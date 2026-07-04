import React, { useMemo } from 'react';
import { Smartphone } from 'lucide-react';

import { IRIS_WEB_URL } from '../config/urls';

/** QR deep-link to Practice on the same host (web); native Iris uses the same API account. */
export const ContinueOnPhoneQr: React.FC = () => {
  const { continueUrl, qrSrc } = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : IRIS_WEB_URL;
    const url = `${origin}/#practice`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=${encodeURIComponent(url)}`;
    return { continueUrl: url, qrSrc: qr };
  }, []);

  return (
    <section
      className="rounded-2xl border border-warm bg-surface-1 p-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start"
      aria-labelledby="continue-on-phone-heading"
    >
      <img
        src={qrSrc}
        alt=""
        width={140}
        height={140}
        className="rounded-lg bg-white p-1 shrink-0"
        loading="lazy"
      />
      <div className="text-center sm:text-left min-w-0">
        <div className="inline-flex items-center gap-2 text-brand-400 mb-2">
          <Smartphone className="w-4 h-4" aria-hidden />
          <h3 id="continue-on-phone-heading" className="text-sm font-semibold text-white">
            Continue on your iPhone
          </h3>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-2">
          Scan to open <strong className="text-stone-300 font-medium">Practice</strong> on your phone
          (Safari). Sign in with the same Google account — or use demo mode — then use the{' '}
          <strong className="text-stone-300 font-medium">Iris</strong> native app for live field coach
          cues while you shoot.
        </p>
        <p className="text-[10px] text-muted break-all font-mono">{continueUrl}</p>
      </div>
    </section>
  );
};
