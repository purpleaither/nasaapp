// Pure procedural kinematics, progressive heavy steering, sequential wave gait,
// single-clean-arc 3-bone arachnid strides (zero double-stepping), and exact 3D Inverse Kinematics (IK)
// for the 6-legged Steampunk Daddy-Longlegs Spider-Walker ("ARACHNO-NOMAD MK.VI" - Aranha Treme-Treme).

export interface SpiderLegState {
  index: number;
  namePrefix: string; // 'Leg_FL', 'Leg_ML', 'Leg_RL', 'Leg_FR', 'Leg_MR', 'Leg_RR'
  side: -1 | 1;       // -1 = Left, +1 = Right
  tripodGroup: 0 | 1; // 0 = Tripod A (FL, MR, RL), 1 = Tripod B (FR, ML, RR)
  waveOrder: number;  // 0..5 metachronal spider wave order so legs never step all at once
  hipLocal: [number, number, number];
  restLocal: [number, number, number];
  currentWorld: [number, number, number];
  plantedWorld: [number, number, number];
  stepStartWorld: [number, number, number];
  stepTargetWorld: [number, number, number];
  stepProgress: number; // 1.0 = planted on ground, 0.0..0.99 = stepping in air
  stanceTime: number;   // Time (seconds) spent planted on the ground since completing the last step
  coxaYawDeg: number;
  femurPitchDeg: number;
  tibiaPitchDeg: number;
  footPitchDeg: number;
}

export interface SpiderWalkerKinematicsState {
  posX: number;
  posY: number;
  posZ: number;
  headingDeg: number;
  linearSpeed: number;
  angularSpeedDeg: number;
  bodyPitchDeg: number;
  bodyRollDeg: number;
  clearanceHeight: number;
  coxaLength: number;
  femurLength: number;
  tibiaLength: number;
  footPadOffset: number; // Length of the 3rd articulated leg bone: the 3.2m Tortoise Foot + 4 Front Claws
  baseMode: boolean;     // false = Modo Walker, true = Modo Base (buried feet, lowered head, open mouth)
  baseDeployProgress: number; // 0.0 = Modo Walker, 1.0 = Modo Base
  neckPitchDeg: number;  // +22 deg downward in Modo Base, ~0 deg in Modo Walker
  neckYawDeg: number;    // Subtle turn look-ahead in Modo Walker, 0 deg in Modo Base
  jawOpenDeg: number;    // +34 deg open mouth in Modo Base, 0 deg closed in Modo Walker
  stepCooldown: number;
  nextWaveCursor: number;
  gaitPhaseTime: number;
  lastLandedLegs: number[];
  legs: SpiderLegState[];
}

export interface WalkerControlInput {
  forward: number; // -1..+1 (W/S)
  turn: number;    // -1..+1 (A/D)
  boost: boolean;  // Shift
  baseMode?: boolean; // Optional override for Modo Base vs Modo Walker
  speedMultiplier?: number; // 0.55..1.0 based on boiler steam pressure
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Transforms a horizontal local offset (lx, lz) into world (wx, wz) using headingDeg,
 * foreshortening by the current procedural bodyPitchDeg and bodyRollDeg so feet are
 * projected along the inclined slope plane rather than over-stretching horizontally on cliffs.
 */
export function localToSlopeWorldXZ(
  posX: number,
  posZ: number,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
  lx: number,
  lz: number
): [number, number] {
  const radY = (headingDeg * Math.PI) / 180;
  const sinH = Math.sin(radY);
  const cosH = Math.cos(radY);

  // Foreshorten horizontal projection by cos(roll) and cos(pitch) so a wide leg span
  // stays constant along the 3D cliff slope instead of over-stretching in 3D
  const cosR = Math.cos((rollDeg * Math.PI) / 180);
  const cosP = Math.cos((pitchDeg * Math.PI) / 180);
  const effLX = lx * clamp(cosR, 0.62, 1.0);
  const effLZ = lz * clamp(cosP, 0.62, 1.0);

  const wx = posX + effLX * cosH + effLZ * sinH;
  const wz = posZ - effLX * sinH + effLZ * cosH;
  return [wx, wz];
}

/**
 * Transforms a horizontal local offset (lx, lz) into world (wx, wz) using headingDeg.
 */
export function localToWorldXZ(
  posX: number,
  posZ: number,
  headingDeg: number,
  lx: number,
  lz: number
): [number, number] {
  return localToSlopeWorldXZ(posX, posZ, headingDeg, 0, 0, lx, lz);
}

/**
 * Transforms a 3D point in Walker-Root-Local space (lx, ly, lz) into 3D World space
 * using the exact rotation composition R = R_y(headingDeg) * R_x(bodyPitchDeg) * R_z(bodyRollDeg).
 */
export function rootLocalToWorld(
  state: SpiderWalkerKinematicsState,
  lx: number,
  ly: number,
  lz: number
): [number, number, number] {
  // 1) Roll around local Z by +bodyRollDeg
  const radR = (state.bodyRollDeg * Math.PI) / 180;
  const cosR = Math.cos(radR);
  const sinR = Math.sin(radR);
  const x1 = lx * cosR - ly * sinR;
  const y1 = lx * sinR + ly * cosR;
  const z1 = lz;

  // 2) Pitch around local X by +bodyPitchDeg
  const radP = (state.bodyPitchDeg * Math.PI) / 180;
  const cosP = Math.cos(radP);
  const sinP = Math.sin(radP);
  const x2 = x1;
  const y2 = y1 * cosP - z1 * sinP;
  const z2 = y1 * sinP + z1 * cosP;

  // 3) Yaw around world Y by +headingDeg
  const radY = (state.headingDeg * Math.PI) / 180;
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);
  const wx = state.posX + x2 * cosY + z2 * sinY;
  const wy = state.posY + y2;
  const wz = state.posZ - x2 * sinY + z2 * cosY;

