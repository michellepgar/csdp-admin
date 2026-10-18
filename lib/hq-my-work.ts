// lib/hq-my-work.ts
/* Michelle HQ's read-only window into the tracker: what's waiting on Michelle, and nothing else. This file has no
   imports so the tests can load it on its own. The route (app/api/hq/my-work) does the reads; this only shapes them.
   Every output object is built field by field, so a new database column can never slip out, and no student field
   (name, birthday, insurance, record link, correction text) or issue free text is ever copied. */

export type MyWorkRows = {
  me: string;
  trackerUrl: string;
  now: string;
  categories: { id: string; task_file_id: string; category_id: string; status: string | null; va_assigned: string[] | null; status_changed_at: string | null }[];
  files: { id: string; school_id: string; file_name: string | null }[];
  categoryNames: { id: string; name: string }[];
  schools: { id: string; name: string }[];
  generalTasks: { id: string; category: string | null; description: string | null; status: string | null; va_assigned: string[] | null; status_changed_at: string | null }[];
  /** app_state.data.schoolData: only vaAssigned is read. */
  schoolData: Record<string, { vaAssigned?: string } | null | undefined> | null;
  emails: { id: string; school_id: string; description: string | null; status: string | null; created_at: string }[];
  issues: { id: string; type: string | null; category: string | null; subcategory: string | null; school: string | null; status: string | null; created_at: string; reported_by: string | null; comment_ack_by: string[] | null }[];
  issueIdsWithComments: string[];
  issueIdsMentioningMe: string[];
  plan: { id: string; kind: string; label: string | null; task_file_category_id: string | null; general_task_id: string | null; sort_order: number | null; created_at: string; completed_at: string | null }[];
};

export type Why = "reported" | "unseen-comments" | "mentioned";

/** The same check as the backup route: the exact "Bearer <secret>", compared in constant time for equal lengths. */
export function hqKeyOk(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const a = new TextEncoder().encode(header), b = new TextEncoder().encode(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const mine = (names: string[] | null, me: string) => (names ?? []).some((n) => n.toLowerCase() === me.toLowerCase());
const open = (status: string | null) => (status ?? "") !== "Completed";

export function shapeMyWork(r: MyWorkRows) {
  const school = new Map(r.schools.map((s) => [s.id, s.name]));
  const file = new Map(r.files.map((f) => [f.id, f]));
  const catName = new Map(r.categoryNames.map((c) => [c.id, c.name]));
  const mySchools = new Set(Object.entries(r.schoolData ?? {}).filter(([, d]) => (d?.vaAssigned ?? "").toLowerCase() === r.me.toLowerCase()).map(([id]) => id));
  const commented = new Set(r.issueIdsWithComments), mentioned = new Set(r.issueIdsMentioningMe);

  const tasks = r.categories.filter((c) => mine(c.va_assigned, r.me) && open(c.status)).map((c) => {
    const f = file.get(c.task_file_id);
    return { id: c.id, school: f ? school.get(f.school_id) ?? null : null, category: catName.get(c.category_id) ?? null, fileName: f?.file_name ?? null,
      status: c.status ?? "", statusChangedAt: c.status_changed_at, link: f ? `/schools/${f.school_id}` : "/overview" };
  });
  const generalTasks = r.generalTasks.filter((g) => mine(g.va_assigned, r.me) && open(g.status)).map((g) => ({
    id: g.id, category: g.category, description: g.description, status: g.status ?? "", statusChangedAt: g.status_changed_at, link: "/general-tasks",
  }));
  const emails = r.emails.filter((e) => e.status === "Needs My Response" && mySchools.has(e.school_id)).map((e) => ({
    id: e.id, school: school.get(e.school_id) ?? null, description: e.description, createdAt: e.created_at, link: `/schools/${e.school_id}`,
  }));
  const issues = r.issues.filter((i) => i.status === "Pending").flatMap((i) => {
    const why: Why[] = [];
    if ((i.reported_by ?? "").toLowerCase() === r.me.toLowerCase()) why.push("reported");
    if (commented.has(i.id) && !mine(i.comment_ack_by, r.me)) why.push("unseen-comments");
    if (mentioned.has(i.id)) why.push("mentioned");
    return why.length ? [{ id: i.id, type: i.type, category: i.category, subcategory: i.subcategory, school: i.school, status: i.status ?? "Pending", createdAt: i.created_at, why, link: "/issues" }] : [];
  });
  const plan = r.plan.filter((p) => (p.kind === "priority" || p.kind === "task" || p.kind === "meeting") && !(p.kind === "meeting" && p.completed_at)).map((p) => ({
    id: p.id, kind: p.kind as "priority" | "task" | "meeting", label: p.label, taskId: p.task_file_category_id, generalTaskId: p.general_task_id, sortOrder: p.sort_order, createdAt: p.created_at,
  }));
  return { me: r.me, fetchedAt: r.now, trackerUrl: r.trackerUrl, tasks, generalTasks, emails, issues, plan };
}
