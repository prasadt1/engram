/**
 * Parses a mentor reply that follows the headline/beats/--- contract
 * (app/prompts/mentor.txt) into renderable pieces. Operates on RAW text,
 * before any markdown parsing -- react-markdown would otherwise turn a
 * "headline\n---" pair into a setext <h2> instead of a divider, and we need
 * the split point before rendering, not after.
 *
 * Split rule: the FIRST line that is exactly "---" (after trimming) marks
 * the end of the quick view. Everything before it is headline + beats;
 * everything after is the full note. If no such line exists, the whole
 * reply is the quick view with no beats and no expander.
 */

export type BeatLabel = 'Working' | 'Watch' | 'Next';

export interface MentorBeat {
  label: BeatLabel;
  text: string;
}

export interface StructuredMentorReply {
  headline: string;
  beats: MentorBeat[];
  fullNote: string | null;
  /** True only when at least the --- divider was found -- drives whether
   * the UI shows a "Read the full note" expander at all. */
  hasStructure: boolean;
}

const BEAT_LINE_RE = /^\*\*(Working|Watch|Next):\*\*\s*(.*)$/;

export function splitMentorReply(raw: string): StructuredMentorReply {
  const lines = raw.split('\n');
  const dividerIndex = lines.findIndex((line) => line.trim() === '---');

  const quickViewLines = dividerIndex === -1 ? lines : lines.slice(0, dividerIndex);
  const fullNote = dividerIndex === -1 ? null : lines.slice(dividerIndex + 1).join('\n').trim();

  const beats: MentorBeat[] = [];
  const headlineLines: string[] = [];
  for (const line of quickViewLines) {
    const match = line.match(BEAT_LINE_RE);
    if (match) {
      beats.push({ label: match[1] as BeatLabel, text: match[2].trim() });
    } else if (beats.length === 0 && line.trim() !== '') {
      // Headline is everything before the first recognized beat line.
      headlineLines.push(line.trim());
    }
  }

  return {
    headline: headlineLines.join(' ').trim(),
    beats,
    fullNote: fullNote && fullNote.length > 0 ? fullNote : null,
    hasStructure: dividerIndex !== -1,
  };
}

const BEAT_ICON: Record<BeatLabel, 'check' | 'arrow-down-right' | 'arrow-right'> = {
  Working: 'check',
  Watch: 'arrow-down-right',
  Next: 'arrow-right',
};

/** Never throws on an unrecognized label -- BEAT_LINE_RE already only
 * matches the closed triad, but this stays defensive for direct callers. */
export function beatIcon(label: string): 'check' | 'arrow-down-right' | 'arrow-right' | 'circle' {
  return (BEAT_ICON as Record<string, 'check' | 'arrow-down-right' | 'arrow-right'>)[label] ?? 'circle';
}
