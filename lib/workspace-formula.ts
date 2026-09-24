import type { CellValue, TableContent } from "@/lib/workspace";

/* Spreadsheet-style formulas for table blocks. A cell whose text starts with
   "=" is a formula, for example =A1+B1 or =SUM(C1:C10). Cells are named by
   column letter and row number as they appear in the table, so A1 is the
   first column's first row.

   Supported: numbers, + - * / and parentheses, cell references (B2), ranges
   (B2:B9) and the functions SUM, AVERAGE, MIN, MAX, COUNT and ROUND. It is a
   small hand-written parser -- nothing is ever passed to eval. Errors show as
   #ERR! (bad formula), #REF! (no such cell), #VALUE! (text in arithmetic),
   #DIV/0! and #CIRC! (a formula that depends on itself). */

export const isFormula = (raw: CellValue | undefined): boolean => typeof raw === "string" && raw.trim().length > 1 && raw.trim().startsWith("=");

export type FormulaError = "#ERR!" | "#REF!" | "#VALUE!" | "#DIV/0!" | "#CIRC!";
type Result = { value: number } | { error: FormulaError };

class FormulaFailure extends Error {
  readonly code: FormulaError;
  constructor(code: FormulaError) {
    super(code);
    this.code = code;
  }
}

type Token = { kind: "num"; value: number } | { kind: "ref"; col: number; row: number } | { kind: "name"; name: string } | { kind: "op"; op: string };

