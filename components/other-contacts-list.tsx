"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OtherContact } from "@/lib/app-state";

function OtherContactView({ contact, onEdit }: { contact: OtherContact; onEdit: () => void }) {
  return (
    <tr className="border-b">
      <td className="px-2 py-2 text-sm">{contact.name}</td>
      <td className="px-2 py-2 text-sm">{contact.organization || ""}</td>
      <td className="px-2 py-2 text-sm">{contact.email || ""}</td>
      <td className="px-2 py-2 text-sm">{contact.phone || ""}</td>
      <td className="px-2 py-2 text-sm whitespace-pre-wrap">{contact.notes || ""}</td>
      <td className="px-2 py-2 text-right">
        <Button type="button" variant="link" size="sm" onClick={onEdit}>Edit</Button>
      </td>
    </tr>
  );
}

function OtherContactEdit({
  contact,
  onDone,
  updateOtherContact,
  removeOtherContact,
}: {
  contact: OtherContact;
  onDone: () => void;
  updateOtherContact: (formData: FormData) => void;
  removeOtherContact: (formData: FormData) => void;
}) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={6} className="p-3">
        <form action={updateOtherContact} onSubmit={onDone} className="space-y-2">
          <input type="hidden" name="id" value={contact.id} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input name="name" defaultValue={contact.name} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Organization</label>
              <Input name="organization" defaultValue={contact.organization || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input name="email" defaultValue={contact.email || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input name="phone" defaultValue={contact.phone || ""} />
            </div>
            <div className="space-y-1 md:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea name="notes" defaultValue={contact.notes || ""} rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
            <SubmitButton pendingLabel="…" variant="ghost" formAction={removeOtherContact}>
              Remove
            </SubmitButton>
          </div>
        </form>
      </td>
    </tr>
  );
}

/* Contacts not tied to any school (e.g. "District Office", "IT
   Support", a vendor) -- a flat list, shown separately from the
   per-school groups above since Name/Organization/Phone don't fit
   ContactRow's Principal/Asst. Principal/Front Desk/Nurse shape. */
export function OtherContactsList({
  contacts,
  addOtherContact,
  updateOtherContact,
  removeOtherContact,
}: {
  contacts: OtherContact[];
  addOtherContact: (formData: FormData) => void;
  updateOtherContact: (formData: FormData) => void;
  removeOtherContact: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="rounded-md border">
      <div className="border-b p-3">
        <h2 className="font-semibold">Other Contacts</h2>
      </div>
      <div className="space-y-3 p-3">
        <form action={addOtherContact} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <Input name="name" placeholder="Name" required className="max-w-[160px]" />
          <Input name="organization" placeholder="Organization" className="max-w-[180px]" />
          <Input name="email" placeholder="Email" className="max-w-[200px]" />
          <Input name="phone" placeholder="Phone" className="max-w-[140px]" />
          <SubmitButton pendingLabel="Adding…">+ Add contact</SubmitButton>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Organization</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No non-school contacts yet.
                  </td>
                </tr>
              )}
              {contacts.map((c) =>
                editingId === c.id ? (
                  <OtherContactEdit
                    key={c.id}
                    contact={c}
                    onDone={() => setEditingId(null)}
                    updateOtherContact={updateOtherContact}
                    removeOtherContact={removeOtherContact}
                  />
                ) : (
                  <OtherContactView key={c.id} contact={c} onEdit={() => setEditingId(c.id)} />
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