  return [wx, wy, wz];
}

/**
 * Transforms a 3D world point (wx, wy, wz) into the exact local 3D coordinate frame of the Walker root
 * (exact inverse of rootLocalToWorld: R_z(-roll) * R_x(-pitch) * R_y(-heading)).
 */
export function worldToRootLocal(
  state: SpiderWalkerKinematicsState,
  wx: number,
  wy: number,
  wz: number
): [number, number, number] {
  const dx = wx - state.posX;
  const dy = wy - state.posY;
  const dz = wz - state.posZ;

  const radY = (state.headingDeg * Math.PI) / 180;
  const cosY = Math.cos(radY);
  const sinY = Math.sin(radY);

  // 1) Undo Yaw (-headingDeg around Y)
  const x2 = dx * cosY - dz * sinY;
  const y2 = dy;
  const z2 = dx * sinY + dz * cosY;

  // 2) Undo Pitch (-bodyPitchDeg around X)
  const radP = (state.bodyPitchDeg * Math.PI) / 180;
  const cosP = Math.cos(radP);
  const sinP = Math.sin(radP);
  const x1 = x2;
  const y1 = y2 * cosP + z2 * sinP;
  const z1 = -y2 * sinP + z2 * cosP;

  // 3) Undo Roll (-bodyRollDeg around Z)
  const radR = (state.bodyRollDeg * Math.PI) / 180;
  const cosR = Math.cos(radR);
  const sinR = Math.sin(radR);
  const lx = x1 * cosR + y1 * sinR;
  const ly = -x1 * sinR + y1 * cosR;
  const lz = z1;

  return [lx, ly, lz];
}

/**
 * Computes the procedural pitch and roll of the 4-foot support plane in the Walker's heading frame:
 * - Positive `bodyRollDeg` rolls the RIGHT side (+X) UP and the LEFT side (-X) DOWN when right feet are higher.
 * - Negative `bodyPitchDeg` pitches the FRONT nose (+Z) UP and the REAR (-Z) DOWN when front feet are higher.
 */
function computeFootPlaneAngles(
  legs: SpiderLegState[],
  headingDeg: number
): { targetPitchDeg: number; targetRollDeg: number; avgFootY: number } {
  const radY = (headingDeg * Math.PI) / 180;
  const sinH = Math.sin(radY);
  const cosH = Math.cos(radY);

  // Least-squares plane fit of foot height y = a * localHorizX + b * localHorizZ + c
  let sumX2 = 0;
  let sumZ2 = 0;
  let sumXY = 0;
  let sumZY = 0;
  let sumY = 0;

  let cx = 0;
  let cz = 0;
  for (const l of legs) {
    cx += l.currentWorld[0];
    cz += l.currentWorld[2];
    sumY += l.currentWorld[1];
  }
  cx /= legs.length;
  cz /= legs.length;
  const avgFootY = sumY / legs.length;

  for (const l of legs) {
    const dx = l.currentWorld[0] - cx;
    const dz = l.currentWorld[2] - cz;
    const dy = l.currentWorld[1] - avgFootY;

    // Horizontal coordinates in the walker's heading frame (+hx = right, +hz = forward)
    const hx = dx * cosH - dz * sinH;
    const hz = dx * sinH + dz * cosH;

    sumX2 += hx * hx;
    sumZ2 += hz * hz;
    sumXY += hx * dy;
    sumZY += hz * dy;
  }

  const slopeRight = sumX2 > 1e-3 ? sumXY / sumX2 : 0;   // dy / d(right)
  const slopeForward = sumZ2 > 1e-3 ? sumZY / sumZ2 : 0; // dy / d(forward)

  // +roll around +Z lifts +X (right side) up by +x * sin(roll), so roll = +atan(slopeRight)
  // +pitch around +X lowers +Z (front nose) by -z * sin(pitch), so pitch = -atan(slopeForward)
  const rawRollDeg = (Math.atan(slopeRight) * 180) / Math.PI;
  const rawPitchDeg = -(Math.atan(slopeForward) * 180) / Math.PI;

  return {
    targetPitchDeg: clamp(rawPitchDeg * 0.90, -46, 46),
    targetRollDeg: clamp(rawRollDeg * 0.90, -46, 46),
    avgFootY,
  };
}

