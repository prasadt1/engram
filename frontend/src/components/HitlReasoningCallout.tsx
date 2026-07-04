import React from 'react';
import { humanizeOrganizeReasoning } from '../lib/humanizeOrganizeReasoning';
import { MentorMarkdown } from './MentorMarkdown';
import { VoiceoverButton } from './VoiceoverButton';

interface Props {
  reasoning: string;
  speechId?: string;
}

/** HITL: agent reasoning visible before approve/reject (Pass 6). */
export const HitlReasoningCallout: React.FC<Props> = ({ reasoning, speechId }) => {
  const text = humanizeOrganizeReasoning(reasoning);
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[10px] font-bold uppercase text-amber-400/90 tracking-wide">
          Why I&apos;m suggesting this
        </p>
        {speechId ? (
          <VoiceoverButton
            speechId={`${speechId}-rationale`}
            text={text}
            label="assignment reasoning"
            size="sm"
          />
        ) : null}
      </div>
      <div className="text-sm text-stone-200 leading-relaxed">
        <MentorMarkdown content={text} />
      </div>
    </div>
  );
};
