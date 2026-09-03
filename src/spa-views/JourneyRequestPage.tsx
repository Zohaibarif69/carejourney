import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { requestService } from "../services";

type Stage = "ready" | "submitting" | "requested" | "confirmed";

export default function JourneyRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { journey, updateJourney } = useApp();
  const navigate = useNavigate();

  const getInitialStage = (): Stage => {
    if (!journey) return "ready";
    if (journey.status === "confirmed") return "confirmed";
    if (journey.status === "requested") return "requested";
    return "ready";
  };

  const [stage, setStage] = useState<Stage>(getInitialStage);
  const [submittedAt, setSubmittedAt] = useState("");

  if (!journey || journey.id !== id) return <div className="p-8 text-text-secondary">Journey not found.</div>;

  if (!journey.signed && journey.status !== "requested" && journey.status !== "confirmed") {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-body text-text-secondary mb-4">Please complete and sign your consultation form first.</p>
        <button onClick={() => navigate(`/journey/${id}/consultation`)} className="px-5 py-2.5 rounded-lg bg-primary text-white text-small font-semibold">
          Go to Consultation
        </button>
      </div>
    );
  }

  const handleSend = async () => {
    setStage("submitting");
    const result = await requestService.submit(journey.id);
    setSubmittedAt(result.submittedAt);
    updateJourney({ status: "requested" });
    setStage("requested");
    setTimeout(async () => {
      await requestService.confirm(result.requestId);
      updateJourney({ status: "confirmed" });
      setStage("confirmed");
    }, 5000);
  };

  const attachments = [
    { label: "Consultation form", done: !!journey.signed },
    ...journey.docs.filter((d) => d.sealed).map((d) => ({ label: d.label, done: true, sealId: d.sealId })),
    ...(journey.visualSession ? [{ label: "Visual exploration", done: true }] : []),
  ];

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }); }
    catch { return iso; }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">Step · Request</p>
        <h1 className="text-page font-semibold text-text mb-2">
          {stage === "requested" || stage === "confirmed" ? "Consultation Request" : "Ready to send"}
        </h1>
      </div>

      {stage === "ready" && (
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
            <p className="text-card font-semibold text-text mb-0.5">{journey.providerName}</p>
            <p className="text-small text-text-secondary mb-3">{journey.providerCity}, {journey.providerCountry}</p>
            <p className="text-small text-primary font-semibold mb-5">{journey.service}</p>
            <p className="text-label font-semibold uppercase tracking-wider text-text-secondary mb-3">Attached</p>
            <div className="space-y-2.5">
              {attachments.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {item.done ? (
                    <svg className="w-4 h-4 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : <div className="w-4 h-4 rounded-full border border-border shrink-0" />}
                  <span className="text-body text-text">{item.label}</span>
                  {"sealId" in item && item.sealId && (
                    <span className="text-[10px] text-text-secondary ml-auto shrink-0" title={`Sealed by Nutrient DWS · ${item.sealId}`}>
                      🔒 Sealed
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-primary-soft border border-primary/10 rounded-xl p-4">
            <p className="text-body font-semibold text-text mb-1">Everything is ready.</p>
            <p className="text-small text-text-secondary">Sending this request shares your consultation information with the provider. They will contact you to confirm.</p>
          </div>
          <button onClick={handleSend} className="w-full py-3.5 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors">
            Send Consultation Request
          </button>
        </div>
      )}

      {stage === "submitting" && (
        <div className="text-center py-16 bg-surface border border-border rounded-xl">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-text-secondary">Sending your request...</p>
        </div>
      )}

      {(stage === "requested" || stage === "confirmed") && (
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5">
            <p className="text-card font-semibold text-text">{journey.providerName}</p>
            <p className="text-small text-text-secondary mt-0.5">{journey.service}</p>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
            <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-6">Status</p>
            <div className="space-y-5">
              {/* Requested */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className={`w-px flex-1 mt-1 ${stage === "confirmed" ? "bg-success" : "bg-border"}`} style={{ height: "2rem" }} />
                </div>
                <div>
                  <p className="text-card font-semibold text-text">Requested</p>
                  {submittedAt && <p className="text-small text-text-secondary mt-0.5">{formatTime(submittedAt)}</p>}
                </div>
              </div>

              {/* Confirmed */}
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage === "confirmed" ? "bg-success" : "border-2 border-border bg-subtle"}`}>
                  {stage === "confirmed" ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : <div className="w-2.5 h-2.5 rounded-full bg-border" />}
                </div>
                <div>
                  <p className={`text-card font-semibold ${stage === "confirmed" ? "text-text" : "text-text-secondary"}`}>Confirmed</p>
                  {stage === "confirmed" && <p className="text-small text-success font-medium mt-0.5">Provider confirmed your request</p>}
                  {stage === "requested" && <p className="text-small text-text-secondary animate-pulse mt-0.5">Waiting for provider...</p>}
                </div>
              </div>
            </div>
          </div>

          {stage === "confirmed" && (
            <div className="bg-success-bg border border-success/20 rounded-xl p-5 text-center">
              <p className="text-section font-semibold text-text mb-1">All done.</p>
              <p className="text-body text-text-secondary mb-4">The provider will be in touch with next steps.</p>
              <button onClick={() => navigate(`/journey/${id}`)} className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors">
                View my Journey
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
