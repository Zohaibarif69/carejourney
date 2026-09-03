export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import { ok, notFound, err } from "@/lib/apiHelpers";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM requests WHERE id = ?", [id]);
  if (!row) return notFound("Request not found");

  try {
    const now = new Date().toISOString();
    await dbRun(`UPDATE requests SET status = 'confirmed', confirmed_at = ? WHERE id = ?`, [now, id]);
    await dbRun(`UPDATE journeys SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`, [row.journey_id as string]);
    return ok({ confirmed: true, confirmedAt: now });
  } catch (e) {
    console.error("confirm error:", e);
    return err("Confirm failed", 500);
  }
}
