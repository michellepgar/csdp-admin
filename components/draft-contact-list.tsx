"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_POSITIONS } from "@/lib/app-state";

export interface DraftContact {
  position: string;
  email: string;
}

/* The add-school form's contact-person list, before the school even
   exists -- entries live only in local state here, JSON-encoded into
   one hidden form field by the caller on submit (see
   app/(app)/layout-actions.ts's addSchool, which parses it back out).
   Once a school exists, its contact list is edited "live" instead via
   components/school-contacts-list.tsx -- a separate component, since
   that one calls real Server Actions per entry instead of holding a
   local draft. */
export function DraftContactList({
  contacts,
  onChange,
}: {
  contacts: DraftContact[];
  onChange: (next: DraftContact[]) => void;
}) {
  const [position, setPosition] = useState(CONTACT_POSITIONS[0]);
  const [email, setEmail] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function addOrSave() {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (editingIndex === null) {
      onChange([...contacts, { position, email: trimmed }]);
    } else {
      const next = [...contacts];
      next[editingIndex] = { position, email: trimmed };
      onChange(next);
      setEditingIndex(null);
    }
    setPosition(CONTACT_POSITIONS[0]);
    setEmail("");
  }

  function startEdit(i: number) {
    setEditingIndex(i);
    setPosition(contacts[i].position);
    setEmail(contacts[i].email);
  }

  function remove(i: number) {
    if (!window.confirm("Remove this contact person?")) return;
    onChange(contacts.filter((_, idx) => idx !== i));
    if (editingIndex === i) {
      setEditingIndex(null);
      setPosition(CONTACT_POSITIONS[0]);
      setEmail("");
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      <label className="text-xs font-medium text-muted-foreground">Contact people</label>
      {contacts.length === 0 && <p className="text-xs text-muted-foreground">None added yet.</p>}
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
          <span>{c.position} — {c.email}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(i)}>✏️</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>✕</Button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="rounded-md border px-2 py-1.5 text-sm"
        >
          {CONTACT_POSITIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-8 text-sm" />
        <Button type="button" size="sm" onClick={addOrSave}>
          {editingIndex === null ? "Add" : "Save"}
        </Button>
      </div>
    </div>
  );
}
