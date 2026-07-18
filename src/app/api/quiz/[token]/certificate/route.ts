import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getPrismaClient } from "@/lib/prisma";
import { getStudentSessionId } from "@/lib/auth";
import { getUploadBytes } from "@/lib/upload";

// GET /api/quiz/[token]/certificate
// Generates the student's PERSONALIZED certificate: the lecture's
// uploaded certificate with the student's full name (and pass date)
// drawn onto the blank name/date lines. Only available after passing.
export async function GET(
  _request: NextRequest,
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
      lecture: { select: { certificatePath: true, certificateMime: true } },
    },
  });
  if (!exam || !exam.isPublished || !exam.lecture.certificatePath) {
    return NextResponse.json({ error: "Certificate not available" }, { status: 404 });
  }

  const student = await prisma.student.findUnique({ where: { id: sid } });
  if (!student) {
    return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  }

  const passedAttempt = await prisma.attempt.findFirst({
    where: { examId: exam.id, studentId: sid, passed: true },
    orderBy: { submittedAt: "asc" },
  });
  if (!passedAttempt) {
    return NextResponse.json(
      { error: "Pass the exam to unlock your certificate" },
      { status: 403 }
    );
  }

  const file = await getUploadBytes(exam.lecture.certificatePath);
  if (!file) {
    return NextResponse.json(
      { error: "Certificate file is missing — contact your instructor" },
      { status: 404 }
    );
  }

  const mimetype = file.mimetype || exam.lecture.certificateMime || "";

  try {
    const pdf = await buildPersonalizedPdf(
      file.data,
      mimetype,
      student.name,
      passedAttempt.submittedAt ?? new Date()
    );
    const safeName = student.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "student";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="eSpark-Certificate-${safeName.replace(/ /g, "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Certificate personalization error:", error);
    // Fall back to the original file rather than blocking the student
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": mimetype || "application/octet-stream",
        "Content-Disposition": 'attachment; filename="eSpark-Certificate.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  }
}

async function buildPersonalizedPdf(
  data: Uint8Array,
  mimetype: string,
  studentName: string,
  passDate: Date
): Promise<Uint8Array> {
  let doc: PDFDocument;

  if (mimetype.includes("pdf")) {
    doc = await PDFDocument.load(data);
  } else {
    // Image certificate: wrap it in an A4-landscape PDF page
    doc = await PDFDocument.create();
    const image = mimetype.includes("png")
      ? await doc.embedPng(data)
      : await doc.embedJpg(data);
    const page = doc.addPage([842, 595]);
    page.drawImage(image, { x: 0, y: 0, width: 842, height: 595 });
  }

  const page = doc.getPage(0);
  const { width: W, height: H } = page.getSize();
  const cream = rgb(0.914, 0.894, 0.878);
  const grey = rgb(0.576, 0.639, 0.643);

  // Student name — centered on the blank name line of the eSpark template
  const nameFont = await doc.embedFont(StandardFonts.TimesRomanItalic);
  let nameSize = H * 0.048;
  const maxNameWidth = W * 0.42;
  while (nameSize > 10 && nameFont.widthOfTextAtSize(studentName, nameSize) > maxNameWidth) {
    nameSize -= 1;
  }
  const nameWidth = nameFont.widthOfTextAtSize(studentName, nameSize);
  page.drawText(studentName, {
    x: W / 2 - nameWidth / 2,
    y: H * 0.517,
    size: nameSize,
    font: nameFont,
    color: cream,
  });

  // Pass date — centered on the Date line (bottom left)
  const dateFont = await doc.embedFont(StandardFonts.TimesRoman);
  const dateText = passDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateSize = H * 0.022;
  const dateWidth = dateFont.widthOfTextAtSize(dateText, dateSize);
  page.drawText(dateText, {
    x: W * 0.184 - dateWidth / 2,
    y: H * 0.232,
    size: dateSize,
    font: dateFont,
    color: grey,
  });

  return doc.save();
}
