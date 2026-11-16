import type { Vec3 } from 'playcanvas';
import { Color, Entity, StandardMaterial } from 'playcanvas';

export type MoonConfig = {
  readonly name: string;
  readonly orbitalSpeed: number;
  readonly radius: number;
  readonly tilt: number;
  readonly phaseOffset: number;
  readonly scale: readonly [number, number, number];
  readonly diffuseColor: readonly [number, number, number];
  readonly emissiveColor: readonly [number, number, number];
  readonly rotationSpeed: readonly [number, number, number];
  readonly nightGlowMultiplier: number;
  readonly invertX?: boolean;
};

export const MOON_CONFIGS = {
  phobos: {
    name: 'PhobosElement',
    orbitalSpeed: 1.25,
    radius: 3750,
    tilt: 0.44,
    phaseOffset: 0.6,
    scale: [110, 76, 100],
    diffuseColor: [0.65, 0.62, 0.6],
    emissiveColor: [0.15, 0.16, 0.2],
    rotationSpeed: [0.05, 0.08, 0.02],
    nightGlowMultiplier: 1.8,
    invertX: true,
  },
  deimos: {
    name: 'DeimosElement',
    orbitalSpeed: 0.38,
    radius: 3900,
    tilt: 0.41,
    phaseOffset: 2.5,
    scale: [36, 32, 36],
    diffuseColor: [0.85, 0.82, 0.8],
    emissiveColor: [0.2, 0.22, 0.28],
    rotationSpeed: [0.02, 0.04, 0.01],
    nightGlowMultiplier: 2.2,
    invertX: false,
  },
} as const satisfies Record<string, MoonConfig>;

export class MoonElement extends Entity {
  private readonly material: StandardMaterial;
  private readonly moonConfig: MoonConfig;
  public orbitalSpeed: number;

  constructor(config: MoonConfig) {
    super(config.name);
    this.moonConfig = config;
    this.orbitalSpeed = config.orbitalSpeed;

    this.material = new StandardMaterial();
    this.material.diffuse = new Color(config.diffuseColor[0], config.diffuseColor[1], config.diffuseColor[2]);
    this.material.emissive = new Color(config.emissiveColor[0], config.emissiveColor[1], config.emissiveColor[2]);
    this.material.emissiveIntensity = 0.5;
    this.material.gloss = 0.1;
    this.material.useFog = false;
    this.material.update();

    this.addComponent('render', {
      type: 'sphere',
      material: this.material,
      castShadows: false,
      receiveShadows: false,
    });

    this.setLocalScale(config.scale[0], config.scale[1], config.scale[2]);
  }

  public update(totalDays: number, camPos: Vec3, sunWorldPos: Vec3): void {
    const {
      orbitalSpeed,
      phaseOffset,
      radius,
      tilt,
      rotationSpeed,
      nightGlowMultiplier,
      diffuseColor,
      invertX,
    } = this.moonConfig;

    const orbitalAngle = totalDays * Math.PI * 2 * orbitalSpeed + phaseOffset;
    const cosAngle = Math.cos(orbitalAngle);
    const sinAngle = Math.sin(orbitalAngle);

    const rawMoonX = cosAngle * radius;
    const moonX = invertX ? -rawMoonX : rawMoonX;
    const moonY = sinAngle * radius * Math.cos(tilt);
    const moonZ = -sinAngle * radius * Math.sin(tilt);

    const worldX = camPos.x + moonX;
    const worldY = camPos.y + moonY;
    const worldZ = camPos.z + moonZ;

    const fade = Math.max(0, Math.min(1, (moonY + 280) / 600));
    const isVisible = fade > 0.001;
    this.enabled = isVisible;

    if (isVisible) {
      this.setPosition(worldX, worldY, worldZ);
      this.rotateLocal(rotationSpeed[0], rotationSpeed[1], rotationSpeed[2]);

      const toSunX = sunWorldPos.x - camPos.x;
      const toSunY = sunWorldPos.y - camPos.y;
      const toSunZ = sunWorldPos.z - camPos.z;
      const sunDistance = Math.hypot(toSunX, toSunY, toSunZ) || 1;

      const dot = (toSunX * moonX + toSunY * moonY + toSunZ * moonZ) / (sunDistance * radius);
      const silhouette = Math.max(0, (dot - 0.5) / 0.5);

      const nightGlow = Math.max(0, -toSunY / 4100);
      const emissiveValue = (1.0 - silhouette) * (0.15 + nightGlow * nightGlowMultiplier);

      this.material.emissiveIntensity = fade * emissiveValue;
      this.material.diffuse.set(
        diffuseColor[0] * (1.0 - silhouette * 0.85),
        diffuseColor[1] * (1.0 - silhouette * 0.85),
        diffuseColor[2] * (1.0 - silhouette * 0.85)
      );
      this.material.update();
    }
  }
}
