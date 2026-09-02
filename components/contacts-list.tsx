"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_FIELDS, type ContactGroup, type NurseLeader, type OtherContact, type SchoolContact } from "@/lib/app-state";
import { OtherContactsList } from "@/components/other-contacts-list";
import { SchoolContactsList } from "@/components/school-contacts-list";

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
    <tr className="border-b">
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
  schoolId,
  schoolContacts,
  onDone,
  updateContactRow,
  removeContactRow,
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
}: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  /* The real Schools-table id matching this row's school name (a
     free-text field, not a foreign key -- see lib/app-state.ts's
     ContactRow). null if no such school exists (e.g. the row predates
     school_contacts, or its name no longer matches any real school) --
     in that case the contact-person list can't be shown/edited here. */
  schoolId: string | null;
  schoolContacts: SchoolContact[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
  removeContactRow: (formData: FormData) => void;
  addSchoolContact: (formData: FormData) => void;
  updateSchoolContact: (formData: FormData) => void;
  removeSchoolContact: (formData: FormData) => void;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={CONTACT_FIELDS.length + 1} className="p-3">
        <form action={updateContactRow} onSubmit={onDone} className="space-y-2">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="rowId" value={row.id} />
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
              <select name="moveToGroupId" defaultValue={group.id} className="w-full rounded-md border px-2 py-1.5 text-sm">
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
            <SubmitButton pendingLabel="…" variant="ghost" formAction={removeContactRow}>
              Remove
            </SubmitButton>
          </div>
        </form>

        <div className="mt-3 border-t pt-3">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Contact People</div>
          {schoolId ? (
            <SchoolContactsList
              schoolId={schoolId}
              contacts={schoolContacts}
              addSchoolContact={addSchoolContact}
              updateSchoolContact={updateSchoolContact}
              removeSchoolContact={removeSchoolContact}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              No matching school found for &quot;{row.school}&quot; — contact people can only be added once this row&apos;s name matches a real school.
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ContactsList({
  groups,
  nurseLeader,
  otherContacts,
  schools,
  schoolContacts,
  addContactGroup,
  renameContactGroup,
  removeContactGroup,
  updateContactRow,
  removeContactRow,
  setNurseLeader,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
}: {
  groups: ContactGroup[];
  nurseLeader: NurseLeader;
  otherContacts: OtherContact[];
  schools: { id: string; name: string }[];
  schoolContacts: Record<string, SchoolContact[]>;
  addContactGroup: (formData: FormData) => void;
  renameContactGroup: (formData: FormData) => void;
  removeContactGroup: (formData: FormData) => void;
  updateContactRow: (formData: FormData) => void;
  removeContactRow: (formData: FormData) => void;
  setNurseLeader: (formData: FormData) => void;
  addOtherContact: (formData: FormData) => void;
  updateOtherContact: (formData: FormData) => void;
  removeOtherContact: (formData: FormData) => void;
  addSchoolContact: (formData: FormData) => void;
  updateSchoolContact: (formData: FormData) => void;
  removeSchoolContact: (formData: FormData) => void;
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
          <div className="flex items-center justify-between gap-2 border-b p-3">
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
              <SubmitButton pendingLabel="…" variant="ghost" size="sm">Remove group</SubmitButton>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
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
                  const matchedSchoolId =
                    schools.find((s) => s.name.trim().toLowerCase() === row.school.trim().toLowerCase())?.id ?? null;
                  return editingRow === row.id ? (
                    <ContactRowEdit
                      key={row.id}
                      group={group}
                      row={row}
                      groups={groups}
                      schoolId={matchedSchoolId}
                      schoolContacts={(matchedSchoolId && schoolContacts[matchedSchoolId]) || []}
                      onDone={() => setEditingRow(null)}
                      updateContactRow={updateContactRow}
                      removeContactRow={removeContactRow}
                      addSchoolContact={addSchoolContact}
                      updateSchoolContact={updateSchoolContact}
                      removeSchoolContact={removeSchoolContact}
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
