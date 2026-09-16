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
