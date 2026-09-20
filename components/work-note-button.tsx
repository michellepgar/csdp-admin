"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { saveWorkNote } from "@/app/(app)/overview/actions";
import { MAX_WORK_NOTE } from "@/lib/work-notes";
import { cn } from "@/lib/utils";

/* A small note button on YOUR OWN task or reminder (Currently Working On,
   Next Shift Plan, Your Plan). It opens a window to write a short
   explanation -- why you couldn't finish or continue -- shown next to the
   item for the team. It only ever adds a note; it can't change the task,
   priority or reminder itself. Filled/amber when a note already exists. */
export function WorkNoteButton({ itemKey, note, label, className }: { itemKey: string; note?: string; label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(note ?? "");
  const hasNote = !!note;

  function openDialog() {
    setDraft(note ?? "");
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={hasNote ? `Edit your note on "${label}"` : `Add a note to "${label}"`}
        title={hasNote ? "Edit note" : "Add a note"}
        className={cn(
          "flex h-5 w-5 flex-none items-center justify-center rounded transition-colors",
          hasNote ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <StickyNote className="h-3 w-3" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Note">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-2 bg-amber-500 px-4 py-3 text-white">
              <StickyNote className="h-5 w-5" />
              <p className="text-base font-semibold">{hasNote ? "Edit your note" : "Add a note"}</p>
            </div>
            <form
              action={async (formData) => {
                setError(null);
                const result = await saveWorkNote(formData);
                if (result.error) setError(result.error);
                else setOpen(false);
              }}
              className="space-y-3 p-4 text-sm"
            >
              <input type="hidden" name="itemKey" value={itemKey} />
              <p className="truncate rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium" title={label}>
                {label}
              </p>
              <label className="block text-xs font-semibold">
                Note
                <textarea
                  name="note"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  maxLength={MAX_WORK_NOTE}
                  autoFocus
                  placeholder="e.g. Waiting on the school's reply — will pick it back up tomorrow"
                  className="mt-1 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                />
                <span className="mt-0.5 flex justify-between font-normal text-muted-foreground">
                  <span>Your team can see this. It doesn&apos;t change the task.</span>
                  <span>
                    {draft.length}/{MAX_WORK_NOTE}
                  </span>
                </span>
              </label>
              {error && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {hasNote ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    onClick={() => {
                      setDraft("");
                      const form = document.querySelector<HTMLFormElement>('[role="dialog"][aria-label="Note"] form');
                      const field = form?.querySelector<HTMLTextAreaElement>("textarea");
                      if (field) field.value = "";
                      form?.requestSubmit();
                    }}
                  >
                    Remove note
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
