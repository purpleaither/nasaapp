// Modelos modulares e animações preparadas: nenhum vulcão ativo ou destruição planetária.
import * as pc from 'playcanvas';
import { SimulationEvent, VolcanicEvent, type VolcanicStatus, sampleHeightViaEvent } from '../../systems/events/worldEvents.ts';
import { GeologicalEvent, missionLayout, scarpBlocks, type Tremor } from './crisis.ts';

export class GeologicalScene {
  public readonly root = new pc.Entity('GeologicalMissionSector');
  private readonly basalt = this.material('#343b43', 3);
  private readonly dust = this.material('#98715a', 1);
  private readonly metal = this.material('#a5afb3', 25);
  private readonly warning = this.material('#dfbd73', 7);
  private readonly indicator = this.material('#5ce0c3', 15, true);
  private structures: pc.Entity[] = [];
  private targetKey = '';
  private shake = 0;
  private shakeStrength = 0;
  private clock = 0;
  private damaged = false;
  private readonly onStatus = (status: VolcanicStatus) => {
    // Os objetivos científicos continuam fixos, inclusive durante uma evacuação.
    const target = status.geology.routes[0].points[2];
    const key = `${target.x},${target.z}`;
    if (key !== this.targetKey) { this.targetKey = key; this.build(status); }
    if (status.geology.events.length >= 2 && !this.damaged) {
      this.damaged = true;
      const panel = this.root.findByName('RelaySolarPanel');
      panel?.setLocalEulerAngles(0, 0, 28);
      const signal = this.root.findByName('RelayOperationalIndicator');
      if (signal) signal.enabled = false;
    }
  };
  private readonly onTremor = (event: Tremor) => {
    this.shake = event.duration;
    this.shakeStrength = event.intensity;
  };
  private readonly onStep = (dt: number) => {
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt);
    for (const structure of this.structures) {
      const amplitude = this.shake > 0 ? Math.min(1, this.shake) * this.shakeStrength * 1.2 : 0;
      structure.setLocalEulerAngles(Math.sin(this.clock * 33) * amplitude, 0, Math.cos(this.clock * 29) * amplitude);
    }
  };
  constructor(private readonly app: pc.Application, private readonly headless = false) {
    this.dust.opacity = 0.24;
    this.dust.blendType = pc.BLEND_NORMAL;
    this.dust.depthWrite = false;
    this.dust.update();
    app.root.addChild(this.root);
    app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus);
    app.on(GeologicalEvent.TREMOR, this.onTremor);
    app.on(SimulationEvent.STEP, this.onStep);
  }
  private material(hex: string, shininess: number, emissive = false) {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color().fromString(hex);
    material.shininess = shininess;
    if (emissive) material.emissive.copy(material.diffuse).mulScalar(0.4);
    material.update(); return material;
  }
  private shape(name: string, type: 'box' | 'sphere' | 'cylinder' | 'cone', material: pc.StandardMaterial, parent: pc.Entity, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const entity = new pc.Entity(name);
    entity.addComponent('render', { type, material, castShadows: !this.headless, receiveShadows: !this.headless });
    entity.setLocalPosition(x, y, z); entity.setLocalScale(sx, sy, sz); parent.addChild(entity); return entity;
  }
  private build(status: VolcanicStatus) {
    for (const child of [...this.root.children]) child.destroy();
    this.structures = []; this.damaged = false;
    const target = status.geology.routes[0].points[2];
    const layout = missionLayout(target);
    const scarp = scarpBlocks(target);
    // Escarpa pré-existente, sem blocos em queda.
    for (const [i, block] of scarp.entries()) {
      const y = sampleHeightViaEvent(this.app, block.x, block.z);
      this.shape(`AncientScarp_${i}`, 'box', this.basalt, this.root, block.x, y + 5, block.z, 15, 20, 15).setLocalEulerAngles(-8, i * 13, 5);
    }
    // A base habitacional é uma instalação fixa própria; aqui fica apenas a retirada.
    const structure = new pc.Entity('ExtractionBeacon');
    const point = status.extraction;
    structure.setLocalPosition(point.x, sampleHeightViaEvent(this.app, point.x, point.z), point.z);
    this.root.addChild(structure); this.structures.push(structure);
    this.shape('Retirada técnica', 'box', this.metal, structure, 0, 4, 0, 18, 8, 11);
    this.shape('Mast', 'cylinder', this.metal, structure, -7, 10, 0, .7, 18, .7);
    this.shape('ExtractionSignal', 'sphere', this.indicator, structure, -7, 19, 0, 1.8, 1.8, 1.8);
    // Balizas geométricas distinguem rotas e a área de queda sem depender só de cor.
    for (const route of status.geology.routes) {
      const point = route.points[1];
      for (const side of [-1, 1]) {
        const x = point.x + side * 45, z = point.z;
        const y = sampleHeightViaEvent(this.app, x, z);
        this.shape('RouteStake', 'cylinder', this.metal, this.root, x, y + 3, z, 0.5, 6, 0.5);
        this.shape(route.id === 'direct' ? 'ScarpWarningTriangle' : 'DetourMarker', route.id === 'direct' ? 'cone' : 'box', this.warning, this.root, x, y + 7, z, 4, 3, 0.8);
      }
    }
    // Blocos basálticos baixos: contraste de materiais sem obstruir objetivos ou saídas.
    for (let i = 0; i < 30; i++) {
      const angle = i * 2.39996, r = 65 + i * 5;
      const x = target.x + Math.sin(angle) * r, z = target.z + Math.cos(angle) * r;
      const y = sampleHeightViaEvent(this.app, x, z);
      this.shape(`AncientBasaltBlock_${i}`, 'box', this.basalt, this.root, x, y + 0.4, z, 3 + i % 4, 1.2, 3).setLocalEulerAngles(7, i * 31, 6);
    }
  }
  public destroy() {
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus);
    this.app.off(GeologicalEvent.TREMOR, this.onTremor);
    this.app.off(SimulationEvent.STEP, this.onStep);
    this.root.destroy();
    for (const m of [this.basalt, this.dust, this.metal, this.warning, this.indicator]) m.destroy();
  }
}
