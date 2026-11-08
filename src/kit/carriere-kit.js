// Quarry machines built in code, all facing +x with the wheels / tracks on y = 0 (used by La Carrière):
// big excavators (bucket or hydraulic hammer), the rigid haul truck, the wheel loader, the drill rig,
// the water truck, the road tipper and belt conveyors.
import * as THREE from 'three';
import { V3, clamp, rnd } from './util.js';
import { MT, std, dummy, grp, add, box, rbox, ext, extY, cylX, cylY, cylZ, rod, rail, sph, anchor, arc, shadows, freeze, instanced } from './geo.js';
import { trackUnit, tire, fender, hydraulic, telescopic, glassCab, truckCab, operator } from './parts.js';
import { tw } from './tween.js';
import { decal } from './aircraft.js';

export const QM = {
  hammer: std(0x2e3138, 0.5, 0.5), plant: std(0x3f7fc8, 0.45, 0.3), plantD: std(0x2c5b94, 0.5, 0.3),
  plantIn: std(0x6a6d72, 0.7, 0.4, { side: THREE.DoubleSide }), galv: std(0xaab2bc, 0.4, 0.7), belt: std(0x1f2126, 0.9, 0),
  tank: std(0xf4f5f8, 0.35, 0.2), stone: std(0xa89d88, 0.95, 0), stoneD: std(0x857a6a, 0.95, 0), wear: std(0x6e6a64, 0.6, 0.5),
  grate: std(0x4a4e58, 0.6, 0.5), conc: std(0xb9b6ae, 0.92, 0)
};
/** Merge the still meshes of a group (moving children must be added afterwards). */
export const bake = (g) => { shadows(g); freeze(g); return g; };
/** A flat bar between two points of the x/y plane (thick in y, wide in z). */
export function slab(p, a, b, t, w, m, z = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const s = box(p, L, t, w, m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z); s.rotation.z = Math.atan2(dy, dx); return s;
}

/* ---------- big mining tyre: block lugs ---------- */
const LUG = new THREE.BoxGeometry(1, 1, 1);
export function otrTire(p, R, w, x, y, z, rimM, side) {
  const g = tire(p, R * 0.93, w, x, y, z, rimM, side, MT.rubberS);
  const n = Math.round(R * 15), im = new THREE.InstancedMesh(LUG, MT.rubberS, n * 2);
  for (let i = 0; i < n; i++) [0, 1].forEach((j) => {
    const a = ((i + j * 0.5) / n) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94, (j ? 1 : -1) * w * 0.24);
    dummy.rotation.set(0, 0, a); dummy.scale.set(R * 0.13, R * 0.22, w * 0.46); dummy.updateMatrix(); im.setMatrixAt(i * 2 + j, dummy.matrix);
  });
  im.castShadow = true; im.receiveShadow = true; g.add(im); freeze(g); g.userData.r = R; return g;
}

