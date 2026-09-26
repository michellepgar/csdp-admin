import assert from "node:assert/strict";
import test from "node:test";
import { applyDecisions, attachUploads, cardsFromSeed, moveCard, parseImport, picturePaths, readStatus, validateReviewContent, exportBoard } from "../lib/feature-review.ts";
import { FEATURE_REVIEW_STARTING_CARDS } from "../lib/feature-review-seed.ts";
import { buildReviewReport } from "../lib/feature-review-report.ts";
import { validateBlockContent } from "../lib/workspace.ts";

const seeded = () => cardsFromSeed(FEATURE_REVIEW_STARTING_CARDS);

test("the 24 starting cards all begin in To be approved with picture placeholders", () => {
  const cards = seeded();
  assert.equal(cards.length, 24);
  assert.ok(cards.every((c) => c.status === "todo" && c.decisionDate === "" && c.comments === ""));
  assert.equal(cards.reduce((n, c) => n + c.pictures.length, 0), 41);
  assert.equal(new Set(cards.flatMap((c) => c.pictures.map((p) => p.file))).size, 37);
  assert.ok(cards.every((c) => c.pictures.every((p) => !p.path)));
});

test("statuses are read from keys or column names", () => {
  assert.equal(readStatus("ok"), "ok");
  assert.equal(readStatus("To be approved"), "todo");
  assert.equal(readStatus("needs improvement"), "improve");
  assert.equal(readStatus("maybe"), null);
});

test("moving to a deciding column fills today's date only when empty", () => {
  const card = seeded()[0];
  const moved = moveCard(card, "ok", "2026-09-26");
  assert.equal(moved.status, "ok");
  assert.equal(moved.decisionDate, "2026-09-26");
  assert.equal(moveCard({ ...moved, decisionDate: "2026-09-01" }, "no", "2026-09-26").decisionDate, "2026-09-01");
  assert.equal(moveCard(card, "todo", "2026-09-26").decisionDate, "");
});

test("the block content is checked like other blocks", () => {
  const content = { cards: seeded() };
  const checked = validateBlockContent("review", JSON.parse(JSON.stringify(content)), (h) => h);
  assert.deepEqual(checked, content);
  assert.equal(validateBlockContent("review", { cards: "nope" }, (h) => h), null);
  assert.deepEqual(validateReviewContent({}), { cards: [] });
  const bad = validateReviewContent({ cards: [{ title: "  " }, { title: "Ok", status: "weird", pictures: [{ file: "a.png", path: "../../etc" }] }] });
  assert.equal(bad?.cards.length, 1);
  assert.equal(bad?.cards[0].status, "todo");
  assert.equal(bad?.cards[0].pictures[0].path, undefined);
});

test("import takes this board's export, the local board file, or a plain card list", () => {
  const cards = seeded();
  const own = parseImport(exportBoard({ cards: [{ ...cards[0], status: "ok", comments: "Looks good" }] }));
  assert.equal(own.kind, "cards");
  if (own.kind === "cards") assert.equal(own.cards[0].comments, "Looks good");

  const local = parseImport(JSON.stringify({ board: "csdp-feature-review", state: { "suggest-patient": { s: "improve", date: "2026-09-20", comments: "Show age too" }, unknown: { s: "ok" } } }));
  assert.equal(local.kind, "decisions");
  if (local.kind === "decisions") {
    const { cards: next, matched } = applyDecisions(cards, local.decisions);
    assert.equal(matched, 1);
    assert.equal(next[0].status, "improve");
    assert.equal(next[0].decisionDate, "2026-09-20");
    assert.equal(next[0].comments, "Show age too");
  }

  const list = parseImport(JSON.stringify([{ id: "x", title: "A card", status: "Declined", pictures: [{ file: "x.png", caption: "c" }] }]));
  assert.equal(list.kind, "cards");
  if (list.kind === "cards") assert.equal(list.cards[0].status, "no");
  assert.equal(parseImport("not json").kind, "error");
});

test("uploaded files go to every picture with that file name", () => {
  const cards = seeded();
  const { cards: next, filled } = attachUploads(cards, { "Guardians-Tab.png": "user/block/1-guardians-tab.png" });
  assert.equal(filled, 2); // used by two cards
  assert.deepEqual([...picturePaths(next)], ["user/block/1-guardians-tab.png"]);
});

test("the printed report escapes text and says None yet. with no comments", () => {
  const html = buildReviewReport([{ ...seeded()[0], title: "<b>x</b>" }], {}, { title: "Report" });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /None yet\./);
  assert.match(html, /break-inside: avoid/);
});
