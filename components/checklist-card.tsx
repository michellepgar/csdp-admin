"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SignatureChip } from "@/components/signature-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoverLabel } from "@/components/hover-label";
import { vaColorByName, type ChecklistTemplateItem, type ChecklistProgressEntry, type Va } from "@/lib/app-state";

const COLLAPSED_COOKIE_NAME = "checklist-collapsed";

export function ChecklistCard({
  schoolId,
  template,
  progress,
  vas,
  initialHidden,
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
  /* Read server-side from the checklist-collapsed cookie by the
     caller (app/(app)/schools/[id]/page.tsx) and handed in as the
     starting value -- same reasoning as the sidebar's own
     initialCollapsed prop (components/sidebar-shell.tsx): seeding
     useState from a prop that already reflects the cookie avoids a
     flash of the wrong (expanded) state on first paint that a
     client-only localStorage read would cause. This is one shared
     preference, not scoped per school, matching how the sidebar's own
     collapse is a single app-wide setting rather than per-page. */
  initialHidden: boolean;
  toggleChecklistItem: (formData: FormData) => void;
  addChecklistTemplateItem: (formData: FormData) => void;
  removeChecklistTemplateItem: (formData: FormData) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [hidden, setHidden] = useState(initialHidden);
  const doneCount = template.filter((t) => progress[t.id]?.status === "Done").length;

  function setHiddenAndRemember(next: boolean) {
    setHidden(next);
    document.cookie = `${COLLAPSED_COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  /* Same collapse pattern as the sidebar (components/sidebar-shell.tsx):
     hidden means the whole panel disappears, replaced by a single small
     icon button to bring it back -- docked to the right (ml-auto) since
     this panel sits on the right side of the Tasks/Checklist row,
     mirroring how the sidebar's own collapsed button sits on the left. */
  if (hidden) {
    return (
      <HoverLabel label="Yearly Checklist" side="left" className="ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setHiddenAndRemember(false)}
          aria-label="Show Yearly Checklist"
          className="border bg-background"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </HoverLabel>
    );
  }

  return (
    // Sized to its own content (not a fixed 50/50 split with Tasks) --
    // a checklist with a handful of short items shouldn't claim half
    // the row's width. Tasks (flex-1 on its own wrapper in
    // schools/[id]/page.tsx) takes whatever this leaves. ml-auto docks
    // it to the row's right edge explicitly.
    <div className="ml-auto w-fit max-w-full rounded-md border bg-card sm:max-w-xs">
      <div className="flex items-center justify-between gap-2 border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold whitespace-nowrap">
          Yearly Checklist {template.length > 0 && <span className="ml-1 text-sm font-normal text-white/70">{doneCount}/{template.length}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <Button type="button" variant="link" size="sm" className="text-white" onClick={() => setEditorOpen((o) => !o)}>
            {editorOpen ? "Close editor" : "Edit template"}
          </Button>
          {/* No hover label here (unlike the collapsed Show button
              below) -- the panel's own "Yearly Checklist" title sits
              right next to this button already, so a tooltip repeating
              the same text would be redundant while it's open. */}
          <Button type="button" variant="ghost" size="icon-sm" className="text-white hover:bg-white/20 hover:text-white" onClick={() => setHiddenAndRemember(true)} aria-label="Hide Yearly Checklist">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                    <ConfirmDeleteButton confirmMessage={`Remove "${item.description}" from the checklist for every school?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
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
              <form key={item.id} action={toggleChecklistItem} className="flex items-center gap-2 rounded-md bg-record-background px-2 py-1">
                <input type="hidden" name="schoolId" value={schoolId} />
                <input type="hidden" name="itemId" value={item.id} />
                <SubmitButton pendingLabel="…" variant={done ? "default" : "outline"}>
                  {done ? "✓" : " "}
                </SubmitButton>
                <span className="min-w-0 flex-1 text-sm">{item.description}</span>
                {done && entry?.checkedBy && (
                  <SignatureChip name={entry.checkedBy} color={vaColorByName(vas, entry.checkedBy)} small />
                )}
              </form>
            );
          })}
        </div>
    </div>
  );
}
