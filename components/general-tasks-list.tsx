"use client";

import { useEffect, useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
import { Dropdown } from "@/components/dropdown";
import { SignatureChip } from "@/components/signature-chip";
import { KebabMenu } from "@/components/kebab-menu";
import { GeneralTaskMoveForm } from "@/components/general-task-move-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
import {
  TASK_STATUS_OPTIONS,
  vaColorByName,
  visibleSchoolItems,
  type GeneralTask,
  type GeneralTaskCategory,
  type TaskCategory,
  type Va,
} from "@/lib/app-state";

const STATUS_TONE: Record<string, StatusTone> = {
  "In Progress": "warning",
  Paused: "paused",
  Completed: "success",
};

export type SchoolTables = Record<string, { key: string; categoryIds: string[]; categoryNames: string[]; fileCount: number }[]>;

function GeneralTaskRow({
  task,
  vas,
  currentUserName,
  schools,
  categories,
  taskCategories,
  schoolTables,
  setGeneralTaskStatus,
  signGeneralTask,
  removeVaFromGeneralTask,
  removeGeneralTask,
  updateGeneralTaskDescription,
  updateGeneralTaskCategory,
  moveGeneralTaskToSchool,
  addTaskCategory,
}: {
  task: GeneralTask;
  vas: Va[];
  currentUserName: string;
  schools: { id: string; name: string }[];
  categories: GeneralTaskCategory[];
  taskCategories: TaskCategory[];
  schoolTables: SchoolTables;
  setGeneralTaskStatus: (formData: FormData) => void;
  signGeneralTask: (formData: FormData) => void;
  removeVaFromGeneralTask: (formData: FormData) => void;
  removeGeneralTask: (formData: FormData) => void;
  updateGeneralTaskDescription: (formData: FormData) => Promise<TaskFileActionResult>;
  updateGeneralTaskCategory: (formData: FormData) => Promise<TaskFileActionResult>;
  moveGeneralTaskToSchool: (formData: FormData) => Promise<{ error: string | null }>;
  addTaskCategory: (formData: FormData) => void;
}) {
  const iSigned = task.vaAssigned.includes(currentUserName);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [editedCategory, setEditedCategory] = useState(task.category);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  return (
    <div className="flex flex-col gap-2 bg-record-background no-record-hover px-1 py-1">
      <div className="flex flex-wrap items-center gap-3">
        {editingCategory ? (
          <form
            action={(formData) => submitTaskFileForm(updateGeneralTaskCategory, formData, setCategoryError, () => setEditingCategory(false))}
            className="flex items-center gap-1"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <Dropdown
              name="category"
              value={editedCategory}
              onChange={setEditedCategory}
              options={categories.map((c) => ({ value: c.name, label: c.name }))}
              className="h-7 rounded-md border px-2 text-left text-sm"
            />
            <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton>
            <Button type="button" variant="ghost" size="xs" onClick={() => { setEditedCategory(task.category); setCategoryError(null); setEditingCategory(false); }}>Cancel</Button>
            {categoryError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{categoryError}</p>}
          </form>
        ) : (
          <span className="text-sm font-bold">{task.category}</span>
        )}

        {editingDescription ? (
          <form
            action={(formData) => submitTaskFileForm(updateGeneralTaskDescription, formData, setDescriptionError, () => setEditingDescription(false))}
            className="flex min-w-40 flex-1 flex-wrap items-center gap-1"
          >
            <input type="hidden" name="taskId" value={task.id} />
            <Input name="description" value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} required autoFocus className="h-7 min-w-0" />
            <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton>
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditingDescription(false)}>Cancel</Button>
            {descriptionError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{descriptionError}</p>}
          </form>
        ) : (
          <span className="min-w-40 flex-1 text-sm break-words">{task.description}</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {task.vaAssigned.map((name) => (
              <form key={name} action={removeVaFromGeneralTask} className="inline-flex items-center gap-1">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="vaName" value={name} />
                <SignatureChip name={name} color={vaColorByName(vas, name)} small />
                <ConfirmDeleteButton confirmMessage={`Remove ${name}'s signature?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
              </form>
            ))}
            {!iSigned && (
              <form action={signGeneralTask}>
                <input type="hidden" name="taskId" value={task.id} />
                <SubmitButton pendingLabel="…" variant="outline" size="xs">+ Sign</SubmitButton>
              </form>
            )}
          </div>

          <StatusSelect
            action={setGeneralTaskStatus}
            hiddenFields={{ taskId: task.id }}
            value={task.status}
            options={TASK_STATUS_OPTIONS.map((s) => ({ value: s, label: s || "—" }))}
            toneClassName={TONE_CLASSES[STATUS_TONE[task.status] ?? "neutral"]}
            optionToneClassName={(v) => TONE_CLASSES[STATUS_TONE[v] ?? "neutral"]}
          />

          <KebabMenu
            ariaLabel={`More actions for ${task.description}`}
            items={[
              { label: "Edit description", onClick: () => { setEditedDescription(task.description); setDescriptionError(null); setEditingDescription(true); } },
              { label: "Edit category", onClick: () => { setEditedCategory(task.category); setCategoryError(null); setEditingCategory(true); } },
              { label: "Move to a school", onClick: () => setMoving(true) },
              {
                label: "Remove",
                destructive: true,
                onClick: () => {
                  if (!window.confirm(`Remove "${task.description}"?`)) return;
                  const fd = new FormData();
                  fd.set("taskId", task.id);
                  removeGeneralTask(fd);
                },
              },
            ]}
          />
        </div>
      </div>

      {moving && (
        <GeneralTaskMoveForm
          taskId={task.id}
          defaultFileName={task.description}
          schools={schools}
          taskCategories={taskCategories}
          schoolTables={schoolTables}
          moveGeneralTaskToSchool={moveGeneralTaskToSchool}
          addTaskCategory={addTaskCategory}
          onClose={() => setMoving(false)}
        />
      )}
    </div>
  );
}

/* Bulk move picker -- targets several selected General Tasks with one
   shared destination (school, plus either a plain category or an
   existing table + category mapping), each still becoming its own new
   file (per Michelle: no combining several tasks onto one file in a
   bulk move -- that's still a one-at-a-time GeneralTaskMoveForm case). */
function BulkMoveForm({ taskIds, tasks, schools, taskCategories, schoolTables, moveGeneralTasksToSchool, onClose }: {
  taskIds: string[];
  tasks: GeneralTask[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolTables: SchoolTables;
  moveGeneralTasksToSchool: (formData: FormData) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [existingTable, setExistingTable] = useState(false);
  const [tableKey, setTableKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];
  const tables = schoolTables[schoolId] || [];
  const selectedTable = tables.find((t) => t.key === tableKey);
  const selectedTasks = tasks.filter((t) => taskIds.includes(t.id));

  return (
    <div className="rounded-md border bg-card p-3">
      <p className="mb-2 text-sm font-semibold">Move {taskIds.length} tasks to which school?</p>
      <form
        action={async (formData) => {
          setError(null);
          taskIds.forEach((id) => formData.append("taskIds", id));
          const fileNames = Object.fromEntries(selectedTasks.map((t) => [t.id, t.description]));
          formData.set("fileNames", JSON.stringify(fileNames));
          if (selectedTable) formData.set("tableCategoryIds", selectedTable.categoryIds.join(","));
          const result = await moveGeneralTasksToSchool(formData);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="space-y-2"
      >
        <Dropdown name="schoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); setTableKey(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
        {schoolId && tables.length > 0 && (
          <div className="flex gap-1">
            <Button type="button" size="xs" variant={existingTable ? "outline" : "default"} onClick={() => { setExistingTable(false); setCategoryId(""); setTableKey(""); }}>New files</Button>
            <Button type="button" size="xs" variant={existingTable ? "default" : "outline"} onClick={() => { setExistingTable(true); setCategoryId(""); }}>Add to existing table</Button>
          </div>
        )}
        {existingTable ? (
          <>
            <Dropdown name="tableKey" value={tableKey} onChange={(v) => { setTableKey(v); setCategoryId(""); }} placeholder="Choose a table" options={tables.map((t) => ({ value: t.key, label: `${t.categoryNames.join(" + ")} (${t.fileCount} file${t.fileCount === 1 ? "" : "s"})` }))} />
            {selectedTable && (
              <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Which category is this?" options={selectedTable.categoryIds.map((id, i) => ({ value: id, label: selectedTable.categoryNames[i] }))} />
            )}
          </>
        ) : (
          <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        )}
        <div className="flex gap-2">
          <SubmitButton size="sm" pendingLabel="Moving…" disabled={!schoolId || !categoryId}>Move {taskIds.length}</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}

/* Work that isn't tied to any school -- Admin, Training, Team Meeting,
   Payroll, etc. Same look as a school's own Tasks card
   (components/tasks-card.tsx), just without a schoolId, count, or
   Communications sub-status, none of which apply to non-school work.
   Categories are editable the same way school Tasks' own categories
   are (Michelle asked for this, not a fixed list) -- see
   addGeneralTaskCategory/removeGeneralTaskCategory. */
export function GeneralTasksList({
  highlightTaskId,
  tasks,
  categories,
  vas,
  currentUserName,
  schools,
  taskCategories,
  schoolTables,
  addGeneralTask,
  setGeneralTaskStatus,
  signGeneralTask,
  removeVaFromGeneralTask,
  removeGeneralTask,
  addGeneralTaskCategory,
  removeGeneralTaskCategory,
  updateGeneralTaskDescription,
  updateGeneralTaskCategory,
  moveGeneralTaskToSchool,
  moveGeneralTasksToSchool,
  addTaskCategory,
}: {
  /** A task to scroll to and flash on arrival (from an Overview link). */
  highlightTaskId?: string;
  tasks: GeneralTask[];
  categories: GeneralTaskCategory[];
  vas: Va[];
  currentUserName: string;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  schoolTables: SchoolTables;
  addGeneralTask: (formData: FormData) => void;
  setGeneralTaskStatus: (formData: FormData) => void;
  signGeneralTask: (formData: FormData) => void;
  removeVaFromGeneralTask: (formData: FormData) => void;
  removeGeneralTask: (formData: FormData) => void;
  addGeneralTaskCategory: (formData: FormData) => void;
  removeGeneralTaskCategory: (formData: FormData) => void;
  updateGeneralTaskDescription: (formData: FormData) => Promise<TaskFileActionResult>;
  updateGeneralTaskCategory: (formData: FormData) => Promise<TaskFileActionResult>;
  moveGeneralTaskToSchool: (formData: FormData) => Promise<{ error: string | null }>;
  moveGeneralTasksToSchool: (formData: FormData) => Promise<{ error: string | null }>;
  addTaskCategory: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  // The task an Overview link pointed at: scrolled into view and flashed for a
  // few seconds so it's obvious where you landed.
  const [flashId, setFlashId] = useState<string | null>(highlightTaskId && tasks.some((t) => t.id === highlightTaskId) ? highlightTaskId : null);
  useEffect(() => {
    if (!flashId) return;
    const scroll = setTimeout(() => {
      document.querySelector(`[data-task-id="${flashId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    const clear = setTimeout(() => setFlashId(null), 3500);
    return () => { clearTimeout(scroll); clearTimeout(clear); };
  }, [flashId]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoving, setBulkMoving] = useState(false);
  const openCount = tasks.filter((t) => t.status === "In Progress").length;

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold">
          Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-white/70">{openCount}</span>}
        </h2>
        <Button type="button" variant="link" size="sm" className="text-white" onClick={() => setEditorOpen((o) => !o)}>
          {editorOpen ? "Close editor" : "Edit categories"}
        </Button>
      </div>
      <div className="space-y-3 p-3">
        {editorOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Existing tasks keep their category name even if it&apos;s later removed here.</p>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{c.name}</span>
                <form action={removeGeneralTaskCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmDeleteButton confirmMessage={`Remove the "${c.name}" category? Existing tasks keep this category name.`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                </form>
              </div>
            ))}
            <form action={addGeneralTaskCategory} className="flex gap-2">
              <Input name="name" placeholder="New category" required />
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
            </form>
          </div>
        )}

        {/* flex-col on mobile, flex-row from sm up -- same fix as
            tasks-card.tsx's own add-task form: a field that isn't
            capped to a definite width can end up nearly off-screen
            next to a sibling on a narrow phone width instead of
            wrapping onto its own line. */}
        <form action={addGeneralTask} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Dropdown
            name="category"
            defaultValue={categories[0]?.name}
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
            className="w-full truncate rounded-md border px-2 py-1.5 text-left text-sm sm:w-auto"
          />
          <Input name="description" placeholder="What are you working on?" required className="w-full sm:min-w-0 sm:flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No general tasks yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {[...tasks].reverse().map((task) => (
              <div key={task.id} data-task-id={task.id} className={`flex items-start gap-2 bg-record-background px-1 ${task.id === flashId ? "task-highlight-flash" : ""}`}>
                <input type="checkbox" className="mt-2" checked={selectedIds.includes(task.id)} onChange={() => toggleSelected(task.id)} />
                <div className="flex-1">
                  <GeneralTaskRow
                    task={task}
                    vas={vas}
                    currentUserName={currentUserName}
                    schools={schools}
                    categories={categories}
                    taskCategories={taskCategories}
                    schoolTables={schoolTables}
                    setGeneralTaskStatus={setGeneralTaskStatus}
                    signGeneralTask={signGeneralTask}
                    removeVaFromGeneralTask={removeVaFromGeneralTask}
                    removeGeneralTask={removeGeneralTask}
                    updateGeneralTaskDescription={updateGeneralTaskDescription}
                    updateGeneralTaskCategory={updateGeneralTaskCategory}
                    moveGeneralTaskToSchool={moveGeneralTaskToSchool}
                    addTaskCategory={addTaskCategory}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
            <span>{selectedIds.length} selected</span>
            <Button type="button" size="xs" variant="outline" onClick={() => setBulkMoving(true)}>Move {selectedIds.length} to a school →</Button>
          </div>
        )}
        {bulkMoving && (
          <BulkMoveForm
            taskIds={selectedIds}
            tasks={tasks}
            schools={schools}
            taskCategories={taskCategories}
            schoolTables={schoolTables}
            moveGeneralTasksToSchool={moveGeneralTasksToSchool}
            onClose={() => { setBulkMoving(false); setSelectedIds([]); }}
          />
        )}
      </div>
    </div>
  );
}
