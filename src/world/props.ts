import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { at, mat, part, signTexture } from './materials';

export const WOOD = 0x6b4a2f;
export const WOOD_DARK = 0x4a3220;
export const ROOF = 0x3d2b1f;
export const STONE = 0x8a857c;
export const WHITEWASH = 0xe6e0d2;

export function roofPrism(w: number, h: number, len: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  return g;
}

export interface HouseOptions {
  w: number;
  d: number;
  h: number;
  wall?: number;
  roof?: number;
  roofH?: number;
  door?: boolean;
  windows?: boolean;
  chimney?: boolean;
  seams?: boolean;
}

/** Log house (drevenica). The door faces +Z. */
export function createHouse(o: HouseOptions): THREE.Group {
  const g = new THREE.Group();
  const wall = o.wall ?? WOOD;
  g.add(at(part(new THREE.BoxGeometry(o.w + 0.3, 0.9, o.d + 0.3), STONE), 0, 0.05, 0));
  g.add(at(part(new THREE.BoxGeometry(o.w, o.h, o.d), wall), 0, o.h / 2 + 0.4, 0));
  if (o.seams ?? wall === WOOD) {
    for (let i = 1; i < 5; i++) {
      g.add(at(part(new THREE.BoxGeometry(o.w + 0.06, 0.05, o.d + 0.06), WOOD_DARK), 0, 0.4 + (o.h * i) / 5, 0));
    }
  }
  const roofH = o.roofH ?? o.w * 0.55;
  g.add(at(part(roofPrism(o.w + 1, roofH, o.d + 1), o.roof ?? ROOF), 0, o.h + 0.4, 0));
  if (o.door ?? true) {
    g.add(at(part(new THREE.BoxGeometry(0.95, 1.8, 0.1), WOOD_DARK), 0, 1.3, o.d / 2 + 0.03));
  }
  if (o.windows ?? true) {
    const wy = 0.4 + o.h * 0.55;
    const addWindow = (x: number, z: number, ry: number): void => {
      const frame = at(part(new THREE.BoxGeometry(0.8, 0.8, 0.08), 0xe8e2d0), x, wy, z, 0, ry, 0);
      const glass = at(part(new THREE.BoxGeometry(0.6, 0.6, 0.1), 0x23262a), x, wy, z, 0, ry, 0);
      g.add(frame, glass);
    };
    addWindow(-o.w / 4 - 0.4, o.d / 2 + 0.03, 0);
    addWindow(o.w / 4 + 0.4, o.d / 2 + 0.03, 0);
    addWindow(o.w / 2 + 0.03, 0, Math.PI / 2);
    addWindow(-o.w / 2 - 0.03, 0, Math.PI / 2);
  }
  if (o.chimney) g.add(at(part(new THREE.BoxGeometry(0.6, 1.6, 0.6), STONE), o.w * 0.2, o.h + roofH * 0.7, -o.d * 0.2));
  return g;
}

export function createBench(len: number): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(len, 0.08, 0.35), WOOD), 0, 0.45, 0));
  for (const x of [-len / 2 + 0.2, len / 2 - 0.2]) g.add(at(part(new THREE.BoxGeometry(0.08, 0.45, 0.3), WOOD_DARK), x, 0.22, 0));
  return g;
}

export function createTable(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(2.0, 0.1, 0.9), WOOD), 0, 0.78, 0));
  for (const [x, z] of [
    [-0.85, -0.35],
    [0.85, -0.35],
    [-0.85, 0.35],
    [0.85, 0.35],
  ]) {
    g.add(at(part(new THREE.BoxGeometry(0.08, 0.78, 0.08), WOOD_DARK), x, 0.39, z));
  }
  g.add(at(part(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 6), 0xd8c7a0), 0.4, 0.91, 0.1));
  g.add(at(part(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6), 0x5b7a3a), -0.5, 0.93, -0.1));
  return g;
}

export function createBarrel(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 9), 0x7a5232), 0, 0.5, 0));
  for (const y of [0.15, 0.85]) g.add(at(part(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 9), 0x3a3a3a), 0, y, 0));
  return g;
}

