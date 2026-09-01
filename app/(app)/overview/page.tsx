import { fetchAppState, checklistCompletion } from "@/lib/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OverviewPage() {
  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <Card className="max-w-xs">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Schools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{state.schools.length}</div>
        </CardContent>
      </Card>
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
