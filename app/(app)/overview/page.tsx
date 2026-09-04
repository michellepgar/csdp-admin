import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { fetchAppState } from "@/lib/fetch-app-state";
import { checklistCompletion, ISSUE_TYPE_LABELS, type IssueType } from "@/lib/app-state";
import { PageBody } from "@/components/page-body";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const openIssues = (state.issues || []).filter((i) => i.status !== "Resolved");
  const issueTypeCounts = (Object.keys(ISSUE_TYPE_LABELS) as IssueType[])
    .map((type) => ({ type, label: ISSUE_TYPE_LABELS[type], count: openIssues.filter((i) => i.type === type).length }))
    .filter((t) => t.count > 0);

  /* Who's actively signed onto what right now -- every "In Progress"
     task, grouped by each VA it's assigned to (a task can have more
     than one VA signed on, so it can appear under more than one name
     here). Only VAs with at least one such task show up; an idle VA
     just doesn't get a row. */
  const inProgressByVa = new Map<string, { schoolId: string; schoolName: string; category: string; fileName: string }[]>();
  for (const school of state.schools) {
    for (const task of state.schoolData[school.id]?.tasks || []) {
      if (task.status !== "In Progress") continue;
      for (const vaName of task.vaAssigned) {
        if (!inProgressByVa.has(vaName)) inProgressByVa.set(vaName, []);
        inProgressByVa.get(vaName)!.push({ schoolId: school.id, schoolName: school.name, category: task.category, fileName: task.fileName });
      }
    }
  }
  const vaNamesWithProgress = Array.from(inProgressByVa.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      {/* Sticky, spans <main>'s full width naturally since <main> now
          carries no padding of its own (components/sidebar-shell.tsx)
          -- h1 cancels the global rule's own sticky/background, same
          trick every other page's PageHeader uses. This page keeps
          its own bigger, set-apart h1 size instead of using PageHeader
          directly since Michelle asked for this one to stand out from
          the rest. pl-12 (see PageHeader's own comment) reserves room
          for the floating "show sidebar" button so it doesn't sit on
          top of the title's first letter when collapsed/closed. h-16,
          not padding-driven, so this lines up with the sidebar's own
          top corner and every other page's header despite this one's
          bigger font (see PageHeader's own comment for why). */}
      <div className="sticky top-0 z-10 flex h-16 items-center bg-header-background pr-4 pl-12 sm:pr-6 md:pr-8">
        <h1 className="static flex items-center gap-2 bg-transparent px-0 py-0 text-4xl font-extrabold tracking-tight">
          <LayoutDashboard className="h-8 w-8" />
          Overview
        </h1>
      </div>

      <PageBody>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Currently Working On</h2>
        {vaNamesWithProgress.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has anything marked &quot;In Progress&quot; right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vaNamesWithProgress.map((vaName) => {
              const va = state.vas.find((v) => v.name === vaName);
              return (
                <div key={vaName} className="rounded-md border bg-record-background p-3">
                  <div className="mb-2 text-sm font-semibold" style={va?.color ? { color: va.color } : undefined}>
                    {vaName}
                  </div>
                  <ul className="space-y-1.5">
                    {inProgressByVa.get(vaName)!.map((t, i) => (
                      <li key={i} className="text-sm">
                        <Link href={`/schools/${t.schoolId}`} className="font-bold underline-offset-2 hover:underline">
                          {t.fileName}
                        </Link>
                        <span className="text-muted-foreground"> — {t.schoolName} · {t.category}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: alerts -- what needs attention right now. */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Alerts</h2>

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

        {/* Right: the numbers -- how many schools, how far along each is. */}
        <div className="space-y-4">
          <Card className="w-40">
            <CardHeader>
              <CardTitle className="text-muted-foreground">Schools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{state.schools.length}</div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Checklist Progress by School</h2>
            <div className="space-y-3">
              {state.schools.map((school) => {
                const pct = checklistCompletion(state, school.id);
                const tone = progressTone(pct);
                return (
                  <div key={school.id} className="rounded-md border bg-record-background p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{school.name}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${PROGRESS_BAR_CLASSES[tone]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
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
