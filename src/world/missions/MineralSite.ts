import { buildOutcropGeometry, PHOTO_COMPOSITION, type V3 } from './outcropGeometry.ts';
import { validateOutcropPhoto } from './photoFraming.ts';
// AFLORAMENTO M01: exterior empoeirado, canto ausente e coleta articulada.

import * as pc from 'playcanvas';
import { CameraEvent, sampleHeightViaEvent, type ExtractionZone } from '../../systems/events/worldEvents.ts';

const CONTACT = new pc.Vec3(-1, 3.8, -0.65);
const OUTWARD = new pc.Vec3(0, 0, -1);
const CORE_TONES = ['#35393e', '#454b50', '#30353a', '#52565b'];
const clamp01 = (value: number) => Math.max(0, Math.min(value, 1));
const ease = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export class MineralSite {
  private readonly site: pc.Entity;
  private readonly rig: pc.Entity;
  private readonly base: pc.Entity;
  private readonly upper: pc.Entity;
  private readonly lower: pc.Entity;
  private readonly elbow: pc.Entity;
  private readonly drill: pc.Entity;
  private readonly crown: pc.Entity;
  private readonly plug: pc.Entity;
  private readonly abrasion: pc.Entity;
  private readonly chips: pc.Entity[] = [];
  private readonly dust: pc.Entity[] = [];
  private readonly sample: pc.Entity;
  private readonly tube: pc.Entity;
  private readonly lid: pc.Entity;
  private readonly materials = new Map<string, pc.StandardMaterial>();
  private readonly textures: pc.Texture[] = [];
  private active = false;

  constructor(private readonly app: pc.Application, target: ExtractionZone, private readonly walker: pc.Entity) {
    this.site = new pc.Entity('Afloramento M01', app);
    app.root.addChild(this.site);
    this.site.setPosition(target.x, sampleHeightViaEvent(app, target.x, target.z), target.z);
    this.site.setEulerAngles(0, Math.atan2(target.x, target.z) * pc.math.RAD_TO_DEG, 0);
    this.buildAccessFloor();
    this.buildOutcrop();
    const fill = new pc.Entity('Luz lateral de inspeção', app);
    this.site.addChild(fill);
    fill.setLocalPosition(11, 13, -13);
    fill.addComponent('light', {
      type: 'omni', range: 42, intensity: 0.85,
      color: new pc.Color(0.94, 0.96, 1), castShadows: false,
    });

    this.abrasion = new pc.Entity('Marca de abrasão', app);
    this.site.addChild(this.abrasion);
    this.abrasion.setLocalPosition(CONTACT);
    this.abrasion.setLocalEulerAngles(-90, 0, 0);
    this.cylinder(this.abrasion, '#595552', 1.89, 0.10);
    const rim = this.cylinder(this.abrasion, '#42474c', 1.32, 0.12);
    rim.setLocalPosition(0, 0.06, 0);
    const recess = this.cylinder(this.abrasion, '#30353a', 1.10, 0.08);
    recess.setLocalPosition(0, 0.11, 0);
    this.part(this.abrasion, 'sphere', '#3e5669', new pc.Vec3(-0.16, 0.154, -0.21),
      new pc.Vec3(0.57, 0.023, 0.25));
    this.abrasion.enabled = false;

    this.plug = this.part(this.site, 'sphere', '#ae6949', CONTACT.clone().add(new pc.Vec3(0.12, 0, 0)), new pc.Vec3(1.65, 1.25, 0.39));
    for (let i = 0; i < 5; i++) {
      const chip = this.part(this.site, 'box', i % 2 ? '#b57550' : '#62392e',
        new pc.Vec3((i - 2) * 0.53, 0.29, -0.72 - (i % 3) * 0.36), new pc.Vec3(0.45, 0.22, 0.33));
      chip.setLocalEulerAngles(22 * i, 46 * i, i * 13);
      chip.enabled = false;
      this.chips.push(chip);
    }
    for (let i = 0; i < 9; i++) {
      const grain = this.part(this.site, 'sphere', i % 3 ? '#d69a70' : '#b36d4b',
        CONTACT, new pc.Vec3(0.24, 0.24, 0.24));
      grain.enabled = false;
      this.dust.push(grain);
    }

    this.rig = new pc.Entity('Braço de coleta M01', app);
    walker.addChild(this.rig);
    this.base = this.part(this.rig, 'cylinder', '#726454', new pc.Vec3(4.7, 4.6, -1.5), new pc.Vec3(3.4, 1.6, 3.4));
    this.upper = this.cylinder(this.rig, '#a7acad', 1.03, 1);
    this.lower = this.cylinder(this.rig, '#6d7a80', 0.8, 1);
    this.elbow = this.part(this.rig, 'sphere', '#ae784e', pc.Vec3.ZERO, new pc.Vec3(2.2, 2.2, 2.2));
    this.drill = new pc.Entity('Cabeça da broca', app);
    this.rig.addChild(this.drill);
    this.part(this.drill, 'cylinder', '#52616a', new pc.Vec3(0, 0.77, 0), new pc.Vec3(2.1, 2.25, 2.1));
    this.crown = new pc.Entity('Coroa de perfuração', app);
    this.drill.addChild(this.crown);
    this.part(this.crown, 'cylinder', '#a6683e', new pc.Vec3(0, -0.61, 0), new pc.Vec3(1.49, 1.4, 1.49));
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const tooth = this.part(this.crown, 'box', i % 2 ? '#edc38a' : '#75492e',
        new pc.Vec3(Math.sin(angle) * 0.6, -1.35, Math.cos(angle) * 0.6), new pc.Vec3(0.35, 0.45, 0.26));
      tooth.setLocalEulerAngles(0, i * 60, 0);
    }

    this.tube = new pc.Entity('Tubo M01', app);
    this.rig.addChild(this.tube);
    this.tube.setLocalPosition(6.8, 5.5, 1.75);
    this.part(this.rig, 'box', '#4b5659', new pc.Vec3(6.8, 4.42, 1.75), new pc.Vec3(2.25, 0.8, 2.6));
    this.cylinder(this.tube, '#c3caca', 1.28, 2.05);
    this.part(this.tube, 'cylinder', '#253034', new pc.Vec3(0, 1.08, 0), new pc.Vec3(1.12, 0.08, 1.12));
    this.part(this.tube, 'cylinder', '#ce8e51', new pc.Vec3(0, -0.46, 0), new pc.Vec3(1.34, 0.48, 1.34));
    this.lid = this.part(this.tube, 'cylinder', '#e7dbbc', new pc.Vec3(0.92, 1.67, 0), new pc.Vec3(1.36, 0.3, 1.36));
    this.labelTube();

    this.sample = new pc.Entity('Testemunho de rocha M01', app);
    app.root.addChild(this.sample);
    for (let i = 0; i < 4; i++) {
      const strip = this.part(this.sample, 'cylinder', CORE_TONES[i], new pc.Vec3(0, (i - 1.5) * 0.31, 0),
        new pc.Vec3(0.71 - (i % 2) * 0.06, 0.35, 0.69));
      strip.setLocalEulerAngles(0, i * 11, (i - 1) * 4);
    }
    this.sample.enabled = false;
    this.stow();
  }

  private material(color: string): pc.StandardMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new pc.StandardMaterial();
      material.diffuse = new pc.Color().fromString(color);
      material.gloss = 0.28;
      material.update();
      this.materials.set(color, material);
    }
    return material;
  }

  private part(parent: pc.Entity, type: 'box' | 'sphere' | 'cylinder' | 'plane', color: string,
    position: pc.Vec3, scale: pc.Vec3, material = this.material(color)): pc.Entity {
    const entity = new pc.Entity(type, this.app);
    entity.addComponent('render', { type, material, castShadows: false, receiveShadows: true });
    parent.addChild(entity);
    entity.setLocalPosition(position);
    entity.setLocalScale(scale);
    return entity;
  }

  private cylinder(parent: pc.Entity, color: string, diameter: number, length: number): pc.Entity {
    return this.part(parent, 'cylinder', color, pc.Vec3.ZERO, new pc.Vec3(diameter, length, diameter));
  }

  private labelTube(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#1f292b';
    context.fillRect(0, 0, 128, 64);
    context.fillStyle = '#fff0cd';
    context.font = 'bold 48px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('M01', 64, 32);
    const texture = new pc.Texture(this.app.graphicsDevice, { mipmaps: false });
    texture.setSource(canvas);
    this.textures.push(texture);
    const material = this.material('#1f292b');
    material.emissive.set(0.8, 0.8, 0.8);
    material.emissiveMap = texture;
    material.update();
    for (const side of [-1, 1]) {
      this.part(this.tube, 'plane', '#1f292b', new pc.Vec3(side * 0.67, 0.29, 0), new pc.Vec3(1.2, 1, 0.65), material)
        .setLocalEulerAngles(0, 0, -side * 90);
    }
  }

  // MISSÕES: Película baixa de poeira sobre a malha do terreno, sem anel de objetivo.
  private buildAccessFloor(): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const width = 14;
    const rows = 8;
    const columns = 8;
    const transform = this.site.getWorldTransform();
    const baseY = this.site.getPosition().y;
    for (let row = 0; row <= rows; row++) {
      const z = -36 + row * 4.5;
      for (let col = 0; col <= columns; col++) {
        const side = (col / columns * 2 - 1);
        const x = side * (width + Math.sin(row * 1.57) * 1.8);
        const position = transform.transformPoint(new pc.Vec3(x, 0, z));
        positions.push(x, sampleHeightViaEvent(this.app, position.x, position.z) - baseY + 0.22, z);
        const alpha = Math.sin(Math.PI * row / rows) * (1 - Math.abs(side)) * 0.57;
        const tint = 0.78 + 0.17 * Math.sin(col * 2.13 + row * 1.23);
        colors.push(0.61 * tint, 0.40 * tint, 0.30 * tint, alpha);
        if (row < rows && col < columns) {
          const a = row * (columns + 1) + col;
          indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
        }
      }
    }
    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(pc.calculateNormals(positions, indices));
    mesh.setColors(colors);
    mesh.setIndices(indices);
    mesh.update();
    const material = this.material('#fffefd');
    material.diffuseVertexColor = true;
    material.opacityVertexColor = true;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.update();
    const access = new pc.Entity('Solo compacto de aproximação', this.app);
    this.site.addChild(access);
    access.addComponent('render', {
      meshInstances: [new pc.MeshInstance(mesh, material, access)],
      castShadows: false, receiveShadows: true,
    });
  }

  private buildOutcrop(): void {
    const geometry = buildOutcropGeometry();
    // Mesmo material mineral fosco; cobertura de poeira codificada por vértice.
    const material = this.material('#ffffff');
    material.diffuseVertexColor = true;
    material.useMetalness = true; material.metalness = 0; material.gloss = 0.025;
    material.emissive.set(0, 0, 0);
    const size = 128;
    const normal = new pc.Texture(this.app.graphicsDevice, { width: size, height: size, mipmaps: true, name: 'Grão mineral fino compartilhado', format: pc.PIXELFORMAT_RGBA8 });
    const pixels = normal.lock();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const n = Math.sin(x * 1.77 + Math.cos(y * 2.21)) * Math.cos(y * 1.31 - x * 0.61);
      const offset = (y * size + x) * 4;
      pixels[offset] = 128 + Math.round(n * 22); pixels[offset + 1] = 128 + Math.round(Math.cos(x * 2.3 + y * 1.7) * 22);
      pixels[offset + 2] = 250; pixels[offset + 3] = 255;
    }
    normal.unlock(); this.textures.push(normal); material.normalMap = normal; material.bumpiness = 0.38;
    const chunks = material.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
    chunks.set('diffusePS', `
      uniform vec3 material_diffuse;
      void getAlbedo() {
        float grain = fract(sin(dot(floor(vPositionW.xyz * 18.0), vec3(12.9898,78.233,43.53))) * 43758.5453);
        dAlbedo = material_diffuse * vVertexColor.rgb * (0.92 + 0.14 * grain);
      }
    `);
    material.shaderChunksVersion = '2.24'; material.update();
    for (const [name, data] of [['Exterior avermelhado desgastado', geometry.exterior], ['Canto ausente · face de ruptura basáltica', geometry.fracture]] as const) {
      const mesh = new pc.Mesh(this.app.graphicsDevice);
      mesh.setPositions(data.positions); mesh.setNormals(pc.calculateNormals(data.positions, data.indices));
      mesh.setColors(data.colors); mesh.setUvs(0, data.uvs); mesh.setIndices(data.indices); mesh.update();
      const entity = new pc.Entity(name, this.app); this.site.addChild(entity);
      entity.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material, entity)], castShadows: true, receiveShadows: true });
    }
  }

  private link(entity: pc.Entity, a: pc.Vec3, b: pc.Vec3, width: number): void {
    const length = a.distance(b);
    entity.setPosition(new pc.Vec3().lerp(a, b, 0.5));
    const direction = new pc.Vec3().sub2(b, a).normalize();
    entity.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, direction));
    entity.setLocalScale(width, Math.max(0.1, length), width);
  }

  private pose(tip: pc.Vec3, axis: pc.Vec3): void {
    const base = this.base.getPosition();
    const elbow = new pc.Vec3().lerp(base, tip, 0.47);
    elbow.y += 3.2;
    this.elbow.setPosition(elbow);
    this.link(this.upper, base, elbow, 1.03);
    this.link(this.lower, elbow, tip, 0.8);
    this.drill.setPosition(tip);
    this.drill.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, axis));
  }

  private stow(): void {
    const parked = this.walker.getWorldTransform().transformPoint(new pc.Vec3(7.4, 5.2, -3.6));
    this.pose(parked, pc.Vec3.UP);
  }

  // Uma composição mostra exterior, canto ausente e fratura no mesmo enquadramento.
  public observation() {
    const transform = this.site.getWorldTransform();
    return { focus: transform.transformPoint(new pc.Vec3(...PHOTO_COMPOSITION.focus)), eye: transform.transformPoint(new pc.Vec3(...PHOTO_COMPOSITION.eye)) };
  }

  public validatePhoto(frame: { origin: pc.Vec3; forward: pc.Vec3; up: pc.Vec3 }) {
    const inverse = this.site.getWorldTransform().clone().invert();
    const tuple = (v: pc.Vec3): V3 => [v.x, v.y, v.z];
    return validateOutcropPhoto({ origin: tuple(inverse.transformPoint(frame.origin)), forward: tuple(inverse.transformVector(frame.forward).normalize()), up: tuple(inverse.transformVector(frame.up).normalize()) });
  }

  public animate(progress: number): void {
    const contact = this.site.getWorldTransform().transformPoint(CONTACT);
    const normal = this.site.getRotation().transformVector(OUTWARD);
    const start = this.walker.getWorldTransform().transformPoint(new pc.Vec3(7.4, 5.2, -3.6));
    const bore = contact.clone().add(normal.clone().mulScalar(1.47));
    const withdrawn = contact.clone().add(normal.clone().mulScalar(4.8));
    const mouth = this.tube.getWorldTransform().transformPoint(new pc.Vec3(0, 1.1, 0));
    const aboveTube = mouth.clone().add(new pc.Vec3(0, 2.1, 0));
    const tip = new pc.Vec3();
    let axis = normal;
    if (progress < 0.24) {
      const reach = ease(progress / 0.24);
      tip.lerp(start, contact.clone().add(normal.clone().mulScalar(3.2)), reach);
      axis = new pc.Vec3().lerp(pc.Vec3.UP, normal, reach).normalize();
    } else if (progress < 0.51) {
      tip.lerp(contact.clone().add(normal.clone().mulScalar(3.2)), bore, ease((progress - 0.24) / 0.14));
    } else if (progress < 0.66) {
      tip.lerp(bore, withdrawn, ease((progress - 0.51) / 0.15));
    } else if (progress < 0.88) {
      const transfer = ease((progress - 0.66) / 0.14);
      tip.lerp(withdrawn, aboveTube, transfer);
      tip.y += Math.sin(transfer * Math.PI) * 3;
      axis = new pc.Vec3().lerp(normal, pc.Vec3.UP, transfer).normalize();
    } else {
      axis = pc.Vec3.UP;
      tip.lerp(aboveTube, start, ease((progress - 0.88) / 0.12));
    }
    this.pose(tip, axis);
    this.crown.setLocalEulerAngles(0, clamp01((progress - 0.24) / 0.27) * 1730, 0);

    const drilled = progress >= 0.51;
    this.plug.enabled = !drilled;
    this.abrasion.enabled = drilled;
    for (const chip of this.chips) chip.enabled = drilled;
    for (const [i, grain] of this.dust.entries()) {
      const t = clamp01((progress - 0.3) / 0.24);
      grain.enabled = progress > 0.30 && progress < 0.54;
      grain.setLocalPosition((i - 4) * t * 0.39, CONTACT.y + Math.sin(t * Math.PI) * (i % 3 + 1) * 0.31 - t * 2.3, -0.2 - t * (0.9 + i % 4));
    }

    this.sample.enabled = drilled && progress < 0.86;
    if (this.sample.enabled) {
      const insertion = ease((progress - 0.8) / 0.06);
      const retained = tip.clone().sub(axis.clone().mulScalar(1.42));
      this.sample.setPosition(retained.lerp(retained, mouth.clone().add(new pc.Vec3(0, -1.3, 0)), insertion));
      this.sample.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP, axis));
    }
    const seal = ease((progress - 0.86) / 0.02);
    this.lid.setLocalPosition(0.92 * (1 - seal), 1.67 - seal * 0.51, 0);

    this.active = true;
    const focus = new pc.Vec3().lerp(contact, mouth, 0.43);
    focus.y += 1;
    const side = this.site.getRotation().transformVector(new pc.Vec3(1, 0, 0));
    const eye = focus.clone().add(side.mulScalar(23)).add(normal.mulScalar(12));
    eye.y += 8.5;
    this.app.fire(CameraEvent.FIELD_FRAME, { eye, focus });
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    this.sample.enabled = false;
    for (const grain of this.dust) grain.enabled = false;
    this.app.fire(CameraEvent.FIELD_FRAME);
    this.stow();
  }

  public endMission(): void {
    this.stop();
    this.rig.enabled = false;
  }

  public destroy(): void {
    this.stop();
    this.rig.destroy();
    this.site.destroy();
    this.sample.destroy();
    for (const material of this.materials.values()) material.destroy();
    for (const texture of this.textures) texture.destroy();
  }
}
