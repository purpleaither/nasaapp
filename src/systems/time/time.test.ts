import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppBase } from 'playcanvas';
import {
  sampleHeightViaEvent,
  shouldEnableNightLanterns,
  TerrainEvent,
} from '../events/worldEvents.ts';
import type { TerrainHeightQuery } from '../events/worldEvents.ts';
import TimeSystem, { calculateDayPhase, DayPhase, TimeEvent } from './index.ts';
import type { TimeData } from './index.ts';

function createMockPlayCanvasApp(): AppBase {
  const listeners = new Map<string, Array<{ fn: (...args: unknown[]) => void; scope?: unknown }>>();
  return {
    on(event: string, fn: (...args: unknown[]) => void, scope?: unknown) {
      const list = listeners.get(event) ?? [];
      list.push({ fn, scope });
      listeners.set(event, list);
      return this;
    },
    off(event: string, fn: (...args: unknown[]) => void, scope?: unknown) {
      const list = listeners.get(event) ?? [];
      listeners.set(
        event,
        list.filter((item) => item.fn !== fn || item.scope !== scope)
      );
      return this;
    },
    fire(event: string, arg1?: unknown) {
      const list = listeners.get(event) ?? [];
      for (const item of list) {
        item.fn.call(item.scope, arg1);
      }
      return this;
    },
  } as unknown as AppBase;
}

test('calculateDayPhase classifies hours into dawn, day, dusk, and night', () => {
  assert.equal(calculateDayPhase(5.5), DayPhase.DAWN);
  assert.equal(calculateDayPhase(12.0), DayPhase.DAY);
  assert.equal(calculateDayPhase(18.0), DayPhase.DUSK);
  assert.equal(calculateDayPhase(22.0), DayPhase.NIGHT);
  assert.equal(calculateDayPhase(2.0), DayPhase.NIGHT);
});

test('shouldEnableNightLanterns activates lanterns automatically only at night', () => {
  assert.equal(shouldEnableNightLanterns(DayPhase.DAWN), false);
  assert.equal(shouldEnableNightLanterns(DayPhase.DAY), false);
  assert.equal(shouldEnableNightLanterns(DayPhase.DUSK), false);
  assert.equal(shouldEnableNightLanterns(DayPhase.NIGHT), true);
});

test('PlayCanvas event bus drives TimeSystem presets, phase transitions, and terrain height queries', () => {
  const app = createMockPlayCanvasApp();
  const time = new TimeSystem(app, {
    initialHour: 17.6,
    initialDay: 1,
    dayDurationMinutes: 4.0,
    timeScale: 1.0,
  });

  let latestTick: TimeData | null = null;
  let lanternsOn = false;
  app.on(TimeEvent.TICK, (data: TimeData) => {
    latestTick = data;
    lanternsOn = shouldEnableNightLanterns(data.phase);
  });

  time.initialize();
  assert.ok(latestTick !== null);
  assert.equal((latestTick as TimeData).phase, DayPhase.DUSK);
  assert.equal(lanternsOn, false, 'Lanterns must be OFF at dusk');

  // Switch to night via PlayCanvas event TimeEvent.SET_PRESET
  app.fire(TimeEvent.SET_PRESET, { preset: 'night' });
  assert.equal((latestTick as TimeData).phase, DayPhase.NIGHT);
  assert.equal(lanternsOn, true, 'Lanterns must turn ON automatically at night');

  // Switch back to day via PlayCanvas event TimeEvent.SET_PRESET
  app.fire(TimeEvent.SET_PRESET, { preset: 'day' });
  assert.equal((latestTick as TimeData).phase, DayPhase.DAY);
  assert.equal(lanternsOn, false, 'Lanterns must turn OFF automatically during the day');

  // Verify event-driven terrain height query
  app.on(TerrainEvent.SAMPLE_HEIGHT, (q: TerrainHeightQuery) => {
    q.outY = q.x * 2 + q.z * 3;
  });
  assert.equal(sampleHeightViaEvent(app, 4, 5), 23);

  time.destroy();
});

