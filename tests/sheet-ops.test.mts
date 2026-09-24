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

test("header row flag: on, off, repeatable, survives column removal and validation", async () => {
  const { validateBlockContent } = await import("../lib/workspace.ts");
  const on = applySheetOps(base(), [{ t: "header", on: true }, { t: "header", on: true }]);
  assert.equal(on.header, true);
  assert.equal(applySheetOps(on, [{ t: "removeCol", id: "b" }]).header, true);
  assert.equal((validateBlockContent("table", on, (h) => h) as TableContent).header, true);
  assert.equal("header" in applySheetOps(on, [{ t: "header", on: false }]), false);
  assert.deepEqual(readSheetOps([{ t: "header", on: true }]), [{ t: "header", on: true }]);
  assert.equal(readSheetOps([{ t: "header", on: "yes" }]), null);
});

test("freeze rows and columns: set, clamp, clear, keep through validation", async () => {
  const { validateBlockContent } = await import("../lib/workspace.ts");
  const frozen = applySheetOps(base(), [{ t: "freeze", rows: 2, cols: 1 }]);
  assert.deepEqual(frozen.freeze, { rows: 2, cols: 1 });
  assert.deepEqual((validateBlockContent("table", frozen, (h) => h) as TableContent).freeze, { rows: 2, cols: 1 });
  assert.equal("freeze" in applySheetOps(frozen, [{ t: "freeze", rows: 0, cols: 0 }]), false);
  assert.deepEqual(readSheetOps([{ t: "freeze", rows: 999, cols: -3 }]), [{ t: "freeze", rows: 20, cols: 0 }]);
  assert.equal(readSheetOps([{ t: "freeze", rows: "2", cols: 0 }]), null);
});

test("undo: every kind of edit reverses exactly back to the original table", async () => {
  const { invertSheetOps, pasteOps } = await import("../lib/sheet-ops.ts");
  const styled = applySheetOps(base(), [
    { t: "addRow", id: "r3" },
    { t: "set", cells: [["r3", "a", "last"]] },
    { t: "fill", cells: [["r2", "a"]], color: "#FFF3B0" },
    { t: "format", cells: [["r2", "b"]], patch: { b: true, align: "center" } },
    { t: "colType", id: "b", type: "dropdown", options: ["1", "2"] },
  ]);
  let n = 0;
  const cases: SheetOp[][] = [
    [{ t: "set", cells: [["r1", "a", "changed"], ["r2", "b", "2"]] }],
    [{ t: "fill", cells: [["r1", "a"], ["r2", "a"]], color: "#FF0000" }],
    [{ t: "format", cells: [["r2", "b"]], patch: { i: true, borderOn: "trbl" } }],
    [{ t: "removeRow", id: "r2" }],
    [{ t: "removeCol", id: "a" }],
    [{ t: "renameCol", id: "a", name: "Name" }],
    [{ t: "colType", id: "b", type: "number" }],
    [{ t: "header", on: true }, { t: "freeze", rows: 2, cols: 1 }],
    [{ t: "addRow", id: "x" }, { t: "addCol", id: "y" }, { t: "set", cells: [["x", "y", "new"]] }],
    pasteOps(styled, 2, 1, [["p", "q", "r"], ["s", "t", "u"]], () => `p${++n}`).ops,
  ];
  for (const ops of cases) {
    const after = applySheetOps(styled, ops);
    const undo = invertSheetOps(styled, ops);
    assert.deepEqual(applySheetOps(after, undo), styled, JSON.stringify(ops));
    assert.deepEqual(applySheetOps(applySheetOps(after, undo), ops), after, `redo ${JSON.stringify(ops)}`);
  }
});

test("readSheetOps accepts insertRow/insertCol and rejects bad ones", () => {
  assert.ok(readSheetOps([{ t: "insertRow", id: "r9", index: 1, cells: { a: "x", b: 2 } }]));
  assert.ok(readSheetOps([{ t: "insertCol", id: "c9", index: 0, name: "N", type: "text", cells: { r1: "x" } }]));
  assert.equal(readSheetOps([{ t: "insertRow", id: "r9", index: -1, cells: {} }]), null);
  assert.equal(readSheetOps([{ t: "insertRow", id: "r9", index: 0, cells: { "bad id": 1 } }]), null);
  assert.equal(readSheetOps([{ t: "insertCol", id: "c9", index: 0, name: "N", type: "nope", cells: {} }]), null);
});

