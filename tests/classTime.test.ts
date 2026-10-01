import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classEndTime, classPhase, defaultEndTime, formatClassRange, blocksOverlap, minutesToTime,
} from "../src/lib/classTime";
import { buildReminders } from "../src/lib/alerts";
import { findScheduleConflicts } from "../src/lib/utils";
import { buildEvents } from "../src/lib/calendar";
import { LEDGER_KEY, readLedger, recordFired, deliverReminder } from "../src/lib/notifications";
import type { Course } from "../src/types";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const course = (over: Partial<Course> & { schedule: Course["schedule"] }) => ({ id: 1, code: "BIO103", title: "Biology", room: "NAC413", ...over }) as unknown as Course;
const settings = { dailyStudyGoalMinutes: 0, studyReminderHour: 18, remindStudyGoal: false, remindUpcomingClass: true, remindDeadlines: false, remindExams: false, classReminderMinutes: 15 };
const remind = (c: Course, now: Date, over = {}) => buildReminders({ now, settings: { ...settings, ...over }, courses: [c], tasks: [], exams: [], todayStudyMinutes: 0 });
// 2026-10-05 is a Monday.
const mon = (h: number, m = 0, s = 0) => new Date(2026, 9, 5, h, m, s);

// ---------------- 90-minute default ----------------
test("default class length is 90 minutes", () => {
  assert.equal(defaultEndTime("08:00"), "09:30");
  assert.equal(defaultEndTime("13:00"), "14:30");
  assert.equal(defaultEndTime("16:20"), "17:50");
});

test("missing / blank / malformed end time → start + 90; explicit end time is respected", () => {
  assert.equal(classEndTime({ startTime: "08:00" }), "09:30");
  assert.equal(classEndTime({ startTime: "08:00", endTime: "" }), "09:30");
  assert.equal(classEndTime({ startTime: "08:00", endTime: undefined }), "09:30");
  assert.equal(classEndTime({ startTime: "08:00", endTime: "garbage" }), "09:30");
  assert.equal(classEndTime({ startTime: "08:00", endTime: "08:00" }), "09:30"); // not after start
  assert.equal(classEndTime({ startTime: "16:05", endTime: "17:00" }), "17:00"); // explicit wins (never 60/90 override)
  assert.equal(classEndTime({ startTime: "09:00", endTime: "10:00" }), "10:00");
  assert.equal(formatClassRange({ startTime: "16:20" }), "4:20 PM – 5:50 PM");
});

test("a late class never wraps past midnight", () => {
  assert.equal(defaultEndTime("23:00"), "23:59");
  assert.equal(minutesToTime(24 * 60 + 30), "23:59");
});

// ---------------- current / finished ----------------
test("class phase uses the full 90 minutes: 4:20–5:50 PM", () => {
  const b = { startTime: "16:20" };
  assert.equal(classPhase(b, mon(16, 19, 59)), "upcoming");
  assert.equal(classPhase(b, mon(16, 20)), "current");
  assert.equal(classPhase(b, mon(16, 30)), "current");
  assert.equal(classPhase(b, mon(17, 49, 59)), "current");
  assert.equal(classPhase(b, mon(17, 50)), "ended");
  assert.equal(classPhase(b, mon(17, 51)), "ended");
});

// ---------------- conflicts ----------------
test("conflict detection uses the default duration; back-to-back classes don't conflict", () => {
  assert.equal(blocksOverlap({ startTime: "08:00" }, { startTime: "09:00", endTime: "10:00" }), true); // 8:00–9:30 overlaps 9:00
  assert.equal(blocksOverlap({ startTime: "08:00" }, { startTime: "09:30" }), false);
  const a = course({ id: 1, code: "A", schedule: [{ days: ["Monday"], startTime: "08:00" } as never] });
  const b = course({ id: 2, code: "B", schedule: [{ days: ["Monday"], startTime: "09:00", endTime: "10:30" }] });
  const c = course({ id: 3, code: "C", schedule: [{ days: ["Monday"], startTime: "09:30", endTime: "11:00" }] });
  const r = findScheduleConflicts([a, b, c]);
  assert.equal(r.length, 2); // A–B, and B–C (09:30 < 10:30); A–C touch only
  assert.deepEqual([r[0].overlapStart, r[0].overlapEnd], ["09:00", "09:30"]);
});

