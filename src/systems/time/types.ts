export const TimeEvent = {
  TICK: 'time:tick',
  PHASE_CHANGED: 'time:phase-changed',
  SET_PRESET: 'time:set-preset',
} as const;

export type TimeEvent = (typeof TimeEvent)[keyof typeof TimeEvent];

export const DayPhase = {
  DAWN: 'dawn',
  DAY: 'day',
  DUSK: 'dusk',
  NIGHT: 'night',
} as const;

export type DayPhase = (typeof DayPhase)[keyof typeof DayPhase];

export type TimePreset = 'day' | 'dusk' | 'night';

export type TimeSetPresetPayload = {
  preset: TimePreset;
};

export type TimeData = {
  hour: number;
  minute: number;
  day: number;
  phase: DayPhase;
  normalized: number;
};

export type TimeOptions = {
  initialHour?: number;
  initialDay?: number;
  dayDurationMinutes?: number;
  timeScale?: number;
};
