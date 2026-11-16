import * as pc from 'playcanvas';
import {
  CameraEvent,
  type CameraStateUpdatedPayload,
  PlayerEvent,
  type PoseUpdatedPayload,
  TerrainEvent,
  TerrainHeightQuery,
  type TerrainMeshStats,
  WalkerEvent,
} from '../../systems/events/worldEvents.ts';
import {
  applyFacetColorJitter,
  Crater,
  createCratersForSeed,
  getPlanetVertexColor,
  samplePlanetHeight,
  WORLD_HALF,
} from './geology.ts';

const CHUNKS_PER_SIDE = 12;
const CHUNK_SIZE = WORLD_HALF * 2 / CHUNKS_PER_SIDE;
const DETAIL_RADIUS = CHUNK_SIZE * 1.2;
const DETAIL_EXIT_RADIUS = CHUNK_SIZE * 1.55;

interface TerrainChunk {
  entity: pc.Entity;
  cx: number;
  cz: number;
  detailed: boolean;
}

export class TerrainManager {
  private app: pc.Application;
  private chunks: TerrainChunk[] = [];
  private sharedMaterial: pc.StandardMaterial;
  private seed: number;
  private craters: Crater[];
  private isHeadless: boolean;
  private readonly cellsPerChunk: number;
  private readonly cellsPerSide: number;
  private readonly cellSize: number;
  private readonly heights: Float32Array;
  private readonly coords: Float64Array;
  private readonly walker = new pc.Vec2();
  private readonly explorer = new pc.Vec2();
  private readonly camera = new pc.Vec2();
  private readonly detailSamples = [this.walker, this.explorer, this.camera];
  private lastDetailCheck = -Infinity;

  private readonly onSampleHeightHandler: (q: TerrainHeightQuery) => void;
  private readonly onRegenerateRandomHandler: () => void;

  constructor(app: pc.Application, initialSeed = 4092, isHeadless = false) {
    this.app = app;
    this.isHeadless = isHeadless;
    this.cellsPerChunk = isHeadless ? 18 : 20;
    this.cellsPerSide = CHUNKS_PER_SIDE * this.cellsPerChunk;
    this.cellSize = (WORLD_HALF * 2) / this.cellsPerSide;
    this.heights = new Float32Array((this.cellsPerSide + 1) ** 2);
    this.coords = Float64Array.from({ length: this.cellsPerSide + 1 },
      (_, i) => -WORLD_HALF + i * this.cellSize);
    this.seed = initialSeed;
    this.craters = createCratersForSeed(initialSeed);

    this.sharedMaterial = new pc.StandardMaterial();
    this.sharedMaterial.diffuse = new pc.Color(1, 1, 1);
    this.sharedMaterial.diffuseVertexColor = true;
    this.sharedMaterial.shininess = 3;
    this.sharedMaterial.emissive = new pc.Color(0, 0, 0);
    const chunks = this.sharedMaterial.getShaderChunks(pc.SHADERLANGUAGE_GLSL);
    chunks.set('diffusePS', `
      uniform vec3 material_diffuse;
      void getAlbedo() {
        float grain = fract(sin(dot(floor(vPositionW.xz * 3.0), vec2(12.9898, 78.233))) * 43758.5453);
        dAlbedo = material_diffuse * vVertexColor.rgb * (0.93 + grain * 0.12);
      }
    `);
    this.sharedMaterial.shaderChunksVersion = '2.24';
    this.sharedMaterial.update();

    this.onSampleHeightHandler = (q: TerrainHeightQuery) => {
      q.outY = this.sampleHeightAt(q.x, q.z);
    };
    this.onRegenerateRandomHandler = () => {
      this.regenerateRandomSeed();
    };

    this.app.on(TerrainEvent.SAMPLE_HEIGHT, this.onSampleHeightHandler, this);
    this.app.on(TerrainEvent.REGENERATE_RANDOM, this.onRegenerateRandomHandler, this);
    this.app.on(WalkerEvent.POSE_UPDATED, this.trackWalker, this);
    this.app.on(PlayerEvent.POSE_UPDATED, this.trackExplorer, this);
    this.app.on(CameraEvent.STATE_UPDATED, this.updateRenderDetail, this);

    this.buildChunks();
  }

  private trackWalker({ x, z }: PoseUpdatedPayload): void {
    this.walker.set(x, z);
  }

  private trackExplorer({ x, z }: PoseUpdatedPayload): void {
    this.explorer.set(x, z);
  }