test("merge, overlap replacement, unmerge, column width, and their undo", async () => {
  const { invertSheetOps, mergeBox } = await import("../lib/sheet-ops.ts");
  const t = applySheetOps(base(), [{ t: "addRow", id: "r3" }, { t: "addCol", id: "c" }]);
  const merged = applySheetOps(t, [{ t: "merge", r1: "r1", c1: "a", r2: "r2", c2: "b" }]);
  assert.deepEqual(merged.merges, [{ r1: "r1", c1: "a", r2: "r2", c2: "b" }]);
  assert.deepEqual(mergeBox(merged, merged.merges![0]), { top: 0, bottom: 1, left: 0, right: 1 });
  // A single cell is not a merge.
  assert.equal(applySheetOps(t, [{ t: "merge", r1: "r1", c1: "a", r2: "r1", c2: "a" }]).merges, undefined);
  // A new merge that overlaps replaces the old one; undo brings the old one back.
  const ops = [{ t: "merge" as const, r1: "r2", c1: "b", r2: "r3", c2: "c" }];
  const replaced = applySheetOps(merged, ops);
  assert.deepEqual(replaced.merges, [{ r1: "r2", c1: "b", r2: "r3", c2: "c" }]);
  assert.deepEqual(applySheetOps(replaced, invertSheetOps(merged, ops)), merged);
  const unmerged = applySheetOps(merged, [{ t: "unmerge", r1: "r1", c1: "a" }]);
  assert.equal(unmerged.merges, undefined);
  assert.deepEqual(applySheetOps(unmerged, invertSheetOps(merged, [{ t: "unmerge", r1: "r1", c1: "a" }])), merged);
  // Widths: clamped, reset with null, kept through a type change, undone.
  const wide = applySheetOps(t, [{ t: "colWidth", id: "a", width: 9999 }]);
  assert.equal(wide.columns[0].width, 600);
  assert.equal(applySheetOps(wide, [{ t: "colType", id: "a", type: "number" }]).columns[0].width, 600);
  assert.equal("width" in applySheetOps(wide, [{ t: "colWidth", id: "a", width: null }]).columns[0], false);
  assert.deepEqual(applySheetOps(wide, invertSheetOps(t, [{ t: "colWidth", id: "a", width: 9999 }])), t);
  // Deleting a wide column and undoing restores its width.
  assert.deepEqual(applySheetOps(applySheetOps(wide, [{ t: "removeCol", id: "a" }]), invertSheetOps(wide, [{ t: "removeCol", id: "a" }])), wide);
});

test("fill: formulas shift with the fill, $ keeps a reference fixed, and $ refs still calculate", async () => {
  const { shiftFormula, evaluateTable } = await import("../lib/workspace-formula.ts");
  assert.equal(shiftFormula("=A1*2", 1, 0), "=A2*2");
  assert.equal(shiftFormula("=SUM(A1:B3)+C4", 2, 1), "=SUM(B3:C5)+D6");
  assert.equal(shiftFormula("=$A$1+A$1+$A1", 3, 2), "=$A$1+C$1+$A4");
  assert.equal(shiftFormula("=ROUND(A1,2)", 1, 0), "=ROUND(A2,2)");
  assert.equal(shiftFormula("=A1", -1, 0), "=#REF!");
  assert.equal(shiftFormula("plain text A1", 1, 0), "plain text A1");
  const t: TableContent = {
    columns: [{ id: "a", name: "A", type: "text" }, { id: "b", name: "B", type: "text" }],
    rows: [{ id: "r1", cells: { a: "4", b: "=$A$1*2" } }],
  };
  assert.equal(evaluateTable(t)["r1|b"], "8");
});

test("readSheetOps checks colWidth, merge and unmerge", () => {
  assert.deepEqual(readSheetOps([{ t: "colWidth", id: "a", width: 10 }]), [{ t: "colWidth", id: "a", width: 60 }]);
  assert.ok(readSheetOps([{ t: "merge", r1: "a", c1: "b", r2: "c", c2: "d" }]));
  assert.equal(readSheetOps([{ t: "merge", r1: "a", c1: "b", r2: "c" }]), null);
  assert.equal(readSheetOps([{ t: "colWidth", id: "a", width: "wide" }]), null);
});
