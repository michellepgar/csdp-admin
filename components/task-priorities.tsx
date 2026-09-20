"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, Flag, Link2, Play, Plus } from "lucide-react";
import { PlanPriorityStartForm } from "@/components/plan-priority-start-form";
import { comparePriorities } from "@/lib/plan-order";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { visibleSchoolItems, vaColorByName, type PlanItem, type GeneralTaskCategory, type TaskCategory, type SchoolDataEntry, type Va } from "@/lib/app-state";

const ADD_NEW_FILE_OPTION = "__add_new_file__";

/* Boss-only "what should someone work on next" list, shown beside
   Alerts since both are "things that need attention" at a glance --
   priorities nobody has grabbed yet show here. One the boss assigned to a
   person stays here, labelled with who it is for, until that person grabs
   it (Today or Next plan) -- they may not have room for it next shift.
   Once grabbed it is on their plan and shows in Next Shift Plan. */
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
        <input name="label" required defaultValue={defaultLabel} placeholder="What should someone work on next?" className="h-8 min-w-48 flex-1 rounded-md border bg-card px-2 text-sm" />
        <Dropdown name="assignedTo" value={assignedTo} onChange={setAssignedTo} placeholder="Assign to someone (optional)" options={vas.map((va) => ({ value: va.name, label: va.name }))} />
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
                <input name="suggestedFileName" required value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="New file name" className="h-8 min-w-0 flex-1 rounded-md border bg-card px-2 text-sm" />
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
        <SubmitButton variant="plan" className="bg-red-600 text-white hover:bg-red-700" size="xs" pendingLabel={pendingLabel} disabled={fileNameMissing}>{submitLabel}</SubmitButton>
        {onCancel && <Button type="button" variant="ghost" size="xs" onClick={onCancel}>Cancel</Button>}
      </div>
    </>
  );
}

