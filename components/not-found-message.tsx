import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/* The friendly "not here" box for a link that points at something removed
   (an old bookmark, a notification about a deleted school, ...). */
export function NotFoundMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-6 w-6" />
      </span>
      <p role="heading" aria-level={2} className="text-lg font-semibold text-balance">{title}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
      <Link href="/overview" className={buttonVariants()}>Go to Overview</Link>
    </div>
  );
}
