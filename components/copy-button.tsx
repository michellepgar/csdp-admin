"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/* A small icon button that copies `value` to the clipboard, with a
   brief checkmark confirmation. Used next to displayed email
   addresses so they don't need to be selected/copied by hand. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail (permissions, insecure context) --
      // silently no-op rather than show an error for a copy button.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${value}`}
      aria-label={copied ? "Copied" : `Copy ${value}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}
