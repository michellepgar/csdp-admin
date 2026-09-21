import assert from "node:assert/strict";
import test from "node:test";
import { duplicateFileNameInTable, duplicateFileNamesInTable } from "../lib/shared-task-files.ts";

test("duplicateFileNameInTable matches by trimmed, case-insensitive name within the same table", () => {
  const existing = [
    { fileName: "  consent-forms-batch-1.pdf ", tableId: "t1", categoryIds: ["c1", "c2"] },
    { fileName: "other-file.pdf", tableId: "t1", categoryIds: ["c1", "c2"] },
    { fileName: "consent-forms-batch-1.pdf", tableId: "t2", categoryIds: ["c3"] },
  ];
  // Same table (by tableId), same name, different case/whitespace -- a match.
  assert.equal(duplicateFileNameInTable(existing, "t1", ["c1", "c2"], "CONSENT-FORMS-BATCH-1.PDF"), true);
  // Same name, but a different table -- no match.
  assert.equal(duplicateFileNameInTable(existing, "t3", ["c9"], "consent-forms-batch-1.pdf"), false);
  // Different name entirely -- no match.
  assert.equal(duplicateFileNameInTable(existing, "t1", ["c1", "c2"], "brand-new-file.pdf"), false);
  // A blank name never matches (the required-field check catches this earlier anyway).
  assert.equal(duplicateFileNameInTable(existing, "t1", ["c1", "c2"], "   "), false);
});

test("duplicateFileNameInTable treats a table with no saved table_id as the same table by its category set, matching groupTaskTables' own grouping key", () => {
  const existing = [
    // No tableId -- exactly the shape of an existing file before anyone has
    // used that table's own "Add file" row (see addTask's own comment on
    // when table_id actually gets written).
    { fileName: "roster.pdf", categoryIds: ["catA"] },
  ];
  // Adding through the same table's row submits its computed key as tableId
  // -- must still count as the same table as the untabled sibling above.
  assert.equal(duplicateFileNameInTable(existing, JSON.stringify(["catA"]), ["catA"], "roster.pdf"), true);
  // A different category set is a different table.
  assert.equal(duplicateFileNameInTable(existing, "", ["catB"], "roster.pdf"), false);
});

test("duplicateFileNamesInTable flags every name that appears more than once, case-insensitively", () => {
  const files = [
    { fileName: "a.pdf" },
    { fileName: "A.pdf" },
    { fileName: "b.pdf" },
    { fileName: "  a.pdf  " },
  ];
  assert.deepEqual(duplicateFileNamesInTable(files), new Set(["a.pdf"]));
  assert.deepEqual(duplicateFileNamesInTable([{ fileName: "solo.pdf" }]), new Set());
});
