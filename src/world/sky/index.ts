import { Color, Entity, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';
import {
  CameraEvent,
  CameraStateUpdatedPayload,
} from '../../systems/events/worldEvents.ts';
import { TimeEvent } from '../../systems/time/types.ts';
import type { TimeData } from '../../systems/time/types.ts';
import { Atmosphere } from './atmosphere.ts';
import { MoonElement, MOON_CONFIGS } from './elements/moon.ts';
import { StarsElement } from './elements/stars.ts';
import { SunElement } from './elements/sun.ts';

export * from './types.ts';

export default class Sky extends Entity {
  private readonly atmosphere: Atmosphere;
  private readonly sunElement: SunElement;
  private readonly fillLight: Entity;
  private readonly phobos: MoonElement;
  private readonly deimos: MoonElement;
  private readonly stars: StarsElement;

  private readonly camPos = new Vec3(0, 15, 30);
  private readonly sunWorldPos = new Vec3();
  private readonly appInstance: AppBase;
  private readonly onTickHandler: (data: TimeData) => void;
  private readonly onCameraStateHandler: (data: CameraStateUpdatedPayload) => void;

  constructor(app: AppBase, isHeadless = false) {
    super('sky', app);
    this.appInstance = app;

    this.atmosphere = new Atmosphere(app);

    this.stars = new StarsElement(app, isHeadless ? 1400 : 5200);
    this.addChild(this.stars);

    this.sunElement = new SunElement(app, isHeadless);
    this.addChild(this.sunElement);

    // Secondary sky fill directional light from the opposite azimuth so shadowed slopes keep crisp facet definition
    this.fillLight = new Entity('SkyBounceLight', app);
    this.fillLight.addComponent('light', {
      type: 'directional',
      color: new Color(0.67, 0.73, 0.8),
      intensity: 0.25,
      castShadows: false,
    });
    this.fillLight.setEulerAngles(52, -135, 0);
    this.addChild(this.fillLight);

    this.phobos = new MoonElement(MOON_CONFIGS.phobos);
    this.addChild(this.phobos);

    this.deimos = new MoonElement(MOON_CONFIGS.deimos);
    this.addChild(this.deimos);

    this.onCameraStateHandler = (data: CameraStateUpdatedPayload) => {
      this.camPos.set(data.x, data.y, data.z);
    };
    this.onTickHandler = (data: TimeData) => this.handleTick(data);

    this.appInstance.on(CameraEvent.STATE_UPDATED, this.onCameraStateHandler, this);
    this.appInstance.on(TimeEvent.TICK, this.onTickHandler, this);

    app.root.addChild(this);
  }

  private handleTick(data: TimeData): void {
    const currentHour = (((data.normalized * 24) % 24) + 24) % 24;
    const state = this.atmosphere.update(currentHour, null);

    this.appInstance.fire(CameraEvent.CLEAR_COLOR, {
      r: state.fogColor.r,
      g: state.fogColor.g,
      b: state.fogColor.b,
    });

    const sunAngleRad = data.normalized * Math.PI * 2 - Math.PI / 2;
    const sunRadius = 4100;
    const tilt = 0.44;

    const sunX = Math.cos(sunAngleRad) * sunRadius;
    const sunY = Math.sin(sunAngleRad) * sunRadius * Math.cos(tilt);
    const sunZ = -Math.sin(sunAngleRad) * sunRadius * Math.sin(tilt);

    this.sunWorldPos.set(this.camPos.x + sunX, this.camPos.y + sunY, this.camPos.z + sunZ);

    this.sunElement.update(
      this.sunWorldPos,
      this.camPos,
      state.lightColor,
      state.lightIntensity,
      data.normalized
    );

    if (this.fillLight.light) {
      this.fillLight.light.color.set(0.67, 0.73, 0.8);
      this.fillLight.light.intensity = state.lightIntensity * 0.16;
    }

    const totalDays = data.day - 1 + data.normalized;
    this.phobos.update(totalDays, this.camPos, this.sunWorldPos);
    this.deimos.update(totalDays, this.camPos, this.sunWorldPos);
    this.stars.update(state.nightFactor, this.camPos);
  }

  public override destroy(): void {
    this.appInstance.off(CameraEvent.STATE_UPDATED, this.onCameraStateHandler, this);
    this.appInstance.off(TimeEvent.TICK, this.onTickHandler, this);
    super.destroy();
  }
}
