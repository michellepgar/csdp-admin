import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { RedcapReportShell } from "@/components/redcap-report-shell";
import { addRedcapTally, updateRedcapTally, removeRedcapTally, setRedcapDistributedForms } from "./actions";

/* Per-student tally entry + report, replacing the earlier v1 (which
   just summed existing Task.count numbers -- not what Michelle
   actually needed, see docs/superpowers/specs). Was open to every
   team member; back to Michelle-only for now while REDCap v2
   (per-student dedup across Initial/Follow-up visits, still being
   worked out) is in progress -- see components/sidebar.tsx's own nav
   gate, which hides the link the same way. */
export default async function RedcapReportPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");
  if (me.name !== "Michelle") redirect("/");

  return (
    <div>
      <PageHeader title="REDCap Report" />
      <PageBody>
        <RedcapReportShell
          schools={state.schools}
          redcapTallies={state.redcapTallies || []}
          redcapDistributedForms={state.redcapDistributedForms || {}}
          addRedcapTally={addRedcapTally}
          updateRedcapTally={updateRedcapTally}
          removeRedcapTally={removeRedcapTally}
          setRedcapDistributedForms={setRedcapDistributedForms}
        />
      </PageBody>
    </div>
  );
}
