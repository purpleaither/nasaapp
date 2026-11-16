import type { AppBase } from 'playcanvas';
import { DayPhase, TimeEvent } from './types.ts';
import type {
  DayPhase as DayPhaseType,
  TimeData,
  TimeOptions,
  TimeSetPresetPayload,
} from './types.ts';

export * from './types.ts';

export function calculateDayPhase(hour: number): DayPhaseType {
  if (hour >= 5 && hour < 7) return DayPhase.DAWN;
  if (hour >= 7 && hour < 17) return DayPhase.DAY;
  if (hour >= 17 && hour < 19) return DayPhase.DUSK;
  return DayPhase.NIGHT;
}

export default class TimeSystem {
  private app: AppBase;
  public currentHour: number;
  public currentDay: number;
  public dayDurationMinutes: number;
  public timeScale: number;
  private lastPhase: DayPhaseType;
  private readonly onUpdateHandler: (dt: number) => void;
  private readonly onSetPresetHandler: (payload: TimeSetPresetPayload) => void;

  constructor(app: AppBase, opts: TimeOptions = {}, private readonly updateEvent = 'update') {
    this.app = app;
    this.currentHour = opts.initialHour ?? 15.8;
    this.currentDay = opts.initialDay ?? 1;
    this.dayDurationMinutes = opts.dayDurationMinutes ?? 3.0;
    this.timeScale = opts.timeScale ?? 1.0;
    this.lastPhase = calculateDayPhase(this.currentHour);

    this.onUpdateHandler = (dt: number) => this.update(Math.min(dt, 0.05));
    this.onSetPresetHandler = (payload: TimeSetPresetPayload) => this.handleSetPreset(payload);

    this.app.on(this.updateEvent, this.onUpdateHandler, this);
    this.app.on(TimeEvent.SET_PRESET, this.onSetPresetHandler, this);
  }

  public initialize(): void {
    const data = this.getTimeData();
    this.lastPhase = data.phase;
    this.app.fire(TimeEvent.TICK, data);
    this.app.fire(TimeEvent.PHASE_CHANGED, data);
  }

  private handleSetPreset(payload: TimeSetPresetPayload): void {
    if (payload.preset === 'day') {
      this.currentHour = 13.5;
    } else if (payload.preset === 'dusk') {
      this.currentHour = 17.8;
    } else {
      this.currentHour = 22.0;
    }
    this.update(0);
  }

  public update(delta: number): void {
    const hoursPerSecond = (24 / (this.dayDurationMinutes * 60)) * this.timeScale;
    this.currentHour += delta * hoursPerSecond;

    while (this.currentHour >= 24) {
      this.currentHour -= 24;
      this.currentDay++;
    }

    const data = this.getTimeData();
    this.app.fire(TimeEvent.TICK, data);

    if (data.phase !== this.lastPhase) {
      this.lastPhase = data.phase;
      this.app.fire(TimeEvent.PHASE_CHANGED, data);
    }
  }

  public getTimeData(): TimeData {
    return {
      hour: Math.floor(this.currentHour),
      minute: Math.floor((this.currentHour % 1) * 60),
      day: this.currentDay,
      phase: calculateDayPhase(this.currentHour),
      normalized: this.currentHour / 24,
    };
  }

  public destroy(): void {
    this.app.off(this.updateEvent, this.onUpdateHandler, this);
    this.app.off(TimeEvent.SET_PRESET, this.onSetPresetHandler, this);
  }
}
