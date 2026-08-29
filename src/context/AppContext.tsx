import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Journey } from "../types";

interface SearchParams {
  country: string;
  city: string;
  category: string;
  concern: string;
}

interface AppContextType {
  journey: Journey | null;
  setJourney: (j: Journey) => void;
  updateJourney: (updates: Partial<Journey>) => void;
  clearJourney: () => void;
  searchParams: SearchParams;
  setSearchParams: (p: SearchParams) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const JOURNEY_KEY = "cj_active_journey";
const SEARCH_KEY = "cj_search_params";

const defaultSearch: SearchParams = { country: "Pakistan", city: "Islamabad", category: "Dermatology", concern: "" };

export function AppProvider({ children }: { children: ReactNode }) {
  const [journey, setJourneyState] = useState<Journey | null>(() => {
    try {
      const raw = localStorage.getItem(JOURNEY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [searchParams, setSearchParamsState] = useState<SearchParams>(() => {
    try {
      const raw = localStorage.getItem(SEARCH_KEY);
      return raw ? JSON.parse(raw) : defaultSearch;
    } catch {
      return defaultSearch;
    }
  });

  const setJourney = useCallback((j: Journey) => {
    setJourneyState(j);
    localStorage.setItem(JOURNEY_KEY, JSON.stringify(j));
    localStorage.setItem(`journey_${j.id}`, JSON.stringify(j));
  }, []);

  const updateJourney = useCallback((updates: Partial<Journey>) => {
    setJourneyState((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
      localStorage.setItem(JOURNEY_KEY, JSON.stringify(updated));
      localStorage.setItem(`journey_${prev.id}`, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearJourney = useCallback(() => {
    setJourneyState(null);
    localStorage.removeItem(JOURNEY_KEY);
  }, []);

  const setSearchParams = useCallback((p: SearchParams) => {
    setSearchParamsState(p);
    localStorage.setItem(SEARCH_KEY, JSON.stringify(p));
  }, []);

  return (
    <AppContext.Provider value={{ journey, setJourney, updateJourney, clearJourney, searchParams, setSearchParams }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
