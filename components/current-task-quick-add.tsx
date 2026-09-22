"use client";

import { useState } from "react";
import { ListChecks, Plus, School } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { TaskCategory, GeneralTaskCategory } from "@/lib/app-state";
import type { QuickAddTable } from "@/components/quick-add-dialog";

type Destination = "school" | "general";

/* "+ Add" right on Currently Working On -- the VAs asked to just add
   something here directly instead of going to a school page (or
   Plan Tomorrow -> Start My Day) first to get it to show up. Two-step
   like PlanPriorityStartForm (destination first, then the fields for
   it), but starts empty (no suggested school/category/file to
   pre-fill from -- there's no linked priority behind this) and calls
   startWorkNow (app/(app)/overview/actions.ts) instead of resolving
   an existing one. Submitting signs YOU on it and sets it In Progress
   immediately -- no separate planning step.

   School files can go into a brand new category OR an existing table
   (a file spanning several categories at once) -- same New category/
   Existing table choice components/quick-add-file-panel.tsx already
   offers, so this doesn't force starting a fresh single-category
   file when the school already tracks that kind of work as a table. */
export function CurrentTaskQuickAdd({
  schools,
  taskCategories,
  tablesBySchool,
  generalTaskCategories,
  startWorkNow,
}: {
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  tablesBySchool: Record<string, QuickAddTable[]>;
  generalTaskCategories: GeneralTaskCategory[];
  startWorkNow: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<Destination>("school");
  const [schoolId, setSchoolId] = useState("");
  const [existingTable, setExistingTable] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [tableKey, setTableKey] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const schoolCategories = schoolId ? visibleSchoolItems(taskCategories, schoolId).map((c) => ({ value: c.id, label: c.name })) : [];
  const generalCategories = generalTaskCategories.map((c) => ({ value: c.name, label: c.name }));
  const tables = tablesBySchool[schoolId] ?? [];
  const chosenTable = tables.find((t) => t.key === tableKey);

  function reset() {
    setOpen(false);
    setDestination("school");
    setSchoolId("");
    setExistingTable(false);
    setCategoryId("");
    setTableKey("");
    setFileName("");
    setError(null);
  }

  function chooseDestination(next: Destination) {
    setDestination(next);
    setSchoolId("");
    setExistingTable(false);
    setCategoryId("");
    setTableKey("");
    setFileName("");
  }

  function chooseSchool(id: string) {
    setSchoolId(id);
    setExistingTable(false);
    setCategoryId("");
    setTableKey("");
    setFileName("");
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" /> Add what you&apos;re working on
      </Button>
    );
  }

  const schoolReady = existingTable ? !!tableKey : !!categoryId;
  const ready = destination === "general"
    ? !!categoryId && !!fileName.trim()
    : !!schoolId && schoolReady && !!fileName.trim();

  return (
    <div className="w-full max-w-md space-y-2 rounded-md border bg-card p-3">
      <p className="text-sm font-semibold">What are you working on?</p>
      <form
        action={async (formData) => {
          setError(null);
          formData.set("destination", destination);
          const result = await startWorkNow(formData);
          if (result.error) setError(result.error);
          else reset();
        }}
        className="space-y-2"
      >
        <div className="grid grid-cols-2 gap-1.5">
          <Button type="button" variant={destination === "school" ? "plan" : "outline"} size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => chooseDestination("school")}>
            <School className="h-4 w-4" /> A school
          </Button>
          <Button type="button" variant={destination === "general" ? "plan" : "outline"} size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => chooseDestination("general")}>
            <ListChecks className="h-4 w-4" /> General
          </Button>
        </div>

        {destination === "school" && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <Dropdown name="schoolId" value={schoolId} onChange={chooseSchool} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />

            {schoolId && tables.length > 0 && (
              <div className="flex gap-1">
                <Button type="button" size="xs" variant={existingTable ? "outline" : "default"} onClick={() => { setExistingTable(false); setTableKey(""); }}>
                  New category
                </Button>
                <Button type="button" size="xs" variant={existingTable ? "default" : "outline"} onClick={() => { setExistingTable(true); setCategoryId(""); }}>
                  Existing table
                </Button>
              </div>
            )}

            {schoolId && (existingTable
              ? (
                <div className="flex flex-wrap gap-1.5">
                  {tables.map((t) => (
                    <Button key={t.key} type="button" size="xs" variant={tableKey === t.key ? "default" : "outline"} onClick={() => setTableKey(t.key)}>
                      {t.label}
                    </Button>
                  ))}
                  {/* Every category in the chosen table -- getAll("categoryIds")
                      on the server picks all of these up at once. */}
                  {chosenTable?.categoryIds.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
                </div>
              )
              : <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={schoolCategories} />
            )}

            {schoolReady && <input name="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder="File name" className="h-8 w-full rounded-md border px-2 text-sm" />}
          </div>
        )}

        {destination === "general" && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={generalCategories} />
            {categoryId && <input name="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder="Description" className="h-8 w-full rounded-md border px-2 text-sm" />}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <SubmitButton variant="plan" size="sm" pendingLabel="Starting…" disabled={!ready}>Start working on this</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-status-danger-foreground">{error}</p>}
      </form>
    </div>
  );
}
