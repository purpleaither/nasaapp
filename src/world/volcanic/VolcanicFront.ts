import { HabitatEvent, type HabitatStatus } from '../habitat/events.ts';
import { HABITAT_CONFIG } from '../habitat/config.ts';
import { HULL_REPAIR, repairBlockReason } from '../geological/hullRepair.ts';
// MISSÃO 1: conclusão científica ao selar e acondicionar o M01, sem etapa de extração.

import type { AppBase } from 'playcanvas';
import {
  type ExtractionZone,
  type FieldPhoto,
  type FieldPhotoError,
  type InputAxesPayload,
  type PoseUpdatedPayload,
  type PlayerBoardingStatePayload,
  PlayerEvent,
  type VolcanicStatus,
  InputEvent,
  SimulationEvent,
  VolcanicEvent,
  WalkerEvent,
} from '../../systems/events/worldEvents.ts';
import { MISSION_CONFIG } from '../../systems/missionConfig.ts';
import { actionSeconds, mineralStage, isPhotoCheckpoint, getMission, getMissionCheckpoints, MISSIONS, type MissionId } from '../../systems/missions.ts';
import { GeologicalEvent, SEISMIC_SCENARIO, missionLayout, segmentHitsCircle, type CollisionQuery, type RouteId, type RouteInfo, type SeismicReading, scarpBlocks, RESCUE_RANGE } from '../geological/crisis.ts';
import { getExtractionZone, type FrontSpeed } from '../extraction/extractionZone.ts';

const config = MISSION_CONFIG.volcanic;

