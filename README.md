# eSpark Academy — Exams Platform

Interactive quiz platform for eSpark Academy students, built in the eSpark
UI style. Students open a private exam link, sign in with their username
and password, take an interactive exam, see their mark instantly and
download their certificate if they pass.

## How it works

```
Course (e.g. "Home Automation")
└── Lecture (e.g. "Lecture 1 — Sensors & Relays")
    ├── Exam         → built in the dashboard or imported from a JSON file
    │   └── link     → /quiz/<token>  (share this with students)
    └── Certificate  → uploaded PDF/image, unlocked when the student passes
```

- **Admin dashboard** (`/admin`) — only you can access it, using
  `ADMIN_USERNAME` / `ADMIN_PASSWORD`. From there you manage courses,
  lectures, exams, certificates, student accounts and monitor all results.
- **Students** never see the dashboard. They receive an exam link plus a
  username & password you create for them in the *Students* tab.
- **Grading is server-side** — correct answers never reach the browser.

## Question types

| Type        | Description                                        |
|-------------|----------------------------------------------------|
| `mcq`       | Multiple choice (single correct answer)            |
| `multi`     | Multiple select (partial credit)                   |
| `truefalse` | True / False                                       |
| `fillblank` | Short text answer (several accepted spellings)     |
| `ordering`  | Arrange items in the correct order                 |
| `matching`  | Match left items to right items                    |

Exams can be built question-by-question in the dashboard **or uploaded as
a JSON file** (Exam editor → *Import JSON file*; use *Download template*
to get a sample with every type).

Per-exam settings: time limit, passing percent, max attempts, shuffle
questions, and whether to reveal correct answers after submission.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:
   - `POSTGRES_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct) — from
     your Neon serverless Postgres project.
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your dashboard login.
   - `R2_*` — Cloudflare R2 credentials for certificate storage
     (optional locally; files fall back to the local filesystem in dev).

3. Create the database tables:

   ```bash
   npm run db:push
   ```

4. Run it:

   ```bash
   npm run dev
   ```

Open `http://localhost:3000/admin` to start creating courses.

## Deploying to Vercel (Neon + Cloudflare R2)

1. Import this repo in Vercel.
2. **Database (Neon):** add the Neon integration (Storage → Neon) or
   create a Neon project manually, then set:
   - `POSTGRES_URL` — the **pooled** connection string
     (`…-pooler.…neon.tech`, `sslmode=require`); used by the app at
     runtime, safe for serverless functions.
   - `DATABASE_URL_UNPOOLED` — the **direct** connection string; used
     only by `npm run db:push` / migrations.
3. **Storage (Cloudflare R2):** create a bucket and an R2 API token with
   *Object Read & Write*, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Optionally set `R2_PUBLIC_URL`
   if the bucket has a public/custom domain — otherwise the bucket can
   stay private and files are proxied through `/api/uploads`.
4. **Admin login:** set `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
5. Create the tables once: run `npm run db:push` locally with the
   production `DATABASE_URL_UNPOOLED` in `.env`.

## Typical flow

1. **Courses & Exams tab** → *New course* → add lectures.
2. On a lecture: *Create exam* → add/import questions → *Save & publish*.
3. Upload the lecture's certificate (PDF or image).
4. **Students tab** → *New student* → copy the generated credentials.
5. Click *Exam link* on the lecture and send it to the student along with
   their credentials.
6. Watch marks arrive in the **Results tab**. Deleting an attempt grants
   the student a retake.
