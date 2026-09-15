import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("lint ignores generated worktree output", () => {
  const config = readFileSync("eslint.config.mjs", "utf8");
  assert.match(config, /"\.worktrees\/\*\*"/);
  assert.match(config, /"node_modules\/\*\*"/);
});
