import { HabitatEvent, type HabitatStatus, type HabitatPlacement } from '../habitat/events.ts';
import { GeologicalEvent, type CollisionQuery } from '../geological/crisis.ts';
// ASTRONAUTA: controla a entidade, a movimentação, o salto e o embarque.
import * as pc from 'playcanvas';
import {
  CameraEvent,
  CameraFocusMode,
  CameraFocusModePayload,
  CameraStateUpdatedPayload,
  InputAxesPayload,
  InputEvent,
  PlayerBoardingStatePayload,
  PlayerEvent,
  PoseUpdatedPayload,
  sampleHeightViaEvent,
  TerrainEvent,
  WalkerEvent,
  VolcanicEvent,
  type VolcanicStatus,
  type EvaCameraAim,
} from '../../systems/events/worldEvents.ts';
import { BOARDING_DISTANCE, canWalkTo, findSafeExit } from './boarding.ts';
import { MISSION_CONFIG } from '../../systems/missionConfig.ts';
import { WORLD_HALF } from '../terrain/geology.ts';
import { ASTRONAUT_CONFIG } from './config.ts';
import { AstronautModel } from './AstronautModel.ts';
import type { PlayerAnimation } from './PlayerAnimator.ts';
import { stepLocomotion, type LocomotionState } from './locomotion.ts';
import { clamp } from '../terrain/noise.ts';

export class PlayerController {
  private app: pc.Application;
  private rootEntity: pc.Entity;
  private shadowMat: pc.StandardMaterial;
  private suitMat: pc.StandardMaterial;
  private trimMat: pc.StandardMaterial;
  private visorMat: pc.StandardMaterial;
  private packMat: pc.StandardMaterial;
  private avatar: AstronautModel;
  private jumpHeight = 0;
  private jumpVelocity = 0;
  private animationState: PlayerAnimation = 'Idle';
  private locomotion: LocomotionState = { heading: MISSION_CONFIG.walkerSpawn.headingDeg, speed: 0 };
  private fieldActionActive = false;
  private habitatLocked = false;
  private readonly onHabitatState = (state: HabitatStatus): void => {
    this.habitatLocked = state.location === 'inside' || state.cycling;
    this.rootEntity.enabled = !this.isBoarded && !this.habitatLocked;
    if (this.habitatLocked) { this.locomotion.speed = 0; this.avatar.update('Idle', false); }
  };
  private readonly onHabitatPlacement = (pose: HabitatPlacement): void => {
    this.isBoarded = false; this.jumpHeight = 0; this.jumpVelocity = 0;
    this.posX = pose.x; this.posZ = pose.z; this.posY = sampleHeightViaEvent(this.app, pose.x, pose.z);
    this.headingDeg = pose.headingDeg; this.locomotion = { heading: pose.headingDeg, speed: 0 };
    this.rootEntity.enabled = !pose.inside;
    this.applyTransform(); this.emitBoardingState();
    this.app.fire(CameraEvent.SET_FOCUS_MODE, { mode: 'explorer' }); this.emitPoseUpdated();
  };
  private cameraAim: { x: number; y: number; z: number } | null = null;
  private readonly onCameraAim = (aim?: EvaCameraAim): void => {
    this.cameraAim = aim?.active ? aim.target : null;
  };
  private phase: VolcanicStatus['phase'] = 'preparation';

  private readonly onJump = (): void => {
    if (this.phase === 'operation' && !this.habitatLocked && !this.isBoarded && !this.fieldActionActive && this.jumpHeight === 0) {
      this.jumpVelocity = 6.8;
      this.jumpHeight = 0.001;
    }
  };

  private readonly onStatus = (status: VolcanicStatus): void => {
    this.phase = status.phase;
    this.fieldActionActive = Boolean(status.fieldActionActive);
    if (this.fieldActionActive) this.locomotion.speed = 0;
    if (this.phase !== 'operation') this.locomotion.speed = 0;
    this.avatar.update(this.animationState, !this.isBoarded && this.phase === 'operation');
  };

