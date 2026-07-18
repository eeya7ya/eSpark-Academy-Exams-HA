import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { getPrismaClient } from "@/lib/prisma";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "26214400"); // 25MB

// Storage backend priority:
// Cloudflare R2 → Vercel Blob → Postgres (serverless without R2/Blob,
// because /tmp is ephemeral there) → local filesystem (dev)
export const useR2 = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET
);
const useVercelBlob = !useR2 && !!process.env.BLOB_READ_WRITE_TOKEN;
const isServerless =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const useDbStorage = isServerless && !useR2 && !useVercelBlob;

export type UploadCategory = "certificates" | "question-images";

const ALLOWED_EXTENSIONS: Record<UploadCategory, string[]> = {
  certificates: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
  "question-images": [".png", ".jpg", ".jpeg", ".webp"],
};

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function sanitiseFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getUploadDir(category: string): string {
  if (isServerless) return path.join("/tmp", "uploads", category);
  return path.join(process.cwd(), "public", "uploads", category);
}

// ── Cloudflare R2 (S3-compatible) backend ───────────────────────────

interface S3LikeClient {
  send(cmd: unknown): Promise<unknown>;
}

let cachedR2Client: S3LikeClient | null = null;

export async function getR2Client(): Promise<S3LikeClient> {
  if (cachedR2Client) return cachedR2Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  cachedR2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  }) as unknown as S3LikeClient;
  return cachedR2Client;
}

function r2PublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  // Private bucket: proxy through our own API route
  return `/api/uploads/${key.replace(/^uploads\//, "")}`;
}

async function saveToR2(
  file: File,
  key: string,
  mimetype: string
): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getR2Client();
  const body = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: mimetype,
      ContentLength: body.length,
    })
  );

  return r2PublicUrl(key);
}

async function deleteFromR2(url: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getR2Client();

  // Recover the key from either a public URL or a proxied path
  let key: string | null = null;
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase && url.startsWith(publicBase)) {
    key = url.slice(publicBase.replace(/\/$/, "").length + 1);
  } else if (url.startsWith("/api/uploads/")) {
    key = "uploads/" + url.replace("/api/uploads/", "");
  } else if (url.startsWith("uploads/")) {
    key = url;
  }
  if (!key || key.includes("..") || key.includes("\0")) return;

  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
    })
  );
}

// ── Postgres storage (fallback when serverless without R2/Blob) ─────

