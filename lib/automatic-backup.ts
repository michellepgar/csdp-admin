import { createClient as createServiceClient } from "@supabase/supabase-js";
import { loadAppState } from "@/lib/fetch-app-state";
import { BACKUP_BUCKET, backupFileName, backupsToPrune } from "@/lib/backup-schedule";

/* The automatic nightly backup -- server-only. Runs from the cron route
   (app/api/cron/backup/route.ts, scheduled in vercel.json) and from the
   Backup page's "Back up now" button. It needs the project's SERVICE key
   because there's no signed-in person at 4 am; that key bypasses row
   security, so it lives only in the server environment (Vercel), never in
   code or the browser.

   The file is exactly what the Backup page's manual "Download Backup"
   produces (an AppState), so the existing Restore accepts it -- with one
   deliberate exception: PRIVATE NOTES ARE LEFT OUT. A service-key read
   sees every person's private notes, and any admin can download these
   files, which would let admins read other people's private notes. The
   file says so (backupMeta.excludes) and Restore then leaves everyone's
   private notes alone instead of clearing them. */

export const REQUIRED_ENV = ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"] as const;

export function missingBackupEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

export type BackupResult = { ok: true; name: string; bytes: number; kept: number } | { ok: false; error: string };

export async function runAutomaticBackup(): Promise<BackupResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set." };

  try {
    const client = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const state = await loadAppState(client);
    // Never overwrite a good backup with an empty or half-loaded one.
    if (!state || state.vas.length === 0 || state.schools.length === 0) {
      return { ok: false, error: "The data didn't load completely, so nothing was saved." };
    }

    const now = new Date();
    const payload = {
      ...state,
      privateNotes: [],
      backupMeta: { automatic: true, createdAt: now.toISOString(), excludes: ["privateNotes"] },
    };
    const json = JSON.stringify(payload);
    const name = backupFileName(now);

    const { error: uploadError } = await client.storage
      .from(BACKUP_BUCKET)
      .upload(name, new Blob([json], { type: "application/json" }), { upsert: true, contentType: "application/json" });
    if (uploadError) return { ok: false, error: `Couldn't save the backup file: ${uploadError.message}` };

    // Keep only the newest BACKUPS_TO_KEEP (14) -- older ones are deleted each night.
    const { data: listed } = await client.storage.from(BACKUP_BUCKET).list("", { limit: 200, sortBy: { column: "name", order: "desc" } });
    const names = (listed ?? []).map((file) => file.name);
    const stale = backupsToPrune(names);
    if (stale.length > 0) await client.storage.from(BACKUP_BUCKET).remove(stale);

    return { ok: true, name, bytes: new TextEncoder().encode(json).length, kept: names.length - stale.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The backup failed." };
  }
}
