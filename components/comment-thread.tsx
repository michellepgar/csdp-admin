"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CommentComposer } from "@/components/comment-composer";
import { initialsForName } from "@/lib/team-presence";
import type { Comment, Va } from "@/lib/app-state";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function colorFor(name: string, vas: Va[]): string {
  return vas.find((v) => v.name === name)?.color || "var(--muted-foreground)";
}

/* The small chat-bubble button every commentable row/card shows --
   click toggles the caller's own expand state rather than an internal
   popup (see components/issues-list.tsx, components/general-notes-list.tsx,
   components/private-notes-list.tsx, each of which owns its own "which
   row is expanded" state). The blinking dot (.priority-dot, same
   animation as Task Priorities' unassigned list) shows whenever the
   current user hasn't seen the LATEST comment yet -- commentAckBy is
   reset to just the poster's own name on every new comment. Opening
   the row acks it. */
export function CommentToggleButton({
  comments,
  commentAckBy,
  currentUserName,
  expanded,
  onToggle,
  onAck,
}: {
  comments: Comment[];
  commentAckBy: string[];
  currentUserName: string;
  expanded: boolean;
  onToggle: () => void;
  onAck: () => void;
}) {
  const unread = comments.length > 0 && !commentAckBy.includes(currentUserName);

  function handleClick() {
    const opening = !expanded;
    onToggle();
    if (opening && unread) onAck();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${comments.length} comment${comments.length === 1 ? "" : "s"} -- ${unread ? "new activity" : "open to view or add a comment"}`}
      className="relative flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-muted"
    >
      <MessageCircle className="h-4 w-4" />
      {comments.length > 0 && <span className="text-xs">{comments.length}</span>}
      {unread && <span className="priority-dot absolute -right-0.5 -top-0.5 m-0" aria-hidden />}
    </button>
  );
}

/* One rendered comment -- avatar/name/timestamp, its sanitized-HTML
   body (screenshots capped to a consistent thumbnail size via the
   [&_img] classes below, click-to-enlarge via the lightbox click
   delegate on the container), and Edit/Delete for its own author.
   Editing swaps the body for the same CommentComposer used to add one,
   pre-filled -- same pattern as GeneralNoteRow's own note-body edit. */
function CommentRow({
  comment,
  vas,
  currentUserName,
  onOpenLightbox,
  editComment,
  removeComment,
}: {
  comment: Comment;
  vas: Va[];
  currentUserName: string;
  onOpenLightbox: (src: string) => void;
  editComment: (formData: FormData) => void;
  removeComment: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isAuthor = comment.author === currentUserName;

  if (editing) {
    return (
      <form action={editComment} onSubmit={() => setEditing(false)} className="rounded-md border bg-muted/30 p-2">
        <input type="hidden" name="commentId" value={comment.id} />
        <CommentComposer vas={vas} defaultText={comment.text} submitLabel="Save" onCancel={() => setEditing(false)} />
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <span
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: colorFor(comment.author, vas) }}
        aria-hidden
      >
        {initialsForName(comment.author)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-semibold">{comment.author}</span> <span className="text-muted-foreground">· {fmtDateTime(comment.createdAt)}{comment.editedAt && " (edited)"}</span>
          </div>
          {isAuthor && (
            <div className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
              <button type="button" onClick={() => setEditing(true)} className="hover:underline">Edit</button>
              <form action={removeComment}>
                <input type="hidden" name="commentId" value={comment.id} />
                <ConfirmDeleteButton confirmMessage="Remove this comment?" pendingLabel="…" variant="ghost" size="xs">✕</ConfirmDeleteButton>
              </form>
            </div>
          )}
        </div>
        <div
          className="overflow-x-auto whitespace-pre-wrap break-words text-sm [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:max-h-[200px] [&_img]:max-w-[240px] [&_img]:cursor-zoom-in [&_img]:rounded [&_img]:object-contain"
          dangerouslySetInnerHTML={{ __html: comment.text }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === "IMG") onOpenLightbox((target as HTMLImageElement).src);
          }}
        />
      </div>
    </div>
  );
}

/* A full-screen dim overlay showing one image at natural size --
   dismissed by clicking anywhere on it. This is a click-delegation
   lightbox, not a real link around the image, because
   lib/sanitize-note-html.ts's allowlist deliberately blocks a data:
   scheme on <a href> (only <img src> is allowed to use data:) -- a
   pasted screenshot has no other URL to link to. */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, not something next/image can optimize. */}
      <img src={src} alt="" className="max-h-full max-w-full rounded object-contain" />
    </div>
  );
}

/* The expanded thread itself -- rendered by the caller inline below
   the commentable row/card, full width, not a floating popup. The
   comment LIST (not the add-comment form under it) caps at roughly 5
   visible comments and scrolls past that. */
export function CommentThreadPanel({
  comments,
  vas,
  currentUserName,
  hiddenFields,
  addComment,
  editComment,
  removeComment,
}: {
  comments: Comment[];
  vas: Va[];
  currentUserName: string;
  /** Extra hidden fields addComment needs to know which parent this
   *  comment belongs to -- e.g. {issueId: issue.id} or {noteId: note.id}.
   *  editComment/removeComment only ever need the comment's own id
   *  (see CommentRow), so they don't take this. */
  hiddenFields: Record<string, string>;
  addComment: (formData: FormData) => void;
  editComment: (formData: FormData) => void;
  removeComment: (formData: FormData) => void;
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="max-h-[220px] space-y-2 overflow-y-auto">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              vas={vas}
              currentUserName={currentUserName}
              onOpenLightbox={setLightboxSrc}
              editComment={editComment}
              removeComment={removeComment}
            />
          ))}
        </div>
      )}
      <form
        action={(formData) => addComment(formData)}
        onSubmit={(e) => {
          const form = e.currentTarget;
          requestAnimationFrame(() => form.reset());
        }}
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <CommentComposer vas={vas} />
      </form>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
