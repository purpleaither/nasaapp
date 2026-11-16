import test from 'node:test';
import assert from 'node:assert/strict';
import { stepLocomotion } from './locomotion.ts';
import { ASTRONAUT_CONFIG } from './config.ts';

const input = { forward: 0, right: 1, cameraYaw: 0, running: false, dt: 1 / 60 };

test('lateral input turns toward travel without snapping or translating sideways', () => {
  const state = { heading: 0, speed: 0 };
  for (let frame = 0; frame < 30; frame++) {
    const heading = state.heading;
    const step = stepLocomotion(state, input);
    assert.ok(Math.abs(state.heading - heading) <= ASTRONAUT_CONFIG.turnSpeed / 60 + 1e-6);
    if (Math.hypot(step.dx, step.dz) > 1e-6) {
      const travelHeading = Math.atan2(step.dx, step.dz) * 180 / Math.PI;
      assert.ok(Math.abs(travelHeading - state.heading) < 1e-6, 'body faces actual travel');
    }
  }
  assert.equal(state.heading, 90);
  assert.equal(state.speed, ASTRONAUT_CONFIG.walkSpeed);
});

test('switching left/right brakes and turns instead of instantly sliding backward', () => {
  const state = { heading: 90, speed: 22 };
  const first = stepLocomotion(state, { ...input, right: -1 });
  assert.ok(state.speed < 22);
  assert.ok(Math.hypot(first.dx, first.dz) < 0.001);
  for (let frame = 0; frame < 60; frame++) stepLocomotion(state, { ...input, right: -1 });
  assert.equal(state.heading, -90);
  assert.equal(state.speed, 22);
  for (let frame = 0; frame < 20; frame++) stepLocomotion(state, { ...input, right: 0 });
  assert.equal(state.speed, 0);
});

test('diagonal input has the same top speed and stable motion at different frame rates', () => {
  function simulate(dt: number, right: number) {
    const state = { heading: right ? 135 : -180, speed: 0 };
    let distance = 0;
    for (let frame = 0; frame < Math.round(2 / dt); frame++) {
      const step = stepLocomotion(state, { ...input, forward: 1, right, dt });
      distance += Math.hypot(step.dx, step.dz);
    }
    return { distance, state };
  }
  const straight = simulate(1 / 60, 0);
  const diagonal = simulate(1 / 60, 1);
  assert.ok(Math.abs(straight.distance - diagonal.distance) < 0.001);
  assert.ok(Math.abs(simulate(1 / 30, 1).distance - simulate(1 / 120, 1).distance) < 0.5);
});
