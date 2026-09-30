import {
  Home, GraduationCap, CalendarDays, Timer, StickyNote, Settings, BookOpen, Calculator, UserCheck,
  RefreshCcw, Map, ListTodo, ClipboardList, Repeat, LayoutList, BarChart3, Target, History, LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; description?: string }
export interface NavGroup { key: string; label: string; href: string; icon: LucideIcon; items: NavItem[] }

export const NAV: NavGroup[] = [
  { key: "home", label: "Home", href: "/", icon: Home, items: [{ href: "/", label: "Dashboard", icon: Home }] },
  {
    key: "academics", label: "Academics", href: "/academics", icon: GraduationCap, items: [
      { href: "/academics", label: "Overview", icon: GraduationCap },
      { href: "/academics/courses", label: "Courses", icon: BookOpen },
      { href: "/academics/gpa", label: "GPA / CGPA", icon: Calculator },
      { href: "/academics/attendance", label: "Attendance", icon: UserCheck },
      { href: "/academics/retakes", label: "Retakes", icon: RefreshCcw },
      { href: "/academics/degree", label: "Degree Planner", icon: Map },
    ],
  },
  {
    key: "planner", label: "Planner", href: "/planner/calendar", icon: CalendarDays, items: [
      { href: "/planner/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/planner/tasks", label: "Tasks", icon: ListTodo },
      { href: "/planner/exams", label: "Exams", icon: ClipboardList },
      { href: "/planner/routine", label: "Routine", icon: Repeat },
      { href: "/planner/schedule", label: "Schedule", icon: LayoutList },
    ],
  },
  {
    key: "study", label: "Study", href: "/study/timer", icon: Timer, items: [
      { href: "/study/timer", label: "Study Timer", icon: Timer },
      { href: "/study/records", label: "Sessions", icon: History },
      { href: "/study/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/study/goals", label: "Goals", icon: Target },
    ],
  },
  { key: "knowledge", label: "Knowledge", href: "/notes", icon: StickyNote, items: [{ href: "/notes", label: "Notes", icon: StickyNote }] },
  { key: "system", label: "System", href: "/settings", icon: Settings, items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export function groupFor(pathname: string): NavGroup | undefined {
  if (pathname === "/") return NAV[0];
  return NAV.find((g) => g.key !== "home" && g.items.some((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(i.href + "/"))));
}

export function isActive(pathname: string, href: string, exact = false): boolean {
  if (href === "/") return pathname === "/";
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}
