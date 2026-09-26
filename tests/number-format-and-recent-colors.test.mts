import assert from "node:assert/strict";
import test from "node:test";
import { decimalsShown, formatCellValue, normalizeFormat, parseCellNumber, setFormats } from "../lib/workspace.ts";
import { readSheetOps } from "../lib/sheet-ops.ts";
import { MAX_RECENT_COLORS, withRecentColor } from "../lib/recent-colors.ts";

test("cell text is read as a number the way a spreadsheet would", () => {
  assert.equal(parseCellNumber("1,200"), 1200);
  assert.equal(parseCellNumber("$40"), 40);
  assert.equal(parseCellNumber("15%"), 0.15);
  assert.equal(parseCellNumber("-3.5"), -3.5);
  assert.equal(parseCellNumber("abc"), null);
  assert.equal(parseCellNumber("12 kids"), null);
  assert.equal(decimalsShown("1.50"), 2);
  assert.equal(decimalsShown("$1,000"), 0);
});

test("number formats show numbers as number, percent, currency and date", () => {
  assert.equal(formatCellValue("1234.5", undefined), "1234.5");
  assert.equal(formatCellValue("1234.5", { num: "number" }), "1,234.50");
  assert.equal(formatCellValue("0.1012", { num: "percent" }), "10.12%");
  assert.equal(formatCellValue("25%", { num: "percent", dp: 0 }), "25%");
  assert.equal(formatCellValue("-1234.5", { num: "currency" }), "-$1,234.50");
  assert.equal(formatCellValue("1234.5", { num: "currency", dp: 0 }), "$1,235");
  assert.equal(formatCellValue("2026-09-26", { num: "date" }), "09/26/2026");
  assert.equal(formatCellValue("0012", { num: "text" }), "0012");
  assert.equal(formatCellValue("hello", { num: "currency" }), "hello");
  assert.equal(formatCellValue("3.14159", { dp: 2 }), "3.14");
});

test("number format and decimals are kept, cleared and checked like other styles", () => {
  assert.deepEqual(normalizeFormat({ num: "currency", dp: 3 }), { num: "currency", dp: 3 });
  assert.equal(normalizeFormat({ num: "money", dp: 12 }), null);
  const content = { columns: [{ id: "c1", name: "A", type: "text" as const }], rows: [{ id: "r1", cells: { c1: "5" } }] };
  const on = setFormats(content, [["r1", "c1"]], { num: "percent", dp: 1 });
  assert.deepEqual(on.formats, { "r1|c1": { num: "percent", dp: 1 } });
  const off = setFormats(on, [["r1", "c1"]], { num: null, dp: null });
  assert.equal(off.formats?.["r1|c1"], undefined);
  const ops = readSheetOps([{ t: "format", cells: [["r1", "c1"]], patch: { num: "date", dp: 2 } }]);
  assert.deepEqual(ops?.[0], { t: "format", cells: [["r1", "c1"]], patch: { num: "date", dp: 2 } });
});

test("recent colors put the newest first, once each, and keep only a few", () => {
  let list: string[] = [];
  list = withRecentColor(list, "#ff0000");
  list = withRecentColor(list, "#00FF00");
  list = withRecentColor(list, "#FF0000");
  assert.deepEqual(list, ["#FF0000", "#00FF00"]);
  assert.deepEqual(withRecentColor(list, "red"), list);
  for (let i = 0; i < 20; i++) list = withRecentColor(list, `#0000${String(i).padStart(2, "0")}`);
  assert.equal(list.length, MAX_RECENT_COLORS);
});
