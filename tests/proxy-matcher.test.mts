// tests/proxy-matcher.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Next's own converter from a matcher string to a regular expression (path-to-regexp rules), so this test reads the
// pattern the way the build does. It is plain CommonJS inside Next, hence the default import.
import parsePath from "next/dist/lib/try-to-parse-path.js";

/* proxy.ts's matcher says which paths the sign-in redirect RUNS on. The pattern is a negative lookahead, so a path that
   does not match is one that skips the redirect (the scheduler and Michelle HQ's window, which guard themselves).
   Next also lets a path carry an optional "_next/data/<id>" prefix and a ".json" style suffix; those only matter for
   page data requests, so this test leaves them out and checks the pattern on its own. */
const source = readFileSync("proxy.ts", "utf8");
const literal = source.match(/^\s*("\/\(.*"),\s*$/m)?.[1];
assert.ok(literal, "the matcher pattern wasn't found in proxy.ts");
const parsed = (parsePath as unknown as { tryToParsePath: (p: string) => { regexStr?: string; error?: unknown } }).tryToParsePath(JSON.parse(literal));
assert.ok(parsed.regexStr && !parsed.error, "Next could not read the matcher pattern");
const runsProxy = (pathname: string) => new RegExp(parsed.regexStr as string).test(pathname);

test("the scheduler and the HQ window skip the sign-in redirect", () => {
  assert.equal(runsProxy("/api/hq/my-work"), false);
  assert.equal(runsProxy("/api/cron/backup"), false);
});

test("look-alike paths do not skip it", () => {
  for (const path of ["/api/hqx", "/api/hq-admin", "/api/cronjob", "/dashboard", "/"]) {
    assert.equal(runsProxy(path), true, `${path} should go through the sign-in redirect`);
  }
});
