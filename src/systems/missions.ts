// MISSÃO 1: A crosta vermelha — fotografia conjunta e coleta do M01.

import type { ExtractionZone } from './events/worldEvents.ts';
import { MISSION_CONFIG } from './missionConfig.ts';

export type FieldAction = 'photo' | 'core' | 'soil' | 'scan' | 'station' | 'inspect' | 'cache' | 'transmit';

export const FIELD_ACTION_SECONDS = 1.6;
export const MINERAL_ACTION_SECONDS = 4.5;

export function actionSeconds(id: MissionId, index: number): number {
  return id === 'mineral-sampling' && MISSIONS[0].checkpoints[index]?.scene === 'core'
    ? MINERAL_ACTION_SECONDS : FIELD_ACTION_SECONDS;
}

export function mineralStage(progress: number) {
  if (progress < 0.24) return 'align';
  if (progress < 0.51) return 'drill';
  if (progress < 0.66) return 'recover';
  if (progress < 0.88) return 'seal';
  return 'confirmed';
}

export interface MissionCheckpoint {
  scene: FieldAction;
  name: string;
  action: string;
  result: string;
  fraction: number;
  offset: number;
  sample?: string;
}

interface Mission {
  id: string;
  name: string;
  briefing: string;
  checkpoints: readonly MissionCheckpoint[];
}

export const MISSIONS = [
  {
    id: 'mineral-sampling',
    name: 'A crosta vermelha',
    briefing: 'Num futuro fictício, investigue um setor inspirado em Elysium Planitia e Cerberus Fossae. Desembarque para fotografar, no mesmo enquadramento, o exterior avermelhado e a face escura do canto ausente. Depois, embarque para coletar e selar M01. A aparência deste afloramento não confirma atividade vulcânica nem representa todas as rochas de Marte.',
    checkpoints: [
      {
        name: 'Exterior e face fraturada do afloramento', action: 'Fotografar exterior e fratura',
        result: 'A superfície avermelhada contrasta com a rocha mais escura exposta na fratura. A composição será investigada na amostra.',
        scene: 'photo', fraction: 0.45, offset: -48,
      },
      {
        name: 'Alvo de perfuração M01', action: 'Perfurar e selar M01',
        result: 'M01 selado e acondicionado no Walker · coleta e registros científicos concluídos.', sample: 'M01',
        scene: 'core', fraction: 0.45, offset: -48,
      },
    ],
  },
] as const satisfies readonly Mission[];

export type MissionId = (typeof MISSIONS)[number]['id'];

export function getMission(id: MissionId): Mission {
  return MISSIONS.find(mission => mission.id === id) ?? MISSIONS[0];
}

export function getMissionCheckpoints(
  id: MissionId,
  extraction: ExtractionZone,
  { x, z }: { x: number; z: number } = MISSION_CONFIG.walkerSpawn,
): ExtractionZone[] {
  const dx = extraction.x - x;
  const dz = extraction.z - z;
  const length = Math.hypot(dx, dz);

  return getMission(id).checkpoints.map(({ fraction, offset }) => ({
    x: x + dx * fraction + (dz / length) * offset,
    z: z + dz * fraction - (dx / length) * offset,
    radius: 22,
  }));
}

export function isPhotoCheckpoint(id: MissionId, index: number): boolean { return getMission(id).checkpoints[index]?.scene === 'photo'; }
