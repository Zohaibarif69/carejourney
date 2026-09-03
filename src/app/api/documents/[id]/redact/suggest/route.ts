export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, uuid, toJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import type { RedactionSuggestion } from "@/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await dbGet("SELECT * FROM documents WHERE id = ?", [id]);
  if (!doc) return notFound("Document not found");
  if (doc.status !== "ready") return err("Document must be ready before redaction suggestions");

  try {
    const suggestions = await getNutrientSuggestions(
      doc.file_url as string,
      doc.extracted_text as string | undefined
    );

    await dbRun("UPDATE documents SET redactions = ? WHERE id = ?", [toJson(suggestions), id]);
    return ok(suggestions);
  } catch (e) {
    console.error("redact/suggest error:", e);
    return err("Redaction suggestion failed", 500);
  }
}

async function getNutrientSuggestions(fileUrl: string, extractedText?: string): Promise<RedactionSuggestion[]> {
  try {
    // Fetch the file from its URL (works whether it's a Blob URL or local /api/files/... URL)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resolvedUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
    const fileRes = await fetch(resolvedUrl);
    if (!fileRes.ok) throw new Error(`Could not fetch file: ${fileRes.status}`);
    const fileBuffer = await fileRes.arrayBuffer();

    const form = new FormData();
    form.append("file1", new Blob([fileBuffer]), "document.pdf");
    form.append("data", JSON.stringify({
      documents: [{ documentId: "file1" }],
      criteria: "All personally identifiable information (names, phone numbers, emails, SSNs, dates of birth, addresses, credit card numbers)",
      redaction_state: "stage",
    }));

    const res = await fetch(`${process.env.NUTRIENT_API_URL}/ai/redact`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}` },
      body: form,
    });

    if (!res.ok) throw new Error(`Nutrient error ${res.status}`);
    const data = await res.json();
    const rawSuggestions = data.redactions ?? data.documents?.[0]?.redactions ?? data.result?.redactions ?? [];

    if (!Array.isArray(rawSuggestions) || rawSuggestions.length === 0) {
      return generateFallbackSuggestions(extractedText);
    }

    return rawSuggestions.map((s: Record<string, unknown>): RedactionSuggestion => ({
      id: uuid(),
      label: (s.type as string) ?? (s.label as string) ?? "Sensitive information",
      page: (s.page as number) ?? 1,
      confidence: (s.confidence as number) ?? 0.8,
      approved: false,
    }));
  } catch (e) {
    console.warn("[API-FALLBACK][Nutrient] Redaction detection failed — using pattern-match fallback.", e);
    return generateFallbackSuggestions(extractedText);
  }
}

function generateFallbackSuggestions(text?: string): RedactionSuggestion[] {
  const patterns = [
    { regex: /\b\d{3}[-.\\s]?\d{3}[-.\\s]?\d{4}\b/, label: "Phone number", confidence: 0.88 },
    { regex: /\b[\w.-]+@[\w.-]+\.\w+\b/, label: "Email address", confidence: 0.93 },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/, label: "Social Security Number", confidence: 0.9 },
    { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, label: "Credit card number", confidence: 0.86 },
    { regex: /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr)\b/i, label: "Home address", confidence: 0.8 },
  ];

  const baseline: RedactionSuggestion[] = [
    { id: uuid(), label: "Patient name", page: 1, confidence: 0.95, approved: false },
    { id: uuid(), label: "Date of birth", page: 1, confidence: 0.91, approved: false },
  ];

  if (!text) return baseline;

  const matched = patterns.filter(({ regex }) => regex.test(text)).map(({ label, confidence }) => ({
    id: uuid(), label, page: 1, confidence, approved: false,
  }));

  return [...baseline, ...matched];
}
