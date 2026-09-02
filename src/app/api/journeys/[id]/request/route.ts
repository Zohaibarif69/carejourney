export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, uuid } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await dbGet("SELECT id FROM journeys WHERE id = ?", [id]);
  if (!journey) return notFound("Journey not found");

  try {
    const requestId = uuid();
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO requests (id, journey_id, status, submitted_at) VALUES (?, ?, 'requested', ?)`,
      [requestId, id, now]
    );
    await dbRun(
      `UPDATE journeys SET status = 'requested', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );

    return ok({ requestId, submittedAt: now });
  } catch (e) {
    console.error("request submit error:", e);
    return err("Request submission failed", 500);
  }
}
