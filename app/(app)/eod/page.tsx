import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { EodList } from "@/components/eod-list";
import { SubmitButton } from "@/components/submit-button";
import { addEodReport } from "./actions";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function EodPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">EOD Reports</h1>

      <form action={addEodReport} className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <input type="date" name="date" defaultValue={todayIsoDate()} required className="rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Time in</label>
            <input type="time" name="timeIn" className="rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Break</label>
            <input type="time" name="breakStart" className="rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Resume</label>
            <input type="time" name="breakEnd" className="rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Time out</label>
            <input type="time" name="timeOut" className="rounded-md border px-2 py-1.5 text-sm" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Total hours are calculated automatically from Time in/out, minus your break.</p>
        <textarea
          name="tasks"
          placeholder="What did you work on today? One item per line…"
          required
          rows={4}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <SubmitButton pendingLabel="Adding…">Add EOD report</SubmitButton>
      </form>

      <EodList reports={state.eodReports || []} vaNames={state.vas.map((v) => v.name)} />
    </div>
  );
}