/**
 * Creates the initial 4-legged "Tortuga-Nomad" Biomechanical Tortoise Walker state
 * with 2-segment leg anatomy (Femur 7.6m + Flared Tibia 9.2m, zero 3rd segment!),
 * procedural slope alignment, and articulated Neck + Lower Jaw for Modo Walker vs Modo Base.
 */
export function createSpiderWalkerState(
  startX: number,
  startZ: number,
  startHeadingDeg: number,
  sampleHeightAt: (x: number, z: number) => number
): SpiderWalkerKinematicsState {
  // 4-Legged Biomechanical Tortoise ("TORTUGA-NOMAD") with 2-Segment Legs:
  // Hip Swivel (1.2m) -> Segment 1: Ribbed Thigh (7.6m) -> Segment 2: Flared Tortoise Foreleg (9.2m)
  const clearanceHeight = 6.4;
  const coxaLength = 1.2;
  const femurLength = 7.6;
  const tibiaLength = 9.2;
  const footPadOffset = 0.0;

  const legConfigs: Array<{
    namePrefix: string;
    side: -1 | 1;
    tripodGroup: 0 | 1;
    waveOrder: number;
    hipLocal: [number, number, number];
    restLocal: [number, number, number];
    initZPhase: number;
  }> = [
    {
      namePrefix: 'Leg_FL',
      side: -1,
      tripodGroup: 0,
      waveOrder: 0,
      hipLocal: [-11.8, -1.1, 8.2],
      restLocal: [-17.8, 0, 10.8],
      initZPhase: -1.6,
    },
    {
      namePrefix: 'Leg_RL',
      side: -1,
      tripodGroup: 1,
      waveOrder: 2,
      hipLocal: [-11.8, -1.1, -8.2],
      restLocal: [-17.8, 0, -10.8],
      initZPhase: -0.5,
    },
    {
      namePrefix: 'Leg_FR',
      side: 1,
      tripodGroup: 1,
      waveOrder: 3,
      hipLocal: [11.8, -1.1, 8.2],
      restLocal: [17.8, 0, 10.8],
      initZPhase: 0.6,
    },
    {
      namePrefix: 'Leg_RR',
      side: 1,
      tripodGroup: 0,
      waveOrder: 1,
      hipLocal: [11.8, -1.1, -8.2],
      restLocal: [17.8, 0, -10.8],
      initZPhase: 1.6,
    },
  ];

  // First pass: sample initial foot heights to determine initial terrain slope
  const legs: SpiderLegState[] = legConfigs.map((cfg, index) => {
    const [wx, wz] = localToWorldXZ(
      startX,
      startZ,
      startHeadingDeg,
      cfg.restLocal[0],
      cfg.restLocal[2] + cfg.initZPhase
    );
    const wy = sampleHeightAt(wx, wz);
    return {
      index,
      namePrefix: cfg.namePrefix,
      side: cfg.side,
      tripodGroup: cfg.tripodGroup,
      waveOrder: cfg.waveOrder,
      hipLocal: cfg.hipLocal,
      restLocal: cfg.restLocal,
      currentWorld: [wx, wy, wz],
      plantedWorld: [wx, wy, wz],
      stepStartWorld: [wx, wy, wz],
      stepTargetWorld: [wx, wy, wz],
      stepProgress: 1.0,
      stanceTime: 10.0,
      coxaYawDeg: 0,
      femurPitchDeg: 30,
      tibiaPitchDeg: -125,
      footPitchDeg: 95,
    };
  });

  const initialPlane = computeFootPlaneAngles(legs, startHeadingDeg);

  // Re-project initial feet along the sloped plane so starting on a steep cliff is foreshortened
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const cfg = legConfigs[i];
    const [wx, wz] = localToSlopeWorldXZ(
      startX,
      startZ,
      startHeadingDeg,
      initialPlane.targetPitchDeg,
      initialPlane.targetRollDeg,
      leg.restLocal[0],
      leg.restLocal[2] + cfg.initZPhase
    );
    const wy = sampleHeightAt(wx, wz);
    leg.currentWorld = [wx, wy, wz];
    leg.plantedWorld = [wx, wy, wz];
    leg.stepStartWorld = [wx, wy, wz];
    leg.stepTargetWorld = [wx, wy, wz];
  }

  const refinedPlane = computeFootPlaneAngles(legs, startHeadingDeg);
  const cosTilt =
    Math.cos((refinedPlane.targetPitchDeg * Math.PI) / 180) *
    Math.cos((refinedPlane.targetRollDeg * Math.PI) / 180);
  const hullGroundY = sampleHeightAt(startX, startZ);

  const state: SpiderWalkerKinematicsState = {
    posX: startX,
    posY: Math.max(
      refinedPlane.avgFootY + clearanceHeight * Math.max(0.68, cosTilt),
      hullGroundY + 4.8
    ),
    posZ: startZ,
    headingDeg: startHeadingDeg,
    linearSpeed: 0,
    angularSpeedDeg: 0,
    bodyPitchDeg: refinedPlane.targetPitchDeg,
    bodyRollDeg: refinedPlane.targetRollDeg,
    clearanceHeight,
    coxaLength,
    femurLength,
    tibiaLength,
    footPadOffset,
    baseMode: false,
    baseDeployProgress: 0,
    neckPitchDeg: 0,
    neckYawDeg: 0,
    jawOpenDeg: 0,
    stepCooldown: 0,
    nextWaveCursor: 0,
    gaitPhaseTime: 0,
    lastLandedLegs: [],
    legs,
  };

  for (const leg of state.legs) {
    solveSpiderLegIK(state, leg);
  }

  return state;
}

