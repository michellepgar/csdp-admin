"use client";

import { useEffect } from "react";

/* Scrolls a private note into view and flashes it briefly, for when you arrive
   from the top bar's note search (?highlightNote=). Works for a note in the
   list or on the pinboard -- both carry data-private-note-id. */
export function NoteFocus({ id }: { id?: string }) {
  useEffect(() => {
    if (!id) return;
    const el = document.querySelector(`[data-private-note-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const scroll = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("task-highlight-flash");
    }, 150);
    const clear = setTimeout(() => el.classList.remove("task-highlight-flash"), 2200);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [id]);
  return null;
}
