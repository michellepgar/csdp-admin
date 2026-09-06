import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { RedcapReportShell } from "@/components/redcap-report-shell";
import { addRedcapTally, removeRedcapTally } from "./actions";

/* Per-student tally entry + report, replacing the earlier v1 (which
   just summed existing Task.count numbers -- not what Michelle
   actually needed, see docs/superpowers/specs). Only reachable via a
   nav link Michelle alone sees (app/(app)/layout.tsx); the page itself
   isn't further access-gated yet, per her own call to keep this quick. */
export default async function RedcapReportPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div>
      <PageHeader title="REDCap Report" />
      <PageBody>
        <RedcapReportShell
          schools={state.schools}
          redcapTallies={state.redcapTallies || []}
          addRedcapTally={addRedcapTally}
          removeRedcapTally={removeRedcapTally}
        />
      </PageBody>
    </div>
  );
}
