import * as pc from 'playcanvas';
import { PlayerEvent, SimulationEvent, VolcanicEvent, type VolcanicStatus, type PoseUpdatedPayload } from '../../systems/events/worldEvents.ts';
import { HabitatEvent, type HabitatStatus } from '../habitat/events.ts';
export const SignalEvent = { ACTION: 'signal:action', STATUS: 'signal:status', QUERY: 'signal:query' } as const;
export type SignalAction = 'start' | 'open' | 'close' | 'clean' | 'cancel' | 'battery' | 'transmit';
export class SignalState {
  started = false; open = false; batteries = 1; elapsed = 0; cleaning = false;
  solution: 'clean' | 'battery' | null = null; completed = false;
  act(action: SignalAction, available: boolean) {
    if(action === 'start') { this.started = true; return; }
    if(action === 'close') { this.open = false; return; }
    if(action === 'cancel') { this.cleaning = false; this.elapsed = 0; return; }
    if(!this.started || !available || this.completed) return;
    if(action === 'open') this.open = true;
    if(action === 'clean' && !this.solution && !this.cleaning) { this.cleaning = true; this.elapsed = 0; }
    if(action === 'battery' && !this.solution && !this.cleaning && this.batteries > 0) { this.batteries--; this.solution = 'battery'; }
    if(action === 'transmit' && this.solution) { this.completed = true; this.open = false; }
  }
  step(dt: number, available: boolean) {
    if(!this.cleaning) return;
    if(!available) { this.act('cancel',false); return; }
    if(!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed = Math.min(20,this.elapsed + dt);
    if(this.elapsed === 20) { this.cleaning = false; this.solution = 'clean'; }
  }
}
export type SignalStatus = ReturnType<SignalMission['getStatus']>;
export class SignalMission {
  readonly state = new SignalState();
  private phase: VolcanicStatus['phase'] = 'preparation';
  private boarded = true; private outside = false; private pose = {x:0,z:0};
  private root?: pc.Entity; private dust?: pc.Entity; private lamp?: pc.StandardMaterial;
  private readonly listeners: [string, (...args: any[]) => void][];
  constructor(private app: pc.Application, render = true) {
    if(render) this.build();
    this.listeners = [
      [PlayerEvent.POSE_UPDATED,(p: PoseUpdatedPayload)=>{this.pose=p;this.publish();}],
      [PlayerEvent.BOARDING_STATE_CHANGED,(s: {isBoarded:boolean})=>{this.boarded=s.isBoarded;this.publish();}],
      [HabitatEvent.STATE,(s:HabitatStatus)=>{this.outside=s.location==='outside'&&!s.cycling;this.publish();}],
      [VolcanicEvent.STATUS_CHANGED,(s:VolcanicStatus)=>{this.phase=s.phase;this.publish();}],
      [SignalEvent.ACTION,(a:SignalAction)=>{this.state.act(a,this.available());this.publish();}],
      [SignalEvent.QUERY,(q:{handled:boolean})=>{if(this.state.started&&this.available()&&!this.state.completed){q.handled=true;this.state.act('open',true);this.publish();}}],
      [SimulationEvent.STEP,(dt:number)=>{this.state.step(dt,this.available());this.publish();}],
    ];
    for(const [event,handler] of this.listeners) app.on(event,handler);
  }
  private available(){return this.phase==='operation' && this.outside && !this.boarded && Math.hypot(this.pose.x+180,this.pose.z+44)<35;}
  getStatus(){return {...this.state, available:this.available(), distance:Math.max(0,Math.round(Math.hypot(this.pose.x+180,this.pose.z+44)-35))};}
  private publish(){
    if(this.dust) this.dust.enabled=this.state.solution!=='clean';
    if(this.lamp){this.lamp.emissive.set(this.state.completed?0.1:1,this.state.completed?1:0.02,0.02);this.lamp.update();}
    this.app.fire(SignalEvent.STATUS,this.getStatus());
  }
  private build(){
    const base=this.app.root.findByName('BASE HABITACIONAL · posto científico fixo') as pc.Entity;
    const panel=base?.findByName('RelaySolarPanel') as pc.Entity;
    if(!base||!panel)return;
    const materials:pc.StandardMaterial[]=[];
    const mat=(hex:string)=>{const m=new pc.StandardMaterial();m.diffuse.fromString(hex);m.update();materials.push(m);return m;};
    const metal=mat('#aab4bc'),dark=mat('#26313c'),dust=mat('#a27454');this.lamp=mat('#ff200c');
    this.root=new pc.Entity('Estação · Restabelecer o sinal');base.addChild(this.root);this.root.setLocalPosition(-70,0,-44);
    const shape=(name:string,type: 'box' | 'sphere' | 'cylinder',m:pc.StandardMaterial,parent:pc.Entity,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{const e=new pc.Entity(name);e.addComponent('render',{type,material:m});parent.addChild(e);e.setLocalPosition(x,y,z);e.setLocalScale(sx,sy,sz);return e;};
    shape('Caixa de instrumentos de comunicação','box',metal,this.root,0,4,0,10,8,6);
    shape('Haste de comunicação','cylinder',dark,this.root,6,10,0,.6,20,.6);
    shape('Antena de dados','sphere',metal,this.root,6,20,0,5,1.1,5);
    shape('Luz de transmissão','sphere',this.lamp,this.root,0,7,-3.2,1.5,1.5,1.5);
    this.dust=shape('Poeira sobre as células solares','box',dust,panel,0,.55,0,.98,.3,.98);
    this.root.on('destroy',()=>materials.forEach(m=>m.destroy()));
  }
  destroy(){for(const [event,handler] of this.listeners)this.app.off(event,handler);this.dust?.destroy();this.root?.destroy();}
}
