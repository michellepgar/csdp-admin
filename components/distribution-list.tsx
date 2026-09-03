"use client";

import { useRef, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CalculatorButton } from "@/components/calculator-button";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
  distributionRowTotalForms,
  distributionRowLanguageTotal,
  distributionRowConsentPacketsTotal,
  distributionCellForms,
  distributionCellField,
  type DistributionGroup,
  type DistributionRow,
} from "@/lib/app-state";

/* Three view states per row instead of the usual view/edit toggle --
   Michelle asked for a separate read-only "Show" (eye icon) alongside
   Edit (pencil) and Remove (trash), distinct from just relabeling the
   same action twice. No modal/dialog component exists anywhere in
   this app yet, so this follows the same expand-the-row-in-place
   convention every other list here already uses for editing, just
   with a second, non-editable expanded form. */
type RowMode = "compact" | "detail" | "edit";

function DistributedCheckbox({
  rowId,
  distributed,
  toggleDistributionRowDistributed,
}: {
  rowId: string;
  distributed: boolean;
  toggleDistributionRowDistributed: (formData: FormData) => void;
}) {
  return (
    <form action={toggleDistributionRowDistributed}>
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="distributed" value={String(!distributed)} />
      <button type="submit" aria-label={distributed ? "Mark as not distributed" : "Mark as distributed"}>
        <input type="checkbox" checked={distributed} readOnly className="pointer-events-none h-4 w-4" />
      </button>
    </form>
  );
}

