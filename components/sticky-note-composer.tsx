"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, ListChecks, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/dropdown";
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
export function StickyNoteComposer({ placeholder }: { placeholder: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [padColor, setPadColor] = useState(NOTE_PAD_COLORS[0].value);

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

  // Clears the editor after a successful add -- the surrounding page
  // re-renders via revalidatePath, but this component itself doesn't
  // remount (same DOM node, same key), so without this the last note's
  // formatting would still be sitting in the box.
  useEffect(() => {
    function clearOnSuccessfulSubmit() {
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
    const form = editorRef.current?.closest("form");
    form?.addEventListener("submit", clearOnSuccessfulSubmit);
    return () => form?.removeEventListener("submit", clearOnSuccessfulSubmit);
  }, []);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  // Always starts a fresh line before inserting -- a single
  // execCommand("insertHTML", `<div>...</div>`) call, when the cursor
  // sits mid-line in plain (not-yet-block-wrapped) text, just splices
  // the fragment in inline rather than actually breaking on to its own
  // line -- confirmed directly (checking a checkbox in with existing
  // text produced "textinput type=checkbox>more text", no line break
  // at all). insertParagraph first (the same command Enter itself
  // triggers) guarantees a real block break to insert into.
  function insertLine(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertParagraph");
    document.execCommand("insertHTML", false, html);
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
              className={`h-5 w-5 rounded-full border-2 ${padColor === c.value ? "border-primary" : "border-transparent"}`}
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

        <Dropdown
          name="_fontFamily"
          defaultValue={FONT_FAMILIES[0].value}
          options={FONT_FAMILIES}
          onChange={(v) => exec("fontName", v || "inherit")}
          className="rounded border bg-background px-1.5 py-0.5 text-left text-xs"
        />
        <Dropdown
          name="_fontSize"
          defaultValue={FONT_SIZES[1].value}
          options={FONT_SIZES}
          onChange={(v) => exec("fontSize", v)}
          className="rounded border bg-background px-1.5 py-0.5 text-left text-xs"
        />

        <div className="flex items-center gap-1 border-l pl-1.5">
          {NOTE_FONT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} text`}
              onMouseDown={preserveSelection}
              onClick={() => exec("foreColor", c.value)}
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 border-l pl-1.5">
          <Button type="button" variant="ghost" size="icon-sm" title="Bullet list" onMouseDown={preserveSelection} onClick={() => exec("insertUnorderedList")}>
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Checklist" onMouseDown={preserveSelection} onClick={() => insertLine('<input type="checkbox">&nbsp;')}>
            <ListChecks className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Hyphen list" onMouseDown={preserveSelection} onClick={() => insertLine("- ")}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="min-h-24 w-full rounded-md border p-3 text-sm empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        style={{ backgroundColor: padColor }}
      />
      <input ref={textInputRef} type="hidden" name="text" />
      <input type="hidden" name="padColor" value={padColor} readOnly />
    </div>
  );
}
