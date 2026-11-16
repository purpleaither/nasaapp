// ASTRONAUTA — câmera de EVA presa ao peito: jaqueta térmica, controles para luvas e tether.
import * as pc from 'playcanvas';
import { ASTRONAUT_CONFIG } from '../config.ts';
import { PlayerEvent, type EvaCameraAim, type EvaCameraQuery } from '../../../systems/events/worldEvents.ts';

export class EvaCamera {
  private readonly mount: pc.Entity;
  private readonly body: pc.Entity;
  private buildParent: pc.Entity;
  private readonly tetherAnchor: pc.Entity;
  private readonly tetherSegments: pc.Entity[] = [];
  private readonly lens: pc.Entity;
  private readonly shutter: pc.Entity;
  private readonly lamp: pc.Entity;
  private readonly materials: pc.StandardMaterial[] = [];
  private chest: pc.GraphNode | null = null;
  private aim: pc.Vec3 | null = null;
  private shutterTime = 0;
  private destroyed = false;
  private readonly scale = ASTRONAUT_CONFIG.modelScale / 300;

  constructor(private readonly app: pc.Application, private readonly astronaut: pc.Entity) {
    this.mount = new pc.Entity('EVA · suporte peitoral fixo', app);
    astronaut.addChild(this.mount);
    this.buildParent = this.mount;
    this.body = new pc.Entity('Berço articulado da câmera EVA', app);
    this.mount.addChild(this.body);
    this.mount.setLocalScale(this.scale, this.scale, this.scale);
    const cover = this.material('#adb4b8', 0.02);
    const foil = this.material('#86939b', 0.4);
    const seam = this.material('#647178', 0.05);
    const dark = this.material('#202b33', 0.3);
    const red = this.material('#ee523e', 0.03);
    const gold = this.material('#efc35b', 0.1);
    const glass = this.material('#266b86', 0.5, true);
    const green = this.material('#65ffb3', 0.05, true);

    // #region EVA — suporte no peito e jaqueta isolante cinza/prateada
    this.box('Placa de fixação ao traje', foil, [0, 0, -0.68], [2.65, 1.9, 0.22]);
    for (const side of [-1, 1]) {
      this.box('Trilho peitoral rígido', dark, [side * 1.05, 0, -0.52], [0.17, 2.15, 0.24]);
      this.box('Trava do suporte', gold, [side * 1.24, -0.57, -0.36], [0.34, 0.36, 0.34]);
      for (const y of [-0.72, 0.72]) this.part('Parafuso do suporte', 'sphere', dark, [side * 1.18, y, -0.49], [0.15, 0.15, 0.13]);
    }
    this.buildParent = this.body;
    this.box('Jaqueta térmica isolante cinza', cover, [0, 0, 0], [2.2, 1.5, 1.28]);
    this.box('Aba térmica superior', foil, [0, 0.79, 0.05], [2.27, 0.13, 1.37]);
    this.box('Aba térmica inferior', foil, [0, -0.78, 0], [2.27, 0.12, 1.31]);
    for (const x of [-0.72, 0, 0.72]) this.box('Costura da capa térmica', seam, [x, 0, 0.648], [0.022, 1.35, 0.015]);
    for (const side of [-1, 1]) {
      this.box('Faixa de isolamento lateral', foil, [side * 1.12, 0, 0], [0.1, 1.3, 1.18]);
      this.box('Reforço térmico', cover, [side * 0.82, 0.36, 0.69], [0.43, 0.53, 0.13]);
    }
    // #endregion

    // #region EVA — lente protegida e comandos ampliados para luvas pressurizadas
    this.barrel('Anel de proteção da objetiva', foil, 0.48, 1.37, 0.35);
    this.barrel('Objetiva da câmera EVA', dark, 0.93, 1.13, 0.78);
    this.barrel('Anel de foco ampliado', gold, 1.08, 1.23, 0.17);
    this.barrel('Vidro da objetiva', glass, 1.39, 0.89, 0.08);
    this.shutter = this.box('Disparador ampliado para luvas', red, [0.76, 0.92, 0.16], [0.57, 0.23, 0.65]);
    this.box('Guarda do disparador', foil, [0.76, 0.79, -0.33], [0.75, 0.3, 0.16]);
    this.box('Alavanca de comando ampliada', gold, [-1.17, 0.3, 0.25], [0.25, 0.75, 0.31]);
    this.lamp = this.part('Indicador de registro EVA', 'sphere', green, [0.87, -0.42, 0.73], [0.19, 0.19, 0.12]);
    this.box('Identificação EVA', dark, [-0.76, -0.43, 0.705], [0.45, 0.21, 0.06]);
    this.lens = new pc.Entity('EVA · origem óptica da fotografia', app);
    this.body.addChild(this.lens);
    this.lens.setLocalPosition(0, 0, 1.72);
    // #endregion

    // #region EVA — cabo de segurança curvo, ancorado na câmera e no traje
    const a = new pc.Vec3(-1.15, -0.55, -0.12);
    const b = new pc.Vec3(-1.8, -2.4, 0.4);
    const c = new pc.Vec3(1.65, -1.45, -1.1);
    this.tetherAnchor = new pc.Entity('Fixação do cabo na câmera', app);
    this.body.addChild(this.tetherAnchor);
    this.tetherAnchor.setLocalPosition(a);
    this.buildParent = this.mount;
    let last = a;
    for (let i = 1; i <= 20; i++) {
      const t = i / 20;
      const next = new pc.Vec3(
        (1 - t) ** 2 * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
        (1 - t) ** 2 * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
        (1 - t) ** 2 * a.z + 2 * (1 - t) * t * b.z + t * t * c.z,
      );
      this.cable(last, next, i % 2 ? gold : dark);
      last = next;
    }
    this.buildParent = this.body;
    this.part('Mosquetão na câmera', 'sphere', red, [a.x, a.y, a.z], [0.24, 0.31, 0.21]);
    this.buildParent = this.mount;
    this.box('Âncora do cabo no traje', foil, [c.x, c.y, c.z], [0.42, 0.42, 0.18]);
    // #endregion
    app.on(PlayerEvent.EVA_CAMERA_AIM, this.onAim, this);
    app.on(PlayerEvent.EVA_CAMERA_QUERY, this.onQuery, this);
    app.on(PlayerEvent.EVA_CAMERA_SHUTTER, this.onShutter, this);
    app.on('postupdate', this.update, this);
    this.update(0);
  }

