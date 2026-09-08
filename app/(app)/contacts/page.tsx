import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { ContactsList } from "@/components/contacts-list";
import {
  renameContactGroup,
  removeContactGroup,
  updateContactRow,
  setNurseLeader,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
} from "./actions";
import { addSchoolContact, updateSchoolContact, removeSchoolContact } from "../schools/[id]/actions";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  return (
    <div>
      <PageHeader title="Schools Contact Information" />
      <PageBody>
        <ContactsList
          groups={state.contactGroups || []}
          schools={state.schools}
          schoolContacts={state.schoolContacts || {}}
          nurseLeader={state.nurseLeader || { name: "", email: "" }}
          otherContacts={state.otherContacts || []}
          renameContactGroup={renameContactGroup}
          removeContactGroup={removeContactGroup}
          updateContactRow={updateContactRow}
          setNurseLeader={setNurseLeader}
          addOtherContact={addOtherContact}
          updateOtherContact={updateOtherContact}
          removeOtherContact={removeOtherContact}
          addSchoolContact={addSchoolContact}
          updateSchoolContact={updateSchoolContact}
          removeSchoolContact={removeSchoolContact}
        />
      </PageBody>
    </div>
  );
}