/**
 * Solves exact 3D 2-segment analytical Inverse Kinematics (IK) in the Walker's local frame
 * for the 4 Tortoise Pillar Legs (Segment 1: Femur 7.6m + Segment 2: Flared Tibia 9.2m).
 * The flat Foot Sole & 4 Front Claws sit directly at the bottom tip of Segment 2 (footPadOffset = 0).
 */
export function solveSpiderLegIK(
  state: SpiderWalkerKinematicsState,
  leg: SpiderLegState
): void {
  // Transform the world foot-sole target into the exact local coordinate frame of the tilted hull
  const [footLX, footLY, footLZ] = worldToRootLocal(
    state,
    leg.currentWorld[0],
    leg.currentWorld[1],
    leg.currentWorld[2]
  );

  // Vector from the leg's Hip attachment point to the Foot Sole in Hull-Local 3D space
  const dx = footLX - leg.hipLocal[0];
  const dy = footLY - leg.hipLocal[1];
  const dz = footLZ - leg.hipLocal[2];

  // 1) Coxa horizontal swivel angle around local Y
  const outwardX = Math.max(0.25, dx * leg.side);
  const forwardZ = dz;
  const coxaYawRad = Math.atan2(forwardZ, outwardX);
  leg.coxaYawDeg = -((coxaYawRad * 180) / Math.PI) * leg.side;

  // 2) Planar target of the foot sole in the Coxa's vertical radial plane (relative to Femur hinge)
  const radialHoriz = Math.hypot(outwardX, forwardZ);
  let horizDist = Math.max(0.5, radialHoriz - state.coxaLength);
  let vertDist = dy;

  const L1 = state.femurLength; // Segment 1: 7.6m
  const L2 = state.tibiaLength; // Segment 2: 9.2m

  const Rmin = Math.abs(L1 - L2) + 0.25;
  const Rmax = (L1 + L2) * 0.992;

  const rawFootDist = Math.hypot(horizDist, vertDist);
  if (rawFootDist > Rmax) {
    const scale = Rmax / rawFootDist;
    horizDist *= scale;
    vertDist *= scale;
  } else if (rawFootDist < Rmin) {
    const scale = Rmin / Math.max(0.01, rawFootDist);
    horizDist *= scale;
    vertDist *= scale;
  }

  const distFoot = clamp(Math.hypot(horizDist, vertDist), Rmin, Rmax);

  // Exact 2-Segment Law of Cosines (Femur L1 + Flared Tibia L2)
  const cosA = clamp(
    (L1 * L1 + distFoot * distFoot - L2 * L2) / (2 * L1 * distFoot),
    -1,
    1
  );
  const alpha = Math.acos(cosA);

  const cosB = clamp(
    (L1 * L1 + L2 * L2 - distFoot * distFoot) / (2 * L1 * L2),
    -1,
    1
  );
  const beta = Math.acos(cosB);

  const baseAng = Math.atan2(vertDist, horizDist);
  const femurRad = baseAng + alpha;
  const tibiaRad = -(Math.PI - beta);

  const femurDeg = (femurRad * 180) / Math.PI;
  const tibiaDeg = (tibiaRad * 180) / Math.PI;

  // Keep the flat Tortoise Foot Sole + 4 Claws level with the ground at the bottom of Segment 2,
  // curling during a stride and pitching downward to dig into the soil in Modo Base!
  const neutralForwardZ = leg.restLocal[2] - leg.hipLocal[2];
  const strideZOffset = forwardZ - neutralForwardZ;
  const stanceFlexDeg = clamp(strideZOffset * 1.6, -12.0, 12.0);
  const t = leg.stepProgress;
  const swingCurlDeg = t < 1.0 ? -Math.sin(t * Math.PI) * 28.0 : 0.0;
  const baseBurialDigDeg = -(state.baseDeployProgress ?? 0) * 18.0;

  const levelFootDeg = -(femurDeg + tibiaDeg);

  leg.femurPitchDeg = femurDeg;
  leg.tibiaPitchDeg = tibiaDeg;
  leg.footPitchDeg = levelFootDeg + stanceFlexDeg + swingCurlDeg + baseBurialDigDeg;
}

/**
 * Computes the exact 3D world position of the bottom of Segment 2 (Tibia / Foot Sole) via forward kinematics
 * (used for unit-testing 2-segment IK accuracy across slopes, turns, pitch, and roll).
 */
