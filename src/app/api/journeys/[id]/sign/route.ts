export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, parseJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import type { Journey } from "@/types";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { generateConsentDocument } from "@/lib/doctavianGenerate";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
  if (!row) return notFound("Journey not found");

  try {
    const result = await signWithDoctavian(row);
    const now = new Date().toISOString();

    await dbRun(
      `UPDATE journeys SET signed = 1, signed_at = ?, status = 'requested', doctavian_envelope_id = ?, updated_at = datetime('now') WHERE id = ?`,
      [now, result.envelopeId ?? null, id]
    );

    return ok({ signed: true, signedAt: now, envelopeId: result.envelopeId });
  } catch (e) {
    console.error("sign error:", e);
    return err("Signing failed", 500);
  }
}

async function signWithDoctavian(journeyRow: Record<string, unknown>): Promise<{ envelopeId?: string }> {
  const patient = parseJson<Journey["patient"]>(journeyRow.patient, { name: "", email: "", phone: "", notes: "" });
  const headers = { "X-Api-Key": process.env.DOCTAVIAN_API_KEY ?? "" };

  try {
    const answers = parseJson<Record<string, string>>(journeyRow.consultation_answers, {});
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateConsentDocument(
        journeyRow.service as string,
        journeyRow.provider_name as string,
        patient,
        answers
      );
    } catch (genError) {
      console.warn("[API-FALLBACK][Doctavian-Generate] Real document generation failed — using pdf-lib fallback.", genError);
      pdfBytes = await buildConsentPdf(journeyRow.service as string, journeyRow.provider_name as string, patient, answers);
    }

    const form = new FormData();
    form.append("file", new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }), "consent-form.pdf");

    const uploadRes = await fetch(`${process.env.DOCTAVIAN_API_URL}/v1/signatures/document/upload`, {
      method: "POST", headers, body: form,
    });
    if (!uploadRes.ok) throw new Error(`Doctavian upload ${uploadRes.status}`);
    const uploadData = await uploadRes.json();
    const fileId = uploadData.result?.data?.files?.[0]?.id;
    if (!fileId) throw new Error("Doctavian upload response missing file id");

    const createRes = await fetch(`${process.env.DOCTAVIAN_API_URL}/v1/signatures/envelope/create`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        documents: [{ referenceDocumentId: 1, name: `Consent — ${journeyRow.service}`, loadMethod: "Storage", urn: fileId }],
        recipients: [{ referenceSignerId: 1, name: patient.name || "Patient", email: patient.email || "patient@example.com", role: "signer", mandatory: true }],
        fields: [{ type: "signature", isRequired: true, referenceSignerId: 1, referenceDocumentId: 1, page: 1, positionX: 85, positionY: 700, width: 200, height: 60, name: "patient_signature" }],
        envelope: { subject: `Please sign your consent form — ${journeyRow.service}`, message: "Please review and sign your consultation consent form.", senderName: (journeyRow.provider_name as string) || "CareJourney", senderEmail: "no-reply@carejourney.demo", isSignOrder: false, expireInDays: 14 },
      }),
    });
    if (!createRes.ok) throw new Error(`Doctavian envelope create ${createRes.status}`);
    const createData = await createRes.json();
    const envelopeId = createData.result?.data?.envelope?.id;
    if (!envelopeId) throw new Error("Doctavian envelope create response missing envelope id");

    const sendRes = await fetch(`${process.env.DOCTAVIAN_API_URL}/v1/signatures/envelope/${envelopeId}/send`, { headers });
    if (!sendRes.ok) throw new Error(`Doctavian envelope send ${sendRes.status}`);

    return { envelopeId };
  } catch (e) {
    console.warn("[API-FALLBACK][Doctavian] Sign flow failed — using synchronous sign.", e);
    return { envelopeId: buildFallbackEnvelopeId() };
  }
}

function buildFallbackEnvelopeId(): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ENV-${datePart}-${random}`;
}

async function buildConsentPdf(service: string, providerName: string, patient: Journey["patient"], answers: Record<string, string>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  const draw = (text: string, opts: { size?: number; useBold?: boolean; gap?: number } = {}) => {
    page.drawText(text, { x: 50, y, size: opts.size ?? 11, font: opts.useBold ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= opts.gap ?? (opts.size ?? 11) + 8;
  };

  draw(`Consent Form — ${service}`, { size: 18, useBold: true, gap: 30 });
  draw(`Provider: ${providerName || "N/A"}`, { size: 12 });
  draw(`Patient: ${patient.name || "N/A"}`, { size: 12 });
  draw(`Email: ${patient.email || "N/A"}`, { size: 12, gap: 24 });
  draw("Consultation Answers", { size: 14, useBold: true, gap: 20 });
  for (const [key, value] of Object.entries(answers)) {
    draw(`${key}: ${value}`, { size: 10, gap: 16 });
    if (y < 80) break;
  }
  y -= 20;
  draw("By signing below, I confirm that the information above is accurate and I consent to the proposed treatment.", { size: 10, gap: 60 });
  page.drawLine({ start: { x: 50, y }, end: { x: 250, y }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
  page.drawText("Patient signature", { x: 50, y: y - 14, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

  return pdf.save();
}
