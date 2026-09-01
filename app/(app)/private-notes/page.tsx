import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, visiblePrivateNotes } from "@/lib/app-state";
import { PrivateNotesList } from "@/components/private-notes-list";
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Private Notes</h1>

      <form action={addPrivateNote} className="space-y-2 max-w-lg">
        <textarea
          name="text"
          placeholder="Add a private note…"
          required
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
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
    </div>
  );
}