/* ---------- a little pile of rocks (for buckets and bodies) ---------- */
const ROCK = new THREE.IcosahedronGeometry(1, 0);
/** A lumpy dome (flat bottom), for heaps of broken rock. */
export const HEAP = (() => {
  const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453, f = 1 + (h - Math.floor(h) - 0.5) * 0.3; p.setXYZ(i, x * f, Math.max(0, y) * f, z * f); }
  g.computeVertexNormals(); return g;
})();
/** A lumpy boulder. */
export const BOULDER = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = Math.sin(x * 9.17 + y * 51.3 + z * 23.9) * 23758.5453, f = 1 + (h - Math.floor(h) - 0.5) * 0.45; p.setXYZ(i, x * f, y * f, z * f); }
  g.computeVertexNormals(); return g;
})();
export function rockHeap(p, x, y, z, sx, sy, sz, m, n = 7) {
  const g = grp(p, x, y, z);
  const base = add(g, HEAP, m || QM.stone); base.scale.set(sx, sy, sz);
  for (let i = 0; i < n; i++) { const r = add(g, ROCK, i % 2 ? QM.stoneD : m || QM.stone, rnd(-0.6, 0.6) * sx, sy * rnd(0.55, 0.8), rnd(-0.6, 0.6) * sz); r.scale.setScalar(rnd(0.16, 0.3) * Math.min(sx, sz)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  return g;
}

/* ================= excavator (bucket or hydraulic hammer) ================= */
/**
 * o: { k: scale, cab: +1 / -1 (side of the cab), tool: 'bucket' | 'hammer' }.
 * Returns { g, tur, boom, stick, tool, tracks, cab, links, tip, heap, reach(x, y, phi), pose } — reach() places the
 * tool pivot at (x, y) in the turret plane (base units) with the tool pointing at the angle phi.
 */
export function excavator(p, o = {}) {
  const k = o.k || 1, cs = o.cab || 1, M = MT.yel, MD = MT.yelD;
  const g = grp(p); g.scale.setScalar(k);
  const raw = [1, -1].map((s) => trackUnit(g, { len: 4.6, r: 0.46, w: 0.72, z: s * 1.38, guard: true }));
  const tracks = raw.map((t) => ({ g: t.g, update: (dx) => t.update(dx / k) }));
  const u = grp(g);
  rbox(u, 2.3, 0.5, 2.0, 0.08, MT.dark, 0, 0.74, 0); cylY(u, 0.82, 0.2, MT.black, 0, 1.02, 0, 24);
  [1, -1].forEach((s) => { rbox(u, 0.5, 0.07, 0.34, 0.02, MT.dark, 0.9, 1.0, s * 1.38, 0.01); rbox(u, 0.12, 0.3, 0.3, 0.03, MT.yel, 2.05, 0.75, s * 1.38, 0.01); });
  bake(u);
  const tur = grp(g, 0, 1.12, 0), d = grp(tur);
  rbox(d, 4.3, 0.3, 2.9, 0.06, MT.dark, -0.45, 0.15, 0);
  // counterweight: rounded back with stripes and tail lights
  extY(d, [[-1.75, -1.45], [-1.75, 1.45], [-2.35, 1.45], [-2.8, 0.95], [-2.93, 0], [-2.8, -0.95], [-2.35, -1.45]], 0.3, 1.05, M, 0, 0.82, 0);
  rbox(d, 0.04, 0.2, 1.5, 0.02, MT.stripes, -2.94, 0.62, 0, 0.01);
  [0.75, -0.75].forEach((z) => rbox(d, 0.05, 0.1, 0.22, 0.02, MT.tail, -2.9, 1.12, z, 0.01));
  // engine compartment across the back, with louvres, exhaust stack and air cleaner
  rbox(d, 1.75, 0.88, 2.86, 0.12, M, -0.95, 0.74, 0);
  [1, -1].forEach((s) => { for (let i = 0; i < 8; i++) box(d, 0.05, 0.44, 0.02, MT.black, -1.6 + i * 0.16, 0.74, s * 1.43); });
  for (let i = 0; i < 6; i++) box(d, 0.08, 0.02, 1.0, MT.black, -1.5 + i * 0.2, 1.19, -cs * 0.55);
  cylY(d, 0.08, 0.75, MT.black, -1.25, 1.55, -cs * 0.95, 10); cylY(d, 0.1, 0.06, MT.black, -1.25, 1.94, -cs * 0.95, 10);
  cylY(d, 0.17, 0.42, MT.dark, -0.55, 1.36, -cs * 1.0, 14); cylY(d, 0.19, 0.06, MT.black, -0.55, 1.58, -cs * 1.0, 14);
  // pump / tool compartment opposite the cab, with door lines and a handrail along the top
  rbox(d, 1.3, 0.88, 1.06, 0.1, M, 0.55, 0.74, -cs * 0.88);
  for (let i = 0; i < 3; i++) box(d, 0.02, 0.6, 0.04, MT.black, 0.15 + i * 0.4, 0.74, -cs * 1.41);
  rbox(d, 0.18, 0.05, 0.03, 0.01, MT.chrome, 0.4, 0.9, -cs * 1.43, 0.008);
  rail(d, [[-2.2, 1.2, -cs * 1.36], [-2.2, 1.6, -cs * 1.36], [1.05, 1.6, -cs * 1.36], [1.05, 1.2, -cs * 1.36]], 0.03, M);
  rail(d, [[-2.6, 1.35, 0.9], [-2.6, 1.68, 0.9], [-2.6, 1.68, -0.9], [-2.6, 1.35, -0.9]], 0.025, M);
  rbox(d, 0.85, 0.62, 0.7, 0.08, MT.dark, 1.15, 0.55, 0); // boom foot
  bake(d);
  // cab on the front corner: posts, big windows, roof guard, wipers, mirrors and work lights
  const cab = grp(tur, 0.55, 0.32, cs * 0.82);
  rbox(cab, 1.45, 0.1, 1.1, 0.03, MT.dark, 0, 0.05, 0);
  rbox(cab, 0.1, 1.6, 1.1, 0.04, M, -0.68, 0.85, 0); rbox(cab, 0.1, 0.48, 1.1, 0.03, M, 0.68, 0.3, 0);
  [0.5, -0.5].forEach((z) => { rod(cab, new V3(0.68, 0.1, z), new V3(0.55, 1.62, z), 0.04, M); rod(cab, new V3(-0.05, 0.1, z), new V3(-0.05, 1.62, z), 0.035, M); rbox(cab, 1.3, 0.24, 0.05, 0.02, M, 0, 0.22, z, 0.01); });
  rbox(cab, 1.5, 0.1, 1.18, 0.05, M, -0.02, 1.68, 0);
  const ws = box(cab, 0.02, 1.36, 0.94, MT.glass, 0.62, 0.92, 0); ws.rotation.z = 0.09;
  box(cab, 1.25, 1.3, 0.02, MT.glass, 0, 0.94, 0.52); box(cab, 1.25, 1.3, 0.02, MT.glass, 0, 0.94, -0.52);
  for (let i = 0; i < 4; i++) box(cab, 0.04, 0.04, 1.1, MT.black, -0.5 + i * 0.33, 1.8, 0);
  [0.55, -0.55].forEach((z) => rail(cab, [[-0.65, 1.73, z], [-0.65, 1.84, z], [0.65, 1.84, z], [0.65, 1.73, z]], 0.02, MT.black));
  rod(cab, new V3(0.66, 0.42, 0.12), new V3(0.6, 1.15, -0.2), 0.012, MT.black);
  rod(cab, new V3(0.55, 1.4, cs * 0.55), new V3(0.85, 1.55, cs * 0.76), 0.02, MT.black); rbox(cab, 0.04, 0.28, 0.17, 0.03, MT.black, 0.87, 1.5, cs * 0.78);
  [0.35, -0.35].forEach((z) => rbox(cab, 0.08, 0.1, 0.16, 0.02, MT.lamp, 0.72, 1.76, z, 0.01));
  rbox(cab, 0.16, 0.55, 0.04, 0.02, MT.black, 0.2, 0.65, cs * 0.56, 0.01); // door handle bar
  operator(cab, -0.2, 0.12, 0);
  bake(cab);
  // boom (banana shape) with its hoses and a work light
  const BP = new V3(1.25, 0.95, 0), LB = 4.3, LS = 2.5;
  const boom = grp(tur, BP.x, BP.y, 0);
  ext(boom, [[-0.15, 0.3], [1.9, 0.86], [LB + 0.15, 0.25], [LB + 0.1, -0.22], [1.9, 0.32], [0.1, -0.32]], [0.15, 0.3, 0.15, 0.15, 0.3, 0.15], 0.6, M, 0, 0, 0, 0.03);
  cylZ(boom, 0.13, 0.72, MT.chrome, 0, 0, 0, 12); cylZ(boom, 0.12, 0.7, MT.chrome, LB, 0, 0, 12);
  rbox(boom, 0.36, 0.2, 0.42, 0.04, MD, 2.15, 0.86, 0);
  [0.17, -0.17].forEach((z) => { rod(boom, new V3(0.4, 0.46, z), new V3(1.9, 0.94, z), 0.03, MT.black); rod(boom, new V3(1.9, 0.94, z), new V3(LB - 0.2, 0.36, z), 0.03, MT.black); });
  rbox(boom, 0.12, 0.14, 0.2, 0.02, MT.lamp, 1.5, 0.82, cs * 0.32, 0.01);
  bake(boom);
  const stick = grp(boom, LB, 0, 0);
  ext(stick, [[-0.8, 0.38], [-0.45, 0.5], [LS - 0.1, 0.2], [LS + 0.1, 0], [LS - 0.1, -0.2], [0, -0.26], [-0.65, -0.12]], 0.08, 0.46, M, 0, 0, 0, 0.03);
  cylZ(stick, 0.1, 0.56, MT.chrome, LS, 0, 0, 12);
  [0.13, -0.13].forEach((z) => rod(stick, new V3(-0.35, 0.48, z), new V3(LS - 0.3, 0.23, z), 0.025, MT.black));
  bake(stick);
  const tool = grp(stick, LS, 0, 0); let tip, heap = null;
  if (o.tool === 'hammer') {
    rbox(tool, 0.62, 0.5, 0.6, 0.06, M, 0.22, 0, 0);
    rbox(tool, 1.75, 0.58, 0.58, 0.08, QM.hammer, 1.35, 0, 0);
    [0.75, 1.3, 1.85].forEach((x) => rbox(tool, 0.08, 0.62, 0.62, 0.02, MT.black, x, 0, 0, 0.01));
    rbox(tool, 0.46, 0.36, 0.36, 0.05, MT.dark, 2.42, 0, 0);
    const ch = add(tool, new THREE.CylinderGeometry(0.05, 0.11, 0.75, 10), MT.steel, 3.0, 0, 0); ch.rotation.z = -Math.PI / 2;
    rod(tool, new V3(-0.1, 0.32, 0.12), new V3(0.9, 0.31, 0.2), 0.03, MT.black); rod(tool, new V3(-0.1, 0.32, -0.12), new V3(0.9, 0.31, -0.2), 0.03, MT.black);
    decal(tool, 'BRH', 0.8, 0.3, '#f2ae1c', 1.35, 0, 0.3);
    tip = anchor(tool, 3.4, 0, 0);
  } else {
    const B = o.bucket || 1.35, c = [0.42 * B, -0.32 * B], R = 0.66 * B, W = 1.05 * B;
    const outer = arc(c[0], c[1], R, 118, -60, 14), inner = arc(c[0], c[1], R - 0.08 * B, -60, 118, 14);
    ext(tool, outer.concat(inner), 0, W, MD, 0, 0, 0, 0.015);
    [W / 2, -W / 2].forEach((z) => ext(tool, outer.concat([c]), 0, 0.07, MD, 0, 0, z, 0.01));
    const T = [c[0] + R * Math.cos(-Math.PI / 3), c[1] + R * Math.sin(-Math.PI / 3)];
    const TOOTH = new THREE.ConeGeometry(0.075 * B, 0.3 * B, 4); TOOTH.translate(0, 0.15 * B, 0);
    for (let i = -2; i <= 2; i++) { const t = add(tool, TOOTH, MT.steel, T[0], T[1], (i * W) / 5.4); t.rotation.z = (2 * Math.PI) / 3; }
    slab(tool, [T[0] - 0.05, T[1] + 0.09], [T[0] - 0.25 * B, T[1] + 0.2 * B], 0.05, W, QM.wear);
    [0.25, -0.25].forEach((z) => ext(tool, [[-0.14, 0.12], [-0.22, 0.4], [-0.06, 0.46], [0.24, 0.32], [0.18, 0.08]], 0.05, 0.06, MD, 0, 0, z * B, 0.01));
    cylZ(tool, 0.07, 0.62, MT.chrome, -0.14, 0.36, 0, 10);
    heap = rockHeap(tool, c[0] - 0.05 * B, c[1] + 0.05 * B, 0, R * 0.75, R * 0.6, W * 0.42); heap.rotation.z = 2.08; heap.visible = false;
    tip = anchor(tool, T[0], T[1], 0);
  }
  if (o.tool === 'hammer') bake(tool); else { heap.userData.dynamic = true; bake(tool); heap.userData.dynamic = false; }
  const links = [
    hydraulic(tur, anchor(tur, 1.1, 0.42, 0.25), anchor(boom, 1.55, -0.12, 0.25), { barrel: 1.1, rb: 0.13 }),
    hydraulic(tur, anchor(tur, 1.1, 0.42, -0.25), anchor(boom, 1.55, -0.12, -0.25), { barrel: 1.1, rb: 0.13 }),
    hydraulic(boom, anchor(boom, 2.15, 0.94, 0), anchor(stick, -0.7, 0.42, 0), { barrel: 1.35, rb: 0.12 }),
    hydraulic(stick, anchor(stick, 0.25, 0.44, 0), anchor(tool, -0.15, 0.38, 0), { barrel: 1.3, rb: 0.1 })
  ];
  const pose = { x: 4.0, y: 0.2, phi: -2.1 };
  function reach(x, y, phi) {
    pose.x = x; pose.y = y; pose.phi = phi;
    const dx = x - BP.x, dy = y - BP.y, dd = clamp(Math.hypot(dx, dy), Math.abs(LB - LS) + 0.05, LB + LS - 0.05);
    const a1 = Math.atan2(dy, dx) + Math.acos(clamp((LB * LB + dd * dd - LS * LS) / (2 * LB * dd), -1, 1));
    const gm = Math.acos(clamp((LB * LB + LS * LS - dd * dd) / (2 * LB * LS), -1, 1));
    boom.rotation.z = a1; stick.rotation.z = -(Math.PI - gm); tool.rotation.z = phi - a1 - stick.rotation.z;
  }
  /** Tween the tool to (x, y, phi). */
  function reachTo(x, y, phi, dur, ease) {
    const f = { ...pose };
    return tw(dur, (t) => reach(f.x + (x - f.x) * t, f.y + (y - f.y) * t, f.phi + (phi - f.phi) * t), ease);
  }
  reach(pose.x, pose.y, pose.phi);
  shadows(g);
  return { g, tur, boom, stick, tool, tracks, cab, links, tip, heap, reach, reachTo, pose, k };
}

/* ================= rigid haul truck (Caterpillar 777-like) ================= */
/** Returns { g, wheels, bed, load, links, cab } — bed pivots at the back (rotation.z > 0 tips it). */
export function haulTruck(p, o = {}) {
  const g = grp(p), d = grp(g), M = MT.yel, R = 1.15, W = 0.82;
  // frame rails, cross members, axle housing
  [0.72, -0.72].forEach((z) => rbox(d, 6.6, 0.7, 0.32, 0.04, MT.dark, -0.1, 1.45, z));
  [-3.1, -0.4, 1.2].forEach((x) => box(d, 0.25, 0.4, 1.4, MT.dark, x, 1.45, 0));
  cylZ(d, 0.36, 3.0, MT.dark, -1.7, R, 0, 16); sph(d, 0.55, MT.dark, -1.7, R, 0);
  // engine module and radiator between the front wheels
  rbox(d, 2.2, 1.45, 1.9, 0.08, M, 2.75, 2.05, 0);
  rbox(d, 0.12, 1.25, 1.75, 0.03, MT.black, 3.86, 2.0, 0); for (let i = 0; i < 9; i++) box(d, 0.04, 0.05, 1.6, MT.dark, 3.93, 1.48 + i * 0.13, 0);
  // bumper with headlights and tow hooks
  rbox(d, 0.55, 0.62, 4.9, 0.06, M, 3.85, 1.16, 0);
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.2, 0.42, 0.03, MT.lamp, 4.13, 1.22, s * 1.75, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.03, MT.amber, 4.13, 1.22, s * 2.2, 0.01); add(d, new THREE.TorusGeometry(0.12, 0.04, 6, 12), MT.dark, 4.15, 0.88, s * 0.7).rotation.y = Math.PI / 2; });
  // front deck over the front wheels, with handrails all round
  rbox(d, 2.6, 0.14, 5.5, 0.04, M, 2.85, 2.82, 0);
  rail(d, [[4.1, 2.9, -2.7], [4.1, 3.75, -2.7], [4.1, 3.75, 2.7], [4.1, 2.9, 2.7]], 0.035, M);
  [1, -1].forEach((s) => { rail(d, [[1.6, 3.75, s * 2.7], [4.1, 3.75, s * 2.7]], 0.035, M); rod(d, new V3(1.6, 2.9, s * 2.7), new V3(1.6, 3.75, s * 2.7), 0.035, M); rail(d, [[1.6, 3.3, s * 2.7], [4.1, 3.3, s * 2.7]], 0.025, M); });
  // diagonal stairway across the front of the radiator, a vertical ladder up to the bumper
  const st0 = new V3(4.2, 1.5, -2.25), st1 = new V3(4.2, 2.82, -0.2);
  for (let i = 0; i <= 6; i++) { const t = i / 6, q = st0.clone().lerp(st1, t); rbox(d, 0.4, 0.05, 0.42, 0.02, MT.black, q.x, q.y, q.z, 0.01); }
  [0.22, -0.22].forEach((dx) => { rod(d, st0.clone().add(new V3(dx, 0, 0)), st1.clone().add(new V3(dx, 0, 0)), 0.03, MT.dark); rod(d, st0.clone().add(new V3(dx, 0.8, 0)), st1.clone().add(new V3(dx, 0.85, 0)), 0.025, M); });
  [0.2, 0.55, 0.9].forEach((y) => box(d, 0.05, 0.05, 0.45, MT.black, 4.12, y, -2.3)); [-2.08, -2.52].forEach((z) => box(d, 0.05, 1.0, 0.05, MT.dark, 4.12, 0.6, z));
  // cab on the left of the deck, a box of filters and the air cleaners on the right
  rbox(d, 1.72, 0.45, 1.84, 0.04, M, 2.85, 3.13, -1.45);
  rbox(d, 1.25, 0.95, 1.5, 0.1, M, 2.6, 3.36, 1.25); for (let i = 0; i < 6; i++) box(d, 0.03, 0.6, 0.02, MT.black, 2.1 + i * 0.2, 3.36, 2.01);
  [0.45, 1.25].forEach((z) => { cylY(d, 0.22, 0.75, MT.dark, 3.55, 3.3, z, 14); cylY(d, 0.24, 0.06, MT.black, 3.55, 3.7, z, 14); });
  [1, -1].forEach((s) => { rod(d, new V3(3.9, 3.7, s * 2.6), new V3(4.4, 3.95, s * 2.95), 0.03, MT.black); rbox(d, 0.06, 0.45, 0.28, 0.03, MT.black, 4.45, 3.9, s * 3.0, 0.01); rbox(d, 0.08, 0.12, 0.18, 0.02, MT.lamp, 4.15, 3.85, s * 2.2, 0.01); });
  // fuel and hydraulic tanks between the axles, mud flaps, tail lights
  rbox(d, 1.35, 1.0, 0.7, 0.12, MT.dark, 0.25, 1.4, -1.58); cylY(d, 0.1, 0.08, MT.chrome, 0.5, 1.95, -1.58, 10);
  rbox(d, 1.35, 1.0, 0.7, 0.12, M, 0.25, 1.4, 1.58); rbox(d, 0.1, 0.4, 0.04, 0.02, MT.glassD, 0.2, 1.4, 1.94, 0.01);
  [1, -1].forEach((s) => { rbox(d, 0.05, 0.75, 1.9, 0.02, MT.black, -2.95, 0.75, s * 1.95, 0.01); rbox(d, 0.07, 0.14, 0.3, 0.02, MT.tail, -3.42, 1.5, s * 0.7, 0.01); });
  // front suspension struts
  [1, -1].forEach((s) => { cylY(d, 0.16, 1.0, MT.dark, 2.3, 2.05, s * 1.75, 12); cylY(d, 0.1, 0.4, MT.chrome, 2.3, 1.45, s * 1.75, 10); });
  const cab = glassCab(d, 2.85, 3.36, -1.45, { len: 1.7, wid: 1.8, h: 1.25, mat: M, roof: M });
  bake(d);
  // dump body with its canopy over the cab
  const bed = grp(g, -2.9, 2.3, 0), bd = grp(bed), BW = 5.3;
  slab(bd, [-1.75, 0.65], [-1.0, 0.18], 0.14, BW - 0.2, MT.yelD); slab(bd, [-1.0, 0.18], [4.85, 0.35], 0.14, BW - 0.2, MT.yelD);
  [1, -1].forEach((s) => {
    ext(bd, [[-1.75, 0.65], [-1.0, 0.12], [4.85, 0.3], [4.85, 2.25], [-1.35, 2.15]], 0.06, 0.14, M, 0, 0, s * (BW / 2), 0.02);
    slab(bd, [-1.4, 2.18], [4.9, 2.28], 0.18, 0.24, M, s * (BW / 2 + 0.02));
    [0.1, 1.3, 2.5, 3.7].forEach((x) => rbox(bd, 0.14, 1.85, 0.12, 0.03, MT.yelD, x, 1.25, s * (BW / 2 + 0.08), 0.01));
    slab(bd, [-0.9, 0.05], [4.8, 0.22], 0.25, 0.3, MT.dark, s * 0.85);
  });
  rbox(bd, 0.16, 2.4, BW, 0.04, M, 4.85, 1.4, 0);
  slab(bd, [4.8, 2.5], [7.45, 2.75], 0.12, BW + 0.1, M);
  for (let z = -2; z <= 2; z += 1) slab(bd, [4.9, 2.38], [7.35, 2.63], 0.14, 0.1, MT.yelD, z);
  slab(bd, [7.4, 2.55], [7.5, 2.8], 0.3, BW + 0.1, MT.yelD);
  cylZ(bd, 0.16, 2.0, MT.dark, 0, 0, 0, 12);
  [1, -1].forEach((s) => { const n = decal(bd, '12', 0.9, 0.75, '#1d1f26', 2.4, 1.4, s * (BW / 2 + 0.16)); if (s < 0) n.rotation.y = Math.PI; });
  bake(bd);
  const load = rockHeap(bed, 1.7, 0.3, 0, 2.9, 1.25, 2.3, QM.stone, 10); load.visible = false;
  const links = [1, -1].map((s) => telescopic(g, anchor(g, 1.0, 1.3, s * 1.0), anchor(bed, 3.3, 0.25, s * 1.0), { n: 4, stage: 1.2, r: 0.17 }));
  const wheels = [];
  [1, -1].forEach((s) => {
    wheels.push(otrTire(g, R, W, 2.3, R, s * 2.05, MT.grey, s));
    wheels.push(otrTire(g, R, W, -1.7, R, s * 1.52, MT.grey, s), otrTire(g, R, W, -1.7, R, s * 2.4, MT.grey, s));
  });
  shadows(g); return { g, wheels, bed, load, links, cab, R };
}

