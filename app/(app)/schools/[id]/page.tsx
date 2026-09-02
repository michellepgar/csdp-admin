import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
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
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
} from "./actions";
import { SchoolContactsList } from "@/components/school-contacts-list";

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
        <div className="border-b p-3">
          <h2 className="font-semibold">Contact Info</h2>
        </div>
        <div className="space-y-4 p-3">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Website</dt>
              <dd className="whitespace-pre-wrap text-sm">{school.website || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-muted-foreground">Hours</dt>
              <dd className="whitespace-pre-wrap text-sm">{school.hours || "—"}</dd>
            </div>
          </dl>

          {!contactRow ? (
            <p className="text-sm text-muted-foreground">No contact info on file for this school yet.</p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {CONTACT_FIELDS.filter((f) => f.key !== "school").map((f) => (
                <div key={f.key}>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">{f.label}</dt>
                  <dd className="whitespace-pre-wrap text-sm">{contactRow[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Contact People</div>
            <SchoolContactsList
              schoolId={schoolId}
              contacts={(state.schoolContacts || {})[schoolId] || []}
              addSchoolContact={addSchoolContact}
              updateSchoolContact={updateSchoolContact}
              removeSchoolContact={removeSchoolContact}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
