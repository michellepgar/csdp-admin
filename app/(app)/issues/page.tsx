import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { AddIssueForm, IssuesTable } from "@/components/issues-list";
import {
  addIssue,
  setIssueStatus,
  removeIssue,
  signIssueFix,
  removeIssueFixSignature,
} from "./actions";

export default async function IssuesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const issues = state.issues || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Issues &amp; Concerns</h1>

      <AddIssueForm addIssue={addIssue} />

      <IssuesTable
        issues={issues}
        currentUserName={me.name}
        currentIsAdmin={isAdmin(me)}
        setIssueStatus={setIssueStatus}
        removeIssue={removeIssue}
        signIssueFix={signIssueFix}
        removeIssueFixSignature={removeIssueFixSignature}
      />
    </div>
  );
}
