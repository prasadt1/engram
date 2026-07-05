/**
 * JudgeWelcome — one-screen precursor for ?judge=1 evaluators.
 * Explains the demo setup and where to find memory proof; the main app
 * uses the same Home / Work / Mentor UX as regular users afterward.
 */

import React from 'react';
import { ArrowRight, BadgeCheck, FlaskConical, Images, Sparkles } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Button, Card, Eyebrow } from './primitives';
import { dismissJudgeWelcome } from '../lib/judgeMode';

interface Props {
  onEnterDemo: () => void;
  onStartTour: () => void;
  onOpenProof: () => void;
}

export const JudgeWelcome: React.FC<Props> = ({ onEnterDemo, onStartTour, onOpenProof }) => {
  const handleEnter = () => {
    dismissJudgeWelcome();
    onEnterDemo();
  };

  return (
    <div className="min-h-screen bg-canvas text-stone-200 flex flex-col">
      <header className="border-b border-warm px-6 py-5 flex items-center gap-3">
        <BrandLogo variant="horizontal" direction="simplified" />
        <Eyebrow tone="brand">Hackathon judge entry</Eyebrow>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl md:text-4xl text-white leading-tight">
            Evaluating Engram — Track 1 MemoryAgent
          </h1>
          <p className="text-stone-400 text-base leading-relaxed">
            You&apos;re viewing a <strong className="text-stone-300">seeded demo photographer</strong>{' '}
            (<code className="font-mono text-sm text-brand-300">demo-user</code>) with 17 real critiques,
            skill graduation, and live memory counts — not an empty sandbox.
          </p>
        </div>

        <Card padding="lg" className="border-brand-500/30 bg-brand-500/5 space-y-4">
          <Eyebrow tone="brand">What to look for</Eyebrow>
          <ul className="space-y-3 text-sm text-stone-300">
            <li className="flex gap-3">
              <BadgeCheck className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
              <span>
                <strong className="text-white">Home → Memory thread</strong> — visual timeline of
                remembered / improved / cleared moments (same screen regular users see).
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
