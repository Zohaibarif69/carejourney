export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbAll, dbRun, uuid } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import { rowToDoc } from "@/app/api/journeys/route";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await dbGet("SELECT id FROM journeys WHERE id = ?", [id]);
  if (!journey) return notFound("Journey not found");

  const { labels } = await req.json();
  if (!Array.isArray(labels) || labels.length === 0) return err("labels array is required");

  try {
    const ids: string[] = [];
    for (const label of labels as string[]) {
      const docId = uuid();
      await dbRun(
        `INSERT INTO documents (id, journey_id, label, status, processing_step) VALUES (?, ?, ?, 'waiting', 0)`,
        [docId, id, label]
      );
      ids.push(docId);
    }

    await dbRun(
      `UPDATE agent_classifications SET confirmed = 1, confirmed_at = datetime('now') WHERE journey_id = ? AND confirmed = 0`,
      [id]
    );

    await dbRun(
      `UPDATE journeys SET status = 'documents', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );

    const placeholders = ids.map(() => "?").join(",");
    const docs = await dbAll(
      `SELECT * FROM documents WHERE id IN (${placeholders})`,
      ids
    );

    return ok(docs.map(rowToDoc));
  } catch (e) {
    console.error("confirm error:", e);
    return err("Confirm failed", 500);
  }
}