export function createSign(text: string): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(0.12, 3.2, 0.12), WOOD_DARK), 0, 1.6, 0));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.68, 0.08), [
    mat(WOOD_DARK),
    mat(WOOD_DARK),
    mat(WOOD_DARK),
    mat(WOOD_DARK),
    new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: signTexture(text), roughness: 0.9 }),
  ]);
  board.position.set(0, 2.7, 0.1);
  board.castShadow = true;
  g.add(board);
  return g;
}

export function createKrcma(): THREE.Group {
  const g = createHouse({ w: 12, d: 9, h: 3.4, chimney: true });
  // porch roof
  g.add(at(part(new THREE.BoxGeometry(6, 0.15, 2.4), ROOF), 0, 3.2, 5.6, 0.2, 0, 0));
  for (const x of [-2.8, 2.8]) g.add(at(part(new THREE.BoxGeometry(0.18, 3.0, 0.18), WOOD_DARK), x, 1.6, 6.6));
  return g;
}

export function createChurch(): THREE.Group {
  const g = createHouse({ w: 7, d: 12, h: 5, wall: WHITEWASH, roof: 0x4a3a2c, roofH: 3.8, seams: false });
  const tower = new THREE.Group();
  tower.add(at(part(new THREE.BoxGeometry(3.2, 10, 3.2), WHITEWASH), 0, 5, 0));
  tower.add(at(part(new THREE.ConeGeometry(2.4, 5, 4), 0x2f3a33), 0, 12.5, 0, 0, Math.PI / 4, 0));
  tower.add(at(part(new THREE.BoxGeometry(0.1, 1.2, 0.1), 0xc9a227, { metalness: 0.7 }), 0, 15.6, 0));
  tower.add(at(part(new THREE.BoxGeometry(0.6, 0.1, 0.1), 0xc9a227, { metalness: 0.7 }), 0, 15.7, 0));
  tower.add(at(part(new THREE.BoxGeometry(1, 1.4, 0.1), 0x23262a), 0, 8, 1.62));
  tower.position.set(0, 0, 7.4);
  g.add(tower);
  return g;
}

export function createForge(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [
    [-2.6, -2],
    [2.6, -2],
    [-2.6, 2],
    [2.6, 2],
  ]) {
    g.add(at(part(new THREE.BoxGeometry(0.22, 3, 0.22), WOOD_DARK), x, 1.5, z));
  }
  g.add(at(part(roofPrism(6.6, 1.8, 5.4), ROOF), 0, 3, 0, 0, Math.PI / 2, 0));
  g.add(at(part(new THREE.BoxGeometry(1.6, 1.0, 1.4), STONE), -1.2, 0.5, -1.2));
  g.add(at(part(new THREE.BoxGeometry(1.2, 0.1, 1.0), 0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 2 }), -1.2, 1.02, -1.2));
  g.add(at(part(new THREE.BoxGeometry(0.4, 0.6, 0.3), 0x3a3a3a), 1.0, 0.3, 0));
  g.add(at(part(new THREE.BoxGeometry(0.8, 0.22, 0.32), 0x4a4a4e, { metalness: 0.6 }), 1.0, 0.7, 0));
  // displayed belts on the wall
  g.add(at(part(new THREE.BoxGeometry(3.6, 2.0, 0.15), WOOD), 0, 1.8, -2.1));
  for (let i = 0; i < 3; i++) {
    g.add(at(part(new THREE.BoxGeometry(0.9, 0.18 + i * 0.06, 0.06), 0x5a3820), -1.2 + i * 1.2, 2.0, -1.98));
  }
  return g;
}

export function createHut(): THREE.Group {
  const g = createHouse({ w: 5, d: 4.2, h: 2.3, wall: 0x7a6248, roof: 0x9b8a5a, roofH: 2.2 });
  g.rotation.z = 0.015;
  return g;
}

export function createWell(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.CylinderGeometry(1.0, 1.1, 0.9, 10), STONE), 0, 0.45, 0));
  g.add(at(part(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 10), 0x2c4a5a), 0, 0.8, 0));
  for (const x of [-0.9, 0.9]) g.add(at(part(new THREE.BoxGeometry(0.12, 2.0, 0.12), WOOD_DARK), x, 1.4, 0));
  g.add(at(part(roofPrism(2.4, 0.9, 1.4), ROOF), 0, 2.3, 0, 0, Math.PI / 2, 0));
  return g;
}

