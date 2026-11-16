export const MISSION_CONFIG = {
  mapSeed: 4092,
  stepSeconds: 1 / 60,
  // Ponto único de partida, usado tanto na primeira tentativa quanto no reinício.
  walkerSpawn: { x: 0, z: 0, headingDeg: 28 },
  initialCamera: { distance: 42, yawDeg: 52, pitchDeg: 24 },
  extraction: {
    radius: 50,
    headingSpreadDeg: 15,
    distanceByFrontSpeed: { 6: 780, 9: 620, 12: 450 },
  },
  volcanic: {
    speedOptions: [6, 9, 12],
    defaultSpeed: 9,
    initialHull: 100,
  },
} as const;
