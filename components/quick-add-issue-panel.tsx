"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Feedback, Field } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { CORRECTION_KINDS, ISSUE_TYPE_LABELS, type IssueType } from "@/lib/app-state";

const TYPES = Object.keys(ISSUE_TYPE_LABELS) as IssueType[];

/* Report an issue: the same three types and fields as the Issues page, with
   the type picked from chips instead of a dropdown. Category editing stays on
   the Issues page. */
export function QuickAddIssuePanel({ data }: { data: QuickAddData }) {
  const { issueCategories, addIssue } = data;
  const [type, setType] = useState<IssueType>("software_issue");
  const [categoryName, setCategoryName] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState(CORRECTION_KINDS[0]);
  const [link, setLink] = useState("");
  const [needs, setNeeds] = useState({ name: false, dob: false, insurance: false, other: false });
  const [otherDetail, setOtherDetail] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const selectedCategory = issueCategories.find((c) => c.name === categoryName);

  const ready =
    type === "software_issue" ? description.trim().length > 0
    : type === "correction" ? link.trim().length > 0
    : link.trim().length > 0 && question.trim().length > 0;

  function build(): FormData {
    const form = new FormData();
    form.set("type", type);
    if (type === "software_issue") {
      form.set("description", description.trim());
      form.set("category", categoryName);
      if (subcategory) form.set("subcategory", subcategory);
      form.set("note", note.trim());
    } else if (type === "correction") {
      form.set("correctionKind", kind);
      form.set("studentRecordLink", link.trim());
      if (needs.name) form.set("needsNameCorrection", "on");
      if (needs.dob) form.set("needsDobCorrection", "on");
      if (needs.insurance) form.set("needsInsuranceCorrection", "on");
      if (needs.other) {
        form.set("needsOtherCorrection", "on");
        form.set("otherCorrectionDetail", otherDetail.trim());
      }
    } else {
      form.set("studentRecordLink", link.trim());
      form.set("question", question.trim());
    }
    return form;
  }

  function clear() {
    setDescription("");
    setNote("");
    setLink("");
    setNeeds({ name: false, dob: false, insurance: false, other: false });
    setOtherDetail("");
    setQuestion("");
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
      setAdded(`${ISSUE_TYPE_LABELS[type]} reported. It's on the Issues page.`);
    } catch {
      setErrors(["The issue could not be saved. Please refresh and try again."]);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Type">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <Chip key={t} on={type === t} onClick={() => { setType(t); setAdded(null); setErrors([]); }}>
              {ISSUE_TYPE_LABELS[t]}
            </Chip>
          ))}
        </div>
      </Field>

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

      {type === "correction" && (
        <>
          <Field label="Kind">
            <div className="flex flex-wrap gap-1.5">
              {CORRECTION_KINDS.map((k) => (
                <Chip key={k} on={kind === k} onClick={() => setKind(k)}>{k}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Link to student record">
            <Input autoFocus value={link} onChange={(e) => { setLink(e.target.value); setAdded(null); }} placeholder="Paste the link" />
          </Field>
          <Field label="Needs correction or verification">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={needs.name} onChange={(e) => setNeeds({ ...needs, name: e.target.checked })} /> Name</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={needs.dob} onChange={(e) => setNeeds({ ...needs, dob: e.target.checked })} /> DOB</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={needs.insurance} onChange={(e) => setNeeds({ ...needs, insurance: e.target.checked })} /> Insurance</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={needs.other} onChange={(e) => setNeeds({ ...needs, other: e.target.checked })} /> Other</label>
            </div>
            {needs.other && <Input value={otherDetail} onChange={(e) => setOtherDetail(e.target.value)} placeholder="What else needs correcting or verifying?" />}
          </Field>
        </>
      )}

      {type === "charting" && (
        <>
          <Field label="Link to student record">
            <Input autoFocus value={link} onChange={(e) => { setLink(e.target.value); setAdded(null); }} placeholder="Paste the link" />
          </Field>
          <Field label="What's the question or concern?">
            <Input value={question} onChange={(e) => { setQuestion(e.target.value); setAdded(null); }} placeholder="Type your question" />
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
