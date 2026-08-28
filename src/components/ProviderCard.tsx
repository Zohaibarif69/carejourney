import { Link } from "react-router-dom";
import type { Provider } from "../types";

const strengthStyle: Record<string, string> = {
  Strong: "text-success bg-success-bg",
  Good: "text-warning bg-warning-bg",
  Possible: "text-text-secondary bg-subtle",
};

interface Props {
  provider: Provider;
}

export default function ProviderCard({ provider }: Props) {
  return (
    <article className="bg-surface border border-border rounded-xl overflow-hidden hover:shadow-[0_4px_20px_rgba(23,32,31,0.06)] transition-shadow duration-200 flex flex-col">
      <div className="h-44 bg-subtle overflow-hidden">
        <img
          src={provider.imageUrl}
          alt={`${provider.name}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-card font-semibold text-text leading-snug">{provider.name}</h3>
          {provider.rating && (
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-warning fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-small text-text-secondary">{provider.rating}</span>
            </div>
          )}
        </div>

        <p className="text-small text-text-secondary mb-3">{provider.city}, {provider.country}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {provider.specialties.map((s) => (
            <span key={s} className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-subtle text-text-secondary border border-border">
              {s}
            </span>
          ))}
        </div>

        {/* Match explanation */}
        <div className="bg-background rounded-lg p-3 mb-4 border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${strengthStyle[provider.matchStrength]}`}>
              {provider.matchStrength} match
            </span>
          </div>
          <p className="text-small text-text-secondary leading-relaxed">{provider.matchReasons[0]}</p>
        </div>

        <div className="mt-auto flex gap-2">
          <Link
            to={`/providers/${provider.id}`}
            className="flex-1 text-center py-2.5 rounded-lg border border-primary text-primary text-small font-semibold hover:bg-primary-soft transition-colors"
          >
            View Provider
          </Link>
        </div>
      </div>
    </article>
  );
}
