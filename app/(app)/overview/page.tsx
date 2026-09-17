import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { fetchAppState } from "@/lib/fetch-app-state";
import { checklistCompletion, findVaByEmail, isAdmin, ISSUE_TYPE_LABELS, type IssueType } from "@/lib/app-state";
import { getCurrentUser } from "@/lib/supabase/server";
import { todayActivityByVa } from "@/lib/shared-task-files";
import { PageBody } from "@/components/page-body";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanTomorrowPicker } from "@/components/plan-tomorrow-picker";
import { PlansForTomorrow } from "@/components/plans-for-tomorrow";
import { SubmitButton } from "@/components/submit-button";
import { savePlan, addPriority, removePlanItem, startNewDay } from "./actions";

/* Same red/orange/green thresholds used for a checklist progress bar's
   fill color -- <34% still has most of the list left (danger), 34-66%
   is partway (warning), 67%+ is mostly/fully done (success). Spelled
   out as full class names (not built with a template string) so
   Tailwind's static scanner actually picks them up. */
const PROGRESS_BAR_CLASSES = {
  danger: "bg-status-danger-foreground",
  warning: "bg-status-warning-foreground",
  success: "bg-status-success-foreground",
};

function progressTone(pct: number): keyof typeof PROGRESS_BAR_CLASSES {
  if (pct < 34) return "danger";
  if (pct < 67) return "warning";
  return "success";
}