function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function tokenize(formula: string): Token[] {
  // "$" only marks a reference as absolute for fill down/right; it means nothing when working out a value.
  const text = formula.replace(/\$/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const number = /^(\d+\.?\d*|\.\d+)/.exec(text.slice(i));
    if (number) {
      tokens.push({ kind: "num", value: Number(number[1]) });
      i += number[1].length;
      continue;
    }
    const word = /^[A-Za-z]+\d*/.exec(text.slice(i));
    if (word) {
      const w = word[0].toUpperCase();
      const ref = /^([A-Z]{1,2})(\d+)$/.exec(w);
      if (ref && text[i + word[0].length] !== "(") tokens.push({ kind: "ref", col: columnIndex(ref[1]), row: Number(ref[2]) - 1 });
      else tokens.push({ kind: "name", name: w });
      i += word[0].length;
      continue;
    }
    if ("+-*/(),:".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    throw new FormulaFailure("#ERR!");
  }
  return tokens;
}

/* An evaluated argument: one number, or a flattened range of numbers. */
type Arg = { kind: "scalar"; value: number } | { kind: "range"; values: number[] };

class Evaluator {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly cell: (col: number, row: number) => { number: number | null; isText: boolean };
  constructor(tokens: Token[], cell: (col: number, row: number) => { number: number | null; isText: boolean }) {
    this.tokens = tokens;
    this.cell = cell;
  }

  run(): number {
    const value = this.scalar(this.expression());
    if (this.pos < this.tokens.length) throw new FormulaFailure("#ERR!");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(op: string): boolean {
    const t = this.peek();
    return !!t && t.kind === "op" && t.op === op;
  }

  private scalar(arg: Arg): number {
    if (arg.kind === "scalar") return arg.value;
    if (arg.values.length === 1) return arg.values[0];
    throw new FormulaFailure("#VALUE!");
  }

  private expression(): Arg {
    let left = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = (this.tokens[this.pos++] as { op: string }).op;
      const right = this.scalar(this.term());
      left = { kind: "scalar", value: op === "+" ? this.scalar(left) + right : this.scalar(left) - right };
    }
    return left;
  }

  private term(): Arg {
    let left = this.unary();
    while (this.isOp("*") || this.isOp("/")) {
      const op = (this.tokens[this.pos++] as { op: string }).op;
      const right = this.scalar(this.unary());
      if (op === "/" && right === 0) throw new FormulaFailure("#DIV/0!");
      left = { kind: "scalar", value: op === "*" ? this.scalar(left) * right : this.scalar(left) / right };
    }
    return left;
  }

  private unary(): Arg {
    if (this.isOp("-")) {
      this.pos++;
      return { kind: "scalar", value: -this.scalar(this.unary()) };
    }
    if (this.isOp("+")) {
      this.pos++;
      return this.unary();
    }
    return this.primary();
  }

  private cellNumber(col: number, row: number): number {
    const c = this.cell(col, row);
    if (c.isText) throw new FormulaFailure("#VALUE!");
    return c.number ?? 0;
  }

  private primary(): Arg {
    const token = this.tokens[this.pos++];
    if (!token) throw new FormulaFailure("#ERR!");
    if (token.kind === "num") return { kind: "scalar", value: token.value };
    if (token.kind === "ref") {
      if (this.isOp(":")) {
        this.pos++;
        const end = this.tokens[this.pos++];
        if (!end || end.kind !== "ref") throw new FormulaFailure("#ERR!");
        const values: number[] = [];
        for (let row = Math.min(token.row, end.row); row <= Math.max(token.row, end.row); row++) {
          for (let col = Math.min(token.col, end.col); col <= Math.max(token.col, end.col); col++) {
            const c = this.cell(col, row);
            if (!c.isText && c.number !== null) values.push(c.number);
          }
        }
        return { kind: "range", values };
      }
      return { kind: "scalar", value: this.cellNumber(token.col, token.row) };
    }
    if (token.kind === "op" && token.op === "(") {
      const inner = this.expression();
      if (!this.isOp(")")) throw new FormulaFailure("#ERR!");
      this.pos++;
      return inner;
    }
    if (token.kind === "name") return this.call(token.name);
    throw new FormulaFailure("#ERR!");
  }

  private call(name: string): Arg {
    if (!this.isOp("(")) throw new FormulaFailure("#ERR!");
    this.pos++;
    const args: Arg[] = [];
    if (this.isOp(")")) {
      this.pos++;
    } else {
      for (;;) {
        args.push(this.expression());
        if (this.isOp(",")) {
          this.pos++;
          continue;
        }
        if (this.isOp(")")) {
          this.pos++;
          break;
        }
        throw new FormulaFailure("#ERR!");
      }
    }
    const numbers = args.flatMap((a) => (a.kind === "scalar" ? [a.value] : a.values));
    const scalar = (value: number): Arg => ({ kind: "scalar", value });
    switch (name) {
      case "SUM":
        return scalar(numbers.reduce((a, b) => a + b, 0));
      case "COUNT":
        return scalar(numbers.length);
      case "AVERAGE":
        if (numbers.length === 0) throw new FormulaFailure("#DIV/0!");
        return scalar(numbers.reduce((a, b) => a + b, 0) / numbers.length);
      case "MIN":
        return scalar(numbers.length ? Math.min(...numbers) : 0);
      case "MAX":
        return scalar(numbers.length ? Math.max(...numbers) : 0);
      case "ROUND": {
        if (args.length < 1 || args.length > 2) throw new FormulaFailure("#ERR!");
        const digits = args.length === 2 ? Math.trunc(this.scalar(args[1])) : 0;
        const factor = 10 ** Math.min(10, Math.max(0, digits));
        return scalar(Math.round(this.scalar(args[0]) * factor) / factor);
      }
      default:
        throw new FormulaFailure("#ERR!");
    }
  }
}

const NUMERIC = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** Formats a result the way a cell shows it (no long floating-point tails). */
export function formatFormulaResult(result: Result): string {
  if ("error" in result) return result.error;
  if (!Number.isFinite(result.value)) return "#ERR!";
  return String(Number(result.value.toFixed(8)));
}

/** Evaluates every formula cell. Keys are `${rowId}|${columnId}`; values are the text a cell shows. */
export function evaluateTable(content: TableContent): Record<string, string> {
  const columnIds = content.columns.map((c) => c.id);
  const cache = new Map<string, Result>();
  const active = new Set<string>();

  function resolve(rowIndex: number, colIndex: number): Result {
    const row = content.rows[rowIndex];
    const columnId = columnIds[colIndex];
    if (!row || columnId === undefined) return { error: "#REF!" };
    const key = `${row.id}|${columnId}`;
    const raw = Object.hasOwn(row.cells, columnId) ? row.cells[columnId] : null;
    const cached = cache.get(key);
    if (cached) return cached;
    if (active.has(key)) return { error: "#CIRC!" };
    active.add(key);
    let result: Result;
    try {
      const evaluator = new Evaluator(tokenize((raw as string).trim().slice(1)), (col, r) => {
        const target = content.rows[r];
        const targetColumn = columnIds[col];
        if (!target || targetColumn === undefined) throw new FormulaFailure("#REF!");
        const value = Object.hasOwn(target.cells, targetColumn) ? target.cells[targetColumn] : null;
        if (isFormula(value)) {
          const inner = resolve(r, col);
          if ("error" in inner) throw new FormulaFailure(inner.error);
          return { number: inner.value, isText: false };
        }
        if (typeof value === "number") return { number: value, isText: false };
        if (typeof value === "string" && value.trim() !== "") {
          return NUMERIC.test(value.trim()) ? { number: Number(value), isText: false } : { number: null, isText: true };
        }
        return { number: null, isText: false };
      });
      result = { value: evaluator.run() };
    } catch (error) {
      result = { error: error instanceof FormulaFailure ? error.code : "#ERR!" };
    }
    active.delete(key);
    cache.set(key, result);
    return result;
  }

  const display: Record<string, string> = {};
  content.rows.forEach((row, rowIndex) => {
    content.columns.forEach((column, colIndex) => {
      const raw = Object.hasOwn(row.cells, column.id) ? row.cells[column.id] : null;
      if (isFormula(raw)) display[`${row.id}|${column.id}`] = formatFormulaResult(resolve(rowIndex, colIndex));
    });
  });
  return display;
}

/** A formula moved by (rows, cols), as when filled down or right: each cell
 *  reference shifts along with it, except the parts marked absolute with "$"
 *  (e.g. $A$1). References pushed off the table's top or left edge become
 *  #REF!-style invalid references and show an error, as in Excel. */
export function shiftFormula(formula: string, rows: number, cols: number): string {
  if (!isFormula(formula)) return formula;
  return formula.replace(/(^|[^A-Za-z0-9_$])(\$?)([A-Za-z]{1,2})(\$?)(\d+)(?![\d(A-Za-z_])/g, (match, lead: string, colAbs: string, letters: string, rowAbs: string, digits: string) => {
    let col = 0;
    for (const ch of letters.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
    const newCol = colAbs ? col : col + cols;
    const newRow = rowAbs ? Number(digits) : Number(digits) + rows;
    if (newCol < 1 || newRow < 1) return `${lead}#REF!`;
    let name = "";
    for (let n = newCol; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return `${lead}${colAbs}${name}${rowAbs}${newRow}`;
  });
}
