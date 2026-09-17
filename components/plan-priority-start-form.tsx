"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { TaskCategory, GeneralTaskCategory } from "@/lib/app-state";

const GENERAL_TASKS_OPTION = "__general__";

export function PlanPriorityStartForm({ planItemId, schools, taskCategories, generalTaskCategories, resolvePriorityPlanItem, onClose }: {
  planItemId: string;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [destinationId, setDestinationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isGeneral = destinationId === GENERAL_TASKS_OPTION;
  const categories = isGeneral
    ? generalTaskCategories.map((c) => ({ value: c.name, label: c.name }))
    : destinationId
      ? visibleSchoolItems(taskCategories, destinationId).map((c) => ({ value: c.id, label: c.name }))
      : [];

  return (
    <div className="absolute bottom-16 right-0 w-72 rounded-md border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">Which school is this for?</p>
      <form
        action={async (formData) => {
          setError(null);
          formData.set("destination", isGeneral ? "general" : "school");
          if (isGeneral) formData.delete("schoolId");
          else formData.set("schoolId", destinationId);
          const result = await resolvePriorityPlanItem(formData);
          if (result.error) setError(result.error);
          else onClose();
        }}
        className="space-y-2"
      >
        <input type="hidden" name="id" value={planItemId} />
        <Dropdown
          name="destinationDisplay"
          value={destinationId}
          onChange={(v) => { setDestinationId(v); setCategoryId(""); }}
          placeholder="Choose a school"
          openUpward
          options={[{ value: GENERAL_TASKS_OPTION, label: "General Tasks" }, ...schools.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" openUpward options={categories} />
        <input name="fileName" required placeholder={isGeneral ? "Description" : "File name"} className="h-8 w-full rounded-md border px-2 text-sm" />
        <div className="flex gap-2">
          <SubmitButton variant="plan" size="xs" pendingLabel="Starting…" disabled={!destinationId || !categoryId}>Start</SubmitButton>
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>Cancel</Button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
