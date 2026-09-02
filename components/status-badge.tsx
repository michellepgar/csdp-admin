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
