import type { ExtractionZone } from '../../systems/events/worldEvents.ts';
import { MISSION_CONFIG } from '../../systems/missionConfig.ts';

export type FrontSpeed = keyof typeof MISSION_CONFIG.extraction.distanceByFrontSpeed;

export function getExtractionZone(speed: FrontSpeed, headingOffsetDeg = 0): ExtractionZone {
  const { walkerSpawn, extraction } = MISSION_CONFIG;
  const distance = extraction.distanceByFrontSpeed[speed];
  const heading = (walkerSpawn.headingDeg + headingOffsetDeg) * Math.PI / 180;
  return {
    x: walkerSpawn.x + Math.sin(heading) * distance,
    z: walkerSpawn.z + Math.cos(heading) * distance,
    radius: extraction.radius,
  };
}

export function getExtractionEntry(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  zone: ExtractionZone,
): number | null {
  const x = startX - zone.x;
  const z = startZ - zone.z;
  const outside = x * x + z * z - zone.radius * zone.radius;
  if (outside <= 0) return 0;

  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSquared = dx * dx + dz * dz;
  const dot = x * dx + z * dz;
  const discriminant = dot * dot - lengthSquared * outside;
  if (dot >= 0 || discriminant < 0) return null;

  const entry = (-dot - Math.sqrt(discriminant)) / lengthSquared;
  return entry <= 1 ? entry : null;
}
