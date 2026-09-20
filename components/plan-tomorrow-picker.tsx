"use client";

import { useState } from "react";
import { Bell, ClipboardList, School as SchoolIcon } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import type { School, SchoolDataEntry, GeneralTask, PlanItem, PrivateNote } from "@/lib/app-state";

interface OpenItem { id: string; schoolId?: string; schoolName: string; category: string; fileName: string; status: string }
type Tab = "inProgress" | "schools" | "general" | "reminder";

function plainText(html: string, max: number): string {
  return html.replace(/<[^>]+>/g, " ").trim().slice(0, max) || "Note";
}

/* Redesigned to match the same "pick a destination first" style
   PlanPriorityStartForm uses -- four tabs (In Progress / Schools /
   General / Reminder) instead of one long flat form mixing carry-over
   checkboxes, a school browser, and a general-tasks browser all in one
   scroll. Everything still saves together through one Save Plan click
   (savePlan), same as before -- the tabs only change what's visible
   while building that one submission, they don't submit separately. */
export function PlanTomorrowPicker({ currentUserName, schools, schoolData, generalTasks, myPlanItems, myReminderNotes, savePlan }: {
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "inProgress", label: "In Progress", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "schools", label: "Schools", icon: <SchoolIcon className="h-4 w-4" /> },
    { id: "general", label: "General", icon: <ClipboardList className="h-4 w-4" /> },
    { id: "reminder", label: "Reminder", icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div>
      <Button type="button" variant="plan" size="sm" onClick={() => setOpen(true)}>End Today&apos;s Work</Button>
      {open && (
        <div className="mt-2 w-full max-w-md rounded-lg border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold">Plan your next shift</p>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {tabs.map((t) => (
              <Button key={t.id} type="button" variant={tab === t.id ? "plan" : "outline"} size="sm" className="h-auto flex-col gap-0.5 py-2" onClick={() => setTab(t.id)}>
                {t.icon} {t.label}
              </Button>
            ))}
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-md bg-muted/30 p-2">
            {tab === "inProgress" && (
              <>
                <p className="text-xs text-muted-foreground">Still in progress today — uncheck to drop from your next shift plan:</p>
                {carryOver.length === 0 && <p className="text-xs text-muted-foreground">Nothing carried over.</p>}
                {carryOver.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.schoolName} · {t.category}
                  </label>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">Reminders you checked off today count as done — they aren&apos;t carried into the next shift.</p>
              </>
            )}
            {tab === "general" && (
              <>
                <p className="text-xs text-muted-foreground">General Tasks:</p>
                {browseGeneralTasks.length === 0 && <p className="text-xs text-muted-foreground">Nothing else open.</p>}
                {browseGeneralTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.category}{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}
                  </label>
                ))}
              </>
            )}
            {tab === "schools" && (
              <>
                <Dropdown name="schoolId" value={schoolId} onChange={setSchoolId} placeholder="Choose a school" options={schools.map((s) => ({ value: s.id, label: s.name }))} />
                {school && browseSchoolTasks.length === 0 && <p className="text-xs text-muted-foreground">Nothing else open at this school.</p>}
                {browseSchoolTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={checked.has(t.id)} onChange={() => toggle(t.id)} /> {t.fileName} — {t.category}{t.status === "Completed" && <span className="text-muted-foreground"> (Completed)</span>}
                  </label>
                ))}
              </>
            )}
            {tab === "reminder" && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Button type="button" size="xs" variant={reminderMode === "freeText" ? "plan" : "outline"} onClick={() => setReminderMode("freeText")}>Free text</Button>
                  <Button type="button" size="xs" variant={reminderMode === "fromNotes" ? "plan" : "outline"} onClick={() => setReminderMode("fromNotes")}>From Private Notes</Button>
                </div>
                {reminderMode === "freeText" ? (
                  <div className="flex gap-2">
                    <input value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="What should you remember to check?" className="h-8 flex-1 rounded-md border px-2 text-sm" />
                    <Button type="button" size="sm" onClick={addPendingReminderFreeText}>Add</Button>
                  </div>
                ) : myReminderNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No private notes are marked as reminders yet — mark one from the Private Notes page.</p>
                ) : (
                  <div className="flex gap-2">
                    <Dropdown name="reminderNoteId" value={selectedNoteId} onChange={setSelectedNoteId} placeholder="Choose a note" options={myReminderNotes.map((n) => ({ value: n.id, label: plainText(n.text, 60) }))} />
                    <Button type="button" size="sm" disabled={!selectedNoteId} onClick={addPendingReminderFromNote}>Add</Button>
                  </div>
                )}
                {pendingReminders.length > 0 && (
                  <ul className="space-y-1">
                    {pendingReminders.map((r) => (
                      <li key={r.key} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-sm">
                        <span>{r.label}</span>
                        <button type="button" onClick={() => removePendingReminder(r.key)} className="text-muted-foreground hover:text-destructive">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <form
            action={async (formData) => {
              setError(null);
              for (const id of checked) formData.append(isSchoolId(id) ? "taskFileCategoryIds" : "generalTaskIds", id);
              formData.set("labels", JSON.stringify(buildLabels()));
              const reminders = pendingReminders.map((r) => ({ label: r.label, noteId: r.noteId }));
              formData.set("reminders", JSON.stringify(reminders));
              const result = await savePlan(formData);
              if (result.error) setError(result.error);
              else setOpen(false);
            }}
            className="mt-3 flex gap-2"
          >
            <SubmitButton variant="plan" size="sm" pendingLabel="Saving…">Save Plan</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </form>
          {error && <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
