import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/upload";

// PUT /api/admin/lectures/[id]
// multipart/form-data: title?, description?, certificate? (file),
// removeCertificate? ("true")
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const prisma = getPrismaClient();
    const existing = await prisma.lecture.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const title = formData.get("title");
    const description = formData.get("description");
    const certificate = formData.get("certificate") as File | null;
    const removeCertificate = formData.get("removeCertificate") === "true";

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof description === "string") {
      data.description = description.trim() || null;
    }

    if (certificate && certificate.size > 0) {
      const uploaded = await saveUploadedFile(certificate, "certificates");
      if (existing.certificatePath) {
        await deleteUploadedFile(existing.certificatePath);
      }
      data.certificateName = uploaded.filename;
      data.certificatePath = uploaded.filepath;
      data.certificateMime = uploaded.mimetype;
    } else if (removeCertificate && existing.certificatePath) {
      await deleteUploadedFile(existing.certificatePath);
      data.certificateName = null;
      data.certificatePath = null;
      data.certificateMime = null;
    }

    const lecture = await prisma.lecture.update({ where: { id }, data });
    return NextResponse.json({ success: true, lecture });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update lecture";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/lectures/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const prisma = getPrismaClient();
    const lecture = await prisma.lecture.findUnique({
      where: { id },
      select: { certificatePath: true },
    });
    await prisma.lecture.delete({ where: { id } });
    if (lecture?.certificatePath) {
      await deleteUploadedFile(lecture.certificatePath);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete lecture" }, { status: 500 });
  }
}
