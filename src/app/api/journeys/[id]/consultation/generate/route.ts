export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, dbRun, toJson } from "@/lib/db";
import { ok, err, notFound } from "@/lib/apiHelpers";
import type { FormSection } from "@/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM journeys WHERE id = ?", [id]);
  if (!row) return notFound("Journey not found");

  try {
    const schema = buildFallbackForm(row.service as string);

    await dbRun(
      `UPDATE journeys SET consultation_schema = ?, status = 'consultation', updated_at = datetime('now') WHERE id = ?`,
      [toJson(schema), id]
    );

    return ok(schema);
  } catch (e) {
    console.error("consultation/generate error:", e);
    return err("Consultation generation failed", 500);
  }
}

function buildFallbackForm(service: string): FormSection[] {
  return [
    {
      id: "personal",
      title: "Personal Information",
      fields: [
        { id: "full_name", label: "Full Name", type: "text", required: true },
        { id: "date_of_birth", label: "Date of Birth", type: "text", required: true },
        { id: "allergies", label: "Known Allergies", type: "textarea", required: false },
      ],
    },
    {
      id: "medical",
      title: "Medical History",
      fields: [
        {
          id: "previous_treatments",
          label: "Previous treatments for this condition?",
          type: "radio",
          options: ["Yes", "No"],
          required: true,
        },
        { id: "medications", label: "Current medications", type: "textarea", required: false },
      ],
    },
    {
      id: "consent",
      title: `Consent for ${service}`,
      fields: [
        {
          id: "consent_treatment",
          label: `I consent to the proposed ${service} procedure`,
          type: "radio",
          options: ["I agree", "I do not agree"],
          required: true,
        },
        {
          id: "consent_data",
          label: "I consent to sharing my data with the provider",
          type: "radio",
          options: ["I agree", "I do not agree"],
          required: true,
        },
      ],
    },
  ];
}
