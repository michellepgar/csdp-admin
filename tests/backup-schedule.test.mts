import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUPS_TO_KEEP,
  backupDateOf,
  backupFileName,
  backupHealth,
  backupsToPrune,
  formatBackupSize,
  isBackupFileName,
  isSafetyBackupName,
  safetyBackupFileName,
  STALE_AFTER_HOURS,
} from "../lib/backup-schedule.ts";

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

test("a before-restore safety copy is named to the second and recognised as a backup", () => {
  const name = safetyBackupFileName(new Date("2026-09-21T03:30:05Z")); // 11:30:05 pm on Sep 20 in New York
  assert.equal(name, "before-restore-2026-09-20-233005.json");
  assert.equal(isSafetyBackupName(name), true);
  assert.equal(isBackupFileName(name), true);
  assert.equal(isSafetyBackupName("2026-09-20.json"), false);
  assert.equal(backupDateOf(name), "2026-09-20");
  assert.equal(backupDateOf("2026-09-19.json"), "2026-09-19");
});

test("safety copies are pruned separately, keeping only the newest few", () => {
  const nightly = ["2026-09-01.json", "2026-09-02.json", "2026-09-03.json"];
  const safety = Array.from({ length: 7 }, (_, i) => `before-restore-2026-09-0${i + 1}-120000.json`);
  const removed = backupsToPrune([...nightly, ...safety], 2);
  assert.deepEqual(removed.filter((n) => !n.startsWith("before")), ["2026-09-01.json"]);
  assert.equal(removed.filter((n) => n.startsWith("before")).length, 2);
  assert.ok(removed.includes("before-restore-2026-09-01-120000.json"));
  assert.ok(!removed.includes("before-restore-2026-09-07-120000.json"));
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

test("a legacy key reveals only its public project id, and the URL gives the app's project id", async () => {
  const { keyProjectRef, projectRefFromUrl } = await import("../lib/backup-schedule.ts");
  const jwt = (claims: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  assert.equal(keyProjectRef(jwt({ role: "service_role", ref: "abcd1234" })), "abcd1234");
  assert.equal(keyProjectRef(jwt({ role: "service_role" })), undefined);
  assert.equal(keyProjectRef("sb_secret_abc"), undefined);
  assert.equal(projectRefFromUrl("https://abcd1234.supabase.co"), "abcd1234");
  assert.equal(projectRefFromUrl("nonsense"), undefined);
});

test("a newer sb_ key is sent as apikey only, never echoed as a Bearer token", async () => {
  const { headersWithoutKeyBearer } = await import("../lib/backup-schedule.ts");
  const key = "sb_secret_abc123";
  const sent = headersWithoutKeyBearer(new Headers({ apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }), key);
  assert.equal(sent.get("authorization"), null);
  assert.equal(sent.get("apikey"), key);
  assert.equal(sent.get("content-type"), "application/json");
  // A user's own token, or a legacy JWT key, is left alone.
  assert.equal(headersWithoutKeyBearer(new Headers({ authorization: "Bearer someone-elses-token" }), key).get("authorization"), "Bearer someone-elses-token");
  const legacy = "eyJhbGciOiJIUzI1NiJ9.e30.sig";
  assert.equal(headersWithoutKeyBearer(new Headers({ authorization: `Bearer ${legacy}` }), legacy).get("authorization"), `Bearer ${legacy}`);
});

test("the key check tells a public key from a secret one without exposing anything", async () => {
  const { describeSupabaseKey } = await import("../lib/backup-schedule.ts");
  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(describeSupabaseKey(jwt("service_role")), "service_role");
  assert.equal(describeSupabaseKey(jwt("anon")), "public");
  assert.equal(describeSupabaseKey("sb_secret_abc123"), "secret");
  assert.equal(describeSupabaseKey("sb_publishable_abc123"), "public");
  assert.equal(describeSupabaseKey("  sb_secret_abc123  "), "secret");
  assert.equal(describeSupabaseKey("not a key"), "unreadable");
  assert.equal(describeSupabaseKey(undefined), "unreadable");
});
