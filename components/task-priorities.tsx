"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { PlanItem, Va } from "@/lib/app-state";

/* Boss-only "what should someone work on next" list, shown beside
   Alerts since both are "things that need attention" at a glance --
   only UNASSIGNED/shared priorities show here (once a VA is attached,
   whether by the boss or by claiming, it's accounted for and shows in
   the full Plans for Tomorrow section below instead). */
export function TaskPriorities({ planItems, vas, isCurrentUserAdmin, addPriority, removePlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  isCurrentUserAdmin: boolean;
  addPriority: (formData: FormData) => Promise<{ error: string | null }>;
  removePlanItem: (formData: FormData) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shared = planItems.filter((p) => p.kind === "priority" && !p.vaName);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Task Priorities</h2>
        {isCurrentUserAdmin && <Button type="button" size="xs" variant="outline" onClick={() => setAddOpen((v) => !v)}>+ Add priority</Button>}
      </div>
      {isCurrentUserAdmin && addOpen && (
        <form
          action={async (formData) => {
            setError(null);
            const result = await addPriority(formData);
            if (result.error) setError(result.error);
            else { setAddOpen(false); setAssignedTo(""); }
          }}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border p-2"
        >
          <input name="label" required placeholder="What should someone work on next?" className="h-8 min-w-48 flex-1 rounded-md border px-2 text-sm" />
          <Dropdown name="assignedTo" value={assignedTo} onChange={setAssignedTo} placeholder="Anyone (shared)" options={vas.map((va) => ({ value: va.name, label: va.name }))} />
          <SubmitButton variant="plan" size="xs" pendingLabel="Adding…">Add</SubmitButton>
          {error && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
      {shared.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing unassigned right now.</p>
      ) : (
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
  );
}