export class VolcanicFront {
  private walker: PoseUpdatedPayload = { ...MISSION_CONFIG.walkerSpawn, y: 0 };
  private previousWalker = this.walker;
  private explorer = this.walker;
  private boarded = true;
  // Nome e bus históricos mantidos por compatibilidade; não há lava ativa.
  private habitatOnline = false;
  private insideHabitat = false;
  private fieldReturnConfirmed = false;
  private readonly returnTarget = { ...HABITAT_CONFIG.entrance };
  private readonly onHabitatRegister = () => { this.habitatOnline = true; };
  private readonly onHabitatState = (state: HabitatStatus) => { this.insideHabitat = state.location === 'inside' && !state.cycling; };
  private readonly onFieldEnd = (payload?: { confirmedInside?: boolean }) => {
    if (!payload?.confirmedInside || !this.insideHabitat || this.completedCheckpoints !== this.checkpoints.length || this.phase !== 'operation') return;
    this.fieldReturnConfirmed = true; this.phase = 'ended'; this.publishStatus();
  };
  private repairActive = false;
  private baseMode = false;
  private readonly onBaseMode = ({ baseMode }: { baseMode: boolean }): void => {
    this.baseMode = baseMode;
    if (!baseMode && this.repairActive) this.stopRepair('Reparo interrompido: o Walker saiu do Modo manutenção.');
    this.publishStatus();
  };
  private repairReason(): string | null {
    return repairBlockReason({ operational: this.phase === 'operation', hull: this.hull, energy: this.energy, baseMode: this.baseMode, boarded: this.boarded,
      shaking: this.elapsedTime < this.shakeUntil && this.localIntensity > 0, busy: this.fieldActionElapsed !== null, evacuating: this.evacuating });
  }
  private stopRepair(message: string): void { this.repairActive = false; this.feedback(message); }
  private readonly onRepair = (): void => {
    if (this.repairActive) this.stopRepair('Reparo interrompido. A energia já utilizada permanece consumida.');
    else {
      const reason = this.repairReason();
      if (reason) this.feedback(reason, 'error');
      else { this.repairActive = true; this.feedback('Manutenção iniciada: recuperando casco com energia do Walker.'); }
    }
    this.publishStatus();
  };
  private energy = 100;
  private equipment = 100;
  private readings: SeismicReading[] = [];
  private selectedRoute: RouteId = 'direct';
  private routePassed = false;
  private evacuating = false;
  private evacuated = false;
  private rescuedCrew = 0;
  private shakeUntil = 0;
  private localIntensity = 0;
  private message = 'Origem da atividade sísmica em investigação.';
  private readonly onRoute = (id: RouteId): void => {
    if (id !== 'direct' && id !== 'detour' || this.phase === 'ended') return;
    this.selectedRoute = id; this.routePassed = false; this.publishStatus();
  };
  private readonly onEvacuate = (): void => {
    if (this.phase !== 'operation' || !this.evacuationRequired()) return;
    this.evacuating = true; this.fieldActionElapsed = null;
    if (this.repairActive) this.stopRepair('Reparo encerrado para iniciar a retirada.');
    this.feedback('Evacuação operacional autorizada. Embarque e siga para o ponto de retirada.');
    this.publishStatus();
  };
  private readonly onRescue = (): void => {
    if (this.phase !== 'operation' || this.readings.length < 2 || this.rescuedCrew) return;
    const refuge = missionLayout(this.checkpoints[0]).refuge;
    if (!this.boarded || Math.hypot(this.walker.x - refuge.x, this.walker.z - refuge.z) > RESCUE_RANGE) {
      this.feedback(`Aproxime o Walker do abrigo de campo (${RESCUE_RANGE} UJ) para recolher a equipe.`, 'error'); return;
    }
    this.rescuedCrew = 2;
    this.feedback('Dois tripulantes recolhidos no Walker. Evacuação disponível.', 'success');
    this.publishStatus();
  };
  private readonly onCollision = (q: CollisionQuery): void => {
    const layout = missionLayout(this.checkpoints[0]);
    const colliders = [...scarpBlocks(this.checkpoints[0]), { ...layout.refuge, radius: 10 }, { ...this.extraction, radius: 9 }];
    // Se o cenário mudou em volta do ator, permite reduzir a penetração agregada.
    const clearance = (x: number, z: number) => Math.min(...colliders.map(p => Math.hypot(x - p.x, z - p.z) - p.radius - q.radius));
    const start = clearance(q.fromX, q.fromZ), end = clearance(q.x, q.z);
    if (start < 0 && end > start + 1e-8) return;
    if (colliders.some(p => segmentHitsCircle(q, p, p.radius))) q.blocked = true;
  };
  private evacuationRequired(): boolean { return this.hull <= 55 || this.energy <= 25 || this.equipment <= 30 || this.rescuedCrew > 0; }
  private speed: FrontSpeed = config.defaultSpeed;
  private readonly extractionHeadingOffset = 0;
  private extraction = getExtractionZone(this.speed, this.extractionHeadingOffset);
  private missionId: MissionId;
  private checkpoints: ExtractionZone[];
  private completedCheckpoints = 0;
  private fieldActionElapsed: number | null = null;
  private fieldActionId = 0;
  private photographReceived = false;
  private readonly onPhoto = (photo: FieldPhoto): void => {
    if (this.fieldActionElapsed !== null && photo.index === this.completedCheckpoints &&
        isPhotoCheckpoint(this.missionId, this.completedCheckpoints) && photo.framingValidated === true && photo.captureId === this.fieldActionId && !this.boarded && photo.source === 'eva' && /^data:image\/(png|jpeg);base64,/.test(photo.image)) {
      this.photographReceived = true;
    }
  };
  private readonly onPhotoError = (error: FieldPhotoError): void => {
    if (this.fieldActionElapsed === null || error.captureId !== this.fieldActionId || error.index !== this.completedCheckpoints) return;
    this.fieldActionElapsed = null;
    this.feedback(error.message, 'error');
    this.publishStatus();
  };

  private feedback(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
    this.app.fire(VolcanicEvent.FIELD_FEEDBACK, { message, kind });
  }
  private elapsedTime = 0;
  private hull: number = config.initialHull;
  private phase: VolcanicStatus['phase'] = 'preparation';
  private defeat: VolcanicStatus['defeat'] = null;
  private lastStatus?: VolcanicStatus;

