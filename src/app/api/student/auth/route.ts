import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  createStudentSession,
  destroyStudentSession,
  getStudentSessionId,
} from "@/lib/auth";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// POST /api/student/auth - Student login
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now <= entry.resetAt && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const student = await getPrismaClient().student.findUnique({
      where: { username: String(username).trim().toLowerCase() },
    });

    if (!student || !verifyPassword(String(password), student.passwordHash)) {
      if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      } else {
        entry.count++;
      }
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    loginAttempts.delete(ip);
    await createStudentSession(student.id);
    return NextResponse.json({
      success: true,
      student: { id: student.id, name: student.name },
    });
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

// DELETE /api/student/auth - Student logout
export async function DELETE() {
  await destroyStudentSession();
  return NextResponse.json({ success: true });
}

// GET /api/student/auth - Check student session
export async function GET() {
  const sid = await getStudentSessionId();
  if (!sid) return NextResponse.json({ authenticated: false });

  const student = await getPrismaClient().student.findUnique({
    where: { id: sid },
    select: { id: true, name: true },
  });
  if (!student) return NextResponse.json({ authenticated: false });

  return NextResponse.json({ authenticated: true, student });
}
