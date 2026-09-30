import { db, runDataMigrations } from "@/db/db";
import { BACKUP_FORMAT, BackupCheck, buildBackupFile, TABLE_KEYS, TableKey } from "@/lib/backup";

export async function exportBackupObject() {
  const tables: Partial<Record<TableKey, unknown[]>> = {};
  for (const key of TABLE_KEYS) tables[key] = await db.table(key).toArray();
  return buildBackupFile(tables);
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const backupFilename = () => `studyos-backup-${new Date().toISOString().slice(0, 10)}.json`;

/**
 * Replaces everything on this device with a VALIDATED backup, atomically:
 * if any write fails the transaction rolls back and existing data is untouched.
 */
export async function restoreBackup(check: BackupCheck): Promise<void> {
  if (!check.ok) throw new Error("The backup didn't pass validation.");
  const tableObjs = TABLE_KEYS.map((k) => db.table(k)).concat(db.table("activeTimer"));
  await db.transaction("rw", tableObjs, async () => {
    for (const t of tableObjs) await t.clear();
    for (const key of TABLE_KEYS) {
      const rows = check.tables[key];
      if (rows?.length) await db.table(key).bulkAdd(rows);
    }
  });
  await runDataMigrations(); // backfills settings from older backups, tidies duplicates
}

export { BACKUP_FORMAT };
