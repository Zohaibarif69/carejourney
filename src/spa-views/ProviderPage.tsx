import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { providerService } from "../services";
import type { Provider } from "../types";
import { useApp } from "../context/AppContext";

export default function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { journey } = useApp();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState("");

  useEffect(() => {
    if (!id) return;
    providerService.getProvider(id).then((p) => {
      if (p) { setProvider(p); setSelectedService(p.services[0]); }
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!provider) return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-text-secondary">Provider not found.</p>
      <Link to="/search" className="mt-4 inline-block text-primary text-small underline">Back to results</Link>
    </div>
  );

  const hasActiveJourneyHere = journey?.providerId === provider.id;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link to="/search" className="inline-flex items-center gap-1.5 text-small font-medium text-text-secondary hover:text-text mb-8 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to results
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main info */}
        <div className="lg:col-span-2">
          <div className="h-64 rounded-xl overflow-hidden bg-subtle mb-6">
            <img src={provider.imageUrl} alt={provider.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {provider.specialties.map((s) => (
              <span key={s} className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary-soft text-primary border border-primary/20">
                {s}
              </span>
            ))}
          </div>

          <h1 className="text-page font-semibold text-text mb-2">{provider.name}</h1>
          <p className="text-body text-text-secondary mb-2">{provider.city}, {provider.country}</p>

          {provider.rating && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((star) => (
                  <svg key={star} className={`w-4 h-4 ${star <= Math.round(provider.rating!) ? "text-warning fill-current" : "text-border fill-current"}`} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-small text-text-secondary">{provider.rating} ({provider.reviewCount} reviews)</span>
            </div>
          )}
        </div>

        {/* CTA card */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-surface border border-border rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
            {hasActiveJourneyHere && (
              <div className="mb-4 p-3 rounded-lg bg-primary-soft border border-primary/20">
                <p className="text-small text-primary font-semibold">You have an active journey with this provider.</p>
              </div>
            )}
            <p className="text-label font-semibold uppercase tracking-wider text-text-secondary mb-2">Select a service</p>
            <div className="space-y-2 mb-5">
              {provider.services.map((service) => (
                <label
                  key={service}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedService === service ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="service"
                    value={service}
                    checked={selectedService === service}
                    onChange={() => setSelectedService(service)}
                    className="accent-primary"
                  />
                  <span className="text-small font-medium text-text">{service}</span>
                </label>
              ))}
            </div>
            {hasActiveJourneyHere ? (
              <Link
                to={`/journey/${journey!.id}`}
                className="block w-full text-center py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors"
              >
                Go to My Journey
              </Link>
            ) : (
              <button
                onClick={() => navigate(`/journey/new?providerId=${provider.id}&service=${encodeURIComponent(selectedService)}`)}
                className="block w-full text-center py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors"
              >
                Start My Journey
              </button>
            )}
            <p className="text-[11px] text-text-secondary text-center mt-3">No commitment required</p>
          </div>
        </div>
      </div>

      {/* About + Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
        <section>
          <h2 className="text-section font-semibold text-text mb-3">About</h2>
          <p className="text-body text-text-secondary leading-relaxed">{provider.description}</p>
        </section>
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Services</h2>
          <ul className="space-y-2">
            {provider.services.map((s) => (
              <li key={s} className="flex items-center gap-2.5 text-body text-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Match explanation */}
      <section className="bg-background border border-border rounded-xl p-6 mb-10">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-3">Why this may be relevant</p>
        <div className="space-y-2.5">
          {provider.matchReasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-success mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-body text-text-secondary">{reason}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-secondary/60 mt-4 border-t border-border pt-3">
          This information helps organise your search — not a medical recommendation.
        </p>
      </section>

      {/* Contact + Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Contact</h2>
          <div className="space-y-2 text-body text-text-secondary">
            <p>Phone: {provider.phone}</p>
            <p>Website: {provider.website}</p>
          </div>
        </section>
        <section>
          <h2 className="text-section font-semibold text-text mb-3">Location</h2>
          <div className="h-32 rounded-xl bg-subtle border border-border flex items-center justify-center">
            <p className="text-small text-text-secondary">{provider.city}, {provider.country}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
