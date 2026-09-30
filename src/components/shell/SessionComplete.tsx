"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Coffee } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Segmented } from "@/components/ui";
import { useStudyTimer } from "@/lib/studyTimer";
import { useCourses } from "@/hooks/useCourses";
import { formatMinutes } from "@/lib/dates";
import { StudySession } from "@/types";

const RATINGS = ["Difficult", "Okay", "Good", "Excellent"] as const;

/** Appears wherever a timer is stopped. Every field is optional — Save or Skip both keep the session. */
export default function SessionComplete() {
  const { completion, dismissCompletion, saveFeedback } = useStudyTimer();
  const { byId } = useCourses();
  const [rating, setRating] = useState<StudySession["rating"]>();
  const [accomplished, setAccomplished] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (completion) { setRating(undefined); setAccomplished(""); } }, [completion]);

  const course = byId(completion?.courseId);
  const breakMinutes = completion ? (completion.mode === "50/10" ? 10 : completion.mode === "25/5" || completion.mode === "Pomodoro" ? 5 : 0) : 0;

  const save = async () => {
    setSaving(true);
    try { await saveFeedback({ rating, accomplished }); } finally { setSaving(false); dismissCompletion(); }
  };

  return (
    <Modal
      open={!!completion} onClose={dismissCompletion} title="Session complete"
      footer={
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={dismissCompletion}>Skip</button>
          <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      }
    >
      {completion && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-1 text-center">
            <CheckCircle2 size={36} className="text-good" aria-hidden="true" />
            <p className="text-lg font-semibold">{completion.isQuickStudy ? "Quick Study" : course?.code ?? "Study session"}</p>
            <p className="text-sm text-ink-muted">{completion.isQuickStudy ? "Open session" : completion.studyType ?? "Session"}{completion.taskLabel ? ` · ${completion.taskLabel}` : ""}</p>
            <p className="mt-1 text-3xl font-bold tabular">{formatMinutes(completion.minutes)}</p>
            <p className="text-xs text-ink-muted">Already saved to your history.</p>
          </div>
          <div>
            <p className="label">How was the session? <span className="font-normal">(optional)</span></p>
            <Segmented label="Session rating" value={rating} options={RATINGS} onChange={(v) => setRating(v === rating ? undefined : v)} />
          </div>
          <div>
            <label htmlFor="accomplished" className="label">What did you accomplish? <span className="font-normal">(optional)</span></label>
            <textarea id="accomplished" className="input" value={accomplished} onChange={(e) => setAccomplished(e.target.value)} placeholder="Finished problem set 3, reviewed pointers…" />
          </div>
          {breakMinutes > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm"><Coffee size={16} className="text-accent" aria-hidden="true" /> Take a {breakMinutes}-minute break before the next one.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
