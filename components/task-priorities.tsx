"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { visibleSchoolItems, type PlanItem, type TaskCategory, type SchoolDataEntry, type Va } from "@/lib/app-state";

const ADD_NEW_FILE_OPTION = "__add_new_file__";

/* Boss-only "what should someone work on next" list, shown beside
   Alerts since both are "things that need attention" at a glance --
   only UNASSIGNED/shared priorities show here (once a VA is attached,
   whether by the boss or by claiming, it's accounted for and shows in
   the full Plans for Tomorrow section below instead). */
/* The Add form's fields, reused as-is for editing an existing priority
   in place -- editing is the same shape as adding, just pre-filled and
   posting to updatePriorityPlanItem (with a hidden id) instead of
   addPriority. Owns its own submit/cancel buttons (rather than the
   caller rendering a separate SubmitButton) so the "file name is
   required once you're linking to a task" rule can actually disable
   the button -- that state lives in here, not the caller. */
function PriorityFields({ vas, schools, taskCategories, schoolData, defaultLabel, defaultAssignedTo, defaultLinkMode, defaultSchoolId, defaultCategoryId, defaultFileName, submitLabel, pendingLabel, onCancel }: {
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolData: Record<string, SchoolDataEntry>;
  defaultLabel?: string;
  defaultAssignedTo?: string;
  defaultLinkMode?: boolean;
  defaultSchoolId?: string;
  defaultCategoryId?: string;
  defaultFileName?: string;
  submitLabel: string;
  pendingLabel: string;
  onCancel?: () => void;
}) {
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo || "");
  const [linkMode, setLinkMode] = useState(!!defaultLinkMode);
  const [schoolId, setSchoolId] = useState(defaultSchoolId || "");
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];

  const filesForCategory = schoolId && categoryId
    ? (schoolData[schoolId]?.taskFiles || []).filter((f) => f.categories.some((c) => c.categoryId === categoryId)).map((f) => f.fileName)
    : [];

  const [fileName, setFileName] = useState(defaultFileName || "");
  const [addingNewFile, setAddingNewFile] = useState(!!defaultFileName && !filesForCategory.includes(defaultFileName));

  const fileNameMissing = linkMode && !!categoryId && !fileName.trim();

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
          <Dropdown
            name="suggestedSchoolId"
            value={schoolId}
            onChange={(v) => { setSchoolId(v); setCategoryId(""); setFileName(""); setAddingNewFile(false); }}
            placeholder="Choose a school"
            options={schools.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Dropdown
            name="suggestedCategoryId"
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setFileName(""); setAddingNewFile(false); }}
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          {categoryId && (
            addingNewFile ? (
              <div className="flex min-w-40 flex-1 items-center gap-1">
                <input name="suggestedFileName" required value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="New file name" className="h-8 min-w-0 flex-1 rounded-md border px-2 text-sm" />
                {filesForCategory.length > 0 && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => { setAddingNewFile(false); setFileName(""); }}>Choose existing</Button>
                )}
              </div>
            ) : (
              <>
                <input type="hidden" name="suggestedFileName" value={fileName} />
                <Dropdown
                  name="suggestedFileNamePicker"
                  value={fileName}
                  onChange={(v) => { if (v === ADD_NEW_FILE_OPTION) { setAddingNewFile(true); setFileName(""); } else setFileName(v); }}
                  placeholder="Choose a file"
                  options={[...filesForCategory.map((name) => ({ value: name, label: name })), { value: ADD_NEW_FILE_OPTION, label: "+ Add new file" }]}
                />
              </>
            )
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <SubmitButton variant="plan" size="xs" pendingLabel={pendingLabel} disabled={fileNameMissing}>{submitLabel}</SubmitButton>
        {onCancel && <Button type="button" variant="ghost" size="xs" onClick={onCancel}>Cancel</Button>}
      </div>
    </>
  );
}

export function TaskPriorities({ planItems, vas, schools, taskCategories, schoolData, isCurrentUserAdmin, addPriority, removePlanItem, claimPriorityPlanItem, updatePriorityPlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolData: Record<string, SchoolDataEntry>;
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
          <PriorityFields vas={vas} schools={schools} taskCategories={taskCategories} schoolData={schoolData} submitLabel="Add" pendingLabel="Adding…" />
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
                    schoolData={schoolData}
                    defaultLabel={item.label}
                    defaultAssignedTo={item.vaName}
                    defaultLinkMode={!!item.suggestedSchoolId}
                    defaultSchoolId={item.suggestedSchoolId}
                    defaultCategoryId={item.suggestedCategoryId}
                    defaultFileName={item.suggestedFileName}
                    submitLabel="Save"
                    pendingLabel="Saving…"
                    onCancel={() => { setEditingId(null); setEditError(null); }}
                  />
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
