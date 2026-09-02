export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, uuid, toJson } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { ok, err, notFound } from "@/lib/apiHelpers";

const VALID_LABELS = ["report", "prescription", "photo", "lab result", "referral", "general"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const journey = await dbGet("SELECT id FROM journeys WHERE id = ?", [id]);
  if (!journey) return notFound("Journey not found");

  const { prompt } = await req.json();
  if (!prompt) return err("prompt is required");

  const system = `You are a medical document classifier. Given a patient's description of their documents,
return a JSON array of document labels. Use ONLY these labels: ${VALID_LABELS.join(", ")}.
Return ONLY a JSON array like ["report","photo"] — no explanation, no markdown.`;

  const user = `Patient says: "${prompt}"\nWhat documents do they have? Return JSON array only.`;

  try {
    const raw = await callLLM(system, user);
    const clean = raw.replace(/```json|```/g, "").trim();
    let labels: string[] = JSON.parse(clean);
    labels = labels.filter((l) => VALID_LABELS.includes(l));
    if (labels.length === 0) labels = ["general"];

    await dbRun(
      `INSERT INTO agent_classifications (id, journey_id, raw_prompt, llm_output) VALUES (?, ?, ?, ?)`,
      [uuid(), id, prompt, toJson(labels)]
    );

    return ok({ labels });
  } catch (e) {
    console.error("classify error:", e);
    return err("Classification failed", 500);
  }
}
