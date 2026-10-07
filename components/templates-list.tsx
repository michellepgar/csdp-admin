"use client";

import { useState } from "react";
import { Copy, Mail, Plus } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { SectionCard } from "@/components/section-card";
import { categoryTone } from "@/lib/category-tone";
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
    <SectionCard
      icon={<Mail />}
      title="Email templates"
      count={templates.length}
      right={
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="bg-white/90 text-header-background hover:bg-white"
          onClick={() => setEditingId(editingId === "new" ? null : "new")}
        >
          {editingId === "new" ? "Cancel" : <><Plus className="h-3 w-3" /> New template</>}
        </Button>
      }
    >

      {editingId === "new" && (
        <TemplateForm template={null} onCancel={() => setEditingId(null)} saveTemplate={saveTemplate} />
      )}

      {templates.length === 0 && editingId !== "new" && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No templates yet. Add one to build the shared library.</p>
      )}

      {templates.map((t) => {
        const isOpen = openId === t.id;
        const isEditing = editingId === t.id;
        const tone = categoryTone(t.category);
        return (
          <div key={t.id} className={`rounded-lg border border-l-4 ${tone.edge} bg-card shadow-sm transition-shadow hover:shadow-md`}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => setOpenId(isOpen ? null : t.id)} className="min-w-0 flex-1 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {t.category && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone.pill}`}>{t.category}</span>}
                </span>
                {!isOpen && !isEditing && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{t.subject || t.body}</span>}
              </button>
              <Button type="button" size="xs" variant="outline" onClick={() => copyTemplate(t)}>
                <Copy className="h-3 w-3" /> {copiedId === t.id ? "Copied!" : "Copy"}
              </Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setOpenId(isOpen ? null : t.id)}>
                {isOpen ? "Collapse" : "View"}
              </Button>
            </div>

            {isEditing ? (
              <div className="border-t p-3">
                <TemplateForm template={t} onCancel={() => setEditingId(null)} saveTemplate={saveTemplate} />
              </div>
            ) : isOpen ? (
              <div className="space-y-2 border-t p-3">
                <p className="text-sm"><strong>Subject:</strong> {t.subject}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                <div className="flex items-center gap-2">
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
    </SectionCard>
  );
}