  public bindToModel(model: pc.Entity): void {
    this.chest = model.findByName('mixamorig:Spine2') ?? model.findByName('mixamorig:Spine1');
    this.update(0);
  }

  private material(hex: string, metalness: number, glow = false): pc.StandardMaterial {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color().fromString(hex);
    material.metalness = metalness;
    material.useMetalness = true;
    material.gloss = 0.35;
    if (glow) material.emissive.copy(material.diffuse).mulScalar(0.35);
    material.update();
    this.materials.push(material);
    return material;
  }

  private part(name: string, type: 'box' | 'cylinder' | 'sphere', material: pc.StandardMaterial,
    position: number[], scale: number[]): pc.Entity {
    const entity = new pc.Entity(name, this.app);
    entity.addComponent('render', { type, material, castShadows: false, receiveShadows: true });
    this.buildParent.addChild(entity);
    entity.setLocalPosition(position[0], position[1], position[2]);
    entity.setLocalScale(scale[0], scale[1], scale[2]);
    return entity;
  }

  private box(name: string, material: pc.StandardMaterial, position: number[], scale: number[]): pc.Entity {
    return this.part(name, 'box', material, position, scale);
  }

  private barrel(name: string, material: pc.StandardMaterial, z: number, diameter: number, length: number): void {
    this.part(name, 'cylinder', material, [0, 0, z], [diameter, length, diameter]).setLocalEulerAngles(90, 0, 0);
  }