/* ================= wheel loader (Caterpillar 988-like) ================= */
/** Returns { g, front, arms, bucket, wheels, links, heap, pose(alpha, phi), poseTo } — front frame articulates about y at x = 0. */
export function wheelLoader(p) {
  const g = grp(p), M = MT.yel, R = 0.98, W = 0.78;
  const rear = grp(g);
  rbox(rear, 3.2, 0.85, 1.5, 0.08, MT.dark, -1.7, 1.15, 0);
  ext(rear, [[-3.75, 1.5], [-0.9, 1.5], [-0.9, 2.5], [-3.4, 2.42], [-3.8, 2.1]], 0.12, 2.0, M, 0, 0, 0, 0.04);
  rbox(rear, 0.08, 0.8, 1.6, 0.03, MT.black, -3.83, 1.92, 0); for (let i = 0; i < 6; i++) box(rear, 0.04, 0.04, 1.5, MT.dark, -3.88, 1.6 + i * 0.13, 0);
  [1, -1].forEach((s) => { for (let i = 0; i < 7; i++) box(rear, 0.06, 0.5, 0.02, MT.black, -3.1 + i * 0.25, 2.0, s * 1.01); });
  rbox(rear, 0.62, 0.85, 2.7, 0.14, M, -3.95, 1.15, 0); [1, -1].forEach((s) => { rbox(rear, 0.05, 0.12, 0.25, 0.02, MT.tail, -4.27, 1.45, s * 1.0, 0.01); rbox(rear, 0.05, 0.12, 0.2, 0.02, MT.lamp, -3.8, 2.48, s * 0.6, 0.01); });
  cylY(rear, 0.09, 0.7, MT.black, -2.2, 2.75, 0.45, 10); cylY(rear, 0.16, 0.4, MT.dark, -1.5, 2.65, -0.45, 12); sph(rear, 0.2, MT.dark, -1.5, 2.9, -0.45);
  [1, -1].forEach((s) => {
    fender(rear, R + 0.14, W + 0.25, -1.7, R, s * 1.35, M, Math.PI * 0.62);
    rbox(rear, 1.1, 0.08, 0.7, 0.02, MT.grate, -0.2, 1.62, s * 1.1, 0.01); // walkway beside the cab
    rail(rear, [[-0.7, 1.65, s * 1.42], [-0.7, 2.45, s * 1.42], [0.3, 2.45, s * 1.42], [0.3, 1.65, s * 1.42]], 0.03, M);
  });
  [0.3, 0.7, 1.1].forEach((y, i) => rbox(rear, 0.35, 0.05, 0.4, 0.02, MT.black, -0.35 - i * 0.05, y, -1.62, 0.01)); rod(rear, new V3(-0.15, 0.2, -1.8), new V3(-0.25, 1.6, -1.8), 0.03, M);
  glassCab(rear, -0.35, 1.6, 0, { len: 1.6, wid: 1.5, h: 1.85, mat: M, roof: M });
  bake(rear);
  const front = grp(g), fd = grp(front);
  rbox(fd, 2.4, 0.8, 1.3, 0.08, MT.dark, 1.3, 1.1, 0); cylY(fd, 0.28, 0.9, MT.dark, 0.05, 1.1, 0, 14);
  cylZ(fd, 0.32, 2.2, MT.dark, 1.7, R, 0, 14); sph(fd, 0.45, MT.dark, 1.7, R, 0);
  [1, -1].forEach((s) => { rbox(fd, 0.6, 1.5, 0.3, 0.06, MT.dark, 0.95, 1.75, s * 0.55, 0.02); fender(fd, R + 0.12, W + 0.2, 1.7, R, s * 1.35, M, Math.PI * 0.45); rbox(fd, 0.06, 0.14, 0.3, 0.02, MT.lamp, 2.45, 2.1, s * 0.5, 0.01); });
  bake(fd);
  const LA = 3.25, arms = grp(front, 0.95, 2.4, 0);
  [0.6, -0.6].forEach((z) => ext(arms, [[-0.22, 0.2], [1.6, 0.27], [LA + 0.12, 0.12], [LA + 0.12, -0.16], [1.6, -0.26], [-0.22, -0.2]], 0.1, 0.22, M, 0, 0, z, 0.02));
  cylZ(arms, 0.13, 1.25, M, 1.45, 0, 0, 12); cylZ(arms, 0.1, 1.5, MT.chrome, 0, 0, 0, 10);
  bake(arms);
  const bucket = grp(arms, LA, 0, 0), bk = grp(bucket), BW = 3.6;
  ext(bk, [[0.05, 1.45], [-0.12, 1.2], [-0.12, 0.0], [0.15, -0.3], [1.55, -0.3], [1.62, -0.2], [1.5, -0.18], [0.25, -0.18], [0.02, 0.05], [0.02, 1.2], [0.18, 1.4]], 0.04, BW, MT.yelD, 0, 0, 0, 0.02);
  [1, -1].forEach((s) => ext(bk, [[-0.12, 1.2], [-0.12, 0], [0.15, -0.3], [1.55, -0.3], [1.3, 0.45], [0.55, 1.2], [0.05, 1.45]], 0.05, 0.07, MT.yelD, 0, 0, s * BW / 2, 0.01));
  const TOOTH = new THREE.ConeGeometry(0.07, 0.28, 4); TOOTH.translate(0, 0.14, 0);
  for (let i = 0; i < 7; i++) { const t = add(bk, TOOTH, MT.steel, 1.6, -0.24, -1.5 + i * 0.5); t.rotation.z = -Math.PI / 2; }
  [0.35, -0.35].forEach((z) => rbox(bk, 0.3, 0.3, 0.18, 0.04, MT.dark, -0.2, 0.95, z, 0.01));
  bake(bk);
  const heap = rockHeap(bucket, 0.75, -0.1, 0, 0.85, 0.65, 1.55, QM.stone, 8); heap.visible = false;
  const links = [
    hydraulic(front, anchor(front, 0.55, 1.2, 0.48), anchor(arms, 1.3, -0.26, 0.48), { barrel: 1.2, rb: 0.13 }),
    hydraulic(front, anchor(front, 0.55, 1.2, -0.48), anchor(arms, 1.3, -0.26, -0.48), { barrel: 1.2, rb: 0.13 }),
    hydraulic(arms, anchor(arms, 1.0, 0.5, 0), anchor(bucket, -0.2, 0.95, 0), { barrel: 1.3, rb: 0.12 })
  ];
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(otrTire(g, R, W, -1.7, R, s * 1.35, MT.yel, s)); wheels.push(otrTire(front, R, W, 1.7, R, s * 1.35, MT.yel, s)); });
  const st = { a: -0.69, phi: 0 };
  const pose = (a, phi) => { st.a = a; st.phi = phi; arms.rotation.z = a; bucket.rotation.z = phi - a; };
  const poseTo = (a, phi, dur, ease) => { const f = { ...st }; return tw(dur, (t) => pose(f.a + (a - f.a) * t, f.phi + (phi - f.phi) * t), ease); };
  pose(-0.69, 0);
  shadows(g); return { g, front, arms, bucket, wheels, links, heap, pose, poseTo, R };
}

