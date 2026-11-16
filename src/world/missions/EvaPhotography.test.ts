// Testa o fluxo real C -> corpo/lente EVA -> renderizador -> registro -> objetivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { CameraSystem } from '../../systems/CameraSystem.ts';
import { InputSystem } from '../../systems/InputSystem.ts';
import { PlayerController } from '../astronaut/PlayerController.ts';
import { SteampunkWalker } from '../walker/SteampunkWalker.ts';
import { VolcanicFront } from '../volcanic/VolcanicFront.ts';
import { MineralMissionScene } from './MineralMissionScene.ts';
import { FieldCamera } from './FieldCamera.ts';
import { VolcanicEvent, PlayerEvent, type FieldPhoto } from '../../systems/events/worldEvents.ts';

test('pressing C on foot aims the suit camera and completes photography only after a saved image', async t => {
  const canvas = { id: 'eva-actual-key', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.CameraComponentSystem, pc.RenderComponentSystem, pc.ModelComponentSystem, pc.AnimationComponentSystem, pc.LightComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.TextureHandler];
  app.init(options);
  app.assets.load = () => {};
  app.on('terrain:sample-height', query => { query.outY = 0; });
  const camera = new CameraSystem(app as pc.Application);
  camera.camYaw = -90;
  const player = new PlayerController(app as pc.Application, true);
  const front = new VolcanicFront(app);
  const walker = new SteampunkWalker(app as pc.Application, true);
  const scene = new MineralMissionScene(app as pc.Application);
  front.attachSimulation();
  app.fire(VolcanicEvent.START);
  const target = front.getStatus().target;
  const orientation = new pc.Quat().setFromEulerAngles(0, Math.atan2(target.x, target.z) * pc.math.RAD_TO_DEG, 0);
  const photoPosition = orientation.transformVector(new pc.Vec3(4, 0, -19.5)).add(new pc.Vec3(target.x, 0, target.z));
  walker.resetToGround(photoPosition.x - 43, photoPosition.z, 0);
  player.toggleBoarding();
  assert.equal(player.getBoardingState().isBoarded, false);
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const keyboard = Object.assign(new EventTarget(), { closest: () => null });
  globalThis.window = keyboard as unknown as Window & typeof globalThis;
  const context = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  };
  globalThis.document = Object.assign(new EventTarget(), {
    createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,dGVzdA==' }),
  }) as unknown as Document;
  const input = new InputSystem(app as pc.Application);
  app.fire(VolcanicEvent.STATUS_CHANGED, front.getStatus());
  const key = (type: string, code: string, value: string) => keyboard.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, key: value, repeat: false }));
  let saved: FieldPhoto | undefined;
  let shutter = 0;
  let shutterOrigin = new pc.Vec3();
  app.on(VolcanicEvent.FIELD_PHOTO, (photo: FieldPhoto) => { saved = photo; });
  app.on(PlayerEvent.EVA_CAMERA_SHUTTER, () => {
    shutter++;
    shutterOrigin = app.root.findByName('EVA · origem óptica da fotografia')!.getPosition().clone();
  });
  try {
    for (let frame = 0; frame < 3; frame++) app.fire('update', 1 / 60);
    assert.equal(front.getStatus().targetDistance, 0);
    key('keydown', '', 'C');
    assert.equal(front.getStatus().fieldActionActive, true);
    let readerStubbed = false;
    for (let frame = 0; frame < 160 && front.getStatus().completedCheckpoints === 0; frame++) {
      app.fire('update', 1 / 60);
      app.fire('postupdate', 1 / 60);
      const photoCamera = (scene as unknown as { camera?: FieldCamera }).camera;
      if (photoCamera && !readerStubbed) {
        const internal = photoCamera as unknown as { texture: pc.Texture };
        // Somente a fronteira da GPU é substituída; teclado, pose, mira e missão são reais.
        t.mock.method(internal.texture, 'read', async () => new Uint8Array(640 * 400 * 4));
        readerStubbed = true;
      }
      app.fire('postrender');
      await Promise.resolve();
    }
    assert.equal(front.getStatus().completedCheckpoints, 1);
    assert.ok(saved);
    assert.equal(saved.source, 'eva');
    assert.equal(saved.framingValidated, true);
    assert.equal(shutter, 1);
    const root = app.root.findByName('ExplorerAstronaut') as pc.Entity;
    const opticalOrigin = root.findByName('EVA · origem óptica da fotografia');
    assert.ok(opticalOrigin);
    const renderedCamera = app.root.findByName('FieldSurveyCamera') as pc.Entity;
    assert.ok(renderedCamera.getPosition().distance(shutterOrigin) < 0.1);
  } finally {
    input.destroy(); scene.destroy(); front.destroy(); walker.destroy(); player.destroy(); camera.destroy(); app.destroy();
    globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});
