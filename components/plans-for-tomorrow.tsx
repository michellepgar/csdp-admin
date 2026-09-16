"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { PlanItem, Va } from "@/lib/app-state";

export function PlansForTomorrow({ planItems, vas, isCurrentUserAdmin, addPriority, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  isCurrentUserAdmin: boolean;
  addPriority: (formData: FormData) => void;
  removePlanItem: (formData: FormData) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");

  const byVa = new Map<string, PlanItem[]>();
  const shared: PlanItem[] = [];
  for (const item of planItems) {
    if (item.vaName) { if (!byVa.has(item.vaName)) byVa.set(item.vaName, []); byVa.get(item.vaName)!.push(item); }
    else shared.push(item);
  }
  const vaNames = Array.from(byVa.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Plans for Tomorrow</h2>
        {isCurrentUserAdmin && <Button type="button" size="xs" variant="outline" onClick={() => setAddOpen((v) => !v)}>+ Add priority</Button>}
      </div>
      {isCurrentUserAdmin && addOpen && (
        <form action={(formData) => { addPriority(formData); setAddOpen(false); setAssignedTo(""); }} className="mb-3 flex flex-wrap items-center gap-2 rounded-md border p-2">
          <input name="label" required placeholder="What should someone work on next?" className="h-8 min-w-48 flex-1 rounded-md border px-2 text-sm" />
          <Dropdown name="assignedTo" value={assignedTo} onChange={setAssignedTo} placeholder="Anyone (shared)" options={vas.map((va) => ({ value: va.name, label: va.name }))} />
          <SubmitButton size="xs" pendingLabel="Adding…">Add</SubmitButton>
        </form>
      )}
      {planItems.length === 0 && <p className="text-sm text-muted-foreground">Nothing planned yet.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vaNames.map((vaName) => (
          <div key={vaName} className="rounded-md border bg-record-background p-3">
            <div className="mb-2 text-sm font-semibold">{vaName}</div>
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
          <div className="rounded-md border bg-record-background p-3">
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
