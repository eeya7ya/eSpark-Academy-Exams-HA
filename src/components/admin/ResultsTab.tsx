"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Trash2,
  BarChart3,
  RefreshCw,
  Eye,
  Paperclip,
  Download,
} from "lucide-react";
import { type ResultRow, inputCls, btnSecondary } from "./types";
import { Modal } from "./CoursesTab";

interface AttemptItem {
  id: string;
  type: string;
  prompt: string;
  points: number;
  earned: number;
  answer: unknown;
  options?: string[];
  lefts?: string[];
  files?: { filename: string; filepath: string; mimetype: string; size?: number }[];
}

interface AttemptDetail {
  id: string;
  student: { name: string; username: string };
  examTitle: string;
  lectureTitle: string;
  courseName: string;
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
  items: AttemptItem[];
}

export default function ResultsTab() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/results/${id}`);
      const data = await res.json();
      if (res.ok) setDetail(data.attempt);
      else alert(data.error || "Failed to load attempt");
    } finally {
      setDetailLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/results", {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResults(data.results);
        setError(null);
      } else setError(data.error || `Failed to load results (HTTP ${res.status})`);
    } catch {
      setError(
        "Could not reach the server. Check the database configuration and retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of results) map.set(r.courseId, r.courseName);
    return [...map.entries()];
  }, [results]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (courseFilter && r.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        r.student.name.toLowerCase().includes(q) ||
        r.student.username.toLowerCase().includes(q) ||
        r.examTitle.toLowerCase().includes(q) ||
        r.lectureTitle.toLowerCase().includes(q)
      );
    });
  }, [results, courseFilter, search]);

  const removeAttempt = async (r: ResultRow) => {
    if (
      !confirm(
        `Delete this attempt by ${r.student.name} (${r.percent}%)? This frees one retake for the student.`
      )
    )
      return;
    const res = await fetch(`/api/admin/results/${r.id}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("Failed to delete attempt");
  };

  if (loading) {
    return <div className="h-48 rounded-2xl animate-shimmer bg-white" />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold">Results</h2>
          <p className="text-xs text-[#9b958c] mt-0.5">
            Every submitted exam attempt with score and pass/fail state.
          </p>
        </div>
        <button onClick={load} className={btnSecondary + " !py-2 !px-3 !text-xs"}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[#c2554d]/10 border border-[#c2554d]/20 text-[#c2554d] text-sm mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="flex-1 min-w-[200px]">{error}</span>
          <button
            onClick={load}
            className="shrink-0 px-3 py-1.5 rounded-md bg-[#c2554d] text-white text-xs font-semibold hover:bg-[#a8463f] transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, exam or lecture…"
          className={inputCls + " !w-64"}
        />
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className={inputCls + " !w-56"}
        >
          <option value="">All courses</option>
          {courses.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#e6e1da] rounded-2xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-[#ded7cd] mx-auto mb-3" />
          <p className="text-sm text-[#76716a] font-medium">No results yet</p>
          <p className="text-xs text-[#9b958c] mt-1">
            Results appear here as soon as students submit their exams.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#e6e1da] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0ebe5] text-left text-[11px] uppercase tracking-wide text-[#9b958c]">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course / Lecture</th>
                  <th className="px-4 py-3 font-semibold">Exam</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[#f0ebe5] last:border-0 hover:bg-[#faf8f5]"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.student.name}</div>
                      <div className="text-[11px] text-[#9b958c] font-mono">
                        {r.student.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#76716a]">
                      <div className="text-xs font-medium">{r.courseName}</div>
                      <div className="text-[11px] text-[#9b958c]">
                        {r.lectureTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#76716a] text-xs">
                      {r.examTitle}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{r.percent}%</span>{" "}
                      <span className="text-[11px] text-[#9b958c]">
                        ({r.score}/{r.maxScore})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] font-bold px-2 py-1 rounded-md ${
                          r.passed
                            ? "bg-[#7da384]/15 text-[#4f7a58]"
                            : "bg-[#c2554d]/10 text-[#c2554d]"
                        }`}
                      >
                        {r.passed ? "PASSED" : "FAILED"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#9b958c] text-xs whitespace-nowrap">
                      {new Date(r.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openDetail(r.id)}
                          className="p-2 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
                          title="View answers & uploaded files"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeAttempt(r)}
                          className="p-2 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                          title="Delete attempt (allows retake)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {detail && (
        <AttemptDetailModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function AttemptDetailModal({
  detail,
  onClose,
}: {
  detail: AttemptDetail;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`${detail.student.name} · ${detail.percent}% (${detail.passed ? "Passed" : "Failed"})`}
      onClose={onClose}
    >
      <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1 space-y-3">
        <p className="text-xs text-[#9b958c]">
          {detail.courseName} · {detail.lectureTitle} — {detail.score}/
          {detail.maxScore} points
        </p>
        {detail.items.map((item, i) => (
          <div
            key={item.id}
            className="bg-[#faf8f5] border border-[#e6e1da] rounded-xl p-3.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-[#2b2f30]">
                {i + 1}. {item.prompt}
              </p>
              <span className="shrink-0 text-[11px] font-semibold text-[#76716a]">
                {item.earned}/{item.points}
              </span>
            </div>
            {item.type === "upload" ? (
              <div className="mt-2 space-y-1.5">
                {item.files && item.files.length > 0 ? (
                  item.files.map((f, j) => (
                    <a
                      key={j}
                      href={f.filepath}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#e6e1da] hover:border-[#5b7884] text-xs text-[#4c626a] transition"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 truncate">{f.filename}</span>
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ))
                ) : (
                  <p className="text-[11px] text-[#c2554d]">No file submitted</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#76716a] mt-1.5">
                {formatAdminAnswer(item)}
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function formatAdminAnswer(item: AttemptItem): string {
  const a = item.answer;
  if (a === null || a === undefined) return "— no answer —";
  switch (item.type) {
    case "mcq":
      return typeof a === "number" ? (item.options?.[a] ?? String(a)) : String(a);
    case "multi":
      return Array.isArray(a)
        ? (a as number[]).map((i) => item.options?.[i] ?? i).join(", ")
        : String(a);
    case "truefalse":
      return a === true ? "True" : a === false ? "False" : String(a);
    case "fillblank":
      return String(a);
    case "ordering":
      return Array.isArray(a) ? (a as string[]).join(" → ") : String(a);
    case "matching":
      return Array.isArray(a)
        ? (a as (string | null)[])
            .map((r, i) => `${item.lefts?.[i] ?? i + 1}: ${r ?? "—"}`)
            .join(" · ")
        : String(a);
    default:
      return String(a);
  }
}
