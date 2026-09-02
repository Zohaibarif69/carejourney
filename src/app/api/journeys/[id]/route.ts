export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, toJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import { rowToJourney } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
  if (!row) return notFound("Journey not found");
  return ok(await rowToJourney(row));
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await dbGet("SELECT id FROM journeys WHERE id = ?", [id]);
  if (!existing) return notFound("Journey not found");

  try {
    const body = await req.json();
    const now = new Date().toISOString();

    // Build SET clause dynamically
    const fields: string[] = ["updated_at = ?"];
    const args: (string | number | null | boolean)[] = [now];

    const map: Record<string, unknown> = {
      status: body.status,
      patient: body.patient !== undefined ? toJson(body.patient) : undefined,
      visual_session: body.visualSession !== undefined ? toJson(body.visualSession) : undefined,
      consultation_answers: body.consultationAnswers !== undefined ? toJson(body.consultationAnswers) : undefined,
      consultation_schema: body.consultationSchema !== undefined ? toJson(body.consultationSchema) : undefined,
      signed: body.signed !== undefined ? (body.signed ? 1 : 0) : undefined,
      signed_at: body.signedAt,
      provider_name: body.providerName,
      provider_city: body.providerCity,
      provider_country: body.providerCountry,
      service: body.service,
    };

    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        args.push(val as string | number | null);
      }
    }
    args.push(id);

    await dbRun(`UPDATE journeys SET ${fields.join(", ")} WHERE id = ?`, args);

    const updated = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
    return ok(await rowToJourney(updated!));
  } catch (e) {
    console.error("PATCH /journeys/[id] error:", e);
    return err("Failed to update journey", 500);
  }
}
