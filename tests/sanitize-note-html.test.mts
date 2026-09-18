import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNoteHtml } from "../lib/sanitize-note-html.ts";

test("a bare pasted URL becomes a real, safe link", () => {
  const result = sanitizeNoteHtml("See https://angeloelementary.edu for details.");
  assert.equal(result, 'See <a href="https://angeloelementary.edu" target="_blank" rel="noopener noreferrer">https://angeloelementary.edu</a> for details.');
});

test("trailing sentence punctuation is not swallowed into the link", () => {
  const result = sanitizeNoteHtml("Check www.angeloelementary.edu, then call.");
  assert.equal(result, 'Check <a href="https://www.angeloelementary.edu" target="_blank" rel="noopener noreferrer">www.angeloelementary.edu</a>, then call.');
});

test("an already-linked pasted anchor is not double-wrapped", () => {
  const result = sanitizeNoteHtml('<a href="https://example.com">https://example.com</a>');
  assert.equal(result, '<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>');
});

test("a javascript: link is neutralized, not saved as a clickable link", () => {
  const result = sanitizeNoteHtml('<a href="javascript:alert(1)">evil</a>');
  assert.equal(result, '<a target="_blank" rel="noopener noreferrer">evil</a>');
});

test("plain text with no link stays untouched", () => {
  const result = sanitizeNoteHtml("Waiting on updated counts from front desk.");
  assert.equal(result, "Waiting on updated counts from front desk.");
});

test("a valid @mention is styled in that teammate's color", () => {
  const result = sanitizeNoteHtml("Hey @Faith can you check this?", [{ name: "Faith", color: "#e07a5f" }]);
  assert.equal(result, 'Hey <b style="color:#e07a5f">@Faith</b> can you check this?');
});

test("mention matching is case-insensitive but renders the real casing", () => {
  const result = sanitizeNoteHtml("cc @faith", [{ name: "Faith", color: "#e07a5f" }]);
  assert.equal(result, 'cc <b style="color:#e07a5f">@Faith</b>');
});

test("an @word that isn't a real teammate stays plain text", () => {
  const result = sanitizeNoteHtml("cc @bob please", [{ name: "Faith", color: "#e07a5f" }]);
  assert.equal(result, "cc @bob please");
});

test("a teammate with no color still gets styled, falling back to a neutral color", () => {
  const result = sanitizeNoteHtml("@Jane thanks", [{ name: "Jane" }]);
  assert.equal(result, '<b style="color:var(--muted-foreground)">@Jane</b> thanks');
});

test("omitting the roster entirely leaves @words untouched (backward compatible)", () => {
  const result = sanitizeNoteHtml("cc @faith");
  assert.equal(result, "cc @faith");
});
