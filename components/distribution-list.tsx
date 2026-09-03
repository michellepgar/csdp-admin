"use client";

import { useState } from "react";
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

function RowView({
  row,
  onEdit,
}: {
  row: DistributionRow;
  onEdit: () => void;
}) {
  return (
    <tr className="border-b bg-record-background">
      <td className="px-2 py-2 align-top text-sm font-medium">{row.school}</td>
      <td className="px-2 py-2 align-top text-sm">{row.enrolled || ""}</td>
      <td className="px-2 py-2 align-top text-sm">{row.contactPerson || ""}</td>
      {DISTRIBUTION_CLASSROOM_TYPES.map((c) =>
        DISTRIBUTION_LANGUAGES.map((l) => (
          <td key={`${c.key}_${l.key}`} className="px-2 py-2 text-center text-sm tabular-nums">
            {distributionCellForms((row.breakdown[c.key] || {})[l.key]) || ""}
          </td>
        ))
      )}
      <td className="px-2 py-2 text-center text-sm font-semibold tabular-nums">
        {distributionRowTotalForms(row)}
      </td>
      <td className="px-2 py-2 align-top text-sm whitespace-pre-wrap">{row.remarks || ""}</td>
      <td className="px-2 py-2 text-right">
        <Button type="button" variant="link" size="sm" onClick={onEdit}>Edit</Button>
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
  const totalCols = 3 + DISTRIBUTION_CLASSROOM_TYPES.length * DISTRIBUTION_LANGUAGES.length + 2;
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={totalCols + 1} className="p-3">
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
              <label className="text-xs font-medium text-muted-foreground">Contact Person</label>
              <Input name="contactPerson" defaultValue={row.contactPerson || ""} />
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
                  <th className="px-2 py-1"></th>
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
            <ConfirmDeleteButton confirmMessage={`Remove ${row.school} from the Distribution List?`} pendingLabel="…" variant="ghost" formAction={removeDistributionRow}>
              Remove
            </ConfirmDeleteButton>
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
  removeDistributionRow,
}: {
  groups: DistributionGroup[];
  addDistributionGroup: (formData: FormData) => void;
  renameDistributionGroup: (formData: FormData) => void;
  removeDistributionGroup: (formData: FormData) => void;
  addDistributionRow: (formData: FormData) => void;
  updateDistributionRow: (formData: FormData) => void;
  removeDistributionRow: (formData: FormData) => void;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);

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
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b bg-title-background text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-2 py-2">School</th>
                    <th className="px-2 py-2">Enrolled</th>
                    <th className="px-2 py-2">Contact Person</th>
                    {DISTRIBUTION_CLASSROOM_TYPES.map((c) =>
                      DISTRIBUTION_LANGUAGES.map((l) => (
                        <th key={`${c.key}_${l.key}`} className="px-2 py-2 text-center">
                          {c.label}
                          <br />
                          {l.label}
                        </th>
                      ))
                    )}
                    <th className="px-2 py-2 text-center">Total</th>
                    <th className="px-2 py-2">Remarks</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {group.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3 + DISTRIBUTION_CLASSROOM_TYPES.length * DISTRIBUTION_LANGUAGES.length + 3}
                        className="px-2 py-4 text-center text-sm text-muted-foreground"
                      >
                        No schools in this group yet.
                      </td>
                    </tr>
                  )}
                  {group.rows.map((row) =>
                    editingRow === row.id ? (
                      <RowEdit
                        key={row.id}
                        groupId={group.id}
                        row={row}
                        onDone={() => setEditingRow(null)}
                        updateDistributionRow={updateDistributionRow}
                        removeDistributionRow={removeDistributionRow}
                      />
                    ) : (
                      <RowView key={row.id} row={row} onEdit={() => setEditingRow(row.id)} />
                    )
                  )}
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
