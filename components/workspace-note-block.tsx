"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListChecks, ListOrdered, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorWell } from "@/components/color-well";
import { NOTE_FONT_COLORS, NOTE_PAD_COLORS } from "@/lib/app-state";
import { shrinkImageToDataUrl } from "@/lib/shrink-image";
import type { NoteContent } from "@/lib/workspace";

const FONT_FAMILIES = [
  { value: "", label: "Sans" },
  { value: "Georgia, serif", label: "Serif" },
  { value: "ui-monospace, Menlo, monospace", label: "Mono" },
  { value: '"Comic Sans MS", "Comic Sans", cursive', label: "Handwritten" },
];
const FONT_SIZES = [
  { value: "2", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "5", label: "Large" },
];

/* Tags and attributes a pasted fragment may keep. Everything else is
   unwrapped (its text survives) or dropped. The server sanitizes again on
   save (lib/sanitize-note-html.ts); this only keeps a paste from Excel /
   Docs / a web page from carrying layout-breaking styles, positioned
   elements or script-ish markup into the editor in the meantime. */
/* Only tags lib/sanitize-note-html.ts keeps -- anything else would be
   stripped on save (P became "ab" from two paragraphs). Block-level
   paragraph-like tags become DIV (which the sanitizer keeps, so line breaks
   survive a round trip); headings also get bold; TFOOT becomes TBODY. */
