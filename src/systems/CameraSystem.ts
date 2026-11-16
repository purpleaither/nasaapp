import { GeologicalEvent, type Tremor } from '../world/geological/crisis.ts';
import * as pc from 'playcanvas';
import { MISSION_CONFIG } from './missionConfig.ts';
// ASTRONAUTA — enquadramento configurado junto ao módulo do personagem.
import { ASTRONAUT_CONFIG } from '../world/astronaut/config.ts';
import { WORLD_HALF } from '../world/terrain/geology.ts';
import { clamp, lerp } from '../world/terrain/noise.ts';
import {
  CameraClearColorPayload,
  type FieldCameraFrame,
  CameraEvent,
  CameraFocusMode,
  CameraFocusModePayload,
  InputEvent,
  InputOrbitPayload,
  InputPanPayload,
  InputZoomPayload,
  PlayerEvent,
  PoseUpdatedPayload,
  sampleHeightViaEvent,
  WalkerEvent,
  VolcanicEvent,
  type VolcanicStatus,
} from './events/worldEvents.ts';

export class CameraSystem {
  private quakePhase: VolcanicStatus['phase'] = 'preparation';
  private readonly onQuakeStatus = (status: VolcanicStatus): void => {
    this.quakePhase = status.phase;
    if (status.phase === 'ended') this.quakeRemaining = 0;
  };
  private quakeRemaining = 0;
  private quakeIntensity = 0;
  private quakeClock = 0;
  private readonly onQuake = (event: Tremor): void => {
    if (Math.hypot(this.camTarget.x - event.epicenter.x, this.camTarget.z - event.epicenter.z) > 650) return;
    this.quakeRemaining = event.duration; this.quakeIntensity = event.intensity;
  };
  private app: pc.Application;
  private cameraEntity: pc.Entity;
  private focusMode: CameraFocusMode = 'walker';

  public camDist: number = MISSION_CONFIG.initialCamera.distance;
  public targetCamDist: number = MISSION_CONFIG.initialCamera.distance;
  public camYaw: number = MISSION_CONFIG.initialCamera.yawDeg;
  public camPitch: number = MISSION_CONFIG.initialCamera.pitchDeg;
  public readonly camTarget = new pc.Vec3(0, 0, 0);
  public readonly camFocus = new pc.Vec3(0, 0, 0);
  private hasInitializedFocus = false;
  private fieldFrame?: FieldCameraFrame;
  private fieldBlend = 0;
  private readonly fieldEye = new pc.Vec3();
  private readonly fieldFocus = new pc.Vec3();
  private readonly renderEye = new pc.Vec3();
  private readonly renderFocus = new pc.Vec3();
  private readonly onFieldFrame = (frame?: FieldCameraFrame): void => {
    this.fieldFrame = frame;
    if (frame) {
      this.fieldEye.set(frame.eye.x, frame.eye.y, frame.eye.z);
      this.fieldFocus.set(frame.focus.x, frame.focus.y, frame.focus.z);
    }
  };

  private readonly onOrbitHandler: (p: InputOrbitPayload) => void;
  private readonly onPanHandler: (p: InputPanPayload) => void;
  private readonly onZoomHandler: (p: InputZoomPayload) => void;
  private readonly onSetFocusModeHandler: (p: CameraFocusModePayload) => void;
  private readonly onWalkerPoseHandler: (p: PoseUpdatedPayload) => void;
  private readonly onPlayerPoseHandler: (p: PoseUpdatedPayload) => void;
  private readonly onClearColorHandler: (p: CameraClearColorPayload) => void;
  private readonly onUpdateHandler: (dt: number) => void;