  constructor(private readonly app: AppBase, missionId: MissionId = MISSIONS[0].id) {
    this.missionId = missionId;
    this.checkpoints = getMissionCheckpoints(missionId, this.extraction);
    app.on(WalkerEvent.POSE_UPDATED, this.onWalkerPose, this);
    app.on(PlayerEvent.POSE_UPDATED, this.onExplorerPose, this);
    app.on(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoardingState, this);
    app.on(VolcanicEvent.SET_SPEED, this.setSpeed, this);
    app.on(VolcanicEvent.FIELD_PHOTO, this.onPhoto, this);
    app.on(VolcanicEvent.FIELD_PHOTO_ERROR, this.onPhotoError, this);
    app.on(VolcanicEvent.COMPLETE_OBJECTIVE, this.completeObjective, this);
    app.on(VolcanicEvent.START, this.start, this);
    app.on(VolcanicEvent.PAUSE, this.pause, this);
    app.on(VolcanicEvent.RESUME, this.resume, this);
    app.on(HabitatEvent.REGISTER, this.onHabitatRegister);
    app.on(HabitatEvent.STATE, this.onHabitatState);
    app.on(HabitatEvent.COMPLETE_FIELD, this.onFieldEnd);
    app.on(GeologicalEvent.REPAIR, this.onRepair);
    app.on(WalkerEvent.BASE_MODE_CHANGED, this.onBaseMode);
    app.on(GeologicalEvent.ROUTE_SELECT, this.onRoute);
    app.on(GeologicalEvent.EVACUATE, this.onEvacuate);
    app.on(GeologicalEvent.RESCUE, this.onRescue);
    app.on(GeologicalEvent.COLLISION_QUERY, this.onCollision);
  }

  public attachSimulation(): void {
    this.app.on(InputEvent.AXES, this.advance, this);
  }

  private onWalkerPose(pose: PoseUpdatedPayload): void {
    this.walker = pose;
  }

  private onExplorerPose(pose: PoseUpdatedPayload): void {
    this.explorer = pose;
  }

  private onBoardingState({ isBoarded }: PlayerBoardingStatePayload): void {
    this.boarded = isBoarded;
    if (!isBoarded && this.repairActive) this.stopRepair('Reparo interrompido: astronauta desembarcado.');
  }

  // MISSÃO 1: o registro fotográfico conjunto exigem EVA; a broca exige o Walker.
  private getFieldOperator() {
    if (this.evacuating) return { pose: this.walker, fieldOperator: 'walker' as const, fieldRequiresBoarding: !this.boarded, fieldRequiresDisembarking: false };
    if (this.habitatOnline && this.completedCheckpoints === this.checkpoints.length) return { pose: this.boarded ? this.walker : this.explorer, fieldOperator: this.boarded ? 'walker' as const : 'explorer' as const, fieldRequiresBoarding: false, fieldRequiresDisembarking: false };
    const scene = getMission(this.missionId).checkpoints[this.completedCheckpoints]?.scene;
    const mineralMission = this.missionId === 'mineral-sampling';
    const onFoot = mineralMission && !this.boarded && scene === 'photo';
    return {
      pose: onFoot ? this.explorer : this.walker,
      fieldOperator: onFoot ? 'explorer' as const : 'walker' as const,
      fieldRequiresBoarding: mineralMission && !this.boarded && scene === 'core',
      fieldRequiresDisembarking: mineralMission && this.boarded && scene === 'photo',
    };
  }

