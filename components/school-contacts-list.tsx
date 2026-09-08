"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/dropdown";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CopyButton } from "@/components/copy-button";
import { CONTACT_POSITIONS, type SchoolContact } from "@/lib/app-state";

type Actions = {
  addSchoolContact: (formData: FormData) => void;
  updateSchoolContact: (formData: FormData) => void;
  removeSchoolContact: (formData: FormData) => void;
};

// Nurse isn't offered here -- a school with two nurses gets them in
// its own dedicated box (components/nurse-box.tsx) right on the
// Contact Info card, not as an entry in this generic list. Filtering
// it out of the Position choices keeps this list from becoming a
// second, competing way to add a nurse.
const NON_NURSE_POSITIONS = CONTACT_POSITIONS.filter((p) => p !== "Nurse");

/* Shared Position/Name/Email fields for both the add form and a row's
   own edit form. */
function ContactFields({
  defaultPosition = NON_NURSE_POSITIONS[0],
  defaultName = "",
  defaultEmail = "",
}: {
  defaultPosition?: string;
  defaultName?: string;
  defaultEmail?: string;
}) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Position</label>
        <Dropdown
          name="position"
          defaultValue={defaultPosition}
          options={NON_NURSE_POSITIONS.map((p) => ({ value: p, label: p }))}
          className="w-full min-w-[140px] rounded-md border px-2 py-1.5 text-left text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input name="name" defaultValue={defaultName} className="min-w-[140px]" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input name="email" type="email" defaultValue={defaultEmail} required className="min-w-[200px]" />
      </div>
    </>
  );
}

function ContactRow({
  schoolId,
  contact,
  updateSchoolContact,
  removeSchoolContact,
}: { schoolId: string; contact: SchoolContact } & Pick<Actions, "updateSchoolContact" | "removeSchoolContact">) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={updateSchoolContact}
        onSubmit={() => setEditing(false)}
        className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2"
      >
        <input type="hidden" name="id" value={contact.id} />
        <input type="hidden" name="schoolId" value={schoolId} />
        <ContactFields defaultPosition={contact.position} defaultName={contact.name || ""} defaultEmail={contact.email} />
        <SubmitButton pendingLabel="Saving…" size="sm">Save</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-record-background px-2 py-1.5 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{contact.position}</span>
        {contact.name && <span className="text-muted-foreground"> — {contact.name}</span>}
        <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <span className="truncate">{contact.email}</span>
          <CopyButton value={contact.email} />
        </div>
      </div>
      <div className="flex flex-none items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        <form action={removeSchoolContact}>
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="schoolId" value={schoolId} />
          <ConfirmDeleteButton
            confirmMessage={`Remove ${contact.name ? contact.name : `this ${contact.position}`}?`}
            pendingLabel="…"
            variant="ghost"
            size="sm"
          >
            ✕
          </ConfirmDeleteButton>
        </form>
      </div>
    </div>
  );
}

function AddContactForm({ schoolId, addSchoolContact }: { schoolId: string } & Pick<Actions, "addSchoolContact">) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add contact
      </Button>
    );
  }

  return (
    <form
      action={addSchoolContact}
      onSubmit={() => setOpen(false)}
      className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-2"
    >
      <input type="hidden" name="schoolId" value={schoolId} />
      <ContactFields />
      <SubmitButton pendingLabel="Adding…" size="sm">Add</SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  );
}

/* For a second Principal, Assistant Principal, or Front Desk contact
   at a school -- Nurse is deliberately excluded (see
   NON_NURSE_POSITIONS above); a school with two nurses gets its own
   dedicated box instead (components/nurse-box.tsx), not this generic
   list. Adding or editing an entry here also updates whichever of the
   single Principal/Asst Principal/Front Desk fields above (edited
   from the Contacts page) matches its position, to the newest entry
   for that position (see lib/sync-contact-row.ts) -- this list is for
   tracking every contact, that single field is still just "the
   current one" shown everywhere else in the app.

   Rendered interactively in the Contacts page's row edit form, and
   `readOnly` on the school's own page -- same convention NurseBox
   follows (see its own comment) since Michelle asked for the school
   page to only ever reflect what's entered on Contacts, never be a
   second place to edit it from. */
export function SchoolContactsList({
  schoolId,
  contacts,
  readOnly = false,
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
}: { schoolId: string; contacts: SchoolContact[]; readOnly?: boolean } & Partial<Actions>) {
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Additional Contacts</div>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {readOnly ? "None on file." : "For a second Principal, Assistant Principal, or Front Desk contact at this school -- add them here."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c) =>
            readOnly ? (
              <div key={c.id} className="rounded-md border bg-record-background px-2 py-1.5 text-sm">
                <span className="font-medium">{c.position}</span>
                {c.name && <span className="text-muted-foreground"> — {c.name}</span>}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="truncate">{c.email}</span>
                  <CopyButton value={c.email} />
                </div>
              </div>
            ) : (
              <ContactRow key={c.id} schoolId={schoolId} contact={c} updateSchoolContact={updateSchoolContact!} removeSchoolContact={removeSchoolContact!} />
            )
          )}
        </div>
      )}
      {!readOnly && <AddContactForm schoolId={schoolId} addSchoolContact={addSchoolContact!} />}
    </div>
  );
}
