"use client";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Toggle } from "@/components/ui";
import { WIDGET_LABELS } from "@/components/dashboard/widgets";
import { DashboardLayout, DashboardWidgetId, DEFAULT_DASHBOARD_ORDER } from "@/types";

/** Normalises a stored layout: drops unknown ids and appends widgets added in later versions. */
export function resolveLayout(layout?: DashboardLayout): { order: DashboardWidgetId[]; hidden: Set<DashboardWidgetId> } {
  const known = new Set(DEFAULT_DASHBOARD_ORDER);
  const order = (layout?.order ?? []).filter((id) => known.has(id));
  for (const id of DEFAULT_DASHBOARD_ORDER) if (!order.includes(id)) order.push(id);
  return { order, hidden: new Set((layout?.hidden ?? []).filter((id) => known.has(id))) };
}

export default function CustomizeDashboard({ open, onClose, layout, onChange }: {
  open: boolean; onClose: () => void; layout?: DashboardLayout; onChange: (l: DashboardLayout) => void;
}) {
  const { order, hidden } = resolveLayout(layout);
  const emit = (o: DashboardWidgetId[], h: Set<DashboardWidgetId>) => onChange({ order: o, hidden: [...h] });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...order];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    emit(next, hidden);
  };
  const toggle = (id: DashboardWidgetId, on: boolean) => {
    const h = new Set(hidden);
    if (on) h.delete(id); else h.add(id);
    emit(order, h);
  };
  return (
    <Modal open={open} onClose={onClose} title="Customize dashboard" description="Show, hide and reorder widgets. Saved on this device.">
      <ul className="divide-y divide-border">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 py-2">
            <span className="flex-1 text-sm">{WIDGET_LABELS[id]}</span>
            <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${WIDGET_LABELS[id]} up`}><ArrowUp size={16} /></button>
            <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${WIDGET_LABELS[id]} down`}><ArrowDown size={16} /></button>
            <Toggle checked={!hidden.has(id)} onChange={(v) => toggle(id, v)} label={`Show ${WIDGET_LABELS[id]}`} />
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost mt-3 w-full" onClick={() => onChange({ order: DEFAULT_DASHBOARD_ORDER, hidden: [] })}><RotateCcw size={14} /> Reset to default</button>
    </Modal>
  );
}
