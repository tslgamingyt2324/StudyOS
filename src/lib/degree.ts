import { Course, PlannedCourse, Semester, SemesterTerm, AppSettings } from "@/types";
import { calculateSemesterGPA } from "@/lib/gpa";

export const TERM_ORDER: SemesterTerm[] = ["Spring", "Summer", "Fall"];

export const termIndex = (t: SemesterTerm) => TERM_ORDER.indexOf(t);
export const termKey = (year: number, term: SemesterTerm) => year * 10 + termIndex(term);

export function nextTerm(year: number, term: SemesterTerm): { year: number; term: SemesterTerm } {
  const i = termIndex(term);
  return i === TERM_ORDER.length - 1 ? { year: year + 1, term: TERM_ORDER[0] } : { year, term: TERM_ORDER[i + 1] };
}

export interface TimelineEntry {
  key: string;
  label: string;
  year: number;
  term: SemesterTerm;
  status: "past" | "current" | "future";
  credits: number;
  gpa: number | null;
  semesterId?: number;
  courseCount: number;
  plannedCourses: PlannedCourse[];
}

/** Past + current semesters (from real data) followed by planned future ones. */
export function buildTimeline(
  semesters: Semester[],
  courses: Course[],
  planned: PlannedCourse[],
  settings: Pick<AppSettings, "gradeScale" | "retakeReplacesOldGrade" | "retakeCreditCountsOnce">
): TimelineEntry[] {
  const real: TimelineEntry[] = [...semesters]
    .sort((a, b) => termKey(a.year, a.term) - termKey(b.year, b.term))
    .map((s) => {
      const cs = courses.filter((c) => c.semesterId === s.id);
      const graded = cs.some((c) => c.gpaCounting && c.grade);
      const gpa = graded ? calculateSemesterGPA(courses, s.id!, settings.gradeScale, settings).gpa : null;
      return {
        key: `s-${s.id}`, label: s.label, year: s.year, term: s.term,
        status: s.isCurrent ? "current" : "past",
        credits: s.registeredCredits || cs.reduce((t, c) => t + c.credits, 0),
        gpa, semesterId: s.id, courseCount: cs.length, plannedCourses: [],
      } as TimelineEntry;
    });

  const realKeys = new Set(real.map((r) => termKey(r.year, r.term)));
  const futureMap = new Map<number, PlannedCourse[]>();
  for (const p of planned) {
    const k = termKey(p.year, p.term);
    if (realKeys.has(k)) continue; // once a real semester exists it owns that slot
    futureMap.set(k, [...(futureMap.get(k) ?? []), p]);
  }
  const future: TimelineEntry[] = [...futureMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => ({
      key: `f-${list[0].year}-${list[0].term}`, label: `${list[0].term} ${list[0].year}`,
      year: list[0].year, term: list[0].term, status: "future" as const,
      credits: list.reduce((t, p) => t + p.credits, 0), gpa: null, courseCount: list.length, plannedCourses: list,
    }));
  return [...real, ...future];
}

export interface GraduationEstimate {
  remainingAfterCurrent: number;
  semestersNeeded: number;
  label: string | null;
  creditsPerSemester: number;
}

/**
 * Estimates the graduation term. Planned future credits are consumed first;
 * whatever remains is spread at `creditsPerSemester` per term.
 */
export function estimateGraduation(args: {
  degreeCredits: number;
  completedCredits: number;
  currentSemesterNewCredits: number;
  plannedFutureCredits: number;
  lastPlannedOrCurrent: { year: number; term: SemesterTerm } | null;
  creditsPerSemester: number;
}): GraduationEstimate {
  const per = Math.max(1, args.creditsPerSemester);
  const remainingAfterCurrent = Math.max(0, args.degreeCredits - args.completedCredits - args.currentSemesterNewCredits);
  const beyondPlan = Math.max(0, remainingAfterCurrent - args.plannedFutureCredits);
  const extraTerms = Math.ceil(beyondPlan / per);
  if (remainingAfterCurrent === 0) {
    return { remainingAfterCurrent, semestersNeeded: 0, label: args.lastPlannedOrCurrent ? `${args.lastPlannedOrCurrent.term} ${args.lastPlannedOrCurrent.year}` : null, creditsPerSemester: per };
  }
  // Planned terms are already reflected in `lastPlannedOrCurrent`; only the
  // overflow beyond the plan adds extra terms.
  let cursor = args.lastPlannedOrCurrent;
  if (!cursor) return { remainingAfterCurrent, semestersNeeded: extraTerms, label: null, creditsPerSemester: per };
  for (let i = 0; i < extraTerms; i++) cursor = nextTerm(cursor.year, cursor.term);
  return { remainingAfterCurrent, semestersNeeded: extraTerms, label: `${cursor.term} ${cursor.year}`, creditsPerSemester: per };
}
