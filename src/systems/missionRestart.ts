import type { VolcanicStatus } from './events/worldEvents.ts';

export const BASE_RESTART_DELAY = 3000;
type BaseOutcome = Pick<VolcanicStatus, 'phase' | 'hull' | 'evacuated'> & { missionCompleted?: boolean; fieldActivityCompleted?: boolean };

export function shouldRestartBase(status: BaseOutcome): boolean {
  return status.phase === 'ended' && !status.evacuated && !(status.fieldActivityCompleted ?? status.missionCompleted) && status.hull <= 0;
}

export function scheduleBaseRestart(status: BaseOutcome, restart: () => void): () => void {
  if (!shouldRestartBase(status)) return () => {};
  const timer = setTimeout(restart, BASE_RESTART_DELAY);
  return () => clearTimeout(timer);
}

export function scheduleAstronautRestart(isDead: boolean, restart: () => void): () => void {
  if (!isDead) return () => {};
  const timer = setTimeout(restart, BASE_RESTART_DELAY);
  return () => clearTimeout(timer);
}
