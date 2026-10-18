// lib/hq-my-work.ts
/* Michelle HQ's read-only window into the tracker: what's waiting on Michelle, and nothing else. This file has no
   imports so the tests can load it on its own. The route (app/api/hq/my-work) does the reads; this only shapes them.
   Every output object is built field by field, so a new database column can never slip out, and no student field
   (name, birthday, insurance, record link, correction text) or issue free text is ever copied. */

export type MyWorkRows = {
  me: string;
  trackerUrl: string;
  now: string;
  categories: {
    id: string; task_file_id: string; category_id: string; status: string | null;
    va_assigned: string[] | null; status_changed_at: string | null;
  }[];
  files: { id: string; school_id: string; file_name: string | null }[];
  categoryNames: { id: string; name: string }[];
  schools: { id: string; name: string }[];
  generalTasks: {
    id: string; category: string | null; description: string | null; status: string | null;
    va_assigned: string[] | null; status_changed_at: string | null;
  }[];
  /** app_state.data.schoolData: only vaAssigned is read. */
  schoolData: Record<string, { vaAssigned?: string } | null | undefined> | null;
  emails: { id: string; school_id: string; description: string | null; status: string | null; created_at: string }[];
  issues: {
    id: string; type: string | null; category: string | null; subcategory: string | null; school: string | null;
    status: string | null; created_at: string; reported_by: string | null; comment_ack_by: string[] | null;
  }[];
  issueIdsWithComments: string[];
  issueIdsMentioningMe: string[];
  plan: {
    id: string; kind: string; label: string | null; task_file_category_id: string | null; general_task_id: string | null;
    sort_order: number | null; created_at: string; completed_at: string | null;
  }[];
};

/** HQ's schema rejects the WHOLE reply if any list has more than this many items. */
export const HQ_LIST_MAX = 500;

export type Why = "reported" | "unseen-comments" | "mentioned";

/** A task row read together with its file (task_files, joined by the database) and an issue row read together with its
    comment count (issue_comments(count), which comes back as [{ count }]). */
export type CategoryWithFile = MyWorkRows["categories"][number] & {
  task_files?: { school_id: string; file_name: string | null } | { school_id: string; file_name: string | null }[] | null;
};
export type IssueWithComments = MyWorkRows["issues"][number] & { issue_comments?: { count?: number | string }[] | null };

/** Splits the joined rows into what shapeMyWork takes: plain category and issue rows (the joined objects are taken off,
    so they can never travel on), the files list built field by field, and the ids of issues that have any comment. */
export function splitEmbeds(cats: CategoryWithFile[], issueRows: IssueWithComments[]) {
  const files = new Map<string, MyWorkRows["files"][number]>();
  const categories = cats.map((row) => {
    const { task_files: joined, ...category } = row;
    const file = Array.isArray(joined) ? joined[0] : joined;
    if (file && !files.has(category.task_file_id)) {
      files.set(category.task_file_id, { id: category.task_file_id, school_id: file.school_id, file_name: file.file_name });
    }
    return category;
  });
  const issueIdsWithComments: string[] = [];
  const issues = issueRows.map((row) => {
    const { issue_comments: joined, ...issue } = row;
    if (Array.isArray(joined) && Number(joined[0]?.count) > 0) issueIdsWithComments.push(issue.id);
    return issue;
  });
  return { categories, files: [...files.values()], issues, issueIdsWithComments };
}

/** The same check as the backup route: the exact "Bearer <secret>", compared in constant time for equal lengths.
    A secret that is missing or only spaces counts as unset, so nothing can match it. */
