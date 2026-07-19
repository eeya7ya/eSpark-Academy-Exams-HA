"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ArrowUp,
  ArrowDown,
  Send,
  GraduationCap,
  Upload,
  Paperclip,
} from "lucide-react";
import type { StudentQuestion } from "@/lib/exam";

// ── Types mirrored from the API responses ────────────────────────────

interface ExamInfo {
  title: string;
  lectureTitle: string;
  courseName: string;
  questionCount: number;
  durationMinutes: number;
  passingPercent: number;
  maxAttempts: number;
  hasCertificate: boolean;
}

interface QuizStatus {
  authenticated: boolean;
  student?: { id: string; name: string };
  exam: ExamInfo;
  attemptsUsed?: number;
  attemptsLeft?: number;
  bestResult?: {
    percent: number;
    passed: boolean;
    score: number;
    maxScore: number;
  } | null;
  certificateUrl?: string | null;
}

interface ReviewItem {
  id: string;
  type: string;
  prompt: string;
  points: number;
  earned: number;
  status: "correct" | "partial" | "wrong";
  explanation: string | null;
  yourAnswer: unknown;
  options?: string[];
  lefts?: string[];
  correct: unknown;
}

interface SubmitResult {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passingPercent: number;
  certificateUrl: string | null;
  review: ReviewItem[] | null;
}

type Phase =
  | "loading"
  | "unavailable"
  | "login"
  | "intro"
  | "playing"
  | "result";

export default function QuizPlayer({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [unavailableMsg, setUnavailableMsg] = useState("");

  // Playing state
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [current, setCurrent] = useState(0);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/quiz/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setUnavailableMsg(data.error || "This exam link is not available");
        setPhase("unavailable");
        return;
      }
      setStatus(data);
      setPhase(data.authenticated ? "intro" : "login");
    } catch {
      setUnavailableMsg("Network error — please refresh the page.");
      setPhase("unavailable");
    }
  }, [token]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const start = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${token}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start the exam");
        return;
      }
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setEndsAt(data.endsAt);
      // Pre-seed ordering answers with the shuffled order shown
      const seed: Record<string, unknown> = {};
      for (const q of data.questions as StudentQuestion[]) {
        if (q.type === "ordering" && q.items) seed[q.id] = [...q.items];
        if (q.type === "matching" && q.lefts)
          seed[q.id] = q.lefts.map(() => null);
      }
      setAnswers(seed);
      setCurrent(0);
      setPhase("playing");
    } catch {
      setError("Network error — please try again.");
    }
  };

  const submit = useCallback(
    async (auto = false) => {
      if (submitting || !attemptId) return;
      if (!auto) {
        const unanswered = questions.filter((q) => isUnanswered(q, answers[q.id]));
        if (
          unanswered.length > 0 &&
          !confirm(
            `You have ${unanswered.length} unanswered question${
              unanswered.length === 1 ? "" : "s"
            }. Submit anyway?`
          )
        )
          return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/quiz/${token}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, answers }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to submit — please try again.");
          setSubmitting(false);
          return;
        }
        setResult(data);
        setPhase("result");
      } catch {
        setError("Network error — your answers were NOT submitted. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attemptId, questions, submitting, token]
  );

  const logout = async () => {
    await fetch("/api/student/auth", { method: "DELETE" });
    setPhase("loading");
    setStatus(null);
    await loadStatus();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="relative max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Brand header */}
        <div className="flex items-center justify-between mb-8">
          <Image
            src="/espark-logo-on-dark.png"
            alt="eSpark Academy"
            width={480}
            height={180}
            className="h-auto w-48 sm:w-64 lg:w-80"
            priority
          />
          {status?.authenticated && status.student && phase !== "playing" && (
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-[var(--primary-light)] hover:text-[var(--foreground)] transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {status.student.name}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-24"
            >
              <div className="w-8 h-8 border-2 border-[var(--primary)]/25 border-t-[var(--primary)] rounded-full animate-spin" />
            </motion.div>
          )}

          {phase === "unavailable" && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-10 text-center"
            >
              <XCircle className="w-10 h-10 text-[var(--danger)] mx-auto mb-4" />
              <h1 className="text-lg font-bold mb-2">Exam unavailable</h1>
              <p className="text-sm text-[var(--primary-light)]">{unavailableMsg}</p>
            </motion.div>
          )}

          {phase === "login" && status && (
            <StudentLogin
              key="login"
              exam={status.exam}
              onSuccess={loadStatus}
            />
          )}

          {phase === "intro" && status && (
            <ExamIntro
              key="intro"
              status={status}
              error={error}
              certificateHref={`/api/quiz/${token}/certificate`}
              onStart={start}
            />
          )}

          {phase === "playing" && (
            <PlayingView
              key="playing"
              token={token}
              questions={questions}
              answers={answers}
              setAnswers={setAnswers}
              current={current}
              setCurrent={setCurrent}
              endsAt={endsAt}
              submitting={submitting}
              error={error}
              onSubmit={submit}
            />
          )}

          {phase === "result" && result && status && (
            <ResultView
              key="result"
              result={result}
              status={status}
              certificateHref={`/api/quiz/${token}/certificate`}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function isUnanswered(q: StudentQuestion, answer: unknown): boolean {
  if (answer === undefined || answer === null) return true;
  switch (q.type) {
    case "multi":
      return !Array.isArray(answer) || answer.length === 0;
    case "fillblank":
      return typeof answer !== "string" || !answer.trim();
    case "matching":
      return !Array.isArray(answer) || answer.some((a) => a === null);
    case "upload":
      return !Array.isArray(answer) || answer.length === 0;
    case "ordering":
      return false; // always has an order
    default:
      return false;
  }
}

// ── Student login ────────────────────────────────────────────────────

function StudentLogin({
  exam,
  onSuccess,
}: {
  exam: ExamInfo;
  onSuccess: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await onSuccess();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-4 py-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--primary-light)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--primary-light)] mb-2">
          {exam.courseName} · {exam.lectureTitle}
        </p>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
          <span className="gradient-text">{exam.title}</span>
        </h1>
      </div>

      <div className="gradient-border">
        <div className="glass rounded-2xl p-8">
          <h2 className="font-semibold text-sm mb-1">Student sign in</h2>
          <p className="text-xs text-[var(--primary-light)] mb-6">
            Use the username and password your instructor gave you.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--primary-light)] mb-2">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="your.username"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--primary-light)] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary)]/85 disabled:opacity-50 text-white font-semibold text-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in to start"
              )}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

