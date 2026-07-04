/**
 * Renders a completed (non-streaming) mentor reply in the structured shape:
 * a prominent headline, 2-3 labeled beats with an icon each, and the full
 * warm narrative tucked behind an expander. See mentorReplyStructure.ts for
 * the parsing and app/prompts/mentor.txt for the contract this depends on.
 */

import React, { useState } from 'react';
import { Check, ArrowDownRight, ArrowRight, Circle, ChevronDown } from 'lucide-react';
import { MentorMarkdown } from './MentorMarkdown';
import { splitMentorReply, beatIcon } from '../lib/mentorReplyStructure';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  check: Check,
  'arrow-down-right': ArrowDownRight,
  'arrow-right': ArrowRight,
  circle: Circle,
};

const ICON_COLOR: Record<string, string> = {
  check: 'text-green-400',
  'arrow-down-right': 'text-amber-400',
  'arrow-right': 'text-brand-400',
  circle: 'text-muted',
};

interface Props {
  content: string;
}

export const MentorStructuredReply: React.FC<Props> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const { headline, beats, fullNote, hasStructure } = splitMentorReply(content);

  if (!hasStructure) {
    // No --- divider found -- render the whole thing as-is, no expander.
    return <MentorMarkdown content={content} />;
  }

  return (
    <div>
      {headline && (
        <p className="font-serif text-lg text-white leading-snug mb-3">{headline}</p>
      )}

      {beats.length > 0 && (
        <div className="space-y-2 mb-3">
          {beats.map((beat, i) => {
            const iconKey = beatIcon(beat.label);
            const Icon = ICONS[iconKey];
            return (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_COLOR[iconKey]}`} aria-hidden />
                <p className="text-stone-200 leading-relaxed">
                  <span className="font-medium text-white">{beat.label}:</span> {beat.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {fullNote && (
        <div className="border-t border-warm/50 pt-2.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
            {expanded ? 'Hide the full note' : 'Read the full note'}
          </button>
          {expanded && (
            <div className="mt-2.5">
              <MentorMarkdown content={fullNote} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
