"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SignatureChip } from "@/components/signature-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vaColorByName, type ChecklistTemplateItem, type ChecklistProgressEntry, type Va } from "@/lib/app-state";

export function ChecklistCard({
  schoolId,
  template,
  progress,
  vas,
  toggleChecklistItem,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
}: {
  schoolId: string;
  template: ChecklistTemplateItem[];
  /* Keyed by item id (already scoped to this school by the caller) --
     status plus who last checked it off, since anyone on the team can
     now do so, not just the assigned VA. */
  progress: Record<string, ChecklistProgressEntry>;
  vas: Va[];
  toggleChecklistItem: (formData: FormData) => void;
  addChecklistTemplateItem: (formData: FormData) => void;
  removeChecklistTemplateItem: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const doneCount = template.filter((t) => progress[t.id]?.status === "Done").length;

  return (
    <div className={`rounded-md border ${hidden ? "w-fit" : "min-w-0 flex-1 basis-0"}`}>
      <div className="flex items-center justify-between gap-2 border-b bg-header-background p-3">
        <h2 className="font-semibold whitespace-nowrap">
          Yearly Checklist {template.length > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{doneCount}/{template.length}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {!hidden && (
            <Button type="button" variant="link" size="sm" onClick={() => setEditorOpen((o) => !o)}>
              {editorOpen ? "Close editor" : "Edit template"}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setHidden((h) => !h)}>
            {hidden ? "Show" : "Hide"}
          </Button>
        </div>
      </div>
      {!hidden && (
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
            const entry = progress[item.id];
            const done = entry?.status === "Done";
            return (
              <form key={item.id} action={toggleChecklistItem} className="flex items-center gap-2">
                <input type="hidden" name="schoolId" value={schoolId} />
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton pendingLabel="…" variant={done ? "default" : "outline"}>
                  {done ? "✓" : " "}
                </SubmitButton>
                <span className="text-sm">{item.description}</span>
                {done && entry?.checkedBy && (
                  <SignatureChip name={entry.checkedBy} color={vaColorByName(vas, entry.checkedBy)} small />
                )}
              </form>
            );
          })}
        </div>
      )}
    </div>
  );
}
