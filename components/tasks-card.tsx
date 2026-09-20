"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Pencil, Trash2 } from "lucide-react";
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
import { groupTaskTables, taskTableColumns, taskTableLayout, submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
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
function SignAndStatus({ schoolId, assignment, vas, categories, currentUserName, canEdit, signTask, removeVaFromTask, setTaskStatus, removeTaskAssignment, moveTaskFileCategory }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  categories: TaskCategory[];
  currentUserName: string;
  canEdit: boolean;
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
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <div className="flex w-24 shrink-0 items-center overflow-hidden">{firstSigner && signerChip(firstSigner)}</div>
        {!iSigned && (
          <form action={signTask} className="shrink-0">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={assignment.id} />
            <SubmitButton pendingLabel="…" variant="outline" size="xs">+ Sign</SubmitButton>
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

function AssignmentCell({ schoolId, assignment, vas, categories, currentUserName, canEdit, actions }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  categories: TaskCategory[];
  currentUserName: string;
  canEdit: boolean;
  actions: Pick<TasksCardProps, "setTaskStatus" | "setTaskCount" | "signTask" | "removeVaFromTask" | "setCommsStatus" | "signComms" | "removeVaFromComms" | "removeTaskAssignment" | "moveTaskFileCategory">;
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
  reorderTasks: (schoolId: string, orderedIds: string[]) => void;
  updateTaskFileName: (formData: FormData) => Promise<TaskFileActionResult>;
};

/* The category/table picker beside the "Add file" input -- a plain
   bordered, tinted button (no chevron) so it reads as something to click
   even before anything is chosen; the placeholder text does the rest. */
const ADD_FILE_PICKER_CLASS =
  "min-w-52 max-w-72 truncate rounded-md border border-primary/60 bg-primary/5 px-3 py-1.5 text-left text-sm font-medium text-primary hover:bg-primary/10";

export function TasksCard(props: TasksCardProps) {
  const { schoolId, categories, taskFiles, vas, canEdit, currentUserName } = props;
  const [editorOpen, setEditorOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [orderedFiles, setOrderedFiles] = useState(taskFiles);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [addFileError, setAddFileError] = useState<string | null>(null);
  const [addToExistingTable, setAddToExistingTable] = useState(false);
  const [addFileTableKey, setAddFileTableKey] = useState("");
  const [addFileCategoryId, setAddFileCategoryId] = useState("");
  const [editFileError, setEditFileError] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState("");
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

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
            <p className="text-xs text-muted-foreground">Changes here apply to every school. Drag to reorder; renaming updates every school.</p>
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
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input key={String(!!category.hasCount)} type="checkbox" name="hasCount" defaultChecked={!!category.hasCount} />
                      Show a Count column for this category
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

        <div className="space-y-2">
          {taskTables.length > 0 && (
            <div className="flex gap-1">
              <Button type="button" size="xs" variant={addToExistingTable ? "outline" : "default"} onClick={() => { setAddToExistingTable(false); setAddFileTableKey(""); }}>New category</Button>
              <Button type="button" size="xs" variant={addToExistingTable ? "default" : "outline"} onClick={() => setAddToExistingTable(true)}>Existing table</Button>
            </div>
          )}
          <form action={(formData) => submitTaskFileForm(props.addTask, formData, setAddFileError, () => setNewFileName(""))} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input type="hidden" name="schoolId" value={schoolId} />
            <div className="flex min-w-56 flex-1 flex-wrap gap-2">
              {addToExistingTable ? (
                <>
                  {taskTables.find((group) => group.key === addFileTableKey)?.categories.map((category) => (
                    <input key={category.id} type="hidden" name="categoryIds" value={category.id} />
                  ))}
                  <Dropdown
                    name="tableKey"
                    value={addFileTableKey}
                    onChange={setAddFileTableKey}
                    placeholder="Choose a table"
                    options={taskTables.map((group) => ({ value: group.key, label: `${group.categories.map((c) => c.name).join(" + ")} (${group.files.length} file${group.files.length === 1 ? "" : "s"})` }))}
                    className={ADD_FILE_PICKER_CLASS}
                  />
                </>
              ) : (
                <Dropdown
                  name="categoryIds"
                  value={addFileCategoryId}
                  onChange={setAddFileCategoryId}
                  placeholder="Choose a category"
                  options={orderedCategories.map((category) => ({ value: category.id, label: category.name.trim() || "(Unnamed category)" }))}
                  className={ADD_FILE_PICKER_CLASS}
                />
              )}
            </div>
            <Input name="fileName" placeholder="File name" required value={newFileName} onChange={(event) => setNewFileName(event.target.value)} className="w-full sm:max-w-md sm:flex-1" />
            <SubmitButton pendingLabel="Adding…" disabled={addToExistingTable ? !addFileTableKey : !addFileCategoryId}>Add</SubmitButton>
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
          return (
          <div key={group.key} className="rounded-md border">
            <button
              type="button"
              onClick={() => toggleTableCollapsed(group.key)}
              aria-expanded={!collapsed}
              className="flex w-full items-center gap-1.5 bg-muted/40 px-3 py-1.5 text-left text-sm font-semibold hover:bg-muted/60"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{group.categories.map((c) => c.name).join(" + ")}</span>
              <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">{group.files.length} file{group.files.length === 1 ? "" : "s"}</span>
            </button>
            {!collapsed && (
            <>
            <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm" style={{minWidth: layout.minWidth}}>
              <colgroup>{columns.map((column, index) => <col key={column.kind === "task" ? `task:${column.category.id}` : column.kind} style={{width: layout.columnWidths[index]}} />)}</colgroup>
              {/* Category header cells get their own bg-title-background
                  (the same token used for every other section heading
                  in this app, e.g. "Other Contacts" -- already
                  theme-aware, no separate dark: override needed)
                  layered OVER the row's own bg-muted/40, alternating
                  full strength / 60% opacity per category column so
                  adjacent categories read as their own distinctly
                  colored band next to the plainer Count/File name
                  headers beside them. */}
              <thead><tr className="border-b bg-muted/40">{columns.map((column, index) => <th key={column.kind === "task" ? `task:${column.category.id}` : column.kind} className={`py-2 break-words ${column.kind === "task" ? `px-4 text-center text-sm font-bold ${columns.slice(0, index + 1).filter((c) => c.kind === "task").length % 2 === 1 ? "bg-title-background" : "bg-title-background/60"} ${dividerClass(index)}` : "px-2 text-left font-medium"}`}>{column.kind === "file" ? "File name" : column.kind === "count" ? "Count" : column.kind === "remove" ? <span className="sr-only">Remove file</span> : column.category.name}</th>)}</tr></thead>
              <tbody>
                {group.files.map((file, fileIndex) => (
                  <tr key={file.id} className="border-b last:border-b-0 hover:bg-row-hover">
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
                        return <td key={`${column.kind}:${category.id}`} className={`px-4 py-2 align-top ${dividerClass(index)}`}>
                          {assignment ? <AssignmentCell schoolId={schoolId} assignment={assignment} vas={vas} categories={orderedCategories} currentUserName={currentUserName} canEdit={canEdit} actions={props} /> : null}
                        </td>;
                      }
                      return <td key="file" className="px-2 py-2 align-top">
                      <div className="flex min-h-7 min-w-0 items-center gap-1">
                        {canEdit && (
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
                        ) : <><span className="font-bold break-words" style={{minWidth: 0, overflowWrap: "anywhere"}}>{file.fileName}</span>{canEdit && <Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60" aria-label={`Edit ${file.fileName}`} onClick={() => { setEditingFileId(file.id); setEditedFileName(file.fileName); setEditFileError(null); }}><Pencil className="h-3 w-3" /></Button>}</>}
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
