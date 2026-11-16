import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLegFootWorldFK,
  createSpiderWalkerState,
  localToSlopeWorldXZ,
  rootLocalToWorld,
  stepSpiderWalkerKinematics,
  worldToRootLocal,
} from './spiderKinematics.ts';

const flatTerrain = () => 10;
// Steep cliff rising to the right (+X) and ahead (+Z), matching the user's steep wall scenario
const steepRightCliff = (x: number, z: number) => 10 + x * 0.72 + z * 0.55;

test('Spider-Walker stays stationary when player gives zero input (does not walk by itself)', () => {
  const state = createSpiderWalkerState(0, 0, 0, flatTerrain);
  const startX = state.posX;
  const startZ = state.posZ;
  const startHeading = state.headingDeg;

  for (let i = 0; i < 60; i++) {
    stepSpiderWalkerKinematics(state, { forward: 0, turn: 0, boost: false }, 1 / 60, flatTerrain);
  }

  assert.equal(state.posX, startX);
  assert.equal(state.posZ, startZ);
  assert.equal(state.headingDeg, startHeading);
  assert.equal(state.linearSpeed, 0);
  assert.equal(state.angularSpeedDeg, 0);
});

test('Zero double-stepping: each leg takes a single clean stride and stays firmly planted for a full stance phase before stepping again', () => {
  const state = createSpiderWalkerState(0, 0, 0, flatTerrain);

  let maxSimultaneousStepping = 0;
  let maxLaunchedInSingleFrame = 0;
  const steppedLegs = new Set<string>();

  const minCoxa = new Array(4).fill(Infinity);
  const maxCoxa = new Array(4).fill(-Infinity);
  const minFemur = new Array(4).fill(Infinity);
  const maxFemur = new Array(4).fill(-Infinity);
  const minTibia = new Array(4).fill(Infinity);
  const maxTibia = new Array(4).fill(-Infinity);
  const minFoot = new Array(4).fill(Infinity);
  const maxFoot = new Array(4).fill(-Infinity);

  // Track planted frames between steps for every leg to prove no leg ever double-stomps in place
  const framesSinceLastLanding = new Array(4).fill(100);
  const stepDistances: number[] = [];

  for (let i = 0; i < 200; i++) {
    const prevPlanted = new Set(
      state.legs.filter((l) => l.stepProgress >= 1.0).map((l) => l.namePrefix)
    );
    stepSpiderWalkerKinematics(state, { forward: 1, turn: 0.15, boost: false }, 0.02, flatTerrain);
    const steppingNow = state.legs.filter((l) => l.stepProgress < 1.0);
    if (steppingNow.length > maxSimultaneousStepping) {
      maxSimultaneousStepping = steppingNow.length;
    }

    let launchedThisFrame = 0;
    state.legs.forEach((l, idx) => {
      if (l.stepProgress < 1.0) {
        steppedLegs.add(l.namePrefix);
        if (prevPlanted.has(l.namePrefix)) {
          launchedThisFrame++;
          // Assert this leg did NOT just land and immediately re-step (must stay planted >= 14 frames!)
          assert.ok(
            framesSinceLastLanding[idx] >= 14,
            `Leg ${l.namePrefix} double-stepped after only ${framesSinceLastLanding[idx]} planted frames!`
          );
          const span = Math.hypot(
            l.stepTargetWorld[0] - l.stepStartWorld[0],
            l.stepTargetWorld[2] - l.stepStartWorld[2]
          );
          stepDistances.push(span);
          assert.ok(
            span >= 4.8,
            `Leg ${l.namePrefix} took a tiny micro-step of ${span}m instead of a full stride (>= 4.8m)`
          );
          framesSinceLastLanding[idx] = 0;
        }
      } else {
        framesSinceLastLanding[idx]++;
      }

      if (l.coxaYawDeg < minCoxa[idx]) minCoxa[idx] = l.coxaYawDeg;
      if (l.coxaYawDeg > maxCoxa[idx]) maxCoxa[idx] = l.coxaYawDeg;
      if (l.femurPitchDeg < minFemur[idx]) minFemur[idx] = l.femurPitchDeg;
      if (l.femurPitchDeg > maxFemur[idx]) maxFemur[idx] = l.femurPitchDeg;
      if (l.tibiaPitchDeg < minTibia[idx]) minTibia[idx] = l.tibiaPitchDeg;
      if (l.tibiaPitchDeg > maxTibia[idx]) maxTibia[idx] = l.tibiaPitchDeg;
      if (l.footPitchDeg < minFoot[idx]) minFoot[idx] = l.footPitchDeg;
      if (l.footPitchDeg > maxFoot[idx]) maxFoot[idx] = l.footPitchDeg;
    });

    if (launchedThisFrame > maxLaunchedInSingleFrame) {
      maxLaunchedInSingleFrame = launchedThisFrame;
    }
  }

  assert.equal(
    maxLaunchedInSingleFrame,
    1,
    'At most 1 leg may launch into a step on any single frame (never stepping together)'
  );
  assert.ok(
    maxSimultaneousStepping >= 1 && maxSimultaneousStepping <= 2,
    `Expected at most 2 legs in the air simultaneously for 4-legged Tortuga, got ${maxSimultaneousStepping}`
  );
  assert.equal(steppedLegs.size, 4, 'All 4 tortoise legs should take turns stepping in the wave');
  assert.ok(stepDistances.length >= 8, 'Should complete multiple full wave cycles');

  assert.equal(state.footPadOffset, 0, 'Tortuga leg must have 2 segments (zero 3rd tarsus segment)');
  for (let idx = 0; idx < 4; idx++) {
    const coxaSweep = maxCoxa[idx] - minCoxa[idx];
    const femurSweep = maxFemur[idx] - minFemur[idx];
    const footSweep = maxFoot[idx] - minFoot[idx];
    assert.ok(
      coxaSweep > 15,
      `Leg ${state.legs[idx].namePrefix} coxa should sweep > 15 deg during stride, got ${coxaSweep}`
    );
    assert.ok(
      femurSweep > 12,
      `Leg ${state.legs[idx].namePrefix} femur should lift/lower > 12 deg during stride, got ${femurSweep}`
    );
    assert.ok(
      footSweep > 20,
      `Leg ${state.legs[idx].namePrefix} foot sole/claws should curl & level > 20 deg during stride, got ${footSweep}`
    );
    assert.ok(
      maxTibia[idx] <= -40,
      `Leg ${state.legs[idx].namePrefix} 2nd segment (tibia) must always bend downward from knee (<= -40 deg), got ${maxTibia[idx]}`
    );
  }
});

