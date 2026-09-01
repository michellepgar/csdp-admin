import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { ContactsList } from "@/components/contacts-list";
import {
  addContactGroup,
  renameContactGroup,
  removeContactGroup,
  addContactRow,
  updateContactRow,
  removeContactRow,
  setNurseLeader,
} from "./actions";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schools Contact Information</h1>
      <ContactsList
        groups={state.contactGroups || []}
        nurseLeader={state.nurseLeader || { name: "", email: "" }}
        addContactGroup={addContactGroup}
        renameContactGroup={renameContactGroup}
        removeContactGroup={removeContactGroup}
        addContactRow={addContactRow}
        updateContactRow={updateContactRow}
        removeContactRow={removeContactRow}
        setNurseLeader={setNurseLeader}
      />
    </div>
  );
}
