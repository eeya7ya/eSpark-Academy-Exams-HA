# eSpark Academy Exams — Project Guide

Quiz platform for eSpark Academy: the admin (instructor) manages courses →
lectures → exams & certificates at `/admin`; students open a private link
(`/quiz/<token>`), sign in, take an interactive exam, see their mark and
download the lecture certificate if they pass. Stack: Next.js (App Router) +
Tailwind v4 + Prisma/PostgreSQL (Neon) + Cloudflare R2 storage, deployed on
Vercel. Grading is server-side — correct answers must never reach the browser.

This file is the standing instruction set. **Always follow the rules below
when generating exams (quizzes) or certificates for this project.**

---

## Brand

Palette (from the main eSpark site):

| Token | Hex | Use |
|---|---|---|
| background | `#1b1e20` | page background (dark charcoal) |
| foreground | `#e9e4e0` | main text (cream) |
| primary | `#5b7884` | St. Pauls Blue — buttons, accents |
| primary-light | `#93a3a4` | Arctic Grey — secondary text |
| accent | `#8a9b8d` | Minty Breeze — success accents, gradients |
| accent-light | `#aebcab` | gradient endpoint |
| surface / border | `#232729` / `#3a4143` | cards, glass, borders |
| success / danger | `#7da384` / `#c2554d` | pass / fail |

Signature styles: glass cards (`backdrop-filter: blur`), gradient text
(`primary-light → accent-light`), soft background glows, rounded-2xl corners.

### Logo assets (in `public/`)

- `espark-logo-on-dark.png` — full "eSpark-Academy" wordmark with the
  curve-of-icons, transparent background, for dark surfaces. Used by the
  landing page and quiz player.
- `espark-mark.png` — the standalone curve-of-icons mark (graduation cap →
  `</>` → lightning → megaphone). Used in the certificate seal.
- `espark-icon.png` / `favicon.ico` — the graduation-cap circle alone.
- Source: `Untitled design (1).png` (repo root) — the original logo export
  on a white background.

**Extraction gotchas (learned the hard way):**
1. To use the logo on dark surfaces, make near-white pixels
   (`r,g,b ≥ 250`) transparent — the cream wordmark (~`#EDEAE5`) must survive,
   so do NOT lower the threshold.
2. The `</>` icon circle **overlaps horizontally** with the wordmark's first
   letter. Never separate them with a straight vertical crop — crop wide,
   then erase the wordmark region (`x ≥ 235, y ≥ 325` in content coordinates
   of the left 360px) instead.
3. The connecting curve exits each icon circle — when isolating a single
   icon (e.g. for a favicon), mask to the circle's radius (diameter = content
   height), don't just crop a rectangle.

---

## Generating exams (quizzes)

Question content rules — **these define the eSpark exam style**:

1. **Test engineering knowledge, not trivia.** Technologies, terms,
   trade-offs and decision-making that a real engineer uses. **Never test
   date/year memorization** — dates may appear only inside explanations as
   context.
2. **Prefer scenario framing**: "You're the engineer — a client asks…",
   "Which technology fits this device?" beats "What is X?".
3. **Every question gets an `explanation`** — it is shown in the answer
   review, so wrong answers still teach. Keep the tone light and rewarding.
4. Include one or two **deliberate traps** per exam — plausible distractors
   that catch students who didn't pay attention (e.g. 232 vs 256 devices;
   a distractor that is true of a *different* technology).
5. **Use all six question types** across the exam: `mcq`, `multi`
   (partial credit), `truefalse`, `fillblank`, `ordering`, `matching`.
6. Size: **15–20 questions, ~20–25 points** for a lecture exam.
   Points: 1 for mcq/truefalse/fillblank, 2 for multi/ordering, 2–3 for
   matching.
7. `fillblank` answers: list several accepted spellings; matching is
   case-insensitive by default.
8. `ordering` items are stored in the **correct order** (the player shuffles
   them); `matching` right-side values must be unique.

### JSON format

An exam is a JSON array importable via the exam editor (Import JSON file)
or `PUT /api/admin/exams/<lectureId>`. Validation lives in
`src/lib/exam.ts` (`validateQuestions`). One example per type:

