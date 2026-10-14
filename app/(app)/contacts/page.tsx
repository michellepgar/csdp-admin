import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState, type AppPart } from "@/lib/fetch-app-state";
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

/* Only the data this page shows (see AppPart in lib/fetch-app-state.ts). */
const PARTS: AppPart[] = ["core", "contacts"];

export default async function ContactsPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState(PARTS);
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
          nurseLeader={state.nurseLeader || { name: "", email: "" }}
          otherContacts={state.otherContacts || []}
          renameContactGroup={renameContactGroup}
          removeContactGroup={removeContactGroup}
          updateContactRow={updateContactRow}
          setNurseLeader={setNurseLeader}
          addOtherContact={addOtherContact}
          updateOtherContact={updateOtherContact}
          removeOtherContact={removeOtherContact}
        />
      </PageBody>
    </div>
  );
}
