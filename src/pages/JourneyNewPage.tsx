import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { providerService, journeyService } from "../services";
import type { Provider } from "../types";

export default function JourneyNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setJourney, journey } = useApp();

  const providerId = searchParams.get("providerId") || "";
  const serviceParam = searchParams.get("service") || "";

  const [provider, setProvider] = useState<Provider | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (providerId) providerService.getProvider(providerId).then((p) => setProvider(p || null));
  }, [providerId]);

  useEffect(() => {
    if (journey && !providerId) navigate(`/journey/${journey.id}`);
  }, [journey, providerId, navigate]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = "Enter a valid email address";
    return errs;
  };

  const handleContinue = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    if (!provider) return;
    setSaving(true);
    try {
      const newJourney = await journeyService.create({
        providerId: provider.id,
        providerName: provider.name,
        providerCity: provider.city,
        providerCountry: provider.country,
        service: serviceParam || provider.services[0],
        patient: { name, email, phone, notes },
        docs: [],
        status: "draft",
      });
      setJourney(newJourney);
      navigate(`/journey/${newJourney.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-2">New Journey</p>
        <h1 className="text-page font-semibold text-text mb-2">Create your Journey</h1>
        <p className="text-body text-text-secondary">Enter your details to get started. No commitment required.</p>
      </div>

      {provider && (
        <div className="bg-primary-soft border border-primary/20 rounded-xl p-4 mb-8">
          <p className="text-label font-semibold uppercase tracking-wider text-primary mb-1.5">You're exploring</p>
          <p className="text-card font-semibold text-text">{provider.name}</p>
          <p className="text-small text-text-secondary mt-0.5">{provider.city}, {provider.country}</p>
          {serviceParam && <p className="text-small text-primary mt-2 font-medium">Service: {serviceParam}</p>}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-6 space-y-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
        <h2 className="text-section font-semibold text-text">Your information</h2>

        {[
          { id: "name", label: "Name", required: true, type: "text", value: name, onChange: (v: string) => { setName(v); setErrors((p) => ({ ...p, name: "" })); }, placeholder: "John Smith", error: errors.name },
          { id: "email", label: "Email", required: true, type: "email", value: email, onChange: (v: string) => { setEmail(v); setErrors((p) => ({ ...p, email: "" })); }, placeholder: "john@example.com", error: errors.email },
          { id: "phone", label: "Phone", required: false, type: "tel", value: phone, onChange: (v: string) => setPhone(v), placeholder: "+92 300 000 0000", error: "" },
        ].map((field) => (
          <div key={field.id}>
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5" htmlFor={field.id}>
              {field.label}{field.required && <span className="text-error ml-0.5">*</span>}
            </label>
            <input
              id={field.id}
              type={field.type}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              className={`w-full px-3 py-2.5 rounded-lg border text-body font-medium focus:outline-none focus:ring-2 transition ${
                field.error
                  ? "border-error bg-error-bg focus:ring-error/20"
                  : "border-border bg-background focus:ring-primary/20 focus:border-primary"
              }`}
            />
            {field.error && <p className="text-error text-small mt-1">{field.error}</p>}
          </div>
        ))}

        <div>
          <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5" htmlFor="notes">
            What would you like to discuss?
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Briefly describe your main concern or what you're hoping to explore..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
          />
        </div>

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {saving ? "Creating your journey..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