export function TaskPriorities({ planItems, vas, schools, taskCategories, schoolData, isCurrentUserAdmin, currentUserName, addPriority, removePlanItem, claimPriorityPlanItem, movePriorityPlanItem, resolvePriorityPlanItem, generalTaskCategories, updatePriorityPlanItem }: {
  planItems: PlanItem[];
  vas: Va[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolData: Record<string, SchoolDataEntry>;
  isCurrentUserAdmin: boolean;
  /** Used to show Today / Next plan only to the person a priority is assigned to. */
  currentUserName: string;
  addPriority: (formData: FormData) => Promise<{ error: string | null }>;
  removePlanItem: (formData: FormData) => void;
  claimPriorityPlanItem: (formData: FormData) => void;
  movePriorityPlanItem: (formData: FormData) => void;
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  generalTaskCategories: GeneralTaskCategory[];
  updatePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [startingToday, setStartingToday] = useState<PlanItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const shared = planItems.filter((p) => p.kind === "priority" && !p.vaName).sort(comparePriorities);

  function resetForm() {
    setAddOpen(false);
  }

  const schoolName = (id?: string) => schools.find((s) => s.id === id)?.name;
  const categoryName = (id?: string) => taskCategories.find((c) => c.id === id)?.name;

  return (
    <div className="overflow-hidden rounded-xl border border-red-500/30 bg-record-background no-record-hover shadow-sm" style={{ "--plan-accent": "#DC2626" } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"><Flag className="h-4 w-4" /></span>
          <h2 className="bg-transparent px-0 py-0 text-base font-semibold leading-tight text-foreground">Task Priorities</h2>
          {shared.length > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{shared.length}</span>}
        </div>
        {isCurrentUserAdmin && (
          <Button type="button" size="xs" variant="plan" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setAddOpen((v) => !v)}>
            {!addOpen && <Plus className="h-3 w-3" />}{addOpen ? "Close" : "Add priority"}
          </Button>
        )}
      </div>
      <div className="space-y-3 p-4">
      {isCurrentUserAdmin && addOpen && (
        <form
          action={async (formData) => {
            setError(null);
            const result = await addPriority(formData);
            if (result.error) setError(result.error);
            else resetForm();
          }}
          className="space-y-2.5 rounded-lg border border-red-500/40 bg-red-500/5 p-3"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-red-600">New priority</div>
          <PriorityFields vas={vas} schools={schools} taskCategories={taskCategories} schoolData={schoolData} submitLabel="Add" pendingLabel="Adding…" />
          {error && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
      {shared.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-red-500/40 px-4 py-6 text-center">
          <Flag className="h-5 w-5 text-red-500/70" />
          <p className="text-sm font-medium">Nothing unassigned right now</p>
          <p className="text-xs text-muted-foreground">New priorities show up here until someone claims them.</p>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unassigned / shared</div>
          <ul className="space-y-2">
            {shared.map((item, index) => editingId === item.id ? (
              <li key={item.id}>
                <form
                  action={async (formData) => {
                    setEditError(null);
                    const result = await updatePriorityPlanItem(formData);
                    if (result.error) setEditError(result.error);
                    else setEditingId(null);
                  }}
                  className="space-y-2.5 rounded-lg border border-red-500/40 bg-red-500/5 p-3"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <PriorityFields
                    vas={vas}
                    schools={schools}
                    taskCategories={taskCategories}
                    schoolData={schoolData}
                    defaultLabel={item.label}
                    defaultAssignedTo={item.assignedTo}
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
              <li key={item.id} className="space-y-2 rounded-lg border border-l-4 border-red-500/25 border-l-red-600 bg-card px-3 py-2.5 text-sm shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white shadow-sm" title={`Priority ${index + 1}`}>{index + 1}</span>
                  <div className="min-w-0">
                  <span className="flex items-center font-medium"><span className="priority-dot" aria-hidden />{item.label}</span>
                  {item.assignedTo && (
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs font-medium shadow-sm">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: vaColorByName(vas, item.assignedTo) || "#94a3b8" }} aria-hidden />
                      Assigned to {item.assignedTo}
                    </span>
                  )}
                  {item.suggestedSchoolId && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{[schoolName(item.suggestedSchoolId), categoryName(item.suggestedCategoryId), item.suggestedFileName].filter(Boolean).join(" · ")}</span>
                    </span>
                  )}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  {isCurrentUserAdmin && (
                    <div className="flex flex-col">
                      <form action={movePriorityPlanItem}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="direction" value="up" /><button type="submit" disabled={index === 0} aria-label="Move up" title="Move up" className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowUp className="h-3 w-3" /></button></form>
                      <form action={movePriorityPlanItem}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="direction" value="down" /><button type="submit" disabled={index === shared.length - 1} aria-label="Move down" title="Move down" className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"><ArrowDown className="h-3 w-3" /></button></form>
                    </div>
                  )}
                  {isCurrentUserAdmin && <Button type="button" variant="ghost" size="xs" onClick={() => { setEditingId(item.id); setEditError(null); }}>Edit</Button>}
                  <form action={removePlanItem}><input type="hidden" name="id" value={item.id} /><ConfirmDeleteButton confirmMessage={`Remove "${item.label}"?`} pendingLabel="…">✕</ConfirmDeleteButton></form>
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-t border-red-500/15 pt-2">
                  {item.assignedTo && item.assignedTo !== currentUserName ? (
                    <span className="text-xs text-muted-foreground">Waiting for {item.assignedTo} to grab it.</span>
                  ) : (
                  <>
                  <Button type="button" variant="plan" size="xs" className="bg-red-600 text-white hover:bg-red-700" title="Claim it and start it now" onClick={async () => { const data = new FormData(); data.set("id", item.id); await claimPriorityPlanItem(data); setStartingToday(item); }}><Play className="h-3 w-3" /> Today</Button>
                  <form action={claimPriorityPlanItem}><input type="hidden" name="id" value={item.id} /><SubmitButton variant="outline" size="xs" pendingLabel="…" title="Add to my next shift plan"><CalendarClock className="h-3 w-3" /> Next plan</SubmitButton></form>
                  </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      {startingToday && (
        <PlanPriorityStartForm
          planItem={startingToday}
          schools={schools}
          taskCategories={taskCategories}
          generalTaskCategories={generalTaskCategories}
          resolvePriorityPlanItem={resolvePriorityPlanItem}
          onClose={() => setStartingToday(null)}
        />
      )}
    </div>
  );
}
