import type { PrivateNote } from "@/lib/app-state";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${mm}/${dd}/${yy}, ${time}`;
}

/* The rendered body of a private note -- text + author/date byline.
   Shared between the ordered list (components/private-notes-list.tsx)
   and the freeform pinboard (components/private-notes-board.tsx) so
   the two never drift into rendering notes differently. */
export function NoteCardContent({
  note,
  showAuthor = true,
}: {
  note: Pick<PrivateNote, "text" | "author" | "createdAt">;
  /** Only the people a note was SHARED to need to see who posted it --
   *  a note you authored yourself is obviously yours, so callers pass
   *  false here when the viewer is the note's own author. */
  showAuthor?: boolean;
}) {
  return (
    <>
      {/* text is sanitized server-side (lib/sanitize-note-html.ts)
          before it's ever stored -- see private-notes/actions.ts's
          addPrivateNote -- so this is safe to render as-is. */}
      <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: note.text }} />
      <p className="mt-1 text-xs text-muted-foreground">
        {showAuthor && <>{note.author} · </>}
        {formatDateTime(note.createdAt)}
      </p>
    </>
  );
}
