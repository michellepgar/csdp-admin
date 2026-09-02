import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import Link from "next/link";
import { findVaByEmail, isAdmin, canEditSchoolRecords, CONTACT_FIELDS } from "@/lib/app-state";
import { ChecklistCard } from "@/components/checklist-card";
import { TasksCard } from "@/components/tasks-card";
import { EmailTrackerCard } from "@/components/email-tracker-card";
import {
  toggleChecklistItem,
  addChecklistTemplateItem,
  removeChecklistTemplateItem,
  addTask,
  setTaskStatus,
  setTaskCount,
  signTask,
  removeVaFromTask,
  removeTask,
  addTaskCategory,
  removeTaskCategory,
  addEmailItem,
  setEmailStatus,
  removeEmailItem,
  requestRemoval,
  updateSchoolDetails,
  removeSchool,
  removeSchoolAndContacts,
} from "./actions";
import { RemoveSchoolControl } from "@/components/remove-school-control";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await params;

  const user = await getCurrentUser();
  if (!user || !user.email) redirect("/login");

  const state = await fetchAppState();
  if (!state) return <p className="text-muted-foreground">Couldn&apos;t load the app — try reloading.</p>;

  const me = findVaByEmail(state, user.email);
  if (!me) redirect("/not-on-team");

  const school = state.schools.find((s) => s.id === schoolId);
  if (!school) notFound();

  const sd = state.schoolData[schoolId] || { vaAssigned: "" };
  const canEdit = canEditSchoolRecords(sd, me.name, isAdmin(me));
  const doneIds = (state.checklistTemplate || [])
    .filter((item) => {
      const p = state.checklistProgress[`${schoolId}:${item.id}`];
      return p && p.status === "Done";
    })
    .map((item) => item.id);

  const contactRow = (state.contactGroups || [])
    .flatMap((g) => g.rows)
    .find((r) => r.school.trim().toLowerCase() === school.name.trim().toLowerCase());

  const myPendingRequestTargetIds = (state.accessRequests || [])
    .filter((r) => r.schoolId === schoolId && r.requestedBy === me.name && r.status === "pending")
    .map((r) => r.targetId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{school.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            VA assigned: <span className="font-medium text-foreground">{sd.vaAssigned || "Unassigned"}</span>
          </p>
        </div>
        <RemoveSchoolControl
          schoolId={schoolId}
          schoolName={school.name}
          removeSchool={removeSchool}
          removeSchoolAndContacts={removeSchoolAndContacts}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TasksCard
          schoolId={schoolId}
          categories={state.taskCategories || []}
          tasks={sd.tasks || []}
          canEdit={canEdit}
          currentUserName={me.name}
          pendingRemovalRequestIds={myPendingRequestTargetIds}
          addTask={addTask}
          setTaskStatus={setTaskStatus}
          setTaskCount={setTaskCount}
          signTask={signTask}
          removeVaFromTask={removeVaFromTask}
          removeTask={removeTask}
          requestRemoval={requestRemoval}
          addTaskCategory={addTaskCategory}
          removeTaskCategory={removeTaskCategory}
        />
        <ChecklistCard
          schoolId={schoolId}
          template={state.checklistTemplate || []}
          doneIds={doneIds}
          canCheckOff={!!sd.vaAssigned && sd.vaAssigned === me.name}
          vaAssigned={sd.vaAssigned}
          toggleChecklistItem={toggleChecklistItem}
          addChecklistTemplateItem={addChecklistTemplateItem}
          removeChecklistTemplateItem={removeChecklistTemplateItem}
        />
      </div>

      <EmailTrackerCard
        schoolId={schoolId}
        items={sd.emailTracker || []}
        canEdit={canEdit}
        pendingRemovalRequestIds={myPendingRequestTargetIds}
        addEmailItem={addEmailItem}
        setEmailStatus={setEmailStatus}
        removeEmailItem={removeEmailItem}
        requestRemoval={requestRemoval}
      />

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold">Contact Info</h2>
          <Link href="/contacts" className="text-sm text-primary underline underline-offset-2">
            Edit on Contacts page
          </Link>
        </div>
        <div className="space-y-4 p-3">
          {/* Website/hours are the one thing still editable here --
              everything else in this card is read-only, edited on the
              Contacts page instead (see the link above). */}
          <AutoSubmitForm action={updateSchoolDetails} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="schoolId" value={schoolId} />
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Website</label>
              <Input key={school.website || ""} name="website" defaultValue={school.website || ""} placeholder="—" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Hours</label>
              <Input key={school.hours || ""} name="hours" defaultValue={school.hours || ""} placeholder="—" className="h-8 text-sm" />
            </div>
          </AutoSubmitForm>

          {!contactRow ? (
            <p className="text-sm text-muted-foreground">No contact info on file for this school yet.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {CONTACT_FIELDS.filter((f) => f.key !== "school").map((f) => {
                const value = contactRow[f.key] || "";
                const isEmail = f.key.toLowerCase().includes("email");
                return (
                  <div key={f.key}>
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">{f.label}</dt>
                    <dd className="flex items-center gap-1 whitespace-pre-wrap text-sm">
                      {value || "—"}
                      {isEmail && value && <CopyButton value={value} />}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Contact People</div>
            {(state.schoolContacts?.[schoolId] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No contact people added yet.</p>
            ) : (
              <div className="space-y-2">
                {(state.schoolContacts?.[schoolId] || []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
                    <span>{c.position} — {c.email}</span>
                    <CopyButton value={c.email} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
