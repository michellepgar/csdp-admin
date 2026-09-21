"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { Chip, Feedback, Field, LABEL, TEXTAREA } from "@/components/quick-add-parts";
import type { QuickAddData } from "@/components/quick-add-dialog";
import { categoriesWithoutTable, parseFileNames } from "@/lib/quick-add";

/* Add files to any school without opening the school first. Pick the school,
   then either tick one or more categories (new files) or pick one of that
   school's existing tables, type one file name per line, and press Add.
   Categories that already have a table aren't offered again -- a category
   lives in one table per school. Admins can also put a VA on the files as
   they're added. It keeps the school, categories and VA after an add.

   Mounted only while its tab is showing, so it starts clean each time and
   has no reset effect -- one would also wipe the form whenever the page
   refreshes underneath it after a successful add (that refresh hands down a
   fresh `schools` array). */
export function QuickAddFilePanel({ data }: { data: QuickAddData }) {
  const { schools, categories, tablesBySchool, addTask, isAdmin, vaNames } = data;
  const pathname = usePathname();
  // Start on the school you're already looking at.
  const [schoolId, setSchoolId] = useState(() => {
    const onSchoolPage = pathname.match(/^\/schools\/([^/]+)/)?.[1] ?? "";
    return schools.some((s) => s.id === onSchoolPage) ? onSchoolPage : "";
  });
  const [existingTable, setExistingTable] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tableKey, setTableKey] = useState("");
  const [vaName, setVaName] = useState("");
  const [fileNames, setFileNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  const namesRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const tables = tablesBySchool[schoolId] ?? [];
  const chosenTable = tables.find((t) => t.key === tableKey);
  const chosenCategoryIds = existingTable ? chosenTable?.categoryIds ?? [] : categoryIds;
  const names = parseFileNames(fileNames);
  const ready = !!schoolId && chosenCategoryIds.length > 0 && names.length > 0;
  const schoolName = schools.find((s) => s.id === schoolId)?.name ?? "";
  const offered = categoriesWithoutTable(categories, tables, categoryIds);
  const categoryNames = chosenCategoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean).join(" + ");

  function toggleCategory(id: string) {
    setCategoryIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
    setAdded(null);
  }

  function chooseSchool(id: string) {
    setSchoolId(id);
    setTableKey("");
    setCategoryIds([]);
    setExistingTable(false);
    setAdded(null);
    setErrors([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors([]);
    setAdded(null);
    const failed: { name: string; message: string }[] = [];
    let ok = 0;
    for (const name of names) {
      const form = new FormData();
      form.set("schoolId", schoolId);
      form.set("fileName", name);
      if (existingTable && chosenTable?.tableId) form.set("tableId", chosenTable.tableId);
      for (const id of chosenCategoryIds) form.append("categoryIds", id);
      if (vaName) form.set("vaName", vaName);
      try {
        const result = await addTask(form);
        if (result.error) failed.push({ name, message: result.error });
        else ok += 1;
      } catch {
        failed.push({ name, message: "Could not be saved. Please refresh and try again." });
      }
    }
    setBusy(false);
    // Whatever didn't save stays in the box so it can be fixed and retried.
    setFileNames(failed.map((f) => f.name).join("\n"));
    setErrors(failed.map((f) => `${f.name}: ${f.message}`));
    if (ok > 0) setAdded(`Added ${ok} file${ok === 1 ? "" : "s"} to ${schoolName}, ${categoryNames}${vaName ? `, assigned to ${vaName}` : ""}. Type more names to add more.`);
    namesRef.current?.focus();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <Field label="School">
        <Dropdown
          name="schoolPicker"
          value={schoolId}
          onChange={chooseSchool}
          placeholder="Choose a school"
          options={[...schools].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ value: s.id, label: s.name }))}
          className="w-full rounded-md border border-primary/60 bg-primary/5 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/10"
        />
      </Field>

      {schoolId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className={LABEL}>{existingTable ? "Which table" : "Categories"}</label>
            {tables.length > 0 && (
              <div className="flex gap-1">
                <Button type="button" size="xs" variant={existingTable ? "outline" : "default"} onClick={() => { setExistingTable(false); setAdded(null); }}>
                  New category
                </Button>
                <Button type="button" size="xs" variant={existingTable ? "default" : "outline"} onClick={() => { setExistingTable(true); setAdded(null); }}>
                  Existing table
                </Button>
              </div>
            )}
          </div>
          {existingTable ? (
            <div className="flex flex-wrap gap-1.5">
              {tables.map((t) => (
                <Chip key={t.key} on={tableKey === t.key} onClick={() => { setTableKey(t.key); setAdded(null); }}>
                  {t.label}
                </Chip>
              ))}
            </div>
          ) : offered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Every category already has a table here. Use Existing table to add files to one.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {offered.map((c) => (
                  <Chip key={c.id} on={categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>
                    {c.name.trim() || "(Unnamed category)"}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Categories that already have a table aren&apos;t shown. Pick more than one for a table with several categories.</p>
            </>
          )}
        </div>
      )}

      {isAdmin && vaNames.length > 0 && (
        <Field label="Assign to (optional)">
          <div className="flex flex-wrap gap-1.5">
            <Chip on={vaName === ""} onClick={() => setVaName("")}>No one</Chip>
            {vaNames.map((name) => (
              <Chip key={name} on={vaName === name} onClick={() => setVaName(name)}>{name}</Chip>
            ))}
          </div>
        </Field>
      )}

      <Field label="File names">
        <textarea
          ref={namesRef}
          autoFocus
          value={fileNames}
          onChange={(e) => { setFileNames(e.target.value); setAdded(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          rows={Math.min(Math.max(fileNames.split("\n").length + 1, 3), 8)}
          placeholder={"One file name per line, e.g.\nconsent-forms-batch-1.pdf\nconsent-forms-batch-2.pdf"}
          className={TEXTAREA}
        />
        <p className="text-xs text-muted-foreground">Paste or type as many as you like, one per line. Ctrl+Enter adds them.</p>
      </Field>

      <Feedback errors={errors} added={added} />
      <div className="flex justify-end">
        <Button type="submit" disabled={!ready || busy}>
          {busy ? "Adding…" : names.length > 1 ? `Add ${names.length} files` : "Add file"}
        </Button>
      </div>
    </form>
  );
}
