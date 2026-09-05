"use client";

import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import type { PrivateNote } from "@/lib/app-state";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PrivateNotesList({
  notes,
  currentUserName,
  shareableVas,
  ackPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  removePrivateNote,
}: {
  notes: PrivateNote[];
  currentUserName: string;
  shareableVas: string[];
  ackPrivateNote: (formData: FormData) => void;
  sharePrivateNote: (formData: FormData) => void;
  unsharePrivateNote: (formData: FormData) => void;
  removePrivateNote: (formData: FormData) => void;
}) {
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No private notes yet — only you can see this page.</p>;
  }

  return (
    <div className="space-y-3">
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
            className={`note-card rounded-md border p-3 ${!n.padColor ? "bg-record-background" : ""}`}
            style={n.padColor ? { backgroundColor: n.padColor } : undefined}
          >
            {/* text is sanitized server-side (lib/sanitize-note-html.ts)
                before it's ever stored -- see private-notes/actions.ts's
                addPrivateNote -- so this is safe to render as-is. */}
            <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: n.text }} />
            <p className="mt-1 text-xs text-muted-foreground">
              {n.author} · {formatDateTime(n.createdAt)}
            </p>

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
