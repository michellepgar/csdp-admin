"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared bits of the Quick add popup's panels (components/quick-add-dialog.tsx). */

const CHIP =
  "rounded-full border px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const CHIP_ON =
  "border-ring bg-linear-to-b from-ring to-ring/85 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(0_0_0/0.25)]";
const CHIP_OFF =
  "border-border bg-linear-to-b from-card to-muted/60 text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_1px_rgb(0_0_0/0.06)] hover:border-ring/50 hover:text-foreground";

export const LABEL = "text-xs font-semibold uppercase text-muted-foreground";
export const TEXTAREA = "w-full resize-none rounded-md border px-3 py-2 text-sm";

/* A pill you tick on or off (or, in a group, pick one of). */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

/* What happened on the last Add: anything that failed (with why), then a
   green line for what worked. */
export function Feedback({ errors, added }: { errors: string[]; added: string | null }) {
  return (
    <>
      {errors.length > 0 && (
        <div role="alert" className="space-y-0.5 text-sm text-red-600 dark:text-red-400">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {added && (
        <p role="status" className="flex items-start gap-1.5 rounded-md bg-status-success px-2.5 py-1.5 text-sm text-status-success-foreground">
          <Check className="mt-0.5 h-4 w-4 flex-none" />
          <span className="min-w-0">{added}</span>
        </p>
      )}
    </>
  );
}
