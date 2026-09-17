import type { PrivateNote } from "@/lib/app-state";

/* getUTC*() + timeZone: "UTC" pinned throughout, for the same reason as
   components/issues-list.tsx's fmtDate -- SSR runs in UTC, hydration
   runs in the viewer's own timezone, and letting the two disagree
   causes an intermittent React hydration mismatch. Using the local
   (non-UTC) getters here would keep the date and time out of sync with
   each other even after that fix. */
function formatDateTime(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
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
      <div
        className="overflow-x-auto text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
        dangerouslySetInnerHTML={{ __html: note.text }}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {showAuthor && <>{note.author} · </>}
        {formatDateTime(note.createdAt)}
      </p>
    </>
  );
}
