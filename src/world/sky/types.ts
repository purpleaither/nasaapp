import type { Color } from 'playcanvas';

export type AtmosphereState = {
  fogColor: Color;
  ambientLight: Color;
  lightColor: Color;
  lightIntensity: number;
  nightFactor: number;
};

export type PhaseConfig = {
  lightColor: Color;
  lightIntensity: number;
  fogColor: Color;
  ambientLight: Color;
};
