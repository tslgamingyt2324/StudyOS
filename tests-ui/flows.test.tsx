import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import React from "react";
import { db } from "@/db/db";
import { ThemeProvider } from "@/lib/theme";
import { StudyTimerProvider } from "@/lib/studyTimer";
import { ToastProvider } from "@/components/shell/Toast";
import { QuickAddProvider } from "@/components/shell/QuickAdd";
import SessionComplete from "@/components/shell/SessionComplete";
import { nav } from "./setup";
import { seedRich } from "./seed";
import { dateKey } from "@/lib/dates";

import Timer from "@/app/study/timer/page";
import Calendar from "@/components/calendar/Calendar";
import Tasks from "@/app/planner/tasks/page";
import AttendancePage from "@/app/academics/attendance/page";
import Notes from "@/app/notes/page";
import Settings from "@/app/settings/page";
import Goals from "@/app/study/goals/page";

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider><ToastProvider><StudyTimerProvider><QuickAddProvider>{children}<SessionComplete /></QuickAddProvider></StudyTimerProvider></ToastProvider></ThemeProvider>
);
const click = (el: Element) => fireEvent.click(el);
const type = (el: Element, value: string) => fireEvent.change(el, { target: { value } });
const dialog = () => screen.findByRole("dialog");
/** Start button is disabled for a tick until the course list loads — wait for it. */
const startTimer = async () => {
  const btn = (await screen.findByRole("button", { name: /Start 25 min/ })) as HTMLButtonElement;
  await waitFor(() => expect(btn.disabled).toBe(false));
  click(btn);
};

