"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { visibleSchoolItems } from "@/lib/app-state";
import type { TaskCategory } from "@/lib/app-state";

export function PlanPriorityStartForm({ planItemId, schools, taskCategories, resolvePriorityPlanItem, onClose }: {
  planItemId: string;
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  resolvePriorityPlanItem: (formData: FormData) => void;
  onClose: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const categories = schoolId ? visibleSchoolItems(taskCategories, schoolId) : [];

  return (
    <div className="absolute bottom-16 right-0 w-72 rounded-md border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">Which school is this for?</p>
      <form action={(formData) => { resolvePriorityPlanItem(formData); onClose(); }} className="space-y-2">
        <input type="hidden" name="id" value={planItemId} />
        <Dropdown name="schoolId" value={schoolId} onChange={(v) => { setSchoolId(v); setCategoryId(""); }} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
        <Dropdown name="categoryId" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <input name="fileName" required placeholder="File name" className="h-8 w-full rounded-md border px-2 text-sm" />
        <div className="flex gap-2">
          <SubmitButton size="xs" pendingLabel="Starting…" disabled={!schoolId || !categoryId}>Start</SubmitButton>
          <Button type="button" variant="ghost" size="xs" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