/* ================= drill rig on tracks ================= */
/** Returns { g, tracks, mast, head, rod, links, foot } — mast.rotation.z = π/2 lies it back over the machine, 0 stands it up. */
export function drillRig(p, o = {}) {
  const g = grp(p), M = o.mat || MT.orange, MD = MT.orangeD;
  const tracks = [1, -1].map((s) => trackUnit(g, { len: 3.9, r: 0.4, w: 0.56, z: s * 1.05, guard: true }));
  const d = grp(g);
  rbox(d, 4.0, 0.42, 1.6, 0.06, MT.dark, -0.1, 0.92, 0);
  // power pack (engine + compressor) under a big hood with louvres
  rbox(d, 2.0, 1.25, 2.3, 0.12, M, -1.1, 1.75, 0);
  [1, -1].forEach((s) => { for (let i = 0; i < 8; i++) box(d, 0.05, 0.7, 0.02, MT.black, -1.85 + i * 0.2, 1.8, s * 1.16); rbox(d, 0.05, 0.14, 0.22, 0.02, MT.tail, -2.12, 1.4, s * 0.85, 0.01); });
  cylY(d, 0.42, 0.06, MT.black, -1.2, 2.39, 0.2, 18); for (let i = 0; i < 5; i++) box(d, 0.8, 0.03, 0.04, MT.dark, -1.2, 2.43, 0.2 - 0.32 + i * 0.16);
  cylY(d, 0.07, 0.6, MT.black, -0.4, 2.65, -0.8, 10);
  // dust collector at the back, with its cyclone
  rbox(d, 0.75, 0.9, 0.9, 0.06, MT.grey, -1.75, 2.85, -0.55); cylY(d, 0.28, 0.6, MT.grey, -1.75, 3.6, -0.55, 14); cylY(d, 0.3, 0.06, MT.dark, -1.75, 3.92, -0.55, 14);
  rod(d, new V3(-1.75, 2.6, -0.1), new V3(1.8, 1.5, -0.35), 0.08, MT.black);
  // walkway with handrail beside the hood, ladder up to the cab
  rail(d, [[-2.05, 2.4, -1.18], [-2.05, 2.85, -1.18], [-0.15, 2.85, -1.18], [-0.15, 2.4, -1.18]], 0.025, M);
  [0.4, 0.75].forEach((y) => rbox(d, 0.3, 0.05, 0.35, 0.02, MT.black, 0.75, y, 1.45, 0.01));
  // boom from the chassis up to the mast cradle
  ext(d, [[1.3, 0.9], [1.95, 0.9], [2.55, 2.95], [2.55, 3.35], [2.1, 3.35], [1.3, 1.45]], 0.1, 0.6, M, 0, 0, 0, 0.03);
  cylZ(d, 0.16, 0.75, MT.chrome, 2.3, 3.15, 0, 12);
  rbox(d, 0.5, 0.06, 1.4, 0.02, MT.stripes, 2.0, 1.15, 0, 0.01);
  glassCab(d, 0.6, 1.13, 0.55, { len: 1.3, wid: 1.15, h: 1.6, mat: M, roof: M });
  decal(d, 'FORAGE', 1.5, 0.35, '#1d1f26', -1.1, 1.75, 1.17);
  bake(d);
  // the mast (feed): a long box beam with slide rails, crown sheaves and a foot that rests on the rock
  const mast = grp(g, 2.3, 3.15, 0), md = grp(mast), X = 0.36;
  rbox(md, 0.36, 9.0, 0.42, 0.04, M, X, 1.55, 0);
  [0.16, -0.16].forEach((z) => box(md, 0.05, 8.6, 0.05, MT.chrome, X + 0.2, 1.6, z));
  for (let y = -2.4; y < 6; y += 0.9) box(md, 0.38, 0.05, 0.44, MD, X, y, 0);
  cylZ(md, 0.24, 0.3, MT.dark, X + 0.05, 6.1, 0, 16); rbox(md, 0.5, 0.25, 0.5, 0.05, MD, X, 6.0, 0, 0.02);
  rbox(md, 0.6, 0.45, 0.6, 0.06, MT.dark, X + 0.12, -2.75, 0, 0.02); rbox(md, 0.8, 0.08, 0.7, 0.02, MT.black, X + 0.12, -2.98, 0, 0.01);
  // rod changer carousel beside the mast
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cylY(md, 0.05, 5.2, MT.steel, X - 0.05 + Math.cos(a) * 0.14, 1.9, -0.42 + Math.sin(a) * 0.14, 6); }
  [-0.6, 4.3].forEach((y) => cylY(md, 0.24, 0.08, MT.dark, X - 0.05, y, -0.42, 14));
  rod(md, new V3(X - 0.2, 5.6, 0.18), new V3(-0.2, 2.5, 0.35), 0.05, MT.black); rod(md, new V3(-0.2, 2.5, 0.35), new V3(-0.1, 0.2, 0.25), 0.05, MT.black);
  bake(md);
  const head = grp(mast, X + 0.3, 5.2, 0), hd = grp(head);
  rbox(hd, 0.42, 0.95, 0.5, 0.06, MT.grey, 0.05, 0, 0, 0.02); rbox(hd, 0.3, 0.4, 0.55, 0.04, M, 0.05, 0.6, 0, 0.02);
  cylY(hd, 0.12, 0.3, MT.dark, 0.05, -0.6, 0, 12); rod(hd, new V3(0, 0.5, 0.25), new V3(-0.3, 0.9, 0.3), 0.04, MT.black);
  bake(hd);
  const rodG = grp(head, 0.05, -0.6, 0);
  cylY(rodG, 0.07, 7.5, MT.steel, 0, -3.75, 0, 6); [-0.5, -2.6, -4.7].forEach((y) => cylY(rodG, 0.09, 0.18, MT.dark, 0, y, 0, 6));
  box(rodG, 0.04, 0.4, 0.16, MT.yel, 0.07, -0.3, 0);
  const links = [hydraulic(g, anchor(g, 1.55, 1.55, 0.36), anchor(mast, X - 0.15, 1.6, 0.36), { barrel: 1.3, rb: 0.11 })];
  const foot = anchor(mast, X + 0.12, -3.0, 0);
  shadows(g); return { g, tracks, mast, head, rod: rodG, links, foot };
}

