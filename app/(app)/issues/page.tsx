import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import {
  AddIssueForm,
  SoftwareIssueTable,
  CorrectionTable,
  ChartingTable,
} from "@/components/issues-list";
import {
  addIssue,
  setIssueStatus,
  editIssue,
  removeIssue,
  addIssueComment,
  editIssueComment,
  removeIssueComment,
  ackIssueComments,
  addIssueCategory,
  removeIssueCategory,
  addIssueSubcategory,
  removeIssueSubcategory,
  addIssueType,
  removeIssueType,
} from "./actions";

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ expandIssue?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const { expandIssue } = await searchParams;
  const issues = state.issues || [];
  const software = issues.filter((i) => i.type === "software_issue");
  const corrections = issues.filter((i) => i.type === "correction");
  const charting = issues.filter((i) => i.type === "charting");
  const issueTypes = state.issueTypes || [];

  const tableProps = { currentUserName: me.name, currentIsAdmin: isAdmin(me), vas: state.vas || [], expandIssueId: expandIssue, setIssueStatus, editIssue, removeIssue, addIssueComment, editIssueComment, removeIssueComment, ackIssueComments };

  return (
    <div>
      <PageHeader title="Issues & Concerns" />
      <PageBody gap={8}>
        <AddIssueForm
          addIssue={addIssue}
          issueTypes={issueTypes}
          addIssueType={addIssueType}
          removeIssueType={removeIssueType}
          issueCategories={state.issueCategories || []}
          addIssueCategory={addIssueCategory}
          removeIssueCategory={removeIssueCategory}
          addIssueSubcategory={addIssueSubcategory}
          removeIssueSubcategory={removeIssueSubcategory}
        />

        <section className="space-y-3">
          <h2 className="font-semibold">Software Issue</h2>
          <SoftwareIssueTable issues={software} {...tableProps} />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Review Patient Information</h2>
          <CorrectionTable issues={corrections} {...tableProps} />
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Charting Questions</h2>
          <ChartingTable issues={charting} {...tableProps} />
        </section>

        {/* One section per type the team added (see "+ New type" above). */}
        {issueTypes.map((customType) => (
          <section key={customType.id} className="space-y-3">
            <h2 className="font-semibold">{customType.name}</h2>
            <SoftwareIssueTable
              showCategory={false}
              emptyText={`No ${customType.name.toLowerCase()} reported.`}
              issues={issues.filter((i) => i.type === "custom" && i.customTypeId === customType.id)}
              {...tableProps}
            />
          </section>
        ))}
      </PageBody>
    </div>
  );
}
