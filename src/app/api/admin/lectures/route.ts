import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";

// POST /api/admin/lectures - create lecture in a course
export async function POST(request: NextRequest) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { courseId, title, description } = await request.json();
    if (!courseId || !title || !String(title).trim()) {
      return NextResponse.json(
        { error: "Course and lecture title are required" },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    const last = await prisma.lecture.findFirst({
      where: { courseId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const lecture = await prisma.lecture.create({
      data: {
        courseId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ success: true, lecture });
  } catch {
    return NextResponse.json({ error: "Failed to create lecture" }, { status: 500 });
  }
}
