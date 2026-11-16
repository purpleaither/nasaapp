import { CameraSystem } from '../../systems/CameraSystem.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as pc from 'playcanvas';
import { HabitatController } from './HabitatController.ts';
import { HabitatScene } from './HabitatScene.ts';
import { HABITAT_CONFIG, airlockFrame } from './config.ts';
import { HabitatEvent, type HabitatPlacement } from './events.ts';
import { VolcanicFront } from '../volcanic/VolcanicFront.ts';
import { InputEvent, PlayerEvent, CameraEvent, TerrainEvent, VolcanicEvent, WalkerEvent, sampleHeightViaEvent } from '../../systems/events/worldEvents.ts';
import { actionSeconds } from '../../systems/missions.ts';
import { PlayerController } from '../astronaut/PlayerController.ts';
import { PlayerLifeSupport } from '../astronaut/vitals/PlayerLifeSupport.ts';
import { LifeSupportEvent } from '../astronaut/vitals/events.ts';
import { SteampunkWalker } from '../walker/SteampunkWalker.ts';
import { GeologicalEvent, type CollisionQuery } from '../geological/crisis.ts';
import { shouldRestartBase } from '../../systems/missionRestart.ts';

function setup() {
  const app=new pc.EventHandler(),mission=new VolcanicFront(app as pc.AppBase),habitat=new HabitatController(app as pc.AppBase);
  mission.attachSimulation();
  app.on(HabitatEvent.PLACE_PLAYER,(p:HabitatPlacement)=>{app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:false});app.fire(PlayerEvent.POSE_UPDATED,{...p,y:0});});
  habitat.initialize();
  const cycle=()=>{for(let i=0;i<44;i++)app.fire('update',.1);};
  const step=(dt:number)=>app.fire(InputEvent.AXES,{dt});
  const prepareAndExit=()=>{app.fire(HabitatEvent.PREPARE);app.fire(HabitatEvent.EXIT);cycle();};
  return {app,mission,habitat,cycle,step,prepareAndExit,destroy(){habitat.destroy();mission.destroy();}};
}

test('airlock interlock never opens both doors, with a closed interval during pressure transition',()=>{
  for(const direction of ['exit','enter'] as const)for(let i=0;i<=1000;i++){
    const s=airlockFrame(direction,HABITAT_CONFIG.cycleSeconds*i/1000);
    assert.ok(s.innerOpen<1e-8||s.outerOpen<1e-8);
    if(i>=250&&i<=700){assert.equal(s.innerOpen,0);assert.equal(s.outerOpen,0);}
  }
});

test('preparation is required; the short cycle starts EVA only after opening and safely placing the astronaut',()=>{
  const s=setup();let prepared=0;let placement:HabitatPlacement|undefined;
  s.app.on(LifeSupportEvent.REFILL_OXYGEN,()=>prepared++);s.app.on(HabitatEvent.PLACE_PLAYER,(p:HabitatPlacement)=>{placement=p;});
  try{
    assert.equal(s.habitat.getStatus().location,'inside');assert.equal(s.mission.getStatus().phase,'preparation');
    s.app.fire(HabitatEvent.EXIT);assert.equal(s.habitat.getStatus().cycling,false);
    s.app.fire(HabitatEvent.PREPARE);assert.equal(prepared,1);s.app.fire(HabitatEvent.EXIT);
    assert.equal(s.habitat.getStatus().cycling,true);assert.equal(s.mission.getStatus().phase,'preparation');
    s.cycle();assert.equal(s.habitat.getStatus().location,'outside');assert.equal(s.habitat.getStatus().cycling,false);
    assert.equal(s.mission.getStatus().phase,'operation');assert.equal(placement?.inside,false);
    assert.equal(placement?.x,HABITAT_CONFIG.outsideSpawn.x);assert.equal(placement?.z,HABITAT_CONFIG.outsideSpawn.z);
    s.app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:true});s.app.fire(HabitatEvent.ENTER);assert.equal(s.habitat.getStatus().cycling,false,'rover cannot enter the airlock');
    s.app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:false});s.app.fire(PlayerEvent.POSE_UPDATED,{x:800,z:800,y:0,headingDeg:0});
    s.app.fire(HabitatEvent.ENTER);assert.equal(s.habitat.getStatus().cycling,false,'must return to the actual entry');
    s.app.fire(PlayerEvent.POSE_UPDATED,{...HABITAT_CONFIG.outsideSpawn,y:0});s.app.fire(HabitatEvent.ENTER);
    assert.equal(s.habitat.getStatus().cycling,true);s.app.fire(VolcanicEvent.PAUSE);const before=s.habitat.getStatus();s.cycle();assert.deepEqual(s.habitat.getStatus(),before);
    s.app.fire(VolcanicEvent.RESUME);s.cycle();assert.equal(s.habitat.getStatus().location,'inside');assert.equal(s.habitat.getStatus().label,'Pressurizado');
  }finally{s.destroy();}
});

