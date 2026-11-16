// Pure TypeScript glTF 2.0 Binary (.glb) procedural modeler & PBR texture generator
// Creates a Monumental Walking Martian Base ("METROPOLIS-NOMAD MK.X")
// with the Gigantic Bio-Dome (30m diameter, 16m height) made of Transparent Glass
// enclosing a living Mini-City (skyscrapers, habitat towers, skybridges, green parks, central spire),
// the forward NASA Airlock Entrance & Boarding Ramp, and the original high-arching 4-segment legs.

export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

export interface NodePrimitiveSpec {
  materialIndex: number;
  mesh: MeshData;
}

export interface WalkerNodeSpec {
  name: string;
  translation: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  primitives: NodePrimitiveSpec[];
  children?: number[];
}

export function createEmptyMesh(): MeshData {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

function pushQuad(
  m: MeshData,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  uvScaleX = 1,
  uvScaleY = 1
): void {
  let ux = p1[0] - p0[0];
  let uy = p1[1] - p0[1];
  let uz = p1[2] - p0[2];
  if (Math.hypot(ux, uy, uz) < 1e-6) {
    ux = p2[0] - p0[0];
    uy = p2[1] - p0[1];
    uz = p2[2] - p0[2];
  }
  const vx = p3[0] - p0[0];
  const vy = p3[1] - p0[1];
  const vz = p3[2] - p0[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len > 1e-6) {
    nx /= len;
    ny /= len;
    nz /= len;
  } else {
    ny = 1;
  }

  const baseIdx = m.positions.length / 3;
  m.positions.push(
    p0[0], p0[1], p0[2],
    p1[0], p1[1], p1[2],
    p2[0], p2[1], p2[2],
    p3[0], p3[1], p3[2]
  );
  for (let i = 0; i < 4; i++) {
    m.normals.push(nx, ny, nz);
  }
  m.uvs.push(0, 0, uvScaleX, 0, uvScaleX, uvScaleY, 0, uvScaleY);
  m.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
}

function pushTri(
  m: MeshData,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number]
): void {
  const ux = p1[0] - p0[0];
  const uy = p1[1] - p0[1];
  const uz = p1[2] - p0[2];
  const vx = p2[0] - p0[0];
  const vy = p2[1] - p0[1];
  const vz = p2[2] - p0[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;

  const baseIdx = m.positions.length / 3;
  m.positions.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
  for (let i = 0; i < 3; i++) {
    m.normals.push(nx, ny, nz);
  }
  m.uvs.push(0, 0, 1, 0, 0.5, 1);
  m.indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
}

export function addTaperedBox(
  m: MeshData,
  cx: number,
  cy: number,
  cz: number,
  botW: number,
  botD: number,
  topW: number,
  topD: number,
  h: number,
  topOffsetX = 0,
  topOffsetZ = 0,
  yawRad = 0
): void {
  const y0 = cy - h * 0.5;
  const y1 = cy + h * 0.5;

  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);

  const rot = (x: number, y: number, z: number): [number, number, number] => {
    if (yawRad === 0) return [x, y, z];
    const dx = x - cx;
    const dz = z - cz;
    return [cx + dx * cosY + dz * sinY, y, cz - dx * sinY + dz * cosY];
  };

  const bx0 = cx - botW * 0.5;
  const bx1 = cx + botW * 0.5;
  const bz0 = cz - botD * 0.5;
  const bz1 = cz + botD * 0.5;

  const tx0 = cx + topOffsetX - topW * 0.5;
  const tx1 = cx + topOffsetX + topW * 0.5;
  const tz0 = cz + topOffsetZ - topD * 0.5;
  const tz1 = cz + topOffsetZ + topD * 0.5;

  const b00 = rot(bx0, y0, bz0);
  const b10 = rot(bx1, y0, bz0);
  const b11 = rot(bx1, y0, bz1);
  const b01 = rot(bx0, y0, bz1);

  const t00 = rot(tx0, y1, tz0);
  const t10 = rot(tx1, y1, tz0);
  const t11 = rot(tx1, y1, tz1);
  const t01 = rot(tx0, y1, tz1);

  pushQuad(m, b01, b11, t11, t01);
  pushQuad(m, b10, b00, t00, t10);
  pushQuad(m, b11, b10, t10, t11);
  pushQuad(m, b00, b01, t01, t00);
  pushQuad(m, t01, t11, t10, t00);
  pushQuad(m, b00, b10, b11, b01);
}

export function addBox(
  m: MeshData,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  yawRad = 0
): void {
  addTaperedBox(m, cx, cy, cz, w, d, w, d, h, 0, 0, yawRad);
}

export function addCylinder(
  m: MeshData,
  cx: number,
  cy: number,
  cz: number,
  radiusBot: number,
  radiusTop: number,
  length: number,
  segments = 12,
  axis: 'x' | 'y' | 'z' = 'y'
): void {
  const half = length * 0.5;

  const mapPt = (u: number, v: number, w: number): [number, number, number] => {
    if (axis === 'y') return [cx + v, cy + w, cz + u];
    if (axis === 'z') return [cx + u, cy + v, cz + w];
    return [cx + w, cy + u, cz + v];
  };

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);

    const p00 = mapPt(c0 * radiusBot, s0 * radiusBot, -half);
    const p10 = mapPt(c1 * radiusBot, s1 * radiusBot, -half);
    const p11 = mapPt(c1 * radiusTop, s1 * radiusTop, half);
    const p01 = mapPt(c0 * radiusTop, s0 * radiusTop, half);

    pushQuad(m, p00, p10, p11, p01, 1 / segments, 1);

    if (radiusTop > 0.001) {
      const topCenter = mapPt(0, 0, half);
      pushTri(m, topCenter, p01, p11);
    }
    if (radiusBot > 0.001) {
      const botCenter = mapPt(0, 0, -half);
      pushTri(m, botCenter, p10, p00);
    }
  }
}

export function addOpenRingY(
  m: MeshData,
  cx: number,
  cy: number,
  cz: number,
  outerRadius: number,
  innerRadius: number,
  height: number,
  segments = 20
): void {
  const halfH = height * 0.5;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);

    // Outer wall
    const oBot0: [number, number, number] = [cx + c0 * outerRadius, cy - halfH, cz + s0 * outerRadius];
    const oBot1: [number, number, number] = [cx + c1 * outerRadius, cy - halfH, cz + s1 * outerRadius];
    const oTop1: [number, number, number] = [cx + c1 * outerRadius, cy + halfH, cz + s1 * outerRadius];
    const oTop0: [number, number, number] = [cx + c0 * outerRadius, cy + halfH, cz + s0 * outerRadius];
    pushQuad(m, oBot0, oBot1, oTop1, oTop0, 1 / segments, 1);

    // Inner wall
    const iBot0: [number, number, number] = [cx + c0 * innerRadius, cy - halfH, cz + s0 * innerRadius];
    const iBot1: [number, number, number] = [cx + c1 * innerRadius, cy - halfH, cz + s1 * innerRadius];
    const iTop1: [number, number, number] = [cx + c1 * innerRadius, cy + halfH, cz + s1 * innerRadius];
    const iTop0: [number, number, number] = [cx + c0 * innerRadius, cy + halfH, cz + s0 * innerRadius];
    pushQuad(m, iBot1, iBot0, iTop0, iTop1, 1 / segments, 1);

    // Top rim
    pushQuad(m, oTop0, oTop1, iTop1, iTop0, 1 / segments, 1);
    // Bottom rim
    pushQuad(m, oBot1, oBot0, iBot0, iBot1, 1 / segments, 1);
  }
}

