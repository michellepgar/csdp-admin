import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps task drag and edit controls compact, muted, and separated from the file name", async () => {
  const source = await readFile(new URL("../components/tasks-card.tsx", import.meta.url), "utf8");

  assert.match(source, /GripVertical className="h-3 w-3[^"\n]*text-muted-foreground\/60/);
  assert.match(source, /size="icon-xs"[^>]*className="[^"]*ml-1[^"]*text-muted-foreground\/60/);
  assert.match(source, /<span className="min-w-0 text-sm font-bold break-words">\{task\.fileName\}<\/span>/);
});

test("submits the file-name update before closing its editor", async () => {
  const source = await readFile(new URL("../components/tasks-card.tsx", import.meta.url), "utf8");

  assert.match(source, /action=\{async \(formData\) => \{[\s\S]*await updateTaskFileName\(formData\);[\s\S]*setEditingFileName\(false\);[\s\S]*\}\}/);
  assert.doesNotMatch(source, /pendingLabel="Saving…" size="xs" onClick=\{\(\) => setEditingFileName\(false\)\}/);
});