/* ================= trucks with a cab-over cab ================= */
/** Road tipper with four axles. Returns { g, wheels, load, body }. */
export function roadTipper(p, cabM, bodyM) {
  const g = grp(p), d = grp(g);
  [0.45, -0.45].forEach((z) => rbox(d, 7.6, 0.3, 0.16, 0.03, MT.black, -0.4, 0.97, z));
  truckCab(d, cabM, 2.05);
  [1, -1].forEach((s) => { rbox(d, 0.9, 0.5, 0.45, 0.06, MT.dark, 0.75, 0.72, s * 0.85, 0.02); rbox(d, 0.05, 0.5, 0.55, 0.02, MT.black, -4.15, 0.62, s * 0.92, 0.01); rbox(d, 0.05, 0.14, 0.22, 0.02, MT.tail, -4.2, 0.95, s * 0.95, 0.01); });
  cylX(d, 0.27, 1.0, MT.chrome, 0.75, 0.72, 0.78, 16);
  const body = grp(d, -1.45, 1.42, 0);
  rbox(body, 5.6, 0.14, 2.4, 0.03, bodyM, 0, 0, 0);
  [1, -1].forEach((s) => { rbox(body, 5.6, 1.15, 0.08, 0.02, bodyM, 0, 0.62, s * 1.18, 0.01); for (let x = -2.4; x <= 2.4; x += 0.8) rbox(body, 0.08, 1.1, 0.06, 0.01, MT.dark, x, 0.6, s * 1.23, 0.01); rbox(body, 5.7, 0.1, 0.12, 0.02, MT.dark, 0, 1.2, s * 1.2, 0.01); });
  rbox(body, 0.1, 1.5, 2.4, 0.02, bodyM, 2.8, 0.78, 0); rbox(body, 0.5, 0.08, 2.4, 0.02, bodyM, 3.02, 1.52, 0); rbox(body, 0.1, 1.15, 2.36, 0.02, bodyM, -2.8, 0.62, 0);
  telescopic(d, anchor(d, 1.4, 1.2, 0), anchor(d, 1.4, 2.4, 0), { n: 3, stage: 0.9, r: 0.12 }).update();
  decal(body, 'GRAVIER', 2.4, 0.42, '#ffffff', 0, 0.65, 1.23);
  bake(d);
  const load = rockHeap(body, 0, 0.3, 0, 2.5, 1.05, 1.05, QM.stoneD, 8); load.visible = false;
  const wheels = [];
  [1, -1].forEach((s) => {
    [2.6, 1.45].forEach((x) => wheels.push(tire(g, 0.55, 0.4, x, 0.55, s * 0.92, MT.grey, s)));
    [-1.9, -3.0].forEach((x) => wheels.push(tire(g, 0.55, 0.3, x, 0.55, s * 0.8, MT.grey, s), tire(g, 0.55, 0.3, x, 0.55, s * 1.11, MT.grey, s)));
    fender(g, 0.66, 0.48, 2.6, 0.55, s * 0.94, MT.black); fender(g, 0.66, 0.48, 1.45, 0.55, s * 0.94, MT.black);
  });
  wheels.forEach((w) => freeze(w));
  shadows(g); return { g, wheels, load, body };
}

