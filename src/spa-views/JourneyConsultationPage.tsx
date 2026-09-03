import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { consultationService } from "../services";
import type { FormSection, ConsultationAnswers } from "../types";

type Stage = "loading" | "form" | "review" | "signing" | "signed";

export default function JourneyConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const { journey, updateJourney } = useApp();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>(() => {
    if (!journey) return "loading";
    if (journey.signed) return "signed";
    if (journey.status === "signing") return "signing";
    if (journey.consultationAnswers) return "review";
    return "loading";
  });

  const [schema, setSchema] = useState<FormSection[]>([]);
  const [answers, setAnswers] = useState<ConsultationAnswers>(journey?.consultationAnswers || {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState("");
  const [signingUrl, setSigningUrl] = useState("");

  useEffect(() => {
    if (!journey || journey.id !== id || schema.length > 0) return;
    consultationService.generate(id!).then((s) => {
      setSchema(s);
      setAnswers((prev) => ({
        name: journey.patient.name,
        email: journey.patient.email,
        phone: journey.patient.phone,
        concern: journey.patient.notes,
        ...prev,
      }));
      setStage("form");
    });
  }, [journey?.id, id]);

  if (!journey || journey.id !== id) return <div className="p-8 text-text-secondary">Journey not found.</div>;

  if (journey.status === "draft" || journey.status === "documents") {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="w-12 h-12 rounded-full bg-subtle border border-border flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <p className="text-body text-text-secondary mb-4">Complete the documents step first.</p>
        <button onClick={() => navigate(`/journey/${id}/documents`)} className="px-5 py-2.5 rounded-lg bg-primary text-white text-small font-semibold">
          Go to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">Step · Consultation</p>
        <h1 className="text-page font-semibold text-text mb-2">Your consultation form</h1>
        {stage === "form" && <p className="text-body text-text-secondary">We've prepared this form using the information from your Journey.</p>}
      </div>

      {/* Loading */}
      {stage === "loading" && (
        <div className="text-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-small text-text-secondary">Preparing your form...</p>
        </div>
      )}

      {/* Form */}
      {stage === "form" && schema.length > 0 && (
        <div className="space-y-6">
          {/* Provider info */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h3 className="text-card font-semibold text-text mb-3">Selected provider</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-label font-semibold uppercase tracking-wider text-text-secondary mb-1">Provider</p>
                <p className="text-body font-medium text-text">{journey.providerName}</p>
              </div>
              <div>
                <p className="text-label font-semibold uppercase tracking-wider text-text-secondary mb-1">Service</p>
                <p className="text-body font-medium text-text">{journey.service}</p>
              </div>
            </div>
          </div>

          {schema.map((section) => (
            <div key={section.id} className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-card font-semibold text-text mb-4">{section.title}</h3>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.id}>
                    <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5" htmlFor={field.id}>
                      {field.label}{field.required && <span className="text-error ml-0.5">*</span>}
                    </label>
                    {field.type === "text" && (
                      <input id={field.id} type="text" value={answers[field.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
                    )}
                    {field.type === "textarea" && (
                      <textarea id={field.id} value={answers[field.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))} rows={3}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none" />
                    )}
                    {field.type === "radio" && field.options && (
                      <div className="flex flex-wrap gap-2">
                        {field.options.map((opt) => (
                          <label key={opt} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-small font-medium ${answers[field.id] === opt ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary hover:border-primary/40"}`}>
                            <input type="radio" name={field.id} value={opt} checked={answers[field.id] === opt} onChange={() => setAnswers((p) => ({ ...p, [field.id]: opt }))} className="accent-primary" />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                    {field.type === "select" && field.options && (
                      <select id={field.id} value={answers[field.id] || ""} onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition">
                        <option value="">Select...</option>
                        {field.options.map((opt) => <option key={opt}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={async () => {
              setSaving(true);
              setSaveError("");
              try {
                await consultationService.saveAnswers(id!, answers);
                updateJourney({ consultationAnswers: answers, status: "signing" });
                setStage("review");
              } catch {
                setSaveError("We couldn't save your answers just now. Please try again.");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover disabled:opacity-60 transition-colors">
            {saving ? "Saving..." : "Review consultation form"}
          </button>
          {saveError && <p className="text-error text-small text-center">{saveError}</p>}
        </div>
      )}

      {/* Review */}
      {stage === "review" && (
        <div className="space-y-4">
          <p className="text-body text-text-secondary mb-2">Review everything before signing.</p>
          {[
            { label: "Patient information", done: true },
            { label: "Provider information", done: true },
            { label: "Treatment information", done: true },
            { label: "Documents", done: journey.docs.some((d) => d.status === "ready") },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
              <span className="text-body font-medium text-text">{item.label}</span>
              {item.done ? (
                <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : <span className="text-label font-semibold uppercase tracking-wider text-text-secondary">Incomplete</span>}
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStage("form")} className="px-5 py-2.5 rounded-lg border border-border text-text-secondary text-small font-medium hover:bg-subtle transition-colors">Edit</button>
            <button onClick={() => setStage("signing")} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors">Continue to Sign</button>
          </div>
        </div>
      )}

      {/* Signing */}
      {stage === "signing" && (
        <div className="bg-surface border border-border rounded-xl p-8 text-center shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
          <div className="w-12 h-12 rounded-full bg-subtle border border-border flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
          </div>
          <h3 className="text-section font-semibold text-text mb-2">Complete your consultation form</h3>
          <p className="text-body text-text-secondary mb-8 max-w-sm mx-auto">Your consultation document is ready. Please review and sign it to continue.</p>
          {signError && <p className="text-error text-small mb-4">{signError}</p>}

          {!signingUrl && (
            <button
              onClick={async () => {
                setSigning(true);
                setSignError("");
                try {
                  const result = await consultationService.sign(id!);
                  if (result.signingUrl) {
                    // Doctavian returned a hosted signing session — open it and
                    // let the patient confirm here once they're done there,
                    // rather than assuming it's signed the instant we get a URL.
                    setSigningUrl(result.signingUrl);
                    window.open(result.signingUrl, "_blank", "noopener,noreferrer");
                  } else {
                    updateJourney({ signed: true, signedAt: result.signedAt || new Date().toISOString(), status: "signing" });
                    setStage("signed");
                  }
                } catch {
                  setSignError("We couldn't start signing just now. Please try again.");
                } finally {
                  setSigning(false);
                }
              }}
              disabled={signing}
              className="px-8 py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover disabled:opacity-60 transition-colors"
            >
              {signing ? <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Opening...</span> : "Open & Sign"}
            </button>
          )}

          {signingUrl && (
            <div className="space-y-4">
              <p className="text-small text-text-secondary">
                We opened your signing document in a new tab. Once you've finished signing there, confirm below.
              </p>
              <div className="flex items-center justify-center gap-3">
                <a href={signingUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-lg border border-border text-text-secondary text-small font-medium hover:bg-subtle transition-colors">
                  Reopen signing tab
                </a>
                <button
                  onClick={() => {
                    updateJourney({ signed: true, signedAt: new Date().toISOString(), status: "signing" });
                    setStage("signed");
                  }}
                  className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors"
                >
                  I've signed it
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signed */}
      {stage === "signed" && (
        <div className="space-y-6">
          <div className="bg-success-bg border border-success/20 rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-card font-semibold text-text">Document signed</p>
              <p className="text-small text-text-secondary">Your consultation form is complete.</p>
            </div>
          </div>
          <button onClick={() => navigate(`/journey/${id}/request`)} className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors">
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
