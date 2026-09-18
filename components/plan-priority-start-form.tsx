"use client";

import { useState } from "react";
import { Bell, ListChecks, School } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { PlanItem, TaskCategory, GeneralTaskCategory } from "@/lib/app-state";

type Destination = "reminder" | "general" | "school";

/* Two-step now instead of one big dropdown mixing "Just a reminder",
   "General Tasks", and every school together -- Michelle asked for
   the destination TYPE to be chosen first (as its own three-way
   toggle), with school/category/file fields only appearing once
   School or General is actually picked. */
export function PlanPriorityStartForm({ planItem, schools, taskCategories, generalTaskCategories, resolvePriorityPlanItem, onClose }: {
  planItem: PlanItem;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState<Destination | "">(planItem.suggestedSchoolId ? "school" : "");
  const [schoolId, setSchoolId] = useState(planItem.suggestedSchoolId ?? "");
  const [categoryId, setCategoryId] = useState(planItem.suggestedCategoryId ?? "");
  const [fileName, setFileName] = useState(planItem.suggestedFileName ?? "");
  const [error, setError] = useState<string | null>(null);

  const schoolCategories = schoolId ? visibleSchoolItems(taskCategories, schoolId).map((c) => ({ value: c.id, label: c.name })) : [];
  const generalCategories = generalTaskCategories.map((c) => ({ value: c.name, label: c.name }));

  function chooseDestination(next: Destination) {
    setDestination(next);
    setSchoolId(next === "school" ? schoolId : "");
    setCategoryId("");
    setFileName("");
  }

  const ready = destination === "reminder"
    || (destination === "general" && !!categoryId && !!fileName.trim())
    || (destination === "school" && !!schoolId && !!categoryId && !!fileName.trim());

  return (
    <div className="absolute bottom-16 right-0 w-72 rounded-lg border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">Where does this belong?</p>
      <form
        action={async (formData) => {
          setError(null);
          formData.set("destination", destination);
          if (destination !== "school") formData.delete("schoolId");
          const result = await resolvePriorityPlanItem(formData);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="space-y-2"
      >
        <input type="hidden" name="id" value={planItem.id} />

        <div className="grid grid-cols-3 gap-1.5">
          <Button type="button" variant={destination === "reminder" ? "plan" : "outline"} size="sm" className="flex-col gap-0.5 py-2 h-auto" onClick={() => chooseDestination("reminder")}>
            <Bell className="h-4 w-4" /> Reminder
          </Button>
          <Button type="button" variant={destination === "general" ? "plan" : "outline"} size="sm" className="flex-col gap-0.5 py-2 h-auto" onClick={() => chooseDestination("general")}>
            <ListChecks className="h-4 w-4" /> General
          </Button>
          <Button type="button" variant={destination === "school" ? "plan" : "outline"} size="sm" className="flex-col gap-0.5 py-2 h-auto" onClick={() => chooseDestination("school")}>
            <School className="h-4 w-4" /> School
          </Button>
        </div>

        {destination === "school" && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <Dropdown name="schoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); }} placeholder="Choose a school" openUpward options={schools.map((s) => ({ value: s.id, label: s.name }))} />
            {schoolId && <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" openUpward options={schoolCategories} />}
            {categoryId && <input name="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder="File name" className="h-8 w-full rounded-md border px-2 text-sm" />}
          </div>
        )}

        {destination === "general" && (
          <div className="space-y-2 rounded-md bg-muted/40 p-2">
            <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" openUpward options={generalCategories} />
            {categoryId && <input name="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder="Description" className="h-8 w-full rounded-md border px-2 text-sm" />}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <SubmitButton variant="plan" size="xs" pendingLabel="Starting…" disabled={!ready}>{destination === "reminder" ? "Mark as reminder" : "Start"}</SubmitButton>
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