  private cable(a: pc.Vec3, b: pc.Vec3, material: pc.StandardMaterial): void {
    const segment = this.part('Segmento do cabo de segurança EVA', 'cylinder', material, [0, 0, 0], [1, 1, 1]);
    this.tetherSegments.push(segment);
    segment.setLocalPosition(new pc.Vec3().lerp(a, b, 0.5));
    segment.setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, new pc.Vec3().sub2(b, a).normalize()));
    segment.setLocalScale(0.075, a.distance(b) + 0.01, 0.075);
  }

  private onAim(payload?: EvaCameraAim): void {
    this.aim = payload?.active ? new pc.Vec3(payload.target.x, payload.target.y, payload.target.z) : null;
    this.update(0);
  }

  private onShutter(): void { this.shutterTime = 0.22; }

  private update(dt: number): void {
    if (this.destroyed) return;
    const anchor = new pc.Vec3(0, 7.4 * this.scale, 0);
    if (this.chest) {
      this.astronaut.getWorldTransform().clone().invert().transformPoint(this.chest.getPosition(), anchor);
    }
    this.mount.setLocalPosition(anchor.x, anchor.y, anchor.z + 1.6 * this.scale);
    let pitch = 0;
    if (this.aim) {
      const at = this.mount.getPosition();
      pitch = -Math.atan2(this.aim.y - at.y, Math.hypot(this.aim.x - at.x, this.aim.z - at.z)) * pc.math.RAD_TO_DEG;
    }
    this.body.setLocalEulerAngles(pc.math.clamp(pitch, -55, 55), 0, 0);
    // O suporte e a âncora do traje não giram; o cabo acompanha só a cabeça articulada.
    const start = this.mount.getWorldTransform().clone().invert().transformPoint(this.tetherAnchor.getPosition());
    const control = new pc.Vec3(-1.8, -2.4, 0.4);
    const end = new pc.Vec3(1.65, -1.45, -1.1);
    let previous = start;
    for (const [index, segment] of this.tetherSegments.entries()) {
      const t = (index + 1) / this.tetherSegments.length;
      const point = new pc.Vec3(
        (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t * t * end.x,
        (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t * t * end.y,
        (1 - t) ** 2 * start.z + 2 * (1 - t) * t * control.z + t * t * end.z,
      );
      segment.setLocalPosition(new pc.Vec3().lerp(previous, point, 0.5));
      segment.setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, new pc.Vec3().sub2(point, previous).normalize()));
      segment.setLocalScale(0.075, previous.distance(point) + 0.01, 0.075);
      previous = point;
    }
    this.shutterTime = Math.max(0, this.shutterTime - Math.min(dt, 0.1));
    this.shutter.setLocalPosition(0.76, this.shutterTime > 0 ? 0.8 : 0.92, 0.16);
    this.lamp.setLocalScale(this.shutterTime > 0 ? 0.3 : 0.19, this.shutterTime > 0 ? 0.3 : 0.19, 0.12);
  }

  private onQuery(query: EvaCameraQuery): void {
    this.update(0);
    query.available = !this.destroyed && this.astronaut.enabled;
    if (!query.available) return;
    query.origin.copy(this.lens.getPosition());
    this.body.getWorldTransform().transformVector(new pc.Vec3(0, 0, 1), query.forward).normalize();
    query.up.copy(this.body.up);
  }

  public destroy(): void {
    this.destroyed = true;
    this.app.off(PlayerEvent.EVA_CAMERA_AIM, this.onAim, this);
    this.app.off(PlayerEvent.EVA_CAMERA_QUERY, this.onQuery, this);
    this.app.off(PlayerEvent.EVA_CAMERA_SHUTTER, this.onShutter, this);
    this.app.off('postupdate', this.update, this);
    this.mount.destroy();
    for (const material of this.materials) material.destroy();
  }
}
