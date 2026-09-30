"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { Note } from "@/types";

export function noteMatches(n: Note, q: string): boolean {
  if (!q) return true;
  const hay = `${n.title}\n${n.body}\n${n.tags.join(" ")}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

export function useNotes() {
  const notes = useLiveQuery(() => db.notes.toArray());
  return useMemo(() => {
    const all = (notes ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
    return { loading: notes === undefined, notes: all, active: all.filter((n) => !n.archived), archived: all.filter((n) => n.archived) };
  }, [notes]);
}
