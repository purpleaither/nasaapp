import test from 'node:test';
import assert from 'node:assert/strict';
import { restartMissionPage, consumeMissionRestart } from './restartPage.ts';
import { scheduleAstronautRestart, scheduleBaseRestart, BASE_RESTART_DELAY } from './missionRestart.ts';

function createPage() {
  const values = new Map<string, string>();
  let reloads = 0;
  return {
    sessionStorage: {
      setItem: (key: string, value: string) => { values.set(key, value); },
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
    },
    location: { reload: () => { reloads++; } },
    get reloads() { return reloads; },
  };
}

test('restarting reloads the whole page and auto-starts only the next fresh attempt', () => {
  const page = createPage();
  assert.equal(consumeMissionRestart(page), false);
  restartMissionPage(page);
  assert.equal(page.reloads, 1);
  assert.equal(consumeMissionRestart(page), true);
  assert.equal(consumeMissionRestart(page), false);
});

test('both astronaut and base death run a full reload instead of reusing the dead world', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const cause of ['astronaut', 'base']) {
    const page = createPage();
    const restart = () => restartMissionPage(page);
    if (cause === 'astronaut') scheduleAstronautRestart(true, restart);
    else scheduleBaseRestart({ phase: 'ended', hull: 0, evacuated: false }, restart);
    t.mock.timers.tick(BASE_RESTART_DELAY);
    assert.equal(page.reloads, 1, cause);
    assert.equal(consumeMissionRestart(page), true);
  }
});

test('blocked session storage cannot prevent reloading away from lava', () => {
  let reloads = 0;
  const page = {
    sessionStorage: {
      setItem() { throw new Error('blocked'); },
      getItem(): string | null { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    },
    location: { reload() { reloads++; } },
  };
  restartMissionPage(page);
  assert.equal(reloads, 1);
  assert.equal(consumeMissionRestart(page), false);
});