test('collecting M01 permits return; the activity ends only inside the pressurized base',()=>{
  const s=setup();
  try{
    s.prepareAndExit();const target=s.mission.getStatus().target;
    s.app.fire(WalkerEvent.POSE_UPDATED,{...target,y:0,headingDeg:0});s.app.fire(PlayerEvent.POSE_UPDATED,{...target,y:0,headingDeg:0});
    s.app.fire(VolcanicEvent.COMPLETE_OBJECTIVE,0);
    s.app.fire(VolcanicEvent.FIELD_PHOTO,{index:0,captureId:s.mission.getStatus().fieldActionId,source:'eva',framingValidated:true,image:'data:image/jpeg;base64,dGVzdA=='});
    s.step(actionSeconds('mineral-sampling',0)+.01);
    s.app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:true});s.app.fire(VolcanicEvent.COMPLETE_OBJECTIVE,1);s.step(actionSeconds('mineral-sampling',1)+.01);
    assert.equal(s.mission.getStatus().missionCompleted,true);assert.equal(s.mission.getStatus().fieldActivityCompleted,false);
    assert.equal(s.mission.getStatus().phase,'operation');assert.equal(s.mission.getStatus().returningToHabitat,true);
    assert.equal(s.mission.getStatus().target.x,HABITAT_CONFIG.entrance.x);
    s.app.fire(HabitatEvent.COMPLETE_FIELD);assert.equal(s.mission.getStatus().phase,'operation');
    s.app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:false});s.app.fire(PlayerEvent.POSE_UPDATED,{...HABITAT_CONFIG.outsideSpawn,y:0});s.step(.01);
    assert.equal(s.mission.getStatus().targetDistance,0,'navigation follows the astronaut after leaving the rover');
    s.app.fire(HabitatEvent.ENTER);s.cycle();s.app.fire(HabitatEvent.COMPLETE_FIELD);
    assert.equal(s.mission.getStatus().phase,'ended');assert.equal(s.mission.getStatus().fieldActivityCompleted,true);
    assert.equal(shouldRestartBase(s.mission.getStatus()),false);
    assert.equal(shouldRestartBase({phase:'ended',hull:0,evacuated:false,missionCompleted:true,fieldActivityCompleted:false}),true,'a collected sample alone cannot turn rover destruction into a victory');
  }finally{s.destroy();}
});

function create3D(){
  const canvas={id:'habitat-model',width:1,height:1} as HTMLCanvasElement,app=new pc.AppBase(canvas),options=new pc.AppOptions();
  options.graphicsDevice=new pc.NullGraphicsDevice(canvas);options.componentSystems=[pc.CameraComponentSystem,pc.RenderComponentSystem,pc.ModelComponentSystem,pc.AnimationComponentSystem,pc.LightComponentSystem];options.resourceHandlers=[pc.ContainerHandler,pc.TextureHandler];app.init(options);app.assets.load=()=>{};
  app.on(TerrainEvent.SAMPLE_HEIGHT,q=>{q.outY=0;});
  return app;
}