  private posX: number = MISSION_CONFIG.walkerSpawn.x;
  private posY = 0;
  private posZ: number = MISSION_CONFIG.walkerSpawn.z;
  private headingDeg: number = MISSION_CONFIG.walkerSpawn.headingDeg;
  private lastWalkerX: number = MISSION_CONFIG.walkerSpawn.x;
  private lastWalkerZ: number = MISSION_CONFIG.walkerSpawn.z;
  private lastWalkerHeading: number = MISSION_CONFIG.walkerSpawn.headingDeg;
  private focusMode: CameraFocusMode = 'walker';
  private isBoarded = true;
  private camYawDeg: number = MISSION_CONFIG.initialCamera.yawDeg;

  private readonly onWalkerPoseHandler: (p: PoseUpdatedPayload) => void;
  private readonly onFocusModeChangedHandler: (p: CameraFocusModePayload) => void;
  private readonly onCameraStateHandler: (p: CameraStateUpdatedPayload) => void;
  private readonly onSeedChangedHandler: () => void;
  private readonly onInputAxesHandler: (p: InputAxesPayload) => void;
  private readonly onInteractHandler: () => void;
  private readonly onToggleBoardingHandler: () => void;

  constructor(app: pc.Application, isHeadless = false) {
    this.app = app;

    this.rootEntity = new pc.Entity('ExplorerAstronaut');
    this.app.root.addChild(this.rootEntity);

    const shadowEnt = new pc.Entity('ContactShadow');
    shadowEnt.addComponent('render', {
      type: 'cylinder',
      castShadows: false,
      receiveShadows: false,
    });

    this.shadowMat = new pc.StandardMaterial();
    this.shadowMat.diffuse = new pc.Color(0.05, 0.02, 0.01);
    this.shadowMat.opacity = 0.42;
    this.shadowMat.blendType = pc.BLEND_NORMAL;
    this.shadowMat.depthWrite = false;
    this.shadowMat.useLighting = false;
    this.shadowMat.update();
    if (shadowEnt.render) {
      shadowEnt.render.material = this.shadowMat;
    }
    shadowEnt.setLocalPosition(0, 0.06, 0);
    shadowEnt.setLocalScale(ASTRONAUT_CONFIG.shadowDiameter, 0.04, ASTRONAUT_CONFIG.shadowDiameter);
    this.rootEntity.addChild(shadowEnt);

    this.suitMat = new pc.StandardMaterial();
    this.suitMat.diffuse = new pc.Color(0.92, 0.91, 0.89);
    this.suitMat.shininess = 18;
    this.suitMat.update();

    this.trimMat = new pc.StandardMaterial();
    this.trimMat.diffuse = new pc.Color(0.85, 0.36, 0.14);
    this.trimMat.shininess = 32;
    this.trimMat.update();

    this.visorMat = new pc.StandardMaterial();
    this.visorMat.diffuse = new pc.Color(0.14, 0.68, 0.85);
    this.visorMat.emissive = new pc.Color(0.06, 0.28, 0.42);
    this.visorMat.shininess = 90;
    this.visorMat.update();

    this.packMat = new pc.StandardMaterial();
    this.packMat.diffuse = new pc.Color(0.72, 0.73, 0.76);
    this.packMat.shininess = 24;
    this.packMat.update();

    // #region ASTRONAUTA — visual provisório durante o carregamento do GLB
    const fallback = new pc.Entity('AstronautLoadingFallback');
    this.rootEntity.addChild(fallback);
    const fallbackScale = ASTRONAUT_CONFIG.fallbackScale;
    fallback.setLocalScale(fallbackScale, fallbackScale, fallbackScale);
    const body = new pc.Entity('Torso');
    body.addComponent('render', {
      type: 'capsule',
      material: this.suitMat,
      castShadows: !isHeadless,
      receiveShadows: !isHeadless,
    });
    body.setLocalPosition(0, 1.35, 0);
    body.setLocalScale(1.05, 1.35, 0.95);
    fallback.addChild(body);

    const collar = new pc.Entity('ShoulderCollar');
    collar.addComponent('render', {
      type: 'cylinder',
      material: this.trimMat,
      castShadows: !isHeadless,
    });
    collar.setLocalPosition(0, 1.92, 0);
    collar.setLocalScale(1.12, 0.14, 1.02);
    fallback.addChild(collar);

    const visor = new pc.Entity('HelmetVisor');
    visor.addComponent('render', {
      type: 'box',
      material: this.visorMat,
      castShadows: !isHeadless,
    });
    visor.setLocalPosition(0, 2.15, 0.36);
    visor.setLocalScale(0.68, 0.42, 0.38);
    fallback.addChild(visor);

    const pack = new pc.Entity('PLSSBackpack');
    pack.addComponent('render', {
      type: 'box',
      material: this.packMat,
      castShadows: !isHeadless,
    });
    pack.setLocalPosition(0, 1.55, -0.52);
    pack.setLocalScale(0.82, 1.05, 0.46);
    fallback.addChild(pack);

    // #endregion
    // ASTRONAUTA — modelo definitivo e animações, encapsulados neste módulo.
    this.avatar = new AstronautModel(app, this.rootEntity, fallback, !isHeadless);

    // Explorer begins boarded inside the walker cabin
    this.rootEntity.enabled = false;
    this.posY = sampleHeightViaEvent(this.app, this.posX, this.posZ);
    this.applyTransform();

    this.onWalkerPoseHandler = (p: PoseUpdatedPayload) => {
      this.lastWalkerX = p.x;
      this.lastWalkerZ = p.z;
      this.lastWalkerHeading = p.headingDeg;
      if (this.isBoarded) {
        this.posX = p.x;
        this.posZ = p.z;
        this.headingDeg = p.headingDeg;
        this.posY = p.y;
        this.applyTransform();
      }
      this.emitBoardingState();
    };

    this.onFocusModeChangedHandler = (p: CameraFocusModePayload) => {
      this.focusMode = p.mode;

    };

    this.onCameraStateHandler = (p: CameraStateUpdatedPayload) => {
      this.camYawDeg = p.yawDeg;
    };

    this.onSeedChangedHandler = () => {
      if (!this.isBoarded) {
        this.disembark();
      }
    };

    this.onInputAxesHandler = (axes: InputAxesPayload) => this.handleInputAxes(axes);
    this.onInteractHandler = () => this.toggleBoarding();
    this.onToggleBoardingHandler = () => this.toggleBoarding();

    this.app.on(HabitatEvent.STATE, this.onHabitatState);
    this.app.on(HabitatEvent.PLACE_PLAYER, this.onHabitatPlacement);
    this.app.on(WalkerEvent.POSE_UPDATED, this.onWalkerPoseHandler, this);
    this.app.on(CameraEvent.FOCUS_MODE_CHANGED, this.onFocusModeChangedHandler, this);
    this.app.on(CameraEvent.STATE_UPDATED, this.onCameraStateHandler, this);
    this.app.on(TerrainEvent.SEED_CHANGED, this.onSeedChangedHandler, this);
    this.app.on(InputEvent.AXES, this.onInputAxesHandler, this);
    this.app.on(PlayerEvent.EVA_CAMERA_AIM, this.onCameraAim, this);
    this.app.on(InputEvent.ACTION_JUMP, this.onJump, this);
    this.app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    this.app.on(InputEvent.ACTION_INTERACT, this.onInteractHandler, this);
    this.app.on(PlayerEvent.TOGGLE_BOARDING, this.onToggleBoardingHandler, this);

    this.emitBoardingState();
  }

