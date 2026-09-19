"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import { NoteCardContent } from "@/components/note-card-content";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { CommentToggleButton, CommentThreadPanel } from "@/components/comment-thread";
import type { PrivateNote, Va } from "@/lib/app-state";

/* One note, as either its read-only card or (if you're the author) its
   own edit form -- editing reuses the exact same StickyNoteComposer
   the "Add a note" form uses, pre-filled with the note's current
   text/color. Only the author ever sees Edit -- being shared a note
   already gets you read/ack/delete/pin, never the ability to change
   someone else's own words (see updatePrivateNote's own comment in
   app/(app)/private-notes/actions.ts). */
function PrivateNoteRow({
  note: n,
  currentUserName,
  shareableVas,
  vas,
  ackPrivateNote,
  updatePrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
  pinPrivateNote,
  addNoteToPlan,
  addPrivateNoteComment,
  editPrivateNoteComment,
  removePrivateNoteComment,
  ackPrivateNoteComments,
}: {
  note: PrivateNote;
  currentUserName: string;
  shareableVas: string[];
  vas: Va[];
  ackPrivateNote: (formData: FormData) => void;
  updatePrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
  pinPrivateNote: (id: string) => void;
  addNoteToPlan: (formData: FormData) => void;
  addPrivateNoteComment: (formData: FormData) => void;
  editPrivateNoteComment: (formData: FormData) => void;
  removePrivateNoteComment: (formData: FormData) => void;
  ackPrivateNoteComments: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const isAuthor = n.author === currentUserName;
  const sharedWith = n.sharedWith || [];
  const ackBy = n.ackBy || [];
  const isSharedWithMe = !isAuthor && sharedWith.includes(currentUserName);
  const needsAck = isSharedWithMe && !ackBy.includes(currentUserName);
  const notYetSharedWith = shareableVas.filter((name) => name !== n.author && !sharedWith.includes(name));

  if (editing) {
    return (
      <form
        action={updatePrivateNote}
        onSubmit={() => setEditing(false)}
        className="note-card space-y-2 rounded-md border bg-muted/30 p-3"
      >
        <input type="hidden" name="id" value={n.id} />
        <StickyNoteComposer placeholder="Edit note…" defaultText={n.text} defaultPadColor={n.padColor} vas={vas} />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input key={String(!!n.isReminder)} type="checkbox" name="isReminder" defaultChecked={!!n.isReminder} />
            Mark as reminder
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
      className={`note-card relative rounded-md border p-3 ${!n.padColor ? "bg-record-background" : ""}`}
      style={n.padColor ? { backgroundColor: n.padColor } : undefined}
    >
      {/* A dedicated drag handle, NOT the whole card -- making the
          entire card draggable made its own buttons unreliable to
          click (confirmed live: a draggable ancestor can swallow a
          click as an attempted drag on some browsers/trackpads,
          especially with the smallest bit of cursor movement during
          the click). The 📌 Pin to board button below is the primary,
          always-reliable way to pin; this handle is just for anyone
          who prefers dragging. */}
      <span
        aria-hidden
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/note-id", n.id)}
        title="Drag to pin this note to the board"
        className="absolute right-2 top-2 cursor-grab select-none text-muted-foreground active:cursor-grabbing"
      >
        ⠿
      </span>
      <NoteCardContent note={n} showAuthor={!isAuthor} />

      {isAuthor && sharedWith.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>Shared with:</span>
          {sharedWith.map((name) => (
            <form key={name} action={unsharePrivateNote} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              <input type="hidden" name="id" value={n.id} />
              <input type="hidden" name="vaName" value={name} />
              <span>
                {name}
                {ackBy.includes(name) ? " ✓" : ""}
              </span>
              <ConfirmDeleteButton confirmMessage={`Stop sharing this note with ${name}?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
            </form>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {isAuthor && notYetSharedWith.length > 0 && (
          <AutoSubmitDropdown
            action={sharePrivateNote}
            hiddenFields={{ id: n.id }}
            name="vaName"
            placeholder="Share with…"
            options={notYetSharedWith.map((name) => ({ value: name, label: name }))}
            className="rounded-md border bg-white px-2 py-1 text-left text-xs text-foreground transition-colors hover:bg-muted"
          />
        )}
        {needsAck && (
          <form action={ackPrivateNote}>
            <input type="hidden" name="id" value={n.id} />
            <SubmitButton pendingLabel="…" variant="outline" size="sm">Mark as checked</SubmitButton>
          </form>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          title="Pin this note to the board on the right — you can also just drag it there"
          onClick={() => pinPrivateNote(n.id)}
        >
          📌 Pin to board
        </Button>
        <form action={addNoteToPlan}>
          <input type="hidden" name="noteId" value={n.id} />
          <input type="hidden" name="label" value={n.text.replace(/<[^>]+>/g, " ").trim().slice(0, 80) || "Note"} />
          <SubmitButton pendingLabel="…" variant="outline" size="sm">+ Add to Your Plan</SubmitButton>
        </form>
        {isAuthor && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {(isAuthor || isSharedWithMe) && (
          <form action={removePrivateNote}>
            <input type="hidden" name="id" value={n.id} />
            <ConfirmDeleteButton confirmMessage="Remove this note?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
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
            ackPrivateNoteComments(fd);
          }}
        />
      </div>
      {commentsExpanded && (
        <div className="mt-2">
          <CommentThreadPanel
            comments={n.comments || []}
            vas={vas}
            currentUserName={currentUserName}
            hiddenFields={{ noteId: n.id }}
            addComment={addPrivateNoteComment}
            editComment={editPrivateNoteComment}
            removeComment={removePrivateNoteComment}
          />
        </div>
      )}
    </div>
  );
}

export function PrivateNotesList({
  notes,
  currentUserName,
  shareableVas,
  vas,
  ackPrivateNote,
  updatePrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
  unpinPrivateNote,
  pinPrivateNote,
  addNoteToPlan,
  addPrivateNoteComment,
  editPrivateNoteComment,
  removePrivateNoteComment,
  ackPrivateNoteComments,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  shareableVas: string[];
  vas: Va[];
  ackPrivateNote: (formData: FormData) => void;
  updatePrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
  unpinPrivateNote: (id: string) => void;
  pinPrivateNote: (id: string) => void;
  addNoteToPlan: (formData: FormData) => void;
  addPrivateNoteComment: (formData: FormData) => void;
  editPrivateNoteComment: (formData: FormData) => void;
  removePrivateNoteComment: (formData: FormData) => void;
  ackPrivateNoteComments: (formData: FormData) => void;
}) {
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleListDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/note-id");
    if (id) unpinPrivateNote(id);
  }

  if (sorted.length === 0) {
    return (
      <p
        className="text-sm text-muted-foreground"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleListDrop}
      >
        No private notes yet — only you can see this page.
      </p>
    );
  }

  return (
    <div className="space-y-3" onDragOver={(e) => e.preventDefault()} onDrop={handleListDrop}>
      {sorted.map((n) => (
        <PrivateNoteRow
          key={n.id}
          note={n}
          currentUserName={currentUserName}
          shareableVas={shareableVas}
          vas={vas}
          ackPrivateNote={ackPrivateNote}
          updatePrivateNote={updatePrivateNote}
          sharePrivateNote={sharePrivateNote}
          unsharePrivateNote={unsharePrivateNote}
          removePrivateNote={removePrivateNote}
          pinPrivateNote={pinPrivateNote}
          addNoteToPlan={addNoteToPlan}
          addPrivateNoteComment={addPrivateNoteComment}
          editPrivateNoteComment={editPrivateNoteComment}
          removePrivateNoteComment={removePrivateNoteComment}
          ackPrivateNoteComments={ackPrivateNoteComments}
        />
      ))}
    </div>
  );
}
