import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_COLUMNS, MAX_ROWS,
  columnName, findFreePosition, defaultContent, defaultRect, clampRect, parsePastedGrid, coerceCell,
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

test("findFreePosition places new blocks in free space", () => {
  const size = { w: 260, h: 180 };
  assert.deepEqual(findFreePosition([], size), { x: 24, y: 24 });
  const first = { x: 24, y: 24, ...size };
  const second = findFreePosition([first], size);
  const overlaps = (a: { x: number; y: number }, b: typeof first) => a.x < b.x + b.w && a.x + size.w > b.x && a.y < b.y + b.h && a.y + size.h > b.y;
  assert.equal(overlaps(second, first), false);
  // First row full (nothing fits at any x up to maxX): wraps below.
  const wide = { x: 0, y: 0, w: 2000, h: 200 };
  const wrapped = findFreePosition([wide], size);
  assert.ok(wrapped.y >= 200);
  assert.equal(overlaps(wrapped, wide), false);
  for (const p of [findFreePosition([], size, { step: 10 }), second, wrapped, findFreePosition([{ x: -50, y: -50, w: 10, h: 10 }], size)]) {
    assert.ok(p.x >= 0 && p.y >= 0);
  }
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

test("columnName handles multi-letter and invalid indexes", () => {
  assert.equal(columnName(701), "ZZ");
  assert.equal(columnName(702), "AAA");
  assert.equal(columnName(-1), "");
  assert.equal(columnName(Number.NaN), "");
});

test("removeColumn drops that column's cells; removeRow removes by id", () => {
  const t = removeColumn(table(), "c2");
  assert.equal(Object.hasOwn(t.rows[0].cells, "c2"), false);
  assert.equal(t.rows[0].cells.c1, "Ann");
  const two: TableContent = { ...table(), rows: [{ id: "a", cells: {} }, { id: "b", cells: {} }] };
  assert.deepEqual(removeRow(two, "a").rows.map((r) => r.id), ["b"]);
});

test("addColumn with a blank name falls back to the default name", () => {
  assert.equal(addColumn(table(), "   ").columns[2].name, "C");
});

test("applyPaste is pure and bounded", () => {
  const t = table();
  const before = structuredClone(t);
  applyPaste(t, 0, 0, [["x", "y"], ["z", "w"]]);
  assert.deepEqual(t, before);
  assert.deepEqual(applyPaste(t, 0, 0, []), before);
  assert.deepEqual(applyPaste(t, -1, 0, [["x"]]), before);
  const huge = Array.from({ length: 200000 }, () => ["v"]);
  const big = applyPaste(t, 0, 0, huge);
  assert.ok(big.rows.length <= MAX_ROWS);
  const edge: TableContent = { columns: Array.from({ length: MAX_COLUMNS }, (_, i) => ({ id: `k${i}`, name: "K", type: "text" as const })), rows: [] };
  let filled = edge;
  for (let i = 0; i < MAX_ROWS; i++) filled = addRow(filled);
  const p = applyPaste(filled, MAX_ROWS - 1, MAX_COLUMNS - 1, [["a", "b"], ["c", "d"]]);
  assert.equal(p.rows.length, MAX_ROWS);
  assert.equal(p.columns.length, MAX_COLUMNS);
  assert.equal(p.rows[MAX_ROWS - 1].cells[`k${MAX_COLUMNS - 1}`], "a");
  const written = p.rows.reduce((n, r) => n + Object.values(r.cells).filter((v) => v !== undefined).length, 0);
  assert.equal(written, 1);
});

test("parsePastedGrid edge cases", () => {
  assert.deepEqual(parsePastedGrid("a\n\nb\n\n"), [["a"], [""], ["b"]]);
  assert.deepEqual(parsePastedGrid("a\rb\rc"), [["a"], ["b"], ["c"]]);
  assert.deepEqual(parsePastedGrid("a\t"), [["a", ""]]);
  assert.equal(parsePastedGrid("x\n".repeat(MAX_ROWS + 500)).length, MAX_ROWS);
  assert.equal(parsePastedGrid(Array.from({ length: MAX_COLUMNS + 10 }, () => "v").join("\t"))[0].length, MAX_COLUMNS);
});

test("coerceCell is strict about numbers, dates and checkboxes", () => {
  assert.equal(coerceCell("1,5", "number"), null);
  assert.equal(coerceCell("1,2,3", "number"), null);
  assert.equal(coerceCell("0x10", "number"), null);
  assert.equal(coerceCell("0b1", "number"), null);
  assert.equal(coerceCell("1e3", "number"), 1000);
  assert.equal(coerceCell("1,234.5", "number"), 1234.5);
  assert.equal(coerceCell("2026-02-30", "date"), null);
  assert.equal(coerceCell("2026-13-45", "date"), null);
  assert.equal(coerceCell("9/31/2026", "date"), null);
  assert.equal(coerceCell("13/1/2026", "date"), null);
  assert.equal(coerceCell("2/28/2026", "date"), "2026-02-28");
  assert.equal(coerceCell("open", "dropdown"), null);
  assert.equal(coerceCell("", "checkbox"), null);
  assert.equal(coerceCell("no", "checkbox"), false);
  assert.equal(coerceCell(Number.NaN, "text"), null);
});

test("validateBlockContent rejects or repairs hostile input", () => {
  assert.equal(validateBlockContent("weird" as never, { html: "x" }, identity), null);
  const dupes = validateBlockContent("table", {
    columns: [{ id: "a", name: "A", type: "text" }, { id: "a", name: "B", type: "text" }],
    rows: [{ id: "r", cells: {} }, { id: "r", cells: {} }],
  }, identity) as TableContent;
  assert.notEqual(dupes.columns[0].id, dupes.columns[1].id);
  assert.notEqual(dupes.rows[0].id, dupes.rows[1].id);
  const reserved = validateBlockContent("table", {
    columns: [{ id: "__proto__", name: "A", type: "text" }, { id: "constructor", name: "B", type: "text" }],
    rows: [],
  }, identity) as TableContent;
  assert.ok(!["__proto__", "constructor", "prototype"].includes(reserved.columns[0].id));
  assert.ok(!["__proto__", "constructor", "prototype"].includes(reserved.columns[1].id));
  const long = validateBlockContent("table", {
    columns: [{ id: "a", name: "A", type: "text" }],
    rows: [{ id: "r", cells: { a: "y".repeat(6000) } }],
  }, identity) as TableContent;
  assert.equal((long.rows[0].cells.a as string).length, 5000);
  const cols = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: "C", type: "text" }));
  const cells = Object.fromEntries(cols.map((c) => [c.id, "y".repeat(5000)]));
  const rows = Array.from({ length: 80 }, (_, i) => ({ id: `r${i}`, cells }));
  assert.equal(validateBlockContent("table", { columns: cols, rows }, identity), null, "over 3,000,000 chars serialized");
  assert.deepEqual(
    validateBlockContent("reminder", { text: "x", due: "2026-99-99", done: false }, identity),
    { text: "x", due: null, done: false },
  );
});

