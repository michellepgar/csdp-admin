// app/api/hq/my-work/route.ts
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { SUPERADMIN_NAME } from "@/lib/app-state";
import { headersWithoutKeyBearer } from "@/lib/backup-schedule";
import { hqKeyOk, shapeMyWork } from "@/lib/hq-my-work";

// Always fresh, never cached.
export const dynamic = "force-dynamic";

/* Michelle HQ reads what's waiting on Michelle from here, read-only. The caller is HQ's server, not a person, so
   (like api/cron) this path skips the sign-in redirect in proxy.ts and the secret is the only gate. Only selects, only
   the columns shapeMyWork needs, a few small queries at once: it stays inside Cloudflare's per-request CPU limit.
   Error replies are fixed sentences: no database message, key or row ever goes into one. */
const NO_STORE = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET(request: Request) {
  // trim(): a stray line break from pasting the secret would otherwise make every call a 401.
  const secret = (process.env.HQ_READ_SECRET ?? "").trim();
  if (!secret) return fail("HQ_READ_SECRET isn't set.", 500);
  if (!hqKeyOk(request.headers.get("authorization"), secret)) return fail("Unauthorized", 401);

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(), key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return fail("The database keys aren't set.", 500);
  const db = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchFor(key) } });
  // SUPERADMIN_NAME is Michelle's name in lib/app-state.ts; it is what the tracker's own pages use for "me".
  const me = SUPERADMIN_NAME.trim();

  let reads;
  try {
    const [cats, gen, emails, issues, plan, schools, catNames, blob, mentions] = await Promise.all([
      db.from("task_file_categories").select("id, task_file_id, category_id, status, va_assigned, status_changed_at").contains("va_assigned", [me]).neq("status", "Completed"),
      db.from("general_tasks").select("id, category, description, status, va_assigned, status_changed_at").contains("va_assigned", [me]).neq("status", "Completed"),
      db.from("email_tracker_items").select("id, school_id, description, status, created_at").eq("status", "Needs My Response"),
      db.from("issues").select("id, type, category, subcategory, school, status, created_at, reported_by, comment_ack_by").eq("status", "Pending"),
      db.from("plan_items").select("id, kind, label, task_file_category_id, general_task_id, sort_order, created_at, completed_at").eq("va_name", me).in("kind", ["priority", "task", "meeting"]),
      db.from("schools").select("id, name"),
      db.from("task_categories").select("id, name"),
      db.from("app_state").select("schoolData:data->schoolData").eq("id", 1).maybeSingle(),
      db.from("mentions").select("issue_id").eq("mentioned_name", me).eq("source", "issue_comment").is("read_at", null),
    ]);
    if ([cats, gen, emails, issues, plan, schools, catNames, blob, mentions].some((r) => r.error)) return fail("Couldn't read the tracker.", 502);

    const fileIds = [...new Set((cats.data ?? []).map((c) => c.task_file_id as string))];
    const issueIds = (issues.data ?? []).map((i) => i.id as string);
    const [files, comments] = await Promise.all([
      fileIds.length ? db.from("task_files").select("id, school_id, file_name").in("id", fileIds) : Promise.resolve({ data: [], error: null }),
      issueIds.length ? db.from("issue_comments").select("issue_id").in("issue_id", issueIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (files.error || comments.error) return fail("Couldn't read the tracker.", 502);

    reads = { cats, gen, emails, issues, plan, schools, catNames, blob, mentions, files, comments };
  } catch {
    return fail("Couldn't read the tracker.", 502);
  }
  const { cats, gen, emails, issues, plan, schools, catNames, blob, mentions, files, comments } = reads;

  try {
    const body = shapeMyWork({
      me, trackerUrl: new URL(request.url).origin, now: new Date().toISOString(),
      categories: (cats.data ?? []) as never, files: (files.data ?? []) as never, categoryNames: (catNames.data ?? []) as never, schools: (schools.data ?? []) as never,
      generalTasks: (gen.data ?? []) as never, schoolData: ((blob.data as { schoolData?: unknown } | null)?.schoolData ?? null) as never,
      emails: (emails.data ?? []) as never, issues: (issues.data ?? []) as never,
      issueIdsWithComments: [...new Set((comments.data ?? []).map((c) => c.issue_id as string))],
      issueIdsMentioningMe: [...new Set((mentions.data ?? []).map((m) => m.issue_id as string).filter(Boolean))],
      plan: (plan.data ?? []) as never,
    });
    return Response.json(body, { headers: NO_STORE });
  } catch {
    return fail("Couldn't shape the reply.", 500);
  }
}

/* Same as lib/automatic-backup.ts: newer sb_ keys must not also be sent as a Bearer token. The header rule itself is
   headersWithoutKeyBearer (lib/backup-schedule.ts, no imports); importing automatic-backup here would drag the whole
   app-state loader into this light route. */
function fetchFor(key: string): typeof fetch {
  if (!key.startsWith("sb_")) return fetch;
  return (input, init) => {
    const base = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    return fetch(input, { ...init, headers: headersWithoutKeyBearer(new Headers(base), key) });
  };
}
