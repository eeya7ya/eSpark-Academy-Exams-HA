"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Download,
  Link2,
  Check,
  ListChecks,
  CheckSquare,
  ToggleLeft,
  Type,
  ArrowUpDown,
  Shuffle,
} from "lucide-react";
import type { Question, QuestionType } from "@/lib/exam";
import { type LectureNode, inputCls, btnPrimary, btnSecondary, btnDanger } from "./types";

const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  icon: typeof ListChecks;
}[] = [
  { type: "mcq", label: "Multiple choice", icon: ListChecks },
  { type: "multi", label: "Multiple select", icon: CheckSquare },
  { type: "truefalse", label: "True / False", icon: ToggleLeft },
  { type: "fillblank", label: "Fill in the blank", icon: Type },
  { type: "ordering", label: "Put in order", icon: ArrowUpDown },
  { type: "matching", label: "Matching", icon: Shuffle },
];

const TEMPLATE: Question[] = [
  {
    id: "q1",
    type: "mcq",
    prompt: "Which device switches a high-power load using a low-power signal?",
    points: 1,
    options: ["Relay", "Resistor", "Capacitor", "Diode"],
    correct: 0,
    explanation: "A relay lets a small control signal switch a big load.",
  },
  {
    id: "q2",
    type: "multi",
    prompt: "Select ALL wireless protocols used in home automation.",
    points: 2,
    options: ["Zigbee", "HDMI", "Z-Wave", "VGA", "Wi-Fi"],
    correct: [0, 2, 4],
  },
  {
    id: "q3",
    type: "truefalse",
    prompt: "A PIR sensor detects motion using infrared radiation.",
    points: 1,
    correct: true,
  },
  {
    id: "q4",
    type: "fillblank",
    prompt: "The microcontroller board family commonly used with the ESP32 is made by _____.",
    points: 1,
    answers: ["Espressif", "espressif systems"],
  },
  {
    id: "q5",
    type: "ordering",
    prompt: "Order the steps to flash a firmware (first to last).",
    points: 2,
    items: [
      "Connect the board via USB",
      "Select the correct COM port",
      "Compile the sketch",
      "Upload the firmware",
    ],
  },
  {
    id: "q6",
    type: "matching",
    prompt: "Match each sensor to what it measures.",
    points: 2,
    pairs: [
      { left: "DHT22", right: "Temperature & humidity" },
      { left: "PIR", right: "Motion" },
      { left: "LDR", right: "Light level" },
    ],
  },
];

interface ExamState {
  title: string;
  durationMinutes: number;
  passingPercent: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  showAnswers: boolean;
  isPublished: boolean;
  questions: Question[];
  token?: string;
}

