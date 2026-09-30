"use client";
import { useEffect, useRef, useState } from "react";

/** Form state that resets to `initial` every time the dialog opens. */
export function useDraft<T>(open: boolean, initial: T) {
  const [draft, setDraft] = useState<T>(initial);
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (open) setDraft(initialRef.current);
  }, [open]);
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));
  return { draft, setDraft, set };
}
