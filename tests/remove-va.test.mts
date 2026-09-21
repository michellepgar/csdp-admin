import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("removeVa clears the removed person's name from not-Completed work, but never touches Completed work", () => {
  const source = readFileSync("app/(app)/team/actions.ts", "utf8");
  const removeVa = source.slice(source.indexOf("export async function removeVa"), source.indexOf("export async function updateVaField"));
  // Only not-Completed rows are looked up and rewritten -- Completed ones are
  // never selected, so their va_assigned (the "who did this" record) is
  // never touched.
  assert.match(removeVa, /\.contains\("va_assigned", \[va\.name\]\)\s*\.neq\("status", "Completed"\)/);
  assert.match(removeVa, /\.from\("task_file_categories"\)/);
  assert.match(removeVa, /\.from\("general_tasks"\)/);
  // School tasks go through the same RPC every other reassignment uses, not a raw column write.
  assert.match(removeVa, /supabase\.rpc\("update_task_assignment", \{ p_school_id: schoolId, p_task_id: row\.id, p_patch: \{ va_assigned: nextAssigned \} \}\)/);
  // Their own plan is cleared entirely, not just the task/general task rows.
  assert.match(removeVa, /supabase\.from\("plan_items"\)\.delete\(\)\.eq\("va_name", va\.name\)/);
  // Not the full fetchAppState() this file's other actions were changed to stop paying for.
  assert.doesNotMatch(removeVa, /await fetchAppState\(\)/);
});

test("the demo branch mirrors the same rule: not-Completed loses the name, Completed keeps it, and their plan is cleared", () => {
  const source = readFileSync("app/(app)/team/actions.ts", "utf8");
  const removeVaStart = source.indexOf("export async function removeVa");
  const demoBranch = source.slice(source.indexOf("if (await isDemoMode())", removeVaStart), source.indexOf("const { supabase } = await requireAdmin()", removeVaStart));
  assert.match(demoBranch, /if \(task\.status !== "Completed"\) task\.vaAssigned = task\.vaAssigned\.filter\(\(n\) => n !== va\.name\)/);
  assert.match(demoBranch, /if \(assignment\.status !== "Completed"\) assignment\.vaAssigned = assignment\.vaAssigned\.filter\(\(n\) => n !== va\.name\)/);
  assert.match(demoBranch, /state\.planItems = \(state\.planItems \|\| \[\]\)\.filter\(\(p\) => p\.vaName !== va\.name\)/);
});

test("removeVa returns {error} instead of throwing, and the team page can show it", () => {
  const actions = readFileSync("app/(app)/team/actions.ts", "utf8");
  assert.match(actions, /export async function removeVa\(formData: FormData\): Promise<RemoveVaResult>/);
  const button = readFileSync("components/remove-va-button.tsx", "utf8");
  assert.match(button, /const result = await removeVa\(formData\)/);
  assert.match(button, /role="alert"/);
  assert.match(button, /cleared from anything of theirs that isn't done yet/);
  const page = readFileSync("app/(app)/team/page.tsx", "utf8");
  assert.match(page, /<RemoveVaButton id=\{va\.id\} name=\{va\.name\} removeVa=\{removeVa\} \/>/);
});