test('3D habitat has coherent dimensions, independent solar arrays, accessible stairs and fixed-world collisions',()=>{
  const app=create3D(),camera=new CameraSystem(app as pc.Application),scene=new HabitatScene(app as pc.Application,true),player=new PlayerController(app as pc.Application,true),mission=new VolcanicFront(app),walker=new SteampunkWalker(app as pc.Application,true),habitat=new HabitatController(app);
  mission.attachSimulation();habitat.initialize();
  try{
    const initial=scene.root.getPosition().clone(),hull=app.root.findByName('Módulo pressurizado 8m × 4m') as pc.Entity;
    const aabb=hull.render!.meshInstances[0].mesh!.aabb;
    assert.ok(Math.abs(aabb.halfExtents.z*2-8*HABITAT_CONFIG.unitsPerMeter)<.01);assert.ok(Math.abs(aabb.halfExtents.x*2-4*HABITAT_CONFIG.unitsPerMeter)<.01);
    for(const name of ['Porta interna intertravada','Porta externa intertravada','Grelha de limpeza de poeira','Baterias e distribuição elétrica','Radiador exposto','BASE HABITACIONAL','RelaySolarPanel'])assert.ok(app.root.findByName(name),name);
    assert.notEqual(app.root.findByName('RelaySolarPanel')!.parent,hull,'solar bank is not mounted on the hull');
    walker.resetToGround(500,500,0);assert.deepEqual(scene.root.getPosition(),initial,'the base does not follow the vehicle');
    assert.equal((app.root.findByName('ExplorerAstronaut') as pc.Entity).enabled,false,'no floating astronaut or modeled interior during the abstract interior view');
    app.fire(HabitatEvent.PREPARE);app.fire(HabitatEvent.EXIT);for(let i=0;i<44;i++)app.fire('update',.1);
    app.fire(CameraEvent.STATE_UPDATED,{yawDeg:180,camDist:30});
    for(let i=0;i<60;i++)app.fire(InputEvent.AXES,{forward:1,right:0,active:true,shiftBoost:false,dt:1/60});
    const pose=(app.root.findByName('ExplorerAstronaut') as pc.Entity).getPosition();
    assert.ok(pose.z>-80,'astronaut can approach and climb the broad steps');assert.ok(pose.y>0);
    assert.ok(sampleHeightViaEvent(app,HABITAT_CONFIG.center.x,-62)>2.5);
    const q:CollisionQuery={fromX:initial.x-45,fromZ:0,x:initial.x+45,z:0,radius:2,blocked:false};app.fire(GeologicalEvent.COLLISION_QUERY,q);assert.equal(q.blocked,true,'cannot walk through the habitat hull');
    app.fire(VolcanicEvent.STATUS_CHANGED,{...mission.getStatus(),geology:{...mission.getStatus().geology,events:[{id:1},{id:2}]}});
    assert.equal((app.root.findByName('RelayOperationalIndicator') as pc.Entity).enabled,false,'instrument failure remains visible on the new equipment');
  }finally{habitat.destroy();walker.destroy();mission.destroy();player.destroy();scene.destroy();camera.destroy();app.destroy();}
});

test('supplies remain preserved in the base and preparation reuses existing support systems',()=>{
  const oldWindow=globalThis.window;globalThis.window=new EventTarget() as unknown as Window&typeof globalThis;
  const app=new pc.EventHandler(),mission=new VolcanicFront(app as pc.AppBase),life=new PlayerLifeSupport(app as pc.AppBase),habitat=new HabitatController(app as pc.AppBase);
  mission.attachSimulation();
  app.on(HabitatEvent.PLACE_PLAYER,(p:HabitatPlacement)=>{app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:false});app.fire(PlayerEvent.POSE_UPDATED,{...p,y:0});});
  try{
    habitat.initialize();app.fire(VolcanicEvent.START);life.oxygen=30;const before=life.getVitalsData();
    for(let i=0;i<60;i++)app.fire(InputEvent.AXES,{dt:1/60});assert.deepEqual(life.getVitalsData(),before);
    app.fire(HabitatEvent.PREPARE);assert.equal(life.oxygen,100);assert.equal(habitat.getStatus().equipmentReady,true);
  }finally{habitat.destroy();life.dispose();mission.destroy();globalThis.window=oldWindow;}
});
