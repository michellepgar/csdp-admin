import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin } from "@/lib/app-state";
import { groupTaskTables, openEmailItemsByVa } from "@/lib/shared-task-files";
import type { QuickAddData, QuickAddTable } from "@/components/quick-add-dialog";
import { SidebarShell } from "@/components/sidebar-shell";
import { LiveRefresh } from "@/components/live-refresh";
import { NavigationProgress } from "@/components/navigation-progress";
import { addSchool } from "./layout-actions";
import { resolveTaskPlanItem, resolvePriorityPlanItem, startReminder } from "@/app/(app)/overview/actions";
import { markMentionRead } from "@/app/(app)/mentions/actions";
import { FloatingChat } from "@/components/floating-chat";
import { addTask, setEmailStatus } from "@/app/(app)/schools/[id]/actions";
import { addGeneralTask } from "@/app/(app)/general-tasks/actions";
import { addPrivateNote, searchPrivateNotes } from "@/app/(app)/private-notes/actions";
import { addIssue } from "@/app/(app)/issues/actions";
import { addSuggestion } from "@/app/(app)/suggestions/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Demo mode has no real Supabase session for is_team_member() to check
  // against -- it would just fail RLS and land here as "not on the team",
  // so skip it entirely for the fake demo user (see getCurrentUser()'s and
  // fetchAppState()'s own demo-mode checks, which this same cookie drives).
  const isDemo = (await cookies()).get("demo-mode")?.value === "1";

  /* getCurrentUser(), the is_team_member() RPC, and fetchAppState()'s
     own ~25-query Promise.all each only depend on the request's
     already-present session cookie, not on each other's return values
     -- they used to run one after another (three full network round
     trips stacked up, on EVERY navigation, since this layout re-runs
     server-side for every page in the (app) group). Firing them
     together cuts that to about one round trip's worth of latency.
     The membership check is still evaluated (and redirected on)
     before `state` is ever read below, so behavior is unchanged --
     the only wasted work in the rare non-member/logged-out case is
     fetchAppState()'s queries running and being discarded, which RLS
     makes cheap (empty results) anyway. */
  const [user, isMember, state] = await Promise.all([
    getCurrentUser(),
    isDemo ? Promise.resolve(true) : createClient().then((supabase) => supabase.rpc("is_team_member")).then((r) => r.data),
    fetchAppState(),
  ]);

  if (!user || !user.email) redirect("/login");

  /* Checked via the same is_team_member() every table's RLS uses --
     every one of those ~25 queries is RLS-gated on team membership,
     and app_state's in particular uses .single(), which errors the
     instant RLS hides its one row (as every query does for a
     non-member). That used to make fetchAppState() return null before
     the findVaByEmail check below ever ran, so a freshly-added-but-
     not-yet-synced or removed test account saw the generic "Couldn't
     load the app" fallback instead of this page's actual "you're not
     on the team" message (see supabase/phase14_fix_app_state_rls.sql's
     comment for the incident this was found from). Checking it here,
     independently of `state`, keeps the two cases distinguishable:
     not on the team is expected and gets a clear page; anything else
     failing is a real problem. */
  if (!isDemo && !isMember) redirect("/not-on-team");

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>
      </div>
    );
  }

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const sidebarCollapsed = (await cookies()).get("sidebar-collapsed")?.value === "1";

  const schoolVaAssigned: Record<string, string> = {};
  for (const schoolId of Object.keys(state.schoolData)) {
    const va = state.schoolData[schoolId]?.vaAssigned;
    if (va) schoolVaAssigned[schoolId] = va;
  }

  /* Drives the blinking dot on the Private Notes/General Notes nav
     links -- Michelle asked for a notification "whenever someone
     shared a private note" that keeps blinking until acknowledged, so
     this reuses the same sharedWith/ackBy (Private Notes) and
     urgency==="Urgent"/ackBy (General Notes) fields those pages
     already track and show their own "needs ack" state from, rather
     than introducing a separate notification system. Computed here
     (not in Sidebar itself) since this layout already has the full
     `state` and `me` in scope; Sidebar only ever needs the two
     booleans. */
  const needsPrivateNoteAck = (state.privateNotes || []).some(
    (n) => (n.sharedWith || []).includes(me.name) && !(n.ackBy || []).includes(me.name)
  );
  const needsGeneralNoteAck = (state.generalNotes || []).some(
    (n) => n.urgency === "Urgent" && n.author !== me.name && !(n.ackBy || []).includes(me.name)
  );
  const needsIssueCommentAck = (state.issues || []).some(
    (i) => (i.comments || []).length > 0 && !(i.commentAckBy || []).includes(me.name)
  );

  const myMentions = (state.mentions || []).filter((m) => m.mentionedName === me.name);

  const myPlanItems = (state.planItems || []).filter((p) => p.vaName === me.name && !p.completedAt);
  const myOpenEmailItems = openEmailItemsByVa(state.schools, state.schoolData).get(me.name) || [];

  /* What the header's Quick add needs to put a file into an existing table:
     each school's tables, boiled down to a label and their categories. */
  const quickAddTables: Record<string, QuickAddTable[]> = {};
  for (const school of state.schools) {
    const groups = groupTaskTables(state.taskCategories || [], state.schoolData[school.id]?.taskFiles || []);
    if (groups.length === 0) continue;
    quickAddTables[school.id] = groups.map((g) => ({
      key: g.key,
      // A table with no saved id is identified only by its category combination.
      tableId: g.key.startsWith("[") ? "" : g.key,
      label: `${g.categories.map((c) => c.name).join(" + ")} (${g.files.length})`,
      categoryIds: g.categories.map((c) => c.id),
    }));
  }

  const quickAdd: QuickAddData = {
    schools: state.schools,
    isAdmin: isAdmin(me),
    vaNames: state.vas.map((v) => v.name).sort((a, b) => a.localeCompare(b)),
    categories: state.taskCategories || [],
    tablesBySchool: quickAddTables,
    generalTaskCategories: state.generalTaskCategories || [],
    issueCategories: state.issueCategories || [],
    issueTypes: state.issueTypes || [],
    addTask,
    addGeneralTask,
    addPrivateNote,
    addIssue,
    addSuggestion,
  };

  return (
    <>
    <SidebarShell
      currentName={me.name}
      currentMember={{ id: me.id, name: me.name, color: me.color }}
      presenceEnabled={!isDemo}
      schools={state.schools}
      isAdmin={isAdmin(me)}
      vas={state.vas}
      schoolVaAssigned={schoolVaAssigned}
      addSchool={addSchool}
      initialCollapsed={sidebarCollapsed}
      needsPrivateNoteAck={needsPrivateNoteAck}
      needsGeneralNoteAck={needsGeneralNoteAck}
      needsIssueCommentAck={needsIssueCommentAck}
      myMentions={myMentions}
      markMentionRead={markMentionRead}
      myPlanItems={myPlanItems}
      myWorkNotes={(state.workNotes || []).filter((n) => n.vaName === me.name)}
      myOpenEmailItems={myOpenEmailItems}
      taskCategories={state.taskCategories || []}
      generalTaskCategories={state.generalTaskCategories || []}
      resolveTaskPlanItem={resolveTaskPlanItem}
      resolvePriorityPlanItem={resolvePriorityPlanItem}
      startReminder={startReminder}
      setEmailStatus={setEmailStatus}
      quickAdd={quickAdd}
      searchNotes={searchPrivateNotes}
    >
      {children}
    </SidebarShell>
    <LiveRefresh />
    <NavigationProgress />
    <FloatingChat
      me={me.name}
      canAddPriority={isAdmin(me)}
      people={state.vas.filter((v) => v.name !== me.name).sort((a, b) => a.name.localeCompare(b.name)).map((v) => ({ id: v.id, name: v.name, color: v.color }))}
    />
    </>
  );
}