// --------------------------------------------------------------------------- Liptovský Mikuláš

const TILE_ROOF = 0x7a3a2a;
const GLASS = 0x23262a;

/** Adds a row of windows on the front (+Z) wall at height y. */
function frontWindows(g: THREE.Group, w: number, d: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * (w / count);
    g.add(at(part(new THREE.BoxGeometry(0.8, 0.95, 0.08), 0xf2ecdc), x, y, d / 2 + 0.03));
    g.add(at(part(new THREE.BoxGeometry(0.58, 0.72, 0.1), GLASS), x, y, d / 2 + 0.03));
  }
}

/** Two-storey plastered burgher house with a tiled roof. The door faces +Z. */
export function createTownHouse(w: number, d: number, wall: number): THREE.Group {
  const h = 4.6;
  const g = createHouse({ w, d, h, wall, roof: TILE_ROOF, roofH: w * 0.5, seams: false, chimney: true });
  frontWindows(g, w, d, 0.4 + h * 0.8, 3);
  // cornice between the floors
  g.add(at(part(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), 0xcfc4ac), 0, 0.4 + h * 0.62, 0));
  return g;
}

/** Radnica with a clock tower. The door faces +Z. */
export function createTownHall(): THREE.Group {
  const w = 12;
  const d = 8;
  const h = 6.2;
  const g = createHouse({ w, d, h, wall: 0xe9dfc6, roof: TILE_ROOF, roofH: 4, seams: false, windows: false });
  frontWindows(g, w, d, 0.4 + h * 0.3, 4);
  frontWindows(g, w, d, 0.4 + h * 0.75, 5);
  // wide portal
  g.add(at(part(new THREE.BoxGeometry(2.2, 2.6, 0.14), WOOD_DARK), 0, 1.7, d / 2 + 0.05));
  const tower = new THREE.Group();
  tower.add(at(part(new THREE.BoxGeometry(3, 15, 3), 0xe9dfc6), 0, 7.5, 0));
  tower.add(at(part(new THREE.ConeGeometry(2.4, 4.5, 4), 0x2f3a33), 0, 17.2, 0, 0, Math.PI / 4, 0));
  tower.add(at(part(new THREE.SphereGeometry(0.3, 6, 4), 0xc9a227, { metalness: 0.7 }), 0, 19.6, 0));
  // clock face with two hands
  tower.add(at(part(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 14), 0xf2ecdc), 0, 12, 1.52, Math.PI / 2, 0, 0));
  tower.add(at(part(new THREE.BoxGeometry(0.08, 0.7, 0.04), 0x1a1410), 0, 12.25, 1.6));
  tower.add(at(part(new THREE.BoxGeometry(0.5, 0.08, 0.04), 0x1a1410), 0.2, 12, 1.6));
  tower.position.set(0, 0, -d / 2 + 1.5);
  g.add(tower);
  return g;
}

export type StallGoods = 'hrnce' | 'kapusta' | 'medovniky' | 'cizmy';

