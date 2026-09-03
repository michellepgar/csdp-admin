import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

/* Temporary diagnostic page -- not linked from the sidebar, and gated
   by the same login check as everything else. Runs the exact queries
   added for Phase 13 (plus a couple of earlier ones as a sanity check)
   directly, one at a time, so a failure shows its real Postgres/
   PostgREST error message instead of the generic "Couldn't load the
   app" fallback fetchAppState()'s callers show when ANY of its ~25
   parallel queries errors. Delete this page once the real issue is
   found and fixed. */
export default async function DebugStatePage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks: [string, () => any][] = [
    ["vas (sanity check)", () => supabase.from("vas").select("id, name").limit(1)],
    ["schools (sanity check)", () => supabase.from("schools").select("id, name, no_recheck").limit(1)],
    ["issue_categories", () => supabase.from("issue_categories").select("id, name").order("sort_order")],
    ["issue_subcategories", () => supabase.from("issue_subcategories").select("id, category_id, name").order("sort_order")],
    ["issues.subcategory column", () => supabase.from("issues").select("id, subcategory").limit(1)],
    ["issues.fix_note column", () => supabase.from("issues").select("id, fix_note").limit(1)],
    ["tasks.comms_status column", () => supabase.from("tasks").select("id, comms_status, comms_va_assigned").limit(1)],
    ["checklist_progress.checked_by column", () => supabase.from("checklist_progress").select("school_id, checked_by").limit(1)],
  ];

  const results: { label: string; ok: boolean; detail: string }[] = [];
  for (const [label, query] of checks) {
    const { data, error } = await query();
    results.push({
      label,
      ok: !error,
      detail: error
        ? `ERROR ${error.code ?? ""}: ${error.message}${error.hint ? ` (hint: ${error.hint})` : ""}`
        : `ok, ${data?.length ?? 0} row(s)`,
    });
  }

  return (
    <div className="space-y-2 p-4 font-mono text-sm">
      <h1 className="text-lg font-bold">Debug: state.ts query checks</h1>
      {results.map((r) => (
        <div key={r.label} className={r.ok ? "text-green-700" : "text-red-700"}>
          <strong>{r.label}:</strong> {r.detail}
        </div>
      ))}
    </div>
  );
}
