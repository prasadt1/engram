/**
 * JudgeWelcome — one-screen precursor for ?judge=1 evaluators.
 * Orient in ~10s: live stat chips, one product screenshot, single Enter CTA.
 * Detail lives in JudgeTour (launched from Home banner after enter).
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button, Eyebrow } from './primitives';
import { dismissJudgeWelcome } from '../lib/judgeMode';
import { fetchJudgeDemoStats, type JudgeDemoStats } from '../lib/judgeDemoStats';
import { useCountUp } from '../hooks/useCountUp';

interface Props {
  onEnterDemo: () => void;
}

function JudgeStatChip({
  label,
  value,
  animate,
  delayMs,
}: {
  label: string;
  value: string;
  animate: boolean;
  delayMs: number;
}) {
  const numeric = /^\d+$/.test(value);
  const target = numeric ? Number(value) : 0;
  const counted = useCountUp(target, 900, animate && numeric);
  const display = numeric ? String(Math.round(counted)) : value;
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [animate, delayMs]);

  return (
    <div
      className={`rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-center transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <p className="font-serif text-2xl text-white tabular-nums leading-none">{display}</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </p>
    </div>
  );
}

export const JudgeWelcome: React.FC<Props> = ({ onEnterDemo }) => {
  const [stats, setStats] = useState<JudgeDemoStats | null>(null);
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchJudgeDemoStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setStatsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setStatsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnter = () => {
    dismissJudgeWelcome();
    onEnterDemo();
  };

  const photoCount = stats?.photoCount;
  const clearedCount = stats?.skillsCleared;
  const focusLabel = stats?.focusLabel ?? '…';

  return (
    <div className="min-h-screen bg-canvas text-stone-200 flex flex-col">
      <header className="border-b border-warm px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo variant="horizontal" direction="simplified" />
          <Eyebrow tone="brand">Hackathon judge entry</Eyebrow>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="font-serif text-3xl md:text-4xl text-white leading-tight">
                Evaluating Engram — Track 1 MemoryAgent
              </h1>
              <p className="text-stone-400 text-base leading-relaxed">
                A seeded photographer with real critiques, skill graduation, and live memory —
                not an empty sandbox.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <JudgeStatChip
                label="Photos in library"
                value={photoCount != null ? String(photoCount) : '—'}
                animate={statsReady && photoCount != null}
                delayMs={0}
              />
              <JudgeStatChip
                label="Skills cleared"
                value={clearedCount != null ? String(clearedCount) : '—'}
                animate={statsReady && clearedCount != null}
                delayMs={80}
              />
              <JudgeStatChip
                label="Current focus"
                value={focusLabel}
                animate={statsReady && stats != null}
                delayMs={160}
              />
            </div>

            <p className="text-sm text-stone-500 leading-relaxed">
              After you enter, navigation matches the normal app — judge mode only scopes data to
              the demo library and keeps{' '}
              <code className="font-mono text-xs">?judge=1</code> in the URL when you move between
              tabs.
            </p>

            <Button size="lg" iconRight={<ArrowRight className="w-4 h-4" />} onClick={handleEnter}>
              Enter demo
            </Button>
          </div>

          <figure className="relative rounded-2xl border border-warm overflow-hidden bg-surface-1 shadow-2xl">
            <img
              src="/judge-welcome-home.webp"
              alt="Engram Home — mentor-read hero and memory threads from the seeded demo library"
              className="w-full h-auto block"
              width={760}
              height={500}
              loading="eager"
              decoding="async"
            />
            <figcaption className="sr-only">
              Home screen showing mentor-read identity, genre memory threads, and journey progress.
            </figcaption>
          </figure>
        </div>
      </main>

      <footer className="border-t border-warm px-6 py-4 text-center text-xs text-stone-500">
        <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-brand-400" aria-hidden />
        Engram — forgetting-aware memory for Qwen agents
      </footer>
    </div>
  );
};

export default JudgeWelcome;
