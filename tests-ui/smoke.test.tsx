import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import { runDataMigrations } from "@/db/db";
import { ThemeProvider } from "@/lib/theme";
import { StudyTimerProvider } from "@/lib/studyTimer";
import { ToastProvider } from "@/components/shell/Toast";
import { QuickAddProvider } from "@/components/shell/QuickAdd";
import { nav } from "./setup";
import { resetDb, seedRich } from "./seed";

import Dashboard from "@/app/page";
import Academics from "@/app/academics/page";
import Courses from "@/app/academics/courses/page";
import CourseDetail from "@/app/academics/courses/[id]/page";
import Gpa from "@/app/academics/gpa/page";
import AttendancePage from "@/app/academics/attendance/page";
import Retakes from "@/app/academics/retakes/page";
import Degree from "@/app/academics/degree/page";
import Calendar from "@/app/planner/calendar/page";
import Tasks from "@/app/planner/tasks/page";
import Exams from "@/app/planner/exams/page";
import Routine from "@/app/planner/routine/page";
import Schedule from "@/app/planner/schedule/page";
import Timer from "@/app/study/timer/page";
import Focus from "@/app/study/focus/page";
import Sessions from "@/app/study/records/page";
import Analytics from "@/app/study/analytics/page";
import Goals from "@/app/study/goals/page";
import Notes from "@/app/notes/page";
import Settings from "@/app/settings/page";
import CommandPalette from "@/components/shell/CommandPalette";

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider><ToastProvider><StudyTimerProvider><QuickAddProvider>{children}</QuickAddProvider></StudyTimerProvider></ToastProvider></ThemeProvider>
);

const PAGES: [string, React.ComponentType, RegExp][] = [
  ["dashboard", Dashboard, /Good (morning|afternoon|evening)/],
  ["academics", Academics, /^Academics$/],
  ["courses", Courses, /^Courses$/],
  ["gpa", Gpa, /GPA \/ CGPA/],
  ["attendance", AttendancePage, /^Attendance$/],
  ["retakes", Retakes, /^Retakes$/],
  ["degree", Degree, /Degree planner/],
  ["calendar", Calendar as React.ComponentType, /\d{4}/],
  ["tasks", Tasks, /^Tasks$/],
  ["exams", Exams, /^Exams$/],
  ["routine", Routine, /^Routine$/],
  ["schedule", Schedule, /Weekly schedule/],
  ["timer", Timer, /Study timer/],
  ["focus", Focus, /Focus mode|Quick Study|CSE115/],
  ["sessions", Sessions, /^Sessions$/],
  ["analytics", Analytics, /^Analytics$/],
  ["goals", Goals, /^Goals$/],
  ["notes", Notes, /^Notes$/],
  ["settings", Settings, /^Settings$/],
];

let errors: unknown[][] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a); });
  nav.pathname = "/"; nav.search = ""; nav.params = {};
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const settle = async (heading: RegExp) => {
  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading" })).toBeNull(), { timeout: 8000 });
  await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 }).some((h) => heading.test(h.textContent ?? ""))).toBe(true), { timeout: 8000 });
};
const realErrors = () => errors.filter((e) => !String(e[0]).includes("not wrapped in act") && !String(e[0]).includes("Not implemented"));

describe("every page renders against an EMPTY database", () => {
  beforeEach(async () => { await resetDb(); await runDataMigrations(); });
  for (const [name, Page, heading] of PAGES) {
    it(name, async () => {
      render(<Providers><Page /></Providers>);
      await settle(heading);
      expect(realErrors()).toEqual([]);
    });
  }
  it("course detail shows a graceful not-found for a missing course", async () => {
    nav.params = { id: "999" };
    render(<Providers><CourseDetail /></Providers>);
    await waitFor(() => expect(screen.getByText("Course not found")).toBeTruthy(), { timeout: 8000 });
  });
  it("dashboard offers a first-run path", async () => {
    render(<Providers><Dashboard /></Providers>);
    await waitFor(() => expect(screen.getByText("Welcome to StudyOS")).toBeTruthy(), { timeout: 8000 });
    expect(screen.getByText("Add your semester")).toBeTruthy();
  });
});

describe("every page renders against a POPULATED database", () => {
  let ids: Awaited<ReturnType<typeof seedRich>>;
  beforeEach(async () => { ids = await seedRich(); });
  for (const [name, Page, heading] of PAGES) {
    it(name, async () => {
      render(<Providers><Page /></Providers>);
      await settle(heading);
      expect(realErrors()).toEqual([]);
    });
  }
  it("course command center shows every connected section", async () => {
    nav.params = { id: String(ids.c1) };
    render(<Providers><CourseDetail /></Providers>);
    await waitFor(() => expect(screen.getByText("Academic status")).toBeTruthy(), { timeout: 8000 });
    for (const t of ["Attendance", "Schedule", "Tasks", "Exams", "Notes", "Study"]) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText("Problem set 3")).toBeTruthy();   // its task
    expect(screen.getByText("Midterm")).toBeTruthy();         // its exam
    expect(screen.getByText("Pointers")).toBeTruthy();        // its note
    expect(screen.getByText(/Start studying CSE115/)).toBeTruthy();
    expect(realErrors()).toEqual([]);
  });
  it("dashboard surfaces alerts, today's class, goals and insights from real data", async () => {
    render(<Providers><Dashboard /></Providers>);
    await waitFor(() => expect(screen.getByText(/Good (morning|afternoon|evening), Ada/)).toBeTruthy(), { timeout: 8000 });
    await waitFor(() => expect(screen.getByText(/Needs your attention/)).toBeTruthy());
    expect(screen.getByText(/overdue/)).toBeTruthy();
    expect(screen.getAllByText(/CSE115/).length).toBeGreaterThan(0);
    expect(screen.getByText("Study 120 hours")).toBeTruthy();
    expect(realErrors()).toEqual([]);
  });
  it("attendance card shows the spec numbers for 11 present / 2 absent", async () => {
    render(<Providers><AttendancePage /></Providers>);
    await waitFor(() => expect(screen.getByText("84.6%")).toBeTruthy(), { timeout: 8000 }); // baseline 10/2 + present today = 11/13
  });
  it("global search finds across types and groups results", async () => {
    render(<Providers><CommandPalette open onClose={() => {}} /></Providers>);
    const box = await screen.findByRole("combobox");
    fireEvent.change(box, { target: { value: "point" } });
    await waitFor(() => expect(screen.getByText("Notes")).toBeTruthy());
    expect(screen.getByText("Pointers")).toBeTruthy();
    fireEvent.change(box, { target: { value: "midterm" } });
    await waitFor(() => expect(screen.getByText("Exams")).toBeTruthy());
    fireEvent.change(box, { target: { value: "zzzzqq" } });
    await waitFor(() => expect(screen.getByText(/No results/)).toBeTruthy());
  });
  it("modal closes on Escape", async () => {
    const onClose = vi.fn();
    const Modal = (await import("@/components/ui/Modal")).default;
    render(<Modal open onClose={onClose} title="T"><input aria-label="x" /></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("dialog")).getByLabelText("x")).toBeTruthy();
  });
});