// Creates the table on demand so deployments that predate this model
// (or ones set up via the SQL editor) don't need a manual migration.
async function ensureStoredFileTable(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "StoredFile" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "mimetype" TEXT NOT NULL,
      "data" BYTEA NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "StoredFile_key_key" ON "StoredFile"("key")`
  );
}

async function saveToDb(
  key: string,
  data: Buffer,
  mimetype: string
): Promise<void> {
  await ensureStoredFileTable();
  const bytes = new Uint8Array(data);
  await getPrismaClient().storedFile.upsert({
    where: { key },
    create: { key, mimetype, data: bytes },
    update: { mimetype, data: bytes },
  });
}

export async function getStoredFile(
  key: string
): Promise<{ data: Uint8Array; mimetype: string } | null> {
  try {
    const file = await getPrismaClient().storedFile.findUnique({
      where: { key },
    });
    if (!file) return null;
    return { data: file.data as Uint8Array, mimetype: file.mimetype };
  } catch {
    return null; // table may not exist yet
  }
}

// Resolve a stored filepath (any backend) to raw bytes — used by the
// certificate personalization endpoint.
export async function getUploadBytes(
  filepath: string
): Promise<{ data: Uint8Array; mimetype: string } | null> {
  if (filepath.startsWith("/api/uploads/")) {
    const key = filepath.replace("/api/uploads/", "");
    if (key.includes("..") || key.includes("\0")) return null;

    const stored = await getStoredFile(key);
    if (stored) return stored;

    const { readFile } = await import("fs/promises");
    const roots = [
      path.join("/tmp", "uploads"),
      path.join(process.cwd(), "public", "uploads"),
    ];
    for (const root of roots) {
      try {
        const data = await readFile(path.join(root, key));
        return {
          data: new Uint8Array(data),
          mimetype: EXT_TO_MIME[path.extname(key).toLowerCase()] || "",
        };
      } catch {
        // try next
      }
    }

    if (useR2) {
      try {
        const { GetObjectCommand } = await import("@aws-sdk/client-s3");
        const client = await getR2Client();
        const result = (await client.send(
          new GetObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: `uploads/${key}`,
          })
        )) as { Body?: { transformToByteArray(): Promise<Uint8Array> }; ContentType?: string };
        if (result.Body) {
          return {
            data: await result.Body.transformToByteArray(),
            mimetype: result.ContentType || "",
          };
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  if (filepath.startsWith("http")) {
    try {
      const res = await fetch(filepath);
      if (!res.ok) return null;
      return {
        data: new Uint8Array(await res.arrayBuffer()),
        mimetype: res.headers.get("content-type") || "",
      };
    } catch {
      return null;
    }
  }

  return null;
}

async function deleteFromDb(key: string): Promise<void> {
  await getPrismaClient()
    .storedFile.delete({ where: { key } })
    .catch(() => {});
}

// ── Public API ──────────────────────────────────────────────────────

export async function saveUploadedFile(
  file: File,
  category: UploadCategory
): Promise<{ filename: string; filepath: string; mimetype: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
    );
  }
  if (file.size === 0) {
    throw new Error("Empty files are not allowed");
  }

  const safeName = sanitiseFilename(file.name);
  const ext = path.extname(safeName).toLowerCase();
  const allowed = ALLOWED_EXTENSIONS[category];
  if (!ext || !allowed.includes(ext)) {
    throw new Error(
      `File extension "${ext || "(none)"}" is not allowed. Allowed: ${allowed.join(", ")}`
    );
  }

  const mimetype = EXT_TO_MIME[ext] || "application/octet-stream";
  const uniqueName = `${Date.now()}-${safeName}`;
  const key = `uploads/${category}/${uniqueName}`;

  let filepath: string;
  if (useR2) {
    filepath = await saveToR2(file, key, mimetype);
  } else if (useVercelBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
    });
    filepath = blob.url;
  } else if (useDbStorage) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await saveToDb(`${category}/${uniqueName}`, buffer, mimetype);
    filepath = `/api/uploads/${category}/${uniqueName}`;
  } else {
    const dir = getUploadDir(category);
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, uniqueName), buffer);
    // Served through the API route — Next.js production servers don't
    // serve files added to public/ after the build.
    filepath = `/api/uploads/${category}/${uniqueName}`;
  }

  return { filename: file.name, filepath, mimetype };
}

export async function deleteUploadedFile(filepath: string): Promise<void> {
  try {
    const publicBase = process.env.R2_PUBLIC_URL;
    const isR2Url =
      useR2 &&
      ((publicBase && filepath.startsWith(publicBase)) ||
        filepath.startsWith("/api/uploads/"));

    if (isR2Url) {
      await deleteFromR2(filepath);
      return;
    }

    if (filepath.startsWith("http")) {
      if (!useVercelBlob) return;
      const { del } = await import("@vercel/blob");
      await del(filepath);
    } else if (filepath.startsWith("/api/uploads/")) {
      const relativePath = filepath.replace("/api/uploads/", "");
      if (relativePath.includes("..") || relativePath.includes("\0")) return;
      await deleteFromDb(relativePath);
      const roots = [
        path.join("/tmp", "uploads"),
        path.join(process.cwd(), "public", "uploads"),
      ];
      for (const root of roots) {
        await unlink(path.join(root, relativePath)).catch(() => {});
      }
    } else {
      if (filepath.includes("..") || filepath.includes("\0")) return;
      await unlink(path.join(process.cwd(), "public", filepath));
    }
  } catch {
    // File may already be deleted
  }
}
