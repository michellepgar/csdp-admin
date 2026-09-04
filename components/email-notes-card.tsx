"use client";

import { AutoSubmitForm } from "@/components/auto-submit-form";

/* One free-text note per school about its email situation -- sits
   beside Email Tracker on the school page (Michelle asked for it
   there specifically). Auto-saves on blur (AutoSubmitForm submits on
   its wrapped field's "change" event), same as every other simple
   autosave field in this app -- no separate Save button needed. */
export function EmailNotesCard({
  schoolId,
  emailNotes,
  setSchoolEmailNotes,
}: {
  schoolId: string;
  emailNotes?: string;
  setSchoolEmailNotes: (formData: FormData) => void;
}) {
  return (
    <div className="min-w-0 flex-1 basis-0 rounded-md border bg-card">
      <div className="flex items-center gap-2 border-b bg-header-background px-3 py-1 text-white">
        <h2 className="font-semibold">Email Notes</h2>
      </div>
      <div className="p-3">
        <AutoSubmitForm action={setSchoolEmailNotes}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <textarea
            key={emailNotes || ""}
            name="emailNotes"
            defaultValue={emailNotes || ""}
            placeholder="Notes about this school's email situation…"
            rows={4}
            className="w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </AutoSubmitForm>
      </div>
    </div>
  );
}
