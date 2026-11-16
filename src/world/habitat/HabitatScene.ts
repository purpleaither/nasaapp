import { translate, subscribeLanguage } from '../../i18n/index.ts';
// BASE HABITACIONAL — instalação fixa modular, sem interior explorável.
import * as pc from 'playcanvas';
import { sampleHeightViaEvent, TerrainEvent, type TerrainHeightQuery, VolcanicEvent, type VolcanicStatus } from '../../systems/events/worldEvents.ts';
import { GeologicalEvent, segmentHitsCircle, type CollisionQuery } from '../geological/crisis.ts';
import { HABITAT_CONFIG } from './config.ts';
import { HabitatEvent, type HabitatStatus } from './events.ts';
export class HabitatScene {
  public readonly root = new pc.Entity('BASE HABITACIONAL · posto científico fixo');
  private materials: pc.StandardMaterial[] = [];
  private textures: pc.Texture[] = [];
  private languageSubscriptions: (()=>void)[] = [];
  private white = this.material('#d1d5d6', 0.08);
  private metal = this.material('#858e92', 0.35, 0.65);
  private dark = this.material('#242d34', 0.15);
  private insulation = this.material('#aeb2af', 0.05);
  private regolith = this.material('#915d41', 0.015);
  private bags = this.material('#8d8270', 0.04);
  private solar = this.material('#1e344b', 0.2, 0.15);
  private deck = this.material('#aaa49a', 0.04);
  private teal = this.material('#74cdb9', 0.1);
  private innerDoor!: pc.Entity;
  private outerDoor!: pc.Entity;
  private statusLamps: pc.Entity[] = [];
  private readonly onState = (s: HabitatStatus) => {
    this.outerDoor.setLocalPosition(s.outerOpen * 21, 11.7, -43);
    this.innerDoor.setLocalPosition(s.innerOpen * 20, 11.7, -26);
    const labels = ['Pressurizado', 'Ciclo em andamento', 'Acesso liberado'];
    this.statusLamps.forEach((lamp, i) => { lamp.enabled = labels[i] === s.label; });
  };
  private readonly onMission = (s: VolcanicStatus) => {
    const panel = this.root.findByName('RelaySolarPanel');
    if (s.geology.events.length >= 2) { panel?.setLocalEulerAngles(20, 0, 9); const signal = this.root.findByName('RelayOperationalIndicator'); if (signal) signal.enabled = false; }
  };
  private readonly onHeight = (q: TerrainHeightQuery) => {
    const x = q.x - HABITAT_CONFIG.center.x, z = q.z - HABITAT_CONFIG.center.z;
    if (Math.abs(x) <= 11 && z <= -38 && z >= -84) {
      // Colisão suavizada sob os degraus: acessível à locomoção existente.
      q.outY = this.root.getPosition().y + (z >= -60 ? 3 : Math.max(0, (z + 84) / 24 * 3));
    }
  };
  private readonly onCollision = (q: CollisionQuery) => {
    const p = this.root.getPosition();
    const circles = [
      ...[-16, -8, 0, 8, 16].map(z=>({ x:0,z,radius:14 })), {x:0,z:-31,radius:9},
      ...[-1,1].flatMap(side=>[-5,8,21].map(z=>({x:side*24,z,radius:8}))),
      {x:-70,z:-18,radius:15},{x:-70,z:8,radius:15},{x:-43,z:14,radius:9},{x:48,z:10,radius:9},
    ].map(c=>({...c,x:c.x+p.x,z:c.z+p.z}));
    const clearance=(x:number,z:number)=>Math.min(...circles.map(c=>Math.hypot(x-c.x,z-c.z)-c.radius-q.radius));
    if(clearance(q.fromX,q.fromZ)<0&&clearance(q.x,q.z)>clearance(q.fromX,q.fromZ)+1e-8)return;
    if(circles.some(c=>segmentHitsCircle(q,c,c.radius)))q.blocked=true;
  };
  constructor(private readonly app: pc.Application, private readonly headless = false) {
    const c=HABITAT_CONFIG.center; this.root.setPosition(c.x,sampleHeightViaEvent(app,c.x,c.z),c.z);app.root.addChild(this.root);
    this.deck.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('diffusePS', `
      uniform vec3 material_diffuse;
      void getAlbedo() {
        float coverage = smoothstep(-0.1, 0.8, sin(vPositionW.x*0.41 + sin(vPositionW.z*0.37))*cos(vPositionW.z*0.27));
        dAlbedo = mix(material_diffuse, vec3(0.49,0.29,0.18), coverage*0.45);
      }
    `);
    this.deck.shaderChunksVersion='2.24';this.deck.update();
    this.build();
    app.on(HabitatEvent.STATE,this.onState);app.on(VolcanicEvent.STATUS_CHANGED,this.onMission);
    app.on(TerrainEvent.SAMPLE_HEIGHT,this.onHeight);app.on(GeologicalEvent.COLLISION_QUERY,this.onCollision);
  }
  private material(hex:string, gloss:number, metalness=0) {
    const m=new pc.StandardMaterial();m.diffuse=new pc.Color().fromString(hex);m.useMetalness=true;m.metalness=metalness;m.gloss=gloss;m.update();this.materials.push(m);return m;
  }
  private shape(name:string,type:'box'|'cylinder'|'sphere'|'cone',m:pc.StandardMaterial,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent=this.root) {
    const e=new pc.Entity(name);e.addComponent('render',{type,material:m,castShadows:!this.headless,receiveShadows:!this.headless});e.setLocalPosition(x,y,z);e.setLocalScale(sx,sy,sz);parent.addChild(e);return e;
  }
  private bar(name:string,a:pc.Vec3,b:pc.Vec3,width:number,m=this.metal,parent=this.root) {
    const e=this.shape(name,'cylinder',m,0,0,0,width,a.distance(b),width,parent);
    e.setLocalPosition(new pc.Vec3().lerp(a,b,.5));e.setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,b.clone().sub(a).normalize()));return e;
  }
  private plaque(text:string,x:number,y:number,z:number,width:number,height:number,east=false) {
    const m=this.material('#e0e5e4',.03);
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');
      if(ctx){
        const t=new pc.Texture(this.app.graphicsDevice,{mipmaps:true});
        const redraw=()=>{ctx.fillStyle='#16252b';ctx.fillRect(0,0,768,192);ctx.fillStyle='#f2f7f5';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 55px sans-serif';ctx.fillText(translate(text),384,96,736);t.setSource(canvas);m.update();};
        m.diffuseMap=t;m.diffuse.set(1,1,1);redraw();this.languageSubscriptions.push(subscribeLanguage(redraw));this.textures.push(t);}
    }
    const right=east?new pc.Vec3(0,0,-1):new pc.Vec3(-1,0,0),up=new pc.Vec3(0,1,0),center=new pc.Vec3(x,y,z),normal=new pc.Vec3().cross(right,up);
    const points=[[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([u,v])=>{const p=center.clone().add(right.clone().mulScalar(u*width/2)).add(up.clone().mulScalar(v*height/2));return [p.x,p.y,p.z];});
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(points);mesh.setNormals(Array.from({length:4},()=>[normal.x,normal.y,normal.z]).flat());mesh.setUvs(0,[0,0,1,0,1,1,0,1]);mesh.setIndices([0,1,2,0,2,3]);mesh.update();
    const e=new pc.Entity(text);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,m,e)],castShadows:false});this.root.addChild(e);return e;
  }
  private hull() {
    const radius=HABITAT_CONFIG.diameterMeters*HABITAT_CONFIG.unitsPerMeter/2;
    const positions:number[]=[],colors:number[]=[],indices:number[]=[];
    const profile=[[-26.8,0],[-26,4.8],[-24,8.8],[-21,11.5],[-17,13.2],[-16.08,radius],[16.08,radius],[17,13.2],[21,11.5],[24,8.8],[26,4.8],[26.8,0]];
    const segments=48;
    for(let row=0;row<profile.length;row++)for(let col=0;col<=segments;col++){
      const [z,r]=profile[row],a=col/segments*Math.PI*2;positions.push(Math.cos(a)*r,16.4+Math.sin(a)*r,z);
      const dust=Math.max(0,-Math.sin(a))*.42+Math.max(0,Math.sin(a))*.06;
      colors.push(.82-dust*.25,.84-dust*.52,.84-dust*.62,1);
      if(row<profile.length-1&&col<segments){const i=row*(segments+1)+col,b=i+segments+1;indices.push(i,i+1,b,i+1,b+1,b);}
    }
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setColors(colors);mesh.setIndices(indices);mesh.update();
    const m=this.material('#ffffff',.06);m.diffuseVertexColor=true;m.update();
    const e=new pc.Entity('Módulo pressurizado 8m × 4m');e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,m,e)],castShadows:!this.headless,receiveShadows:true});this.root.addChild(e);
    // Juntas circulares e painéis longitudinais; nada de grandes janelas.
    for(const z of [-16,-8,0,8,16]) {
      const positions:number[]=[],indices:number[]=[];const radial=48,tube=6;
      for(let i=0;i<=radial;i++)for(let j=0;j<=tube;j++) {
        const a=i/radial*Math.PI*2,b=j/tube*Math.PI*2,r=13.5+Math.cos(b)*.1;
        positions.push(Math.cos(a)*r,16.4+Math.sin(a)*r,z+Math.sin(b)*.1);
        if(i<radial&&j<tube){const k=i*(tube+1)+j,n=k+tube+1;indices.push(k,n,k+1,k+1,n,n+1);}
      }
      const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update();
      const joint=new pc.Entity('Junta circular de painel térmico');joint.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,this.insulation,joint)],castShadows:false,receiveShadows:true});this.root.addChild(joint);
    }
    for(const a of [-.15,1.1,2.1,3.3,4.4,5.4])this.bar('Junta longitudinal',new pc.Vec3(Math.cos(a)*13.5,16.4+Math.sin(a)*13.5,-16),new pc.Vec3(Math.cos(a)*13.5,16.4+Math.sin(a)*13.5,16),.15,this.insulation);
  }
  private chamberShell(name:string, front:number, back:number, outer:number, inner:number, m:pc.StandardMaterial) {
    const profile=[[front,inner],[front,outer],[back,outer],[back,inner]],positions:number[]=[],indices:number[]=[];
    const n=40;
    for(const [z,r] of profile)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;positions.push(Math.cos(a)*r,11.7+Math.sin(a)*r,z);}
    for(let row=0;row<4;row++)for(let i=0;i<n;i++){const a=row*(n+1)+i,b=((row+1)%4)*(n+1)+i;indices.push(a,a+1,b,a+1,b+1,b);}
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update();
    const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,m,e)],castShadows:!this.headless,receiveShadows:true});this.root.addChild(e);return e;
  }
  private berm(side:number) {
    // Regolito sustentado por contenção independente; não repousa sobre uma casca fina.
    const positions:number[]=[],indices:number[]=[];
    for(const z of [-16,29])positions.push(side*15,0,z,side*18,7.5,z,side*25,7,z,side*38,0,z);
    for(let i=0;i<3;i++)indices.push(i,i+4,i+1,i+1,i+4,i+5);
    indices.push(0,1,2,0,2,3,4,6,5,4,7,6);
    const mesh=new pc.Mesh(this.app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(pc.calculateNormals(positions,indices));mesh.setIndices(indices);mesh.update();
    const m=this.regolith; m.cull=pc.CULLFACE_NONE;m.update();const e=new pc.Entity('Berma de regolito com contenção');e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,m,e)],castShadows:!this.headless,receiveShadows:true});this.root.addChild(e);
    for(let row=0;row<3;row++)for(let i=0;i<7;i++)this.shape('Saco estrutural de contenção','box',this.bags,side*17.8,1.2+row*2.25,-13+i*6.6+(row%2)*1.1,3,2.1,6.2);
    for(const z of [-14,7,28])this.shape('Montante da barreira','box',this.metal,side*16.4,4,z,.5,8,.6);
  }
  private build() {
    this.shape('Plataforma estrutural','box',this.deck,0,2.5,-2,36,1,72);
    for(const x of [-16,16])for(const z of [-29,-10,10,29]){
      this.shape('Sapata parcialmente assentada','cylinder',this.regolith,x,.02,z,5,.55,5);
      this.shape('Pé nivelador','cylinder',this.metal,x,1.2,z,1.1,2.5,1.1);
    }
    this.hull();this.berm(-1);this.berm(1);
    this.chamberShell('Câmara cilíndrica de despressurização',-42.6,-21,9,8.5,this.white);
    for(const z of [-23,-40.8])this.chamberShell('Conexão circular reforçada',z-.55,z+.55,9.5,8,this.metal);
    this.chamberShell('Vedação externa',-42,-41.3,8.7,7.7,this.dark);
    this.innerDoor=this.shape('Porta interna intertravada','cylinder',this.insulation,0,11.7,-26,16.2,.8,16.2);this.innerDoor.setLocalEulerAngles(90,0,0);
    this.outerDoor=this.shape('Porta externa intertravada','cylinder',this.white,0,11.7,-43,16,.8,16);this.outerDoor.setLocalEulerAngles(90,0,0);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      this.shape('Trava mecânica da porta','box',this.metal,Math.cos(a)*7.4,11.7+Math.sin(a)*7.4,-43.5,1.6,1.2,1.2);
    }
    this.shape('Patamar de acesso','box',this.deck,0,2.5,-50,24,1,23);
    for(let i=0;i<6;i++)this.shape('Degrau largo acessível','box',this.deck,0,(6-i)*.25,-62-i*4,22,(6-i)*.5,4);
    for(const side of [-1,1]){
      for(const z of [-42,-58,-70,-82]){const top=z>=-60?10:10+(z+60)/8;this.bar('Montante do corrimão',new pc.Vec3(side*11,Math.max(0,top-7),z),new pc.Vec3(side*11,top,z),.45);}
      this.bar('Corrimão do patamar',new pc.Vec3(side*11,10,-42),new pc.Vec3(side*11,10,-60),.55);
      this.bar('Corrimão dos degraus',new pc.Vec3(side*11,10,-60),new pc.Vec3(side*11,7,-84),.55);
    }
    this.shape('Grelha de limpeza de poeira','box',this.dark,0,3.1,-52,15,.15,10);
    for(let i=0;i<7;i++)this.shape('Ranhura da grelha','box',this.metal,-6+i*2,3.23,-52,.25,.12,9);
    this.shape('Escova e armário de limpeza','box',this.insulation,-16,6,-49,4,6,6);
    this.shape('Painel de estado da câmara','box',this.dark,13,12,-41,8,11,1);
    ['Pressurizado','Ciclo em andamento','Acesso liberado'].forEach((label,i)=>{
      this.plaque(label,13,15-i*3,-41.6,7,1.5);
      const m=this.material(i===1?'#e6b964':'#74cdb9',.1);m.emissive.copy(m.diffuse).mulScalar(.7);m.update();
      this.statusLamps.push(this.shape(`Estado · ${label}`,'sphere',m,8.5,15-i*3,-42,1,1,1));
    });
    this.plaque('BASE HABITACIONAL',13.6,20,0,28,5,true);
    this.plaque('EVA · LIMPEZA DE POEIRA',0,5,-58,18,2);
    for(const x of [-9,9]){
      const m=this.material('#d5e9db',.1);m.emissive.set(.35,.45,.4);m.update();this.shape('Luz de orientação','sphere',m,x,11,-44,1.5,1.5,1.5);
      if(!this.headless){const light=new pc.Entity('Luz externa de acesso');light.addComponent('light',{type:'omni',range:40,intensity:.45,color:new pc.Color(.88,.94,1),castShadows:false});light.setLocalPosition(x,13,-46);this.root.addChild(light);}
    }
    // Estruturas de energia separadas do casco, com espaço para manutenção.
    for(const [i,z] of [-18,8].entries()){
      const bank=new pc.Entity('Estrutura solar independente');bank.setLocalPosition(-70,9,z);bank.setLocalEulerAngles(20,0,0);this.root.addChild(bank);
      this.shape(i?'Painel solar auxiliar':'RelaySolarPanel','box',this.solar,0,0,0,26,.6,19,bank);
      for(const x of [-80,-60])this.shape('Suporte solar','cylinder',this.metal,x,4.35,z,.8,8.7,.8);
      for(let col=0;col<6;col++)this.bar('Divisão de células solares',new pc.Vec3(-11+col*4.4,.34,-8.8),new pc.Vec3(-11+col*4.4,.34,8.8),.1,this.insulation,bank);
    }
    this.shape('Baterias e distribuição elétrica','box',this.insulation,-43,5,14,14,10,12);
    this.plaque('BATERIAS · ENERGIA',-43,7,7.8,13,2);
    for(let i=0;i<3;i++)this.shape('Caixa técnica identificada','box',this.white,-42+i*7,2.6,35,6,5,6);
    this.plaque('DADOS · CIÊNCIA',-36,3,31.8,13,2);
    // Eletrocalha protegida no perímetro traseiro, fora do acesso e do estacionamento.
    for(const [a,b] of [[[ -70,0.3,36],[-43,0.3,36]],[[-43,.3,36],[-18,.3,36]],[[-70,.3,-18],[-70,.3,36]]] as const)this.bar('Conduíte protegido',new pc.Vec3(...a),new pc.Vec3(...b),.9,this.dark);
    const radiator=this.shape('Radiador exposto','box',this.white,48,13,10,1,20,27);radiator.setLocalEulerAngles(0,0,0);
    for(const z of [0,20])this.shape('Pé do radiador','box',this.metal,48,2,z,5,4,3);
    for(let i=0;i<7;i++)this.shape('Aleta de radiador','box',this.insulation,48.65,13,-1+i*3.6,.3,18,.25);
    this.shape('Mastro de comunicação','cylinder',this.metal,-43,13,-10,.8,26,.8);
    this.shape('Antena circular','sphere',this.white,-43,27,-10,10,7,1.2).setLocalEulerAngles(-25,-25,0);
    this.shape('RelayOperationalIndicator','sphere',this.teal,-43,25,-10,1.3,1.3,1.3);
    this.shape('SeismometerVacuumCover','sphere',this.white,-30,1,-28,3,2,3);
    // Estacionamento: balizas baixas e sinal no chão, sem cercar o rover.
    for(const x of [73,147])for(const z of [-31,31])this.shape('Baliza de estacionamento','cylinder',this.teal,x,1,z,.8,2,.8);
    this.plaque('ROVER · ESTACIONAMENTO',110,1,-34,36,3);
  }
  public destroy(){this.languageSubscriptions.forEach(unsubscribe=>unsubscribe());this.app.off(HabitatEvent.STATE,this.onState);this.app.off(VolcanicEvent.STATUS_CHANGED,this.onMission);this.app.off(TerrainEvent.SAMPLE_HEIGHT,this.onHeight);this.app.off(GeologicalEvent.COLLISION_QUERY,this.onCollision);this.root.destroy();for(const m of this.materials)m.destroy();for(const t of this.textures)t.destroy();}
}
