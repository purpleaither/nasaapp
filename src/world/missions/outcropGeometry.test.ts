import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutcropGeometry, PHOTO_COMPOSITION, type V3 } from './outcropGeometry.ts';
import { validateOutcropPhoto } from './photoFraming.ts';
const sub = (a: V3, b: V3): V3 => a.map((x,i) => x-b[i]) as V3;
const forward = (eye: V3, target = PHOTO_COMPOSITION.focus): V3 => { const d = sub(target,eye), l = Math.hypot(...d); return d.map(x=>x/l) as V3; };
test('the removed corner is a closed, non overlapping rock mesh; exterior and fracture share their actual boundary', () => {
  const surfaces = buildOutcropGeometry(); const edges = new Map<string, number>();
  for (const surface of Object.values(surfaces)) {
    assert.ok(surface.positions.every(Number.isFinite));
    assert.ok(surface.colors.every(v=>v>=0&&v<=1));
    const point = (i: number) => surface.positions.slice(i*3,i*3+3).map(v=>v.toFixed(5)).join(',');
    for (let i=0;i<surface.indices.length;i+=3) {
      const tri=surface.indices.slice(i,i+3);
      for(let j=0;j<3;j++) { const key=[point(tri[j]),point(tri[(j+1)%3])].sort().join('|');edges.set(key,(edges.get(key)??0)+1); }
    }
  }
  assert.ok([...edges.values()].every(n=>n===2), 'every physical edge is shared by exactly two triangles, including the fracture rim');
  const points = surfaces.exterior.positions;
  for(let i=0;i<points.length;i+=3) assert.ok(!(points[i]>8&&points[i+2]<1), 'the original front right corner is absent');
  assert.ok(surfaces.fracture.positions.length>300);
  const mean=(colors:number[],c:number)=>colors.filter((_,i)=>i%4===c).reduce((a,b)=>a+b,0)/(colors.length/4);
  assert.ok(mean(surfaces.exterior.colors,0)>mean(surfaces.exterior.colors,2)*1.4);
  assert.ok(mean(surfaces.fracture.colors,0)<mean(surfaces.exterior.colors,0));
});
test('one camera frame must see both surfaces and their connecting edge from the front at a usable distance', () => {
  const eye = PHOTO_COMPOSITION.eye;
  assert.equal(validateOutcropPhoto({ origin:eye,forward:forward(eye),up:[0,1,0] }).valid,true);
  for(const origin of [[0,8,25],[1,4,0],[0,9,-80]] as V3[]) assert.equal(validateOutcropPhoto({origin,forward:forward(origin),up:[0,1,0]}).valid,false);
  assert.equal(validateOutcropPhoto({origin:eye,forward:[0,0,-1],up:[0,1,0]}).valid,false);
  assert.equal(validateOutcropPhoto({origin:eye,forward:[0,1,0],up:[0,1,0]}).valid,false);
  assert.equal(validateOutcropPhoto({origin:[NaN,0,0],forward:[0,0,1],up:[0,1,0]}).valid,false);
});
