import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getStudentSessionId } from "@/lib/auth";

// GET /api/quiz/[token] - exam info for the student entry page.
// Works logged-out (safe metadata only) so the login screen can show
// which exam the link points to.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const prisma = getPrismaClient();

  const exam = await prisma.exam.findUnique({
    where: { token },
    include: {
      lecture: {
        select: {
          title: true,
          certificatePath: true,
          course: { select: { name: true } },
        },
      },
    },
  });

  if (!exam || !exam.isPublished) {
    return NextResponse.json(
      { error: "This exam link is not available" },
      { status: 404 }
    );
  }

  const questionCount = Array.isArray(exam.questions)
    ? (exam.questions as unknown[]).length
    : 0;

  const info = {
    title: exam.title,
    lectureTitle: exam.lecture.title,
    courseName: exam.lecture.course.name,
    questionCount,
    durationMinutes: exam.durationMinutes,
    passingPercent: exam.passingPercent,
    maxAttempts: exam.maxAttempts,
    hasCertificate: !!exam.lecture.certificatePath,
  };

  const sid = await getStudentSessionId();
  if (!sid) {
    return NextResponse.json({ authenticated: false, exam: info });
  }

  const student = await prisma.student.findUnique({
    where: { id: sid },
    select: { id: true, name: true },
  });
  if (!student) {
    return NextResponse.json({ authenticated: false, exam: info });
  }

  const attempts = await prisma.attempt.findMany({
    where: { examId: exam.id, studentId: student.id, submittedAt: { not: null } },
    orderBy: { percent: "desc" },
    select: { percent: true, passed: true, score: true, maxScore: true },
  });

  const best = attempts[0] ?? null;
  const passed = !!best?.passed;

  return NextResponse.json({
    authenticated: true,
    student,
    exam: info,
    attemptsUsed: attempts.length,
    attemptsLeft: Math.max(0, exam.maxAttempts - attempts.length),
    bestResult: best,
    certificateUrl:
      passed && exam.lecture.certificatePath ? exam.lecture.certificatePath : null,
  });
}
