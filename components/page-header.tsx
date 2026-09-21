/* Every top-level page's title row, unified in one place: sticky just
   under the app's top bar (components/app-top-bar.tsx, h-14) so it never
   scrolls out of view, spanning <main>'s full width with no gap around it
   -- <main> itself carries no padding at all (see
   components/sidebar-shell.tsx), so this naturally reaches every edge.
   Now a plain light row rather than a second teal band: the top bar above
   already carries the brand color, and two stacked teal bars read as one
   heavy block. Cancels the global h1 rule's own sticky/background and
   white text (see app/globals.css) since this row carries the background
   itself, same trick the Overview and school page title rows use.

   h-14 (fixed, not padding-driven) keeps every page's title row the same
   height with its content vertically centered, regardless of whether a
   page has a subtitle. Horizontal padding matches PageBody's, so the
   title lines up with the content beneath it. */
export function PageHeader({ title }: { title: string }) {
  return (
    <div className="sticky top-14 z-10 flex h-14 items-center border-b bg-background px-4 sm:px-6 md:px-8">
      <h1 className="static bg-transparent px-0 py-0 text-foreground">{title}</h1>
    </div>
  );
}
