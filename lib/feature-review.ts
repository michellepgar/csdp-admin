/* Feature Review: a My Workspace block that is a kanban board for reviewing a
   software project's new features with a client. Cards move between four
   columns while the client decides; each card has pictures (files in the
   private "workspace-files" storage bucket), what / why / how, and a decision
   with a date and the client's comments. The whole board is the block's
   content (one JSON document), like every other block. */

export type ReviewStatus = "todo" | "improve" | "ok" | "no";

export const REVIEW_COLUMNS: { status: ReviewStatus; name: string; tone: "blue" | "amber" | "green" | "red" }[] = [
  { status: "todo", name: "To be approved", tone: "blue" },
  { status: "improve", name: "Needs improvement", tone: "amber" },
  { status: "ok", name: "Approved", tone: "green" },
  { status: "no", name: "Declined", tone: "red" },
];
export const REVIEW_STATUSES: ReviewStatus[] = REVIEW_COLUMNS.map((c) => c.status);

/** `file` is the picture's file name (its placeholder until uploaded); `path` is where the uploaded file is stored. */
export type ReviewPicture = { id: string; file: string; caption: string; path?: string };
export type ReviewCard = {
  id: string;
  area: string;
  title: string;
  status: ReviewStatus;
  pictures: ReviewPicture[];
  what: string;
  why: string;
  how: string[];
  /** YYYY-MM-DD, or "" when not decided yet. */
  decisionDate: string;
  comments: string;
};
export type ReviewContent = { cards: ReviewCard[] };
/** A starting card: no id-level status or decision yet, pictures without ids. */
export type ReviewSeedCard = { id: string; area: string; title: string; pictures: { file: string; caption: string }[]; what: string; why: string; how: string[] };

export const MAX_REVIEW_CARDS = 300;
export const MAX_REVIEW_PICTURES = 12;
const MAX_TITLE = 200;
const MAX_AREA = 60;
const MAX_TEXT = 4000;
const MAX_STEPS = 30;
const MAX_STEP = 600;
const MAX_CAPTION = 300;
const MAX_COMMENTS = 10000;
const MAX_FILE_NAME = 120;
/** "<user id>/<block id>/<file>" inside the workspace-files bucket. */
const PICTURE_PATH = /^[\w-]{1,64}\/[\w-]{1,64}\/[\w.-]{1,160}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[\w-]{1,64}$/;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const oneLine = (v: unknown, max: number) => text(v, max).replace(/\s+/g, " ").trim();

export function newReviewId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 16) : Math.random().toString(36).slice(2, 14);
}

/** A column's status from its key or its name ("Approved", "To be approved", ...). */
export function readStatus(raw: unknown): ReviewStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if ((REVIEW_STATUSES as string[]).includes(value)) return value as ReviewStatus;
  return REVIEW_COLUMNS.find((c) => c.name.toLowerCase() === value)?.status ?? null;
}

export function columnName(status: ReviewStatus): string {
  return REVIEW_COLUMNS.find((c) => c.status === status)?.name ?? "To be approved";
}

/** Approved or Declined: the client has made up their mind. */
export const isDecided = (status: ReviewStatus) => status === "ok" || status === "no";

function readPicture(raw: unknown, seen: Set<string>): ReviewPicture | null {
  if (!isObject(raw)) return null;
  const file = oneLine(raw.file ?? raw.name, MAX_FILE_NAME);
  const path = typeof raw.path === "string" && PICTURE_PATH.test(raw.path) ? raw.path : undefined;
  if (!file && !path) return null;
  let id = typeof raw.id === "string" && ID.test(raw.id) && !seen.has(raw.id) ? raw.id : newReviewId();
  while (seen.has(id)) id = newReviewId();
  seen.add(id);
  return { id, file: file || "picture", caption: oneLine(raw.caption, MAX_CAPTION), ...(path ? { path } : {}) };
}

/** One card, cleaned up; null when it has no title. Unknown statuses start in To be approved. */
export function readCard(raw: unknown, seenIds: Set<string>): ReviewCard | null {
  if (!isObject(raw)) return null;
  const title = oneLine(raw.title, MAX_TITLE);
  if (!title) return null;
  let id = typeof raw.id === "string" && ID.test(raw.id) && !seenIds.has(raw.id) ? raw.id : newReviewId();
  while (seenIds.has(id)) id = newReviewId();
  seenIds.add(id);
  const pictureIds = new Set<string>();
  const rawPictures = Array.isArray(raw.pictures) ? raw.pictures : Array.isArray(raw.pics) ? raw.pics.map((p) => (Array.isArray(p) ? { file: p[0], caption: p[1] } : p)) : [];
  const pictures = rawPictures.map((p) => readPicture(p, pictureIds)).filter((p): p is ReviewPicture => !!p).slice(0, MAX_REVIEW_PICTURES);
  const how = (Array.isArray(raw.how) ? raw.how : typeof raw.how === "string" ? raw.how.split("\n") : [])
    .map((step) => oneLine(step, MAX_STEP))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
  const date = typeof raw.decisionDate === "string" && DATE.test(raw.decisionDate) ? raw.decisionDate : typeof raw.date === "string" && DATE.test(raw.date) ? raw.date : "";
  return {
    id,
    area: oneLine(raw.area, MAX_AREA),
    title,
    status: readStatus(raw.status ?? raw.s) ?? "todo",
    pictures,
    what: text(raw.what, MAX_TEXT).trim(),
    why: text(raw.why, MAX_TEXT).trim(),
    how,
    decisionDate: date,
    comments: text(raw.comments, MAX_COMMENTS),
  };
}