  private advance({ dt }: InputAxesPayload): void {
    if (this.phase !== 'operation') return;

    if (!Number.isFinite(dt) || dt <= 0) return;
    const travelled = Math.hypot(this.walker.x - this.previousWalker.x, this.walker.z - this.previousWalker.z);
    if (travelled > 0.01 && this.repairActive) this.stopRepair('Reparo interrompido: Walker em movimento.');
    const rise = Math.max(0, this.walker.y - this.previousWalker.y);
    this.energy = Math.max(0, this.energy - dt * 0.035 - travelled * 0.028 - rise * 0.015);
    this.previousWalker = this.walker;
    this.elapsedTime += dt;
    const layout = missionLayout(this.checkpoints[0]);
    if (Math.hypot(this.walker.x - (this.selectedRoute === 'detour' ? layout.bypass.x : layout.rockfall.x),
        this.walker.z - (this.selectedRoute === 'detour' ? layout.bypass.z : layout.rockfall.z)) < 30) this.routePassed = true;
    while (this.readings.length < SEISMIC_SCENARIO.length && this.elapsedTime >= SEISMIC_SCENARIO[this.readings.length].at) {
      const event = SEISMIC_SCENARIO[this.readings.length];
      const id = this.readings.length + 1;
      const local = Math.hypot(this.walker.x - layout.rockfall.x, this.walker.z - layout.rockfall.z) < 650;
      this.message = local ? event.message : 'Evento sísmico detectado no setor de investigação. Sem danos observados no Walker.';
      this.readings = [...this.readings, { id, time: event.at, amplitude: event.amplitude, message: this.message }];
      this.localIntensity = local ? event.amplitude : 0;
      this.shakeUntil = event.at + 3;
      if (local) {
        if (this.repairActive) this.stopRepair('Reparo interrompido pelo tremor. Aguarde estabilização.');
        this.hull = Math.max(0, this.hull - event.hull);
        this.equipment = Math.max(0, this.equipment - event.equipment);
        this.energy = Math.max(0, this.energy - event.energy);
        this.app.fire(WalkerEvent.HULL_DAMAGED);
      }
      // A poeira e os blocos são locais mesmo quando o instrumento detecta o sismo à distância.
      this.app.fire(GeologicalEvent.TREMOR, { id, intensity: event.amplitude, epicenter: layout.rockfall, duration: 3 });
      this.feedback(this.message, local ? 'error' : 'info');
    }
    if (this.repairActive) {
      const reason = this.repairReason();
      if (reason) this.stopRepair(reason);
      else {
        const recovered = Math.min(100 - this.hull, HULL_REPAIR.hullPerSecond * dt, Math.max(0, (this.energy - HULL_REPAIR.energyReserve) / HULL_REPAIR.energyPerHull));
        this.hull = Math.min(100, this.hull + recovered);
        this.energy -= recovered * HULL_REPAIR.energyPerHull;
        if (this.hull >= 100 - 1e-8) { this.hull = 100; this.stopRepair('Casco recuperado. Os danos nos instrumentos e nas rotas permanecem independentes.'); }
        else if (this.energy <= HULL_REPAIR.energyReserve + 1e-8) this.stopRepair('Reparo interrompido para preservar a reserva de energia.');
      }
    }
    if (this.hull <= 0 || this.energy <= 0) {
      this.defeat = this.hull <= 0 ? 'structural' : 'power'; this.phase = 'ended'; this.fieldActionElapsed = null;
    }
    if (this.phase === 'operation' && this.evacuating && this.boarded && Math.hypot(this.walker.x - this.extraction.x, this.walker.z - this.extraction.z) <= this.extraction.radius) {
      this.evacuated = true; this.phase = 'ended'; this.fieldActionElapsed = null;
    }
    this.app.fire(SimulationEvent.STEP, dt);
    this.advanceFieldAction(dt);
    this.publishStatus();
  }

