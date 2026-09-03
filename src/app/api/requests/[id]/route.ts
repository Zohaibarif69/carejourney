export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet } from "@/lib/db";
import { ok, notFound } from "@/lib/apiHelpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM requests WHERE id = ?", [id]);
  if (!row) return notFound("Request not found");

  return ok({
    id: row.id,
    journeyId: row.journey_id,
    status: row.status,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at ?? undefined,
  });
}