export default function ExamEditor({
  lecture,
  onClose,
  onSaved,
}: {
  lecture: LectureNode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [exam, setExam] = useState<ExamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [copied, setCopied] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/admin/exams/${lecture.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.exam) {
          setExam({
            title: d.exam.title,
            durationMinutes: d.exam.durationMinutes,
            passingPercent: d.exam.passingPercent,
            maxAttempts: d.exam.maxAttempts,
            shuffleQuestions: d.exam.shuffleQuestions,
            showAnswers: d.exam.showAnswers,
            isPublished: d.exam.isPublished,
            questions: (d.exam.questions as Question[]) || [],
            token: d.exam.token,
          });
        } else {
          setExam({
            title: `${lecture.title} — Exam`,
            durationMinutes: 0,
            passingPercent: 60,
            maxAttempts: 1,
            shuffleQuestions: false,
            showAnswers: true,
            isPublished: false,
            questions: [],
          });
        }
      })
      .catch(() => setError("Failed to load exam"))
      .finally(() => setLoading(false));
  }, [lecture]);

  const update = (patch: Partial<ExamState>) =>
    setExam((prev) => (prev ? { ...prev, ...patch } : prev));

  const updateQuestion = (index: number, q: Question) => {
    setExam((prev) => {
      if (!prev) return prev;
      const questions = [...prev.questions];
      questions[index] = q;
      return { ...prev, questions };
    });
  };

  const addQuestion = (type: QuestionType) => {
    const id = `q${Date.now().toString(36)}`;
    const base = { id, prompt: "", points: 1 };
    let q: Question;
    switch (type) {
      case "mcq":
        q = { ...base, type, options: ["", ""], correct: 0 };
        break;
      case "multi":
        q = { ...base, type, options: ["", ""], correct: [] };
        break;
      case "truefalse":
        q = { ...base, type, correct: true };
        break;
      case "fillblank":
        q = { ...base, type, answers: [""] };
        break;
      case "ordering":
        q = { ...base, type, items: ["", ""] };
        break;
      case "matching":
        q = {
          ...base,
          type,
          pairs: [
            { left: "", right: "" },
            { left: "", right: "" },
          ],
        };
        break;
    }
    setExam((prev) =>
      prev ? { ...prev, questions: [...prev.questions, q] } : prev
    );
  };

  const removeQuestion = (index: number) => {
    setExam((prev) =>
      prev
        ? { ...prev, questions: prev.questions.filter((_, i) => i !== index) }
        : prev
    );
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setExam((prev) => {
      if (!prev) return prev;
      const target = index + dir;
      if (target < 0 || target >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...prev, questions };
    });
  };

  const save = async (publishState?: boolean) => {
    if (!exam) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${lecture.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...exam,
          isPublished: publishState ?? exam.isPublished,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save exam");
        return;
      }
      update({ isPublished: data.exam.isPublished, token: data.exam.token });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(list)) {
          setError(
            'Invalid file: expected a JSON array of questions or {"questions": [...]}'
          );
          return;
        }
        setExam((prev) =>
          prev ? { ...prev, questions: list as Question[] } : prev
        );
        setError(null);
      } catch {
        setError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const exportJson = () => {
    if (!exam) return;
    const blob = new Blob([JSON.stringify(exam.questions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-questions.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "espark-exam-template.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = () => {
    if (!exam?.token) return;
    navigator.clipboard
      .writeText(`${window.location.origin}/quiz/${exam.token}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-center overflow-y-auto p-2 sm:p-6">
      <div className="w-full max-w-3xl bg-[#faf8f5] rounded-2xl border border-[#e6e1da] shadow-xl my-auto text-[#2b2f30]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#faf8f5]/95 backdrop-blur border-b border-[#e6e1da] rounded-t-2xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">
              Exam — {lecture.title}
            </h3>
            <p className="text-[11px] text-[#9b958c]">
              {exam?.questions.length ?? 0} question
              {(exam?.questions.length ?? 0) === 1 ? "" : "s"} ·{" "}
              {exam?.isPublished ? "Published" : "Draft"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {exam?.token && (
              <button
                onClick={copyLink}
                className={btnSecondary + " !py-2 !px-3 !text-xs"}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#4f7a58]" /> Copied
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" /> Student link
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] transition cursor-pointer"
              aria-label="Close editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading || !exam ? (
          <div className="p-10 flex justify-center">
            <div className="w-7 h-7 border-2 border-[#5b7884]/25 border-t-[#5b7884] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="px-4 sm:px-6 py-5 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-[#c2554d]/10 border border-[#c2554d]/20 text-[#c2554d] text-sm">
                {error}
              </div>
            )}

            {/* Settings */}
            <section className="bg-white border border-[#e6e1da] rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#9b958c]">
                Exam settings
              </h4>
              <div>
                <label className="block text-xs font-medium text-[#76716a] mb-2">
                  Exam title
                </label>
                <input
                  value={exam.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#76716a] mb-2">
                    Duration (min, 0 = none)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={exam.durationMinutes}
                    onChange={(e) =>
                      update({ durationMinutes: parseInt(e.target.value) || 0 })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#76716a] mb-2">
                    Passing score (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={exam.passingPercent}
                    onChange={(e) =>
                      update({ passingPercent: parseInt(e.target.value) || 0 })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#76716a] mb-2">
                    Max attempts
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={exam.maxAttempts}
                    onChange={(e) =>
                      update({ maxAttempts: parseInt(e.target.value) || 1 })
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[#76716a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exam.shuffleQuestions}
                    onChange={(e) => update({ shuffleQuestions: e.target.checked })}
                    className="accent-[#5b7884]"
                  />
                  Shuffle question order
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-[#76716a] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exam.showAnswers}
                    onChange={(e) => update({ showAnswers: e.target.checked })}
                    className="accent-[#5b7884]"
                  />
                  Show correct answers after submission
                </label>
              </div>
            </section>

            {/* Import / export */}
            <section className="bg-white border border-[#e6e1da] rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#9b958c] mb-3">
                Import / export questions (JSON)
              </h4>
              <div className="flex flex-wrap gap-2">
                <label className={btnSecondary + " !py-2 !px-3 !text-xs"}>
                  <Upload className="w-3.5 h-3.5" />
                  Import JSON file
                  <input
                    ref={importRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importJson(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={exportJson}
                  className={btnSecondary + " !py-2 !px-3 !text-xs"}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export current
                </button>
                <button
                  onClick={downloadTemplate}
                  className={btnSecondary + " !py-2 !px-3 !text-xs"}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download template
                </button>
              </div>
              <p className="text-[11px] text-[#9b958c] mt-2 leading-relaxed">
                Importing replaces the question list below. The template shows
                every supported type: mcq, multi, truefalse, fillblank,
                ordering, matching.
              </p>
            </section>

            {/* Questions */}
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#9b958c]">
                Questions
              </h4>

              {exam.questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  index={i}
                  total={exam.questions.length}
                  question={q}
                  onChange={(nq) => updateQuestion(i, nq)}
                  onRemove={() => removeQuestion(i)}
                  onMove={(dir) => moveQuestion(i, dir)}
                />
              ))}

              <div className="bg-white border border-dashed border-[#ded7cd] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#76716a] mb-2.5">
                  Add a question
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => addQuestion(type)}
                      className={btnSecondary + " !py-2 !px-3 !text-xs"}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <div className="text-xs text-[#9b958c]">
                {savedFlash && (
                  <span className="inline-flex items-center gap-1 text-[#4f7a58] font-semibold">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className={btnSecondary}
                >
                  {exam.isPublished ? "Save & unpublish" : "Save draft"}
                </button>
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className={btnPrimary}
                >
                  {saving
                    ? "Saving…"
                    : exam.isPublished
                      ? "Save & keep published"
                      : "Save & publish"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-question editor card ─────────────────────────────────────────

function QuestionCard({
  index,
  total,
  question,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  question: Question;
  onChange: (q: Question) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = QUESTION_TYPES.find((t) => t.type === question.type);

  return (
    <div className="bg-white border border-[#e6e1da] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-[#5b7884]/10 text-[#4c626a]">
          Q{index + 1} · {meta?.label}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-[#9b958c]">Points</label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={question.points}
            onChange={(e) =>
              onChange({ ...question, points: parseFloat(e.target.value) || 1 })
            }
            className={inputCls + " !w-16 !py-1.5 !px-2 text-center"}
          />
        </div>
        <button
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="p-1.5 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] disabled:opacity-30 transition cursor-pointer"
          aria-label="Move up"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="p-1.5 rounded-lg text-[#76716a] hover:bg-[#f4f0ec] disabled:opacity-30 transition cursor-pointer"
          aria-label="Move down"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button onClick={onRemove} className={btnDanger} aria-label="Delete question">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        value={question.prompt}
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        placeholder="Question text…"
        rows={2}
        className={inputCls + " mb-3"}
      />

      <TypeFields question={question} onChange={onChange} />

      <input
        value={question.explanation || ""}
        onChange={(e) =>
          onChange({ ...question, explanation: e.target.value || undefined })
        }
        placeholder="Explanation shown after submission (optional)"
        className={inputCls + " mt-3 !text-xs"}
      />
    </div>
  );
}

function TypeFields({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  switch (question.type) {
    case "mcq":
      return (
        <OptionListEditor
          options={question.options}
          onOptionsChange={(options, removedIndex) => {
            let correct = question.correct;
            if (removedIndex !== undefined) {
              if (correct === removedIndex) correct = 0;
              else if (correct > removedIndex) correct -= 1;
            }
            onChange({ ...question, options, correct: Math.min(correct, options.length - 1) });
          }}
          renderMarker={(i) => (
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={question.correct === i}
              onChange={() => onChange({ ...question, correct: i })}
              className="accent-[#5b7884] cursor-pointer"
              title="Mark as correct"
            />
          )}
          hint="Select the correct option with the radio button."
        />
      );

    case "multi":
      return (
        <OptionListEditor
          options={question.options}
          onOptionsChange={(options, removedIndex) => {
            let correct = question.correct;
            if (removedIndex !== undefined) {
              correct = correct
                .filter((c) => c !== removedIndex)
                .map((c) => (c > removedIndex ? c - 1 : c));
            }
            correct = correct.filter((c) => c < options.length);
            onChange({ ...question, options, correct });
          }}
          renderMarker={(i) => (
            <input
              type="checkbox"
              checked={question.correct.includes(i)}
              onChange={(e) => {
                const set = new Set(question.correct);
                if (e.target.checked) set.add(i);
                else set.delete(i);
                onChange({
                  ...question,
                  correct: [...set].sort((a, b) => a - b),
                });
              }}
              className="accent-[#5b7884] cursor-pointer"
              title="Mark as correct"
            />
          )}
          hint="Tick every correct option. Students get partial credit."
        />
      );

    case "truefalse":
      return (
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => onChange({ ...question, correct: v })}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                question.correct === v
                  ? "bg-[#5b7884] text-white border-[#5b7884]"
                  : "bg-white text-[#76716a] border-[#ded7cd] hover:border-[#5b7884]"
              }`}
            >
              {v ? "True is correct" : "False is correct"}
            </button>
          ))}
        </div>
      );

    case "fillblank":
      return (
        <div className="space-y-2">
          {question.answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={a}
                onChange={(e) => {
                  const answers = [...question.answers];
                  answers[i] = e.target.value;
                  onChange({ ...question, answers });
                }}
                placeholder={`Accepted answer ${i + 1}`}
                className={inputCls}
              />
              {question.answers.length > 1 && (
                <button
                  onClick={() =>
                    onChange({
                      ...question,
                      answers: question.answers.filter((_, j) => j !== i),
                    })
                  }
                  className={btnDanger}
                  aria-label="Remove answer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                onChange({ ...question, answers: [...question.answers, ""] })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c626a] hover:text-[#2b2f30] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add accepted answer
            </button>
            <label className="flex items-center gap-1.5 text-[11px] text-[#9b958c] cursor-pointer">
              <input
                type="checkbox"
                checked={question.caseSensitive === true}
                onChange={(e) =>
                  onChange({ ...question, caseSensitive: e.target.checked })
                }
                className="accent-[#5b7884]"
              />
              Case sensitive
            </label>
          </div>
        </div>
      );

    case "ordering":
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-[#9b958c]">
            Enter the items in the CORRECT order — students see them shuffled.
          </p>
          {question.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#9b958c] w-5">
                {i + 1}.
              </span>
              <input
                value={item}
                onChange={(e) => {
                  const items = [...question.items];
                  items[i] = e.target.value;
                  onChange({ ...question, items });
                }}
                placeholder={`Step ${i + 1}`}
                className={inputCls}
              />
              {question.items.length > 2 && (
                <button
                  onClick={() =>
                    onChange({
                      ...question,
                      items: question.items.filter((_, j) => j !== i),
                    })
                  }
                  className={btnDanger}
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              onChange({ ...question, items: [...question.items, ""] })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c626a] hover:text-[#2b2f30] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
        </div>
      );

    case "matching":
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-[#9b958c]">
            Students match each left item to the right item (right side is shuffled).
          </p>
          {question.pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={pair.left}
                onChange={(e) => {
                  const pairs = [...question.pairs];
                  pairs[i] = { ...pairs[i], left: e.target.value };
                  onChange({ ...question, pairs });
                }}
                placeholder="Left item"
                className={inputCls}
              />
              <span className="text-[#9b958c] text-xs">→</span>
              <input
                value={pair.right}
                onChange={(e) => {
                  const pairs = [...question.pairs];
                  pairs[i] = { ...pairs[i], right: e.target.value };
                  onChange({ ...question, pairs });
                }}
                placeholder="Matches with"
                className={inputCls}
              />
              {question.pairs.length > 2 && (
                <button
                  onClick={() =>
                    onChange({
                      ...question,
                      pairs: question.pairs.filter((_, j) => j !== i),
                    })
                  }
                  className={btnDanger}
                  aria-label="Remove pair"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
                ...question,
                pairs: [...question.pairs, { left: "", right: "" }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c626a] hover:text-[#2b2f30] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add pair
          </button>
        </div>
      );

    default:
      return null;
  }
}

function OptionListEditor({
  options,
  onOptionsChange,
  renderMarker,
  hint,
}: {
  options: string[];
  onOptionsChange: (options: string[], removedIndex?: number) => void;
  renderMarker: (index: number) => React.ReactNode;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[#9b958c]">{hint}</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          {renderMarker(i)}
          <input
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onOptionsChange(next);
            }}
            placeholder={`Option ${i + 1}`}
            className={inputCls}
          />
          {options.length > 2 && (
            <button
              onClick={() =>
                onOptionsChange(
                  options.filter((_, j) => j !== i),
                  i
                )
              }
              className={btnDanger}
              aria-label="Remove option"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => onOptionsChange([...options, ""])}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#4c626a] hover:text-[#2b2f30] transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Add option
      </button>
    </div>
  );
}