  // MISSÕES: Confirma apenas o objetivo ativo e somente dentro do alcance.
  private completeObjective(index = this.completedCheckpoints): void {
    if (this.phase !== 'operation') {
      this.feedback(this.phase === 'preparation' ? 'Inicie a operação para usar C nos objetivos.' : 'Retome a operação antes de usar C.');
      return;
    }
    if (this.repairActive) { this.feedback('Interrompa o reparo antes de operar os instrumentos.'); return; }
    if (this.evacuating) { this.feedback('Evacuação em andamento. Priorize a retirada.'); return; }
    if (this.equipment <= 30) { this.feedback('Instrumentos comprometidos. Evacue a equipe.', 'error'); return; }
    if (this.fieldActionElapsed !== null) { this.feedback('Ação científica em andamento.'); return; }
    if (index !== this.completedCheckpoints) return;
    const target = this.checkpoints[index];
    const { pose, fieldRequiresBoarding, fieldRequiresDisembarking } = this.getFieldOperator();
    if (!target) { this.feedback(this.habitatOnline ? 'M01 acondicionado e registrado. Retorne à base para encerrar a atividade de campo.' : 'M01 acondicionado e registrado. Missão concluída.'); return; }
    if (fieldRequiresDisembarking) { this.feedback('Desembarque do Walker com E e use a câmera EVA para fotografar o afloramento.'); return; }
    if (fieldRequiresBoarding) { this.feedback('Embarque no Walker com E para operar a broca.'); return; }
    const distance = Math.ceil(Math.max(0, Math.hypot(target.x - pose.x, target.z - pose.z) - target.radius));
    if (distance > 0) { this.feedback(`C recebido. Aproxime-se mais ${distance} UJ do afloramento para ${getMission(this.missionId).checkpoints[index].action.toLowerCase()} e pressione C novamente.`); return; }
    this.fieldActionId++;
    this.photographReceived = false;
    this.feedback(isPhotoCheckpoint(this.missionId, index) ? 'Câmera acionada. Estabilizando e enquadrando o afloramento.' : 'Braço de perfuração acionado.');
    this.fieldActionElapsed = 0;
    this.publishStatus();
    this.app.fire(VolcanicEvent.FIELD_PROGRESS, 0);
  }

  // Os danos observados podem interromper a operação; nenhum sismo prevê uma erupção.
  private advanceFieldAction(dt: number): void {
    if (this.fieldActionElapsed === null) return;
    if (this.phase !== 'operation' || this.equipment <= 30) {
      this.fieldActionElapsed = null;
      return;
    }
    const target = this.checkpoints[this.completedCheckpoints];
    const { pose, fieldRequiresBoarding, fieldRequiresDisembarking } = this.getFieldOperator();
    if (!target || fieldRequiresBoarding || fieldRequiresDisembarking || Math.hypot(target.x - pose.x, target.z - pose.z) > target.radius) {
      this.fieldActionElapsed = null;
      this.app.fire(VolcanicEvent.FIELD_PROGRESS, 0);
      return;
    }
    this.fieldActionElapsed += dt;
    const progress = Math.min(this.fieldActionElapsed / actionSeconds(this.missionId, this.completedCheckpoints), 1);
    this.app.fire(VolcanicEvent.FIELD_PROGRESS, progress);
    if (this.fieldActionElapsed === null || this.phase !== 'operation') return;
    if (progress === 1) {
      const needsPhoto = isPhotoCheckpoint(this.missionId, this.completedCheckpoints);
      if (needsPhoto && !this.photographReceived) {
        if (this.fieldActionElapsed > actionSeconds(this.missionId, this.completedCheckpoints) + 3) {
          this.fieldActionElapsed = null;
          this.feedback('A imagem não foi registrada. Pressione C para tentar novamente.', 'error');
        }
        return;
      }
      this.fieldActionElapsed = null;
      this.completedCheckpoints++;
      if (this.completedCheckpoints === this.checkpoints.length && !this.evacuating && !this.habitatOnline) this.phase = 'ended';
      this.feedback(needsPhoto ? getMission(this.missionId).checkpoints[this.completedCheckpoints - 1].result : 'Tubo M01 selado, acondicionado no Walker e associado aos registros científicos.', 'success');
    }
  }

