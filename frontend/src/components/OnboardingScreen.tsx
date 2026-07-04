import React, { useState } from 'react';
import { Aperture, Loader2, ScanEye, Store } from 'lucide-react';
import { BRAND } from '../config/brand';
import { BrandLogo } from './BrandLogo';
import { FilmGrain } from './FilmGrain';
import { useLogoEntrance } from '../hooks/useLogoEntrance';
import { InlineAlertBanner } from './InlineAlertBanner';
import { apiUnreachableMessage } from '../lib/apiHelp';
import { friendlyErrorMessage } from '../lib/friendlyError';
import type { UserMode } from '../types/practice';

interface Props {
  onComplete: (mode: UserMode) => void;
  onPersist: (mode: UserMode) => Promise<void>;
}

export const OnboardingScreen: React.FC<Props> = ({ onComplete, onPersist }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const logoAnimate = useLogoEntrance();

  const choose = async (mode: UserMode) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      await onPersist(mode);
      onComplete(mode);
    } catch (e) {
      const msg = friendlyErrorMessage(e);
      if (import.meta.env.DEV) {
        // Local dev: enter the app even when api-dev is not running (avoids stuck/flickery UX).
        setWarning(msg || apiUnreachableMessage());
        onComplete(mode);
        return;
      }
      setError(msg);
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-canvas text-stone-200 flex items-center justify-center p-6 overflow-hidden">
      <FilmGrain />
      <div className="max-w-3xl w-full space-y-8 relative z-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <BrandLogo variant="horizontal" direction="simplified" size={40} animate={logoAnimate} className="justify-center mx-auto" />
          <p className="font-serif text-xl md:text-2xl text-stone-100 max-w-lg leading-relaxed">
            {BRAND.tagline} — I remember every frame you upload and coach you like a mentor in the
            darkroom, not a generic chatbot.
          </p>
          <p className="text-sm text-stone-500">Choose your path to get started.</p>
        </div>

        {error && (
          <InlineAlertBanner message={error} onDismiss={() => setError(null)} />
        )}

        {warning && (
          <InlineAlertBanner
            message={`${warning} You can still explore the UI; run make api-dev for full features.`}
            variant="warning"
            onDismiss={() => setWarning(null)}
          />
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void choose('hobbyist')}
            className="text-left rounded-2xl border border-warm bg-surface-2 p-6 hover:border-brand-500/60 hover:bg-surface-3 transition-colors disabled:opacity-50 shadow-lg shadow-black/20"
          >
            <Aperture className="w-8 h-8 text-brand-400 mb-3" aria-hidden />
            <h2 className="text-lg font-bold text-white mb-2">Hobbyist</h2>
            <p className="text-sm text-muted leading-relaxed">
              Critique, practice assignments, and a contact-sheet library that grows with every
              shoot.
            </p>
            <span className="inline-block mt-4 text-sm font-semibold text-brand-400">
              Start as hobbyist →
            </span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void choose('working_pro')}
            className="text-left rounded-2xl border border-warm bg-surface-2 p-6 hover:border-brand-500/60 hover:bg-surface-3 transition-colors disabled:opacity-50 shadow-lg shadow-black/20"
          >
            <Store className="w-8 h-8 text-brand-400 mb-3" aria-hidden />
            <h2 className="text-lg font-bold text-white mb-2">Working pro</h2>
            <p className="text-sm text-muted leading-relaxed">
              Portfolio insight and a memory that tracks your style — advanced pro tools coming
              soon.
            </p>
            <span className="inline-block mt-4 text-sm font-semibold text-brand-400">
              Start as working pro →
            </span>
          </button>
        </div>

        <div
          className="rounded-2xl border border-dashed border-warm bg-surface-1 p-6 flex gap-4 opacity-80"
          aria-disabled="true"
        >
          <ScanEye className="w-8 h-8 text-stone-500 shrink-0" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-stone-400 mb-1">Accessible mode</h2>
            <p className="text-sm text-stone-500">
              Voice-first field coaching with scene narration — coming soon on web and iPhone.
            </p>
            <span className="inline-block mt-2 text-xs uppercase tracking-wide text-stone-600">
              Coming soon
            </span>
          </div>
        </div>

        {saving && (
          <p className="text-center text-sm text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
            Setting up your studio…
          </p>
        )}

        <p className="text-center text-xs text-stone-500">
          Switch between Hobbyist and Working pro anytime in Settings.
        </p>
      </div>
    </div>
  );
};
