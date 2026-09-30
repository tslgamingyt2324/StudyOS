"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { AppSettings } from "@/types";

export function useSettings() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const update = async (patch: Partial<AppSettings>) => {
    if (settings?.id !== undefined) await db.settings.update(settings.id, patch);
  };
  return { settings, loading: settings === undefined, update };
}
