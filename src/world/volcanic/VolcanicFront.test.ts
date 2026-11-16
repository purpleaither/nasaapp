// MISSÃO 1 — sequência científica, permissões de operação e extração.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventHandler, type AppBase, type Application } from 'playcanvas';
import { InputSystem } from '../../systems/InputSystem.ts';
import { InputEvent, PlayerEvent, VolcanicEvent, WalkerEvent } from '../../systems/events/worldEvents.ts';
import { actionSeconds } from '../../systems/missions.ts';
import { MISSION_CONFIG } from '../../systems/missionConfig.ts';
import { VolcanicFront } from './VolcanicFront.ts';

function setup() {
  const app = new EventHandler();
  const front = new VolcanicFront(app as AppBase);
  front.attachSimulation();
  const driveTo = ({ x, z }: { x: number; z: number }, dt = 1 / 60) => {
    app.fire(WalkerEvent.POSE_UPDATED, { x, z, y: 0, headingDeg: 28 });
    app.fire(InputEvent.AXES, { dt });
  };
  const onFoot = (position: { x: number; z: number } = front.getStatus().target) => {
    app.fire(PlayerEvent.POSE_UPDATED, { ...position, y: 0, headingDeg: 0 });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
  };
  const execute = (index?: number) => app.fire(VolcanicEvent.COMPLETE_OBJECTIVE, index);
  const finish = () => {
    const status = front.getStatus();
    if (status.fieldActionActive && status.completedCheckpoints === 0) {
      // Simula somente o retorno do renderizador; as regras de missão continuam reais.
      app.fire(VolcanicEvent.FIELD_PHOTO, { index: status.completedCheckpoints, captureId: status.fieldActionId, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
    }
    app.fire(InputEvent.AXES, { dt: actionSeconds('mineral-sampling', status.completedCheckpoints) + 0.001 });
  };
  return { app, front, driveTo, onFoot, execute, finish };
}

test('mission finishes after one joint photograph and sealed M01, without travelling to extraction', () => {
  const { app, front, driveTo, onFoot, execute, finish } = setup();
  try {
    const { target, extraction } = front.getStatus();
    execute(0);
    assert.equal(front.getStatus().fieldActionActive, false);
    app.fire(VolcanicEvent.START);
    driveTo(extraction);
    assert.equal(front.getStatus().evacuated, false);
    driveTo({ x: target.x + target.radius + 1, z: target.z });
    execute(0);
    assert.equal(front.getStatus().fieldActionActive, false);
    driveTo(target);
    onFoot(target);
    execute(2);
    assert.equal(front.getStatus().fieldActionActive, false);
    for (const index of [0, 1]) {
      if (index === 1) app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
      assert.equal(front.getStatus().completedCheckpoints, index);
      execute(index);
      assert.equal(front.getStatus().fieldActionActive, true);
      finish();
    }
    assert.equal(front.getStatus().completedCheckpoints, 2);
    assert.equal(front.getStatus().missionCompleted, true);
    assert.equal(front.getStatus().evacuated, false);
    assert.equal(front.getStatus().phase, 'ended');
    assert.ok(front.getStatus().distanceToExtraction > 0, 'success occurs at the outcrop, not an extraction zone');
    const finished = front.getStatus();
    app.fire(InputEvent.AXES, { dt: 100 });
    assert.deepEqual(front.getStatus(), finished, 'victory is stable and stops the mission simulation');
  } finally { front.destroy(); }
});

test('one joint photograph requires EVA; collection then requires boarding near the outcrop', () => {
  const { app, front, driveTo, onFoot, execute, finish } = setup();
  try {
    const target = front.getStatus().target;
    app.fire(VolcanicEvent.START);
    driveTo({ x: target.x + 65, z: target.z });
    app.fire(PlayerEvent.POSE_UPDATED, { ...target, y: 0, headingDeg: 0 });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    for (const index of [0]) {
      execute(index);
      assert.equal(front.getStatus().fieldOperator, 'explorer');
      finish();
    }
    assert.equal(front.getStatus().fieldRequiresBoarding, true);
    execute(1);
    assert.equal(front.getStatus().fieldActionActive, false);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
    execute(1);
    assert.equal(front.getStatus().fieldActionActive, false, 'Walker must also be in range');
    driveTo(target);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
    execute(1);
    assert.equal(front.getStatus().mineralStage, 'align');
    finish();
    assert.equal(front.getStatus().completedCheckpoints, 2);
  } finally { front.destroy(); }
});

test('pause freezes collection, leaving range cancels it and instrument damage prevents a sample', () => {
  const { app, front, driveTo, onFoot, execute, finish } = setup();
  try {
    app.fire(VolcanicEvent.START);
    const target = front.getStatus().target;
    driveTo(target);
    onFoot(target);
    execute(0);
    app.fire(VolcanicEvent.PAUSE);
    finish();
    assert.equal(front.getStatus().completedCheckpoints, 0);
    app.fire(VolcanicEvent.RESUME);
    onFoot({ x: target.x + 100, z: target.z });
    driveTo({ x: target.x + 100, z: target.z });
    assert.equal(front.getStatus().fieldActionActive, false);
    assert.equal(front.getStatus().completedCheckpoints, 0);
    driveTo(target);
    onFoot(target);
    execute(0);
    driveTo(target, 200);
    assert.equal(front.getStatus().phase, 'operation', 'seismic damage does not imply automatic destruction');
    assert.equal(front.getStatus().geology.equipment, 30);
    assert.equal(front.getStatus().fieldActionActive, false);
    assert.equal(front.getStatus().geology.evacuationRequired, true);
    assert.equal(front.getStatus().completedCheckpoints, 0);
  } finally { front.destroy(); }
});

test('C executes the current objective once per press through the keyboard system', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const keyboard = Object.assign(new EventTarget(), { closest: () => null });
  globalThis.window = keyboard as unknown as Window & typeof globalThis;
  globalThis.document = new EventTarget() as Document;
  const { app, front, driveTo, onFoot, finish } = setup();
  const input = new InputSystem(app as Application);
  const press = (repeat = false) => keyboard.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { code: 'KeyC', repeat }));
  try {
    app.fire(VolcanicEvent.START);
    press();
    assert.equal(front.getStatus().fieldActionActive, false);
    driveTo(front.getStatus().target);
    onFoot();
    keyboard.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyC' }));
    press();
    assert.equal(front.getStatus().fieldActionActive, true);
    finish();
    press(true);
    assert.equal(front.getStatus().completedCheckpoints, 1);
    assert.equal(front.getStatus().fieldActionActive, false);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
    keyboard.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyC' }));
    press();
    assert.equal(front.getStatus().fieldActionActive, true);
  } finally {
    input.destroy(); front.destroy();
    globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});

