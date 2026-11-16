import type { AppBase, GraphicsDevice } from 'playcanvas';
import {
  BLEND_ADDITIVEALPHA,
  Color,
  CULLFACE_NONE,
  Entity,
  FILTER_LINEAR,
  FILTER_LINEAR_MIPMAP_LINEAR,
  Mesh,
  MeshInstance,
  PIXELFORMAT_RGBA8,
  StandardMaterial,
  Texture,
  Vec3,
} from 'playcanvas';

export class StarsElement extends Entity {
  private material: StandardMaterial;

  constructor(app: AppBase, count = 5200) {
    super('StarsElement', app);

    const starTexture = this.createStarGlowTexture(app.graphicsDevice);

    this.material = new StandardMaterial();
    this.material.diffuse = new Color(0, 0, 0);
    this.material.emissive = new Color(1, 1, 1);
    this.material.emissiveMap = starTexture;
    this.material.opacityMap = starTexture;
    this.material.opacityMapChannel = 'a';
    this.material.diffuseVertexColor = false;
    this.material.emissiveVertexColor = true;
    this.material.emissiveIntensity = 9.0;
    this.material.blendType = BLEND_ADDITIVEALPHA;
    this.material.cull = CULLFACE_NONE;
    this.material.depthWrite = false;
    this.material.useLighting = false;
    this.material.useFog = false;
    this.material.update();

    const mesh = this.buildStarfieldMesh(app.graphicsDevice, count);
    const meshInstance = new MeshInstance(mesh, this.material, this);

    this.addComponent('render', {
      type: 'asset',
      castShadows: false,
      receiveShadows: false,
    });

    if (this.render) {
      this.render.meshInstances = [meshInstance];
    }
  }

  private createStarGlowTexture(graphicsDevice: GraphicsDevice): Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;
      const center = (size - 1) / 2;
      const maxR = size / 2;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dist = Math.hypot(x - center, y - center);
          const factor = Math.max(0, 1 - Math.min(1, dist / maxR));
          const byteVal = Math.floor(Math.pow(factor, 1.6) * 255);
          const idx = (y * size + x) * 4;
          data[idx] = byteVal;
          data[idx + 1] = byteVal;
          data[idx + 2] = byteVal;
          data[idx + 3] = byteVal;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const texture = new Texture(graphicsDevice, {
      width: size,
      height: size,
      format: PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: FILTER_LINEAR,
    });
    texture.setSource(canvas);
    return texture;
  }

  private buildStarfieldMesh(graphicsDevice: GraphicsDevice, count: number): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const up = new Vec3(0, 1, 0);
    const altUp = new Vec3(1, 0, 0);
    const normal = new Vec3();
    const tangentU = new Vec3();
    const tangentV = new Vec3();
    const center = new Vec3();
    const temp = new Vec3();

    for (let i = 0; i < count; i++) {
      const phi = Math.random() * Math.PI * 2;
      const cosTheta = -0.02 + Math.random() * 1.02;
      const clampedCos = Math.max(0, cosTheta);
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));

      const distBonus = Math.random() * 600;
      const radius = 4200 + distBonus;

      center.set(radius * sinTheta * Math.cos(phi), radius * cosTheta, radius * sinTheta * Math.sin(phi));
      normal.copy(center).normalize();

      const refUp = Math.abs(normal.y) > 0.95 ? altUp : up;
      tangentU.cross(refUp, normal).normalize();
      tangentV.cross(normal, tangentU).normalize();

      const tier = Math.random();
      let starSize = 13 + Math.random() * 9;
      let starBrightness = 1.6 + Math.random() * 0.8;

      if (tier > 0.96) {
        starSize = 30 + Math.random() * 10;
        starBrightness = 2.8 + Math.random() * 0.8;
      } else if (tier > 0.82) {
        starSize = 22 + Math.random() * 10;
        starBrightness = 2.3 + Math.random() * 0.8;
      }

      const redShift = (distBonus / 600) * 0.65 + (1 - clampedCos) * 0.35;
      let r = 1.0;
      let g = 1.0;
      let b = 1.0;

      if (redShift > 0.75) {
        r = 1.0;
        g = 0.35 + Math.random() * 0.15;
        b = 0.18 + Math.random() * 0.1;
      } else if (redShift > 0.5) {
        r = 1.0;
        g = 0.62 + Math.random() * 0.15;
        b = 0.32 + Math.random() * 0.15;
      } else if (redShift > 0.3) {
        r = 1.0;
        g = 0.88 + Math.random() * 0.12;
        b = 0.65 + Math.random() * 0.15;
      } else if (Math.random() > 0.5) {
        r = 0.85 + Math.random() * 0.1;
        g = 0.92 + Math.random() * 0.08;
      }

      const hs = starSize * 0.5;
      const baseIndex = i * 4;

      temp.copy(center).sub(tangentU.clone().mulScalar(hs)).sub(tangentV.clone().mulScalar(hs));
      positions.push(temp.x, temp.y, temp.z);

      temp.copy(center).add(tangentU.clone().mulScalar(hs)).sub(tangentV.clone().mulScalar(hs));
      positions.push(temp.x, temp.y, temp.z);

      temp.copy(center).add(tangentU.clone().mulScalar(hs)).add(tangentV.clone().mulScalar(hs));
      positions.push(temp.x, temp.y, temp.z);

      temp.copy(center).sub(tangentU.clone().mulScalar(hs)).add(tangentV.clone().mulScalar(hs));
      positions.push(temp.x, temp.y, temp.z);

      for (let v = 0; v < 4; v++) {
        normals.push(-normal.x, -normal.y, -normal.z);
        colors.push(r * starBrightness, g * starBrightness, b * starBrightness, 1.0);
      }

      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
    }

    const mesh = new Mesh(graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setColors(colors);
    mesh.setIndices(indices);
    mesh.update();

    return mesh;
  }

  public update(nightFactor: number, camPos: Vec3): void {
    this.setPosition(camPos);
    this.material.opacity = nightFactor;
    this.material.emissiveIntensity = nightFactor * 6.5;
    this.material.update();
    this.enabled = nightFactor > 0.001;
  }
}
