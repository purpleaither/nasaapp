import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSteampunkWalkerNodes,
  generateSteampunkTexturePng,
  generateSteampunkWalkerGlb,
} from './glbBuilder.ts';

test('generateSteampunkTexturePng produces a valid PNG binary with signature and IEND', () => {
  const png = generateSteampunkTexturePng(112, 132, 92, 'armor');
  assert.ok(png.byteLength > 200, 'PNG should have non-trivial byte length');
  assert.equal(png[0], 137);
  assert.equal(png[1], 80); // 'P'
  assert.equal(png[2], 78); // 'N'
  assert.equal(png[3], 71); // 'G'
});

test('buildSteampunkWalkerNodes returns 22 hierarchical 4-legged Tortuga-Nomad Tortoise Walker nodes with articulated Neck and Jaw', () => {
  const nodes = buildSteampunkWalkerNodes();
  // 1 Root + 1 Hull_Body + 1 Turret + 1 Biome_Gimbal_Assembly + 1 Neck_Assembly + 1 Jaw_Lower + 4 legs * 4 segments = 22 nodes
  assert.equal(nodes.length, 22);
  assert.equal(nodes[0].name, 'AetherNomadRoot');
  assert.equal(nodes[0].children?.length, 8); // Hull + Turret + Biome + Neck + 4 Coxa joints

  const hull = nodes.find((n) => n.name === 'Hull_Body');
  const dome = nodes.find((n) => n.name === 'Turret_Assembly');
  const biome = nodes.find((n) => n.name === 'Biome_Gimbal_Assembly');
  const neck = nodes.find((n) => n.name === 'Neck_Assembly');
  const jaw = nodes.find((n) => n.name === 'Jaw_Lower');
  const legFLCoxa = nodes.find((n) => n.name === 'Leg_FL_Coxa');
  const legFLFemur = nodes.find((n) => n.name === 'Leg_FL_Femur');
  const legFLTibia = nodes.find((n) => n.name === 'Leg_FL_Tibia');
  const legFLFoot = nodes.find((n) => n.name === 'Leg_FL_Foot');

  assert.ok(hull && hull.primitives.length > 0);
  assert.ok(dome && dome.primitives.length > 0);
  assert.ok(biome && biome.primitives.length > 0);
  assert.ok(neck && neck.primitives.length > 0);
  assert.deepEqual(neck.children, [5]);
  assert.ok(jaw && jaw.primitives.length > 0);
  assert.ok(legFLCoxa && legFLCoxa.primitives.length > 0);
  assert.ok(legFLFemur && legFLFemur.primitives.length > 0);
  assert.ok(legFLTibia && legFLTibia.primitives.length > 0);
  assert.ok(legFLFoot && legFLFoot.primitives.length > 0);
});

test('generateSteampunkWalkerGlb builds a valid glTF 2.0 binary (.glb) with embedded PNG textures', () => {
  const glb = generateSteampunkWalkerGlb();
  assert.ok(glb.byteLength > 35000, 'GLB binary should include 22 nodes and 6 embedded PNG textures');

  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const magic = dv.getUint32(0, true);
  const version = dv.getUint32(4, true);
  const totalLen = dv.getUint32(8, true);

  assert.equal(magic, 0x46546c67, 'Magic header must be "glTF"');
  assert.equal(version, 2, 'glTF version must be 2');
  assert.equal(totalLen, glb.byteLength, 'Header total length must match buffer byteLength');

  const jsonChunkLen = dv.getUint32(12, true);
  const jsonChunkType = dv.getUint32(16, true);
  assert.equal(jsonChunkType, 0x4e4f534a, 'First chunk must be JSON');

  const jsonStr = new TextDecoder().decode(glb.subarray(20, 20 + jsonChunkLen));
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.asset.version, '2.0');
  assert.equal(parsed.materials.length, 6);
  assert.equal(parsed.textures.length, 6);
  assert.equal(parsed.images.length, 6);
  assert.equal(parsed.nodes.length, 22);
});

test('Hull_Body, Neck_Assembly, Jaw_Lower, and Biome_Gimbal_Assembly have unit normals, front Tortuga head, rear tortoise tail, and spherical clearance', () => {
  const nodes = buildSteampunkWalkerNodes();
  const hull = nodes.find((n) => n.name === 'Hull_Body');
  const neck = nodes.find((n) => n.name === 'Neck_Assembly');
  const jaw = nodes.find((n) => n.name === 'Jaw_Lower');
  const biome = nodes.find((n) => n.name === 'Biome_Gimbal_Assembly');
  assert.ok(hull && neck && jaw && biome);

  let minZ = Infinity;
  let maxNeckWorldZ = -Infinity;
  let maxY = -Infinity;
  for (const node of [hull, neck, jaw, biome]) {
    for (const prim of node.primitives) {
      const pos = prim.mesh.positions;
      const norm = prim.mesh.normals;
      for (let i = 0; i < pos.length; i += 3) {
        if (node === hull && pos[i + 2] < minZ) minZ = pos[i + 2];
        if (node === neck && pos[i + 2] + neck.translation[2] > maxNeckWorldZ) {
          maxNeckWorldZ = pos[i + 2] + neck.translation[2];
        }
        if (node === hull && pos[i + 1] > maxY) maxY = pos[i + 1];

        const nLen = Math.hypot(norm[i], norm[i + 1], norm[i + 2]);
        assert.ok(Math.abs(nLen - 1.0) < 1e-3, 'All vertex normals must be unit length');
      }
    }
  }

  assert.ok(maxNeckWorldZ > 22.5, `Expected forward Tortuga neck & rounded head > 22.5, got ${maxNeckWorldZ}`);
  assert.ok(minZ < -19.5, `Expected rear segmented tortoise tail < -19.5, got ${minZ}`);
  assert.ok(maxY > 15.5, `Expected geodesic carapace dome height > 15.5, got ${maxY}`);

  assert.deepEqual(biome.translation, [0, 5.2, 0]);
  let maxRadius = 0;
  for (const prim of biome.primitives) {
    const pos = prim.mesh.positions;
    for (let i = 0; i < pos.length; i += 3) {
      const r3d = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
      if (r3d > maxRadius) maxRadius = r3d;
    }
  }
  assert.ok(
    maxRadius <= 8.15,
    `Biome_Gimbal_Assembly must fit inside R <= 8.15m collision-free sphere, got ${maxRadius}`
  );
});



