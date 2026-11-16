// AFLORAMENTO M01 — bloco único com canto removido; sem placas sobrepostas.
// Coordenadas locais em UJ. A face diagonal 3 substitui o canto frontal direito.
export type V3 = [number, number, number];
export interface RockSurface { positions: number[]; colors: number[]; indices: number[]; uvs: number[] }
export const OUTCROP_FOOTPRINT = [
  [-10, 0], [-6, -0.65], [-1, -0.4], [4.2, 0], [11.3, 5.0], [11.8, 8],
  [11.3, 10.5], [8.5, 12.5], [3, 13], [-5, 12], [-10, 10], [-12, 6], [-11.8, 2.8],
] as const;
export const PHOTO_COMPOSITION = {
  focus: [1.8, 3.9, 1] as V3,
  outer: [-3.6, 4.4, -0.55] as V3,
  fracture: [8.1, 3.8, 2.4] as V3,
  // Pontos na mesma foto: exterior, ruptura e sua borda comum.
  anchors: [[-5, 3.4, -0.6], [-2, 5.5, -0.4], [6.5, 3.1, 1.0], [9.2, 5.3, 3.2], [4.2, 4.5, 0]] as V3[],
  eye: [4, 9, -22] as V3,
};
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const noise = (x: number, y: number, z: number) => Math.sin(x * 1.73 + Math.cos(z * 1.31) + y * 2.19) * Math.cos(z * 2.11 - x * 0.83 + y * 0.61);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (r: number, g: number, b: number): V3 => [r / 255, g / 255, b / 255];
const basalt = rgb(50, 54, 59), rust = rgb(137, 78, 49), ochre = rgb(163, 110, 63);
function color(point: V3, fractured: boolean, top: boolean, edge: number): number[] {
  const [x, y, z] = point, n = noise(x * 0.7, y * 0.8, z * 0.7);
  const cavity = Math.max(0, -noise(x * 2, y, z * 2));
  const dust = fractured ? clamp(0.025 + cavity ** 4 * 0.2 + (edge < 0.08 ? 0.1 : 0), 0, 0.3)
    : clamp(0.55 + n * 0.3 + (top ? 0.3 : 0) + cavity * 0.14, 0.12, 0.97);
  const shade = 0.87 + (n + 1) * 0.12;
  return basalt.map((v, i) => lerp(v, lerp(rust[i], ochre[i], clamp(n + 0.35)), dust) * shade).concat(1);
}
export function buildOutcropGeometry(): { exterior: RockSurface; fracture: RockSurface } {
  const empty = (): RockSurface => ({ positions: [], colors: [], indices: [], uvs: [] });
  const exterior = empty(), fracture = empty();
  const levels = [-0.8, 0.15, 1.65, 3.2, 4.85, 6.4, 7.75, 8.5];
  const rings = levels.map((y, level) => OUTCROP_FOOTPRINT.map(([x, z], i): V3 => {
    const factor = level === 0 ? 0.94 : level === levels.length - 1 ? 0.89 : level === levels.length - 2 ? 0.97 : 1;
    return [x * factor + Math.sin(i * 3.3 + level) * 0.13,
      y * 0.82 + (level === 0 ? 0 : Math.sin(i * 1.8 + level * 0.7) * 0.15),
      5 + (z - 5) * factor + Math.cos(i * 2.7 + level) * 0.12];
  }));
  const vertex = (surface: RockSurface, p: V3, broken: boolean, top: boolean, edge: number) => {
    surface.positions.push(...p); surface.colors.push(...color(p, broken, top, edge));
    // Mesma escala mineral em todas as regiões; sem textura de casca independente.
    surface.uvs.push((p[0] + p[2] * 0.5) * 0.6, p[1] * 0.6 + p[2] * 0.35);
  };
  const subdivisions = 12;
  for (let face = 0; face < OUTCROP_FOOTPRINT.length; face++) {
    const next = (face + 1) % OUTCROP_FOOTPRINT.length;
    const broken = face === 3, surface = broken ? fracture : exterior;
    const offset = surface.positions.length / 3;
    for (let level = 0; level < levels.length; level++) {
      for (let col = 0; col <= subdivisions; col++) {
        const u = col / subdivisions, a = rings[level][face], b = rings[level][next];
        const p: V3 = a.map((v, i) => lerp(v, b[i], u)) as V3;
        const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz);
        const envelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * level / (levels.length - 1));
        // Ruptura: lascas/degraus irregulares. Exterior: pequenas cavidades e desgaste.
        const relief = envelope * (broken ? noise(p[0] * 1.4, p[1], p[2]) * 0.34 + (level % 2 ? -0.16 : 0.14)
          : 0.13 * noise(p[0], p[1], p[2]) - Math.max(0, -noise(p[0] * 2, p[1] * 2, p[2])) ** 6 * 0.16);
        p[0] += dz / len * relief; p[2] -= dx / len * relief;
        vertex(surface, p, broken, false, Math.min(u, 1 - u));
      }
    }
    for (let row = 0; row < levels.length - 1; row++) for (let col = 0; col < subdivisions; col++) {
      const a = offset + row * (subdivisions + 1) + col, b = a + subdivisions + 1;
      if ((row + col) % 2) surface.indices.push(a, b, b + 1, a, b + 1, a + 1);
      else surface.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  for (const [level, top] of [[0, false], [levels.length - 1, true]] as const) {
    const ring = rings[level], center: V3 = [0, top ? 7.01 : -0.656, 6];
    const offset = exterior.positions.length / 3;
    vertex(exterior, center, false, top, 0.5);
    for (let face = 0; face < ring.length; face++) {
      const next = (face + 1) % ring.length;
      for (let col = 0; col < subdivisions; col++) {
        const a = ring[face].map((v, i) => lerp(v, ring[next][i], col / subdivisions)) as V3;
        const b = ring[face].map((v, i) => lerp(v, ring[next][i], (col + 1) / subdivisions)) as V3;
        const index = exterior.positions.length / 3;
        vertex(exterior, a, false, top, 0.5); vertex(exterior, b, false, top, 0.5);
        exterior.indices.push(offset, top ? index + 1 : index, top ? index : index + 1);
      }
    }
  }
  return { exterior, fracture };
}
