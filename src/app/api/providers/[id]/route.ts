export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbGet, parseJson } from "@/lib/db";
import { ok, notFound } from "@/lib/apiHelpers";
import type { Provider } from "@/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await dbGet("SELECT * FROM providers WHERE id = ?", [id]);
  if (!row) return notFound("Provider not found");

  const provider: Provider = {
    id: row.id as string,
    name: row.name as string,
    city: row.city as string,
    country: row.country as string,
    specialties: parseJson<string[]>(row.specialties, []),
    services: parseJson<string[]>(row.services, []),
    description: row.description as string,
    phone: row.phone as string,
    website: row.website as string,
    imageUrl: row.image_url as string,
    matchReasons: parseJson<string[]>(row.match_reasons, []),
    matchStrength: (row.match_strength as Provider["matchStrength"]) ?? "Possible",
    rating: row.rating as number | undefined,
    reviewCount: row.review_count as number | undefined,
  };

  return ok(provider);
}
