import type { PrivateNote } from "@/lib/app-state";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* The rendered body of a private note -- text + author/date byline.
   Shared between the ordered list (components/private-notes-list.tsx)
   and the freeform pinboard (components/private-notes-board.tsx) so
   the two never drift into rendering notes differently. */
export function NoteCardContent({ note }: { note: Pick<PrivateNote, "text" | "author" | "createdAt"> }) {
  return (
    <>
      {/* text is sanitized server-side (lib/sanitize-note-html.ts)
          before it's ever stored -- see private-notes/actions.ts's
          addPrivateNote -- so this is safe to render as-is. */}
      <div className="text-sm [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: note.text }} />
      <p className="mt-1 text-xs text-muted-foreground">
        {note.author} · {formatDateTime(note.createdAt)}
      </p>
    </>
  );
}
