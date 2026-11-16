import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pc from 'playcanvas';
import { PlayerController } from './PlayerController.ts';
import { CameraEvent, InputEvent, TerrainEvent, VolcanicEvent, WalkerEvent, PlayerEvent } from '../../systems/events/worldEvents.ts';

function createApp() {
  const canvas = { id: 'astronaut-test', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.ModelComponentSystem, pc.AnimationComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.TextureHandler];
  app.init(options);
  const load = app.assets.load.bind(app.assets);
  app.assets.load = (asset: pc.Asset) => {
    if (asset.type === 'texture') {
      // GPU-free texture substitute; geometry and animation use the actual uploaded GLB.
      asset.resource = new pc.Texture(app.graphicsDevice);
      asset.loaded = true;
      asset.fire('load', asset);
    } else {
      if (asset.type === 'container') {
        const bytes = readFileSync(new URL('../../../public/models/astronaut/astronaut.glb', import.meta.url));
        asset.file = { url: (asset.file as { url: string }).url, contents: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
      }
      load(asset);
    }
  };
  app.on(TerrainEvent.SAMPLE_HEIGHT, (query) => { query.outY = 0; });
  app.on(CameraEvent.SET_FOCUS_MODE, (payload) => app.fire(CameraEvent.FOCUS_MODE_CHANGED, payload));
  return app;
}

test('uploaded astronaut loads, animates and preserves boarding, running, jumping and pause', async () => {
  const app = createApp();
  const player = new PlayerController(app as pc.Application, true);
  try {
    app.fire(WalkerEvent.POSE_UPDATED, { x: 0, y: 0, z: 0, headingDeg: 0 });
    const asset = app.assets.find('ExplorerModel')!;
    await new Promise<void>((resolve, reject) => {
      if (asset.loaded) return resolve();
      asset.once('load', () => resolve());
      asset.once('error', reject);
    });
    const root = app.root.findByName('ExplorerAstronaut') as pc.Entity;
    const model = root.findByName('OhMarsAstronaut') as pc.Entity;
    assert.ok(model?.animation, 'actual model and animation component load');
    assert.equal(root.enabled, false);
    assert.equal((root.findByName('AstronautLoadingFallback') as pc.Entity).enabled, false);
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    player.toggleBoarding();
    assert.equal(root.enabled, true);
    assert.equal(player.getBoardingState().canBoard, true);
    app.update(1 / 60);
    for (const mesh of model.model!.meshInstances!) mesh.skinInstance?.updateMatrices(mesh.node, 1);
    const bounds = new pc.BoundingBox();
    const meshes = model.model!.meshInstances!;
    bounds.copy(meshes[0]!.aabb);
    for (const mesh of meshes.slice(1)) bounds.add(mesh.aabb);
    assert.ok(bounds.halfExtents.y * 2 > 11 && bounds.halfExtents.y * 2 < 14, 'model is calibrated to astronaut scale');
    assert.ok(bounds.center.y - bounds.halfExtents.y > -0.1, 'feet stay above terrain');
    app.fire(CameraEvent.STATE_UPDATED, { yawDeg: -90, camDist: 30 });
    const opticalFrame = { origin: new pc.Vec3(), forward: new pc.Vec3(), up: new pc.Vec3(), available: false };
    app.fire(PlayerEvent.EVA_CAMERA_QUERY, opticalFrame);
    assert.equal(opticalFrame.available, true);
    assert.ok(opticalFrame.origin.y > root.getPosition().y + 4 && opticalFrame.origin.y < root.getPosition().y + 13, 'camera follows the animated chest');
    const start = root.getPosition().clone();
    app.fire(InputEvent.AXES, { active: true, forward: 0, right: 1, shiftBoost: false, dt: 1 / 60 });
    assert.ok((model.animation as unknown as { currAnim: string }).currAnim?.endsWith('/2'), 'walk clip selected');
    app.fire(InputEvent.AXES, { active: true, forward: 0, right: 1, shiftBoost: true, dt: 1 / 60 });
    assert.ok((model.animation as unknown as { currAnim: string }).currAnim?.endsWith('/1'), 'run clip selected');
    assert.ok(root.getPosition().distance(start) > 0);
    assert.ok(model.animation!.speed < 1, 'stride matches acceleration instead of playing full speed');
    app.fire(InputEvent.ACTION_JUMP);
    app.fire(InputEvent.AXES, { active: false, forward: 0, right: 0, shiftBoost: false, dt: 1 / 60 });
    assert.ok(root.getPosition().y > 0);
    assert.ok((model.animation as unknown as { currAnim: string }).currAnim?.endsWith('/3'), 'jump clip selected');
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'paused' });
    assert.equal(model.animation!.enabled, false);
    app.fire(VolcanicEvent.STATUS_CHANGED, { phase: 'operation' });
    assert.equal(model.animation!.enabled, true);
    for (let frame = 0; frame < 240; frame++) {
      app.fire(InputEvent.AXES, { active: false, forward: 0, right: 0, shiftBoost: false, dt: 1 / 60 });
    }
    assert.equal(root.getPosition().y, 0, 'jump lands on terrain');
    player.toggleBoarding();
    assert.equal(player.getBoardingState().isBoarded, true);
    assert.equal(root.enabled, false);
    assert.equal(model.animation!.enabled, false);

  } finally {
    player.destroy();
    assert.equal(app.assets.find('ExplorerModel'), null);
    app.destroy();
  }
});
