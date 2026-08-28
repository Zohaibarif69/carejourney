const STEPS = [
  { key: "provider", label: "Provider" },
  { key: "visual", label: "Visual" },
  { key: "info", label: "Info" },
  { key: "documents", label: "Documents" },
  { key: "consultation", label: "Consultation" },
  { key: "request", label: "Request" },
  { key: "confirmed", label: "Confirmed" },
];

const CURRENT_MAP: Record<string, string> = {
  draft: "documents",
  documents: "documents",
  consultation: "consultation",
  signing: "consultation",
  requested: "request",
  confirmed: "confirmed",
};

const COMPLETED_MAP: Record<string, string[]> = {
  draft: ["provider", "visual", "info"],
  documents: ["provider", "visual", "info"],
  consultation: ["provider", "visual", "info", "documents"],
  signing: ["provider", "visual", "info", "documents", "consultation"],
  requested: ["provider", "visual", "info", "documents", "consultation", "request"],
  confirmed: ["provider", "visual", "info", "documents", "consultation", "request", "confirmed"],
};

interface Props {
  status: string;
  orientation?: "horizontal" | "vertical";
}

export default function JourneyStepper({ status, orientation = "horizontal" }: Props) {
  const completed = COMPLETED_MAP[status] || ["provider"];
  const current = CURRENT_MAP[status] || "documents";

  if (orientation === "vertical") {
    return (
      <div className="space-y-3">
        {STEPS.map((step) => {
          const done = completed.includes(step.key);
          const active = current === step.key && !done;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                done ? "bg-success" : active ? "border-2 border-primary bg-white" : "border border-border bg-subtle"
              }`}>
                {done && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                {active && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className={`text-small ${done ? "text-success font-medium" : active ? "text-text font-semibold" : "text-text-secondary"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center overflow-x-auto">
      {STEPS.map((step, i) => {
        const done = completed.includes(step.key);
        const active = current === step.key && !done;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done ? "bg-success" : active ? "border-2 border-primary bg-white" : "border border-border bg-subtle"
              }`}>
                {done ? (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : active ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                ) : (
                  <span className="text-[11px] font-semibold text-text-secondary">{i + 1}</span>
                )}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                done ? "text-success" : active ? "text-primary" : "text-text-secondary"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 md:w-10 mb-6 transition-colors ${done ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
