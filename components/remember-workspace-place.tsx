"use client";

import { useEffect } from "react";
import { rememberOpened } from "@/lib/workspace-last-place";

/* Marks the tab shown in My Workspace as where the sidebar's "My Workspace"
   link should bring you back to. Renders nothing. */
export function RememberWorkspacePlace({ place }: { place: string }) {
  useEffect(() => {
    rememberOpened("workspace", place);
  }, [place]);
  return null;
}
