"use client";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import { NoteCardContent } from "@/components/note-card-content";
import type { PrivateNote } from "@/lib/app-state";

export function PrivateNotesList({
  notes,
  currentUserName,
  shareableVas,
  ackPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
  unpinPrivateNote,
  pinPrivateNote,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  shareableVas: string[];
  ackPrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
  unpinPrivateNote: (id: string) => void;
  pinPrivateNote: (id: string) => void;
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
      {sorted.map((n) => {
        const isAuthor = n.author === currentUserName;
        const sharedWith = n.sharedWith || [];
        const ackBy = n.ackBy || [];
        const isSharedWithMe = !isAuthor && sharedWith.includes(currentUserName);
        const needsAck = isSharedWithMe && !ackBy.includes(currentUserName);
        const notYetSharedWith = shareableVas.filter((name) => name !== n.author && !sharedWith.includes(name));

        return (
          <div
            key={n.id}
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
              {(isAuthor || isSharedWithMe) && (
                <form action={removePrivateNote}>
                  <input type="hidden" name="id" value={n.id} />
                  <ConfirmDeleteButton confirmMessage="Remove this note?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
