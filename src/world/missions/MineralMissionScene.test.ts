import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { MineralMissionScene } from './MineralMissionScene.ts';
import { MissionWaypoint } from './MissionWaypoint.ts';
import { SteampunkWalker } from '../walker/SteampunkWalker.ts';
import { PlayerController } from '../astronaut/PlayerController.ts';
import { VolcanicFront } from '../volcanic/VolcanicFront.ts';
import { CameraSystem } from '../../systems/CameraSystem.ts';
import { CameraEvent, InputEvent, TerrainEvent, VolcanicEvent } from '../../systems/events/worldEvents.ts';
import { actionSeconds } from '../../systems/missions.ts';

test('mineral scene builds M01, locks movement during actions, animates drilling and releases the camera', () => {
  const canvas = { id: 'mineral-scene', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.CameraComponentSystem, pc.RenderComponentSystem, pc.ModelComponentSystem, pc.AnimationComponentSystem, pc.LightComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.TextureHandler];
  app.init(options);
  app.assets.load = () => {};
  app.on(TerrainEvent.SAMPLE_HEIGHT, query => { query.outY = 0; });
  const camera = new CameraSystem(app as pc.Application);
  const player = new PlayerController(app as pc.Application, true);
  const front = new VolcanicFront(app);
  const walker = new SteampunkWalker(app as pc.Application, true);
  const scene = new MineralMissionScene(app as pc.Application);
  const waypoint = new MissionWaypoint(app as pc.Application);
  front.attachSimulation();
  let fieldFrame = false;
  app.on(CameraEvent.FIELD_FRAME, frame => { fieldFrame = Boolean(frame); });
  try {
    app.fire(VolcanicEvent.START);
    assert.ok(app.root.findByName('Afloramento M01'));
    assert.ok(app.root.findByName('Tubo M01'));
    const target = front.getStatus().target;
    const orientation = new pc.Quat().setFromEulerAngles(0, Math.atan2(target.x, target.z) * pc.math.RAD_TO_DEG, 0);
  const photoPosition = orientation.transformVector(new pc.Vec3(4, 0, -19.5)).add(new pc.Vec3(target.x, 0, target.z));
  walker.resetToGround(photoPosition.x - 43, photoPosition.z, 0);
    player.toggleBoarding();
    app.fire(CameraEvent.STATE_UPDATED, { yawDeg: -90, camDist: 30 });
    for (let frame = 0; frame < 15; frame++) {
      app.fire(InputEvent.AXES, { active: false, forward: 0, right: 0, shiftBoost: false, dt: 1 / 60 });
    }
    for (const index of [0, 1]) {
      if (index === 1) {
        player.toggleBoarding();
        walker.resetToGround(target.x, target.z - 18, 28);
      }
      app.fire(VolcanicEvent.COMPLETE_OBJECTIVE, index);
      assert.equal(front.getStatus().fieldActionActive, true);
      const before = walker.rootEntity.getPosition().clone();
      player.toggleBoarding();
      assert.equal(player.getBoardingState().isBoarded, index === 1, 'operator cannot change while the instrument is operating');
      app.fire(InputEvent.AXES, { active: true, forward: 1, right: 1, shiftBoost: true, dt: 0.01 });
      assert.ok(Math.hypot(walker.kinematics.posX - before.x, walker.kinematics.posZ - before.z) < 0.001, 'Walker stays parked');
      assert.equal(fieldFrame, true);
      if (index === 0) app.fire(VolcanicEvent.FIELD_PHOTO, { index, captureId: front.getStatus().fieldActionId, source: 'eva', framingValidated: true, image: 'data:image/jpeg;base64,dGVzdA==' });
      app.fire(InputEvent.AXES, { active: false, forward: 0, right: 0, shiftBoost: false, dt: actionSeconds('mineral-sampling', index) });
      assert.equal(front.getStatus().completedCheckpoints, index + 1);
      assert.equal(fieldFrame, false, 'navigation camera is released after the action');
    }
    const lid = app.root.findByName('Tubo M01') as pc.Entity;
    assert.ok(lid.enabled, 'sealed tube remains with the vehicle');
  } finally {
    waypoint.destroy(); scene.destroy(); front.destroy(); walker.destroy(); player.destroy(); camera.destroy(); app.destroy();
  }
});
