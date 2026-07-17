import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getStudentSessionId } from "@/lib/auth";
import {
  gradeExam,
  buildReview,
  type Question,
  type AnswerMap,
} from "@/lib/exam";

// POST /api/quiz/[token]/submit { attemptId, answers } - grade server-side
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sid = await getStudentSessionId();
  if (!sid) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const prisma = getPrismaClient();
  const exam = await prisma.exam.findUnique({
    where: { token },
    include: {
      lecture: { select: { certificatePath: true } },
    },
  });
  if (!exam || !exam.isPublished) {
    return NextResponse.json(
      { error: "This exam link is not available" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const attemptId = String(body.attemptId || "");
    const answers = (body.answers || {}) as AnswerMap;

    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, examId: exam.id, studentId: sid },
    });
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.submittedAt) {
      return NextResponse.json(
        { error: "This attempt was already submitted" },
        { status: 400 }
      );
    }

    const questions = (exam.questions as unknown as Question[]) || [];
    const graded = gradeExam(questions, answers);
    const passed = graded.percent >= exam.passingPercent;

    await prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        answers: answers as object,
        score: graded.score,
        maxScore: graded.maxScore,
        percent: graded.percent,
        passed,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      score: graded.score,
      maxScore: graded.maxScore,
      percent: graded.percent,
      passed,
      passingPercent: exam.passingPercent,
      certificateUrl:
        passed && exam.lecture.certificatePath
          ? exam.lecture.certificatePath
          : null,
      review: exam.showAnswers ? buildReview(questions, answers) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to submit exam" }, { status: 500 });
  }
}
