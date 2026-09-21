"use client";

import { useEffect, useRef, useState } from "react";
import { MentionAutocomplete } from "@/components/mention-autocomplete";
import { SubmitButton } from "@/components/submit-button";
import type { Va } from "@/lib/app-state";
import { shrinkImageToDataUrl } from "@/lib/shrink-image";

// Same rule as sticky-note-composer.tsx's hasContent -- a comment that's
// nothing but a pasted screenshot has no innerText of its own.
function hasContent(editor: HTMLElement): boolean {
  return !!editor.innerText.trim() || !!editor.querySelector("img, table");
}

/* The lean comment box used everywhere a comment can be posted or
   edited (Issues & Concerns, General Notes, Private Notes) -- a
   stripped-down sibling of components/sticky-note-composer.tsx with no
   formatting toolbar (comments stay quick messages, not documents) but
   the same paste-a-screenshot and @mention-autocomplete behavior,
   reused as-is rather than reinvented. Renders a hidden `text` input
   so the surrounding <form action={...}> picks up the sanitized-at-
   save-time HTML the same way every note composer already does. */
export function CommentComposer({
  vas,
  defaultText,
  placeholder = "Add a comment… use @ to mention someone",
  submitLabel = "Post",
  onCancel,
}: {
  vas: Va[];
  /** Pre-fills the editor for an edit-in-place -- same one-time-on-mount
   *  behavior as StickyNoteComposer's own defaultText. */
  defaultText?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Shown as a Cancel button next to Post/Save when editing an
   *  existing comment (the caller owns exiting edit mode; this
   *  composer has no state of its own about whether it's "new" vs
   *  "editing"). Omitted entirely for the ordinary add-a-comment case. */
  onCancel?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchorRect, setMentionAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (editorRef.current && defaultText) editorRef.current.innerHTML = defaultText;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads its initial content once per mount, same as StickyNoteComposer.
  }, []);

  useEffect(() => {
    const form = editorRef.current?.closest("form");
    if (!form) return;
    function syncBeforeSubmit(e: SubmitEvent) {
      const editor = editorRef.current;
      if (!editor || !hasContent(editor)) {
        e.preventDefault();
        return;
      }
      if (textInputRef.current) textInputRef.current.value = editor.innerHTML;
    }
    form.addEventListener("submit", syncBeforeSubmit);
    return () => form.removeEventListener("submit", syncBeforeSubmit);
  }, []);

  useEffect(() => {
    function clearOnSuccessfulSubmit() {
      if (editorRef.current && !defaultText) editorRef.current.innerHTML = "";
    }
    const form = editorRef.current?.closest("form");
    form?.addEventListener("submit", clearOnSuccessfulSubmit);
    return () => form?.removeEventListener("submit", clearOnSuccessfulSubmit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attached once to this component's owning form, same as StickyNoteComposer.
  }, []);

  function detectMention() {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0 || !selection.isCollapsed) {
      setMentionQuery(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
      setMentionQuery(null);
      return;
    }
    const node = range.startContainer;
    const textBeforeCaret = node.nodeType === Node.TEXT_NODE ? (node.textContent || "").slice(0, range.startOffset) : "";
    const match = textBeforeCaret.match(/@(\w*)$/);
    if (!match) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(match[1]);
    const rects = range.cloneRange().getClientRects();
    setMentionAnchorRect(rects.length > 0 ? rects[0] : editor.getBoundingClientRect());
  }

  function selectMention(name: string) {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent || "";
    const textBeforeCaret = text.slice(0, range.startOffset);
    const match = textBeforeCaret.match(/@(\w*)$/);
    if (!match) return;
    const start = range.startOffset - match[0].length;
    const mentionRange = document.createRange();
    mentionRange.setStart(node, start);
    mentionRange.setEnd(node, range.startOffset);
    mentionRange.deleteContents();
    const inserted = document.createTextNode(`@${name} `);
    mentionRange.insertNode(inserted);
    const after = document.createRange();
    after.setStartAfter(inserted);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
    editor.focus();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    setMentionQuery(null);
  }

  // Identical to sticky-note-composer.tsx's handlePaste -- see that
  // file's own comment for why this is the one paste case that needs
  // real code (a copied screenshot has no HTML clipboard representation
  // for the browser's default paste to do anything with).
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    e.preventDefault();

    const editor = editorRef.current;
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 && editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;

    // Shrunk first (see lib/shrink-image.ts) -- a raw screenshot or phone
    // photo would otherwise be saved into the note at full size.
    void shrinkImageToDataUrl(file).then((dataUrl) => {
      if (!editor) return;
      editor.focus();
      const img = document.createElement("img");
      img.src = dataUrl;
      const range = savedRange ?? document.createRange();
      if (!savedRange) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  return (
    <div className="flex gap-1">
      <div className="min-w-0 flex-1">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onPaste={handlePaste}
          onInput={detectMention}
          onKeyUp={detectMention}
          onClick={detectMention}
          onBlur={() => setMentionQuery(null)}
          className="note-html min-h-[2.25rem] w-full overflow-x-auto rounded-[0.65rem] border border-ring/40 bg-linear-to-b from-transparent to-ring/5 px-2 py-1.5 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(0_0_0/0.07)] transition-shadow outline-none focus:border-ring focus:ring-3 focus:ring-ring/25 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
        />
        <MentionAutocomplete query={mentionQuery} anchorRect={mentionAnchorRect} vas={vas} onSelect={selectMention} onClose={() => setMentionQuery(null)} />
      </div>
      <input ref={textInputRef} type="hidden" name="text" />
      <div className="flex flex-none items-start gap-1">
        <SubmitButton pendingLabel="…" size="xs">{submitLabel}</SubmitButton>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
