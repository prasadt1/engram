import {
  Archive,
  Brain,
  CloudUpload,
  Database,
  Eye,
  MessageSquare,
  Package,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface LiveProofStep {
  text: string;
  icon: LucideIcon;
  atSec: number;
}

/** Upload / critique pipeline — narrated sequence aligned with analyzeWaitCopy timing. */
export const UPLOAD_PROOF_STEPS: LiveProofStep[] = [
  { text: 'Photo saved to object storage', icon: CloudUpload, atSec: 0 },
  { text: 'Qwen-VL analyzing composition and lighting', icon: Eye, atSec: 8 },
  { text: 'MongoDB memory lookup started', icon: Database, atSec: 18 },
  { text: 'Live memories recalled for context', icon: Brain, atSec: 23 },
  { text: 'Retired memories excluded', icon: Archive, atSec: 26 },
  { text: 'Context packed under token budget', icon: Package, atSec: 28 },
  { text: 'New memory written after critique', icon: Sparkles, atSec: 58 },
];

/** Mentor chat orchestrator — shorter sequence for 30–90s replies. */
export const MENTOR_PROOF_STEPS: LiveProofStep[] = [
  { text: 'Question received', icon: MessageSquare, atSec: 0 },
  { text: 'Relevant memories recalled', icon: Brain, atSec: 6 },
  { text: 'Retired memories excluded', icon: Archive, atSec: 18 },
  { text: 'Reply streamed from Qwen', icon: Sparkles, atSec: 35 },
];

export function liveProofStepIndex(steps: LiveProofStep[], waitSec: number): number {
  return steps.reduce((step, s, i) => (waitSec >= s.atSec ? i : step), 0);
}
