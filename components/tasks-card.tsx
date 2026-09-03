"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DeleteOrRequestControl } from "@/components/delete-or-request-control";
import { StatusBadge, TONE_CLASSES, TONE_OPTION_STYLE, type StatusTone } from "@/components/status-badge";
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

      <AutoSubmitForm action={setStatusAction}>
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="taskId" value={taskId} />
        {/* The dropdown itself carries the status color now (was
            previously paired with a separate read-only StatusBadge
            showing the same value again right next to it). */}
        <select
          key={status}
          name="status"
          defaultValue={status}
          disabled={!canEdit}
          className={`rounded-md border px-1.5 py-0.5 text-xs font-medium ${TONE_CLASSES[TASK_STATUS_TONE[status] ?? "neutral"]}`}
        >
          {TASK_STATUS_OPTIONS.map((s) => (
            <option key={s || "none"} value={s} style={TONE_OPTION_STYLE[TASK_STATUS_TONE[s] ?? "neutral"]}>{s || "—"}</option>
          ))}
        </select>
      </AutoSubmitForm>
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
}) {
  const needsCount = COUNT_CATEGORIES.includes(task.category);
  const hasComms = CATEGORIES_WITH_COMMUNICATIONS.includes(task.category);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-record-background px-1 py-1">
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

      <span className="min-w-40 flex-1 text-sm font-bold break-words">{task.fileName}</span>

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
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const catNames = categories.map((c) => c.name);
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
  };

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b bg-title-background p-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">
            Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{openCount}</span>}
          </h2>
          <StatusBadge tone="warning">{inProgressCount}</StatusBadge>
          <StatusBadge tone="paused">{pausedCount}</StatusBadge>
          <StatusBadge tone="success">{completedCount}</StatusBadge>
        </div>
        <Button type="button" variant="link" size="sm" onClick={() => setEditorOpen((o) => !o)}>
          {editorOpen ? "Close editor" : "Edit categories"}
        </Button>
      </div>
      <div className="space-y-3 p-3">
        {editorOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Editing this list changes the categories for every school. Existing files keep their category name even if it&apos;s later removed here.</p>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{c.name}</span>
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

        <form action={addTask} className="flex flex-wrap gap-2">
          <input type="hidden" name="schoolId" value={schoolId} />
          <select name="category" className="rounded-md border px-2 py-1.5 text-sm">
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <Input name="fileName" placeholder="File name, e.g. Q3-enrollment-report.xlsx" required className="max-w-md flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        {categories.map((c) => {
          const items = tasks.filter((t) => t.category === c.name);
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
                  {items.map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
                </div>
              )}
            </div>
          );
        })}

        {tasks.some((t) => !catNames.includes(t.category)) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Other</div>
            <div className="divide-y rounded-md border">
              {tasks.filter((t) => !catNames.includes(t.category)).map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
