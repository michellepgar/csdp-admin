/* Pure helpers for the automatic nightly backup (no server/client
   imports, so the Backup page, the cron route and the tests can all use
   them). Backup files live in a private storage bucket, one per day,
   named YYYY-MM-DD.json (Eastern time, matching the rest of the app). */

export const BACKUP_BUCKET = "backups";
export const BACKUPS_TO_KEEP = 14;
/* The job runs once a day. Past this many hours with no new file, the
   Backup page warns that something's wrong instead of showing a calm
   "everything's fine". */
export const STALE_AFTER_HOURS = 36;

const FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;

export function backupFileName(when: Date): string {
  const day = when.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `${day}.json`;
}

export function isBackupFileName(name: string): boolean {
  return FILE_PATTERN.test(name);
}

/* Which files to delete so only the newest `keep` remain. Names sort
   chronologically, so newest = lexicographically largest. Anything that
   isn't one of our backup files is never touched. */
export function backupsToPrune(names: string[], keep: number = BACKUPS_TO_KEEP): string[] {
  return names
    .filter(isBackupFileName)
    .sort()
    .reverse()
    .slice(keep);
}

export type BackupHealth = "ok" | "stale" | "none";

export function backupHealth(lastBackupAt: string | undefined, now: number = Date.now()): BackupHealth {
  if (!lastBackupAt) return "none";
  const hours = (now - new Date(lastBackupAt).getTime()) / 3_600_000;
  return hours <= STALE_AFTER_HOURS ? "ok" : "stale";
}

/* Three made-up recent backups, for the demo (which has no storage) to
   show what the Backup page's panel looks like. */
export function demoBackupFiles(): { name: string; size: number; updatedAt: string }[] {
  return [0, 1, 2].map((daysAgo) => {
    const when = new Date(Date.now() - daysAgo * 86_400_000);
    when.setHours(8, 0, 12, 0);
    return { name: backupFileName(when), size: 2_400_000 - daysAgo * 90_000, updatedAt: when.toISOString() };
  });
}

/* What kind of key is this? Reads only the harmless label part -- the
   "role" inside a legacy JWT key, or the "sb_secret_"/"sb_publishable_"
   prefix of a newer key -- and never returns any of the secret itself, so
   the result is safe to show in an error message. Used to tell someone
   they pasted the public key where the secret one belongs. */
export type KeyKind = "service_role" | "secret" | "public" | "unreadable";

export function describeSupabaseKey(key: string | undefined): KeyKind {
  const value = (key ?? "").trim();
  if (value.startsWith("sb_secret_")) return "secret";
  if (value.startsWith("sb_publishable_")) return "public";
  if (value.startsWith("eyJ")) {
    try {
      const payload = value.split(".")[1] ?? "";
      const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: string };
      if (json.role === "service_role") return "service_role";
      if (json.role === "anon") return "public";
    } catch {
      // Falls through to unreadable.
    }
  }
  return "unreadable";
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
