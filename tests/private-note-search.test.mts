import assert from "node:assert/strict";
import test from "node:test";
import { noteMatches, noteSnippet, noteToPlainText, searchWords } from "../lib/private-note-search.ts";

test("searchWords lowercases, splits on spaces and drops blanks and repeats", () => {
  assert.deepEqual(searchWords("  Baker  roster baker "), ["baker", "roster"]);
  assert.deepEqual(searchWords("   "), []);
});

test("noteToPlainText drops tags, spaces out line breaks and decodes entities", () => {
  assert.equal(noteToPlainText("<b>Call</b> Baker<br>Tom &amp; Jerry &lt;now&gt;&nbsp;ok"), "Call Baker Tom & Jerry <now> ok");
  assert.equal(noteToPlainText("<ul><li>one</li><li>two</li></ul>"), "one two");
});

test("noteMatches needs every word, in any order and case", () => {
  const html = "<p>Ask the <b>Baker</b> front desk about the roster</p>";
  assert.equal(noteMatches(html, searchWords("roster baker")), true);
  assert.equal(noteMatches(html, searchWords("baker angelo")), false);
  assert.equal(noteMatches(html, []), true);
});

test("noteSnippet shows the text around the first match", () => {
  const long = "x ".repeat(60) + "the corrected roster is due Friday " + "y ".repeat(60);
  const snippet = noteSnippet(long, ["roster"]);
  assert.ok(snippet.includes("roster"), snippet);
  assert.ok(snippet.startsWith("…") && snippet.endsWith("…"), snippet);
  assert.equal(noteSnippet("short note", ["short"]), "short note");
});
