"use client";

import { Button } from "@/components/ui/button";
import type { School, SchoolDataEntry, ChecklistTemplateItem, ChecklistProgressEntry } from "@/lib/app-state";

// Wraps a value in double quotes and escapes any inside it, per the
// plain CSV convention every spreadsheet app (Excel, Sheets, Numbers)
// already reads without a special import step -- a task's file name
// or a VA list can contain a comma, so every field needs this, not
// just the ones that happen to have one today.
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvRows(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/* One button, one file, covering every school -- the only export in
   the app (a per-school Tasks/Checklist export existed briefly but was
   removed; this is the one Michelle kept). Tasks and the Yearly
   Checklist have different shapes (a task has a category/file name/
   count; a checklist entry has an item/checked-by), so rather than
   force them into one mismatched table this is two stacked tables in
   the same CSV -- a blank line between them reads fine in
   Excel/Sheets as "two separate ranges on one sheet," which is
   exactly what this is. */
export function ExportAllSchoolsButton({
  schools,
  schoolData,
  checklistTemplate,
  checklistProgress,
}: {
  schools: School[];
  schoolData: Record<string, SchoolDataEntry>;
  checklistTemplate: ChecklistTemplateItem[];
  checklistProgress: Record<string, ChecklistProgressEntry>;
}) {
  function handleExport() {
    const sortedSchools = [...schools].sort((a, b) => a.name.localeCompare(b.name));

    const taskRows: string[][] = [];
    for (const school of sortedSchools) {
      for (const t of schoolData[school.id]?.tasks || []) {
        taskRows.push([
          school.name,
          t.category,
          t.fileName,
          t.count || "",
          t.status,
          t.vaAssigned.join("; "),
          t.commsStatus || "",
          (t.commsVaAssigned || []).join("; "),
          new Date(t.createdAt).toLocaleDateString(),
        ]);
      }
    }

    const checklistRows: string[][] = [];
    for (const school of sortedSchools) {
      for (const item of checklistTemplate) {
        const entry = checklistProgress[`${school.id}:${item.id}`];
        checklistRows.push([school.name, item.description, entry?.status || "Not Done", entry?.checkedBy || ""]);
      }
    }

    const csv = [
      csvRows([["Tasks"], ["School", "Category", "File Name", "Count", "Status", "VA Assigned", "Communications Status", "Communications VA", "Created"], ...taskRows]),
      "",
      csvRows([["Yearly Checklist"], ["School", "Item", "Status", "Checked By"], ...checklistRows]),
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `all-schools-tasks-and-checklist-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={schools.length === 0}>
      Export All Schools (Tasks &amp; Checklist)
    </Button>
  );
}
