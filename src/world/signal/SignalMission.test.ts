import test from 'node:test';
import assert from 'node:assert/strict';
import { SignalState } from './SignalMission.ts';
test('cleaning cancels without cost, takes 20 active seconds, locks battery and transmits once',()=>{
 const s=new SignalState();s.act('start',true);s.act('clean',true);s.step(10,true);s.act('cancel',true);assert.equal(s.solution,null);assert.equal(s.elapsed,0);assert.equal(s.batteries,1);
 s.act('clean',true);s.step(19.9,true);assert.equal(s.solution,null);s.step(.1,true);assert.equal(s.solution,'clean');s.act('battery',true);assert.equal(s.batteries,1);s.act('transmit',true);s.act('transmit',true);assert.equal(s.completed,true);
});
test('battery is consumed exactly once and transmission completes',()=>{const s=new SignalState();s.act('start',true);s.act('battery',true);s.act('battery',true);s.act('clean',true);assert.equal(s.batteries,0);assert.equal(s.solution,'battery');s.act('transmit',true);assert.equal(s.completed,true);});
test('empty stock disables installation but allows cleaning; distance interrupts maintenance',()=>{const s=new SignalState();s.batteries=0;s.act('start',true);s.act('battery',true);assert.equal(s.solution,null);assert.equal(s.batteries,0);s.act('clean',true);s.step(5,true);s.step(1,false);assert.equal(s.cleaning,false);assert.equal(s.elapsed,0);s.act('clean',true);s.step(20,true);s.act('transmit',true);assert.equal(s.completed,true);});

import * as pc from 'playcanvas';
import { SignalMission, SignalEvent } from './SignalMission.ts';
import { HabitatScene } from '../habitat/HabitatScene.ts';
import { HabitatEvent } from '../habitat/events.ts';
import { PlayerEvent, VolcanicEvent, SimulationEvent } from '../../systems/events/worldEvents.ts';
test('station reuses the existing solar panel and event controls update dust, lamp and objectives',()=>{
 const canvas={id:'signal-test',width:1,height:1} as HTMLCanvasElement;const app=new pc.AppBase(canvas);const options=new pc.AppOptions();options.graphicsDevice=new pc.NullGraphicsDevice(canvas);options.componentSystems=[pc.RenderComponentSystem];app.init(options);
 const habitat=new HabitatScene(app as pc.Application,true);const mission=new SignalMission(app as pc.Application);
 try{
  assert.ok(app.root.findByName('Estação · Restabelecer o sinal'));
  const dust=app.root.findByName('Poeira sobre as células solares') as pc.Entity;assert.equal(dust.parent?.name,'RelaySolarPanel');
  app.fire(VolcanicEvent.STATUS_CHANGED,{phase:'operation',geology:{events:[]}});app.fire(HabitatEvent.STATE,{location:'outside',cycling:false,outerOpen:0,innerOpen:0,label:'Acesso liberado'});app.fire(PlayerEvent.BOARDING_STATE_CHANGED,{isBoarded:false});app.fire(PlayerEvent.POSE_UPDATED,{x:-180,z:-60});
  app.fire(SignalEvent.ACTION,'start');const query={handled:false};app.fire(SignalEvent.QUERY,query);assert.equal(query.handled,true);assert.equal(mission.getStatus().open,true);
  app.fire(SignalEvent.ACTION,'clean');app.fire(SimulationEvent.STEP,20);assert.equal(dust.enabled,false);app.fire(SignalEvent.ACTION,'transmit');assert.equal(mission.getStatus().completed,true);
  const lamp=app.root.findByName('Luz de transmissão') as pc.Entity;assert.ok((lamp.render?.meshInstances[0].material as pc.StandardMaterial).emissive.g>.9);
 }finally{mission.destroy();habitat.destroy();app.destroy();}
});
