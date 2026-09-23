"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import { TaskTableCategoryPicker } from "@/components/task-table-category-picker";
import { TaskTableAddFileRow } from "@/components/task-table-add-file-row";
import { KebabMenu } from "@/components/kebab-menu";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DeleteOrRequestControl } from "@/components/delete-or-request-control";
import { StatusBadge, TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
import { Dropdown } from "@/components/dropdown";
import { SignatureChip } from "@/components/signature-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupTaskTables, taskTableColumns, taskTableLayout, duplicateFileNamesInTable, submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
import {
  TASK_STATUS_OPTIONS,
  vaColorByName,
  type TaskFile,
  type TaskFileCategory,
  type TaskCategory,
  type Va,
} from "@/lib/app-state";

const TASK_STATUS_TONE: Record<string, StatusTone> = {
  "In Progress": "warning",
  Paused: "paused",
  Completed: "success",
};

/* Three fixed-width grid tracks -- [VA/sign area][Status][Remove] --
   instead of a flex row, so Status and the assignment-remove icon
   always start at the same x offset in every row of a category
   column, regardless of how many people have signed or how long any
   one VA's name is. A flex row couldn't guarantee this: its Status
   badge and remove icon just got pushed further right (or wrapped
   onto a second line entirely) as the signed-VA area grew, which is
   exactly what Michelle's screenshot showed -- rows with 0 vs. 2
   signatures had their Status badges landing in completely different
   places, and a long name wrapped the whole row to two lines with the
   badge dropping underneath instead of staying beside it. Grid tracks
   don't reflow based on a sibling's content the way flex-wrap does:
   the VA/sign area (first track) can wrap or overflow internally
   without ever moving the Status/Remove tracks after it.
   The first signer sits in a fixed-width slot at the left with
   "+ Sign" right after it (any further signers follow), so every
   "+ Sign" lines up in the same spot next to the first VA rather than
   drifting out toward Status. */
function SignAndStatus({ schoolId, assignment, vas, categories, currentUserName, canEdit, isAdmin, assignTaskToVa, signTask, removeVaFromTask, setTaskStatus, removeTaskAssignment, moveTaskFileCategory }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  categories: TaskCategory[];
  currentUserName: string;
  canEdit: boolean;
  /** Admins get "Assign to a VA" in the 3-dot menu. */
  isAdmin: boolean;
  assignTaskToVa: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  setTaskStatus: (formData: FormData) => void;
  removeTaskAssignment: (formData: FormData) => void;
  moveTaskFileCategory: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const iSigned = assignment.vaAssigned.includes(currentUserName);
  const [moving, setMoving] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const moveTargets = categories.filter((category) => category.id !== assignment.categoryId);

  if (moving) {
    return (
      <form
        action={async (formData) => {
          setMoveError(null);
          const result = await moveTaskFileCategory(formData);
          if (result.error) setMoveError(result.error);
          else { setMoving(false); setMoveTargetId(""); }
        }}
        className="space-y-1"
      >
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="taskId" value={assignment.id} />
        <Dropdown name="newCategoryId" value={moveTargetId} onChange={setMoveTargetId} placeholder="Move to which category?" options={moveTargets.map((category) => ({ value: category.id, label: category.name }))} />
        {moveError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{moveError}</p>}
        <div className="flex gap-2">
          <SubmitButton size="xs" pendingLabel="Moving…" disabled={!moveTargetId}>Move</SubmitButton>
          <Button type="button" variant="ghost" size="xs" onClick={() => { setMoving(false); setMoveError(null); setMoveTargetId(""); }}>Cancel</Button>
        </div>
      </form>
    );
  }

  const [firstSigner, ...otherSigners] = assignment.vaAssigned;
  const signerChip = (name: string) => (
    <form key={name} action={removeVaFromTask} className="inline-flex shrink-0 items-center gap-1">
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="taskId" value={assignment.id} />
      <input type="hidden" name="vaName" value={name} />
      <SignatureChip name={name} color={vaColorByName(vas, name)} small />
      <ConfirmDeleteButton confirmMessage={`Remove ${name}'s signature?`} pendingLabel="…" iconSize="icon-2xs">✕</ConfirmDeleteButton>
    </form>
  );

  return (
    <div className="grid grid-cols-[1fr_88px_24px] items-start gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <div className="flex min-h-6 w-24 shrink-0 items-center overflow-hidden">{firstSigner && signerChip(firstSigner)}</div>
        {!iSigned && (
          <form action={signTask} className="shrink-0">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={assignment.id} />
            <SubmitButton
              pendingLabel="…"
              variant="outline"
              size="xs"
              title={assignment.vaAssigned.length > 0 ? "Take this file over from " + assignment.vaAssigned.join(", ") : undefined}
              onClick={(event) => {
                if (assignment.vaAssigned.length > 0 && !window.confirm("Take this file over from " + assignment.vaAssigned.join(", ") + "? Your name replaces theirs.")) event.preventDefault();
              }}
            >
              {assignment.vaAssigned.length > 0 ? "Take over" : "+ Sign"}
            </SubmitButton>
          </form>
        )}
        {otherSigners.map(signerChip)}
      </div>
      <StatusSelect
        action={setTaskStatus}
        hiddenFields={{ schoolId, taskId: assignment.id }}
        value={assignment.status}
        options={TASK_STATUS_OPTIONS.map((status) => ({ value: status, label: status || "—" }))}
        toneClassName={TONE_CLASSES[TASK_STATUS_TONE[assignment.status] ?? "neutral"]}
        optionToneClassName={(status) => TONE_CLASSES[TASK_STATUS_TONE[status] ?? "neutral"]}
        disabled={!canEdit}
      />
      {canEdit && (
        <KebabMenu
          ariaLabel={`More actions for the ${assignment.category} task`}
          items={[
            ...(isAdmin ? [{
              label: "Assign to a VA",
              panel: (close: () => void) => (
                <div className="w-56 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Assign this file to:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vas.map((va) => (
                      <form key={va.id} action={(formData) => { assignTaskToVa(formData); close(); }}>
                        <input type="hidden" name="schoolId" value={schoolId} />
                        <input type="hidden" name="taskId" value={assignment.id} />
                        <input type="hidden" name="vaName" value={va.name} />
                        <button type="submit" className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:bg-muted">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: va.color || "#94a3b8" }} aria-hidden />
                          {va.name}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              ),
            }] : []),
            ...(moveTargets.length > 0 ? [{ label: "Move to another category", onClick: () => setMoving(true) }] : []),
            {
              label: "Remove",
              destructive: true,
              onClick: () => {
                if (!window.confirm(`Remove only the ${assignment.category} task from this file?`)) return;
                const formData = new FormData();
                formData.set("schoolId", schoolId);
                formData.set("taskId", assignment.id);
                removeTaskAssignment(formData);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function AssignmentCell({ schoolId, assignment, vas, categories, currentUserName, canEdit, isAdmin, actions }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  categories: TaskCategory[];
  currentUserName: string;
  canEdit: boolean;
  isAdmin: boolean;
  actions: Pick<TasksCardProps, "assignTaskToVa" | "setTaskStatus" | "setTaskCount" | "signTask" | "removeVaFromTask" | "setCommsStatus" | "signComms" | "removeVaFromComms" | "removeTaskAssignment" | "moveTaskFileCategory">;
}) {
  return (
    <div className="min-w-0">
      <SignAndStatus
        schoolId={schoolId}
        assignment={assignment}
        vas={vas}
        categories={categories}
        currentUserName={currentUserName}
        canEdit={canEdit}
        isAdmin={isAdmin}
        assignTaskToVa={actions.assignTaskToVa}
        signTask={actions.signTask}
        removeVaFromTask={actions.removeVaFromTask}
        setTaskStatus={actions.setTaskStatus}
        removeTaskAssignment={actions.removeTaskAssignment}
        moveTaskFileCategory={actions.moveTaskFileCategory}
      />
    </div>
  );
}

type TasksCardProps = {
  /** A task to scroll to and flash on arrival (from an Overview link). */
  highlightTaskId?: string;
  schoolId: string;
  categories: TaskCategory[];
  taskFiles: TaskFile[];
  vas: Va[];
  canEdit: boolean;
  currentUserName: string;
  addTask: (formData: FormData) => Promise<TaskFileActionResult>;
  addCategoryToFiles: (formData: FormData) => Promise<TaskFileActionResult>;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  assignTaskToVa: (formData: FormData) => void;
  /** Whether the viewer is an admin (shows "Assign to a VA" in a file's 3-dot menu). */
  isAdmin: boolean;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
  removeTaskAssignment: (formData: FormData) => void;
  moveTaskFileCategory: (formData: FormData) => Promise<TaskFileActionResult>;
  addTaskCategory: (formData: FormData) => void;
  removeTaskCategory: (formData: FormData) => void;
  setCommsStatus: (formData: FormData) => void;
  signComms: (formData: FormData) => void;
  removeVaFromComms: (formData: FormData) => void;
  reorderTaskCategories: (orderedIds: string[]) => void;
  renameTaskCategory: (formData: FormData) => Promise<TaskFileActionResult>;
  setTaskCategoryHasCount: (formData: FormData) => void;
  setTaskCategoryEodPhrase: (formData: FormData) => void;
  reorderTasks: (schoolId: string, orderedIds: string[]) => void;
  updateTaskFileName: (formData: FormData) => Promise<TaskFileActionResult>;
};

export function TasksCard(props: TasksCardProps) {
  const { schoolId, categories, taskFiles, vas, canEdit, currentUserName } = props;
  const [editorOpen, setEditorOpen] = useState(false);
  // The task an Overview link pointed at: scrolled into view and flashed for a
  // few seconds so it's obvious where you landed.
  const [flashId, setFlashId] = useState<string | null>(
    props.highlightTaskId && taskFiles.some((file) => file.categories.some((a) => a.id === props.highlightTaskId)) ? props.highlightTaskId : null,
  );
  useEffect(() => {
    if (!flashId) return;
    const scroll = setTimeout(() => {
      const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-assignment-id="${flashId}"]`));
      // The table and the phone cards both exist; scroll to whichever is showing.
      (targets.find((el) => el.offsetParent !== null) ?? targets[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    const clear = setTimeout(() => setFlashId(null), 1900);
    return () => { clearTimeout(scroll); clearTimeout(clear); };
  }, [flashId]);
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [orderedFiles, setOrderedFiles] = useState(taskFiles);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [addFileError, setAddFileError] = useState<string | null>(null);
  // The top form only ever starts a brand NEW table now -- each table
  // already grew its own "+ Add file" row (TaskTableAddFileRow below),
  // so a separate "add to an existing table" mode here was doing the
  // same job twice. Picking several categories here (instead of the
  // old single-category dropdown) is what lets this create a
  // multi-category table in one step -- addTask already accepted
  // several categoryIds server-side, the UI just never offered more
  // than one.
  const [newTableCategoryIds, setNewTableCategoryIds] = useState<string[]>([]);
  const [editFileError, setEditFileError] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState("");
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState<Set<string>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Record<string, string[]>>({});
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState<Set<string>>(new Set());

  function toggleNewTableCategory(id: string) {
    setNewTableCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleTableSelectMode(key: string) {
    setSelectMode((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setSelectedFileIds((prev) => ({ ...prev, [key]: [] }));
  }

  function toggleFileSelected(key: string, fileId: string) {
    setSelectedFileIds((prev) => {
      const current = prev[key] || [];
      return { ...prev, [key]: current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId] };
    });
  }

  async function removeSelectedFiles(key: string) {
    const ids = selectedFileIds[key] || [];
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} file${ids.length === 1 ? "" : "s"} and all of its tasks?`)) return;
    setBulkBusy((prev) => new Set(prev).add(key));
    for (const fileId of ids) {
      const formData = new FormData();
      formData.set("schoolId", schoolId);
      formData.set("taskFileId", fileId);
      props.removeTask(formData);
    }
    setBulkBusy((prev) => { const next = new Set(prev); next.delete(key); return next; });
    setSelectedFileIds((prev) => ({ ...prev, [key]: [] }));
    setSelectMode((prev) => { const next = new Set(prev); next.delete(key); return next; });
  }

  /* Removes just one category's task from each selected file -- the
     file itself, and its OTHER categories (in a multi-category table),
     are untouched. Same removeTaskAssignment the per-row kebab's own
     "Remove" already uses, just run once per selected file instead of
     picked one row at a time. */
  async function removeSelectedCategory(key: string, group: { categories: TaskCategory[]; files: TaskFile[] }) {
    const categoryId = bulkCategoryTarget[key];
    const category = group.categories.find((c) => c.id === categoryId);
    if (!category) return;
    const ids = selectedFileIds[key] || [];
    const assignmentIds = ids
      .map((fileId) => group.files.find((f) => f.id === fileId)?.categories.find((a) => a.categoryId === categoryId)?.id)
      .filter((id): id is string => !!id);
    if (assignmentIds.length === 0) return;
    if (!window.confirm(`Remove the "${category.name}" task from ${assignmentIds.length} selected file${assignmentIds.length === 1 ? "" : "s"}?`)) return;
    setBulkBusy((prev) => new Set(prev).add(key));
    for (const taskId of assignmentIds) {
      const formData = new FormData();
      formData.set("schoolId", schoolId);
      formData.set("taskId", taskId);
      props.removeTaskAssignment(formData);
    }
    setBulkBusy((prev) => { const next = new Set(prev); next.delete(key); return next; });
    setSelectedFileIds((prev) => ({ ...prev, [key]: [] }));
    setSelectMode((prev) => { const next = new Set(prev); next.delete(key); return next; });
  }

  function toggleTableCollapsed(key: string) {
    setCollapsedTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh optimistic category order after server mutations.
    setOrderedCategories(categories);
  }, [categories]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh optimistic file order after server mutations.
    setOrderedFiles(taskFiles);
  }, [taskFiles]);

  const taskTables = groupTaskTables(orderedCategories, orderedFiles);
  const assignments = orderedFiles.flatMap((file) => file.categories);
  const openCount = assignments.filter((item) => item.status !== "Completed").length;
  const inProgressCount = assignments.filter((item) => item.status === "In Progress").length;
  const pausedCount = assignments.filter((item) => item.status === "Paused").length;
  const completedCount = assignments.filter((item) => item.status === "Completed").length;

  function moveItem<T extends { id: string }>(items: T[], draggedId: string, targetId: string): T[] | null {
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return null;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  function dropCategory(targetId: string) {
    if (!draggedCategoryId) return;
    const next = moveItem(orderedCategories, draggedCategoryId, targetId);
    setDraggedCategoryId(null);
    if (!next) return;
    setOrderedCategories(next);
    props.reorderTaskCategories(next.map((item) => item.id));
  }

  /* Moves a file one step up or down within its own table by swapping it
     with its neighbour there, then saves the whole school's file order. */
  function moveFileStep(tableFiles: TaskFile[], fileId: string, direction: "up" | "down") {
    const index = tableFiles.findIndex((file) => file.id === fileId);
    const neighbour = tableFiles[direction === "up" ? index - 1 : index + 1];
    if (index < 0 || !neighbour) return;
    const next = moveItem(orderedFiles, fileId, neighbour.id);
    if (!next) return;
    setOrderedFiles(next.map((file, sortOrder) => ({ ...file, sortOrder })));
    props.reorderTasks(schoolId, next.map((item) => item.id));
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-header-background px-3 py-1 text-white">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-white/70">{openCount}</span>}</h2>
          <StatusBadge tone="warning">{inProgressCount}</StatusBadge>
          <StatusBadge tone="paused">{pausedCount}</StatusBadge>
          <StatusBadge tone="success">{completedCount}</StatusBadge>
        </div>
        <Button type="button" variant="link" size="sm" className="text-white" onClick={() => setEditorOpen((open) => !open)}>{editorOpen ? "Close editor" : "Edit categories"}</Button>
      </div>

      <div className="space-y-3 p-3">
        {editorOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reordering, renaming and the EOD phrase apply to every school. The Count column below is just for this school.</p>
            {orderedCategories.map((category) => (
              <div key={category.id} draggable onDragStart={() => setDraggedCategoryId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCategory(category.id)} onDragEnd={() => setDraggedCategoryId(null)} className={`flex items-center justify-between gap-2 text-sm ${draggedCategoryId === category.id ? "opacity-40" : ""}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/60" />
                    {editingCategoryId === category.id ? (
                      <form
                        action={(formData) => submitTaskFileForm(props.renameTaskCategory, formData, setEditCategoryError, () => setEditingCategoryId(null))}
                        className="flex flex-1 items-center gap-1"
                      >
                        <input type="hidden" name="id" value={category.id} />
                        <Input name="name" defaultValue={category.name} required autoFocus className="h-7" />
                        <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton>
                        <Button type="button" variant="ghost" size="xs" onClick={() => { setEditingCategoryId(null); setEditCategoryError(null); }}>Cancel</Button>
                      </form>
                    ) : <><span>{category.name}</span><Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60" aria-label={`Edit ${category.name}`} onClick={() => { setEditingCategoryId(category.id); setEditCategoryError(null); }}><Pencil className="h-3 w-3" /></Button></>}
                  </div>
                  {editingCategoryId === category.id && editCategoryError && <p role="alert" className="pl-4 text-xs text-red-600 dark:text-red-400">{editCategoryError}</p>}
                  <AutoSubmitForm action={props.setTaskCategoryHasCount} className="pl-4">
                    <input type="hidden" name="id" value={category.id} />
                    <input type="hidden" name="schoolId" value={schoolId} />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input key={String(!!category.hasCount)} type="checkbox" name="hasCount" defaultChecked={!!category.hasCount} />
                      Show a Count column for this category (this school only)
                    </label>
                  </AutoSubmitForm>
                  <AutoSubmitForm action={props.setTaskCategoryEodPhrase} className="pl-4">
                    <input type="hidden" name="id" value={category.id} />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      EOD phrase
                      <input
                        key={category.eodPhrase || ""}
                        type="text"
                        name="eodPhrase"
                        defaultValue={category.eodPhrase || ""}
                        placeholder={`e.g. "Encode/Update Info, Upload" (blank uses "${category.name}")`}
                        className="h-7 min-w-0 flex-1 rounded-md border px-1.5 text-sm"
                      />
                    </label>
                  </AutoSubmitForm>
                </div>
                <form action={props.removeTaskCategory}>
                  <input type="hidden" name="id" value={category.id} />
                  <ConfirmDeleteButton confirmMessage={`Remove the "${category.name}" category? Categories still used by files cannot be removed.`} pendingLabel="…" variant="ghost" size="icon-xs">✕</ConfirmDeleteButton>
                </form>
              </div>
            ))}
            <form action={props.addTaskCategory} className="flex gap-2">
              <Input name="name" placeholder="New category" required />
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
            </form>
          </div>
        )}

        <div className="space-y-2 rounded-md border border-dashed p-2">
          {/* Only ever starts a brand new table now -- adding a file to
              a table that already exists happens right on that table
              itself (its own "+ Add file" row further down). Pick
              every category this new table should have, then name its
              first file. */}
          <p className="text-xs font-medium text-muted-foreground">New table — choose its categories:</p>
          <div className="flex flex-wrap gap-1.5">
            {orderedCategories.map((category) => (
              <label key={category.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-xs ${newTableCategoryIds.includes(category.id) ? "border-primary/60 bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}>
                <input type="checkbox" className="h-3 w-3" checked={newTableCategoryIds.includes(category.id)} onChange={() => toggleNewTableCategory(category.id)} />
                {category.name.trim() || "(Unnamed category)"}
              </label>
            ))}
          </div>
          <form action={(formData) => submitTaskFileForm(props.addTask, formData, setAddFileError, () => setNewFileName(""))} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input type="hidden" name="schoolId" value={schoolId} />
            {newTableCategoryIds.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
            <Input name="fileName" placeholder="File name" required value={newFileName} onChange={(event) => setNewFileName(event.target.value)} className="w-full sm:max-w-md sm:flex-1" />
            <SubmitButton pendingLabel="Adding…" disabled={newTableCategoryIds.length === 0}>Add</SubmitButton>
          </form>
        </div>
        {addFileError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addFileError}</p>}

        {orderedFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : taskTables.map((group) => {
          const columns = taskTableColumns(group.categories);
          const layout = taskTableLayout(columns);
          // A very light left border between two category columns
          // sitting side by side in the same table -- just enough to
          // see where one category ends and the next begins, not a
          // heavy rule. Only between two TASK columns specifically
          // (never before the first one, right after File name/Count,
          // which already has its own row/column structure to tell
          // them apart).
          const dividerClass = (index: number) => columns[index - 1]?.kind === "task" ? "border-l border-border/40" : "";
          const collapsed = collapsedTables.has(group.key);
          // Two files here with the same name, front and center -- Michelle
          // asked to be told, not just quietly allowed it (a file name is a
          // label, not an identity: see supabase/phase40_unrestricted_file_names.sql).
          const duplicateNames = duplicateFileNamesInTable(group.files);
          const isSelecting = selectMode.has(group.key);
          const selectedInTable = selectedFileIds[group.key] || [];
          return (
          <div key={group.key} className="rounded-md border">
            <div className="flex w-full items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-sm font-semibold">
              <button
                type="button"
                onClick={() => toggleTableCollapsed(group.key)}
                aria-expanded={!collapsed}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:opacity-80"
              >
                {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{group.categories.map((c) => c.name).join(" + ")}</span>
              </button>
              {canEdit && group.files.length > 0 && (
                <Button type="button" variant="ghost" size="xs" onClick={() => toggleTableSelectMode(group.key)}>{isSelecting ? "Done" : "Select"}</Button>
              )}
              <span className="shrink-0 text-xs font-normal text-muted-foreground">{group.files.length} file{group.files.length === 1 ? "" : "s"}</span>
            </div>
            {!collapsed && (
            <>
            {selectedInTable.length > 0 && (
              <div className="space-y-1 border-t bg-muted/20 p-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{selectedInTable.length} selected</span>
                  <Button type="button" size="xs" variant="destructive" disabled={bulkBusy.has(group.key)} onClick={() => removeSelectedFiles(group.key)}>
                    {bulkBusy.has(group.key) ? "Removing…" : `Remove ${selectedInTable.length} whole file${selectedInTable.length === 1 ? "" : "s"}`}
                  </Button>
                  {group.categories.length > 1 && (
                    <>
                      <Dropdown
                        name={`bulk-category-${group.key}`}
                        value={bulkCategoryTarget[group.key] || ""}
                        onChange={(value) => setBulkCategoryTarget((prev) => ({ ...prev, [group.key]: value }))}
                        placeholder="Choose a category…"
                        options={group.categories.map((category) => ({ value: category.id, label: category.name }))}
                        className="min-w-40 rounded-md border px-2 py-1 text-left text-xs"
                      />
                      <Button type="button" size="xs" variant="outline" disabled={!bulkCategoryTarget[group.key] || bulkBusy.has(group.key)} onClick={() => removeSelectedCategory(group.key, group)}>
                        Remove just that category
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
            {/* Phones: one card per file (name, then each category with its count
                and VA/status) instead of a wide table that scrolls sideways. */}
            <div className="space-y-2 p-2 sm:hidden">
              {group.files.map((file) => {
                const countCategoryIds = new Set(columns.find((column) => column.kind === "count")?.categories.map((category) => category.id));
                return (
                  <div key={file.id} className="space-y-2 rounded-lg border bg-card p-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      {isSelecting && (
                        <input type="checkbox" className="mt-1 shrink-0" checked={selectedInTable.includes(file.id)} onChange={() => toggleFileSelected(group.key, file.id)} aria-label={`Select ${file.fileName}`} />
                      )}
                      {editingFileId === file.id ? (
                        <form action={(formData) => submitTaskFileForm(props.updateTaskFileName, formData, setEditFileError, () => setEditingFileId(null))} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          <input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="taskFileId" value={file.id} />
                          <Input name="fileName" value={editedFileName} onChange={(event) => setEditedFileName(event.target.value)} required autoFocus className="h-8 min-w-0" />
                          <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton><Button type="button" variant="ghost" size="xs" onClick={() => setEditingFileId(null)}>Cancel</Button>
                          {editFileError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{editFileError}</p>}
                        </form>
                      ) : (
                        <p className="min-w-0 flex-1 break-words font-bold" style={{ overflowWrap: "anywhere" }} title={duplicateNames.has(file.fileName.trim().toLowerCase()) ? "Another file in this table has this same name" : undefined}>
                          {file.fileName}
                          {duplicateNames.has(file.fileName.trim().toLowerCase()) && <Copy className="ml-1 inline h-3 w-3 shrink-0 align-middle text-amber-600 dark:text-amber-400" aria-label="Another file in this table has this same name" />}
                          {canEdit && <Button type="button" variant="ghost" size="icon-xs" className="ml-1 align-middle text-muted-foreground/60" aria-label={`Edit ${file.fileName}`} onClick={() => { setEditingFileId(file.id); setEditedFileName(file.fileName); setEditFileError(null); }}><Pencil className="h-3 w-3" /></Button>}
                        </p>
                      )}
                      <DeleteOrRequestControl canDelete={canEdit} idFieldName="taskFileId" schoolId={schoolId} targetId={file.id} label={`file "${file.fileName}" and all of its tasks`} removeAction={props.removeTask} icon={<Trash2 className="h-3 w-3" />} />
                    </div>
                    {group.categories.map((category) => {
                      const assignment = file.categories.find((item) => item.categoryId === category.id);
                      if (!assignment) return null;
                      return (
                        <div key={category.id} data-assignment-id={assignment.id} className={`space-y-1 border-t pt-2 ${assignment.id === flashId ? "task-highlight-flash" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category.name}</span>
                            {countCategoryIds.has(category.id) && (
                              <AutoSubmitForm action={props.setTaskCount}>
                                <input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="taskId" value={assignment.id} />
                                <label className="flex items-center gap-1 text-xs text-muted-foreground">Count
                                  <input key={assignment.count || ""} type="number" min={0} name="count" aria-label={`${category.name} count for ${file.fileName}`} defaultValue={assignment.count || ""} placeholder="0" disabled={!canEdit} className="h-7 w-16 rounded-md border px-1.5 py-0.5 text-sm" />
                                </label>
                              </AutoSubmitForm>
                            )}
                          </div>
                          <AssignmentCell schoolId={schoolId} assignment={assignment} vas={vas} categories={orderedCategories} currentUserName={currentUserName} canEdit={canEdit} isAdmin={props.isAdmin} actions={props} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full table-fixed border-collapse text-sm" style={{minWidth: layout.minWidth}}>
              <colgroup>{isSelecting && <col style={{width: "28px"}} />}{columns.map((column, index) => <col key={column.kind === "task" ? `task:${column.category.id}` : column.kind} style={{width: layout.columnWidths[index]}} />)}</colgroup>
              {/* Category header cells get their own bg-title-background
                  (the same token used for every other section heading
                  in this app, e.g. "Other Contacts" -- already
                  theme-aware, no separate dark: override needed)
                  layered OVER the row's own bg-muted/40, alternating
                  full strength / 60% opacity per category column so
                  adjacent categories read as their own distinctly
                  colored band next to the plainer Count/File name
                  headers beside them. */}
              <thead><tr className="border-b bg-muted/40">{isSelecting && <th className="w-7"><span className="sr-only">Select</span></th>}{columns.map((column, index) => <th key={column.kind === "task" ? `task:${column.category.id}` : column.kind} className={`py-2 break-words ${column.kind === "task" ? `px-4 text-center text-sm font-bold ${columns.slice(0, index + 1).filter((c) => c.kind === "task").length % 2 === 1 ? "bg-title-background" : "bg-title-background/60"} ${dividerClass(index)}` : "px-2 text-left font-medium"}`}>{column.kind === "file" ? "File name" : column.kind === "count" ? "Count" : column.kind === "remove" ? <span className="sr-only">Remove file</span> : column.category.name}</th>)}</tr></thead>
              <tbody>
                {group.files.map((file, fileIndex) => (
                  <tr key={file.id} className="border-b last:border-b-0 hover:bg-row-hover">
                    {isSelecting && (
                      <td className="px-1 py-2 align-top">
                        <input type="checkbox" checked={selectedInTable.includes(file.id)} onChange={() => toggleFileSelected(group.key, file.id)} aria-label={`Select ${file.fileName}`} />
                      </td>
                    )}
                    {columns.map((column, index) => {
                      if (column.kind === "remove") return <td key="remove" className="px-1 py-2 align-top"><DeleteOrRequestControl canDelete={canEdit} idFieldName="taskFileId" schoolId={schoolId} targetId={file.id} label={`file "${file.fileName}" and all of its tasks`} removeAction={props.removeTask} icon={<Trash2 className="h-3 w-3" />} /></td>;
                      if (column.kind === "count") return <td key="count" className="px-2 py-2 align-top"><div className="space-y-1">{column.categories.map(category => {
                        const assignment=file.categories.find(a => a.categoryId === category.id);
                        if (!assignment) return null;
                        return <AutoSubmitForm key={assignment.id} action={props.setTaskCount}>
                          <input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="taskId" value={assignment.id} />
                          {column.categories.length > 1 && <label htmlFor={`count-${assignment.id}`} className="block text-[10px] leading-tight text-muted-foreground break-words">{category.name}</label>}
                          <input id={`count-${assignment.id}`} key={assignment.count || ""} type="number" min={0} name="count" aria-label={`${category.name} count for ${file.fileName}`} defaultValue={assignment.count || ""} placeholder="0" disabled={!canEdit} className="h-7 w-14 rounded-md border px-1.5 py-0.5 text-sm" />
                        </AutoSubmitForm>;
                      })}</div></td>;
                      if (column.kind === "task") {
                        const category = column.category;
                        const assignment = file.categories.find((item) => item.categoryId === category.id);
                        return <td key={`${column.kind}:${category.id}`} data-assignment-id={assignment?.id} className={`px-4 py-2 align-top ${dividerClass(index)} ${assignment && assignment.id === flashId ? "task-highlight-flash" : ""}`}>
                          {assignment ? <AssignmentCell schoolId={schoolId} assignment={assignment} vas={vas} categories={orderedCategories} currentUserName={currentUserName} canEdit={canEdit} isAdmin={props.isAdmin} actions={props} /> : null}
                        </td>;
                      }
                      return <td key="file" className="px-2 py-2 align-top">
                      <div className="flex min-h-7 min-w-0 items-center gap-1">
                        {/* Only worth showing once there's a second file to trade places with. */}
                        {canEdit && group.files.length > 1 && (
                          <span className="flex shrink-0 flex-col">
                            <button type="button" disabled={fileIndex === 0} onClick={() => moveFileStep(group.files, file.id, "up")} aria-label={`Move ${file.fileName} up`} title="Move up" className="flex h-3.5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"><ArrowUp className="h-3 w-3" /></button>
                            <button type="button" disabled={fileIndex === group.files.length - 1} onClick={() => moveFileStep(group.files, file.id, "down")} aria-label={`Move ${file.fileName} down`} title="Move down" className="flex h-3.5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent"><ArrowDown className="h-3 w-3" /></button>
                          </span>
                        )}
                        {editingFileId === file.id ? (
                          <form action={(formData) => submitTaskFileForm(props.updateTaskFileName, formData, setEditFileError, () => setEditingFileId(null))} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                            <input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="taskFileId" value={file.id} />
                            <Input name="fileName" value={editedFileName} onChange={(event) => setEditedFileName(event.target.value)} required autoFocus className="h-7 min-w-0" />
                            <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton><Button type="button" variant="ghost" size="xs" onClick={() => setEditingFileId(null)}>Cancel</Button>
                            {editFileError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{editFileError}</p>}
                          </form>
                        ) : <><span className="font-bold break-words" style={{minWidth: 0, overflowWrap: "anywhere"}} title={duplicateNames.has(file.fileName.trim().toLowerCase()) ? "Another file in this table has this same name" : undefined}>{file.fileName}</span>{duplicateNames.has(file.fileName.trim().toLowerCase()) && <Copy className="ml-1 inline h-3 w-3 shrink-0 align-middle text-amber-600 dark:text-amber-400" aria-label="Another file in this table has this same name" />}{canEdit && <Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60" aria-label={`Edit ${file.fileName}`} onClick={() => { setEditingFileId(file.id); setEditedFileName(file.fileName); setEditFileError(null); }}><Pencil className="h-3 w-3" /></Button>}</>}
                      </div>
                    </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {canEdit && <TaskTableAddFileRow schoolId={schoolId} tableId={group.key} categoryIds={group.categories.map((category) => category.id)} addTask={props.addTask} />}
            {canEdit && <TaskTableCategoryPicker schoolId={schoolId} tableId={group.key} files={group.files} categories={orderedCategories} action={props.addCategoryToFiles} />}
            </>
            )}
          </div>
        ); })}
      </div>
    </div>
  );
}
