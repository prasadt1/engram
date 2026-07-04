import React from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { MiniSparkline } from './MiniSparkline';

export interface DimensionTrend {
  key: string;
  label: string;
  values: number[];
  latest: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat';
}

interface Props {
  dimension: DimensionTrend;
}

export const ScoreTrendRow: React.FC<Props> = ({ dimension }) => {
  const { label, values, latest, delta, trend } = dimension;

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-brand-400'
      : trend === 'down'
        ? 'text-rose-400'
        : 'text-muted';

  const deltaText =
    delta == null
      ? null
      : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs earlier uploads`;

  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-24 text-xs text-stone-300 shrink-0">{label}</span>
      <MiniSparkline
        values={values}
        className="shrink-0 text-brand-400"
        aria-label={`${label} scores over ${values.length} uploads`}
      />
      <span className="w-10 text-xs tabular-nums font-semibold text-stone-100 text-right shrink-0">
        {latest != null ? latest.toFixed(1) : '—'}
      </span>
      <span className={`flex items-center gap-0.5 text-[10px] shrink-0 min-w-[4.5rem] ${trendColor}`}>
        <TrendIcon className="w-3 h-3" aria-hidden />
        {deltaText ?? '—'}
      </span>
    </li>
  );
};
