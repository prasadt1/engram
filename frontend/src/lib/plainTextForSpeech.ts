/** Strip markdown-ish formatting for Web Speech API utterances. */

export function plainTextForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Spoken practice assignment: skill focus + brief only (rationale stays on-screen). */
export function practiceSpeechText(parts: {
  targetSkill?: string;
  brief: string;
}): string {
  const segments: string[] = [];
  if (parts.targetSkill) {
    segments.push(`Focus on ${parts.targetSkill.replace(/_/g, ' ')}.`);
  }
  segments.push(plainTextForSpeech(parts.brief));
  return segments.filter(Boolean).join(' ');
}
