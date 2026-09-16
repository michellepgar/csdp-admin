import assert from "node:assert/strict";
import test from "node:test";
import * as tables from "../lib/shared-task-files.ts";

test("count columns are left of the filename and remain independent for shared tasks", () => {
  assert.equal(typeof tables.taskTableColumns, 'function');
  const columns = tables.taskTableColumns([{id:'initial',name:'Initial'},{id:'follow',name:'Follow up'},{id:'photos',name:'Photos'}], ['Initial','Follow up']);
  assert.deepEqual(columns.map((column) => column.kind==='file' ? 'file' : `${column.kind}:${column.category.id}`), ['count:initial','count:follow','file','task:initial','task:follow','task:photos']);
});

test("tables without a count category keep filename first", () => {
  assert.equal(typeof tables.taskTableColumns, 'function');
  assert.deepEqual(tables.taskTableColumns([{id:'photos',name:'Photos'}], ['Initial']).map((column) => column.kind), ['file','task']);
});

test("count and filename widths stay compact across separate task tables", () => {
  assert.equal(typeof tables.taskTableLayout, 'function');
  const initial=tables.taskTableLayout(tables.taskTableColumns([{id:'i',name:'Initial'}], ['Initial']));
  const encoding=tables.taskTableLayout(tables.taskTableColumns([{id:'e',name:'Encoding & Uploading (Consent & SDF)'}], ['Encoding & Uploading (Consent & SDF)']));
  assert.deepEqual(initial.columnWidths, [72,256,undefined]);
  assert.deepEqual(encoding.columnWidths, initial.columnWidths);
  assert.equal(initial.minWidth,648);
});

test("shared task layout budgets space for each independent count and task column", () => {
  assert.equal(typeof tables.taskTableLayout, 'function');
  const shared=tables.taskTableLayout(tables.taskTableColumns([{id:'i',name:'Initial'},{id:'f',name:'Follow up'}], ['Initial','Follow up']));
  assert.deepEqual(shared.columnWidths,[72,72,256,undefined,undefined]);
  assert.equal(shared.minWidth,1040);
  const photos=tables.taskTableLayout(tables.taskTableColumns([{id:'p',name:'Photos'}], []));
  assert.deepEqual(photos.columnWidths,[256,undefined]);
  assert.equal(photos.minWidth,576);
});
