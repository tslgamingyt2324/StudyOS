# StudyOS

A premium, local-first **student operating system** for university students. One connected system:

**Academics → Courses → Attendance → Calendar → Tasks → Exams → Study → Notes → Goals → Analytics → Degree progress**

Everything is stored in your browser (IndexedDB). There are no accounts, no servers, no analytics and no external API calls.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start   # production
```

Requires Node 18.17+ (developed on Node 22).

| Script | What it does |
|---|---|
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | 29 unit tests for the pure logic in `src/lib` (attendance, goals, stats, dates, reminders, calendar, GPA, degree, backup, markdown) |
| `npm run test:ui` | 66 jsdom tests: every page against an empty *and* a populated database, plus create/edit/delete, timer, calendar, backup/restore and legacy-migration flows |

## What's inside

| Area | Pages |
|---|---|
| Home | **Dashboard** — customisable command center (show/hide/reorder widgets, saved locally) |
| Academics | Overview · Courses · **Course command center** · GPA/CGPA · **Attendance** · Retakes · **Degree planner** |
| Planner | **Calendar** (month/week/day, drag to reschedule) · Tasks · Exams · Routine · Schedule |
| Study | Timer · **Focus mode** · Sessions · Analytics · **Goals** (+ milestones) |
| Knowledge | **Notes** (Markdown, pin, archive, tags, course links) |
| System | Settings · validated JSON backup/restore · type-`RESET` to erase |

Global: **Ctrl/⌘+K** search across courses, tasks, exams, notes, sessions, goals and events · **Quick add** for 10 kinds of item · reminders · achievements.

## Key rules worth knowing

- **Attendance** = present ÷ (present + absent). *Excused* classes are excluded from both sides (they neither help nor hurt). Each course can override the default required %, and can carry a starting count for classes held before you began logging.
- **Goals** derive progress from your data (study hours from sessions, CGPA from your profile, course grade, attendance, completed tasks); only "custom" goals are typed by hand.
- **Insights** are plain rules over your own data — no AI. Behavioural claims (peak day/time, trends) are withheld until there are ≥ 8 sessions on ≥ 4 days.
- **Dates** are bucketed by your *local* day (the pre-2.0 code used UTC days, which mis-filed late-night sessions and streaks outside UTC).
- **GPA/CGPA/retake calculations are unchanged.** Your official CGPA and completed credits remain stored transcript values (Settings → Academic record).

## Data

- Database `studyos-db` (Dexie, schema v4). New in v4: `attendance`, `notes`, `goals`, `calendarEvents`, `plannedCourses`, `achievements`; new indexes on `tasks` (`examId`). Existing tables were not altered.
- **Upgrading from the previous app version:** on first launch StudyOS copies the old database (`naffiz-os-db`, the identifier the pre-2.0 app used) into `studyos-db` — read-only, in one transaction. The old database is left untouched as a safety net; "Reset StudyOS" removes both.
- Backup format `studyos-backup` v2. Older backups (no `format` field) still import; anything invalid is rejected *before* any data is touched, and a restore is atomic.
- The old hard-coded "self-heal" that re-imposed one student's schedule at every launch was removed; fresh installs start empty.

## Reminders

Class, deadline, exam and study-goal reminders (Settings) fire while StudyOS is open or installed and running, at most once each per day — as system notifications if you grant permission, otherwise as in-app toasts. Web apps cannot schedule notifications for when they are fully closed.

## PWA

Installable (`manifest.json`, icons, shortcuts). The service worker precaches every main route and caches assets network-first, so visited pages work offline; all data is local regardless. Course detail pages (`/academics/courses/:id`) are cached after first visit.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Dexie/IndexedDB · Framer Motion · Lucide. No chart or editor libraries — charts and the Markdown renderer are small in-repo components.

## Class schedule rule

Every class block is **90 minutes** unless it stores an explicit end time. `src/lib/classTime.ts` is the single
source of truth (`classEndTime`, `classPhase`, `blocksOverlap`): a missing/blank/invalid end time becomes
start + 90 min, an explicit valid end time is always respected, and nothing is rewritten in the database.
A class is "current" for `start ≤ now < end`. Reminders are always measured from the **start** time.

## Notifications — what works and what can't

**Works**
- Real system notifications through the service worker (`registration.showNotification`) while StudyOS is
  running — foreground, or alive in the background — including tap-to-open on the right page.
- Catch-up on resume (`visibilitychange` / `focus` / `pageshow` / service worker ready): a reminder that is
  due *right now* fires; one whose moment has passed (class already started) never does.
- Each reminder id fires once (persistent ledger, 7-day TTL, cross-tab lock, notification `tag`), and is only
  recorded after it was actually delivered.
- Settings → Reminders: Allow Notifications, Test Notification, and Notification Diagnostics.

**Cannot (without a server)**
- A browser/PWA cannot run code at a future time once the page is closed or suspended by the OS. Timers are
  frozen in the background, so an exact "7:45 AM" alert with the app fully closed needs **Web Push**
  (a push server sending a message at that time).
- iPhone: notifications only work for the app **added to the Home Screen** (iOS 16.4+).

**Adding Web Push later:** `public/sw.js` already has a `push` handler expecting `{title, body, href, tag}`.
You would add a push subscription (VAPID) in the page and a small server that sends at reminder time.

## Brand & icons

The StudyOS identity (a circle with an S cut out of it, plus wordmark) is documented in
[`docs/BRAND.md`](docs/BRAND.md). All icons and the `<Logo />` path data are generated by
`python3 scripts/brand/build_brand.py` (see the requirements file next to it).