/** Market stall with a striped canopy. Customers stand on the +Z side, the vendor behind it. */
export function createStall(canopy: number, goods: StallGoods): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(3, 0.1, 1.2), WOOD), 0, 0.9, 0.2));
  g.add(at(part(new THREE.BoxGeometry(2.9, 0.85, 0.08), WOOD_DARK), 0, 0.45, 0.78));
  for (const [x, z, hh] of [
    [-1.45, -0.85, 2.5],
    [1.45, -0.85, 2.5],
    [-1.45, 0.8, 2.1],
    [1.45, 0.8, 2.1],
  ]) {
    g.add(at(part(new THREE.BoxGeometry(0.1, hh, 0.1), WOOD_DARK), x, hh / 2, z));
  }
  const cloth = new THREE.Group();
  cloth.add(part(new THREE.BoxGeometry(3.4, 0.05, 2.2), canopy));
  for (const x of [-1.1, 0, 1.1]) cloth.add(at(part(new THREE.BoxGeometry(0.4, 0.06, 2.21), 0xf2ecdc), x, 0, 0));
  cloth.position.set(0, 2.32, 0);
  cloth.rotation.x = 0.18;
  g.add(cloth);
  const geos: THREE.BufferGeometry[] = [];
  let color = 0x9a5a32;
  for (let i = 0; i < 5; i++) {
    const x = -1.1 + i * 0.55;
    switch (goods) {
      case 'hrnce':
        color = 0xa8603a;
        geos.push(new THREE.CylinderGeometry(0.17, 0.12, 0.3, 8).translate(x, 1.1, 0.2));
        geos.push(new THREE.TorusGeometry(0.15, 0.03, 4, 8).rotateX(Math.PI / 2).translate(x, 1.25, 0.2));
        break;
      case 'kapusta':
        color = 0x7fa04a;
        geos.push(new THREE.IcosahedronGeometry(0.2, 0).translate(x, 1.15, 0.05));
        geos.push(new THREE.IcosahedronGeometry(0.18, 0).translate(x + 0.25, 1.13, 0.4));
        break;
      case 'medovniky':
        color = 0x8a4a22;
        geos.push(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 6).rotateX(Math.PI / 2.4).translate(x, 1.12, 0.2));
        break;
      case 'cizmy':
        color = 0x2a1a12;
        geos.push(new THREE.BoxGeometry(0.12, 0.34, 0.14).translate(x, 1.12, 0.1));
        geos.push(new THREE.BoxGeometry(0.12, 0.08, 0.26).translate(x, 0.99, 0.16));
        break;
    }
  }
  const merged = mergeGeometries(geos.map((x) => x.toNonIndexed()), false);
  if (merged) g.add(part(merged, color));
  return g;
}

/** Pranier – the pillory on the square (empty… for now). */
export function createPillory(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(1.6, 0.3, 1.6), STONE), 0, 0.15, 0));
  g.add(at(part(new THREE.BoxGeometry(0.22, 2.6, 0.22), WOOD_DARK), 0, 1.5, 0));
  g.add(at(part(new THREE.BoxGeometry(1.4, 0.32, 0.14), WOOD), 0, 1.75, 0.15));
  for (const x of [-0.45, 0, 0.45]) g.add(at(part(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 6), 0x1a1410), x, 1.75, 0.16, Math.PI / 2, 0, 0));
  return g;
}

// --------------------------------------------------------------------------- Jánošíkove diery

/** Wooden ladder along local +Y, leaning back (towards -Z) by `lean`. `broken` drops two rungs. */
export function createLadder(length: number, lean: number, broken = false): THREE.Group {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.x = -lean;
  g.add(inner);
  for (const x of [-0.32, 0.32]) {
    const rail = part(new THREE.BoxGeometry(0.09, broken && x > 0 ? length * 0.55 : length, 0.09), WOOD);
    rail.position.set(x, broken && x > 0 ? length * 0.275 : length / 2, 0);
    inner.add(rail);
  }
  const rungs: THREE.BufferGeometry[] = [];
  for (let y = 0.3; y < length - 0.1; y += 0.42) {
    if (broken && y > length * 0.35 && y < length * 0.75) continue;
    rungs.push(new THREE.BoxGeometry(0.66, 0.06, 0.07).translate(0, y, 0));
  }
  const merged = mergeGeometries(rungs.map((x) => x.toNonIndexed()), false);
  if (merged) inner.add(part(merged, WOOD_DARK));
  return g;
}

/** Drevorubač's lean-to: a slanted bark roof on two posts with a log pile. */
export function createLeanTo(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.6, 1.6]) g.add(at(part(new THREE.BoxGeometry(0.14, 2.2, 0.14), WOOD_DARK), x, 1.1, 0.9));
  g.add(at(part(new THREE.BoxGeometry(3.8, 0.12, 2.6), 0x5a4632), 0, 1.45, 0, -0.55, 0, 0));
  const logs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const row = i < 3 ? 0 : 1;
    const x = (i % 3) * 0.32 - 0.32 + row * 0.16;
    logs.push(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 7).rotateZ(Math.PI / 2).translate(0, 0.15 + row * 0.27, x));
  }
  const pile = mergeGeometries(logs.map((x) => x.toNonIndexed()), false);
  if (pile) g.add(at(part(pile, 0x7a5232), 2.8, 0, 0.6));
  // stump with the axe stuck in it
  g.add(at(part(new THREE.CylinderGeometry(0.35, 0.4, 0.55, 8), 0x6a4a2a), -2.6, 0.27, 1.6));
  g.add(at(part(new THREE.BoxGeometry(0.05, 0.75, 0.05), WOOD), -2.6, 0.85, 1.6, 0, 0, 0.5));
  g.add(at(part(new THREE.BoxGeometry(0.04, 0.16, 0.22), 0xb9bec4, { metalness: 0.7, roughness: 0.4 }), -2.45, 0.6, 1.6, 0, 0, 0.5));
  return g;
}

