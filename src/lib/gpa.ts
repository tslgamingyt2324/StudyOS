import { Course, Grade, Semester, AppSettings } from "@/types";

export interface GpaResult {
  gpa: number;
  gpaCreditsAttempted: number;
  qualityPoints: number;
}

/**
 * Computes GPA for a set of courses, honoring:
 *  - gpaCounting flag (course must opt in)
 *  - retake rules from settings (does old grade stay in the average?)
 *  - retake credit-counts-once rule
 */
export function calculateGPA(
  courses: Course[],
  scale: Record<Grade, number>,
  settings: Pick<AppSettings, "retakeReplacesOldGrade" | "retakeCreditCountsOnce">
): GpaResult {
  // Only ungraded/empty-grade courses are excluded (still in progress).
  const eligible = courses.filter((c) => c.gpaCounting && c.grade);

  // Group by course code so we can apply retake rules per-course.
  const byCode = new Map<string, Course[]>();
  for (const c of eligible) {
    const arr = byCode.get(c.code) ?? [];
    arr.push(c);
    byCode.set(c.code, arr);
  }

  let qualityPoints = 0;
  let creditsAttempted = 0;

  for (const [, attempts] of byCode) {
    const sorted = [...attempts].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    if (sorted.length === 1 || !settings.retakeReplacesOldGrade) {
      // No retake, or policy keeps every attempt in the average.
      for (const a of sorted) {
        qualityPoints += scale[a.grade] * a.credits;
        creditsAttempted += a.credits;
      }
    } else {
      // Retake replaces old grade: only the latest attempt counts toward GPA.
      const latest = sorted[sorted.length - 1];
      qualityPoints += scale[latest.grade] * latest.credits;
      creditsAttempted += settings.retakeCreditCountsOnce
        ? latest.credits
        : sorted.reduce((sum, a) => sum + a.credits, 0);
    }
  }

  return {
    gpa: creditsAttempted > 0 ? qualityPoints / creditsAttempted : 0,
    gpaCreditsAttempted: creditsAttempted,
    qualityPoints,
  };
}

export function calculateSemesterGPA(
  courses: Course[],
  semesterId: number,
  scale: Record<Grade, number>,
  settings: Pick<AppSettings, "retakeReplacesOldGrade" | "retakeCreditCountsOnce">
): GpaResult {
  return calculateGPA(courses.filter((c) => c.semesterId === semesterId), scale, settings);
}

export function completedCredits(
  courses: Course[],
  settings?: Pick<AppSettings, "retakeCreditCountsOnce">
): number {
  const eligible = courses.filter((c) => c.degreeCredit && c.status === "Completed" && c.grade && c.grade !== "F");

  if (!settings?.retakeCreditCountsOnce) {
    return eligible.reduce((sum, c) => sum + c.credits, 0);
  }

  // Count each course code's credits only once, even if it has a completed
  // retake attempt on top of the original completed attempt.
  const seenCodes = new Set<string>();
  let total = 0;
  for (const c of [...eligible].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
    if (seenCodes.has(c.code)) continue;
    seenCodes.add(c.code);
    total += c.credits;
  }
  return total;
}

/** Required average GPA for remaining credits to hit a target CGPA. */
export function requiredFutureGPA(
  currentCGPA: number,
  currentCredits: number,
  targetCGPA: number,
  remainingCredits: number
): { required: number; achievable: boolean } {
  if (remainingCredits <= 0) return { required: 0, achievable: currentCGPA >= targetCGPA };
  const requiredPoints = targetCGPA * (currentCredits + remainingCredits) - currentCGPA * currentCredits;
  const required = requiredPoints / remainingCredits;
  return { required, achievable: required <= 4.0 };
}

/** Roadmap of projected CGPA across upcoming semesters, given a flat target GPA per term. */
export function projectRoadmap(
  currentCGPA: number,
  currentCredits: number,
  semesterPlans: { label: string; targetGPA: number; credits: number }[]
): { label: string; targetGPA: number; projectedCGPA: number }[] {
  let qp = currentCGPA * currentCredits;
  let cr = currentCredits;
  return semesterPlans.map((p) => {
    qp += p.targetGPA * p.credits;
    cr += p.credits;
    return { label: p.label, targetGPA: p.targetGPA, projectedCGPA: cr > 0 ? qp / cr : 0 };
  });
}

export function gradeColor(grade: Grade): string {
  const points: Record<Grade, string> = {
    "A": "text-good", "A-": "text-good",
    "B+": "text-good", "B": "text-warn", "B-": "text-warn",
    "C+": "text-warn", "C": "text-warn", "C-": "text-bad",
    "D+": "text-bad", "D": "text-bad", "F": "text-bad", "": "text-ink-faint",
  };
  return points[grade];
}