test('mission 1 can be completed using actual Walker steering and terrain with all legacy route presets', async t => {
  const { createCratersForSeed, samplePlanetHeight, WORLD_HALF } = await import('../terrain/geology.ts');
  const { createSpiderWalkerState, stepSpiderWalkerKinematics } = await import('../walker/spiderKinematics.ts');
  t.mock.method(Math, 'random', () => 0.75);
  const craters = createCratersForSeed(MISSION_CONFIG.mapSeed);
  const height = (x: number, z: number) => samplePlanetHeight(x, z, MISSION_CONFIG.mapSeed, craters);
  for (const speed of MISSION_CONFIG.volcanic.speedOptions) {
    const { app, front } = setup();
    const spawn = MISSION_CONFIG.walkerSpawn;
    const walker = createSpiderWalkerState(spawn.x, spawn.z, spawn.headingDeg, height);
    app.fire(VolcanicEvent.SET_SPEED, speed);
    app.fire(VolcanicEvent.START);
    let status = front.getStatus();
    try {
      for (let frame = 0; frame < 12000 && status.phase === 'operation'; frame++) {
        if (status.completedCheckpoints === 1 && status.fieldRequiresBoarding) {
          app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
          status = front.getStatus();
        }
        if (status.completedCheckpoints === 0 && status.targetDistance === 0 && status.fieldRequiresDisembarking) {
          const dx = status.target.x - walker.posX;
          const dz = status.target.z - walker.posZ;
          const length = Math.hypot(dx, dz) || 1;
          app.fire(PlayerEvent.POSE_UPDATED, { x: status.target.x + dx / length * 20, z: status.target.z + dz / length * 20, y: 0, headingDeg: 0 });
          app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
          status = front.getStatus();
        }
        if (status.target !== status.extraction && status.targetDistance === 0 && !status.fieldActionActive) {
          app.fire(VolcanicEvent.COMPLETE_OBJECTIVE);
          status = front.getStatus();
        }
        if (status.fieldActionActive) {
          walker.linearSpeed = 0; walker.angularSpeedDeg = 0;
          if (status.completedCheckpoints === 0) app.fire(VolcanicEvent.FIELD_PHOTO, {
            index: status.completedCheckpoints, captureId: status.fieldActionId, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==',
          });
        }
        const right = Math.abs(status.targetBearing) > 6 ? Math.sign(status.targetBearing) : 0;
        stepSpiderWalkerKinematics(walker, {
          turn: status.fieldActionActive ? 0 : -right,
          forward: !status.fieldActionActive && Math.abs(status.targetBearing) < 40 ? 1 : 0,
          boost: true,
        }, MISSION_CONFIG.stepSeconds, height, WORLD_HALF * 0.95);
        app.fire(WalkerEvent.POSE_UPDATED, { x: walker.posX, y: walker.posY, z: walker.posZ, headingDeg: walker.headingDeg });
        app.fire(InputEvent.AXES, { dt: MISSION_CONFIG.stepSeconds });
        status = front.getStatus();
      }
      assert.equal(status.missionCompleted, true, `${speed} UJ/s: ${status.defeat ?? 'mission incomplete'}`);
      assert.equal(status.completedCheckpoints, 2);
    } finally { front.destroy(); }
  }
});

