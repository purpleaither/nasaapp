import { habitatGroundPad } from '../habitat/config.ts';
import { clamp, fbm, hash2D, lerp, noise2D, ridgedFbm, smoothstep } from './noise.ts';

export const WORLD_HALF = 2800;

export interface Crater {
  x: number;
  z: number;
  r: number;
  depth: number;
}

export function createCratersForSeed(seed: number): Crater[] {
  const craters: Crater[] = [];
  const craterCount = 36;
  for (let i = 0; i < craterCount; i++) {
    const angle = i * 2.39996 + (seed % 100) * 0.1;
    const dist = (0.1 + 0.8 * hash2D(i, 11, seed, 30)) * WORLD_HALF;
    const cx = Math.cos(angle) * dist + noise2D(i * 1.7, seed * 0.05, seed, 10) * 190;
    const cz = Math.sin(angle) * dist + noise2D(seed * 0.05, i * 2.3, seed, 20) * 190;
    const r = 65 + hash2D(i, 29, seed, 50) * 165;
    const depth = r * 0.25;
    craters.push({ x: cx, z: cz, r, depth });
  }
  return craters;
}

export function samplePlanetHeight(
  x: number,
  z: number,
  seed: number,
  craters: Crater[]
): number {
  const warpX = x + fbm(x * 0.00085, z * 0.00085, seed, 4, 2.0, 0.5, 101) * 240.0;
  const warpZ = z + fbm(x * 0.00085, z * 0.00085, seed, 4, 2.0, 0.5, 202) * 240.0;

  const macroPlains = fbm(warpX * 0.0012, warpZ * 0.0012, seed, 5, 2.05, 0.5, 303) * 14.0;
  const microDetail = fbm(x * 0.028, z * 0.028, seed, 3, 2.2, 0.45, 808) * 1.5;
  const duneRipples = Math.sin(x * 0.055 + z * 0.038 + noise2D(x * 0.02, z * 0.02, seed, 99) * 2.2) * 0.85;
  let h = macroPlains + microDetail + duneRipples;

  const rawPlateau = fbm(warpX * 0.00058 + 4.2, warpZ * 0.00058 - 1.7, seed, 4, 2.1, 0.5, 404);
  const plateauMask = smoothstep(0.22, 0.5, rawPlateau);
  if (plateauMask > 0.001) {
    const mesaRawHeight = plateauMask * 115.0;
    const steppedMesa = Math.round(mesaRawHeight / 14.0) * 14.0;
    const fineTerrace = Math.round(mesaRawHeight / 3.5) * 3.5;
    h += lerp(mesaRawHeight, steppedMesa * 0.72 + fineTerrace * 0.28, 0.82);
  }

  const rawMacroMtn = fbm(warpX * 0.00048 - 8.5, warpZ * 0.00048 + 6.1, seed, 4, 2.0, 0.5, 505);
  const mountainMask = smoothstep(0.25, 0.56, rawMacroMtn);
  if (mountainMask > 0.001) {
    const ridges = ridgedFbm(warpX * 0.0022, warpZ * 0.0022, seed, 5, 606);
    const mtnElevation = Math.pow(mountainMask, 1.22) * (110.0 + ridges * 310.0);
    const mtnStepped = Math.floor(mtnElevation / 9.0) * 9.0;
    h += lerp(mtnElevation, mtnStepped, 0.24);
  }

  const canyonField = fbm(warpX * 0.00062, warpZ * 0.00062, seed, 4, 2.0, 0.48, 707);
  const distFromCanyonCenter = Math.abs(canyonField);
  const canyonThreshold = 0.068;

  if (distFromCanyonCenter < canyonThreshold) {
    const normCanyon = distFromCanyonCenter / canyonThreshold;
    const wallProfile = 1.0 - smoothstep(0.22, 1.0, normCanyon);
    const rawCarve = wallProfile * (88.0 + plateauMask * 46.0);
    const steppedCarve = Math.floor(rawCarve / 10.5) * 10.5;
    h -= lerp(rawCarve, steppedCarve, 0.72);
  }

  for (let i = 0; i < craters.length; i++) {
    const c = craters[i];
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r * 1.35) {
      const norm = d / c.r;
      if (norm < 0.82) {
        const bowl = Math.cos((norm / 0.82) * (Math.PI * 0.5));
        h -= Math.min(1.0, bowl * 1.25) * c.depth;
      } else {
        const rim = Math.sin(((norm - 0.82) / 0.53) * Math.PI);
        h += rim * (c.depth * 0.38);
      }
    }
  }

  // Setor de missão dominado por planície antiga; relevo distante e crateras preservados.
  const localPlain = 1 - smoothstep(500, 850, Math.hypot(x - 120, z - 210));
  h = lerp(h, h * 0.18 + macroPlains * 0.82, localPlain);
  // Fraturas antigas e estáticas: depressões irregulares, nunca lava emissiva.
  const faultZ = (z - 240) / 210;
  const envelope = 1 - smoothstep(0.7, 1, Math.abs(faultZ));
  const bend = Math.sin(z * 0.027) * 9 + Math.sin(z * 0.071) * 3;
  const faultDistance = Math.abs(x - 245 - bend);
  const fault = (1 - smoothstep(7, 32, faultDistance)) * envelope;
  h -= fault * 17;
  const secondary = Math.abs(x - 330 + z * 0.18 + Math.sin(z * 0.04) * 5);
  h -= (1 - smoothstep(4, 21, secondary)) * envelope * 9;
  h = lerp(h, 0, habitatGroundPad(x, z));
  return h;
}

export function getPlanetVertexColor(
  y: number,
  ny: number,
  seed: number,
  wx = 0,
  wz = 0
): [number, number, number] {
  const strataBand = Math.sin(y * 0.05 + noise2D(wx * 0.0025, wz * 0.0025, seed, 33) * 0.8);

  // Fluxos antigos solidificados: lobos escuros e poeira ferruginosa descontínua.
  const lobe = Math.sin(wx * 0.012 + Math.sin(wz * 0.008) * 1.8) + noise2D(wx * 0.006, wz * 0.006, seed, 77);
  const exposed = ny < 0.76 || lobe > 0.15 || y < -30;
  if (exposed) return strataBand > 0 ? [0.27, 0.29, 0.32] : [0.19, 0.21, 0.24];
  return strataBand > 0.2 ? [0.61, 0.37, 0.25] : [0.48, 0.29, 0.21];
}

export function applyFacetColorJitter(
  rgb: [number, number, number],
  avgX: number,
  avgZ: number
): [number, number, number] {
  const facetJitter = 0.95 + 0.065 * Math.sin(avgX * 0.22 + avgZ * 0.19);
  return [
    clamp(rgb[0] * facetJitter, 0, 1),
    clamp(rgb[1] * facetJitter, 0, 1),
    clamp(rgb[2] * facetJitter, 0, 1),
  ];
}
