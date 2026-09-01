import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAppState, findVaByEmail, isAdmin, SUPERADMIN_NAME } from "@/lib/app-state";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Button } from "@/components/ui/button";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me || !isAdmin(me)) redirect("/overview");

  const sortedVas = [...state.vas].sort((a, b) => a.name.localeCompare(b.name));
  const promotableVas = sortedVas.filter((v) => v.name !== SUPERADMIN_NAME && v.role !== "owner");
  const assignableVas = sortedVas.filter((v) => v.role !== "owner");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Team</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">VAs</h2>
        <form action={addVa} className="flex gap-2 max-w-sm">
          <Input name="name" placeholder="VA name" required />
          <Button type="submit">Add</Button>
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
                <Button type="submit" variant="ghost" size="sm">✕</Button>
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
              <Input name="value" type="email" defaultValue={va.email || ""} placeholder="name@example.com" className="max-w-xs" />
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
              <input type="color" name="value" defaultValue={va.color || "#888888"} className="h-8 w-11 rounded border" />
            </AutoSubmitForm>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Admin</h2>
        <div className="space-y-2">
          {promotableVas.length === 0 && <p className="text-sm text-muted-foreground">No other VAs yet.</p>}
          {promotableVas.map((va) => (
            <AutoSubmitForm key={va.id} action={toggleVaAdmin} className="flex items-center gap-2">
              <span className="w-32 flex-none font-medium">{va.name}</span>
              <input type="hidden" name="id" value={va.id} />
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="admin" defaultChecked={!!va.admin} />
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
          <AutoSubmitForm action={setCommunicationEditor}>
            <select name="name" defaultValue={state.communicationEditor || ""} className="rounded-md border px-3 py-2 text-sm">
              {sortedVas.map((va) => (
                <option key={va.id} value={va.name}>{va.name}</option>
              ))}
            </select>
          </AutoSubmitForm>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">School Assignments</h2>
        <div className="space-y-2">
          {[...state.schools].sort((a, b) => a.name.localeCompare(b.name)).map((school) => {
            const sd = state.schoolData[school.id];
            return (
              <AutoSubmitForm key={school.id} action={setSchoolAssignment} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <span className="font-medium">{school.name}</span>
                <input type="hidden" name="schoolId" value={school.id} />
                <select name="vaName" defaultValue={sd?.vaAssigned || ""} className="rounded-md border px-3 py-1.5 text-sm">
                  <option value="">Unassigned</option>
                  {assignableVas.map((va) => (
                    <option key={va.id} value={va.name}>{va.name}</option>
                  ))}
                </select>
              </AutoSubmitForm>
            );
          })}
        </div>
      </section>
    </div>
  );
}
