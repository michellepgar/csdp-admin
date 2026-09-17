"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { vaColorByName, type PlanItem, type Va } from "@/lib/app-state";

/* Every VA's own plan for tomorrow, all in one place -- both their own
   carried-over tasks (kind:"task") and any boss-added priorities
   (kind:"priority") show up together here, grouped by VA. The same
   priorities also show, on their own, in the compact Task Priorities
   widget beside Alerts -- this is the full picture across everyone. */
export function PlansForTomorrow({ planItems, vas, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  removePlanItem: (formData: FormData) => void;
}) {
  const byVa = new Map<string, PlanItem[]>();
  const shared: PlanItem[] = [];
  for (const item of planItems) {
    if (item.vaName) { if (!byVa.has(item.vaName)) byVa.set(item.vaName, []); byVa.get(item.vaName)!.push(item); }
    else shared.push(item);
  }
  const vaNames = Array.from(byVa.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h2 className="mb-3 font-semibold">Plans for Tomorrow</h2>
      {planItems.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vaNames.map((vaName) => (
          <div key={vaName} className="rounded-md border border-l-4 bg-record-background p-3" style={{ borderLeftColor: vaColorByName(vas, vaName) || "var(--plan-accent)" }}>
            <div className="mb-2 text-sm font-semibold" style={vaColorByName(vas, vaName) ? { color: vaColorByName(vas, vaName) } : undefined}>{vaName}</div>
            <ul className="space-y-1.5">
              {byVa.get(vaName)!.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.label}</span>
                  <form action={removePlanItem}><input type="hidden" name="id" value={item.id} /><ConfirmDeleteButton confirmMessage={`Remove "${item.label}" from ${vaName}'s plan?`} pendingLabel="…">✕</ConfirmDeleteButton></form>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {shared.length > 0 && (
          <div className="rounded-md border border-l-4 border-l-plan-accent bg-record-background p-3">
            <div className="mb-2 text-sm font-semibold text-muted-foreground">Unassigned / shared</div>
            <ul className="space-y-1.5">
              {shared.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.label}</span>
                  <form action={removePlanItem}><input type="hidden" name="id" value={item.id} /><ConfirmDeleteButton confirmMessage={`Remove "${item.label}"?`} pendingLabel="…">✕</ConfirmDeleteButton></form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
