"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChecklistTemplateItem } from "@/lib/app-state";

export function ChecklistCard({
  schoolId,
  template,
  doneIds,
  canCheckOff,
  vaAssigned,
  toggleChecklistItem,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
}: {
  schoolId: string;
  template: ChecklistTemplateItem[];
  doneIds: string[];
  canCheckOff: boolean;
  vaAssigned: string;
  toggleChecklistItem: (formData: FormData) => void;
  addChecklistTemplateItem: (formData: FormData) => void;
  removeChecklistTemplateItem: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const doneSet = new Set(doneIds);
  const doneCount = template.filter((t) => doneSet.has(t.id)).length;

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b bg-header-background p-3">
        <h2 className="font-semibold">
          Yearly Checklist {template.length > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{doneCount}/{template.length}</span>}
        </h2>
        <Button type="button" variant="link" size="sm" onClick={() => setEditorOpen((o) => !o)}>
          {editorOpen ? "Close editor" : "Edit template"}
        </Button>
      </div>
      <div className="space-y-3 p-3">
        {editorOpen && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Editing this list changes the checklist for every school.</p>
            {template.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{item.description}</span>
                <form action={removeChecklistTemplateItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
                </form>
              </div>
            ))}
            <form action={addChecklistTemplateItem} className="flex gap-2">
              <Input name="description" placeholder="New checklist item" required />
              <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
            </form>
          </div>
        )}

        {template.length === 0 && (
          <p className="text-sm text-muted-foreground">No checklist items yet — use &quot;Edit template&quot; to add the first one.</p>
        )}

        {template.map((item) => {
          const done = doneSet.has(item.id);
          return (
            <form key={item.id} action={toggleChecklistItem} className="flex items-center gap-2">
              <input type="hidden" name="schoolId" value={schoolId} />
              <input type="hidden" name="itemId" value={item.id} />
              <SubmitButton
                pendingLabel="…"
                variant={done ? "default" : "outline"}
                disabled={!canCheckOff}
                title={canCheckOff ? undefined : `Only ${vaAssigned || "the assigned VA"} can check this off`}
              >
                {done ? "✓" : " "}
              </SubmitButton>
              <span className="text-sm">{item.description}</span>
            </form>
          );
        })}
      </div>
    </div>
  );
}
