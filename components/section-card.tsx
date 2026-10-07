import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* The app's standard section: a raised card with a teal header strip (an
   icon chip, the title, an optional count, optional controls on the right)
   over its content. Pages that used to put a bare form or list straight on
   the page use this so every page looks finished, like Overview. The title
   is a role="heading" paragraph, not an <h2>, because the global h2 style
   would add a second teal bar. */
export function SectionCard({
  icon,
  title,
  count,
  right,
  children,
  className,
  bodyClassName,
}: {
  icon: ReactNode;
  title: ReactNode;
  count?: number;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-record-background no-record-hover shadow-sm", className)}>
      <div className="flex flex-wrap items-center gap-2.5 bg-header-background px-4 py-2.5 text-white">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-white/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
          {icon}
        </span>
        <p role="heading" aria-level={2} className="text-sm font-semibold">{title}</p>
        {count !== undefined && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">{count}</span>}
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      <div className={cn("space-y-3 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/* A friendly empty state for a section with nothing in it yet. */
export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 [&_svg]:h-5 [&_svg]:w-5" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
