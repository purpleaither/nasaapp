import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARDING_DISTANCE, WALKER_CLEARANCE, canWalkTo, findSafeExit } from './boarding.ts';

test('exit is beside the walker, clear of geometry and within boarding distance', () => {
  for (const heading of [0, 28, 90, 180, 270]) {
    const exit = findSafeExit(10, 20, heading, 1000, () => 7);
    assert.ok(exit);
    const [x, y, z] = exit;
    assert.equal(y, 7);
    const distance = Math.hypot(x - 10, z - 20);
    assert.ok(distance > WALKER_CLEARANCE && distance <= BOARDING_DISTANCE);
    assert.ok(canWalkTo(x, z, 10, 20));
  }
});

test('exit selects the opposite side at the map edge', () => {
  const exit = findSafeExit(99, 0, 0, 100, () => 0);
  assert.ok(exit);
  assert.ok(exit[0] < 99);
  assert.ok(Math.abs(exit[0]) <= 99 && Math.abs(exit[2]) <= 99);
});

test('exit avoids cliffs and invalid height samples, and stays aboard if all are unsafe', () => {
  const exit = findSafeExit(0, 0, 0, 100, (x) => x > 0 ? NaN : 0);
  assert.ok(exit && exit[0] < 0);
  assert.equal(findSafeExit(0, 0, 0, 100, (x) => x * 2), null);
  assert.equal(findSafeExit(0, 0, 0, 100, () => NaN), null);
});

test('walking cannot enter the vehicle clearance area', () => {
  assert.equal(canWalkTo(0, 0, 0, 0), false);
  assert.equal(canWalkTo(31, 0, 0, 0), false);
  assert.equal(canWalkTo(WALKER_CLEARANCE + 1, 0, 0, 0), true);
});
