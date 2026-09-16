import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps task drag and edit controls compact, muted, and separated from the file name", async () => {
  const source = await readFile(new URL("../components/tasks-card.tsx", import.meta.url), "utf8");

  assert.match(source, /GripVertical className="h-3 w-3[^"\n]*text-muted-foreground\/60/);
  assert.match(source, /size="icon-xs"[^>]*className="[^"]*ml-1[^"]*text-muted-foreground\/60/);
  assert.match(source, /<span className="font-bold break-words"[^>]*>\{file\.fileName\}<\/span>/);
});

// Editor save ordering and failure handling are exercised behaviorally in
// category-filename-rules.test.mts, rather than matching handler source text.

test("keeps delete controls at the smallest visible icon size", async () => {
  const source = await readFile(new URL("../components/confirm-delete-button.tsx", import.meta.url), "utf8");
  assert.match(source, /variant="ghost"\s+size="icon-xs"/);
});
