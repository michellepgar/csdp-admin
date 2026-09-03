import Link from "next/link";
import { fetchAppState } from "@/lib/fetch-app-state";
import { checklistCompletion, ISSUE_TYPE_LABELS, type IssueType } from "@/lib/app-state";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

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
    </div>
  );
}
