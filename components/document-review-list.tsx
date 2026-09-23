"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { CopyButton } from "@/components/copy-button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CollapsibleSection } from "@/components/collapsible-section";
import { StatusBadge } from "@/components/status-badge";
import {
  copyAllText,
  lowConfidenceCount,
  type DocumentExtraction,
  type DocumentExtractionField,
  type DocumentExtractionStatus,
} from "@/lib/document-extractions";

const STATUS_TABS: { value: DocumentExtractionStatus; label: string }[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "encoded", label: "Encoded" },
  { value: "rejected", label: "Rejected" },
];

function fmtDate(iso: string) {
  // Same explicit America/New_York timeZone every other date-rendering
  // component in this app uses (see components/issues-list.tsx's own
  // fmtDate) -- avoids a server/client hydration mismatch across the
  // day boundary.
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "America/New_York" });
}

function ImportPanel({ importDocumentExtractions }: {
  importDocumentExtractions: (formData: FormData) => Promise<{ error: string | null; imported: number }>;
}) {
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <CollapsibleSection title="Paste from agent" initialCollapsed={false} cookieName="my-workspace-import-collapsed">
      <form
        action={async (formData) => {
          setError(null);
          setMessage(null);
          const result = await importDocumentExtractions(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setJson("");
          setMessage(`Imported ${result.imported} document${result.imported === 1 ? "" : "s"}.`);
        }}
        className="space-y-2"
      >
        <textarea
          name="json"
          value={json}
          onChange={(event) => setJson(event.target.value)}
          placeholder="Paste the agent's JSON output here"
          rows={8}
          required
          className="w-full rounded-md border bg-card p-2 font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
          {message && <p className="text-sm text-status-success-foreground">{message}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-status-danger-foreground">{error}</p>}
      </form>
    </CollapsibleSection>
  );
}

function FieldRow({ entryId, field, index, updateDocumentExtractionField }: {
  entryId: string;
  field: DocumentExtractionField;
  index: number;
  updateDocumentExtractionField: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [value, setValue] = useState(field.value);
  const [error, setError] = useState<string | null>(null);
  const low = field.confidence !== "high";

  useEffect(() => {
    setValue(field.value);
  }, [field.value]);

  async function save() {
    if (value === field.value) return;
    const formData = new FormData();
    formData.set("id", entryId);
    formData.set("fieldIndex", String(index));
    formData.set("value", value);
    const result = await updateDocumentExtractionField(formData);
    setError(result.error);
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md p-2 ${low ? "bg-status-warning/20" : "bg-record-background"}`}>
      <span className="w-40 shrink-0 text-sm font-medium">{field.label}</span>
      <Input value={value} onChange={(event) => setValue(event.target.value)} onBlur={save} className="min-w-40 flex-1" />
      <span className={`text-xs ${low ? "text-status-warning-foreground" : "text-muted-foreground"}`}>{field.confidence}</span>
      <CopyButton value={value} />
      {field.note && <span className="w-full text-xs text-muted-foreground">{field.note}</span>}
      {error && <p role="alert" className="w-full text-xs text-status-danger-foreground">{error}</p>}
    </div>
  );
}

function ReviewPanel({ entry, setDocumentExtractionStatus, updateDocumentExtractionField, removeDocumentExtraction, onClose }: {
  entry: DocumentExtraction;
  setDocumentExtractionStatus: (formData: FormData) => Promise<{ error: string | null }>;
  updateDocumentExtractionField: (formData: FormData) => Promise<{ error: string | null }>;
  removeDocumentExtraction: (formData: FormData) => void;
  onClose: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function setStatus(status: DocumentExtractionStatus, reason?: string) {
    setStatusError(null);
    const formData = new FormData();
    formData.set("id", entry.id);
    formData.set("status", status);
    if (reason) formData.set("rejectionReason", reason);
    const result = await setDocumentExtractionStatus(formData);
    if (result.error) {
      setStatusError(result.error);
      return;
    }
    onClose();
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(copyAllText(entry.fields));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // Clipboard API can fail (permissions, insecure context) -- same
      // silent no-op components/copy-button.tsx already uses.
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-3">
      {entry.summary && <p className="text-sm">{entry.summary}</p>}
      {entry.flags.length > 0 && (
        <div className="space-y-1 rounded-md bg-status-warning/20 p-2 text-sm text-status-warning-foreground">
          {entry.flags.map((flag, index) => <p key={index}>⚠ {flag}</p>)}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={copyAll}>{copiedAll ? "Copied!" : "Copy all"}</Button>
      </div>
      <div className="space-y-1.5">
        {entry.fields.map((field, index) => (
          <FieldRow key={index} entryId={entry.id} field={field} index={index} updateDocumentExtractionField={updateDocumentExtractionField} />
        ))}
      </div>
      {rejecting ? (
        <div className="space-y-2 rounded-md border p-2">
          <Input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Reason (optional)" />
          <div className="flex gap-2">
            <Button type="button" variant="destructive" size="sm" onClick={() => setStatus("rejected", rejectionReason)}>Confirm reject</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {entry.status !== "approved" && <Button type="button" size="sm" onClick={() => setStatus("approved")}>Approve</Button>}
          {entry.status !== "encoded" && <Button type="button" size="sm" variant="outline" onClick={() => setStatus("encoded")}>Mark as encoded</Button>}
          {entry.status !== "rejected" && <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(true)}>Reject</Button>}
          <form action={removeDocumentExtraction}>
            <input type="hidden" name="id" value={entry.id} />
            <ConfirmDeleteButton confirmMessage={`Delete "${entry.documentName}"? This can't be undone.`} pendingLabel="…">Delete</ConfirmDeleteButton>
          </form>
        </div>
      )}
      {statusError && <p role="alert" className="text-sm text-status-danger-foreground">{statusError}</p>}
    </div>
  );
}

