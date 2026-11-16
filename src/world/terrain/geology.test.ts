import test from 'node:test';
import assert from 'node:assert/strict';
import { fbm, hash2D, noise2D, ridgedFbm, smoothstep } from './noise.ts';
import {
  createCratersForSeed,
  getPlanetVertexColor,
  samplePlanetHeight,
  WORLD_HALF,
} from './geology.ts';

test('noise functions are deterministic for a given seed', () => {
  const h1 = hash2D(10, 20, 4092, 5);
  const h2 = hash2D(10, 20, 4092, 5);
  assert.equal(h1, h2);
  assert.ok(h1 >= 0 && h1 < 1);

  const n1 = noise2D(12.34, -56.78, 4092, 10);
  const n2 = noise2D(12.34, -56.78, 4092, 10);
  assert.equal(n1, n2);
  assert.ok(n1 >= -1 && n1 <= 1);

  assert.ok(Number.isFinite(fbm(0.5, 0.5, 4092)));
  assert.ok(Number.isFinite(ridgedFbm(0.5, 0.5, 4092)));
  assert.equal(smoothstep(0, 10, 5), 0.5);
});

test('createCratersForSeed creates 36 deterministic craters within bounds', () => {
  const craters = createCratersForSeed(4092);
  assert.equal(craters.length, 36);
  for (const c of craters) {
    assert.ok(c.r >= 65 && c.r <= 230);
    assert.equal(c.depth, c.r * 0.25);
    assert.ok(Math.abs(c.x) <= WORLD_HALF * 1.2);
    assert.ok(Math.abs(c.z) <= WORLD_HALF * 1.2);
  }
});

test('samplePlanetHeight returns deterministic finite elevation', () => {
  const craters = createCratersForSeed(4092);
  const y1 = samplePlanetHeight(0, 0, 4092, craters);
  const y2 = samplePlanetHeight(0, 0, 4092, craters);
  assert.equal(y1, y2);
  assert.ok(Number.isFinite(y1));
});

test('exposed basalt is dark blue-grey and dust remains reddish with normalized colors', () => {
  const basalt = getPlanetVertexColor(10, 0.4, 4092, 0, 0);
  assert.ok(basalt[2] > basalt[0]);
  assert.ok(Math.max(...basalt) < 0.4);
  const colors = Array.from({ length: 80 }, (_, i) => getPlanetVertexColor(10, 1, 4092, i * 20, i * 13));
  assert.ok(colors.some(c => c[0] > c[2] * 1.5));
  assert.ok(colors.some(c => c[2] > c[0]));
  assert.ok(colors.flat().every(c => c >= 0 && c <= 1));
});
