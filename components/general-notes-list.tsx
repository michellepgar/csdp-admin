"use client";

import { useEffect, useState } from "react";
import { ZoomableHtml } from "@/components/image-lightbox";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { CommentToggleButton, CommentThreadPanel } from "@/components/comment-thread";
import type { GeneralNote, Va } from "@/lib/app-state";

/* A note's id paired with whether the current viewer is allowed to
 * delete it — computed server-side (page.tsx) and passed down as plain
 * data, not a function. Only Server Actions (or primitives) can cross
 * the server-to-client boundary as a prop; a plain closure throws at
 * runtime — not caught by `next build`'s type-check, only by actually
 * hitting the page, which is exactly what happened here. */
export type DeletableNoteId = { id: string; canDelete: boolean };

/* timeZone pinned to Michelle's own working timezone for the same
   reason as components/issues-list.tsx's fmtDate -- SSR runs in UTC,
   hydration runs in the viewer's own timezone, and letting the two
   disagree causes an intermittent React hydration mismatch. */
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
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
  vas,
  isHighlighted,
  ackGeneralNote,
  updateGeneralNote,
  removeGeneralNote,
  addGeneralNoteComment,
  editGeneralNoteComment,
  removeGeneralNoteComment,
  ackGeneralNoteComments,
}: {
  note: GeneralNote;
  currentUserName: string;
  canDelete: boolean;
  vas: Va[];
  isHighlighted: boolean;
  ackGeneralNote: (formData: FormData) => void;
  updateGeneralNote: (formData: FormData) => void;
  removeGeneralNote: (formData: FormData) => void;
  addGeneralNoteComment: (formData: FormData) => void;
  editGeneralNoteComment: (formData: FormData) => void;
  removeGeneralNoteComment: (formData: FormData) => void;
  ackGeneralNoteComments: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
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
        <StickyNoteComposer placeholder="Edit note…" defaultText={n.text} defaultPadColor={n.padColor} vas={vas} />
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
      id={`note-${n.id}`}
      className={`note-card rounded-md border p-3 ${n.urgency === "Urgent" ? "border-destructive/50 bg-destructive/5" : !n.padColor ? "bg-record-background" : ""} ${isHighlighted ? "note-highlight-flash" : ""}`}
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
          <ZoomableHtml html={n.text} className="note-html overflow-x-auto text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded" />
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
          <CommentToggleButton
            comments={n.comments || []}
            commentAckBy={n.commentAckBy || []}
            currentUserName={currentUserName}
            expanded={commentsExpanded}
            onToggle={() => setCommentsExpanded((cur) => !cur)}
            onAck={() => {
              const fd = new FormData();
              fd.set("noteId", n.id);
              ackGeneralNoteComments(fd);
            }}
          />
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
      {commentsExpanded && (
        <div className="mt-2">
          <CommentThreadPanel
            comments={n.comments || []}
            vas={vas}
            currentUserName={currentUserName}
            hiddenFields={{ noteId: n.id }}
            addComment={addGeneralNoteComment}
            editComment={editGeneralNoteComment}
            removeComment={removeGeneralNoteComment}
          />
        </div>
      )}
    </div>
  );
}

export function GeneralNotesList({
  notes,
  currentUserName,
  deletable,
  vas,
  highlightNote,
  ackGeneralNote,
  updateGeneralNote,
  removeGeneralNote,
  addGeneralNoteComment,
  editGeneralNoteComment,
  removeGeneralNoteComment,
  ackGeneralNoteComments,
}: {
  notes: GeneralNote[];
  currentUserName: string;
  deletable: DeletableNoteId[];
  vas: Va[];
  /** A note id to scroll to and briefly flash on mount -- set from
   *  ?highlightNote= on the URL, which is how a mentions-bell click
   *  (components/mentions-bell.tsx) deep-links back to the specific
   *  note someone was mentioned in. */
  highlightNote?: string;
  ackGeneralNote: (formData: FormData) => void;
  updateGeneralNote: (formData: FormData) => void;
  removeGeneralNote: (formData: FormData) => void;
  addGeneralNoteComment: (formData: FormData) => void;
  editGeneralNoteComment: (formData: FormData) => void;
  removeGeneralNoteComment: (formData: FormData) => void;
  ackGeneralNoteComments: (formData: FormData) => void;
}) {
  const deletableIds = new Set(deletable.filter((d) => d.canDelete).map((d) => d.id));
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Driven through React state (not a direct classList.add/remove) on
  // purpose -- classList mutated straight on the DOM node gets silently
  // wiped the next time this list re-renders for ANY reason (a Server
  // Action revalidating the page, an unrelated state update elsewhere),
  // since React's reconciliation resets className to whatever the JSX
  // below computes, with no idea an outside mutation happened.
  // Confirmed directly: the class was there immediately after being
  // added, then gone moments later with no code in between removing it
  // on purpose. Keeping "is this the highlighted note" in state instead
  // means React itself renders the class, so it survives reconciliation.
  const [highlightedId, setHighlightedId] = useState(highlightNote ?? null);

  useEffect(() => {
    if (!highlightedId) return;
    document.getElementById(`note-${highlightedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timeout);
  }, [highlightedId]);

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
          vas={vas}
          isHighlighted={n.id === highlightedId}
          ackGeneralNote={ackGeneralNote}
          updateGeneralNote={updateGeneralNote}
          removeGeneralNote={removeGeneralNote}
          addGeneralNoteComment={addGeneralNoteComment}
          editGeneralNoteComment={editGeneralNoteComment}
          removeGeneralNoteComment={removeGeneralNoteComment}
          ackGeneralNoteComments={ackGeneralNoteComments}
        />
      ))}
    </div>
  );
}
