import type { AppBase, GraphicsDevice, Vec3 } from 'playcanvas';
import {
  ADDRESS_CLAMP_TO_EDGE,
  BLEND_ADDITIVE,
  Color,
  CULLFACE_NONE,
  Entity,
  FILTER_LINEAR,
  Mesh,
  MeshInstance,
  PIXELFORMAT_RGBA8,
  StandardMaterial,
  Texture,
} from 'playcanvas';

export class SunElement extends Entity {
  private readonly sunMat: StandardMaterial;
  private readonly coronaMat: StandardMaterial;
  private readonly sphere: Entity;
  private readonly corona: Entity;
  private readonly lightNode: Entity;

  constructor(app: AppBase, isHeadless = false) {
    super('SunElement', app);

    this.lightNode = new Entity('SunDirectionalLight', app);
    this.lightNode.addComponent('light', {
      type: 'directional',
      color: new Color(1.0, 0.86, 0.74),
      intensity: 1.22,
      castShadows: !isHeadless,
      shadowDistance: 1200,
      shadowResolution: isHeadless ? 512 : 2048,
      shadowBias: 0.12,
      normalOffsetBias: 0.1,
    });
    this.lightNode.setEulerAngles(44, 38, 0);
    this.addChild(this.lightNode);

    this.sunMat = new StandardMaterial();
    this.sunMat.diffuse.set(1, 1, 1);
    this.sunMat.emissive.set(1, 0.96, 0.88);
    this.sunMat.emissiveIntensity = 4.0;
    this.sunMat.useFog = false;
    this.sunMat.update();

    this.sphere = new Entity('SunSphere', app);
    this.sphere.addComponent('render', {
      type: 'sphere',
      material: this.sunMat,
      castShadows: false,
      receiveShadows: false,
    });
    this.sphere.setLocalScale(170, 170, 170);
    this.addChild(this.sphere);

    this.coronaMat = new StandardMaterial();
    this.coronaMat.diffuse.set(0, 0, 0);
    this.coronaMat.emissive.set(1, 0.96, 0.88);
    this.coronaMat.emissiveMap = this.createTexture(app.graphicsDevice);
    this.coronaMat.emissiveIntensity = 0.42;
    this.coronaMat.blendType = BLEND_ADDITIVE;
    this.coronaMat.cull = CULLFACE_NONE;
    this.coronaMat.depthWrite = false;
    this.coronaMat.useLighting = false;
    this.coronaMat.useFog = false;
    this.coronaMat.update();

    const s = 290;
    const mesh = new Mesh(app.graphicsDevice);
    mesh.setPositions([-s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0]);
    mesh.setNormals([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    mesh.setUvs(0, [0, 0, 1, 0, 1, 1, 0, 1]);
    mesh.setIndices([0, 1, 2, 0, 2, 3]);
    mesh.update();

    this.corona = new Entity('SunCorona', app);
    this.corona.addComponent('render', { type: 'asset', castShadows: false, receiveShadows: false });
    if (this.corona.render) {
      this.corona.render.meshInstances = [new MeshInstance(mesh, this.coronaMat, this.corona)];
    }
    this.addChild(this.corona);
  }

  private createTexture(device: GraphicsDevice): Texture {
    const size = 64;
    const tex = new Texture(device, {
      width: size,
      height: size,
      format: PIXELFORMAT_RGBA8,
      mipmaps: false,
      minFilter: FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
    });
    const pixels = tex.lock();
    const half = (size - 1) / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const norm = Math.hypot(x - half, y - half) / (size * 0.46);
        const v = norm < 1 ? Math.floor(Math.pow(1 - norm, 2.8) * 255) : 0;
        const i = (y * size + x) * 4;
        pixels[i] = v;
        pixels[i + 1] = v;
        pixels[i + 2] = v;
        pixels[i + 3] = 255;
      }
    }
    tex.unlock();
    return tex;
  }

  public update(
    sunPos: Vec3,
    camPos: Vec3,
    color: Color,
    lightIntensity: number,
    normalizedTime = 0.5
  ): void {
    this.setPosition(sunPos);
    this.lookAt(camPos);
    this.corona.lookAt(camPos);

    if (this.lightNode.light) {
      this.lightNode.light.color.copy(color);
      // Respect the actual phase intensity (so night is genuinely dark at 0.24 and day is a balanced 1.22)
      this.lightNode.light.intensity = lightIntensity;
      this.lightNode.light.enabled = lightIntensity > 0.01;

      // Smoothly sweep light angle without sudden 180-degree atan2 flips at noon/dawn
      const elevation = 34 + Math.sin(normalizedTime * Math.PI * 2 - Math.PI / 2) * 14;
      const azimuth = 38 + Math.cos(normalizedTime * Math.PI * 2) * 28;
      this.lightNode.setEulerAngles(elevation, azimuth, 0);
    }

    const relY = sunPos.y - camPos.y;
    const fade = Math.max(0, Math.min(1, (relY + 300) / 700));
    const isVisualVisible = fade > 0.001;
    this.sphere.enabled = isVisualVisible;
    this.corona.enabled = isVisualVisible;

    if (isVisualVisible) {
      this.sunMat.emissive.copy(color);
      this.sunMat.emissiveIntensity = fade * 4.2;
      this.sunMat.update();

      this.coronaMat.emissive.copy(color);
      this.coronaMat.emissiveIntensity = fade * 0.42;
      this.coronaMat.update();
    }
  }
}
