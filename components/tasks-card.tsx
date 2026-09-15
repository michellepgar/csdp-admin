"use client";

import { useEffect, useState } from "react";
import { GripVertical, Pencil } from "lucide-react";
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
import {
  TASK_STATUS_OPTIONS,
  COUNT_CATEGORIES,
  CATEGORIES_WITH_COMMUNICATIONS,
  vaColorByName,
  type Task,
  type TaskCategory,
  type Va,
} from "@/lib/app-state";

const TASK_STATUS_TONE: Record<string, StatusTone> = {
  "In Progress": "warning",
  Paused: "paused",
  Completed: "success",
};

/* Shared by both the main status/signatures and the Communications
   status/signatures on an Initial/Recheck row -- same controls, just
   pointed at different fields/actions. */
function SignAndStatus({
  schoolId,
  taskId,
  vas,
  vaAssigned,
  status,
  currentUserName,
  canEdit,
  signAction,
  removeVaAction,
  setStatusAction,
}: {
  schoolId: string;
  taskId: string;
  vas: Va[];
  vaAssigned: string[];
  status: string;
  currentUserName: string;
  canEdit: boolean;
  signAction: (formData: FormData) => void;
  removeVaAction: (formData: FormData) => void;
  setStatusAction: (formData: FormData) => void;
}) {
  const iSigned = vaAssigned.includes(currentUserName);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {vaAssigned.map((name) => (
          <form key={name} action={removeVaAction} className="inline-flex items-center gap-1">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="vaName" value={name} />
            <SignatureChip name={name} color={vaColorByName(vas, name)} small />
            <ConfirmDeleteButton confirmMessage={`Remove ${name}'s signature?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
          </form>
        ))}
        {!iSigned && (
          <form action={signAction}>
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={taskId} />
            <SubmitButton pendingLabel="…" variant="outline" size="xs">+ Sign</SubmitButton>
          </form>
        )}
      </div>

      <StatusSelect
        action={setStatusAction}
        hiddenFields={{ schoolId, taskId }}
        value={status}
        options={TASK_STATUS_OPTIONS.map((s) => ({ value: s, label: s || "—" }))}
        toneClassName={TONE_CLASSES[TASK_STATUS_TONE[status] ?? "neutral"]}
        optionToneClassName={(v) => TONE_CLASSES[TASK_STATUS_TONE[v] ?? "neutral"]}
        disabled={!canEdit}
      />
    </div>
  );
}

function TaskRow({
  schoolId,
  task,
  vas,
  canEdit,
  currentUserName,
  setTaskStatus,
  setTaskCount,
  signTask,
  removeVaFromTask,
  removeTask,
  setCommsStatus,
  signComms,
  removeVaFromComms,
  updateTaskFileName,
  draggable,
  dragged,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  schoolId: string;
  task: Task;
  vas: Va[];
  canEdit: boolean;
  currentUserName: string;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
  setCommsStatus: (formData: FormData) => void;
  signComms: (formData: FormData) => void;
  removeVaFromComms: (formData: FormData) => void;
  updateTaskFileName: (formData: FormData) => void;
  draggable: boolean;
  dragged: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const needsCount = COUNT_CATEGORIES.includes(task.category);
  const hasComms = CATEGORIES_WITH_COMMUNICATIONS.includes(task.category);
  const [editingFileName, setEditingFileName] = useState(false);

  return (
    <div draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} className={`flex flex-wrap items-center gap-3 bg-record-background px-1 py-1 ${dragged ? "opacity-40" : ""}`}>
      {/* Count comes first (fixed width, so it lines up row to row),
          then the file name gets whatever space is left and wraps
          rather than truncating -- file names run long sometimes.
          Sign/status is pushed to the far right (ml-auto) regardless
          of how much room the name actually takes. */}
      <div className="flex w-14 shrink-0 items-center gap-1">
        {needsCount && (
          <AutoSubmitForm action={setTaskCount} className="flex items-center gap-1">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={task.id} />
            <input
              key={task.count || ""}
              type="number"
              min={0}
              name="count"
              defaultValue={task.count || ""}
              placeholder="0"
              disabled={!canEdit}
              className="w-14 rounded-md border px-1.5 py-0.5 text-sm"
            />
          </AutoSubmitForm>
        )}
      </div>

      <div className="flex min-w-40 flex-1 items-center gap-0.5">
        {draggable && <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing" aria-label="Drag to reorder task" />}
        {editingFileName ? (
          <form action={updateTaskFileName} className="flex flex-1 items-center gap-1">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={task.id} />
            <Input name="fileName" defaultValue={task.fileName} required autoFocus className="h-7 min-w-0 flex-1" />
            <SubmitButton pendingLabel="Saving…" size="xs" onClick={() => setEditingFileName(false)}>Save</SubmitButton>
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditingFileName(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-sm font-bold break-words">{task.fileName}</span>
            {canEdit && <Button type="button" variant="ghost" size="icon-xs" className="ml-1 text-muted-foreground/60 hover:text-muted-foreground" aria-label={`Edit ${task.fileName}`} onClick={() => setEditingFileName(true)}><Pencil className="h-3 w-3" /></Button>}
          </>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-4">
        <SignAndStatus
          schoolId={schoolId}
          taskId={task.id}
          vas={vas}
          vaAssigned={task.vaAssigned}
          status={task.status}
          currentUserName={currentUserName}
          canEdit={canEdit}
          signAction={signTask}
          removeVaAction={removeVaFromTask}
          setStatusAction={setTaskStatus}
        />

        {hasComms && (
          <div className="flex flex-wrap items-center gap-2 border-l pl-4">
            <span className="text-sm font-medium text-muted-foreground">Communications</span>
            <SignAndStatus
              schoolId={schoolId}
              taskId={task.id}
              vas={vas}
              vaAssigned={task.commsVaAssigned || []}
              status={task.commsStatus || ""}
              currentUserName={currentUserName}
              canEdit={canEdit}
              signAction={signComms}
              removeVaAction={removeVaFromComms}
              setStatusAction={setCommsStatus}
            />
          </div>
        )}

        <DeleteOrRequestControl
          canDelete={canEdit}
          idFieldName="taskId"
          schoolId={schoolId}
          targetId={task.id}
          label={`task "${task.fileName}"`}
          removeAction={removeTask}
        />
      </div>
    </div>
  );
}

export function TasksCard({
  schoolId,
  categories,
  tasks,
  vas,
  canEdit,
  currentUserName,
  noRecheck,
  addTask,
  setTaskStatus,
  setTaskCount,
  signTask,
  removeVaFromTask,
  removeTask,
  addTaskCategory,
  removeTaskCategory,
  setCommsStatus,
  signComms,
  removeVaFromComms,
  setNoRecheck,
  reorderTaskCategories,
  renameTaskCategory,
  reorderTasks,
  updateTaskFileName,
}: {
  schoolId: string;
  categories: TaskCategory[];
  tasks: Task[];
  vas: Va[];
  canEdit: boolean;
  currentUserName: string;
  noRecheck: boolean;
  addTask: (formData: FormData) => void;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
  addTaskCategory: (formData: FormData) => void;
  removeTaskCategory: (formData: FormData) => void;
  setCommsStatus: (formData: FormData) => void;
  signComms: (formData: FormData) => void;
  removeVaFromComms: (formData: FormData) => void;
  setNoRecheck: (formData: FormData) => void;
  reorderTaskCategories: (orderedIds: string[]) => void;
  renameTaskCategory: (formData: FormData) => void;
  reorderTasks: (schoolId: string, category: string, orderedIds: string[]) => void;
  updateTaskFileName: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState(categories);
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  useEffect(() => setOrderedCategories(categories), [categories]);
  useEffect(() => setOrderedTasks(tasks), [tasks]);
  const catNames = orderedCategories.map((c) => c.name);
  const openCount = tasks.filter((t) => t.status !== "Completed").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const pausedCount = tasks.filter((t) => t.status === "Paused").length;
  const completedCount = tasks.filter((t) => t.status === "Completed").length;

  const rowProps = {
    schoolId,
    vas,
    canEdit,
    currentUserName,
    setTaskStatus,
    setTaskCount,
    signTask,
    removeVaFromTask,
    removeTask,
    setCommsStatus,
    signComms,
    removeVaFromComms,
    updateTaskFileName,
  };

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
    reorderTaskCategories(next.map((category) => category.id));
  }

  function dropTask(category: string, targetId: string) {
    if (!draggedTaskId) return;
    const categoryTasks = orderedTasks.filter((task) => task.category === category);
    const nextCategoryTasks = moveItem(categoryTasks, draggedTaskId, targetId);
    setDraggedTaskId(null);
    if (!nextCategoryTasks) return;
    const ranks = new Map(nextCategoryTasks.map((task, index) => [task.id, index]));
    setOrderedTasks((current) => current.map((task) => ranks.has(task.id) ? { ...task, sortOrder: ranks.get(task.id)! } : task));
    reorderTasks(schoolId, category, nextCategoryTasks.map((task) => task.id));
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-header-background px-3 py-1 text-white">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">
            Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-white/70">{openCount}</span>}
          </h2>
          <StatusBadge tone="warning">{inProgressCount}</StatusBadge>
          <StatusBadge tone="paused">{pausedCount}</StatusBadge>
          <StatusBadge tone="success">{completedCount}</StatusBadge>
        </div>
        <Button type="button" variant="link" size="sm" className="text-white" onClick={() => setEditorOpen((o) => !o)}>
          {editorOpen ? "Close editor" : "Edit categories"}
        </Button>
      </div>
      <div className="space-y-3 p-3">
        {editorOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Changes here apply to every school. Drag by the handle to reorder; renaming also updates existing files.</p>
            {orderedCategories.map((c) => (
              <div key={c.id} draggable onDragStart={() => setDraggedCategoryId(c.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCategory(c.id)} onDragEnd={() => setDraggedCategoryId(null)} className={`flex items-center justify-between gap-2 rounded-md text-sm ${draggedCategoryId === c.id ? "opacity-40" : ""}`}>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing" />
                  {editingCategoryId === c.id ? (
                    <form action={renameTaskCategory} className="flex flex-1 items-center gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <Input name="name" defaultValue={c.name} required autoFocus className="h-7" />
                      <SubmitButton pendingLabel="Saving…" size="xs" onClick={() => setEditingCategoryId(null)}>Save</SubmitButton>
                      <Button type="button" variant="ghost" size="xs" onClick={() => setEditingCategoryId(null)}>Cancel</Button>
                    </form>
                  ) : <><span>{c.name}</span><Button type="button" variant="ghost" size="icon-xs" className="-ml-0.5 text-muted-foreground/60 hover:text-muted-foreground" aria-label={`Edit ${c.name}`} onClick={() => setEditingCategoryId(c.id)}><Pencil className="h-3 w-3" /></Button></>}
                </div>
                <form action={removeTaskCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmDeleteButton confirmMessage={`Remove the "${c.name}" category? Existing files keep this category name.`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                </form>
              </div>
            ))}
            <form action={addTaskCategory} className="flex gap-2">
              <Input name="name" placeholder="New category" required />
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
            </form>
          </div>
        )}

        {/* flex-col on mobile, flex-row from sm up -- the Dropdown's own
            button sizes to fit its label text (no width cap), and a
            long category name ("Encoding & Uploading (Consent & SDF)")
            is on its own wider than a phone screen. Side by side in a
            flex-wrap row, that pushed the file name input almost
            entirely off-screen instead of onto its own line, so typing
            into it scrolled the caret out of view with no way to see
            what was actually being typed. Stacking full-width on
            mobile (w-full sm:w-auto on each field) avoids that
            entirely; sm and up keeps the original side-by-side row. */}
        <form action={addTask} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input type="hidden" name="schoolId" value={schoolId} />
          <Dropdown
            name="category"
            defaultValue={categories[0]?.name}
            options={orderedCategories.map((c) => ({ value: c.name, label: c.name }))}
            className="w-full truncate rounded-md border px-2 py-1.5 text-left text-sm sm:w-auto"
          />
          <Input name="fileName" placeholder="File name" required className="w-full sm:max-w-md sm:flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        {orderedCategories.map((c) => {
          const items = orderedTasks.filter((t) => t.category === c.name).sort((a, b) => a.sortOrder - b.sortOrder);
          const total = COUNT_CATEGORIES.includes(c.name) ? items.reduce((sum, t) => sum + (parseInt(t.count || "0", 10) || 0), 0) : null;
          const isFollowUp = c.name === "Follow up";
          return (
            <div key={c.id} className={`space-y-2 ${isFollowUp && noRecheck ? "opacity-40" : ""}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {total !== null && items.length > 0 && <span className="text-xs text-muted-foreground">Total: {total}</span>}
                <span>{c.name}</span>
                {isFollowUp && (
                  <form action={setNoRecheck} className="ml-auto">
                    <input type="hidden" name="schoolId" value={schoolId} />
                    <input type="hidden" name="noRecheck" value={noRecheck ? "false" : "true"} />
                    <SubmitButton pendingLabel="…" variant={noRecheck ? "default" : "outline"} size="sm" disabled={!canEdit}>
                      {noRecheck ? "Undo" : "No Follow up"}
                    </SubmitButton>
                  </form>
                )}
              </div>
              {isFollowUp && noRecheck ? (
                <p className="text-xs font-medium text-muted-foreground">No Follow up</p>
              ) : items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files yet in this category.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {items.map((t) => <TaskRow key={t.id} task={t} {...rowProps} draggable={canEdit} dragged={draggedTaskId === t.id} onDragStart={() => setDraggedTaskId(t.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropTask(c.name, t.id)} onDragEnd={() => setDraggedTaskId(null)} />)}
                </div>
              )}
            </div>
          );
        })}

        {tasks.some((t) => !catNames.includes(t.category)) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Other</div>
            <div className="divide-y rounded-md border">
              {orderedTasks.filter((t) => !catNames.includes(t.category)).sort((a, b) => a.sortOrder - b.sortOrder).map((t) => <TaskRow key={t.id} task={t} {...rowProps} draggable={false} dragged={false} onDragStart={() => {}} onDragOver={() => {}} onDrop={() => {}} onDragEnd={() => {}} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
