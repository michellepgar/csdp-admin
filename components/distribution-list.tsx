"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Dropdown } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DISTRIBUTION_CLASSROOM_TYPES,
  DISTRIBUTION_LANGUAGES,
  distributionRowTotalForms,
  distributionRowLanguageTotal,
  distributionCellForms,
  distributionCellDisplay,
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

          <div className="overflow-x-auto">
            <table className="min-w-[600px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-2 py-1">Number of Classrooms</th>
                  {DISTRIBUTION_LANGUAGES.map((l) => (
                    <th key={l.key} className="px-2 py-1 text-center">{l.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_CLASSROOM_TYPES.map((c) => (
                  <tr key={c.key} className="border-t">
                    <td className="px-2 py-1 font-medium">
                      {c.label}
                      {c.key === "regular" && row.classroomRegular ? ` (${row.classroomRegular} classrooms)` : ""}
                      {c.key === "launch" && row.classroomLaunch ? ` (${row.classroomLaunch} classrooms)` : ""}
                      {c.key === "crr" && row.classroomCrr ? ` (${row.classroomCrr} classrooms)` : ""}
                    </td>
                    {DISTRIBUTION_LANGUAGES.map((l) => (
                      <td key={l.key} className="px-2 py-1 text-center tabular-nums">
                        {distributionCellForms((row.breakdown[c.key] || {})[l.key]) || ""}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td className="px-2 py-1">Total forms distributed</td>
                  {DISTRIBUTION_LANGUAGES.map((l) => (
                    <td key={l.key} className="px-2 py-1 text-center tabular-nums">
                      {distributionRowLanguageTotal(row, l.key)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

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

function RowEdit({
  groupId,
  row,
  onDone,
  updateDistributionRow,
  removeDistributionRow,
}: {
  groupId: string;
  row: DistributionRow;
  onDone: () => void;
  updateDistributionRow: (formData: FormData) => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  const totalCols = 12 + DISTRIBUTION_LANGUAGES.length;
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={totalCols} className="p-3">
        <form action={updateDistributionRow} onSubmit={onDone} className="space-y-3">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="rowId" value={row.id} />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">School</label>
              <Input defaultValue={row.school} disabled />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Enrolled</label>
              <Input name="enrolled" defaultValue={row.enrolled || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Number of Consent Packets</label>
              <Input name="consentPackets" defaultValue={row.consentPackets || ""} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact Person</label>
              <Input name="contactPerson" defaultValue={row.contactPerson || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Regular Classrooms</label>
              <Input name="classroomRegular" defaultValue={row.classroomRegular || ""} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Launch Classrooms</label>
              <Input name="classroomLaunch" defaultValue={row.classroomLaunch || ""} inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CRR Classrooms</label>
              <Input name="classroomCrr" defaultValue={row.classroomCrr || ""} inputMode="numeric" />
            </div>
            <div className="space-y-1 md:col-span-4">
              <label className="text-xs font-medium text-muted-foreground">Remarks</label>
              <textarea name="remarks" defaultValue={row.remarks || ""} rows={2} className="w-full rounded-md border px-2 py-1 text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[600px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-2 py-1">Forms distributed, by language</th>
                  {DISTRIBUTION_LANGUAGES.map((l) => (
                    <th key={l.key} className="px-2 py-1 text-center">{l.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTION_CLASSROOM_TYPES.map((c) => (
                  <tr key={c.key}>
                    <td className="px-2 py-1 text-sm font-medium">{c.label}</td>
                    {DISTRIBUTION_LANGUAGES.map((l) => (
                      <td key={l.key} className="px-2 py-1">
                        <Input
                          name={`cell_${c.key}_${l.key}`}
                          defaultValue={distributionCellDisplay((row.breakdown[c.key] || {})[l.key])}
                          className="w-20 text-center"
                          inputMode="numeric"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
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
              </table>
            </div>
            {group.rows.length > 0 && (
              <div className="flex flex-wrap gap-3 border-t p-3 text-xs text-muted-foreground">
                {DISTRIBUTION_LANGUAGES.map((l) => (
                  <span key={l.key}>
                    {l.label}: {group.rows.reduce((sum, r) => sum + distributionRowLanguageTotal(r, l.key), 0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