test('only a saved joint photo with validated framing can unlock the sample; failure and stale images cannot', () => {
  const { app, front, driveTo, onFoot, execute } = setup();
  try {
    app.fire(VolcanicEvent.START); driveTo(front.getStatus().target); onFoot(); execute(0);
    const first = front.getStatus().fieldActionId;
    app.fire(InputEvent.AXES, { dt: 1.8 });
    assert.equal(front.getStatus().completedCheckpoints, 0);
    app.fire(VolcanicEvent.FIELD_PHOTO, { index: 0, captureId: first, source: 'eva', framingValidated: false, image: 'data:image/jpeg;base64,dGVzdA==' });
    app.fire(InputEvent.AXES, { dt: 0.01 });
    assert.equal(front.getStatus().completedCheckpoints, 0, 'image without both surfaces in frame is rejected');
    app.fire(VolcanicEvent.FIELD_PHOTO_ERROR, { index: 0, captureId: first, message: 'Enquadre ambas as superfícies.' });
    assert.equal(front.getStatus().fieldActionActive, false);
    execute(0); const retry = front.getStatus().fieldActionId;
    assert.ok(retry > first);
    app.fire(VolcanicEvent.FIELD_PHOTO, { index: 0, captureId: first, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
    app.fire(InputEvent.AXES, { dt: 1.8 });
    assert.equal(front.getStatus().completedCheckpoints, 0);
    app.fire(VolcanicEvent.FIELD_PHOTO, { index: 0, captureId: retry, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
    app.fire(InputEvent.AXES, { dt: 0.01 });
    assert.equal(front.getStatus().completedCheckpoints, 1);
    assert.equal(front.getStatus().fieldRequiresBoarding, true);
  } finally { front.destroy(); }
});

test('C and Shift+C work with key fallback, provide feedback out of range and preserve typing/Ctrl+C', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let typing = false;
  const keyboard = Object.assign(new EventTarget(), { closest: () => typing ? {} : null });
  globalThis.window = keyboard as unknown as Window & typeof globalThis;
  globalThis.document = new EventTarget() as Document;
  const { app, front, driveTo, onFoot } = setup();
  const input = new InputSystem(app as Application);
  let feedback = '';
  app.on(VolcanicEvent.FIELD_FEEDBACK, payload => { feedback = payload.message; });
  const key = (type: string, extra: Record<string, unknown> = {}) => keyboard.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code: '', key: 'C', repeat: false, ...extra }));
  try {
    key('keydown');
    assert.ok(feedback.includes('Inicie'));
    key('keyup');
    app.fire(VolcanicEvent.START);
    key('keydown');
    assert.ok(feedback.includes('Desembarque'));
    key('keyup');
    driveTo(front.getStatus().target);
    onFoot();
    typing = true;
    key('keydown');
    assert.equal(front.getStatus().fieldActionActive, false);
    typing = false;
    key('keydown', { ctrlKey: true });
    assert.equal(front.getStatus().fieldActionActive, false);
    key('keydown', { shiftKey: true });
    assert.equal(front.getStatus().fieldActionActive, true);
  } finally {
    input.destroy(); front.destroy();
    globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});


test('a missing photograph times out and allows C to retry instead of locking the astronaut', () => {
  const { app, front, driveTo, onFoot, execute } = setup();
  try {
    app.fire(VolcanicEvent.START);
    driveTo(front.getStatus().target);
    onFoot();
    execute(0);
    const captureId = front.getStatus().fieldActionId;
    app.fire(InputEvent.AXES, { dt: 5 });
    assert.equal(front.getStatus().fieldActionActive, false);
    assert.equal(front.getStatus().completedCheckpoints, 0);
    execute(0);
    assert.equal(front.getStatus().fieldActionActive, true);
    assert.ok(front.getStatus().fieldActionId > captureId);
  } finally { front.destroy(); }
});

test('joint photography requires EVA and boarding cancels any pending capture', () => {
  const { app, front, driveTo, onFoot, execute } = setup();
  try {
    app.fire(VolcanicEvent.START); driveTo(front.getStatus().target); execute(0);
    assert.equal(front.getStatus().fieldActionActive, false);
    onFoot(); execute(0); const first = front.getStatus().fieldActionId;
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
    app.fire(InputEvent.AXES, { dt: 0.01 });
    assert.equal(front.getStatus().fieldActionActive, false);
    assert.equal(front.getStatus().completedCheckpoints, 0);
    onFoot(); execute(0); const captureId = front.getStatus().fieldActionId;
    assert.ok(captureId > first);
    app.fire(VolcanicEvent.FIELD_PHOTO, { index: 0, captureId, source: 'walker', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
    app.fire(InputEvent.AXES, { dt: 1.7 });
    assert.equal(front.getStatus().completedCheckpoints, 0);
    app.fire(VolcanicEvent.FIELD_PHOTO, { index: 0, captureId, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
    app.fire(InputEvent.AXES, { dt: 0.01 });
    assert.equal(front.getStatus().completedCheckpoints, 1);
    assert.equal(front.getStatus().fieldRequiresBoarding, true);
  } finally { front.destroy(); }
});
