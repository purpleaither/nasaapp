import { getMission } from '../../systems/missions.ts';
// MISSÃO 1 — adaptação das cenas de inspeção e perfuração do pacote de missões.
import * as pc from 'playcanvas';
import { MineralSite } from './MineralSite.ts';
import { FieldCamera } from './FieldCamera.ts';
import { CameraEvent, PlayerEvent, VolcanicEvent, type EvaCameraQuery, type VolcanicStatus } from '../../systems/events/worldEvents.ts';

export class MineralMissionScene {
  private site?: MineralSite;
  private sitePosition?: { x: number; z: number };
  private camera?: FieldCamera;
  private checkpoint = 0;
  private captureId = 0;
  private fieldOperator: 'walker' | 'explorer' = 'walker';
  private active = false;
  private photoTaken = false;
  private readonly light = new pc.StandardMaterial();
  private readonly beam: pc.Entity;

  constructor(private readonly app: pc.Application) {
    this.light.emissive = new pc.Color(0.4, 1, 0.8);
    this.light.useLighting = false;
    this.light.update();
    this.beam = new pc.Entity('Feixe de inspeção M01', app);
    this.beam.addComponent('render', { type: 'cylinder', material: this.light, castShadows: false });
    app.root.addChild(this.beam);
    this.beam.enabled = false;
    app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    app.on(VolcanicEvent.FIELD_PROGRESS, this.onProgress, this);
  }

  private onStatus(status: VolcanicStatus): void {
    this.fieldOperator = status.fieldOperator;
    if (this.captureId !== status.fieldActionId) {
      this.captureId = status.fieldActionId;
      this.photoTaken = false;
    }
    const scienceTarget = { ...status.geology.routes[0].points[2], radius: 22 };
    const targetChanged = this.sitePosition?.x !== scienceTarget.x || this.sitePosition?.z !== scienceTarget.z;
    if (status.completedCheckpoints < getMission(status.missionId).checkpoints.length && (!this.site || targetChanged)) {
      this.site?.destroy();
      this.site = undefined;
      this.sitePosition = { x: scienceTarget.x, z: scienceTarget.z };
      const walker = this.app.root.findByName('ArachnoNomadWalker');
      if (walker instanceof pc.Entity) this.site = new MineralSite(this.app, scienceTarget, walker);
    }
    if (this.checkpoint !== status.completedCheckpoints) {
      this.checkpoint = status.completedCheckpoints;
      this.photoTaken = false;
    }
    this.active = status.fieldActionActive;
    if (!this.active || status.phase === 'ended') {
      this.beam.enabled = false;
      this.site?.stop();
      this.app.fire(CameraEvent.FIELD_FRAME);
      this.app.fire(PlayerEvent.EVA_CAMERA_AIM);
    }
  }

  private onProgress(progress: number): void {
    if (!this.site || !this.active) return;
    if (this.checkpoint === 1) {
      this.site.animate(progress);
      return;
    }
    const observation = this.site.observation();
    const target = observation.focus;
    this.beam.enabled = false;
    let from = observation.eye;
    let opticalFrame: EvaCameraQuery | undefined;
    if (this.fieldOperator === 'explorer') {
      this.app.fire(PlayerEvent.EVA_CAMERA_AIM, { target: observation.focus, active: true });
      opticalFrame = { origin: new pc.Vec3(), forward: new pc.Vec3(), up: new pc.Vec3(), available: false };
      this.app.fire(PlayerEvent.EVA_CAMERA_QUERY, opticalFrame);
      if (!opticalFrame.available) {
        if (!this.photoTaken) {
          this.photoTaken = true;
          this.app.fire(VolcanicEvent.FIELD_PHOTO_ERROR, { index: this.checkpoint, captureId: this.captureId, message: 'Câmera EVA indisponível. Embarque ou tente novamente com C.' });
        }
        return;
      }
      from = opticalFrame.origin;
    }
    const direction = new pc.Vec3().sub2(target, from);
    this.beam.setPosition(new pc.Vec3().lerp(from, target, 0.5));
    this.beam.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, direction.clone().normalize()));
    this.beam.setLocalScale(0.15, direction.length(), 0.15);
    this.app.fire(CameraEvent.FIELD_FRAME, opticalFrame ? {
      eye: opticalFrame.origin,
      focus: opticalFrame.origin.clone().add(opticalFrame.forward.clone().mulScalar(20)),
    } : observation);
    if (progress >= 0.78 && !this.photoTaken) {
      if (!opticalFrame) return;
      const framing = this.site.validatePhoto(opticalFrame);
      if (!framing.valid) {
        if (progress >= 1) {
          this.photoTaken = true;
          this.app.fire(VolcanicEvent.FIELD_PHOTO_ERROR, { index: this.checkpoint, captureId: this.captureId, message: framing.reason });
        }
        return;
      }
      this.photoTaken = true;
      this.camera ??= new FieldCamera(this.app);
      this.camera.capture(observation.focus, this.checkpoint, from, {
        framingValidated: true, captureId: this.captureId, source: opticalFrame ? 'eva' : 'walker',
        forward: opticalFrame?.forward, up: opticalFrame?.up,
      });
    }
  }

  public destroy(): void {
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    this.app.off(VolcanicEvent.FIELD_PROGRESS, this.onProgress, this);
    this.app.fire(CameraEvent.FIELD_FRAME);
    this.app.fire(PlayerEvent.EVA_CAMERA_AIM);
    this.camera?.destroy();
    this.site?.destroy();
    this.beam.destroy();
    this.light.destroy();
  }
}