export function computeLegFootWorldFK(
  state: SpiderWalkerKinematicsState,
  leg: SpiderLegState
): [number, number, number] {
  const fRad = (leg.femurPitchDeg * Math.PI) / 180;
  const tRad = ((leg.femurPitchDeg + leg.tibiaPitchDeg) * Math.PI) / 180;
  const footRad =
    ((leg.femurPitchDeg + leg.tibiaPitchDeg + leg.footPitchDeg) * Math.PI) / 180;

  const rFoot =
    state.coxaLength +
    state.femurLength * Math.cos(fRad) +
    state.tibiaLength * Math.cos(tRad) +
    state.footPadOffset * Math.cos(footRad);
  const yFoot =
    state.femurLength * Math.sin(fRad) +
    state.tibiaLength * Math.sin(tRad) +
    state.footPadOffset * Math.sin(footRad);

  const cRad = (leg.coxaYawDeg * Math.PI) / 180;
  const xCoxa = leg.side * rFoot;
  const lx = leg.hipLocal[0] + xCoxa * Math.cos(cRad);
  const ly = leg.hipLocal[1] + yFoot;
  const lz = leg.hipLocal[2] - xCoxa * Math.sin(cRad);

  return rootLocalToWorld(state, lx, ly, lz);
}

/**
 * Checks whether a candidate leg is allowed to lift off without destabilizing adjacent legs.
 */
function areNeighborsSupportive(legs: SpiderLegState[], candidateIndex: number): boolean {
  const neighbors: number[][] =
    legs.length === 4
      ? [
          [1, 2],
          [0, 3],
          [0, 3],
          [1, 2],
        ]
      : [
          [1, 3],
          [0, 2, 4],
          [1, 5],
          [4, 0],
          [3, 5, 1],
          [4, 2],
        ];
  for (const nIdx of neighbors[candidateIndex] ?? []) {
    if (legs[nIdx] && legs[nIdx].stepProgress < 0.52) {
      return false;
    }
  }
  return true;
}

/**
 * Advances the Tortuga-Nomad physics, progressive turning inertia, single-clean-arc 3-bone tortoise
 * strides, staggered wave foot-stepping, procedural slope alignment, exact 3D IK, and
 * Modo Base (buried feet + lowered carapace + lowered neck/head + open mouth) vs Modo Walker.
 */
