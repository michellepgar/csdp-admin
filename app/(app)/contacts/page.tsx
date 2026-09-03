import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { ContactsList } from "@/components/contacts-list";
import {
  addContactGroup,
  renameContactGroup,
  removeContactGroup,
  updateContactRow,
  removeContactRow,
  setNurseLeader,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
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
      <PageHeader title="Schools Contact Information" />
      <ContactsList
        groups={state.contactGroups || []}
        schools={state.schools}
        nurseLeader={state.nurseLeader || { name: "", email: "" }}
        otherContacts={state.otherContacts || []}
        addContactGroup={addContactGroup}
        renameContactGroup={renameContactGroup}
        removeContactGroup={removeContactGroup}
        updateContactRow={updateContactRow}
        removeContactRow={removeContactRow}
        setNurseLeader={setNurseLeader}
        addOtherContact={addOtherContact}
        updateOtherContact={updateOtherContact}
        removeOtherContact={removeOtherContact}
      />
    </div>
  );
}
