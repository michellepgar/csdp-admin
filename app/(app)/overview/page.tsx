import Link from "next/link";
import { fetchAppState } from "@/lib/fetch-app-state";
import { checklistCompletion } from "@/lib/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const schoolsNeedingEmailAttention = state.schools
    .filter((school) => (state.schoolData[school.id]?.emailTracker || []).some((e) => e.status !== "Done"))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="flex flex-wrap gap-4">
        <Card className="max-w-xs">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Schools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{state.schools.length}</div>
          </CardContent>
        </Card>

        <Card
          className={`max-w-sm ${
            schoolsNeedingEmailAttention.length > 0
              ? "border-status-danger-foreground/40 bg-status-danger"
              : ""
          }`}
        >
          <CardHeader>
            <CardTitle
              className={`text-sm font-medium ${
                schoolsNeedingEmailAttention.length > 0 ? "text-status-danger-foreground" : "text-muted-foreground"
              }`}
            >
              Email Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
            {schoolsNeedingEmailAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up — no open emails.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-status-danger-foreground">
                  {schoolsNeedingEmailAttention.length} school{schoolsNeedingEmailAttention.length === 1 ? "" : "s"} need attention:
                </p>
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
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Checklist Progress by School</h2>
        <div className="space-y-2">
          {state.schools.map((school) => (
            <div key={school.id} className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm font-medium">{school.name}</span>
              <span className="text-sm text-muted-foreground">{checklistCompletion(state, school.id)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