/** A dark cave mouth framed by boulders. Opens towards +Z. */
export function createCaveMouth(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(4.6, 3.6, 0.3), 0x0a0908), 0, 1.6, 0));
  const rocks: [number, number, number, number][] = [
    [-2.7, 1.2, 0.4, 1.5],
    [2.7, 1.3, 0.4, 1.6],
    [-1.4, 3.6, 0.5, 1.4],
    [1.2, 3.7, 0.4, 1.5],
    [0, 4.2, 0.2, 1.3],
  ];
  for (const [x, y, z, s] of rocks) {
    const m = part(new THREE.DodecahedronGeometry(s, 0), 0x6f6b64);
    m.position.set(x, y, z);
    m.scale.set(1, 1.1, 0.8);
    g.add(m);
  }
  return g;
}

/** Bed of spruce boughs (čečina) with a rolled sheepskin. */
export function createBedding(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, r] of [
    [-0.9, 0.1],
    [0.9, -0.15],
  ]) {
    g.add(at(part(new THREE.BoxGeometry(1.0, 0.22, 2.1), 0x2f4f2a), x, 0.11, 0, 0, r, 0));
    g.add(at(part(new THREE.CylinderGeometry(0.2, 0.2, 0.9, 7), 0xe8e0cc), x, 0.3, -0.8, 0, r + Math.PI / 2, Math.PI / 2));
  }
  return g;
}

export function createKoliba(): THREE.Group {
  return createHouse({ w: 6, d: 5, h: 2.3, roofH: 3.2, roof: 0x55452f, chimney: true });
}

export function createFenceRing(radius: number, posts: number, gapAngle = 0): THREE.Group {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    if (gapAngle && Math.abs(Math.atan2(Math.sin(a - gapAngle), Math.cos(a - gapAngle))) < 0.25) continue;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    geos.push(new THREE.BoxGeometry(0.12, 1.1, 0.12).translate(x, 0.55, z));
    const a2 = ((i + 1) / posts) * Math.PI * 2;
    if (gapAngle && Math.abs(Math.atan2(Math.sin(a2 - gapAngle), Math.cos(a2 - gapAngle))) < 0.25) continue;
    const x2 = Math.cos(a2) * radius;
    const z2 = Math.sin(a2) * radius;
    const len = Math.hypot(x2 - x, z2 - z);
    for (const y of [0.45, 0.85]) {
      const rail = new THREE.BoxGeometry(len, 0.07, 0.05);
      rail.rotateY(-Math.atan2(z2 - z, x2 - x));
      rail.translate((x + x2) / 2, y, (z + z2) / 2);
      geos.push(rail);
    }
  }
  const g = new THREE.Group();
  const merged = mergeGeometries(geos.map((x) => x.toNonIndexed()), false);
  if (merged) g.add(part(merged, WOOD));
  return g;
}

export function createSheep(): THREE.Group {
  const g = new THREE.Group();
  const wool = at(part(new THREE.IcosahedronGeometry(0.45, 0), 0xeeeae0), 0, 0.65, 0);
  wool.scale.set(1, 0.85, 1.3);
  g.add(wool);
  g.add(at(part(new THREE.BoxGeometry(0.22, 0.24, 0.3), 0x2a2420), 0, 0.78, 0.6));
  for (const [x, z] of [
    [-0.18, -0.3],
    [0.18, -0.3],
    [-0.18, 0.3],
    [0.18, 0.3],
  ]) {
    g.add(at(part(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0x2a2420), x, 0.2, z));
  }
  return g;
}

