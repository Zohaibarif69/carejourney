interface Step {
  label: string;
}

interface Props {
  title: string;
  subtitle?: string;
  steps: Step[];
  currentStep: number;
}

export default function ProcessingState({ title, subtitle, steps, currentStep }: Props) {
  return (
    <div className="flex flex-col items-center py-12">
      <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-6" />
      <h3 className="text-section font-semibold text-text mb-1">{title}</h3>
      {subtitle && <p className="text-small text-text-secondary mb-8">{subtitle}</p>}
      <div className="space-y-3 w-full max-w-xs">
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                done ? "bg-success" : active ? "border-2 border-primary animate-pulse" : "border border-border bg-subtle"
              }`}>
                {done && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {active && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className={`text-small ${done ? "text-success font-medium" : active ? "text-text font-medium" : "text-text-secondary"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
