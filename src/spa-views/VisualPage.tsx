import { useState, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
import { visualService } from "../services";

const EXPERIENCES = [
  "Skin Analysis Simulation",
  "Tone Correction Preview",
  "Treatment Visualisation",
];

const PROCESSING_STEPS = [
  "Preparing image",
  "Analysing features",
  "Applying experience",
  "Generating result",
];

type Stage = "upload" | "preview" | "processing" | "result";

export default function VisualPage() {
  const { journey, updateJourney } = useApp();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [experience, setExperience] = useState(EXPERIENCES[0]);
  const [processingStep, setProcessingStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSelectedFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setStage("preview");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleExplore = async () => {
    if (!selectedFile) return;
    setError("");
    setStage("processing");
    setProcessingStep(0);

    // Drive the step indicator visually while the real call is in flight.
    // These are cosmetic ticks, not a guarantee the backend is at that exact
    // stage — if Perfect Corp's flow is async, replace this with polling a
    // real job-status endpoint instead (see api/visual.ts).
    const tickTimers = PROCESSING_STEPS.map((_, i) =>
      setTimeout(() => setProcessingStep(i + 1), (i + 1) * 900)
    );

    try {
      const result = await visualService.explore(selectedFile, experience);
      setResultUrl(result.resultUrl);
      setStage("result");
    } catch (err) {
      tickTimers.forEach(clearTimeout);
      setError("We couldn't process your photo right now. Please try again.");
      setStage("preview");
    }
  };

  const handleSaveToJourney = () => {
    if (!journey) { navigate("/journey/new"); return; }
    updateJourney({
      visualSession: { originalUrl, resultUrl, experience, savedAt: new Date().toISOString() },
    });
    navigate(`/journey/${journey.id}`);
  };

  const handleTryAgain = () => {
    setOriginalUrl(""); setResultUrl(""); setStage("upload"); setProcessingStep(0);
    setSelectedFile(null); setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-10">
        {/* Lavender accent label — unique to this page */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lavender-bg border border-lavender-border mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-lavender" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-lavender">Visual Exploration</span>
        </div>
        <h1 className="text-page font-semibold text-text mb-2">Explore visually</h1>
        <p className="text-body text-text-secondary max-w-md">
          Upload one photo to explore a supported visual experience. For discussion purposes — not a medical prediction.
        </p>
      </div>

      {/* Upload */}
      {stage === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
            dragging ? "border-lavender bg-lavender-bg" : "border-border bg-background hover:border-lavender/60 hover:bg-lavender-bg/50"
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-lavender-bg border border-lavender-border flex items-center justify-center">
            <svg className="w-6 h-6 text-lavender" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-body font-semibold text-text mb-1">Upload your photo</p>
            <p className="text-small text-text-secondary">Drag &amp; drop or browse</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="px-5 py-2 rounded-lg border border-lavender text-lavender text-small font-semibold hover:bg-lavender-bg transition-colors"
          >
            Browse
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} aria-label="Upload photo" />
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && (
        <div className="space-y-6">
          <div>
            <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-3">Your photo</p>
            <div className="h-64 rounded-xl overflow-hidden bg-subtle border border-border">
              <img src={originalUrl} alt="Uploaded photo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-3">Choose an experience</p>
            <div className="space-y-2">
              {EXPERIENCES.map((exp) => (
                <label
                  key={exp}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                    experience === exp
                      ? "border-lavender bg-lavender-bg"
                      : "border-border bg-surface hover:border-lavender/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="experience"
                    value={exp}
                    checked={experience === exp}
                    onChange={() => setExperience(exp)}
                    className="accent-[#7C6FAD]"
                  />
                  <span className="text-small font-medium text-text">{exp}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-error text-small">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleExplore} className="flex-1 py-3 rounded-lg bg-lavender text-white font-semibold text-small hover:opacity-90 transition-opacity">
              Explore
            </button>
            <button onClick={handleTryAgain} className="px-5 py-3 rounded-lg border border-border text-text-secondary text-small font-medium hover:bg-subtle transition-colors">
              Change photo
            </button>
          </div>
        </div>
      )}

      {/* Processing */}
      {stage === "processing" && (
        <div className="text-center py-16 bg-lavender-bg border border-lavender-border rounded-xl">
          <div className="w-10 h-10 rounded-full border-2 border-lavender border-t-transparent animate-spin mx-auto mb-6" />
          <h3 className="text-section font-semibold text-text mb-1">Preparing your result</h3>
          <p className="text-small text-text-secondary mb-8">This may take a moment.</p>
          <div className="space-y-3 max-w-xs mx-auto text-left">
            {PROCESSING_STEPS.map((step, i) => {
              const done = i < processingStep;
              const active = i === processingStep - 1 && processingStep <= PROCESSING_STEPS.length;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-lavender" : active ? "border-2 border-lavender animate-pulse" : "border border-lavender-border bg-lavender-bg"}`}>
                    {done && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    {active && !done && <div className="w-2 h-2 rounded-full bg-lavender" />}
                  </div>
                  <span className={`text-small ${done ? "text-lavender font-medium" : active ? "text-text font-medium" : "text-text-secondary"}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result */}
      {stage === "result" && (
        <div className="space-y-6">
          <div>
            <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-3">Your result</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden border border-border">
              <div className="relative">
                <img src={originalUrl} alt="Original" className="w-full aspect-square object-cover" />
                <span className="absolute bottom-2 left-2 text-[9px] font-semibold uppercase tracking-wider bg-black/50 text-white px-1.5 py-0.5 rounded">Original</span>
              </div>
              <div className="relative">
                <img src={resultUrl} alt="Visual result" className="w-full aspect-square object-cover" />
                <span className="absolute bottom-2 left-2 text-[9px] font-semibold uppercase tracking-wider bg-black/50 text-white px-1.5 py-0.5 rounded">Result</span>
              </div>
            </div>
          </div>
          <div className="bg-lavender-bg border border-lavender-border rounded-xl p-4">
            <p className="text-small text-text-secondary leading-relaxed">
              <span className="font-semibold text-lavender">Visual exploration only.</span> This is for discussion purposes — not a medical prediction or guarantee of treatment outcomes.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveToJourney} className="flex-1 py-3 rounded-lg bg-primary text-white font-semibold text-small hover:bg-primary-hover transition-colors">
              Save to Journey
            </button>
            <button onClick={handleTryAgain} className="px-5 py-3 rounded-lg border border-border text-text-secondary text-small font-medium hover:bg-subtle transition-colors">
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
