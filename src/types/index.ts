// ==========================================================================
// StudyOS — core data model
// Every table in Dexie maps 1:1 to one of these interfaces.
// ==========================================================================

export type Grade =
  | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "F" | "";

export type SemesterTerm = "Spring" | "Summer" | "Fall";

export interface Semester {
  id?: number;
  term: SemesterTerm;
  year: number;
  label: string; // e.g. "Fall 2026"
  isCurrent: boolean;
  registeredCredits: number;
}

export interface Course {
  id?: number;
  code: string; // CSE115
  title: string; // Programming Language
  credits: number;
  faculty: string;
  section: string;
  room?: string;
  semesterId: number;
  schedule: ClassSchedule[];

  // Editable flags — never assumed
  gpaCounting: boolean; // does this course count toward CGPA?
  degreeCredit: boolean; // does it count toward the degree credit total?
  isRetake: boolean;

  // Grade info
  grade: Grade; // current/final grade for THIS attempt
  status: "Planned" | "In Progress" | "Completed";

  // Retake linkage
  originalCourseId?: number; // if this row is a retake attempt, points to the original course row
  retakeTargetGrade?: Grade;
  retakePlannedSemester?: string;

  notes?: string;

  // v4 — attendance (optional; absent on rows created before v4)
  attendanceBaseline?: AttendanceBaseline;
  requiredAttendance?: number; // overrides settings.attendanceThreshold for this course
  targetGrade?: Grade; // course goal grade for any course (not only retakes)
}

export interface ClassSchedule {
  days: string[]; // ["Sunday","Tuesday"]
  startTime: string; // "08:00"
  endTime: string; // "09:30"
}

export interface RoutineItem {
  id?: number;
  title: string;
  category: "Study" | "Class" | "Assignment" | "Exercise" | "Personal" | "Break" | "Sleep" | "Other";
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  daysOfWeek: number[]; // 0=Sun..6=Sat, empty = one-off (uses date)
  date?: string; // ISO date for one-off items
  priority: "Low" | "Medium" | "High";
  completed: boolean;
  completedDates: string[]; // ISO dates this recurring item was completed on
  order: number;
}

export interface Task {
  id?: number;
  title: string;
  description?: string;
  courseId?: number;
  category: "Task" | "Assignment";
  deadline?: string; // ISO date-time
  priority: "Low" | "Medium" | "High";
  status: "Not started" | "In progress" | "Completed" | "Overdue";
  estimatedMinutes?: number;
  actualMinutes?: number;
  createdAt: string;
  completedAt?: string;
  tags?: string[]; // v4
  examId?: number; // v4 — links a prep task to an exam
}

export type StudyType =
  | "Lecture Review" | "Assignment" | "Problem Solving" | "Exam Preparation"
  | "Reading" | "Lab Preparation" | "Revision" | "Other";

export interface StudySession {
  id?: number;
  courseId?: number;
  taskLabel?: string;
  studyType?: StudyType;
  mode: "Pomodoro" | "25/5" | "50/10" | "Custom" | "Quick";
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
  /** True for sessions started via "Start Quick Study" — no course, no
   *  study type, no notes. Kept separate from `courseId` being empty
   *  because a Course Study session can also be logged with "No course"
   *  selected; only THIS flag means "deliberately unassigned, no setup". */
  isQuickStudy?: boolean;
  /** v4 — optional feedback from the completion screen. */
  rating?: "Difficult" | "Okay" | "Good" | "Excellent";
  accomplished?: string;
}

/** Single-row table (id is always 1) holding the currently running/paused
 * timer so it survives navigating between pages and full page refreshes. */
export interface ActiveTimer {
  id: 1;
  sessionId: number; // the draft StudySession row this timer is filling in
  courseId?: number;
  taskLabel?: string;
  studyType?: StudyType;
  mode: StudySession["mode"];
  plannedMinutes: number;
  startedAt: string; // ISO
  status: "running" | "paused";
  pausedAt?: string; // ISO, set while paused
  accumulatedPauseMs: number;
  isQuickStudy?: boolean;
}

export type ExamType = "Quiz" | "Midterm" | "Final" | "Other";

export interface Exam {
  id?: number;
  courseId: number;
  title: string; // e.g. "Quiz 1", "Midterm"
  examType: ExamType;
  date: string; // ISO date
  time?: string; // "HH:MM"
  topics?: string;
  preparationPct: number; // 0-100, user-entered
  targetMarks?: number;
  actualMarks?: number;
  notes?: string;
  location?: string; // v4
}