export function DocumentReviewList({ entries, importDocumentExtractions, updateDocumentExtractionField, setDocumentExtractionStatus, removeDocumentExtraction }: {
  entries: DocumentExtraction[];
  importDocumentExtractions: (formData: FormData) => Promise<{ error: string | null; imported: number }>;
  updateDocumentExtractionField: (formData: FormData) => Promise<{ error: string | null }>;
  setDocumentExtractionStatus: (formData: FormData) => Promise<{ error: string | null }>;
  removeDocumentExtraction: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<DocumentExtractionStatus>("pending_review");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = Object.fromEntries(
    STATUS_TABS.map((t) => [t.value, entries.filter((entry) => entry.status === t.value).length]),
  ) as Record<DocumentExtractionStatus, number>;
  const shown = entries.filter((entry) => entry.status === tab);

  return (
    <div className="space-y-4">
      <ImportPanel importDocumentExtractions={importDocumentExtractions} />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value}
            type="button"
            size="sm"
            variant={tab === t.value ? "default" : "outline"}
            onClick={() => { setTab(t.value); setExpandedId(null); }}
          >
            {t.label} {counts[t.value] > 0 && <span className="ml-1 text-xs opacity-80">{counts[t.value]}</span>}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((entry) => {
            const flagged = lowConfidenceCount(entry.fields) + entry.flags.length;
            return (
              <div key={entry.id} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                  aria-expanded={expandedId === entry.id}
                  className="flex w-full flex-wrap items-center gap-2 bg-record-background p-3 text-left text-sm"
                >
                  <span className="font-medium">{entry.documentName}</span>
                  <span className="text-muted-foreground">{entry.documentType}</span>
                  {entry.school && <span className="text-muted-foreground">{entry.school}</span>}
                  <span className="text-xs text-muted-foreground">{fmtDate(entry.createdAt)}</span>
                  {flagged > 0 && <StatusBadge tone="warning">{flagged} to check</StatusBadge>}
                </button>
                {expandedId === entry.id && (
                  <div className="border-t p-2">
                    <ReviewPanel
                      entry={entry}
                      setDocumentExtractionStatus={setDocumentExtractionStatus}
                      updateDocumentExtractionField={updateDocumentExtractionField}
                      removeDocumentExtraction={removeDocumentExtraction}
                      onClose={() => setExpandedId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