```json
[
  {"id":"q1","type":"mcq","prompt":"…","points":1,
   "options":["A","B","C"],"correct":0,"explanation":"…"},
  {"id":"q2","type":"multi","prompt":"Select ALL…","points":2,
   "options":["A","B","C"],"correct":[0,2],"explanation":"…"},
  {"id":"q3","type":"truefalse","prompt":"…","points":1,"correct":true},
  {"id":"q4","type":"fillblank","prompt":"… ____.","points":1,
   "answers":["KNX","knx association"]},
  {"id":"q5","type":"ordering","prompt":"Order the steps:","points":2,
   "items":["First","Second","Third"]},
  {"id":"q6","type":"matching","prompt":"Match:","points":3,
   "pairs":[{"left":"Zigbee","right":"2.4 GHz mesh"},
            {"left":"Z-Wave","right":"Sub-1 GHz mesh"}]}
]
```

### Exam settings defaults

Duration **20 min** · passing **60%** · **2 attempts** · shuffle **off**
(keep the narrative arc) · show answers after submission **on** (that's
where the explanations shine).

### Workflow

1. Read the lecture material (PDF/slides) fully before writing questions.
2. Draft the exam JSON following the rules above.
3. **Validate** by importing through the platform (locally:
   `PUT /api/admin/exams/<lectureId>` must return `success: true`).
4. Deliver: the JSON file + (optionally) a standalone interactive HTML
   preview in the site's dark style. Mark the preview **instructor-only** —
   it embeds the answers.
5. Publish via `/admin` → lecture → Create exam → Import JSON →
   Save & publish → share the **Student link** (`/quiz/<token>`).

---

## Generating certificates

Template: **`docs/certificate-template.html`** — edit the lecture/session
title lines, keep everything else. Design spec (A4 landscape, 297×210mm):

- **Plain dark charcoal `#1b1e20` background — NO glow circles.** Blurred
  radial glows look fine on screens but print/export as visible light
  circles, so never add them to certificates. Thin outer frame, **gradient
  double border** (`#5b7884 → #8a9b8d`) and four corner ticks.
- Top: the full eSpark-Academy logo (transparent version), ~19mm tall.
- Serif (Georgia) headline `CERTIFICATE OF COMPLETION`, letterspaced.
- "This certificate is proudly presented to" + **blank student-name line**
  (the platform serves one file to all passing students).
- Lecture title in gradient text + course/session subtitle.
- Bottom row — **`align-items: flex-start`** so both signature lines sit at
  the SAME level: Date line (left) · **seal** (center) · signature (right):
  *Eng. Yahya Khaled Fraj · Instructor · Certified KNX Partner · eSpark
  Academy*.
- Seal = double ring (26mm, `#8a9b8d`) with the **curve mark**
  (`espark-mark.png`, ~17mm) inside — no star, no text.
- Footer tagline: "Your partner for professional growth and deep knowledge".

### Render pipeline (IMPORTANT)

**Do not use Chromium's `page.pdf()`** — it shrinks the 297mm page (~87%)
leaving dead space on the right/bottom. Instead:

1. Screenshot the HTML with Playwright at viewport **1123×794**
   (= 297×210mm at CSS 96dpi), `deviceScaleFactor: 3` (≈288 DPI print).
2. Convert PNG → full-bleed PDF with Pillow:
   `img.save("out.pdf", "PDF", resolution=img.width/(297/25.4))`.
3. Visually verify: full-bleed (no dead space), signature lines level,
   seal mark complete (all four icon circles).

Upload via `/admin` → course → lecture → **Certificate** (accepts
PDF/PNG/JPG/WEBP; stored in R2).

---

## Platform notes for future work

- Admin auth: `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` (SHA-256 hex) env
  vars; students are DB rows with scrypt-hashed passwords.
- DB: `POSTGRES_URL` (Neon pooled) at runtime; `DATABASE_URL_UNPOOLED` for
  `npm run db:push`. Table DDL also in `prisma/create-tables.sql`.
- Storage: R2 (`R2_*` env vars) → Vercel Blob → local, in that priority.
- After changing branding assets, check ALL of: `espark-logo-on-dark.png`,
  `espark-mark.png`, `espark-icon.png`, `favicon.ico`, and the certificate
  template.
