import React from 'react';
import { Target } from 'lucide-react';
import type { Assignment } from '../../types/practice';

interface Props {
  assignment: Assignment;
}

export const ActivePracticeBanner: React.FC<Props> = ({ assignment }) => (
  <div className="w-full max-w-2xl rounded-2xl border border-brand-500/50 bg-brand-500/10 px-5 py-4 text-left">
    <div className="flex items-start gap-3">
      <Target className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1">
          Active practice — uploads count toward this assignment
        </p>
        <p className="text-xs text-muted mb-2 capitalize">
          {assignment.targetSkill.replace(/_/g, ' ')}
        </p>
        <p className="text-sm text-stone-200 leading-relaxed">{assignment.brief}</p>
      </div>
    </div>
  </div>
);
