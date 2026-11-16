import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { VolcanicFront } from '../volcanic/VolcanicFront.ts';
import { GeologicalScene } from './GeologicalScene.ts';
import { GeologicalEvent, missionLayout, rockfallBlocks, type CollisionQuery } from './crisis.ts';
import { InputEvent, PlayerEvent, SimulationEvent, TerrainEvent, VolcanicEvent, WalkerEvent } from '../../systems/events/worldEvents.ts';
function setup() {
  const app = new pc.EventHandler();
  const crisis = new VolcanicFront(app as pc.AppBase);
  crisis.attachSimulation();
  const step = (dt: number) => app.fire(InputEvent.AXES, { dt });
  const move = (p: { x: number; z: number }, dt = 1 / 60) => { app.fire(WalkerEvent.POSE_UPDATED, { ...p, y: 0, headingDeg: 28 }); step(dt); };
  const query = (from: { x: number; z: number }, to: { x: number; z: number }, radius = 2) => {
    const q: CollisionQuery = { fromX: from.x, fromZ: from.z, ...to, radius, blocked: false };
    app.fire(GeologicalEvent.COLLISION_QUERY, q); return q.blocked;
  };
  return { app, crisis, step, move, query, start: () => app.fire(VolcanicEvent.START) };
}

test('seismic events are isolated, instrumented and local; pause freezes energy and event progression', () => {
  const { app, crisis, start, step, move } = setup();
  try {
    start(); step(34);
    assert.equal(crisis.getStatus().hull, 100);
    assert.equal(crisis.getStatus().geology.events.length, 0);
    step(1);
    assert.equal(crisis.getStatus().hull, 90);
    assert.equal(crisis.getStatus().geology.events.length, 1);
    assert.equal(crisis.getStatus().geology.shaking, true);
    step(4);
    const quiet = crisis.getStatus();
    assert.equal(quiet.geology.shaking, false);
    step(20);
    assert.equal(crisis.getStatus().hull, quiet.hull, 'no continuous thermal damage');
    app.fire(VolcanicEvent.PAUSE);
    const paused = crisis.getStatus(); step(400);
    assert.deepEqual(crisis.getStatus(), paused);
    app.fire(VolcanicEvent.RESUME);
    move({ x: -1600, z: -1600 }); step(140);
    assert.equal(crisis.getStatus().geology.events.length, 3);
    assert.equal(crisis.getStatus().hull, 90, 'remote detections do not damage the whole map');
    assert.equal(crisis.getStatus().geology.equipment, 85);
  } finally { crisis.destroy(); }
});

test('rockfall changes routes and swept collisions for both actors; retreat from occupied ground remains possible', () => {
  const { app, crisis, start, step, query } = setup();
  try {
    start();
    const target = crisis.getStatus().target;
    const { rockfall, bypass } = missionLayout(target);
    const from = { x: rockfall.x, z: rockfall.z - 60 }, to = { x: rockfall.x, z: rockfall.z + 60 };
    assert.equal(query(from, to), false);
    step(35);
    assert.equal(crisis.getStatus().geology.routes[0].state, 'falling');
    assert.equal(query(from, to, 2), true, 'astronaut cannot tunnel through fallen rock');
    assert.equal(query(from, to, 30), true, 'Walker uses the same blocking geometry');
    assert.equal(query({ x: bypass.x, z: bypass.z - 30 }, { x: bypass.x, z: bypass.z + 30 }, 30), false);
    const block = rockfallBlocks(target)[2];
    assert.equal(query(block, { x: block.x, z: block.z - 12 }), false, 'no entrapment when rocks fall on the actor');
    assert.equal(query(block, { x: block.x, z: block.z + 0.2 }, 30), false, 'Walker can retreat even when multiple falling blocks overlap its clearance');
    step(4);
    assert.equal(crisis.getStatus().geology.routes[0].state, 'blocked');
    app.fire(GeologicalEvent.ROUTE_SELECT, 'detour');
    assert.equal(crisis.getStatus().geology.selectedRoute, 'detour');
    app.fire(GeologicalEvent.ROUTE_SELECT, 'direct');
    assert.equal(crisis.getStatus().geology.selectedRoute, 'detour', 'blocked route cannot be reselected');
    const [direct, detour] = crisis.getStatus().geology.routes;
    assert.ok(detour.distance > direct.distance);
    assert.ok(detour.energyEstimate > direct.energyEstimate);
  } finally { crisis.destroy(); }
});

