import assert from "node:assert/strict";
import test from "node:test";
import { fitWithin, MAX_IMAGE_DIMENSION } from "../lib/shrink-image.ts";

test("fitWithin leaves an image that already fits untouched", () => {
  assert.deepEqual(fitWithin(800, 600, MAX_IMAGE_DIMENSION), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(MAX_IMAGE_DIMENSION, 200, MAX_IMAGE_DIMENSION), { width: MAX_IMAGE_DIMENSION, height: 200 });
});

test("fitWithin scales the longest side down to the maximum, keeping the ratio", () => {
  assert.deepEqual(fitWithin(2800, 1400, 1400), { width: 1400, height: 700 });
  assert.deepEqual(fitWithin(1000, 4000, 1400), { width: 350, height: 1400 });
});

test("fitWithin never returns a zero-sized side", () => {
  const result = fitWithin(100000, 10, 1400);
  assert.equal(result.width, 1400);
  assert.ok(result.height >= 1);
});
