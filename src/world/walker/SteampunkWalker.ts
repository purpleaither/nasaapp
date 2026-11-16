import { GeologicalEvent, WALKER_COLLISION_RADIUS, type CollisionQuery } from '../geological/crisis.ts';
import * as pc from 'playcanvas';
import {
  CameraEvent,
  CameraFocusMode,
  CameraFocusModePayload,
  InputAxesPayload,
  InputEvent,
  sampleHeightViaEvent,
  shouldEnableNightLanterns,
  TerrainEvent,
  WalkerBaseModePayload,
  WalkerBoostPayload,
  WalkerEvent,
  VolcanicEvent,
  type VolcanicStatus,
} from '../../systems/events/worldEvents.ts';
import { DayPhase, TimeData, TimeEvent } from '../../systems/time/types.ts';
import { MISSION_CONFIG } from '../../systems/missionConfig.ts';
import {
  createSpiderWalkerState,
  SpiderWalkerKinematicsState,
  stepSpiderWalkerKinematics,
  WalkerControlInput,
} from './spiderKinematics.ts';

const DAMAGE_FLASH_SECONDS = 0.18;
const DAMAGE_FLASH_INTERVAL = 0.70;
const DAMAGE_FLASH_BLEND = 0.6;
const DAMAGE_FLASH_DIFFUSE = new pc.Color(0.57, 0.02, 0.017);
const DAMAGE_FLASH_EMISSIVE = new pc.Color(1, 0.045, 0.03);

export class SteampunkWalker {
  private app: pc.Application;
  private isHeadless: boolean;
  public readonly rootEntity: pc.Entity;
  private nodeEntities: Map<string, pc.Entity> = new Map();

  // Night Spotlight Entities (automatic at night via TimeEvent.TICK, without geometric cones)
  private lanternEntities: pc.Entity[] = [];
  private lanternsActive = false;
  private lastReportedPhase: DayPhase | null = null;
  private focusMode: CameraFocusMode = 'walker';
  private fieldActionActive = false;
  private readonly onMissionStatus = (status: VolcanicStatus): void => {
    this.fieldActionActive = Boolean(status.fieldActionActive);
    if (this.fieldActionActive) {
      this.kinematics.linearSpeed = 0;
      this.kinematics.angularSpeedDeg = 0;
    }
  };
  public boostEnabled = false;

  // Procedural 4-Legged Tortuga Kinematics State (1:1 world scale)
  public kinematics: SpiderWalkerKinematicsState;
  private domeSweepPhase = 0;
  private shieldPulsePhase = 0;
  private shieldMaterials: pc.StandardMaterial[] = [];
  private readonly damageMaterials = new Map<pc.Material, pc.StandardMaterial>();
  private readonly damageMeshes: { mesh: pc.MeshInstance; original: pc.Material; flashing: pc.Material }[] = [];
  private damageFlashTime = 0;
  private readonly sampleHeightFn: (x: number, z: number) => number;

  private readonly onTimeTickHandler: (data: TimeData) => void;
  private readonly onInputAxesHandler: (axes: InputAxesPayload) => void;
  private readonly onFocusModeChangedHandler: (payload: CameraFocusModePayload) => void;
  private readonly onSetBoostHandler: (payload: WalkerBoostPayload) => void;
  private readonly onSetBaseModeHandler: (payload: WalkerBaseModePayload) => void;
  private readonly onSeedChangedHandler: () => void;
  private readonly onDownloadGlbHandler: () => void;