export function addEllipsoid(
  m: MeshData,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  rings = 10,
  slices = 16,
  pitchDeg = 0,
  thetaMin = 0,
  thetaMax = Math.PI,
  zTaper = 0,
  fullQuadUv = false
): void {
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);

  const samplePt = (theta: number, phi: number): [number, number, number] => {
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const taperFactor = 1.0 + zTaper * cosPhi * sinT;
    const lx = rx * sinT * sinPhi * taperFactor;
    const ly = ry * cosT * (1.0 + zTaper * 0.35 * cosPhi * sinT);
    const lz = rz * sinT * cosPhi;

    const py = ly * cosP - lz * sinP;
    const pz = ly * sinP + lz * cosP;
    return [cx + lx, cy + py, cz + pz];
  };

  for (let r = 0; r < rings; r++) {
    const t0 = thetaMin + (r / rings) * (thetaMax - thetaMin);
    const t1 = thetaMin + ((r + 1) / rings) * (thetaMax - thetaMin);

    for (let s = 0; s < slices; s++) {
      const p0 = (s / slices) * Math.PI * 2;
      const p1 = ((s + 1) / slices) * Math.PI * 2;

      const v00 = samplePt(t0, p0);
      const v10 = samplePt(t0, p1);
      const v11 = samplePt(t1, p1);
      const v01 = samplePt(t1, p0);

      pushQuad(
        m,
        v01,
        v11,
        v10,
        v00,
        fullQuadUv ? 1 : 1 / slices,
        fullQuadUv ? 1 : 1 / rings
      );
    }
  }
}

export function addStrut3D(
  m: MeshData,
  p0: [number, number, number],
  p1: [number, number, number],
  wBot: number,
  dBot: number,
  wTop = wBot,
  dTop = dBot
): void {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) return;

  const ax = dx / len;
  const ay = dy / len;
  const az = dz / len;

  // Choose an up-reference vector not parallel to axis
  const upX = 0;
  const upY = Math.abs(ay) < 0.92 ? 1 : 0;
  const upZ = Math.abs(ay) < 0.92 ? 0 : 1;

  // right = normalize(up x axis)
  let rx = upY * az - upZ * ay;
  let ry = upZ * ax - upX * az;
  let rz = upX * ay - upY * ax;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // fwd = axis x right
  const fx = ay * rz - az * ry;
  const fy = az * rx - ax * rz;
  const fz = ax * ry - ay * rx;

  const corner = (
    base: [number, number, number],
    u: number,
    v: number
  ): [number, number, number] => [
    base[0] + rx * u + fx * v,
    base[1] + ry * u + fy * v,
    base[2] + rz * u + fz * v,
  ];

  const hw0 = wBot * 0.5;
  const hd0 = dBot * 0.5;
  const hw1 = wTop * 0.5;
  const hd1 = dTop * 0.5;

  const b00 = corner(p0, -hw0, -hd0);
  const b10 = corner(p0, hw0, -hd0);
  const b11 = corner(p0, hw0, hd0);
  const b01 = corner(p0, -hw0, hd0);

  const t00 = corner(p1, -hw1, -hd1);
  const t10 = corner(p1, hw1, -hd1);
  const t11 = corner(p1, hw1, hd1);
  const t01 = corner(p1, -hw1, hd1);

  pushQuad(m, b01, b11, t11, t01);
  pushQuad(m, b10, b00, t00, t10);
  pushQuad(m, b11, b10, t10, t11);
  pushQuad(m, b00, b01, t01, t00);
  pushQuad(m, t01, t11, t10, t00);
  pushQuad(m, b00, b10, b11, b01);
}

function addLegSpanCylinderX(
  m: MeshData,
  side: -1 | 1,
  distStart: number,
  distEnd: number,
  cy: number,
  cz: number,
  radiusStart: number,
  radiusEnd: number,
  segments = 8
): void {
  const x0 = side * distStart;
  const x1 = side * distEnd;
  const cx = (x0 + x1) * 0.5;
  const len = Math.abs(x1 - x0);
  const rNegX = side === 1 ? radiusStart : radiusEnd;
  const rPosX = side === 1 ? radiusEnd : radiusStart;
  addCylinder(m, cx, cy, cz, rNegX, rPosX, len, segments, 'x');
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

export function encodeUncompressedPng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const rowStride = width * 4 + 1;
  const rawLen = rowStride * height;
  const raw = new Uint8Array(rawLen);
  for (let y = 0; y < height; y++) {
    const outOff = y * rowStride;
    raw[outOff] = 0;
    const inOff = y * width * 4;
    raw.set(rgba.subarray(inOff, inOff + width * 4), outOff + 1);
  }

  const maxBlock = 65535;
  const numBlocks = Math.ceil(rawLen / maxBlock);
  const zlibLen = 2 + rawLen + numBlocks * 5 + 4;
  const zlib = new Uint8Array(zlibLen);
  let zPtr = 0;
  zlib[zPtr++] = 0x78;
  zlib[zPtr++] = 0x01;

  let remaining = rawLen;
  let srcOff = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blkLen = Math.min(maxBlock, remaining);
    remaining -= blkLen;
    const isFinal = remaining === 0 ? 1 : 0;
    zlib[zPtr++] = isFinal;
    zlib[zPtr++] = blkLen & 0xff;
    zlib[zPtr++] = (blkLen >>> 8) & 0xff;
    const nlen = (~blkLen) & 0xffff;
    zlib[zPtr++] = nlen & 0xff;
    zlib[zPtr++] = (nlen >>> 8) & 0xff;
    zlib.set(raw.subarray(srcOff, srcOff + blkLen), zPtr);
    zPtr += blkLen;
    srcOff += blkLen;
  }

  const adler = adler32(raw);
  zlib[zPtr++] = (adler >>> 24) & 0xff;
  zlib[zPtr++] = (adler >>> 16) & 0xff;
  zlib[zPtr++] = (adler >>> 8) & 0xff;
  zlib[zPtr++] = adler & 0xff;

  const makeChunk = (typeStr: string, data: Uint8Array): Uint8Array => {
    const chunk = new Uint8Array(12 + data.length);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = typeStr.charCodeAt(i);
    }
    chunk.set(data, 8);
    const crc = crc32(chunk.subarray(4, 8 + data.length));
    dv.setUint32(8 + data.length, crc, false);
    return chunk;
  };

  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  ihdrDv.setUint32(0, width, false);
  ihdrDv.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = makeChunk('IHDR', ihdr);
  const cIdat = makeChunk('IDAT', zlib);
  const cIend = makeChunk('IEND', new Uint8Array(0));

  const out = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  let p = 0;
  out.set(sig, p); p += sig.length;
  out.set(cIhdr, p); p += cIhdr.length;
  out.set(cIdat, p); p += cIdat.length;
  out.set(cIend, p);
  return out;
}

export function generateSteampunkTexturePng(
  baseR: number,
  baseG: number,
  baseB: number,
  style:
    | 'armor'
    | 'bronzePlate'
    | 'creamDome'
    | 'darkIron'
    | 'brassGold'
    | 'furnace'
    | 'whiteComposite'
    | 'titaniumPlates'
    | 'glassCanopy'
    | 'darkHydraulics'
    | 'hazardGold'
    | 'greenhouseBio'
): Uint8Array {
  const size = 64;
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const borderDist = Math.min(x, y, size - 1 - x, size - 1 - y);
      let panelFactor = 1.0;
      let alpha = 255;

      if (style === 'glassCanopy' || style === 'creamDome') {
        const cx = (x / (size - 1)) * 2 - 1;
        const cy = (y / (size - 1)) * 2 - 1;
        const r = Math.hypot(cx, cy);
        // Holographic Energy Shield Force-Field Cell: ultra-clear plasma center + glowing energy facet seam
        if (borderDist <= 1) {
          alpha = 96;
          panelFactor = 1.32;
        } else if (borderDist === 2) {
          alpha = 56;
          panelFactor = 1.16;
        } else {
          const wave = Math.sin(r * Math.PI * 3.0) * 0.04;
          alpha = Math.round(24 + Math.max(0, r - 0.55) * 28);
          panelFactor = 1.06 + wave;
        }
      } else if (
        style === 'armor' ||
        style === 'whiteComposite' ||
        style === 'bronzePlate' ||
        style === 'titaniumPlates'
      ) {
        if (borderDist <= 1) {
          panelFactor = 0.93;
        } else if (borderDist === 2) {
          panelFactor = 1.04;
        }
      } else if (style === 'furnace' || style === 'greenhouseBio') {
        const cx = (x / (size - 1)) * 2 - 1;
        const cy = (y / (size - 1)) * 2 - 1;
        const r = Math.hypot(cx, cy);
        panelFactor = Math.max(0.85, 1.15 - r * 0.25);
      }

      rgba[idx] = Math.max(0, Math.min(255, Math.round(baseR * panelFactor)));
      rgba[idx + 1] = Math.max(0, Math.min(255, Math.round(baseG * panelFactor)));
      rgba[idx + 2] = Math.max(0, Math.min(255, Math.round(baseB * panelFactor)));
      rgba[idx + 3] = alpha;
    }
  }

  return encodeUncompressedPng(size, size, rgba);
}

