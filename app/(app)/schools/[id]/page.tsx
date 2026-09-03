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
  setCommsStatus,
  signComms,
  removeVaFromComms,
  setNoRecheck,
  addEmailItem,
  setEmailStatus,
  removeEmailItem,
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
  const checklistProgressForSchool: Record<string, { status: string; checkedBy?: string }> = {};
  for (const item of state.checklistTemplate || []) {
    const p = state.checklistProgress[`${schoolId}:${item.id}`];
    if (p) checklistProgressForSchool[item.id] = p;
  }

  const contactRow = (state.contactGroups || [])
    .flatMap((g) => g.rows)
    .find((r) => r.school.trim().toLowerCase() === school.name.trim().toLowerCase());

  return (
    <div className="space-y-6">
      {/* Sticky/background live on this row div, not on h1 itself --
          position:sticky only has "room" to stick for as long as its
          own immediate parent's box hasn't scrolled past the stick
          point. h1's immediate parent here is this row, which (unlike
          a plain <h1> sitting directly in the space-y-6 column on
          every other page) is short -- just the title/subtitle line --
          so if h1 carried its own sticky+bg (from the global h1 rule)
          it would stick for a few dozen pixels and then scroll away
          with this tiny row, never actually staying visible. Making
          the row itself the sticky element gives it the full page's
          scroll range to stick within, since the row's parent is the
          tall space-y-6 column. h1 cancels the global rule's own
          sticky/background (static + bg-transparent + no padding) so
          the two don't stack. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md bg-header-background px-3 py-1.5">
        <div className="min-w-0 flex-1">
          <h1 className="static bg-transparent px-0 py-0 text-2xl font-bold">{school.name}</h1>
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

      {/* flex, not grid -- Yearly Checklist can collapse to just its
          header (its own "Hide" button) and shrink to that header's
          width instead of always taking a fixed half-width column;
          Tasks grows to fill whatever space that frees up. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-0">
          <TasksCard
            schoolId={schoolId}
            categories={state.taskCategories || []}
            tasks={sd.tasks || []}
            vas={state.vas}
            canEdit={canEdit}
            currentUserName={me.name}
            noRecheck={!!school.noRecheck}
            addTask={addTask}
            setTaskStatus={setTaskStatus}
            setTaskCount={setTaskCount}
            signTask={signTask}
            removeVaFromTask={removeVaFromTask}
            removeTask={removeTask}
            addTaskCategory={addTaskCategory}
            removeTaskCategory={removeTaskCategory}
            setCommsStatus={setCommsStatus}
            signComms={signComms}
            removeVaFromComms={removeVaFromComms}
            setNoRecheck={setNoRecheck}
          />
        </div>
        <ChecklistCard
          schoolId={schoolId}
          template={state.checklistTemplate || []}
          progress={checklistProgressForSchool}
          vas={state.vas}
          toggleChecklistItem={toggleChecklistItem}
          addChecklistTemplateItem={addChecklistTemplateItem}
          removeChecklistTemplateItem={removeChecklistTemplateItem}
        />
      </div>

      <EmailTrackerCard
        schoolId={schoolId}
        items={sd.emailTracker || []}
        canEdit={canEdit}
        addEmailItem={addEmailItem}
        setEmailStatus={setEmailStatus}
        removeEmailItem={removeEmailItem}
      />

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b bg-title-background p-3">
          <h2 className="font-semibold">Contact Info</h2>
          <Link href="/contacts" className="text-sm text-primary underline underline-offset-2">
            Edit on Contacts page
          </Link>
        </div>
        <div className="space-y-3 p-3">
          {/* Website/hours are the one thing still editable here --
              everything else in this card is read-only, edited on the
              Contacts page instead (see the link above). Label and
              input share one row (not stacked) to keep this card
              compact. */}
          <AutoSubmitForm action={updateSchoolDetails} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="schoolId" value={schoolId} />
            <div className="flex items-center gap-2">
              <label className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Website</label>
              <Input key={school.website || ""} name="website" defaultValue={school.website || ""} placeholder="—" className="h-7 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Hours</label>
              <Input key={school.hours || ""} name="hours" defaultValue={school.hours || ""} placeholder="—" className="h-7 text-sm" />
            </div>
          </AutoSubmitForm>

          {!contactRow ? (
            <p className="text-sm text-muted-foreground">No contact info on file for this school yet.</p>
          ) : (
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {CONTACT_FIELDS.filter((f) => f.key !== "school").map((f) => {
                const value = contactRow[f.key] || "";
                const isEmail = f.key.toLowerCase().includes("email");
                const isNotes = f.key === "notes";
                return (
                  <div key={f.key} className={`flex items-baseline gap-1 text-sm ${isNotes ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                    <dt className="flex-none text-xs font-semibold uppercase text-muted-foreground">{f.label}:</dt>
                    <dd className={`flex min-w-0 items-center gap-1 ${isNotes ? "whitespace-pre-wrap" : "truncate"}`}>
                      {value || "—"}
                      {isEmail && value && <CopyButton value={value} />}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