test('rescue requires a damaged field relay, nearby Walker and boarding; evacuation succeeds only at the withdrawal point', () => {
  const { app, crisis, start, step, move } = setup();
  try {
    start(); app.fire(GeologicalEvent.EVACUATE);
    assert.equal(crisis.getStatus().geology.evacuating, false, 'no prediction-based evacuation');
    app.fire(GeologicalEvent.RESCUE);
    assert.equal(crisis.getStatus().geology.rescuedCrew, 0);
    step(106);
    app.fire(GeologicalEvent.RESCUE);
    assert.equal(crisis.getStatus().geology.rescuedCrew, 0, 'must reach the refuge');
    const refuge = crisis.getStatus().geology.refuge;
    move({ x: refuge.x - 45, z: refuge.z });
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    app.fire(GeologicalEvent.RESCUE);
    assert.equal(crisis.getStatus().geology.rescuedCrew, 0);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true });
    app.fire(GeologicalEvent.RESCUE);
    assert.equal(crisis.getStatus().geology.rescuedCrew, 2);
    app.fire(GeologicalEvent.EVACUATE);
    const status = crisis.getStatus();
    assert.equal(status.geology.evacuating, true);
    assert.equal(status.target, status.extraction);
    assert.equal(status.fieldRequiresDisembarking, false);
    assert.equal(status.evacuated, false);
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    move(status.extraction);
    assert.equal(crisis.getStatus().evacuated, false, 'cannot evacuate while leaving the astronaut behind');
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: true }); step(0.01);
    assert.equal(crisis.getStatus().evacuated, true);
    assert.equal(crisis.getStatus().phase, 'ended');
    assert.equal(crisis.getStatus().missionCompleted, false, 'withdrawal does not claim a nonexistent scientific sample');
  } finally { crisis.destroy(); }
});

test('operational energy responds to movement; waiting damages nothing between tremors; exhausted power ends the operation', () => {
  const a = setup(), b = setup();
  try {
    a.start(); b.start(); a.step(10); b.move({ x: 120, z: 80 }, 10);
    assert.ok(b.crisis.getStatus().geology.energy < a.crisis.getStatus().geology.energy);
    a.move({ x: -1500, z: -1500 }); a.step(3000);
    assert.equal(a.crisis.getStatus().phase, 'ended');
    assert.equal(a.crisis.getStatus().defeat, 'power');
    assert.equal(a.crisis.getStatus().hull, 100, 'power exhaustion is not fictitious eruption damage');
  } finally { a.crisis.destroy(); b.crisis.destroy(); }
});

test('rock injuries occur only inside the impact area, not whenever an instrument detects a quake', () => {
  const { app, crisis, start, step } = setup();
  let injuries = 0;
  app.on(GeologicalEvent.INJURY, () => injuries++);
  try {
    start();
    app.fire(PlayerEvent.BOARDING_STATE_CHANGED, { isBoarded: false });
    app.fire(PlayerEvent.POSE_UPDATED, { ...missionLayout(crisis.getStatus().target).rockfall, y: 0, headingDeg: 0 });
    step(35); assert.equal(injuries, 1);
    step(160); assert.equal(injuries, 1);
  } finally { crisis.destroy(); }
});

