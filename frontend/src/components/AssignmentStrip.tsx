import React from 'react';
import { Target } from 'lucide-react';
import type { Assignment } from '../types/practice';

interface Props {
  assignment: Assignment;
  onShootNow: () => void;
  onPractice: () => void;
}

export const AssignmentStrip: React.FC<Props> = ({
  assignment,
  onShootNow,
  onPractice,
}) => (
  <div className="border-b border-brand-500/30 bg-brand-500/10">
    <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
      <div className="flex items-start gap-2 min-w-0">
        <Target className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase text-brand-400 tracking-wide">
            Active practice
          </p>
          <p className="text-sm text-stone-200 line-clamp-2">{assignment.brief}</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onShootNow}
          className="px-3 py-1.5 rounded-lg bg-brand-500 text-on-brand text-sm font-semibold hover:bg-brand-400"
        >
          Shoot Now
        </button>
        <button
          type="button"
          onClick={onPractice}
          className="px-3 py-1.5 rounded-lg border border-warm text-stone-300 text-sm hover:bg-surface-2"
        >
          My Practice
        </button>
      </div>
    </div>
  </div>
);