const KEEP_TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "BR", "DIV", "SPAN", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "IMG"]);
const AS_DIV = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "PRE"]);
const HEADINGS = new Set(["H1", "H2", "H3", "H4"]);
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
    if (!KEEP_TAGS.has(tag) && !AS_DIV.has(tag) && tag !== "TFOOT") {
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
    const outTag = AS_DIV.has(tag) ? "div" : tag === "TFOOT" ? "tbody" : tag.toLowerCase();
    const copy = document.createElement(outTag);
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
    if (HEADINGS.has(tag)) {
      const bold = document.createElement("b");
      cleanNode(el, bold);
      copy.appendChild(bold);
    } else {
      cleanNode(el, copy);
    }
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
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [padColor, setPadColor] = useState(content.padColor || NOTE_PAD_COLORS[0].value);
  const [fontFamilyIndex, setFontFamilyIndex] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);

  function currentHtml(): string {
    const editor = editorRef.current;
    if (!editor) return "";
    // A cleared contentEditable leaves a stray <br>; store that as empty.
    if (!editor.innerText.trim() && !editor.querySelector("img, table, ul, ol")) return "";
    return editor.innerHTML;
  }

  function emit() {
    onChange({ html: currentHtml(), padColor });
  }

  function changePad(color: string) {
    setPadColor(color);
    onChange({ html: currentHtml(), padColor: color });
    onFlush();
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  // Same reason as the sticky-note composer: a click outside the
  // contentEditable would blur it and collapse the selection before
  // Bold/Italic/etc. could apply to it.
  // The color picker takes the focus, which drops the text selection; remember it first.
  const savedRange = useRef<Range | null>(null);
  function rememberSelection() {
    const selection = window.getSelection();
    const editor = editorRef.current;
    savedRange.current = selection && selection.rangeCount > 0 && editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  }
  function colorText(hex: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }
    document.execCommand("foreColor", false, hex);
    emit();
  }

  function preserveSelection(e: React.MouseEvent) {
    e.preventDefault();
  }

  // Same approach as the Private Notes composer: a plain DOM insert after
  // the block the caret is in, because execCommand mangles an empty editor.
  function insertChecklistItem() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const item = document.createElement("div");
    item.className = "note-checklist-item";
    item.innerHTML = '<input type="checkbox">&nbsp;';
    const selection = window.getSelection();
    let block: ChildNode | null = selection?.anchorNode && editor.contains(selection.anchorNode) ? (selection.anchorNode as ChildNode) : null;
    while (block && block.parentNode !== editor) block = block.parentNode as ChildNode | null;
    if (block) block.after(item);
    else editor.appendChild(item);
    const range = document.createRange();
    range.selectNodeContents(item);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    emit();
  }

  // Enter on a checklist row starts the next row, like a real list would.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    const anchor = window.getSelection()?.anchorNode;
    const anchorEl = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement);
    if (!anchorEl?.closest(".note-checklist-item")) return;
    e.preventDefault();
    insertChecklistItem();
  }

  // A ticked box only changes the checkbox's live property; the saved HTML
  // needs the attribute, so mirror it before saving.
  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      if (target.checked) target.setAttribute("checked", "");
      else target.removeAttribute("checked");
      emit();
    }
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
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) && !/^[^\s/:]+:\d+/.test(url);
    if (!hasScheme && /^[^\s/]+\.[^\s/]+/.test(url) && !/\s/.test(url)) url = `https://${url}`;
    if (!SAFE_URL.test(url)) {
      setLinkMessage("Links must start with http://, https:// or mailto:");
      return;
    }
    setLinkMessage(null);
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
    // A copied screenshot is raw image bytes with no HTML; shrink it and insert an <img>.
    const imageItem = Array.from(e.clipboardData.items ?? []).find((item) => item.type.startsWith("image/"));
    const imageFile = imageItem?.getAsFile();
    if (imageFile) {
      e.preventDefault();
      const editor = editorRef.current;
      const selection = window.getSelection();
      const saved = selection && selection.rangeCount > 0 && editor?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
      void shrinkImageToDataUrl(imageFile).then((dataUrl) => {
        if (!editor) return;
        editor.focus();
        const img = document.createElement("img");
        img.src = dataUrl;
        const range = saved ?? document.createRange();
        if (!saved) {
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
        emit();
      });
      return;
    }
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
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-1.5 py-1">
        <div className="flex items-center gap-1 border-r pr-1.5">
          {NOTE_PAD_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} pad`}
              onMouseDown={preserveSelection}
              onClick={() => changePad(c.value)}
              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${padColor === c.value ? "border-primary" : "border-border"}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
          <ColorWell title="More pad colors" value={padColor} active={!NOTE_PAD_COLORS.some((c) => c.value === padColor)} onCommit={changePad} />
        </div>
        <Button type="button" variant="ghost" size="icon-sm" title="Bold" onMouseDown={preserveSelection} onClick={() => exec("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Italic" onMouseDown={preserveSelection} onClick={() => exec("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Underline" onMouseDown={preserveSelection} onClick={() => exec("underline")}>
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          title="Font family"
          onMouseDown={preserveSelection}
          onClick={() => {
            const next = (fontFamilyIndex + 1) % FONT_FAMILIES.length;
            setFontFamilyIndex(next);
            exec("fontName", FONT_FAMILIES[next].value || "inherit");
          }}
        >
          {FONT_FAMILIES[fontFamilyIndex].label}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          title="Font size"
          onMouseDown={preserveSelection}
          onClick={() => {
            const next = (fontSizeIndex + 1) % FONT_SIZES.length;
            setFontSizeIndex(next);
            exec("fontSize", FONT_SIZES[next].value);
          }}
        >
          {FONT_SIZES[fontSizeIndex].label}
        </Button>
        <div className="flex items-center gap-1 border-x px-1.5">
          {NOTE_FONT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} text`}
              onMouseDown={preserveSelection}
              onClick={() => exec("foreColor", c.value)}
              className="h-4 w-4 rounded-full border transition-transform hover:scale-110"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <ColorWell title="More text colors" size="h-4 w-4" onBeforeOpen={rememberSelection} onCommit={colorText} />
        </div>
        <Button type="button" variant="ghost" size="icon-sm" title="Bullet list" onMouseDown={preserveSelection} onClick={() => exec("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Checklist" onMouseDown={preserveSelection} onClick={insertChecklistItem}>
          <ListChecks className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Numbered list" onMouseDown={preserveSelection} onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Link" onMouseDown={preserveSelection} onClick={addLink}>
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {linkMessage && (
        <p role="alert" className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {linkMessage}
        </p>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type a note…"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        onInput={emit}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onBlur={onFlush}
        style={{ backgroundColor: padColor, color: "#1a1a1a" }}
        className="note-html min-h-0 w-full flex-1 overflow-auto break-words p-3 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
      />
    </div>
  );
}
