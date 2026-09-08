"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CopyButton } from "@/components/copy-button";
import type { SchoolContact } from "@/lib/app-state";

type Actions = {
  addSchoolContact: (formData: FormData) => void;
  updateSchoolContact: (formData: FormData) => void;
  removeSchoolContact: (formData: FormData) => void;
};

function NurseRow({
  schoolId,
  nurse,
  updateSchoolContact,
  removeSchoolContact,
}: { schoolId: string; nurse: SchoolContact } & Pick<Actions, "updateSchoolContact" | "removeSchoolContact">) {
  const [editing, setEditing] = useState(false);
  const isLegacy = nurse.id === "__legacy__";

  if (editing) {
    return (
      <form
        action={updateSchoolContact}
        onSubmit={() => setEditing(false)}
        className="space-y-1 rounded-md border bg-muted/30 p-2 text-sm"
      >
        <input type="hidden" name="id" value={nurse.id} />
        <input type="hidden" name="schoolId" value={schoolId} />
        <input type="hidden" name="position" value="Nurse" />
        <Input name="name" defaultValue={nurse.name || ""} placeholder="Name" />
        <Input name="email" type="email" defaultValue={nurse.email} placeholder="Email" required />
        <div className="flex items-center gap-2">
          <SubmitButton pendingLabel="Saving…" size="sm">Save</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <div className="truncate">{nurse.name || "—"}</div>
        {nurse.email && (
          <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="truncate">{nurse.email}</span>
            <CopyButton value={nurse.email} />
          </div>
        )}
      </div>
      {/* The legacy fallback (a nurse name/email that predates this
          box, still living only on contact_rows -- see this file's
          own comment below) has no school_contacts row to edit/remove
          here; click + Add nurse to enter it as a real one instead. */}
      {!isLegacy && (
        <div className="flex flex-none items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          <form action={removeSchoolContact}>
            <input type="hidden" name="id" value={nurse.id} />
            <input type="hidden" name="schoolId" value={schoolId} />
            <ConfirmDeleteButton confirmMessage={`Remove ${nurse.name || "this nurse"}?`} pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
          </form>
        </div>
      )}
    </div>
  );
}

function AddNurseForm({ schoolId, addSchoolContact }: { schoolId: string } & Pick<Actions, "addSchoolContact">) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add nurse
      </Button>
    );
  }

  return (
    <form action={addSchoolContact} onSubmit={() => setOpen(false)} className="space-y-1 rounded-md border bg-muted/30 p-2 text-sm">
      <input type="hidden" name="schoolId" value={schoolId} />
      <input type="hidden" name="position" value="Nurse" />
      <Input name="name" placeholder="Name" />
      <Input name="email" type="email" placeholder="Email" required />
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Adding…" size="sm">Add</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

/* All of a school's nurses in one box -- not the generic "Additional
   Contacts" treatment (a school with two nurses isn't a "separate
   contact person", it's still just the Nurse role, twice). Backed by
   the same school_contacts rows as Additional Contacts, filtered to
   position === "Nurse" here and excluded there (see
   components/school-contacts-list.tsx) so a nurse only ever shows up
   in this one place.

   Rendered in two places: interactively (add/edit/remove) in the
   Contacts page's row edit form, and `readOnly` on the school's own
   page -- same convention Website/Address/Phone/Fax/Hours already
   follow (editable only from Contacts, just displayed here), since
   Michelle asked for the school page to only ever reflect what's
   entered on Contacts, never be a second place to edit it from.
   `readOnly` skips rendering Add/Edit/Remove entirely, so the action
   props aren't needed there (hence optional).

   `legacyNurse` covers a school whose nurse name/email was entered
   before this box existed (still just living on contact_rows, no
   school_contacts row of its own) -- shown read-only alongside any
   real entries so it isn't silently dropped, but only while there
   are zero real nurse rows; the moment a real one is added, the sync
   in lib/sync-contact-row.ts makes contact_rows' own field track the
   newest real entry instead, so the legacy value stops being distinct
   from that entry and this stops showing it separately. */
export function NurseBox({
  schoolId,
  nurses,
  legacyNurse,
  readOnly = false,
  addSchoolContact,
  updateSchoolContact,
  removeSchoolContact,
}: {
  schoolId: string;
  nurses: SchoolContact[];
  legacyNurse?: { name?: string; email?: string };
  readOnly?: boolean;
} & Partial<Actions>) {
  const showLegacy = nurses.length === 0 && legacyNurse && (legacyNurse.name || legacyNurse.email);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground">Nurse</div>
      {nurses.length === 0 && !showLegacy && <p className="text-sm text-muted-foreground">No nurse on file yet.</p>}
      {showLegacy && (
        <div className="text-sm">
          <div>{legacyNurse!.name || "—"}</div>
          {legacyNurse!.email && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="truncate">{legacyNurse!.email}</span>
              <CopyButton value={legacyNurse!.email} />
            </div>
          )}
        </div>
      )}
      {readOnly
        ? nurses.map((n) => (
            <div key={n.id} className="text-sm">
              <div>{n.name || "—"}</div>
              {n.email && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="truncate">{n.email}</span>
                  <CopyButton value={n.email} />
                </div>
              )}
            </div>
          ))
        : nurses.map((n) => (
            <NurseRow key={n.id} schoolId={schoolId} nurse={n} updateSchoolContact={updateSchoolContact!} removeSchoolContact={removeSchoolContact!} />
          ))}
      {!readOnly && <AddNurseForm schoolId={schoolId} addSchoolContact={addSchoolContact!} />}
    </div>
  );
}
