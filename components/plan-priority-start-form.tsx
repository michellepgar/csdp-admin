"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { PlanItem, TaskCategory, GeneralTaskCategory } from "@/lib/app-state";

const GENERAL_TASKS_OPTION = "__general__";
const REMINDER_OPTION = "__reminder__";

export function PlanPriorityStartForm({ planItem, schools, taskCategories, generalTaskCategories, resolvePriorityPlanItem, onClose }: {
  planItem: PlanItem;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [destinationId, setDestinationId] = useState(planItem.suggestedSchoolId ?? "");
  const [categoryId, setCategoryId] = useState(planItem.suggestedCategoryId ?? "");
  const [fileName, setFileName] = useState(planItem.suggestedFileName ?? "");
  const [error, setError] = useState<string | null>(null);

  const isGeneral = destinationId === GENERAL_TASKS_OPTION;
  const isReminder = destinationId === REMINDER_OPTION;
  const categories = isGeneral
    ? generalTaskCategories.map((c) => ({ value: c.name, label: c.name }))
    : destinationId && !isReminder
      ? visibleSchoolItems(taskCategories, destinationId).map((c) => ({ value: c.id, label: c.name }))
      : [];

  return (
    <div className="absolute bottom-16 right-0 w-72 rounded-md border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">{isReminder ? "Just a heads-up, not a real task?" : "Which school is this for?"}</p>
      <form
        action={async (formData) => {
          setError(null);
          formData.set("destination", isReminder ? "reminder" : isGeneral ? "general" : "school");
          if (isReminder || isGeneral) formData.delete("schoolId");
          else formData.set("schoolId", destinationId);
          const result = await resolvePriorityPlanItem(formData);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="space-y-2"
      >
        <input type="hidden" name="id" value={planItem.id} />
        <Dropdown
          name="destinationDisplay"
          value={destinationId}
          onChange={(v) => { setDestinationId(v); setCategoryId(""); }}
          placeholder="Choose a school"
          openUpward
          options={[{ value: REMINDER_OPTION, label: "Just a reminder" }, { value: GENERAL_TASKS_OPTION, label: "General Tasks" }, ...schools.map((s) => ({ value: s.id, label: s.name }))]}
        />
        {!isReminder && <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" openUpward options={categories} />}
        {!isReminder && <input name="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} required placeholder={isGeneral ? "Description" : "File name"} className="h-8 w-full rounded-md border px-2 text-sm" />}
        <div className="flex gap-2">
          <SubmitButton variant="plan" size="xs" pendingLabel="Starting…" disabled={!destinationId || (!isReminder && !categoryId)}>{isReminder ? "Mark as reminder" : "Start"}</SubmitButton>
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
