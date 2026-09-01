"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmailTemplate } from "@/lib/app-state";

function TemplateForm({
  template,
  onCancel,
  saveTemplate,
}: {
  template: EmailTemplate | null;
  onCancel: () => void;
  saveTemplate: (formData: FormData) => void;
}) {
  return (
    <form action={saveTemplate} className="space-y-2 rounded-md border p-3">
      <input type="hidden" name="id" value={template ? template.id : "new"} />
      <div className="flex gap-2">
        <Input name="name" placeholder="Template name" defaultValue={template?.name || ""} required />
        <Input name="category" placeholder="Category (optional)" defaultValue={template?.category || ""} />
      </div>
      <Input name="subject" placeholder="Subject line" defaultValue={template?.subject || ""} required />
      <textarea
        name="body"
        placeholder="Email body… use {{placeholders}} as needed"
        defaultValue={template?.body || ""}
        rows={6}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export function TemplatesList({
  templates,
  saveTemplate,
  removeTemplate,
}: {
  templates: EmailTemplate[];
  saveTemplate: (formData: FormData) => void;
  removeTemplate: (formData: FormData) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyTemplate(t: EmailTemplate) {
    try {
      await navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${t.body}`);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId((id) => (id === t.id ? null : id)), 1500);
    } catch {
      // Clipboard access can be denied by the browser — nothing to do
      // beyond just not showing the "Copied" confirmation.
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => setEditingId(editingId === "new" ? null : "new")}
      >
        {editingId === "new" ? "Cancel" : "+ New template"}
      </Button>

      {editingId === "new" && (
        <TemplateForm template={null} onCancel={() => setEditingId(null)} saveTemplate={saveTemplate} />
      )}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">No templates yet. Add one to build the shared library.</p>
      )}

      {templates.map((t) => {
        const isOpen = openId === t.id;
        const isEditing = editingId === t.id;
        return (
          <div key={t.id} className="rounded-md border">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : t.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
            >
              <span>
                {t.name}
                {t.category && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{t.category}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{isOpen ? "Collapse" : "View"}</span>
            </button>

            {isEditing ? (
              <div className="border-t p-3">
                <TemplateForm template={t} onCancel={() => setEditingId(null)} saveTemplate={saveTemplate} />
              </div>
            ) : isOpen ? (
              <div className="space-y-2 border-t p-3">
                <p className="text-sm"><strong>Subject:</strong> {t.subject}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onClick={() => copyTemplate(t)}>
                    {copiedId === t.id ? "Copied!" : "Copy"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(t.id)}>
                    Edit
                  </Button>
                  {confirmingId === t.id ? (
                    <form action={removeTemplate}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton pendingLabel="…" variant="ghost" size="sm">Confirm delete?</SubmitButton>
                    </form>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingId(t.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
