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
  toggleVaAdmin,
  setCommunicationEditor,
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
  const promotableVas = sortedVas.filter((v) => v.name !== SUPERADMIN_NAME && v.role !== "owner");
  const assignableVas = sortedVas.filter((v) => v.role !== "owner");

  return (
    <div>
      <PageHeader title="Team" />
      <PageBody gap={10}>
      <div className="space-y-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">VAs</div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Add / Remove VAs</h2>
          <form action={addVa} className="flex gap-2 max-w-sm">
            <Input name="name" placeholder="VA name" required />
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </form>
          <div className="space-y-2">
            {sortedVas.length === 0 && <p className="text-sm text-muted-foreground">No VAs added yet.</p>}
            {sortedVas.map((va) => (
              <div key={va.id} className="flex items-center gap-2 rounded-md border p-2">
                <span className="w-32 flex-none font-medium">
                  {va.name}
                  {va.role === "owner" && <span className="ml-1 text-xs text-muted-foreground">(Owner)</span>}
                </span>
                <form action={removeVa}>
                  <input type="hidden" name="id" value={va.id} />
                  <ConfirmDeleteButton confirmMessage={`Remove ${va.name} from the team?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Login Email</h2>
          <div className="space-y-2">
            {sortedVas.map((va) => (
              <AutoSubmitForm key={va.id} action={updateVaField} className="flex items-center gap-2">
                <span className="w-32 flex-none font-medium">{va.name}</span>
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
                  placeholder="name@example.com"
                  className="max-w-xs"
                />
              </AutoSubmitForm>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">VA Colors</h2>
          <div className="space-y-2">
            {sortedVas.map((va) => (
              <AutoSubmitForm key={va.id} action={updateVaField} className="flex items-center gap-2">
                <span className="w-32 flex-none font-medium">{va.name}</span>
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
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-8 border-t pt-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Admin Access</h2>
          <div className="space-y-2">
            {promotableVas.length === 0 && <p className="text-sm text-muted-foreground">No other VAs yet.</p>}
            {promotableVas.map((va) => (
              <AutoSubmitForm key={va.id} action={toggleVaAdmin} className="flex items-center gap-2">
                <span className="w-32 flex-none font-medium">{va.name}</span>
                <input type="hidden" name="id" value={va.id} />
                <label className="flex items-center gap-1.5 text-sm">
                  <input key={String(!!va.admin)} type="checkbox" name="admin" defaultChecked={!!va.admin} />
                  Admin
                </label>
              </AutoSubmitForm>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Communication Access</h2>
          {sortedVas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No VAs added yet.</p>
          ) : (
            <AutoSubmitDropdown
              action={setCommunicationEditor}
              name="name"
              defaultValue={state.communicationEditor || ""}
              options={sortedVas.map((va) => ({ value: va.name, label: va.name }))}
              className="rounded-md border px-3 py-2 text-left text-sm"
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">School Assignments</h2>
          <div className="space-y-2">
            {[...state.schools].sort((a, b) => a.name.localeCompare(b.name)).map((school) => {
              const sd = state.schoolData[school.id];
              return (
                <div key={school.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
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
