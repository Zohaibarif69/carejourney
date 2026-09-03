import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { providerService } from "../services";
import type { Provider } from "../types";
import ProviderCard from "../components/ProviderCard";

const COUNTRIES = ["Pakistan", "UAE", "United Kingdom", "United States"];
const CITIES: Record<string, string[]> = {
  Pakistan: ["Islamabad", "Lahore", "Karachi", "Rawalpindi", "Peshawar"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah"],
  "United Kingdom": ["London", "Manchester", "Birmingham"],
  "United States": ["New York", "Los Angeles", "Chicago"],
};
const CATEGORIES = ["Dermatology", "Aesthetic", "Cosmetic", "Skin Care"];

export default function SearchPage() {
  const { searchParams, setSearchParams } = useApp();
  const [country, setCountry] = useState(searchParams.country);
  const [city, setCity] = useState(searchParams.city);
  const [category, setCategory] = useState(searchParams.category);
  const [concern, setConcern] = useState(searchParams.concern);
  const [sort, setSort] = useState("Recommended");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    setError("");
    try {
      const results = await providerService.search(country, city, category, concern);
      setProviders(results);
      setSearched(true);
    } catch {
      setError("We couldn't load providers right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runSearch(); }, []);

  const handleSearch = () => {
    setSearchParams({ country, city, category, concern });
    runSearch();
  };

  const cities = CITIES[country] || [];

  const sorted = [...providers].sort((a, b) => {
    if (sort === "Rating") return (b.rating || 0) - (a.rating || 0);
    if (sort === "Name A–Z") return a.name.localeCompare(b.name);
    const order = { Strong: 0, Good: 1, Possible: 2 };
    return order[a.matchStrength] - order[b.matchStrength];
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Controls */}
      <div className="mb-10">
        <h1 className="text-page font-semibold text-text mb-6">Find care in</h1>
        <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Country</label>
              <select
                value={country}
                onChange={(e) => { setCountry(e.target.value); setCity(CITIES[e.target.value]?.[0] || ""); }}
                className="px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              >
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              >
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Looking for</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors"
            >
              Search
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">
              What's on your mind? <span className="normal-case font-medium text-text-secondary/70">(optional — refines match reasons)</span>
            </label>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="e.g. Persistent redness on my cheeks, looking for a gentle long-term plan"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-small text-text-secondary">Finding providers...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-20">
          <p className="text-body text-text-secondary mb-4">{error}</p>
          <button onClick={runSearch} className="px-5 py-2.5 rounded-lg bg-primary text-white text-small font-semibold">Try again</button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && searched && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-small text-text-secondary">
              <span className="font-semibold text-text">{sorted.length}</span> providers found in {city}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary">Sort:</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none"
              >
                {["Recommended", "Rating", "Name A–Z"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-xl">
              <p className="text-body text-text-secondary mb-1">No providers found in this location.</p>
              <p className="text-small text-text-secondary">Try another city or category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((p) => <ProviderCard key={p.id} provider={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
