"use client";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { TONE_CLASSES, type StatusTone } from "@/components/status-badge";
import { StatusSelect } from "@/components/status-select";
import { Dropdown } from "@/components/dropdown";
import { SignatureChip } from "@/components/signature-chip";
import { Input } from "@/components/ui/input";
import {
  GENERAL_TASK_CATEGORIES,
  TASK_STATUS_OPTIONS,
  vaColorByName,
  type GeneralTask,
  type Va,
} from "@/lib/app-state";

const STATUS_TONE: Record<string, StatusTone> = {
  "In Progress": "warning",
  Paused: "paused",
  Completed: "success",
};

function GeneralTaskRow({
  task,
  vas,
  currentUserName,
  setGeneralTaskStatus,
  signGeneralTask,
  removeVaFromGeneralTask,
  removeGeneralTask,
}: {
  task: GeneralTask;
  vas: Va[];
  currentUserName: string;
  setGeneralTaskStatus: (formData: FormData) => void;
  signGeneralTask: (formData: FormData) => void;
  removeVaFromGeneralTask: (formData: FormData) => void;
  removeGeneralTask: (formData: FormData) => void;
}) {
  const iSigned = task.vaAssigned.includes(currentUserName);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-record-background px-1 py-1">
      <span className="min-w-40 flex-1 text-sm font-bold break-words">{task.description}</span>
      <span className="text-xs text-muted-foreground">{task.category}</span>

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

        <form action={removeGeneralTask}>
          <input type="hidden" name="taskId" value={task.id} />
          <ConfirmDeleteButton confirmMessage={`Remove "${task.description}"?`} pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
        </form>
      </div>
    </div>
  );
}

/* Work that isn't tied to any school -- Admin, Training, Team Meeting,
   Payroll, etc. Same look as a school's own Tasks card
   (components/tasks-card.tsx), just without a schoolId, count, or
   Communications sub-status, none of which apply to non-school work. */
export function GeneralTasksList({
  tasks,
  vas,
  currentUserName,
  addGeneralTask,
  setGeneralTaskStatus,
  signGeneralTask,
  removeVaFromGeneralTask,
  removeGeneralTask,
}: {
  tasks: GeneralTask[];
  vas: Va[];
  currentUserName: string;
  addGeneralTask: (formData: FormData) => void;
  setGeneralTaskStatus: (formData: FormData) => void;
  signGeneralTask: (formData: FormData) => void;
  removeVaFromGeneralTask: (formData: FormData) => void;
  removeGeneralTask: (formData: FormData) => void;
}) {
  const openCount = tasks.filter((t) => t.status === "In Progress").length;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold">
          Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-white/70">{openCount}</span>}
        </h2>
      </div>
      <div className="space-y-3 p-3">
        <form action={addGeneralTask} className="flex flex-wrap items-center gap-2">
          <Dropdown
            name="category"
            defaultValue={GENERAL_TASK_CATEGORIES[0]}
            options={GENERAL_TASK_CATEGORIES.map((c) => ({ value: c, label: c }))}
            className="rounded-md border px-2 py-1.5 text-left text-sm"
          />
          <Input name="description" placeholder="What are you working on?" required className="min-w-0 flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No general tasks yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {[...tasks].reverse().map((task) => (
              <GeneralTaskRow
                key={task.id}
                task={task}
                vas={vas}
                currentUserName={currentUserName}
                setGeneralTaskStatus={setGeneralTaskStatus}
                signGeneralTask={signGeneralTask}
                removeVaFromGeneralTask={removeVaFromGeneralTask}
                removeGeneralTask={removeGeneralTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