export function createKotlik(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(at(part(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5), WOOD_DARK), Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55, -Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3));
  }
  g.add(at(part(new THREE.SphereGeometry(0.42, 9, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x2b2b2e, { metalness: 0.5, roughness: 0.5 }), 0, 0.95, 0));
  g.add(at(part(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 9), 0xe8e2cf), 0, 0.92, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(at(part(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5), 0x4a3220), Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2, Math.PI / 2, a, 0));
  }
  return g;
}

export function createVatraPile(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(at(part(new THREE.CylinderGeometry(0.07, 0.11, 1.9, 5), i % 2 ? WOOD : WOOD_DARK), Math.cos(a) * 0.5, 0.85, Math.sin(a) * 0.5, -Math.sin(a) * 0.32, 0, Math.cos(a) * 0.32));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(at(part(new THREE.DodecahedronGeometry(0.28, 0), STONE), Math.cos(a) * 1.6, 0.1, Math.sin(a) * 1.6));
  }
  return g;
}

export function createFlame(): THREE.Group {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 }));
  outer.position.y = 1.1;
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 6), new THREE.MeshBasicMaterial({ color: 0xffd45a }));
  inner.position.y = 0.8;
  g.add(outer, inner);
  return g;
}

export function createDummy(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5), WOOD_DARK), 0, 0.95, 0));
  g.add(at(part(new THREE.BoxGeometry(1.3, 0.08, 0.08), WOOD_DARK), 0, 1.45, 0));
  g.add(at(part(new THREE.CylinderGeometry(0.26, 0.3, 0.75, 7), 0x8a2a2a), 0, 1.25, 0));
  g.add(at(part(new THREE.CylinderGeometry(0.3, 0.32, 0.3, 7), 0xd8c26a), 0, 0.78, 0));
  g.add(at(part(new THREE.IcosahedronGeometry(0.19, 0), 0xd8c26a), 0, 1.8, 0));
  // the "lordly" white wig of the straw nobleman
  g.add(at(part(new THREE.IcosahedronGeometry(0.17, 0), 0xf2efe8), 0, 1.93, -0.04));
  return g;
}

export function createTarget(): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-0.35, 0.35]) g.add(at(part(new THREE.BoxGeometry(0.08, 1.4, 0.08), WOOD_DARK), x, 0.7, 0));
  const rings = [
    [0.55, 0xece6da],
    [0.4, 0xb3261e],
    [0.25, 0xece6da],
    [0.11, 0xb3261e],
  ] as const;
  rings.forEach(([r, c], i) => g.add(at(part(new THREE.CylinderGeometry(r, r, 0.06, 12), c), 0, 1.5, 0.04 + i * 0.012, Math.PI / 2, 0, 0)));
  return g;
}

export function createChest(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(part(new THREE.BoxGeometry(1.1, 0.6, 0.7), 0x6e4426), 0, 0.3, 0));
  g.add(at(part(new THREE.BoxGeometry(1.14, 0.2, 0.74), 0x5a361e), 0, 0.68, 0));
  g.add(at(part(new THREE.BoxGeometry(1.16, 0.06, 0.06), 0x3a3a3a, { metalness: 0.6 }), 0, 0.45, 0.35));
  g.add(at(part(new THREE.BoxGeometry(0.12, 0.14, 0.04), 0xc9a227, { metalness: 0.8 }), 0, 0.55, 0.37));
  return g;
}

export function createCastle(): THREE.Group {
  const g = new THREE.Group();
  const stone = 0x8f8a80;
  const wallSeg = (x: number, z: number, w: number, d: number, h: number): void => {
    g.add(at(part(new THREE.BoxGeometry(w, h, d), stone), x, h / 2, z));
    for (let i = -w / 2 + 0.5; i < w / 2; i += 1.4) {
      if (w > d) g.add(at(part(new THREE.BoxGeometry(0.7, 0.7, d), stone), x + i, h + 0.35, z));
    }
  };
  wallSeg(0, -7, 16, 1.4, 7);
  wallSeg(0, 7, 16, 1.4, 6);
  wallSeg(-8, 0, 1.4, 14, 7.5);
  wallSeg(8, 0, 1.4, 14, 5);
  const tower = (x: number, z: number, h: number): void => {
    g.add(at(part(new THREE.CylinderGeometry(2.2, 2.5, h, 8), stone), x, h / 2, z));
    g.add(at(part(new THREE.ConeGeometry(2.8, 3.5, 8), 0x3d3a35), x, h + 1.75, z));
  };
  tower(-8, -7, 12);
  tower(8, 7, 9);
  g.add(at(part(new THREE.BoxGeometry(6, 14, 6), 0x9a958a), 2, 7, -2));
  g.add(at(part(roofPrism(6.6, 3, 6.6), 0x3d3a35), 2, 14, -2));
  return g;
}

