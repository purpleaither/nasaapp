import test from 'node:test';
import assert from 'node:assert/strict';
import { EventHandler, type AppBase } from 'playcanvas';
import { VolcanicFront } from '../volcanic/VolcanicFront.ts';
import { GeologicalEvent, missionLayout } from './crisis.ts';
import { InputEvent, PlayerEvent, VolcanicEvent, WalkerEvent } from '../../systems/events/worldEvents.ts';
function setup() {
  const app = new EventHandler(), mission = new VolcanicFront(app as AppBase); mission.attachSimulation();
  const step = (dt: number) => app.fire(InputEvent.AXES, { dt });
  app.fire(VolcanicEvent.START);
  return { app, mission, step };
}
test('hull maintenance requires boarding, base mode and stable ground; restores hull at the advertised energy cost', () => {
  const { app, mission, step } = setup();
  try {
    app.fire(GeologicalEvent.REPAIR); assert.equal(mission.getStatus().geology.repairActive, false);
    step(35); app.fire(GeologicalEvent.REPAIR);
    assert.equal(mission.getStatus().geology.repairActive, false);
    app.fire(WalkerEvent.BASE_MODE_CHANGED, { baseMode: true });
    app.fire(GeologicalEvent.REPAIR); assert.equal(mission.getStatus().geology.repairActive, false, 'quake in progress');
    step(4); app.fire(GeologicalEvent.REPAIR);
    const before = mission.getStatus(); assert.equal(before.geology.repairActive, true);
    step(2); assert.equal(mission.getStatus().hull, 95);
    assert.ok(before.geology.energy - mission.getStatus().geology.energy >= 2);
    app.fire(VolcanicEvent.PAUSE); const paused = mission.getStatus(); step(100);
    assert.deepEqual(mission.getStatus(), paused);
    app.fire(VolcanicEvent.RESUME); step(2);
    assert.equal(mission.getStatus().hull, 100);
    assert.equal(mission.getStatus().geology.repairActive, false);
    assert.equal(mission.getStatus().geology.equipment, 85, 'hull repair does not magically fix instruments');
    assert.equal(mission.getStatus().geology.events.length, 1);
  } finally { mission.destroy(); }
});
test('movement, leaving base mode, disembarking and a subsequent tremor interrupt maintenance', () => {
  const { app, mission, step } = setup();
  const start = () => { app.fire(WalkerEvent.BASE_MODE_CHANGED, { baseMode: true }); app.fire(GeologicalEvent.REPAIR); assert.equal(mission.getStatus().geology.repairActive, true); };
  try {
    step(39); start(); app.fire(WalkerEvent.POSE_UPDATED, { x: 1, z: 0, y: 0, headingDeg: 0 }); step(0.1);
    assert.equal(mission.getStatus().geology.repairActive, false); assert.equal(mission.getStatus().hull, 90);
    start(); app.fire(WalkerEvent.BASE_MODE_CHANGED, { baseMode: false }); assert.equal(mission.getStatus().geology.repairActive, false);
    start(); app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false }); assert.equal(mission.getStatus().geology.repairActive, false);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true }); start(); step(66);
    assert.equal(mission.getStatus().geology.repairActive, false); assert.equal(mission.getStatus().hull, 72);
  } finally { mission.destroy(); }
});
test('repair is finite and preserves a 10 percent reserve; spent energy cannot be recovered by toggling', () => {
  const { app, mission, step } = setup();
  try {
    app.fire(WalkerEvent.POSE_UPDATED, { ...missionLayout(mission.getStatus().target).rockfall, y: 0, headingDeg: 0 }); step(35);
    app.fire(WalkerEvent.POSE_UPDATED, { x: -900, z: -900, y: 0, headingDeg: 0 }); step(4);
    while (mission.getStatus().geology.energy > 11) step(1);
    app.fire(WalkerEvent.BASE_MODE_CHANGED, { baseMode: true }); app.fire(GeologicalEvent.REPAIR);
    assert.equal(mission.getStatus().geology.repairActive, true); step(2);
    const after = mission.getStatus(); assert.equal(after.geology.energy, 10);
    assert.ok(after.hull > 35 && after.hull < 100); assert.equal(after.geology.repairActive, false);
    app.fire(GeologicalEvent.REPAIR); assert.equal(mission.getStatus().geology.repairActive, false);
    assert.equal(mission.getStatus().geology.energy, after.geology.energy);
  } finally { mission.destroy(); }
});
