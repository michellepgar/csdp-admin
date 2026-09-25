/* Shown the moment you click to another page, while that page's data loads
   (the sidebar and top bar stay put). Shaped like a typical page -- a title
   row, then a few cards -- so the switch feels immediate instead of stuck. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading page">
      <div className="sticky top-14 z-10 flex h-14 items-center border-b bg-background px-4 sm:px-6 md:px-8">
        <div className="h-5 w-44 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-6 p-4 sm:p-6 md:p-8">
        {[0, 1, 2].map((card) => (
          <div key={card} className="overflow-hidden rounded-md border bg-card shadow-sm">
            <div className="h-10 animate-pulse bg-title-background/70" />
            <div className="space-y-2.5 p-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
