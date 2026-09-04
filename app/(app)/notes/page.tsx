import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canDeleteGeneralNote } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
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
  const notes = state.generalNotes || [];
  const deletable = notes.map((n) => ({ id: n.id, canDelete: canDeleteGeneralNote(state, n, me.name, meIsAdmin) }));

  return (
    <div>
      <PageHeader title="General Notes" />
      <PageBody>
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
          notes={notes}
          currentUserName={me.name}
          deletable={deletable}
          ackGeneralNote={ackGeneralNote}
          removeGeneralNote={removeGeneralNote}
        />
      </PageBody>
    </div>
  );
}
