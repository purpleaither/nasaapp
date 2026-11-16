import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { CameraSystem } from './CameraSystem.ts';
import { MISSION_CONFIG } from './missionConfig.ts';
import { CameraEvent, InputEvent, TerrainEvent } from './events/worldEvents.ts';
import { PlayerController } from '../world/astronaut/PlayerController.ts';
import { SteampunkWalker } from '../world/walker/SteampunkWalker.ts';

function createAttempt() {
  const canvas = { id: 'spawn-test', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.CameraComponentSystem, pc.RenderComponentSystem, pc.ModelComponentSystem, pc.AnimationComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.TextureHandler];
  app.init(options);
  // Spawn must be correct even before the asynchronous visual assets load.
  app.assets.load = () => {};
  app.on(TerrainEvent.SAMPLE_HEIGHT, query => { query.outY = 10; });
  const camera = new CameraSystem(app as pc.Application);
  const player = new PlayerController(app as pc.Application, true);
  const walker = new SteampunkWalker(app as pc.Application, true);
  const spawn = MISSION_CONFIG.walkerSpawn;
  walker.resetToGround(spawn.x, spawn.z, spawn.headingDeg);
  camera.resetToStart({ ...spawn, y: walker.kinematics.posY });
  const astronaut = app.root.findByName('ExplorerAstronaut') as pc.Entity;
  const view = app.root.findByName('MainCamera') as pc.Entity;
  return {
    app, camera, player, walker, astronaut,
    snapshot() {
      return {
        walker: walker.rootEntity.getPosition().clone(),
        heading: walker.kinematics.headingDeg,
        velocity: walker.kinematics.linearSpeed,
        baseMode: walker.kinematics.baseMode,
        astronaut: astronaut.getPosition().clone(),
        visible: astronaut.enabled,
        boarded: player.getBoardingState().isBoarded,
        camera: view.getPosition().clone(),
        yaw: camera.camYaw, pitch: camera.camPitch, distance: camera.camDist,
      };
    },
    destroy() { walker.destroy(); player.destroy(); camera.destroy(); app.destroy(); },
  };
}

test('every fresh attempt restores the exact original spawn and camera after driving and disembarking', () => {
  let attempt = createAttempt();
  try {
    const first = attempt.snapshot();
    assert.equal(first.walker.x, MISSION_CONFIG.walkerSpawn.x);
    assert.equal(first.walker.z, MISSION_CONFIG.walkerSpawn.z);
    assert.deepEqual(first.astronaut, first.walker);
    assert.equal(first.boarded, true);
    assert.equal(first.visible, false);
    for (const death of ['astronaut', 'base']) {
      for (let step = 0; step < 120; step++) {
        attempt.app.fire(InputEvent.AXES, { active: true, forward: 1, right: 0, shiftBoost: true, dt: 1 / 60 });
      }
      attempt.player.toggleBoarding();
      attempt.app.fire(InputEvent.ORBIT, { dx: 90, dy: 20 });
      attempt.app.fire(InputEvent.ZOOM, { wheelDelta: 2 });
      assert.notDeepEqual(attempt.snapshot(), first);
      attempt.destroy();
      attempt = createAttempt();
      assert.deepEqual(attempt.snapshot(), first, `restart after ${death} returns to original start`);
      attempt.app.fire(CameraEvent.SET_FOCUS_MODE, { mode: 'walker' });
    }
  } finally { attempt.destroy(); }
});