/** The block's saved content, checked; null when it isn't a board at all. */
export function validateReviewContent(raw: unknown): ReviewContent | null {
  if (!isObject(raw)) return null;
  if (raw.cards === undefined) return { cards: [] };
  if (!Array.isArray(raw.cards) || raw.cards.length > MAX_REVIEW_CARDS) return null;
  const seen = new Set<string>();
  const cards = raw.cards.map((c) => readCard(c, seen)).filter((c): c is ReviewCard => !!c);
  return { cards };
}

export function cardsFromSeed(seed: ReviewSeedCard[]): ReviewCard[] {
  const seen = new Set<string>();
  return seed.map((card) => readCard({ ...card, status: "todo" }, seen)).filter((c): c is ReviewCard => !!c);
}

/** Moving a card to a decided column fills in today's date when it has none. */
export function moveCard(card: ReviewCard, status: ReviewStatus, today: string): ReviewCard {
  if (card.status === status) return card;
  return { ...card, status, decisionDate: status !== "todo" && !card.decisionDate ? today : card.decisionDate };
}

/** What Export writes: the whole board, as a backup. */
export function exportBoard(content: ReviewContent): string {
  return JSON.stringify({ board: "csdp-feature-review", version: 2, exported: new Date().toISOString(), cards: content.cards }, null, 2);
}

export type ImportResult =
  | { kind: "cards"; cards: ReviewCard[] }
  | { kind: "decisions"; decisions: Record<string, { status: ReviewStatus; decisionDate: string; comments: string }> }
  | { kind: "error"; message: string };

/* Import accepts three shapes:
   - this board's own Export ({ board, cards }) -- replaces the cards;
   - the local board file's "Save board file" ({ board, state: { id: { s, date, comments } } })
     -- brings over decisions for cards with the same id;
   - a plain list of cards (like the starting-cards list) -- replaces the cards. */
export function parseImport(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { kind: "error", message: "That file isn't a Feature Review board file." };
  }
  const list = Array.isArray(data) ? data : isObject(data) && Array.isArray(data.cards) ? data.cards : null;
  if (list) {
    if (list.length > MAX_REVIEW_CARDS) return { kind: "error", message: `A board can hold up to ${MAX_REVIEW_CARDS} cards.` };
    const seen = new Set<string>();
    const cards = list.map((c) => readCard(c, seen)).filter((c): c is ReviewCard => !!c);
    return cards.length > 0 ? { kind: "cards", cards } : { kind: "error", message: "That file has no cards in it." };
  }
  if (isObject(data) && isObject(data.state)) {
    const decisions: Record<string, { status: ReviewStatus; decisionDate: string; comments: string }> = {};
    for (const [id, raw] of Object.entries(data.state)) {
      if (!ID.test(id) || !isObject(raw)) continue;
      decisions[id] = {
        status: readStatus(raw.s ?? raw.status) ?? "todo",
        decisionDate: typeof raw.date === "string" && DATE.test(raw.date) ? raw.date : "",
        comments: text(raw.comments, MAX_COMMENTS),
      };
    }
    return Object.keys(decisions).length > 0 ? { kind: "decisions", decisions } : { kind: "error", message: "That board file has no decisions in it." };
  }
  return { kind: "error", message: "That file isn't a Feature Review board file." };
}

/** Local-board decisions applied to the cards with the same id; how many matched. */
export function applyDecisions(cards: ReviewCard[], decisions: Record<string, { status: ReviewStatus; decisionDate: string; comments: string }>): { cards: ReviewCard[]; matched: number } {
  let matched = 0;
  const next = cards.map((card) => {
    const d = decisions[card.id];
    if (!d) return card;
    matched++;
    return { ...card, status: d.status, decisionDate: d.decisionDate, comments: d.comments };
  });
  return { cards: next, matched };
}

/** Storage paths still used by any card (a file shared by two cards stays until both let go). */
export function picturePaths(cards: ReviewCard[]): Set<string> {
  return new Set(cards.flatMap((c) => c.pictures.map((p) => p.path).filter((p): p is string => !!p)));
}

/** Uploaded files matched to pictures by file name (case-insensitive); how many pictures were filled. */
export function attachUploads(cards: ReviewCard[], uploaded: Record<string, string>): { cards: ReviewCard[]; filled: number } {
  const byName = new Map(Object.entries(uploaded).map(([name, path]) => [name.toLowerCase(), path]));
  let filled = 0;
  const next = cards.map((card) => {
    let changed = false;
    const pictures = card.pictures.map((p) => {
      const path = byName.get(p.file.toLowerCase());
      if (!path || p.path === path) return p;
      changed = true;
      filled++;
      return { ...p, path };
    });
    return changed ? { ...card, pictures } : card;
  });
  return { cards: next, filled };
}
