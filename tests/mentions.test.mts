import assert from "node:assert/strict";
import test from "node:test";
import { extractMentionedNames, snippetFromHtml } from "../lib/mentions.ts";

test("extracts a real teammate's name, matched case-insensitively", () => {
  assert.deepEqual(extractMentionedNames("Hey @faith can you check?", ["Faith", "Jane"]), ["Faith"]);
});

test("returns the teammate's real stored casing, not the typed casing", () => {
  assert.deepEqual(extractMentionedNames("@FAITH please look", ["Faith"]), ["Faith"]);
});

test("ignores an @word that isn't a real teammate", () => {
  assert.deepEqual(extractMentionedNames("cc @bob please", ["Faith", "Jane"]), []);
});

test("de-duplicates repeated mentions of the same person", () => {
  assert.deepEqual(extractMentionedNames("@Faith @Faith are you there", ["Faith"]), ["Faith"]);
});

test("returns multiple distinct mentions in first-occurrence order", () => {
  assert.deepEqual(extractMentionedNames("@Jane and @Faith please review", ["Faith", "Jane"]), ["Jane", "Faith"]);
});

test("does not exclude a self-mention -- that is the caller's job", () => {
  assert.deepEqual(extractMentionedNames("noting this for myself @Michelle", ["Michelle"]), ["Michelle"]);
});

test("snippetFromHtml strips tags and collapses whitespace", () => {
  assert.equal(snippetFromHtml("<div>Hey <b>@Faith</b>,\n\ncan you check   this?</div>"), "Hey @Faith, can you check this?");
});

test("snippetFromHtml truncates long text to the given max length", () => {
  const long = "a".repeat(300);
  const result = snippetFromHtml(long, 20);
  assert.equal(result.length, 20);
});
