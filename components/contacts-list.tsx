"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_FIELDS, type ContactGroup, type NurseLeader, type OtherContact } from "@/lib/app-state";
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
  onDone,
  updateContactRow,
  removeContactRow,
}: {
  group: ContactGroup;
  row: ContactGroup["rows"][number];
  groups: ContactGroup[];
  onDone: () => void;
  updateContactRow: (formData: FormData) => void;
  removeContactRow: (formData: FormData) => void;
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
