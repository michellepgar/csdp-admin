"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Feedback, Field, TEXTAREA } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { MAX_SUGGESTION_DETAILS, MAX_SUGGESTION_TITLE } from "@/lib/suggestions";

/* A suggestion: a short title and an optional description. Screenshots and
   files are attached from the Suggestions page. */
export function QuickAddSuggestionPanel({ data, onClose }: { data: QuickAddData; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const ready = title.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors([]);
    setAdded(null);
    const form = new FormData();
    form.set("text", title.trim());
    form.set("details", details.trim());
    form.set("attachments", "[]");
    try {
      const result = await data.addSuggestion(form);
      if (result.error) {
        setErrors([result.error]);
      } else {
        setTitle("");
        setDetails("");
        setAdded("Suggestion sent. Thank you!");
      }
    } catch {
      setErrors(["The suggestion could not be saved. Please refresh and try again."]);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Suggest something">
        <Input autoFocus value={title} maxLength={MAX_SUGGESTION_TITLE} onChange={(e) => { setTitle(e.target.value); setAdded(null); }} placeholder="A short title" />
      </Field>
      <Field label="Details (optional)">
        <textarea
          value={details}
          maxLength={MAX_SUGGESTION_DETAILS}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Describe it as long as you like"
          className={TEXTAREA}
        />
        <p className="text-xs text-muted-foreground">
          To attach screenshots or files, use{" "}
          <Link href="/suggestions" prefetch={false} onClick={onClose} className="text-primary underline underline-offset-2">Suggestions</Link>.
        </p>
      </Field>
      <Feedback errors={errors} added={added} />
      <div className="flex justify-end">
        <Button type="submit" disabled={!ready || busy}>{busy ? "Sending…" : "Send suggestion"}</Button>
      </div>
    </form>
  );
}