  private setSpeed(speed: number): void {
    const selectedSpeed = config.speedOptions.find(option => option === speed);
    if (this.phase !== 'preparation' || selectedSpeed === undefined) return;
    this.speed = selectedSpeed;
    this.extraction = getExtractionZone(selectedSpeed, this.extractionHeadingOffset);
    this.checkpoints = getMissionCheckpoints(this.missionId, this.extraction);
    this.publishStatus();
  }

  private start(): void {
    if (this.phase !== 'preparation') return;
    this.beginOperation();
  }

  private beginOperation(): void {
    this.previousWalker = this.walker;
    this.phase = 'operation';
    this.publishStatus();
  }

  private pause(): void {
    if (this.phase !== 'operation') return;
    this.phase = 'paused';
    this.publishStatus();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'operation';
    this.publishStatus();
  }

  public getStatus(): VolcanicStatus {
    const layout = missionLayout(this.checkpoints[0]);
    const routeState = 'open';
    const routes: RouteInfo[] = (['direct', 'detour'] as const).map(id => {
      const middle = id === 'direct' ? layout.rockfall : layout.bypass;
      const points = [MISSION_CONFIG.walkerSpawn, middle, this.checkpoints[0]];
      const distance = Math.round(Math.hypot(middle.x, middle.z) + Math.hypot(middle.x - this.checkpoints[0].x, middle.z - this.checkpoints[0].z));
      return { id, name: id === 'direct' ? 'Corredor direto' : 'Desvio pela planície', points, distance,
        terrain: id === 'direct' ? 'Basalto firme · junto à escarpa' : 'Regolito e blocos baixos',
        energyEstimate: Math.ceil(distance * (id === 'direct' ? 0.03 : 0.036)),
        risk: id === 'direct' ? 'Percurso junto à escarpa' : 'Menor exposição à escarpa; terreno mais irregular',
        state: id === 'direct' ? routeState : 'open' };
    });
    const dx = this.extraction.x - this.walker.x;
    const dz = this.extraction.z - this.walker.z;
    const heading = Math.atan2(dx, dz) * 180 / Math.PI;
    const relativeBearing = heading - this.walker.headingDeg;
    const missionCompleted = this.completedCheckpoints === this.checkpoints.length;
    const scienceTarget = this.checkpoints[Math.min(this.completedCheckpoints, this.checkpoints.length - 1)] ?? this.extraction;
    const returningToHabitat = this.habitatOnline && missionCompleted && !this.evacuating;
    const target = this.evacuating ? this.extraction : returningToHabitat ? this.returnTarget : scienceTarget;
    const { pose, fieldOperator, fieldRequiresBoarding, fieldRequiresDisembarking } = this.getFieldOperator();
    const targetHeading = Math.atan2(target.x - pose.x, target.z - pose.z) * 180 / Math.PI;
    // MISSÕES: D reduz o ângulo do Walker. No HUD, valores positivos indicam virar à direita.
    const headingDifference = pose.headingDeg - targetHeading;
    const targetBearing = (((headingDifference + 180) % 360 + 360) % 360) - 180;
    return {
      geology: {
        repairActive: this.repairActive, repairAvailable: this.repairReason() === null, repairHint: this.repairReason() ?? 'Reparo disponível: 2,5% de casco/s; custo de 0,45% de energia por 1% de casco.',
        energy: Math.ceil(this.energy), equipment: Math.ceil(this.equipment), events: this.readings,
        shaking: this.phase === 'operation' && this.elapsedTime < this.shakeUntil,
        localIntensity: this.elapsedTime < this.shakeUntil ? this.localIntensity : 0,
        selectedRoute: this.selectedRoute, routes,
        navigation: this.evacuating ? this.extraction : returningToHabitat ? this.returnTarget : this.routePassed ? target : this.selectedRoute === 'detour' ? layout.bypass : layout.rockfall,
        navigationLabel: this.evacuating ? 'Retirada operacional' : returningToHabitat ? 'BASE HABITACIONAL' : this.routePassed ? 'Afloramento M01' : this.selectedRoute === 'detour' ? 'Desvio pela planície' : 'Corredor direto',
        evacuationRequired: this.evacuationRequired(), evacuating: this.evacuating, rescuedCrew: this.rescuedCrew,
        refuge: layout.refuge, message: this.message,
      },
      targetBearing: Math.round(targetBearing),
      fieldOperator,
      fieldRequiresBoarding,
      fieldRequiresDisembarking,
      fieldActionActive: this.fieldActionElapsed !== null,
      fieldActionId: this.fieldActionId,
      mineralStage: this.missionId === 'mineral-sampling' && getMission(this.missionId).checkpoints[this.completedCheckpoints]?.scene === 'core' && this.fieldActionElapsed !== null
        ? mineralStage(this.fieldActionElapsed / actionSeconds(this.missionId, this.completedCheckpoints)) : undefined,
      missionId: this.missionId,
      completedCheckpoints: this.completedCheckpoints,
      target,
      targetDistance: missionCompleted && !returningToHabitat ? 0 : Math.ceil(Math.max(
        0, Math.hypot(target.x - pose.x, target.z - pose.z) - target.radius,
      )),
      phase: this.phase,
      // Campos legados sem frente térmica; preservados para consumidores antigos do bus.
      distance: 0, secondsToArrival: 0, speed: this.speed,
      zone: this.hull <= 0 ? 'destruction' : this.evacuationRequired() ? 'heated' : 'safe',
      hull: Math.ceil(this.hull),
      defeat: this.defeat,
      evacuated: this.evacuated,
      missionCompleted,
      fieldActivityCompleted: missionCompleted && (!this.habitatOnline || this.fieldReturnConfirmed),
      returningToHabitat,
      extraction: this.extraction,
      distanceToExtraction: Math.ceil(Math.max(0, Math.hypot(dx, dz) - this.extraction.radius)),
      extractionBearing: Math.round(((relativeBearing + 540) % 360) - 180),
      elapsedSeconds: Math.floor(this.elapsedTime + 1e-8),
    };
  }

