"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/* Cycles between light and dark. Defaults to the OS/browser
   preference (via the root ThemeProvider's defaultTheme="system")
   until someone clicks this, at which point their explicit choice
   persists in localStorage via next-themes. Rendering is deferred
   until mount (`mounted` guard) because the server can't know the
   visitor's OS theme, so rendering the wrong icon before hydration
   would cause a flash/mismatch. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button type="button" variant="ghost" size="icon-sm" aria-label="Toggle theme" disabled />;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
