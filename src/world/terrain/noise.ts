export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function fract(n: number): number {
  return n - Math.floor(n);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function hash2D(ix: number, iz: number, worldSeed: number, seedOffset = 0): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + (worldSeed + seedOffset) * 74.7) * 43758.5453123;
  return fract(n);
}

export function noise2D(x: number, z: number, worldSeed: number, seedOffset = 0): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  const uz = fz * fz * fz * (fz * (fz * 6.0 - 15.0) + 10.0);

  const a = hash2D(ix, iz, worldSeed, seedOffset);
  const b = hash2D(ix + 1, iz, worldSeed, seedOffset);
  const c = hash2D(ix, iz + 1, worldSeed, seedOffset);
  const d = hash2D(ix + 1, iz + 1, worldSeed, seedOffset);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz) * 2.0 - 1.0;
}

export function fbm(
  x: number,
  z: number,
  worldSeed: number,
  octaves = 5,
  lacunarity = 2.05,
  gain = 0.5,
  seedOffset = 0
): number {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, z * frequency, worldSeed, seedOffset + i * 19) * amplitude;
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total / maxVal;
}

export function ridgedFbm(
  x: number,
  z: number,
  worldSeed: number,
  octaves = 5,
  seedOffset = 77
): number {
  let total = 0;
  let amplitude = 0.55;
  let frequency = 1.0;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    let signal = 1.0 - Math.abs(noise2D(x * frequency, z * frequency, worldSeed, seedOffset + i * 31));
    signal = signal * signal * weight;
    weight = clamp(signal * 1.8, 0.0, 1.0);
    total += signal * amplitude;
    frequency *= 2.12;
    amplitude *= 0.5;
  }
  return total;
}
