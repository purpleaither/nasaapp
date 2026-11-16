import { HABITAT_CONFIG } from '../habitat/config.ts';
// Eventos e consequências deste cenário são ficcionais, não previsões sobre Marte.
export const WALKER_COLLISION_RADIUS = 30;
export const RESCUE_RANGE = 55;
export type Point = { x: number; z: number };
export type RouteId = 'direct' | 'detour';
export type RouteState = 'open' | 'falling' | 'blocked';
export interface RouteInfo {
  id: RouteId; name: string; points: Point[]; distance: number;
  terrain: string; energyEstimate: number; risk: string; state: RouteState;
}
export interface SeismicReading { id: number; time: number; amplitude: number; message: string }
export interface GeologicalStatus {
  repairActive: boolean; repairAvailable: boolean; repairHint: string;
  energy: number; equipment: number; events: SeismicReading[];
  shaking: boolean; localIntensity: number; selectedRoute: RouteId;
  routes: RouteInfo[]; navigation: Point; navigationLabel: string;
  evacuationRequired: boolean; evacuating: boolean; rescuedCrew: number;
  refuge: Point; message: string;
}
export const GeologicalEvent = {
  TREMOR: 'geological:tremor', COLLISION_QUERY: 'geological:collision-query',
  ROUTE_SELECT: 'geological:route-select', EVACUATE: 'geological:evacuate',
  REPAIR: 'geological:repair', RESCUE: 'geological:rescue', INJURY: 'geological:injury',
} as const;
export interface Tremor { id: number; intensity: number; epicenter: Point; duration: number }
export interface CollisionQuery { fromX: number; fromZ: number; x: number; z: number; radius: number; blocked: boolean }
export const SEISMIC_SCENARIO = [
  { at: 35, amplitude: 0.48, hull: 10, equipment: 15, energy: 0, message: 'Evento sísmico detectado. Corredor direto permanece livre.' },
  { at: 105, amplitude: 0.65, hull: 18, equipment: 30, energy: 8, message: 'Evento sísmico detectado. Alimentação do relé interrompida; instrumentos em bateria.' },
  { at: 190, amplitude: 0.76, hull: 24, equipment: 25, energy: 12, message: 'Integridade do módulo comprometida. Recomendada evacuação por danos observados.' },
] as const;
export function missionLayout(target: Point) {
  const length = Math.hypot(target.x, target.z) || 1;
  const normal = { x: target.z / length, z: -target.x / length };
  const rockfall = { x: target.x * 0.52, z: target.z * 0.52 };
  const bypass = { x: rockfall.x - normal.x * 120, z: rockfall.z - normal.z * 120 };
  return { rockfall, bypass, refuge: { ...HABITAT_CONFIG.center }, normal };
}
// As mesmas esferas horizontais alimentam modelos e colisões de ambos os controladores.
export function rockfallBlocks(target: Point) {
  const { rockfall, normal } = missionLayout(target);
  return [-24, -12, 0, 12, 24].map((offset, index) => ({
    x: rockfall.x + normal.x * offset, z: rockfall.z + normal.z * offset,
    radius: 7 + index % 2, height: 8 + index % 3 * 2,
  }));
}
export function segmentHitsCircle(q: CollisionQuery, p: Point, radius: number) {
  const dx = q.x - q.fromX, dz = q.z - q.fromZ;
  const t = Math.max(0, Math.min(1, ((p.x - q.fromX) * dx + (p.z - q.fromZ) * dz) / (dx * dx + dz * dz || 1)));
  const startDistance = Math.hypot(q.fromX - p.x, q.fromZ - p.z);
  const endDistance = Math.hypot(q.x - p.x, q.z - p.z);
  // Permite sair de uma área ocupada durante uma queda, sem aprisionar o jogador.
  if (startDistance < radius + q.radius && endDistance > startDistance) return false;
  return Math.hypot(q.fromX + dx * t - p.x, q.fromZ + dz * t - p.z) < radius + q.radius;
}

export function scarpBlocks(target: Point) {
  const { rockfall, normal } = missionLayout(target);
  return Array.from({ length: 5 }, (_, i) => ({ x: rockfall.x + normal.x * (65 + i * 11), z: rockfall.z + normal.z * (65 + i * 11), radius: 9 }));
}
