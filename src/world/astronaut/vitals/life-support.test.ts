import { GeologicalEvent } from '../../geological/crisis.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventHandler, type AppBase } from 'playcanvas';
import { PlayerLifeSupport } from './PlayerLifeSupport.ts';
import { LifeSupportEvent } from './events.ts';
import { PlayerEvent, SimulationEvent, VolcanicEvent } from '../../../systems/events/worldEvents.ts';

function setup() {
  const oldWindow = globalThis.window;
  globalThis.window = new EventTarget() as unknown as Window & typeof globalThis;
  const app = new EventHandler();
  const life = new PlayerLifeSupport(app as AppBase);
  return { app, life, cleanup() { life.dispose(); globalThis.window = oldWindow; } };
}
function tick(app: EventHandler, frames = 60) {
  for (let frame = 0; frame < frames; frame++) app.fire(SimulationEvent.STEP, 1 / 60);
}

test('supplies are preserved in preparation, cabin and pause; walking/running use more oxygen', () => {
  const { app, life, cleanup } = setup();
  try {
    tick(app);
    assert.equal(life.oxygen, 100);
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    tick(app);
    assert.equal(life.oxygen, 100, 'cabin preserves supplies');
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    tick(app);
    const idleLoss = 100 - life.oxygen;
    app.fire(LifeSupportEvent.REFILL_OXYGEN);
    app.fire(PlayerEvent.STATE_CHANGED, { isMoving: true, isRunning: false });
    tick(app);
    const walkLoss = 100 - life.oxygen;
    app.fire(LifeSupportEvent.REFILL_OXYGEN);
    app.fire(PlayerEvent.STATE_CHANGED, { isMoving: true, isRunning: true });
    tick(app);
    const runLoss = 100 - life.oxygen;
    assert.ok(Math.abs(walkLoss - idleLoss * 2) < 1e-8);
    assert.ok(Math.abs(runLoss - idleLoss * 4) < 1e-8);
    assert.ok(life.water < 100 && life.food < 100);
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'paused' });
    const before = life.getVitalsData();
    tick(app);
    assert.deepEqual(life.getVitalsData(), before);
  } finally { cleanup(); }
});

test('low oxygen warns, suffocation damages health and refills restore all three resources', () => {
  const { app, life, cleanup } = setup();
  try {
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    let warnings = 0;
    app.on(LifeSupportEvent.WARNING_TRIGGERED, () => warnings++);
    life.oxygen = 24;
    tick(app, 1);
    assert.equal(life.isCriticalOxygen, true);
    assert.equal(warnings, 1);
    life.oxygen = 0;
    tick(app);
    assert.equal(life.isSuffocating, true);
    assert.ok(life.health < 100);
    app.fire(LifeSupportEvent.REFILL_OXYGEN);
    app.fire(LifeSupportEvent.DRINK_WATER);
    app.fire(LifeSupportEvent.EAT_FOOD);
    assert.deepEqual([life.oxygen, life.water, life.food], [100, 100, 100]);
    assert.equal(life.isSuffocating, false);
    tick(app, 1);
    assert.equal(life.isRecovering, true);
  } finally { cleanup(); }
});

test('death pauses the mission and HUD snapshot events stop after disposal', () => {
  const { app, life, cleanup } = setup();
  try {
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    let deaths = 0;
    let pauses = 0;
    let snapshots = 0;
    app.on(LifeSupportEvent.GAME_OVER, () => deaths++);
    app.on(VolcanicEvent.PAUSE, () => pauses++);
    app.on(LifeSupportEvent.VITALS_CHANGED, () => snapshots++);
    life.health = 1;
    life.oxygen = 0;
    tick(app);
    assert.equal(life.health, 0);
    assert.equal(life.deathCause, 'asphyxiation');
    assert.equal(deaths, 1);
    assert.equal(pauses, 1);
    const previous = snapshots;
    app.fire(LifeSupportEvent.REQUEST_VITALS);
    assert.equal(snapshots, previous + 1);
    life.dispose();
    app.fire(LifeSupportEvent.REQUEST_VITALS);
    assert.equal(snapshots, previous + 1);
  } finally { cleanup(); }
});

test('rock impacts cause discrete injuries, while cabin, pause and disposal protect life support', () => {
  const { app, life, cleanup } = setup();
  try {
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    assert.equal(life.health, 100, 'cabin protects the astronaut');
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    assert.equal(life.health, 55);
    assert.equal(life.deathCause, 'rockfall');
    tick(app, 30);
    assert.ok(life.health > 55, 'no persistent invisible lava damage');
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'paused' });
    const before = life.health;
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    tick(app);
    assert.equal(life.health, before);
    life.dispose();
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    assert.equal(life.health, before);
  } finally { cleanup(); }
});

test('fatal rock impact pauses the mission once and preserves the astronaut restart flow', () => {
  const { app, life, cleanup } = setup();
  try {
    let deaths = 0, pauses = 0;
    app.on(LifeSupportEvent.GAME_OVER, () => deaths++);
    app.on(VolcanicEvent.PAUSE, () => pauses++);
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    life.health = 40;
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    app.fire(GeologicalEvent.INJURY, { damage: 45 });
    assert.equal(life.health, 0);
    assert.equal(life.isGameOver, true);
    assert.equal(life.deathCause, 'rockfall');
    assert.equal(deaths, 1); assert.equal(pauses, 1);
  } finally { cleanup(); }
});

test('old front-position events cannot burn any terrain or astronaut', () => {
  const { app, life, cleanup } = setup();
  try {
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    app.fire(VolcanicEvent.POSITION_CHANGED, 10000);
    app.fire(PlayerEvent.POSE_UPDATED, { x: 0, y: 0, z: -2000, headingDeg: 0 });
    tick(app);
    assert.equal(life.health, 100);
  } finally { cleanup(); }
});
