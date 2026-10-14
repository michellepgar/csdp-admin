import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* lib/nav-flags.ts imports server-only modules, so the pure rule function is
   pulled out of the source and run here on its own. */
const source = readFileSync("lib/nav-flags.ts", "utf8");
const body = source.slice(source.indexOf("export function navFlagsFor"));
const fn = new Function(`${body.replace("export function navFlagsFor(rows: FlagRows, myName: string): NavFlags", "return function navFlagsFor(rows, myName)")}`)() as (
  rows: unknown,
  myName: string,
) => { privateNote: boolean; generalNote: boolean; issueComment: boolean };

const none = { privateNotes: [], urgentNotes: [], issues: [] };

test("sidebar dots light up for unseen shared notes, urgent notes and issue comments", () => {
  assert.deepEqual(fn(none, "Jane"), { privateNote: false, generalNote: false, issueComment: false });
  assert.equal(fn({ ...none, privateNotes: [{ author: "John", sharedWith: ["Jane"], ackBy: [] }] }, "Jane").privateNote, true);
  assert.equal(fn({ ...none, urgentNotes: [{ author: "John", ackBy: [] }] }, "Jane").generalNote, true);
  assert.equal(fn({ ...none, issues: [{ hasComments: true, commentAckBy: [] }] }, "Jane").issueComment, true);
});

test("sidebar dots stay off once seen, for your own notes, and with no comments", () => {
  assert.equal(fn({ ...none, privateNotes: [{ author: "John", sharedWith: ["Jane"], ackBy: ["Jane"] }] }, "Jane").privateNote, false);
  assert.equal(fn({ ...none, privateNotes: [{ author: "Jane", sharedWith: ["John"], ackBy: [] }] }, "Jane").privateNote, false);
  assert.equal(fn({ ...none, urgentNotes: [{ author: "Jane", ackBy: [] }] }, "Jane").generalNote, false);
  assert.equal(fn({ ...none, urgentNotes: [{ author: "John", ackBy: ["Jane"] }] }, "Jane").generalNote, false);
  assert.equal(fn({ ...none, issues: [{ hasComments: false, commentAckBy: [] }] }, "Jane").issueComment, false);
  assert.equal(fn({ ...none, issues: [{ hasComments: true, commentAckBy: ["Jane"] }] }, "Jane").issueComment, false);
});
