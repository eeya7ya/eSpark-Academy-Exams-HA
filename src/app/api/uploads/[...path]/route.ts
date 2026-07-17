import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Serves locally-stored uploads (dev: public/uploads, serverless without
// Blob: /tmp/uploads). With Vercel Blob configured, file URLs are absolute
// and this route is never used.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const relative = segments.join("/");

  if (relative.includes("..") || relative.includes("\0")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const roots = [
    path.join(process.cwd(), "public", "uploads"),
    path.join("/tmp", "uploads"),
  ];

  try {
    let data: Buffer | null = null;
    let filePath = "";
    for (const root of roots) {
      try {
        filePath = path.join(root, relative);
        data = await readFile(filePath);
        break;
      } catch {
        data = null;
      }
    }
    if (!data) throw new Error("not found");
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
      }[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
