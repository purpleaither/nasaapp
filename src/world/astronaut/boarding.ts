// ASTRONAUTA: regras de proximidade, saída segura e colisão com o veículo.
import { ASTRONAUT_CONFIG } from './config.ts';
export const WALKER_CLEARANCE = ASTRONAUT_CONFIG.walkerClearance;
export const BOARDING_DISTANCE = ASTRONAUT_CONFIG.boardingDistance;
export const WALK_SPEED = ASTRONAUT_CONFIG.walkSpeed;

export function findSafeExit(
  x: number, z: number, heading: number, bound: number,
  height: (x: number, z: number) => number,
  isClear: (x: number, z: number) => boolean = () => true,
): [number, number, number] | null {
  // Prefer the right side, then the left, before trying other directions.
  for (const radius of ASTRONAUT_CONFIG.exitRadii) {
    for (const offset of [90, -90, 135, -135, 45, -45, 180, 0]) {
      const angle = (heading + offset) * Math.PI / 180;
      const px = x + Math.sin(angle) * radius;
      const pz = z + Math.cos(angle) * radius;
      if (Math.abs(px) > bound - 1 || Math.abs(pz) > bound - 1) continue;
      const y = height(px, pz);
      if (!Number.isFinite(y)) continue;
      const stable = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => {
        const neighbor = height(px + dx, pz + dz);
        return Number.isFinite(neighbor) && Math.abs(neighbor - y) <= 0.7;
      });
      if (stable && isClear(px, pz)) return [px, y, pz];
    }
  }
  // Keep the astronaut aboard when no safe ground is available.
  return null;
}

export function canWalkTo(x: number, z: number, walkerX: number, walkerZ: number): boolean {
  return Math.hypot(x - walkerX, z - walkerZ) >= WALKER_CLEARANCE;
}
