"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import type { GeneralNote } from "@/lib/app-state";

/* A note's id paired with whether the current viewer is allowed to
 * delete it — computed server-side (page.tsx) and passed down as plain
 * data, not a function. Only Server Actions (or primitives) can cross
 * the server-to-client boundary as a prop; a plain closure throws at
 * runtime — not caught by `next build`'s type-check, only by actually
 * hitting the page, which is exactly what happened here. */
export type DeletableNoteId = { id: string; canDelete: boolean };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* One note, as either its read-only card or (if you're the author) its
   own edit form -- editing reuses the exact same StickyNoteComposer
   the "Add a note" form up top uses, pre-filled with the note's
   current text/color, so formatting a note doesn't require different
   controls depending on whether you're creating or fixing one. Only
   the author ever sees the Edit button -- Michelle asked for this to
   be strict, no admin exception (unlike Delete, see
   app/(app)/notes/actions.ts's updateGeneralNote comment). */
function GeneralNoteRow({
  note: n,
  currentUserName,
  canDelete,
  ackGeneralNote,
  updateGeneralNote,
  removeGeneralNote,
}: {
  note: GeneralNote;
  currentUserName: string;
  canDelete: boolean;
  ackGeneralNote: (formData: FormData) => void;
  updateGeneralNote: (formData: FormData) => void;
  removeGeneralNote: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ackBy = n.ackBy || [];
  const isAuthor = n.author === currentUserName;
  const needsAck = n.urgency === "Urgent" && !isAuthor && !ackBy.includes(currentUserName);

  if (editing) {
    return (
      <form
        action={updateGeneralNote}
        onSubmit={() => setEditing(false)}
        className="note-card space-y-2 rounded-md border bg-muted/30 p-3"
      >
        <input type="hidden" name="id" value={n.id} />
        <StickyNoteComposer placeholder="Edit note…" defaultText={n.text} defaultPadColor={n.padColor} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="urgent" defaultChecked={n.urgency === "Urgent"} />
            Urgent
          </label>
          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div
      className={`note-card rounded-md border p-3 ${n.urgency === "Urgent" ? "border-destructive/50 bg-destructive/5" : !n.padColor ? "bg-record-background" : ""}`}
      style={n.urgency !== "Urgent" && n.padColor ? { backgroundColor: n.padColor } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {n.urgency === "Urgent" && (
            <span className="mb-1 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
              Urgent
            </span>
          )}
          {/* text is sanitized server-side (lib/sanitize-note-html.ts)
              before it's ever stored -- see notes/actions.ts's
              addGeneralNote/updateGeneralNote -- so this is safe to
              render as-is. */}
          <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: n.text }} />
          <p className="mt-1 text-xs text-muted-foreground">
            {n.author} · {formatDateTime(n.createdAt)}
            {n.urgency === "Urgent" && ackBy.length > 0 && ` · Seen by ${ackBy.join(", ")}`}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {needsAck && (
            <form action={ackGeneralNote}>
              <input type="hidden" name="id" value={n.id} />
              <SubmitButton pendingLabel="…" variant="outline" size="sm">Mark as checked</SubmitButton>
            </form>
          )}
          {isAuthor && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-muted-foreground hover:underline">
              Edit
            </button>
          )}
          {canDelete && (
            <form action={removeGeneralNote}>
              <input type="hidden" name="id" value={n.id} />
              <ConfirmDeleteButton confirmMessage="Remove this note?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function GeneralNotesList({
  notes,
  currentUserName,
  deletable,
  ackGeneralNote,
  updateGeneralNote,
  removeGeneralNote,
}: {
  notes: GeneralNote[];
  currentUserName: string;
  deletable: DeletableNoteId[];
  ackGeneralNote: (formData: FormData) => void;
  updateGeneralNote: (formData: FormData) => void;
  removeGeneralNote: (formData: FormData) => void;
}) {
  const deletableIds = new Set(deletable.filter((d) => d.canDelete).map((d) => d.id));
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No notes yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((n) => (
        <GeneralNoteRow
          key={n.id}
          note={n}
          currentUserName={currentUserName}
          canDelete={deletableIds.has(n.id)}
          ackGeneralNote={ackGeneralNote}
          updateGeneralNote={updateGeneralNote}
          removeGeneralNote={removeGeneralNote}
        />
      ))}
    </div>
  );
}
