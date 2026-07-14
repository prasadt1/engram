/**
 * Benchmark headline visuals + trace heatmap; full table collapsed.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Eyebrow, InfoTooltip, Tag } from '../primitives';
import { useCountUp } from '../../hooks/useCountUp';
import {
  BENCHMARK_PROVENANCE,
  BENCHMARK_TIE_NOTE,
  CONTROL_TRACE_COUNT,
  defaultResults,
  DIVERGED_TRACE_COUNT,
  FAMA_HEADING,
  FAMA_TOOLTIP,
  JUDGE_GUIDE_URL,
  LEAKED_ANSWER_COUNT,
  noForgettingByTrace,
  noForgettingResults,
  recencyByTrace,
  recencyResults,
  TRACE_LABELS,
  traceForgotMatter,
} from './proofData';

function formatRatio(n: number): string {
  return `${n.toFixed(2)}×`;
}

function ScoreRing({
  label,
  value,
  tone,
  showFamaTooltip = false,
}: {
  label: string;
  value: number;
  tone: 'good' | 'mid' | 'bad';
  showFamaTooltip?: boolean;
}) {
  const animated = useCountUp(value, 1000, true);
  const pct = Math.min(100, value * 100);
  const stroke = tone === 'good' ? '#f59e0b' : tone === 'mid' ? '#fb923c' : '#f87171';
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="oklch(0.3 0 0)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-serif font-bold text-white tabular-nums">
            {animated.toFixed(2)}
          </span>
        </div>
      </div>
      <p className="text-xs text-stone-400 text-center max-w-[8rem]">
        {label}
        {showFamaTooltip && (
          <InfoTooltip text={FAMA_TOOLTIP} label="What FAMA means" className="ml-0.5" />
        )}
      </p>
    </div>
  );
}

export const BenchmarkVisual: React.FC = () => {
  const [tableOpen, setTableOpen] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const meanShipped = defaultResults.summary.mean_fama;
  const meanRecency = recencyResults.summary.mean_fama;
  const meanAblated = noForgettingResults.summary.mean_fama;
  const tokenRatio = defaultResults.summary.mean_token_savings_ratio;
  const tokenAnimated = useCountUp(tokenRatio, 1000, true);

  return (
    <section id="proof-benchmark" className="scroll-mt-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>Step 3 · Controlled benchmark</Eyebrow>
        <Tag variant="outline">{defaultResults.summary.trace_count} scripted scenarios</Tag>
      </div>

      {/* Headline comparison — three configs */}
      <div className="rounded-2xl border border-warm bg-surface-1/40 p-5 md:p-6">
        <p className="text-sm text-center text-stone-200 font-medium mb-5">{FAMA_HEADING}</p>
        <div className="grid sm:grid-cols-3 gap-6 items-start justify-items-center">
          <ScoreRing label="Mean · Engram shipped" value={meanShipped} tone="good" showFamaTooltip />
          <ScoreRing label="Mean · recency-only" value={meanRecency} tone="mid" showFamaTooltip />
          <ScoreRing label="Mean · never forgets" value={meanAblated} tone="bad" showFamaTooltip />
        </div>
        <p className="mt-5 text-sm text-stone-200 font-medium text-center max-w-xl mx-auto">
          {BENCHMARK_TIE_NOTE}
        </p>
        <div className="mt-5 text-center space-y-1.5">
          <p className="text-xs text-stone-400">
            Stale facts leaked into{' '}
            <span className="text-rose-300 font-semibold">{LEAKED_ANSWER_COUNT}</span> /{' '}
            {defaultResults.summary.trace_count} answers under either baseline
          </p>
          <p className="text-sm text-brand-400 font-semibold tabular-nums">
            {tokenAnimated.toFixed(2)}× smaller context (shipped vs full history)
          </p>
        </div>
      </div>

      <p className="text-xs text-stone-500 leading-relaxed rounded-lg border border-warm/60 bg-surface-2/30 px-3 py-2.5">
        {BENCHMARK_PROVENANCE}
      </p>

      {/* Trace heatmap */}
      <div className="rounded-xl border border-warm/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-stone-300">
            <span className="text-brand-400 font-semibold">{DIVERGED_TRACE_COUNT}</span> scenarios where
            forgetting mattered ·{' '}
            <span className="text-stone-400">{CONTROL_TRACE_COUNT}</span> controls (nothing outdated)
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="img"
          aria-label={`${DIVERGED_TRACE_COUNT} diverged traces, ${CONTROL_TRACE_COUNT} controls`}
        >
          {defaultResults.results.map((row) => {
            const ablated = noForgettingByTrace.get(row.user_id);
            const diverged = traceForgotMatter(row.fama.fama, ablated);
            const label = TRACE_LABELS[row.user_id] ?? row.user_id;
            const isHover = hoverId === row.user_id;
            return (
              <button
                key={row.user_id}
                type="button"
                title={label}
                onMouseEnter={() => setHoverId(row.user_id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(row.user_id)}
                onBlur={() => setHoverId(null)}
                className={`w-3.5 h-3.5 rounded-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                  diverged
                    ? 'bg-brand-400 hover:scale-125'
                    : 'bg-stone-600/80 hover:bg-stone-500'
                } ${isHover ? 'scale-150 ring-1 ring-white/30' : ''}`}
                aria-label={label}
              />
            );
          })}
        </div>
        {hoverId && (
          <p className="text-xs text-stone-400 animate-fadeIn min-h-[2.5rem]">
            <span className="font-mono text-stone-500">{hoverId}</span> — {TRACE_LABELS[hoverId] ?? hoverId}
          </p>
        )}
        <div className="flex gap-4 text-[10px] text-stone-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-brand-400" aria-hidden /> Forgetting changed the score
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-stone-600" aria-hidden /> Control (all 1.00)
          </span>
        </div>
      </div>

      {/* Collapsed full table */}
      <div className="border border-warm rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setTableOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
          aria-expanded={tableOpen}
        >
          <span className="text-sm text-stone-300 inline-flex items-center gap-1">
            Full FAMA table (all {defaultResults.summary.trace_count} rows)
            <InfoTooltip text={FAMA_TOOLTIP} label="What FAMA means" />
          </span>
          <ChevronDown className={`w-5 h-5 text-stone-500 transition-transform ${tableOpen ? 'rotate-180' : ''}`} />
        </button>
        {tableOpen && (
          <div className="border-t border-warm max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-2 text-muted uppercase text-[10px]">
                <tr>
                  <th className="text-left px-3 py-2">Scenario</th>
                  <th className="text-right px-3 py-2">
                    Shipped
                    <InfoTooltip text={FAMA_TOOLTIP} label="What FAMA means" className="ml-0.5" />
                  </th>
                  <th className="text-right px-3 py-2">
                    Recency-only
                    <InfoTooltip text={FAMA_TOOLTIP} label="What FAMA means" className="ml-0.5" />
                  </th>
                  <th className="text-right px-3 py-2">
                    Never forgets
                    <InfoTooltip text={FAMA_TOOLTIP} label="What FAMA means" className="ml-0.5" />
                  </th>
                  <th className="text-right px-3 py-2">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {defaultResults.results.map((row) => {
                  const ablated = noForgettingByTrace.get(row.user_id);
                  const recency = recencyByTrace.get(row.user_id);
                  const diverged = traceForgotMatter(row.fama.fama, ablated);
                  return (
                    <tr
                      key={row.user_id}
                      className={`border-t border-warm/40 ${diverged ? 'bg-brand-500/10' : ''}`}
                    >
                      <td className="px-3 py-1.5 text-stone-400 max-w-[14rem] truncate">
                        {TRACE_LABELS[row.user_id] ?? row.user_id}
                      </td>
                      <td className="px-3 py-1.5 text-right text-white tabular-nums">
                        {row.fama.fama.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-stone-500 tabular-nums">
                        {recency ? recency.fama.fama.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-stone-500 tabular-nums">
                        {ablated ? ablated.fama.fama.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-brand-400 tabular-nums">
                        {formatRatio(row.token_savings_ratio)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-stone-500 text-center">
        Reproduce:{' '}
        <code className="font-mono text-stone-400">python -m eval.run --compare</code> ·{' '}
        <a href={JUDGE_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
          Full judge guide
        </a>
      </p>
    </section>
  );
};
