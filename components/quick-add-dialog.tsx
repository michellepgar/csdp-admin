"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Chip } from "@/components/quick-add-parts";
import { QuickAddFilePanel } from "@/components/quick-add-file-panel";
import { QuickAddIssuePanel } from "@/components/quick-add-issue-panel";
import { QuickAddNotePanel } from "@/components/quick-add-note-panel";
import { QuickAddSuggestionPanel } from "@/components/quick-add-suggestion-panel";
import { QuickAddTaskPanel } from "@/components/quick-add-task-panel";
import type { GeneralTaskCategory, IssueCategory, TaskCategory } from "@/lib/app-state";
import type { TaskFileActionResult } from "@/lib/shared-task-files";

/* One existing table on a school's Tasks card, boiled down to what the file
   panel needs -- computed in app/(app)/layout.tsx. `tableId` is empty for a
   table that's only identified by its category combination. */
export type QuickAddTable = { key: string; tableId: string; label: string; categoryIds: string[] };

/* Everything the popup's panels need, gathered in app/(app)/layout.tsx. The
   add actions are the same Server Actions the pages' own forms use. */
export type QuickAddData = {
  schools: { id: string; name: string }[];
  isAdmin: boolean;
  vaNames: string[];
  categories: TaskCategory[];
  tablesBySchool: Record<string, QuickAddTable[]>;
  generalTaskCategories: GeneralTaskCategory[];
  issueCategories: IssueCategory[];
  addTask: (formData: FormData) => Promise<TaskFileActionResult>;
  addGeneralTask: (formData: FormData) => Promise<void>;
  addPrivateNote: (formData: FormData) => Promise<void>;
  addIssue: (formData: FormData) => Promise<void>;
  addSuggestion: (formData: FormData) => Promise<{ error: string | null }>;
};

const KINDS = [
  { id: "file", label: "File" },
  { id: "task", label: "General task" },
  { id: "note", label: "Private note" },
  { id: "issue", label: "Issue" },
  { id: "suggestion", label: "Suggestion" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

/* The header's "Quick add": pick what you're adding, fill in the few fields,
   and it stays open (with your choices kept) so you can add more without
   reopening it. The file tab is the one the popup opens on.

   Mounted only while it's open (see components/app-top-bar.tsx), and each
   panel only while its tab is showing, so every opening starts clean. */
export function QuickAddDialog({ onClose, data }: { onClose: () => void; data: QuickAddData }) {
  const [kind, setKind] = useState<Kind>("file");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Quick add"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-visible rounded-xl border bg-background shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between rounded-t-xl bg-header-background px-4 py-2.5 text-white">
          <h2 className="static bg-transparent p-0 text-base font-semibold">Quick add</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div role="group" aria-label="What are you adding?" className="flex flex-wrap gap-1.5 border-b pb-3">
            {KINDS.map((k) => (
              <Chip key={k.id} on={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </Chip>
            ))}
          </div>

          {kind === "file" && <QuickAddFilePanel data={data} />}
          {kind === "task" && <QuickAddTaskPanel data={data} />}
          {kind === "note" && <QuickAddNotePanel data={data} onClose={onClose} />}
          {kind === "issue" && <QuickAddIssuePanel data={data} />}
          {kind === "suggestion" && <QuickAddSuggestionPanel data={data} onClose={onClose} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
