import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface Props {
  label: string;
  onClick: () => void;
}

/** Contextual back affordance for one-level-deep sub-views. */
export const SubViewBack: React.FC<Props> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-white transition-colors min-h-[44px] py-2 -ml-1 px-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
  >
    <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
    {label}
  </button>
);
