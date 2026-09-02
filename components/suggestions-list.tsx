"use client";

import { useState } from "react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import type { Suggestion } from "@/lib/app-state";

const STATUSES = ["Requested", "Working On It", "Added"] as const;

const STATUS_TONE: Record<(typeof STATUSES)[number], StatusTone> = {
  Requested: "neutral",
  "Working On It": "warning",
  Added: "success",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SuggestionsList({
  suggestions,
  currentUserName,
  isMichelle,
  teamNames,
  setSuggestionStatus,
  removeSuggestion,
}: {
  suggestions: Suggestion[];
  currentUserName: string;
  isMichelle: boolean;
  teamNames: string[];
  setSuggestionStatus: (formData: FormData) => void;
  removeSuggestion: (formData: FormData) => void;
}) {
  const [sortField, setSortField] = useState<"date" | "author">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...suggestions].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "author") return a.author.localeCompare(b.author) * dir;
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as "date" | "author")}
          className="rounded-md border px-2 py-1 text-sm"
        >
          <option value="date">Sort by date</option>
          <option value="author">Sort by author</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "↑ Ascending" : "↓ Descending"}
        </Button>
      </div>

      {STATUSES.map((status) => {
        const list = sorted.filter((s) => s.status === status);
        return (
          <section key={status} className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-header-background px-2 py-1">
              <h2 className="text-lg font-semibold">{status}</h2>
              <StatusBadge tone={STATUS_TONE[status]}>{list.length}</StatusBadge>
            </div>
            {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
            {list.map((s) => {
              const canDelete = s.author === currentUserName || !teamNames.includes(s.author);
              return (
                <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm">{s.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.author} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {isMichelle && (
                      <AutoSubmitForm action={setSuggestionStatus}>
                        <input type="hidden" name="id" value={s.id} />
                        <select key={s.status} name="status" defaultValue={s.status} className="rounded-md border px-2 py-1 text-xs">
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </AutoSubmitForm>
                    )}
                    {canDelete && (
                      <form action={removeSuggestion}>
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton pendingLabel="…" variant="ghost" size="sm">✕</SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
