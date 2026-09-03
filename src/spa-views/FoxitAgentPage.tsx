import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { foxitAgentService } from "../services";
import type { AgentStep } from "../types";

function examplePromptsFor(fileUrl: string, absoluteBase: string) {
  const url = `${absoluteBase}${fileUrl}`;
  return [
    `Compress this PDF and OCR the result: ${url}`,
    `Convert this document to PDF and tell me how many pages it has: ${url}`,
    `Extract the text from this document: ${url}`,
  ];
}

function StepRow({ step }: { step: AgentStep }) {
  if (step.type === "final_text") {
    return (
      <div className="flex gap-3 py-2.5">
        <div className="w-6 h-6 rounded-full bg-success-bg flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5 text-success" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-small text-text leading-relaxed pt-0.5">{step.content}</p>
      </div>
    );
  }

  const isCall = step.type === "tool_call";
  return (
    <div className="flex gap-3 py-2.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCall ? "bg-primary-soft" : "bg-subtle"}`}>
        <span className={`text-[10px] font-bold ${isCall ? "text-primary" : "text-text-secondary"}`}>{isCall ? "→" : "←"}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-small font-semibold text-text">
          {isCall ? `Calling ${step.toolName}` : `Result from ${step.toolName}`}
        </p>
        <pre className="text-[11px] text-text-secondary mt-1 whitespace-pre-wrap break-words font-mono bg-subtle rounded-md px-2.5 py-2 max-h-32 overflow-y-auto">
          {isCall ? JSON.stringify(step.toolInput, null, 2) : step.content}
        </pre>
      </div>
    </div>
  );
}