export interface AppSettings extends SettingsExtras {
  id?: number;
  userName: string;
  university: string;
  department: string;
  currentSemesterId?: number;
  gradeScale: Record<Grade, number>;
  attendanceThreshold: number; // e.g. 70
  retakeReplacesOldGrade: boolean; // does retake grade replace old in GPA calc?
  retakeCreditCountsOnce: boolean; // does credit count once even if retaken multiple times?
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
  targetCGPA?: number;
  /** @deprecated superseded by degreeCredits - officialCompletedCredits. Kept only so old
   *  JSON backups still import without crashing; no longer read anywhere. */
  expectedRemainingCredits?: number;
  dailyStudyGoalMinutes: number; // e.g. 240 = 4 hours/day target
  semesterNumber: number; // e.g. 3 = "3rd Semester"
  dataVersion?: number; // tracks which one-time data corrections have been applied

  // --------------------------------------------------------------------
  // AUTHORITATIVE ACADEMIC PROFILE — single source of truth.
  // These three fields come from the student's official transcript
  // and must NEVER be derived by recalculating from `courses` rows. Every
  // screen that shows "Official CGPA" / "Completed Credits" / remaining
  // degree credits reads these three values (see src/lib/academicProfile.ts).
  // Course-row-based calculations (calculateGPA, completedCredits) are only
  // ever used for Semester GPA / Projected GPA "what-if" numbers, which are
  // clearly labeled as such and can never overwrite these.
  // --------------------------------------------------------------------
  officialCGPA: number; // e.g. 2.70 — matches official transcript cumulative CGPA
  officialCompletedCredits: number; // e.g. 22 — matches official transcript completed credits
  degreeCredits: number; // e.g. 130 — total credits required for the degree

  // Reminder preferences — stored now so the toggles work and persist,
  // but actual push delivery needs the app installed to an iPhone Home
  // Screen with notification permission granted (see Settings for why).
  remindStudyGoal: boolean;
  remindUpcomingClass: boolean;
  remindDeadlines: boolean;
  remindExams: boolean;
}

export const DEFAULT_GRADE_SCALE: Record<Grade, number> = {
  "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "F": 0.0, "": 0,
};

// ==========================================================================
// StudyOS 2.0 additions — all additive; no existing field was changed.
// ==========================================================================

export type AttendanceStatus = "Present" | "Absent" | "Excused";

export interface AttendanceRecord {
  id?: number;
  courseId: number;
  date: string; // YYYY-MM-DD (local)
  status: AttendanceStatus;
  note?: string;
}

/** Optional per-course attendance data stored on the Course row. */
export interface AttendanceBaseline {
  present: number;
  absent: number;
  excused: number;
}

export interface Note {
  id?: number;
  title: string;
  body: string;
  courseId?: number;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GoalType = "Academic" | "Study" | "Course" | "Personal";
export type GoalMetric =
  | "cgpa" | "study_hours" | "course_grade" | "attendance" | "tasks_completed" | "manual";
export type GoalStatus = "Active" | "Completed" | "Abandoned";

export interface Goal {
  id?: number;
  title: string;
  description?: string;
  type: GoalType;
  metric: GoalMetric;
  target: number; // cgpa / hours / grade points / % / count / manual target
  startValue?: number; // baseline for cgpa goals
  manualCurrent?: number; // only used when metric === "manual"
  unit?: string; // display unit for manual goals
  courseId?: number;
  startDate: string; // YYYY-MM-DD
  deadline?: string; // YYYY-MM-DD
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
}

export type CalendarEventKind = "General" | "Study" | "Class" | "Personal";

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  kind: CalendarEventKind;
  courseId?: number;
  location?: string;
  date: string; // YYYY-MM-DD (local)
  startTime?: string; // HH:MM — omitted for all-day
  endTime?: string;
  allDay: boolean;
}

export interface PlannedCourse {
  id?: number;
  term: SemesterTerm;
  year: number;
  code: string;
  title: string;
  credits: number;
  isRetake?: boolean;
  expectedGrade?: Grade;
}

export interface AchievementUnlock {
  key: string; // primary key
  unlockedAt: string;
}

export type DashboardWidgetId =
  | "alerts" | "today" | "studyGoal" | "academic" | "deadlines" | "exams"
  | "attendance" | "goals" | "notes" | "degree" | "insights";

export interface DashboardLayout {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

export const DEFAULT_DASHBOARD_ORDER: DashboardWidgetId[] = [
  "alerts", "today", "studyGoal", "academic", "deadlines", "exams",
  "attendance", "goals", "degree", "notes", "insights",
];

/** Extra settings fields added in v4 — all optional so old rows stay valid. */
export interface SettingsExtras {
  dashboardLayout?: DashboardLayout;
  creditsPerSemester?: number; // default load used for graduation estimates
  classReminderMinutes?: number; // lead time for "class starts in N minutes"
  studyReminderHour?: number; // local hour after which the goal reminder may fire
  weekStartsOn?: number; // 0 = Sunday … 6 = Saturday (calendar only)
}

/** Session feedback captured on the completion screen (all optional). */
export interface SessionFeedback {
  rating?: "Difficult" | "Okay" | "Good" | "Excellent";
  accomplished?: string;
}
