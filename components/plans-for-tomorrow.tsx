"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { vaColorByName, type PlanItem, type Va } from "@/lib/app-state";

/* Every VA's own plan for tomorrow -- both their own carried-over
   tasks (kind:"task") and any priority assigned to them by name
   (kind:"priority" with vaName set), grouped by VA. Unassigned/shared
   priorities are NOT shown here -- those live only in the Task
   Priorities widget beside Alerts, until a VA claims one (at which
   point it gets a vaName and shows up here). kind:"note" reminders are
   excluded entirely -- those are personal Your-Plan-bubble items, not
   part of the shared tomorrow plan, and a completed one (completedAt
   set) has no business showing up here as if still pending. */
export function PlansForTomorrow({ planItems, vas, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  removePlanItem: (formData: FormData) => void;
}) {
  const byVa = new Map<string, PlanItem[]>();
  for (const item of planItems) {
    if (!item.vaName || item.kind === "note") continue;
    if (!byVa.has(item.vaName)) byVa.set(item.vaName, []);
    byVa.get(item.vaName)!.push(item);
  }
  const vaNames = Array.from(byVa.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h2 className="mb-3 font-semibold">Plans for Tomorrow</h2>
      {vaNames.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vaNames.map((vaName) => (
          <div key={vaName} className="rounded-md border border-l-4 bg-record-background p-3" style={{ borderLeftColor: vaColorByName(vas, vaName) || "var(--plan-accent)" }}>
            <div className="mb-2 text-sm font-semibold" style={vaColorByName(vas, vaName) ? { color: vaColorByName(vas, vaName) } : undefined}>{vaName}</div>
            <ul className="space-y-1.5">
              {byVa.get(vaName)!.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center">{item.kind === "priority" && <span className="priority-dot" aria-hidden />}{item.label}</span>
                  <form action={removePlanItem}><input type="hidden" name="id" value={item.id} /><ConfirmDeleteButton confirmMessage={`Remove "${item.label}" from ${vaName}'s plan?`} pendingLabel="…">✕</ConfirmDeleteButton></form>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
