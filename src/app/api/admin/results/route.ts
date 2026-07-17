import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";

// GET /api/admin/results?examId=&studentId= - submitted attempts, newest first
export async function GET(request: NextRequest) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const examId = request.nextUrl.searchParams.get("examId");
  const studentId = request.nextUrl.searchParams.get("studentId");

  const attempts = await getPrismaClient().attempt.findMany({
    where: {
      submittedAt: { not: null },
      ...(examId ? { examId } : {}),
      ...(studentId ? { studentId } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 500,
    include: {
      student: { select: { id: true, name: true, username: true } },
      exam: {
        select: {
          id: true,
          title: true,
          passingPercent: true,
          lecture: {
            select: {
              id: true,
              title: true,
              course: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    results: attempts.map((a) => ({
      id: a.id,
      student: a.student,
      examId: a.exam.id,
      examTitle: a.exam.title,
      lectureTitle: a.exam.lecture.title,
      courseId: a.exam.lecture.course.id,
      courseName: a.exam.lecture.course.name,
      score: a.score,
      maxScore: a.maxScore,
      percent: a.percent,
      passed: a.passed,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
    })),
  });
}
