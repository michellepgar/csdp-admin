"use client";

import { SubmitButton } from "@/components/submit-button";
import type { GeneralNote } from "@/lib/app-state";

/* A note's id paired with whether the current viewer is allowed to
   delete it — computed server-side (page.tsx) and passed down as plain
   data, not a function. Only Server Actions (or primitives) can cross
   the server-to-client boundary as a prop; a plain closure throws at
   runtime — not caught by `next build`'s type-check, only by actually
   hitting the page, which is exactly what happened here. */
export type DeletableNoteId = { id: string; canDelete: boolean };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function GeneralNotesList({
  notes,
  currentUserName,
  deletable,
  ackGeneralNote,
  removeGeneralNote,
}: {
  notes: GeneralNote[];
  currentUserName: string;
  deletable: DeletableNoteId[];
  ackGeneralNote: (formData: FormData) => void;
  removeGeneralNote: (formData: FormData) => void;
}) {
  const deletableIds = new Set(deletable.filter((d) => d.canDelete).map((d) => d.id));
  const sorted = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No notes yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sorted.map((n) => {
        const ackBy = n.ackBy || [];
        const isAuthor = n.author === currentUserName;
        const needsAck = n.urgency === "Urgent" && !isAuthor && !ackBy.includes(currentUserName);
        return (
          <div
            key={n.id}
            className={`rounded-md border p-3 ${n.urgency === "Urgent" ? "border-destructive/50 bg-destructive/5" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                {n.urgency === "Urgent" && (
                  <span className="mb-1 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    Urgent
                  </span>
                )}
                <p className="text-sm whitespace-pre-wrap">{n.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.author} · {formatDateTime(n.createdAt)}
                  {n.urgency === "Urgent" && ackBy.length > 0 && ` · Seen by ${ackBy.join(", ")}`}
                </p>
              </div>
              <div className="flex flex-none items-center gap-2">
                {needsAck && (
                  <form action={ackGeneralNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <SubmitButton pendingLabel="…" variant="outline" size="sm">Mark as checked</SubmitButton>
                  </form>
                )}
                {deletableIds.has(n.id) && (
                  <form action={removeGeneralNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
