"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, ClipboardList, ListChecks, Plus, School as SchoolIcon, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import { groupTaskTables } from "@/lib/shared-task-files";
import { visibleSchoolItems, type School, type SchoolDataEntry, type GeneralTask, type GeneralTaskCategory, type PlanItem, type PrivateNote, type TaskCategory } from "@/lib/app-state";

interface OpenItem { id: string; schoolId?: string; schoolName: string; category: string; fileName: string; status: string }
type Tab = "inProgress" | "schools" | "general" | "reminder";

const NEW_CATEGORY = "__new_category__";
const TABLE_PREFIX = "table:";

/* A file or task typed in here that doesn't exist yet. It is only created
   when the plan is saved (savePlan), so cancelling leaves nothing behind. */
interface NewItem {
  key: string;
  kind: "school" | "general";
  schoolId?: string;
  schoolName?: string;
  /** Set when an existing category was chosen; empty for a brand-new one. */
  categoryId?: string;
  /** Set when the file goes into an existing table: that table's id and every category in it. */
  tableId?: string;
  categoryIds?: string[];
  categoryName: string;
  isNewCategory: boolean;
  name: string;
}

function plainText(html: string, max: number): string {
  return html.replace(/<[^>]+>/g, " ").trim().slice(0, max) || "Note";
}

/* One planning window, two ways in:
   - "end": the End Today's Work button. Ends the shift -- saving also
     closes it (endShift), so Start my day unlocks. Tasks still In Progress
     start out checked, as the default carry-over.
   - "add": the Add button on Planned Work, for a plan someone forgot
     to make when they ended their day. Doesn't touch the shift, and
     starts with only what's already planned checked.
   Either way everything saves together through one submit (savePlan); the
   tabs only change what's visible while building that one submission. */
