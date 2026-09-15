import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps task drag and edit controls compact and muted beside the file name", async () => {
  const source = await readFile(new URL("../components/tasks-card.tsx", import.meta.url), "utf8");

  assert.match(source, /GripVertical className="h-3 w-3[^"\n]*text-muted-foreground\/60/);
  assert.match(source, /size="icon-xs"[^>]*className="[^"]*text-muted-foreground\/60/);
});
