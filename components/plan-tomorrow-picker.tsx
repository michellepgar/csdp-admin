"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarClock, ClipboardList, ListChecks, Plus, School as SchoolIcon, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { School, SchoolDataEntry, GeneralTask, PlanItem, PrivateNote } from "@/lib/app-state";

interface OpenItem { id: string; schoolId?: string; schoolName: string; category: string; fileName: string; status: string }
type Tab = "inProgress" | "schools" | "general" | "reminder";

function plainText(html: string, max: number): string {
  return html.replace(/<[^>]+>/g, " ").trim().slice(0, max) || "Note";
}

/* One planning window, two ways in:
   - "end": the End Today's Work button. Ends the shift -- saving also
     closes it (endShift), so Start my day unlocks. Tasks still In Progress
     start out checked, as the default carry-over.
   - "add": the Add button on Next Shift Plan, for a plan someone forgot
     to make when they ended their day. Doesn't touch the shift, and
     starts with only what's already planned checked.
   Either way everything saves together through one submit (savePlan); the
   tabs only change what's visible while building that one submission. */
export function PlanTomorrowPicker({ mode, disabled, disabledReason, currentUserName, schools, schoolData, generalTasks, myPlanItems, myReminderNotes, savePlan }: {
  mode: "end" | "add";
  /** End mode only: the button is off until a shift has been started. */
  disabled?: boolean;
  disabledReason?: string;
  currentUserName: string;
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  generalTasks: GeneralTask[];
  myPlanItems: PlanItem[];
  /** This VA's own private notes flagged as reminders -- the "From
   *  Private Notes" option under the Reminder tab picks from these. */
  myReminderNotes: PrivateNote[];
  savePlan: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("inProgress");
  const [schoolId, setSchoolId] = useState("");
  const [error, setError] = useState<string | null>(null);

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
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set([...(mode === "end" ? carryOver.map((t) => t.id) : []), ...alreadyPlannedTaskIds, ...alreadyPlannedGeneralIds] as string[]),
  );

  const school = schools.find((s) => s.id === schoolId);
  const browseSchoolTasks: OpenItem[] = school
    ? (schoolData[school.id]?.tasks || [])
        .filter((t) => !schoolCarryOver.some((c) => c.id === t.id))
        .map((t) => ({ id: t.id, schoolId: school.id, schoolName: school.name, category: t.category, fileName: t.fileName, status: t.status }))
    : [];
  const browseGeneralTasks: OpenItem[] = generalTasks
    .filter((t) => !generalCarryOver.some((c) => c.id === t.id))
    .map((t) => ({ id: t.id, schoolName: "General", category: t.category, fileName: t.description, status: t.status }));

  const [pendingReminders, setPendingReminders] = useState<{ key: string; label: string; noteId?: string }[]>([]);
  const [reminderMode, setReminderMode] = useState<"freeText" | "fromNotes">("freeText");
  const [reminderText, setReminderText] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");

  function toggle(id: string) {
    setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function addPendingReminderFreeText() {
    const label = reminderText.trim();
    if (!label) return;
    setPendingReminders((prev) => [...prev, { key: `free-${Date.now()}`, label }]);
    setReminderText("");
  }

  function addPendingReminderFromNote() {
    const note = myReminderNotes.find((n) => n.id === selectedNoteId);
    if (!note) return;
    setPendingReminders((prev) => [...prev, { key: `note-${note.id}`, label: plainText(note.text, 80), noteId: note.id }]);
    setSelectedNoteId("");
  }

  function removePendingReminder(key: string) {
    setPendingReminders((prev) => prev.filter((r) => r.key !== key));
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

  const tabs: { id: Tab; label: string; hint: string; icon: React.ReactNode; count: number }[] = [
    { id: "inProgress", label: "In Progress", hint: mode === "end" ? "Still open from today" : "What you're working on now", icon: <ListChecks className="h-4 w-4" />, count: carryOver.filter((t) => checked.has(t.id)).length },
    { id: "schools", label: "Schools", hint: "Pick from any school", icon: <SchoolIcon className="h-4 w-4" />, count: browseSchoolTasks.filter((t) => checked.has(t.id)).length },
    { id: "general", label: "General", hint: "General Tasks", icon: <ClipboardList className="h-4 w-4" />, count: browseGeneralTasks.filter((t) => checked.has(t.id)).length },
    { id: "reminder", label: "Reminder", hint: "Things to remember", icon: <Bell className="h-4 w-4" />, count: pendingReminders.length },
  ];
  const taskTotal = checked.size;
  const title = mode === "end" ? "Plan your next shift" : "Add to your next shift plan";
  const subtitle = mode === "end" ? "Choose what carries into your next shift, then save to end today's work." : "Add anything you forgot. This doesn't end your day.";

  return (
    <div>
      {mode === "end" ? (
        <Button type="button" variant="plan" size="sm" disabled={disabled} title={disabled ? disabledReason : undefined} onClick={() => setOpen(true)}>End Today&apos;s Work</Button>
      ) : (
        <Button type="button" variant="plan" size="xs" onClick={() => setOpen(true)}><Plus className="h-3 w-3" /> Add</Button>
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex max-h-[92vh] min-h-[min(34rem,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 bg-plan-accent px-5 py-4 text-plan-accent-foreground">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/20"><CalendarClock className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="bg-transparent px-0 py-0 text-lg font-semibold leading-tight text-inherit">{title}</h2>
                <p className="text-sm opacity-90">{subtitle}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/20"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="flex flex-none gap-1.5 overflow-x-auto border-b bg-muted/30 p-3 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex flex-none items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      tab === t.id ? "border-plan-accent bg-plan-accent text-plan-accent-foreground shadow-sm" : "bg-background hover:bg-muted",
                    )}
                  >
                    {t.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{t.label}</span>
                      <span className={cn("hidden text-xs sm:block", tab === t.id ? "opacity-90" : "text-muted-foreground")}>{t.hint}</span>
                    </span>
                    {t.count > 0 && <span className={cn("rounded-full px-1.5 text-xs font-bold", tab === t.id ? "bg-white/25" : "bg-plan-accent text-plan-accent-foreground")}>{t.count}</span>}
                  </button>
                ))}
              </div>

              <div className="min-h-64 flex-1 space-y-2 overflow-y-auto p-4">
                {tab === "inProgress" && (
                  <>
                    <p className="text-sm text-muted-foreground">{mode === "end" ? "Still in progress today. Uncheck anything that shouldn't be in your next shift plan." : "Tasks you're working on now. Check the ones to add."}</p>
                    {carryOver.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing in progress right now.</p>}
                    {carryOver.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t.id)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span><span className="text-muted-foreground"> — {t.schoolName} · {t.category}</span></span>
                      </label>
                    ))}
                    <p className="pt-1 text-xs text-muted-foreground">Reminders you checked off today count as done. They aren&apos;t carried into the next shift.</p>
                  </>
                )}
                {tab === "general" && (
                  <>
                    <p className="text-sm text-muted-foreground">General Tasks you can add:</p>
                    {browseGeneralTasks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing else open.</p>}
                    {browseGeneralTasks.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t.id)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span><span className="text-muted-foreground"> — {t.category}</span>{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}</span>
                      </label>
                    ))}
                  </>
                )}
                {tab === "schools" && (
                  <>
                    <Dropdown name="schoolId" value={schoolId} onChange={setSchoolId} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
                    {!school && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Choose a school to see its tasks.</p>}
                    {school && browseSchoolTasks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing else open at this school.</p>}
                    {browseSchoolTasks.map((t) => (
                      <label key={t.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm shadow-sm transition-colors hover:bg-muted/40", checked.has(t.id) && "border-plan-accent/60 bg-plan-accent/5")}>
                        <input type="checkbox" className="h-4 w-4" checked={checked.has(t.id)} onChange={() => toggle(t.id)} />
                        <span className="min-w-0"><span className="font-medium">{t.fileName}</span><span className="text-muted-foreground"> — {t.category}</span>{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}</span>
                      </label>
                    ))}
                  </>
                )}
                {tab === "reminder" && (
                  <div className="space-y-3">
                    <div className="flex gap-1">
                      <Button type="button" size="xs" variant={reminderMode === "freeText" ? "plan" : "outline"} onClick={() => setReminderMode("freeText")}>Free text</Button>
                      <Button type="button" size="xs" variant={reminderMode === "fromNotes" ? "plan" : "outline"} onClick={() => setReminderMode("fromNotes")}>From Private Notes</Button>
                    </div>
                    {reminderMode === "freeText" ? (
                      <div className="flex gap-2">
                        <input value={reminderText} onChange={(e) => setReminderText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPendingReminderFreeText(); } }} placeholder="What should you remember to check?" className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" />
                        <Button type="button" size="sm" onClick={addPendingReminderFreeText}>Add</Button>
                      </div>
                    ) : myReminderNotes.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No private notes are marked as reminders yet. Mark one from the Private Notes page.</p>
                    ) : (
                      <div className="flex gap-2">
                        <Dropdown name="reminderNoteId" value={selectedNoteId} onChange={setSelectedNoteId} placeholder="Choose a note" options={myReminderNotes.map((n) => ({ value: n.id, label: plainText(n.text, 60) }))} />
                        <Button type="button" size="sm" disabled={!selectedNoteId} onClick={addPendingReminderFromNote}>Add</Button>
                      </div>
                    )}
                    {pendingReminders.length > 0 && (
                      <ul className="space-y-1.5">
                        {pendingReminders.map((r) => (
                          <li key={r.key} className="flex items-center justify-between gap-2 rounded-lg border border-l-4 border-l-plan-accent-secondary bg-card px-3 py-2 text-sm shadow-sm">
                            <span>{r.label}</span>
                            <button type="button" onClick={() => removePendingReminder(r.key)} aria-label="Remove reminder" className="text-muted-foreground hover:text-destructive">✕</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form
              action={async (formData) => {
                setError(null);
                for (const id of checked) formData.append(isSchoolId(id) ? "taskFileCategoryIds" : "generalTaskIds", id);
                formData.set("labels", JSON.stringify(buildLabels()));
                formData.set("reminders", JSON.stringify(pendingReminders.map((r) => ({ label: r.label, noteId: r.noteId }))));
                if (mode === "end") formData.set("endShift", "1");
                const result = await savePlan(formData);
                if (result.error) setError(result.error);
                else { setPendingReminders([]); setOpen(false); }
              }}
              className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-5 py-3"
            >
              <p className="mr-auto text-sm text-muted-foreground">
                <b className="text-foreground">{taskTotal}</b> task{taskTotal === 1 ? "" : "s"} · <b className="text-foreground">{pendingReminders.length}</b> new reminder{pendingReminders.length === 1 ? "" : "s"}
              </p>
              {error && <p role="alert" className="w-full text-sm text-red-600 sm:order-first dark:text-red-400">{error}</p>}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <SubmitButton variant="plan" pendingLabel="Saving…">{mode === "end" ? "Save plan & end day" : "Add to plan"}</SubmitButton>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
