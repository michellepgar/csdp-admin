import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeNoteHtml } from "../lib/sanitize-note-html.ts";

/* Notes and comments are cleaned again when they're read (lib/fetch-app-state.ts),
   so cleaning a note that was already cleaned on save must leave it unchanged. */
test("cleaning a saved note again leaves it exactly as it was", () => {
  const roster = [{ name: "Jane", color: "#0ea5e9" }];
  const samples = [
    "Call @Jane about www.angeloelementary.edu, then check https://example.org/form?x=1&y=2.",
    '<ul><li><input type="checkbox" checked>&nbsp;Upload forms</li><li><input type="checkbox">&nbsp;Email nurse</li></ul>',
    '<p><b>Bold</b> <i>italic</i> <u>under</u> <span style="color:#dc2626">red</span></p>',
    '<img src="data:image/png;base64,iVBORw0KGgo=">',
    "Tom &amp; Jerry &lt;3 &quot;quotes&quot;",
    "<table><tr><td>A</td><td>B</td></tr></table>",
  ];
  for (const raw of samples) {
    const saved = sanitizeNoteHtml(raw, roster);
    assert.equal(sanitizeNoteHtml(saved), saved, `changed on second clean: ${raw}`);
  }
});

test("HTML written straight into the database can't run code", () => {
  const attacks = [
    '<img src=x onerror="alert(1)">',
    "<script>alert(1)</script>",
    '<a href="javascript:alert(1)">click</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<div onclick="alert(1)">hi</div>',
    '<svg onload="alert(1)"></svg>',
  ];
  for (const raw of attacks) {
    const out = sanitizeNoteHtml(raw);
    assert.doesNotMatch(out, /onerror|onclick|onload|<script|javascript:|<iframe|<svg/i, out);
  }
});
