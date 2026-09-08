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
  updatePrivateNoteBoardState,
  unpinPrivateNote,
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            <p className="mb-2 text-xs text-muted-foreground">
              Click 📌 Pin to board on any note (or drag it here) to pin it anywhere — click ↩ Return to list on a pinned note to bring it back.
            </p>
            <PrivateNotesBoard
              notes={boardNotes}
              pinPrivateNote={pinPrivateNote}
              updatePrivateNoteBoardState={updatePrivateNoteBoardState}
              unpinPrivateNote={unpinPrivateNote}
            />
          </div>
        </div>
      </PageBody>
    </div>
  );
}
