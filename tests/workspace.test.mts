import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COLUMNS, MAX_ROWS,
  columnName, defaultContent, defaultRect, clampRect, parsePastedGrid, coerceCell,
  addRow, removeRow, addColumn, removeColumn, renameColumn, setColumnType, setCell, applyPaste,
  validateBlockContent, normalizeTags, tagColor, dueState,
  type TableContent,
} from "../lib/workspace.ts";

const identity = (html: string) => html;

function table(): TableContent {
  return {
    columns: [{ id: "c1", name: "Name", type: "text" }, { id: "c2", name: "Qty", type: "number" }],
    rows: [{ id: "r1", cells: { c1: "Ann", c2: 3 } }],
  };
}

test("columnName counts like a spreadsheet", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
  assert.equal(columnName(27), "AB");
});

test("defaultContent gives each kind a usable starting shape", () => {
  const t = defaultContent("table") as TableContent;
  assert.equal(t.columns.length, 3);
  assert.equal(t.rows.length, 3);
  assert.deepEqual(defaultContent("note"), { html: "" });
  assert.deepEqual(defaultContent("reminder"), { text: "", due: null, done: false });
});

test("defaultRect and clampRect keep blocks reachable and within size limits", () => {
  const r = defaultRect("note", 40, 50);
  assert.equal(r.x, 40);
  assert.equal(r.y, 50);
  const c = clampRect({ x: -30, y: -5, w: 10, h: 99999 }, "table");
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  assert.equal(c.w, 240);
  assert.equal(c.h, 1200);
});

