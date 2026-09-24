import assert from "node:assert/strict";
import test from "node:test";
import { applySheetOps, readSheetOps } from "../lib/sheet-ops.ts";
import type { SheetOp } from "../lib/sheet-ops.ts";
import type { TableContent } from "../lib/workspace.ts";

const base = (): TableContent => ({
  columns: [
    { id: "a", name: "A", type: "text" },
    { id: "b", name: "B", type: "number" },
  ],
  rows: [
    { id: "r1", cells: { a: "x", b: 1 } },
    { id: "r2", cells: {} },
  ],
});

test("two people editing different cells both keep their change", () => {
  const annOps: SheetOp[] = [{ t: "set", cells: [["r1", "a", "Ann"]] }];
  const boOps: SheetOp[] = [{ t: "set", cells: [["r2", "b", "7"]] }];
  // The server applies whichever arrives second on top of the first.
  const saved = applySheetOps(applySheetOps(base(), annOps), boOps);
  assert.equal(saved.rows[0].cells.a, "Ann");
  assert.equal(saved.rows[1].cells.b, 7); // coerced to the number column
});

test("replaying edits on a copy that already has them changes nothing", () => {
  const ops: SheetOp[] = [
    { t: "addRow", id: "r3" },
    { t: "addCol", id: "c", name: "Notes" },
    { t: "set", cells: [["r3", "c", "hi"]] },
    { t: "fill", cells: [["r3", "c"]], color: "#FFF3B0" },
    { t: "format", cells: [["r3", "c"]], patch: { b: true } },
  ];
  const once = applySheetOps(base(), ops);
  const twice = applySheetOps(once, ops);
  assert.deepEqual(twice, once);
  assert.equal(once.rows.length, 3);
  assert.equal(once.columns.length, 3);
});

test("edits to a row someone else deleted are dropped quietly", () => {
  const deleted = applySheetOps(base(), [{ t: "removeRow", id: "r2" }]);
  const after = applySheetOps(deleted, [{ t: "set", cells: [["r2", "a", "late"]] }, { t: "fill", cells: [["r2", "a"]], color: "#FFF3B0" }]);
  assert.equal(after.rows.length, 1);
  assert.equal(after.fills, undefined);
});

test("style sets exact highlight and format, clearing what isn't given", () => {
  const styled = applySheetOps(base(), [{ t: "format", cells: [["r1", "a"]], patch: { i: true } }, { t: "style", cells: [["r1", "a", "#ff0000", { b: true }]] }]);
  assert.deepEqual(styled.fills, { "r1|a": "#FF0000" });
  assert.deepEqual(styled.formats, { "r1|a": { b: true } });
});

test("rename, column type and column removal", () => {
  const out = applySheetOps(base(), [
    { t: "renameCol", id: "a", name: "Name" },
    { t: "colType", id: "b", type: "text" },
    { t: "removeCol", id: "zz" },
  ]);
  assert.equal(out.columns[0].name, "Name");
  assert.equal(out.columns[1].type, "text");
  assert.equal(out.rows[0].cells.b, "1");
});

test("readSheetOps accepts good ops and rejects anything malformed", () => {
  const good = readSheetOps([
    { t: "set", cells: [["r1", "a", "x"], ["r1", "b", 3], ["r2", "a", null]] },
    { t: "fill", cells: [["r1", "a"]], color: "#abcdef" },
    { t: "format", cells: [["r1", "a"]], patch: { b: true, size: "lg", font: null, junk: 1 } },
    { t: "addRow", id: "new-row" },
    { t: "colType", id: "b", type: "dropdown", options: ["x", 5, "y"] },
  ]);
  assert.ok(good);
  assert.equal((good[1] as { color: string }).color, "#ABCDEF");
  assert.deepEqual((good[2] as { patch: object }).patch, { b: true, size: "lg", font: null });
  assert.deepEqual((good[4] as { options: string[] }).options, ["x", "y"]);

  for (const bad of [
    null,
    [],
    [{ t: "nope" }],
    [{ t: "set", cells: [["r1", "a", { x: 1 }]] }],
    [{ t: "set", cells: [["__proto__", "a", "x"]] }],
    [{ t: "fill", cells: [["r1", "a"]], color: "url(x)" }],
    [{ t: "addRow", id: "has space" }],
    [{ t: "colType", id: "a", type: "formula" }],
  ]) {
    assert.equal(readSheetOps(bad), null, JSON.stringify(bad));
  }
});

test("pasteOps grows the table like applyPaste and reports the pasted ids", async () => {
  const { applyPaste } = await import("../lib/workspace.ts");
  const { pasteOps } = await import("../lib/sheet-ops.ts");
  let n = 0;
  const grid = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]];
  const { ops, rowIds, columnIds } = pasteOps(base(), 1, 1, grid, () => `n${++n}`);
  const viaOps = applySheetOps(base(), ops);
  const direct = applyPaste(base(), 1, 1, grid);
  assert.deepEqual(viaOps.rows.map((r) => Object.values(r.cells)), direct.rows.map((r) => Object.values(r.cells)));
  assert.equal(viaOps.columns.length, 4);
  assert.deepEqual(rowIds, ["r2", "n3", "n4"]);
  assert.deepEqual(columnIds, ["b", "n1", "n2"]);
});

test("align, text color and borders: set, add/remove sides, reset", () => {
  const t = applySheetOps(base(), [
    { t: "format", cells: [["r1", "a"], ["r1", "b"]], patch: { align: "center", color: "#dc2626", borderOn: "tb" } },
    { t: "format", cells: [["r1", "a"]], patch: { borderOn: "l", borderOff: "b" } },
  ]);
  assert.deepEqual(t.formats?.["r1|a"], { align: "center", color: "#DC2626", border: "tl" });
  assert.deepEqual(t.formats?.["r1|b"], { align: "center", color: "#DC2626", border: "tb" });
  const reset = applySheetOps(t, [{ t: "format", cells: [["r1", "a"], ["r1", "b"]], patch: { align: null, color: null, borderOff: "trbl" } }]);
  assert.equal(reset.formats, undefined);
});

test("readSheetOps keeps only valid align, color and sides", () => {
  const ops = readSheetOps([{ t: "format", cells: [["r1", "a"]], patch: { align: "justify", color: "red", borderOn: "xtbq", borderOff: 5 } }]);
  assert.ok(ops);
  assert.deepEqual((ops[0] as { patch: object }).patch, { borderOn: "tb" });
});
