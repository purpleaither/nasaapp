// MISSÕES: Seta flutuante sobre o centro exato do objetivo atual ou da extração.

import * as pc from 'playcanvas';
import {
  type ExtractionZone,
  type VolcanicStatus,
  sampleHeightViaEvent,
  TerrainEvent,
  VolcanicEvent,
} from '../../systems/events/worldEvents.ts';

const POINTER_HEIGHT = 16;
const SEARCHING_COLOR = new pc.Color(1, 0.77, 0.12);
const READY_COLOR = new pc.Color(0.25, 1, 0.57);

export class MissionWaypoint {
  private readonly root: pc.Entity;
  private readonly material = new pc.StandardMaterial();
  private target?: ExtractionZone;
  private ready?: boolean;

  constructor(private readonly app: pc.Application) {
    this.root = new pc.Entity('MissionWaypoint', app);
    this.root.enabled = false;
    this.material.useLighting = false;
    this.material.useFog = false;

    const tip = new pc.Entity('WaypointTip', app);
    tip.addComponent('render', {
      type: 'cone',
      material: this.material,
      castShadows: false,
      receiveShadows: false,
    });
    tip.setLocalPosition(0, 5, 0);
    tip.setLocalEulerAngles(0, 0, 180);
    tip.setLocalScale(13, 10, 13);
    this.root.addChild(tip);

    const shaft = new pc.Entity('WaypointShaft', app);
    shaft.addComponent('render', {
      type: 'cylinder',
      material: this.material,
      castShadows: false,
      receiveShadows: false,
    });
    shaft.setLocalPosition(0, 14, 0);
    shaft.setLocalScale(4, 8, 4);
    this.root.addChild(shaft);

    app.root.addChild(this.root);
    app.on(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    app.on(TerrainEvent.SEED_CHANGED, this.placeAboveTarget, this);
  }

  private onStatus(status: VolcanicStatus): void {
    this.root.enabled = status.phase === 'operation' || status.phase === 'paused';
    if (!this.root.enabled) return;

    const navigation = { ...status.geology.navigation, radius: 24 };
    if (!this.target || navigation.x !== this.target.x || navigation.z !== this.target.z) {
      this.target = navigation;
      this.placeAboveTarget();
    }

    const ready = status.target !== status.extraction && status.targetDistance === 0 && !status.fieldRequiresBoarding && !status.fieldRequiresDisembarking;
    if (ready === this.ready) return;

    this.ready = ready;
    this.material.emissive.copy(ready ? READY_COLOR : SEARCHING_COLOR);
    this.material.update();
  }

  private placeAboveTarget(): void {
    if (!this.target) return;
    const { x, z } = this.target;
    this.root.setPosition(x, sampleHeightViaEvent(this.app, x, z) + POINTER_HEIGHT, z);
  }

  public destroy(): void {
    this.app.off(VolcanicEvent.STATUS_CHANGED, this.onStatus, this);
    this.app.off(TerrainEvent.SEED_CHANGED, this.placeAboveTarget, this);
    this.root.destroy();
    this.material.destroy();
  }
}