export function addTube3D(
  m: MeshData,
  p0: [number, number, number],
  p1: [number, number, number],
  rx0: number,
  ry0: number,
  rx1 = rx0,
  ry1 = ry0,
  segments = 12,
  capEnds = true
): void {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) return;

  const ax = dx / len;
  const ay = dy / len;
  const az = dz / len;

  const upX = 0;
  const upY = Math.abs(ay) < 0.92 ? 1 : 0;
  const upZ = Math.abs(ay) < 0.92 ? 0 : 1;

  // right = normalize(up x axis)
  let rx = upY * az - upZ * ay;
  let ry = upZ * ax - upX * az;
  let rz = upX * ay - upY * ax;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // upOrtho = axis x right
  const ux = ay * rz - az * ry;
  const uy = az * rx - ax * rz;
  const uz = ax * ry - ay * rx;

  const ringPt = (
    base: [number, number, number],
    radX: number,
    radY: number,
    ang: number
  ): [number, number, number] => {
    const c = Math.cos(ang) * radX;
    const s = Math.sin(ang) * radY;
    return [
      base[0] + rx * c + ux * s,
      base[1] + ry * c + uy * s,
      base[2] + rz * c + uz * s,
    ];
  };

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;

    const v00 = ringPt(p0, rx0, ry0, a0);
    const v10 = ringPt(p0, rx0, ry0, a1);
    const v11 = ringPt(p1, rx1, ry1, a1);
    const v01 = ringPt(p1, rx1, ry1, a0);

    pushQuad(m, v00, v10, v11, v01, 1 / segments, 1);

    if (capEnds) {
      if (rx1 > 0.001 && ry1 > 0.001) {
        pushTri(m, p1, v01, v11);
      }
      if (rx0 > 0.001 && ry0 > 0.001) {
        pushTri(m, p0, v10, v00);
      }
    }
  }
}

