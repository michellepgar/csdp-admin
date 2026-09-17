"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { visibleSchoolItems, type PlanItem, type TaskCategory, type Va } from "@/lib/app-state";

/* Boss-only "what should someone work on next" list, shown beside
   Alerts since both are "things that need attention" at a glance --
   only UNASSIGNED/shared priorities show here (once a VA is attached,
   whether by the boss or by claiming, it's accounted for and shows in
   the full Plans for Tomorrow section below instead). */
export function TaskPriorities({ planItems, vas, schools, taskCategories, isCurrentUserAdmin, addPriority, removePlanItem, claimPriorityPlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  isCurrentUserAdmin: boolean;
  addPriority: (formData: FormData) => Promise<{ error: string | null }>;
  removePlanItem: (formData: FormData) => void;
  claimPriorityPlanItem: (formData: FormData) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];

  const shared = planItems.filter((p) => p.kind === "priority" && !p.vaName);

  function resetForm() {
    setAddOpen(false);
    setAssignedTo("");
    setLinkMode(false);
    setSchoolId("");
    setCategoryId("");
  }

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
            else resetForm();
          }}
          className="mb-3 space-y-2 rounded-md border p-2"
        >
          <div className="flex gap-1">
            <Button type="button" size="xs" variant={linkMode ? "outline" : "default"} onClick={() => setLinkMode(false)}>Free text</Button>
            <Button type="button" size="xs" variant={linkMode ? "default" : "outline"} onClick={() => setLinkMode(true)}>Link to a task</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input name="label" required placeholder="What should someone work on next?" className="h-8 min-w-48 flex-1 rounded-md border px-2 text-sm" />
            <Dropdown name="assignedTo" value={assignedTo} onChange={setAssignedTo} placeholder="Anyone (shared)" options={vas.map((va) => ({ value: va.name, label: va.name }))} />
          </div>
          {linkMode && (
            <div className="flex flex-wrap items-center gap-2">
              <Dropdown name="suggestedSchoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
              <Dropdown name="suggestedCategoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              <input name="suggestedFileName" placeholder="File name (optional)" className="h-8 min-w-40 flex-1 rounded-md border px-2 text-sm" />
            </div>
          )}
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
                <span className="flex items-center"><span className="priority-dot" aria-hidden />{item.label}</span>
                <div className="flex items-center gap-1">
                  <form action={claimPriorityPlanItem}><input type="hidden" name="id" value={item.id} /><SubmitButton variant="plan" size="xs" pendingLabel="…">Claim</SubmitButton></form>
                  <form action={removePlanItem}><input type="hidden" name="id" value={item.id} /><ConfirmDeleteButton confirmMessage={`Remove "${item.label}"?`} pendingLabel="…">✕</ConfirmDeleteButton></form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
