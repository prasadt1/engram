/**
 * Memory Proof Room — visual-first judge surface (#glassbox).
 * Full text: docs/judge-memory-proof-room.md
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from './primitives';
import { CanonSonyVisual } from './proof/CanonSonyVisual';
import { LiveStatsPanel } from './proof/LiveStatsPanel';
import { BenchmarkVisual } from './proof/BenchmarkVisual';
import { JUDGE_GUIDE_URL } from './proof/proofData';

const PROOF_STEPS = [
  { n: 1, label: 'Canon → Sony', hint: 'Play the story', targetId: 'proof-start' },
  { n: 2, label: 'Live library', hint: 'MongoDB now', targetId: 'proof-live' },
  { n: 3, label: 'Benchmark', hint: '26 scenarios', targetId: 'proof-benchmark' },
] as const;

function scrollToProofSection(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const GlassBoxTab: React.FC = () => (
  <div className="max-w-4xl mx-auto px-1 space-y-8 pb-10">
    <header className="space-y-4" id="proof-heading">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl text-white">Memory Proof Room</h1>
        <p className="mt-2 font-serif text-base md:text-lg text-stone-200 leading-snug max-w-2xl">
          This page proves Engram remembers what matters, forgets what no longer applies, and
          matches a full-memory baseline while using far less context.
        </p>
        <p className="mt-2 text-sm text-stone-400 max-w-xl">
          Visual proof in three steps — play the story, check live counts, scan the benchmark.
        </p>
      </div>

      <nav aria-label="Proof steps" className="grid sm:grid-cols-3 gap-2">
        {PROOF_STEPS.map((step) => (
          <button
            key={step.n}
            type="button"
            onClick={() => scrollToProofSection(step.targetId)}
            className="rounded-xl border border-warm/80 bg-surface-1/50 px-3 py-3 text-left hover:border-brand-500/40 hover:bg-brand-500/5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Step {step.n}</p>
            <p className="text-sm font-medium text-stone-100 mt-0.5">{step.label}</p>
            <p className="text-[11px] text-stone-500">{step.hint}</p>
          </button>
        ))}
      </nav>
    </header>

    <CanonSonyVisual />
    <LiveStatsPanel />
    <BenchmarkVisual />

    <footer className="border-t border-warm pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-xs text-stone-500 max-w-md">
        Want the full methodology, MCP tool specs, and reproduction commands? They live in the repo — not
        duplicated here.
      </p>
      <Button
        variant="secondary"
        size="sm"
        iconRight={<ExternalLink className="w-4 h-4" />}
        onClick={() => window.open(JUDGE_GUIDE_URL, '_blank', 'noopener,noreferrer')}
      >
        Full judge guide (markdown)
      </Button>
    </footer>
  </div>
);

export default GlassBoxTab;
