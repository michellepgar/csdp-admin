// tests/hq-my-work.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hqKeyOk, shapeMyWork, splitEmbeds, type MyWorkRows } from "../lib/hq-my-work.ts";

const base: MyWorkRows = {
  me: "Michelle", trackerUrl: "https://tracker.example", now: "2026-10-19T01:00:00.000Z",
  categories: [], files: [], categoryNames: [], schools: [], generalTasks: [], schoolData: {}, emails: [], issues: [],
  issueIdsWithComments: [], issueIdsMentioningMe: [], plan: [],
};

/** Rows from the database can hold anything; this lets a test slip in a value the types would not allow. */
const odd = (v: unknown) => v as never;

test("the key check needs the exact bearer secret", () => {
  assert.equal(hqKeyOk(null, "s3cret"), false);
  assert.equal(hqKeyOk("Bearer wrong!", "s3cret"), false);
  assert.equal(hqKeyOk("Bearer s3cret", ""), false);
  assert.equal(hqKeyOk("Bearer s3cret", "s3cret"), true);
});

test("the key check rejects an empty header, a wrong length, the wrong case and a missing scheme", () => {
  assert.equal(hqKeyOk("", "s3cret"), false);
  assert.equal(hqKeyOk("Bearer s3cre", "s3cret"), false);
  assert.equal(hqKeyOk("Bearer s3cretX", "s3cret"), false);
  assert.equal(hqKeyOk("bearer s3cret", "s3cret"), false);
  assert.equal(hqKeyOk("Bearer S3CRET", "s3cret"), false);
  assert.equal(hqKeyOk("s3cret", "s3cret"), false);
});

test("a secret that is blank or missing counts as unset, even when the header matches it", () => {
  assert.equal(hqKeyOk("Bearer    ", "   "), false);
  assert.equal(hqKeyOk("Bearer  ", " "), false);
  assert.equal(hqKeyOk("Bearer undefined", odd(undefined)), false);
});

test("tasks: hers and not Completed, with school, category, file name and link", () => {
  const out = shapeMyWork({
    ...base,
    categories: [
      { id: "c1", task_file_id: "f1", category_id: "k1", status: "Review", va_assigned: ["Michelle"], status_changed_at: "2026-10-15T00:00:00Z" },
      { id: "c2", task_file_id: "f1", category_id: "k1", status: "Completed", va_assigned: ["Michelle"], status_changed_at: null },
      { id: "c3", task_file_id: "f1", category_id: "k1", status: "", va_assigned: ["Ana"], status_changed_at: null },
    ],
    files: [{ id: "f1", school_id: "s1", file_name: "September logs" }],
    categoryNames: [{ id: "k1", name: "Attendance" }],
    schools: [{ id: "s1", name: "Riverside" }],
  });
  assert.deepEqual(out.tasks, [{ id: "c1", school: "Riverside", category: "Attendance", fileName: "September logs", status: "Review", statusChangedAt: "2026-10-15T00:00:00Z", link: "/schools/s1" }]);
});

test("tasks: any status but Completed is waiting on her, and a missing status comes out as an empty string", () => {
  const row = (id: string, status: string | null) => ({ id, task_file_id: "f1", category_id: "k1", status, va_assigned: ["Michelle"], status_changed_at: null });
  const out = shapeMyWork({
    ...base,
    categories: [row("c1", ""), row("c2", "Paused"), row("c3", null), row("c4", "Completed")],
    files: [{ id: "f1", school_id: "s1", file_name: "September logs" }],
    categoryNames: [{ id: "k1", name: "Attendance" }],
    schools: [{ id: "s1", name: "Riverside" }],
  });
  assert.deepEqual(out.tasks.map((t) => [t.id, t.status]), [["c1", ""], ["c2", "Paused"], ["c3", ""]]);
});

test("tasks: a task whose file is missing has no school or file name and links to the overview", () => {
  const out = shapeMyWork({
    ...base,
    categories: [{ id: "c1", task_file_id: "gone", category_id: "k1", status: "Review", va_assigned: ["Michelle"], status_changed_at: null }],
    categoryNames: [{ id: "k1", name: "Attendance" }],
  });
  assert.deepEqual(out.tasks, [{ id: "c1", school: null, category: "Attendance", fileName: null, status: "Review", statusChangedAt: null, link: "/overview" }]);
});

