import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { EodList } from "@/components/eod-list";
import { EodEntryForm } from "@/components/eod-entry-form";
import { addEodReport, updateEodReport, removeEodReport } from "./actions";

export default async function EodPage({ searchParams }: { searchParams: Promise<{ draftTasks?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  // "Send to EOD" (Overview's Currently Working On) hands its lines off
  // this way -- just fills the tasks box, still needs hours before saving.
  const { draftTasks } = await searchParams;

  return (
    <div>
      <PageHeader title="EOD Reports" />
      <PageBody>
      <EodEntryForm action={addEodReport} defaultTasks={draftTasks} />

      <EodList
        reports={state.eodReports || []}
        vaNames={state.vas.map((v) => v.name)}
        currentUserName={me.name}
        currentIsAdmin={isAdmin(me)}
        updateEodReport={updateEodReport}
        removeEodReport={removeEodReport}
      />
      </PageBody>
    </div>
  );
}
