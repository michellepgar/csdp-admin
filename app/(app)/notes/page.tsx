import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, canDeleteGeneralNote } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { GeneralNotesList } from "@/components/general-notes-list";
import { AddNoteForm } from "@/components/add-note-form";
import {
  addGeneralNote,
  ackGeneralNote,
  updateGeneralNote,
  removeGeneralNote,
  addGeneralNoteComment,
  editGeneralNoteComment,
  removeGeneralNoteComment,
  ackGeneralNoteComments,
} from "./actions";

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ highlightNote?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const { highlightNote } = await searchParams;
  const meIsAdmin = isAdmin(me);
  const notes = state.generalNotes || [];
  const deletable = notes.map((n) => ({ id: n.id, canDelete: canDeleteGeneralNote(state, n, me.name, meIsAdmin) }));

  return (
    <div>
      <PageHeader title="General Notes" />
      <PageBody>
        <AddNoteForm action={addGeneralNote} placeholder="Add a note…" draftKey="draft:general-note" vas={state.vas || []}>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="urgent" />
            Urgent
          </label>
        </AddNoteForm>

        <GeneralNotesList
          notes={notes}
          currentUserName={me.name}
          deletable={deletable}
          vas={state.vas || []}
          highlightNote={highlightNote}
          ackGeneralNote={ackGeneralNote}
          updateGeneralNote={updateGeneralNote}
          removeGeneralNote={removeGeneralNote}
          addGeneralNoteComment={addGeneralNoteComment}
          editGeneralNoteComment={editGeneralNoteComment}
          removeGeneralNoteComment={removeGeneralNoteComment}
          ackGeneralNoteComments={ackGeneralNoteComments}
        />
      </PageBody>
    </div>
  );
}
