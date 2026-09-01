"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_STATUS_OPTIONS, COUNT_CATEGORIES, type Task, type TaskCategory } from "@/lib/app-state";

function TaskRow({
  schoolId,
  task,
  canEdit,
  currentUserName,
  setTaskStatus,
  setTaskCount,
  signTask,
  removeVaFromTask,
  removeTask,
}: {
  schoolId: string;
  task: Task;
  canEdit: boolean;
  currentUserName: string;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
}) {
  const needsCount = COUNT_CATEGORIES.includes(task.category);
  const iSigned = task.vaAssigned.includes(currentUserName);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <span className="font-mono text-sm">{task.fileName}</span>

      {needsCount && (
        <AutoSubmitForm action={setTaskCount} className="flex items-center gap-1">
          <input type="hidden" name="schoolId" value={schoolId} />
          <input type="hidden" name="taskId" value={task.id} />
          <span className="text-xs text-muted-foreground">Count</span>
          <input
            key={task.count || ""}
            type="number"
            min={0}
            name="count"
            defaultValue={task.count || ""}
            placeholder="0"
            disabled={!canEdit}
            className="w-16 rounded-md border px-2 py-1 text-sm"
          />
        </AutoSubmitForm>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {task.vaAssigned.map((name) => (
          <form key={name} action={removeVaFromTask} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="vaName" value={name} />
            <span>{name}</span>
            <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
          </form>
        ))}
        {!iSigned && (
          <form action={signTask}>
            <input type="hidden" name="schoolId" value={schoolId} />
            <input type="hidden" name="taskId" value={task.id} />
            <SubmitButton pendingLabel="…" variant="outline" size="sm">+ Sign</SubmitButton>
          </form>
        )}
      </div>

      <AutoSubmitForm action={setTaskStatus}>
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="taskId" value={task.id} />
        <select
          key={task.status}
          name="status"
          defaultValue={task.status}
          disabled={!canEdit}
          className="rounded-md border px-2 py-1 text-xs"
        >
          {TASK_STATUS_OPTIONS.map((s) => (
            <option key={s || "none"} value={s}>{s || "—"}</option>
          ))}
        </select>
      </AutoSubmitForm>

      {canEdit && (
        <form action={removeTask}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <input type="hidden" name="taskId" value={task.id} />
          <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function TasksCard({
  schoolId,
  categories,
  tasks,
  canEdit,
  currentUserName,
  addTask,
  setTaskStatus,
  setTaskCount,
  signTask,
  removeVaFromTask,
  removeTask,
  addTaskCategory,
  removeTaskCategory,
}: {
  schoolId: string;
  categories: TaskCategory[];
  tasks: Task[];
  canEdit: boolean;
  currentUserName: string;
  addTask: (formData: FormData) => void;
  setTaskStatus: (formData: FormData) => void;
  setTaskCount: (formData: FormData) => void;
  signTask: (formData: FormData) => void;
  removeVaFromTask: (formData: FormData) => void;
  removeTask: (formData: FormData) => void;
  addTaskCategory: (formData: FormData) => void;
  removeTaskCategory: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const catNames = categories.map((c) => c.name);
  const openCount = tasks.filter((t) => t.status !== "Completed").length;

  const rowProps = { schoolId, canEdit, currentUserName, setTaskStatus, setTaskCount, signTask, removeVaFromTask, removeTask };

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="font-semibold">
          Tasks {openCount > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{openCount}</span>}
        </h2>
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
                  <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
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
          <Input name="fileName" placeholder="File name, e.g. Q3-enrollment-report.xlsx" required className="max-w-md flex-1 font-mono" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>

        {categories.map((c) => {
          const items = tasks.filter((t) => t.category === c.name);
          const total = COUNT_CATEGORIES.includes(c.name) ? items.reduce((sum, t) => sum + (parseInt(t.count || "0", 10) || 0), 0) : null;
          return (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{c.name}</span>
                {total !== null && items.length > 0 && <span className="text-xs text-muted-foreground">Total: {total}</span>}
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files yet in this category.</p>
              ) : (
                items.map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)
              )}
            </div>
          );
        })}

        {tasks.some((t) => !catNames.includes(t.category)) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Other</div>
            {tasks.filter((t) => !catNames.includes(t.category)).map((t) => <TaskRow key={t.id} task={t} {...rowProps} />)}
          </div>
        )}
      </div>
    </div>
  );
}