export function hqKeyOk(header: string | null, secret: string): boolean {
  if (typeof secret !== "string" || !secret.trim() || !header) return false;
  const a = new TextEncoder().encode(header), b = new TextEncoder().encode(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Names are compared trimmed and lower-case. Anything that isn't text becomes "", so one odd row can't throw. */
const norm = (s: unknown) => (typeof s === "string" ? s.trim().toLowerCase() : "");
/** True when her name is in a list of names. A list that isn't a list, or entries that aren't text, are skipped. */
const mine = (names: unknown, meKey: string) => Array.isArray(names) && names.some((n) => norm(n) === meKey);
const open = (status: string | null) => (status ?? "") !== "Completed";

/** A date as a number of milliseconds, so "+00:00" and "Z" spellings compare alike. Anything that isn't a readable date is null. */
const ms = (s: unknown) => {
  const t = typeof s === "string" ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? null : t;
};
/** A sort position, or null when it isn't a finite number. */
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : null);
/** Smallest first, with null (missing) always last. */
const smallestFirst = (a: number | null, b: number | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);

/** Sorts a copy by the keys in turn (equal rows keep the order they were read in), then keeps the first HQ_LIST_MAX,
    so when a list is too long the cut falls on the least relevant rows: the newest, and any without a date. */
function capList<T>(list: T[], ...keys: ((item: T) => number | null)[]): T[] {
  return [...list]
    .sort((a, b) => {
      for (const key of keys) {
        const d = smallestFirst(key(a), key(b));
        if (d) return d;
      }
      return 0;
    })
    .slice(0, HQ_LIST_MAX);
}

export function shapeMyWork(r: MyWorkRows) {
  // An empty name would match every unassigned school, blank assignee and missing reporter, so refuse it outright.
  const meKey = norm(r.me);
  if (!meKey) throw new Error("me is required");

  const school = new Map(r.schools.map((s) => [s.id, s.name]));
  const file = new Map(r.files.map((f) => [f.id, f]));
  const catName = new Map(r.categoryNames.map((c) => [c.id, c.name]));
  const mySchools = new Set(
    Object.entries(r.schoolData ?? {}).filter(([, d]) => norm(d?.vaAssigned) === meKey).map(([id]) => id),
  );
  const commented = new Set(r.issueIdsWithComments), mentioned = new Set(r.issueIdsMentioningMe);

  const tasks = capList(
    r.categories
      .filter((c) => mine(c.va_assigned, meKey) && open(c.status))
      .map((c) => {
        const f = file.get(c.task_file_id);
        return {
          id: c.id,
          school: f ? school.get(f.school_id) ?? null : null,
          category: catName.get(c.category_id) ?? null,
          fileName: f?.file_name ?? null,
          status: c.status ?? "",
          statusChangedAt: c.status_changed_at,
          link: f ? `/schools/${f.school_id}` : "/overview",
        };
      }),
    (t) => ms(t.statusChangedAt),
  );

  const generalTasks = capList(
    r.generalTasks
      .filter((g) => mine(g.va_assigned, meKey) && open(g.status))
      .map((g) => ({
        id: g.id,
        category: g.category,
        description: g.description,
        status: g.status ?? "",
        statusChangedAt: g.status_changed_at,
        link: "/general-tasks",
      })),
    (g) => ms(g.statusChangedAt),
  );

  // #email-tracker is the id of the email section on the school page (components/email-tracker-card.tsx).
  const emails = capList(
    r.emails
      .filter((e) => e.status === "Needs My Response" && mySchools.has(e.school_id))
      .map((e) => ({
        id: e.id,
        school: school.get(e.school_id) ?? null,
        description: e.description,
        createdAt: e.created_at,
        link: `/schools/${e.school_id}#email-tracker`,
      })),
    (e) => ms(e.createdAt),
  );

  const issues = capList(
    r.issues
      .filter((i) => i.status === "Pending")
      .flatMap((i) => {
        const why: Why[] = [];
        if (norm(i.reported_by) === meKey) why.push("reported");
        if (commented.has(i.id) && !mine(i.comment_ack_by, meKey)) why.push("unseen-comments");
        if (mentioned.has(i.id)) why.push("mentioned");
        if (!why.length) return [];
        return [{
          id: i.id,
          type: i.type,
          category: i.category,
          subcategory: i.subcategory,
          school: i.school,
          status: i.status ?? "Pending",
          createdAt: i.created_at,
          why,
          link: "/issues",
        }];
      }),
    (i) => ms(i.createdAt),
  );

  const plan = capList(
    r.plan
      .filter((p) => (p.kind === "priority" || p.kind === "task" || p.kind === "meeting") && !(p.kind === "meeting" && p.completed_at))
      .map((p) => ({
        id: p.id,
        kind: p.kind as "priority" | "task" | "meeting",
        label: p.label,
        taskId: p.task_file_category_id,
        generalTaskId: p.general_task_id,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
      })),
    (p) => num(p.sortOrder),
    (p) => ms(p.createdAt),
  );

  return { me: r.me, fetchedAt: r.now, trackerUrl: r.trackerUrl, tasks, generalTasks, emails, issues, plan };
}