test('prepared 3D scene drops basalt blocks, emits finite impact dust with no persistent smoke', () => {
  const canvas = { id: 'geology-scene', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas);
  const options = new pc.AppOptions(); options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem]; app.init(options);
  app.on(TerrainEvent.SAMPLE_HEIGHT, q => { q.outY = 0; });
  const crisis = new VolcanicFront(app); const scene = new GeologicalScene(app as pc.Application, true);
  crisis.attachSimulation();
  try {
    app.fire(VolcanicEvent.START);
    const rock = app.root.findByName('RockfallBlock_0') as pc.Entity;
    const initial = rock.getPosition().clone();
    const mat = rock.render!.material as pc.StandardMaterial;
    assert.deepEqual(mat.emissive, new pc.Color(0, 0, 0));
    app.fire(InputEvent.AXES, { dt: 34.98 });
    app.fire(InputEvent.AXES, { dt: 0.02 });
    assert.ok(rock.getPosition().y > 12, 'fall begins above the ground rather than spawning a blocking pile');
    // Events are raised by the rule engine; then step the prepared animation at normal frame duration.
    for (let i = 0; i < 200; i++) app.fire(SimulationEvent.STEP, 1 / 60);
    assert.ok(rock.getPosition().y < initial.y - 10);
    assert.ok(rock.getPosition().distance(initial) > 40);
    for (let i = 0; i < 200; i++) app.fire(SimulationEvent.STEP, 1 / 60);
    for (let i = 0; i < 20; i++) assert.equal((app.root.findByName(`ImpactRegolith_${i}`) as pc.Entity).enabled, false);
    app.fire(InputEvent.AXES, { dt: 70 });
    assert.equal(app.root.findByName('FieldRefugeAndSeismometer'), null, 'the old shelter cube was replaced by the dedicated habitat');
  } finally { scene.destroy(); crisis.destroy(); app.destroy(); }
});

test('the real Walker stops before fallen blocks and safe exits keep astronaut clear of the new collision geometry', async () => {
  const { SteampunkWalker } = await import('../walker/SteampunkWalker.ts');
  const { PlayerController } = await import('../astronaut/PlayerController.ts');
  const canvas = { id: 'geology-controllers', width: 1, height: 1 } as HTMLCanvasElement;
  const app = new pc.AppBase(canvas), options = new pc.AppOptions();
  options.graphicsDevice = new pc.NullGraphicsDevice(canvas);
  options.componentSystems = [pc.RenderComponentSystem, pc.ModelComponentSystem, pc.AnimationComponentSystem];
  options.resourceHandlers = [pc.ContainerHandler, pc.TextureHandler]; app.init(options);
  app.assets.load = () => {};
  app.on(TerrainEvent.SAMPLE_HEIGHT, q => { q.outY = 0; });
  const player = new PlayerController(app as pc.Application, true);
  const crisis = new VolcanicFront(app), walker = new SteampunkWalker(app as pc.Application, true);
  crisis.attachSimulation();
  try {
    app.fire(VolcanicEvent.START);
    const { rockfall } = missionLayout(crisis.getStatus().target);
    app.fire(InputEvent.AXES, { dt: 35 });
    walker.resetToGround(rockfall.x, rockfall.z - 65, 0);
    for (let frame = 0; frame < 300; frame++) walker.update(1 / 60, { forward: 1, turn: 0, boost: true });
    assert.ok(walker.kinematics.posZ < rockfall.z - 15, 'movement controller respects rockfall collision');
    player.toggleBoarding();
    assert.equal(player.getBoardingState().isBoarded, false);
    const astronaut = app.root.findByName('ExplorerAstronaut') as pc.Entity;
    const position = astronaut.getPosition();
    const q: CollisionQuery = { fromX: position.x, fromZ: position.z, x: position.x, z: position.z, radius: 2, blocked: false };
    app.fire(GeologicalEvent.COLLISION_QUERY, q);
    assert.equal(q.blocked, false, 'exit placement tests the updated colliders');
  } finally { walker.destroy(); crisis.destroy(); player.destroy(); app.destroy(); }
});
