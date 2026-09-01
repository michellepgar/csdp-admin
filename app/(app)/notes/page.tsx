import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, findVaByEmail, isAdmin, canDeleteGeneralNote } from "@/lib/app-state";
import { GeneralNotesList } from "@/components/general-notes-list";
import { SubmitButton } from "@/components/submit-button";
import { addGeneralNote, ackGeneralNote, removeGeneralNote } from "./actions";

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const meIsAdmin = isAdmin(me);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">General Notes/Announcements</h1>

      <form action={addGeneralNote} className="space-y-2 max-w-lg">
        <textarea
          name="text"
          placeholder="Add a note…"
          required
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="urgent" />
            Urgent
          </label>
          <SubmitButton pendingLabel="Adding…">Add note</SubmitButton>
        </div>
      </form>

      <GeneralNotesList
        notes={state.generalNotes || []}
        currentUserName={me.name}
        canDelete={(note) => canDeleteGeneralNote(state, note, me.name, meIsAdmin)}
        ackGeneralNote={ackGeneralNote}
        removeGeneralNote={removeGeneralNote}
      />
    </div>
  );
}
