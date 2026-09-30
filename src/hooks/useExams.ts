"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/db";
import { daysBetween, parseKey } from "@/lib/dates";

export function useExams() {
  const exams = useLiveQuery(() => db.exams.orderBy("date").toArray());
  return useMemo(() => {
    const all = exams ?? [];
    const now = new Date();
    const withDays = all.map((e) => ({ exam: e, days: daysBetween(now, parseKey(e.date)) }));
    return {
      loading: exams === undefined,
      exams: all,
      upcoming: withDays.filter((x) => x.days >= 0).map((x) => x.exam),
      past: withDays.filter((x) => x.days < 0).map((x) => x.exam).reverse(),
      daysUntil: (date: string) => daysBetween(now, parseKey(date)),
    };
  }, [exams]);
}