export function createSpruceGeometries(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 5).translate(0, 1.1, 0);
  const cones = [
    new THREE.ConeGeometry(2.0, 3.2, 7).translate(0, 2.6, 0),
    new THREE.ConeGeometry(1.6, 2.8, 7).translate(0, 4.2, 0),
    new THREE.ConeGeometry(1.1, 2.4, 7).translate(0, 5.7, 0),
  ];
  return { trunk, crown: mergeGeometries(cones, false) ?? cones[0] };
}

/** Coach with team of horses. Front faces +Z. */
export function createCoachModel(): { root: THREE.Group; wheels: THREE.Object3D[]; legs: THREE.Object3D[] } {
  const root = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const legs: THREE.Object3D[] = [];
  const body = 0x5a1f1a;
  root.add(at(part(new THREE.BoxGeometry(1.9, 1.5, 2.8), body), 0, 1.65, 0));
  root.add(at(part(new THREE.BoxGeometry(2.1, 0.12, 3.0), 0x2a1a12), 0, 2.46, 0));
  root.add(at(part(new THREE.BoxGeometry(1.95, 0.08, 2.85), 0xc9a227, { metalness: 0.7, roughness: 0.4 }), 0, 1.0, 0));
  for (const sx of [-1, 1]) {
    root.add(at(part(new THREE.BoxGeometry(0.05, 0.6, 1.0), 0x23262a), 0.96 * sx, 1.85, 0));
    root.add(at(part(new THREE.BoxGeometry(0.06, 0.3, 0.3), 0xc9a227, { metalness: 0.7 }), 0.97 * sx, 1.4, 0.9));
  }
  root.add(at(part(new THREE.BoxGeometry(1.6, 0.5, 0.9), 0x2a1a12), 0, 1.25, 1.9));
  for (const [x, z] of [
    [-1.0, -1.0],
    [1.0, -1.0],
    [-1.0, 1.1],
    [1.0, 1.1],
  ]) {
    const w = new THREE.Group();
    w.position.set(x, 0.55, z);
    w.add(at(part(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 10), 0x3a2414), 0, 0, 0, 0, 0, Math.PI / 2));
    w.add(at(part(new THREE.BoxGeometry(0.12, 1.0, 0.08), 0x6b4a2f), 0, 0, 0));
    root.add(w);
    wheels.push(w);
  }
  root.add(at(part(new THREE.BoxGeometry(0.1, 0.1, 2.4), WOOD_DARK), 0, 0.85, 3.3));
  for (const sx of [-0.65, 0.65]) {
    const horse = new THREE.Group();
    horse.position.set(sx, 0, 4.0);
    const coat = sx < 0 ? 0x4a2e1c : 0x1f1a17;
    horse.add(at(part(new THREE.BoxGeometry(0.55, 0.6, 1.5), coat), 0, 1.25, 0));
    horse.add(at(part(new THREE.BoxGeometry(0.3, 0.75, 0.35), coat), 0, 1.7, 0.75, -0.6, 0, 0));
    horse.add(at(part(new THREE.BoxGeometry(0.26, 0.28, 0.6), coat), 0, 2.0, 1.1));
    horse.add(at(part(new THREE.BoxGeometry(0.12, 0.7, 0.1), 0x15110f), 0, 1.25, -0.8, 0.5, 0, 0));
    for (const [lx, lz] of [
      [-0.2, 0.6],
      [0.2, 0.6],
      [-0.2, -0.6],
      [0.2, -0.6],
    ]) {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.95, lz);
      leg.add(at(part(new THREE.BoxGeometry(0.12, 0.95, 0.12), coat), 0, -0.47, 0));
      horse.add(leg);
      legs.push(leg);
    }
    root.add(horse);
  }
  return { root, wheels, legs };
}
