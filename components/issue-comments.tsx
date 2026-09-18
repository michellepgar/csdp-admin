"use client";

import { useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { MentionAutocomplete } from "@/components/mention-autocomplete";
import { initialsForName } from "@/lib/team-presence";
import type { Issue, Va } from "@/lib/app-state";

/* timeZone pinned to Michelle's own working timezone -- see
   components/issues-list.tsx's fmtDate for the full hydration-mismatch
   reasoning; this panel only ever renders after the viewer expands a
   row (never during SSR), so there's no mismatch risk here, but every
   other timestamp in the app is pinned the same way for consistency. */
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function colorFor(name: string, vas: Va[]): string {
  return vas.find((v) => v.name === name)?.color || "var(--muted-foreground)";
}

// Splits comment text on @word tokens, styling the ones that match a
// real teammate (bold, that teammate's own color) and leaving
// everything else -- including an @word that ISN'T a real teammate --
// as plain text. Mirrors lib/sanitize-note-html.ts's mention styling,
// but General Notes bake their styling into saved HTML at write time
// (they're rendered via dangerouslySetInnerHTML) while comment text is
// plain, so this runs client-side at render time instead.
function renderCommentText(text: string, vas: Va[]) {
  const byLowerName = new Map(vas.map((v) => [v.name.toLowerCase(), v.name]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(/@(\w+)/g)) {
    const real = byLowerName.get(match[1].toLowerCase());
    const start = match.index!;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(real ? <b key={key++} style={{ color: colorFor(real, vas) }}>@{real}</b> : match[0]);
    lastIndex = start + match[0].length;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}

/* The small chat-bubble button every issue row shows -- click toggles
   the caller's own expand state (see components/issues-list.tsx, which
   owns which issue's row is currently expanded) rather than an
   internal popup. The blinking dot (.priority-dot, same animation as
   Task Priorities' unassigned list) shows whenever the current user
   hasn't seen the LATEST comment yet -- commentAckBy is reset to just
   the poster's own name on every new comment
   (app/(app)/issues/actions.ts's addIssueComment). Opening the row
   acks it. */
export function CommentToggleButton({
  issue,
  currentUserName,
  expanded,
  onToggle,
  ackIssueComments,
}: {
  issue: Issue;
  currentUserName: string;
  expanded: boolean;
  onToggle: () => void;
  ackIssueComments: (formData: FormData) => void;
}) {
  const comments = issue.comments || [];
  const unread = comments.length > 0 && !(issue.commentAckBy || []).includes(currentUserName);

  function handleClick() {
    const opening = !expanded;
    onToggle();
    if (opening && unread) {
      const fd = new FormData();
      fd.set("issueId", issue.id);
      ackIssueComments(fd);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${comments.length} comment${comments.length === 1 ? "" : "s"} -- ${unread ? "new activity" : "open to view or add a comment"}`}
      className="relative flex h-7 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-muted"
    >
      <MessageCircle className="h-4 w-4" />
      {comments.length > 0 && <span className="text-xs">{comments.length}</span>}
      {unread && <span className="priority-dot absolute -right-0.5 -top-0.5 m-0" aria-hidden />}
    </button>
  );
}

/* The expanded thread itself -- rendered by the caller inline below
   the issue's row (see components/issues-list.tsx), full width, not a
   floating popup. The comment LIST (not the add-comment form under it)
   caps at roughly 5 visible comments (max-h-[220px] ~= 5 rows at this
   font size) and scrolls past that -- Michelle asked to see more at
   once than the old 288px popup allowed, without the row growing
   unbounded for a long-running thread. */
export function CommentThreadPanel({
  issue,
  vas,
  addIssueComment,
}: {
  issue: Issue;
  vas: Va[];
  addIssueComment: (formData: FormData) => void;
}) {
  const comments = issue.comments || [];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  function updateMentionState() {
    const el = textareaRef.current;
    if (!el) return;
    const upToCaret = el.value.slice(0, el.selectionStart ?? 0);
    const match = upToCaret.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setAnchorRect(el.getBoundingClientRect());
    } else {
      setMentionQuery(null);
    }
  }

  function selectMention(name: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const upToCaret = el.value.slice(0, caret);
    const match = upToCaret.match(/@(\w*)$/);
    if (!match) return;
    const start = caret - match[0].length;
    const inserted = `@${name} `;
    el.value = el.value.slice(0, start) + inserted + el.value.slice(caret);
    const newCaret = start + inserted.length;
    el.setSelectionRange(newCaret, newCaret);
    el.focus();
    setMentionQuery(null);
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="max-h-[220px] space-y-2 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: colorFor(c.author, vas) }}
                aria-hidden
              >
                {initialsForName(c.author)}
              </span>
              <div className="min-w-0">
                <div className="text-xs"><span className="font-semibold">{c.author}</span> <span className="text-muted-foreground">· {fmtDateTime(c.createdAt)}</span></div>
                <div className="whitespace-pre-wrap break-words text-sm">{renderCommentText(c.text, vas)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <form
        action={(formData) => addIssueComment(formData)}
        onSubmit={(e) => {
          const form = e.currentTarget;
          requestAnimationFrame(() => form.reset());
        }}
        className="flex gap-1"
      >
        <input type="hidden" name="issueId" value={issue.id} />
        <textarea
          ref={textareaRef}
          name="text"
          required
          placeholder="Add a comment… use @ to mention someone"
          rows={2}
          onInput={updateMentionState}
          onKeyUp={updateMentionState}
          onClick={updateMentionState}
          onBlur={() => setMentionQuery(null)}
          className="w-full min-w-0 flex-1 resize-y rounded-md border px-1.5 py-1 text-sm"
        />
        <SubmitButton pendingLabel="…" size="xs">Post</SubmitButton>
      </form>
      <MentionAutocomplete query={mentionQuery} anchorRect={anchorRect} vas={vas} onSelect={selectMention} onClose={() => setMentionQuery(null)} />
    </div>
  );
}
