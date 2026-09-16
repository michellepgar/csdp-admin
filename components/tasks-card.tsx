"use client";

import { useEffect, useState } from "react";
import { GripVertical, Pencil, Plus, X } from "lucide-react";
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
import { groupTaskTables, taskTableColumns, submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
import {
  TASK_STATUS_OPTIONS,
  COUNT_CATEGORIES,
  CATEGORIES_WITH_COMMUNICATIONS,
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

function SignAndStatus({ schoolId, assignment, vas, currentUserName, canEdit, signTask, removeVaFromTask, setTaskStatus }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  currentUserName: string;
  canEdit: boolean;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  setTaskStatus: (formData: FormData) => void;
}) {
  const iSigned = assignment.vaAssigned.includes(currentUserName);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {assignment.vaAssigned.map((name) => (
          <form key={name} action={removeVaFromTask} className="inline-flex items-center gap-1">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={assignment.id} />
            <input type="hidden" name="vaName" value={name} />
            <SignatureChip name={name} color={vaColorByName(vas, name)} small />
            <ConfirmDeleteButton confirmMessage={`Remove ${name}'s signature?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
          </form>
        ))}
        {!iSigned && (
          <form action={signTask}>
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={assignment.id} />
            <SubmitButton pendingLabel="…" variant="outline" size="xs">+ Sign</SubmitButton>
          </form>
        )}
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
    </div>
  );
}

function AssignmentCell({ schoolId, assignment, vas, currentUserName, canEdit, actions }: {
  schoolId: string;
  assignment: TaskFileCategory;
  vas: Va[];
  currentUserName: string;
  canEdit: boolean;
  actions: Pick<TasksCardProps, "setTaskStatus" | "setTaskCount" | "signTask" | "removeVaFromTask" | "setCommsStatus" | "signComms" | "removeVaFromComms" | "removeTaskAssignment">;
}) {
  const hasComms = CATEGORIES_WITH_COMMUNICATIONS.includes(assignment.category);
  return (
    <div className="min-w-52 space-y-2">
      <div className="flex items-center gap-2">
        <SignAndStatus schoolId={schoolId} assignment={assignment} vas={vas} currentUserName={currentUserName} canEdit={canEdit} signTask={actions.signTask} removeVaFromTask={actions.removeVaFromTask} setTaskStatus={actions.setTaskStatus} />
        {canEdit && (
          <form action={actions.removeTaskAssignment} className="ml-auto">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={assignment.id} />
            <ConfirmDeleteButton confirmMessage={`Remove only the ${assignment.category} task from this file?`} pendingLabel="…" variant="ghost" size="icon-xs"><X className="h-3 w-3" /></ConfirmDeleteButton>
          </form>
        )}
      </div>
      {hasComms && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <span className="text-xs font-medium text-muted-foreground">Communications</span>
          <SignAndStatus
            schoolId={schoolId}
            assignment={{ ...assignment, vaAssigned: assignment.commsVaAssigned || [], status: assignment.commsStatus || "" }}
            vas={vas}
            currentUserName={currentUserName}
            canEdit={canEdit}
            signTask={actions.signComms}
            removeVaFromTask={actions.removeVaFromComms}
            setTaskStatus={actions.setCommsStatus}
          />
        </div>
      )}
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
  noRecheck: boolean;
  addTask: (formData: FormData) => Promise<TaskFileActionResult>;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
  removeTaskAssignment: (formData: FormData) => void;
  addTaskCategory: (formData: FormData) => void;
  removeTaskCategory: (formData: FormData) => void;
  setCommsStatus: (formData: FormData) => void;
  signComms: (formData: FormData) => void;
  removeVaFromComms: (formData: FormData) => void;
  setNoRecheck: (formData: FormData) => void;
  reorderTaskCategories: (orderedIds: string[]) => void;
  renameTaskCategory: (formData: FormData) => void;
  reorderTasks: (schoolId: string, orderedIds: string[]) => void;
  updateTaskFileName: (formData: FormData) => Promise<TaskFileActionResult>;
};

export function TasksCard(props: TasksCardProps) {
  const { schoolId, categories, taskFiles, vas, canEdit, currentUserName, noRecheck } = props;
  const [editorOpen, setEditorOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [orderedFiles, setOrderedFiles] = useState(taskFiles);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [categoryPickers, setCategoryPickers] = useState([0]);
  const [newFileName, setNewFileName] = useState("");
  const [addFileError, setAddFileError] = useState<string | null>(null);
  const [editFileError, setEditFileError] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState("");

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

  function dropFile(targetId: string) {
    if (!draggedFileId) return;
    const next = moveItem(orderedFiles, draggedFileId, targetId);
    setDraggedFileId(null);
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
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/60" />
                  {editingCategoryId === category.id ? (
                    <form action={props.renameTaskCategory} className="flex flex-1 items-center gap-1">
                      <input type="hidden" name="id" value={category.id} />
                      <Input name="name" defaultValue={category.name} required autoFocus className="h-7" />
                      <SubmitButton pendingLabel="Saving…" size="xs" onClick={() => setEditingCategoryId(null)}>Save</SubmitButton>
                      <Button type="button" variant="ghost" size="xs" onClick={() => setEditingCategoryId(null)}>Cancel</Button>
                    </form>
                  ) : <><span>{category.name}</span><Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60" aria-label={`Edit ${category.name}`} onClick={() => setEditingCategoryId(category.id)}><Pencil className="h-3 w-3" /></Button></>}
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

        <form action={(formData) => submitTaskFileForm(props.addTask, formData, setAddFileError, () => setNewFileName(""))} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input type="hidden" name="schoolId" value={schoolId} />
          <div className="flex min-w-56 flex-1 flex-wrap gap-2">
            {categoryPickers.map((picker, index) => (
              <div key={picker} className="flex items-center gap-1">
                <Dropdown name="categoryIds" defaultValue={orderedCategories[Math.min(index, orderedCategories.length - 1)]?.id} options={orderedCategories.map((category) => ({ value: category.id, label: category.name }))} className="max-w-72 truncate rounded-md border px-2 py-1.5 text-left text-sm" />
                {index > 0 && <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove category selection" onClick={() => setCategoryPickers((items) => items.filter((item) => item !== picker))}><X className="h-3 w-3" /></Button>}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryPickers((items) => [...items, Math.max(...items) + 1])}><Plus className="h-3.5 w-3.5" /> Add category</Button>
          </div>
          <Input name="fileName" placeholder="File name" required value={newFileName} onChange={(event) => setNewFileName(event.target.value)} className="w-full sm:max-w-md sm:flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
        {addFileError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addFileError}</p>}

        {orderedFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files yet.</p>
        ) : taskTables.map((group) => {
          const columns = taskTableColumns(group.categories, COUNT_CATEGORIES);
          const countColumnTotal = columns.filter((column) => column.kind === "count").length;
          return (
          <div key={group.key} className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead><tr className="border-b bg-muted/40">{columns.map((column) => <th key={column.kind === "file" ? "file" : `${column.kind}:${column.category.id}`} className="px-2 py-2 text-left font-medium">{column.kind === "file" ? "File name" : column.kind === "count" ? (countColumnTotal === 1 ? "Count" : `${column.category.name} count`) : <>{column.category.name}{column.category.name === "Follow up" && <form action={props.setNoRecheck} className="mt-1"><input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="noRecheck" value={noRecheck ? "false" : "true"} /><SubmitButton pendingLabel="…" variant="ghost" size="xs">{noRecheck ? "Undo no follow up" : "No follow up"}</SubmitButton></form>}</>}</th>)}</tr></thead>
              <tbody>
                {group.files.map((file) => (
                  <tr key={file.id} draggable={canEdit} onDragStart={() => setDraggedFileId(file.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropFile(file.id)} onDragEnd={() => setDraggedFileId(null)} className={`border-b last:border-b-0 ${draggedFileId === file.id ? "opacity-40" : ""}`}>
                    {columns.map((column) => {
                      if (column.kind !== "file") {
                        const category = column.category;
                        const assignment = file.categories.find((item) => item.categoryId === category.id);
                        const editable = canEdit && !(category.name === "Follow up" && noRecheck);
                        return <td key={`${column.kind}:${category.id}`} className={`px-2 py-2 align-top ${category.name === "Follow up" && noRecheck ? "opacity-40" : ""}`}>
                          {assignment ? column.kind === "count" ? <AutoSubmitForm action={props.setTaskCount}>
                            <input type="hidden" name="schoolId" value={schoolId} />
                            <input type="hidden" name="taskId" value={assignment.id} />
                            <input key={assignment.count || ""} type="number" min={0} name="count" aria-label={`${category.name} count for ${file.fileName}`} defaultValue={assignment.count || ""} placeholder="0" disabled={!editable} className="w-14 rounded-md border px-1.5 py-0.5 text-sm" />
                          </AutoSubmitForm> : <AssignmentCell schoolId={schoolId} assignment={assignment} vas={vas} currentUserName={currentUserName} canEdit={editable} actions={props} /> : <span className="text-muted-foreground">—</span>}
                        </td>;
                      }
                      return <td key="file" className="px-2 py-2 align-top">
                      <div className="flex min-w-48 items-center gap-1">
                        {canEdit && <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/60" aria-label="Drag to reorder file" />}
                        {editingFileId === file.id ? (
                          <form action={(formData) => submitTaskFileForm(props.updateTaskFileName, formData, setEditFileError, () => setEditingFileId(null))} className="flex flex-wrap items-center gap-1">
                            <input type="hidden" name="schoolId" value={schoolId} /><input type="hidden" name="taskFileId" value={file.id} />
                            <Input name="fileName" value={editedFileName} onChange={(event) => setEditedFileName(event.target.value)} required autoFocus className="h-7 min-w-40" />
                            <SubmitButton pendingLabel="Saving…" size="xs">Save</SubmitButton><Button type="button" variant="ghost" size="xs" onClick={() => setEditingFileId(null)}>Cancel</Button>
                            {editFileError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{editFileError}</p>}
                          </form>
                        ) : <><span className="font-bold break-words">{file.fileName}</span>{canEdit && <Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60" aria-label={`Edit ${file.fileName}`} onClick={() => { setEditingFileId(file.id); setEditedFileName(file.fileName); setEditFileError(null); }}><Pencil className="h-3 w-3" /></Button>}<DeleteOrRequestControl canDelete={canEdit} idFieldName="taskFileId" schoolId={schoolId} targetId={file.id} label={`file "${file.fileName}" and all of its tasks`} removeAction={props.removeTask} /></>}
                      </div>
                    </td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ); })}
      </div>
    </div>
  );
}
