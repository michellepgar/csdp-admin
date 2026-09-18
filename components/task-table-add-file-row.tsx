"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";

/* A quick "type a name, hit Add" row scoped to one already-rendered
   table -- categoryIds is that table's own combination, pre-set and
   hidden, so adding a file here never requires picking a category.
   Reuses the same addTask action the top-of-card form uses; the only
   difference is which categoryIds get submitted. */
export function TaskTableAddFileRow({ schoolId, categoryIds, addTask }: {
  schoolId: string;
  categoryIds: string[];
  addTask: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="border-t px-2 py-1">
        <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setOpen(true)}><Plus className="h-3 w-3" /> Add file</Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => submitTaskFileForm(addTask, formData, setError, () => { setFileName(""); setOpen(false); })}
      className="flex items-center gap-2 border-t px-2 py-1.5"
    >
      <input type="hidden" name="schoolId" value={schoolId} />
      {categoryIds.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
      <Input name="fileName" placeholder="File name" required autoFocus value={fileName} onChange={(event) => setFileName(event.target.value)} className="h-7 max-w-xs" />
      <SubmitButton pendingLabel="Adding…" size="xs">Add</SubmitButton>
      <Button type="button" variant="ghost" size="xs" onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
