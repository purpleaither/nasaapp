import { SignalMission } from './signal/SignalMission.ts';
import { HabitatScene } from './habitat/HabitatScene.ts';
import { HabitatController } from './habitat/HabitatController.ts';
import { GeologicalScene } from './geological/GeologicalScene.ts';
import { CameraSystem } from '../systems/CameraSystem.ts';
import { EngineSystem } from '../systems/EngineSystem.ts';
import { InputSystem } from '../systems/InputSystem.ts';
import { SimulationEvent } from '../systems/events/worldEvents.ts';
import { MISSION_CONFIG } from '../systems/missionConfig.ts';
import TimeSystem from '../systems/time/index.ts';
import { DustManager } from './effects/DustManager.ts';
import { MineralMissionScene } from './missions/MineralMissionScene.ts';
// ASTRONAUTA — ponto de integração do módulo com o mundo.
import { PlayerController } from './astronaut/index.ts';
import { PlayerLifeSupport } from './astronaut/vitals/PlayerLifeSupport.ts';
import Sky from './sky/index.ts';
import { TerrainManager } from './terrain/TerrainManager.ts';
import { VolcanicFront } from './volcanic/VolcanicFront.ts';
import { SteampunkWalker } from './walker/SteampunkWalker.ts';

export type { CameraFocusMode, TimePreset } from '../systems/events/worldEvents.ts';

/**
 * Pure event-driven PlayCanvas World container.
 * All subsystems (Terrain, Camera, Sky, Time, Player, Spider-Walker, Dust, Input)
 * communicate exclusively through PlayCanvas events (`app.fire` / `app.on` / `app.off`).
 */
export class WorldManager {
  private engine: EngineSystem;
  private terrain: TerrainManager;
  private camera: CameraSystem;
  private sky: Sky;
  private player: PlayerController;
  private lifeSupport: PlayerLifeSupport;
  private walker: SteampunkWalker;
  private dust: DustManager;
  private volcanicFront: VolcanicFront;
  private habitatScene: HabitatScene;
  private habitat: HabitatController;
  private geologicalScene: GeologicalScene;
  private missionScene: MineralMissionScene;
  private time: TimeSystem;
  private input: InputSystem;
  private signal: SignalMission;

  constructor(canvas: HTMLCanvasElement, initialSeed = MISSION_CONFIG.mapSeed) {
    this.engine = new EngineSystem(canvas);
    const { app, isHeadless } = this.engine;

    // 1. Terrain listens to TerrainEvent.SAMPLE_HEIGHT & TerrainEvent.REGENERATE_RANDOM
    this.terrain = new TerrainManager(app, initialSeed, isHeadless);

    // 2. Camera listens to InputEvent.*, WalkerEvent.POSE_UPDATED, PlayerEvent.POSE_UPDATED, CameraEvent.*
    this.camera = new CameraSystem(app);

    // 3. Sky listens to TimeEvent.TICK & CameraEvent.STATE_UPDATED
    this.sky = new Sky(app, isHeadless);

    // 4. Explorer & Spider-Walker listen to InputEvent.AXES, TimeEvent.TICK, TerrainEvent.SEED_CHANGED, etc.
    this.player = new PlayerController(app, isHeadless);
    this.lifeSupport = new PlayerLifeSupport(app);
    this.volcanicFront = new VolcanicFront(app);
    this.walker = new SteampunkWalker(app, isHeadless);
    this.missionScene = new MineralMissionScene(app);

    // 5. DustManager listens to WalkerEvent.FOOT_STEPPED to emit Martian dust puffs at the feet
    this.dust = new DustManager(app, isHeadless);

    this.time = new TimeSystem(app, {
      initialHour: 17.6,
      initialDay: 1,
      dayDurationMinutes: 4.0,
      timeScale: 1.0,
    }, SimulationEvent.STEP);

    this.geologicalScene = new GeologicalScene(app, isHeadless);
    this.habitatScene = new HabitatScene(app, isHeadless);
    this.habitat = new HabitatController(app);
    this.signal = new SignalMission(app);
    this.volcanicFront.attachSimulation();

    this.input = new InputSystem(app);

    // Emit initial TimeEvent.TICK & TimeEvent.PHASE_CHANGED so Sky and automatic Night Lanterns synchronize
    this.time.initialize();

    // A primeira partida e todos os reinícios passam pela mesma origem fixa.
    const { x, z, headingDeg } = MISSION_CONFIG.walkerSpawn;
    this.walker.resetToGround(x, z, headingDeg);
    this.camera.resetToStart({ x, y: this.walker.kinematics.posY, z, headingDeg });
    this.habitat.initialize();
  }

  public getSignalStatus() { return this.signal.getStatus(); }

  public getWalkerBaseMode() { return this.walker.kinematics.baseMode; }

  public getHabitatStatus() { return this.habitat.getStatus(); }

  public getAstronautVitals() {
    return this.lifeSupport.getVitalsData();
  }

  public getBoardingState() {
    return this.player.getBoardingState();
  }

  public getVolcanicStatus() {
    return this.volcanicFront.getStatus();
  }

  public getTerrainMeshStats() {
    return this.terrain.getMeshStats();
  }

  public fire(eventName: string, payload?: unknown): void {
    this.engine.app.fire(eventName, payload);
  }

  public on<T = unknown>(eventName: string, handler: (payload: T) => void): void {
    this.engine.app.on(eventName, handler as (arg: unknown) => void);
  }

  public off<T = unknown>(eventName: string, handler: (payload: T) => void): void {
    this.engine.app.off(eventName, handler as (arg: unknown) => void);
  }

  public destroy(): void {
    this.signal.destroy();
    this.input.destroy();
    this.time.destroy();
    this.dust.destroy();
    this.habitat.destroy();
    this.habitatScene.destroy();
    this.geologicalScene.destroy();
    this.missionScene.destroy();
    this.volcanicFront.destroy();
    this.walker.destroy();
    this.lifeSupport.dispose();
    this.player.destroy();
    this.sky.destroy();
    this.camera.destroy();
    this.terrain.destroy();
    this.engine.destroy();
  }
}