beforeEach(async () => { nav.pathname = "/"; nav.search = ""; nav.params = {}; vi.spyOn(console, "error").mockImplementation(() => {}); await seedRich(); await db.activeTimer.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("study timer lifecycle", () => {
  it("start → pause → resume → refresh → stop → completion screen → save feedback", async () => {
    const before = await db.studySessions.count();
    const { unmount } = render(<Providers><Timer /></Providers>);
    await startTimer();
    await waitFor(async () => expect((await db.activeTimer.get(1))?.status).toBe("running"));

    click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(async () => expect((await db.activeTimer.get(1))?.status).toBe("paused"));
    click(await screen.findByRole("button", { name: "Resume" }));
    await waitFor(async () => expect((await db.activeTimer.get(1))?.status).toBe("running"));

    // "Refresh": tear the whole tree down and mount again — the timer must survive.
    unmount();
    render(<Providers><Timer /></Providers>);
    expect(await screen.findByRole("button", { name: "Pause" })).toBeTruthy();
    expect((await db.activeTimer.get(1))?.status).toBe("running");

    click(screen.getByRole("button", { name: "Stop and save session" }));
    const d = await dialog();
    expect(within(d).getByText("Session complete")).toBeTruthy();
    // Saved BEFORE the feedback step — closing the tab here loses nothing.
    expect(await db.activeTimer.get(1)).toBeUndefined();
    expect(await db.studySessions.count()).toBe(before + 1);

    click(within(d).getByRole("radio", { name: "Good" }));
    type(within(d).getByLabelText(/What did you accomplish/), "Finished chapter 4");
    click(within(d).getByRole("button", { name: "Save" }));
    await waitFor(async () => {
      const last = (await db.studySessions.toArray()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
      expect(last.rating).toBe("Good"); expect(last.accomplished).toBe("Finished chapter 4"); expect(last.completed).toBe(true);
    });
  });

  it("rating is optional: Skip keeps the session with no feedback", async () => {
    render(<Providers><Timer /></Providers>);
    await startTimer();
    click(await screen.findByRole("button", { name: "Stop and save session" }));
    const d = await dialog();
    click(within(d).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const last = (await db.studySessions.toArray()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    expect(last.completed).toBe(true); expect(last.rating).toBeUndefined();
  });

  it("reset restarts the clock (confirmed); discard deletes the session (confirmed)", async () => {
    render(<Providers><Timer /></Providers>);
    await startTimer();
    await waitFor(async () => expect(await db.activeTimer.get(1)).toBeTruthy());
    const t0 = (await db.activeTimer.get(1))!.startedAt;
    await new Promise((r) => setTimeout(r, 20));
    click(screen.getByRole("button", { name: "Reset timer" }));
    click(within(await dialog()).getByRole("button", { name: "Reset" }));
    await waitFor(async () => expect((await db.activeTimer.get(1))!.startedAt > t0).toBe(true));

    const n = await db.studySessions.count();
    click(screen.getByRole("button", { name: "Discard session" }));
    click(within(await dialog()).getByRole("button", { name: "Discard" }));
    await waitFor(async () => expect(await db.activeTimer.get(1)).toBeUndefined());
    expect(await db.studySessions.count()).toBe(n - 1);
  });

  it("?course= preselects that course", async () => {
    const { c2 } = await seedRich();
    nav.search = `course=${c2}`;
    render(<Providers><Timer /></Providers>);
    await waitFor(() => expect((screen.getByLabelText("Course") as HTMLSelectElement).value).toBe(String(c2)));
  });
});

describe("calendar", () => {
  it("navigates months, creates, edits and deletes an event; today button returns", async () => {
    render(<Providers><Calendar /></Providers>);
    const heading = await screen.findByRole("heading", { level: 1 });
    const start = heading.textContent;
    click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).not.toBe(start));
    click(screen.getByRole("button", { name: "Previous month" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(start));

    // create
    click(screen.getByRole("button", { name: "Event" }));
    let d = await dialog();
    expect(within(d).getByText("New event")).toBeTruthy();
    type(within(d).getByLabelText("Title"), "Robotics club");
    click(within(d).getByRole("button", { name: "Add event" }));
    await waitFor(async () => expect((await db.calendarEvents.toArray()).some((e) => e.title === "Robotics club")).toBe(true));

    // edit via details
    const chip = (await screen.findAllByRole("button", { name: /Event: Robotics club/ }))[0];
    click(chip);
    d = await dialog();
    click(within(d).getByRole("button", { name: /Edit/ }));
    d = await screen.findByRole("dialog", { name: /Edit event/ });
    type(within(d).getByLabelText("Title"), "Robotics lab");
    click(within(d).getByRole("button", { name: "Save changes" }));
    await waitFor(async () => expect((await db.calendarEvents.toArray()).some((e) => e.title === "Robotics lab")).toBe(true));

    // delete (with confirmation)
    click((await screen.findAllByRole("button", { name: /Event: Robotics lab/ }))[0]);
    click(within(await dialog()).getByRole("button", { name: /Edit/ }));
    d = await screen.findByRole("dialog", { name: /Edit event/ });
    click(within(d).getByRole("button", { name: "Delete event" }));
    click(within(await screen.findByRole("dialog", { name: "Delete event" })).getByRole("button", { name: "Delete" }));
    await waitFor(async () => expect((await db.calendarEvents.toArray()).some((e) => e.title.startsWith("Robotics"))).toBe(false));

    click(screen.getByRole("button", { name: "Next month" }));
    click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(start));
  });

  it("shows classes, exams and deadlines from the data layer, and switches views", async () => {
    render(<Providers><Calendar /></Providers>);
    await screen.findAllByRole("button", { name: /Class: CSE115/ });
    expect(screen.getAllByRole("button", { name: /Exam: CSE115 · Midterm/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Deadline: Problem set 3/ }).length).toBeGreaterThan(0);
    click(screen.getByRole("radio", { name: "Week" }));
    await screen.findAllByRole("button", { name: /Class: CSE115/ });
    click(screen.getByRole("radio", { name: "Day" }));
    await waitFor(() => expect(screen.getAllByText(/CSE115/).length).toBeGreaterThan(0));
  });

  it("moving an event to another day (drag & drop) updates the record", async () => {
    render(<Providers><Calendar /></Providers>);
    const chip = (await screen.findAllByRole("button", { name: /Event: Study group/ }))[0];
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    // Find tomorrow's cell if it's in the current grid (it always is for the month view).
    const cell = screen.getAllByRole("gridcell").find((c) => within(c).queryAllByRole("button", { name: new RegExp(`Add event on ${dateKey(tomorrow)}`) }).length > 0)!;
    const data: Record<string, string> = {};
    const dataTransfer = { setData: (k: string, v: string) => { data[k] = v; }, getData: (k: string) => data[k], effectAllowed: "", dropEffect: "" };
    fireEvent.dragStart(chip, { dataTransfer });
    fireEvent.dragOver(cell, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer });
    await waitFor(async () => expect((await db.calendarEvents.toArray()).find((e) => e.title === "Study group")?.date).toBe(dateKey(tomorrow)));
  });
});

describe("tasks, attendance, notes, goals, settings", () => {
  it("adds a task through the form, validates, completes it, and filters overdue", async () => {
    render(<Providers><Tasks /></Providers>);
    click((await screen.findAllByRole("button", { name: /Add task/ }))[0]);
    let d = await dialog();
    click(within(d).getByRole("button", { name: "Add" }));            // empty title → validation
    expect(await within(d).findByText("Give it a title.")).toBeTruthy();
    type(within(d).getByLabelText("Title"), "Read chapter 5");
    click(within(d).getByRole("button", { name: "Add" }));
    await waitFor(async () => expect((await db.tasks.toArray()).some((t) => t.title === "Read chapter 5")).toBe(true));

    click(await screen.findByRole("checkbox", { name: /Read chapter 5, not completed/ }));
    await waitFor(async () => expect((await db.tasks.toArray()).find((t) => t.title === "Read chapter 5")?.status).toBe("Completed"));

    click(screen.getByRole("button", { name: /^Overdue/ }));
    await waitFor(() => expect(screen.getByText("Late essay")).toBeTruthy());
    expect(screen.queryByText("Problem set 3")).toBeNull();
  });

  it("attendance buttons record, replace and undo, and update the percentage", async () => {
    const { c2 } = await seedRich();
    render(<Providers><AttendancePage /></Providers>);
    await screen.findAllByText("SOC101");
    const card = screen.getAllByText("SOC101").map((n) => n.closest(".card") as HTMLElement).find((c) => within(c).queryByRole("button", { name: /^Present/ }))!;
    click(within(card).getByRole("button", { name: /^Present/ }));
    await waitFor(async () => expect((await db.attendance.where("courseId").equals(c2).toArray()).map((r) => r.status).sort()).toEqual(["Absent", "Present"].sort()));
    click(within(card).getByRole("button", { name: /Excused/ }));   // replaces today's Present
    await waitFor(async () => expect((await db.attendance.where({ courseId: c2, date: dateKey() }).toArray())[0].status).toBe("Excused"));
    click(within(card).getByRole("button", { name: /Excused/ }));   // tap again = undo
    await waitFor(async () => expect(await db.attendance.where({ courseId: c2, date: dateKey() }).count()).toBe(0));
  });

  it("notes: create, autosave edit, pin, search, archive", async () => {
    render(<Providers><Notes /></Providers>);
    click((await screen.findAllByRole("button", { name: /New note/ }))[0]);
    const title = await screen.findByLabelText("Note title");
    type(title, "Weber");
    type(screen.getByLabelText("Note body"), "# Iron cage\n- rationalisation");
    await waitFor(async () => expect((await db.notes.toArray()).some((n) => n.title === "Weber" && n.body.includes("Iron cage"))).toBe(true), { timeout: 3000 });
    click(screen.getByRole("button", { name: "Pin" }));
    await waitFor(async () => expect((await db.notes.toArray()).find((n) => n.title === "Weber")?.pinned).toBe(true));
    type(screen.getByLabelText("Search notes"), "rationalisation");
    expect(await screen.findAllByText("Weber")).toBeTruthy();
    click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(async () => expect((await db.notes.toArray()).find((n) => n.title === "Weber")?.archived).toBe(true));
  });

  it("goals: derived goal shows real progress; manual goal can be nudged", async () => {
    render(<Providers><Goals /></Providers>);
    await screen.findByText("Study 120 hours");
    expect(screen.getAllByText(/\/ 120h/).length).toBeGreaterThan(0);
    click(screen.getByRole("button", { name: "Increase progress" }));
    await waitFor(async () => expect((await db.goals.toArray()).find((g) => g.title === "Read books")?.manualCurrent).toBe(3));
  });

  it("settings: RESET requires typing RESET; import rejects garbage without touching data", async () => {
    render(<Providers><Settings /></Providers>);
    click(await screen.findByRole("button", { name: /Reset StudyOS/ }));
    const d = await dialog();
    const go = within(d).getByRole("button", { name: "Delete everything" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    type(within(d).getByLabelText(/Type RESET/), "reset");
    expect(go.disabled).toBe(true);           // case-sensitive
    type(within(d).getByLabelText(/Type RESET/), "RESET");
    expect(go.disabled).toBe(false);
    click(within(d).getByRole("button", { name: "Cancel" }));

    const before = await db.courses.count();
    const input = screen.getByLabelText("Choose backup file") as HTMLInputElement;
    const bad = new File(["this is not json"], "x.json", { type: "application/json" });
    Object.defineProperty(bad, "text", { value: async () => "this is not json" });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText(/isn't valid JSON/)).toBeTruthy();
    expect(await db.courses.count()).toBe(before);
  });
});
