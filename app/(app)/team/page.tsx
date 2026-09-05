import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import { findVaByEmail, isAdmin, SUPERADMIN_NAME } from "@/lib/app-state";
import { PageHeader } from "@/components/page-header";
import { PageBody } from "@/components/page-body";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Input } from "@/components/ui/input";
import {
  addVa,
  removeVa,
  updateVaField,
  updateVaAccess,
  setSchoolAssignment,
} from "./actions";

export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) redirect("/overview");

  const sortedVas = [...state.vas].sort((a, b) => a.name.localeCompare(b.name));
  // Every VA is assignable to a school, Michelle (role "owner") included --
  // she does fieldwork too, there's no reason school assignment should be
  // the one list that leaves her out.
  const assignableVas = sortedVas;

  return (
    <div>
      <PageHeader title="Team" />
      <PageBody gap={10}>
      <div className="space-y-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">VAs</div>

        {/* Add/Remove, Login Email, VA Colors, and Access used to be
            four separate lists, each repeating every VA's name on its
            own row -- Michelle asked for them combined so a VA's
            name, email, color, and admin/communication access all
            live on the same row instead of scrolling between four
            lists to find the same person four times. Each field group
            below is still its own AutoSubmitForm (saves the moment
            that one field changes, independent of the others in the
            same row) -- only the LAYOUT is merged, not the save
            behavior.

            Michelle shows up in this list too (not excluded) -- her
            Admin box renders `disabled` (a plain visual "this is
            permanent", can't be unchecked by clicking it) with a
            hidden input carrying the real "on" value, since a
            disabled checkbox is left out of form submissions
            entirely. updateVaAccess also re-asserts this server-side
            (see app/(app)/team/actions.ts) so a crafted request
            bypassing this UI still can't remove it either. */}
        <section className="space-y-3">
          <h2 className="font-semibold">VAs</h2>
          <form action={addVa} className="flex gap-2 max-w-sm">
            <Input name="name" placeholder="VA name" required />
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
          <div className="space-y-2">
            {sortedVas.length === 0 && <p className="text-sm text-muted-foreground">No VAs added yet.</p>}
            {sortedVas.map((va) => {
              const isSuperadmin = va.name === SUPERADMIN_NAME;
              return (
                <div key={va.id} className="flex flex-wrap items-center gap-3 rounded-md border bg-record-background px-3 py-1.5">
                  <span className="w-28 flex-none font-medium">
                    {va.name}
                    {va.role === "owner" && <span className="ml-1 text-xs text-muted-foreground">(Owner)</span>}
                  </span>

                  <AutoSubmitForm action={updateVaField} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={va.id} />
                    <input type="hidden" name="field" value="email" />
                    {/* Keyed by its own current value: an uncontrolled input's
                        defaultValue only applies once, at mount — without a key
                        that changes when the saved value does, a later revalidate
                        wouldn't visibly reflect it even though the save worked. */}
                    <Input
                      key={va.email || ""}
                      name="value"
                      type="email"
                      defaultValue={va.email || ""}
                      placeholder="Login email"
                      className="h-8 w-48"
                    />
                  </AutoSubmitForm>

                  <AutoSubmitForm action={updateVaField} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={va.id} />
                    <input type="hidden" name="field" value="color" />
                    <input
                      key={va.color || "#888888"}
                      type="color"
                      name="value"
                      defaultValue={va.color || "#888888"}
                      className="h-8 w-11 rounded border"
                    />
                  </AutoSubmitForm>

                  <AutoSubmitForm action={updateVaAccess} className="flex items-center gap-3">
                    <input type="hidden" name="id" value={va.id} />
                    <label className="flex items-center gap-1.5 text-sm">
                      {isSuperadmin && <input type="hidden" name="admin" value="on" />}
                      <input
                        key={String(!!va.admin)}
                        type="checkbox"
                        name={isSuperadmin ? undefined : "admin"}
                        defaultChecked={isSuperadmin || !!va.admin}
                        disabled={isSuperadmin}
                      />
                      Admin
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input key={String(!!va.communicationAccess)} type="checkbox" name="communicationAccess" defaultChecked={!!va.communicationAccess} />
                      Communication
                    </label>
                  </AutoSubmitForm>

                  <form action={removeVa} className="ml-auto">
                    <input type="hidden" name="id" value={va.id} />
                    <ConfirmDeleteButton confirmMessage={`Remove ${va.name} from the team?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="space-y-8 border-t pt-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</div>

        <section className="space-y-3">
          <h2 className="font-semibold">School Assignments</h2>
          <div className="space-y-2">
            {[...state.schools].sort((a, b) => a.name.localeCompare(b.name)).map((school) => {
              const sd = state.schoolData[school.id];
              return (
                <div key={school.id} className="flex items-center justify-between gap-2 rounded-md border bg-record-background px-3 py-1">
                  <span className="font-medium">{school.name}</span>
                  <AutoSubmitDropdown
                    action={setSchoolAssignment}
                    hiddenFields={{ schoolId: school.id }}
                    name="vaName"
                    defaultValue={sd?.vaAssigned || ""}
                    placeholder="Unassigned"
                    options={[{ value: "", label: "Unassigned" }, ...assignableVas.map((va) => ({ value: va.name, label: va.name }))]}
                    className="rounded-md border px-3 py-1.5 text-left text-sm"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
      </PageBody>
    </div>
  );
}
