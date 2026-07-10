/**
 * JudgeWelcome — one-screen precursor for ?judge=1 evaluators.
 * Explains the demo setup and where to find memory proof; the main app
 * uses the same Home / Work / Mentor UX as regular users afterward.
 */

import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FlaskConical,
  Images,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button, Card, Eyebrow } from './primitives';
import { dismissJudgeWelcome } from '../lib/judgeMode';

interface Props {
  onEnterDemo: () => void;
  onStartTour: () => void;
  onOpenProof: () => void;
  /** When set, the user reopened this guide from inside the app — show Back to Home. */
  onBack?: () => void;
}

export const JudgeWelcome: React.FC<Props> = ({ onEnterDemo, onStartTour, onOpenProof, onBack }) => {
  const handleEnter = () => {
    dismissJudgeWelcome();
    onEnterDemo();
  };

  useEffect(() => {
    if (!onBack) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="min-h-screen bg-canvas text-stone-200 flex flex-col">
      <header className="border-b border-warm px-6 py-5 flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-300 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 focus-visible:outline-offset-2 rounded-md"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden />
            Back to Home
          </button>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo variant="horizontal" direction="simplified" />
            <Eyebrow tone="brand">Hackathon judge entry</Eyebrow>
          </div>
        )}
        {onBack && <Eyebrow tone="brand">Judge guide</Eyebrow>}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl md:text-4xl text-white leading-tight">
            Evaluating Engram — Track 1 MemoryAgent
          </h1>
          <p className="text-stone-400 text-base leading-relaxed">
            You&apos;re viewing a <strong className="text-stone-300">seeded demo photographer</strong>{' '}
            (<code className="font-mono text-sm text-brand-300">demo-user</code>) with 16 real
            Qwen-VL critiques across five sessions — composition has graduated, lighting is one strong
            shoot from clearing, and a memory-derived Practice assignment is ready. Live MongoDB
            counts throughout; not an empty sandbox.
          </p>
        </div>

        <Card padding="lg" className="border-brand-500/30 bg-brand-500/5 space-y-4">
          <Eyebrow tone="brand">What to look for</Eyebrow>
          <ul className="space-y-3 text-sm text-stone-300">
            <li className="flex gap-3">
              <BadgeCheck className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Home → Memory threads</strong> — step through each
                genre with the arrows; captions show real score growth, not filler (same screen
                regular users see).
              </span>
            </li>
            <li className="flex gap-3">
              <Target className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Practice → memory-derived assignment</strong> — open
                Practice (or the Journey card on Home); Suggest practice cites watching/streak state
                (lighting at 2/3) and explains why — not a generic prompt.
              </span>
            </li>
            <li className="flex gap-3">
              <Images className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Click any thread photo</strong> — opens that frame in
                My Work with scoped Mentor chat and a Memory Receipt.
              </span>
            </li>
            <li className="flex gap-3">
              <FlaskConical className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Memory Proof Room</strong> — live MongoDB stats, MCP
                round-trip toggle, and FAMA benchmark with Canon/Sony worked example.
              </span>
            </li>
            <li className="flex gap-3">
              <Users className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Coach Assist roster</strong> — three learner cards
                with isolated MongoDB journeys (Jordan interactive; Alex and Sam as scale proof).
              </span>
            </li>
          </ul>
        </Card>

        <p className="text-sm text-stone-500">
          After you enter, navigation matches the normal app — judge mode only scopes data to the demo
          library and keeps <code className="font-mono text-xs">?judge=1</code> in the URL when you move
          between tabs.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" iconRight={<ArrowRight className="w-4 h-4" />} onClick={handleEnter}>
            Enter demo
          </Button>
          <Button variant="secondary" size="lg" onClick={onStartTour}>
            Run judge walkthrough
          </Button>
          <Button variant="subtle" size="lg" onClick={onOpenProof}>
            Memory Proof Room
          </Button>
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
