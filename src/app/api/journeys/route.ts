export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbAll, dbRun, uuid, toJson, parseJson } from "@/lib/db";
import { ok, err } from "@/lib/apiHelpers";
import type { Journey } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = uuid();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO journeys (
        id, provider_id, provider_name, provider_city, provider_country,
        service, patient, visual_session, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.providerId,
        body.providerName,
        body.providerCity,
        body.providerCountry,
        body.service,
        toJson(body.patient ?? {}),
        body.visualSession ? toJson(body.visualSession) : null,
        body.status ?? "draft",
        now,
        now,
      ]
    );

    const journey = await getJourneyById(id);
    return ok(journey, 201);
  } catch (e) {
    console.error("POST /journeys error:", e);
    return err("Failed to create journey", 500);
  }
}

// ─── Shared helpers (imported by sub-routes) ──────────────────────────────────

export async function getJourneyById(id: string): Promise<Journey> {
  const row = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
  if (!row) throw new Error(`Journey ${id} not found`);
  return rowToJourney(row);
}

export async function rowToJourney(row: Record<string, unknown>): Promise<Journey> {
  const docs = await dbAll(
    "SELECT * FROM documents WHERE journey_id = ? ORDER BY rowid",
    [row.id as string]
  );

  return {
    id: row.id as string,
    providerId: row.provider_id as string,
    providerName: row.provider_name as string,
    providerCity: row.provider_city as string,
    providerCountry: row.provider_country as string,
    service: row.service as string,
    patient: parseJson(row.patient, { name: "", email: "", phone: "", notes: "" }),
    visualSession: row.visual_session ? parseJson(row.visual_session, undefined) : undefined,
    docs: docs.map(rowToDoc),
    consultationAnswers: row.consultation_answers
      ? parseJson(row.consultation_answers, undefined)
      : undefined,
    consultationSchema: row.consultation_schema
      ? parseJson(row.consultation_schema, undefined)
      : undefined,
    signed: Boolean(row.signed),
    signedAt: row.signed_at as string | undefined,
    status: row.status as Journey["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function rowToDoc(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    journeyId: row.journey_id as string,
    label: row.label as string,
    fileName: row.file_name as string | undefined,
    fileUrl: row.file_url as string | undefined,
    status: row.status as "waiting" | "uploaded" | "processing" | "ready" | "error",
    processingStep: row.processing_step as number,
    foxitJobId: row.foxit_job_id as string | undefined,
    extractedText: row.extracted_text as string | undefined,
    redactions: row.redactions ? parseJson(row.redactions, undefined) : undefined,
    sealed: Boolean(row.sealed),
    sealedAt: row.sealed_at as string | undefined,
    sealId: row.seal_id as string | undefined,
  };
}
