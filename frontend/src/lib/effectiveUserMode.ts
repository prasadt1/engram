import { FEATURES } from '../config/features';
import type { UserMode } from '../types/practice';

/** Working pro framing is deferred until print sales ships — avoid misleading badges. */
export function effectiveUserMode(mode: UserMode): UserMode {
  return mode === 'working_pro' && !FEATURES.printSales ? 'hobbyist' : mode;
}
