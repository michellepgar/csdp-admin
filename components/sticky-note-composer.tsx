"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionAutocomplete } from "@/components/mention-autocomplete";
import { NOTE_PAD_COLORS, NOTE_FONT_COLORS, type Va } from "@/lib/app-state";
import { shrinkImageToDataUrl } from "@/lib/shrink-image";

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

/* The rich-text body for General Notes/Private Notes -- pad color,
   bold/italic/underline, font family/size/color, bullet/checklist/
   hyphen lists. Renders two hidden inputs (`text`, `padColor`) so the
   surrounding <form action={addGeneralNote|addPrivateNote}> (owned by
   the page, not this component) picks them up as plain FormData same
   as any other field -- a Server Action only ever sees real form
   controls, never a contentEditable div's own live DOM state, so this
   syncs that state into the hidden `text` input right before the form
   actually submits (found via the DOM, not a prop, since the <form>
   tag itself lives one level up in the page component).

   Built on document.execCommand -- yes, formally deprecated, but still
   the only zero-dependency way to get real bold/italic/underline/
   color/font/list editing inside a contentEditable without pulling in
   a full rich-text library (Slate, Lexical, TipTap) for what's meant
   to stay a small sticky-note composer, not a document editor. Every
   major browser (Chrome, Edge, Safari, Firefox) still implements it
   for exactly this case. */
// A draft is just {html, padColor} under its own key -- wrapped in
// try/catch everywhere since localStorage can throw (private
// browsing, disabled site data) and a draft is a convenience, never
// something worth breaking the composer over if it's unavailable.
type Draft = { html: string; padColor: string };

function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function saveDraft(key: string, draft: Draft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // ignore -- see Draft's own comment
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore -- see Draft's own comment
  }
}

// "Empty" used to mean "no innerText" -- true for a genuinely blank
// box, but ALSO true for a note that's nothing but a pasted screenshot
// or a pasted table with no other text in it (an <img>/<table> has no
// innerText of its own). That silently blocked the Add note submit
// entirely (e.preventDefault() with no error shown) and, separately,
// threw away the draft on every keystroke after pasting an
// image-only note. A real note has content if it has EITHER text or
// one of these two elements.
function hasContent(editor: HTMLElement): boolean {
  return !!editor.innerText.trim() || !!editor.querySelector("img, table");
}

