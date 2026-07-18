// ─────────────────────────────────────────────────────────────────────
// eSpark Academy exam engine — question model, validation, student
// sanitization (correct answers never leave the server) and grading.
// ─────────────────────────────────────────────────────────────────────

export type QuestionType =
  | "mcq"        // single choice
  | "multi"      // multiple select (partial credit)
  | "truefalse"
  | "fillblank"  // short text answer
  | "ordering"   // arrange items in the correct order
  | "matching";  // match left items to right items

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  image?: string;
  points: number;
  explanation?: string;
}

export interface McqQuestion extends BaseQuestion {
  type: "mcq";
  options: string[];
  correct: number; // index into options
}

export interface MultiQuestion extends BaseQuestion {
  type: "multi";
  options: string[];
  correct: number[]; // indices into options
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: "truefalse";
  correct: boolean;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: "fillblank";
  answers: string[]; // any accepted answer
  caseSensitive?: boolean;
}

export interface OrderingQuestion extends BaseQuestion {
  type: "ordering";
  items: string[]; // stored in the CORRECT order; shown shuffled
}

export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  pairs: { left: string; right: string }[];
}

export type Question =
  | McqQuestion
  | MultiQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | OrderingQuestion
  | MatchingQuestion;

// What the student's browser receives — no correct answers.
export type StudentQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  image?: string;
  points: number;
  options?: string[];  // mcq / multi
  items?: string[];    // ordering (shuffled)
  lefts?: string[];    // matching
  rights?: string[];   // matching (shuffled)
};

// Student answer shapes, keyed by question id:
//   mcq: number | truefalse: boolean | multi: number[]
//   fillblank: string | ordering: string[] | matching: (string|null)[] (right per left)
export type AnswerMap = Record<string, unknown>;

// ── Validation (used when the admin saves or imports questions) ─────

export function validateQuestions(input: unknown): {
  questions?: Question[];
  error?: string;
} {
  if (!Array.isArray(input)) {
    return { error: "Questions must be an array" };
  }

  const questions: Question[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < input.length; i++) {
    const q = input[i] as Record<string, unknown>;
    const label = `Question ${i + 1}`;

    if (!q || typeof q !== "object") return { error: `${label}: not an object` };
    if (typeof q.prompt !== "string" || !q.prompt.trim()) {
      return { error: `${label}: "prompt" is required` };
    }

    const type = q.type as QuestionType;
    const points =
      typeof q.points === "number" && q.points > 0 ? q.points : 1;
    let id = typeof q.id === "string" && q.id ? q.id : `q${i + 1}`;
    while (seenIds.has(id)) id = `${id}_x`;
    seenIds.add(id);

    const base = {
      id,
      prompt: q.prompt.trim(),
      points,
      ...(typeof q.image === "string" && q.image ? { image: q.image } : {}),
      ...(typeof q.explanation === "string" && q.explanation
        ? { explanation: q.explanation }
        : {}),
    };

    switch (type) {
      case "mcq": {
        const options = q.options;
        if (!Array.isArray(options) || options.length < 2 || !options.every((o) => typeof o === "string" && o.trim())) {
          return { error: `${label}: mcq needs at least 2 non-empty "options"` };
        }
        const correct = q.correct;
        if (typeof correct !== "number" || correct < 0 || correct >= options.length) {
          return { error: `${label}: mcq "correct" must be a valid option index` };
        }
        questions.push({ ...base, type: "mcq", options: options.map((o: string) => o.trim()), correct });
        break;
      }
      case "multi": {
        const options = q.options;
        if (!Array.isArray(options) || options.length < 2 || !options.every((o) => typeof o === "string" && o.trim())) {
          return { error: `${label}: multi needs at least 2 non-empty "options"` };
        }
        const correct = q.correct;
        if (
          !Array.isArray(correct) ||
          correct.length === 0 ||
          !correct.every((c) => typeof c === "number" && c >= 0 && c < options.length)
        ) {
          return { error: `${label}: multi "correct" must be a non-empty array of option indices` };
        }
        questions.push({
          ...base,
          type: "multi",
          options: options.map((o: string) => o.trim()),
          correct: [...new Set(correct as number[])].sort((a, b) => a - b),
        });
        break;
      }
      case "truefalse": {
        if (typeof q.correct !== "boolean") {
          return { error: `${label}: truefalse "correct" must be true or false` };
        }
        questions.push({ ...base, type: "truefalse", correct: q.correct });
        break;
      }
      case "fillblank": {
        const answers = q.answers;
        if (!Array.isArray(answers) || answers.length === 0 || !answers.every((a) => typeof a === "string" && a.trim())) {
          return { error: `${label}: fillblank needs a non-empty "answers" array` };
        }
        questions.push({
          ...base,
          type: "fillblank",
          answers: answers.map((a: string) => a.trim()),
          caseSensitive: q.caseSensitive === true,
        });
        break;
      }
      case "ordering": {
        const items = q.items;
        if (!Array.isArray(items) || items.length < 2 || !items.every((it) => typeof it === "string" && it.trim())) {
          return { error: `${label}: ordering needs at least 2 non-empty "items" (in correct order)` };
        }
        const trimmed = items.map((it: string) => it.trim());
        if (new Set(trimmed).size !== trimmed.length) {
          return { error: `${label}: ordering items must be unique` };
        }
        questions.push({ ...base, type: "ordering", items: trimmed });
        break;
      }
      case "matching": {
        const pairs = q.pairs;
        if (
          !Array.isArray(pairs) ||
          pairs.length < 2 ||
          !pairs.every(
            (p) =>
              p &&
              typeof p.left === "string" && p.left.trim() &&
              typeof p.right === "string" && p.right.trim()
          )
        ) {
          return { error: `${label}: matching needs at least 2 "pairs" of {left, right}` };
        }
        const cleaned = (pairs as { left: string; right: string }[]).map((p) => ({
          left: p.left.trim(),
          right: p.right.trim(),
        }));
        if (new Set(cleaned.map((p) => p.right)).size !== cleaned.length) {
          return { error: `${label}: matching right-side values must be unique` };
        }
        questions.push({ ...base, type: "matching", pairs: cleaned });
        break;
      }
      default:
        return {
          error: `${label}: unknown type "${String(q.type)}". Allowed: mcq, multi, truefalse, fillblank, ordering, matching`,
        };
    }
  }

  return { questions };
}

