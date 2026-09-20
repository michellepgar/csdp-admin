import assert from "node:assert/strict";
import test from "node:test";
import * as tables from "../lib/shared-task-files.ts";

test("count columns are left of the filename and remain independent for shared tasks", () => {
  assert.equal(typeof tables.taskTableColumns, 'function');
  const columns = tables.taskTableColumns([{id:'initial',name:'Initial',hasCount:true},{id:'follow',name:'Follow up',hasCount:true},{id:'photos',name:'Photos'}]);
  assert.deepEqual(columns.map((column) => column.kind==='task' ? `task:${column.category.id}` : column.kind), ['count','file','task:initial','task:follow','task:photos','remove']);
});

test("tables without counts reserve a blank count space so filenames align", () => {
  assert.equal(typeof tables.taskTableColumns, 'function');
  assert.deepEqual(tables.taskTableColumns([{id:'photos',name:'Photos'}]).map((column) => column.kind), ['count','file','task','remove']);
});

test("count and filename widths stay compact across separate task tables", () => {
  assert.equal(typeof tables.taskTableLayout, 'function');
  const initial=tables.taskTableLayout(tables.taskTableColumns([{id:'i',name:'Initial',hasCount:true}]));
  const encoding=tables.taskTableLayout(tables.taskTableColumns([{id:'e',name:'Encoding & Uploading (Consent & SDF)',hasCount:true}]));
  assert.deepEqual(initial.columnWidths, [64,undefined,undefined,28]);
  assert.deepEqual(encoding.columnWidths, initial.columnWidths);
  assert.equal(initial.minWidth,522);
});

test("shared task layout budgets space for each independent count and task column", () => {
  assert.equal(typeof tables.taskTableLayout, 'function');
  const shared=tables.taskTableLayout(tables.taskTableColumns([{id:'i',name:'Initial',hasCount:true},{id:'f',name:'Follow up',hasCount:true}]));
  assert.deepEqual(shared.columnWidths,[64,undefined,undefined,undefined,28]);
  assert.equal(shared.minWidth,772);
  const photos=tables.taskTableLayout(tables.taskTableColumns([{id:'p',name:'Photos'}]));
  assert.deepEqual(photos.columnWidths,[64,undefined,undefined,28]);
  assert.equal(photos.minWidth,522);
});

test("a category's Count column can be toggled on independently of any fixed name list", () => {
  const off = tables.taskTableColumns([{id:'x',name:'Anything',hasCount:false}]);
  assert.equal((off[0] as {kind:string;categories:unknown[]}).categories.length, 0);
  const on = tables.taskTableColumns([{id:'x',name:'Anything',hasCount:true}]);
  assert.equal((on[0] as {kind:string;categories:unknown[]}).categories.length, 1);
});
