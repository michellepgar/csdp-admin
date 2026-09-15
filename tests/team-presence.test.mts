import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { aggregatePresence, initialsForName, visiblePresence } from "../lib/team-presence.ts";

test("groups multiple tabs for one member and keeps them active when any tab is active", () => {
  const members = aggregatePresence({
    tabA: [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", active: false, lastActiveAt: "2026-09-16T00:00:00.000Z" }],
    tabB: [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", active: true, lastActiveAt: "2026-09-16T00:01:00.000Z" }],
  });

  assert.deepEqual(members, [{ memberId: "va-1", name: "Michelle Pink", color: "#0ea5e9", status: "active" }]);
});

test("rejects malformed payloads and caps the visible roster", () => {
  assert.deepEqual(aggregatePresence({ bad: [{ memberId: 7 }] }), []);
  const members = Array.from({ length: 6 }, (_, index) => ({
    memberId: String(index),
    name: `VA ${index}`,
    color: "#000000",
    status: "idle" as const,
  }));

  assert.equal(visiblePresence(members, 5).overflow, 1);
  assert.equal(visiblePresence(members, 5).members.length, 5);
  assert.equal(initialsForName("Michelle Pink"), "MP");
});

test("sidebar renders presence above Account and keeps the signed-in name out of the header", () => {
  const sidebar = readFileSync("components/sidebar.tsx", "utf8");
  assert.match(sidebar, /<TeamPresence[\s\S]*collapsed=\{collapsed\}/);
  assert.ok(sidebar.indexOf("<TeamPresence") < sidebar.indexOf(">Account<"));
  assert.doesNotMatch(sidebar, /mt-1 text-sm text-white\/80/);
});

test("presence renders a compact collapsed avatar stack", () => {
  const presence = readFileSync("components/team-presence.tsx", "utf8");
  assert.match(presence, /visiblePresence\(members, collapsed \? 3 : 5\)/);
  assert.match(presence, /aria-label=/);
});

test("layout and sidebar shell pass the signed-in VA identity to the sidebar", () => {
  assert.match(readFileSync("app/(app)/layout.tsx", "utf8"), /currentMember=\{\{ id: me\.id, name: me\.name, color: me\.color \}\}/);
  assert.match(readFileSync("components/sidebar-shell.tsx", "utf8"), /currentMember=\{currentMember\}/);
});
