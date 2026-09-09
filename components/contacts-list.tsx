"use client";

import { Fragment, useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { Dropdown } from "@/components/dropdown";
import { CONTACT_FIELDS, CONTACT_POSITION_GROUPS, type ContactGroup, type NurseLeader, type OtherContact, type School } from "@/lib/app-state";
import { OtherContactsList } from "@/components/other-contacts-list";

type RowMode = "compact" | "detail" | "edit";

/* Row stays visible and the edit form (or the read-only detail panel)
   opens as an ADDITIONAL sibling row below it -- same accordion
   pattern, and now the same Show(eye)/Edit(pencil) icon pair, as
   Distribution List (components/distribution-list.tsx), which
   Michelle asked this page to match. Clicking the active icon again
   closes its panel back to compact, exactly like that pattern. */
function ContactRowView({
  row,
  activeMode,
  onShowDetail,
  onEdit,
}: {
  row: ContactGroup["rows"][number];
  activeMode: RowMode;
  onShowDetail: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className={`border-b bg-record-background ${activeMode !== "compact" ? "border-b-0" : ""}`}>
      {CONTACT_FIELDS.map((f) => (
        <td key={f.key} className="px-2 py-2 align-top text-sm whitespace-pre-wrap">
          {row[f.key] || ""}
        </td>
      ))}
      <td className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={activeMode === "detail" ? "Hide details" : "Show details"}
            aria-pressed={activeMode === "detail"}
            className={activeMode === "detail" ? "text-primary" : ""}
            onClick={onShowDetail}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={activeMode === "edit" ? "Close edit" : "Edit"}
            aria-pressed={activeMode === "edit"}
            className={activeMode === "edit" ? "text-primary" : ""}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* Read-only -- just the school-level fields (Website/Address/Phone/
   Fax/Hours) that the compact row above never shows (they only ever
   lived in the Edit form until now). Everything else on the compact
   row already covers the contact people, so this is only for the one
   thing that isn't visible without opening Edit. */
function ContactRowDetail({
  row,
  schools,
  onDone,
  onEdit,
}: {
  row: ContactGroup["rows"][number];
  schools: School[];
  onDone: () => void;
  onEdit: () => void;
}) {
  const matchedSchool = schools.find((s) => s.name.trim().toLowerCase() === row.school.trim().toLowerCase());
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={CONTACT_FIELDS.length + 1} className="p-3">
        <div className="space-y-3 text-sm">
          {matchedSchool ? (
            <>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Website</dt>
                  <dd>{matchedSchool.website || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Address</dt>
                  <dd className="whitespace-pre-wrap">{matchedSchool.address || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Phone</dt>
                  <dd>{matchedSchool.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Fax</dt>
                  <dd>{matchedSchool.fax || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Hours</dt>
                  <dd className="whitespace-pre-wrap">{matchedSchool.hours || "—"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground">
              This row&apos;s school name (&quot;{row.school}&quot;) doesn&apos;t match a real school, so there&apos;s no website/address/phone/fax/hours to show.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>Edit</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>Close</Button>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* Just the form -- no tr/td wrapper -- so both the desktop table row
   (ContactRowEdit below) and the mobile card list (ContactRowCard)
   can share the exact same edit form instead of two copies drifting
   apart. */
function ContactRowEditForm({
  group,
  row,
  groups,
  schools,
  onDone,
  updateContactRow,
}: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  schools: School[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
}) {
  /* Website/hours actually live on `schools`, matched here by name
     (same trim/lowercase match the school page itself uses to find
     its contact_rows entry -- contact_rows only ever stored a school
     NAME, never an id). A row whose name doesn't match any real
     school (typo, or a school since renamed/removed) just doesn't get
     these two fields -- nothing to save them against. */
  const matchedSchool = schools.find((s) => s.name.trim().toLowerCase() === row.school.trim().toLowerCase());

  return (
    <form action={updateContactRow} onSubmit={onDone} className="space-y-2">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="rowId" value={row.id} />
          {matchedSchool && <input type="hidden" name="schoolId" value={matchedSchool.id} />}
          {/* School name + which group it's in, together up top -- these
              two are the row's own identity, not a "contact person"
              or "school info" field. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">School</label>
              <Input name="school" defaultValue={row.school || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Move to group</label>
              <Dropdown
                name="moveToGroupId"
                defaultValue={group.id}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                className="w-full rounded-md border px-2 py-1.5 text-left text-sm"
              />
            </div>
          </div>

          {/* Each contact person's name and email side by side --
              CONTACT_POSITION_GROUPS pairs them by position for exactly
              this (see its own comment in lib/app-state.ts). A 2-column
              grid keeps every pair on the same row regardless of how
              many rows there are, which a 3-column grid couldn't (an
              even number of fields per person split unevenly across an
              odd column count, so Front Desk's email used to land on
              the NEXT row instead of next to Front Desk's name).

              Nurse is excluded from this grid -- it gets its own
              multi-line textareas right below instead of a single-line
              Input, since a school can have more than one nurse. */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Contact People</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CONTACT_POSITION_GROUPS.filter((g) => g.label !== "Nurse").map((g) => (
                <Fragment key={g.label}>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{g.label}</label>
                    <Input name={g.nameKey} defaultValue={row[g.nameKey] || ""} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{g.label} Email</label>
                    <Input name={g.emailKey} defaultValue={row[g.emailKey] || ""} />
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Nurse: one name per line, matched by line number to the
              same line in Nurse Email -- a second (or third) nurse is
              just another line, not a separate add/edit/remove entry
              (tried that first; Michelle asked for this instead, "one
              box" you can see every name in at a glance). Same
              multi-line convention Hours already uses further down. */}
          <div className="space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Nurse</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nurse Name</label>
                <textarea
                  name="nurseName"
                  defaultValue={row.nurseName || ""}
                  rows={3}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nurse Email</label>
                <textarea
                  name="nurseEmail"
                  defaultValue={row.nurseEmail || ""}
                  rows={3}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea name="notes" defaultValue={row.notes || ""} rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
          </div>

          {/* School-level fields, grouped in their own section separate
              from the contact people above -- these live on `schools`,
              not this contact_rows entry (see the comment at the top of
              this component), and only ever show on the school's own
              page. */}
          {matchedSchool && (
            <div className="space-y-2 border-t pt-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">School Info</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Website</label>
                  <Input name="website" defaultValue={matchedSchool.website || ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Address</label>
                  <Input name="address" defaultValue={matchedSchool.address || ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Phone</label>
                  <PhoneInput name="phone" defaultValue={matchedSchool.phone || ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fax</label>
                  <PhoneInput name="fax" defaultValue={matchedSchool.fax || ""} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hours (grade-level hours, one per line)</label>
                <textarea
                  name="hours"
                  defaultValue={matchedSchool.hours || ""}
                  rows={4}
                  className="w-full rounded-md border px-2 py-1 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">Website/address/phone/fax/hours only show on the school&apos;s own page, not in this table.</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
          </div>
        </form>
  );
}

/* Desktop-only: wraps ContactRowEditForm in the tr/td an accordion row
   needs inside the table. */
function ContactRowEdit(props: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  schools: School[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={CONTACT_FIELDS.length + 1} className="p-3">
        <ContactRowEditForm {...props} />
      </td>
    </tr>
  );
}

/* Mobile-only: one row's compact fields as a card instead of a table
   row -- CONTACT_FIELDS' ten columns plus Show/Edit have nowhere to go
   on a phone-width screen without horizontal scrolling. Unlike the
   desktop table (which has a separate Show toggle for the school-level
   fields), this card always includes them when a matched school
   exists -- there's no compact-vs-detail distinction worth keeping once
   everything's already stacking vertically. */
function ContactRowCard({
  row,
  schools,
  mode,
  onEdit,
  group,
  groups,
  onDone,
  updateContactRow,
}: {
  row: ContactGroup["rows"][number];
  schools: School[];
  mode: RowMode;
  onEdit: () => void;
  group: ContactGroup;
  groups: ContactGroup[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
}) {
  const matchedSchool = schools.find((s) => s.name.trim().toLowerCase() === row.school.trim().toLowerCase());

  if (mode === "edit") {
    return (
      <div className="rounded-md border bg-muted/30 p-3">
        <ContactRowEditForm
          group={group}
          row={row}
          groups={groups}
          schools={schools}
          onDone={onDone}
          updateContactRow={updateContactRow}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-record-background p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{row.school}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      {CONTACT_POSITION_GROUPS.map((g) => {
        const name = row[g.nameKey];
        const email = row[g.emailKey];
        if (!name && !email) return null;
        return (
          <div key={g.label}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">{g.label}</div>
            <div className="whitespace-pre-wrap">{name || "—"}</div>
            {email && <div className="whitespace-pre-wrap text-muted-foreground">{email}</div>}
          </div>
        );
      })}
      {row.notes && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Notes</div>
          <div className="whitespace-pre-wrap">{row.notes}</div>
        </div>
      )}
      {matchedSchool && (
        <div className="space-y-1 border-t pt-2">
          {matchedSchool.website && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Website</div>
              <div>{matchedSchool.website}</div>
            </div>
          )}
          {matchedSchool.address && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Address</div>
              <div className="whitespace-pre-wrap">{matchedSchool.address}</div>
            </div>
          )}
          {(matchedSchool.phone || matchedSchool.fax) && (
            <div className="grid grid-cols-2 gap-2">
              {matchedSchool.phone && (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Phone</div>
                  <div>{matchedSchool.phone}</div>
                </div>
              )}
              {matchedSchool.fax && (
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Fax</div>
                  <div>{matchedSchool.fax}</div>
                </div>
              )}
            </div>
          )}
          {matchedSchool.hours && (
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Hours</div>
              <div className="whitespace-pre-wrap">{matchedSchool.hours}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ContactsList({
  groups,
  schools,
  nurseLeader,
  otherContacts,
  renameContactGroup,
  removeContactGroup,
  updateContactRow,
  setNurseLeader,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
}: {
  groups: ContactGroup[];
  schools: School[];
  nurseLeader: NurseLeader;
  otherContacts: OtherContact[];
  renameContactGroup: (formData: FormData) => void;
  removeContactGroup: (formData: FormData) => void;
  updateContactRow: (formData: FormData) => void;
  setNurseLeader: (formData: FormData) => void;
  addOtherContact: (formData: FormData) => void;
  updateOtherContact: (formData: FormData) => void;
  removeOtherContact: (formData: FormData) => void;
}) {
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({});
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editingLeader, setEditingLeader] = useState(false);

  function setMode(rowId: string, mode: RowMode) {
    setRowModes((prev) => ({ ...prev, [rowId]: mode }));
  }

  return (
    <div className="space-y-6">
      {/* No manual "+ Add group" here anymore -- Michelle asked for it
          gone since a group is already created automatically the
          moment a school is added with that group picked (see
          createSchool/findOrCreateGroupByName in
          app/(app)/layout-actions.ts), so a separate manual path was
          redundant. */}
      <div className="rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Nurse Leader</span>
          {editingLeader ? (
            <form
              action={setNurseLeader}
              onSubmit={() => setEditingLeader(false)}
              className="flex flex-wrap items-center gap-2"
            >
              <Input name="name" placeholder="Name" defaultValue={nurseLeader.name} className="max-w-[160px]" />
              <Input name="email" placeholder="Email" defaultValue={nurseLeader.email} className="max-w-[220px]" />
              <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
            </form>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {nurseLeader.name}
                {nurseLeader.name && nurseLeader.email ? " — " : ""}
                {nurseLeader.email}
              </span>
              <Button type="button" variant="link" size="sm" onClick={() => setEditingLeader(true)}>Edit</Button>
            </>
          )}
        </div>
      </div>

      {groups.map((group) => {
        // Always alphabetical by school name, regardless of the order
        // schools were added in (sort_order in the database just
        // reflects insertion order) -- Michelle asked for this to be
        // automatic, not something anyone has to maintain by hand.
        // localeCompare with numeric:true so e.g. "School 2" sorts
        // before "School 10", not after it.
        const sortedRows = [...group.rows].sort((a, b) => a.school.localeCompare(b.school, undefined, { numeric: true, sensitivity: "base" }));
        return (
        <div key={group.id} className="rounded-md border bg-card">
          {/* bg-header-background + text-white -- Michelle asked for the
              group name's own background to match the PAGE title's
              color (the h1 bar at the very top), not the softer
              bg-title-background every other section header uses.
              White text for the same reason h1 itself uses white --
              this saturated a teal doesn't read well with the usual
              dark text. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-header-background px-3 py-1 text-white">
            {editingGroupName === group.id ? (
              <form
                action={renameContactGroup}
                onSubmit={() => setEditingGroupName(null)}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="id" value={group.id} />
                <Input name="name" defaultValue={group.name} className="max-w-xs bg-background text-foreground" />
                <SubmitButton pendingLabel="…">✓</SubmitButton>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{group.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGroupName(group.id)}>✏️</Button>
              </div>
            )}
            <form action={removeContactGroup}>
              <input type="hidden" name="id" value={group.id} />
              <ConfirmDeleteButton confirmMessage={`Remove the "${group.name}" group and all its schools from Contacts?`} pendingLabel="…" variant="ghost" size="sm">Remove group</ConfirmDeleteButton>
            </form>
          </div>
          {/* Table on sm and up; a stacked card list below sm (see
              ContactRowCard's own comment) -- CONTACT_FIELDS' ten
              columns have no way to fit a phone-width screen even at
              minimum padding, so this is a real second layout, not
              just a narrower version of the same one. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
                  {CONTACT_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-2">{f.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={CONTACT_FIELDS.length + 1} className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No schools in this group yet.
                    </td>
                  </tr>
                )}
                {sortedRows.map((row) => {
                  const mode = rowModes[row.id] || "compact";
                  return (
                    <Fragment key={row.id}>
                      <ContactRowView
                        row={row}
                        activeMode={mode}
                        onShowDetail={() => setMode(row.id, mode === "detail" ? "compact" : "detail")}
                        onEdit={() => setMode(row.id, mode === "edit" ? "compact" : "edit")}
                      />
                      {mode === "detail" && (
                        <ContactRowDetail
                          row={row}
                          schools={schools}
                          onDone={() => setMode(row.id, "compact")}
                          onEdit={() => setMode(row.id, "edit")}
                        />
                      )}
                      {mode === "edit" && (
                        <ContactRowEdit
                          group={group}
                          row={row}
                          groups={groups}
                          schools={schools}
                          onDone={() => setMode(row.id, "compact")}
                          updateContactRow={updateContactRow}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-2 sm:hidden">
            {sortedRows.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">No schools in this group yet.</p>
            )}
            {sortedRows.map((row) => {
              const mode = rowModes[row.id] || "compact";
              return (
                <ContactRowCard
                  key={row.id}
                  row={row}
                  schools={schools}
                  mode={mode}
                  onEdit={() => setMode(row.id, mode === "edit" ? "compact" : "edit")}
                  group={group}
                  groups={groups}
                  onDone={() => setMode(row.id, "compact")}
                  updateContactRow={updateContactRow}
                />
              );
            })}
          </div>
        </div>
        );
      })}

      <OtherContactsList
        contacts={otherContacts}
        addOtherContact={addOtherContact}
        updateOtherContact={updateOtherContact}
        removeOtherContact={removeOtherContact}
      />
    </div>
  );
}
