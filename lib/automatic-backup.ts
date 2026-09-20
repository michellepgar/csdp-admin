import { createClient as createServiceClient } from "@supabase/supabase-js";
import { loadAppState } from "@/lib/fetch-app-state";
import { BACKUP_BUCKET, backupFileName, backupsToPrune, describeSupabaseKey, headersWithoutKeyBearer, keyProjectRef, projectRefFromUrl } from "@/lib/backup-schedule";

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

/* When the load comes back empty, say WHY in plain words instead of a
   vague failure. A wrong key is by far the most common cause: the public
   ("anon"/"publishable") key connects fine but row security hides every
   row from it, so the load looks empty rather than failing. */
type Client = Parameters<typeof loadAppState>[0];

async function explainEmptyLoad(client: Client, serviceKey: string, couldNotLoad: boolean, url: string): Promise<string> {
  const kind = describeSupabaseKey(serviceKey);
  if (kind === "public") {
    return "Nothing was saved: SUPABASE_SERVICE_ROLE_KEY in Vercel is the PUBLIC key (anon/publishable). Replace it with the secret key (service_role, or the one starting with sb_secret_) and redeploy.";
  }
  if (kind === "unreadable") {
    return "Nothing was saved: SUPABASE_SERVICE_ROLE_KEY in Vercel doesn't look like a Supabase key. Check for a missing part, or a space or quote mark at the start or end, then redeploy.";
  }
  // A key from a DIFFERENT project is rejected outright -- say so.
  const keyRef = keyProjectRef(serviceKey);
  const appRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (keyRef && appRef && keyRef !== appRef) {
    return `Nothing was saved: SUPABASE_SERVICE_ROLE_KEY belongs to a different Supabase project (${keyRef}) than this app uses (${appRef}). Copy the secret key from the ${appRef} project into Vercel and redeploy.`;
  }

  // An ordinary read (not a HEAD request, whose errors come back with no
  // text at all) so the real reason and HTTP status are visible.
  const { data, error, status, statusText } = await client.from("vas").select("id").limit(1);
  if (error || status >= 400) {
    const reason = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" · ") || "no details given";
    const advice =
      status === 401
        ? "The key was rejected -- it may be cut off, from the wrong project, or an old-style key that's been turned off. Copy the secret key again (the newer one starting with sb_secret_ is best), paste it into Vercel with no spaces or quotes, and redeploy."
        : status === 403
          ? "The key connected but was denied. Copy the secret key again into Vercel and redeploy."
          : "Try again in a minute; if it keeps happening, tell me this message.";
    const direct = await restProbe(url, serviceKey);
    return `Nothing was saved: Supabase answered ${status || "no response"} ${statusText || ""} (${reason}). Direct check -> ${direct}. ${advice}`.replace(/\s+/g, " ");
  }
  const count = data?.length ?? 0;
  return `Nothing was saved: the key looks right, but the data read came back ${couldNotLoad ? "incomplete" : "empty"} (team members found: ${count}). Try again in a minute; if it keeps happening, tell me this message.`;
}

/* A fetch that, for newer sb_ keys, doesn't also send the key as a Bearer
   token (see headersWithoutKeyBearer). */
function fetchFor(key: string): typeof fetch {
  if (!key.startsWith("sb_")) return fetch;
  return (input, init) => {
    const base = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    return fetch(input, { ...init, headers: headersWithoutKeyBearer(new Headers(base), key) });
  };
}

/* Asks the database's REST address directly, two ways, and reports just
   the HTTP status of each (never the key) -- so a rejection is pinned on
   the key/header combination instead of guessed at. */
async function restProbe(url: string, key: string): Promise<string> {
  const target = `${url.replace(/\/$/, "")}/rest/v1/vas?select=id&limit=1`;
  const attempts: [string, Record<string, string>][] = [
    ["apikey only", { apikey: key }],
    ["apikey + bearer", { apikey: key, authorization: `Bearer ${key}` }],
  ];
  const results: string[] = [];
  for (const [label, headers] of attempts) {
    try {
      const response = await fetch(target, { headers });
      results.push(`${label}: ${response.status}`);
    } catch {
      results.push(`${label}: no response`);
    }
  }
  return results.join(", ");
}

export async function runAutomaticBackup(): Promise<BackupResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // trim(): a stray space or line break from pasting would break the key.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set." };

  try {
    const client = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchFor(serviceKey) } });

    const state = await loadAppState(client);
    // Never overwrite a good backup with an empty or half-loaded one.
    if (!state || state.vas.length === 0 || state.schools.length === 0) {
      return { ok: false, error: await explainEmptyLoad(client, serviceKey, !state, url) };
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
