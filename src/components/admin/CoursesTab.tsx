"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Award,
  FileQuestion,
  Link2,
  Check,
  Upload,
  X,
  BookOpen,
} from "lucide-react";
import {
  type CourseNode,
  type LectureNode,
  inputCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from "./types";
import ExamEditor from "./ExamEditor";

export default function CoursesTab() {
  const [courses, setCourses] = useState<CourseNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [examLecture, setExamLecture] = useState<LectureNode | null>(null);

  // Course form state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseNode | null>(null);
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/courses");
      const data = await res.json();
      if (res.ok) {
        setCourses(data.courses);
        setError(null);
      } else {
        setError(data.error || "Failed to load courses");
      }
    } catch {
      setError("Network error while loading courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseName("");
    setCourseDesc("");
    setShowCourseForm(true);
  };

  const openEditCourse = (course: CourseNode) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setCourseDesc(course.description || "");
    setShowCourseForm(true);
  };

  const saveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editingCourse
          ? `/api/admin/courses/${editingCourse.id}`
          : "/api/admin/courses",
        {
          method: editingCourse ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: courseName, description: courseDesc }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setShowCourseForm(false);
        await load();
      } else {
        alert(data.error || "Failed to save course");
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCourse = async (course: CourseNode) => {
    if (
      !confirm(
        `Delete course "${course.name}" with all its lectures, exams and results? This cannot be undone.`
      )
    )
      return;
    const res = await fetch(`/api/admin/courses/${course.id}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
    else alert("Failed to delete course");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-2xl animate-shimmer bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Courses</h2>
          <p className="text-xs text-[#9b958c] mt-0.5">
            Course → lectures → exam &amp; certificate. Share each exam link
            with your students.
          </p>
        </div>
        <button onClick={openCreateCourse} className={btnPrimary}>
          <Plus className="w-4 h-4" />
          New course
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#c2554d]/10 border border-[#c2554d]/20 text-[#c2554d] text-sm mb-4">
          {error}
        </div>
      )}

      {courses.length === 0 && !error && (
        <div className="bg-white border border-[#e6e1da] rounded-2xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-[#ded7cd] mx-auto mb-3" />
          <p className="text-sm text-[#76716a] font-medium">No courses yet</p>
          <p className="text-xs text-[#9b958c] mt-1">
            Create your first course (e.g. &ldquo;Home Automation&rdquo;) to
            start adding lectures and exams.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white border border-[#e6e1da] rounded-2xl overflow-hidden"
          >
            {/* Course header */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-4">
              <button
                onClick={() => toggleExpand(course.id)}
                className="p-1 rounded-md hover:bg-[#f4f0ec] transition cursor-pointer"
                aria-label="Toggle course"
              >
                {expanded.has(course.id) ? (
                  <ChevronDown className="w-4 h-4 text-[#76716a]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#76716a]" />
                )}
              </button>
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => toggleExpand(course.id)}
              >
                <h3 className="font-semibold text-sm truncate">{course.name}</h3>
                <p className="text-xs text-[#9b958c] truncate">
                  {course.lectures.length} lecture
                  {course.lectures.length === 1 ? "" : "s"}
                  {course.description ? ` · ${course.description}` : ""}
                </p>
              </div>
              <button
                onClick={() => openEditCourse(course)}
                className="p-2 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
                aria-label="Edit course"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteCourse(course)}
                className="p-2 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                aria-label="Delete course"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Lectures */}
            {expanded.has(course.id) && (
              <div className="border-t border-[#f0ebe5] px-4 sm:px-5 py-4 bg-[#faf8f5]">
                <LectureList
                  course={course}
                  onChanged={load}
                  onEditExam={(lecture) => setExamLecture(lecture)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Course create/edit modal */}
      {showCourseForm && (
        <Modal
          title={editingCourse ? "Edit course" : "New course"}
          onClose={() => setShowCourseForm(false)}
        >
          <form onSubmit={saveCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Course name
              </label>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. Home Automation"
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Description (optional)
              </label>
              <textarea
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                placeholder="Short description of the course"
                rows={3}
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowCourseForm(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : editingCourse ? "Save changes" : "Create course"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Exam editor overlay */}
      {examLecture && (
        <ExamEditor
          lecture={examLecture}
          onClose={() => setExamLecture(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── Lectures inside a course ─────────────────────────────────────────

function LectureList({
  course,
  onChanged,
  onEditExam,
}: {
  course: CourseNode;
  onChanged: () => Promise<void>;
  onEditExam: (lecture: LectureNode) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LectureNode | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCertFor, setUploadingCertFor] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDesc("");
    setShowForm(true);
  };

  const openEdit = (lecture: LectureNode) => {
    setEditing(lecture);
    setTitle(lecture.title);
    setDesc(lecture.description || "");
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const formData = new FormData();
        formData.set("title", title);
        formData.set("description", desc);
        const res = await fetch(`/api/admin/lectures/${editing.id}`, {
          method: "PUT",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to save lecture");
          return;
        }
      } else {
        const res = await fetch("/api/admin/lectures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: course.id, title, description: desc }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to create lecture");
          return;
        }
      }
      setShowForm(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (lecture: LectureNode) => {
    if (
      !confirm(
        `Delete lecture "${lecture.title}"${lecture.exam ? " and its exam/results" : ""}?`
      )
    )
      return;
    const res = await fetch(`/api/admin/lectures/${lecture.id}`, {
      method: "DELETE",
    });
    if (res.ok) await onChanged();
    else alert("Failed to delete lecture");
  };

  const uploadCertificate = async (lecture: LectureNode, file: File) => {
    setUploadingCertFor(lecture.id);
    try {
      const formData = new FormData();
      formData.set("certificate", file);
      const res = await fetch(`/api/admin/lectures/${lecture.id}`, {
        method: "PUT",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to upload certificate");
      await onChanged();
    } finally {
      setUploadingCertFor(null);
    }
  };

  const removeCertificate = async (lecture: LectureNode) => {
    if (!confirm(`Remove the certificate from "${lecture.title}"?`)) return;
    const formData = new FormData();
    formData.set("removeCertificate", "true");
    const res = await fetch(`/api/admin/lectures/${lecture.id}`, {
      method: "PUT",
      body: formData,
    });
    if (res.ok) await onChanged();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/quiz/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  return (
    <div>
      <div className="space-y-2">
        {course.lectures.length === 0 && (
          <p className="text-xs text-[#9b958c] py-2">
            No lectures yet — add the first lecture of this course.
          </p>
        )}

        {course.lectures.map((lecture) => (
          <div
            key={lecture.id}
            className="bg-white border border-[#e6e1da] rounded-xl px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[180px]">
                <h4 className="text-sm font-semibold">{lecture.title}</h4>
                {lecture.description && (
                  <p className="text-xs text-[#9b958c] mt-0.5">
                    {lecture.description}
                  </p>
                )}
              </div>

              {/* Exam status / actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {lecture.exam ? (
                  <>
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded-md ${
                        lecture.exam.isPublished
                          ? "bg-[#7da384]/15 text-[#4f7a58]"
                          : "bg-[#e9b44c]/15 text-[#9a7422]"
                      }`}
                    >
                      {lecture.exam.isPublished ? "Published" : "Draft"} ·{" "}
                      {lecture.exam.questionCount} Q
                    </span>
                    <button
                      onClick={() => copyLink(lecture.exam!.token)}
                      className={btnSecondary + " !py-1.5 !px-2.5 !text-xs"}
                      title="Copy the student exam link"
                    >
                      {copiedToken === lecture.exam.token ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#4f7a58]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5" />
                          Exam link
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-[#f4f0ec] text-[#9b958c]">
                    No exam
                  </span>
                )}
                <button
                  onClick={() => onEditExam(lecture)}
                  className={btnSecondary + " !py-1.5 !px-2.5 !text-xs"}
                >
                  <FileQuestion className="w-3.5 h-3.5" />
                  {lecture.exam ? "Edit exam" : "Create exam"}
                </button>

                {/* Certificate */}
                {lecture.certificatePath ? (
                  <span className="inline-flex items-center gap-1">
                    <a
                      href={lecture.certificatePath}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-[#5b7884]/10 text-[#4c626a] hover:bg-[#5b7884]/20 transition"
                      title={lecture.certificateName || "Certificate"}
                    >
                      <Award className="w-3.5 h-3.5" />
                      Certificate
                    </a>
                    <button
                      onClick={() => removeCertificate(lecture)}
                      className="p-1 rounded text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                      title="Remove certificate"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : (
                  <label
                    className={
                      btnSecondary +
                      " !py-1.5 !px-2.5 !text-xs " +
                      (uploadingCertFor === lecture.id
                        ? "opacity-50 pointer-events-none"
                        : "")
                    }
                    title="Upload certificate (PDF or image) given after passing"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingCertFor === lecture.id
                      ? "Uploading…"
                      : "Certificate"}
                    <input
                      ref={certInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadCertificate(lecture, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}

                <button
                  onClick={() => openEdit(lecture)}
                  className="p-1.5 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
                  aria-label="Edit lecture"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(lecture)}
                  className="p-1.5 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                  aria-label="Delete lecture"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={openCreate}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#4c626a] hover:text-[#2b2f30] transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Add lecture
      </button>

      {showForm && (
        <Modal
          title={editing ? "Edit lecture" : `New lecture in ${course.name}`}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Lecture title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lecture 1 — Sensors & Relays"
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#76716a] mb-2">
                Description (optional)
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add lecture"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Tiny modal ───────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#e6e1da] shadow-xl p-6 text-[#2b2f30]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-sm">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
