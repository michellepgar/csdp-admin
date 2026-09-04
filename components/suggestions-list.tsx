"use client";

import { useState } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
import { AutoSubmitDropdown } from "@/components/auto-submit-dropdown";
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
        <Dropdown
          name="sortField"
          value={sortField}
          onChange={(v) => setSortField(v as "date" | "author")}
          options={[{ value: "date", label: "Sort by date" }, { value: "author", label: "Sort by author" }]}
          className="rounded-md border px-2 py-1 text-left text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
          {sortDir === "asc" ? "↑ Ascending" : "↓ Descending"}
        </Button>
      </div>

      {STATUSES.map((status) => {
        const list = sorted.filter((s) => s.status === status);
        return (
          <section key={status} className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-header-background px-2 py-1 text-white">
              <h2 className="text-lg font-semibold">{status}</h2>
              <StatusBadge tone={STATUS_TONE[status]}>{list.length}</StatusBadge>
            </div>
            {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
            {list.map((s) => {
              const canDelete = s.author === currentUserName || !teamNames.includes(s.author);
              return (
                <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border bg-record-background p-3">
                  <div>
                    <p className="text-sm">{s.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.author} · {formatDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {isMichelle && (
                      <AutoSubmitDropdown
                        action={setSuggestionStatus}
                        hiddenFields={{ id: s.id }}
                        name="status"
                        value={s.status}
                        options={STATUSES.map((st) => ({ value: st, label: st }))}
                        className="rounded-md border px-2 py-1 text-left text-xs"
                      />
                    )}
                    {canDelete && (
                      <form action={removeSuggestion}>
                        <input type="hidden" name="id" value={s.id} />
                        <ConfirmDeleteButton confirmMessage="Remove this suggestion?" pendingLabel="…" variant="ghost" size="sm">✕</ConfirmDeleteButton>
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
