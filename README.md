# Naffiz OS — Personal Academic & Life Management System

A local-first PWA for Naffiz, CSE @ North South University. Built with Next.js 14,
TypeScript, Tailwind CSS, Framer Motion, and Dexie (IndexedDB) — no backend required.

## Run it locally

```bash
npm install
npm run dev
```
Open http://localhost:3000 — your real Spring/Summer/Fall 2026 courses are seeded
automatically on first launch and persist in IndexedDB from then on (survives refresh,
closing the browser, and reopening).

## Get it installed on your iPhone Home Screen (real PWA)

A `claude.ai` link cannot host a Next.js app with a working service worker —
it needs to be actually deployed. The fastest free path:

1. Push this folder to a GitHub repo.
2. Go to vercel.com → "New Project" → import the repo → Deploy (zero config needed).
3. On your iPhone, open the deployed URL in **Safari** (must be Safari, not Chrome).
4. Tap the Share icon → **Add to Home Screen**.
5. Launch "Naffiz OS" from your Home Screen — it now runs full-screen, offline-capable,
   with the service worker caching the app shell.
6. For push-style reminders, iOS requires the app to be installed this way *and*
   for you to grant notification permission from inside the installed app — Phase 2
   will wire up the actual notification scheduling logic.

## What's implemented in Phase 1

- **Data model & persistence**: Dexie/IndexedDB schema for Semesters, Courses, Routine
  items, Tasks, Study Sessions, Settings. Nothing is lost on refresh.
- **Your real academic record**, seeded exactly as you gave it: Spring 2026 (CSE115,
  CSE115L, ENG102, MAT116), Summer 2026 (CSE173, ENG103, POL101, SOC101), Fall 2026
  in-progress (BIO103, CHE101, CSE115 retake, CSE115L retake) — including your actual
  faculty codes, sections, rooms, and schedules.
- **CGPA/retake engine**: per-course `gpaCounting` / `degreeCredit` / `isRetake` flags
  (nothing assumed), configurable retake-replacement and credit-counting rules,
  editable grade scale, Target CGPA required-GPA calculator, live What-If simulator.
- **Dashboard**: animated CGPA/GPA/credits/streak cards, today's real class schedule
  with automatic conflict detection (checked against your actual Fall 2026 timetable),
  upcoming deadlines, and a transparent rule-based Academic Health panel (no fake AI).
- **Courses & Retakes**: full course detail pages (editable grade/flags/notes),
  dedicated retake comparison view (original vs. retake attempt).
- **Daily Routine**: add/edit/delete/complete, category-colored timeline, day-of-week
  recurrence.
- **Tasks/Assignments**: deadlines with live countdown + overdue detection, priority,
  course linking.
- **Study Timer**: Pomodoro/25-5/50-10/Custom modes, animated ring, real session
  logging tied to courses, recent-session history.
- **Settings**: theme (light/dark/system, properly designed dark surfaces — not
  inverted colors), editable grade scale, retake rules, attendance threshold,
  full JSON export/import backup, and app reset.
- **PWA foundation**: manifest, generated app icons, service worker with offline
  app-shell caching, safe-area-aware layout, bottom nav + floating quick-add sheet.

## Phase 2 (next)
Quizzes/Exams tracker, Attendance system, full Calendar (month/week/day), Study/CGPA
analytics with charts, real notification scheduling, Goals, Notes with search,
Achievements. Say the word and I'll continue straight from this codebase.

## Data & privacy
Everything lives only in your browser's IndexedDB. No login, no cloud sync, no NSU/
Canvas/portal credentials are stored or requested anywhere in this app.