  constructor(app: pc.Application, isHeadless = false) {
    this.app = app;
    this.isHeadless = isHeadless;
    this.sampleHeightFn = (x: number, z: number) => sampleHeightViaEvent(this.app, x, z);

    const { x, z, headingDeg } = MISSION_CONFIG.walkerSpawn;
    this.kinematics = createSpiderWalkerState(x, z, headingDeg, this.sampleHeightFn);

    this.rootEntity = new pc.Entity('ArachnoNomadWalker');
    this.app.root.addChild(this.rootEntity);
    // Aplica o ponto inicial antes mesmo de o modelo 3D terminar de carregar.
    this.applyKinematicsToEntities();

    this.loadGlbModel();

    this.onTimeTickHandler = (data: TimeData) => this.handleTimeTick(data);
    this.onInputAxesHandler = (axes: InputAxesPayload) => this.handleInputAxes(axes);
    this.onFocusModeChangedHandler = (p: CameraFocusModePayload) => {
      this.focusMode = p.mode;
      if (p.mode === 'explorer') {
        this.kinematics.linearSpeed = 0;
        this.kinematics.angularSpeedDeg = 0;
      }
      this.setBaseMode(p.mode === 'explorer');
      this.emitPoseUpdated();
    };
    this.onSetBoostHandler = (p: WalkerBoostPayload) => {
      this.boostEnabled = p.enabled;
      this.app.fire(WalkerEvent.BOOST_CHANGED, { enabled: this.boostEnabled });
    };
    this.onSetBaseModeHandler = (p: WalkerBaseModePayload) => {
      this.setBaseMode(p.baseMode);
    };
    this.onSeedChangedHandler = () => {
      const wasBaseMode = this.kinematics.baseMode;
      this.resetToGround(
        this.kinematics.posX,
        this.kinematics.posZ,
        this.kinematics.headingDeg
      );
      if (wasBaseMode) {
        this.setBaseMode(true);
      }
    };
    this.onDownloadGlbHandler = () => this.downloadGlbFile();

    this.app.on(VolcanicEvent.STATUS_CHANGED, this.onMissionStatus, this);
    this.app.on(TimeEvent.TICK, this.onTimeTickHandler, this);
    this.app.on(InputEvent.AXES, this.onInputAxesHandler, this);
    this.app.on(CameraEvent.FOCUS_MODE_CHANGED, this.onFocusModeChangedHandler, this);
    this.app.on(WalkerEvent.SET_BOOST, this.onSetBoostHandler, this);
    this.app.on(WalkerEvent.SET_BASE_MODE, this.onSetBaseModeHandler, this);
    this.app.on(TerrainEvent.SEED_CHANGED, this.onSeedChangedHandler, this);
    this.app.on(WalkerEvent.DOWNLOAD_GLB, this.onDownloadGlbHandler, this);
    this.app.on(WalkerEvent.HULL_DAMAGED, this.flashDamage, this);
    this.app.on('update', this.updateDamageFlash, this);

    this.emitPoseUpdated();
  }

  public setBaseMode(enabled: boolean): void {
    if (this.kinematics.baseMode === enabled) return;
    this.kinematics.baseMode = enabled;
    this.app.fire(WalkerEvent.BASE_MODE_CHANGED, { baseMode: enabled });

    // Emit seismic dust puffs at all 4 tortoise feet when burying into the ground in Modo Base
    if (enabled) {
      for (const leg of this.kinematics.legs) {
        this.app.fire(WalkerEvent.FOOT_STEPPED, {
          legIndex: leg.index,
          namePrefix: leg.namePrefix,
          x: leg.plantedWorld[0],
          y: leg.plantedWorld[1],
          z: leg.plantedWorld[2],
          intensity: 1.25,
        });
      }
    }
  }

  private loadGlbModel(): void {
    const glbUrl = '/models/arachno_nomad_walker.glb';
    this.app.assets.loadFromUrl(glbUrl, 'container', (err, asset) => {
      if (!this.rootEntity.parent) return;
      if (err || !asset) {
        console.warn('Could not load GLB asset from URL:', glbUrl, err);
        return;
      }
      const containerResource = asset.resource as pc.ContainerResource;
      if (!containerResource || !containerResource.instantiateRenderEntity) {
        return;
      }
      const modelEntity = containerResource.instantiateRenderEntity({
        castShadows: !this.isHeadless,
        receiveShadows: true,
      });
      this.rootEntity.addChild(modelEntity);

      this.cacheNodeEntities(modelEntity);
      this.attachNightLanterns();
      this.applyKinematicsToEntities();
    });
  }