export function stepSpiderWalkerKinematics(
  state: SpiderWalkerKinematicsState,
  input: WalkerControlInput,
  dt: number,
  sampleHeightAt: (x: number, z: number) => number,
  worldBound = 1320
): void {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  state.lastLandedLegs = [];

  if (typeof input.baseMode === 'boolean') {
    state.baseMode = input.baseMode;
  }

  // Smoothly animate Base Mode deployment progress (0.0 = Modo Walker, 1.0 = Modo Base)
  if (state.baseMode) {
    state.baseDeployProgress = Math.min(1.0, state.baseDeployProgress + clampedDt * 1.65);
  } else {
    state.baseDeployProgress = Math.max(0.0, state.baseDeployProgress - clampedDt * 1.85);
  }
  const deploySmooth =
    state.baseDeployProgress *
    state.baseDeployProgress *
    (3 - 2 * state.baseDeployProgress);

  const speedMult = clamp(input.speedMultiplier ?? 1.0, 0.45, 1.25);
  const maxLinearSpeed = (input.boost ? 24.0 : 15.0) * speedMult;
  const maxTurnSpeedDeg = (input.boost ? 48.0 : 34.0) * speedMult;

  // In Modo Base (or while deploying/undeploying base), lock locomotion so the base stays anchored
  const canWalk = !state.baseMode && state.baseDeployProgress < 0.15;
  const effForwardInput = canWalk ? clamp(input.forward, -1, 1) : 0;
  const effTurnInput = canWalk ? clamp(input.turn, -1, 1) : 0;

  const targetLinear = effForwardInput * maxLinearSpeed;
  const targetAngular = effTurnInput * maxTurnSpeedDeg;

  const linLerp = Math.min(1, clampedDt * (Math.abs(targetLinear) > 0.01 ? 4.0 : 6.5));
  const angLerp = Math.min(1, clampedDt * (Math.abs(targetAngular) > 0.01 ? 3.5 : 7.0));

  state.linearSpeed = lerp(state.linearSpeed, targetLinear, linLerp);
  state.angularSpeedDeg = lerp(state.angularSpeedDeg, targetAngular, angLerp);

  if (Math.abs(state.linearSpeed) < 0.02 && Math.abs(targetLinear) === 0) {
    state.linearSpeed = 0;
  }
  if (Math.abs(state.angularSpeedDeg) < 0.05 && Math.abs(targetAngular) === 0) {
    state.angularSpeedDeg = 0;
  }

  // Integrate progressive heading and position
  state.headingDeg = (state.headingDeg + state.angularSpeedDeg * clampedDt) % 360;
  const radH = (state.headingDeg * Math.PI) / 180;
  const vx = Math.sin(radH) * state.linearSpeed;
  const vz = Math.cos(radH) * state.linearSpeed;

  state.posX = clamp(state.posX + vx * clampedDt, -worldBound, worldBound);
  state.posZ = clamp(state.posZ + vz * clampedDt, -worldBound, worldBound);

  const motionMagnitude =
    Math.abs(state.linearSpeed) + Math.abs(state.angularSpeedDeg) * 0.30;
  const isMoving = motionMagnitude > 0.06;
  if (isMoving) {
    state.gaitPhaseTime += clampedDt * (input.boost ? 5.5 : 4.2);
  }

  // Single-arc tortoise stride timing & lift arc:
  const currentCosTilt =
    Math.cos((state.bodyPitchDeg * Math.PI) / 180) *
    Math.cos((state.bodyRollDeg * Math.PI) / 180);
  const stepDuration = input.boost ? 0.28 : 0.36;
  const baseArcHeight = (input.boost ? 3.8 : 3.2) * clamp(currentCosTilt, 0.55, 1.0);

  const speedRatio = clamp(
    Math.max(
      Math.abs(state.linearSpeed) / maxLinearSpeed,
      Math.abs(state.angularSpeedDeg) / maxTurnSpeedDeg
    ),
    0.0,
    1.0
  );
  const strideOvershoot = lerp(2.2, input.boost ? 4.4 : 3.8, speedRatio);

  // Depth to bury planted tortoise feet into the ground in Modo Base (1.45m deep!)
  const footBurialDepth = 1.45 * deploySmooth;

  // 1) Advance any legs currently mid-step & bury planted feet into the terrain when in Modo Base
  for (const leg of state.legs) {
    if (leg.stepProgress < 1.0) {
      leg.stepProgress = Math.min(1.0, leg.stepProgress + clampedDt / stepDuration);
      const t = leg.stepProgress;

      if (t < 0.60) {
        const remTime = (1.0 - t) * stepDuration;
        const remHeading = state.headingDeg + state.angularSpeedDeg * remTime;
        const remX = state.posX + vx * remTime;
        const remZ = state.posZ + vz * remTime;
        const [remRestX, remRestZ] = localToSlopeWorldXZ(
          remX,
          remZ,
          remHeading,
          state.bodyPitchDeg,
          state.bodyRollDeg,
          leg.restLocal[0],
          leg.restLocal[2]
        );
        const curStepDx = leg.stepTargetWorld[0] - leg.stepStartWorld[0];
        const curStepDz = leg.stepTargetWorld[2] - leg.stepStartWorld[2];
        const curStepLen = Math.hypot(curStepDx, curStepDz);
        if (curStepLen > 0.1) {
          const dirX = curStepDx / curStepLen;
          const dirZ = curStepDz / curStepLen;
          const refinedX = remRestX + dirX * strideOvershoot;
          const refinedZ = remRestZ + dirZ * strideOvershoot;
          if (
            Math.hypot(refinedX - leg.stepStartWorld[0], refinedZ - leg.stepStartWorld[2]) >= 3.8
          ) {
            leg.stepTargetWorld[0] = lerp(leg.stepTargetWorld[0], refinedX, 0.25);
            leg.stepTargetWorld[2] = lerp(leg.stepTargetWorld[2], refinedZ, 0.25);
            leg.stepTargetWorld[1] = sampleHeightAt(
              leg.stepTargetWorld[0],
              leg.stepTargetWorld[2]
            );
          }
        }
      }

      const smoothT = t * t * (3 - 2 * t);

      let fx = lerp(leg.stepStartWorld[0], leg.stepTargetWorld[0], smoothT);
      let fz = lerp(leg.stepStartWorld[2], leg.stepTargetWorld[2], smoothT);

      const singleArcTuck = -Math.sin(t * Math.PI) * 0.9 * clamp(currentCosTilt, 0.55, 1.0);
      const rightWorldX = Math.cos(radH) * leg.side;
      const rightWorldZ = -Math.sin(radH) * leg.side;
      fx += rightWorldX * singleArcTuck;
      fz += rightWorldZ * singleArcTuck;

      const groundAtFoot = sampleHeightAt(fx, fz);
      const baseFootY = lerp(leg.stepStartWorld[1], leg.stepTargetWorld[1], smoothT);

      const isFrontLeg = leg.index === 0 || leg.index === 2;
      const legArcHeight = baseArcHeight * (isFrontLeg ? 1.12 : 1.0);
      const liftPhase = Math.pow(t, 0.78);
      const lift = Math.sin(liftPhase * Math.PI) * legArcHeight;

      leg.currentWorld[0] = fx;
      leg.currentWorld[2] = fz;
      leg.currentWorld[1] = Math.max(groundAtFoot, baseFootY) + lift;

      if (leg.stepProgress >= 1.0) {
        leg.plantedWorld[0] = leg.stepTargetWorld[0];
        const finalGroundY = sampleHeightAt(leg.stepTargetWorld[0], leg.stepTargetWorld[2]);
        leg.plantedWorld[1] = finalGroundY - footBurialDepth;
        leg.plantedWorld[2] = leg.stepTargetWorld[2];
        leg.currentWorld[0] = leg.stepTargetWorld[0];
        leg.currentWorld[1] = finalGroundY - footBurialDepth;
        leg.currentWorld[2] = leg.stepTargetWorld[2];
        leg.stanceTime = 0.0;
        state.lastLandedLegs.push(leg.index);
      }
    } else {
      leg.stanceTime += clampedDt;
      const groundY = sampleHeightAt(leg.plantedWorld[0], leg.plantedWorld[2]);
      leg.plantedWorld[1] = groundY - footBurialDepth;
      leg.currentWorld[0] = leg.plantedWorld[0];
      leg.currentWorld[1] = groundY - footBurialDepth;
      leg.currentWorld[2] = leg.plantedWorld[2];
    }
  }

  // 2) Directional Single-Step-Per-Stride Wave Gait Scheduler (4 Tortoise Legs):
  state.stepCooldown = Math.max(0, state.stepCooldown - clampedDt);
  const numLegs = state.legs.length;
  const activeStepCount = state.legs.filter((l) => l.stepProgress < 1.0).length;
  const maxConcurrentSteps = numLegs === 4 ? 2 : 3;

  const effLinear =
    Math.abs(targetLinear) > Math.abs(state.linearSpeed)
      ? lerp(state.linearSpeed, targetLinear, 0.45)
      : state.linearSpeed;
  const effAngular =
    Math.abs(targetAngular) > Math.abs(state.angularSpeedDeg)
      ? lerp(state.angularSpeedDeg, targetAngular, 0.45)
      : state.angularSpeedDeg;

  const endStepHeading = state.headingDeg + effAngular * stepDuration;
  const midHeadingDeg = state.headingDeg + effAngular * stepDuration * 0.5;
  const midRad = (midHeadingDeg * Math.PI) / 180;
  const effVx = Math.sin(midRad) * effLinear;
  const effVz = Math.cos(midRad) * effLinear;
  const endStepX = state.posX + effVx * stepDuration;
  const endStepZ = state.posZ + effVz * stepDuration;

  const minStanceTime = stepDuration * 0.85;

  let hasSeverelyStretchedLeg = false;
  if (canWalk) {
    for (const leg of state.legs) {
      if (leg.stepProgress < 1.0) continue;
      const [rx, rz] = localToSlopeWorldXZ(
        state.posX,
        state.posZ,
        state.headingDeg,
        state.bodyPitchDeg,
        state.bodyRollDeg,
        leg.restLocal[0],
        leg.restLocal[2]
      );
      if (Math.hypot(leg.plantedWorld[0] - rx, leg.plantedWorld[2] - rz) > 6.2) {
        hasSeverelyStretchedLeg = true;
        break;
      }
    }
  }

  if (
    canWalk &&
    (isMoving || hasSeverelyStretchedLeg) &&
    activeStepCount < maxConcurrentSteps &&
    state.stepCooldown <= 0
  ) {
    let bestLeg: SpiderLegState | null = null;
    let bestScore = -1;
    let bestTargetX = 0;
    let bestTargetZ = 0;

    const probeDt = 0.05;
    const probeHeading = state.headingDeg + effAngular * probeDt;
    const probeX = state.posX + effVx * probeDt;
    const probeZ = state.posZ + effVz * probeDt;

    const triggerBehind = lerp(1.9, 2.7, speedRatio);
    const minStepSpan = lerp(3.8, 5.6, speedRatio);

    for (const leg of state.legs) {
      if (leg.stepProgress < 1.0) continue;

      const [restWorldX, restWorldZ] = localToSlopeWorldXZ(
        state.posX,
        state.posZ,
        state.headingDeg,
        state.bodyPitchDeg,
        state.bodyRollDeg,
        leg.restLocal[0],
        leg.restLocal[2]
      );

      const offsetX = leg.plantedWorld[0] - restWorldX;
      const offsetZ = leg.plantedWorld[2] - restWorldZ;
      const distFromRest = Math.hypot(offsetX, offsetZ);

      if (leg.stanceTime < minStanceTime && distFromRest < 9.5) continue;

      const [nextRestX, nextRestZ] = localToSlopeWorldXZ(
        probeX,
        probeZ,
        probeHeading,
        state.bodyPitchDeg,
        state.bodyRollDeg,
        leg.restLocal[0],
        leg.restLocal[2]
      );

      const anchorVx = (nextRestX - restWorldX) / probeDt;
      const anchorVz = (nextRestZ - restWorldZ) / probeDt;
      const anchorSpeed = Math.hypot(anchorVx, anchorVz);

      let ux: number;
      let uz: number;
      if (anchorSpeed >= 0.06) {
        ux = anchorVx / anchorSpeed;
        uz = anchorVz / anchorSpeed;
      } else if (distFromRest > 5.8) {
        ux = -offsetX / distFromRest;
        uz = -offsetZ / distFromRest;
      } else {
        continue;
      }

      const signedAlongMotion = offsetX * ux + offsetZ * uz;
      const perpDrift = Math.abs(-offsetX * uz + offsetZ * ux);

      const isTrailingEnough = signedAlongMotion <= -triggerBehind;
      const isPerpDrifted = perpDrift > 3.6 && signedAlongMotion <= 0.5;
      const isUrgent = signedAlongMotion <= -6.2 || distFromRest > 6.8;

      if (!isTrailingEnough && !isPerpDrifted && !isUrgent) {
        continue;
      }

      if (!isUrgent && !areNeighborsSupportive(state.legs, leg.index)) {
        continue;
      }

      const [endRestX, endRestZ] = localToSlopeWorldXZ(
        endStepX,
        endStepZ,
        endStepHeading,
        state.bodyPitchDeg,
        state.bodyRollDeg,
        leg.restLocal[0],
        leg.restLocal[2]
      );

      const effOvershoot = anchorSpeed >= 0.06 ? strideOvershoot : 1.0;
      const targetX = endRestX + ux * effOvershoot;
      const targetZ = endRestZ + uz * effOvershoot;

      const stepSpan = Math.hypot(
        targetX - leg.plantedWorld[0],
        targetZ - leg.plantedWorld[2]
      );
      if (stepSpan < minStepSpan && !isUrgent) {
        continue;
      }

      const waveDiff = (leg.waveOrder - state.nextWaveCursor + numLegs) % numLegs;
      const waveBonus = waveDiff === 0 ? 3.2 : waveDiff === 1 ? 1.6 : 0.0;
      const score =
        Math.max(-signedAlongMotion, distFromRest * 0.85) + perpDrift * 0.5 + waveBonus;

      if (score > bestScore) {
        bestScore = score;
        bestLeg = leg;
        bestTargetX = targetX;
        bestTargetZ = targetZ;
      }
    }

    if (bestLeg) {
      const targetGroundY = sampleHeightAt(bestTargetX, bestTargetZ);
      bestLeg.stepStartWorld = [
        bestLeg.currentWorld[0],
        bestLeg.currentWorld[1],
        bestLeg.currentWorld[2],
      ];
      bestLeg.stepTargetWorld = [bestTargetX, targetGroundY, bestTargetZ];
      bestLeg.stepProgress = 0.0;
      bestLeg.stanceTime = 0.0;
      state.nextWaveCursor = (bestLeg.waveOrder + 1) % numLegs;
      state.stepCooldown = stepDuration * 0.25;
    }
  }

  // 3) Procedural 4-Foot Support Plane Alignment + Weight-Shift Sway:
  const groundedLegs = state.legs.map((l) => ({
    ...l,
    currentWorld: [
      l.currentWorld[0],
      sampleHeightAt(l.currentWorld[0], l.currentWorld[2]),
      l.currentWorld[2],
    ] as [number, number, number],
  }));
  const footPlane = computeFootPlaneAngles(groundedLegs, state.headingDeg);

  const gaitRollSway = isMoving ? Math.sin(state.gaitPhaseTime) * 2.2 : 0;
  const gaitPitchSway = isMoving ? Math.cos(state.gaitPhaseTime) * 1.4 : 0;
  const accelPitch = (state.linearSpeed / maxLinearSpeed) * -2.0;
  const turnRoll = (state.angularSpeedDeg / maxTurnSpeedDeg) * 2.4;

  state.bodyPitchDeg = lerp(
    state.bodyPitchDeg,
    clamp(footPlane.targetPitchDeg + accelPitch + gaitPitchSway, -46, 46),
    Math.min(1, clampedDt * 7.5)
  );
  state.bodyRollDeg = lerp(
    state.bodyRollDeg,
    clamp(footPlane.targetRollDeg + turnRoll + gaitRollSway, -46, 46),
    Math.min(1, clampedDt * 7.5)
  );

  // In Modo Base, lower the carapace belly down toward the terrain while burying the 4 feet!
  const cosTilt =
    Math.cos((state.bodyPitchDeg * Math.PI) / 180) *
    Math.cos((state.bodyRollDeg * Math.PI) / 180);
  const hullGroundY = sampleHeightAt(state.posX, state.posZ);
  const strideBob = isMoving ? Math.sin(state.gaitPhaseTime * 2) * 0.45 * (1 - deploySmooth) : 0;
  const activeClearance = lerp(state.clearanceHeight, 3.6, deploySmooth);
  const minHullClearance = lerp(5.8, 3.2, deploySmooth);
  const targetPosY = Math.max(
    footPlane.avgFootY + activeClearance * Math.max(0.65, cosTilt) + strideBob,
    hullGroundY + minHullClearance
  );
  state.posY = lerp(state.posY, targetPosY, Math.min(1, clampedDt * 8.5));

  // 4) Articulated Neck & Lower Jaw (Mouth):
  // In Modo Walker: head held upright with subtle gait nod & turn look-ahead, mouth closed (0 deg)
  // In Modo Base: lowers head (+22 deg downward pitch) and opens mouth wide (+34 deg jaw pitch)!
  const walkerNeckPitch = isMoving ? Math.sin(state.gaitPhaseTime * 2) * 1.8 : 0;
  const walkerNeckYaw = clamp(-state.angularSpeedDeg * 0.28, -14, 14);
  state.neckPitchDeg = lerp(walkerNeckPitch, 22.0, deploySmooth);
  state.neckYawDeg = lerp(walkerNeckYaw, 0.0, deploySmooth);
  state.jawOpenDeg = 34.0 * deploySmooth;

  // 5) Solve exact 3D 3-bone Tortoise IK in the hull's local frame for all 4 legs
  for (const leg of state.legs) {
    solveSpiderLegIK(state, leg);
  }
}
