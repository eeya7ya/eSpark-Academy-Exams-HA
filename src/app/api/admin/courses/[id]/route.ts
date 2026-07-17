import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { deleteUploadedFile } from "@/lib/upload";

// PUT /api/admin/courses/[id] - update course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { name, description } = await request.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }

    const course = await getPrismaClient().course.update({
      where: { id },
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
      },
    });
    return NextResponse.json({ success: true, course });
  } catch {
    return NextResponse.json({ error: "Failed to update course" }, { status: 500 });
  }
}

// DELETE /api/admin/courses/[id] - delete course (cascades to lectures/exams)
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
    const lectures = await prisma.lecture.findMany({
      where: { courseId: id },
      select: { certificatePath: true },
    });
    await prisma.course.delete({ where: { id } });

    // Best-effort cleanup of uploaded certificates
    for (const l of lectures) {
      if (l.certificatePath) await deleteUploadedFile(l.certificatePath);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 });
  }
}
