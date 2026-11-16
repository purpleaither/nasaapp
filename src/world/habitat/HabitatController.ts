import { Vec3, type AppBase } from 'playcanvas';
import { CameraEvent, PlayerEvent, VolcanicEvent, type VolcanicStatus, type PlayerBoardingStatePayload, type PoseUpdatedPayload, sampleHeightViaEvent } from '../../systems/events/worldEvents.ts';
import { LifeSupportEvent } from '../astronaut/vitals/events.ts';
import { HABITAT_CONFIG, airlockFrame } from './config.ts';
import { HabitatEvent, type HabitatStatus, type HabitatPlacement } from './events.ts';
export class HabitatController {
  private location: HabitatStatus['location'] = 'inside';
  private cycling = false;
  private direction: HabitatStatus['direction'] = 'exit';
  private elapsed = 0;
  private equipmentReady = false;
  private fieldActive = false;
  private pose: PoseUpdatedPayload = { ...HABITAT_CONFIG.outsideSpawn, y: 0 };
  private boarded = true;
  private phase: VolcanicStatus['phase'] = 'preparation';
  private scientificComplete = false;
  private message = 'Base habitacional pressurizada. Consulte os objetivos e prepare o equipamento antes da EVA.';
  private readonly onPose = (pose: PoseUpdatedPayload) => { this.pose = pose; this.publish(); };
  private readonly onBoarding = ({ isBoarded }: PlayerBoardingStatePayload) => { this.boarded = isBoarded; this.publish(); };
  private readonly onMission = (status: VolcanicStatus) => { this.phase = status.phase; this.scientificComplete = status.missionCompleted; };
  private readonly prepare = () => {
    if (this.location !== 'inside' || this.cycling || this.phase === 'ended' || this.phase === 'paused') return;
    this.equipmentReady = true;
    this.message = 'Câmera EVA, broca, traje e tubo M01 verificados. Suprimentos preparados para a saída.';
    for (const event of [LifeSupportEvent.REFILL_OXYGEN, LifeSupportEvent.DRINK_WATER, LifeSupportEvent.EAT_FOOD]) this.app.fire(event);
    this.publish();
  };
  private readonly exit = () => {
    if (this.location !== 'inside' || this.cycling || !this.equipmentReady || this.phase === 'ended' || this.phase === 'paused') return;
    this.beginCycle('exit');
  };
  private readonly enter = () => {
    if (!this.getStatus().canEnter) return;
    this.beginCycle('enter');
  };
  private readonly completeField = () => {
    if (this.location !== 'inside' || this.cycling || !this.scientificComplete || !this.fieldActive || this.phase !== 'operation') return;
    this.fieldActive = false; this.message = 'Atividade de campo encerrada. Registros e amostra M01 entregues na base.'; this.publish();
    this.app.fire(HabitatEvent.COMPLETE_FIELD, { confirmedInside: true });
  };
  private readonly onCompleteRequest = (payload?: { confirmedInside?: boolean }) => {
    if (!payload?.confirmedInside) this.completeField();
  };
  private readonly update = (dt: number) => {
    if (!this.cycling || this.phase === 'paused' || this.phase === 'ended') return;
    this.elapsed += Math.max(0, Math.min(dt, 0.1));
    if (this.elapsed >= HABITAT_CONFIG.cycleSeconds) {
      this.elapsed = HABITAT_CONFIG.cycleSeconds; this.cycling = false;
      if (this.direction === 'exit') {
        this.location = 'outside'; this.fieldActive = true;
        this.message = 'Acesso liberado. EVA iniciada; o rover permanece no estacionamento lateral.';
        this.app.fire(CameraEvent.FIELD_FRAME);
        this.app.fire(VolcanicEvent.START);
        this.place(false);
      } else {
        this.location = 'inside'; this.message = 'Pressurizado. Retorno à base concluído. Consulte os registros ou prepare uma nova saída.';
        this.place(true); this.showBase();
      }
    }
    this.publish();
  };
  constructor(private readonly app: AppBase) {
    app.on(PlayerEvent.POSE_UPDATED, this.onPose); app.on(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoarding);
    app.on(VolcanicEvent.STATUS_CHANGED, this.onMission);
    app.on(HabitatEvent.PREPARE, this.prepare); app.on(HabitatEvent.EXIT, this.exit); app.on(HabitatEvent.ENTER, this.enter);
    app.on(HabitatEvent.COMPLETE_FIELD, this.onCompleteRequest); app.on(HabitatEvent.REQUEST_STATUS, this.publish);
    app.on('update', this.update);
    app.fire(HabitatEvent.REGISTER);
  }
  public initialize() { this.place(true); this.publish(); this.showBase(); }
  private showBase() {
    const c = HABITAT_CONFIG.center, y = sampleHeightViaEvent(this.app, c.x, c.z);
    this.app.fire(CameraEvent.FIELD_FRAME, { eye: new Vec3(c.x + 100, y + 66, c.z - 145), focus: new Vec3(c.x - 8, y + 10, c.z - 5) });
  }
  private place(inside: boolean) {
    const pose: HabitatPlacement = inside ? { x: HABITAT_CONFIG.center.x, z: -32, headingDeg: 180, inside: true } : { ...HABITAT_CONFIG.outsideSpawn, inside: false };
    this.app.fire(HabitatEvent.PLACE_PLAYER, pose);
  }
  private beginCycle(direction: 'exit' | 'enter') {
    this.direction = direction; this.elapsed = 0; this.cycling = true;
    this.message = direction === 'exit' ? 'Saída EVA: porta interna, fechamento, despressurização e abertura externa.' : 'Retorno: limpeza de poeira, fechamento externo, pressurização e acesso à base.';
    this.showBase(); this.publish();
  }
  public getStatus(): HabitatStatus {
    const distance = Math.ceil(Math.hypot(this.pose.x - HABITAT_CONFIG.entrance.x, this.pose.z - HABITAT_CONFIG.entrance.z));
    const frame = this.cycling ? airlockFrame(this.direction, this.elapsed) : { innerOpen: 0, outerOpen: 0, label: this.location === 'inside' ? 'Pressurizado' as const : 'Acesso liberado' as const, fade: 0 };
    return { ...frame, location: this.location, cycling: this.cycling, direction: this.direction, elapsed: this.elapsed,
      progress: Math.min(1, this.elapsed / HABITAT_CONFIG.cycleSeconds), equipmentReady: this.equipmentReady,
      fieldActive: this.fieldActive, canEnter: !this.boarded && this.location === 'outside' && !this.cycling && distance <= HABITAT_CONFIG.entrance.radius && this.phase === 'operation', distance,
      message: this.message };
  }
  private lastState = '';
  private readonly publish = () => { const state = this.getStatus(), key = JSON.stringify(state); if (key !== this.lastState) { this.lastState = key; this.app.fire(HabitatEvent.STATE, state); } };
  public destroy() {
    this.app.off(PlayerEvent.POSE_UPDATED, this.onPose); this.app.off(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoarding);
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onMission); this.app.off(HabitatEvent.PREPARE, this.prepare);
    this.app.off(HabitatEvent.EXIT, this.exit); this.app.off(HabitatEvent.ENTER, this.enter);
    this.app.off(HabitatEvent.COMPLETE_FIELD, this.onCompleteRequest); this.app.off(HabitatEvent.REQUEST_STATUS, this.publish); this.app.off('update', this.update);
  }
}
