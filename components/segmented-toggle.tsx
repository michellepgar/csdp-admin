"use client";

import { cn } from "@/lib/utils";

/* A small two-or-more-way switch (Columns / List, Notes / Table). The chosen
   side is a raised, glowing accent chip; the others are quiet until hovered. */
export function SegmentedToggle<T extends string>({ value, onChange, options, className }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="group" className={cn("inline-flex gap-0.5 rounded-xl border border-ring/25 bg-muted/55 p-0.5 shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)]", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[10px] px-3 py-1 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-ring text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_3px_rgb(0_0_0/0.3)] active:bg-ring/80"
                : "text-foreground/70 hover:bg-card/70 hover:text-foreground active:bg-card",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
