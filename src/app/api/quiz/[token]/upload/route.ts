import { NextRequest, NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getStudentSessionId } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";

// POST /api/quiz/[token]/upload  (multipart: file, questionId)
// Stores one file for an in-progress attempt's upload question and returns
// its metadata; the browser adds it to that question's answer, which is
// graded/persisted at submit time.
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
  const exam = await prisma.exam.findUnique({ where: { token } });
  if (!exam || !exam.isPublished) {
    return NextResponse.json(
      { error: "This exam link is not available" },
      { status: 404 }
    );
  }

  // Must have an open (unsubmitted) attempt to attach uploads to.
  const attempt = await prisma.attempt.findFirst({
    where: { examId: exam.id, studentId: sid, submittedAt: null },
  });
  if (!attempt) {
    return NextResponse.json(
      { error: "Start the exam before uploading" },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploaded = await saveUploadedFile(file, "submissions");
    return NextResponse.json({
      success: true,
      file: {
        filename: uploaded.filename,
        filepath: uploaded.filepath,
        mimetype: uploaded.mimetype,
        size: file.size,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
