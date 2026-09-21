"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, ChevronDown, ClipboardList, ListChecks, Mail, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { PlanPriorityStartForm } from "@/components/plan-priority-start-form";
import type { OpenEmailItem } from "@/lib/shared-task-files";
import { WorkNoteButton } from "@/components/work-note-button";
import { makeNoteLookup, planItemNoteKey } from "@/lib/work-notes";
import type { PlanItem, TaskCategory, GeneralTaskCategory, WorkNote } from "@/lib/app-state";

/* Shared shape for every row in the expanded panel -- a plain
   bordered box before, now a slightly raised card with a colored left
   edge that identifies its section at a glance (matches the same
   accent each section's own home already uses: plan-accent for
   priorities, in Task Priorities' own unassigned box; plan-accent-
   secondary for reminders/email, which are both "keep an eye on this"
   items rather than active work). */
const ROW_BASE = "flex items-center justify-between gap-2 rounded-lg border-l-4 border bg-background/60 p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md";

export function PlanBubble({ myWorkNotes, currentUserName, myPlanItems, myOpenEmailItems, schools, taskCategories, generalTaskCategories, resolveTaskPlanItem, resolvePriorityPlanItem, completeNoteReminder, setEmailStatus }: {
  myWorkNotes: WorkNote[];
  currentUserName: string;
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
  const noteLookup = makeNoteLookup(myWorkNotes);
  const [expanded, setExpanded] = useState(false);
  const [startingPriority, setStartingPriority] = useState<PlanItem | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const hasContent = myPlanItems.length > 0 || myOpenEmailItems.length > 0;

  // Publishes how much bottom-right space this bubble/window takes (its
  // own height plus a 1rem gap) as --plan-dock, so the floating chat
  // bubble can ride above it instead of being covered when the plan
  // window opens. 0px when there's no plan bubble at all.
  useEffect(() => {
    const root = document.documentElement;
    const el = dockRef.current;
    if (!el) {
      root.style.setProperty("--plan-dock", "0px");
      return;
    }
    const update = () => root.style.setProperty("--plan-dock", `${el.offsetHeight + 16}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--plan-dock", "0px");
    };
  }, [hasContent]);

  // The floating chat asks the plan window to fold up when it opens
  // (they're both tall, so only one is open at a time).
  useEffect(() => {
    const collapse = () => setExpanded(false);
    const openPlan = () => {
      setExpanded(true);
      window.dispatchEvent(new Event("chat:close"));
    };
    window.addEventListener("plan:collapse", collapse);
    window.addEventListener("plan:open", openPlan);
    return () => {
      window.removeEventListener("plan:collapse", collapse);
      window.removeEventListener("plan:open", openPlan);
    };
  }, []);

  if (!hasContent) return null;

  const actionableItems = myPlanItems.filter((item) => item.kind !== "note");
  const reminders = myPlanItems.filter((item) => item.kind === "note");

  return (
    <div ref={dockRef} className="fixed bottom-4 right-4 z-50">
      {expanded ? (
        <div className="w-72 overflow-hidden rounded-lg border bg-card shadow-lg">
          <button type="button" onClick={() => setExpanded(false)} className="flex w-full items-center justify-between bg-plan-accent px-3 py-2.5 text-sm font-semibold text-plan-accent-foreground">
            <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4" /> Your Plan</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="max-h-80 space-y-3 overflow-y-auto p-2.5">
            {actionableItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><ListChecks className="h-3.5 w-3.5" /> To Do</div>
                {actionableItems.map((item) => (
                  <div key={item.id} className={`${ROW_BASE} items-start ${item.kind === "priority" ? "border-l-plan-accent" : "border-l-border"}`}>
                    <span className="min-w-0 flex-1 break-words">
                      {item.label}
                      {noteLookup(planItemNoteKey(item), currentUserName) && (
                        <span className="mt-1 block rounded bg-amber-50 px-1.5 py-1 text-xs italic text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{noteLookup(planItemNoteKey(item), currentUserName)}</span>
                      )}
                    </span>
                    <WorkNoteButton itemKey={planItemNoteKey(item)} note={noteLookup(planItemNoteKey(item), currentUserName)} label={item.label} />
                    {item.kind === "priority" ? (
                      <Button type="button" variant="plan" size="xs" className="shrink-0" onClick={() => setStartingPriority(item)}><Play className="h-3 w-3" /> Start</Button>
                    ) : (
                      <form action={resolveTaskPlanItem} className="shrink-0">
                        <input type="hidden" name="id" value={item.id} />
                        {item.taskFileCategoryId ? (
                          <>
                            <input type="hidden" name="taskFileCategoryId" value={item.taskFileCategoryId} />
                            <input type="hidden" name="schoolId" value={item.schoolId} />
                          </>
                        ) : (
                          <input type="hidden" name="generalTaskId" value={item.generalTaskId} />
                        )}
                        <SubmitButton variant="plan" size="xs" pendingLabel="…"><Play className="h-3 w-3" /> Start</SubmitButton>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
            {reminders.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><Bell className="h-3.5 w-3.5" /> Reminders</div>
                {reminders.map((item) => (
                  <div key={item.id} className={`${ROW_BASE} items-start border-l-plan-accent-secondary`}>
                    <span className="min-w-0 flex-1 break-words">
                      {/* Opening the reminder just shows you the note -- it is only
                          marked reviewed by ticking the checkbox on the right. */}
                      {item.noteId ? (
                        <Link href={`/private-notes?highlightNote=${item.noteId}`} prefetch={false} title="Open this note" className="hover:underline">{item.label}</Link>
                      ) : (
                        item.label
                      )}
                      {noteLookup(planItemNoteKey(item), currentUserName) && (
                        <span className="mt-1 block rounded bg-amber-50 px-1.5 py-1 text-xs italic text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">{noteLookup(planItemNoteKey(item), currentUserName)}</span>
                      )}
                    </span>
                    <WorkNoteButton itemKey={planItemNoteKey(item)} note={noteLookup(planItemNoteKey(item), currentUserName)} label={item.label} />
                    <AutoSubmitForm action={completeNoteReminder} className="shrink-0">
                      <input type="hidden" name="id" value={item.id} />
                      <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground" title="Tick to mark this reminder as reviewed">
                        <input type="checkbox" aria-label={`Mark "${item.label}" as reviewed`} className="h-4 w-4" />
                        Reviewed
                      </label>
                    </AutoSubmitForm>
                  </div>
                ))}
              </div>
            )}
            {myOpenEmailItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Email Tracker</div>
                {myOpenEmailItems.map((item) => (
                  <div key={item.itemId} className={`${ROW_BASE} items-start border-l-plan-accent-secondary`}>
                    <Link href={`/schools/${item.schoolId}#email-tracker`} className="min-w-0 flex-1 break-words hover:underline">
                      {item.description}<span className="text-muted-foreground"> — {item.schoolName}</span>
                    </Link>
                    <form action={setEmailStatus} className="shrink-0">
                      <input type="hidden" name="schoolId" value={item.schoolId} />
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <input type="hidden" name="status" value="Done" />
                      <SubmitButton size="xs" pendingLabel="…" variant="outline"><Check className="h-3 w-3" /> Done</SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setExpanded(true); window.dispatchEvent(new Event("chat:close")); }} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-plan-accent text-plan-accent-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl" aria-label="Your plan">
          <ClipboardList className="h-6 w-6" />
          {/* White badge (not the usual status-danger red) -- that red
              is now too close to the new coral bubble color to read as
              its own separate element against it. */}
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-plan-accent shadow-sm">{myPlanItems.length + myOpenEmailItems.length}</span>
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
