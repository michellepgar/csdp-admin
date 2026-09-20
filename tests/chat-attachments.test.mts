import assert from "node:assert/strict";
import test from "node:test";
import {
  attachmentTypeOf,
  formatFileSize,
  isPreviewableImage,
  MAX_ATTACHMENT_BYTES,
  messagePreview,
  validateAttachment,
  type ChatMessage,
} from "../lib/chat.ts";

test("photos and common documents are accepted", () => {
  assert.equal(validateAttachment("photo.jpg", "image/jpeg", 2_000_000), null);
  assert.equal(validateAttachment("scan.pdf", "application/pdf", 900_000), null);
  assert.equal(validateAttachment("sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 50_000), null);
});

test("a file with no browser-reported type is recognised by its extension", () => {
  assert.equal(attachmentTypeOf("report.docx", ""), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(attachmentTypeOf("data.csv", ""), "text/csv");
  assert.equal(validateAttachment("data.csv", "", 1000), null);
});

test("files over 10 MB, empty files, and other types are refused with a clear message", () => {
  assert.equal(validateAttachment("big.pdf", "application/pdf", MAX_ATTACHMENT_BYTES + 1), "Files can be up to 10 MB.");
  assert.equal(validateAttachment("empty.pdf", "application/pdf", 0), "That file is empty.");
  assert.match(validateAttachment("run.exe", "application/x-msdownload", 1000) ?? "", /photos, PDFs/);
  assert.match(validateAttachment("script.js", "text/javascript", 1000) ?? "", /photos, PDFs/);
});

test("only formats every browser can draw get an inline preview", () => {
  assert.equal(isPreviewableImage("image/png"), true);
  assert.equal(isPreviewableImage("image/heic"), false);
  assert.equal(isPreviewableImage("application/pdf"), false);
});

test("file sizes read naturally", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(3.5 * 1024 * 1024), "3.5 MB");
});

test("a message list preview shows the text, or what was attached when there is none", () => {
  const base: ChatMessage = { id: "1", room: "team", senderName: "John", body: "", createdAt: "2026-09-20T00:00:00Z" };
  assert.equal(messagePreview({ ...base, body: "hello" }), "hello");
  assert.equal(messagePreview({ ...base, attachment: { path: "p", name: "pic.jpg", type: "image/jpeg", size: 1 } }), "Sent a photo");
  assert.equal(messagePreview({ ...base, attachment: { path: "p", name: "form.pdf", type: "application/pdf", size: 1 } }), "Sent form.pdf");
});
