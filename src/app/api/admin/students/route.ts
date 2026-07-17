import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient, describeDbError } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { hashPassword, generatePassword } from "@/lib/password";

// GET /api/admin/students - list students with attempt counts
export async function GET() {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const students = await getPrismaClient().student.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        createdAt: true,
        _count: { select: { attempts: true } },
      },
    });

    return NextResponse.json({
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        username: s.username,
        createdAt: s.createdAt,
        attemptCount: s._count.attempts,
      })),
    });
  } catch (error) {
    console.error("Load students error:", error);
    return NextResponse.json({ error: describeDbError(error) }, { status: 500 });
  }
}

// POST /api/admin/students - create student (password auto-generated if omitted)
export async function POST(request: NextRequest) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, username, password } = await request.json();
    if (!name || !String(name).trim() || !username || !String(username).trim()) {
      return NextResponse.json(
        { error: "Name and username are required" },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-40 characters: letters, numbers, dots, dashes or underscores",
        },
        { status: 400 }
      );
    }

    const finalPassword =
      password && String(password).length >= 6
        ? String(password)
        : generatePassword();

    const prisma = getPrismaClient();
    const exists = await prisma.student.findUnique({
      where: { username: cleanUsername },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        name: String(name).trim(),
        username: cleanUsername,
        passwordHash: hashPassword(finalPassword),
      },
      select: { id: true, name: true, username: true, createdAt: true },
    });

    // Password is returned ONCE so the admin can hand it to the student
    return NextResponse.json({ success: true, student, password: finalPassword });
  } catch {
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
