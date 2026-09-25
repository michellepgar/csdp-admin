import Link from "next/link";
import { BookOpen, Lock } from "lucide-react";
import { PRIVATE_NOTES_HREF } from "@/lib/workspace-last-place";

/* My Workspace's two tabs: your workbooks, and your Private Notes. */
export function WorkspaceTabs({ active, notesAlert }: { active: "workbooks" | "notes"; notesAlert?: boolean }) {
  const tab = (isActive: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
    }`;
  return (
    <nav aria-label="My Workspace" className="inline-flex gap-1 rounded-lg border bg-muted/60 p-1">
      <Link href="/my-workspace" prefetch={false} aria-current={active === "workbooks" ? "page" : undefined} className={tab(active === "workbooks")}>
        <BookOpen className="h-4 w-4 text-primary" /> Workbooks
      </Link>
      <Link href={PRIVATE_NOTES_HREF} prefetch={false} aria-current={active === "notes" ? "page" : undefined} className={tab(active === "notes")}>
        <span className="relative">
          <Lock className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          {notesAlert && <span className="nav-alert-dot absolute -right-1 -top-1 h-2 w-2 rounded-full bg-status-danger-foreground" title="A note was shared with you -- open it to clear this" />}
        </span>
        Private Notes
      </Link>
    </nav>
  );
}
