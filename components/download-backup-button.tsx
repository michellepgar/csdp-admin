"use client";

import { Button } from "@/components/ui/button";
import type { AppState } from "@/lib/app-state";

export function DownloadBackupButton({ state }: { state: AppState }) {
  function handleDownload() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `csdp-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return <Button type="button" onClick={handleDownload}>⬇ Download Backup</Button>;
}
