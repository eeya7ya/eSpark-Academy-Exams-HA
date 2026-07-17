import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { useR2, getR2Client } from "@/lib/upload";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Serves uploaded files (certificates, question images).
// - Cloudflare R2 configured  → streams the object from the bucket
//   (used when the bucket is private / no R2_PUBLIC_URL is set)
// - otherwise                 → local filesystem (public/uploads in dev,
//   /tmp/uploads on serverless without R2/Blob)
// With Vercel Blob or a public R2 URL, file URLs are absolute and this
// route is never used.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relative = segments.join("/");

  if (relative.includes("..") || relative.includes("\0")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const ext = path.extname(relative).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  if (useR2) {
    return streamFromR2(relative, mime);
  }

  const roots = [
    path.join(process.cwd(), "public", "uploads"),
    path.join("/tmp", "uploads"),
  ];

  for (const root of roots) {
    try {
      const data = await readFile(path.join(root, relative));
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // try next root
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}

async function streamFromR2(relative: string, mime: string): Promise<Response> {
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getR2Client();
    const result = (await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: `uploads/${relative}`,
      })
    )) as {
      Body?: unknown;
      ContentType?: string;
      ContentLength?: number;
    };

    const body = result.Body as ReadableStream | null;
    if (!body) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType || mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    if (result.ContentLength !== undefined) {
      headers["Content-Length"] = String(result.ContentLength);
    }

    return new Response(body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