test("general tasks, emails for her schools only, and plan rows", () => {
  const out = shapeMyWork({
    ...base,
    schools: [{ id: "s1", name: "Riverside" }, { id: "s2", name: "Hillcrest" }],
    generalTasks: [{ id: "g1", category: "Admin", description: "Update the checklist", status: "In Progress", va_assigned: ["Michelle"], status_changed_at: "2026-10-16T00:00:00Z" },
      { id: "g2", category: "Admin", description: "Done thing", status: "Completed", va_assigned: ["Michelle"], status_changed_at: null }],
    schoolData: { s1: { vaAssigned: "Michelle" }, s2: { vaAssigned: "Ana" } },
    emails: [{ id: "e1", school_id: "s1", description: "Ask for signed forms", status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" },
      { id: "e2", school_id: "s2", description: "Not hers", status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" },
      { id: "e3", school_id: "s1", description: "Waiting", status: "Waiting on Them", created_at: "2026-10-14T00:00:00Z" },
      { id: "e4", school_id: "s1", description: "Finished", status: "Done", created_at: "2026-10-14T00:00:00Z" }],
    plan: [{ id: "p1", kind: "priority", label: "Finish Riverside first", task_file_category_id: null, general_task_id: null, sort_order: 0, created_at: "2026-10-17T00:00:00Z", completed_at: null },
      { id: "p2", kind: "meeting", label: "Team call", task_file_category_id: null, general_task_id: null, sort_order: null, created_at: "2026-10-17T00:00:00Z", completed_at: "2026-10-18T00:00:00Z" },
      { id: "p3", kind: "note", label: "private", task_file_category_id: null, general_task_id: null, sort_order: null, created_at: "2026-10-17T00:00:00Z", completed_at: null }],
  });
  assert.deepEqual(out.generalTasks, [{ id: "g1", category: "Admin", description: "Update the checklist", status: "In Progress", statusChangedAt: "2026-10-16T00:00:00Z", link: "/general-tasks" }]);
  assert.deepEqual(out.emails, [{ id: "e1", school: "Riverside", description: "Ask for signed forms", createdAt: "2026-10-14T00:00:00Z", link: "/schools/s1#email-tracker" }]);
  assert.deepEqual(out.plan, [{ id: "p1", kind: "priority", label: "Finish Riverside first", taskId: null, generalTaskId: null, sortOrder: 0, createdAt: "2026-10-17T00:00:00Z" }]);
});

test("plan: an open meeting and a task row are kept, with exactly these fields", () => {
  const out = shapeMyWork({
    ...base,
    plan: [
      { id: "p1", kind: "meeting", label: "Standup", task_file_category_id: null, general_task_id: null, sort_order: null, created_at: "2026-10-17T00:00:00Z", completed_at: null },
      { id: "p2", kind: "task", label: "Send the forms", task_file_category_id: "c1", general_task_id: "g1", sort_order: 3, created_at: "2026-10-17T01:00:00Z", completed_at: null },
    ],
  });
  assert.deepEqual(out.plan, [
    { id: "p1", kind: "meeting", label: "Standup", taskId: null, generalTaskId: null, sortOrder: null, createdAt: "2026-10-17T00:00:00Z" },
    { id: "p2", kind: "task", label: "Send the forms", taskId: "c1", generalTaskId: "g1", sortOrder: 3, createdAt: "2026-10-17T01:00:00Z" },
  ]);
});

test("issues: only Pending ones that involve her, with only safe fields", () => {
  const issue = (id: string, extra: Record<string, unknown>) => ({ id, type: "correction", category: "Attendance", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z", reported_by: "Ana", comment_ack_by: [] as string[],
    student_name: "SECRET NAME", dob: "2015-01-01", insurance_number: "123", student_record_link: "x", correct_info: "y", description: "free text", remarks: "free", ...extra });
  const out = shapeMyWork({
    ...base,
    issues: [issue("i1", { reported_by: "Michelle" }), issue("i2", {}), issue("i3", {}), issue("i4", { status: "Resolved", reported_by: "Michelle" }), issue("i5", { comment_ack_by: ["Michelle"] })],
    issueIdsWithComments: ["i2", "i5"], issueIdsMentioningMe: ["i3"],
  });
  assert.deepEqual(out.issues.map((i) => [i.id, i.why]), [["i1", ["reported"]], ["i2", ["unseen-comments"]], ["i3", ["mentioned"]]]);
  const json = JSON.stringify(out);
  for (const leak of ["SECRET NAME", "2015-01-01", "insurance", "student", "free text", "remarks", "correct_info"]) assert.equal(json.includes(leak), false, leak);
  assert.deepEqual(Object.keys(out.issues[0]).sort(), ["category", "createdAt", "id", "link", "school", "status", "subcategory", "type", "why"]);
});

test("issues: one that involves her in several ways lists every reason, in a fixed order", () => {
  const out = shapeMyWork({
    ...base,
    issues: [{ id: "i1", type: "correction", category: "Attendance", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z", reported_by: "Michelle", comment_ack_by: [] }],
    issueIdsWithComments: ["i1"], issueIdsMentioningMe: ["i1"],
  });
  assert.deepEqual(out.issues.map((i) => i.why), [["reported", "unseen-comments", "mentioned"]]);
});

test("the response has exactly the allowed top-level keys", () => {
  assert.deepEqual(Object.keys(shapeMyWork(base)).sort(), ["emails", "fetchedAt", "generalTasks", "issues", "me", "plan", "tasks", "trackerUrl"]);
});

test("an empty or blank name is refused, so unassigned rows can never match", () => {
  // These rows would all match an empty name: a blank assignee, an unassigned school, no reporter.
  const rows: MyWorkRows = {
    ...base,
    schools: [{ id: "s1", name: "Riverside" }],
    categories: [{ id: "c1", task_file_id: "f1", category_id: "k1", status: "Review", va_assigned: [""], status_changed_at: null }],
    schoolData: { s1: {} },
    emails: [{ id: "e1", school_id: "s1", description: "Ask", status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" }],
    issues: [{ id: "i1", type: "correction", category: null, subcategory: null, school: null, status: "Pending", created_at: "2026-10-10T00:00:00Z", reported_by: null, comment_ack_by: null }],
  };
  for (const me of ["", "   ", "\t\n", odd(null), odd(undefined), odd(42)]) {
    assert.throws(() => shapeMyWork({ ...rows, me }), { message: "me is required" });
  }
});

test("names match ignoring case and stray spaces, and an odd value in a row never throws", () => {
  const cat = (id: string, va: unknown) => ({ id, task_file_id: "f1", category_id: "k1", status: "Review", va_assigned: odd(va), status_changed_at: null });
  const out = shapeMyWork({
    ...base,
    me: " Michelle ",
    categories: [
      cat("c1", [null, "Michelle "]), // a null entry is skipped, a trailing space still matches
      cat("c2", ["michelle"]), // a different case still matches
      cat("c3", null),
      cat("c4", "Michelle"), // not a list
      cat("c5", [42, {}]), // not names
      cat("c6", ["Ana"]),
    ],
    generalTasks: [
      { id: "g1", category: "Admin", description: "Mixed", status: "Review", va_assigned: odd([undefined, "MICHELLE"]), status_changed_at: null },
      { id: "g2", category: "Admin", description: "Odd", status: "Review", va_assigned: odd({ 0: "Michelle" }), status_changed_at: null },
    ],
  });
  assert.deepEqual(out.tasks.map((t) => t.id), ["c1", "c2"]);
  assert.deepEqual(out.generalTasks.map((g) => g.id), ["g1"]);
});

test("schools: her name in schoolData matches loosely, and a non-text or missing value never throws", () => {
  const ids = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];
  const out = shapeMyWork({
    ...base,
    schools: ids.map((id) => ({ id, name: id })),
    schoolData: {
      s1: { vaAssigned: "  MICHELLE" },
      s2: { vaAssigned: odd(42) },
      s3: null,
      s4: odd("oops"),
      s5: { vaAssigned: odd(["Michelle"]) },
      s6: {},
      s7: { vaAssigned: "michelle " },
    },
    emails: ids.map((s) => ({ id: `e-${s}`, school_id: s, description: s, status: "Needs My Response", created_at: "2026-10-14T00:00:00Z" })),
  });
  assert.deepEqual(out.emails.map((e) => e.id), ["e-s1", "e-s7"]);
});

test("issues: her name matches loosely in reported_by and comment_ack_by, and odd values never throw", () => {
  const issue = (id: string, reportedBy: unknown, ackBy: unknown) => ({
    id, type: "correction", category: "Attendance", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z",
    reported_by: odd(reportedBy), comment_ack_by: odd(ackBy),
  });
  const out = shapeMyWork({
    ...base,
    issues: [
      issue("i1", " michelle ", []),
      issue("i2", null, [null, "Ana"]), // no reporter, comments she has not acknowledged
      issue("i3", 42, [null, " MICHELLE"]), // reporter is not text, and she acknowledged the comments
      issue("i4", "Ana", "Michelle"), // acknowledgements are not a list, so she has not acknowledged
    ],
    issueIdsWithComments: ["i2", "i3", "i4"],
  });
  assert.deepEqual(out.issues.map((i) => [i.id, i.why]), [["i1", ["reported"]], ["i2", ["unseen-comments"]], ["i4", ["unseen-comments"]]]);
});

test("the route is read-only, locked, uncached and outside the sign-in redirect", () => {
  const route = readFileSync("app/api/hq/my-work/route.ts", "utf8");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /\.(insert|update|upsert|rpc)\(|from\([^)]*\)\s*\.delete\(/);
  assert.match(route, /hqKeyOk\(/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(route, /loadAppState/);
  assert.match(readFileSync("proxy.ts", "utf8"), /api\/hq/);
});

test("the route trims the secret, passes a clean name and never leaks error details", () => {
  const route = readFileSync("app/api/hq/my-work/route.ts", "utf8");
  assert.match(route, /HQ_READ_SECRET \?\? ""\)\.trim\(\)/);
  assert.match(route, /const me = SUPERADMIN_NAME\.trim\(\)/);
  assert.match(route, /try \{[\s\S]*shapeMyWork\([\s\S]*\} catch \{\s*return fail\(\"Couldn't shape the reply\.\", 500\)/);
  assert.doesNotMatch(route, /\.message\b|\.details\b|\.hint\b|String\(e/);
});

test("the route makes one round of parallel selects, joined in the database, and builds its client inside the guard", () => {
  const route = readFileSync("app/api/hq/my-work/route.ts", "utf8");
  // Long id lists in the address and a second round trip are both gone.
  assert.doesNotMatch(route, /\.in\(\s*"(id|issue_id)"/);
  assert.equal(route.match(/await Promise\.all/g)?.length, 1);
  assert.match(route, /issue_comments\(count\)/);
  assert.match(route, /task_files\(school_id, file_name\)/);
  // A bad database address is caught too, so the reply is still a fixed sentence.
  assert.match(route, /try \{\s*(\/\/[^\n]*\s*)?const db = createServiceClient\(/);
  // The exact-name database filters are explained where they are.
  assert.match(route, /exactly/);
});

test("splitEmbeds pulls files and comment counts out of the joined rows and drops the joins", () => {
  const cat = (id: string, fileId: string, files: unknown) => ({
    id, task_file_id: fileId, category_id: "c1", status: "In Progress", va_assigned: ["Michelle"], status_changed_at: null, task_files: files,
  });
  const issue = (id: string, comments: unknown) => ({
    id, type: "correction", category: "Name", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z",
    reported_by: "Ana", comment_ack_by: [], issue_comments: comments,
  });
  const out = splitEmbeds(
    [
      cat("a", "f1", { school_id: "s1", file_name: "Roster.xlsx" }),
      cat("b", "f1", { school_id: "s1", file_name: "Roster.xlsx" }), // same file, second category
      cat("c", "f2", [{ school_id: "s2", file_name: "List.xlsx" }]), // a one-item list is read the same way
      cat("d", "f3", null), // no file: the task stays, with no file row
    ] as never,
    [issue("i1", [{ count: 2 }]), issue("i2", [{ count: 0 }]), issue("i3", []), issue("i4", null), issue("i5", [{ count: "3" }])] as never,
  );
  assert.deepEqual(out.files, [
    { id: "f1", school_id: "s1", file_name: "Roster.xlsx" },
    { id: "f2", school_id: "s2", file_name: "List.xlsx" },
  ]);
  assert.deepEqual(out.issueIdsWithComments, ["i1", "i5"]);
  assert.equal(out.categories.length, 4);
  for (const row of [...out.categories, ...out.issues]) {
    assert.ok(!("task_files" in row) && !("issue_comments" in row), "a joined object was left on a row");
  }
});

test("nothing from the joined rows reaches the reply", () => {
  const joined = splitEmbeds(
    [{ id: "a", task_file_id: "f1", category_id: "c1", status: "In Progress", va_assigned: ["Michelle"], status_changed_at: null, task_files: { school_id: "s1", file_name: "Roster.xlsx", secret_join: "LEAK-1" } }] as never,
    [{ id: "i1", type: "correction", category: "Name", subcategory: null, school: "Riverside", status: "Pending", created_at: "2026-10-10T00:00:00Z", reported_by: "Michelle", comment_ack_by: [], issue_comments: [{ count: 4, text: "LEAK-2" }] }] as never,
  );
  const out = shapeMyWork({
    ...base,
    categories: joined.categories, files: joined.files, schools: [{ id: "s1", name: "Riverside" }], categoryNames: [{ id: "c1", name: "Roster" }],
    issues: joined.issues, issueIdsWithComments: joined.issueIdsWithComments,
  });
  assert.equal(out.tasks[0].school, "Riverside");
  assert.equal(out.tasks[0].fileName, "Roster.xlsx");
  assert.deepEqual(out.issues.map((i) => i.why), [["reported", "unseen-comments"]]);
  assert.doesNotMatch(JSON.stringify(out), /LEAK|task_files|issue_comments|secret_join/);
});
