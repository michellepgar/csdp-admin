"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotOnTeamPage() {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>You&apos;re signed in, but...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your email isn&apos;t on the team list yet. Ask Michelle to add it on the Team page, then try again.
          </p>
          <Button className="w-full" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