/** Quarry water truck: big white tank, spray bar at the back, water cannon on top. Returns { g, wheels, cannon, nozzles, tip }. */
export function waterTruck(p, cabM) {
  const g = grp(p), d = grp(g);
  [0.45, -0.45].forEach((z) => rbox(d, 7.0, 0.3, 0.16, 0.03, MT.black, -0.3, 0.97, z));
  truckCab(d, cabM, 2.05);
  const tank = cylX(d, 0.95, 4.7, QM.tank, -1.05, 2.12, 0, 28); tank.scale.z = 1.25;
  [-3.2, -2.1, -1.0, 0.1, 1.15].forEach((x) => { const b = cylX(d, 0.975, 0.08, MT.blue, x, 2.12, 0, 28); b.scale.z = 1.25; });
  const end = add(d, new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI), QM.tank, -3.4, 2.12, 0); end.rotation.y = -Math.PI / 2; end.scale.set(1.25, 1, 0.25);
  [1, -1].forEach((s) => { rbox(d, 4.6, 0.12, 0.04, 0.01, MT.blue, -1.05, 1.95, s * 1.19, 0.005); decal(d, 'EAU', 1.2, 0.45, '#2f6fe0', -1.6, 2.35, s * 1.2).rotation.y = s > 0 ? 0 : Math.PI; });
  rbox(d, 4.0, 0.06, 0.7, 0.02, MT.grate, -1.2, 3.12, 0, 0.01); [0.38, -0.38].forEach((z) => rail(d, [[-3.1, 3.15, z], [-3.1, 3.6, z], [0.6, 3.6, z], [0.6, 3.15, z]], 0.025, MT.grey));
  cylY(d, 0.3, 0.12, MT.grey, -2.2, 3.15, 0, 16);
  for (let y = 0.6; y < 3.1; y += 0.35) box(d, 0.05, 0.04, 0.5, MT.grey, -3.65, y, 0.5); [0.27, 0.73].forEach((z) => box(d, 0.04, 2.6, 0.04, MT.grey, -3.65, 1.85, z));
  // pump, spray bar with nozzles, side hose reel, mud flaps
  rbox(d, 0.8, 0.6, 0.7, 0.05, MT.dark, -3.1, 0.75, -0.6, 0.02);
  cylZ(d, 0.07, 2.5, MT.dark, -3.55, 0.6, 0, 10); const nozzles = [];
  for (let i = 0; i < 5; i++) { cylX(d, 0.05, 0.16, MT.steel, -3.62, 0.6, -1.0 + i * 0.5, 8); nozzles.push(anchor(g, -3.72, 0.55, -1.0 + i * 0.5)); }
  cylZ(d, 0.35, 0.3, MT.red, 0.9, 1.35, 1.0, 16); cylZ(d, 0.2, 0.32, MT.dark, 0.9, 1.35, 1.0, 12);
  [1, -1].forEach((s) => { rbox(d, 0.05, 0.5, 0.55, 0.02, MT.black, -3.6, 0.62, s * 0.92, 0.01); rbox(d, 0.05, 0.14, 0.22, 0.02, MT.tail, -3.65, 0.95, s * 0.95, 0.01); });
  bake(d);
  const cannon = grp(g, 0.95, 3.15, 0); cylY(cannon, 0.12, 0.3, MT.dark, 0, 0.15, 0, 12);
  const barrel = grp(cannon, 0, 0.32, 0); cylX(barrel, 0.07, 0.8, MT.red, 0.35, 0, 0, 10); cylX(barrel, 0.09, 0.12, MT.dark, 0.75, 0, 0, 10); barrel.rotation.z = 0.35;
  const tip = anchor(barrel, 0.85, 0, 0);
  const wheels = [];
  [1, -1].forEach((s) => {
    wheels.push(tire(g, 0.55, 0.4, 2.6, 0.55, s * 0.92, MT.grey, s));
    [-1.35, -2.45].forEach((x) => wheels.push(tire(g, 0.55, 0.3, x, 0.55, s * 0.8, MT.grey, s), tire(g, 0.55, 0.3, x, 0.55, s * 1.11, MT.grey, s)));
    fender(g, 0.66, 0.48, 2.6, 0.55, s * 0.94, MT.black);
  });
  wheels.forEach((w) => freeze(w));
  shadows(g); return { g, wheels, cannon, barrel, nozzles, tip };
}

