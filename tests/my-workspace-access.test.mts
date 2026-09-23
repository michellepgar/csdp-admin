import assert from "node:assert/strict";
import test from "node:test";
import { isMyWorkspaceUser } from "../lib/my-workspace-access.ts";

test("isMyWorkspaceUser matches only Michelle's email, case-insensitively", () => {
  assert.equal(isMyWorkspaceUser("michellepgar@gmail.com"), true);
  assert.equal(isMyWorkspaceUser("MichellePGar@Gmail.com"), true);
  assert.equal(isMyWorkspaceUser("jane@demo.csdp-tracker.local"), false);
  assert.equal(isMyWorkspaceUser("someoneelse@example.com"), false);
  assert.equal(isMyWorkspaceUser(undefined), false);
  assert.equal(isMyWorkspaceUser(null), false);
  assert.equal(isMyWorkspaceUser(""), false);
});
