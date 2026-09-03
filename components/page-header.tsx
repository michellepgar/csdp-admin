/* Every top-level page's title row, unified in one place: the page
   name on the left, the signed-in user's name on the right, sticky so
   neither ever scrolls out of view -- Michelle asked for this to
   match a reference app's header pattern (name in the corner, title
   next to it, "this part doesn't move"). Cancels the global h1 rule's
   own sticky/background (see app/globals.css) since this row carries
   both itself, same trick the school page's own custom title row
   already used before this component existed.

   The negative-margin/padding pairs below cancel out <main>'s own
   left/right padding (components/sidebar-shell.tsx) and re-add the
   same amount as this bar's own padding instead, so the color spans
   truly edge to edge (flush with the sidebar and the browser's right
   edge) instead of floating as an inset rounded box with a visible
   gap around it -- exactly what Michelle pointed out was wrong. Must
   stay in sync with <main>'s own horizontal padding if that changes. */
export function PageHeader({ title, userName }: { title: string; userName: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-header-background px-4 py-3 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <h1 className="static bg-transparent px-0 py-0 text-2xl font-bold">{title}</h1>
      <span className="text-sm font-medium text-muted-foreground">{userName}</span>
    </div>
  );
}