// ============================================================================
// BIOMECHANICAL TORTOISE MOBILE BASE ("TORTUGA-NOMAD MK.II")
// Inspired by the Wild Kratts Tortuga HQ + Geodesic Gyro-City Bio-Dome:
// 1. Flared Hexagonal Tortoise Carapace Skirt + Closed Olive-Sage Plastron Belly (Zero Ramp!)
// 2. Articulated Tubular Neck (Neck_Assembly) + Friendly Rounded Tortuga Head
// 3. Articulated Lower Jaw (Jaw_Lower) that opens wide as the Mouth Entrance in Base Mode!
// 4. Short Segmented Pointed Mechanical Tortoise Tail (Zero Rear Rocket Thrusters!)
// 5. Translucent Geodesic Carapace Dome + Top Skylight Cap + Internal Gyro Citadel
// 6. 4 Sturdy Flared Tortoise Pillar Legs (FL, RL, FR, RR) that bury into the ground in Base Mode!
// ============================================================================
export function buildSteampunkWalkerNodes(): WalkerNodeSpec[] {
  const hullWhite = createEmptyMesh();      // Mat 0: Tortuga Turquoise-Teal Carapace & Head
  const hullTitanium = createEmptyMesh();   // Mat 1: Dark-Teal Structural Scutes & Foreleg Cuffs
  const hullGlass = createEmptyMesh();      // Mat 2: Translucent Crystal Bio-Dome Canopy
  const hullHydraulics = createEmptyMesh(); // Mat 3: Olive-Sage Plastron, Tubular Neck & Tail
  const hullGold = createEmptyMesh();       // Mat 4: Ivory-Gold Claws, Rings & Trim
  const hullBio = createEmptyMesh();        // Mat 5: Glowing Cyan Cockpit Eyes & Core

  // Node 3: Biome_Gimbal_Assembly pivoted at [0, 5.2, 0]
  const biomeWhite = createEmptyMesh();
  const biomeTitanium = createEmptyMesh();
  const biomeGlass = createEmptyMesh();
  const biomeHydraulics = createEmptyMesh();
  const biomeGold = createEmptyMesh();
  const biomeBio = createEmptyMesh();

  // Node 4: Neck_Assembly pivoted at [0, 0.25, 13.5] (Articulated Tubular Neck + Rounded Upper Head)
  const neckWhite = createEmptyMesh();
  const neckTitanium = createEmptyMesh();
  const neckHydraulics = createEmptyMesh();
  const neckGold = createEmptyMesh();
  const neckBio = createEmptyMesh();

  // Node 5: Jaw_Lower pivoted at [0, 2.02, 4.95] relative to Neck_Assembly (Articulated Mouth/Jaw)
  const jawWhite = createEmptyMesh();
  const jawTitanium = createEmptyMesh();
  const jawHydraulics = createEmptyMesh();
  const jawGold = createEmptyMesh();
  const jawBio = createEmptyMesh();

  // ==========================================================================
  // 1. FLARED TORTOISE CARAPACE RIM & CLOSED PLASTRON UNDERBELLY (Hull_Body)
  // Wide flared marginal scutes overhanging the 4 tortoise leg sockets, with a
  // flat-bottomed, 100% closed olive-sage plastron belly underneath and ZERO ventral ramp!
  // Internal spherical cavity around [0, 5.2, 0] stays strictly R >= 8.75m.
  // ==========================================================================
  const shellRadius = 15.4;

  // Flared Carapace Marginal Rim (wide turquoise-teal shell skirt at y = 0.2m .. 2.2m)
  addOpenRingY(hullTitanium, 0, 0.25, 0.0, shellRadius + 1.15, 11.4, 0.75, 12);
  addOpenRingY(hullWhite, 0, 1.05, 0.0, shellRadius + 0.85, 11.55, 1.05, 12);
  addOpenRingY(hullTitanium, 0, 1.72, 0.0, shellRadius + 0.25, 11.75, 0.42, 12);

  // 12 Flared Marginal Carapace Scutes (beveled tortoise shell skirt plates around perimeter)
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const sinA = Math.sin(ang);
    const cosA = Math.cos(ang);

    addStrut3D(
      hullWhite,
      [sinA * 13.8, 2.35, cosA * 13.8],
      [sinA * 16.6, 0.35, cosA * 16.6],
      3.8,
      0.72,
      4.5,
      0.48
    );
    addStrut3D(
      hullTitanium,
      [sinA * 13.9, 2.42, cosA * 13.9],
      [sinA * 16.7, 0.25, cosA * 16.7],
      0.65,
      0.78,
      0.85,
      0.55
    );
  }

  // Olive-Sage Tortoise Plastron Sidewalls & 100% Closed Flat Plastron Belly (y = -0.2m .. -4.25m)
  addOpenRingY(hullHydraulics, 0, -0.65, 0.0, 14.4, 10.6, 1.25, 12);
  addOpenRingY(hullHydraulics, 0, -1.75, 0.0, 12.8, 9.4, 1.15, 12);
  addOpenRingY(hullTitanium, 0, -2.75, 0.0, 11.2, 8.2, 0.95, 12);

  // SOLID CLOSED TORTOISE PLASTRON FLOOR (y = -3.55m .. -4.25m, 100% closed underneath!)
  addCylinder(hullHydraulics, 0, -3.58, 0.0, 9.2, 10.6, 0.72, 12, 'y');
  addCylinder(hullTitanium, 0, -4.02, 0.0, 7.4, 8.8, 0.36, 10, 'y');
  addCylinder(hullGold, 0, -4.22, 0.0, 4.6, 5.8, 0.16, 8, 'y');

  // Mechanical Ribbed Plastron Panels on the sides between Front & Rear Legs
  for (const side of [-1, 1] as const) {
    addTaperedBox(
      hullHydraulics,
      side * 13.2,
      -1.15,
      0.0,
      2.2,
      9.6,
      2.6,
      10.4,
      1.85
    );
    for (const zRib of [-3.2, -1.6, 0.0, 1.6, 3.2]) {
      addBox(hullTitanium, side * 14.35, -1.15, zRib, 0.45, 1.45, 0.65);
      addBox(hullBio, side * 14.52, -1.15, zRib, 0.18, 0.85, 0.25);
    }
  }

  // Contoured Anterior Neck Collar Socket on Hull_Body (around [0, 0.25, 13.5], zero ramp!)
  addTube3D(
    hullTitanium,
    [0, 0.15, 12.8],
    [0, 0.25, 13.85],
    2.45,
    1.95,
    2.22,
    1.78,
    12
  );
  addTube3D(
    hullWhite,
    [0, 0.45, 12.9],
    [0, 0.52, 13.75],
    2.32,
    1.45,
    2.08,
    1.28,
    12
  );

  // Internal Floor Stator Ring on the inside of the closed plastron floor (y = -3.18m)
  addOpenRingY(hullGold, 0, -3.18, 0.0, 4.5, 3.6, 0.22, 10);
  addCylinder(hullBio, 0, -3.22, 0.0, 2.4, 2.6, 0.14, 10, 'y');

  // 4 Recessed Under-Carapace Tortoise Shoulder/Hip Sockets (FL, RL, FR, RR)
  const hipSockets: Array<{ sx: number; sz: number }> = [
    { sx: 11.8, sz: 8.2 },
    { sx: 11.8, sz: -8.2 },
  ];
  for (const { sx, sz } of hipSockets) {
    for (const side of [-1, 1] as const) {
      addCylinder(hullHydraulics, side * sx, -0.85, sz, 2.25, 2.45, 1.65, 10, 'y');
      addCylinder(hullTitanium, side * sx, -1.15, sz, 1.95, 2.15, 1.25, 10, 'y');
      addCylinder(hullGold, side * sx, -1.45, sz, 1.55, 1.55, 0.28, 10, 'y');
    }
  }

  // ==========================================================================
  // 2. ARTICULATED ORGANIC-BIOMECHANICAL NECK & FRIENDLY TORTUGA HEAD (Neck_Assembly)
  // Pivoted at [0, 0.25, 13.5] on AetherNomadRoot.
  // Uses smooth 12-sided elliptical tubular rings (addTube3D) and contoured
  // ellipsoids (addEllipsoid) instead of blocky rectangular boxes!
  // ==========================================================================
  const neckRings = 6;
  const sampleNeckSpine = (t: number): { y: number; z: number; rx: number; ry: number } => {
    // Smooth S-curve rising from [0, 0, 0] to [0, 2.38, 4.95]
    const smooth = t * t * (3 - 2 * t);
    const z = t * 4.95;
    const y = smooth * 2.38;
    const rx = 2.05 * (1 - t * 0.22);
    const ry = 1.62 * (1 - t * 0.18);
    return { y, z, rx, ry };
  };

  for (let n = 0; n < neckRings; n++) {
    const t0 = n / neckRings;
    const t1 = (n + 1) / neckRings;
    const tm = (t0 + t1) * 0.5;
    const s0 = sampleNeckSpine(t0);
    const s1 = sampleNeckSpine(t1);
    const sm = sampleNeckSpine(tm);

    // Smooth elliptical olive-sage flexible neck tube
    addTube3D(
      neckHydraulics,
      [0, s0.y, s0.z],
      [0, s1.y, s1.z],
      s0.rx,
      s0.ry,
      s1.rx,
      s1.ry,
      12
    );

    // Contoured turquoise-teal dorsal neck shield plate along the upper curve
    addTube3D(
      neckWhite,
      [0, s0.y + 0.22, s0.z + 0.06],
      [0, s1.y + 0.22, s1.z - 0.06],
      s0.rx * 0.88,
      s0.ry * 0.72,
      s1.rx * 0.88,
      s1.ry * 0.72,
      10
    );

    // Sleek rounded dark-teal & gold articulation ring at the segment midpoint
    addTube3D(
      neckTitanium,
      [0, sm.y - 0.02, sm.z - 0.14],
      [0, sm.y + 0.02, sm.z + 0.14],
      sm.rx * 1.05,
      sm.ry * 1.05,
      sm.rx * 1.05,
      sm.ry * 1.05,
      12
    );
  }

  // SLEEK ROUNDED TORTUGA UPPER HEAD & SNOUT (Neck_Assembly local z = 4.4 .. 9.95, y = 2.05 .. 4.65)
  // Upper Cranium Dome (Turquoise-Teal, smooth rounded tortoise head silhouette)
  addEllipsoid(
    neckWhite,
    0,
    2.82,
    6.65,
    2.38,
    1.52,
    2.55,
    6,
    12,
    -4,
    0,
    Math.PI * 0.58,
    -0.14
  );
  // Contoured Upper Snout / Rounded Tortoise Nose (z = 6.5 .. 9.95)
  addEllipsoid(
    neckWhite,
    0,
    2.48,
    8.15,
    1.82,
    1.08,
    1.85,
    6,
    12,
    4,
    0,
    Math.PI * 0.58,
    -0.22
  );
  // Sleek Dark-Teal Dorsal Head Scute Crest
  addEllipsoid(
    neckTitanium,
    0,
    3.48,
    6.45,
    1.45,
    0.95,
    2.15,
    5,
    10,
    -5,
    0,
    Math.PI * 0.52,
    -0.15
  );

  // Friendly Panoramic Cyan Cockpit Eyes / Visor Domes on Left & Right Sides of the Head
  for (const side of [-1, 1] as const) {
    addEllipsoid(
      neckBio,
      side * 1.02,
      2.95,
      7.65,
      0.82,
      0.52,
      1.15,
      5,
      10,
      -8,
      0,
      Math.PI * 0.68
    );
    // Smooth dark-teal eye socket trim
    addEllipsoid(
      neckTitanium,
      side * 0.98,
      3.18,
      7.55,
      0.86,
      0.34,
      1.18,
      4,
      10,
      -10,
      0,
      Math.PI * 0.52
    );
    // Cute rounded nostril vents at the tip of the snout
    addCylinder(neckTitanium, side * 0.38, 2.52, 9.75, 0.14, 0.14, 0.22, 8, 'z');
  }

  // Iconic Circular Ear-Pod Searchlight Drums on Left & Right Temples of the Head
  for (const side of [-1, 1] as const) {
    const ex = side * 2.26;
    const ey = 2.92;
    const ez = 5.85;
    addCylinder(neckTitanium, ex, ey, ez, 0.92, 0.92, 0.48, 10, 'x');
    addCylinder(neckWhite, ex + side * 0.16, ey, ez, 0.76, 0.76, 0.38, 10, 'x');
    addCylinder(neckBio, ex + side * 0.28, ey, ez, 0.48, 0.48, 0.20, 10, 'x');
    addCylinder(neckGold, ex, ey, ez + 0.58, 0.24, 0.20, 0.32, 8, 'z');
  }

  // Upper Mouth Roof & Glowing Internal Airlock Portal (visible when Jaw_Lower opens in Base Mode!)
  addTaperedBox(neckTitanium, 0, 2.25, 6.85, 2.8, 3.6, 2.1, 3.2, 0.28);
  addCylinder(neckBio, 0, 2.52, 5.35, 1.15, 1.15, 0.36, 10, 'z');
  addCylinder(neckGold, 0, 2.52, 5.32, 1.32, 1.32, 0.24, 10, 'z');

  // ==========================================================================
  // 2B. ARTICULATED LOWER JAW & MOUTH ENTRANCE (Jaw_Lower)
  // Child of Neck_Assembly, pivoted at the jaw hinge [0, 2.02, 4.95].
  // Closes flush against the upper head in Walker Mode (0 deg) and hinges open
  // down to the ground in Base Mode (+32 deg) as the Tortuga's mouth entrance!
  // ==========================================================================
  // Smooth Rounded Olive-Sage Lower Chin & Jaw Underside (local z = 0.0 .. 4.75)
  addEllipsoid(
    jawHydraulics,
    0,
    0.08,
    2.25,
    1.88,
    0.66,
    2.42,
    5,
    12,
    0,
    Math.PI * 0.46,
    Math.PI,
    -0.20
  );
  // Contoured Turquoise-Teal Lower Lip Rim
  addEllipsoid(
    jawWhite,
    0,
    0.14,
    2.30,
    1.95,
    0.40,
    2.48,
    4,
    12,
    0,
    Math.PI * 0.44,
    Math.PI * 0.78,
    -0.20
  );
  // Interior Mouth Floor / Boarding Tongue Walkway Deck with Glowing Guide Strips
  addTaperedBox(jawTitanium, 0, 0.12, 2.30, 2.55, 4.15, 1.75, 4.15, 0.14);
  for (const side of [-1, 1] as const) {
    addStrut3D(
      jawGold,
      [side * 1.05, 0.18, 0.45],
      [side * 0.72, 0.18, 4.25],
      0.16,
      0.10,
      0.14,
      0.10
    );
    addStrut3D(
      jawBio,
      [side * 0.85, 0.19, 0.55],
      [side * 0.56, 0.19, 4.15],
      0.10,
      0.08,
      0.08,
      0.08
    );
  }

  // ==========================================================================
  // 3. SHORT POINTED MECHANICAL TORTOISE TAIL (Rear at z = -14.2m .. -20.4m)
  // Replaces the rocket thruster with a 4-segment pointed Tortuga tail!
  // ==========================================================================
  const tailSegments = 4;
  for (let t = 0; t < tailSegments; t++) {
    const f0 = t / tailSegments;
    const f1 = (t + 1) / tailSegments;
    const tz0 = -14.0 - f0 * 6.2;
    const ty0 = -0.35 + f0 * 0.95;
    const tz1 = -14.0 - f1 * 6.2;
    const ty1 = -0.35 + f1 * 0.95;
    const tw0 = 1.45 * (1 - f0 * 0.85);
    const th0 = 0.95 * (1 - f0 * 0.85);
    const tw1 = Math.max(0.12, 1.45 * (1 - f1 * 0.92));
    const th1 = Math.max(0.10, 0.95 * (1 - f1 * 0.92));

    addTube3D(
      t % 2 === 0 ? hullHydraulics : hullTitanium,
      [0, ty0, tz0],
      [0, ty1, tz1],
      tw0,
      th0,
      tw1,
      th1,
      10
    );
  }

  // ==========================================================================
  // 4. HOLOGRAPHIC ENERGY SHIELD DOME (Attached to Hull_Body, ZERO Metal Cage/Grid!)
  // Replaces the heavy metal dome lattice with a pure translucent cyan-aqua
  // Energy Force-Field Dome projected from the carapace rim emitters!
  // ==========================================================================
  const domeRadius = 14.4;
  const domeHeight = 15.6;

  // Base Energy Shield Projector Channel Ring along the upper Carapace Rim (y = 1.75m .. 2.05m)
  addOpenRingY(hullGold, 0, 1.78, 0.0, 14.58, 13.88, 0.18, 12);
  addOpenRingY(hullBio, 0, 1.92, 0.0, 14.48, 13.96, 0.22, 12);

  // 6 Compact Perimeter Field Projector Nodes on the Carapace Rim (projecting the shield upward)
  for (let eIdx = 0; eIdx < 6; eIdx++) {
    const eAng = (eIdx / 6) * Math.PI * 2 + Math.PI / 6;
    const ex = Math.sin(eAng) * 14.45;
    const ez = Math.cos(eAng) * 14.45;
    addCylinder(hullTitanium, ex, 1.95, ez, 0.62, 0.48, 0.45, 8, 'y');
    addCylinder(hullGold, ex, 2.22, ez, 0.46, 0.36, 0.18, 8, 'y');
    addCylinder(hullBio, ex, 2.42, ez, 0.34, 0.16, 0.28, 8, 'y');
  }

  // Unobstructed Geodesic Energy Force-Field Dome (zero metal latitude rings or meridian bars!)
  addEllipsoid(
    hullGlass,
    0,
    1.4,
    0.0,
    domeRadius,
    domeHeight,
    domeRadius,
    8,
    12,
    0,
    0,
    Math.PI * 0.50,
    0,
    true
  );

  // ==========================================================================
  // 5. AUTO-LEVELING GYROSCOPIC CITADEL ACROPOLIS (Biome_Gimbal_Assembly at [0, 5.2, 0])
  // Unified low-poly citadel + Cardan gyroscope & sub-deck pendulum core!
  // Strictly within R <= 8.0m around [0, 5.2, 0] so it never touches the shell.
  // ==========================================================================
  addOpenRingY(biomeTitanium, 0, 0.0, 0.0, 7.96, 7.32, 0.48, 12);
  addOpenRingY(biomeGold, 0, 0.0, 0.0, 7.99, 7.72, 0.22, 12);

  for (let gIdx = 0; gIdx < 4; gIdx++) {
    const gAng = (gIdx / 4) * Math.PI * 2;
    const gx = Math.sin(gAng);
    const gz = Math.cos(gAng);
    addCylinder(
      biomeGold,
      gx * 7.65,
      0.0,
      gz * 7.65,
      0.34,
      0.34,
      0.75,
      6,
      gIdx % 2 === 0 ? 'z' : 'x'
    );
    addStrut3D(
      biomeTitanium,
      [gx * 7.15, -0.15, gz * 7.15],
      [gx * 2.65, -2.15, gz * 2.65],
      0.55,
      0.32,
      0.42,
      0.26
    );
  }

  // Lower Armored Gyroscopic Pendulum & Gravity Core (local Y = -0.25m .. -3.35m)
  addCylinder(biomeTitanium, 0, -0.52, 0.0, 5.1, 6.95, 0.78, 8, 'y');
  addCylinder(biomeHydraulics, 0, -1.28, 0.0, 2.9, 4.9, 0.76, 8, 'y');
  addOpenRingY(biomeGold, 0, -1.68, 0.0, 3.6, 2.95, 0.26, 8);
  addCylinder(biomeBio, 0, -2.25, 0.0, 1.35, 2.25, 0.82, 8, 'y');
  addCylinder(biomeTitanium, 0, -2.92, 0.0, 0.35, 1.25, 0.68, 8, 'y');

  // Fortified 12-Sided Citadel Acropolis Deck (r = 7.15m)
  addCylinder(biomeWhite, 0, 0.14, 0.0, 7.15, 7.02, 0.32, 12, 'y');
  addCylinder(biomeHydraulics, 0, 0.32, 0.0, 6.65, 6.65, 0.10, 12, 'y');
  addOpenRingY(biomeTitanium, 0, 0.46, 0.0, 7.12, 6.68, 0.28, 12);
  addOpenRingY(biomeGold, 0, 0.64, 0.0, 7.05, 6.78, 0.12, 12);

  addCylinder(biomeTitanium, 0, 0.58, 0.0, 4.25, 3.95, 0.45, 8, 'y');
  addCylinder(biomeWhite, 0, 0.92, 0.0, 3.85, 3.65, 0.26, 8, 'y');
  addOpenRingY(biomeGold, 0, 1.08, 0.0, 3.72, 3.42, 0.12, 8);

  // 4 Chiseled Low-Poly Bastion Ward Towers + Skybridges
  for (let bIdx = 0; bIdx < 4; bIdx++) {
    const bAng = (bIdx / 4) * Math.PI * 2;
    const bx = Math.sin(bAng) * 4.95;
    const bz = Math.cos(bAng) * 4.95;

    addTaperedBox(biomeTitanium, bx, 0.72, bz, 2.05, 2.05, 1.75, 1.75, 0.75, 0, 0, bAng);
    addTaperedBox(
      biomeWhite,
      bx,
      2.25,
      bz,
      1.62,
      1.62,
      1.12,
      1.12,
      2.35,
      -Math.sin(bAng) * 0.28,
      -Math.cos(bAng) * 0.28,
      bAng
    );
    addBox(biomeGold, bx * 0.97, 1.85, bz * 0.97, 1.58, 0.22, 1.58, bAng);
    addBox(biomeBio, bx * 0.95, 2.65, bz * 0.95, 1.38, 0.22, 1.38, bAng);
    addTaperedBox(
      biomeTitanium,
      bx * 0.94,
      3.62,
      bz * 0.94,
      1.22,
      1.22,
      0.45,
      0.45,
      0.48,
      0,
      0,
      bAng
    );

    const sx = Math.sin(bAng) * 3.05;
    const sz = Math.cos(bAng) * 3.05;
    addBox(biomeTitanium, sx, 2.35, sz, 0.78, 0.26, 2.3, bAng);
    addBox(biomeGold, sx, 2.52, sz, 0.56, 0.14, 2.3, bAng);
    addBox(biomeWhite, sx * 1.15, 0.38, sz * 1.15, 1.15, 0.08, 3.2, bAng);

    const pAng = bAng + Math.PI * 0.25;
    const px = Math.sin(pAng) * 4.85;
    const pz = Math.cos(pAng) * 4.85;
    addCylinder(biomeTitanium, px, 0.52, pz, 1.25, 1.10, 0.35, 6, 'y');
    addCylinder(biomeBio, px, 1.05, pz, 1.02, 0.22, 0.75, 6, 'y');
    addCylinder(biomeGold, px, 1.52, pz, 0.22, 0.04, 0.25, 6, 'y');

    addStrut3D(
      biomeTitanium,
      [Math.sin(pAng) * 3.25, 0.95, Math.cos(pAng) * 3.25],
      [Math.sin(pAng) * 1.35, 4.15, Math.cos(pAng) * 1.35],
      0.42,
      0.62,
      0.28,
      0.42
    );
  }

  // Central Command Spire & Solar Obelisk (x = 0, z = 0, y = 1.0m .. 7.15m)
  addCylinder(biomeWhite, 0, 2.25, 0.0, 2.15, 1.68, 2.4, 8, 'y');
  addCylinder(biomeGold, 0, 1.85, 0.0, 2.12, 2.12, 0.26, 8, 'y');
  addCylinder(biomeBio, 0, 2.65, 0.0, 1.88, 1.88, 0.26, 8, 'y');
  addCylinder(biomeTitanium, 0, 3.55, 0.0, 2.15, 1.85, 0.36, 8, 'y');
  addCylinder(biomeWhite, 0, 4.65, 0.0, 1.52, 1.02, 1.9, 8, 'y');
  addCylinder(biomeGold, 0, 4.55, 0.0, 1.42, 1.42, 0.26, 8, 'y');
  addCylinder(biomeBio, 0, 5.85, 0.0, 0.95, 0.28, 0.95, 8, 'y');
  addCylinder(biomeGold, 0, 6.68, 0.0, 0.28, 0.05, 0.78, 6, 'y');

  // ==========================================================================
  // 6. NODE 2: TURRET_ASSEMBLY (Floating Apex Energy Shield Harmonic Crown)
  // Hovering plasma stabilizer ring at the zenith of the Energy Shield Dome (zero cross-bars!)
  // ==========================================================================
  const dishWhite = createEmptyMesh();
  const dishTitanium = createEmptyMesh();
  const dishWindows = createEmptyMesh();
  const dishGold = createEmptyMesh();
  const dishBio = createEmptyMesh();

  addOpenRingY(dishGold, 0, 0.92, 0, 2.35, 1.95, 0.14, 12);
  addOpenRingY(dishBio, 0, 1.02, 0, 2.22, 1.85, 0.18, 12);
  addEllipsoid(dishWindows, 0, 0.85, 0, 2.15, 0.48, 2.15, 4, 12, 0, 0, Math.PI * 0.48, 0, true);
  addCylinder(dishBio, 0, 1.28, 0, 0.45, 0.08, 0.46, 8, 'y');
  addCylinder(dishGold, 0, 1.05, 0, 0.58, 0.42, 0.20, 8, 'y');

  // ==========================================================================
  // 7. FOUR 2-SEGMENT HEAVY TORTOISE PILLAR LEGS (Nodes 6..21: FL, RL, FR, RR)
  // True 2-segment Tortuga leg anatomy (zero 3rd spider segment!):
  // - Hip Swivel Socket (Coxa, 1.2m recessed under carapace)
  // - Segment 1: Ribbed Upper Thigh (Femur, 7.2m) -> Single Rounded Knee Joint
  // - Segment 2: Wide Continuous Conical Tortoise Foreleg Shell (Tibia, 8.8m)
  //   terminating directly in the flat Ground Sole + 4 Front Claws (Foot at tip, 0m offset)!
  // ==========================================================================
  const coxaLen = 1.2;
  const femurLen = 7.6;
  const tibiaLen = 9.2;

  const buildTortoiseLegNodes = (
    namePrefix: string,
    side: -1 | 1,
    hipPos: [number, number, number]
  ): {
    coxaSpec: WalkerNodeSpec;
    femurSpec: WalkerNodeSpec;
    tibiaSpec: WalkerNodeSpec;
    footSpec: WalkerNodeSpec;
  } => {
    // --- COXA (Recessed Shoulder Swivel Socket under Carapace, length 1.2m) ---
    const coxaWhite = createEmptyMesh();
    const coxaTitanium = createEmptyMesh();
    const coxaHydraulics = createEmptyMesh();
    const coxaGold = createEmptyMesh();

    addCylinder(coxaHydraulics, 0, 0, 0, 1.45, 1.45, 1.65, 10, 'y');
    addLegSpanCylinderX(coxaHydraulics, side, 0.0, coxaLen, 0, 0, 1.38, 1.28, 10);
    addCylinder(coxaTitanium, side * coxaLen, 0, 0, 1.28, 1.28, 1.75, 10, 'z');
    addCylinder(coxaGold, side * coxaLen, 0, 0, 0.72, 0.72, 1.92, 8, 'z');

    // --- SEGMENT 1: FEMUR (Ribbed Olive-Sage Tortoise Upper Thigh, length 7.2m) ---
    const femurWhite = createEmptyMesh();
    const femurTitanium = createEmptyMesh();
    const femurHydraulics = createEmptyMesh();
    const femurGold = createEmptyMesh();

    // Thick ribbed tortoise upper leg cylinder + 3 segmented mechanical rings
    addLegSpanCylinderX(femurHydraulics, side, 0.1, femurLen, 0, 0, 1.35, 1.46, 10);
    for (const frac of [0.25, 0.52, 0.78]) {
      const rx = side * (femurLen * frac);
      addLegSpanCylinderX(
        femurTitanium,
        side,
        femurLen * frac - 0.18,
        femurLen * frac + 0.18,
        0,
        0,
        1.48,
        1.48,
        10
      );
      addBox(femurGold, rx, 0.0, 0, 0.22, 2.6, 2.6);
    }

    // Single Rounded Tortoise Knee Joint at [side * 7.2, 0, 0]
    const kneeX = side * femurLen;
    addCylinder(femurTitanium, kneeX, 0, 0, 1.56, 1.56, 1.90, 10, 'z');
    addCylinder(femurWhite, kneeX, 0.25, 0, 1.45, 1.45, 2.00, 10, 'z');

    // --- SEGMENT 2: TIBIA (Continuous Flared Conical Tortoise Foreleg Shell, length 8.8m) ---
    // Goes directly from the Knee Joint all the way down to the ground sole (zero 3rd segment!)
    const tibiaWhite = createEmptyMesh();
    const tibiaTitanium = createEmptyMesh();
    const tibiaHydraulics = createEmptyMesh();
    const tibiaGold = createEmptyMesh();

    // Continuous flared Turquoise-Teal Foreleg Shell (0.0m .. 6.2m, flaring from r = 1.48m to 2.22m)
    addLegSpanCylinderX(tibiaWhite, side, 0.0, 6.2, 0, 0, 1.48, 2.22, 10);
    // Lower Dark-Teal Flared Foreleg Cuff Band (6.1m .. 8.8m, flaring from r = 2.20m to 2.48m at ground)
    addLegSpanCylinderX(tibiaTitanium, side, 6.1, tibiaLen, 0, 0, 2.20, 2.48, 10);
    // Subtle gold trim seam on the foreleg cuff
    addLegSpanCylinderX(tibiaGold, side, 6.02, 6.22, 0, 0, 2.24, 2.26, 10);
    addLegSpanCylinderX(tibiaHydraulics, side, tibiaLen - 0.35, tibiaLen, 0, 0, 2.35, 2.42, 10);

    // --- FOOT SOLE & 4 CLAWS (Mounted directly at the bottom tip of Segment 2, 0m extra length!) ---
    const footTitanium = createEmptyMesh();
    const footWhite = createEmptyMesh();
    const footHydraulics = createEmptyMesh();
    const footGold = createEmptyMesh();

    // Wide Flat Olive-Sage & Dark-Teal Tortoise Foot Sole centered at [0, 0, 0] (end of Tibia)
    addCylinder(footHydraulics, 0, 0.22, 0, 2.68, 2.45, 0.76, 10, 'y');
    addCylinder(footTitanium, 0, 0.56, 0, 2.52, 2.32, 0.42, 10, 'y');
    addCylinder(footWhite, 0, 0.78, 0, 2.35, 2.15, 0.22, 10, 'y');

    // 4 Sculpted Ivory-Gold Front Tortoise Toe Claws along the front (+Z) of the foot sole!
    for (const clawAngle of [-0.55, -0.18, 0.18, 0.55]) {
      const cx = Math.sin(clawAngle) * 1.98 + side * 0.25;
      const cz = Math.cos(clawAngle) * 2.22;
      addTaperedBox(
        footGold,
        cx,
        0.10,
        cz,
        0.72,
        0.96,
        0.30,
        0.48,
        0.68,
        Math.sin(clawAngle) * 0.22,
        0.38,
        clawAngle
      );
    }

    return {
      coxaSpec: {
        name: `${namePrefix}_Coxa`,
        translation: hipPos,
        primitives: [
          { materialIndex: 0, mesh: coxaWhite },
          { materialIndex: 1, mesh: coxaTitanium },
          { materialIndex: 3, mesh: coxaHydraulics },
          { materialIndex: 4, mesh: coxaGold },
        ],
      },
      femurSpec: {
        name: `${namePrefix}_Femur`,
        translation: [side * coxaLen, 0, 0],
        primitives: [
          { materialIndex: 0, mesh: femurWhite },
          { materialIndex: 1, mesh: femurTitanium },
          { materialIndex: 3, mesh: femurHydraulics },
          { materialIndex: 4, mesh: femurGold },
        ],
      },
      tibiaSpec: {
        name: `${namePrefix}_Tibia`,
        translation: [side * femurLen, 0, 0],
        primitives: [
          { materialIndex: 0, mesh: tibiaWhite },
          { materialIndex: 1, mesh: tibiaTitanium },
          { materialIndex: 3, mesh: tibiaHydraulics },
          { materialIndex: 4, mesh: tibiaGold },
        ],
      },
      footSpec: {
        name: `${namePrefix}_Foot`,
        translation: [side * tibiaLen, 0, 0],
        primitives: [
          { materialIndex: 0, mesh: footWhite },
          { materialIndex: 1, mesh: footTitanium },
          { materialIndex: 3, mesh: footHydraulics },
          { materialIndex: 4, mesh: footGold },
        ],
      },
    };
  };

  // 4 Quadruped Tortoise Legs (Front-Left, Rear-Left, Front-Right, Rear-Right)
  const legConfigs: Array<{
    namePrefix: string;
    side: -1 | 1;
    hipPos: [number, number, number];
  }> = [
    { namePrefix: 'Leg_FL', side: -1, hipPos: [-11.8, -1.1, 8.2] },
    { namePrefix: 'Leg_RL', side: -1, hipPos: [-11.8, -1.1, -8.2] },
    { namePrefix: 'Leg_FR', side: 1, hipPos: [11.8, -1.1, 8.2] },
    { namePrefix: 'Leg_RR', side: 1, hipPos: [11.8, -1.1, -8.2] },
  ];

  const nodes: WalkerNodeSpec[] = [
    {
      name: 'AetherNomadRoot',
      translation: [0, 0, 0],
      primitives: [],
      children: [1, 2, 3, 4],
    },
    {
      name: 'Hull_Body',
      translation: [0, 0, 0],
      primitives: [
        { materialIndex: 0, mesh: hullWhite },
        { materialIndex: 1, mesh: hullTitanium },
        { materialIndex: 2, mesh: hullGlass },
        { materialIndex: 3, mesh: hullHydraulics },
        { materialIndex: 4, mesh: hullGold },
        { materialIndex: 5, mesh: hullBio },
      ],
    },
    {
      name: 'Turret_Assembly',
      translation: [0, 15.8, 0.0],
      primitives: [
        { materialIndex: 0, mesh: dishWhite },
        { materialIndex: 1, mesh: dishTitanium },
        { materialIndex: 2, mesh: dishWindows },
        { materialIndex: 4, mesh: dishGold },
        { materialIndex: 5, mesh: dishBio },
      ],
    },
    {
      name: 'Biome_Gimbal_Assembly',
      translation: [0, 5.2, 0],
      primitives: [
        { materialIndex: 0, mesh: biomeWhite },
        { materialIndex: 1, mesh: biomeTitanium },
        { materialIndex: 2, mesh: biomeGlass },
        { materialIndex: 3, mesh: biomeHydraulics },
        { materialIndex: 4, mesh: biomeGold },
        { materialIndex: 5, mesh: biomeBio },
      ],
    },
    {
      name: 'Neck_Assembly',
      translation: [0, 0.25, 13.5],
      primitives: [
        { materialIndex: 0, mesh: neckWhite },
        { materialIndex: 1, mesh: neckTitanium },
        { materialIndex: 3, mesh: neckHydraulics },
        { materialIndex: 4, mesh: neckGold },
        { materialIndex: 5, mesh: neckBio },
      ],
      children: [5],
    },
    {
      name: 'Jaw_Lower',
      translation: [0, 2.02, 4.95],
      primitives: [
        { materialIndex: 0, mesh: jawWhite },
        { materialIndex: 1, mesh: jawTitanium },
        { materialIndex: 3, mesh: jawHydraulics },
        { materialIndex: 4, mesh: jawGold },
        { materialIndex: 5, mesh: jawBio },
      ],
    },
  ];

  for (const cfg of legConfigs) {
    const { coxaSpec, femurSpec, tibiaSpec, footSpec } = buildTortoiseLegNodes(
      cfg.namePrefix,
      cfg.side,
      cfg.hipPos
    );
    const coxaIdx = nodes.length;
    const femurIdx = coxaIdx + 1;
    const tibiaIdx = coxaIdx + 2;
    const footIdx = coxaIdx + 3;

    coxaSpec.children = [femurIdx];
    femurSpec.children = [tibiaIdx];
    tibiaSpec.children = [footIdx];

    nodes[0].children!.push(coxaIdx);
    nodes.push(coxaSpec, femurSpec, tibiaSpec, footSpec);
  }

  return nodes;
}

