// Scenery props shared between worlds.
import * as THREE from 'three';
import { rnd, pick } from './util.js';
import { C, ICO, MT, add, box, grp, cylY, cylX, rbox, ext, shadows } from './geo.js';

const WARM = new THREE.MeshBasicMaterial({ color: 0xffc06a });

export function autumnTree(scene, x, z, cols) {
  const g = grp(scene, x, 0, z); cylY(g, 0.2, 2.4, 0x5b3626, 0, 1.2, 0, 8);
  for (let i = 0; i < 5; i++) {
    const m = add(g, ICO, pick(cols), rnd(-0.9, 0.9), rnd(2.4, 3.6), rnd(-0.9, 0.9));
    m.scale.setScalar(rnd(0.8, 1.3)); m.rotation.set(rnd(0, 3), rnd(0, 3), 0);
  }
  shadows(g); return g;
}
export function lamp(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry || 0;
  cylY(g, 0.08, 4.2, 0x30354a, 0, 2.1, 0, 8); box(g, 0.9, 0.08, 0.08, 0x30354a, 0.4, 4.15, 0);
  add(g, new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd796 }), 0.8, 4.0, 0);
  const L = new THREE.PointLight(0xffa04a, 1.3, 11, 2); L.position.set(0.8, 3.7, 0); g.add(L);
  shadows(g); return g;
}
export function cone(scene, x, z) {
  const g = grp(scene, x, 0, z);
  add(g, new THREE.ConeGeometry(0.28, 0.75, 12), C.orange, 0, 0.375, 0); cylY(g, 0.19, 0.13, C.white, 0, 0.42, 0, 12);
  box(g, 0.6, 0.06, 0.6, C.orange, 0, 0.03, 0); shadows(g); return g;
}
export function barrier(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  [-1, 1].forEach((s) => { box(g, 0.1, 1, 0.1, C.white, s, 0.5, 0); box(g, 0.5, 0.08, 0.5, C.dark, s, 0.04, 0); });
  for (let i = 0; i < 4; i++) box(g, 0.5, 0.28, 0.08, i % 2 ? C.white : C.orange, -0.75 + i * 0.5, 0.82, 0);
  shadows(g); return g;
}
export function office(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  box(g, 4.4, 2.5, 2.3, C.blue, 0, 1.35, 0); for (let i = -2; i <= 2; i++) box(g, 0.08, 2.3, 2.36, C.blueD, i * 0.9, 1.35, 0);
  box(g, 4.5, 0.12, 2.4, C.blueD, 0, 2.65, 0); box(g, 4.5, 0.15, 2.4, C.dark, 0, 0.08, 0);
  box(g, 0.9, 1.6, 0.06, 0x23306e, -1.3, 1.05, 1.19); box(g, 1.3, 0.8, 0.06, WARM, 0.9, 1.55, 1.19);
  shadows(g); return g;
}
export function stringLights(scene, a, b) {
  const cols = [0xffd796, 0xff8a5c, 0xfff0b0, 0x9fd0ff];
  for (let i = 1; i < 14; i++) {
    const t = i / 14, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * 0.9;
    add(scene, new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4] }), p.x, p.y, p.z);
  }
}
export function pipes(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  cylX(g, 0.45, 3.2, C.concrete, -0.5, 0.45, 0, 14); cylX(g, 0.45, 3.2, C.concrete, 0.5, 0.45, 0, 14); cylX(g, 0.45, 3.2, C.concrete, 0, 1.22, 0, 14);
  shadows(g); return g;
}

/* ---------- farm ---------- */
export function barn(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  const red = 0xb8322a, roof = 0x5a3a33, trim = 0xf3ede1;
  ext(g, [[-3, 0], [3, 0], [3, 3], [1.8, 4.6], [0, 5.3], [-1.8, 4.6], [-3, 3]], 0, 6, red, 0, 0, 0, 0.02);
  ext(g, [[-3.3, 2.88], [-1.98, 4.78], [0, 5.55], [1.98, 4.78], [3.3, 2.88], [3.05, 2.8], [1.8, 4.55], [0, 5.25], [-1.8, 4.55], [-3.05, 2.8]], 0, 6.5, roof, 0, 0, 0, 0.02);
  box(g, 2.2, 2.6, 0.1, 0x8a2620, 0, 1.3, 3.02);
  [[-0.55], [0.55]].forEach(([xx]) => { box(g, 1.0, 2.5, 0.06, trim, xx, 1.3, 3.06); });
  box(g, 0.08, 2.5, 0.08, red, 0, 1.3, 3.1); box(g, 2.1, 0.08, 0.08, red, 0, 2.45, 3.1);
  box(g, 1.0, 0.7, 0.06, WARM, 0, 3.6, 3.04);
  shadows(g); return g;
}
export function silo(scene, x, z, h) {
  const g = grp(scene, x, 0, z), H = h || 7;
  cylY(g, 1.2, H, 0xc9d1d6, 0, H / 2, 0, 24);
  for (let y = 0.8; y < H; y += 0.9) cylY(g, 1.22, 0.06, 0x9aa5ad, 0, y, 0, 24);
  add(g, new THREE.ConeGeometry(1.35, 1.0, 24), 0x9aa5ad, 0, H + 0.5, 0);
  for (let y = 0.4; y < H; y += 0.35) box(g, 0.32, 0.04, 0.04, 0x6b737a, 1.24, y, 0);
  shadows(g); return g;
}
export function fence(scene, a, b, n) {
  const g = grp(scene, 0, 0, 0), wood = 0x9a7a55;
  for (let i = 0; i <= n; i++) { const t = i / n; box(g, 0.14, 0.9, 0.14, wood, a[0] + (b[0] - a[0]) * t, 0.45, a[1] + (b[1] - a[1]) * t); }
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  [0.4, 0.72].forEach((y) => { const r = box(g, L, 0.08, 0.06, wood, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); r.rotation.y = ang; });
  shadows(g); return g;
}
export function farmhouse(scene, x, z, ry) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  box(g, 4.4, 2.8, 3.2, 0xf1e6d2, 0, 1.4, 0);
  ext(g, [[-2.5, 0], [2.5, 0], [0, 1.6]], 0, 3.6, 0xc0583a, 0, 2.8, 0, 0.03);
  box(g, 0.8, 1.5, 0.06, 0x6b3b2a, -1.0, 0.75, 1.62);
  [[0.6, 1.6], [1.6, 1.6]].forEach(([xx, yy]) => { box(g, 0.7, 0.6, 0.06, WARM, xx, yy, 1.62); });
  box(g, 0.5, 1.0, 0.5, 0x8a5a45, 1.4, 4.0, -0.6);
  shadows(g); return g;
}
export function roundBaleStack(scene, x, z, ry, n) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry || 0;
  const geo = new THREE.CylinderGeometry(0.62, 0.62, 1.15, 20); geo.rotateX(Math.PI / 2);
  const mats = [MT.straw || new THREE.MeshLambertMaterial({ color: 0xe2bd55 })];
  for (let i = 0; i < (n || 3); i++) add(g, geo, mats[0], i * 1.25 - 1.25, 0.62, 0);
  if ((n || 3) >= 3) add(g, geo, mats[0], -0.62, 1.7, 0), add(g, geo, mats[0], 0.62, 1.7, 0);
  shadows(g); return g;
}
export function pond(scene, x, z, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshLambertMaterial({ color: 0x3a6fd8 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.scale.set(1.3, 1, 1); scene.add(m);
  const rim = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.35, 28), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.025, z); rim.scale.set(1.3, 1, 1); scene.add(rim);
  return m;
}
export { rbox, MT };
