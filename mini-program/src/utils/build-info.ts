export const ENGINEERING_PHASE = 'P1-01';

export function buildStatus(phase: string): string {
  return phase ? `工程阶段 ${phase}` : '工程阶段未设置';
}