  // #region ASTRONAUTA — entrar, sair e sinalizar proximidade do veículo
  public toggleBoarding(): void {
    if (this.fieldActionActive || this.habitatLocked) return;
    if (this.isBoarded) {
      this.disembark();
    } else {
      const dist = Math.hypot(this.posX - this.lastWalkerX, this.posZ - this.lastWalkerZ);
      if (dist <= BOARDING_DISTANCE) {
        this.board();
      }
    }
  }

  private disembark(): void {
    const exit = findSafeExit(
      this.lastWalkerX, this.lastWalkerZ, this.lastWalkerHeading,
      WORLD_HALF * 0.95, (x, z) => sampleHeightViaEvent(this.app, x, z),
      (x, z) => !this.blockedAt(x, z, x, z),
    );
    if (!exit) return;
    this.jumpHeight = 0;
    this.jumpVelocity = 0;
    this.animationState = 'Idle';
    this.isBoarded = false;
    this.avatar.update('Idle', this.phase === 'operation');
    this.rootEntity.enabled = true;
    [this.posX, this.posY, this.posZ] = exit;
    this.headingDeg = this.lastWalkerHeading;
    this.locomotion = { heading: this.headingDeg, speed: 0 };
    this.applyTransform();
    this.emitBoardingState();
    if (this.focusMode !== 'explorer') {
      this.app.fire(CameraEvent.SET_FOCUS_MODE, { mode: 'explorer' });
    }
    this.emitPoseUpdated();
  }

