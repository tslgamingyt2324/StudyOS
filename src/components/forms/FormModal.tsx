"use client";
import { ReactNode, useId, useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { ConfirmDialog, ErrorNote } from "@/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  /** Return an error string to keep the dialog open and show it. */
  onSubmit: () => Promise<string | void>;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  children: ReactNode;
  size?: "md" | "lg";
}

/** Shared chrome for every create/edit form: validation message, busy state, delete-with-confirm. */
export default function FormModal({ open, onClose, title, description, submitLabel, onSubmit, onDelete, deleteLabel = "Delete", children, size }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const formId = useId();

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const err = await onSubmit();
      if (err) setError(err);
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open} onClose={onClose} title={title} description={description} size={size}
        footer={
          <div className="space-y-2">
            {error && <ErrorNote message={error} />}
            <div className="flex gap-2">
              {onDelete && (
                <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} aria-label={deleteLabel}>
                  <Trash2 size={16} />
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" form={formId} className="btn btn-primary flex-1" disabled={busy}>
                {busy ? "Saving…" : submitLabel}
              </button>
            </div>
          </div>
        }
      >
        <form id={formId} className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {children}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirming} danger title={deleteLabel} confirmLabel="Delete"
        message="This can't be undone."
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          try { await onDelete?.(); onClose(); }
          catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete. Nothing was changed."); }
        }}
      />
    </>
  );
}