test('All headings (-360..+360 deg), slow button tapping on steep slopes, and reversing uphill NEVER leave legs frozen or buried underground', () => {
  // 1) Verify every heading around the compass (including 270..340 deg and -340..-270 deg) steps both forward and in reverse without turning!
  for (let heading = -340; heading <= 340; heading += 40) {
    const rad = (heading * Math.PI) / 180;
    const mountainAlongHeading = (x: number, z: number) =>
      10 + (x * Math.sin(rad) + z * Math.cos(rad)) * 0.82;

    // Forward climb up the mountain at this heading (turn = 0)
    const fwdState = createSpiderWalkerState(0, 0, heading, mountainAlongHeading);
    const fwdStepped = new Set<string>();
    for (let i = 0; i < 80; i++) {
      stepSpiderWalkerKinematics(
        fwdState,
        { forward: 1, turn: 0, boost: false },
        0.02,
        mountainAlongHeading
      );
      for (const l of fwdState.legs) {
        if (l.stepProgress < 1.0) fwdStepped.add(l.namePrefix);
      }
    }
    assert.equal(
      fwdStepped.size,
      4,
      `At heading ${heading} deg climbing uphill with turn=0, all 4 legs must step (got ${fwdStepped.size})`
    );

    // Reverse ("dando ré em uma montanha, apontado para cima") at this heading (turn = 0)
    const revState = createSpiderWalkerState(0, 0, heading, mountainAlongHeading);
    const revStepped = new Set<string>();
    for (let i = 0; i < 80; i++) {
      stepSpiderWalkerKinematics(
        revState,
        { forward: -1, turn: 0, boost: false },
        0.02,
        mountainAlongHeading
      );
      for (const l of revState.legs) {
        if (l.stepProgress < 1.0) revStepped.add(l.namePrefix);
      }
    }
    assert.equal(
      revStepped.size,
      4,
      `At heading ${heading} deg reversing on a mountain with turn=0, all 4 legs must step (got ${revStepped.size})`
    );
  }

  // 2) Verify slow button tapping on a steep slope followed by continuous walking and reversing
  //    never leaves legs behind and never buries the Knee joint or Foot Sole underground!
  const steepMountain = (x: number, z: number) => 10 - x * 0.65 + z * 0.65;
  const tapState = createSpiderWalkerState(0, 0, 315, steepMountain);

  // Phase A: Slow tapping of W (4 frames pressed, 20 frames released)
  for (let i = 0; i < 240; i++) {
    const forward = i % 24 < 4 ? 1 : 0;
    stepSpiderWalkerKinematics(tapState, { forward, turn: 0, boost: false }, 0.02, steepMountain);
  }

  // Phase B: Resume walking straight (turn = 0), then reverse down the mountain (turn = 0)
  for (let i = 0; i < 160; i++) {
    const forward = i < 80 ? 1 : -1;
    stepSpiderWalkerKinematics(tapState, { forward, turn: 0, boost: false }, 0.02, steepMountain);

    for (const leg of tapState.legs) {
      const [rx, rz] = localToSlopeWorldXZ(
        tapState.posX,
        tapState.posZ,
        tapState.headingDeg,
        tapState.bodyPitchDeg,
        tapState.bodyRollDeg,
        leg.restLocal[0],
        leg.restLocal[2]
      );
      const distFromRest = Math.hypot(leg.currentWorld[0] - rx, leg.currentWorld[2] - rz);
      assert.ok(
        distFromRest < 11.5,
        `Leg ${leg.namePrefix} was left behind (${distFromRest.toFixed(2)}m from rest anchor)!`
      );

      // Verify exact 2-segment FK match and that Knee joint is strictly ABOVE the terrain
      const [fkX, fkY, fkZ] = computeLegFootWorldFK(tapState, leg);
      const fkErr = Math.hypot(
        fkX - leg.currentWorld[0],
        fkY - leg.currentWorld[1],
        fkZ - leg.currentWorld[2]
      );
      assert.ok(fkErr < 0.15, `Leg ${leg.namePrefix} FK error must be < 0.15m, got ${fkErr}`);

      const fRad = (leg.femurPitchDeg * Math.PI) / 180;
      const cRad = (leg.coxaYawDeg * Math.PI) / 180;
      const rKnee = tapState.coxaLength + tapState.femurLength * Math.cos(fRad);
      const yKnee = tapState.femurLength * Math.sin(fRad);
      const xCoxa = leg.side * rKnee;
      const kneeWorld = rootLocalToWorld(
        tapState,
        leg.hipLocal[0] + xCoxa * Math.cos(cRad),
        leg.hipLocal[1] + yKnee,
        leg.hipLocal[2] - xCoxa * Math.sin(cRad)
      );
      const kneeGroundY = steepMountain(kneeWorld[0], kneeWorld[2]);
      assert.ok(
        kneeWorld[1] >= kneeGroundY,
        `Leg ${leg.namePrefix} knee joint must stay above ground, got ${
          kneeWorld[1] - kneeGroundY
        }m`
      );
    }
  }
});

