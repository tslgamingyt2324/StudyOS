/**
 * Backup format + validation. Pure functions only (no database access) so the
 * rules can be unit-tested; src/db/backupIo.ts does the reading and writing.
 */
export const BACKUP_FORMAT = "studyos-backup";
export const BACKUP_VERSION = 2;

export const TABLE_KEYS = [
  "semesters", "courses", "routineItems", "tasks", "studySessions", "settings", "exams",
  "attendance", "notes", "goals", "calendarEvents", "plannedCourses", "achievements",
] as const;
export type TableKey = (typeof TABLE_KEYS)[number];

export interface BackupFile {
  format?: string;
  version?: number;
  exportedAt?: string;
  app?: string;
  data?: Partial<Record<TableKey, unknown[]>>;
  // Legacy (pre-2.0) backups stored each table at the top level.
  [k: string]: unknown;
}

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Normalised rows per table, only when ok. */
  tables: Partial<Record<TableKey, Record<string, unknown>[]>>;
  counts: Partial<Record<TableKey, number>>;
  exportedAt?: string;
  legacy: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown) => typeof v === "string";
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Minimal shape rules per table. Each returns an error string for a bad row. */
const ROW_RULES: Record<TableKey, (r: Record<string, unknown>) => string | null> = {
  semesters: (r) => (isStr(r.label) && isNum(r.year) && isStr(r.term) ? null : "needs label, term and year"),
  courses: (r) => (isStr(r.code) && isNum(r.semesterId) && isNum(r.credits) ? null : "needs code, semesterId and credits"),
  routineItems: (r) => (isStr(r.title) && Array.isArray(r.daysOfWeek) ? null : "needs title and daysOfWeek"),
  tasks: (r) => (isStr(r.title) ? null : "needs a title"),
  studySessions: (r) => (isStr(r.startedAt) && isNum(r.actualMinutes) ? null : "needs startedAt and actualMinutes"),
  settings: (r) => (isObj(r.gradeScale) ? null : "needs a gradeScale"),
  exams: (r) => (isStr(r.date) && isNum(r.courseId) ? null : "needs date and courseId"),
  attendance: (r) => (isNum(r.courseId) && isStr(r.date) && ["Present", "Absent", "Excused"].includes(r.status as string) ? null : "needs courseId, date and a valid status"),
  notes: (r) => (isStr(r.title) && isStr(r.body) && Array.isArray(r.tags) ? null : "needs title, body and tags"),
  goals: (r) => (isStr(r.title) && isNum(r.target) && isStr(r.metric) ? null : "needs title, metric and target"),
  calendarEvents: (r) => (isStr(r.title) && isStr(r.date) ? null : "needs title and date"),
  plannedCourses: (r) => (isStr(r.code) && isNum(r.year) && isNum(r.credits) ? null : "needs code, year and credits"),
  achievements: (r) => (isStr(r.key) ? null : "needs a key"),
};

export function validateBackup(input: unknown): BackupCheck {
  const fail = (msg: string): BackupCheck => ({ ok: false, errors: [msg], warnings: [], tables: {}, counts: {}, legacy: false });
  if (!isObj(input)) return fail("This isn't a StudyOS backup — the file doesn't contain a JSON object.");

  const file = input as BackupFile;
  const versioned = file.format === BACKUP_FORMAT;
  if (versioned && typeof file.version === "number" && file.version > BACKUP_VERSION) {
    return fail(`This backup was made by a newer version of StudyOS (format ${file.version}). Update the app, then try again.`);
  }
  // Legacy backups have tables at the top level and no `format` marker.
  const source = versioned ? file.data : file;
  if (!isObj(source)) return fail("The backup is missing its data section.");

  const errors: string[] = [];
  const warnings: string[] = [];
  const tables: BackupCheck["tables"] = {};
  const counts: BackupCheck["counts"] = {};

  for (const key of TABLE_KEYS) {
    const rows = (source as Record<string, unknown>)[key];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) { errors.push(`“${key}” should be a list.`); continue; }
    const bad = rows.findIndex((r) => !isObj(r) || ROW_RULES[key](r) !== null);
    if (bad !== -1) {
      const why = isObj(rows[bad]) ? ROW_RULES[key](rows[bad] as Record<string, unknown>) : "isn't an object";
      errors.push(`“${key}” entry ${bad + 1} ${why}.`);
      continue;
    }
    tables[key] = rows as Record<string, unknown>[];
    counts[key] = rows.length;
  }

  const known = Object.keys(counts).length + errors.length;
  if (known === 0) return fail("This file doesn't contain any StudyOS data.");
  if (!tables.settings || tables.settings.length === 0) warnings.push("The backup has no settings; defaults will be used.");
  if (tables.courses && tables.semesters) {
    const ids = new Set(tables.semesters.map((s) => s.id));
    const orphan = tables.courses.filter((c) => !ids.has(c.semesterId)).length;
    if (orphan) warnings.push(`${orphan} course${orphan === 1 ? " points" : "s point"} to a semester that isn't in the backup.`);
  }
  if (!versioned) warnings.push("This is a backup from an earlier version. Notes, goals, attendance and calendar events aren't in it, so those will be empty after restoring.");

  return { ok: errors.length === 0, errors, warnings, tables, counts, exportedAt: file.exportedAt as string | undefined, legacy: !versioned };
}

export function buildBackupFile(tables: Partial<Record<TableKey, unknown[]>>, now = new Date()): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: "StudyOS", exportedAt: now.toISOString(), data: tables };
}

export const TABLE_LABELS: Record<TableKey, string> = {
  semesters: "semesters", courses: "courses", routineItems: "routine items", tasks: "tasks", studySessions: "study sessions",
  settings: "settings", exams: "exams", attendance: "attendance records", notes: "notes", goals: "goals",
  calendarEvents: "calendar events", plannedCourses: "planned courses", achievements: "achievements",
};

export function describeCounts(counts: BackupCheck["counts"]): string[] {
  return TABLE_KEYS.filter((k) => (counts[k] ?? 0) > 0 && k !== "settings" && k !== "achievements").map((k) => `${counts[k]} ${TABLE_LABELS[k]}`);
}
