import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTable, isFormula } from "../lib/workspace-formula.ts";
import { coerceCell, removeColumn, removeRow, setCells, setFill, setFills, validateBlockContent, FILL_COLORS } from "../lib/workspace.ts";
import type { TableContent } from "../lib/workspace.ts";

function table(rows: (string | number | null)[][]): TableContent {
  const width = Math.max(...rows.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => ({ id: `c${i}`, name: `Col ${i}`, type: "text" as const }));
  return {
    columns,
    rows: rows.map((cells, r) => ({ id: `r${r}`, cells: Object.fromEntries(cells.map((v, i) => [`c${i}`, v])) })),
  };
}
const shown = (t: TableContent, row: number, col: number) => evaluateTable(t)[`r${row}|c${col}`];

test("isFormula needs an equals sign and something after it", () => {
  assert.equal(isFormula("=A1"), true);
  assert.equal(isFormula("="), false);
  assert.equal(isFormula("A1"), false);
  assert.equal(isFormula(5), false);
});

test("arithmetic, precedence, parentheses and unary minus", () => {
  const t = table([["=1+2*3", "=(1+2)*3", "=-4+10", "=10/4"]]);
  assert.equal(shown(t, 0, 0), "7");
  assert.equal(shown(t, 0, 1), "9");
  assert.equal(shown(t, 0, 2), "6");
  assert.equal(shown(t, 0, 3), "2.5");
});

test("cell references, ranges and functions", () => {
  const t = table([
    [10, 2, "=SUM(A1:A3)"],
    [20, 4, "=AVERAGE(A1:B2)"],
    [30, null, "=MAX(A1:A3)+MIN(B1:B2)"],
    ["=A1+B1", "=ROUND(10/3,2)", "=COUNT(A1:B3)"],
  ]);
  assert.equal(shown(t, 0, 2), "60");
  assert.equal(shown(t, 1, 2), "9");
  assert.equal(shown(t, 2, 2), "32");
  assert.equal(shown(t, 3, 0), "12");
  assert.equal(shown(t, 3, 1), "3.33");
  assert.equal(shown(t, 3, 2), "5");
});

test("formulas can use other formulas, and numeric text counts as a number", () => {
  const t = table([["5", "=A1*2", "=B1+1"]]);
  assert.equal(shown(t, 0, 1), "10");
  assert.equal(shown(t, 0, 2), "11");
});

test("errors: circular, bad reference, text in arithmetic, divide by zero, junk", () => {
  const t = table([["=A1", "=B1+C1", "=Z9", "hello", "=D1+1", "=1/0", "=SUM(", "=NOPE(1)", "=1 $ 2"]]);
  assert.equal(shown(t, 0, 0), "#CIRC!");
  assert.equal(shown(t, 0, 2), "#REF!");
  assert.equal(shown(t, 0, 4), "#VALUE!");
  assert.equal(shown(t, 0, 5), "#DIV/0!");
  assert.equal(shown(t, 0, 6), "#ERR!");
  assert.equal(shown(t, 0, 7), "#ERR!");
  assert.equal(shown(t, 0, 8), "#ERR!");
  // B1 depends on itself through C1? no: B1 = B1+C1 is a self-reference.
  assert.equal(shown(t, 0, 1), "#CIRC!");
});

test("a two-cell loop is circular for both and does not hang", () => {
  const t = table([["=B1", "=A1"]]);
  assert.equal(shown(t, 0, 0), "#CIRC!");
  assert.equal(shown(t, 0, 1), "#CIRC!");
});

test("ranges ignore text and blanks; AVERAGE of nothing is #DIV/0!", () => {
  const t = table([["a", "=SUM(A1:A3)", "=AVERAGE(A1:A1)"], [4, null, null], [null, null, null]]);
  assert.equal(shown(t, 0, 1), "4");
  assert.equal(shown(t, 0, 2), "#DIV/0!");
});

test("floating point tails are trimmed", () => {
  assert.equal(shown(table([["=0.1+0.2"]]), 0, 0), "0.3");
});

test("formulas survive coerceCell in text and number columns only", () => {
  assert.equal(coerceCell("=A1+1", "text"), "=A1+1");
  assert.equal(coerceCell(" =A1+1 ", "number"), "=A1+1");
  assert.equal(coerceCell("=A1+1", "date"), null);
  assert.equal(coerceCell("=", "number"), null);
});

test("fills: set, clear, ignore unknown colors and cells, prune on delete", () => {
  const base = table([[1, 2], [3, 4]]);
  const yellow = FILL_COLORS[0].value;
  const a = setFill(base, "r0", "c0", yellow);
  assert.deepEqual(a.fills, { "r0|c0": yellow });
  assert.equal(setFill(a, "r0", "c0", "#123456").fills, undefined);
  assert.equal(setFill(a, "r0", "c0", null).fills, undefined);
  assert.equal(setFill(base, "nope", "c0", yellow), base);
  const two = setFill(a, "r1", "c1", yellow);
  assert.deepEqual(removeRow(two, "r0").fills, { "r1|c1": yellow });
  assert.deepEqual(removeColumn(two, "c1").fills, { "r0|c0": yellow });
});

test("validateBlockContent keeps only fills that point at real cells with listed colors", () => {
  const identity = (h: string) => h;
  const t = table([[1, 2]]);
  const yellow = FILL_COLORS[0].value;
  const out = validateBlockContent("table", { ...t, fills: { "r0|c0": yellow, "r0|c9": yellow, "r0|c1": "#000000", "zz|c0": yellow } }, identity) as TableContent;
  assert.deepEqual(out.fills, { "r0|c0": yellow });
  const none = validateBlockContent("table", { ...t, fills: "nope" }, identity) as TableContent;
  assert.equal(none.fills, undefined);
});

test("setFills highlights several cells and skips unknown ones; setCells fills and clears", () => {
  const base = table([[1, 2], [3, 4]]);
  const blue = FILL_COLORS[2].value;
  const lit = setFills(base, [["r0", "c0"], ["r1", "c1"], ["zz", "c0"]], blue);
  assert.deepEqual(lit.fills, { "r0|c0": blue, "r1|c1": blue });
  assert.equal(setFills(lit, [["r0", "c0"], ["r1", "c1"]], null).fills, undefined);
  assert.equal(setFills(base, [["zz", "c0"]], blue), base);

  const cleared = setCells(base, [["r0", "c0"], ["r0", "c1"]], null);
  assert.deepEqual(cleared.rows[0].cells, { c0: null, c1: null });
  assert.equal(cleared.rows[1], base.rows[1]); // untouched row keeps its identity
  assert.equal(setCells(base, [["r0", "c9"]], "x"), base);
  const filled = setCells(base, [["r0", "c0"], ["r1", "c0"]], "hi");
  assert.equal(filled.rows[1].cells.c0, "hi");
});
