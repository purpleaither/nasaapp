import type { MissionId } from '../missions.ts';
import type { Vec3, AppBase } from 'playcanvas';
import { DayPhase } from '../time/types.ts';
import type { DayPhase as DayPhaseType } from '../time/types.ts';

export type CameraFocusMode = 'walker' | 'explorer';
export type TimePreset = 'day' | 'dusk' | 'night';

export const InputEvent = {
  ORBIT: 'input:orbit',
  PAN: 'input:pan',
  ZOOM: 'input:zoom',
  AXES: 'input:axes',
  ACTION_INTERACT: 'input:action-interact',
  ACTION_JUMP: 'input:action-jump',
} as const;

export interface InputOrbitPayload {
  dx: number;
  dy: number;
}

export interface InputPanPayload {
  dx: number;
  dy: number;
}

export interface InputZoomPayload {
  wheelDelta: number;
}

export interface InputAxesPayload {
  forward: number;
  right: number;
  active: boolean;
  shiftBoost: boolean;
  dt: number;
}

export const TerrainEvent = {
  REGENERATE_RANDOM: 'terrain:regenerate-random',
  SEED_CHANGED: 'terrain:seed-changed',
  SAMPLE_HEIGHT: 'terrain:sample-height',
  MESH_STATS_CHANGED: 'terrain:mesh-stats-changed',
} as const;

export interface TerrainMeshStats {
  chunks: number;
  detailedChunks: number;
  triangles: number;
}

export interface TerrainSeedChangedPayload {
  seed: number;
}

export interface TerrainHeightQuery {
  x: number;
  z: number;
  outY: number;
}

export const VolcanicEvent = {
  POSITION_CHANGED: 'volcanic:position-changed',
  STATUS_CHANGED: 'volcanic:status-changed',
  SET_SPEED: 'volcanic:set-speed',
  FIELD_PROGRESS: 'volcanic:field-progress',
  FIELD_PHOTO: 'volcanic:field-photo',
  FIELD_PHOTO_ERROR: 'volcanic:field-photo-error',
  FIELD_FEEDBACK: 'volcanic:field-feedback',
  COMPLETE_OBJECTIVE: 'volcanic:complete-objective',
  START: 'volcanic:start',
  PAUSE: 'volcanic:pause',
  RESUME: 'volcanic:resume',
} as const;

export const SimulationEvent = {
  STEP: 'simulation:step',
} as const;

export interface ExtractionZone {
  x: number;
  z: number;
  radius: number;
}

export interface FieldPhoto { index: number; image: string; captureId: number; source: 'eva' | 'walker'; framingValidated: boolean }
export interface FieldPhotoError { index: number; captureId: number; message: string }
export interface FieldFeedback { message: string; kind: 'info' | 'error' | 'success' }
export interface EvaCameraAim { target: { x: number; y: number; z: number }; active: boolean }
export interface EvaCameraQuery { origin: Vec3; forward: Vec3; up: Vec3; available: boolean }
export interface FieldCameraFrame {
  eye: { x: number; y: number; z: number };
  focus: { x: number; y: number; z: number };
}

export interface VolcanicStatus {
  geology: import('../../world/geological/crisis.ts').GeologicalStatus;
  phase: 'preparation' | 'operation' | 'paused' | 'ended';
  distance: number;
  secondsToArrival: number;
  speed: number;
  zone: 'safe' | 'heated' | 'destruction';
  hull: number;
  defeat: 'structural' | 'power' | null;
  evacuated: boolean;
  missionCompleted: boolean;
  fieldActivityCompleted: boolean;
  returningToHabitat: boolean;
  extraction: ExtractionZone;
  distanceToExtraction: number;
  extractionBearing: number;
  elapsedSeconds: number;
  missionId: MissionId;
  completedCheckpoints: number;
  target: ExtractionZone;
  targetDistance: number;
  targetBearing: number;
  fieldActionActive: boolean;
  fieldActionId: number;
  fieldOperator: 'walker' | 'explorer';
  fieldRequiresBoarding: boolean;
  fieldRequiresDisembarking: boolean;
  mineralStage?: ReturnType<typeof import('../missions.ts').mineralStage>;
}

