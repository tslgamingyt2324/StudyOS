"use client";
import Link from "next/link";
import { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Flame, Info, Lightbulb, Target, UserCheck, StickyNote, Map, Clock } from "lucide-react";
import type { useDashboard } from "@/hooks/useDashboard";
import { Badge, Progress } from "@/components/ui";
import { cn, deadlineLabel, formatCountdown } from "@/lib/utils";
import { classPhase, formatClassRange } from "@/lib/classTime";
import { formatHours, formatMinutes, shortDate, daysBetween, parseKey } from "@/lib/dates";
import { DashboardWidgetId } from "@/types";

type Data = NonNullable<ReturnType<typeof useDashboard>["data"]>;

function Card({ title, href, linkLabel = "See all", children, className }: { title: string; href?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card overflow-hidden", className)} aria-label={title}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 className="section-title !mb-0">{title}</h2>
        {href && <Link href={href} className="flex min-h-[32px] items-center text-xs font-medium text-accent">{linkLabel} <ChevronRight size={14} aria-hidden="true" /></Link>}
      </div>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <p className="px-4 pb-4 pt-2 text-sm text-ink-muted">{children}</p>;
const urgencyClass = (u: string) => (u === "overdue" ? "text-bad" : u === "today" || u === "soon" ? "text-warn" : "text-ink-muted");

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  alerts: "Important alerts", today: "Today's classes", studyGoal: "Study goal & streak", academic: "Academic snapshot",
  deadlines: "Deadlines", exams: "Exams", attendance: "Attendance", goals: "Goals", notes: "Recent notes",
  degree: "Degree progress", insights: "Insights",
};

function Alerts({ d }: { d: Data }) {
  if (d.alerts.length === 0) return null;
  return (
    <Card title="Needs your attention">
      <ul className="divide-y divide-border pt-1">
        {d.alerts.slice(0, 5).map((a) => {
          const Icon = a.level === "info" ? Info : AlertTriangle;
          const tone = a.level === "bad" ? "text-bad" : a.level === "warn" ? "text-warn" : "text-accent";
          const row = (
            <span className="flex items-start gap-3 px-4 py-3">
              <Icon size={16} className={cn("mt-0.5 shrink-0", tone)} aria-hidden="true" />
              <span className="text-sm">{a.text}</span>
            </span>
          );
          return <li key={a.id}>{a.href ? <Link href={a.href} className="block hover:bg-surface-sunken/40">{row}</Link> : row}</li>;
        })}
      </ul>
      {d.alerts.length > 5 && <p className="px-4 pb-3 text-xs text-ink-muted">+{d.alerts.length - 5} more</p>}
    </Card>
  );
}

function Today({ d }: { d: Data }) {
  return (
    <Card title="Today" href="/planner/schedule" linkLabel="Schedule">
      {d.next && (
        <div className="mx-4 mt-2 rounded-xl bg-accent-soft px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Next class{d.next.dayOffset === 0 ? "" : d.next.dayOffset === 1 ? " · tomorrow" : ` · ${d.next.dayName}`}
          </p>
          <p className="text-sm font-medium">{d.next.course.code} · {formatClassRange(d.next.sched)} · {d.next.course.room ?? "Room TBA"}</p>
          <p className="flex items-center gap-1 text-xs text-ink-muted"><Clock size={12} aria-hidden="true" /> in {formatCountdown(d.next.minutesUntil)}</p>
        </div>
      )}
      {d.today.length === 0 ? (
        <Empty>{d.courses.length === 0 ? "Add courses to see your class schedule here." : "No classes today."}</Empty>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {d.today.map(({ course, sched }, i) => {
            const over = classPhase(sched, d.now) === "ended", live = classPhase(sched, d.now) === "current";
            return (
              <li key={i}>
                <Link href={`/academics/courses/${course.id}`} className={cn("row-link", over && "opacity-55")}>
                  <span className="flex items-center gap-3">
                    <span className="min-w-0"><span className="block text-xs font-semibold tabular text-ink-muted">{formatClassRange(sched)}</span><span className="block truncate text-sm font-medium">{course.code} · {course.title}</span><span className="block text-xs text-ink-muted">{course.room ?? "Room TBA"}</span></span>
                  </span>
                  {live && <Badge tone="good">Now</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StudyGoal({ d }: { d: Data }) {
  const goal = d.settings.dailyStudyGoalMinutes || 0;
  const today = d.study.todayMinutes;
  const pct = goal ? (today / goal) * 100 : 0;
  const met = goal > 0 && today >= goal;
  return (
    <Card title="Study" href="/study/timer" linkLabel="Open timer">
      <div className="space-y-2 px-4 pb-4 pt-2">
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold tabular">{formatHours(today)}<span className="text-sm font-medium text-ink-muted"> / {goal ? formatHours(goal, 0) : "no goal"}</span></p>
          <span className="flex items-center gap-1 text-sm font-semibold"><Flame size={16} className={d.study.streak.current > 0 ? "text-warn" : "text-ink-faint"} aria-hidden="true" />{d.study.streak.current}<span className="font-normal text-ink-muted">day streak</span></span>
        </div>
        <Progress value={pct} tone={met ? "good" : "accent"} label="Today's study goal" />
        <p className="text-xs text-ink-muted">{!goal ? "Set a daily goal in Settings." : met ? "Goal reached today — well done." : `${formatMinutes(goal - today)} left to reach today's goal.`} · {formatHours(d.study.weekMinutes)} this week</p>
      </div>
    </Card>
  );
}

function Academic({ d }: { d: Data }) {
  const { profile, settings } = d;
  const pct = profile.degreeCredits ? (profile.completedCredits / profile.degreeCredits) * 100 : 0;
  return (
    <Card title="Academic snapshot" href="/academics" linkLabel="Overview">
      <div className="grid grid-cols-2 gap-3 px-4 pb-3 pt-2 sm:grid-cols-4">
        <div><p className="text-xs text-ink-muted">CGPA</p><p className="text-2xl font-bold tabular">{profile.completedCredits > 0 || profile.officialCGPA > 0 ? profile.officialCGPA.toFixed(2) : "—"}</p><p className="text-[11px] text-ink-muted">{settings.targetCGPA ? `Target ${settings.targetCGPA.toFixed(2)}` : "No target"}</p></div>
        <div><p className="text-xs text-ink-muted">Semester GPA</p><p className="text-2xl font-bold tabular">{d.semGpa === null ? "—" : d.semGpa.toFixed(2)}</p><p className="text-[11px] text-ink-muted">{d.semester?.label ?? "No semester"}</p></div>
        <div><p className="text-xs text-ink-muted">Credits done</p><p className="text-2xl font-bold tabular">{profile.completedCredits}</p></div>
        <div><p className="text-xs text-ink-muted">Remaining</p><p className="text-2xl font-bold tabular">{profile.remainingCredits}</p></div>
      </div>
      <div className="px-4 pb-4"><Progress value={pct} thin label="Degree progress" /><p className="mt-1 text-[11px] text-ink-muted">{pct.toFixed(0)}% of {profile.degreeCredits} degree credits</p></div>
    </Card>
  );
}

function Deadlines({ d }: { d: Data }) {
  const list = [...d.tasks].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")).slice(0, 4);
  return (
    <Card title="Upcoming deadlines" href="/planner/tasks">
      {list.length === 0 ? <Empty>Nothing due. You&apos;re clear.</Empty> : (
        <ul className="mt-1 divide-y divide-border">
          {list.map((t) => {
            const dl = deadlineLabel(t.deadline);
            return (
              <li key={t.id}><Link href="/planner/tasks" className="row-link">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.title}</span><span className="block text-xs text-ink-muted">{[d.byId(t.courseId)?.code, t.category].filter(Boolean).join(" · ")}</span></span>
                <span className={cn("shrink-0 text-xs font-semibold", urgencyClass(dl.urgency))}>{dl.label}</span>
              </Link></li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Exams({ d }: { d: Data }) {
  const list = d.exams.slice(0, 3);
  return (
    <Card title="Upcoming exams" href="/planner/exams">
      {list.length === 0 ? <Empty>No exams scheduled.</Empty> : (
        <ul className="mt-1 divide-y divide-border">
          {list.map((e) => {
            const days = daysBetween(d.now, parseKey(e.date));
            return (
              <li key={e.id}><Link href="/planner/exams" className="row-link">
                <span><span className="block text-sm font-medium">{d.byId(e.courseId)?.code} · {e.title}</span><span className="block text-xs text-ink-muted">{shortDate(e.date)} · {e.preparationPct}% prepared</span></span>
                <span className={cn("shrink-0 text-xs font-semibold", days <= 3 ? "text-warn" : "text-ink-muted")}>{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}</span>
              </Link></li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Attendance({ d }: { d: Data }) {
  const rows = d.courses.map((c) => ({ c, a: d.attendance.get(c.id!) })).filter((r) => r.a && r.a.status !== "none");
  return (
    <Card title="Attendance" href="/academics/attendance">
      {rows.length === 0 ? <Empty><UserCheck size={14} className="mr-1 inline" aria-hidden="true" />Log attendance to track each course against its requirement.</Empty> : (
        <ul className="mt-1 divide-y divide-border">
          {rows.slice(0, 5).map(({ c, a }) => (
            <li key={c.id}><Link href={`/academics/courses/${c.id}`} className="row-link">
              <span className="text-sm font-medium">{c.code}</span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular">{a!.percentage!.toFixed(0)}%</span>
                <Badge tone={a!.status === "risk" ? "bad" : a!.status === "warning" ? "warn" : "good"}>{a!.status === "risk" ? "At risk" : a!.status === "warning" ? "Close" : "Safe"}</Badge>
              </span>
            </Link></li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Goals({ d }: { d: Data }) {
  return (
    <Card title="Goals" href="/study/goals">
      {d.goals.length === 0 ? <Empty><Target size={14} className="mr-1 inline" aria-hidden="true" />Set a goal — progress updates from your own data.</Empty> : (
        <ul className="space-y-3 px-4 pb-4 pt-2">
          {d.goals.slice(0, 3).map(({ goal, progress, behind }) => (
            <li key={goal.id}>
              <div className="mb-1 flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{goal.title}</span><span className="text-xs tabular text-ink-muted">{progress.text}</span></div>
              <Progress value={progress.percent} tone={behind ? "warn" : progress.achieved ? "good" : "accent"} thin label={goal.title} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Notes({ d }: { d: Data }) {
  const list = d.notes.slice(0, 3);
  return (
    <Card title="Recent notes" href="/notes">
      {list.length === 0 ? <Empty><StickyNote size={14} className="mr-1 inline" aria-hidden="true" />Capture lecture notes and link them to a course.</Empty> : (
        <ul className="mt-1 divide-y divide-border">
          {list.map((n) => (
            <li key={n.id}><Link href={`/notes?open=${n.id}`} className="row-link"><span className="min-w-0"><span className="block truncate text-sm font-medium">{n.title}</span><span className="block truncate text-xs text-ink-muted">{d.byId(n.courseId)?.code ?? "General"}</span></span></Link></li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Degree({ d }: { d: Data }) {
  const { profile, credit } = d;
  const pct = profile.degreeCredits ? (profile.completedCredits / profile.degreeCredits) * 100 : 0;
  return (
    <Card title="Degree progress" href="/academics/degree" linkLabel="Planner">
      <div className="space-y-2 px-4 pb-4 pt-2">
        <p className="text-2xl font-bold tabular">{profile.completedCredits}<span className="text-sm font-medium text-ink-muted"> / {profile.degreeCredits} credits</span></p>
        <Progress value={pct} label="Degree progress" />
        <p className="flex items-center gap-1 text-xs text-ink-muted"><Map size={12} aria-hidden="true" />{credit.newDegreeCredits > 0 ? `If this semester goes to plan: ${credit.completedCreditsAfter} done, ${credit.remainingCreditsAfter} to go.` : "Plan future semesters in the Degree Planner."}</p>
      </div>
    </Card>
  );
}

function Insights({ d }: { d: Data }) {
  const list = d.insights.slice(0, 4);
  if (list.length === 0) return null;
  return (
    <Card title="Insights">
      <ul className="space-y-2 px-4 pb-4 pt-2">
        {list.map((i) => (
          <li key={i.id} className="flex items-start gap-2.5 text-sm"><Lightbulb size={15} className={cn("mt-0.5 shrink-0", i.tone === "good" ? "text-good" : i.tone === "warn" ? "text-warn" : "text-accent")} aria-hidden="true" />{i.text}</li>
        ))}
      </ul>
      <p className="px-4 pb-3 text-[11px] text-ink-faint">Calculated from your own data — no AI involved.</p>
    </Card>
  );
}

const MAP: Record<DashboardWidgetId, (p: { d: Data }) => ReactNode> = {
  alerts: Alerts, today: Today, studyGoal: StudyGoal, academic: Academic, deadlines: Deadlines, exams: Exams,
  attendance: Attendance, goals: Goals, notes: Notes, degree: Degree, insights: Insights,
};
/** Widgets that sit side by side on wide screens; the rest span the full row. */
export const HALF_WIDTH: DashboardWidgetId[] = ["deadlines", "exams", "attendance", "goals", "notes", "degree"];

export function renderWidget(id: DashboardWidgetId, d: Data) {
  const W = MAP[id];
  return W ? <W d={d} /> : null;
}