  private needsDetail(cx: number, cz: number, radius: number): boolean {
    const minX = -WORLD_HALF + cx * CHUNK_SIZE;
    const minZ = -WORLD_HALF + cz * CHUNK_SIZE;
    return this.detailSamples.some(({ x, y: z }) => {
      const dx = Math.max(minX - x, 0, x - minX - CHUNK_SIZE);
      const dz = Math.max(minZ - z, 0, z - minZ - CHUNK_SIZE);
      return dx * dx + dz * dz < radius * radius;
    });
  }

  private updateRenderDetail({ x, z }: CameraStateUpdatedPayload): void {
    const now = performance.now();
    if (now - this.lastDetailCheck < 200) return;
    this.lastDetailCheck = now;
    this.camera.set(x, z);

    let changed = false;
    for (const chunk of this.chunks) {
      const radius = chunk.detailed ? DETAIL_EXIT_RADIUS : DETAIL_RADIUS;
      const detailed = this.needsDetail(chunk.cx, chunk.cz, radius);
      if (detailed === chunk.detailed) continue;

      const mesh = this.createChunkMesh(chunk.cx, chunk.cz, detailed);
      chunk.entity.render!.meshInstances = [new pc.MeshInstance(mesh, this.sharedMaterial)];
      chunk.detailed = detailed;
      changed = true;
    }
    if (changed) this.app.fire(TerrainEvent.MESH_STATS_CHANGED, this.getMeshStats());
  }

  public getMeshStats(): TerrainMeshStats {
    let detailedChunks = 0;
    let triangles = 0;
    for (const { entity, detailed } of this.chunks) {
      if (detailed) detailedChunks++;
      triangles += (entity.render?.meshInstances?.[0]?.mesh?.primitive[0]?.count ?? 0) / 3;
    }

    return { chunks: this.chunks.length, detailedChunks, triangles };
  }

  public sampleHeightAt(x: number, z: number): number {
    if (Math.abs(x) > WORLD_HALF || Math.abs(z) > WORLD_HALF) {
      return samplePlanetHeight(x, z, this.seed, this.craters);
    }

    const gridX = (x + WORLD_HALF) / this.cellSize;
    const gridZ = (z + WORLD_HALF) / this.cellSize;
    const ix = Math.min(Math.floor(gridX), this.cellsPerSide - 1);
    const iz = Math.min(Math.floor(gridZ), this.cellsPerSide - 1);
    const u = gridX - ix;
    const v = gridZ - iz;
    const stride = this.cellsPerSide + 1;
    const i = iz * stride + ix;
    const a = this.heights[i];
    const b = this.heights[i + 1];
    const c = this.heights[i + stride];
    const d = this.heights[i + stride + 1];

    if ((ix + iz) % 2 === 0) {
      return u + v <= 1
        ? a + u * (b - a) + v * (c - a)
        : d + (1 - u) * (c - d) + (1 - v) * (b - d);
    }
    return u >= v
      ? a + u * (b - a) + v * (d - b)
      : a + u * (d - c) + v * (c - a);
  }

  public regenerateRandomSeed(): number {
    const nextSeed = Math.floor(1000 + Math.random() * 9000);
    this.seed = nextSeed;
    this.craters = createCratersForSeed(nextSeed);
    this.buildChunks();
    this.app.fire(TerrainEvent.SEED_CHANGED, { seed: nextSeed });
    return nextSeed;
  }

  public buildChunks(): void {
    for (const { entity } of this.chunks) {
      entity.destroy();
    }
    this.chunks = [];

    const stride = this.cellsPerSide + 1;
    const coords = this.coords;
    for (let z = 0; z < stride; z++) {
      for (let x = 0; x < stride; x++) {
        this.heights[z * stride + x] = samplePlanetHeight(coords[x], coords[z], this.seed, this.craters);
      }
    }

    for (let cz = 0; cz < CHUNKS_PER_SIDE; cz++) {
      for (let cx = 0; cx < CHUNKS_PER_SIDE; cx++) {
        const detailed = this.needsDetail(cx, cz, DETAIL_RADIUS);
        const mesh = this.createChunkMesh(cx, cz, detailed);
        const entity = new pc.Entity(`PlanetChunk_${cx}_${cz}`);
        entity.addComponent('render', {
          meshInstances: [new pc.MeshInstance(mesh, this.sharedMaterial)],
          castShadows: !this.isHeadless,
          receiveShadows: !this.isHeadless,
        });
        this.app.root.addChild(entity);
        this.chunks.push({ entity, cx, cz, detailed });
      }
    }
    this.app.fire(TerrainEvent.MESH_STATS_CHANGED, this.getMeshStats());
  }

