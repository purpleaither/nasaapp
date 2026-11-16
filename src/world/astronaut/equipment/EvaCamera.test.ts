import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { EvaCamera } from './EvaCamera.ts';
import { PlayerEvent, type EvaCameraQuery } from '../../../systems/events/worldEvents.ts';

function createApp() {
  const canvas = { id: 'eva-equipment', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem];
  app.init(options);
  return app;
}

test('EVA camera stays fixed to suit, models insulation, glove controls and tether, and supplies its optical frame', () => {
  const app = createApp();
  const astronaut = new pc.Entity('Astronaut', app);
  app.root.addChild(astronaut);
  const equipment = new EvaCamera(app as pc.Application, astronaut);
  const query = (): EvaCameraQuery => {
    const frame = { origin: new pc.Vec3(), forward: new pc.Vec3(), up: new pc.Vec3(), available: false };
    app.fire(PlayerEvent.EVA_CAMERA_QUERY, frame);
    return frame;
  };
  try {
    const mount = astronaut.findByName('EVA · suporte peitoral fixo') as pc.Entity;
    assert.equal(mount.parent, astronaut);
    assert.ok(mount.findByName('Jaqueta térmica isolante cinza'));
    assert.ok(mount.findByName('Disparador ampliado para luvas'));
    assert.ok(mount.findByName('Alavanca de comando ampliada'));
    assert.ok(mount.findByName('Âncora do cabo no traje'));
    assert.equal(mount.children.filter(child => child.name === 'Segmento do cabo de segurança EVA').length, 20);
    const initial = query();
    assert.equal(initial.available, true);
    assert.ok(initial.origin.y > 6 && initial.origin.y < 10);
    assert.ok(initial.forward.z > 0.99);
    astronaut.setPosition(50, 10, -20);
    astronaut.setEulerAngles(0, 90, 0);
    const moved = query();
    assert.ok(moved.origin.x > 50 && moved.origin.z < -19);
    assert.ok(moved.forward.x > 0.99);
    const target = new pc.Vec3(70, 12, -20);
    app.fire(PlayerEvent.EVA_CAMERA_AIM, { target, active: true });
    const aimed = query();
    assert.ok(mount.getLocalEulerAngles().length() < 0.001, 'chest support remains fixed while optical head tilts');
    assert.ok(new pc.Vec3().sub2(target, aimed.origin).normalize().dot(aimed.forward) > 0.999);
    const shutter = mount.findByName('Disparador ampliado para luvas') as pc.Entity;
    app.fire(PlayerEvent.EVA_CAMERA_SHUTTER);
    app.fire('postupdate', 0.01);
    assert.equal(shutter.getLocalPosition().y, 0.8);
    for (let i = 0; i < 4; i++) app.fire('postupdate', 0.1);
    assert.equal(shutter.getLocalPosition().y, 0.92);
    astronaut.enabled = false;
    assert.equal(query().available, false, 'equipment is hidden and unavailable while boarded');
  } finally {
    equipment.destroy();
    assert.equal(app.hasEvent(PlayerEvent.EVA_CAMERA_QUERY), false);
    app.destroy();
  }
});
