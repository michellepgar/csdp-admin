/* Pure helpers for the automatic nightly backup (no server/client
   imports, so the Backup page, the cron route and the tests can all use
   them). Backup files live in a private storage bucket, one per day,
   named YYYY-MM-DD.json (Eastern time, matching the rest of the app). */

export const BACKUP_BUCKET = "backups";
export const BACKUPS_TO_KEEP = 14;
/* "Before restore" safety copies (saved automatically just before a
   restore, so it can be undone) -- only the newest few are worth keeping. */
export const SAFETY_BACKUPS_TO_KEEP = 5;
/* The job runs once a day. Past this many hours with no new file, the
   Backup page warns that something's wrong instead of showing a calm
   "everything's fine". */
export const STALE_AFTER_HOURS = 36;

const NIGHTLY_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;
const SAFETY_PATTERN = /^before-restore-\d{4}-\d{2}-\d{2}-\d{6}\.json$/;

export function backupFileName(when: Date): string {
  const day = when.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `${day}.json`;
}

export function isSafetyBackupName(name: string): boolean {
  return SAFETY_PATTERN.test(name);
}

export function isBackupFileName(name: string): boolean {
  return NIGHTLY_PATTERN.test(name) || SAFETY_PATTERN.test(name);
}

/* "before-restore-2026-09-20-143005.json" -- Eastern date and time, to the
   second, so two restores in one day never collide. */
export function safetyBackupFileName(when: Date): string {
  const day = when.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const time = when
    .toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false })
    .replace(/:/g, "");
  return `before-restore-${day}-${time}.json`;
}

/* The calendar date a backup file was made for, "YYYY-MM-DD". */
export function backupDateOf(name: string): string | undefined {
  return name.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
}

/* Which files to delete so only the newest `keep` remain. Names sort
   chronologically, so newest = lexicographically largest. Anything that
   isn't one of our backup files is never touched. */
export function backupsToPrune(names: string[], keep: number = BACKUPS_TO_KEEP, keepSafety: number = SAFETY_BACKUPS_TO_KEEP): string[] {
  const newestFirst = (list: string[]) => [...list].sort().reverse();
  const nightly = newestFirst(names.filter((name) => NIGHTLY_PATTERN.test(name)));
  const safety = newestFirst(names.filter((name) => SAFETY_PATTERN.test(name)));
  return [...nightly.slice(keep), ...safety.slice(keepSafety)];
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
  const nightly = [0, 1, 2].map((daysAgo) => {
    const when = new Date(Date.now() - daysAgo * 86_400_000);
    when.setHours(8, 0, 12, 0);
    return { name: backupFileName(when), size: 2_400_000 - daysAgo * 90_000, updatedAt: when.toISOString() };
  });
  const before = new Date(Date.now() - 3 * 3_600_000);
  return [{ name: safetyBackupFileName(before), size: 2_450_000, updatedAt: before.toISOString() }, ...nightly];
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

/* The project a legacy (JWT-style) key belongs to -- its "ref" claim,
   which is just the project's public id (the same string that's in the
   project URL), not a secret. undefined for newer sb_ keys, which don't
   carry it. Lets us say "this key is from a different project" instead of
   a vague failure. */
export function keyProjectRef(key: string | undefined): string | undefined {
  const value = (key ?? "").trim();
  if (!value.startsWith("eyJ")) return undefined;
  try {
    const payload = value.split(".")[1] ?? "";
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { ref?: string };
    return typeof json.ref === "string" ? json.ref : undefined;
  } catch {
    return undefined;
  }
}

/* "https://abcd1234.supabase.co" -> "abcd1234". */
export function projectRefFromUrl(url: string | undefined): string | undefined {
  try {
    return new URL(url ?? "").hostname.split(".")[0] || undefined;
  } catch {
    return undefined;
  }
}

/* Newer Supabase secret keys (sb_secret_...) are NOT JWTs: they belong in
   the "apikey" header only. A client that also sends the key as
   "Authorization: Bearer <key>" gets it rejected as an invalid token. This
   drops that one header when it's just the key echoed back, and leaves
   every other request untouched. */
export function headersWithoutKeyBearer(headers: Headers, key: string): Headers {
  const next = new Headers(headers);
  if (key.startsWith("sb_") && next.get("authorization") === `Bearer ${key}`) next.delete("authorization");
  return next;
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
