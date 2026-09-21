import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { categoriesWithoutTable, parseFileNames, plainTextToNoteHtml } from "../lib/quick-add.ts";

test("parseFileNames trims, drops blanks and repeats, and keeps the typed order", () => {
  assert.deepEqual(parseFileNames("  a.pdf \n\nB.pdf\r\nA.PDF\n  \nc.docx"), ["a.pdf", "B.pdf", "c.docx"]);
  assert.deepEqual(parseFileNames("   \n "), []);
});

test("categories already in a table are not offered again, unless currently ticked", () => {
  const categories = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
  const tables = [{ categoryIds: ["c1", "c2"] }];
  assert.deepEqual(categoriesWithoutTable(categories, tables), [{ id: "c3" }]);
  assert.deepEqual(categoriesWithoutTable(categories, tables, ["c2"]), [{ id: "c2" }, { id: "c3" }]);
  assert.deepEqual(categoriesWithoutTable(categories, []), categories);
});

test("addTask only lets an admin assign a VA while adding a file", () => {
  const source = readFileSync("app/(app)/schools/[id]/actions.ts", "utf8");
  const addTask = source.slice(source.indexOf("export async function addTask"), source.indexOf("export async function addCategoryToFiles"));
  assert.match(addTask, /formData\.get\("vaName"\)/);
  assert.match(addTask, /if \(!isAdmin\(me\)\) return \{ error: "Only an admin can assign a file to someone else\." \}/);
});

test("plainTextToNoteHtml escapes markup and keeps line breaks", () => {
  assert.equal(plainTextToNoteHtml("  a < b & c\nnext line "), "a &lt; b &amp; c<br>next line");
});
