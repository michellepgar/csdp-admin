"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRecoveryError, isPasswordRecoveryEvent, scheduleLoginRedirect, updatePassword } from "@/lib/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingRecoverySession, setIsCheckingRecoverySession] = useState(true);

  useEffect(() => {
    const recoveryError = getRecoveryError(window.location.hash);
    if (recoveryError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The recovery error exists only in the browser URL after hydration.
      setError(recoveryError);
      setIsCheckingRecoverySession(false);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return;
    }

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isPasswordRecoveryEvent(event, session)) setHasRecoverySession(true);
      if (event === "PASSWORD_RECOVERY" || event === "INITIAL_SESSION") setIsCheckingRecoverySession(false);
    });

    supabase.auth.getSession().then(() => {
      setIsCheckingRecoverySession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!hasRecoverySession) {
      setError("This password-reset link is invalid or has expired. Request a new link from the sign-in page.");
      return;
    }

    const supabase = createClient();
    const result = await updatePassword(
      (attributes) => supabase.auth.updateUser(attributes),
      password,
      confirmation,
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage("Password reset successful. Redirecting you to sign in…");
    setPassword("");
    setConfirmation("");
    scheduleLoginRedirect(
      (callback, delay) => window.setTimeout(callback, delay),
      () => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Auth state is intentionally reloaded before returning to sign in.
        window.location.href = "/login";
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmation">Confirm new password</Label>
              <Input id="confirmation" type="password" required minLength={6} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={!hasRecoverySession}>
              {isCheckingRecoverySession ? "Verifying reset link…" : "Update password"}
            </Button>
            {!isCheckingRecoverySession && !hasRecoverySession && !error && (
              <p className="text-sm text-destructive">This password-reset link is invalid or has expired. Request a new link from the sign-in page.</p>
            )}
            <Button type="button" variant="link" className="w-full" onClick={() => {
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Auth state is intentionally reloaded before returning to sign in.
              window.location.href = "/login";
            }}>
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
