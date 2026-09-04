"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [resent, setResent] = useState(false);

  /* Supabase redirects a confirmation/reset link straight back here
     with the outcome in the URL's hash fragment (not a normal query
     param) -- an expired/already-used link lands as
     #error=access_denied&error_code=otp_expired&error_description=...
     with no page of ours in between to show something friendlier.
     Turn that into a plain message + a way to actually recover
     (request a new link) instead of leaving a raw error hash in the
     address bar. */
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("error=")) return;
    const params = new URLSearchParams(hash.slice(1));
    const code = params.get("error_code");
    const description = params.get("error_description");
    if (code === "otp_expired") {
      setError("That link expired before it was clicked. Enter your email below and request a new one.");
      setCanResend(true);
    } else if (description) {
      setError(description.replace(/\+/g, " "));
    }
    // Clear the hash so refreshing/sharing the URL doesn't repeat this.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCanResend(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      if (error.message.toLowerCase().includes("email not confirmed")) setCanResend(true);
      return;
    }
    window.location.href = "/overview";
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCanResend(false);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      if (error.message.toLowerCase().includes("already registered")) {
        setCanResend(true);
        setError("An account already exists for this email but isn't confirmed yet. Request a new confirmation link below.");
      }
      return;
    }
    if (!data.session) {
      setMode("signin");
      setMessage("Account created — check your email to confirm it, then sign in here.");
      return;
    }
    window.location.href = "/overview";
  }

  async function handleResendConfirmation() {
    setError(null);
    setResent(false);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) { setError(error.message); return; }
    setCanResend(false);
    setResent(true);
    setMessage("Confirmation email sent — check your inbox (and spam folder), then click it right away before it expires.");
  }

  /* No real Supabase session here on purpose -- just a cookie flag that
     getCurrentUser()/fetchAppState()/proxy.ts/the (app) layout all check
     for and short-circuit to a fake "Jane" user + made-up sample data
     (lib/demo-app-state.ts) instead of ever touching the real database.
     30-day expiry is arbitrary -- long enough that closing the tab and
     coming back doesn't drop someone mid-tour, short enough it doesn't
     linger forever if they never explicitly leave (signing out clears it
     too, see components/sign-out-button.tsx). */
  function startDemo() {
    document.cookie = "demo-mode=1; path=/; max-age=2592000; samesite=lax";
    window.location.href = "/overview";
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); return; }
    setMode("signin");
    setMessage("Check your email for a password reset link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>CSDP Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">Send reset link</Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setMode("signin")}>
                Back to sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={mode === "signup" ? handleSignUp : handleSignIn} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full">
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
              {canResend && (
                <Button type="button" variant="outline" className="w-full" onClick={handleResendConfirmation}>
                  Resend confirmation email
                </Button>
              )}
              {mode === "signin" && (
                <Button type="button" variant="link" className="w-full" onClick={() => setMode("forgot")}>
                  Forgot your password?
                </Button>
              )}
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
              </Button>
              {mode === "signin" && (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    or
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={startDemo}>
                    Not ready to create an account? See a demo
                  </Button>
                </>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
