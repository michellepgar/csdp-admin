import { LayoutDashboard, School, Users, MessageSquarePlus, Megaphone, Lock, Mail, Contact, Clock, ShieldAlert, CheckSquare, AlertTriangle } from "lucide-react";
import Link from "next/link";

export function Sidebar({
  currentName,
  schools,
  isAdmin,
}: {
  currentName: string;
  schools: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  return (
    <aside className="flex w-64 flex-none flex-col border-r bg-background">
      <div className="border-b p-4">
        <div className="text-lg font-bold text-primary">CSDP Tracker</div>
        <div className="mt-1 text-sm text-muted-foreground">{currentName}</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <Link
          href="/overview"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </Link>
        <Link
          href="/private-notes"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Lock className="h-4 w-4" />
          Private Notes
        </Link>
        <Link
          href="/approvals"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <CheckSquare className="h-4 w-4" />
          Approvals
        </Link>
        {isAdmin && (
          <Link
            href="/team"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Users className="h-4 w-4" />
            Team
          </Link>
        )}
        <Link
          href="/issues"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <AlertTriangle className="h-4 w-4" />
          Issues &amp; Concerns
        </Link>
        <Link
          href="/notes"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Megaphone className="h-4 w-4" />
          General Notes
        </Link>
        <Link
          href="/eod"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Clock className="h-4 w-4" />
          EOD Reports
        </Link>
        <Link
          href="/contacts"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Contact className="h-4 w-4" />
          Schools Contact Info
        </Link>
        <Link
          href="/templates"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Mail className="h-4 w-4" />
          Email Templates
        </Link>
        <Link
          href="/suggestions"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Suggestions
        </Link>
        {isAdmin && (
          <Link
            href="/admin-settings"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <ShieldAlert className="h-4 w-4" />
            Backup &amp; School Year
          </Link>
        )}
        <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">
          Schools ({schools.length})
        </div>
        {[...schools].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
          <Link
            key={s.id}
            href={`/schools/${s.id}`}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <School className="h-4 w-4" />
            {s.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
