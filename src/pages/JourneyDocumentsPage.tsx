import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { agentService, reviewService } from "../services";
import { displayLabel } from "../services/documentLabels";
import type { DocItem } from "../types";

type Stage = "agent" | "confirming" | "confirmation" | "upload" | "ready";

const PROCESSING_STEPS = [
  "File received",
  "Reading document",
  "Extracting information",
  "Preparing for consultation",
];

function DocStatusBadge({ status }: { status: DocItem["status"] }) {
  const map: Record<DocItem["status"], { label: string; cls: string }> = {
    waiting: { label: "Waiting", cls: "text-text-secondary bg-subtle" },
    uploaded: { label: "Uploaded", cls: "text-warning bg-warning-bg" },
    processing: { label: "Processing", cls: "text-warning bg-warning-bg" },
    ready: { label: "Ready", cls: "text-success bg-success-bg" },
    error: { label: "Error", cls: "text-error bg-error-bg" },
  };
  const { label, cls } = map[status];
  return <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${cls}`}>{label}</span>;
}

export default function JourneyDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const { journey, updateJourney } = useApp();
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>(() => {
    if (journey?.docs.length && journey.docs.every((d) => d.sealed)) return "ready";
    if (journey?.docs.length) return "upload";
    return "agent";
  });

  const [agentText, setAgentText] = useState("");
  const [agentError, setAgentError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<string, boolean>>({});
  const [sealing, setSealing] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Stop any in-flight polling when the page unmounts.
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (!journey || journey.id !== id) return <div className="p-8 text-text-secondary">Journey not found.</div>;

  const handleAgentSubmit = async () => {
    if (!agentText.trim()) { setAgentError("Please describe what documents you have."); return; }
    setAgentError("");
    setStage("confirming");
    try {
      const categories = await agentService.classify(id!, agentText);
      setPendingCategories(categories);
      setStage("confirmation");
    } catch {
      setAgentError("We couldn't understand that just now. Please try again.");
      setStage("agent");
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const docs = await agentService.confirm(id!, pendingCategories);
      updateJourney({ docs, status: "documents" });
      setStage("upload");
    } catch {
      setAgentError("We couldn't save that just now. Please try again.");
      setStage("confirmation");
    } finally {
      setConfirming(false);
    }
  };

  // Polls a single document's status every ~900ms until Foxit's job is done
  // or errors out, merging each update into the journey's docs. Reaching
  // "ready" here means Foxit has finished OCR/extract — it does NOT yet
  // advance the journey stage. That now waits for the separate Review &
  // Seal step below (Nutrient DWS), since a document isn't cleared to send
  // to the provider just because Foxit finished processing it.
  const pollDoc = useCallback((docId: string, currentDocs: DocItem[]) => {
    const tick = async () => {
      try {
        const updatedDoc = await agentService.getStatus(docId);
        const nextDocs = currentDocs.map((d) => (d.id === docId ? updatedDoc : d));
        updateJourney({ docs: nextDocs });

        if (updatedDoc.status === "ready" || updatedDoc.status === "error") {
          return;
        }
        pollTimers.current[docId] = setTimeout(() => pollDoc(docId, nextDocs), 900);
      } catch {
        setUploadError((prev) => ({ ...prev, [docId]: "We couldn't check on this document. Please try again." }));
      }
    };
    pollTimers.current[docId] = setTimeout(tick, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (docId: string, file: File) => {
    setUploadError((prev) => ({ ...prev, [docId]: "" }));
    try {
      const updatedDoc = await agentService.uploadFile(docId, file);
      const nextDocs = journey.docs.map((d) => (d.id === docId ? updatedDoc : d));
      updateJourney({ docs: nextDocs });
      pollDoc(docId, nextDocs);
    } catch {
      setUploadError((prev) => ({ ...prev, [docId]: "Upload failed. Please try again." }));
    }
  };

  // Review & Seal (Nutrient DWS) — runs once Foxit has a document ready.
  // Step 1: ask Nutrient what it would suggest redacting before this file
  // leaves the platform for the provider.
  const handleGetSuggestions = async (docId: string) => {
    setReviewError((prev) => ({ ...prev, [docId]: "" }));
    setSuggestionsLoading((prev) => ({ ...prev, [docId]: true }));
    try {
      const suggestions = await reviewService.getSuggestions(docId);
      const nextDocs = journey.docs.map((d) => (d.id === docId ? { ...d, redactions: suggestions } : d));
      updateJourney({ docs: nextDocs });
    } catch {
      setReviewError((prev) => ({ ...prev, [docId]: "We couldn't get suggestions just now. Please try again." }));
    } finally {
      setSuggestionsLoading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  // Step 2: the patient approves/rejects each suggestion locally before
  // committing anything — nothing is redacted until they confirm below.
  const handleToggleSuggestion = (docId: string, suggestionId: string) => {
    const nextDocs = journey.docs.map((d) => {
      if (d.id !== docId || !d.redactions) return d;
      return {
        ...d,
        redactions: d.redactions.map((r) => (r.id === suggestionId ? { ...r, approved: !r.approved } : r)),
      };
    });
    updateJourney({ docs: nextDocs });
  };

  // Step 3: apply only the approved redactions and seal (digitally sign)
  // the cleared copy. Once every document in the journey is sealed, the
  // journey is genuinely ready to move on — this replaces the old
  // "Foxit finished processing" trigger for advancing the stage.
  const handleSeal = async (docId: string) => {
    const doc = journey.docs.find((d) => d.id === docId);
    if (!doc?.redactions) return;
    const approvedIds = doc.redactions.filter((r) => r.approved).map((r) => r.id);

    setReviewError((prev) => ({ ...prev, [docId]: "" }));
    setSealing((prev) => ({ ...prev, [docId]: true }));
    try {
      const sealedDoc = await reviewService.seal(docId, approvedIds);
      const nextDocs = journey.docs.map((d) => (d.id === docId ? sealedDoc : d));
      const allSealed = nextDocs.every((d) => d.sealed);
      updateJourney({ docs: nextDocs, ...(allSealed ? { status: "consultation" } : {}) });
      if (allSealed) setStage("ready");
    } catch {
      setReviewError((prev) => ({ ...prev, [docId]: "We couldn't seal this document just now. Please try again." }));
    } finally {
      setSealing((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const currentDocs = journey.docs;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">Step · Documents</p>
        <h1 className="text-page font-semibold text-text mb-2">Prepare your documents</h1>
      </div>

      {/* Agent input */}
      {(stage === "agent" || stage === "confirming") && (
        <div className="space-y-6">
          <p className="text-body text-text-secondary">Tell us what documents you have. We'll help you organise them for your Journey.</p>
          <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-3">Tell us what you have</label>
            <textarea
              value={agentText}
              onChange={(e) => { setAgentText(e.target.value); setAgentError(""); }}
              placeholder="For example: I have a report from my dermatologist and a prescription."
              rows={4}
              disabled={stage === "confirming"}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
            />
            {agentError && <p className="text-error text-small mt-1">{agentError}</p>}
          </div>

          {stage === "confirming" && (
            <div className="flex items-center gap-3 text-small text-text-secondary">
              <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              Understanding your documents...
            </div>
          )}

          {stage === "agent" && (
            <div className="flex justify-end">
              <button
                onClick={handleAgentSubmit}
                className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation */}
      {stage === "confirmation" && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
          <p className="text-body text-text-secondary mb-4">I understand you have:</p>
          <div className="space-y-3 mb-6">
            {pendingCategories.map((category, i) => (
              <div key={`${category}_${i}`} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-body text-text font-medium">{displayLabel(category)}</span>
              </div>
            ))}
          </div>
          <p className="text-small text-text-secondary mb-5">I'll prepare these documents for your Journey.</p>
          {agentError && <p className="text-error text-small mb-4">{agentError}</p>}
          <p className="text-card font-semibold text-text mb-4">Is that correct?</p>
          <div className="flex gap-3">
            <button onClick={handleConfirm} disabled={confirming} className="px-5 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors">
              {confirming ? "Saving..." : "Yes, continue"}
            </button>
            <button onClick={() => { setPendingCategories([]); setStage("agent"); }} disabled={confirming} className="px-5 py-2.5 rounded-lg border border-border text-text-secondary text-small font-medium hover:bg-subtle disabled:opacity-60 transition-colors">
              Edit
            </button>
          </div>
        </div>
      )}

      {/* Upload */}
      {stage === "upload" && (
        <div className="space-y-4">
          <p className="text-body text-text-secondary">Upload your documents below. We'll process them for your journey.</p>
          {currentDocs.map((doc) => (
            <div key={doc.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-card font-semibold text-text">{doc.label}</p>
                  {doc.fileName && <p className="text-small text-text-secondary mt-0.5">{doc.fileName}</p>}
                </div>
                <DocStatusBadge status={doc.status} />
              </div>

              {doc.status === "waiting" && (
                <>
                  <input
                    ref={(el) => { fileRefs.current[doc.id] = el; }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    aria-label={`Upload ${doc.label}`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(doc.id, f); }}
                  />
                  <button
                    onClick={() => fileRefs.current[doc.id]?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-border text-small font-medium text-text-secondary hover:border-primary hover:text-primary hover:bg-primary-soft transition-colors"
                  >
                    Upload file
                  </button>
                  {uploadError[doc.id] && <p className="text-error text-small mt-2">{uploadError[doc.id]}</p>}
                </>
              )}

              {doc.status === "error" && (
                <>
                  <p className="text-error text-small mb-2">{uploadError[doc.id] || "Something went wrong processing this document."}</p>
                  <input
                    ref={(el) => { fileRefs.current[doc.id] = el; }}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    aria-label={`Retry upload for ${doc.label}`}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(doc.id, f); }}
                  />
                  <button
                    onClick={() => fileRefs.current[doc.id]?.click()}
                    className="w-full py-2.5 rounded-lg border border-dashed border-error text-small font-medium text-error hover:bg-error-bg transition-colors"
                  >
                    Try again
                  </button>
                </>
              )}

              {(doc.status === "uploaded" || doc.status === "processing") && (
                <div className="space-y-2 mt-2">
                  {PROCESSING_STEPS.map((step, i) => {
                    const done = i < (doc.processingStep || 0);
                    const active = i === (doc.processingStep || 0) - 1 && doc.status === "processing";
                    return (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-success" : active ? "border-2 border-primary animate-pulse" : "border border-border"}`}>
                          {done && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                        </div>
                        <span className={`text-small ${done ? "text-success font-medium" : active ? "text-text font-medium" : "text-text-secondary"}`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Review & Seal (Nutrient DWS) — appears once Foxit has finished
                  processing this document, before it can move on. */}
              {doc.status === "ready" && !doc.sealed && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-small font-semibold text-text">Review before sending</p>
                  </div>

                  {!doc.redactions && (
                    <>
                      <p className="text-small text-text-secondary mb-3">
                        Before this goes to your provider, we'll check it for anything sensitive that doesn't need to be shared.
                      </p>
                      <button
                        onClick={() => handleGetSuggestions(doc.id)}
                        disabled={suggestionsLoading[doc.id]}
                        className="w-full py-2.5 rounded-lg border border-primary text-primary text-small font-semibold hover:bg-primary-soft disabled:opacity-60 transition-colors"
                      >
                        {suggestionsLoading[doc.id] ? "Checking document..." : "Review with Nutrient DWS"}
                      </button>
                    </>
                  )}

                  {doc.redactions && (
                    <>
                      {doc.redactions.length === 0 ? (
                        <p className="text-small text-text-secondary mb-3">Nothing sensitive found — this document is ready to seal as-is.</p>
                      ) : (
                        <div className="space-y-2 mb-3">
                          <p className="text-small text-text-secondary mb-1">We suggest redacting:</p>
                          {doc.redactions.map((r) => (
                            <label key={r.id} className="flex items-start gap-2.5 py-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={r.approved}
                                onChange={() => handleToggleSuggestion(doc.id, r.id)}
                                className="mt-0.5 accent-primary"
                              />
                              <span className="text-small text-text flex-1">{r.label}</span>
                              <span className="text-[10px] text-text-secondary uppercase tracking-wider shrink-0 mt-0.5">{Math.round(r.confidence * 100)}% confident</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => handleSeal(doc.id)}
                        disabled={sealing[doc.id]}
                        className="w-full py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors"
                      >
                        {sealing[doc.id] ? "Sealing..." : "Confirm & Seal"}
                      </button>
                    </>
                  )}
                  {reviewError[doc.id] && <p className="text-error text-small mt-2">{reviewError[doc.id]}</p>}
                </div>
              )}

              {doc.sealed && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-small text-success font-medium">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Sealed by Nutrient DWS · tamper-evident copy
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ready */}
      {stage === "ready" && (
        <div className="space-y-6">
          <div className="bg-success-bg border border-success/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-card font-semibold text-text">Documents ready</h3>
            </div>
            <div className="space-y-3 mb-4">
              {journey.docs.map((doc) => (
                <div key={doc.id} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-success shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-small font-semibold text-text">{doc.label}</p>
                    {doc.fileName && <p className="text-small text-text-secondary">{doc.fileName}</p>}
                    {doc.sealed && (
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Sealed by Nutrient DWS{doc.sealedAt ? ` · ${new Date(doc.sealedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}` : ""}
                        {doc.sealId ? ` · ${doc.sealId}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-success bg-success-bg px-2.5 py-0.5 rounded-full shrink-0">Sealed</span>
                </div>
              ))}
            </div>
            <p className="text-small text-text-secondary">These documents are cleared, sealed, and attached to your Journey.</p>
          </div>
          <button
            onClick={() => navigate(`/journey/${id}/consultation`)}
            className="w-full py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors"
          >
            Continue to consultation
          </button>
        </div>
      )}
    </div>
  );
}
