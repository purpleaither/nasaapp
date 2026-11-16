import { Color, FOG_EXP2 } from 'playcanvas';
import type { AppBase, CameraComponent } from 'playcanvas';
import { DayPhase } from '../../systems/time/types.ts';
import type { DayPhase as DayPhaseType } from '../../systems/time/types.ts';
import type { AtmosphereState, PhaseConfig } from './types.ts';

const PHASE_CONFIGS: Record<DayPhaseType, PhaseConfig> = {
  [DayPhase.DAWN]: {
    lightColor: new Color(0.95, 0.62, 0.45),
    lightIntensity: 0.78,
    fogColor: new Color(0.42, 0.18, 0.13),
    ambientLight: new Color(0.18, 0.08, 0.07),
  },
  [DayPhase.DAY]: {
    lightColor: new Color(1.0, 0.86, 0.74),
    lightIntensity: 1.22,
    fogColor: new Color(0.58, 0.25, 0.16),
    ambientLight: new Color(0.26, 0.12, 0.09),
  },
  [DayPhase.DUSK]: {
    lightColor: new Color(0.92, 0.44, 0.3),
    lightIntensity: 0.72,
    fogColor: new Color(0.36, 0.14, 0.12),
    ambientLight: new Color(0.15, 0.07, 0.07),
  },
  [DayPhase.NIGHT]: {
    // Cool nocturnal starlight/moonlight with low ambient so it truly looks like night while preserving facet contrast
    lightColor: new Color(0.32, 0.36, 0.52),
    lightIntensity: 0.24,
    fogColor: new Color(0.05, 0.03, 0.06),
    ambientLight: new Color(0.04, 0.025, 0.045),
  },
};

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export class Atmosphere {
  private app: AppBase;
  private currentFogColor = new Color();
  private currentAmbientLight = new Color();
  private currentLightColor = new Color();

  constructor(app: AppBase) {
    this.app = app;
    this.app.scene.fog.type = FOG_EXP2;
    this.app.scene.fog.density = 0.00034;
    this.app.scene.exposure = 1.0;
  }

  private getPhaseBlend(hour: number): { from: PhaseConfig; to: PhaseConfig; progress: number } {
    // Wide, gradual multi-hour transitions so Dawn -> Day and Day -> Dusk -> Night are completely smooth
    if (hour >= 4.5 && hour < 6.5) {
      return {
        from: PHASE_CONFIGS[DayPhase.NIGHT],
        to: PHASE_CONFIGS[DayPhase.DAWN],
        progress: (hour - 4.5) / 2.0,
      };
    }
    if (hour >= 6.5 && hour < 9.5) {
      return {
        from: PHASE_CONFIGS[DayPhase.DAWN],
        to: PHASE_CONFIGS[DayPhase.DAY],
        progress: (hour - 6.5) / 3.0,
      };
    }
    if (hour >= 9.5 && hour < 15.5) {
      return {
        from: PHASE_CONFIGS[DayPhase.DAY],
        to: PHASE_CONFIGS[DayPhase.DAY],
        progress: 0,
      };
    }
    if (hour >= 15.5 && hour < 18.0) {
      return {
        from: PHASE_CONFIGS[DayPhase.DAY],
        to: PHASE_CONFIGS[DayPhase.DUSK],
        progress: (hour - 15.5) / 2.5,
      };
    }
    if (hour >= 18.0 && hour < 20.5) {
      return {
        from: PHASE_CONFIGS[DayPhase.DUSK],
        to: PHASE_CONFIGS[DayPhase.NIGHT],
        progress: (hour - 18.0) / 2.5,
      };
    }
    return {
      from: PHASE_CONFIGS[DayPhase.NIGHT],
      to: PHASE_CONFIGS[DayPhase.NIGHT],
      progress: 0,
    };
  }

  public update(hour: number, camera: CameraComponent | null): AtmosphereState {
    const { from, to, progress } = this.getPhaseBlend(hour);
    const t = smoothstep01(progress);

    this.currentFogColor.lerp(from.fogColor, to.fogColor, t);
    this.currentAmbientLight.lerp(from.ambientLight, to.ambientLight, t);
    this.currentLightColor.lerp(from.lightColor, to.lightColor, t);
    const intensity = from.lightIntensity + (to.lightIntensity - from.lightIntensity) * t;

    this.app.scene.fog.color.copy(this.currentFogColor);
    this.app.scene.ambientLight.copy(this.currentAmbientLight);

    if (camera) {
      camera.clearColor.copy(this.currentFogColor);
    }

    // Stars only visible at night and twilight; 0.0 during daytime (07:30 to 17:00)
    let nightFactor = 0;
    if (hour >= 20.0 || hour < 4.5) {
      nightFactor = 1.0;
    } else if (hour >= 17.0 && hour < 20.0) {
      nightFactor = smoothstep01((hour - 17.0) / 3.0);
    } else if (hour >= 4.5 && hour < 7.5) {
      nightFactor = 1.0 - smoothstep01((hour - 4.5) / 3.0);
    }

    return {
      fogColor: this.currentFogColor,
      ambientLight: this.currentAmbientLight,
      lightColor: this.currentLightColor,
      lightIntensity: intensity,
      nightFactor,
    };
  }
}
