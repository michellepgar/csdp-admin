import assert from "node:assert/strict";
import test from "node:test";
import * as rules from "../lib/shared-task-files.ts";

const existing = [{id:'f1',fileName:'Grade 1',sortOrder:0,createdAt:'2026-09-16',categories:[{id:'a1',taskFileId:'f1',categoryId:'c1',category:'Transactions',status:'Done',vaAssigned:['Owner'],sortOrder:0}]}];

test("filename collision only applies to overlapping categories and excludes the edited file", () => {
  assert.equal(typeof rules.fileNameConflicts, 'function');
  assert.equal(rules.fileNameConflicts(existing, ' grade 1 ', ['c2']), false);
  assert.equal(rules.fileNameConflicts(existing, ' GRADE 1 ', ['c2','c1']), true);
  assert.equal(rules.fileNameConflicts(existing, 'Grade 1', ['c1'], 'f1'), false);
});

test("duplicate filename errors return a form result instead of throwing", async () => {
  assert.equal(typeof rules.saveTaskFile, 'function');
  const result = await rules.saveTaskFile(async () => {throw Object.assign(new Error('duplicate filename'), {code:'23505'});});
  assert.match(result.error || '', /selected category/i);
});

test("failed file mutations hide internal details and successful saves clear the error", async (t) => {
  t.mock.method(console, 'error', () => {});
  assert.equal(typeof rules.saveTaskFile, 'function');
  const failed = await rules.saveTaskFile(async () => {throw new Error('internal SQL secret');});
  assert.match(failed.error || '', /try again/i);
  assert.doesNotMatch(failed.error || '', /internal SQL secret/);
  assert.deepEqual(await rules.saveTaskFile(async () => {}), {error:null});
});

test("file form keeps its editor open until a successful save finishes", async () => {
  assert.equal(typeof rules.submitTaskFileForm, 'function');
  let finish!: (result: {error:string|null}) => void;
  let closed = false;
  const errors: (string|null)[] = [];
  const pending = rules.submitTaskFileForm(() => new Promise((resolve) => {finish=resolve;}), new FormData(), (error) => errors.push(error), () => {closed=true;});
  assert.equal(closed, false);
  finish({error:'Duplicate'});
  await pending;
  assert.equal(closed, false);
  assert.deepEqual(errors, [null,'Duplicate']);
  await rules.submitTaskFileForm(async () => ({error:null}), new FormData(), (error) => errors.push(error), () => {closed=true;});
  assert.equal(closed, true);
});

test("file form handles transport failures without closing the editor", async () => {
  assert.equal(typeof rules.submitTaskFileForm, 'function');
  let closed = false;
  let message: string|null = null;
  await rules.submitTaskFileForm(async () => {throw new Error('transport');}, new FormData(), (error) => {message=error;}, () => {closed=true;});
  assert.equal(closed,false);
  assert.match(message || '', /refresh.*try again/i);
});
