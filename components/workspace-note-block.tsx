"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteContent } from "@/lib/workspace";

/* Tags and attributes a pasted fragment may keep. Everything else is
   unwrapped (its text survives) or dropped. The server sanitizes again on
   save (lib/sanitize-note-html.ts); this only keeps a paste from Excel /
   Docs / a web page from carrying layout-breaking styles, positioned
   elements or script-ish markup into the editor in the meantime. */
const KEEP_TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "BR", "P", "DIV", "SPAN", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "PRE", "IMG"]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "META", "LINK", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "SVG", "MATH", "TITLE", "HEAD", "NOSCRIPT", "TEMPLATE", "COLGROUP", "COL"]);
const SAFE_URL = /^(https?:|mailto:)/i;
const SAFE_IMG = /^(https?:|data:image\/(png|jpe?g|gif|webp);)/i;

function cleanNode(node: Node, out: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.appendChild(document.createTextNode(child.textContent ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toUpperCase();
    if (DROP_TAGS.has(tag)) continue;
    if (!KEEP_TAGS.has(tag)) {
      cleanNode(el, out); // unwrap unknown wrappers, keep their text
      continue;
    }
    if (tag === "IMG") {
      const src = el.getAttribute("src") ?? "";
      if (!SAFE_IMG.test(src)) continue;
      const img = document.createElement("img");
      img.setAttribute("src", src);
      const alt = el.getAttribute("alt");
      if (alt) img.setAttribute("alt", alt);
      out.appendChild(img);
      continue;
    }
    const copy = document.createElement(tag.toLowerCase());
    if (tag === "A") {
      const href = el.getAttribute("href") ?? "";
      if (SAFE_URL.test(href)) copy.setAttribute("href", href);
    }
    if (tag === "TD" || tag === "TH") {
      for (const attr of ["colspan", "rowspan"]) {
        const value = el.getAttribute(attr);
        if (value && /^\d{1,3}$/.test(value)) copy.setAttribute(attr, value);
      }
    }
    cleanNode(el, copy);
    out.appendChild(copy);
  }
}

function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const holder = document.createElement("div");
  cleanNode(doc.body, holder);
  return holder.innerHTML;
}

/* A note block's rich-text body. Built on document.execCommand exactly as
   components/sticky-note-composer.tsx does (see its comment on why); none of
   that composer's form/draft/mention/pad-colour machinery is used here.

   The HTML is put into the editable div ONCE (useState's initial value feeds
   dangerouslySetInnerHTML, whose value never changes afterwards) -- React
   never rewrites it, so the caret never jumps while typing. `content.html`
   comes from the server (sanitized on save) or, after a sheet switch within
   the same session, from this session's own last edit. */
export function WorkspaceNoteBlock({
  content,
  onChange,
  onFlush,
}: {
  content: NoteContent;
  /** Called on every edit with the current HTML (the canvas debounces the save). */
  onChange: (content: NoteContent) => void;
  /** Called on blur: save right now instead of waiting for the debounce. */
  onFlush: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [initialHtml] = useState(content.html);

  function currentHtml(): string {
    const editor = editorRef.current;
    if (!editor) return "";
    // A cleared contentEditable leaves a stray <br>; store that as empty.
    if (!editor.innerText.trim() && !editor.querySelector("img, table, ul, ol")) return "";
    return editor.innerHTML;
  }

  function emit() {
    onChange({ html: currentHtml() });
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  // Same reason as the sticky-note composer: a click outside the
  // contentEditable would blur it and collapse the selection before
  // Bold/Italic/etc. could apply to it.
  function preserveSelection(e: React.MouseEvent) {
    e.preventDefault();
  }

  function addLink() {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const saved = selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    const entered = window.prompt("Link address (for example https://example.com)");
    if (!entered) return;
    let url = entered.trim();
    if (!url) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
    if (!SAFE_URL.test(url)) return;
    editor.focus();
    if (saved) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved);
    }
    if (saved && saved.collapsed) document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "&quot;")}">${url.replace(/[<>&]/g, "")}</a>`);
    else document.execCommand("createLink", false, url);
    emit();
  }

  // Paste stays inside the block: only a cleaned fragment is inserted (no
  // styles, positioned elements or scripts), and plain text falls back to
  // insertText. Excel/Sheets ranges arrive as a plain <table>, which the
  // note styling already renders.
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (!html && !text) return;
    e.preventDefault();
    const cleaned = html ? cleanPastedHtml(html) : "";
    if (cleaned.trim()) document.execCommand("insertHTML", false, cleaned);
    else document.execCommand("insertText", false, text);
    emit();
  }

  // A file dropped on a contentEditable would navigate the page to it.
  function handleDrop(e: React.DragEvent) {
    if (e.dataTransfer.files.length > 0 || e.dataTransfer.types.includes("text/html")) e.preventDefault();
  }

  return (
    <div className="flex h-full min-h-32 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-ring/15 bg-muted/50 px-1.5 py-1">
        <Button type="button" variant="ghost" size="icon-sm" title="Bold" onMouseDown={preserveSelection} onClick={() => exec("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Italic" onMouseDown={preserveSelection} onClick={() => exec("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Button type="button" variant="ghost" size="icon-sm" title="Bullet list" onMouseDown={preserveSelection} onClick={() => exec("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Numbered list" onMouseDown={preserveSelection} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Link" onMouseDown={preserveSelection} onClick={addLink}>
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type a note…"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        onInput={emit}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onBlur={onFlush}
        className="note-html min-h-0 w-full flex-1 overflow-auto break-words p-3 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
      />
    </div>
  );
}
