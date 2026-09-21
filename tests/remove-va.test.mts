import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("removeVa blocks removal while the person still has open school or general tasks, and says why", () => {
  const source = readFileSync("app/(app)/team/actions.ts", "utf8");
  const removeVa = source.slice(source.indexOf("export async function removeVa"), source.indexOf("export async function updateVaField"));
  // Real branch: two cheap counts, not a full fetchAppState().
  assert.match(removeVa, /supabase\.from\("task_file_categories"\)\.select\("id", \{ count: "exact", head: true \}\)\.contains\("va_assigned", \[va\.name\]\)\.neq\("status", "Completed"\)/);
  assert.match(removeVa, /supabase\.from\("general_tasks"\)\.select\("id", \{ count: "exact", head: true \}\)\.contains\("va_assigned", \[va\.name\]\)\.neq\("status", "Completed"\)/);
  assert.doesNotMatch(removeVa, /await fetchAppState\(\)/);
  // Blocked returns {error}, doesn't delete.
  assert.match(source, /if \(message\) return \{ error: message \};/);
});

test("removeVa returns {error} instead of throwing, and the team page can show it", () => {
  const actions = readFileSync("app/(app)/team/actions.ts", "utf8");
  assert.match(actions, /export async function removeVa\(formData: FormData\): Promise<RemoveVaResult>/);
  const button = readFileSync("components/remove-va-button.tsx", "utf8");
  assert.match(button, /const result = await removeVa\(formData\)/);
  assert.match(button, /role="alert"/);
  const page = readFileSync("app/(app)/team/page.tsx", "utf8");
  assert.match(page, /<RemoveVaButton id=\{va\.id\} name=\{va\.name\} removeVa=\{removeVa\} \/>/);
});