  private publishStatus(): void {
    const status = this.getStatus();
    if (JSON.stringify(this.lastStatus) === JSON.stringify(status)) return;
    this.lastStatus = status;
    this.app.fire(VolcanicEvent.STATUS_CHANGED, status);
  }

  destroy(): void {
    this.app.off(HabitatEvent.REGISTER, this.onHabitatRegister);
    this.app.off(HabitatEvent.STATE, this.onHabitatState);
    this.app.off(HabitatEvent.COMPLETE_FIELD, this.onFieldEnd);
    this.app.off(GeologicalEvent.REPAIR, this.onRepair);
    this.app.off(WalkerEvent.BASE_MODE_CHANGED, this.onBaseMode);
    this.app.off(GeologicalEvent.ROUTE_SELECT, this.onRoute);
    this.app.off(GeologicalEvent.EVACUATE, this.onEvacuate);
    this.app.off(GeologicalEvent.RESCUE, this.onRescue);
    this.app.off(GeologicalEvent.COLLISION_QUERY, this.onCollision);
    this.app.off(WalkerEvent.POSE_UPDATED, this.onWalkerPose, this);
    this.app.off(PlayerEvent.POSE_UPDATED, this.onExplorerPose, this);
    this.app.off(PlayerEvent.BOARDING_STATE_CHANGED, this.onBoardingState, this);
    this.app.off(InputEvent.AXES, this.advance, this);
    this.app.off(VolcanicEvent.SET_SPEED, this.setSpeed, this);
    this.app.off(VolcanicEvent.FIELD_PHOTO, this.onPhoto, this);
    this.app.off(VolcanicEvent.FIELD_PHOTO_ERROR, this.onPhotoError, this);
    this.app.off(VolcanicEvent.COMPLETE_OBJECTIVE, this.completeObjective, this);
    this.app.off(VolcanicEvent.START, this.start, this);
    this.app.off(VolcanicEvent.PAUSE, this.pause, this);
    this.app.off(VolcanicEvent.RESUME, this.resume, this);
  }
}
