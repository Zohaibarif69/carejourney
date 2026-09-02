export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, toJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import { rowToJourney } from "@/app/api/journeys/route";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT id FROM journeys WHERE id = ?", [id]);
  if (!row) return notFound("Journey not found");

  try {
    const { consultationAnswers } = await req.json();
    await dbRun(
      `UPDATE journeys SET consultation_answers = ?, status = 'signing', updated_at = datetime('now') WHERE id = ?`,
      [toJson(consultationAnswers), id]
    );
    const updated = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
    return ok(await rowToJourney(updated!));
  } catch (e) {
    console.error("consultation PATCH error:", e);
    return err("Failed to save answers", 500);
  }
}