  private cacheNodeEntities(root: pc.Entity): void {
    const findAndCache = (nodeName: string) => {
      const ent = root.findByName(nodeName) as pc.Entity | null;
      if (ent) {
        this.nodeEntities.set(nodeName, ent);
      }
    };

    findAndCache('Hull_Body');
    findAndCache('Turret_Assembly');
    findAndCache('Biome_Gimbal_Assembly');
    findAndCache('Neck_Assembly');
    findAndCache('Jaw_Lower');

    const prefixes = ['Leg_FL', 'Leg_RL', 'Leg_FR', 'Leg_RR'];
    const parts = ['Coxa', 'Femur', 'Tibia', 'Foot'];

    for (const prefix of prefixes) {
      for (const part of parts) {
        findAndCache(`${prefix}_${part}`);
      }
    }

    // Cache the Energy Shield Dome material ('GlassCanopy') for live harmonic plasma pulsing
    this.shieldMaterials = [];
    const renderComps = root.findComponents('render') as pc.RenderComponent[];
    for (const rc of renderComps) {
      for (const mi of rc.meshInstances) {
        const mat = mi.material as pc.StandardMaterial | undefined;
        if (mat instanceof pc.StandardMaterial) {
          let flashing = this.damageMaterials.get(mat);
          if (!flashing) {
            flashing = mat.clone();
            flashing.diffuse.lerp(mat.diffuse, DAMAGE_FLASH_DIFFUSE, DAMAGE_FLASH_BLEND);
            flashing.emissive.lerp(mat.emissive, DAMAGE_FLASH_EMISSIVE, DAMAGE_FLASH_BLEND);
            flashing.emissiveMap = null;
            flashing.emissiveIntensity = 0.8;
            flashing.update();
            this.damageMaterials.set(mat, flashing);
          }
          this.damageMeshes.push({ mesh: mi, original: mat, flashing });
          if (this.damageFlashTime > DAMAGE_FLASH_INTERVAL - DAMAGE_FLASH_SECONDS) mi.material = flashing;
        }
        if (mat && mat.name === 'GlassCanopy' && !this.shieldMaterials.includes(mat)) {
          mat.depthWrite = false;
          mat.cull = pc.CULLFACE_NONE;
          mat.update();
          this.shieldMaterials.push(mat);
        }
      }
    }
  }

  private flashDamage(): void {
    if (this.damageFlashTime > 0) return;
    this.damageFlashTime = DAMAGE_FLASH_INTERVAL;
    for (const { mesh, flashing } of this.damageMeshes) mesh.material = flashing;
  }

  private updateDamageFlash(dt: number): void {
    if (this.damageFlashTime <= 0) return;
    const flashEnd = DAMAGE_FLASH_INTERVAL - DAMAGE_FLASH_SECONDS;
    const wasFlashing = this.damageFlashTime > flashEnd;
    this.damageFlashTime = Math.max(0, this.damageFlashTime - dt);
    if (wasFlashing && this.damageFlashTime <= flashEnd) {
      for (const { mesh, original } of this.damageMeshes) mesh.material = original;
    }
  }

  private emitPoseUpdated(): void {
    this.app.fire(WalkerEvent.POSE_UPDATED, {
      x: this.kinematics.posX,
      y: this.kinematics.posY,
      z: this.kinematics.posZ,
      headingDeg: this.kinematics.headingDeg,
    });
  }

  /**
   * Automatically switches night searchlights ON when TimeSystem enters NIGHT phase
   * and OFF during DAWN, DAY, and DUSK, communicating state changes via PlayCanvas events.
   */
  private handleTimeTick(data: TimeData): void {
    const nextActive = shouldEnableNightLanterns(data.phase);
    if (nextActive !== this.lanternsActive || data.phase !== this.lastReportedPhase) {
      this.lanternsActive = nextActive;
      this.lastReportedPhase = data.phase;
      for (const lEnt of this.lanternEntities) {
        lEnt.enabled = this.lanternsActive;
      }
      this.app.fire(WalkerEvent.LANTERN_STATE_CHANGED, {
        active: this.lanternsActive,
        phase: data.phase,
      });
    }
  }

  private handleInputAxes(axes: InputAxesPayload): void {
    const controlInput: WalkerControlInput =
      this.focusMode === 'walker' && !this.kinematics.baseMode && !this.fieldActionActive
        ? {
            forward: axes.forward,
            turn: -axes.right,
            boost: axes.shiftBoost || this.boostEnabled,
          }
        : {
            forward: 0,
            turn: 0,
            boost: false,
          };

    this.update(axes.dt, controlInput);
    this.emitPoseUpdated();
  }

