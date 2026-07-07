/**
 * Interactive trace_1 story — scripted eval harness, not demo-user MongoDB.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Button, Eyebrow, Tag } from '../primitives';
import { JUDGE_GUIDE_URL, TRACE_LABELS, WORKED_TRACE_ID, workedDefault, workedNoForgetting } from './proofData';

type Phase = 0 | 1 | 2 | 3 | 4;

const PHASE_MS = 1400;

/**
 * Mentor-voice narration keyed to what the stage actually shows at each phase.
 * NB: the component reveals the Sony fact at the "Still Canon" step (phase 2)
 * and only retires Canon at the "Sony switch" step (phase 3), so the lines are
 * written to the real per-phase visuals rather than the step captions.
 */
const NARRATION: Record<Phase, string> = {
  0: 'Press Play — watch one fact get stored, then retired when it stops being true.',
  1: 'Session 2: you tell me you shoot Canon — I remember it.',
  2: 'Session 3: you switch to Sony. For a beat both facts are live — I haven’t retired Canon yet.',
  3: 'I link the switch and retire the Canon fact — kept for audit, it never coaches you again.',
  4: 'You ask what gear you use: I recall only Sony. “Never forget” leaks the stale Canon fact back in.',
};

function MemoryChip({
  label,
  tone,
  visible,
  className = '',
}: {
  label: string;
  tone: 'live' | 'superseded' | 'recalled-good' | 'recalled-bad';
  visible: boolean;
  className?: string;
}) {
  const toneClass =
    tone === 'live'
      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100'
      : tone === 'superseded'
        ? 'bg-stone-600/30 border-stone-500/40 text-stone-400 line-through opacity-70'
        : tone === 'recalled-good'
          ? 'bg-brand-500/25 border-brand-400/60 text-brand-100'
          : 'bg-rose-500/15 border-rose-500/40 text-rose-100';

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 ${
        visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1 pointer-events-none'
      } ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}

export const CanonSonyVisual: React.FC = () => {
  const [phase, setPhase] = useState<Phase>(0);
  const [playing, setPlaying] = useState(false);

  const runStory = useCallback(() => {
    setPlaying(true);
    setPhase(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (phase >= 4) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setPhase((p) => (p + 1) as Phase), PHASE_MS);
    return () => window.clearTimeout(t);
  }, [playing, phase]);

  if (!workedDefault || !workedNoForgetting) return null;

  const showCanonLive = phase >= 1;
  const showSony = phase >= 2;
  const canonSuperseded = phase >= 3;
  const showQuestion = phase >= 3;
  const showRecall = phase >= 4;

  return (
    <section
      id="proof-start"
      className="scroll-mt-6 rounded-2xl border border-brand-500/35 bg-gradient-to-b from-brand-500/10 to-surface-1/30 p-4 md:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow tone="brand">Step 1 · Start here</Eyebrow>
            <Tag variant="outline">Eval harness</Tag>
          </div>
          <h2 className="font-serif text-xl md:text-2xl text-white">Canon → Sony — forgetting in one question</h2>
          <p className="text-sm text-stone-400 max-w-xl">
            {TRACE_LABELS[WORKED_TRACE_ID]}{' '}
            <span className="font-mono text-xs text-stone-600">({WORKED_TRACE_ID})</span> — same{' '}
            <code className="font-mono text-xs">recall()</code> engine as the coach, not demo-user uploads.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" icon={<Play className="w-4 h-4" />} onClick={runStory} disabled={playing}>
            {playing ? 'Playing…' : 'Play story'}
          </Button>
          <Button
            variant="subtle"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              setPlaying(false);
              setPhase(0);
            }}
            aria-label="Reset animation"
          />
        </div>
      </div>

      {/* Session timeline */}
      <div className="relative pt-2 pb-1">
        <div className="absolute top-[1.15rem] left-[8%] right-[8%] h-0.5 bg-warm/80" aria-hidden />
        <ol className="relative grid grid-cols-3 gap-2 text-center list-none p-0 m-0">
          {[
            { n: 1, label: 'Canon stored' },
            { n: 2, label: 'Still Canon' },
            { n: 3, label: 'Sony switch' },
          ].map((s, i) => {
            const active = phase >= i + 1;
            return (
              <li key={s.n} className="flex flex-col items-center gap-2">
                <span
                  className={`relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                    active
                      ? 'border-brand-400 bg-brand-500/30 text-brand-100 scale-110'
                      : 'border-warm bg-surface-2 text-stone-500'
                  }`}
                >
                  {s.n}
                </span>
                <span className={`text-[10px] uppercase tracking-wide ${active ? 'text-stone-300' : 'text-stone-600'}`}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Memory store visualization */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-warm/70 bg-photo-black/40 p-4 space-y-3 min-h-[8rem]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Live memory</p>
          <div className="flex flex-wrap gap-2">
            <MemoryChip label="Canon body" tone="live" visible={showCanonLive && !canonSuperseded} />
            <MemoryChip label="Sony mirrorless" tone="live" visible={showSony} />
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-stone-600/60 bg-surface-2/30 p-4 space-y-3 min-h-[8rem]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Superseded (audit only)</p>
          <MemoryChip label="Canon body" tone="superseded" visible={canonSuperseded} />
        </div>
      </div>

      {/* Mentor-voice narration — updates as the story plays */}
      <p
        className="text-sm text-stone-300 text-center min-h-[2.75rem] flex items-center justify-center transition-opacity duration-300"
        aria-live="polite"
      >
        {NARRATION[phase]}
      </p>

      {/* Question + recall split */}
      <div
        className={`rounded-xl border border-warm bg-surface-1/50 p-4 space-y-4 transition-opacity duration-500 ${
          showQuestion ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <p className="font-serif text-lg text-white text-center">
          Q: What camera gear do I use?
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div
            className={`rounded-lg border p-3 space-y-2 transition-all duration-500 ${
              showRecall ? 'border-brand-500/50 bg-brand-500/10' : 'border-warm/50'
            }`}
          >
            <p className="text-xs font-semibold text-brand-400">Engram (shipped)</p>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              <MemoryChip label="Sony mirrorless" tone="recalled-good" visible={showRecall} />
            </div>
            <p className="text-[11px] text-stone-500">Retired Canon stays out of context.</p>
          </div>
          <div
            className={`rounded-lg border p-3 space-y-2 transition-all duration-500 ${
              showRecall ? 'border-rose-500/40 bg-rose-500/5' : 'border-warm/50'
            }`}
          >
            <p className="text-xs font-semibold text-rose-300/90">Never forgets (ablation)</p>
            <div className="flex flex-wrap gap-2 min-h-[2rem]">
              <MemoryChip label="Sony mirrorless" tone="recalled-bad" visible={showRecall} />
              <MemoryChip label="Canon body" tone="recalled-bad" visible={showRecall} />
            </div>
            <p className="text-[11px] text-stone-500">Stale Canon leaks back in.</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-stone-500 text-center">
        Full prose + reproduction steps:{' '}
        <a href={JUDGE_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
          judge-memory-proof-room.md
        </a>
      </p>
    </section>
  );
};
