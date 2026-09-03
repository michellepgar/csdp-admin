import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";

/* Temporary diagnostic page (outside the (app) route group on purpose
   -- see the git history for why: app/(app)/layout.tsx calls
   fetchAppState() itself and gates every page under it on that
   succeeding, so a copy of this living inside (app) could never show
   anything useful for a user fetchAppState() is failing for).

   Shows exactly why a specific logged-in user is failing the
   is_team_member() check that "Couldn't load the app" hides behind --
   the raw auth email (to catch stray whitespace/case a screenshot
   wouldn't reveal), every row in `vas` for comparison, and the actual
   Postgres error from the same app_state query fetchAppState() runs
   first. Delete this page once the real issue is found and fixed. */
export default async function DebugStatePage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const supabase = await createClient();

  const { data: allVas, error: vasError } = await supabase.from("vas").select("id, name, email");
  const { data: appStateData, error: appStateError } = await supabase.from("app_state").select("data").eq("id", 1).single();

  return (
    <div style={{ padding: "1rem", fontFamily: "monospace", fontSize: "14px", whiteSpace: "pre-wrap" }}>
      <h1 style={{ fontWeight: "bold", fontSize: "18px", marginBottom: "8px" }}>Debug: team membership check</h1>

      <p><strong>Logged-in auth email (raw, JSON-quoted to reveal hidden whitespace):</strong></p>
      <p>{JSON.stringify(user.email)}</p>

      <p style={{ marginTop: "12px" }}><strong>vas table query:</strong> {vasError ? `ERROR: ${vasError.message}` : `ok, ${allVas?.length ?? 0} row(s)`}</p>
      {allVas && (
        <ul>
          {allVas.map((v) => {
            const matches = (v.email || "").toLowerCase() === user.email!.toLowerCase();
            return (
              <li key={v.id} style={{ color: matches ? "lightgreen" : "inherit" }}>
                {JSON.stringify(v.email)} -- {v.name} {matches ? "  <-- MATCHES logged-in email" : ""}
              </li>
            );
          })}
        </ul>
      )}

      <p style={{ marginTop: "12px" }}>
        <strong>app_state single-row query (same one fetchAppState() runs first):</strong>{" "}
        {appStateError ? `ERROR ${appStateError.code ?? ""}: ${appStateError.message}` : `ok, got a row (data present: ${!!appStateData?.data})`}
      </p>
    </div>
  );
}
