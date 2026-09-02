"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_POSITIONS, type SchoolContact } from "@/lib/app-state";

/* The contact-person list on a school's own page -- editable anytime.
   The sidebar's add-school form no longer collects contacts directly;
   it offers "Add + contact info now" (redirects here right after
   creation, via addSchoolAndOpen) or "add later" (stays on the
   sidebar, fill this in whenever). Every add/edit/delete here is a
   real Server Action call, each of which re-syncs the matching
   contact_rows email column server-side (see
   app/(app)/schools/[id]/actions.ts). */
export function SchoolContactsList({
  schoolId,
  contacts,
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
}: {
  schoolId: string;
  contacts: SchoolContact[];
  addSchoolContact: (formData: FormData) => void;
  updateSchoolContact: (formData: FormData) => void;
  removeSchoolContact: (formData: FormData) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contact people added yet.</p>}
      {contacts.map((c) =>
        editingId === c.id ? (
          <AutoSubmitForm key={c.id} action={updateSchoolContact} className="flex items-center gap-1">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="schoolId" value={schoolId} />
            <select name="position" defaultValue={c.position} className="rounded-md border px-2 py-1.5 text-sm">
              {CONTACT_POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <Input name="email" defaultValue={c.email} className="h-8 text-sm" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
              Done
            </Button>
          </AutoSubmitForm>
        ) : (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
            <span>{c.position} — {c.email}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(c.id)}>✏️</Button>
              <form action={removeSchoolContact}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="schoolId" value={schoolId} />
                <ConfirmDeleteButton
                  confirmMessage={`Remove ${c.position} (${c.email})?`}
                  pendingLabel="…"
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </ConfirmDeleteButton>
              </form>
            </div>
          </div>
        )
      )}
      <form action={addSchoolContact} className="flex items-center gap-1">
        <input type="hidden" name="schoolId" value={schoolId} />
        <select name="position" defaultValue={CONTACT_POSITIONS[0]} className="rounded-md border px-2 py-1.5 text-sm">
          {CONTACT_POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Input name="email" placeholder="Email" required className="h-8 text-sm" />
        <SubmitButton pendingLabel="Adding…" size="sm">+ Add</SubmitButton>
      </form>
    </div>
  );
}
