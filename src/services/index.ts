/**
 * Single import point — same interface as the original src/services/index.ts
 * but everything now calls /api/* (Next.js routes) instead of Xano.
 *
 * No more VITE_USE_MOCKS needed — just set real API keys in .env.local.
 * Each service falls back gracefully when a third-party API is unavailable.
 */

import type { Provider, DocItem, FormSection, ConsultationAnswers, Journey, RedactionSuggestion, AgentStep, EsignParty } from "../types";
import { apiFetch } from "./apiClient";

const APP_URL =
  typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL ?? "";

// ─── Providers ───────────────────────────────────────────────────────────────

export const providerService = {
  async search(country: string, city: string, category: string, concern?: string): Promise<Provider[]> {
    const params = new URLSearchParams({ country, city, category });
    if (concern) params.set("concern", concern);
    return apiFetch<Provider[]>(`/providers/search?${params.toString()}`);
  },

  async getProvider(id: string): Promise<Provider | undefined> {
    try {
      return await apiFetch<Provider>(`/providers/${id}`);
    } catch {
      return undefined;
    }
  },
};

// ─── Journeys ────────────────────────────────────────────────────────────────

export const journeyService = {
  async create(data: Omit<Journey, "id" | "createdAt" | "updatedAt">): Promise<Journey> {
    return apiFetch<Journey>("/journeys", { method: "POST", body: data });
  },
  async get(id: string): Promise<Journey | null> {
    try { return await apiFetch<Journey>(`/journeys/${id}`); } catch { return null; }
  },
  async update(journey: Journey): Promise<Journey> {
    return apiFetch<Journey>(`/journeys/${journey.id}`, { method: "PATCH", body: journey });
  },
  async patch(id: string, updates: Partial<Journey>): Promise<Journey> {
    return apiFetch<Journey>(`/journeys/${id}`, { method: "PATCH", body: updates });
  },
};

// ─── Document Agent ───────────────────────────────────────────────────────────

export const agentService = {
  async classify(journeyId: string, prompt: string): Promise<string[]> {
    const { labels } = await apiFetch<{ labels: string[] }>(
      `/journeys/${journeyId}/documents/classify`,
      { method: "POST", body: { prompt } }
    );
    return labels;
  },

  async confirm(journeyId: string, labels: string[]): Promise<DocItem[]> {
    return apiFetch<DocItem[]>(`/journeys/${journeyId}/documents/confirm`, {
      method: "POST",
      body: { labels },
    });
  },

  async uploadFile(docId: string, file: File): Promise<DocItem> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${APP_URL}/api/documents/${docId}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  },

  async getStatus(docId: string): Promise<DocItem> {
    return apiFetch<DocItem>(`/documents/${docId}/status`);
  },
};

// ─── Review (Nutrient DWS) ────────────────────────────────────────────────────

export const reviewService = {
  async getSuggestions(docId: string): Promise<RedactionSuggestion[]> {
    return apiFetch<RedactionSuggestion[]>(`/documents/${docId}/redact/suggest`, {
      method: "POST",
    });
  },

  async seal(docId: string, approvedRedactionIds: string[]): Promise<DocItem> {
    return apiFetch<DocItem>(`/documents/${docId}/redact/seal`, {
      method: "POST",
      body: { approvedRedactionIds },
    });
  },
};

// ─── Consultation (Doctavian) ─────────────────────────────────────────────────

export const consultationService = {
  async generate(journeyId: string): Promise<FormSection[]> {
    return apiFetch<FormSection[]>(`/journeys/${journeyId}/consultation/generate`, {
      method: "POST",
    });
  },

  async saveAnswers(journeyId: string, answers: ConsultationAnswers): Promise<Journey> {
    return apiFetch<Journey>(`/journeys/${journeyId}/consultation`, {
      method: "PATCH",
      body: { consultationAnswers: answers },
    });
  },

  async sign(journeyId: string): Promise<{ signed: boolean; signedAt: string; signingUrl?: string }> {
    return apiFetch(`/journeys/${journeyId}/sign`, { method: "POST" });
  },
};

// ─── Requests ─────────────────────────────────────────────────────────────────

export const requestService = {
  async submit(journeyId: string): Promise<{ requestId: string; submittedAt: string }> {
    return apiFetch(`/journeys/${journeyId}/request`, { method: "POST" });
  },

  async getStatus(requestId: string): Promise<{ status: "requested" | "confirmed"; confirmedAt?: string }> {
    return apiFetch(`/requests/${requestId}`);
  },

  async confirm(requestId: string): Promise<void> {
    await apiFetch(`/requests/${requestId}/confirm`, { method: "POST" });
  },
};

// ─── Foxit Document Agent + eSign ──────────────────────────────────────────────
// Two deliberately separate calls. `runAgent` drives the MCP tool-use loop
// (reversible document work only — merge, convert, compress, OCR, extract).
// `sendForSignature` is the human-triggered handoff with its own Foxit eSign
// credentials — it is never called from `runAgent` or from anywhere in the
// agent's tool loop. See src/lib/foxitAgent.ts and src/lib/foxitEsign.ts.

export const foxitAgentService = {
  async runAgent(prompt: string): Promise<{ steps: AgentStep[]; finalText: string }> {
    return apiFetch(`/documents/agent-process`, { method: "POST", body: { prompt } });
  },

  async sendForSignature(payload: {
    folderName: string;
    documentPublicUrl: string;
    documentFileName: string;
    parties: EsignParty[];
  }): Promise<{ folderId: string }> {
    return apiFetch(`/documents/foxit-esign`, { method: "POST", body: payload });
  },
};

// ─── Visual (Perfect Corp) ────────────────────────────────────────────────────

export const visualService = {
  async explore(file: File, experience: string): Promise<{ originalUrl: string; resultUrl: string; experience: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("experience", experience);
    const res = await fetch(`${APP_URL}/api/visual/explore`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Visual explore failed: ${res.status}`);
    return res.json();
  },
};
