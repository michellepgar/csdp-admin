import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/supabase/server";
import { fetchAppState } from "@/lib/fetch-app-state";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { findVaByEmail, isAdmin, canEditSchoolRecords, CONTACT_POSITION_GROUPS } from "@/lib/app-state";
import { ChecklistCard } from "@/components/checklist-card";
import { TasksCard } from "@/components/tasks-card";
import { EmailTrackerCard } from "@/components/email-tracker-card";
import { EmailNotesCard } from "@/components/email-notes-card";
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
  setSchoolEmailNotes,
  renameSchool,
  removeSchool,
  removeSchoolAndContacts,
} from "./actions";
import { RemoveSchoolControl } from "@/components/remove-school-control";
import { EditSchoolNameControl } from "@/components/edit-school-name-control";
import { PageBody } from "@/components/page-body";
import { CopyButton } from "@/components/copy-button";

/* A website saved as "www.school.edu" or "school.edu" (no protocol) is
   a relative link to the browser -- clicking it would try to load
   e.g. csdp-admin.vercel.app/school.edu instead of leaving the app.
   Only add https:// when a scheme isn't already there. */
function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

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

  const checklistCollapsed = (await cookies()).get("checklist-collapsed")?.value === "1";

  const contactRow = (state.contactGroups || [])
    .flatMap((g) => g.rows)
    .find((r) => r.school.trim().toLowerCase() === school.name.trim().toLowerCase());

  return (
    <div>
      {/* Sticky/background live on this row div, not on h1 itself --
          position:sticky only has "room" to stick for as long as its
          own immediate parent's box hasn't scrolled past the stick
          point. h1's immediate parent here is this row, which is
          short -- just the title/subtitle line -- so if h1 carried
          its own sticky+bg (from the global h1 rule) it would stick
          for a few dozen pixels and then scroll away with this tiny
          row, never actually staying visible. Making the row itself
          the sticky element gives it the full page's scroll range to
          stick within. h1 cancels the global rule's own sticky/
          background (static + bg-transparent + no padding) so the two
          don't stack. Spans <main>'s full width naturally since <main>
          now carries no padding of its own
          (components/sidebar-shell.tsx). pl-12 (see PageHeader's own
          comment) reserves room for the floating "show sidebar"
          button so it doesn't sit on top of the title's first letter
          when collapsed/closed. min-h-16 (not padding-driven, and not
          a hard h-16) lines this up with the sidebar's own top corner
          and every other page's header in the common case, but still
          lets the row grow past that on a narrow phone screen where a
          long school name wraps to two lines -- a hard h-16 there
          clipped nothing (no overflow-hidden) but the wrapped second
          line and the Remove button both rendered past the row's own
          box and overlapped the content below it instead of pushing
          it down, confirmed directly at a 375px viewport. */}
      <div className="sticky top-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-2 bg-header-background py-2 pr-4 pl-12 sm:pr-6 md:pr-8">
        <div className="min-w-0 flex-1">
          <h1 className="static bg-transparent px-0 py-0 text-2xl font-bold">{school.name}</h1>
          {/* text-white/80 (not text-muted-foreground) -- this sits on
              the same bold teal bg-header-background as the white h1
              text above it, where a soft gray reads as barely-visible
              instead of intentionally de-emphasized. */}
          <p className="mt-1 text-sm text-white/80">
            VA assigned: <span className="font-medium text-white">{sd.vaAssigned || "Unassigned"}</span>
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <EditSchoolNameControl schoolId={schoolId} schoolName={school.name} renameSchool={renameSchool} />
          <RemoveSchoolControl
            schoolId={schoolId}
            schoolName={school.name}
            removeSchool={removeSchool}
            removeSchoolAndContacts={removeSchoolAndContacts}
          />
        </div>
      </div>

      <PageBody>
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
          initialHidden={checklistCollapsed}
          toggleChecklistItem={toggleChecklistItem}
          addChecklistTemplateItem={addChecklistTemplateItem}
          removeChecklistTemplateItem={removeChecklistTemplateItem}
        />
      </div>

      {/* flex, matching the Tasks/Checklist row above -- Michelle
          asked for Email Notes right beside Email Tracker. */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-0">
          <EmailTrackerCard
            schoolId={schoolId}
            items={sd.emailTracker || []}
            canEdit={canEdit}
            addEmailItem={addEmailItem}
            setEmailStatus={setEmailStatus}
            removeEmailItem={removeEmailItem}
          />
        </div>
        <EmailNotesCard schoolId={schoolId} emailNotes={school.emailNotes} setSchoolEmailNotes={setSchoolEmailNotes} />
      </div>

      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b bg-title-background p-3">
          <h2 className="font-semibold">Contact Info</h2>
          <Link href="/contacts" className="text-sm text-primary underline underline-offset-2">
            Edit on Contacts page
          </Link>
        </div>
        <div className="p-3">
          {/* Everything here is read-only -- editable only from the
              Contacts page's row edit form now (see the link above).

              Three columns: Principal/Asst Principal, Front Desk/
              Nurse, then the school's own details (Website/Phone/
              Fax/Hours) -- Michelle asked for this split (previously
              two columns, before that one stacked block). */}
          {!contactRow && !school.website && !school.phone && !school.fax && !school.hours ? (
            <p className="text-sm text-muted-foreground">No contact info on file for this school yet.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {/* CONTACT_POSITION_GROUPS is Principal, Asst Principal,
                  Front Desk, Nurse in that order -- split into its
                  first/second half for these two columns rather than
                  hardcoding each position separately. */}
              {[CONTACT_POSITION_GROUPS.slice(0, 2), CONTACT_POSITION_GROUPS.slice(2, 4)].map((groups, i) => (
                <dl key={i} className="space-y-2">
                  {contactRow ? (
                    groups.map((g) => {
                      const name = contactRow[g.nameKey] || "";
                      const email = contactRow[g.emailKey] || "";
                      if (!name && !email) return null;
                      return (
                        <div key={g.label} className="text-sm">
                          <dt className="text-xs font-semibold uppercase text-muted-foreground">{g.label}</dt>
                          <dd className="truncate">{name || "—"}</dd>
                          {email && (
                            <dd className="flex min-w-0 items-center gap-1 text-muted-foreground">
                              <span className="truncate">{email}</span>
                              <CopyButton value={email} />
                            </dd>
                          )}
                        </div>
                      );
                    })
                  ) : i === 0 ? (
                    <p className="text-sm text-muted-foreground">No contact people on file yet.</p>
                  ) : null}
                  {i === 1 && contactRow?.notes && (
                    <div className="text-sm">
                      <dt className="text-xs font-semibold uppercase text-muted-foreground">Notes</dt>
                      <dd className="whitespace-pre-wrap">{contactRow.notes}</dd>
                    </div>
                  )}
                </dl>
              ))}

              <div className="space-y-2 text-sm">
                {school.website && (
                  <div className="flex items-center gap-1">
                    <span className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Website</span>
                    <a
                      href={websiteHref(school.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1 truncate text-primary underline-offset-2 hover:underline"
                    >
                      <span className="truncate">{school.website}</span>
                      <ExternalLink className="h-3.5 w-3.5 flex-none" />
                    </a>
                  </div>
                )}
                {/* Phone and Fax always share one row, next to each
                    other -- they used to just be two more items flowing
                    through a 2-column grid alongside Website/Hours,
                    which could split them apart depending on which
                    fields happened to be filled in. */}
                {(school.phone || school.fax) && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {school.phone && (
                      <div className="flex items-center gap-1">
                        <span className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Phone</span>
                        <a href={`tel:${school.phone.replace(/[^0-9+]/g, "")}`} className="text-primary underline-offset-2 hover:underline">
                          {school.phone}
                        </a>
                      </div>
                    )}
                    {school.fax && (
                      <div className="flex items-center gap-1">
                        <span className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Fax</span>
                        <span>{school.fax}</span>
                      </div>
                    )}
                  </div>
                )}
                {school.hours && (
                  <div className="flex items-baseline gap-1">
                    <span className="w-16 flex-none text-xs font-semibold uppercase text-muted-foreground">Hours</span>
                    <span className="whitespace-pre-wrap">{school.hours}</span>
                  </div>
                )}
                {!school.website && !school.phone && !school.fax && !school.hours && (
                  <p className="text-sm text-muted-foreground">No website/phone/fax/hours on file yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </PageBody>
    </div>
  );
}
