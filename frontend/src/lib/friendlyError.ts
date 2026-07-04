import { apiUnreachableMessage } from './apiHelp';

export function friendlyErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return 'Cancelled — ask again anytime.';
    }
    const msg = err.message;
    const lower = msg.toLowerCase();
    if (lower.includes('504') || lower.includes('timeout') || lower.includes('timed out')) {
      return 'That took too long — the server may still be processing. Wait a moment and check My Work, or try again.';
    }
    if (
      lower.includes('failed to fetch') ||
      lower.includes('502') ||
      lower.includes('503') ||
      lower.includes('network')
    ) {
      return apiUnreachableMessage();
    }
    if (msg.length > 180 || lower.includes('traceback') || lower.includes('exception')) {
      return 'Something went wrong on my side. Please try again.';
    }
    return msg;
  }
  return 'Something went wrong. Please try again.';
}
