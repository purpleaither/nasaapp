import { missionLayout } from '../world/geological/crisis.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventHandler, type AppBase } from 'playcanvas';
import { VolcanicFront } from '../world/volcanic/VolcanicFront.ts';
import { InputEvent, VolcanicEvent, WalkerEvent, type VolcanicStatus } from './events/worldEvents.ts';
import { BASE_RESTART_DELAY, scheduleBaseRestart, scheduleAstronautRestart } from './missionRestart.ts';

test('base restarts once after hull reaches zero, never on partial damage, pause or victory', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let restarts = 0;
  for (const status of [
    { phase: 'operation' as const, hull: 40, evacuated: false },
    { phase: 'paused' as const, hull: 0, evacuated: false },
    { phase: 'ended' as const, hull: 100, evacuated: true },
    { phase: 'ended' as const, hull: 0, evacuated: false, missionCompleted: true },
  ]) scheduleBaseRestart(status, () => restarts++);
  t.mock.timers.tick(BASE_RESTART_DELAY * 2);
  assert.equal(restarts, 0);
  scheduleBaseRestart({ phase: 'ended', hull: 0, evacuated: false }, () => restarts++);
  t.mock.timers.tick(BASE_RESTART_DELAY - 1);
  assert.equal(restarts, 0);
  t.mock.timers.tick(1);
  assert.equal(restarts, 1);
  t.mock.timers.tick(BASE_RESTART_DELAY * 2);
  assert.equal(restarts, 1);
});

test('astronaut death also restarts automatically; cleanup cancels pending restarts', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let restarts = 0;
  scheduleAstronautRestart(false, () => restarts++);
  const cancel = scheduleAstronautRestart(true, () => restarts++);
  cancel();
  t.mock.timers.tick(BASE_RESTART_DELAY);
  assert.equal(restarts, 0);
  scheduleAstronautRestart(true, () => restarts++);
  t.mock.timers.tick(BASE_RESTART_DELAY);
  assert.equal(restarts, 1);
  const cancelBase = scheduleBaseRestart({ phase: 'ended', hull: 0, evacuated: false }, () => restarts++);
  cancelBase();
  t.mock.timers.tick(BASE_RESTART_DELAY);
  assert.equal(restarts, 1);
});

test('actual localized rockfall and structural damage emit zero hull and schedules a fresh mission', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const app = new EventHandler();
  const front = new VolcanicFront(app as AppBase);
  front.attachSimulation();
  let restarts = 0;
  let cancel = () => {};
  app.on(VolcanicEvent.STATUS_CHANGED, (status: VolcanicStatus) => {
    if (status.phase === 'ended') cancel = scheduleBaseRestart(status, () => restarts++);
  });
  try {
    app.fire(VolcanicEvent.START);
    const position = missionLayout(front.getStatus().target).rockfall;
    app.fire(WalkerEvent.POSE_UPDATED, { ...position, y: 0, headingDeg: 28 });
    for (let step = 0; step < 12000 && front.getStatus().phase !== 'ended'; step++) {
      app.fire(InputEvent.AXES, { dt: 1 / 60 });
    }
    assert.equal(front.getStatus().hull, 0);
    assert.equal(front.getStatus().phase, 'ended');
    assert.equal(restarts, 0);
    t.mock.timers.tick(BASE_RESTART_DELAY);
    assert.equal(restarts, 1);
  } finally { cancel(); front.destroy(); }
});
