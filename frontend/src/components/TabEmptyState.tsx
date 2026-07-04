import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  steps?: string[];
  action?: { label: string; onClick: () => void };
  /** Optional example photo to show blurred preview with Glass Box overlay */
  examplePhoto?: {
    url: string;
    sceneDescription: string;
    overallAverage: number;
    glassBoxSummary: string;
  };
}

export const TabEmptyState: React.FC<Props> = ({
  icon: Icon,
  title,
  description,
  steps,
  action,
  examplePhoto,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Photo preview mode: show blurred example with Glass Box overlay
  if (examplePhoto) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Blurred photo preview with Glass Box */}
        <div className="relative rounded-2xl overflow-hidden border border-warm bg-photo-black shadow-lg">
          <div className="relative aspect-[16/10]">
            {/* Example photo with blur */}
            <img
              src={examplePhoto.url}
              alt={examplePhoto.sceneDescription}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                imageLoaded ? 'opacity-60' : 'opacity-0'
              }`}
              style={{
                filter: imageLoaded ? 'blur(8px)' : 'none',
              }}
              onLoad={() => setImageLoaded(true)}
            />

            {/* Gradient overlay for better text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

            {/* Glass Box panel - muted to indicate example */}
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md">
              <div className="rounded-xl bg-photo-black/70 border border-warm/30 p-4 shadow-xl opacity-70">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
                    <Sparkles className="w-4 h-4 text-brand-400/70" aria-hidden />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white/80">
                      Example critique
                    </p>
                    <p className="text-[10px] text-muted/80">
                      This is what you'll see
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/70 shadow-md">
                    <span className="text-sm font-bold text-on-brand tabular-nums">
                      {examplePhoto.overallAverage.toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-stone-300/80 leading-relaxed line-clamp-2">
                  {examplePhoto.glassBoxSummary}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Message and CTA below preview */}
        <div className="text-center py-6 px-6 rounded-2xl border border-dashed border-warm bg-surface-1/60">
          <Icon className="w-11 h-11 text-brand-400/80 mx-auto mb-4" aria-hidden />
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-muted leading-relaxed">{description}</p>
          {steps && steps.length > 0 && (
            <ol className="mt-4 text-left text-sm text-muted space-y-2 list-decimal list-inside">
              {steps.map((s) => (
                <li key={s}>
                  <span className="text-stone-300">{s}</span>
                </li>
              ))}
            </ol>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default mode: simple empty state
  return (
    <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-warm bg-surface-1/60 max-w-lg mx-auto">
      <Icon className="w-11 h-11 text-brand-400/80 mx-auto mb-4" aria-hidden />
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
      {steps && steps.length > 0 && (
        <ol className="mt-4 text-left text-sm text-muted space-y-2 list-decimal list-inside">
          {steps.map((s) => (
            <li key={s}>
              <span className="text-stone-300">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
