"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Pencil, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SignatureChip } from "@/components/signature-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checklistSummary, vaColorByName, type ChecklistTemplateItem, type ChecklistProgressEntry, type Va } from "@/lib/app-state";

const COLLAPSED_COOKIE_NAME = "checklist-collapsed";

export function ChecklistCard({
  schoolId,
  template,
  progress,
  vas,
  initialHidden,
  toggleChecklistItem,
  setChecklistNotNeeded,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
  updateChecklistTemplateItem,
  reorderChecklistTemplate,
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
  setChecklistNotNeeded: (formData: FormData) => void;
  addChecklistTemplateItem: (formData: FormData) => void;
  removeChecklistTemplateItem: (formData: FormData) => void;
  updateChecklistTemplateItem: (formData: FormData) => void;
  reorderChecklistTemplate: (orderedIds: string[]) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [hidden, setHidden] = useState(initialHidden);
  const summary = checklistSummary(template, progress);

  // A local copy the drag handlers below reorder instantly (dragging
  // an item several places at once shouldn't wait on a round trip to
  // the server to look right), then just re-synced from `template`
  // whenever it changes -- by the time a fresh `template` prop
  // actually arrives (add/remove, or this same drag's own
  // reorderChecklistTemplate call finishing), it already matches
  // whatever's showing locally, so this never visibly flips back to a
  // stale order in between.
  const [orderedItems, setOrderedItems] = useState(template);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is the intentional server-data refresh for an optimistic drag order.
    setOrderedItems(template);
  }, [template]);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const next = [...orderedItems];
    const fromIndex = next.findIndex((t) => t.id === draggedId);
    const toIndex = next.findIndex((t) => t.id === targetId);
    setDraggedId(null);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedItems(next);
    reorderChecklistTemplate(next.map((t) => t.id));
  }

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
      <div className="flex items-center justify-between gap-2 rounded-md border bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold whitespace-nowrap">
          Yearly Checklist {summary.total > 0 && <span className="ml-1 text-sm font-normal text-white/70">{summary.done}/{summary.total}</span>}
        </h2>
        <Button type="button" variant="ghost" size="sm" className="border-white/40 bg-white/10 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] hover:border-white/70 hover:bg-white/20 hover:text-white active:bg-white/30" onClick={() => setHiddenAndRemember(false)} aria-label="Show Yearly Checklist">
          Show <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    // Full width, like Tasks under it and the cards below it.
    <div className="w-full rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold whitespace-nowrap">
          Yearly Checklist {summary.total > 0 && <span className="ml-1 text-sm font-normal text-white/70">{summary.done}/{summary.total}</span>}
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
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-3 p-3">
          {editorOpen && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Add, edit and remove checklist items here. Changes apply to every school. Drag by the handle to reorder.</p>
              {orderedItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(item.id)}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center justify-between gap-2 rounded-md text-sm ${draggedId === item.id ? "opacity-40" : ""}`}
                >
                  {editingItemId === item.id ? (
                    <form
                      action={(formData) => { updateChecklistTemplateItem(formData); setEditingItemId(null); }}
                      className="flex min-w-0 flex-1 items-center gap-1.5"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <Input name="description" defaultValue={item.description} required autoFocus className="h-8 min-w-0" />
                      <SubmitButton pendingLabel="…" size="xs">Save</SubmitButton>
                      <Button type="button" variant="ghost" size="xs" onClick={() => setEditingItemId(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <GripVertical className="h-4 w-4 flex-none cursor-grab text-muted-foreground active:cursor-grabbing" />
                      <span className="min-w-0 break-words">{item.description}</span>
                      <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground/60" aria-label={`Edit ${item.description}`} onClick={() => setEditingItemId(item.id)}><Pencil className="h-3 w-3" /></Button>
                    </span>
                  )}
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

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {template.map((item) => {
            const entry = progress[item.id];
            const done = entry?.status === "Done";
            const notNeeded = !!entry?.notNeeded;
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-md bg-record-background px-2 py-1">
                {notNeeded ? (
                  <span className="w-9 text-center text-muted-foreground">—</span>
                ) : (
                  <form action={toggleChecklistItem}>
                    <input type="hidden" name="schoolId" value={schoolId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitButton pendingLabel="…" variant={done ? "default" : "outline"}>{done ? "✓" : " "}</SubmitButton>
                  </form>
                )}
                <span className={`min-w-0 flex-1 text-sm ${notNeeded ? "text-muted-foreground line-through" : ""}`}>{item.description}</span>
                {notNeeded ? (
                  <form action={setChecklistNotNeeded} className="flex items-center gap-1">
                    <input type="hidden" name="schoolId" value={schoolId} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <input type="hidden" name="notNeeded" value="false" />
                    <span className="text-xs text-muted-foreground">Not needed</span>
                    <SubmitButton pendingLabel="…" variant="ghost" size="xs">Undo</SubmitButton>
                  </form>
                ) : (
                  <>
                    {done && entry?.checkedBy && <SignatureChip name={entry.checkedBy} color={vaColorByName(vas, entry.checkedBy)} small />}
                    <form action={setChecklistNotNeeded}>
                      <input type="hidden" name="schoolId" value={schoolId} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="notNeeded" value="true" />
                      <SubmitButton pendingLabel="…" variant="ghost" size="icon-xs"><span className="text-destructive/70"><X className="h-3 w-3" /><span className="sr-only">Mark {item.description} not needed</span></span></SubmitButton>
                    </form>
                  </>
                )}
              </div>
            );
          })}
          </div>
        </div>
    </div>
  );
}
