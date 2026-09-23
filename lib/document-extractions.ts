export type DocumentExtractionConfidence = "high" | "medium" | "low";
const VALID_CONFIDENCE: DocumentExtractionConfidence[] = ["high", "medium", "low"];

export type DocumentExtractionField = {
  label: string;
  value: string;
  confidence: DocumentExtractionConfidence;
  note: string;
};

export type DocumentExtractionStatus = "pending_review" | "approved" | "encoded" | "rejected";

/** One row read back from the document_extractions table. */
export type DocumentExtraction = {
  id: string;
  documentName: string;
  documentType: string;
  school: string | null;
  summary: string;
  fields: DocumentExtractionField[];
  flags: string[];
  status: DocumentExtractionStatus;
  rejectionReason: string | null;
  createdAt: string;
};

/** One document parsed out of a "paste from agent" JSON import, ready to insert. */
export type ParsedDocument = {
  documentName: string;
  documentType: string;
  school: string;
  summary: string;
  fields: DocumentExtractionField[];
  flags: string[];
};

/* Accepts either a single document object or a {"documents": [...]}
   wrapper (the agent's JSON format lets both through, per the
   design doc). Required per document: document_name, and a fields
   array where every field has a label. Everything else has a safe
   default so a slightly incomplete paste doesn't get rejected over a
   missing optional field -- but a genuinely malformed shape (fields
   not a list, an invalid confidence value, a missing label) is
   rejected with a specific, actionable error naming which document
   and field it's about. All-or-nothing: one bad document in a pasted
   batch means none of them import, so a partial success never leaves
   Michelle unsure which ones actually made it in. */
export function parseDocumentExtractionsJson(raw: string): { documents: ParsedDocument[] } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "Paste the agent's JSON output first." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { error: "That doesn't look like valid JSON. Check for a missing comma or bracket and try again." };
  }

  let rawDocuments: unknown[];
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "documents" in parsed) {
    const documents = (parsed as { documents: unknown }).documents;
    if (!Array.isArray(documents)) return { error: `"documents" must be a list.` };
    rawDocuments = documents;
  } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    rawDocuments = [parsed];
  } else {
    return { error: 'Expected a document object or a {"documents": [...]} wrapper.' };
  }

  if (rawDocuments.length === 0) return { error: "No documents found in the pasted JSON." };

  const documents: ParsedDocument[] = [];
  for (let i = 0; i < rawDocuments.length; i++) {
    const raw = rawDocuments[i];
    const docLabel = `Document ${i + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: `${docLabel} isn't a valid object.` };
    const d = raw as Record<string, unknown>;

    const documentName = typeof d.document_name === "string" ? d.document_name.trim() : "";
    if (!documentName) return { error: `${docLabel} is missing "document_name".` };

    if (!Array.isArray(d.fields)) return { error: `${docLabel}'s "fields" must be a list.` };

    const fields: DocumentExtractionField[] = [];
    for (let j = 0; j < d.fields.length; j++) {
      const rawField = d.fields[j];
      const fieldLabel = `${docLabel}, field ${j + 1}`;
      if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) return { error: `${fieldLabel} isn't a valid object.` };
      const f = rawField as Record<string, unknown>;

      const label = typeof f.label === "string" ? f.label.trim() : "";
      if (!label) return { error: `${fieldLabel} is missing "label".` };

      const value = typeof f.value === "string" ? f.value : "";

      let confidence: DocumentExtractionConfidence = "medium";
      if (f.confidence !== undefined) {
        if (typeof f.confidence !== "string" || !VALID_CONFIDENCE.includes(f.confidence as DocumentExtractionConfidence)) {
          return { error: `${fieldLabel} has an invalid "confidence" (must be "high", "medium" or "low").` };
        }
        confidence = f.confidence as DocumentExtractionConfidence;
      }

      const note = typeof f.note === "string" ? f.note : "";
      fields.push({ label, value, confidence, note });
    }

    const flags = Array.isArray(d.flags) ? d.flags.filter((x): x is string => typeof x === "string") : [];
    const documentType = typeof d.document_type === "string" && d.document_type.trim() ? d.document_type.trim() : "Other";
    const school = typeof d.school === "string" ? d.school.trim() : "";
    const summary = typeof d.summary === "string" ? d.summary.trim() : "";

    documents.push({ documentName, documentType, school, summary, fields, flags });
  }

  return { documents };
}

export function lowConfidenceCount(fields: { confidence: string }[]): number {
  return fields.filter((f) => f.confidence !== "high").length;
}

export function copyAllText(fields: { label: string; value: string }[]): string {
  return fields.map((f) => `${f.label}: ${f.value}`).join("\n");
}
