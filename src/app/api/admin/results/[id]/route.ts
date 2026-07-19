import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { gradeExam, type Question, type AnswerMap } from "@/lib/exam";

// GET /api/admin/results/[id] - full attempt detail incl. per-question
// answers and any uploaded files (so the instructor can review open tasks)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attempt = await getPrismaClient().attempt.findUnique({
    where: { id },
    include: {
      student: { select: { name: true, username: true } },
      exam: {
        select: {
          title: true,
          questions: true,
          lecture: {
            select: { title: true, course: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const questions = (attempt.exam.questions as unknown as Question[]) || [];
  const answers = (attempt.answers as AnswerMap) || {};
  const { results } = gradeExam(questions, answers);
  const gradeById = new Map(results.map((r) => [r.id, r]));

  const items = questions.map((q) => {
    const g = gradeById.get(q.id);
    const answer = answers[q.id];
    const base = {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      earned: g?.earned ?? 0,
      answer: answer ?? null,
    };
    // Upload answers carry file metadata; expose it for download links.
    if (q.type === "upload") {
      const files = Array.isArray(answer) ? answer : [];
      return { ...base, files };
    }
    if (q.type === "mcq" || q.type === "multi") {
      return { ...base, options: q.options };
    }
    if (q.type === "matching") {
      return { ...base, lefts: q.pairs.map((p) => p.left) };
    }
    return base;
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      student: attempt.student,
      examTitle: attempt.exam.title,
      lectureTitle: attempt.exam.lecture.title,
      courseName: attempt.exam.lecture.course.name,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percent: attempt.percent,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
      items,
    },
  });
}

// DELETE /api/admin/results/[id] - delete an attempt (gives the student a retake)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await getPrismaClient().attempt.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete attempt" }, { status: 500 });
  }
}
