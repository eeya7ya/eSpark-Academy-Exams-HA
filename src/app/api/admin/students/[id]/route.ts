import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { validateAdminSession } from "@/lib/auth";
import { hashPassword, generatePassword } from "@/lib/password";

// PUT /api/admin/students/[id] - update name and/or reset password
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { name, resetPassword, password } = await request.json();

    const data: Record<string, unknown> = {};
    if (name && String(name).trim()) data.name = String(name).trim();

    let newPassword: string | undefined;
    if (resetPassword) {
      newPassword =
        password && String(password).length >= 6
          ? String(password)
          : generatePassword();
      data.passwordHash = hashPassword(newPassword);
    }

    const student = await getPrismaClient().student.update({
      where: { id },
      data,
      select: { id: true, name: true, username: true },
    });

    return NextResponse.json({
      success: true,
      student,
      ...(newPassword ? { password: newPassword } : {}),
    });
  } catch {
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}

// DELETE /api/admin/students/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await getPrismaClient().student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}
