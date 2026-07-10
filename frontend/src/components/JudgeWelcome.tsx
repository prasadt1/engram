/**
 * JudgeWelcome — one-screen precursor for ?judge=1 evaluators.
 * Orient in ~10s: live proof sentences, one tight product crop, single Enter CTA.
 * Detail lives in JudgeTour (launched from Home banner after enter).
 */

import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button, Eyebrow } from './primitives';
import { dismissJudgeWelcome } from '../lib/judgeMode';
import {
  fetchJudgeDemoStats,
  JUDGE_DEMO_STATS_FAILURE_FALLBACK,
  JUDGE_DEMO_STATS_LOADING,
  type JudgeDemoStats,
  type JudgeProofLine,
} from '../lib/judgeDemoStats';

interface Props {
  onEnterDemo: () => void;
}

function JudgeProofLineItem({
  line,
  animate,
  delayMs,
}: {
  line: JudgeProofLine;
  animate: boolean;
  delayMs: number;
}) {
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [animate, delayMs]);

  return (
    <li
      className={`rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm text-stone-300 leading-snug transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <strong className="font-semibold text-white">{line.emphasis}</strong>
      {line.rest}
    </li>
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

  const proofLines =
    stats ??
    (statsReady ? JUDGE_DEMO_STATS_FAILURE_FALLBACK : JUDGE_DEMO_STATS_LOADING);

  return (
    <div className="min-h-screen bg-canvas text-stone-200 flex flex-col">
      <header className="border-b border-warm px-6 py-5 flex items-center justify-between gap-4 shrink-0">
        <BrandLogo variant="horizontal" direction="simplified" />
        <div className="text-right shrink-0">
          <Eyebrow tone="brand" className="whitespace-nowrap">
            Track 1 · MemoryAgent
          </Eyebrow>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">Judge entry</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full px-6 py-8 lg:py-12">
        <div className="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="space-y-6 lg:space-y-7">
            <div className="space-y-3">
              <h1 className="font-serif text-3xl md:text-4xl lg:text-[2.65rem] text-white leading-tight">
                Evaluating Engram
              </h1>
              <p className="text-stone-400 text-base leading-relaxed max-w-lg">
                A seeded photographer with real critiques, skill graduation, and live memory —
                not an empty sandbox.
              </p>
            </div>

            <ul className="space-y-2.5" aria-label="Live demo proof">
              <JudgeProofLineItem
                line={proofLines.library}
                animate={stats != null}
                delayMs={0}
              />
              <JudgeProofLineItem
                line={proofLines.cleared}
                animate={stats != null}
                delayMs={80}
              />
              <JudgeProofLineItem
                line={proofLines.focus}
                animate={stats != null}
                delayMs={160}
              />
            </ul>

            <p className="text-sm text-stone-500 leading-relaxed max-w-lg">
              After you enter, navigation matches the normal app — judge mode only scopes data to
              the demo library and keeps{' '}
              <code className="font-mono text-xs">?judge=1</code> in the URL when you move between
              tabs.
            </p>

            <Button size="lg" iconRight={<ArrowRight className="w-4 h-4" />} onClick={handleEnter}>
              Enter demo
            </Button>
          </div>

          <figure className="relative rounded-2xl border border-warm overflow-hidden bg-surface-1 shadow-2xl lg:max-h-[min(520px,55vh)] flex items-center justify-center">
            <img
              src="/judge-welcome-home.webp"
              alt="Engram Home — mentor-read hero with a loaded frame from the seeded demo library"
              className="w-full h-full object-cover object-left-top"
              width={720}
              height={480}
              loading="eager"
              decoding="async"
            />
            <figcaption className="sr-only">
              Tight crop of the Home mentor-read hero — live critique and identity from the demo
              library.
            </figcaption>
          </figure>
        </div>
      </main>

      <footer className="border-t border-warm px-6 py-4 text-center text-xs text-stone-500 shrink-0">
        <Sparkles className="w-3.5 h-3.5 inline-block mr-1 text-brand-400" aria-hidden />
        Engram — forgetting-aware memory for Qwen agents
      </footer>
    </div>
  );
};

export default JudgeWelcome;