test('Sturdy Tortuga tortoise stance and procedural sideways alignment on steep cliffs', () => {
  const state = createSpiderWalkerState(0, 0, 0, steepRightCliff);

  // Verify 4-legged Tortuga stance
  assert.equal(state.legs.length, 4);
  for (const leg of state.legs) {
    assert.ok(Math.abs(leg.restLocal[0]) >= 16.5, 'Tortuga legs should have sturdy lateral stance >= 16.5m');
  }

  // Walk along and up the steep right-hand cliff
  for (let i = 0; i < 90; i++) {
    stepSpiderWalkerKinematics(
      state,
      { forward: 1, turn: -0.2, boost: true },
      0.03,
      steepRightCliff
    );
  }

  // On a steep right-hand cliff (+X is higher), bodyRollDeg must tilt sideways (> +18 deg)
  assert.ok(
    state.bodyRollDeg > 18,
    `Tortuga should tilt sideways with the right-hand cliff (expected > 18 deg, got ${state.bodyRollDeg})`
  );

  for (const leg of state.legs) {
    assert.ok(Number.isFinite(leg.coxaYawDeg));
    assert.ok(Number.isFinite(leg.femurPitchDeg));
    assert.ok(Number.isFinite(leg.tibiaPitchDeg));
    assert.ok(Number.isFinite(leg.footPitchDeg));
    assert.ok(
      leg.femurPitchDeg >= -15 && leg.femurPitchDeg <= 80,
      `Femur ${leg.namePrefix} should stay in tortoise range [-15, 80]: got ${leg.femurPitchDeg}`
    );
    assert.ok(
      leg.tibiaPitchDeg < -15,
      `Tibia ${leg.namePrefix} should bend downward: got ${leg.tibiaPitchDeg}`
    );

    const [fkX, fkY, fkZ] = computeLegFootWorldFK(state, leg);
    const err = Math.hypot(
      fkX - leg.currentWorld[0],
      fkY - leg.currentWorld[1],
      fkZ - leg.currentWorld[2]
    );
    const maxAllowedErr = leg.stepProgress >= 1.0 ? 0.05 : 0.25;
    assert.ok(
      err < maxAllowedErr,
      `Foot ${leg.namePrefix} FK error should be < ${maxAllowedErr}m, got ${err}`
    );
  }

  const localPt = worldToRootLocal(state, state.posX, state.posY, state.posZ);
  assert.equal(localPt[0], 0);
  assert.equal(localPt[1], 0);
  assert.equal(localPt[2], 0);
});