test("clampRect survives hostile numbers", () => {
  for (const bad of [Number.NaN, Infinity, -Infinity, 1e300]) {
    const c = clampRect({ x: bad, y: bad, w: bad, h: bad }, "note");
    for (const v of [c.x, c.y, c.w, c.h]) assert.ok(Number.isFinite(v));
    assert.ok(c.x >= 0 && c.x <= 100000 && c.y >= 0 && c.y <= 100000);
    assert.ok(c.w >= 160 && c.w <= 1200 && c.h >= 100 && c.h <= 1200);
  }
});

test("normalizeTags skips non-strings; tagColor varies; dueState rejects garbage", () => {
  assert.deepEqual(normalizeTags([null as unknown as string, "a"]), ["a"]);
  const colors = new Set(Array.from({ length: 30 }, (_, i) => tagColor(`tag-${i}`)));
  assert.ok(colors.size > 1);
  assert.equal(dueState("garbage", "2026-09-24"), "none");
});

test("a maximum-size table with realistic content is accepted; over the cap is rejected", () => {
  const columns = Array.from({ length: MAX_COLUMNS }, (_, i) => ({ id: crypto.randomUUID(), name: `Col ${i}`, type: "text" }));
  const rows = Array.from({ length: MAX_ROWS }, () => ({
    id: crypto.randomUUID(),
    cells: Object.fromEntries(columns.map((c) => [c.id, "abcdefgh"])),
  }));
  const ok = validateBlockContent("table", { columns, rows }, identity) as TableContent;
  assert.ok(ok);
  assert.equal(ok.rows.length, MAX_ROWS);
  assert.equal(ok.columns.length, MAX_COLUMNS);
  const bigCells = Object.fromEntries(columns.map((c) => [c.id, "y".repeat(5000)]));
  const tooBig = rows.slice(0, 40).map((r) => ({ id: r.id, cells: bigCells }));
  assert.equal(validateBlockContent("table", { columns, rows: tooBig }, identity), null);
});

test("inherited-property ids are replaced and never read through the prototype", () => {
  const t = validateBlockContent("table", {
    columns: [{ id: "toString", name: "A", type: "text" }, { id: "hasOwnProperty", name: "B", type: "text" }],
    rows: [{ id: "valueOf", cells: {} }],
  }, identity) as TableContent;
  assert.ok(!["toString", "hasOwnProperty"].includes(t.columns[0].id));
  assert.ok(!["toString", "hasOwnProperty"].includes(t.columns[1].id));
  assert.notEqual(t.rows[0].id, "valueOf");
  const hostile: TableContent = { columns: [{ id: "toString", name: "A", type: "text" }], rows: [{ id: "r", cells: {} }] };
  assert.equal(setColumnType(hostile, "toString", "text").rows[0].cells.toString, null);
});

test("year 0000 is not a valid date", () => {
  assert.equal(coerceCell("0000-01-01", "date"), null);
});
