"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* Route-level error boundary -- catches a page crashing while
   rendering (a bad fetch, an unexpected null, etc.) instead of
   showing Next.js's own bare crash screen. Michelle asked that any
   in-app error message say "contact admin" rather than naming her
   specifically, matching the same wording now used on
   app/not-on-team/page.tsx. `reset()` (from Next.js) just re-renders
   this route's tree again, which is enough for anything transient
   (a dropped network request, a one-off timeout).

   Shows `error.message` when there is one, rather than always the
   generic line -- every `throw new Error(...)` in this app is
   developer-authored, human-readable text ("Not authorized", "This is
   a demo account — changes aren't saved", etc.), not a raw exception
   or anything a user typed, so it's safe and actually useful to show
   directly. Confirmed directly: without this, the demo account's own
   friendly "changes aren't saved" message was being silently replaced
   by this generic one, indistinguishable from a real bug. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message
              ? error.message
              : "This page ran into a problem loading. Try again, and if it keeps happening, contact admin."}
          </p>
          <Button className="w-full" onClick={() => reset()}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
