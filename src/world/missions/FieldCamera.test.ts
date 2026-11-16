import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { FieldCamera } from './FieldCamera.ts';
import { PlayerEvent, VolcanicEvent, type FieldPhoto, type FieldPhotoError } from '../../systems/events/worldEvents.ts';

test('photo renderer uses the optical pose, saves flipped pixels with capture identity, and reports read failures', async t => {
  const canvas = { id: 'photo-readback', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.CameraComponentSystem];
  app.init(options);
  const photoCamera = new FieldCamera(app as pc.Application);
  const internal = photoCamera as unknown as { camera: pc.Entity; texture: pc.Texture };
  const previousDocument = globalThis.document;
  let firstPixel = 0;
  const context = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => { firstPixel = image.data[0]; },
  };
  globalThis.document = Object.assign(new EventTarget(), { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/jpeg;base64,dGVzdA==' }) }) as unknown as Document;
  const pixels = new Uint8Array(640 * 400 * 4);
  pixels[0] = 10;
  pixels[(400 - 1) * 640 * 4] = 220;
  const reader = t.mock.method(internal.texture, 'read', async () => pixels);
  let shutter = 0;
  app.on(PlayerEvent.EVA_CAMERA_SHUTTER, () => shutter++);
  try {
    const saved = new Promise<FieldPhoto>(resolve => app.once(VolcanicEvent.FIELD_PHOTO, resolve));
    const origin = new pc.Vec3(10, 7, 20);
    const forward = new pc.Vec3(1, -0.2, 1).normalize();
    photoCamera.capture(new pc.Vec3(20, 5, 30), 0, origin, { captureId: 42, source: 'eva', forward });
    assert.deepEqual(internal.camera.getPosition(), origin);
    assert.ok(internal.camera.forward.dot(forward) > 0.999);
    assert.equal(shutter, 1);
    app.fire('postrender');
    const image = await saved;
    assert.equal(firstPixel, 220, 'readback is vertically flipped');
    assert.equal(image.captureId, 42);
    assert.equal(image.source, 'eva');
    assert.ok(image.image.startsWith('data:image/jpeg'));
    reader.mock.mockImplementation(async () => { throw new Error('GPU unavailable'); });
    const failed = new Promise<FieldPhotoError>(resolve => app.once(VolcanicEvent.FIELD_PHOTO_ERROR, resolve));
    photoCamera.capture(new pc.Vec3(), 1, origin, { captureId: 43, source: 'eva', forward });
    app.fire('postrender');
    const error = await failed;
    assert.equal(error.captureId, 43);
    assert.equal(error.index, 1);
  } finally {
    photoCamera.destroy(); app.destroy(); globalThis.document = previousDocument;
  }
});
