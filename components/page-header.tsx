/* Every top-level page's title row, unified in one place: sticky so
   it never scrolls out of view, spanning <main>'s full width with no
   gap around it -- <main> itself now carries no padding at all (see
   components/sidebar-shell.tsx), so this just naturally reaches every
   edge instead of needing a negative-margin trick to cancel padding
   that lived elsewhere. Cancels the global h1 rule's own sticky/
   background (see app/globals.css) since this row carries both
   itself, same trick the school page's own custom title row already
   used before this component existed.

   Used to also show the signed-in user's name in the top-right corner
   -- Michelle asked for that, then asked for it removed again.

   pl-12 (rather than matching pr-4/sm:pr-6/md:pr-8 on the left too) is
   a fixed reserve for the floating "show sidebar" button
   (components/sidebar-shell.tsx), which sits fixed at top-4 left-4 --
   z-20, above this bar's z-10 -- only when the sidebar is collapsed
   (desktop) or closed (mobile). Confirmed directly: without this, that
   button's icon sits right on top of the title's first letter.

   h-16 (fixed, not padding-driven) -- Michelle pointed out this
   header and the sidebar's own top corner (components/sidebar.tsx)
   didn't line up; different content (a subtitle on the school page,
   none here) plus padding-based sizing meant each block's actual
   height depended on its own font metrics instead of a shared value.
   Every header block in the app (this one, Overview's, the school
   page's) now uses this same fixed height with its content vertically
   centered inside it, so the sidebar corner lines up with whichever
   page header is showing regardless of page. Was h-20 originally;
   Michelle later said that read as too much empty padding around a
   single line of title text, so every one of these shrank to h-16
   together (keeping them all equal, and equal to the sidebar corner,
   is the part that actually matters here -- not the specific value). */
export function PageHeader({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 flex h-16 items-center bg-header-background pr-4 pl-12 sm:pr-6 md:pr-8">
      <h1 className="static bg-transparent px-0 py-0 text-2xl font-bold">{title}</h1>
    </div>
  );
}