// ── Student view (answers stripped, lists shuffled) ─────────────────

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sanitizeForStudent(
  questions: Question[],
  shuffleQuestions: boolean
): StudentQuestion[] {
  const list = shuffleQuestions ? shuffled(questions) : questions;
  return list.map((q) => {
    const base: StudentQuestion = {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      ...(q.image ? { image: q.image } : {}),
    };
    switch (q.type) {
      case "mcq":
      case "multi":
        return { ...base, options: q.options };
      case "ordering":
        return { ...base, items: shuffled(q.items) };
      case "matching":
        return {
          ...base,
          lefts: q.pairs.map((p) => p.left),
          rights: shuffled(q.pairs.map((p) => p.right)),
        };
      default:
        return base;
    }
  });
}

// ── Grading ─────────────────────────────────────────────────────────

export interface QuestionResult {
  id: string;
  earned: number;
  points: number;
  correct: boolean; // fully correct
}

export function gradeExam(
  questions: Question[],
  answers: AnswerMap
): { score: number; maxScore: number; percent: number; results: QuestionResult[] } {
  let score = 0;
  let maxScore = 0;
  const results: QuestionResult[] = [];

  for (const q of questions) {
    maxScore += q.points;
    const answer = answers[q.id];
    const fraction = gradeQuestion(q, answer);
    const earned = Math.round(fraction * q.points * 100) / 100;
    score += earned;
    results.push({ id: q.id, earned, points: q.points, correct: fraction >= 1 });
  }

  const percent = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score: Math.round(score * 100) / 100, maxScore, percent, results };
}

function gradeQuestion(q: Question, answer: unknown): number {
  if (answer === undefined || answer === null) return 0;

  switch (q.type) {
    case "mcq":
      return typeof answer === "number" && answer === q.correct ? 1 : 0;

    case "truefalse":
      return typeof answer === "boolean" && answer === q.correct ? 1 : 0;

    case "multi": {
      if (!Array.isArray(answer)) return 0;
      const chosen = new Set(
        answer.filter((a) => typeof a === "number") as number[]
      );
      const correct = new Set(q.correct);
      let hits = 0;
      let misses = 0;
      for (const c of chosen) {
        if (correct.has(c)) hits++;
        else misses++;
      }
      // Partial credit: each right pick counts, each wrong pick cancels one
      const fraction = (hits - misses) / correct.size;
      return Math.max(0, Math.min(1, fraction));
    }

    case "fillblank": {
      if (typeof answer !== "string") return 0;
      const given = answer.trim();
      if (!given) return 0;
      return q.answers.some((a) =>
        q.caseSensitive
          ? a === given
          : a.toLowerCase() === given.toLowerCase()
      )
        ? 1
        : 0;
    }

    case "ordering": {
      if (!Array.isArray(answer) || answer.length !== q.items.length) return 0;
      let correctPositions = 0;
      for (let i = 0; i < q.items.length; i++) {
        if (answer[i] === q.items[i]) correctPositions++;
      }
      return correctPositions === q.items.length
        ? 1
        : correctPositions / q.items.length;
    }

    case "matching": {
      if (!Array.isArray(answer) || answer.length !== q.pairs.length) return 0;
      let hits = 0;
      for (let i = 0; i < q.pairs.length; i++) {
        if (answer[i] === q.pairs[i].right) hits++;
      }
      return hits / q.pairs.length;
    }

    default:
      return 0;
  }
}

// Correction sheet sent back after submission when the exam allows it.
export function buildReview(questions: Question[], answers: AnswerMap) {
  return questions.map((q) => {
    // Grade each question server-side so the review UI shows the SAME
    // verdict the score is based on — never a naive string comparison
    // (which mislabels fillblank alternatives, partial multi, etc.).
    const fraction = gradeQuestion(q, answers[q.id]);
    const earned = Math.round(fraction * q.points * 100) / 100;
    const status: "correct" | "partial" | "wrong" =
      fraction >= 1 ? "correct" : fraction > 0 ? "partial" : "wrong";

    const base = {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      points: q.points,
      earned,
      status,
      explanation: q.explanation || null,
      yourAnswer: answers[q.id] ?? null,
    };
    switch (q.type) {
      case "mcq":
        return { ...base, options: q.options, correct: q.correct };
      case "multi":
        return { ...base, options: q.options, correct: q.correct };
      case "truefalse":
        return { ...base, correct: q.correct };
      case "fillblank":
        return { ...base, correct: q.answers };
      case "ordering":
        return { ...base, correct: q.items };
      case "matching":
        return {
          ...base,
          lefts: q.pairs.map((p) => p.left),
          correct: q.pairs.map((p) => p.right),
        };
    }
  });
}
