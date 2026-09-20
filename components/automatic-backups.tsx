"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, DatabaseBackup, Download, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backupHealth, BACKUPS_TO_KEEP, formatBackupSize } from "@/lib/backup-schedule";
import { cn } from "@/lib/utils";

export interface BackupFile {
  /** e.g. "2026-09-20.json" */
  name: string;
  size: number;
  /** When the file was written. */
  updatedAt: string;
}

const TZ = "America/New_York";

function dayLabel(name: string): { chip: string; long: string } {
  const [y, m, d] = name.replace(".json", "").split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  const key = name.replace(".json", "");
  return {
    chip: key === today ? "Today" : key === yesterday ? "Yesterday" : date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
    long: date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  };
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

/* The "Automatic backups" panel on the Backup page: is the nightly backup
   healthy, the kept files (newest 14) with a download button each, a "Back up
   now" button, and -- until the two server settings exist -- the exact
   setup steps. The list itself is read on the server (page.tsx); this
   component only handles the buttons. */
export function AutomaticBackups({
  files,
  missingEnv,
  demo,
  backUpNow,
  getDownloadUrl,
}: {
  files: BackupFile[];
  missingEnv: string[];
  demo: boolean;
  backUpNow: () => Promise<{ error: string | null }>;
  getDownloadUrl: (name: string) => Promise<{ url: string | null; error: string | null }>;
}) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const latest = files[0];
  const health = backupHealth(latest?.updatedAt);
  const notSetUp = !demo && missingEnv.length > 0;

  async function run() {
    setRunning(true);
    setMessage(null);
    const result = await backUpNow();
    setRunning(false);
    setMessage(result.error ? { text: result.error, ok: false } : { text: "Backup saved.", ok: true });
  }

  async function download(name: string) {
    setDownloading(name);
    const result = await getDownloadUrl(name);
    setDownloading(null);
    if (!result.url) {
      setMessage({ text: result.error ?? "Couldn't download that backup.", ok: false });
      return;
    }
    const link = document.createElement("a");
    link.href = result.url;
    link.download = `csdp-tracker-backup-${name}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const banner = notSetUp
    ? {
        tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
        chip: "bg-amber-500 text-white",
        icon: <KeyRound className="h-5 w-5" />,
        title: "Almost there — two quick settings to finish setup",
        detail: "The nightly backup can't run until they're added in Vercel.",
      }
    : health === "ok"
      ? {
          tone: "border-green-300 bg-green-50 text-green-900 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-100",
          chip: "bg-green-600 text-white",
          icon: <CheckCircle2 className="h-5 w-5" />,
          title: `Last backup: ${dayLabel(latest.name).long}, ${timeLabel(latest.updatedAt)}`,
          detail: `${formatBackupSize(latest.size)} · everything looks good.`,
        }
      : health === "stale"
        ? {
            tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100",
            chip: "bg-red-600 text-white",
            icon: <AlertTriangle className="h-5 w-5" />,
            title: `No new backup since ${dayLabel(latest.name).long}`,
            detail: "The nightly job may have stopped. Press Back up now, and if it fails, check the setup.",
          }
        : {
            tone: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100",
            chip: "bg-sky-600 text-white",
            icon: <DatabaseBackup className="h-5 w-5" />,
            title: "No automatic backup yet",
            detail: "The first one runs tonight, or press Back up now to make one immediately.",
          };

  return (
    <section className="overflow-hidden rounded-xl border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 bg-header-background px-4 py-3 text-white">
        <ShieldCheck className="h-5 w-5" />
        <h2 className="static bg-transparent px-0 py-0 text-base font-semibold text-white">Automatic backups</h2>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">Every night · newest {BACKUPS_TO_KEEP} kept</span>
        {demo && <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-amber-950">Demo sample</span>}
      </div>

      <div className="space-y-4 p-4">
        <div className={cn("flex items-start gap-3 rounded-xl border p-3", banner.tone)}>
          <span className={cn("flex h-10 w-10 flex-none items-center justify-center rounded-full shadow-sm", banner.chip)}>{banner.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{banner.title}</p>
            <p className="text-xs opacity-90">{banner.detail}</p>
          </div>
        </div>

        {notSetUp && (
          <ol className="list-decimal space-y-2 rounded-lg border bg-muted/30 p-3 pl-8 text-sm">
            <li>
              In <strong>Supabase</strong>, open Project Settings, then API keys, and copy the secret <code className="rounded bg-muted px-1">service_role</code> key.
            </li>
            <li>
              In <strong>Vercel</strong>, open this project, then Settings, then Environment Variables. Add{" "}
              {missingEnv.map((name, index) => (
                <span key={name}>
                  {index > 0 && " and "}
                  <code className="rounded bg-muted px-1 font-semibold">{name}</code>
                </span>
              ))}{" "}
              for Production. For <code className="rounded bg-muted px-1">CRON_SECRET</code>, type any long random text (at least 32 characters). For{" "}
              <code className="rounded bg-muted px-1">SUPABASE_SERVICE_ROLE_KEY</code>, paste the key from step 1.
            </li>
            <li>Redeploy the site. This page then turns green after the first backup runs.</li>
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void run()} disabled={running || notSetUp}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? "Backing up…" : "Back up now"}
          </Button>
          {message && (
            <span role="status" className={cn("text-sm font-medium", message.ok ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-400")}>
              {message.text}
            </span>
          )}
        </div>

        {files.length > 0 && (
          <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border bg-background">
            {files.map((file, index) => {
              const label = dayLabel(file.name);
              return (
                <li key={file.name} className="flex items-center gap-3 border-l-4 border-l-transparent px-3 py-2.5 transition-colors hover:border-l-primary hover:bg-primary/5">
                  <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-[10px] font-semibold leading-none">{label.chip}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{label.long}</span>
                    <span className="block text-xs text-muted-foreground">{timeLabel(file.updatedAt)}</span>
                  </span>
                  {index === 0 && <span className="hidden rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 sm:inline dark:bg-green-500/20 dark:text-green-200">Latest</span>}
                  <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{formatBackupSize(file.size)}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void download(file.name)} disabled={downloading === file.name} aria-label={`Download the backup from ${label.long}`}>
                    {downloading === file.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong>Private Notes are not in automatic backups</strong>, so nobody (admins included) can read them from a backup file, and restoring one leaves
          everyone&apos;s private notes as they are. To restore, download a backup and use the restore form below. Downloading a backup yourself
          (above) still includes the private notes you can see.
        </p>
      </div>
    </section>
  );
}
