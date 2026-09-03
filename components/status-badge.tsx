export type StatusTone = "neutral" | "success" | "warning" | "danger" | "paused";

// Exported so a status <select> itself can be colored directly (e.g.
// tasks-card.tsx, email-tracker-card.tsx) instead of pairing it with a
// separate read-only StatusBadge showing the same value twice.
export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-status-neutral text-status-neutral-foreground",
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
  paused: "bg-status-paused text-status-paused-foreground",
};

// Same colors as TONE_CLASSES, as inline styles instead of Tailwind
// classes -- for a status <select>'s individual <option> elements.
// Browsers are notoriously inconsistent about an <option> inheriting
// `color`/`background-color` from its parent <select> once the
// browser's native dark popup styling (color-scheme: dark) is active;
// setting both explicitly on every <option> itself is the reliable
// fix (this is why a colored status dropdown's closed box looked
// right in dark mode, but its opened list showed unreadable
// dark-on-dark text everywhere except under the mouse's hover
// highlight).
export const TONE_OPTION_STYLE: Record<StatusTone, React.CSSProperties> = {
  neutral: { backgroundColor: "var(--status-neutral)", color: "var(--status-neutral-foreground)" },
  success: { backgroundColor: "var(--status-success)", color: "var(--status-success-foreground)" },
  warning: { backgroundColor: "var(--status-warning)", color: "var(--status-warning-foreground)" },
  danger: { backgroundColor: "var(--status-danger)", color: "var(--status-danger-foreground)" },
  paused: { backgroundColor: "var(--status-paused)", color: "var(--status-paused-foreground)" },
};

// A colored pill for a status or severity value (e.g. "Pending",
// "Resolved", "Working On It"). `tone` picks which semantic color
// token pair to use — see the four status/foreground CSS custom
// property pairs in app/globals.css. Purely presentational: callers
// decide what tone a given status value maps to.
export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
