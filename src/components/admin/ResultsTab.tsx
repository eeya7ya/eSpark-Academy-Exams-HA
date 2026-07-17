"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, BarChart3, RefreshCw } from "lucide-react";
import { type ResultRow, inputCls, btnSecondary } from "./types";

export default function ResultsTab() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [search, setSearch] = useState("");

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
                      <button
                        onClick={() => removeAttempt(r)}
                        className="p-2 rounded-lg text-[#c2554d] hover:bg-[#c2554d]/10 transition cursor-pointer"
                        title="Delete attempt (allows retake)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