  public getBoardingState(): PlayerBoardingStatePayload {
    const dist = Math.hypot(this.posX - this.lastWalkerX, this.posZ - this.lastWalkerZ);
    return { isBoarded: this.isBoarded, canBoard: !this.isBoarded && dist <= BOARDING_DISTANCE, distanceToWalker: Math.round(dist) };
  }

  private board(): void {
    this.locomotion.speed = 0;
    this.jumpHeight = 0;
    this.jumpVelocity = 0;
    this.animationState = 'Idle';
    this.avatar.update('Idle', false);
    this.isBoarded = true;
    this.rootEntity.enabled = false;
    this.posX = this.lastWalkerX;
    this.posZ = this.lastWalkerZ;
    this.emitBoardingState();
    if (this.focusMode !== 'walker') {
      this.app.fire(CameraEvent.SET_FOCUS_MODE, { mode: 'walker' });
    }
  }

  private emitBoardingState(): void {
    this.app.fire(PlayerEvent.BOARDING_STATE_CHANGED, this.getBoardingState());
  }

  // #endregion

  // #region ASTRONAUTA — movimento, corrida, salto e escolha da animação
  private handleInputAxes(axes: InputAxesPayload): void {
    if (this.isBoarded || this.habitatLocked || this.focusMode !== 'explorer') return;

    const previousX = this.posX;
    const previousZ = this.posZ;
    const { dx, dz } = stepLocomotion(this.locomotion, {
      forward: this.fieldActionActive ? 0 : axes.forward, right: this.fieldActionActive ? 0 : axes.right, cameraYaw: this.camYawDeg,
      running: axes.shiftBoost, dt: axes.dt,
    });
    this.headingDeg = this.locomotion.heading;
    // A câmera peitoral aponta com o corpo, sem exigir o uso do visor pelas luvas.
    if (this.cameraAim && this.fieldActionActive) {
      const targetYaw = Math.atan2(this.cameraAim.x - this.posX, this.cameraAim.z - this.posZ) * pc.math.RAD_TO_DEG;
      const delta = ((targetYaw - this.headingDeg + 540) % 360) - 180;
      const step = ASTRONAUT_CONFIG.turnSpeed * axes.dt;
      this.headingDeg += pc.math.clamp(delta, -step, step);
      this.locomotion.heading = this.headingDeg;
    }
    const moveDistance = Math.hypot(dx, dz);
    if (moveDistance > 0) {
      const bound = WORLD_HALF * 0.95;
      const nextX = clamp(this.posX + dx, -bound, bound);
      const nextZ = clamp(this.posZ + dz, -bound, bound);
      // Preserve wall sliding while keeping the character outside the vehicle.
      for (const axis of ['x', 'z']) {
        const x = axis === 'x' ? nextX : this.posX;
        const z = axis === 'z' ? nextZ : this.posZ;
        const y = sampleHeightViaEvent(this.app, x, z);
        if (!this.blockedAt(x, z, this.posX, this.posZ) && canWalkTo(x, z, this.lastWalkerX, this.lastWalkerZ) &&
            Number.isFinite(y) && Math.abs(y - this.posY) <= moveDistance * 0.9) {
          this.posX = x;
          this.posZ = z;
          this.posY = y;
        }
      }
    }

    const groundY = sampleHeightViaEvent(this.app, this.posX, this.posZ);
    if (this.jumpHeight > 0 || this.jumpVelocity > 0) {
      this.jumpVelocity -= 3.71 * axes.dt;
      this.jumpHeight = Math.max(0, this.jumpHeight + this.jumpVelocity * axes.dt);
      if (this.jumpHeight === 0) this.jumpVelocity = 0;
    }
    this.posY = groundY;
    const actualDistance = Math.hypot(this.posX - previousX, this.posZ - previousZ);
    const moved = actualDistance > 0.001;
    // Match the stride to actual displacement, including acceleration and obstacles.
    const referenceSpeed = ASTRONAUT_CONFIG.walkSpeed * (axes.shiftBoost ? 1.8 : 1);
    const gaitSpeed = Math.max(0.15, Math.min(1.5, actualDistance / Math.max(axes.dt, 0.001) / referenceSpeed));
    this.animationState = this.jumpHeight > 0 ? 'Jump' : moved ? axes.shiftBoost ? 'Run' : 'Walk' : 'Idle';
    this.avatar.update(this.animationState, this.phase === 'operation', gaitSpeed);
    this.app.fire(PlayerEvent.STATE_CHANGED, { isMoving: moved, isRunning: moved && axes.shiftBoost });
    this.applyTransform();
    this.emitPoseUpdated();
    this.emitBoardingState();
  }

