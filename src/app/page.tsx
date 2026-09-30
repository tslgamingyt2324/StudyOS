"use client";
import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, GraduationCap, Settings2 } from "lucide-react";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettings } from "@/hooks/useSettings";
import { useQuickAdd } from "@/components/shell/QuickAdd";
import { EmptyState, PageSkeleton } from "@/components/ui";
import { HALF_WIDTH, renderWidget } from "@/components/dashboard/widgets";
import CustomizeDashboard, { resolveLayout } from "@/components/dashboard/Customize";

function greeting(h: number) { return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

export default function Dashboard() {
  const { loading, data } = useDashboard();
  const { settings, update } = useSettings();
  const quick = useQuickAdd();
  const [customizing, setCustomizing] = useState(false);

  if (loading || !data || !settings) return <PageSkeleton />;

  const { order, hidden } = resolveLayout(settings.dashboardLayout);
  const visible = order.filter((id) => !hidden.has(id));
  const name = settings.userName?.trim().split(" ")[0];
  const noAcademics = data.allCourses.length === 0;

  // Group consecutive half-width widgets into two-column rows.
  const rows: (typeof order)[] = [];
  for (const id of visible) {
    const last = rows[rows.length - 1];
    if (HALF_WIDTH.includes(id) && last && HALF_WIDTH.includes(last[0]) && last.length < 2) last.push(id);
    else rows.push([id]);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{greeting(data.now.getHours())}{name ? `, ${name}` : ""}</h1>
          <p className="text-sm text-ink-muted">
            {data.now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {data.semester ? ` · ${data.semester.label}` : ""}
          </p>
        </div>
        <button className="icon-btn shrink-0" onClick={() => setCustomizing(true)} aria-label="Customize dashboard"><LayoutGrid size={20} /></button>
      </header>

      {noAcademics && (
        <div className="card">
          <EmptyState
            icon={GraduationCap} title="Welcome to StudyOS"
            message="Add your first course to start building your academic dashboard — schedule, attendance, exams, study time and goals all connect from there."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {data.semester ? <button className="btn btn-primary" onClick={() => quick.open("course")}>Add course</button> : <button className="btn btn-primary" onClick={() => quick.open("semester")}>Add your semester</button>}
                <Link href="/settings" className="btn btn-secondary"><Settings2 size={16} /> Set up profile</Link>
              </div>
            }
          />
        </div>
      )}

      {visible.length === 0 && <div className="card"><EmptyState title="Your dashboard is empty" message="Every widget is hidden." action={<button className="btn btn-primary" onClick={() => setCustomizing(true)}>Customize</button>} /></div>}

      {rows.map((row) => (
        <div key={row.join("-")} className={row.length === 2 ? "grid gap-4 md:grid-cols-2" : ""}>
          {row.map((id) => <div key={id} className="min-w-0">{renderWidget(id, data)}</div>)}
        </div>
      ))}

      <CustomizeDashboard open={customizing} onClose={() => setCustomizing(false)} layout={settings.dashboardLayout} onChange={(l) => update({ dashboardLayout: l })} />
    </div>
  );
}
