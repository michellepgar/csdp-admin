"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { CONTACT_FIELDS, type ContactGroup, type NurseLeader, type OtherContact, type School } from "@/lib/app-state";
import { OtherContactsList } from "@/components/other-contacts-list";

function ContactRowView({
  group,
  row,
  groups,
  onEdit,
}: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  onEdit: () => void;
}) {
  return (
    <tr className="border-b bg-record-background">
      {CONTACT_FIELDS.map((f) => (
        <td key={f.key} className="px-2 py-2 align-top text-sm whitespace-pre-wrap">
          {row[f.key] || ""}
        </td>
      ))}
      <td className="px-2 py-2 text-right">
        <Button type="button" variant="link" size="sm" onClick={onEdit}>Edit</Button>
      </td>
    </tr>
  );
}

function ContactRowEdit({
  group,
  row,
  groups,
  schools,
  onDone,
  updateContactRow,
  removeContactRow,
}: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  schools: School[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
  removeContactRow: (formData: FormData) => void;
}) {
  /* Website/hours actually live on `schools`, matched here by name
     (same trim/lowercase match the school page itself uses to find
     its contact_rows entry -- contact_rows only ever stored a school
     NAME, never an id). A row whose name doesn't match any real
     school (typo, or a school since renamed/removed) just doesn't get
     these two fields -- nothing to save them against. */
  const matchedSchool = schools.find((s) => s.name.trim().toLowerCase() === row.school.trim().toLowerCase());

  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={CONTACT_FIELDS.length + 1} className="p-3">
        <form action={updateContactRow} onSubmit={onDone} className="space-y-2">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="rowId" value={row.id} />
          {matchedSchool && <input type="hidden" name="schoolId" value={matchedSchool.id} />}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {CONTACT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                {f.key === "notes" ? (
                  <textarea name={f.key} defaultValue={row[f.key] || ""} rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
                ) : (
                  <Input name={f.key} defaultValue={row[f.key] || ""} />
                )}
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Move to group</label>
              <Dropdown
                name="moveToGroupId"
                defaultValue={group.id}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                className="w-full rounded-md border px-2 py-1.5 text-left text-sm"
              />
            </div>
            {matchedSchool && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Website</label>
                  <Input name="website" defaultValue={matchedSchool.website || ""} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Hours</label>
                  <Input name="hours" defaultValue={matchedSchool.hours || ""} />
                </div>
              </>
            )}
          </div>
          {matchedSchool && (
            <p className="text-xs text-muted-foreground">Website/hours only show on the school&apos;s own page, not in this table.</p>
          )}
          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
            <ConfirmDeleteButton confirmMessage={`Remove ${row.school || "this row"} from Schools Contact Information?`} pendingLabel="…" variant="ghost" formAction={removeContactRow}>
              Remove
            </ConfirmDeleteButton>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function ContactsList({
  groups,
  schools,
  nurseLeader,
  otherContacts,
  addContactGroup,
  renameContactGroup,
  removeContactGroup,
  updateContactRow,
  removeContactRow,
  setNurseLeader,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
}: {
  groups: ContactGroup[];
  schools: School[];
  nurseLeader: NurseLeader;
  otherContacts: OtherContact[];
  addContactGroup: (formData: FormData) => void;
  renameContactGroup: (formData: FormData) => void;
  removeContactGroup: (formData: FormData) => void;
  updateContactRow: (formData: FormData) => void;
  removeContactRow: (formData: FormData) => void;
  setNurseLeader: (formData: FormData) => void;
  addOtherContact: (formData: FormData) => void;
  updateOtherContact: (formData: FormData) => void;
  removeOtherContact: (formData: FormData) => void;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const [editingLeader, setEditingLeader] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-3">
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

      <form action={addContactGroup} className="flex items-center gap-2">
        <Input name="name" placeholder="New group name" required className="max-w-xs" />
        <SubmitButton pendingLabel="Adding…">+ Add group</SubmitButton>
      </form>

      {groups.map((group) => (
        <div key={group.id} className="rounded-md border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            {editingGroupName === group.id ? (
              <form
                action={renameContactGroup}
                onSubmit={() => setEditingGroupName(null)}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="id" value={group.id} />
                <Input name="name" defaultValue={group.name} className="max-w-xs" />
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
          <div className="overflow-x-auto">
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
                {group.rows.length === 0 && (
                  <tr>
                    <td colSpan={CONTACT_FIELDS.length + 1} className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No schools in this group yet.
                    </td>
                  </tr>
                )}
                {group.rows.map((row) => {
                  return editingRow === row.id ? (
                    <ContactRowEdit
                      key={row.id}
                      group={group}
                      row={row}
                      groups={groups}
                      schools={schools}
                      onDone={() => setEditingRow(null)}
                      updateContactRow={updateContactRow}
                      removeContactRow={removeContactRow}
                    />
                  ) : (
                    <ContactRowView
                      key={row.id}
                      group={group}
                      row={row}
                      groups={groups}
                      onEdit={() => setEditingRow(row.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <OtherContactsList
        contacts={otherContacts}
        addOtherContact={addOtherContact}
        updateOtherContact={updateOtherContact}
        removeOtherContact={removeOtherContact}
      />
    </div>
  );
}
