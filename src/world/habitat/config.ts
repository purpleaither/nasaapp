// Escala visual compartilhada: astronauta ~12,4 UJ representa ~1,85 m.
export const HABITAT_CONFIG = {
  unitsPerMeter: 6.7,
  center: { x: -110, z: 0 },
  lengthMeters: 8, diameterMeters: 4,
  platformHeight: 3,
  entrance: { x: -110, z: -84, radius: 24 },
  outsideSpawn: { x: -110, z: -91, headingDeg: 90 },
  parking: { x: 0, z: 0 },
  cycleSeconds: 4.2,
} as const;
export function habitatGroundPad(x: number, z: number): number {
  // Fundação/área de chegada fixa; não deforma o terreno durante eventos.
  const dx = Math.max(0, Math.abs(x - HABITAT_CONFIG.center.x) - 85);
  const dz = Math.max(0, Math.abs(z - HABITAT_CONFIG.center.z + 12) - 85);
  const t = Math.min(1, Math.hypot(dx, dz) / 40);
  return 1 - t * t * (3 - 2 * t);
}
export interface AirlockState { innerOpen: number; outerOpen: number; label: 'Pressurizado' | 'Ciclo em andamento' | 'Acesso liberado'; fade: number }
export function airlockFrame(direction: 'exit' | 'enter', elapsed: number): AirlockState {
  const t = Math.max(0, Math.min(1, elapsed / HABITAT_CONFIG.cycleSeconds));
  // Portas intertravadas: há sempre um intervalo com ambas fechadas.
  const first = t < 0.22 ? Math.sin(t / 0.22 * Math.PI) : 0;
  const second = t > 0.72 ? Math.sin((t - 0.72) / 0.28 * Math.PI) : 0;
  return { innerOpen: direction === 'exit' ? first : second, outerOpen: direction === 'exit' ? second : first,
    label: t < 0.2 ? direction === 'exit' ? 'Pressurizado' : 'Acesso liberado' : t > 0.73 ? direction === 'exit' ? 'Acesso liberado' : 'Pressurizado' : 'Ciclo em andamento',
    fade: t > 0.35 && t < 0.72 ? Math.min(1, (t - 0.35) * 12, (0.72 - t) * 12) : 0 };
}
