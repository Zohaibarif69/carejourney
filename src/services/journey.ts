import type { Journey } from "@/types";
import { apiFetch } from "./apiClient";

export const journeyService = {
  async create(data: Omit<Journey, "id" | "createdAt" | "updatedAt">): Promise<Journey> {
    return apiFetch<Journey>("/journeys", { method: "POST", body: data });
  },

  async get(id: string): Promise<Journey | null> {
    try {
      return await apiFetch<Journey>(`/journeys/${id}`);
    } catch {
      return null;
    }
  },

  async update(journey: Journey): Promise<Journey> {
    return apiFetch<Journey>(`/journeys/${journey.id}`, { method: "PATCH", body: journey });
  },

  async patch(id: string, updates: Partial<Journey>): Promise<Journey> {
    return apiFetch<Journey>(`/journeys/${id}`, { method: "PATCH", body: updates });
  },
};
