import assert from "node:assert/strict";
import test from "node:test";
import { BACKUPS_TO_KEEP, backupFileName, backupHealth, backupsToPrune, formatBackupSize, isBackupFileName, STALE_AFTER_HOURS } from "../lib/backup-schedule.ts";

test("backup files are named by the Eastern-time date", () => {
  // 03:30 UTC on Sep 21 is still the evening of Sep 20 in New York.
  assert.equal(backupFileName(new Date("2026-09-21T03:30:00Z")), "2026-09-20.json");
  assert.equal(backupFileName(new Date("2026-09-21T12:00:00Z")), "2026-09-21.json");
});

test("only our own dated .json files count as backups", () => {
  assert.equal(isBackupFileName("2026-09-20.json"), true);
  assert.equal(isBackupFileName("notes.txt"), false);
  assert.equal(isBackupFileName("2026-09-20.json.bak"), false);
});

test("pruning keeps the newest N and never touches other files", () => {
  const names = ["2026-09-01.json", "2026-09-03.json", "2026-09-02.json", "readme.txt", "2026-09-04.json"];
  assert.deepEqual(backupsToPrune(names, 2), ["2026-09-02.json", "2026-09-01.json"]);
  assert.deepEqual(backupsToPrune(names, 10), []);
});

test("by default only the newest 14 backups are kept", () => {
  assert.equal(BACKUPS_TO_KEEP, 14);
  const names = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}.json`);
  const removed = backupsToPrune(names);
  assert.equal(removed.length, 6);
  assert.deepEqual(removed, ["2026-09-06.json", "2026-09-05.json", "2026-09-04.json", "2026-09-03.json", "2026-09-02.json", "2026-09-01.json"]);
});

test("health is ok for a recent backup, stale after a day and a half, none when there is no backup", () => {
  const now = new Date("2026-09-20T12:00:00Z").getTime();
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
  assert.equal(backupHealth(hoursAgo(8), now), "ok");
  assert.equal(backupHealth(hoursAgo(STALE_AFTER_HOURS), now), "ok");
  assert.equal(backupHealth(hoursAgo(STALE_AFTER_HOURS + 1), now), "stale");
  assert.equal(backupHealth(undefined, now), "none");
});

test("sizes read naturally", () => {
  assert.equal(formatBackupSize(900), "900 B");
  assert.equal(formatBackupSize(2048), "2 KB");
  assert.equal(formatBackupSize(5.5 * 1024 * 1024), "5.5 MB");
});
