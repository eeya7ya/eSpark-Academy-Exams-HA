import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, describeDbError } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";

// GET /api/admin/courses - full tree: courses -> lectures -> exam summary
export async function GET() {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const courses = await getPrismaClient().course.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        lectures: {
          orderBy: { sortOrder: "asc" },
          include: {
            exam: {
              select: {
                id: true,
                token: true,
                title: true,
                isPublished: true,
                durationMinutes: true,
                passingPercent: true,
                maxAttempts: true,
                questions: true,
                _count: { select: { attempts: true } },
              },
            },
          },
        },
      },
    });

    // Send question COUNT only in the tree — full exam loads in the editor
    const data = courses.map((c) => ({
      ...c,
      lectures: c.lectures.map((l) => ({
        ...l,
        exam: l.exam
          ? {
              id: l.exam.id,
              token: l.exam.token,
              title: l.exam.title,
              isPublished: l.exam.isPublished,
              durationMinutes: l.exam.durationMinutes,
              passingPercent: l.exam.passingPercent,
              maxAttempts: l.exam.maxAttempts,
              questionCount: Array.isArray(l.exam.questions)
                ? (l.exam.questions as unknown[]).length
                : 0,
              attemptCount: l.exam._count.attempts,
            }
          : null,
      })),
    }));

    return NextResponse.json({ courses: data });
  } catch (error) {
    console.error("Load courses error:", error);
    return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
  }
}

// POST /api/admin/courses - create course
export async function POST(request: NextRequest) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description } = await request.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }

    const course = await getPrismaClient().course.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
      },
    });
    return NextResponse.json({ success: true, course });
  } catch {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
