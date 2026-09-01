"use client";

import { useState } from "react";
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

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return; }
    window.location.href = "/overview";
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); return; }
    if (!data.session) {
      setMode("signin");
      setMessage("Account created — check your email to confirm it, then sign in here.");
      return;
    }
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
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
