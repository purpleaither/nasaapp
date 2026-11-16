/** ASTRONAUTA — ajustes centrais de tamanho, câmera e espaço para embarque. */
export const ASTRONAUT_CONFIG = {
  // TAMANHO: era 150. Agora o personagem tem o dobro desse tamanho (~12,4 UJ).
  modelScale: 300,
  // ROUPA: clareia a textura e reduz o aspecto metálico acinzentado.
  suitBrightness: 1.2,
  suitMetalness: 0.03,
  modelGroundOffset: 0.24,
  fallbackScale: 5,
  shadowDiameter: 9.6,
  // CÂMERA: enquadra o astronauta maior enquanto está a pé.
  cameraDistance: 30,
  cameraFocusOffset: 3.8,
  // COLISÃO / EMBARQUE: mantém espaço para o personagem maior junto à Tortuga.
  walkerClearance: 38,
  boardingDistance: 48,
  exitRadii: [43, 45, 47],
  walkSpeed: 22,
  // MOVIMENTO: evita deslizar de lado antes de o corpo completar a curva.
  turnSpeed: 540,
  acceleration: 100,
  deceleration: 140,
} as const;
