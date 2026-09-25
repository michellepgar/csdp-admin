"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";

/* A quick "type a name, hit Add" row scoped to one already-rendered
   table -- categoryIds is that table's own combination, pre-set and
   hidden, so adding a file here never requires picking a category.
   Reuses the same addTask action the top-of-card form uses; the only
   difference is which categoryIds get submitted.

   It stays open after each file, cleared and ready for the next name, so
   several files go in with just typing and Enter. Esc or Done closes it. */
export function TaskTableAddFileRow({ schoolId, tableId, categoryIds, addTask }: {
  schoolId: string;
  tableId: string;
  categoryIds: string[];
  addTask: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    setLastAdded(null);
    setFileName("");
  }

  if (!open) {
    return (
      <div className="border-t px-2 py-1">
        <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={() => setOpen(true)}><Plus className="h-3 w-3" /> Add file</Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        const added = String(formData.get("fileName") || "").trim();
        return submitTaskFileForm(addTask, formData, setError, () => {
          setFileName("");
          setLastAdded(added);
          // Ready for the next one.
          requestAnimationFrame(() => inputRef.current?.focus());
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      className="flex flex-wrap items-center gap-2 border-t px-2 py-1.5"
    >
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="tableId" value={tableId} />
      {categoryIds.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
      <Input ref={inputRef} name="fileName" placeholder="File name — press Enter to add" aria-label="New file name" required autoFocus value={fileName} onChange={(event) => { setFileName(event.target.value); setError(null); }} className="h-7 max-w-xs" />
      <SubmitButton pendingLabel="Adding…" size="xs">Add</SubmitButton>
      <Button type="button" variant="ghost" size="xs" onClick={close}>Done</Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : lastAdded ? (
        <p role="status" className="text-xs text-muted-foreground">Added “{lastAdded}” — type the next one, or Esc when you&apos;re done.</p>
      ) : null}
    </form>
  );
}
