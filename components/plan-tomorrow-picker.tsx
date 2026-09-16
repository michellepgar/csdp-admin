"use client";

import { useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import type { School, SchoolDataEntry, GeneralTask, PlanItem } from "@/lib/app-state";

interface OpenItem { id: string; schoolId?: string; schoolName: string; category: string; fileName: string; status: string }

export function PlanTomorrowPicker({ currentUserName, schools, schoolData, generalTasks, myPlanItems, savePlan }: {
  currentUserName: string;
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  generalTasks: GeneralTask[];
  myPlanItems: PlanItem[];
  savePlan: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [schoolId, setSchoolId] = useState("");

  const schoolCarryOver: OpenItem[] = schools.flatMap((school) =>
    (schoolData[school.id]?.tasks || [])
      .filter((t) => t.status === "In Progress" && t.vaAssigned.includes(currentUserName))
      .map((t) => ({ id: t.id, schoolId: school.id, schoolName: school.name, category: t.category, fileName: t.fileName, status: t.status }))
  );
  const generalCarryOver: OpenItem[] = generalTasks
    .filter((t) => t.status === "In Progress" && t.vaAssigned.includes(currentUserName))
    .map((t) => ({ id: t.id, schoolName: "General", category: t.category, fileName: t.description, status: t.status }));
  const carryOver = [...schoolCarryOver, ...generalCarryOver];

  const alreadyPlannedTaskIds = new Set(myPlanItems.filter((p) => p.kind === "task" && p.taskFileCategoryId).map((p) => p.taskFileCategoryId));
  const alreadyPlannedGeneralIds = new Set(myPlanItems.filter((p) => p.kind === "task" && p.generalTaskId).map((p) => p.generalTaskId));
  const [checked, setChecked] = useState<Set<string>>(() => new Set([...carryOver.map((t) => t.id), ...alreadyPlannedTaskIds, ...alreadyPlannedGeneralIds] as string[]));

  const school = schools.find((s) => s.id === schoolId);
  const browseSchoolTasks: OpenItem[] = school
    ? (schoolData[school.id]?.tasks || [])
        .filter((t) => !schoolCarryOver.some((c) => c.id === t.id))
        .map((t) => ({ id: t.id, schoolId: school.id, schoolName: school.name, category: t.category, fileName: t.fileName, status: t.status }))
    : [];
  const browseGeneralTasks: OpenItem[] = generalTasks
    .filter((t) => !generalCarryOver.some((c) => c.id === t.id))
    .map((t) => ({ id: t.id, schoolName: "General", category: t.category, fileName: t.description, status: t.status }));

  function toggle(id: string) {
    setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function buildLabels(): Record<string, { label: string; schoolId?: string }> {
    const all = [...carryOver, ...browseSchoolTasks, ...browseGeneralTasks];
    const labels: Record<string, { label: string; schoolId?: string }> = {};
    for (const id of checked) {
      const item = all.find((t) => t.id === id);
      if (item) labels[id] = { label: `${item.fileName} — ${item.category}`, schoolId: item.schoolId };
    }
    return labels;
  }

  const isSchoolId = (id: string) => [...carryOver, ...browseSchoolTasks].some((t) => t.id === id && t.schoolId);

  return (
    <div>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>End Today&apos;s Work</Button>
      {open && (
        <div className="mt-2 max-w-md rounded-md border bg-card p-3">
          <p className="mb-2 text-xs text-muted-foreground">Still in progress today — uncheck to drop from tomorrow&apos;s plan:</p>
          {carryOver.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Nothing carried over.</p>}
          {carryOver.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.schoolName} · {t.category}
            </label>
          ))}
          <div className="my-2 border-t" />
          <p className="mb-1 text-xs text-muted-foreground">General Tasks:</p>
          {browseGeneralTasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.category}{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}
            </label>
          ))}
          <div className="my-2 border-t" />
          <p className="mb-1 text-xs text-muted-foreground">Browse other open tasks by school:</p>
          <Dropdown name="schoolId" value={schoolId} onChange={setSchoolId} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
          {browseSchoolTasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.category}{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}
            </label>
          ))}
          <form
            action={(formData) => {
              for (const id of checked) formData.append(isSchoolId(id) ? "taskFileCategoryIds" : "generalTaskIds", id);
              formData.set("labels", JSON.stringify(buildLabels()));
              savePlan(formData);
              setOpen(false);
            }}
            className="mt-2 flex gap-2"
          >
            <SubmitButton size="sm" pendingLabel="Saving…">Save Plan</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </form>
        </div>
      )}
    </div>
  );
}