test("parsePastedGrid reads Excel/Sheets clipboard text", () => {
  assert.deepEqual(parsePastedGrid("a\tb\nc\td\n"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parsePastedGrid("a\tb\r\nc\td"), [["a", "b"], ["c", "d"]]);
  assert.deepEqual(parsePastedGrid('"x\ty"\t"line1\nline2"\t"say ""hi"""'), [["x\ty", "line1\nline2", 'say "hi"']]);
  assert.deepEqual(parsePastedGrid(""), []);
  assert.deepEqual(parsePastedGrid("single"), [["single"]]);
});

test("coerceCell converts to each column type", () => {
  assert.equal(coerceCell("1,250.5", "number"), 1250.5);
  assert.equal(coerceCell("abc", "number"), null);
  assert.equal(coerceCell("", "number"), null);
  assert.equal(coerceCell("9/3/2026", "date"), "2026-09-03");
  assert.equal(coerceCell("2026-09-03", "date"), "2026-09-03");
  assert.equal(coerceCell("nope", "date"), null);
  assert.equal(coerceCell("Yes", "checkbox"), true);
  assert.equal(coerceCell("0", "checkbox"), false);
  assert.equal(coerceCell("open", "dropdown", ["Open", "Closed"]), "Open");
  assert.equal(coerceCell("other", "dropdown", ["Open", "Closed"]), null);
  assert.equal(coerceCell("", "text"), null);
  assert.equal(coerceCell(12, "text"), "12");
});

test("row and column operations respect limits and keep data consistent", () => {
  let t = table();
  t = addRow(t);
  assert.equal(t.rows.length, 2);
  t = removeRow(t, "r1");
  assert.equal(t.rows.length, 1);
  t = addColumn(t);
  assert.equal(t.columns.length, 3);
  assert.equal(t.columns[2].name, "C");
  t = removeColumn(t, t.columns[2].id);
  assert.equal(t.columns.length, 2);
  const single: TableContent = { columns: [{ id: "only", name: "Only", type: "text" }], rows: [] };
  assert.equal(removeColumn(single, "only").columns.length, 1, "never removes the last column");
  let big = table();
  for (let i = 0; i < MAX_COLUMNS + 5; i++) big = addColumn(big);
  assert.equal(big.columns.length, MAX_COLUMNS);
  let many: TableContent = { columns: [{ id: "c", name: "C", type: "text" }], rows: [] };
  for (let i = 0; i < MAX_ROWS + 5; i++) many = addRow(many);
  assert.equal(many.rows.length, MAX_ROWS);
});

test("renameColumn trims, bounds and ignores blanks", () => {
  let t = renameColumn(table(), "c1", "  Person  ");
  assert.equal(t.columns[0].name, "Person");
  t = renameColumn(t, "c1", "   ");
  assert.equal(t.columns[0].name, "Person");
  t = renameColumn(t, "c1", "x".repeat(100));
  assert.equal(t.columns[0].name.length, 60);
});

test("setColumnType re-coerces existing cells; setCell coerces to the column type", () => {
  let t = setColumnType(table(), "c2", "checkbox");
  assert.equal(t.rows[0].cells.c2, false, "3 is not a truthy word so it becomes false");
  t = setCell(table(), "r1", "c2", "42");
  assert.equal(t.rows[0].cells.c2, 42);
  t = setCell(t, "r1", "c2", "not a number");
  assert.equal(t.rows[0].cells.c2, null);
});

test("applyPaste overwrites from the anchor, growing the table within limits", () => {
  const t = applyPaste(table(), 0, 1, [["10", "extra"], ["20", "more"]]);
  assert.equal(t.rows[0].cells.c2, 10);
  assert.equal(t.columns.length, 3, "a third column was added for 'extra'");
  const extraId = t.columns[2].id;
  assert.equal(t.rows[0].cells[extraId], "extra");
  assert.equal(t.rows.length, 2, "a second row was added");
  assert.equal(t.rows[1].cells.c2, 20);
  assert.equal(t.rows[0].cells.c1, "Ann", "cells left of the anchor are untouched");
});

test("validateBlockContent normalizes and bounds everything from the client", () => {
  assert.deepEqual(validateBlockContent("note", { html: "<b>hi</b>", junk: 1 }, identity), { html: "<b>hi</b>" });
  assert.deepEqual(validateBlockContent("note", { html: 5 }, identity), { html: "" });
  assert.equal(validateBlockContent("note", { html: "x".repeat(200001) }, identity), null);
  assert.deepEqual(
    validateBlockContent("reminder", { text: "  call  ", due: "2026-09-30", done: true }, identity),
    { text: "call", due: "2026-09-30", done: true },
  );
  assert.deepEqual(
    validateBlockContent("reminder", { text: "x", due: "tomorrow", done: "yes" }, identity),
    { text: "x", due: null, done: false },
  );
  const t = validateBlockContent("table", {
    columns: [{ id: "a", name: "N", type: "number" }, { id: "b", name: "  ", type: "weird" }],
    rows: [{ id: "r", cells: { a: "5", b: "hello", zzz: "dropped" } }],
  }, identity) as TableContent;
  assert.equal(t.columns[0].type, "number");
  assert.equal(t.columns[1].type, "text");
  assert.equal(t.columns[1].name, "Column");
  assert.deepEqual(t.rows[0].cells, { a: 5, b: "hello" });
  assert.equal(validateBlockContent("table", { columns: [], rows: [] }, identity), null);
  assert.equal(validateBlockContent("table", "nope", identity), null);
});

test("normalizeTags trims, dedupes case-insensitively and caps", () => {
  assert.deepEqual(normalizeTags([" Payroll ", "payroll", "", "Schools"]), ["Payroll", "Schools"]);
  assert.equal(normalizeTags(Array.from({ length: 20 }, (_, i) => `t${i}`)).length, 8);
  assert.equal(normalizeTags(["x".repeat(50)])[0].length, 24);
});

test("tagColor is stable and case-insensitive", () => {
  assert.equal(tagColor("Payroll"), tagColor("payroll"));
  assert.ok(["teal", "violet", "amber", "rose", "sky", "green", "orange", "slate"].includes(tagColor("anything")));
});

test("dueState compares ISO dates", () => {
  assert.equal(dueState(null, "2026-09-24"), "none");
  assert.equal(dueState("2026-09-23", "2026-09-24"), "overdue");
  assert.equal(dueState("2026-09-24", "2026-09-24"), "today");
  assert.equal(dueState("2026-09-25", "2026-09-24"), "upcoming");
});
