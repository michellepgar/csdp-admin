"use client";

import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { openEmailItemsByVa } from "@/lib/shared-task-files";
import { vaColorByName, type PlanItem, type School, type SchoolDataEntry, type Va } from "@/lib/app-state";

/* Same status/tone pairing as email-tracker-card.tsx's own copy --
   kept separate rather than a shared import for the same reason
   overview/page.tsx's TODAY_STATUS_TONE is its own copy: neither file
   exports theirs, and this is read-only display. */
const EMAIL_STATUS_TONE: Record<string, StatusTone> = {
  "Needs My Response": "warning",
  "Waiting on Them": "paused",
};

/* Every VA's own plan for tomorrow -- both their own carried-over
   tasks (kind:"task") and any priority assigned to them by name
   (kind:"priority" with vaName set), grouped by VA. Unassigned/shared
   priorities are NOT shown here -- those live only in the Task
   Priorities widget beside Alerts, until a VA claims one (at which
   point it gets a vaName and shows up here). kind:"note" reminders are
   excluded entirely -- those are personal Your-Plan-bubble items, not
   part of the shared tomorrow plan. A completedAt item is also
   excluded regardless of kind -- a priority resolved as "just a
   reminder" (resolvePriorityPlanItem's reminder branch) stays kind:
   "priority" but is done, and has no business showing up here as if
   still pending. The ✕ only renders on the current VA's own items --
   removePlanItem enforces the same ownership check server-side, but
   showing it on someone else's row would just be a button that always
   fails, so it's hidden here too.

   Open Email Tracker items are appended per VA below the plan items --
   unlike tasks/priorities, these are never opt-in (see
   openEmailItemsByVa's own comment): every non-Done email for a VA's
   assigned schools always shows here, with no ✕ at all, since there's
   no plan_item row to remove -- the only way one of these leaves this
   list is its status changing (from here, the school page, or Your
   Plan's "Mark Done"). */
export function PlansForTomorrow({ planItems, vas, schools, schoolData, currentUserName, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  currentUserName: string;
  removePlanItem: (formData: FormData) => void;
}) {
  const byVa = new Map<string, PlanItem[]>();
  for (const item of planItems) {
    if (!item.vaName || item.kind === "note" || item.completedAt) continue;
    if (!byVa.has(item.vaName)) byVa.set(item.vaName, []);
    byVa.get(item.vaName)!.push(item);
  }
  const emailByVa = openEmailItemsByVa(schools, schoolData);
  const vaNames = Array.from(new Set([...byVa.keys(), ...emailByVa.keys()])).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h2 className="mb-3 font-semibold">Plans for Tomorrow</h2>
      {vaNames.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vaNames.map((vaName) => (
          <div key={vaName} className="rounded-md border border-l-4 bg-record-background p-3" style={{ borderLeftColor: vaColorByName(vas, vaName) || "var(--plan-accent)" }}>
            <div className="mb-2 text-sm font-semibold" style={vaColorByName(vas, vaName) ? { color: vaColorByName(vas, vaName) } : undefined}>{vaName}</div>
            <ul className="space-y-1.5">
              {(byVa.get(vaName) || []).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center">{item.kind === "priority" && <span className="priority-dot" aria-hidden />}{item.label}</span>
                  {vaName === currentUserName && (
                    <form action={removePlanItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmDeleteButton
                        confirmMessage={
                          item.kind === "priority"
                            ? `Remove "${item.label}" from your plan? It'll go back to Task Priorities for anyone to claim.`
                            : `Remove "${item.label}" from your plan?`
                        }
                        pendingLabel="…"
                      >
                        ✕
                      </ConfirmDeleteButton>
                    </form>
                  )}
                </li>
              ))}
              {(emailByVa.get(vaName) || []).map((item) => (
                <li key={item.itemId} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/schools/${item.schoolId}#email-tracker`} className="hover:underline">
                    {item.description}
                    <span className="text-muted-foreground"> — {item.schoolName}</span>
                  </Link>
                  <StatusBadge tone={EMAIL_STATUS_TONE[item.status] ?? "neutral"}>{item.status}</StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