export type WalkerBiomeStyle = 'island' | 'citadel';

export const WalkerEvent = {
  HULL_DAMAGED: 'walker:hull-damaged',
  POSE_UPDATED: 'walker:pose-updated',
  SET_BOOST: 'walker:set-boost',
  BOOST_CHANGED: 'walker:boost-changed',
  SET_BASE_MODE: 'walker:set-base-mode',
  BASE_MODE_CHANGED: 'walker:base-mode-changed',
  LANTERN_STATE_CHANGED: 'walker:lantern-state-changed',
  FOOT_STEPPED: 'walker:foot-stepped',
  DOWNLOAD_GLB: 'walker:download-glb',
  SET_BIOME_STYLE: 'walker:set-biome-style',
} as const;

export interface WalkerBiomeStylePayload {
  style: WalkerBiomeStyle;
}

export interface WalkerBaseModePayload {
  baseMode: boolean;
}

export interface PoseUpdatedPayload {
  x: number;
  y: number;
  z: number;
  headingDeg: number;
}

export interface WalkerBoostPayload {
  enabled: boolean;
}

export interface WalkerLanternStatePayload {
  active: boolean;
  phase: DayPhaseType;
}

export interface WalkerFootSteppedPayload {
  legIndex: number;
  namePrefix: string;
  x: number;
  y: number;
  z: number;
  intensity: number;
}

// ASTRONAUTA — eventos compartilhados com câmera, interface e mundo.
export const PlayerEvent = {
  POSE_UPDATED: 'player:pose-updated',
  STATE_CHANGED: 'player:state-changed',
  EVA_CAMERA_AIM: 'player:eva-camera-aim',
  EVA_CAMERA_QUERY: 'player:eva-camera-query',
  EVA_CAMERA_SHUTTER: 'player:eva-camera-shutter',
  BOARDING_STATE_CHANGED: 'player:boarding-state-changed',
  TOGGLE_BOARDING: 'player:toggle-boarding',
} as const;

export interface PlayerBoardingStatePayload {
  isBoarded: boolean;
  canBoard: boolean;
  distanceToWalker: number;
}

export const CameraEvent = {
  FIELD_FRAME: 'camera:field-frame',
  SET_FOCUS_MODE: 'camera:set-focus-mode',
  FOCUS_MODE_CHANGED: 'camera:focus-mode-changed',
  STATE_UPDATED: 'camera:state-updated',
  CLEAR_COLOR: 'camera:clear-color',
} as const;

export interface CameraFocusModePayload {
  mode: CameraFocusMode;
}

export interface CameraStateUpdatedPayload {
  x: number;
  y: number;
  z: number;
  yawDeg: number;
  camDist: number;
}

export interface CameraClearColorPayload {
  r: number;
  g: number;
  b: number;
}

/**
 * Pure rule for automatic night lanterns:
 * Lanterns turn ON automatically during NIGHT (19:00..05:00) and stay OFF during DAWN, DAY, and DUSK.
 */
export function shouldEnableNightLanterns(phase: DayPhaseType): boolean {
  return phase === DayPhase.NIGHT;
}

const sharedHeightQuery: TerrainHeightQuery = { x: 0, z: 0, outY: 0 };

/**
 * Queries terrain elevation at (x, z) strictly via the PlayCanvas event bus.
 */
export function sampleHeightViaEvent(app: AppBase, x: number, z: number): number {
  sharedHeightQuery.x = x;
  sharedHeightQuery.z = z;
  sharedHeightQuery.outY = 0;
  app.fire(TerrainEvent.SAMPLE_HEIGHT, sharedHeightQuery);
  return sharedHeightQuery.outY;
}
