import assert from "node:assert/strict";
import test from "node:test";
import { distinctCategoryTones } from "../lib/category-tone.ts";

test("every General Tasks category gets its own color, up to 34 categories", () => {
  const names = Array.from({ length: 34 }, (_, i) => `Category ${i + 1}`);
  const tones = distinctCategoryTones(names);
  const edges = new Set(names.map((n) => tones.get(n)?.edge));
  const pills = new Set(names.map((n) => tones.get(n)?.pill));
  assert.equal(edges.size, 34);
  assert.equal(pills.size, 34);
});

test("a category keeps the color of its place in the list, and a repeated name isn't counted twice", () => {
  const tones = distinctCategoryTones(["Admin", "Email", "Admin", "Data Entry"]);
  assert.equal(tones.size, 3);
  assert.notEqual(tones.get("Admin")?.edge, tones.get("Email")?.edge);
  assert.notEqual(tones.get("Email")?.edge, tones.get("Data Entry")?.edge);
  assert.deepEqual(distinctCategoryTones(["Admin", "Email"]).get("Email"), tones.get("Email"));
});

test("a task with no category gets the plain neutral look without using up a color", () => {
  const tones = distinctCategoryTones(["", "Admin"]);
  assert.equal(tones.get("")?.pill, "bg-muted text-foreground");
  assert.equal(tones.get("Admin")?.edge, distinctCategoryTones(["Admin"]).get("Admin")?.edge);
});