/* ================= belt conveyor ================= */
const IDL = new THREE.CylinderGeometry(1, 1, 1, 8); IDL.rotateX(Math.PI / 2);
const PEB = new THREE.IcosahedronGeometry(1, 0);
/**
 * A troughed belt conveyor from A to B (points in p's space; p's y = 0 is the ground): stringers, lattice, idlers,
 * drums, a walkway with its handrail, legs to the ground, and pebbles that ride on the belt.
 * Returns { g, L, feed, running, update(dt), fill(on), head, tail }.
 */
export function conveyor(p, A, B, o = {}) {
  const w = o.w || 0.9, D = new V3().subVectors(B, A), L = D.length(), F = o.frame || QM.galv;
  const g = grp(p, A.x, A.y, A.z); g.rotation.order = 'YZX';
  g.rotation.y = Math.atan2(-D.z, D.x); g.rotation.z = Math.atan2(D.y, Math.hypot(D.x, D.z));
  const d = grp(g), side = o.walk || 1, zs = w / 2 + 0.12;
  [1, -1].forEach((s) => {
    rbox(d, L, 0.22, 0.07, 0.02, F, L / 2, 0, s * zs, 0.01); rbox(d, L, 0.08, 0.06, 0.02, F, L / 2, -0.55, s * zs, 0.01);
    for (let x = 0; x < L - 0.3; x += 1.2) { const x2 = Math.min(L, x + 0.6), x3 = Math.min(L, x + 1.2); rod(d, new V3(x, -0.55, s * zs), new V3(x2, -0.05, s * zs), 0.025, F, 4); rod(d, new V3(x2, -0.05, s * zs), new V3(x3, -0.55, s * zs), 0.025, F, 4); }
  });
  box(d, L, 0.035, w, QM.belt, L / 2, 0.16, 0); box(d, L, 0.02, w * 0.9, QM.belt, L / 2, -0.16, 0);
  cylZ(d, 0.17, w + 0.06, MT.dark, 0, 0.0, 0, 14); cylZ(d, 0.2, w + 0.06, MT.dark, L, 0.0, 0, 14);
  rbox(d, 0.7, 0.35, w + 0.3, 0.05, o.hood || QM.plantD, L - 0.25, 0.3, 0, 0.02); // head hood
  rbox(d, 0.5, 0.45, 0.4, 0.05, MT.dark, L - 0.1, -0.1, -side * (zs + 0.25), 0.02); // drive motor
  rbox(d, 1.0, 0.25, w + 0.2, 0.04, o.hood || QM.plantD, 0.35, 0.3, 0, 0.02); // feed skirt at the tail
  if (o.walkway !== false) {
    rbox(d, L, 0.04, 0.55, 0.01, QM.grate, L / 2, -0.05, side * (zs + 0.35), 0.01);
    for (let x = 0.3; x < L; x += 1.5) rod(d, new V3(x, -0.05, side * (zs + 0.6)), new V3(x, 0.9, side * (zs + 0.6)), 0.02, MT.yel, 4);
    rod(d, new V3(0.3, 0.9, side * (zs + 0.6)), new V3(L - 0.2, 0.9, side * (zs + 0.6)), 0.022, MT.yel, 4);
    rod(d, new V3(0.3, 0.45, side * (zs + 0.6)), new V3(L - 0.2, 0.45, side * (zs + 0.6)), 0.018, MT.yel, 4);
  }
  bake(d);
  const n = Math.max(2, Math.floor(L / 0.9)), idl = new THREE.InstancedMesh(IDL, MT.steel, n * 3);
  for (let i = 0; i < n; i++) {
    const x = 0.45 + i * ((L - 0.9) / Math.max(1, n - 1));
    [[0, 0.06, w * 0.34, 0], [w * 0.33, 0.1, w * 0.32, 0.4], [-w * 0.33, 0.1, w * 0.32, -0.4]].forEach(([z, y, len, rx], j) => {
      dummy.position.set(x, y, z); dummy.rotation.set(rx, 0, 0); dummy.scale.set(0.06, 0.06, len); dummy.updateMatrix(); idl.setMatrixAt(i * 3 + j, dummy.matrix);
    });
  }
  idl.castShadow = true; g.add(idl);
  // legs down to the ground
  if (o.legs !== false) {
    const lg = grp(p), dn = D.clone().normalize(), perp = new V3(-dn.z, 0, dn.x).normalize();
    for (let x = o.leg0 || 1.2; x < L - 0.6; x += o.legStep || 3.2) {
      const q = A.clone().addScaledVector(dn, x); const top = q.y - 0.6; if (top < 0.6) continue;
      [1, -1].forEach((s) => { const a = q.clone().addScaledVector(perp, s * zs); a.y = top; const b = a.clone(); b.y = 0; rod(lg, a, b, 0.07, F, 6); rbox(lg, 0.4, 0.06, 0.4, 0.02, QM.conc, b.x, 0.03, b.z, 0.01); });
      const a1 = q.clone().addScaledVector(perp, zs), b1 = q.clone().addScaledVector(perp, -zs); a1.y = top; b1.y = top * 0.4; rod(lg, a1, b1, 0.035, F, 4);
    }
    bake(lg);
  }
  // pebbles riding on the belt
  const N = Math.max(6, Math.round(L / 0.3)), col = o.color || 0xbdb09a;
  const items = Array.from({ length: N }, (_, i) => ({ s: (i * L) / N, on: false, r: rnd(0.08, 0.15) * (o.size || 1), z: rnd(-w * 0.28, w * 0.28), a: rnd(0, 6) }));
  const peb = instanced(g, PEB, N, (i, dm) => { dm.position.set(0, -50, 0); dm.scale.setScalar(0.001); return Array.isArray(col) ? col[i % col.length] : col; });
  peb.instanceMatrix.setUsage(THREE.DynamicDrawUsage); peb.frustumCulled = false;
  const api = {
    g, L, feed: false, running: false, speed: o.speed || 2.4,
    head: anchor(g, L + 0.2, 0.2, 0), tail: anchor(g, 0.3, 0.4, 0),
    write() {
      items.forEach((it, i) => {
        if (it.on) { dummy.position.set(it.s, 0.2 + it.r * 0.7, it.z); dummy.rotation.set(it.a, it.a * 2, 0); dummy.scale.setScalar(it.r); }
        else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); }
        dummy.updateMatrix(); peb.setMatrixAt(i, dummy.matrix);
      });
      peb.instanceMatrix.needsUpdate = true;
    },
    update(dt) {
      if (!api.running) return; let out = 0;
      items.forEach((it) => { it.s += api.speed * dt; if (it.s > L) { it.s -= L; if (it.on) out++; it.on = api.feed; } });
      api.write(); return out;
    },
    fill(v) { items.forEach((it) => (it.on = v)); api.write(); },
    loaded() { return items.some((it) => it.on); }
  };
  api.write();
  return api;
}
