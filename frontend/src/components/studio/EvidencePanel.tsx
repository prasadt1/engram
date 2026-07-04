/**
 * Evidence sources — human-readable labels (Pass 6).
 */

import React from 'react';
import { BookOpen, Camera, Eye } from 'lucide-react';
import type { EvidenceItem } from '../../types/studio';

const SOURCE_CONFIG: Record<
  EvidenceItem['source'],
  { label: string; icon: React.ReactNode; color: string }
> = {
  EXIF: {
    label: 'Camera metadata',
    icon: <Camera className="w-3.5 h-3.5" aria-hidden />,
    color: 'text-stone-300 bg-surface-2 border-warm',
  },
  CV: {
    label: 'What I see in the image',
    icon: <Eye className="w-3.5 h-3.5" aria-hidden />,
    color: 'text-brand-400 bg-brand-500/10 border-brand-500/25',
  },
  Coach: {
    label: 'Photography principles',
    icon: <BookOpen className="w-3.5 h-3.5" aria-hidden />,
    color: 'text-amber-400/90 bg-amber-500/10 border-amber-500/25',
  },
};

const FIELD_LABELS: Record<string, string> = {
  composition: 'Composition',
  lighting: 'Lighting',
  technique: 'Technique',
  creativity: 'Creativity',
  subject_impact: 'Subject impact',
  focal_length: 'Focal length',
  aperture: 'Aperture',
  shutter_speed: 'Shutter',
  iso: 'ISO',
};

function humanField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

const EvidencePanel: React.FC<{ evidence: EvidenceItem[]; className?: string }> = ({
  evidence,
  className = '',
}) => {
  if (evidence.length === 0) return null;

  return (
    <div
      className={`rounded-xl bg-surface-1 border border-warm overflow-hidden ${className}`}
    >
      <div className="px-4 py-3 border-b border-warm flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted" aria-hidden />
        <h4 className="text-sm font-semibold text-stone-200">How I backed this critique</h4>
        <span className="ml-auto text-xs text-muted">{evidence.length} signals</span>
      </div>
      <ul className="divide-y divide-warm/60" role="list">
        {evidence.map((item, idx) => {
          const cfg = SOURCE_CONFIG[item.source];
          return (
            <li key={idx} className="px-4 py-3 flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded border shrink-0 ${cfg.color}`}
              >
                {cfg.icon}
                {cfg.label}
              </div>
              <div className="flex-1 min-w-0 text-xs text-stone-300">
                <span className="text-muted">{humanField(item.field)}: </span>
                {item.value}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EvidencePanel;
