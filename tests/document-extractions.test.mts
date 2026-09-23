import assert from "node:assert/strict";
import test from "node:test";
import { parseDocumentExtractionsJson, lowConfidenceCount, copyAllText } from "../lib/document-extractions.ts";

test("parses a single document object, filling in defaults", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({
    document_name: "referral_form_0923.pdf",
    fields: [{ label: "Student name", value: "Alex Rivera" }],
  }));
  assert.ok("documents" in result, JSON.stringify(result));
  if (!("documents" in result)) return;
  assert.equal(result.documents.length, 1);
  const doc = result.documents[0];
  assert.equal(doc.documentName, "referral_form_0923.pdf");
  assert.equal(doc.documentType, "Other");
  assert.equal(doc.school, "");
  assert.equal(doc.summary, "");
  assert.deepEqual(doc.flags, []);
  assert.deepEqual(doc.fields, [{ label: "Student name", value: "Alex Rivera", confidence: "medium", note: "" }]);
});

test("parses a {documents: [...]} wrapper with several documents", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({
    documents: [
      { document_name: "a.pdf", document_type: "Referral Form", school: "Angelo Elementary", summary: "A referral.", fields: [{ label: "DOB", value: "1/2/2015", confidence: "low", note: "Handwriting unclear" }], flags: ["Parent signature missing"] },
      { document_name: "b.pdf", fields: [{ label: "Name", value: "Sam" }] },
    ],
  }));
  assert.ok("documents" in result, JSON.stringify(result));
  if (!("documents" in result)) return;
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[0].documentType, "Referral Form");
  assert.deepEqual(result.documents[0].flags, ["Parent signature missing"]);
  assert.equal(result.documents[0].fields[0].confidence, "low");
  assert.equal(result.documents[1].documentName, "b.pdf");
});

test("rejects blank input", () => {
  const result = parseDocumentExtractionsJson("   ");
  assert.deepEqual(result, { error: "Paste the agent's JSON output first." });
});

test("rejects malformed JSON", () => {
  const result = parseDocumentExtractionsJson("{ not json");
  assert.ok("error" in result);
  if ("error" in result) assert.match(result.error, /valid JSON/);
});

test("rejects a top-level array", () => {
  const result = parseDocumentExtractionsJson("[1, 2, 3]");
  assert.deepEqual(result, { error: 'Expected a document object or a {"documents": [...]} wrapper.' });
});

test("rejects a document missing document_name", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({ fields: [] }));
  assert.deepEqual(result, { error: 'Document 1 is missing "document_name".' });
});

test("rejects a document whose fields isn't a list", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({ document_name: "a.pdf", fields: "none" }));
  assert.deepEqual(result, { error: `Document 1's "fields" must be a list.` });
});

test("rejects a field missing a label", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({ document_name: "a.pdf", fields: [{ value: "x" }] }));
  assert.deepEqual(result, { error: 'Document 1, field 1 is missing "label".' });
});

test("rejects an invalid confidence value", () => {
  const result = parseDocumentExtractionsJson(JSON.stringify({ document_name: "a.pdf", fields: [{ label: "Name", value: "x", confidence: "sure" }] }));
  assert.deepEqual(result, { error: 'Document 1, field 1 has an invalid "confidence" (must be "high", "medium" or "low").' });
});

test("lowConfidenceCount counts everything below high", () => {
  assert.equal(lowConfidenceCount([
    { confidence: "high" },
    { confidence: "medium" },
    { confidence: "low" },
  ]), 2);
  assert.equal(lowConfidenceCount([]), 0);
});

test("copyAllText joins label: value pairs with newlines", () => {
  assert.equal(
    copyAllText([{ label: "Name", value: "Alex" }, { label: "DOB", value: "1/2/2015" }]),
    "Name: Alex\nDOB: 1/2/2015",
  );
});
