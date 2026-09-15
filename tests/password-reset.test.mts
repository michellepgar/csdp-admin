import assert from "node:assert/strict";
import test from "node:test";
import { updatePassword } from "../lib/password-reset.ts";

test("saves a confirmed password through the supplied auth update", async () => {
  let savedPassword: string | undefined;

  const result = await updatePassword(
    async ({ password }) => {
      savedPassword = password;
      return { error: null };
    },
    "new-password",
    "new-password",
  );

  assert.deepEqual(result, { error: null });
  assert.equal(savedPassword, "new-password");
});

test("rejects mismatched passwords without calling the auth update", async () => {
  let calls = 0;

  const result = await updatePassword(
    async () => {
      calls += 1;
      return { error: null };
    },
    "new-password",
    "different-password",
  );

  assert.deepEqual(result, { error: "Passwords do not match." });
  assert.equal(calls, 0);
});

test("returns the auth provider error to the form", async () => {
  const result = await updatePassword(
    async () => ({ error: { message: "Recovery link has expired" } }),
    "new-password",
    "new-password",
  );

  assert.deepEqual(result, { error: "Recovery link has expired" });
});
