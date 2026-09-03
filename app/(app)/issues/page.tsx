import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import {
  AddIssueForm,
  SoftwareIssueTable,
  CorrectionTable,
  ChartingTable,
} from "@/components/issues-list";
import {
  addIssue,
  setIssueStatus,
  removeIssue,
  setIssueFixNote,
  setIssueNote,
  addIssueCategory,
  removeIssueCategory,
  addIssueSubcategory,
  removeIssueSubcategory,
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
  const corrections = issues.filter((i) => i.type === "correction");
  const charting = issues.filter((i) => i.type === "charting");

  const tableProps = { currentUserName: me.name, currentIsAdmin: isAdmin(me), setIssueStatus, removeIssue };
  const fixProps = { setIssueFixNote };

  return (
    <div className="space-y-8">
      <PageHeader title="Issues & Concerns" userName={me.name} />

      <AddIssueForm
        addIssue={addIssue}
        issueCategories={state.issueCategories || []}
        addIssueCategory={addIssueCategory}
        removeIssueCategory={removeIssueCategory}
        addIssueSubcategory={addIssueSubcategory}
        removeIssueSubcategory={removeIssueSubcategory}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Software Issue</h2>
        <SoftwareIssueTable issues={software} {...tableProps} setIssueNote={setIssueNote} />
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
