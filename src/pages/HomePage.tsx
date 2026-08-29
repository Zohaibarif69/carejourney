import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

const COUNTRIES = ["Pakistan", "UAE", "United Kingdom", "United States"];
const CITIES: Record<string, string[]> = {
  Pakistan: ["Islamabad", "Lahore", "Karachi", "Rawalpindi", "Peshawar"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah"],
  "United Kingdom": ["London", "Manchester", "Birmingham"],
  "United States": ["New York", "Los Angeles", "Chicago"],
};
const CATEGORIES = ["Dermatology", "Aesthetic", "Cosmetic", "Skin Care"];

export default function HomePage() {
  const navigate = useNavigate();
  const { searchParams, setSearchParams } = useApp();
  const [country, setCountry] = useState(searchParams.country);
  const [city, setCity] = useState(searchParams.city);
  const [category, setCategory] = useState(searchParams.category);
  const [concern, setConcern] = useState(searchParams.concern);

  const handleSearch = () => {
    setSearchParams({ country, city, category, concern });
    navigate("/search");
  };

  const cities = CITIES[country] || [];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-background">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-soft border border-primary/20 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Your healthcare journey starts here</span>
            </div>

            <h1 className="text-hero font-semibold text-text leading-tight mb-5 max-md:text-[40px] max-sm:text-[32px]">
              Find the right care.<br />
              Start your journey.
            </h1>
            <p className="text-body text-text-secondary leading-relaxed mb-10 max-w-md">
              Discover aesthetic and dermatology providers, explore your options, and prepare for your consultation — all in one place.
            </p>

            {/* Search form */}
            <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Country</label>
                  <select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setCity(CITIES[e.target.value]?.[0] || ""); }}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  >
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">City</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  >
                    {cities.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-2">What are you looking for?</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-small font-semibold border transition-colors ${
                        category === cat
                          ? "bg-primary text-white border-primary"
                          : "bg-background border-border text-text-secondary hover:border-primary hover:text-primary"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">
                  What's on your mind? <span className="normal-case font-medium text-text-secondary/70">(optional)</span>
                </label>
                <textarea
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="e.g. Persistent redness on my cheeks, looking for a gentle long-term plan"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-text text-small font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
                />
                <p className="text-[11px] text-text-secondary mt-1">Helps us explain why each provider may be a good fit for you.</p>
              </div>

              <button
                onClick={handleSearch}
                className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors"
              >
                Find Care
              </button>
            </div>
          </div>

          {/* Hero image */}
          <div className="hidden lg:block h-[480px] rounded-xl overflow-hidden bg-subtle">
            <img
              src="https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=700&h=900&fit=crop&auto=format"
              alt="Healthcare professional"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-border bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-14 text-center">How it works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                num: "01",
                title: "Discover",
                desc: "Find providers in your chosen location and care category. See why each provider may be relevant to your search.",
              },
              {
                num: "02",
                title: "Explore",
                desc: "Understand your options. Use our visual exploration tool to explore what a treatment might look like — for discussion, not prediction.",
              },
              {
                num: "03",
                title: "Start your Journey",
                desc: "Prepare your information, upload your documents, and complete your consultation form. Then send your request directly to the provider.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col gap-4">
                <span className="text-[40px] font-bold text-border leading-none">{step.num}</span>
                <h3 className="text-section font-semibold text-text">{step.title}</h3>
                <p className="text-small text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-16 bg-primary-soft border-t border-primary/10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-page font-semibold text-text mb-3">Your journey, organised in one place.</h2>
          <p className="text-body text-text-secondary max-w-md mx-auto leading-relaxed">
            From discovery to consultation request — CareJourney keeps every step clear, calm, and connected.
          </p>
        </div>
      </section>
    </div>
  );
}