test("calendar shows the full class duration when no end time is stored", () => {
  const c = course({ schedule: [{ days: ["Monday"], startTime: "13:00" } as never] });
  const ev = buildEvents({ from: mon(0), to: mon(0), courses: [c], allCourses: [c], exams: [], tasks: [], routine: [], sessions: [], events: [] });
  assert.equal(ev[0].endTime, "14:30");
});

// ---------------- class reminders ----------------
const bio = () => course({ schedule: [{ days: ["Monday"], startTime: "08:00" } as never] });

test("8:00 class, 15-min lead: due from 7:45, with the spec'd text", () => {
  const r = remind(bio(), mon(7, 45));
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "BIO103 starts soon");
  assert.equal(r[0].body, "BIO103 starts in 15 minutes · NAC413");
  assert.equal(r[0].id, "class-1-2026-10-05-08:00");
  assert.equal(r[0].href, "/planner/calendar");
});

test("not due before the lead window opens", () => {
  assert.equal(remind(bio(), mon(7, 44, 59)).length, 0);
  assert.equal(remind(bio(), mon(6, 0)).length, 0);
});

test("resume catch-up: returning at 7:46 still reminds, with the remaining minutes", () => {
  const r = remind(bio(), mon(7, 46));
  assert.equal(r.length, 1);
  assert.match(r[0].body, /starts in 14 minutes/);
});

test("no stale reminders once the class has started (8:00, 8:30, during and after the class)", () => {
  for (const t of [mon(8, 0), mon(8, 30), mon(9, 29), mon(9, 31)]) assert.equal(remind(bio(), t).length, 0);
});

test("reminder is based on START: 4:20 PM class → 4:05 PM, never 5:35 PM", () => {
  const c = course({ schedule: [{ days: ["Monday"], startTime: "16:20" } as never] });
  assert.equal(remind(c, mon(16, 5)).length, 1);
  assert.equal(remind(c, mon(17, 35)).length, 0);
});

test("only the matching weekday gets a reminder", () => {
  const tue = new Date(2026, 9, 6, 7, 50);
  assert.equal(remind(bio(), tue).length, 0);
});

test("configured lead minutes are respected", () => {
  assert.equal(remind(bio(), mon(7, 30), { classReminderMinutes: 30 }).length, 1);
  assert.equal(remind(bio(), mon(7, 30), { classReminderMinutes: 10 }).length, 0);
  assert.equal(remind(bio(), mon(7, 45), { remindUpcomingClass: false }).length, 0);
});

test("the id is stable across checks (so duplicates can be suppressed)", () => {
  const ids = new Set([mon(7, 45), mon(7, 50), mon(7, 59)].map((t) => remind(bio(), t)[0].id));
  assert.equal(ids.size, 1);
});

// ---------------- fired ledger / delivery ----------------
test("ledger remembers ids, survives a day change, expires after a week, tolerates corruption", () => {
  const s = mem(); const t0 = Date.UTC(2026, 9, 5, 12);
  recordFired("class-1-2026-10-05-08:00", t0, s);
  assert.ok(readLedger(t0 + 30 * 3600_000, s)["class-1-2026-10-05-08:00"]); // next day: still remembered
  assert.equal(Object.keys(readLedger(t0 + 8 * 24 * 3600_000, s)).length, 0);
  s.setItem(LEDGER_KEY, "{not json");
  assert.deepEqual(readLedger(t0, s), {});
});

test("delivery: toast when visible, deferred (NOT recorded) when hidden and no system notification", async () => {
  const r = { id: "x", title: "T", body: "B" };
  let toasts = 0;
  assert.equal(await deliverReminder(r, { visible: true, toast: () => { toasts++; } }), "in-app");
  assert.equal(toasts, 1);
  assert.equal(await deliverReminder(r, { visible: false, toast: () => { toasts++; } }), "deferred");
  assert.equal(toasts, 1);
});
