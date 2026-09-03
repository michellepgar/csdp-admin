import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import {
  AddIssueForm,
  SoftwareIssueTable,
  RecordUpdateTable,
  CorrectionTable,
  ChartingTable,
} from "@/components/issues-list";
import {
  addIssue,
  setIssueStatus,
  removeIssue,
  setIssueFixNote,
} from "./actions";

export default async function IssuesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const issues = state.issues || [];
  const software = issues.filter((i) => i.type === "software_issue");
  const recordUpdates = issues.filter((i) => i.type === "record_update");
  const corrections = issues.filter((i) => i.type === "correction");
  const charting = issues.filter((i) => i.type === "charting");

  const tableProps = { currentUserName: me.name, currentIsAdmin: isAdmin(me), setIssueStatus, removeIssue };
  const fixProps = { setIssueFixNote };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Issues &amp; Concerns</h1>

      <AddIssueForm addIssue={addIssue} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Software Issue</h2>
        <SoftwareIssueTable issues={software} {...tableProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Record Update</h2>
        <RecordUpdateTable issues={recordUpdates} {...tableProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Correction / Verification</h2>
        <CorrectionTable issues={corrections} {...tableProps} {...fixProps} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Charting Questions</h2>
        <ChartingTable issues={charting} {...tableProps} {...fixProps} />
      </section>
    </div>
  );
}
