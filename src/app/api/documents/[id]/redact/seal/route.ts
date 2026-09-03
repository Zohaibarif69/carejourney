export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, uuid, toJson, parseJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import { rowToDoc } from "@/app/api/journeys/route";
import { saveFile } from "@/lib/storage";
import type { RedactionSuggestion } from "@/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await dbGet("SELECT * FROM documents WHERE id = ?", [id]);
  if (!doc) return notFound("Document not found");

  const { approvedRedactionIds } = await req.json();
  if (!Array.isArray(approvedRedactionIds)) return err("approvedRedactionIds array is required");

  try {
    const allRedactions = parseJson<RedactionSuggestion[]>(doc.redactions, []);
    const approved = allRedactions.filter((r) => approvedRedactionIds.includes(r.id));

    const sealId = await sealWithNutrient(doc.file_url as string, approved, id);
    const now = new Date().toISOString();

    const updatedRedactions = allRedactions.map((r) => ({
      ...r,
      approved: approvedRedactionIds.includes(r.id),
    }));

    await dbRun(
      `UPDATE documents SET sealed = 1, sealed_at = ?, seal_id = ?, redactions = ? WHERE id = ?`,
      [now, sealId, toJson(updatedRedactions), id]
    );

    const updated = await dbGet("SELECT * FROM documents WHERE id = ?", [id]);
    return ok(rowToDoc(updated!));
  } catch (e) {
    console.error("redact/seal error:", e);
    return err("Seal failed", 500);
  }
}

async function sealWithNutrient(fileUrl: string, approvedRedactions: RedactionSuggestion[], docId: string): Promise<string> {
  if (approvedRedactions.length === 0) return `local-seal-${uuid()}`;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resolvedUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${fileUrl}`;
    const fileRes = await fetch(resolvedUrl);
    if (!fileRes.ok) throw new Error(`Could not fetch file: ${fileRes.status}`);
    const fileBuffer = await fileRes.arrayBuffer();

    const criteria = approvedRedactions.map((r) => r.label).join(", ");
    const form = new FormData();
    form.append("file1", new Blob([fileBuffer]), "document.pdf");
    form.append("data", JSON.stringify({
      documents: [{ documentId: "file1" }],
      criteria: `Only redact: ${criteria}`,
      redaction_state: "apply",
    }));

    const res = await fetch(`${process.env.NUTRIENT_API_URL}/ai/redact`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NUTRIENT_API_KEY}` },
      body: form,
    });

    if (!res.ok) throw new Error(`Nutrient error ${res.status}`);

    const sealId = `seal-${uuid()}`;
    const sealedBuffer = Buffer.from(await res.arrayBuffer());
    // Save sealed PDF to persistent storage
    await saveFile(["sealed", `${docId}-${sealId}.pdf`], sealedBuffer, "application/pdf");

    return sealId;
  } catch (e) {
    console.warn("[API-FALLBACK][Nutrient] Seal call failed — using local seal id.", e);
    return `local-seal-${uuid()}`;
  }
}
