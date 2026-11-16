import * as pc from 'playcanvas';
import {
  SimulationEvent,
  WalkerEvent,
  WalkerFootSteppedPayload,
} from '../../systems/events/worldEvents.ts';

interface DustParticle {
  entity: pc.Entity;
  material: pc.StandardMaterial;
  age: number;
  maxAge: number;
  vx: number;
  vy: number;
  vz: number;
  spinSpeed: number;
  baseScale: number;
}

export class DustManager {
  private app: pc.Application;
  private isHeadless: boolean;
  private dustPool: DustParticle[] = [];
  private readonly onFootSteppedHandler: (p: WalkerFootSteppedPayload) => void;

  constructor(app: pc.Application, isHeadless = false) {
    this.app = app;
    this.isHeadless = isHeadless;

    const count = this.isHeadless ? 14 : 32;
    for (let i = 0; i < count; i++) {
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(0.72, 0.34, 0.20);
      mat.emissive = new pc.Color(0.24, 0.10, 0.05);
      mat.opacity = 0.0;
      mat.blendType = pc.BLEND_NORMAL;
      mat.depthWrite = false;
      mat.useMetalness = false;
      mat.shininess = 8;
      mat.update();

      const ent = new pc.Entity(`MartianFootDust_${i}`);
      ent.addComponent('render', {
        type: i % 2 === 0 ? 'box' : 'cone',
        material: mat,
        castShadows: false,
        receiveShadows: false,
      });
      ent.enabled = false;
      this.app.root.addChild(ent);

      this.dustPool.push({
        entity: ent,
        material: mat,
        age: 999,
        maxAge: 0.7,
        vx: 0,
        vy: 0,
        vz: 0,
        spinSpeed: (i % 2 === 0 ? 1 : -1) * (95 + (i % 4) * 28),
        baseScale: 0.65,
      });
    }

    this.onFootSteppedHandler = (p: WalkerFootSteppedPayload) => {
      this.spawnDust(p.x, p.y, p.z, p.intensity);
    };

    this.app.on(WalkerEvent.FOOT_STEPPED, this.onFootSteppedHandler, this);
    this.app.on(SimulationEvent.STEP, this.update, this);
  }

  private spawnDust(wx: number, wy: number, wz: number, intensity: number): void {
    const burstCount = 4;
    let spawned = 0;

    for (const p of this.dustPool) {
      if (p.entity.enabled) continue;

      const angle = (spawned / burstCount) * Math.PI * 2 + Math.random() * 0.6;
      const horizSpeed = 2.8 * (0.65 + Math.random() * 0.7) * intensity;

      p.age = 0;
      p.maxAge = 0.58 + Math.random() * 0.25;
      p.vx = Math.cos(angle) * horizSpeed;
      p.vy = 2.4 + Math.random() * 2.0;
      p.vz = Math.sin(angle) * horizSpeed;
      p.baseScale = 0.65 * Math.max(0.7, intensity);

      p.material.diffuse.set(0.74, 0.35, 0.21);
      p.material.emissive.set(0.25, 0.10, 0.05);
      p.material.opacity = 0.72;
      p.material.update();

      p.entity.setLocalPosition(
        wx + (Math.random() - 0.5) * 0.5,
        wy + 0.2,
        wz + (Math.random() - 0.5) * 0.5
      );
      p.entity.setLocalScale(p.baseScale, p.baseScale * 0.75, p.baseScale);
      p.entity.setLocalEulerAngles(
        Math.random() * 360,
        Math.random() * 360,
        Math.random() * 360
      );
      p.entity.enabled = true;

      spawned++;
      if (spawned >= burstCount) break;
    }
  }

  private update = (dt: number): void => {
    const clampedDt = Math.min(dt, 0.05);
    for (const p of this.dustPool) {
      if (!p.entity.enabled) continue;
      p.age += clampedDt;
      if (p.age >= p.maxAge) {
        p.entity.enabled = false;
        continue;
      }

      const t = p.age / p.maxAge;
      const pos = p.entity.getLocalPosition();
      p.vy -= 4.2 * clampedDt;
      p.entity.setLocalPosition(
        pos.x + p.vx * clampedDt,
        Math.max(pos.y + p.vy * clampedDt, pos.y),
        pos.z + p.vz * clampedDt
      );
      p.entity.rotateLocal(p.spinSpeed * clampedDt, p.spinSpeed * 0.7 * clampedDt, 0);

      const scale = p.baseScale * (0.75 + t * 1.65);
      p.entity.setLocalScale(scale, scale * 0.72, scale);
      p.material.opacity = 0.72 * Math.pow(1 - t, 1.4);
      p.material.update();
    }
  };

  public destroy(): void {
    this.app.off(WalkerEvent.FOOT_STEPPED, this.onFootSteppedHandler, this);
    this.app.off(SimulationEvent.STEP, this.update, this);

    for (const p of this.dustPool) {
      p.entity.destroy();
      p.material.destroy();
    }
  }
}