  constructor(app: pc.Application) {
    this.app = app;
    app.on(GeologicalEvent.TREMOR, this.onQuake);
    app.on(VolcanicEvent.STATUS_CHANGED, this.onQuakeStatus);
    this.cameraEntity = new pc.Entity('MainCamera');
    this.cameraEntity.addComponent('camera', {
      clearColor: new pc.Color(0.58, 0.25, 0.16),
      projection: pc.PROJECTION_PERSPECTIVE,
      fov: 62,
      nearClip: 0.5,
      farClip: 14000,
    });
    this.app.root.addChild(this.cameraEntity);

    this.onOrbitHandler = (p) => this.handleOrbit(p.dx, p.dy);
    this.onPanHandler = (p) => this.handlePan(p.dx, p.dy);
    this.onZoomHandler = (p) => this.handleZoom(p.wheelDelta);
    this.onSetFocusModeHandler = (p) => this.handleSetFocusMode(p.mode);
    this.onWalkerPoseHandler = (p) => this.handleWalkerPose(p);
    this.onPlayerPoseHandler = (p) => this.handlePlayerPose(p);
    this.onClearColorHandler = (p) => {
      if (this.cameraEntity.camera) {
        this.cameraEntity.camera.clearColor.set(p.r, p.g, p.b, 1);
      }
    };
    this.onUpdateHandler = (dt: number) => this.update(Math.min(dt, 0.05));

    this.app.on(CameraEvent.FIELD_FRAME, this.onFieldFrame, this);
    this.app.on(InputEvent.ORBIT, this.onOrbitHandler, this);
    this.app.on(InputEvent.PAN, this.onPanHandler, this);
    this.app.on(InputEvent.ZOOM, this.onZoomHandler, this);
    this.app.on(CameraEvent.SET_FOCUS_MODE, this.onSetFocusModeHandler, this);
    this.app.on(WalkerEvent.POSE_UPDATED, this.onWalkerPoseHandler, this);
    this.app.on(PlayerEvent.POSE_UPDATED, this.onPlayerPoseHandler, this);
    this.app.on(CameraEvent.CLEAR_COLOR, this.onClearColorHandler, this);
    this.app.on('update', this.onUpdateHandler, this);
  }

  private handleOrbit(dx: number, dy: number): void {
    this.camYaw -= dx * 0.32;
    this.camPitch = clamp(this.camPitch + dy * 0.28, -14, 82);
  }

  private handlePan(dx: number, dy: number): void {
    const panFactor = Math.max(0.03, this.camDist * 0.0022);
    const rad = this.camYaw * pc.math.DEG_TO_RAD;
    this.camTarget.x -= (Math.cos(rad) * dx + Math.sin(rad) * dy) * panFactor;
    this.camTarget.z -= (-Math.sin(rad) * dx + Math.cos(rad) * dy) * panFactor;
    this.clampTargetToWorld();
  }

  private handleZoom(wheelDelta: number): void {
    const zoomStep = Math.max(1.5, this.targetCamDist * 0.14);
    this.targetCamDist = clamp(this.targetCamDist - wheelDelta * zoomStep, 5, 3800);
  }

  private handleSetFocusMode(mode: CameraFocusMode): void {
    this.focusMode = mode;
    this.targetCamDist = mode === 'walker' ? MISSION_CONFIG.initialCamera.distance : ASTRONAUT_CONFIG.cameraDistance;
    this.app.fire(CameraEvent.FOCUS_MODE_CHANGED, { mode });
  }

  private handleWalkerPose(pose: PoseUpdatedPayload): void {
    if (this.focusMode !== 'walker') return;
    this.camTarget.set(pose.x, pose.y + 2.5, pose.z);
    this.clampTargetToWorld();
    if (!this.hasInitializedFocus) {
      this.camFocus.copy(this.camTarget);
      this.hasInitializedFocus = true;
    }
  }

  private handlePlayerPose(pose: PoseUpdatedPayload): void {
    if (this.focusMode !== 'explorer') return;
    this.camTarget.set(pose.x, pose.y + ASTRONAUT_CONFIG.cameraFocusOffset, pose.z);
    this.clampTargetToWorld();
  }