  /**
   * Attaches Night Searchlights to the Tortuga Head Ear-Pods + Belly Work-Lamp.
   * Initially disabled until a night phase event arrives via TimeEvent.TICK.
   */
  private attachNightLanterns(): void {
    const hull = this.nodeEntities.get('Hull_Body');
    const neck = this.nodeEntities.get('Neck_Assembly') ?? hull;
    const dome = this.nodeEntities.get('Turret_Assembly');
    if (!hull || !neck) return;

    const createSpotLantern = (
      parent: pc.Entity,
      name: string,
      lx: number,
      ly: number,
      lz: number,
      pitchDownDeg: number,
      yawDeg: number,
      intensity: number,
      range: number
    ) => {
      const holder = new pc.Entity(name);
      holder.setLocalPosition(lx, ly, lz);
      holder.setLocalEulerAngles(-(90 - pitchDownDeg), yawDeg, 0);

      holder.addComponent('light', {
        type: 'spot',
        color: new pc.Color(0.82, 0.96, 1.0),
        intensity,
        range,
        innerConeAngle: 20,
        outerConeAngle: 46,
        castShadows: false,
      });

      holder.enabled = this.lanternsActive;
      parent.addChild(holder);
      this.lanternEntities.push(holder);
    };

    createSpotLantern(neck, 'FrontLantern_L', -2.26, 2.92, 6.45, 20, -6, 3.4, 180);
    createSpotLantern(neck, 'FrontLantern_R', 2.26, 2.92, 6.45, 20, 6, 3.4, 180);

    if (dome) {
      createSpotLantern(dome, 'CommsDishBeacon', 0, 1.0, 0.5, 15, 0, 2.8, 160);
    }

    const bellyLight = new pc.Entity('BellyWorkLantern');
    bellyLight.setLocalPosition(0, -0.6, -1.0);
    bellyLight.addComponent('light', {
      type: 'point',
      color: new pc.Color(0.85, 0.95, 1.0),
      intensity: 1.5,
      range: 42,
      castShadows: false,
    });
    bellyLight.enabled = this.lanternsActive;
    hull.addChild(bellyLight);
    this.lanternEntities.push(bellyLight);
  }

  private applyKinematicsToEntities(): void {
    const k = this.kinematics;
    this.rootEntity.setLocalPosition(k.posX, k.posY, k.posZ);

    const qYaw = new pc.Quat().setFromAxisAngle(pc.Vec3.UP, k.headingDeg);
    const qPitch = new pc.Quat().setFromAxisAngle(pc.Vec3.RIGHT, k.bodyPitchDeg);
    const qRoll = new pc.Quat().setFromAxisAngle(new pc.Vec3(0, 0, 1), k.bodyRollDeg);
    const qTilt = new pc.Quat().mul2(qPitch, qRoll);
    const qRoot = new pc.Quat().mul2(qYaw, qTilt);
    this.rootEntity.setLocalRotation(qRoot);

    const biomeGimbal = this.nodeEntities.get('Biome_Gimbal_Assembly');
    if (biomeGimbal) {
      // Exact quaternion inverse of (qPitch * qRoll) so world rotation is
      // (qYaw * qPitch * qRoll) * (qPitch * qRoll)^-1 = qYaw.
      // This keeps the internal gyroscopic city 100% upright at any angle!
      const qGyroLevel = qTilt.clone().invert();
      biomeGimbal.setLocalRotation(qGyroLevel);
    }

    const neck = this.nodeEntities.get('Neck_Assembly');
    if (neck) {
      neck.setLocalEulerAngles(k.neckPitchDeg, k.neckYawDeg, 0);
    }

    const jaw = this.nodeEntities.get('Jaw_Lower');
    if (jaw) {
      jaw.setLocalEulerAngles(k.jawOpenDeg, 0, 0);
    }

    for (const leg of k.legs) {
      const coxa = this.nodeEntities.get(`${leg.namePrefix}_Coxa`);
      const femur = this.nodeEntities.get(`${leg.namePrefix}_Femur`);
      const tibia = this.nodeEntities.get(`${leg.namePrefix}_Tibia`);
      const foot = this.nodeEntities.get(`${leg.namePrefix}_Foot`);

      if (coxa) {
        coxa.setLocalEulerAngles(0, leg.coxaYawDeg, 0);
      }
      if (femur) {
        femur.setLocalEulerAngles(0, 0, leg.side * leg.femurPitchDeg);
      }
      if (tibia) {
        tibia.setLocalEulerAngles(0, 0, leg.side * leg.tibiaPitchDeg);
      }
      if (foot) {
        foot.setLocalEulerAngles(0, 0, leg.side * leg.footPitchDeg);
      }
    }
  }