  private createChunkMesh(cx: number, cz: number, detailed: boolean): pc.Mesh {
    const coords = this.coords;
    const seed = this.seed;
    const stride = this.cellsPerSide + 1;
    const cellsPerChunk = this.cellsPerChunk;
    const step = detailed ? 1 : this.isHeadless ? 3 : 4;
    const startX = cx * cellsPerChunk;
    const startZ = cz * cellsPerChunk;
    const cells = cellsPerChunk / step;
    const edgeTriangles = detailed ? 0 : 2 * (4 * cells - 4) + 4 * cells * (step - 1);
    const numTris = cells * cells * 2 + edgeTriangles;
    const numVerts = numTris * 3;
    const positions = new Float32Array(numVerts * 3);
    const normals = new Float32Array(numVerts * 3);
    const colors = new Float32Array(numVerts * 4);

    let vPtr = 0;
    let cPtr = 0;

    const emitTri = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cxPt: number,
      cy: number,
      czPt: number
    ) => {
      const ux = bx - ax;
      const uy = by - ay;
      const uz = bz - az;
      const vx = cxPt - ax;
      const vy = cy - ay;
      const vz = czPt - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const avgY = (ay + by + cy) / 3;
      const avgX = (ax + bx + cxPt) / 3;
      const avgZ = (az + bz + czPt) / 3;
      const baseRgb = getPlanetVertexColor(avgY, ny, seed, avgX, avgZ);
      const [r, g, b] = applyFacetColorJitter(baseRgb, avgX, avgZ);

      const pts = [ax, ay, az, bx, by, bz, cxPt, cy, czPt];
      for (let k = 0; k < 9; k += 3) {
        positions[vPtr] = pts[k];
        positions[vPtr + 1] = pts[k + 1];
        positions[vPtr + 2] = pts[k + 2];
        normals[vPtr] = nx;
        normals[vPtr + 1] = ny;
        normals[vPtr + 2] = nz;
        vPtr += 3;
        colors[cPtr++] = r;
        colors[cPtr++] = g;
        colors[cPtr++] = b;
        colors[cPtr++] = 1.0;
      }
    };

    const emitGridTri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
      emitTri(
        coords[ax], this.heights[az * stride + ax], coords[az],
        coords[bx], this.heights[bz * stride + bx], coords[bz],
        coords[cx], this.heights[cz * stride + cx], coords[cz]
      );
    };

    for (let iz = 0; iz < cellsPerChunk; iz += step) {
      const z = startZ + iz;
      const zEnd = z + step;

      for (let ix = 0; ix < cellsPerChunk; ix += step) {
        const x = startX + ix;
        const xEnd = x + step;
        const west = ix === 0;
        const east = ix + step === cellsPerChunk;
        const north = iz === 0;
        const south = iz + step === cellsPerChunk;
        if (!detailed && (west || east || north || south)) {
          const centerX = x + Math.floor(step / 2);
          const centerZ = z + Math.floor(step / 2);
          const fanEdge = (ax: number, az: number, bx: number, bz: number, split: boolean) => {
            const segments = split ? step : 1;
            const dx = (bx - ax) / segments;
            const dz = (bz - az) / segments;
            for (let i = 0; i < segments; i++) {
              emitGridTri(centerX, centerZ, ax + i * dx, az + i * dz,
                ax + (i + 1) * dx, az + (i + 1) * dz);
            }
          };
          fanEdge(x, z, x, zEnd, west);
          fanEdge(x, zEnd, xEnd, zEnd, south);
          fanEdge(xEnd, zEnd, xEnd, z, east);
          fanEdge(xEnd, z, x, z, north);
        } else if ((x / step + z / step) % 2 === 0) {
          emitGridTri(x, z, x, zEnd, xEnd, z);
          emitGridTri(xEnd, z, x, zEnd, xEnd, zEnd);
        } else {
          emitGridTri(x, z, x, zEnd, xEnd, zEnd);
          emitGridTri(x, z, xEnd, zEnd, xEnd, z);
        }
      }
    }

    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setColors(colors);
    mesh.update(pc.PRIMITIVE_TRIANGLES);

    return mesh;
  }

  public destroy(): void {
    this.app.off(TerrainEvent.SAMPLE_HEIGHT, this.onSampleHeightHandler, this);
    this.app.off(TerrainEvent.REGENERATE_RANDOM, this.onRegenerateRandomHandler, this);
    this.app.off(WalkerEvent.POSE_UPDATED, this.trackWalker, this);
    this.app.off(PlayerEvent.POSE_UPDATED, this.trackExplorer, this);
    this.app.off(CameraEvent.STATE_UPDATED, this.updateRenderDetail, this);
    for (const { entity } of this.chunks) {
      entity.destroy();
    }
    this.chunks = [];
    this.sharedMaterial.destroy();
  }
}
