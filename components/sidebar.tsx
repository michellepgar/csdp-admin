import { LayoutDashboard, School, Users, MessageSquarePlus, Megaphone, Lock, Mail, Contact } from "lucide-react";
import Link from "next/link";

export function Sidebar({
  currentName,
  schoolNames,
  isAdmin,
}: {
  currentName: string;
  schoolNames: string[];
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
          href="/notes"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Megaphone className="h-4 w-4" />
          General Notes
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
        <div className="mt-4 px-3 text-xs font-semibold uppercase text-muted-foreground">
          Schools ({schoolNames.length})
        </div>
        {schoolNames.map((name) => (
          <div key={name} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground">
            <School className="h-4 w-4" />
            {name}
          </div>
        ))}
      </nav>
    </aside>
  );
}