  public update(dt: number, controlInput: WalkerControlInput): void {
    const before = { ...this.kinematics };
    stepSpiderWalkerKinematics(this.kinematics, controlInput, dt, this.sampleHeightFn);
    const q: CollisionQuery = { fromX: before.posX, fromZ: before.posZ, x: this.kinematics.posX, z: this.kinematics.posZ, radius: WALKER_COLLISION_RADIUS, blocked: false };
    this.app.fire(GeologicalEvent.COLLISION_QUERY, q);
    if (q.blocked) {
      this.kinematics.posX = before.posX; this.kinematics.posZ = before.posZ;
      this.kinematics.posY = before.posY; this.kinematics.linearSpeed = 0;
    }
    this.applyKinematicsToEntities();

    if (this.kinematics.lastLandedLegs.length > 0) {
      for (const legIdx of this.kinematics.lastLandedLegs) {
        const leg = this.kinematics.legs[legIdx];
        if (!leg) continue;
        const intensity =
          Math.min(1.4, Math.abs(this.kinematics.linearSpeed) / 14.0 + 0.6) *
          (controlInput.boost ? 1.3 : 1.0);
        this.app.fire(WalkerEvent.FOOT_STEPPED, {
          legIndex: leg.index,
          namePrefix: leg.namePrefix,
          x: leg.plantedWorld[0],
          y: leg.plantedWorld[1],
          z: leg.plantedWorld[2],
          intensity,
        });
      }
    }

    const isMovingOrTurning =
      Math.abs(this.kinematics.linearSpeed) > 0.1 ||
      Math.abs(this.kinematics.angularSpeedDeg) > 0.2;
    if (isMovingOrTurning) {
      this.domeSweepPhase += dt * 1.4;
    }
    const dome = this.nodeEntities.get('Turret_Assembly');
    if (dome) {
      this.domeSweepPhase += dt * (this.kinematics.baseMode ? 1.8 : 1.1);
      const turnLookAhead = -this.kinematics.angularSpeedDeg * 0.55;
      const crownSpin = (this.domeSweepPhase * 28) % 360;
      dome.setLocalEulerAngles(0, turnLookAhead + crownSpin, 0);
    }

    // Animate the Holographic Energy Shield Dome harmonic plasma pulse
    this.shieldPulsePhase += dt * (this.kinematics.baseMode ? 3.2 : 2.0);
    if (this.shieldMaterials.length > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.shieldPulsePhase);
      const baseBoost = this.kinematics.baseDeployProgress * 0.28;
      const eR = 0.14 + pulse * 0.08 + baseBoost * 0.06;
      const eG = 0.68 + pulse * 0.22 + baseBoost * 0.24;
      const eB = 0.88 + pulse * 0.18 + baseBoost * 0.18;
      for (const mat of this.shieldMaterials) {
        mat.emissive.set(eR, eG, eB);
        mat.update();
      }
    }
  }

  public resetToGround(x: number, z: number, headingDeg: number): void {
    this.kinematics = createSpiderWalkerState(x, z, headingDeg, this.sampleHeightFn);
    this.applyKinematicsToEntities();
    this.emitPoseUpdated();
  }

  public downloadGlbFile(): void {
    fetch('/models/arachno_nomad_walker.glb')
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'arachno_nomad_spider_walker.glb';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      })
      .catch((err) => console.error('Error downloading GLB file:', err));
  }

  public destroy(): void {
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onMissionStatus, this);
    this.app.off(TimeEvent.TICK, this.onTimeTickHandler, this);
    this.app.off(InputEvent.AXES, this.onInputAxesHandler, this);
    this.app.off(CameraEvent.FOCUS_MODE_CHANGED, this.onFocusModeChangedHandler, this);
    this.app.off(WalkerEvent.SET_BOOST, this.onSetBoostHandler, this);
    this.app.off(WalkerEvent.SET_BASE_MODE, this.onSetBaseModeHandler, this);
    this.app.off(TerrainEvent.SEED_CHANGED, this.onSeedChangedHandler, this);
    this.app.off(WalkerEvent.DOWNLOAD_GLB, this.onDownloadGlbHandler, this);
    this.app.off(WalkerEvent.HULL_DAMAGED, this.flashDamage, this);
    this.app.off('update', this.updateDamageFlash, this);

    this.rootEntity.destroy();
    for (const material of this.damageMaterials.values()) material.destroy();
  }
}