  /** Reposiciona a câmera sem interpolar a partir do local da morte. */
  public resetToStart(pose: PoseUpdatedPayload): void {
    const initial = MISSION_CONFIG.initialCamera;
    this.focusMode = 'walker';
    this.fieldFrame = undefined;
    this.fieldBlend = 0;
    this.camDist = initial.distance;
    this.targetCamDist = initial.distance;
    this.camYaw = initial.yawDeg;
    this.camPitch = initial.pitchDeg;
    this.camTarget.set(pose.x, pose.y + 2.5, pose.z);
    this.camFocus.copy(this.camTarget);
    this.hasInitializedFocus = true;
    this.update(0);
  }

  public clampTargetToWorld(): void {
    const bound = WORLD_HALF * 0.95;
    this.camTarget.x = clamp(this.camTarget.x, -bound, bound);
    this.camTarget.z = clamp(this.camTarget.z, -bound, bound);
  }

  public update(dt: number): void {
    this.camFocus.lerp(this.camFocus, this.camTarget, Math.min(1, dt * 10.0));
    this.camDist = lerp(this.camDist, this.targetCamDist, Math.min(1, dt * 8.0));

    const radYaw = this.camYaw * pc.math.DEG_TO_RAD;
    const radPitch = this.camPitch * pc.math.DEG_TO_RAD;

    const anchorY = this.camFocus.y + 2.4;
    const cx = this.camFocus.x + Math.sin(radYaw) * Math.cos(radPitch) * this.camDist;
    const cz = this.camFocus.z + Math.cos(radYaw) * Math.cos(radPitch) * this.camDist;
    const groundAtCam = sampleHeightViaEvent(this.app, cx, cz);
    const cy = Math.max(groundAtCam + 1.6, anchorY + Math.sin(radPitch) * this.camDist);

    this.fieldBlend = lerp(this.fieldBlend, this.fieldFrame ? 1 : 0, Math.min(1, dt * 4.5));
    this.renderEye.set(cx, cy, cz).lerp(this.renderEye, this.fieldEye, this.fieldBlend);
    this.renderFocus.set(this.camFocus.x, anchorY + 0.6, this.camFocus.z)
      .lerp(this.renderFocus, this.fieldFocus, this.fieldBlend);
    this.renderEye.y = Math.max(this.renderEye.y, sampleHeightViaEvent(this.app, this.renderEye.x, this.renderEye.z) + 1.6);
    if (this.quakePhase === 'operation') {
      this.quakeClock += dt;
      this.quakeRemaining = Math.max(0, this.quakeRemaining - dt);
    }
    if (this.quakeRemaining > 0) {
      const a = this.quakeIntensity * Math.min(1, this.quakeRemaining) * 0.16;
      this.renderEye.x += Math.sin(this.quakeClock * 39) * a;
      this.renderEye.y += Math.cos(this.quakeClock * 31) * a;
    }
    this.cameraEntity.setLocalPosition(this.renderEye);
    this.cameraEntity.lookAt(this.renderFocus);

    this.app.fire(CameraEvent.STATE_UPDATED, {
      x: this.renderEye.x,
      y: this.renderEye.y,
      z: this.renderEye.z,
      yawDeg: this.camYaw,
      camDist: this.camDist,
    });
  }

  public destroy(): void {
    this.app.off(GeologicalEvent.TREMOR, this.onQuake);
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onQuakeStatus);
    this.app.off(CameraEvent.FIELD_FRAME, this.onFieldFrame, this);
    this.app.off(InputEvent.ORBIT, this.onOrbitHandler, this);
    this.app.off(InputEvent.PAN, this.onPanHandler, this);
    this.app.off(InputEvent.ZOOM, this.onZoomHandler, this);
    this.app.off(CameraEvent.SET_FOCUS_MODE, this.onSetFocusModeHandler, this);
    this.app.off(WalkerEvent.POSE_UPDATED, this.onWalkerPoseHandler, this);
    this.app.off(PlayerEvent.POSE_UPDATED, this.onPlayerPoseHandler, this);
    this.app.off(CameraEvent.CLEAR_COLOR, this.onClearColorHandler, this);
    this.app.off('update', this.onUpdateHandler, this);
    this.cameraEntity.destroy();
  }
}