  // #endregion

  private blockedAt(x: number, z: number, fromX: number, fromZ: number): boolean {
    const q: CollisionQuery = { x, z, fromX, fromZ, radius: 2, blocked: false };
    this.app.fire(GeologicalEvent.COLLISION_QUERY, q); return q.blocked;
  }

  private applyTransform(): void {
    this.rootEntity.setLocalPosition(this.posX, this.posY + this.jumpHeight, this.posZ);
    this.rootEntity.setLocalEulerAngles(0, this.headingDeg, 0);
  }

  private emitPoseUpdated(): void {
    this.app.fire(PlayerEvent.POSE_UPDATED, {
      x: this.posX,
      y: this.posY + this.jumpHeight,
      z: this.posZ,
      headingDeg: this.headingDeg,
    });
  }

  public destroy(): void {
    this.app.off(HabitatEvent.STATE, this.onHabitatState);
    this.app.off(HabitatEvent.PLACE_PLAYER, this.onHabitatPlacement);
    this.app.off(WalkerEvent.POSE_UPDATED, this.onWalkerPoseHandler, this);
    this.app.off(CameraEvent.FOCUS_MODE_CHANGED, this.onFocusModeChangedHandler, this);
    this.app.off(CameraEvent.STATE_UPDATED, this.onCameraStateHandler, this);
    this.app.off(TerrainEvent.SEED_CHANGED, this.onSeedChangedHandler, this);
    this.app.off(InputEvent.AXES, this.onInputAxesHandler, this);
    this.app.off(PlayerEvent.EVA_CAMERA_AIM, this.onCameraAim, this);
    this.app.off(InputEvent.ACTION_JUMP, this.onJump, this);
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    this.app.off(InputEvent.ACTION_INTERACT, this.onInteractHandler, this);
    this.app.off(PlayerEvent.TOGGLE_BOARDING, this.onToggleBoardingHandler, this);

    this.avatar.destroy();
    this.rootEntity.destroy();
    this.shadowMat.destroy();
    this.suitMat.destroy();
    this.trimMat.destroy();
    this.visorMat.destroy();
    this.packMat.destroy();
  }
}
