import test from "node:test";
import assert from "node:assert/strict";
import { clipboardTableHtml, sameClipboardText } from "../lib/clipboard-table.ts";

test("clipboardTableHtml puts each cell's color and text styling inline", () => {
  const html = clipboardTableHtml(
    [["Paid", "<b>"], ["", "2"]],
    [[{ fill: "#FEF08A", format: { b: true, color: "#DC2626", align: "center" } }, null], [null, { format: { i: true, u: true, size: "lg", font: "mono" } }]],
  );
  assert.equal(
    html,
    '<table><tr><td style="background-color:#FEF08A;font-weight:bold;color:#DC2626;text-align:center">Paid</td><td>&lt;b&gt;</td></tr>' +
      '<tr><td></td><td style="font-style:italic;text-decoration:underline;font-family:Consolas, monospace;font-size:18px">2</td></tr></table>',
  );
});

test("sameClipboardText ignores Windows line breaks and one trailing line break", () => {
  assert.ok(sameClipboardText("a\tb\nc\td", "a\tb\r\nc\td\r\n"));
  assert.ok(sameClipboardText("Paid", "Paid\n"));
  assert.ok(!sameClipboardText("Paid", "Unpaid"));
});