// ── Exam intro ───────────────────────────────────────────────────────

function ExamIntro({
  status,
  error,
  certificateHref,
  onStart,
}: {
  status: QuizStatus;
  error: string | null;
  certificateHref: string;
  onStart: () => void;
}) {
  const { exam } = status;
  const attemptsLeft = status.attemptsLeft ?? exam.maxAttempts;
  const best = status.bestResult;
  const noAttemptsLeft = attemptsLeft <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
    >
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-widest text-[var(--primary-light)] mb-2">
          {exam.courseName} · {exam.lectureTitle}
        </p>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
          <span className="gradient-text">{exam.title}</span>
        </h1>
        {status.student && (
          <p className="text-sm text-[var(--primary-light)] mt-3">
            Welcome, <span className="font-semibold text-[var(--foreground)]">{status.student.name}</span>
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-center">
          <InfoStat label="Questions" value={String(exam.questionCount)} />
          <InfoStat
            label="Time limit"
            value={exam.durationMinutes > 0 ? `${exam.durationMinutes} min` : "None"}
          />
          <InfoStat label="Pass mark" value={`${exam.passingPercent}%`} />
          <InfoStat
            label="Attempts left"
            value={`${attemptsLeft}/${exam.maxAttempts}`}
          />
        </div>

        {best && (
          <div
            className={`flex items-center gap-3 p-4 rounded-xl mb-6 border ${
              best.passed
                ? "bg-[var(--success)]/10 border-[var(--success)]/30"
                : "bg-[var(--danger)]/10 border-[var(--danger)]/25"
            }`}
          >
            {best.passed ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-[var(--danger)] shrink-0" />
            )}
            <div className="text-sm">
              Your best result so far:{" "}
              <span className="font-bold">{best.percent}%</span>{" "}
              {best.passed ? "(passed)" : "(not passed)"}
            </div>
          </div>
        )}

        {status.certificateUrl && (
          <a
            href={certificateHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/25 text-[var(--accent-light)] font-semibold text-sm transition"
          >
            <Award className="w-4 h-4" />
            Download your certificate
          </a>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-sm mb-4">
            {error}
          </div>
        )}

        {!noAttemptsLeft ? (
          <>
            <button
              onClick={onStart}
              className="w-full py-3.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary)]/85 text-white font-bold text-sm transition cursor-pointer glow-primary flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              {best ? "Start new attempt" : "Start exam"}
            </button>
            {exam.durationMinutes > 0 && (
              <p className="text-[11px] text-[var(--primary-light)] text-center mt-3">
                The {exam.durationMinutes}-minute timer starts as soon as you
                click start.
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-[var(--primary-light)] py-2">
            You have used all your attempts for this exam.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-xl px-3 py-3 lg:py-4 border border-[var(--border)]">
      <div className="text-base lg:text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--primary-light)] mt-0.5">
        {label}
      </div>
    </div>
  );
}

// ── Playing ─────────────────────────────────────────────────────────

function PlayingView({
  token,
  questions,
  answers,
  setAnswers,
  current,
  setCurrent,
  endsAt,
  submitting,
  error,
  onSubmit,
}: {
  token: string;
  questions: StudentQuestion[];
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  current: number;
  setCurrent: React.Dispatch<React.SetStateAction<number>>;
  endsAt: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (auto?: boolean) => void;
}) {
  const q = questions[current];
  const setAnswer = (value: unknown) =>
    setAnswers((prev) => ({ ...prev, [q.id]: value }));

  const answeredCount = useMemo(
    () => questions.filter((qq) => !isUnanswered(qq, answers[qq.id])).length,
    [questions, answers]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Progress + timer */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-[var(--primary-light)] mb-1.5">
            <span>
              Question {current + 1} of {questions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-light)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
              animate={{ width: `${((current + 1) / questions.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
        {endsAt && <Countdown endsAt={endsAt} onExpire={() => onSubmit(true)} />}
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="glass rounded-2xl p-6 sm:p-8"
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2 className="text-base sm:text-lg font-semibold leading-relaxed">
              {q.prompt}
            </h2>
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-[var(--primary)]/15 text-[var(--primary-light)]">
              {q.points} pt{q.points === 1 ? "" : "s"}
            </span>
          </div>

          {q.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.image}
              alt="Question illustration"
              className="max-h-64 rounded-xl mb-5 border border-[var(--border)]"
            />
          )}

          <QuestionInput q={q} answer={answers[q.id]} onAnswer={setAnswer} token={token} />
        </motion.div>
      </AnimatePresence>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-sm mt-4">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 gap-3">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg glass text-sm font-medium disabled:opacity-30 hover:border-[var(--primary)] transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Dots */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-center max-w-[40%]">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              aria-label={`Go to question ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full transition cursor-pointer ${
                i === current
                  ? "bg-[var(--primary-light)] scale-125"
                  : isUnanswered(qq, answers[qq.id])
                    ? "bg-[var(--surface-light)] hover:bg-[var(--border)]"
                    : "bg-[var(--accent)]"
              }`}
            />
          ))}
        </div>

        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary)]/85 text-white text-sm font-semibold transition cursor-pointer"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => onSubmit(false)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/85 disabled:opacity-50 text-white text-sm font-bold transition cursor-pointer glow-accent"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit exam
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Countdown({
  endsAt,
  onExpire,
}: {
  endsAt: string;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(endsAt).getTime() - Date.now())
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(ms);
      if (ms <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const urgent = totalSec <= 60;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg glass text-sm font-mono font-semibold shrink-0 ${
        urgent ? "text-[var(--danger)] animate-pulse" : "text-[var(--foreground)]"
      }`}
    >
      <Clock className="w-4 h-4" />
      {min}:{String(sec).padStart(2, "0")}
    </div>
  );
}

// ── Question inputs per type ─────────────────────────────────────────

function QuestionInput({
  q,
  answer,
  onAnswer,
  token,
}: {
  q: StudentQuestion;
  answer: unknown;
  onAnswer: (value: unknown) => void;
  token: string;
}) {
  switch (q.type) {
    case "mcq":
      return (
        <div className="space-y-2.5">
          {q.options!.map((opt, i) => {
            const selected = answer === i;
            return (
              <button
                key={i}
                onClick={() => onAnswer(i)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition cursor-pointer flex items-center gap-3 ${
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/15"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/60"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    selected ? "border-[var(--primary-light)]" : "border-[var(--border)]"
                  }`}
                >
                  {selected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary-light)]" />
                  )}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      );

    case "multi": {
      const chosen = new Set(Array.isArray(answer) ? (answer as number[]) : []);
      return (
        <div className="space-y-2.5">
          <p className="text-[11px] text-[var(--primary-light)] -mt-2 mb-2">
            Select all that apply.
          </p>
          {q.options!.map((opt, i) => {
            const selected = chosen.has(i);
            return (
              <button
                key={i}
                onClick={() => {
                  const next = new Set(chosen);
                  if (selected) next.delete(i);
                  else next.add(i);
                  onAnswer([...next].sort((a, b) => a - b));
                }}
                className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition cursor-pointer flex items-center gap-3 ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/15"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${
                    selected
                      ? "border-[var(--accent-light)] bg-[var(--accent)]/40"
                      : "border-[var(--border)]"
                  }`}
                >
                  {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      );
    }

    case "truefalse":
      return (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((v) => {
            const selected = answer === v;
            return (
              <button
                key={String(v)}
                onClick={() => onAnswer(v)}
                className={`py-5 rounded-xl border text-base font-bold transition cursor-pointer ${
                  selected
                    ? v
                      ? "border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]"
                      : "border-[var(--danger)] bg-[var(--danger)]/15 text-[var(--danger)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/60"
                }`}
              >
                {v ? "True" : "False"}
              </button>
            );
          })}
        </div>
      );

    case "fillblank":
      return (
        <input
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="Type your answer…"
          className="w-full px-4 py-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--primary-light)]/50 focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition text-sm"
        />
      );

    case "ordering": {
      const order = Array.isArray(answer) ? (answer as string[]) : q.items!;
      const move = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= order.length) return;
        const next = [...order];
        [next[i], next[j]] = [next[j], next[i]];
        onAnswer(next);
      };
      return (
        <div className="space-y-2">
          <p className="text-[11px] text-[var(--primary-light)] mb-2">
            Arrange the items in the correct order using the arrows.
          </p>
          {order.map((item, i) => (
            <motion.div
              key={item}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
            >
              <span className="w-6 h-6 rounded-md bg-[var(--primary)]/20 text-[var(--primary-light)] text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="flex-1">{item}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1.5 rounded-md hover:bg-[var(--surface-light)] disabled:opacity-25 transition cursor-pointer"
                aria-label="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="p-1.5 rounded-md hover:bg-[var(--surface-light)] disabled:opacity-25 transition cursor-pointer"
                aria-label="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      );
    }

    case "matching": {
      const picks = Array.isArray(answer)
        ? (answer as (string | null)[])
        : q.lefts!.map(() => null);
      return (
        <div className="space-y-2.5">
          <p className="text-[11px] text-[var(--primary-light)] mb-2">
            Match each item on the left with the correct option.
          </p>
          {q.lefts!.map((left, i) => (
            <div
              key={left}
              className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <span className="text-sm font-medium sm:w-1/2">{left}</span>
              <select
                value={picks[i] ?? ""}
                onChange={(e) => {
                  const next = [...picks];
                  next[i] = e.target.value || null;
                  onAnswer(next);
                }}
                className="sm:w-1/2 px-3 py-2 rounded-lg bg-[var(--surface-light)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="">— choose —</option>
                {q.rights!.map((right) => (
                  <option key={right} value={right}>
                    {right}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case "upload":
      return <UploadInput q={q} answer={answer} onAnswer={onAnswer} token={token} />;

    default:
      return null;
  }
}

// Upload question — files upload immediately; the answer is the metadata list.
function UploadInput({
  q,
  answer,
  onAnswer,
  token,
}: {
  q: StudentQuestion;
  answer: unknown;
  onAnswer: (value: unknown) => void;
  token: string;
}) {
  const files = Array.isArray(answer)
    ? (answer as { filename: string; filepath: string; size?: number }[])
    : [];
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const maxFiles = q.maxFiles ?? 3;
  const accept = (q.accept ?? []).join(",");

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErr(null);
    setUploading(true);
    try {
      const added: typeof files = [];
      for (const file of Array.from(fileList)) {
        if (files.length + added.length >= maxFiles) {
          setErr(`You can upload at most ${maxFiles} file(s) here.`);
          break;
        }
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch(`/api/quiz/${token}/upload`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setErr(data.error || `Could not upload ${file.name}`);
          break;
        }
        added.push(data.file);
      }
      if (added.length) onAnswer([...files, ...added]);
    } catch {
      setErr("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (i: number) => {
    onAnswer(files.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--primary-light)] -mt-1">
        Do the task, then upload your file(s) — {q.accept?.join(", ") || "PDF or image"}.
        Up to {maxFiles}.
      </p>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-sm"
            >
              <Paperclip className="w-4 h-4 text-[var(--accent-light)] shrink-0" />
              <span className="flex-1 truncate">{f.filename}</span>
              {typeof f.size === "number" && (
                <span className="text-[11px] text-[var(--primary-light)] shrink-0">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              )}
              <button
                onClick={() => removeFile(i)}
                className="p-1 rounded-md text-[var(--danger)] hover:bg-[var(--danger)]/10 transition cursor-pointer shrink-0"
                aria-label="Remove file"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < maxFiles && (
        <label
          className={`flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed cursor-pointer transition ${
            uploading
              ? "border-[var(--border)] opacity-60 pointer-events-none"
              : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface)]"
          }`}
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
              <span className="text-xs text-[var(--primary-light)]">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6 text-[var(--primary-light)]" />
              <span className="text-sm font-medium">Choose file to upload</span>
              <span className="text-[11px] text-[var(--primary-light)]">
                {q.accept?.join(" · ") || "PDF, PNG, JPG"}
              </span>
            </>
          )}
          <input
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {err && (
        <p className="text-xs text-[var(--danger)]">{err}</p>
      )}
    </div>
  );
}

// ── Result screen ────────────────────────────────────────────────────

function ResultView({
  result,
  status,
  certificateHref,
}: {
  result: SubmitResult;
  status: QuizStatus;
  certificateHref: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div
        className={`glass rounded-2xl p-8 sm:p-10 text-center mb-6 ${
          result.passed ? "glow-accent" : ""
        }`}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }}
        >
          {result.passed ? (
            <CheckCircle2 className="w-14 h-14 text-[var(--success)] mx-auto mb-4" />
          ) : (
            <XCircle className="w-14 h-14 text-[var(--danger)] mx-auto mb-4" />
          )}
        </motion.div>

        <h1 className="text-xl font-bold mb-1">
          {result.passed ? "Congratulations — you passed!" : "Exam not passed"}
        </h1>
        <p className="text-sm text-[var(--primary-light)] mb-6">
          {status.exam.title} · pass mark {result.passingPercent}%
        </p>

        <div className="text-5xl sm:text-6xl font-bold gradient-text mb-2">
          {result.percent}%
        </div>
        <p className="text-sm text-[var(--primary-light)]">
          {result.score} / {result.maxScore} points
        </p>

        {result.certificateUrl && (
          <a
            href={certificateHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/85 text-white font-bold text-sm transition glow-accent"
          >
            <Award className="w-4 h-4" />
            Download your certificate
          </a>
        )}

        {result.passed && !result.certificateUrl && status.exam.hasCertificate && (
          <p className="text-xs text-[var(--primary-light)] mt-5">
            Your certificate will be available from your instructor.
          </p>
        )}
      </div>

      {/* Review */}
      {result.review && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--primary-light)]">
            Answer review
          </h2>
          {result.review.map((item, i) => (
            <ReviewCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ReviewCard({ item, index }: { item: ReviewItem; index: number }) {
  const yourAnswerText = formatAnswer(item, item.yourAnswer);
  const correctText = formatCorrect(item);
  // Trust the server's verdict — the same grade the score is based on.
  const status = item.status;
  const answerColor =
    status === "correct"
      ? "text-[var(--success)]"
      : status === "partial"
        ? "text-[#d9a441]"
        : "text-[var(--danger)]";

  const isUpload = item.type === "upload";

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start gap-3">
        {status === "correct" ? (
          <CheckCircle2 className="w-4 h-4 text-[var(--success)] mt-0.5 shrink-0" />
        ) : status === "partial" ? (
          <CheckCircle2 className="w-4 h-4 text-[#d9a441] mt-0.5 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-[var(--danger)] mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium mb-2">
              {index + 1}. {item.prompt}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-[var(--primary-light)] whitespace-nowrap">
              {item.earned}/{item.points}
            </span>
          </div>
          {isUpload ? (
            <p className="text-xs text-[var(--primary-light)]">
              {status === "correct" ? (
                <>
                  Submitted:{" "}
                  <span className="text-[var(--success)]">
                    {yourAnswerText || "file(s)"}
                  </span>{" "}
                  — your instructor will review it.
                </>
              ) : (
                <span className="text-[var(--danger)]">
                  No file submitted for this task.
                </span>
              )}
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--primary-light)]">
                Your answer:{" "}
                <span className={answerColor}>{yourAnswerText || "—"}</span>
              </p>
              {status !== "correct" && (
                <p className="text-xs text-[var(--primary-light)] mt-1">
                  Correct answer:{" "}
                  <span className="text-[var(--success)]">{correctText}</span>
                </p>
              )}
            </>
          )}
          {item.explanation && (
            <p className="text-xs text-[var(--primary-light)]/80 mt-2 italic">
              {item.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatAnswer(item: ReviewItem, answer: unknown): string {
  if (answer === null || answer === undefined) return "";
  switch (item.type) {
    case "mcq":
      return typeof answer === "number"
        ? (item.options?.[answer] ?? String(answer))
        : "";
    case "multi":
      return Array.isArray(answer)
        ? (answer as number[])
            .map((i) => item.options?.[i] ?? String(i))
            .join(", ")
        : "";
    case "truefalse":
      return answer === true ? "True" : answer === false ? "False" : "";
    case "fillblank":
      return typeof answer === "string" ? answer : "";
    case "ordering":
      return Array.isArray(answer) ? (answer as string[]).join(" → ") : "";
    case "matching":
      return Array.isArray(answer)
        ? (answer as (string | null)[])
            .map((r, i) => `${item.lefts?.[i] ?? i + 1}: ${r ?? "—"}`)
            .join(" · ")
        : "";
    case "upload":
      return Array.isArray(answer)
        ? (answer as { filename: string }[])
            .map((f) => f.filename)
            .join(", ")
        : "";
    default:
      return String(answer);
  }
}

function formatCorrect(item: ReviewItem): string {
  switch (item.type) {
    case "mcq":
      return typeof item.correct === "number"
        ? (item.options?.[item.correct] ?? "")
        : "";
    case "multi":
      return Array.isArray(item.correct)
        ? (item.correct as number[])
            .map((i) => item.options?.[i] ?? String(i))
            .join(", ")
        : "";
    case "truefalse":
      return item.correct === true ? "True" : "False";
    case "fillblank":
      return Array.isArray(item.correct)
        ? (item.correct as string[]).join(" / ")
        : "";
    case "ordering":
      return Array.isArray(item.correct)
        ? (item.correct as string[]).join(" → ")
        : "";
    case "matching":
      return Array.isArray(item.correct)
        ? (item.correct as string[])
            .map((r, i) => `${item.lefts?.[i] ?? i + 1}: ${r}`)
            .join(" · ")
        : "";
    default:
      return "";
  }
}