// ============================================================================
// Binary glTF 2.0 (.GLB) Assembler with Embedded Tortuga PBR PNG Textures
// ============================================================================
export function generateSteampunkWalkerGlb(): Uint8Array {
  const nodesSpec = buildSteampunkWalkerNodes();

  const pngTextures: Uint8Array[] = [
    generateSteampunkTexturePng(64, 192, 168, 'whiteComposite'),  // 0: Tortuga Turquoise-Teal Carapace & Head
    generateSteampunkTexturePng(36, 108, 100, 'titaniumPlates'),  // 1: Deep Teal Foreleg Cuffs & Scute Ribs
    generateSteampunkTexturePng(82, 232, 255, 'glassCanopy'),     // 2: Holographic Cyan-Aqua Energy Shield Force-Field
    generateSteampunkTexturePng(116, 146, 108, 'darkHydraulics'), // 3: Olive-Sage Plastron, Ribbed Neck & Tail
    generateSteampunkTexturePng(212, 232, 168, 'hazardGold'),     // 4: Pale Mint-Gold Toe Claws & Gimbal Rings
    generateSteampunkTexturePng(135, 245, 255, 'greenhouseBio'),  // 5: Glowing Ice-Cyan Brow Visors & Bio Core
  ];

  const materialDefs = [
    { name: 'TortugaTealCarapace', metallic: 0.18, roughness: 0.42 },
    { name: 'DeepTealScuteFrame', metallic: 0.35, roughness: 0.38 },
    {
      name: 'GlassCanopy',
      metallic: 0.05,
      roughness: 0.12,
      emissive: [0.16, 0.72, 0.92],
      alphaMode: 'BLEND',
    },
    { name: 'OliveSagePlastronAndNeck', metallic: 0.25, roughness: 0.48 },
    {
      name: 'TortugaClawsAndGyroTrim',
      metallic: 0.45,
      roughness: 0.32,
    },
    {
      name: 'GlowingCyanVisorAndBio',
      metallic: 0.15,
      roughness: 0.28,
      emissive: [0.65, 1.25, 1.35],
    },
  ];

  const bufferViews: Array<{
    buffer: number;
    byteOffset: number;
    byteLength: number;
    target?: number;
  }> = [];
  const accessors: Array<{
    bufferView: number;
    componentType: number;
    count: number;
    type: string;
    min?: number[];
    max?: number[];
  }> = [];
  const meshes: Array<{
    name: string;
    primitives: Array<{
      attributes: { POSITION: number; NORMAL: number; TEXCOORD_0: number };
      indices: number;
      material: number;
    }>;
  }> = [];

  const binChunks: Uint8Array[] = [];
  let currentByteOffset = 0;

  const appendBin = (bytes: Uint8Array, target?: number): number => {
    const pad = (4 - (bytes.length % 4)) % 4;
    const bvIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: currentByteOffset,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    binChunks.push(bytes);
    currentByteOffset += bytes.length;
    if (pad > 0) {
      binChunks.push(new Uint8Array(pad));
      currentByteOffset += pad;
    }
    return bvIndex;
  };

  const gltfNodes: Array<{
    name: string;
    translation: [number, number, number];
    mesh?: number;
    children?: number[];
  }> = [];

  for (const n of nodesSpec) {
    const validPrims = n.primitives.filter((p) => p.mesh.indices.length > 0);
    let meshIdx: number | undefined;

    if (validPrims.length > 0) {
      const gltfPrims = validPrims.map((prim) => {
        const posArr = new Float32Array(prim.mesh.positions);
        const normArr = new Float32Array(prim.mesh.normals);
        const uvArr = new Float32Array(prim.mesh.uvs);
        const idxArr = new Uint16Array(prim.mesh.indices);

        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < posArr.length; i += 3) {
          if (posArr[i] < min[0]) min[0] = posArr[i];
          if (posArr[i + 1] < min[1]) min[1] = posArr[i + 1];
          if (posArr[i + 2] < min[2]) min[2] = posArr[i + 2];
          if (posArr[i] > max[0]) max[0] = posArr[i];
          if (posArr[i + 1] > max[1]) max[1] = posArr[i + 1];
          if (posArr[i + 2] > max[2]) max[2] = posArr[i + 2];
        }

        const posBv = appendBin(new Uint8Array(posArr.buffer), 34962);
        const posAcc = accessors.length;
        accessors.push({
          bufferView: posBv,
          componentType: 5126,
          count: posArr.length / 3,
          type: 'VEC3',
          min,
          max,
        });

        const normBv = appendBin(new Uint8Array(normArr.buffer), 34962);
        const normAcc = accessors.length;
        accessors.push({
          bufferView: normBv,
          componentType: 5126,
          count: normArr.length / 3,
          type: 'VEC3',
        });

        const uvBv = appendBin(new Uint8Array(uvArr.buffer), 34962);
        const uvAcc = accessors.length;
        accessors.push({
          bufferView: uvBv,
          componentType: 5126,
          count: uvArr.length / 2,
          type: 'VEC2',
        });

        const idxBv = appendBin(new Uint8Array(idxArr.buffer), 34963);
        const idxAcc = accessors.length;
        accessors.push({
          bufferView: idxBv,
          componentType: 5123,
          count: idxArr.length,
          type: 'SCALAR',
        });

        return {
          attributes: {
            POSITION: posAcc,
            NORMAL: normAcc,
            TEXCOORD_0: uvAcc,
          },
          indices: idxAcc,
          material: prim.materialIndex,
        };
      });

      meshIdx = meshes.length;
      meshes.push({
        name: `${n.name}_Mesh`,
        primitives: gltfPrims,
      });
    }

    gltfNodes.push({
      name: n.name,
      translation: n.translation,
      ...(meshIdx !== undefined ? { mesh: meshIdx } : {}),
      ...(n.children && n.children.length > 0 ? { children: n.children } : {}),
    });
  }

  const images = pngTextures.map((png, idx) => {
    const bv = appendBin(png);
    return {
      name: `Tex_${materialDefs[idx].name}`,
      bufferView: bv,
      mimeType: 'image/png',
    };
  });

  const samplers = [
    {
      magFilter: 9729,
      minFilter: 9729,
      wrapS: 10497,
      wrapT: 10497,
    },
  ];

  const textures = images.map((_, idx) => ({
    sampler: 0,
    source: idx,
  }));

  const materials = materialDefs.map((m, idx) => ({
    name: m.name,
    doubleSided: false,
    pbrMetallicRoughness: {
      baseColorTexture: { index: idx },
      metallicFactor: m.metallic,
      roughnessFactor: m.roughness,
    },
    ...(m.emissive ? { emissiveFactor: m.emissive } : {}),
    ...(m.alphaMode ? { alphaMode: m.alphaMode } : {}),
  }));

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'MetropolisNomad Procedural Monumental Glass Dome City GLB Modeler',
    },
    scene: 0,
    scenes: [{ name: 'MetropolisNomadScene', nodes: [0] }],
    nodes: gltfNodes,
    meshes,
    materials,
    textures,
    images,
    samplers,
    accessors,
    bufferViews,
    buffers: [{ byteLength: currentByteOffset }],
  };

  const jsonEncoder = new TextEncoder();
  const jsonBytes = jsonEncoder.encode(JSON.stringify(gltfJson));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunkLen = jsonBytes.length + jsonPad;

  const binChunkLen = currentByteOffset;
  const totalByteLength = 12 + 8 + jsonChunkLen + 8 + binChunkLen;

  const glb = new Uint8Array(totalByteLength);
  const dv = new DataView(glb.buffer);

  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalByteLength, true);

  dv.setUint32(12, jsonChunkLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) {
    glb[20 + jsonBytes.length + i] = 0x20;
  }

  const binHeaderOff = 20 + jsonChunkLen;
  dv.setUint32(binHeaderOff, binChunkLen, true);
  dv.setUint32(binHeaderOff + 4, 0x004e4942, true);

  let writePtr = binHeaderOff + 8;
  for (const chunk of binChunks) {
    glb.set(chunk, writePtr);
    writePtr += chunk.length;
  }

  return glb;
}
