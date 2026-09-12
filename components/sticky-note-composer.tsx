"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTE_PAD_COLORS, NOTE_FONT_COLORS } from "@/lib/app-state";

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

export function StickyNoteComposer({
  placeholder,
  defaultText,
  defaultPadColor,
  draftKey,
}: {
  placeholder: string;
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
      setPadColor(draft.padColor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!editor.innerText.trim()) clearDraft(draftKey!);
      else saveDraft(draftKey!, { html, padColor });
    }
    editor.addEventListener("input", persist);
    return () => editor.removeEventListener("input", persist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, padColor]);

  useEffect(() => {
    const form = editorRef.current?.closest("form");
    if (!form) return;
    function syncBeforeSubmit(e: SubmitEvent) {
      const isEmpty = !editorRef.current?.innerText.trim();
      if (isEmpty) {
        e.preventDefault();
        return;
      }
      if (textInputRef.current && editorRef.current) {
        textInputRef.current.value = editorRef.current.innerHTML;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // [&_ul]/[&_ol] -- the app's own CSS reset otherwise zeroes
        // out list-style/padding on every <ul>/<li> globally, so a
        // Bullet list click looked like it did nothing while actually
        // typing (the list existed in the DOM, just with no visible
        // marker). Matches the same override the rendered note itself
        // uses (general-notes-list.tsx/private-notes-list.tsx).
        // .note-checklist-item is defined in globals.css (its indent
        // and checkbox alignment).
        className="min-h-24 w-full rounded-md border p-3 text-sm empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        style={{ backgroundColor: padColor }}
      />
      <input ref={textInputRef} type="hidden" name="text" />
      <input type="hidden" name="padColor" value={padColor} readOnly />
    </div>
  );
}
