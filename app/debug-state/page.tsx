import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

/* Temporary diagnostic page -- outside the (app) route group on
   purpose: app/(app)/layout.tsx calls fetchAppState() itself and shows
   "Couldn't load the app" for EVERY page under it (this one included)
   if that fails, before any child page body runs -- so a copy of this
   living inside (app) could never actually show anything useful.
   Still gated by the same login check as everything else. Runs the
   exact queries added across recent phases one at a time, so a
   failure shows its real Postgres/PostgREST error message instead of
   fetchAppState()'s generic null-on-any-of-~25-queries-failing.
   Delete this page once the real issue is found and fixed. */
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
    <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: "14px" }}>
      <h1 style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px" }}>Debug: state.ts query checks</h1>
      {results.map((r) => (
        <div key={r.label} style={{ color: r.ok ? "green" : "red", marginBottom: "4px" }}>
          <strong>{r.label}:</strong> {r.detail}
        </div>
      ))}
    </div>
  );
}
