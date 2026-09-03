/* Every top-level page's title row, unified in one place: sticky so
   it never scrolls out of view, background bleeding edge to edge
   (flush with the sidebar and the browser's right edge -- see the
   negative-margin/padding pairs below, which cancel <main>'s own
   left/right padding from components/sidebar-shell.tsx and re-add the
   same amount as this bar's own padding instead; must stay in sync
   with <main>'s own horizontal padding if that changes). Cancels the
   global h1 rule's own sticky/background (see app/globals.css) since
   this row carries both itself, same trick the school page's own
   custom title row already used before this component existed.

   Used to also show the signed-in user's name in the top-right corner
   -- Michelle asked for that, then asked for it removed again. */
export function PageHeader({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-header-background px-4 py-3 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
      <h1 className="static bg-transparent px-0 py-0 text-2xl font-bold">{title}</h1>
    </div>
  );
}
