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
/* The Add form's fields, reused as-is for editing an existing priority
   in place -- editing is the same shape as adding, just pre-filled and
   posting to updatePriorityPlanItem (with a hidden id) instead of
   addPriority. */
function PriorityFields({ vas, schools, taskCategories, defaultLabel, defaultAssignedTo, defaultLinkMode, defaultSchoolId, defaultCategoryId, defaultFileName }: {
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  defaultLabel?: string;
  defaultAssignedTo?: string;
  defaultLinkMode?: boolean;
  defaultSchoolId?: string;
  defaultCategoryId?: string;
  defaultFileName?: string;
}) {
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo || "");
  const [linkMode, setLinkMode] = useState(!!defaultLinkMode);
  const [schoolId, setSchoolId] = useState(defaultSchoolId || "");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];

  return (
    <>
      <div className="flex gap-1">
        <Button type="button" size="xs" variant={linkMode ? "outline" : "default"} onClick={() => setLinkMode(false)}>Free text</Button>
        <Button type="button" size="xs" variant={linkMode ? "default" : "outline"} onClick={() => setLinkMode(true)}>Link to a task</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input name="label" required defaultValue={defaultLabel} placeholder="What should someone work on next?" className="h-8 min-w-48 flex-1 rounded-md border px-2 text-sm" />
        <Dropdown name="assignedTo" value={assignedTo} onChange={setAssignedTo} placeholder="Anyone (shared)" options={vas.map((va) => ({ value: va.name, label: va.name }))} />
      </div>
      {linkMode && (
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown name="suggestedSchoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
          <Dropdown name="suggestedCategoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <input name="suggestedFileName" defaultValue={defaultFileName} placeholder="File name (optional)" className="h-8 min-w-40 flex-1 rounded-md border px-2 text-sm" />
        </div>
      )}
    </>
  );
}

export function TaskPriorities({ planItems, vas, schools, taskCategories, isCurrentUserAdmin, addPriority, removePlanItem, claimPriorityPlanItem, updatePriorityPlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  isCurrentUserAdmin: boolean;
  addPriority: (formData: FormData) => Promise<{ error: string | null }>;
  removePlanItem: (formData: FormData) => void;
  claimPriorityPlanItem: (formData: FormData) => void;
  updatePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const shared = planItems.filter((p) => p.kind === "priority" && !p.vaName);

  function resetForm() {
    setAddOpen(false);
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
          <PriorityFields vas={vas} schools={schools} taskCategories={taskCategories} />
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
            {shared.map((item) => editingId === item.id ? (
              <li key={item.id}>
                <form
                  action={async (formData) => {
                    setEditError(null);
                    const result = await updatePriorityPlanItem(formData);
                    if (result.error) setEditError(result.error);
                    else setEditingId(null);
                  }}
                  className="space-y-2 rounded-md border p-2"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <PriorityFields
                    vas={vas}
                    schools={schools}
                    taskCategories={taskCategories}
                    defaultLabel={item.label}
                    defaultAssignedTo={item.vaName}
                    defaultLinkMode={!!item.suggestedSchoolId}
                    defaultSchoolId={item.suggestedSchoolId}
                    defaultCategoryId={item.suggestedCategoryId}
                    defaultFileName={item.suggestedFileName}
                  />
                  <div className="flex items-center gap-2">
                    <SubmitButton variant="plan" size="xs" pendingLabel="Saving…">Save</SubmitButton>
                    <Button type="button" variant="ghost" size="xs" onClick={() => { setEditingId(null); setEditError(null); }}>Cancel</Button>
                  </div>
                  {editError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{editError}</p>}
                </form>
              </li>
            ) : (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center"><span className="priority-dot" aria-hidden />{item.label}</span>
                <div className="flex items-center gap-1">
                  <form action={claimPriorityPlanItem}><input type="hidden" name="id" value={item.id} /><SubmitButton variant="plan" size="xs" pendingLabel="…">Claim</SubmitButton></form>
                  {isCurrentUserAdmin && <Button type="button" variant="ghost" size="xs" onClick={() => { setEditingId(item.id); setEditError(null); }}>Edit</Button>}
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
