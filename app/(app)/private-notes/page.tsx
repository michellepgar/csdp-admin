import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, visiblePrivateNotes } from "@/lib/app-state";
import { noteMatches, searchWords } from "@/lib/private-note-search";
import { NoteFocus } from "@/components/note-focus";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { PrivateNotesList } from "@/components/private-notes-list";
import { PrivateNotesBoard } from "@/components/private-notes-board";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { SubmitButton } from "@/components/submit-button";
import {
  addPrivateNote,
  updatePrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  ackPrivateNote,
  removePrivateNote,
  pinPrivateNote,
  reorderPinnedNotes,
  unpinPrivateNote,
  resizePinnedNoteWidth,
  resizePinnedNoteHeight,
  addNoteToPlan,
  addPrivateNoteComment,
  editPrivateNoteComment,
  removePrivateNoteComment,
  ackPrivateNoteComments,
} from "./actions";

export default async function PrivateNotesPage({ searchParams }: { searchParams: Promise<{ q?: string; highlightNote?: string }> }) {
  const { q = "", highlightNote } = await searchParams;
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const mine = visiblePrivateNotes(state, me.name);
  // ?q= narrows both the list and the board to notes containing every word typed.
  const words = searchWords(q);
  const searching = words.length > 0;
  const shown = searching ? mine.filter((n) => noteMatches(n.text, words)) : mine;
  const listNotes = shown.filter((n) => n.boardX == null);
  const boardNotes = shown.filter((n) => n.boardX != null);
  // The board stays folded the way it was left, unless what you came here for
  // (a search match or a note picked from the top bar) is pinned on it.
  const boardCollapsed =
    (await cookies()).get("priority-board-collapsed")?.value === "1" &&
    !(searching && boardNotes.length > 0) &&
    !boardNotes.some((n) => n.id === highlightNote);

  return (
    <div>
      <PageHeader title="Private Notes" />
      <PageBody>
        <NoteFocus id={highlightNote} />
        <form method="get" className="flex max-w-3xl flex-wrap items-center gap-2" role="search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search your notes by keyword"
            aria-label="Search your notes"
            className="min-w-56 flex-1 rounded-md border px-3 py-1.5 text-sm"
          />
          <Button type="submit">Search</Button>
          {searching && (
            <Link href="/private-notes" prefetch={false} className="text-sm text-primary underline underline-offset-2">
              Clear search
            </Link>
          )}
        </form>
        {searching && (
          <p className="text-sm text-muted-foreground">
            {shown.length === 0
              ? `No notes contain “${q.trim()}”.`
              : `${shown.length} of ${mine.length} note${mine.length === 1 ? "" : "s"} contain “${q.trim()}”.`}
          </p>
        )}

        {!(searching && shown.length === 0) && (
          <>
            {/* The board sits above the list and folds away -- Michelle asked
                for it on top so the notes she pinned are the first thing on
                the page, and collapsible for when she wants the list to have
                the room. */}
            <CollapsibleSection title="My Priority Board" count={boardNotes.length} initialCollapsed={boardCollapsed} cookieName="priority-board-collapsed">
              <PrivateNotesBoard
                notes={boardNotes}
                currentUserName={me.name}
                pinPrivateNote={pinPrivateNote}
                reorderPinnedNotes={reorderPinnedNotes}
                unpinPrivateNote={unpinPrivateNote}
                resizePinnedNoteWidth={resizePinnedNoteWidth}
                resizePinnedNoteHeight={resizePinnedNoteHeight}
                addNoteToPlan={addNoteToPlan}
              />
            </CollapsibleSection>

            <div className="max-w-3xl space-y-4">
              <form action={addPrivateNote} className="space-y-2">
                <StickyNoteComposer placeholder="Add a private note…" draftKey="draft:private-note" vas={state.vas || []} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="isReminder" />
                    Mark as reminder
                  </label>
                  <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
                </div>
              </form>

              <PrivateNotesList
                notes={listNotes}
                currentUserName={me.name}
                shareableVas={state.vas.map((v) => v.name)}
                vas={state.vas || []}
                ackPrivateNote={ackPrivateNote}
                updatePrivateNote={updatePrivateNote}
                sharePrivateNote={sharePrivateNote}
                unsharePrivateNote={unsharePrivateNote}
                removePrivateNote={removePrivateNote}
                unpinPrivateNote={unpinPrivateNote}
                pinPrivateNote={pinPrivateNote}
                addNoteToPlan={addNoteToPlan}
                addPrivateNoteComment={addPrivateNoteComment}
                editPrivateNoteComment={editPrivateNoteComment}
                removePrivateNoteComment={removePrivateNoteComment}
                ackPrivateNoteComments={ackPrivateNoteComments}
              />
            </div>
          </>
        )}
      </PageBody>
    </div>
  );
}
