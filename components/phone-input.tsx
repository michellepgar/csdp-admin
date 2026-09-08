"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/* Formats digits into ###-###-#### as they're typed, capping at 10
   digits -- any other characters (parens, spaces, an existing dash)
   are stripped, so pasting "(508) 894-4440" or "5088944440" both land
   on the same "508-894-4440". */
function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join("-");
}

/* Drop-in replacement for a plain phone-number Input -- same
   name/defaultValue/className props, just self-formatting. Still an
   uncontrolled-from-the-form's-perspective field: the formatted string
   is what actually submits, since this IS the input FormData reads
   from (no separate hidden field needed). */
export function PhoneInput({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue || "");
  return (
    <Input
      type="tel"
      name={name}
      value={value}
      onChange={(e) => setValue(formatPhone(e.target.value))}
      placeholder="Phone Number"
      className={className}
    />
  );
}
