"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { PlanPriorityStartForm } from "@/components/plan-priority-start-form";
import type { OpenEmailItem } from "@/lib/shared-task-files";
import type { PlanItem, TaskCategory, GeneralTaskCategory } from "@/lib/app-state";

export function PlanBubble({ myPlanItems, myOpenEmailItems, schools, taskCategories, generalTaskCategories, resolveTaskPlanItem, resolvePriorityPlanItem, completeNoteReminder, setEmailStatus }: {
  myPlanItems: PlanItem[];
  myOpenEmailItems: OpenEmailItem[];
  schools: { id: string; name: string }[];
  taskCategories: TaskCategory[];
  generalTaskCategories: GeneralTaskCategory[];
  resolveTaskPlanItem: (formData: FormData) => void;
  resolvePriorityPlanItem: (formData: FormData) => Promise<{ error: string | null }>;
  completeNoteReminder: (formData: FormData) => void;
  setEmailStatus: (formData: FormData) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [startingPriority, setStartingPriority] = useState<PlanItem | null>(null);

  if (myPlanItems.length === 0 && myOpenEmailItems.length === 0) return null;

  const actionableItems = myPlanItems.filter((item) => item.kind !== "note");
  const reminders = myPlanItems.filter((item) => item.kind === "note");

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {expanded ? (
        <div className="w-72 overflow-hidden rounded-md border bg-card shadow-lg">
          <button type="button" onClick={() => setExpanded(false)} className="flex w-full items-center justify-between bg-plan-accent px-3 py-2 text-sm font-semibold text-plan-accent-foreground">
            <span>Your Plan</span><span>▾</span>
          </button>
          <div className="max-h-80 space-y-2 overflow-y-auto p-2">
            {actionableItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="flex items-center">{item.kind === "priority" && <span className="priority-dot" aria-hidden />}{item.label}</span>
                {item.kind === "priority" ? (
                  <Button type="button" variant="plan" size="xs" onClick={() => setStartingPriority(item)}>Start</Button>
                ) : (
                  <form action={resolveTaskPlanItem}>
                    <input type="hidden" name="id" value={item.id} />
                    {item.taskFileCategoryId ? (
                      <>
                        <input type="hidden" name="taskFileCategoryId" value={item.taskFileCategoryId} />
                        <input type="hidden" name="schoolId" value={item.schoolId} />
                      </>
                    ) : (
                      <input type="hidden" name="generalTaskId" value={item.generalTaskId} />
                    )}
                    <SubmitButton variant="plan" size="xs" pendingLabel="…">Start</SubmitButton>
                  </form>
                )}
              </div>
            ))}
            {reminders.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Reminders</div>
                {reminders.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span>{item.label}</span>
                    <form action={completeNoteReminder}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton size="xs" pendingLabel="…">✓</SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
            {myOpenEmailItems.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Email Tracker</div>
                {myOpenEmailItems.map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <Link href={`/schools/${item.schoolId}#email-tracker`} className="min-w-0 flex-1 truncate hover:underline">
                      {item.description}<span className="text-muted-foreground"> — {item.schoolName}</span>
                    </Link>
                    <form action={setEmailStatus}>
                      <input type="hidden" name="schoolId" value={item.schoolId} />
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <input type="hidden" name="status" value="Done" />
                      <SubmitButton size="xs" pendingLabel="…">Mark Done</SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setExpanded(true)} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-plan-accent text-plan-accent-foreground shadow-lg" aria-label="Your plan">
          <ClipboardList className="h-6 w-6" />
          {/* White badge (not the usual status-danger red) -- that red
              is now too close to the new coral bubble color to read as
              its own separate element against it. */}
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-plan-accent">{myPlanItems.length + myOpenEmailItems.length}</span>
        </button>
      )}
      {startingPriority && (
        <PlanPriorityStartForm
          planItem={startingPriority}
          schools={schools}
          taskCategories={taskCategories}
          generalTaskCategories={generalTaskCategories}
          resolvePriorityPlanItem={resolvePriorityPlanItem}
          onClose={() => setStartingPriority(null)}
        />
      )}
    </div>
  );
}
