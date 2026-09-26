/* The Feature Review printout: a summary (how many cards in each column),
   then every card -- title, area, decision and date, what / why / how, its
   pictures and the client's comments. Cards are grouped in column order and
   never split across pages. Also used for printing a single card. */
import { REVIEW_COLUMNS, columnName, type ReviewCard } from "./feature-review.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function formatDecisionDate(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function buildReviewReport(cards: ReviewCard[], urls: Record<string, string>, options: { title: string; single?: boolean }): string {
  const order = REVIEW_COLUMNS.map((c) => c.status);
  const sorted = [...cards].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const printed = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const summary = options.single
    ? ""
    : `<table class="sum"><thead><tr><th>Decision</th><th>Features</th></tr></thead><tbody>${REVIEW_COLUMNS.map(
        (c) => `<tr><td>${esc(c.name)}</td><td>${cards.filter((card) => card.status === c.status).length}</td></tr>`,
      ).join("")}<tr class="total"><td>Total</td><td>${cards.length}</td></tr></tbody></table>`;
  const items = sorted
    .map((card) => {
      const pictures = card.pictures
        .map((p) => {
          const url = p.path ? urls[p.path] : undefined;
          return `<figure>${url ? `<img src="${esc(url)}" alt="">` : `<div class="missing">Picture not uploaded: ${esc(p.file)}</div>`}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ""}</figure>`;
        })
        .join("");
      return `<section class="item">
  <h2>${esc(card.title)}</h2>
  <div class="meta">${card.area ? `${esc(card.area)} · ` : ""}<b>${esc(columnName(card.status))}</b>${card.decisionDate ? ` · ${esc(formatDecisionDate(card.decisionDate))}` : ""}</div>
  ${card.what ? `<p><b>What it does.</b> ${esc(card.what)}</p>` : ""}
  ${card.why ? `<p><b>Why we need it.</b> ${esc(card.why)}</p>` : ""}
  ${card.how.length ? `<p><b>How to try it.</b></p><ol>${card.how.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>` : ""}
  ${pictures}
  <p><b>Client comments</b></p><div class="comments">${card.comments.trim() ? esc(card.comments) : "None yet."}</div>
</section>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(options.title)}</title><style>
  @page { margin: 16mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2933; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .intro { color: #52606d; margin-bottom: 14px; }
  table.sum { border-collapse: collapse; margin: 0 0 18px; min-width: 260px; }
  table.sum th, table.sum td { border: 1px solid #cbd2d9; padding: 4px 10px; text-align: left; }
  table.sum th { background: #f0f4f8; }
  table.sum td:last-child { text-align: right; }
  table.sum tr.total td { font-weight: 700; }
  .item { break-inside: avoid; page-break-inside: avoid; border-top: 2px solid #d9e2ec; padding: 12px 0 8px; }
  h2 { font-size: 13pt; margin: 0 0 2px; }
  .meta { color: #52606d; margin-bottom: 6px; }
  p { margin: 6px 0; }
  ol { margin: 4px 0 6px 20px; padding: 0; }
  figure { margin: 8px 0; break-inside: avoid; }
  figure img { max-width: 100%; max-height: 360px; border: 1px solid #d9e2ec; border-radius: 4px; }
  figcaption { font-size: 9.5pt; color: #52606d; }
  .missing { font-size: 9.5pt; color: #9aa5b1; border: 1px dashed #cbd2d9; padding: 10px; border-radius: 4px; }
  .comments { white-space: pre-wrap; border-left: 3px solid #9fb3c8; padding: 4px 10px; background: #f8fafc; }
</style></head><body>
<h1>${esc(options.title)}</h1>
<div class="intro">Printed ${esc(printed)}.${options.single ? "" : ` ${cards.length} feature${cards.length === 1 ? "" : "s"}, with the client's decisions and comments.`}</div>
${summary}
${items}
</body></html>`;
}
