import { Link, useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import JourneyStepper from "../components/JourneyStepper";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "In Progress", cls: "text-warning bg-warning-bg" },
  documents: { label: "Documents", cls: "text-warning bg-warning-bg" },
  consultation: { label: "Consultation", cls: "text-primary bg-primary-soft" },
  signing: { label: "Signing", cls: "text-primary bg-primary-soft" },
  requested: { label: "Requested", cls: "text-info bg-info-bg" },
  confirmed: { label: "Confirmed", cls: "text-success bg-success-bg" },
};

export default function JourneyDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { journey, clearJourney } = useApp();
  const navigate = useNavigate();

  if (!journey || journey.id !== id) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-body text-text-secondary mb-4">Journey not found.</p>
        <Link to="/" className="text-primary text-small underline">Go home</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[journey.status] || STATUS_BADGE.draft;
  const docsCount = journey.docs.filter((d) => d.status === "ready").length;
  const isLocked = (key: string) => {
    if (key === "consultation") return journey.status === "draft" || journey.status === "documents";
    if (key === "request") return journey.status !== "signing" && journey.status !== "requested" && journey.status !== "confirmed";
    return false;
  };

  const cards = [
    {
      key: "documents",
      title: "Documents",
      desc: "Add your previous reports, prescriptions, or other medical documents.",
      stat: docsCount > 0 ? `${docsCount} document${docsCount !== 1 ? "s" : ""} added` : "No documents yet",
      to: `/journey/${id}/documents`,
      complete: ["consultation", "signing", "requested", "confirmed"].includes(journey.status),
    },
    {
      key: "consultation",
      title: "Consultation form",
      desc: "Complete the information required by your selected provider.",
      stat: ["consultation", "signing"].includes(journey.status) ? "Form ready to complete" : "",
      to: `/journey/${id}/consultation`,
      complete: ["signing", "requested", "confirmed"].includes(journey.status),
    },
    {
      key: "request",
      title: "Send request",
      desc: "Review your consultation package and send it to the provider.",
      stat: journey.status === "confirmed" ? "Confirmed by provider" : journey.status === "requested" ? "Request submitted" : "",
      to: `/journey/${id}/request`,
      complete: ["requested", "confirmed"].includes(journey.status),
    },
    {
      key: "foxit-agent",
      title: "Foxit document agent (bonus)",
      desc: "Ask an AI agent to merge, convert, compress, or OCR your documents with Foxit's real tools — then send the result for signature as a separate, human-triggered step.",
      stat: "",
      to: `/journey/${id}/agent`,
      complete: false,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">My Journey</p>
          <h1 className="text-page font-semibold text-text">{journey.providerName}</h1>
          <p className="text-body text-text-secondary mt-0.5">{journey.providerCity}, {journey.providerCountry}</p>
          <p className="text-small text-primary font-medium mt-1">{journey.service}</p>
        </div>
        <span className={`text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full shrink-0 ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Stepper */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6 overflow-x-auto shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-5">Your Journey</p>
        <div className="hidden md:block">
          <JourneyStepper status={journey.status} orientation="horizontal" />
        </div>
        <div className="md:hidden">
          <JourneyStepper status={journey.status} orientation="vertical" />
        </div>
      </div>

      {/* Visual session */}
      {journey.visualSession && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-card font-semibold text-text">Visual Exploration</p>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success-bg px-2.5 py-0.5 rounded-full">Saved</span>
          </div>
          <div className="grid grid-cols-2 gap-2 h-28 rounded-lg overflow-hidden">
            <img src={journey.visualSession.originalUrl} alt="Original" className="w-full h-full object-cover" />
            <img src={journey.visualSession.resultUrl} alt="Result" className="w-full h-full object-cover" />
          </div>
          <p className="text-small text-text-secondary mt-2">{journey.visualSession.experience}</p>
        </div>
      )}

      {/* Action cards */}
      <div className="space-y-4 mb-8">
        <h2 className="text-section font-semibold text-text">Continue your Journey</h2>
        {cards.map((card) => {
          const locked = isLocked(card.key);
          return (
            <div
              key={card.key}
              className={`bg-surface border rounded-xl p-5 transition-colors ${
                card.complete ? "border-success/30 bg-success-bg/20" : locked ? "border-border opacity-60" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {card.complete && (
                      <svg className="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <p className="text-card font-semibold text-text">{card.title}</p>
                  </div>
                  <p className="text-small text-text-secondary mb-2">{card.desc}</p>
                  {card.stat && <p className="text-small text-primary font-medium">{card.stat}</p>}
                </div>
                <div className="shrink-0">
                  {locked ? (
                    <div className="flex items-center gap-1.5 text-text-secondary text-small">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Locked
                    </div>
                  ) : (
                    <Link
                      to={card.to}
                      className="px-4 py-2 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors"
                    >
                      {card.complete ? "Review" : "Continue"}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmed state */}
      {journey.status === "confirmed" && (
        <div className="bg-success-bg border border-success/20 rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-section font-semibold text-text mb-2">Journey complete</h3>
          <p className="text-small text-text-secondary">Your consultation request has been confirmed by {journey.providerName}.</p>
          <div className="flex justify-center gap-10 mt-5 text-center">
            <div><p className="text-label font-semibold uppercase tracking-wider text-text-secondary">Documents</p><p className="text-card font-semibold text-text mt-0.5">{docsCount}</p></div>
            <div><p className="text-label font-semibold uppercase tracking-wider text-text-secondary">Visual</p><p className="text-card font-semibold text-text mt-0.5">{journey.visualSession ? "1" : "0"}</p></div>
            <div><p className="text-label font-semibold uppercase tracking-wider text-text-secondary">Status</p><p className="text-card font-semibold text-success mt-0.5">Confirmed</p></div>
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <button
          onClick={() => { clearJourney(); navigate("/"); }}
          className="text-small text-text-secondary hover:text-error transition-colors"
        >
          Clear journey data
        </button>
      </div>
    </div>
  );
}