export default function FoxitAgentPage() {
  const { id } = useParams<{ id: string }>();
  const { journey } = useApp();

  // ── Agent loop (reversible tools only) ──────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [finalText, setFinalText] = useState("");

  // File the agent will actually act on. The example prompts below only ever
  // reference this file's real public URL — never a vague "my uploaded
  // documents" the agent has no way to resolve.
  const [attachedFileUrl, setAttachedFileUrl] = useState("");
  const [attachedFileName, setAttachedFileName] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState("");

  const attachFile = async (file: File) => {
    setAttaching(true);
    setAttachError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      setAttachedFileUrl(data.url);
      setAttachedFileName(data.fileName);
      setDocumentPublicUrl((prev) => prev || `${absoluteBase}${data.url}`);
      setDocumentFileName((prev) => prev || data.fileName);
    } catch (e) {
      setAttachError(
        e instanceof Error ? e.message : "Couldn't attach that file. Try a smaller PDF."
      );
    } finally {
      setAttaching(false);
    }
  };

  const absoluteBase = typeof window !== "undefined" ? window.location.origin : "";
  const examplePrompts = attachedFileUrl ? examplePromptsFor(attachedFileUrl, absoluteBase) : [];

  const runAgent = async () => {
    if (!prompt.trim()) { setAgentError("Describe what you'd like the agent to do."); return; }
    setAgentError("");
    setRunning(true);
    setSteps([]);
    setFinalText("");
    try {
      const result = await foxitAgentService.runAgent(prompt);
      setSteps(result.steps);
      setFinalText(result.finalText);
    } catch (e) {
      setAgentError(
        e instanceof Error
          ? e.message
          : "The agent couldn't run just now. Make sure the Foxit MCP sidecar is running (npm run dev starts it automatically)."
      );
    } finally {
      setRunning(false);
    }
  };

  // ── Human-triggered signature handoff ────────────────────────────────────
  const [folderName, setFolderName] = useState(journey ? `Consent — ${journey.service}` : "");
  const [documentPublicUrl, setDocumentPublicUrl] = useState("");
  const [documentFileName, setDocumentFileName] = useState("");
  const [signerFirstName, setSignerFirstName] = useState(journey?.patient.name.split(" ")[0] ?? "");
  const [signerLastName, setSignerLastName] = useState(journey?.patient.name.split(" ").slice(1).join(" ") ?? "");
  const [signerEmail, setSignerEmail] = useState(journey?.patient.email ?? "");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [folderId, setFolderId] = useState("");

  const sendForSignature = async () => {
    if (!folderName || !documentPublicUrl || !documentFileName || !signerFirstName || !signerLastName || !signerEmail) {
      setSendError("Fill in every field — this call goes straight to Foxit's real eSign API.");
      return;
    }
    setSendError("");
    setSending(true);
    setFolderId("");
    try {
      const result = await foxitAgentService.sendForSignature({
        folderName,
        documentPublicUrl,
        documentFileName,
        parties: [{ firstName: signerFirstName, lastName: signerLastName, emailId: signerEmail }],
      });
      setFolderId(result.folderId);
    } catch (e) {
      setSendError(
        e instanceof Error
          ? e.message
          : "Couldn't reach Foxit eSign. Note: the document URL must be publicly reachable — Foxit's servers fetch it over the internet, so a localhost URL will fail."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        {id && (
          <Link to={`/journey/${id}`} className="text-small text-text-secondary hover:text-primary transition-colors inline-flex items-center gap-1 mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Journey
          </Link>
        )}
        <p className="text-label font-semibold uppercase tracking-widest text-text-secondary mb-1">Bonus · Foxit</p>
        <h1 className="text-page font-semibold text-text mb-2">Document agent & signing handoff</h1>
        <p className="text-body text-text-secondary">
          Two separate things happen on this page, deliberately. The agent below can call any of Foxit's
          real, reversible PDF tools on its own. Sending something for an actual signature is a different
          call, with different credentials, that only happens when a person clicks the button in the second
          section — the agent can never trigger it itself.
        </p>
      </div>

      {/* ── Section A: agent loop ─────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)] mb-8">
        <h2 className="text-card font-semibold text-text mb-1">Ask the document agent</h2>
        <p className="text-small text-text-secondary mb-4">
          Connects to Foxit's live MCP server and lets the agent pick from its real tool catalog — merge,
          convert, compress, OCR, extract. No signing tool exists in this catalog on purpose.
        </p>

        {/* Step 1: attach a real file, so the agent has something real to act on */}
        <div className="mb-4">
          <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">
            1. Attach a file
          </label>
          {!attachedFileUrl ? (
            <label className="flex items-center justify-center gap-2 w-full px-3 py-4 rounded-lg border-2 border-dashed border-border text-small text-text-secondary hover:border-primary hover:text-primary cursor-pointer transition-colors">
              {attaching ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Uploading...
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  Click to upload a PDF for the agent to work on
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={attaching}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) attachFile(f); }}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-success/30 bg-success-bg">
              <span className="text-small text-text truncate">
                📄 {attachedFileName} <span className="text-text-secondary">— attached, ready for the agent</span>
              </span>
              <button
                onClick={() => { setAttachedFileUrl(""); setAttachedFileName(""); }}
                className="text-[11px] font-medium text-text-secondary hover:text-primary shrink-0 ml-3"
              >
                Change
              </button>
            </div>
          )}
          {attachError && <p className="text-error text-small mt-1.5">{attachError}</p>}
        </div>

        {/* Step 2: describe what the agent should do to it */}
        <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">
          2. Tell the agent what to do
        </label>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setAgentError(""); }}
          placeholder={attachedFileUrl ? "e.g. Compress this PDF and OCR the result." : "Attach a file above first, then describe what to do with it."}
          rows={3}
          disabled={running}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none mb-3"
        />

        {attachedFileUrl && (
          <div className="flex flex-wrap gap-2 mb-4">
            {examplePrompts.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                disabled={running}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {ex.split(":")[0]}
              </button>
            ))}
          </div>
        )}

        {agentError && <p className="text-error text-small mb-3">{agentError}</p>}

        <button
          onClick={runAgent}
          disabled={running}
          className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Running agent...
            </span>
          ) : (
            "Run agent"
          )}
        </button>

        {steps.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border divide-y divide-border/60">
            {steps.map((step, i) => <StepRow key={i} step={step} />)}
          </div>
        )}

        {finalText && !steps.some((s) => s.type === "final_text") && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-small text-text leading-relaxed">{finalText}</p>
          </div>
        )}
      </div>

      {/* ── Section B: human-triggered signature ──────────────────────────── */}
      <div className="bg-surface border-2 border-primary/20 rounded-xl p-5 shadow-[0_4px_20px_rgba(23,32,31,0.06)]">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
          <h2 className="text-card font-semibold text-text">Send for signature — a person does this</h2>
        </div>
        <p className="text-small text-text-secondary mb-4">
          This calls Foxit's real eSign API directly, with its own OAuth2 credentials — completely separate
          from the MCP tool catalog above. The document URL must be publicly reachable; Foxit's servers fetch
          it over the internet.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Folder name</label>
            <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Consent — Dermatology consultation"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
          <div>
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Document public URL</label>
            <input value={documentPublicUrl} onChange={(e) => setDocumentPublicUrl(e.target.value)} placeholder="https://your-public-url.com/uploads/sample.pdf"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
          <div>
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Document file name</label>
            <input value={documentFileName} onChange={(e) => setDocumentFileName(e.target.value)} placeholder="sample.pdf"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Signer first name</label>
              <input value={signerFirstName} onChange={(e) => setSignerFirstName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            </div>
            <div>
              <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Signer last name</label>
              <input value={signerLastName} onChange={(e) => setSignerLastName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
            </div>
          </div>
          <div>
            <label className="text-label font-semibold uppercase tracking-wider text-text-secondary block mb-1.5">Signer email</label>
            <input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" />
          </div>
        </div>

        {sendError && <p className="text-error text-small mb-3">{sendError}</p>}

        {!folderId ? (
          <button
            onClick={sendForSignature}
            disabled={sending}
            className="px-6 py-2.5 rounded-lg bg-primary text-white text-small font-semibold hover:bg-primary-hover disabled:opacity-60 transition-colors"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Sending to Foxit eSign...
              </span>
            ) : (
              "Send for signature"
            )}
          </button>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-success-bg border border-success/20 rounded-lg">
            <svg className="w-5 h-5 text-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <p className="text-small text-text">
              Sent — Foxit folder <span className="font-mono font-semibold">{folderId}</span>. Signers will get a real signing email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