test('Modo Base buries the 4 tortoise feet into the ground, lowers the head, and opens the mouth, restoring in Modo Walker', () => {
  const flatGround = () => 10.0;
  const state = createSpiderWalkerState(0, 0, 0, flatGround);
  const walkerPosY = state.posY;

  assert.equal(state.baseMode, false);
  assert.equal(state.jawOpenDeg, 0);
  assert.equal(state.neckPitchDeg, 0);

  // Transition to Modo Base
  for (let i = 0; i < 40; i++) {
    stepSpiderWalkerKinematics(
      state,
      { forward: 0, turn: 0, boost: false, baseMode: true },
      0.03,
      flatGround
    );
  }

  assert.equal(state.baseMode, true);
  assert.equal(state.baseDeployProgress, 1.0);
  assert.ok(
    state.neckPitchDeg >= 21.5,
    `Expected lowered head neckPitchDeg >= 21.5, got ${state.neckPitchDeg}`
  );
  assert.ok(
    state.jawOpenDeg >= 33.5,
    `Expected open mouth jawOpenDeg >= 33.5, got ${state.jawOpenDeg}`
  );
  assert.ok(
    state.posY < walkerPosY - 2.0,
    `Expected lowered hull posY in Modo Base, got ${state.posY} vs ${walkerPosY}`
  );

  for (const leg of state.legs) {
    assert.ok(
      leg.plantedWorld[1] < 10.0 - 1.3,
      `Expected ${leg.namePrefix} foot buried > 1.3m below ground (10.0m), got ${leg.plantedWorld[1]}`
    );
  }

  // Transition back to Modo Walker
  for (let i = 0; i < 40; i++) {
    stepSpiderWalkerKinematics(
      state,
      { forward: 0, turn: 0, boost: false, baseMode: false },
      0.03,
      flatGround
    );
  }

  assert.equal(state.baseMode, false);
  assert.equal(state.baseDeployProgress, 0.0);
  assert.ok(
    Math.abs(state.neckPitchDeg) < 0.1,
    `Expected upright neck in Modo Walker, got ${state.neckPitchDeg}`
  );
  assert.ok(
    Math.abs(state.jawOpenDeg) < 0.1,
    `Expected closed mouth in Modo Walker, got ${state.jawOpenDeg}`
  );
  for (const leg of state.legs) {
    assert.ok(
      Math.abs(leg.plantedWorld[1] - 10.0) < 0.05,
      `Expected ${leg.namePrefix} foot unburied at surface (10.0m) in Modo Walker, got ${leg.plantedWorld[1]}`
    );
  }
});