function RowView({
  row,
  onShowDetail,
  onEdit,
  toggleDistributionRowDistributed,
  removeDistributionRow,
}: {
  row: DistributionRow;
  onShowDetail: () => void;
  onEdit: () => void;
  toggleDistributionRowDistributed: (formData: FormData) => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  return (
    <tr className="border-b bg-record-background">
      <td className="px-2 py-2 align-top text-sm font-medium">{row.school}</td>
      <td className="px-2 py-2 align-top text-sm">{row.enrolled || ""}</td>
      <td className="px-2 py-2 text-center">
        <DistributedCheckbox rowId={row.id} distributed={!!row.distributed} toggleDistributionRowDistributed={toggleDistributionRowDistributed} />
      </td>
      <td className="px-2 py-2 text-center text-sm tabular-nums">{row.classroomRegular || ""}</td>
      <td className="px-2 py-2 text-center text-sm tabular-nums">{row.classroomLaunch || ""}</td>
      <td className="px-2 py-2 text-center text-sm tabular-nums">{row.classroomCrr || ""}</td>
      <td className="px-2 py-2 text-center text-sm tabular-nums">{row.consentPackets || ""}</td>
      {DISTRIBUTION_LANGUAGES.map((l) => (
        <td key={l.key} className="px-2 py-2 text-center text-sm tabular-nums">
          {distributionRowLanguageTotal(row, l.key) || ""}
        </td>
      ))}
      <td className="px-2 py-2 text-center text-sm font-semibold tabular-nums">
        {distributionRowTotalForms(row)}
      </td>
      <td className="px-2 py-2 align-top text-sm">{row.contactPerson || ""}</td>
      <td className="px-2 py-2 align-top text-sm whitespace-pre-wrap">{row.remarks || ""}</td>
      <td className="px-2 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Show details" onClick={onShowDetail}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <form action={removeDistributionRow}>
            <input type="hidden" name="rowId" value={row.id} />
            <ConfirmDeleteButton
              confirmMessage={`Remove ${row.school} from the Distribution List?`}
              pendingLabel="…"
              variant="ghost"
              size="icon-sm"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </ConfirmDeleteButton>
          </form>
        </div>
      </td>
    </tr>
  );
}

/* Read-only -- everything RowView shows plus the full classroom-type x
   language forms breakdown that the compact row only ever shows as
   three language TOTALS. */
function RowDetail({
  row,
  onDone,
  onEdit,
  removeDistributionRow,
}: {
  row: DistributionRow;
  onDone: () => void;
  onEdit: () => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  const totalCols = 12 + DISTRIBUTION_LANGUAGES.length;
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={totalCols} className="p-3">
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">School</dt><dd>{row.school}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Enrolled</dt><dd>{row.enrolled || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Distributed</dt><dd>{row.distributed ? "Yes" : "No"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Number of Consent Packets</dt><dd>{row.consentPackets || "—"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Contact Person</dt><dd>{row.contactPerson || "—"}</dd></div>
            <div className="md:col-span-3"><dt className="text-xs font-semibold uppercase text-muted-foreground">Remarks</dt><dd className="whitespace-pre-wrap">{row.remarks || "—"}</dd></div>
          </div>

          {/* Full Packets/Loose/Extra Packets/Extra Loose breakdown,
              read-only -- same fields RowEdit's grid edits, Michelle
              asked for Show to actually reveal them instead of just
              the computed forms total per cell. */}
          <div className="overflow-x-auto">
            <table className="min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-2 py-1">Classroom Type</th>
                  <th className="px-2 py-1">Language</th>
                  <th className="px-2 py-1 text-center">Packets</th>
                  <th className="px-2 py-1 text-center">Packet Size</th>
                  <th className="px-2 py-1 text-center">Loose Forms</th>
                  <th className="px-2 py-1 text-center">Extra Packets</th>
                  <th className="px-2 py-1 text-center">Extra Loose</th>
                  <th className="px-2 py-1 text-center">Forms Total</th>
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_CLASSROOM_TYPES.flatMap((c) =>
                  DISTRIBUTION_LANGUAGES.map((l, i) => {
                    const cell = (row.breakdown[c.key] || {})[l.key];
                    const classroomCount =
                      c.key === "regular" ? row.classroomRegular : c.key === "launch" ? row.classroomLaunch : row.classroomCrr;
                    return (
                      <tr key={`${c.key}_${l.key}`} className={i === 0 ? "border-t" : ""}>
                        {i === 0 && (
                          <td rowSpan={DISTRIBUTION_LANGUAGES.length} className="px-2 py-1 align-top font-medium">
                            {c.label}
                            {classroomCount ? ` (${classroomCount} classrooms)` : ""}
                          </td>
                        )}
                        <td className="px-2 py-1">{l.label}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{distributionCellField(cell, "packets") || "—"}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{distributionCellField(cell, "packetSize")}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{distributionCellField(cell, "loose") || "—"}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{distributionCellField(cell, "extraPackets") || "—"}</td>
                        <td className="px-2 py-1 text-center tabular-nums">{distributionCellField(cell, "extraLoose") || "—"}</td>
                        <td className="px-2 py-1 text-center font-semibold tabular-nums">{distributionCellForms(cell)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
            <span>Total forms distributed:</span>
            {DISTRIBUTION_LANGUAGES.map((l) => (
              <span key={l.key}>{l.label}: {distributionRowLanguageTotal(row, l.key)}</span>
            ))}
            <span>All: {distributionRowTotalForms(row)}</span>
          </p>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>Edit</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>Close</Button>
            <form action={removeDistributionRow} className="ml-auto">
              <input type="hidden" name="rowId" value={row.id} />
              <ConfirmDeleteButton confirmMessage={`Remove ${row.school} from the Distribution List?`} pendingLabel="…" variant="ghost" size="sm">
                <Trash2 className="h-4 w-4" />
              </ConfirmDeleteButton>
            </form>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* One numeric input + its calculator helper, sharing a ref so
   CalculatorButton can write straight into the input's DOM value. Used
   for every numeric field in RowEdit except the ones Michelle
   specifically excluded (Group, School, Enrolled, Contact Person).

   A plain <input>, not the styled Input component -- confirmed
   directly that a ref passed to Input never reaches the real DOM node
   (Base UI's primitive doesn't forward it the way this needed),
   Same workaround Dropdown's own hidden input already uses for the
   same reason. Classes copied from Input's own so this still looks
   identical to every other field in this form. */
function CalcInput({ name, defaultValue, className }: { name: string; defaultValue: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        name={name}
        defaultValue={defaultValue}
        inputMode="numeric"
        className={
          "h-8 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 " +
          (className ?? "w-16 text-center")
        }
      />
      <CalculatorButton inputRef={ref} />
    </div>
  );
}

const BREAKDOWN_SUBFIELDS = [
  { key: "packets" as const, label: "Packets" },
  { key: "loose" as const, label: "Loose Forms" },
  { key: "extraPackets" as const, label: "Extra Packets" },
  { key: "extraLoose" as const, label: "Extra Loose" },
];

function RowEdit({
  groupId,
  groups,
  row,
  onDone,
  updateDistributionRow,
  removeDistributionRow,
}: {
  groupId: string;
  groups: DistributionGroup[];
  row: DistributionRow;
  onDone: () => void;
  updateDistributionRow: (formData: FormData) => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  const totalCols = 12 + DISTRIBUTION_LANGUAGES.length;
  const consentPacketsRef = useRef<HTMLInputElement>(null);

  /* Number of Consent Packets isn't entered anymore -- Michelle asked
     for it to always equal Packets + Extra Packets summed across
     every classroom-type x language cell (see
     distributionRowConsentPacketsTotal's comment in lib/app-state.ts).
     Recomputed live, straight from the DOM (same uncontrolled-inputs
     convention as CalcInput/CalculatorButton) whenever any packets_*
     or extraPackets_* field changes, so it visibly updates as you
     type -- not just after saving. The actual saved value is always
     computed server-side from the submitted breakdown regardless
     (app/(app)/distribution-list/actions.ts), so this display can
     never drift from what gets saved even if a keystroke were missed
     here. */
  function recomputeConsentPackets(e: React.FormEvent<HTMLDivElement>) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.name.startsWith("packets_") && !target.name.startsWith("extraPackets_")) return;
    let total = 0;
    e.currentTarget.querySelectorAll<HTMLInputElement>('input[name^="packets_"], input[name^="extraPackets_"]').forEach((el) => {
      total += Number(el.value) || 0;
    });
    if (consentPacketsRef.current) consentPacketsRef.current.value = String(total);
  }
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={totalCols} className="p-3">
        <form action={updateDistributionRow} onSubmit={onDone} className="space-y-3">
          <input type="hidden" name="rowId" value={row.id} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Group</label>
              <Dropdown
                name="moveToGroupId"
                defaultValue={groupId}
                options={groups.map((g) => ({ value: g.id, label: g.name }))}
                className="w-full rounded-md border px-2 py-1.5 text-left text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">School</label>
              <Input defaultValue={row.school} disabled />
            </div>
            {/* w-24 -- comfortably fits the 5-digit max these two
                fields actually get encoded with. */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Enrolled</label>
              <Input name="enrolled" defaultValue={row.enrolled || ""} className="w-24" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Number of Consent Packets</label>
              <input
                ref={consentPacketsRef}
                type="text"
                readOnly
                tabIndex={-1}
                title="Packets + Extra Packets, totaled automatically from the grid below"
                defaultValue={distributionRowConsentPacketsTotal(row)}
                className="h-8 w-24 rounded-lg border border-input bg-muted px-2.5 py-1 text-center text-sm text-muted-foreground outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact Person</label>
              <Input name="contactPerson" defaultValue={row.contactPerson || ""} />
            </div>
            {/* w-16 -- a classroom count is realistically 1-2 digits,
                same width as the breakdown grid's own inputs below. */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Regular Classrooms</label>
              <CalcInput name="classroomRegular" defaultValue={row.classroomRegular || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Launch Classrooms</label>
              <CalcInput name="classroomLaunch" defaultValue={row.classroomLaunch || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CRR Classrooms</label>
              <CalcInput name="classroomCrr" defaultValue={row.classroomCrr || ""} />
            </div>
            <div className="space-y-1 md:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Remarks</label>
              <textarea name="remarks" defaultValue={row.remarks || ""} rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
            </div>
          </div>

          {/* Packets/packet size/Loose/Extra Packets/Extra Loose per
              classroom type x language, same shape the original HTML
              app used (and automatically totals the same way -- see
              distributionCellForms) -- restored per Michelle's
              request, having been simplified to one plain number per
              cell earlier in this rewrite. Every field here gets a
              calculator button; Michelle only excluded Group/School/
              Enrolled/Contact Person, which live above, not in this
              grid. */}
          <div className="overflow-x-auto" onInput={recomputeConsentPackets}>
            <table className="min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-2 py-1">Classroom Type</th>
                  <th className="px-2 py-1">Language</th>
                  <th className="px-2 py-1">
                    Packets
                    <br />
                    <span className="font-normal normal-case">(size editable)</span>
                  </th>
                  {BREAKDOWN_SUBFIELDS.slice(1).map((f) => (
                    <th key={f.key} className="px-2 py-1">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_CLASSROOM_TYPES.flatMap((c) =>
                  DISTRIBUTION_LANGUAGES.map((l, i) => {
                    const cell = (row.breakdown[c.key] || {})[l.key];
                    return (
                      <tr key={`${c.key}_${l.key}`} className={i === 0 ? "border-t" : ""}>
                        {i === 0 && (
                          <td rowSpan={DISTRIBUTION_LANGUAGES.length} className="px-2 py-1 align-top text-sm font-medium">
                            {c.label}
                          </td>
                        )}
                        <td className="px-2 py-1">{l.label}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <CalcInput
                              name={`packets_${c.key}_${l.key}`}
                              defaultValue={distributionCellField(cell, "packets")}
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                            {/* No calculator here -- packet size is a
                                single multiplier (usually just 25),
                                not a list of numbers to add up. */}
                            <Input
                              name={`packetSize_${c.key}_${l.key}`}
                              defaultValue={distributionCellField(cell, "packetSize")}
                              className="w-14 text-center"
                              inputMode="numeric"
                            />
                          </div>
                        </td>
                        {(["loose", "extraPackets", "extraLoose"] as const).map((field) => (
                          <td key={field} className="px-2 py-1">
                            <CalcInput
                              name={`${field}_${c.key}_${l.key}`}
                              defaultValue={distributionCellField(cell, field)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <SubmitButton pendingLabel="Saving…">Done</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
            <div className="ml-auto">
              <ConfirmDeleteButton confirmMessage={`Remove ${row.school} from the Distribution List?`} pendingLabel="…" variant="ghost" formAction={removeDistributionRow}>
                <Trash2 className="h-4 w-4" />
              </ConfirmDeleteButton>
            </div>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function DistributionList({
  groups,
  addDistributionGroup,
  renameDistributionGroup,
  removeDistributionGroup,
  addDistributionRow,
  updateDistributionRow,
  toggleDistributionRowDistributed,
  removeDistributionRow,
}: {
  groups: DistributionGroup[];
  addDistributionGroup: (formData: FormData) => void;
  renameDistributionGroup: (formData: FormData) => void;
  removeDistributionGroup: (formData: FormData) => void;
  addDistributionRow: (formData: FormData) => void;
  updateDistributionRow: (formData: FormData) => void;
  toggleDistributionRowDistributed: (formData: FormData) => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  const [rowModes, setRowModes] = useState<Record<string, RowMode>>({});
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);

  function setMode(rowId: string, mode: RowMode) {
    setRowModes((prev) => ({ ...prev, [rowId]: mode }));
  }

  return (
    <div className="space-y-6">
      <form action={addDistributionRow} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
        <Dropdown
          name="group"
          required
          placeholder="Choose group…"
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          className="rounded-md border px-2 py-1.5 text-left text-sm"
        />
        <Input name="school" placeholder="School name" required className="max-w-xs" />
        <SubmitButton pendingLabel="Adding…">+ Add school</SubmitButton>
      </form>

      <form action={addDistributionGroup} className="flex items-center gap-2">
        <Input name="name" placeholder="New group name" required className="max-w-xs" />
        <SubmitButton pendingLabel="Adding…">+ Add group</SubmitButton>
      </form>

      {groups.map((group) => {
        const totalForms = group.rows.reduce((sum, r) => sum + distributionRowTotalForms(r), 0);
        return (
          <div key={group.id} className="rounded-md border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              {editingGroupName === group.id ? (
                <form
                  action={renameDistributionGroup}
                  onSubmit={() => setEditingGroupName(null)}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="id" value={group.id} />
                  <Input name="name" defaultValue={group.name} className="max-w-xs" />
                  <SubmitButton pendingLabel="…">✓</SubmitButton>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{group.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGroupName(group.id)}>✏️</Button>
                  <span className="text-xs text-muted-foreground">{totalForms} forms total</span>
                </div>
              )}
              <form action={removeDistributionGroup}>
                <input type="hidden" name="id" value={group.id} />
                <ConfirmDeleteButton confirmMessage={`Remove the "${group.name}" group and all its schools from the Distribution List?`} pendingLabel="…" variant="ghost" size="sm">Remove group</ConfirmDeleteButton>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px]">
                <thead>
                  <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-2 py-2" rowSpan={2}>School</th>
                    <th className="px-2 py-2" rowSpan={2}>Enrolled</th>
                    <th className="px-2 py-2 text-center" rowSpan={2}>Distributed</th>
                    <th className="border-l px-2 py-2 text-center" colSpan={DISTRIBUTION_CLASSROOM_TYPES.length}>Number of Classrooms</th>
                    <th className="border-l px-2 py-2 text-center" rowSpan={2}>
                      Number of
                      <br />
                      Consent Packets
                    </th>
                    <th className="border-l px-2 py-2 text-center" colSpan={DISTRIBUTION_LANGUAGES.length}>Languages</th>
                    <th className="border-l px-2 py-2 text-center" rowSpan={2}>
                      Total Number of
                      <br />
                      Forms Distributed
                    </th>
                    <th className="px-2 py-2" rowSpan={2}>Contact Person</th>
                    <th className="px-2 py-2" rowSpan={2}>Remarks</th>
                    <th rowSpan={2} />
                  </tr>
                  <tr className="border-b bg-title-background text-center text-xs font-semibold uppercase text-muted-foreground">
                    {DISTRIBUTION_CLASSROOM_TYPES.map((c, i) => (
                      <th key={c.key} className={`px-2 py-1 ${i === 0 ? "border-l" : ""}`}>{c.label.replace(" Classroom", "").replace(" Classes", "")}</th>
                    ))}
                    {DISTRIBUTION_LANGUAGES.map((l, i) => (
                      <th key={l.key} className={`px-2 py-1 ${i === 0 ? "border-l" : ""}`}>{l.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.length === 0 && (
                    <tr>
                      <td colSpan={12 + DISTRIBUTION_LANGUAGES.length} className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No schools in this group yet.
                      </td>
                    </tr>
                  )}
                  {group.rows.map((row) => {
                    const mode = rowModes[row.id] || "compact";
                    if (mode === "edit") {
                      return (
                        <RowEdit
                          key={row.id}
                          groupId={group.id}
                          groups={groups}
                          row={row}
                          onDone={() => setMode(row.id, "compact")}
                          updateDistributionRow={updateDistributionRow}
                          removeDistributionRow={removeDistributionRow}
                        />
                      );
                    }
                    if (mode === "detail") {
                      return (
                        <RowDetail
                          key={row.id}
                          row={row}
                          onDone={() => setMode(row.id, "compact")}
                          onEdit={() => setMode(row.id, "edit")}
                          removeDistributionRow={removeDistributionRow}
                        />
                      );
                    }
                    return (
                      <RowView
                        key={row.id}
                        row={row}
                        onShowDetail={() => setMode(row.id, "detail")}
                        onEdit={() => setMode(row.id, "edit")}
                        toggleDistributionRowDistributed={toggleDistributionRowDistributed}
                        removeDistributionRow={removeDistributionRow}
                      />
                    );
                  })}
                </tbody>
                {group.rows.length > 0 && (
                  // Sits directly under the Languages columns (not a
                  // separate line below the whole table) -- 7 columns
                  // come before Languages (School/Enrolled/Distributed/
                  // the 3 classroom columns/Consent Packets), 4 after
                  // (Total Forms/Contact Person/Remarks/the icon
                  // column), matching the header's own column count.
                  <tfoot>
                    <tr className="border-t bg-title-background/60 text-xs font-semibold text-muted-foreground">
                      <td colSpan={7} className="px-2 py-2 text-right">Group total</td>
                      {DISTRIBUTION_LANGUAGES.map((l) => (
                        <td key={l.key} className="px-2 py-2 text-center tabular-nums">
                          {group.rows.reduce((sum, r) => sum + distributionRowLanguageTotal(r, l.key), 0)}
                        </td>
                      ))}
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
