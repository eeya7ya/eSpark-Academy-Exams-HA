import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { validateQuestions } from "@/lib/exam";

// GET /api/admin/exams/[lectureId] - full exam (with answers) for the editor
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lectureId } = await params;
  const exam = await getPrismaClient().exam.findUnique({
    where: { lectureId },
  });
  return NextResponse.json({ exam });
}

// PUT /api/admin/exams/[lectureId] - create or update the lecture's exam
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lectureId } = await params;
  try {
    const body = await request.json();
    const {
      title,
      durationMinutes,
      passingPercent,
      maxAttempts,
      shuffleQuestions,
      showAnswers,
      isPublished,
      questions,
    } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Exam title is required" }, { status: 400 });
    }

    const validated = validateQuestions(questions ?? []);
    if (validated.error) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (isPublished && validated.questions!.length === 0) {
      return NextResponse.json(
        { error: "Add at least one question before publishing" },
        { status: 400 }
      );
    }

    const prisma = getPrismaClient();
    const lecture = await prisma.lecture.findUnique({ where: { id: lectureId } });
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const data = {
      title: String(title).trim(),
      durationMinutes: clampInt(durationMinutes, 0, 600, 0),
      passingPercent: clampInt(passingPercent, 0, 100, 60),
      maxAttempts: clampInt(maxAttempts, 1, 100, 1),
      shuffleQuestions: shuffleQuestions === true,
      showAnswers: showAnswers !== false,
      isPublished: isPublished === true,
      questions: validated.questions as object[],
    };

    const exam = await prisma.exam.upsert({
      where: { lectureId },
      create: { lectureId, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, exam });
  } catch {
    return NextResponse.json({ error: "Failed to save exam" }, { status: 500 });
  }
}

// DELETE /api/admin/exams/[lectureId] - remove exam (and its attempts)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lectureId } = await params;
  try {
    await getPrismaClient().exam.delete({ where: { lectureId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete exam" }, { status: 500 });
  }
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof value === "number" ? Math.round(value) : parseInt(String(value));
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
