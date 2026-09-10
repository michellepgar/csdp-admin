import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, visiblePrivateNotes } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { PrivateNotesList } from "@/components/private-notes-list";
import { PrivateNotesBoard } from "@/components/private-notes-board";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { SubmitButton } from "@/components/submit-button";
import {
  addPrivateNote,
  sharePrivateNote,
  unsharePrivateNote,
  ackPrivateNote,
  removePrivateNote,
  pinPrivateNote,
  reorderPinnedNotes,
  unpinPrivateNote,
  resizePinnedNoteWidth,
} from "./actions";

export default async function PrivateNotesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const mine = visiblePrivateNotes(state, me.name);
  const listNotes = mine.filter((n) => n.boardX == null);
  const boardNotes = mine.filter((n) => n.boardX != null);

  return (
    <div>
      <PageHeader title="Private Notes" />
      <PageBody>
        {/* Pinboard gets more room than the list (3fr vs 2fr, i.e. 60/40)
            -- Michelle asked for a bigger board now that notes can be
            dragged wider (up to 640px, see private-notes-board.tsx),
            so the board's own column needs more width to actually fit
            a stretched note without it dominating a 50/50 split. The
            low breakpoint (was lg: 1024px, now sm) still matters for
            the same reason as before: staying side-by-side at ordinary
            window widths instead of stacking the board full-width
            below the list. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_3fr]">
          <div className="space-y-4">
            <form action={addPrivateNote} className="max-w-lg space-y-2">
              <StickyNoteComposer placeholder="Add a private note…" />
              <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
            </form>

            <PrivateNotesList
              notes={listNotes}
              currentUserName={me.name}
              shareableVas={state.vas.map((v) => v.name)}
              ackPrivateNote={ackPrivateNote}
              sharePrivateNote={sharePrivateNote}
              unsharePrivateNote={unsharePrivateNote}
              removePrivateNote={removePrivateNote}
              unpinPrivateNote={unpinPrivateNote}
              pinPrivateNote={pinPrivateNote}
            />
          </div>

          <div>
            <h2 className="mb-2">Pinboard</h2>
            <PrivateNotesBoard
              notes={boardNotes}
              currentUserName={me.name}
              pinPrivateNote={pinPrivateNote}
              reorderPinnedNotes={reorderPinnedNotes}
              unpinPrivateNote={unpinPrivateNote}
              resizePinnedNoteWidth={resizePinnedNoteWidth}
            />
          </div>
        </div>
      </PageBody>
    </div>
  );
}
