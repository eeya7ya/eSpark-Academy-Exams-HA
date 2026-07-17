import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getStudentSessionId } from "@/lib/auth";
import { sanitizeForStudent, type Question } from "@/lib/exam";

// POST /api/quiz/[token]/start - begin (or resume) an attempt.
// Returns sanitized questions — correct answers never leave the server.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sid = await getStudentSessionId();
  if (!sid) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const exam = await prisma.exam.findUnique({ where: { token } });
  if (!exam || !exam.isPublished) {
    return NextResponse.json(
      { error: "This exam link is not available" },
      { status: 404 }
    );
  }

  const student = await prisma.student.findUnique({ where: { id: sid } });
  if (!student) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const submittedCount = await prisma.attempt.count({
    where: { examId: exam.id, studentId: sid, submittedAt: { not: null } },
  });

  // Resume an in-progress attempt if one exists
  let attempt = await prisma.attempt.findFirst({
    where: { examId: exam.id, studentId: sid, submittedAt: null },
  });

  if (!attempt) {
    if (submittedCount >= exam.maxAttempts) {
      return NextResponse.json(
        { error: "You have used all your attempts for this exam" },
        { status: 403 }
      );
    }
    attempt = await prisma.attempt.create({
      data: { examId: exam.id, studentId: sid },
    });
  }

  const questions = sanitizeForStudent(
    (exam.questions as unknown as Question[]) || [],
    exam.shuffleQuestions
  );

  const endsAt =
    exam.durationMinutes > 0
      ? new Date(
          attempt.startedAt.getTime() + exam.durationMinutes * 60 * 1000
        ).toISOString()
      : null;

  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    endsAt,
    questions,
  });
}
