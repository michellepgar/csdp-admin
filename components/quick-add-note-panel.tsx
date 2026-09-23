"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Feedback, Field, TEXTAREA } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { plainTextToNoteHtml } from "@/lib/quick-add";

/* A private note (only you can see it). Plain text here -- formatting, colors
   and sharing are on the Private Notes page. */
export function QuickAddNotePanel({ data, onClose }: { data: QuickAddData; onClose: () => void }) {
  const [text, setText] = useState("");
  const [reminder, setReminder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ready = text.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors([]);
    setAdded(null);
    const form = new FormData();
    form.set("text", plainTextToNoteHtml(text));
    if (reminder) form.set("isReminder", "on");
    try {
      const result = await data.addPrivateNote(form);
      if (result.error) {
        setErrors([result.error]);
      } else {
        setText("");
        setAdded(reminder ? "Saved as a reminder. Only you can see it." : "Saved. Only you can see it.");
      }
    } catch {
      setErrors(["The note could not be saved. Please refresh and try again."]);
    }
    setBusy(false);
    ref.current?.focus();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <Field label="Private note">
        <textarea
          ref={ref}
          autoFocus
          value={text}
          onChange={(e) => { setText(e.target.value); setAdded(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          rows={Math.min(Math.max(text.split("\n").length + 1, 4), 10)}
          placeholder="Jot something down"
          className={TEXTAREA}
        />
        <p className="text-xs text-muted-foreground">
          Only you can see it. For colors, formatting or sharing, use{" "}
          <Link href="/private-notes" prefetch={false} onClick={onClose} className="text-primary underline underline-offset-2">Private Notes</Link>.
        </p>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
        Make it a reminder
      </label>
      <Feedback errors={errors} added={added} />
      <div className="flex justify-end">
        <Button type="submit" disabled={!ready || busy}>{busy ? "Saving…" : "Save note"}</Button>
      </div>
    </form>
  );
}
