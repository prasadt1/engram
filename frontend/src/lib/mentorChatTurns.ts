import type { ChatMessage } from '../services/mentorClient';

export interface ChatTurn {
  id: string;
  user: ChatMessage;
  assistant?: ChatMessage;
}

/** Pair each user message with the following assistant reply (one accordion row). */
export function groupMessagesIntoTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let pending: ChatTurn | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      if (pending) turns.push(pending);
      pending = { id: message.id, user: message };
      continue;
    }
    if (pending) {
      turns.push({ ...pending, assistant: message });
      pending = null;
    } else {
      turns.push({
        id: message.id,
        user: {
          id: `orphan-${message.id}`,
          role: 'user',
          content: 'Earlier reply',
        },
        assistant: message,
      });
    }
  }

  if (pending) turns.push(pending);
  return turns;
}

export function turnPreview(text: string, maxLen = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen).trim()}…`;
}
