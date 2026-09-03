import { useState } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { journey, clearJourney, updateJourney } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(journey?.patient.name || "");
  const [email, setEmail] = useState(journey?.patient.email || "");
  const [phone, setPhone] = useState(journey?.patient.phone || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (journey) {
      updateJourney({ patient: { ...journey.patient, name, email, phone } });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">Account</p>
        <h1 className="text-page font-semibold text-text">My Profile</h1>
      </div>

      <div className="space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4 bg-surface border border-border rounded-xl p-5">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shrink-0">
            {name ? name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <p className="text-card font-semibold text-text">{name || "Your Name"}</p>
            <p className="text-small text-text-secondary">{email || "your@email.com"}</p>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-card font-semibold text-text mb-4">Personal information</h2>
          <div className="space-y-4">
            {[
              { id: "name", label: "Name", type: "text", value: name, onChange: setName },
              { id: "email", label: "Email", type: "email", value: email, onChange: setEmail },
              { id: "phone", label: "Phone", type: "tel", value: phone, onChange: setPhone, placeholder: "+92 300 000 0000" },
            ].map((field) => (
              <div key={field.id}>
                <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5" htmlFor={field.id}>{field.label}</label>
                <input
                  id={field.id}
                  type={field.type}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder={"placeholder" in field ? field.placeholder : undefined}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>
            ))}
            <button
              onClick={handleSave}
              className={`px-5 py-2.5 rounded-lg text-small font-semibold transition-colors ${
                saved ? "bg-primary-soft text-primary" : "bg-primary text-white hover:bg-primary-hover"
              }`}
            >
              {saved ? "Saved" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Preferred locations */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-card font-semibold text-text mb-3">Preferred locations</h2>
          <div className="flex flex-wrap gap-2">
            {["Islamabad", "Lahore"].map((city) => (
              <span key={city} className="px-3 py-1.5 rounded-full bg-primary-soft text-primary text-small font-semibold border border-primary/20">
                {city}
              </span>
            ))}
            <button disabled title="Coming soon" className="px-3 py-1.5 rounded-full border border-dashed border-border text-text-secondary/50 text-small font-medium cursor-not-allowed">
              + Add location
            </button>
          </div>
          <p className="text-[11px] text-text-secondary/60 mt-2">Coming soon</p>
        </div>

        {/* Active journey */}
        {journey && (
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-card font-semibold text-text mb-3">Active Journey</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body font-semibold text-text">{journey.providerName}</p>
                <p className="text-small text-text-secondary">{journey.service}</p>
              </div>
              <button onClick={() => navigate(`/journey/${journey.id}`)} className="px-4 py-2 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors">
                View
              </button>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-card font-semibold text-text mb-3">Account settings</h2>
          <div className="space-y-2">
            {["Notification preferences", "Privacy settings"].map((s) => (
              <button key={s} disabled title="Coming soon" className="w-full text-left text-body text-text-secondary/50 py-1 cursor-not-allowed">{s} <span className="text-[11px]">(coming soon)</span></button>
            ))}
            {journey && (
              <button onClick={() => { clearJourney(); navigate("/"); }} className="w-full text-left text-body text-error hover:opacity-70 py-1 transition-colors">
                Clear journey data
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
