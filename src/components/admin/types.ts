// Client-side types for the admin dashboard

export interface ExamSummary {
  id: string;
  token: string;
  title: string;
  isPublished: boolean;
  durationMinutes: number;
  passingPercent: number;
  maxAttempts: number;
  questionCount: number;
  attemptCount: number;
}

export interface LectureNode {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  certificateName: string | null;
  certificatePath: string | null;
  exam: ExamSummary | null;
}

export interface CourseNode {
  id: string;
  name: string;
  description: string | null;
  lectures: LectureNode[];
}

export interface StudentRow {
  id: string;
  name: string;
  username: string;
  createdAt: string;
  attemptCount: number;
}

export interface ResultRow {
  id: string;
  student: { id: string; name: string; username: string };
  examId: string;
  examTitle: string;
  lectureTitle: string;
  courseId: string;
  courseName: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  startedAt: string;
  submittedAt: string;
}

// Shared light-theme styles (matches the eSpark admin panel)
export const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#ded7cd] text-[#2b2f30] placeholder:text-[#a8a299] focus:outline-none focus:border-[#5b7884] focus:ring-2 focus:ring-[#5b7884]/15 transition text-sm";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#5b7884] hover:bg-[#4c626a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition cursor-pointer";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white border border-[#ded7cd] hover:border-[#5b7884] text-[#2b2f30] font-medium text-sm transition cursor-pointer";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 text-xs font-medium transition cursor-pointer";
