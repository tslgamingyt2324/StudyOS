"use client";
import { ReactNode, useEffect, useId, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// Open dialogs, oldest first. Only the topmost one reacts to Escape / Tab, so a
// confirm dialog opened from inside an editor closes alone.
const stack: symbol[] = [];

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Wider dialog for editors / calendars. */
  size?: "md" | "lg";
  footer?: ReactNode;
}

/**
 * Accessible dialog. Bottom sheet on phones, centred card from `sm` up.
 * Escape closes it, Tab is trapped inside, focus returns to the trigger, and
 * background scroll is locked while open.
 */
export default function Modal({ open, onClose, title, description, children, size = "md", footer }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const me = Symbol("modal");
    stack.push(me);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first field (not the close button) so typing can start at once.
    const t = window.setTimeout(() => {
      const els = panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = els && (Array.from(els).find((e) => e.dataset.close === undefined) ?? els[0]);
      first?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      stack.splice(stack.indexOf(me), 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} aria-hidden="true"
          />
          <motion.div
            ref={panel}
            role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined}
            className={`card relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none shadow-pop sm:rounded-b-[1.25rem] ${size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"}`}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-lg font-semibold">{title}</h2>
                {description && <p id={descId} className="text-xs text-ink-muted">{description}</p>}
              </div>
              <button type="button" data-close onClick={onClose} aria-label="Close dialog" className="icon-btn -mr-2 -mt-1"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
            {footer && <div className="border-t border-border px-5 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
