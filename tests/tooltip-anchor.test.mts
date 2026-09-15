import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

for (const file of [
  "components/hover-label.tsx",
  "components/icon-tooltip.tsx",
  "components/schools-flyout.tsx",
]) {
  test(`${file} measures its anchor from an interaction handler`, () => {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /const rect = open \? .*\.current\?\.getBoundingClientRect\(\)/);
    assert.match(source, /setRect\(/);
  });
}