export default async function OverviewPage() {
  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const schoolsNeedingEmailAttention = state.schools
    .filter((school) => (state.schoolData[school.id]?.emailTracker || []).some((e) => e.status !== "Done"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const allEmailItems = state.schools.flatMap((s) => state.schoolData[s.id]?.emailTracker || []);
  const needsResponseCount = allEmailItems.filter((e) => e.status === "Needs My Response").length;
  const waitingOnThemCount = allEmailItems.filter((e) => e.status === "Waiting on Them").length;

  const completedSchoolsCount = state.schools.filter((school) => checklistCompletion(state, school.id) === 100).length;

  const openIssues = (state.issues || []).filter((i) => i.status !== "Resolved");
  const issueTypeCounts = (Object.keys(ISSUE_TYPE_LABELS) as IssueType[])
    .map((type) => ({ type, label: ISSUE_TYPE_LABELS[type], count: openIssues.filter((i) => i.type === type).length }))
    .filter((t) => t.count > 0);

  const user = await getCurrentUser();
  const me = user?.email ? findVaByEmail(state, user.email) : undefined;

  const todayByVa = todayActivityByVa(state.schools, state.schoolData, state.generalTasks || [], state.statusChangedAt || {});
  const vaNamesWithActivity = Array.from(todayByVa.keys()).sort((a, b) => a.localeCompare(b));

  const myPlanItems = (state.planItems || []).filter((p) => p.kind === "task" && p.vaName === me?.name);

  return (
    <div>
      {/* Sticky, spans <main>'s full width naturally since <main> now
          carries no padding of its own (components/sidebar-shell.tsx)
          -- h1 cancels the global rule's own sticky/background, same
          trick every other page's PageHeader uses. This page still
          builds its own title row (rather than using PageHeader
          directly) for the LayoutDashboard icon next to the text, but
          the text itself is the same uniform h1 size as every other
          page now (see app/globals.css's own h1 rule) -- it used to be
          its own larger size, deliberately set apart from the rest;
          Michelle later asked for every header to be uniform instead.
          pl-12 (see PageHeader's own comment) reserves room for the
          floating "show sidebar" button so it doesn't sit on top of
          the title's first letter when collapsed/closed. h-14, not
          padding-driven, so this lines up with the sidebar's own top
          corner and every other page's header (see PageHeader's own
          comment for why this shrank from h-16). */}
      <div className="sticky top-0 z-10 flex h-14 items-center bg-header-background pr-4 pl-12 sm:pr-6 md:pr-8">
        <h1 className="static flex items-center gap-2 bg-transparent px-0 py-0">
          <LayoutDashboard className="h-5 w-5" />
          Overview
        </h1>
      </div>

      <PageBody>
      <div>
        <h2 className="mb-3 font-semibold">Today</h2>
        {vaNamesWithActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity today yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vaNamesWithActivity.map((vaName) => {
              const va = state.vas.find((v) => v.name === vaName);
              return (
                <div key={vaName} className="rounded-md border border-l-4 border-l-plan-accent-secondary bg-record-background p-3">
                  <div className="mb-2 text-sm font-semibold" style={va?.color ? { color: va.color } : undefined}>
                    {vaName}
                  </div>
                  <ul className="space-y-1.5">
                    {todayByVa.get(vaName)!.map((t, i) => (
                      <li key={i} className="text-sm">
                        <Link href={t.schoolId ? `/schools/${t.schoolId}` : "/general-tasks"} className="font-bold underline-offset-2 hover:underline">
                          {t.fileName}
                        </Link>
                        <span className="text-muted-foreground"> — {t.schoolName} · {t.category}</span>
                        {t.state === "completed-today" && <span className="text-status-success-foreground"> (completed today)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {me && (
        <div className="flex flex-wrap gap-2">
          <PlanTomorrowPicker
            currentUserName={me.name}
            schools={state.schools}
            schoolData={state.schoolData}
            generalTasks={state.generalTasks || []}
            myPlanItems={myPlanItems}
            savePlan={savePlan}
          />
          <form action={startNewDay}>
            <SubmitButton variant="outline" size="sm" pendingLabel="…">Start a New Day</SubmitButton>
          </form>
        </div>
      )}

      <PlansForTomorrow
        planItems={state.planItems || []}
        vas={state.vas}
        isCurrentUserAdmin={!!me && isAdmin(me)}
        addPriority={addPriority}
        removePlanItem={removePlanItem}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: alerts -- what needs attention right now. */}
        <div className="space-y-4">
          <h2 className="font-semibold">Alerts</h2>

          <Card className={schoolsNeedingEmailAttention.length > 0 ? "border-status-danger-foreground/40 bg-status-danger" : ""}>
            <CardHeader>
              <CardTitle className={schoolsNeedingEmailAttention.length > 0 ? "text-status-danger-foreground" : "text-muted-foreground"}>
                Email Tracker
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schoolsNeedingEmailAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground">All caught up — no open emails.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3 text-sm font-medium text-status-danger-foreground">
                    <span>Needs My Response: {needsResponseCount}</span>
                    <span>Waiting on Them: {waitingOnThemCount}</span>
                  </div>
                  <ul className="space-y-1">
                    {schoolsNeedingEmailAttention.map((school) => (
                      <li key={school.id}>
                        <Link
                          href={`/schools/${school.id}#email-tracker`}
                          className="text-sm text-status-danger-foreground underline underline-offset-2"
                        >
                          {school.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={openIssues.length > 0 ? "border-status-warning-foreground/40 bg-status-warning" : ""}>
            <CardHeader>
              <CardTitle className={openIssues.length > 0 ? "text-status-warning-foreground" : "text-muted-foreground"}>
                Issues &amp; Concerns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing open right now.</p>
              ) : (
                <div className="space-y-2">
                  <ul className="space-y-1 text-sm font-medium text-status-warning-foreground">
                    {issueTypeCounts.map((t) => (
                      <li key={t.type}>{t.label}: {t.count}</li>
                    ))}
                  </ul>
                  <Link href="/issues" className="text-sm text-status-warning-foreground underline underline-offset-2">
                    View Issues &amp; Concerns
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: how far along each school is. */}
        <div className="space-y-4">
          <div>
            <div className="mb-3 flex items-center justify-between bg-header-background px-2 py-1">
              <h2 className="static bg-transparent px-0 py-0 font-semibold">Checklist Progress by School</h2>
              <span className="text-sm font-medium text-white">{completedSchoolsCount}/{state.schools.length} completed</span>
            </div>
            <div className="space-y-3">
              {state.schools.map((school) => {
                const pct = checklistCompletion(state, school.id);
                const tone = progressTone(pct);
                return (
                  <Link
                    key={school.id}
                    href={`/schools/${school.id}`}
                    className="block rounded-md border bg-record-background p-3 hover:bg-[color-mix(in_oklch,var(--record-background),var(--primary)_8%)]"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium underline-offset-2 hover:underline">{school.name}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${PROGRESS_BAR_CLASSES[tone]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </PageBody>
    </div>
  );
}
