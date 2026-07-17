import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "26214400"); // 25MB

const useVercelBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const isServerless =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

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

// Always serve local files through the API route — Next.js production
// servers don't serve files added to public/ after the build.
function getUploadUrl(category: string, filename: string): string {
  return `/api/uploads/${category}/${filename}`;
}

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

  let filepath: string;
  if (useVercelBlob) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${category}/${uniqueName}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    filepath = blob.url;
  } else {
    const dir = getUploadDir(category);
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, uniqueName), buffer);
    filepath = getUploadUrl(category, uniqueName);
  }

  return { filename: file.name, filepath, mimetype };
}

export async function deleteUploadedFile(filepath: string): Promise<void> {
  try {
    if (filepath.startsWith("http")) {
      if (!useVercelBlob) return;
      const { del } = await import("@vercel/blob");
      await del(filepath);
    } else if (filepath.startsWith("/api/uploads/")) {
      const relativePath = filepath.replace("/api/uploads/", "");
      if (relativePath.includes("..") || relativePath.includes("\0")) return;
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
