import { Link, useLocation, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";

const STEPS = [
  { key: "provider", label: "Provider selected" },
  { key: "visual", label: "Visual exploration" },
  { key: "info", label: "Information" },
  { key: "documents", label: "Documents" },
  { key: "consultation", label: "Consultation form" },
  { key: "request", label: "Request sent" },
  { key: "confirmed", label: "Confirmed" },
];

const COMPLETED_MAP: Record<string, string[]> = {
  draft: ["provider", "visual", "info"],
  documents: ["provider", "visual", "info"],
  consultation: ["provider", "visual", "info", "documents"],
  signing: ["provider", "visual", "info", "documents", "consultation"],
  requested: ["provider", "visual", "info", "documents", "consultation", "request"],
  confirmed: ["provider", "visual", "info", "documents", "consultation", "request", "confirmed"],
};

const CURRENT_MAP: Record<string, string> = {
  draft: "documents",
  documents: "documents",
  consultation: "consultation",
  signing: "consultation",
  requested: "request",
  confirmed: "confirmed",
};

export default function Sidebar() {
  const { journey } = useApp();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  if (!journey) return null;

  const journeyId = id || journey.id;
  const completed = COMPLETED_MAP[journey.status] || ["provider"];
  const current = CURRENT_MAP[journey.status] || "documents";

  const navLinks = [
    { to: `/journey/${journeyId}`, label: "Overview" },
    { to: `/journey/${journeyId}/documents`, label: "Documents" },
    { to: `/journey/${journeyId}/consultation`, label: "Consultation" },
    { to: `/journey/${journeyId}/request`, label: "Request" },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col min-h-full">
      {/* Journey header */}
      <div className="p-5 border-b border-border">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-2">Active Journey</p>
        <h3 className="text-[15px] font-semibold text-text leading-snug">{journey.providerName}</h3>
        <p className="text-small text-text-secondary mt-0.5">{journey.providerCity}, {journey.providerCountry}</p>
        <p className="text-small text-primary mt-1.5 font-medium">{journey.service}</p>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-0.5">
        {navLinks.map((link) => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-small font-medium transition-colors ${
                active
                  ? "bg-primary-soft text-primary"
                  : "text-text-secondary hover:text-text hover:bg-subtle"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Progress */}
      <div className="p-4 mt-auto">
        <div className="border-t border-border pt-4">
          <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-3">Progress</p>
          <div className="space-y-2.5">
            {STEPS.map((step) => {
              const done = completed.includes(step.key);
              const active = current === step.key && !done;
              return (
                <div key={step.key} className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    done
                      ? "bg-success"
                      : active
                      ? "border-2 border-primary bg-white"
                      : "border border-border bg-subtle"
                  }`}>
                    {done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {active && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <span className={`text-small ${done ? "text-success font-medium" : active ? "text-text font-semibold" : "text-text-secondary"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
