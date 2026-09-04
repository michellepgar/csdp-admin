import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, visiblePrivateNotes } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { PrivateNotesList } from "@/components/private-notes-list";
import { StickyNoteComposer } from "@/components/sticky-note-composer";
import { SubmitButton } from "@/components/submit-button";
import { addPrivateNote, sharePrivateNote, unsharePrivateNote, ackPrivateNote, removePrivateNote } from "./actions";

export default async function PrivateNotesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const mine = visiblePrivateNotes(state, me.name);

  return (
    <div>
      <PageHeader title="Private Notes" />
      <PageBody>
        <form action={addPrivateNote} className="max-w-lg space-y-2">
          <StickyNoteComposer placeholder="Add a private note…" />
          <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
        </form>

        <PrivateNotesList
          notes={mine}
          currentUserName={me.name}
          shareableVas={state.vas.map((v) => v.name)}
          ackPrivateNote={ackPrivateNote}
          sharePrivateNote={sharePrivateNote}
          unsharePrivateNote={unsharePrivateNote}
          removePrivateNote={removePrivateNote}
        />
      </PageBody>
    </div>
  );
}
