"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { selectedCategoryFiles, submitTaskFileForm, type TaskFileActionResult } from "@/lib/shared-task-files";
import type { TaskCategory, TaskFile } from "@/lib/app-state";

export function TaskTableCategoryPicker({ schoolId, tableId, files, categories, action }: {
  schoolId: string; tableId: string; files: TaskFile[]; categories: TaskCategory[];
  action: (formData: FormData) => Promise<TaskFileActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const available = categories.filter(category => files.some(file => !file.categories.some(a => a.categoryId === category.id)));
  const eligible = files.filter(file => !file.categories.some(a => a.categoryId === categoryId));
  return <div className="border-t px-2 py-1">
    <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" aria-expanded={open} onClick={() => {setOpen(!open); setError(null); setCategoryId(""); setSelectedIds([]);}}><Plus className="h-3 w-3" /> Add category</Button>
    {open && <form action={async formData => {
      try {
        const selected = selectedCategoryFiles(files, selectedIds, categoryId);
        if (!categoryId || selected.length === 0) {setError("Choose a category and select at least one file."); return;}
        formData.delete("fileIds");
        selected.forEach(file => formData.append("fileIds", file.id));
        await submitTaskFileForm(action, formData, setError, () => {setOpen(false); setSelectedIds([]); setCategoryId("");});
      } catch {setError("File selection has changed. Please close and reopen the picker.");}
    }} className="space-y-2 py-2">
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="tableId" value={tableId} />
      <Dropdown name="categoryId" value={categoryId} onChange={value => {setCategoryId(value); setSelectedIds([]); setError(null);}} placeholder="Choose category" options={available.map(c => ({value:c.id,label:c.name}))} />
      {categoryId && <fieldset className="max-h-48 space-y-1 overflow-y-auto">
        <legend className="mb-1 text-xs text-muted-foreground">Select files for this category</legend>
        {eligible.map(file => <label key={file.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="fileIds" value={file.id} checked={selectedIds.includes(file.id)} onChange={event => setSelectedIds(ids => event.target.checked ? [...ids,file.id] : ids.filter(id => id !== file.id))} />
          <span className="break-words">{file.fileName}</span>
        </label>)}
      </fieldset>}
      {available.length === 0 && <p className="text-xs text-muted-foreground">Every category is already assigned to these files.</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2"><SubmitButton size="xs" pendingLabel="Adding…" disabled={!categoryId || selectedIds.length === 0}>Add to selected files</SubmitButton><Button type="button" variant="ghost" size="xs" onClick={() => {setOpen(false); setSelectedIds([]); setCategoryId("");}}>Cancel</Button></div>
    </form>}
  </div>;
}
