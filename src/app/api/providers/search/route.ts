export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { dbRun, uuid, parseJson, toJson } from "@/lib/db";
import { callLLM } from "@/lib/llm";
import { ok, err } from "@/lib/apiHelpers";
import type { Provider } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const country = searchParams.get("country");
  const city = searchParams.get("city");
  const category = searchParams.get("category");
  const concern = searchParams.get("concern") ?? "";

  if (!country || !city || !category) {
    return err("country, city, and category are required");
  }

  try {
    const serpResults = await searchSerpApi(country, city, category);
    const ranked = await rankWithLLM(serpResults, concern, category);

    const providers: Provider[] = [];
    for (const p of ranked) {
      const id = uuid();
      await dbRun(
        `INSERT INTO providers (
          id, serpapi_place_id, name, city, country, specialties, services,
          description, phone, website, image_url, rating, review_count,
          match_reasons, match_strength, last_synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(serpapi_place_id) DO UPDATE SET
          match_reasons = excluded.match_reasons,
          match_strength = excluded.match_strength,
          last_synced_at = excluded.last_synced_at`,
        [
          id,
          p.serpPlaceId ?? id,
          p.name,
          city,
          country,
          toJson([category]),
          toJson(p.services ?? []),
          p.description ?? "",
          p.phone ?? "",
          p.website ?? "",
          p.imageUrl ?? "",
          p.rating ?? null,
          p.reviewCount ?? null,
          toJson(p.matchReasons ?? []),
          p.matchStrength ?? "Possible",
        ]
      );
      providers.push({
        id,
        name: p.name,
        city,
        country,
        specialties: [category],
        services: p.services ?? [],
        description: p.description ?? "",
        phone: p.phone ?? "",
        website: p.website ?? "",
        imageUrl: p.imageUrl ?? "",
        matchReasons: p.matchReasons ?? [],
        matchStrength: p.matchStrength ?? "Possible",
        rating: p.rating,
        reviewCount: p.reviewCount,
      });
    }

    return ok(providers);
  } catch (e) {
    console.error("providers/search error:", e);
    return err("Provider search failed", 500);
  }
}

interface SerpPlace {
  serpPlaceId?: string;
  name: string;
  description?: string;
  phone?: string;
  website?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  services?: string[];
}

async function searchSerpApi(country: string, city: string, category: string): Promise<SerpPlace[]> {
  try {
    const query = `${category} clinic ${city} ${country}`;
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "search");
    url.searchParams.set("api_key", process.env.SERPAPI_KEY!);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);
    const data = await res.json();
    const places = (data.local_results ?? []) as Record<string, unknown>[];

    if (places.length === 0) return buildFallbackProviders(city, country, category);

    return places.slice(0, 10).map((p) => ({
      serpPlaceId: p.place_id as string | undefined,
      name: (p.title as string) ?? "",
      description: (p.description as string) ?? "",
      phone: (p.phone as string) ?? "",
      website: (p.website as string) ?? "",
      imageUrl: (p.thumbnail as string) ?? "",
      rating: p.rating as number | undefined,
      reviewCount: p.reviews as number | undefined,
      services: [],
    }));
  } catch (e) {
    console.warn("[API-FALLBACK][SerpApi] Provider search failed — using demo clinics.", e);
    return buildFallbackProviders(city, country, category);
  }
}

function buildFallbackProviders(city: string, country: string, category: string): SerpPlace[] {
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return [
    { name: `${city} ${label} Center`, rating: 4.8, reviewCount: 214 },
    { name: `${label} Clinic of ${city}`, rating: 4.6, reviewCount: 132 },
    { name: `${city} Family ${label} Practice`, rating: 4.5, reviewCount: 89 },
    { name: `Premier ${label} Group — ${city}`, rating: 4.7, reviewCount: 176 },
  ].map((t, i) => ({
    serpPlaceId: `demo-${category}-${city}-${i}`.toLowerCase().replace(/\s+/g, "-"),
    name: t.name,
    description: `A ${category} provider serving patients in ${city}, ${country}. (Demo listing)`,
    phone: "+1 (555) 010-0100",
    website: "",
    imageUrl: "",
    rating: t.rating,
    reviewCount: t.reviewCount,
    services: [],
  }));
}

interface RankedProvider extends SerpPlace {
  matchReasons: string[];
  matchStrength: "Strong" | "Good" | "Possible";
}

async function rankWithLLM(places: SerpPlace[], concern: string, category: string): Promise<RankedProvider[]> {
  if (places.length === 0) return [];

  const system = `You are a medical tourism advisor. Given a patient concern and a list of providers,
rank them by suitability. Respond ONLY with valid JSON array, no markdown.
Each item: { "index": number, "matchStrength": "Strong"|"Good"|"Possible", "matchReasons": string[], "services": string[] }`;

  const user = `Patient concern: "${concern || category}"\nCategory: ${category}\nProviders:\n${places.map((p, i) => `${i}. ${p.name} — ${p.description ?? "no description"}`).join("\n")}\n\nReturn a JSON array ranked best-first.`;

  try {
    const raw = await callLLM(system, user);
    const clean = raw.replace(/```json|```/g, "").trim();
    const rankings = JSON.parse(clean) as Array<{ index: number; matchStrength: "Strong" | "Good" | "Possible"; matchReasons: string[]; services: string[] }>;
    return rankings.map((r) => ({ ...places[r.index], matchStrength: r.matchStrength, matchReasons: r.matchReasons, services: r.services }));
  } catch (e) {
    console.warn("[API-FALLBACK][LLM] Ranking failed — showing unranked results.", e);
    return places.map((p) => ({ ...p, matchStrength: "Possible" as const, matchReasons: [`Matches your search for ${category}`] }));
  }
}

export function rowToProvider(row: Record<string, unknown>): Provider {
  return {
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
}
