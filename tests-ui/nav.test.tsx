import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, waitFor } from "@testing-library/react";
import React from "react";
import { ThemeProvider } from "@/lib/theme";
import { StudyTimerProvider } from "@/lib/studyTimer";
import { ToastProvider } from "@/components/shell/Toast";
import { QuickAddProvider, useQuickAdd } from "@/components/shell/QuickAdd";
import { BottomNav, Sidebar } from "@/components/shell/Navigation";
import NotificationPanel from "@/components/settings/NotificationPanel";
import { nav } from "./setup";
import { resetDb } from "./seed";

const Shell = () => { const q = useQuickAdd(); return <BottomNav onQuickAdd={() => q.open("menu")} />; };
const App = () => (
  <ThemeProvider><ToastProvider><StudyTimerProvider><QuickAddProvider><Shell /></QuickAddProvider></StudyTimerProvider></ToastProvider></ThemeProvider>
);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); nav.pathname = "/"; });

describe("mobile bottom navigation", () => {
  it("is a true five-slot grid with Quick Add in the centre slot", async () => {
    await resetDb();
    render(<App />);
    const bar = screen.getByRole("navigation", { name: "Primary" });
    const grid = bar.querySelector(".grid-cols-5") as HTMLElement;
    expect(grid).toBeTruthy();
    const slots = Array.from(grid.children);
    expect(slots).toHaveLength(5);
    // order: Home, Academics, Quick add, Planner, More
    expect(within(slots[0] as HTMLElement).getByText("Home")).toBeTruthy();
    expect(within(slots[1] as HTMLElement).getByText("Academics")).toBeTruthy();
    expect(within(slots[2] as HTMLElement).getByRole("button", { name: "Quick add" })).toBeTruthy();
    expect(within(slots[3] as HTMLElement).getByText("Planner")).toBeTruthy();
    expect(slots[4].tagName).toBe("BUTTON");
    expect(slots[4].getAttribute("aria-label")).toBe("More");
    // Study is no longer a bar slot
    expect(within(bar).queryByRole("link", { name: "Study" })).toBeNull();
  });

  it("the + button opens the existing Quick Add menu with all actions", async () => {
    await resetDb();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    const dialog = await screen.findByRole("dialog", { name: "Quick add" });
    for (const label of ["Start studying", "Study session", "Task", "Assignment", "Exam", "Calendar event", "Routine", "Note", "Goal", "Attendance"])
      expect(within(dialog).getByText(label)).toBeTruthy();
  });

  it("More exposes Study, Notes, Goals and Settings", async () => {
    await resetDb();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const dialog = await screen.findByRole("dialog", { name: "More" });
    const href = (name: string) => within(dialog).getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href");
    expect(href("Study")).toBe("/study/timer");
    expect(href("Notes")).toBe("/notes");
    expect(href("Goals")).toBe("/study/goals");
    expect(href("Settings")).toBe("/settings");
  });

  it("More is highlighted while on a Study page", async () => {
    nav.pathname = "/study/timer";
    await resetDb();
    render(<App />);
    expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("notification settings panel", () => {
  const noop = () => {};
  it("explains unsupported browsers", async () => {
    render(<NotificationPanel classRemindersOn onEnableClassReminders={noop} />);
    expect(await screen.findByText(/doesn.t support system notifications/i)).toBeTruthy();
  });

  it("shows the disabled state with an Allow button", async () => {
    vi.stubGlobal("Notification", Object.assign(function () {}, { permission: "default", requestPermission: async () => "default" }));
    render(<NotificationPanel classRemindersOn onEnableClassReminders={noop} />);
    expect(await screen.findByText("Notifications are currently disabled.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allow notifications" })).toBeTruthy();
  });

  it("granting permission switches on class reminders when they were off", async () => {
    const N = Object.assign(function () {}, { permission: "default", requestPermission: async () => { (N as any).permission = "granted"; return "granted"; } });
    vi.stubGlobal("Notification", N);
    const enable = vi.fn();
    render(<NotificationPanel classRemindersOn={false} onEnableClassReminders={enable} />);
    fireEvent.click(await screen.findByRole("button", { name: "Allow notifications" }));
    await waitFor(() => expect(enable).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Notifications are enabled")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send a test notification" })).toBeTruthy();
  });

  it("lists diagnostics", async () => {
    vi.stubGlobal("Notification", Object.assign(function () {}, { permission: "granted" }));
    render(<NotificationPanel classRemindersOn onEnableClassReminders={noop} />);
    await screen.findByText("Notifications are enabled");
    for (const l of ["Notification support", "Permission", "Service worker", "PWA"]) expect(screen.getByText(l)).toBeTruthy();
  });
});

describe("brand", () => {
  it("the desktop sidebar shows the StudyOS logo with an accessible name and links home", async () => {
    await resetDb();
    render(<ThemeProvider><ToastProvider><StudyTimerProvider><QuickAddProvider><Sidebar onSearch={() => {}} onQuickAdd={() => {}} /></QuickAddProvider></StudyTimerProvider></ToastProvider></ThemeProvider>);
    const home = screen.getByRole("link", { name: "StudyOS home" });
    expect(home.getAttribute("href")).toBe("/");
    expect(within(home).getByRole("img", { name: "StudyOS" })).toBeTruthy();
    expect(home.querySelectorAll("svg").length).toBe(2); // app tile + wordmark
  });
});