export function StickyNoteComposer({
  placeholder,
  defaultText,
  defaultPadColor,
  draftKey,
  vas,
}: {
  placeholder: string;
  /** Team roster for the @mention autocomplete (components/mention-
   *  autocomplete.tsx) -- matches typed @names against real accounts
   *  and renders each suggestion's own avatar color. */
  vas: Va[];
  /** Pre-fills the editor with existing sanitized HTML and starts the
   *  hidden `text` input at that same value -- used when this same
   *  composer is reused to EDIT a note instead of creating a new one
   *  (see general-notes-list.tsx/private-notes-list.tsx's own edit
   *  rows). Only applied once, on mount -- this component's callers
   *  always mount a fresh instance per edit (toggling into/out of
   *  edit remounts it), so there's no "the note changed underneath
   *  it" case to keep in sync with. */
  defaultText?: string;
  defaultPadColor?: string;
  /** Turns on draft persistence -- Michelle asked for the "Add a note"
   *  box specifically to remember what's half-written if you switch
   *  pages before posting it. Saved to localStorage (per browser, not
   *  synced anywhere) under this exact key on every keystroke, loaded
   *  back on mount, and cleared the moment the note is actually
   *  posted. Only passed by the two "Add a note" composers
   *  (app/(app)/notes/page.tsx, app/(app)/private-notes/page.tsx), not
   *  by an EDIT row -- editing an existing note has its own saved
   *  content already; a half-finished edit isn't a "draft" in the
   *  sense Michelle meant, and separately drafting an edit vs. losing
   *  one was never asked for. */
  draftKey?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [padColor, setPadColor] = useState(defaultPadColor || NOTE_PAD_COLORS[0].value);
  const [fontFamilyIndex, setFontFamilyIndex] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(1);

  // contentEditable's own content can't be set via React children/
  // dangerouslySetInnerHTML (React warns about mixing that with
  // contentEditable), so this sets it once, directly, on mount -- a
  // saved draft loses out to defaultText (editing an existing note
  // always wins over a leftover draft, though in practice an edit row
  // never passes draftKey at all, see draftKey's own comment above).
  // The draft itself is only ever read here, inside an effect -- never
  // during render -- since localStorage doesn't exist during this
  // "use client" component's initial SERVER render (Next.js still
  // renders Client Components once on the server for the first HTML,
  // before hydrating); touching it outside an effect would crash that
  // render.
  useEffect(() => {
    if (!editorRef.current) return;
    if (defaultText) {
      editorRef.current.innerHTML = defaultText;
      return;
    }
    const draft = draftKey ? loadDraft(draftKey) : null;
    if (draft?.html) {
      editorRef.current.innerHTML = draft.html;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- A browser-only saved draft restores its companion color after hydration.
      setPadColor(draft.padColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The editor intentionally loads its initial props and draft only once per mount.
  }, []);

  // Saves the draft on every keystroke and pad-color change -- cheap
  // enough for a synchronous localStorage write at note-composing
  // scale, and simpler than debouncing for what's meant to just
  // survive a page navigation, not a rapid-fire save.
  useEffect(() => {
    if (!draftKey) return;
    const editor = editorRef.current;
    if (!editor) return;
    function persist() {
      if (!editor) return;
      const html = editor.innerHTML;
      if (!hasContent(editor)) clearDraft(draftKey!);
      else saveDraft(draftKey!, { html, padColor });
    }
    editor.addEventListener("input", persist);
    return () => editor.removeEventListener("input", persist);
  }, [draftKey, padColor]);

  useEffect(() => {
    const form = editorRef.current?.closest("form");
    if (!form) return;
    function syncBeforeSubmit(e: SubmitEvent) {
      const editor = editorRef.current;
      if (!editor || !hasContent(editor)) {
        e.preventDefault();
        return;
      }
      if (textInputRef.current) {
        textInputRef.current.value = editor.innerHTML;
      }
    }
    form.addEventListener("submit", syncBeforeSubmit);
    return () => form.removeEventListener("submit", syncBeforeSubmit);
  }, []);

  // Clears the editor (and the draft, if any) after a successful add
  // -- the surrounding page re-renders via revalidatePath, but this
  // component itself doesn't remount (same DOM node, same key), so
  // without this the last note's formatting would still be sitting in
  // the box.
  useEffect(() => {
    function clearOnSuccessfulSubmit() {
      if (editorRef.current) editorRef.current.innerHTML = "";
      if (draftKey) clearDraft(draftKey);
    }
    const form = editorRef.current?.closest("form");
    form?.addEventListener("submit", clearOnSuccessfulSubmit);
    return () => form?.removeEventListener("submit", clearOnSuccessfulSubmit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The submit listener is deliberately attached once to this component's owning form.
  }, []);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  // Inserts a new checklist row right after whichever top-level block
  // the cursor is currently in (or appends one if the editor is
  // completely empty). Deliberately plain DOM methods, not
  // execCommand("insertParagraph") -- confirmed directly that on an
  // EMPTY editor, insertParagraph followed by insertHTML produced a
  // malformed nested structure (an empty leading paragraph, then the
  // checklist row wrapped inside ANOTHER div instead of sitting at the
  // top level) rather than one clean row. Walking up to the editor's
  // own direct child and inserting a sibling next to it sidesteps
  // execCommand's block-splitting behavior entirely.
  function insertChecklistItem() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const newItem = document.createElement("div");
    newItem.className = "note-checklist-item";
    newItem.innerHTML = '<input type="checkbox">&nbsp;';

    const selection = window.getSelection();
    let block: ChildNode | null = selection?.anchorNode && editor.contains(selection.anchorNode) ? (selection.anchorNode as ChildNode) : null;
    while (block && block.parentNode !== editor) block = block.parentNode as ChildNode | null;

    if (block) {
      block.after(newItem);
    } else {
      editor.appendChild(newItem);
    }

    const range = document.createRange();
    range.selectNodeContents(newItem);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  // Bullet lists (a real <ul>/<li> from execCommand("insertUnorderedList"))
  // already get this from the browser for free -- Enter inside one
  // creates the next <li> natively, no code of ours involved. A
  // checklist row has no such built-in continuation (it's just a
  // <div> with a checkbox, not a list semantically), so Enter there
  // needs to be caught and handled the same way a real list would --
  // reusing insertChecklistItem() above, which (since checklist rows
  // are always direct children of the editor) lands in the same place
  // whether it's called from here or from the toolbar button.
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    const anchor = window.getSelection()?.anchorNode;
    const anchorEl = anchor && (anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement);
    if (!anchorEl?.closest(".note-checklist-item")) return;

    e.preventDefault();
    insertChecklistItem();
  }

  // Every toolbar control needs this on mousedown (not just its own
  // onClick) -- clicking anything outside the contentEditable blurs it
  // and collapses whatever text was selected there BEFORE the click
  // handler ever runs, so by the time exec()/insertLine() call
  // .focus() again, the selection needed to make Bold/Italic/color
  // etc. apply to the highlighted text is already gone. Confirmed
  // directly: selecting text and clicking Bold left it unformatted
  // without this. preventDefault on mousedown stops the browser from
  // shifting focus away in the first place.
  function preserveSelection(e: React.MouseEvent) {
    e.preventDefault();
  }

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchorRect, setMentionAnchorRect] = useState<DOMRect | null>(null);

  // Unlike a <textarea> (components/issue-comments.tsx), a
  // contentEditable's caret lives in a Selection/Range, not a
  // selectionStart offset -- this reads the text of whichever text
  // node the caret sits in, up to the caret's offset within THAT node,
  // and checks for a trailing @word the same way the textarea version
  // does. getBoundingClientRect() on a COLLAPSED range gives the
  // caret's real on-screen position, which a textarea has no
  // equivalent for -- so unlike the textarea (anchored to the whole
  // textarea's rect), this anchors right at the caret.
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
    // A trailing plain space here gets silently collapsed by the
    // browser's own contentEditable whitespace handling the instant
    // more text is typed right after it -- confirmed directly ("Hi
    // @Jane" + typing more produced "Hi @Janemore", no space at all).
    // A non-breaking space is immune to that collapsing.
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

  // A copied TABLE or LINK (handled by the browser's own default paste
  // -- lib/sanitize-note-html.ts is what keeps those alive on save) is
  // real HTML on the clipboard already. A copied SCREENSHOT is not --
  // it's raw image bytes with no HTML representation at all, and
  // confirmed directly that the browser's default contentEditable
  // paste does nothing visible with it left to itself. This is the
  // one paste case that needs actual code: detect an image clipboard
  // item, read it as a data URL, and insert it as a real <img> at the
  // cursor ourselves. Every other paste (plain text, a copied table,
  // a copied link) still falls through to the browser's own default
  // handling untouched -- this only intercepts when an image is
  // actually present.
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
    // Captured synchronously, before the FileReader's async read --
    // by the time reader.onload fires the selection may have moved
    // (or the editor may have lost focus entirely), so the insertion
    // point has to be locked in now, not read again later.
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted p-1.5">
        <div className="flex items-center gap-1 border-r pr-1.5">
          {NOTE_PAD_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} pad`}
              onMouseDown={preserveSelection}
              onClick={() => setPadColor(c.value)}
              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${padColor === c.value ? "border-primary" : "border-transparent hover:border-muted-foreground/40"}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
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

        {/* Plain click-to-cycle buttons, not the app's own Dropdown --
            Dropdown opens a popup on its OWN click, which (like every
            other click outside the contentEditable) blurs it and
            collapses whatever text was selected there before the
            click handler -- and thus exec("fontName"/"fontSize") --
            ever runs. Confirmed directly: picking a font/size from
            that dropdown silently did nothing. A single button here
            gets the same onMouseDown preventDefault every other
            control already needs, with no intermediate popup click to
            lose the selection on. */}
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

        <div className="flex items-center gap-1 border-l pl-1.5">
          {NOTE_FONT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} text`}
              onMouseDown={preserveSelection}
              onClick={() => exec("foreColor", c.value)}
              className="h-4 w-4 rounded-full border transition-transform hover:scale-110 hover:border-muted-foreground/40"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 border-l pl-1.5">
          <Button type="button" variant="ghost" size="icon-sm" title="Bullet list" onMouseDown={preserveSelection} onClick={() => exec("insertUnorderedList")}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Checklist"
            onMouseDown={preserveSelection}
            onClick={insertChecklistItem}
          >
            <ListChecks className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onInput={detectMention}
        onKeyUp={detectMention}
        onClick={detectMention}
        onBlur={() => setMentionQuery(null)}
        // [&_ul]/[&_ol] -- the app's own CSS reset otherwise zeroes
        // out list-style/padding on every <ul>/<li> globally, so a
        // Bullet list click looked like it did nothing while actually
        // typing (the list existed in the DOM, just with no visible
        // marker). Matches the same override the rendered note itself
        // uses (general-notes-list.tsx/private-notes-list.tsx).
        // .note-checklist-item is defined in globals.css (its indent
        // and checkbox alignment).
        className="note-html min-h-24 w-full overflow-x-auto rounded-md border p-3 text-sm empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-1 [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:p-1 [&_a]:text-primary [&_a]:underline [&_img]:my-1 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded"
        style={{ backgroundColor: padColor }}
      />
      <MentionAutocomplete query={mentionQuery} anchorRect={mentionAnchorRect} vas={vas} onSelect={selectMention} onClose={() => setMentionQuery(null)} />
      <input ref={textInputRef} type="hidden" name="text" />
      <input type="hidden" name="padColor" value={padColor} readOnly />
    </div>
  );
}
