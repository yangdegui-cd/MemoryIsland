// Sprint_Loop_Rig supplies the complete authored two-step running cycle.
export const RIVER_RUN_SPEED = 4.6;
export const RIVER_GAIT_RATE = 1;
export const RIVER_LANE_LIMIT = 2.65;

export function riverVelocity(current: number, requested: number, dt: number) {
  const next = current + (requested - current) * (1 - Math.exp(-14 * dt));
  return requested === 0 && Math.abs(next) < .015 ? 0 : next;
}

export function riverFacing(current: number, forward: number, lateral: number, dt: number) {
  if (Math.hypot(forward, lateral) < .05) return current;
  const target = Math.atan2(-lateral, forward);
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + Math.max(-14 * dt, Math.min(14 * dt, delta));
}
