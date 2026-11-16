import * as pc from 'playcanvas';
import {
  type ExtractionZone,
  type VolcanicStatus,
  sampleHeightViaEvent,
  TerrainEvent,
  VolcanicEvent,
} from '../../systems/events/worldEvents.ts';

export class ExtractionMarker {
  private readonly root = new pc.Entity('ExtractionZone');
  private readonly ring = new pc.Entity('ExtractionBoundary');
  private readonly material = new pc.StandardMaterial();
  private zone: ExtractionZone;

  constructor(private readonly app: pc.Application, zone: ExtractionZone) {
    this.zone = zone;
    this.material.useLighting = false;
    this.material.emissive = new pc.Color(0.18, 1, 0.83);
    this.material.cull = pc.CULLFACE_NONE;
    this.material.update();

    this.root.addChild(this.ring);
    this.ring.addComponent('render', { castShadows: false, receiveShadows: false });
    const beacon = new pc.Entity('ExtractionBeacon');
    beacon.addComponent('render', {
      type: 'cylinder',
      material: this.material,
      castShadows: false,
      receiveShadows: false,
    });
    beacon.setLocalPosition(0, 21, 0);
    beacon.setLocalScale(2, 42, 2);
    this.root.addChild(beacon);
    app.root.addChild(this.root);
    this.updateGeometry();
    app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    app.on(TerrainEvent.SEED_CHANGED, this.updateGeometry, this);
  }

  private onStatus({ extraction }: VolcanicStatus): void {
    if (extraction === this.zone) return;
    this.zone = extraction;
    this.updateGeometry();
  }

  private updateGeometry(): void {
    const { x, z, radius } = this.zone;
    const ground = sampleHeightViaEvent(this.app, x, z);
    this.root.setPosition(x, ground, z);

    const segments = 64;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = 2 * Math.PI * i / segments;
      for (const r of [radius, radius - 2]) {
        const dx = r * Math.sin(angle);
        const dz = r * Math.cos(angle);
        positions.push(dx, sampleHeightViaEvent(this.app, x + dx, z + dz) - ground + 1.2, dz);
      }
      const a = 2 * i;
      const b = 2 * ((i + 1) % segments);
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }

    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setIndices(indices);
    mesh.update();
    this.ring.render!.meshInstances = [new pc.MeshInstance(mesh, this.material)];
  }

  destroy(): void {
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    this.app.off(TerrainEvent.SEED_CHANGED, this.updateGeometry, this);
    this.root.destroy();
    this.material.destroy();
  }
}
