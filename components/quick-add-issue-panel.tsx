"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Feedback, Field } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { ISSUE_TYPE_LABELS, type IssueType } from "@/lib/app-state";

const BUILT_IN_TYPES = Object.keys(ISSUE_TYPE_LABELS) as IssueType[];

/* Report an issue: the same types and fields as the Issues page (the three
   built-in ones plus any the team added there), with the type picked from
   chips instead of a dropdown. Category and type editing stay on the Issues
   page. A type the team added takes a description and an optional note. */
export function QuickAddIssuePanel({ data }: { data: QuickAddData }) {
  const { issueCategories, issueTypes, addIssue } = data;
  // A built-in type's key, or "custom:<id>" for one the team added.
  const [type, setType] = useState<string>("software_issue");
  const [categoryName, setCategoryName] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [school, setSchool] = useState("");
  const [studentName, setStudentName] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const selectedCategory = issueCategories.find((c) => c.name === categoryName);
  const customType = issueTypes.find((t) => `custom:${t.id}` === type);
  const typeLabel = customType ? customType.name : ISSUE_TYPE_LABELS[type as IssueType];

  const ready =
    type === "software_issue" || customType ? description.trim().length > 0
    : link.trim().length > 0;

  function build(): FormData {
    const form = new FormData();
    form.set("type", customType ? "custom" : type);
    if (customType) {
      form.set("customTypeId", customType.id);
      form.set("description", description.trim());
      form.set("note", note.trim());
    } else if (type === "software_issue") {
      form.set("description", description.trim());
      form.set("category", categoryName);
      if (subcategory) form.set("subcategory", subcategory);
      form.set("note", note.trim());
    } else {
      // correction (Review Patient Information) and charting (Charting
      // Questions) -- same shape, filed to different sections.
      form.set("school", school.trim());
      form.set("studentName", studentName.trim());
      form.set("studentRecordLink", link.trim());
      form.set("note", note.trim());
    }
    return form;
  }

  function clear() {
    setDescription("");
    setNote("");
    setSchool("");
    setStudentName("");
    setLink("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors([]);
    setAdded(null);
    try {
      await addIssue(build());
      clear();
      setAdded(`${typeLabel} reported. It's on the Issues page.`);
    } catch {
      setErrors(["The issue could not be saved. Please refresh and try again."]);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Type">
        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_TYPES.map((t) => (
            <Chip key={t} on={type === t} onClick={() => { setType(t); setAdded(null); setErrors([]); }}>
              {ISSUE_TYPE_LABELS[t]}
            </Chip>
          ))}
          {issueTypes.map((t) => (
            <Chip key={t.id} on={type === `custom:${t.id}`} onClick={() => { setType(`custom:${t.id}`); setAdded(null); setErrors([]); }}>
              {t.name}
            </Chip>
          ))}
        </div>
      </Field>

      {customType && (
        <>
          <Field label="Describe it">
            <Input autoFocus value={description} onChange={(e) => { setDescription(e.target.value); setAdded(null); }} placeholder={`Describe the ${customType.name.toLowerCase()}`} />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else worth knowing" />
          </Field>
        </>
      )}

      {type === "software_issue" && (
        <>
          {issueCategories.length > 0 && (
            <Field label="Category (optional)">
              <div className="flex flex-wrap gap-1.5">
                {issueCategories.map((c) => (
                  <Chip key={c.id} on={categoryName === c.name} onClick={() => { setCategoryName(categoryName === c.name ? "" : c.name); setSubcategory(""); }}>
                    {c.name}
                  </Chip>
                ))}
              </div>
              {selectedCategory && selectedCategory.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedCategory.subcategories.map((s) => (
                    <Chip key={s.id} on={subcategory === s.name} onClick={() => setSubcategory(subcategory === s.name ? "" : s.name)}>
                      {s.name}
                    </Chip>
                  ))}
                </div>
              )}
            </Field>
          )}
          <Field label="What's the issue?">
            <Input autoFocus value={description} onChange={(e) => { setDescription(e.target.value); setAdded(null); }} placeholder="Describe the issue" />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else worth knowing" />
          </Field>
        </>
      )}

      {(type === "correction" || type === "charting") && (
        <>
          <Field label="School">
            <Input autoFocus value={school} onChange={(e) => setSchool(e.target.value)} placeholder="School" />
          </Field>
          <Field label="Name">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Name" />
          </Field>
          <Field label="Link to student record">
            <Input value={link} onChange={(e) => { setLink(e.target.value); setAdded(null); }} placeholder="Paste the link" />
          </Field>
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else worth knowing" />
          </Field>
        </>
      )}

      <Feedback errors={errors} added={added} />
      <div className="flex justify-end">
        <Button type="submit" disabled={!ready || busy}>{busy ? "Reporting…" : "Report issue"}</Button>
      </div>
    </form>
  );
}
