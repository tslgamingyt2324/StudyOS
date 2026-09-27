import { AppSettings, Course } from "@/types";

/**
 * The authoritative academic profile — everything a screen needs to show
 * "Official CGPA", "Completed Credits", and remaining degree credits.
 *
 * IMPORTANT: these numbers come straight from `settings` (the verified
 * transcript values), never from recalculating `courses`. This is what
 * fixes the historical "CGPA shows 2.31 / 2.19 / remaining shows 98" bugs:
 * those were all symptoms of deriving an "official" number from course
 * rows that could drift (duplicate rows, a stray grade, a stale default).
 * A single stored source of truth can't drift the same way — every screen
 * (Dashboard, Academics, CGPA Goal) calls this one function.
 */
export interface AcademicProfile {
  officialCGPA: number;
  completedCredits: number;
  degreeCredits: number;
  remainingCredits: number;
  semesterNumber: number;
}

export function getAcademicProfile(settings: AppSettings): AcademicProfile {
  const completedCredits = settings.officialCompletedCredits;
  const degreeCredits = settings.degreeCredits;
  return {
    officialCGPA: settings.officialCGPA,
    completedCredits,
    degreeCredits,
    remainingCredits: Math.max(0, degreeCredits - completedCredits),
    semesterNumber: settings.semesterNumber || 1,
  };
}

/** Registered / retake / net-new credit breakdown for the current semester (Part 20). */
export interface SemesterCreditBreakdown {
  registeredCredits: number;
  retakeCredits: number;
  newDegreeCredits: number;
  completedCreditsAfter: number; // completedCredits + newDegreeCredits, if this semester finishes as planned
  remainingCreditsAfter: number;
}

export function getSemesterCreditBreakdown(
  profile: AcademicProfile,
  currentSemesterCourses: Course[],
  registeredCredits: number
): SemesterCreditBreakdown {
  const retakeCredits = currentSemesterCourses
    .filter((c) => c.isRetake)
    .reduce((sum, c) => sum + c.credits, 0);
  const newDegreeCredits = Math.max(0, registeredCredits - retakeCredits);
  const completedCreditsAfter = profile.completedCredits + newDegreeCredits;
  return {
    registeredCredits,
    retakeCredits,
    newDegreeCredits,
    completedCreditsAfter,
    remainingCreditsAfter: Math.max(0, profile.degreeCredits - completedCreditsAfter),
  };
}
