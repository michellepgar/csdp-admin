"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Feedback, Field, TEXTAREA } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { parseFileNames } from "@/lib/quick-add";

/* General tasks (work that isn't tied to a school): pick a category and type
   one task per line. */
export function QuickAddTaskPanel({ data }: { data: QuickAddData }) {
  const { generalTaskCategories, addGeneralTask } = data;
  const [category, setCategory] = useState(generalTaskCategories[0]?.name ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lines = parseFileNames(text);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0 || busy) return;
    setBusy(true);
    setErrors([]);
    setAdded(null);
    const failed: string[] = [];
    let ok = 0;
    for (const description of lines) {
      const form = new FormData();
      form.set("category", category);
      form.set("description", description);
      try {
        await addGeneralTask(form);
        ok += 1;
      } catch {
        failed.push(description);
      }
    }
    setBusy(false);
    setText(failed.join("\n"));
    setErrors(failed.map((d) => `${d}: could not be saved. Please refresh and try again.`));
    if (ok > 0) setAdded(`Added ${ok} general task${ok === 1 ? "" : "s"}${category ? ` in ${category}` : ""}. Type more to add more.`);
    ref.current?.focus();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      {generalTaskCategories.length > 0 && (
        <Field label="Category">
          <div className="flex flex-wrap gap-1.5">
            {generalTaskCategories.map((c) => (
              <Chip key={c.id} on={category === c.name} onClick={() => { setCategory(c.name); setAdded(null); }}>
                {c.name.trim() || "(Unnamed category)"}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <Field label="Tasks">
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
          rows={Math.min(Math.max(text.split("\n").length + 1, 3), 8)}
          placeholder={"What are you working on? One task per line."}
          className={TEXTAREA}
        />
        <p className="text-xs text-muted-foreground">Ctrl+Enter adds them.</p>
      </Field>
      <Feedback errors={errors} added={added} />
      <div className="flex justify-end">
        <Button type="submit" disabled={lines.length === 0 || busy}>
          {busy ? "Adding…" : lines.length > 1 ? `Add ${lines.length} tasks` : "Add task"}
        </Button>
      </div>
    </form>
  );
}
