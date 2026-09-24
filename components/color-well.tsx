"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/* "More colors": a rainbow circle that opens the browser's full color picker
   (the same one the Team page uses), shown next to a row of preset swatches.
   The color is applied once, when the picker closes -- not on every step of
   dragging around inside it. `onBeforeOpen` runs just before the picker takes
   the focus (a note uses it to remember which words were selected). */
export function ColorWell({
  value,
  title,
  active = false,
  size = "h-5 w-5",
  onCommit,
  onBeforeOpen,
}: {
  /** The color the picker starts on. */
  value?: string;
  title: string;
  /** Ringed when the current color is a custom one (not one of the swatches). */
  active?: boolean;
  size?: string;
  onCommit: (hex: string) => void;
  onBeforeOpen?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  useLayoutEffect(() => {
    commit.current = onCommit;
  });

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // React's onChange fires on every movement inside the picker; the native "change" fires once it closes.
    const onChange = () => commit.current(input.value.toUpperCase());
    input.addEventListener("change", onChange);
    return () => input.removeEventListener("change", onChange);
  }, []);

  return (
    <span
      title={title}
      onMouseDown={onBeforeOpen}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 ${size} ${active ? "border-primary" : "border-border"}`}
      style={{ background: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)" }}
    >
      <input
        ref={inputRef}
        type="color"
        aria-label={title}
        defaultValue={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#4F46E5"}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
      />
    </span>
  );
}