export function PlanTomorrowPicker({ mode, disabled, disabledReason, currentUserName, schools, schoolData, generalTasks, taskCategories, generalTaskCategories, myPlanItems, myReminderNotes, savePlan }: {
  mode: "end" | "add";
  /** End mode only: the button is off until a shift has been started. */
  disabled?: boolean;
  disabledReason?: string;
  currentUserName: string;
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  generalTasks: GeneralTask[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  myPlanItems: PlanItem[];
  /** This VA's own private notes flagged as reminders -- the "From
   *  Private Notes" option under the Reminder tab picks from these. */
  myReminderNotes: PrivateNote[];
  savePlan: (formData: FormData) => Promise<{ error: string | null; changed?: number }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("inProgress");
  const [schoolId, setSchoolId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // "By category" and "Existing table" are two separate ways to pick where a file goes.
  const [schoolMode, setSchoolMode] = useState<"category" | "table">("category");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [generalCategory, setGeneralCategory] = useState("");
  const [newGeneralCategoryName, setNewGeneralCategoryName] = useState("");
  const [newGeneralTaskName, setNewGeneralTaskName] = useState("");
  const [newItems, setNewItems] = useState<NewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Set when a save went through but changed nothing -- e.g. Save clicked with
  // nothing new checked, or everything checked turned out to be stale and was
  // dropped server-side (see savePlan's own comment on that).
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const schoolCarryOver: OpenItem[] = schools.flatMap((school) =>
    (schoolData[school.id]?.tasks || [])
      .filter((t) => t.status === "In Progress" && t.vaAssigned.includes(currentUserName))
      .map((t) => ({ id: t.id, schoolId: school.id, schoolName: school.name, category: t.category, fileName: t.fileName, status: t.status }))
  );
  const generalCarryOver: OpenItem[] = generalTasks
    .filter((t) => t.status === "In Progress" && t.vaAssigned.includes(currentUserName))
    .map((t) => ({ id: t.id, schoolName: "General", category: t.category, fileName: t.description, status: t.status }));
  const carryOver = [...schoolCarryOver, ...generalCarryOver];

  const alreadyPlannedTaskIds = new Set(myPlanItems.filter((p) => p.kind === "task" && p.taskFileCategoryId).map((p) => p.taskFileCategoryId));
  const alreadyPlannedGeneralIds = new Set(myPlanItems.filter((p) => p.kind === "task" && p.generalTaskId).map((p) => p.generalTaskId));
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set([...(mode === "end" ? carryOver.map((t) => t.id) : []), ...alreadyPlannedTaskIds, ...alreadyPlannedGeneralIds] as string[]),
  );

  const school = schools.find((s) => s.id === schoolId);
  const schoolCategories = school ? visibleSchoolItems(taskCategories, school.id) : [];
  const pickedCategory = schoolCategories.find((c) => c.id === categoryId);
  // Existing tables at this school that hold more than one category (a
  // single-category table is just that category, already in the list).
  const schoolTables = school
    ? groupTaskTables(taskCategories, schoolData[school.id]?.taskFiles || []).filter((g) => g.categories.length > 1)
    : [];
  const tableLabel = (g: { categories: { name: string }[]; files: unknown[] }) => `${g.categories.map((c) => c.name).join(" + ")} (${g.files.length} file${g.files.length === 1 ? "" : "s"})`;
  const pickedTable = categoryId.startsWith(TABLE_PREFIX) ? schoolTables.find((g) => g.key === categoryId.slice(TABLE_PREFIX.length)) : undefined;
  const browseSchoolTasks: OpenItem[] = school && pickedTable
    ? pickedTable.files
        .flatMap((f) => f.categories.map((a) => ({ id: a.id, schoolId: school.id, schoolName: school.name, category: a.category, fileName: f.fileName, status: a.status })))
        .filter((t) => !schoolCarryOver.some((c) => c.id === t.id))
    : school && pickedCategory
    ? (schoolData[school.id]?.tasks || [])
        .filter((t) => t.category === pickedCategory.name)
        .filter((t) => !schoolCarryOver.some((c) => c.id === t.id))
        .map((t) => ({ id: t.id, schoolId: school.id, schoolName: school.name, category: t.category, fileName: t.fileName, status: t.status }))
    : [];
  const browseGeneralTasks: OpenItem[] = generalTasks
    .filter((t) => generalCategory !== "" && generalCategory !== NEW_CATEGORY && t.category === generalCategory)
    .filter((t) => !generalCarryOver.some((c) => c.id === t.id))
    .map((t) => ({ id: t.id, schoolName: "General", category: t.category, fileName: t.description, status: t.status }));

  const [pendingReminders, setPendingReminders] = useState<{ key: string; label: string; noteId?: string }[]>([]);
  const [reminderMode, setReminderMode] = useState<"freeText" | "fromNotes">("freeText");
  const [reminderText, setReminderText] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");

  /* What each ticked item is (its school, its label), remembered at the moment
     it was ticked. The lists above only hold the school/category currently
     chosen, so without this an item ticked under one school and then a
     different school picked would look like a General Task when saved. */
  const [itemInfo, setItemInfo] = useState<Record<string, { label: string; schoolId?: string }>>({});
  const remember = (items: OpenItem[]) => setItemInfo((prev) => {
    const next = { ...prev };
    for (const t of items) next[t.id] = { label: `${t.fileName} — ${t.category}`, schoolId: t.schoolId };
    return next;
  });

  function toggle(item: OpenItem) {
    if (!checked.has(item.id)) remember([item]);
    setChecked((prev) => { const next = new Set(prev); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; });
  }

  function addPendingReminderFreeText() {
    const label = reminderText.trim();
    if (!label) return;
    setPendingReminders((prev) => [...prev, { key: `free-${Date.now()}`, label }]);
    setReminderText("");
  }

  function addPendingReminderFromNote() {
    const note = myReminderNotes.find((n) => n.id === selectedNoteId);
    if (!note) return;
    setPendingReminders((prev) => [...prev, { key: `note-${note.id}`, label: plainText(note.text, 80), noteId: note.id }]);
    setSelectedNoteId("");
  }

  function stageNewSchoolFile() {
    const name = newFileName.trim();
    if (!school || !name) return;
    const isNew = categoryId === NEW_CATEGORY;
    const categoryName = isNew ? newCategoryName.trim() : pickedTable ? pickedTable.categories.map((c) => c.name).join(" + ") : pickedCategory?.name || "";
    if (!categoryName) return;
    // Already on the list? Tick it instead of creating a duplicate.
    const matches = !isNew ? browseSchoolTasks.filter((t) => t.fileName.trim().toLowerCase() === name.toLowerCase()) : [];
    if (matches.length > 0) {
      remember(matches);
      setChecked((prev) => { const next = new Set(prev); for (const m of matches) next.add(m.id); return next; });
    } else {
      setNewItems((prev) => [...prev, {
        key: `school-${Date.now()}`, kind: "school", schoolId: school.id, schoolName: school.name,
        categoryId: isNew || pickedTable ? undefined : categoryId,
        tableId: pickedTable?.key, categoryIds: pickedTable?.categories.map((c) => c.id),
        categoryName, isNewCategory: isNew, name,
      }]);
    }
    setNewFileName("");
  }

  function stageNewGeneralTask() {
    const name = newGeneralTaskName.trim();
    const isNew = generalCategory === NEW_CATEGORY;
    const categoryName = isNew ? newGeneralCategoryName.trim() : generalCategory;
    if (!name || !categoryName) return;
    const existing = !isNew && browseGeneralTasks.find((t) => t.fileName.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      remember([existing]);
      setChecked((prev) => new Set(prev).add(existing.id));
    } else {
      setNewItems((prev) => [...prev, { key: `general-${Date.now()}`, kind: "general", categoryName, isNewCategory: isNew, name }]);
    }
    setNewGeneralTaskName("");
  }

  function removeNewItem(key: string) {
    setNewItems((prev) => prev.filter((i) => i.key !== key));
  }

  function removePendingReminder(key: string) {
    setPendingReminders((prev) => prev.filter((r) => r.key !== key));
  }

  // Where an id came from: what was remembered when ticked, else what's already
  // on the plan, else the lists currently showing.
  function infoFor(id: string): { label: string; schoolId?: string } | undefined {
    if (itemInfo[id]) return itemInfo[id];
    const planned = myPlanItems.find((p) => p.kind === "task" && (p.taskFileCategoryId === id || p.generalTaskId === id));
    if (planned) return { label: planned.label, schoolId: planned.taskFileCategoryId ? planned.schoolId : undefined };
    const listed = [...carryOver, ...browseSchoolTasks, ...browseGeneralTasks].find((t) => t.id === id);
    return listed ? { label: `${listed.fileName} — ${listed.category}`, schoolId: listed.schoolId } : undefined;
  }

  function buildLabels(): Record<string, { label: string; schoolId?: string }> {
    const labels: Record<string, { label: string; schoolId?: string }> = {};
    for (const id of checked) {
      const info = infoFor(id);
      if (info) labels[id] = info;
    }
    return labels;
  }

  const isSchoolId = (id: string) => !!infoFor(id)?.schoolId || myPlanItems.some((p) => p.kind === "task" && p.taskFileCategoryId === id);

  const tabs: { id: Tab; label: string; hint: string; icon: React.ReactNode; count: number }[] = [
    { id: "inProgress", label: "In Progress", hint: mode === "end" ? "Still open from today" : "What you're working on now", icon: <ListChecks className="h-4 w-4" />, count: carryOver.filter((t) => checked.has(t.id)).length },
    { id: "schools", label: "Schools", hint: "Pick from any school", icon: <SchoolIcon className="h-4 w-4" />, count: browseSchoolTasks.filter((t) => checked.has(t.id)).length + newItems.filter((i) => i.kind === "school").length },
    { id: "general", label: "General", hint: "General Tasks", icon: <ClipboardList className="h-4 w-4" />, count: browseGeneralTasks.filter((t) => checked.has(t.id)).length + newItems.filter((i) => i.kind === "general").length },
    { id: "reminder", label: "Reminder", hint: "Things to remember", icon: <Bell className="h-4 w-4" />, count: pendingReminders.length },
  ];
  const taskTotal = checked.size + newItems.length;
  const title = mode === "end" ? "Plan your upcoming work" : "Add to your Planned Work";
  const subtitle = mode === "end" ? "Choose what you'll work on next, then save to end today's work." : "Add anything you forgot. This doesn't end your day.";

  return (
    <div>
      {mode === "end" ? (
        <Button type="button" variant="plan" size="sm" disabled={disabled} title={disabled ? disabledReason : undefined} onClick={() => { setSavedMessage(null); setOpen(true); }}>End Today&apos;s Work</Button>
      ) : (
        <Button type="button" variant="plan" size="xs" onClick={() => { setSavedMessage(null); setOpen(true); }}><Plus className="h-3 w-3" /> Add</Button>
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex max-h-[92vh] min-h-[min(34rem,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 bg-plan-accent px-5 py-4 text-plan-accent-foreground">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20"><CalendarClock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="bg-transparent px-0 py-0 text-lg font-semibold leading-tight text-inherit">{title}</h2>
                <p className="text-sm opacity-90">{subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex flex-none gap-1.5 overflow-x-auto border-b bg-muted/30 p-3 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex flex-none items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      tab === t.id ? "border-plan-accent bg-plan-accent text-plan-accent-foreground shadow-sm" : "bg-background hover:bg-muted",
                    )}
                  >
                    {t.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{t.label}</span>
                      <span className={cn("hidden text-xs sm:block", tab === t.id ? "opacity-90" : "text-muted-foreground")}>{t.hint}</span>
                    </span>
                    {t.count > 0 && <span className={cn("rounded-full px-1.5 text-xs font-bold", tab === t.id ? "bg-white/25" : "bg-plan-accent text-plan-accent-foreground")}>{t.count}</span>}
                  </button>
                ))}
              </div>

              <div className="min-h-64 flex-1 space-y-2 overflow-y-auto p-4">
                {tab === "inProgress" && (
                  <>
                    <p className="text-sm text-muted-foreground">{mode === "end" ? "Still in progress today. Uncheck anything that shouldn't be in your Planned Work." : "Tasks you're working on now. Check the ones to add."}</p>
                    {carryOver.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing in progress right now.</p>}
                    {carryOver.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span><span className="text-muted-foreground"> — {t.schoolName} · {t.category}</span></span>
                      </label>
                    ))}
                    <p className="pt-1 text-xs text-muted-foreground">Reminders you checked off today count as done. They aren&apos;t carried forward.</p>
                  </>
                )}
                {tab === "general" && (
                  <>
                    <Dropdown
                      name="generalCategory"
                      value={generalCategory}
                      onChange={setGeneralCategory}
                      placeholder="Choose a category"
                      options={[...generalTaskCategories.map((c) => ({ value: c.name, label: c.name })), { value: NEW_CATEGORY, label: "+ New category" }]}
                    />
                    {generalCategory === "" && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Choose a category to see its tasks.</p>}
                    {generalCategory === NEW_CATEGORY && (
                      <input value={newGeneralCategoryName} onChange={(e) => setNewGeneralCategoryName(e.target.value)} placeholder="New category name" className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
                    )}
                    {generalCategory !== "" && generalCategory !== NEW_CATEGORY && browseGeneralTasks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No tasks in this category yet.</p>}
                    {browseGeneralTasks.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span>{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}</span>
                      </label>
                    ))}
                    {generalCategory !== "" && (
                      <div className="flex gap-2 rounded-lg border border-dashed p-2.5">
                        <input value={newGeneralTaskName} onChange={(e) => setNewGeneralTaskName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); stageNewGeneralTask(); } }} placeholder="Not on the list? Type a new task" className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" />
                        <Button type="button" size="sm" onClick={stageNewGeneralTask} disabled={!newGeneralTaskName.trim() || (generalCategory === NEW_CATEGORY && !newGeneralCategoryName.trim())}>Add new</Button>
                      </div>
                    )}
                    {newItems.filter((i) => i.kind === "general").length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Will be created when you save</p>
                        {newItems.filter((i) => i.kind === "general").map((i) => (
                          <div key={i.key} className="flex items-center justify-between gap-2 rounded-lg border border-l-4 border-l-plan-accent bg-card px-3 py-2 text-sm shadow-sm">
                            <span className="min-w-0"><span className="font-medium">{i.name}</span><span className="text-muted-foreground"> — {i.categoryName}</span>{i.isNewCategory && <span className="ml-1.5 rounded-full bg-plan-accent px-1.5 py-0.5 text-[10px] font-bold text-plan-accent-foreground">new category</span>}</span>
                            <button type="button" onClick={() => removeNewItem(i.key)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {tab === "schools" && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Dropdown name="schoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
                    </div>
                    {school && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex overflow-hidden rounded-lg border bg-card text-sm shadow-sm">
                          <button type="button" onClick={() => { setSchoolMode("category"); setCategoryId(""); }} className={cn("px-3 py-1.5 font-medium transition-colors", schoolMode === "category" ? "bg-plan-accent text-plan-accent-foreground" : "hover:bg-muted")}>By category</button>
                          <button type="button" onClick={() => { setSchoolMode("table"); setCategoryId(""); }} className={cn("border-l px-3 py-1.5 font-medium transition-colors", schoolMode === "table" ? "bg-plan-accent text-plan-accent-foreground" : "hover:bg-muted")}>Existing table</button>
                        </div>
                        {schoolMode === "category" ? (
                          <Dropdown
                            name="categoryId"
                            value={categoryId}
                            onChange={setCategoryId}
                            placeholder="Choose a category"
                            options={[...schoolCategories.map((c) => ({ value: c.id, label: c.name })), { value: NEW_CATEGORY, label: "+ New category" }]}
                          />
                        ) : schoolTables.length > 0 ? (
                          <Dropdown
                            name="tableId"
                            value={categoryId}
                            onChange={setCategoryId}
                            placeholder="Choose a table"
                            options={schoolTables.map((g) => ({ value: TABLE_PREFIX + g.key, label: tableLabel(g) }))}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">This school has no tables with more than one category.</span>
                        )}
                      </div>
                    )}
                    {!school && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Choose a school first.</p>}
                    {school && categoryId === "" && schoolMode === "category" && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Now choose a category to see its files.</p>}
                    {school && categoryId === "" && schoolMode === "table" && schoolTables.length > 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Now choose a table. A new file you add will be created in that table, with all of its categories.</p>}
                    {categoryId === NEW_CATEGORY && (
                      <div className="space-y-1">
                        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
                        <p className="text-xs text-muted-foreground">Categories are shared by every school.</p>
                      </div>
                    )}
                    {school && (pickedCategory || pickedTable) && browseSchoolTasks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">{pickedTable ? "No other files in this table." : "No other files in this category at this school."}</p>}
                    {browseSchoolTasks.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span>{pickedTable && <span className="text-muted-foreground"> — {t.category}</span>}{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}</span>
                      </label>
                    ))}
                    {school && categoryId !== "" && (
                      <div className="flex gap-2 rounded-lg border border-dashed p-2.5">
                        <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); stageNewSchoolFile(); } }} placeholder="Not on the list? Type a new file name" className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" />
                        <Button type="button" size="sm" onClick={stageNewSchoolFile} disabled={!newFileName.trim() || (categoryId === NEW_CATEGORY && !newCategoryName.trim())}>Add new</Button>
                      </div>
                    )}
                    {newItems.filter((i) => i.kind === "school").length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Will be created when you save</p>
                        {newItems.filter((i) => i.kind === "school").map((i) => (
                          <div key={i.key} className="flex items-center justify-between gap-2 rounded-lg border border-l-4 border-l-plan-accent bg-card px-3 py-2 text-sm shadow-sm">
                            <span className="min-w-0"><span className="font-medium">{i.name}</span><span className="text-muted-foreground"> — {i.schoolName + " · " + i.categoryName}</span>{i.isNewCategory && <span className="ml-1.5 rounded-full bg-plan-accent px-1.5 py-0.5 text-[10px] font-bold text-plan-accent-foreground">new category</span>}</span>
                            <button type="button" onClick={() => removeNewItem(i.key)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {tab === "reminder" && (
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      <Button type="button" size="xs" variant={reminderMode === "freeText" ? "plan" : "outline"} onClick={() => setReminderMode("freeText")}>Free text</Button>
                      <Button type="button" size="xs" variant={reminderMode === "fromNotes" ? "plan" : "outline"} onClick={() => setReminderMode("fromNotes")}>From Private Notes</Button>
                    </div>
                    {reminderMode === "freeText" ? (
                      <div className="flex gap-2">
                        <input value={reminderText} onChange={(e) => setReminderText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPendingReminderFreeText(); } }} placeholder="What should you remember to check?" className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" />
                        <Button type="button" size="sm" onClick={addPendingReminderFreeText}>Add</Button>
                      </div>
                    ) : myReminderNotes.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No private notes are marked as reminders yet. Mark one from the Private Notes page.</p>
                    ) : (
                      <div className="flex gap-2">
                        <Dropdown name="reminderNoteId" value={selectedNoteId} onChange={setSelectedNoteId} placeholder="Choose a note" options={myReminderNotes.map((n) => ({ value: n.id, label: plainText(n.text, 60) }))} />
                        <Button type="button" size="sm" disabled={!selectedNoteId} onClick={addPendingReminderFromNote}>Add</Button>
                      </div>
                    )}
                    {pendingReminders.length > 0 && (
                      <ul className="space-y-1.5">
                        {pendingReminders.map((r) => (
                          <li key={r.key} className="flex items-center justify-between gap-2 rounded-lg border border-l-4 border-l-plan-accent-secondary bg-card px-3 py-2 text-sm shadow-sm">
                            <span>{r.label}</span>
                            <button type="button" onClick={() => removePendingReminder(r.key)} aria-label="Remove reminder" className="text-muted-foreground hover:text-destructive">✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form
              action={async (formData) => {
                setError(null);
                setSavedMessage(null);
                for (const id of checked) formData.append(isSchoolId(id) ? "taskFileCategoryIds" : "generalTaskIds", id);
                formData.set("labels", JSON.stringify(buildLabels()));
                formData.set("reminders", JSON.stringify(pendingReminders.map((r) => ({ label: r.label, noteId: r.noteId }))));
                formData.set("newItems", JSON.stringify(newItems));
                if (mode === "end") formData.set("endShift", "1");
                const result = await savePlan(formData);
                if (result.error) setError(result.error);
                else if (!result.changed) {
                  // Nothing to save -- leave the window open so it's clear the click
                  // registered, rather than silently closing like a real save does.
                  setSavedMessage("No plans saved — nothing was added or changed.");
                } else {
                  setPendingReminders([]);
                  setNewItems([]);
                  setOpen(false);
                  router.refresh();
                }
              }}
              className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-5 py-3"
            >
              <p className="mr-auto text-sm text-muted-foreground">
                <b className="text-foreground">{taskTotal}</b> task{taskTotal === 1 ? "" : "s"} · <b className="text-foreground">{pendingReminders.length}</b> new reminder{pendingReminders.length === 1 ? "" : "s"}
              </p>
              {error && <p role="alert" className="w-full text-sm text-red-600 sm:order-first dark:text-red-400">{error}</p>}
              {!error && savedMessage && <p role="status" className="w-full text-sm text-muted-foreground sm:order-first">{savedMessage}</p>}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <SubmitButton variant="plan" pendingLabel="Saving…">{mode === "end" ? "Save plan & end day" : "Add to plan"}</SubmitButton>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
