// Mechanical parts: tracks, tyres, hydraulic rams, cabs, people.
import * as THREE from 'three';
import { V3 } from './util.js';
import {
  MT, UB, dummy, add, box, grp, cylGeo, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, gearShape, shadows
} from './geo.js';

const _a = new V3(), _b = new V3(), _d = new V3(), YAX = new V3(0, 1, 0);

/** Point group g (living in `parent`) from anchor A to anchor B; returns length. */
export function orient(g, parent, A, B) {
  A.getWorldPosition(_a); B.getWorldPosition(_b);
  parent.worldToLocal(_a); parent.worldToLocal(_b);
  _d.subVectors(_b, _a); const L = _d.length() || 0.001;
  g.position.copy(_a); g.quaternion.setFromUnitVectors(YAX, _d.multiplyScalar(1 / L));
  return L;
}

/** Hydraulic cylinder between two anchors: barrel stays, chrome rod slides. */
export function hydraulic(parent, A, B, o) {
  const g = grp(parent), rb = o.rb || 0.09, rr = o.rr || rb * 0.55, rs = o.barrel * 0.22;
  const barrel = add(g, cylGeo(14), o.mat || MT.yel); barrel.scale.set(rb, o.barrel, rb); barrel.position.y = o.barrel / 2;
  const gland = add(g, cylGeo(14), MT.dark); gland.scale.set(rb * 1.12, 0.07, rb * 1.12); gland.position.y = o.barrel;
  const base = add(g, cylGeo(14), MT.dark); base.scale.set(rb * 1.05, 0.06, rb * 1.05); base.position.y = 0.03;
  rod(g, new V3(rb, 0.12, 0), new V3(rb, o.barrel * 0.9, 0), 0.018, MT.black, 6);
  const rodM = add(g, cylGeo(12), MT.chrome);
  const eye = grp(g); cylZ(eye, rr * 1.5, rr * 3.2, MT.dark, 0, 0, 0, 10);
  return {
    update() {
      const L = orient(g, parent, A, B), rl = Math.max(0.02, L - rs);
      rodM.scale.set(rr, rl, rr); rodM.position.y = rs + rl / 2; eye.position.y = L;
    }
  };
}

/** Multi-stage telescopic ram (tipper trucks). */
export function telescopic(parent, A, B, o) {
  const g = grp(parent), n = o.n || 5, sl = o.stage || 1.1, parts = [];
  for (let i = 0; i < n; i++) {
    const r = (o.r || 0.16) - i * 0.024;
    const m = add(g, cylGeo(18), i === 0 ? MT.dark : MT.chrome); m.scale.set(r, sl, r); parts.push(m);
    if (i > 0) { const c = add(g, cylGeo(18), MT.dark); c.scale.set(r + 0.012, 0.05, r + 0.012); parts.push(c); }
  }
  return {
    update() {
      const L = orient(g, parent, A, B), ex = Math.max(0, L - sl); let k = 0;
      for (let i = 0; i < n; i++) {
        const off = n > 1 ? (ex * i) / (n - 1) : 0;
        parts[k++].position.y = off + sl / 2;
        if (i > 0) parts[k++].position.y = off + sl - 0.02;
      }
    }
  };
}

/** Rigid bar between two anchors. */
export function strut(parent, A, B, t, m) {
  const g = grp(parent); const b = add(g, UB, m);
  return { update() { const L = orient(g, parent, A, B); b.scale.set(t, L, t); b.position.y = L / 2; } };
}

/** Crawler track: instanced shoes running around idler + sprocket. update(dx) when the machine moves. */
export function trackUnit(p, o) {
  const g = grp(p, 0, 0.1, o.z), r = o.r, c = o.len / 2 - r;
  const P = 4 * c + 2 * Math.PI * r, N = Math.round(P / (o.pitch || 0.19)), pitch = P / N;
  const pg = new THREE.BoxGeometry(pitch * 0.9, 0.055, o.w); pg.translate(0, -0.028, 0);
  const gg = new THREE.BoxGeometry(0.045, 0.05, o.w * 0.98); gg.translate(0, -0.075, 0);
  const lg = new THREE.BoxGeometry(pitch * 0.95, 0.07, 0.07); lg.translate(0, 0.02, 0);
  const plates = new THREE.InstancedMesh(pg, MT.shoe, N), grous = new THREE.InstancedMesh(gg, MT.shoe, N);
  const links = new THREE.InstancedMesh(lg, MT.black, N * 2);
  [plates, grous, links].forEach((m) => {
    m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(m);
  });
  let off = 0;
  function place(s) {
    s = ((s % P) + P) % P; let x, y, a;
    if (s < 2 * c) { x = -c + s; y = 0; a = 0; }
    else if ((s -= 2 * c) < Math.PI * r) { const t = -Math.PI / 2 + s / r; x = c + r * Math.cos(t); y = r + r * Math.sin(t); a = t + Math.PI / 2; }
    else if ((s -= Math.PI * r) < 2 * c) { x = c - s; y = 2 * r; a = Math.PI; }
    else { s -= 2 * c; const t = Math.PI / 2 + s / r; x = -c + r * Math.cos(t); y = r + r * Math.sin(t); a = t + Math.PI / 2; }
    dummy.position.set(x, y, 0); dummy.rotation.set(0, 0, a); dummy.scale.set(1, 1, 1);
  }
  function write() {
    for (let i = 0; i < N; i++) {
      place(i * pitch + off); dummy.updateMatrix();
      plates.setMatrixAt(i, dummy.matrix); grous.setMatrixAt(i, dummy.matrix);
      dummy.position.z = o.w * 0.28; dummy.updateMatrix(); links.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.z = -o.w * 0.28; dummy.updateMatrix(); links.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    plates.instanceMatrix.needsUpdate = grous.instanceMatrix.needsUpdate = links.instanceMatrix.needsUpdate = true;
  }
  write();
  const idler = grp(g, c, r, 0);
  cylZ(idler, r * 0.86, o.w * 0.62, MT.dark, 0, 0, 0, 24); cylZ(idler, r * 0.5, o.w * 0.7, MT.steel, 0, 0, 0, 16);
  box(idler, r * 1.1, 0.06, o.w * 0.72, MT.black, 0, 0, 0);
  const spr = grp(g, -c, r, 0);
  const sg = new THREE.ExtrudeGeometry(gearShape(r * 0.95, r * 0.78, 10), { depth: o.w * 0.35, bevelEnabled: false });
  sg.translate(0, 0, -o.w * 0.175); add(spr, sg, MT.dark);
  cylZ(spr, r * 0.55, o.w * 0.55, MT.steel, 0, 0, 0, 16); cylZ(spr, r * 0.62, 0.3, MT.dark, 0, 0, Math.sign(o.z) * o.w * 0.4, 16);
  const nb = Math.max(3, Math.round((c * 2) / 0.55));
  for (let k = 1; k < nb; k++) cylZ(g, 0.12, o.w * 0.62, MT.dark, -c + (k * (2 * c)) / nb, 0.13, 0, 12);
  cylZ(g, 0.09, o.w * 0.45, MT.dark, 0, 2 * r - 0.1, 0, 10);
  rbox(g, 2 * c, r * 0.95, o.w * 0.5, 0.08, o.frame || MT.dark, 0, r, 0);
  if (o.guard) rbox(g, 2 * c * 0.9, 0.12, o.w * 0.25, 0.04, o.frame || MT.dark, 0, r * 1.55, Math.sign(o.z) * o.w * 0.3);
  return { g, update(dx) { off -= dx; write(); idler.rotation.z -= dx / (r * 0.86); spr.rotation.z -= dx / r; } };
}

/** Tyre + rim with nuts. side = +1/-1 for the outer face. */
const TG = {};
export function tire(p, R, w, x, y, z, rimM, side, rubber) {
  const key = R + '_' + w;
  if (!TG[key]) {
    const ri = R * 0.6;
    const pts = [[ri, -w / 2], [R * 0.9, -w / 2], [R * 0.97, -w / 2 + w * 0.07], [R, -w * 0.3], [R, w * 0.3], [R * 0.97, w / 2 - w * 0.07], [R * 0.9, w / 2], [ri, w / 2]]
      .map((q) => new THREE.Vector2(q[0], q[1]));
    const g = new THREE.LatheGeometry(pts, 36); g.rotateX(Math.PI / 2); TG[key] = g;
  }
  const g = grp(p, x, y, z), ri = R * 0.6, s = side || Math.sign(z) || 1;
  add(g, TG[key], rubber || MT.rubber);
  cylZ(g, ri, w * 0.86, rimM || MT.grey, 0, 0, 0, 24); cylZ(g, ri * 0.72, w * 0.9, MT.dark, 0, 0, 0, 20);
  cylZ(g, ri * 0.42, 0.06, rimM || MT.grey, 0, 0, s * w * 0.45, 16); cylZ(g, ri * 0.2, 0.08, MT.steel, 0, 0, s * w * 0.47, 10);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cylZ(g, 0.022, 0.05, MT.chrome, Math.cos(a) * ri * 0.3, Math.sin(a) * ri * 0.3, s * w * 0.48, 6); }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const h = add(g, cylGeo(8), MT.black, Math.cos(a) * ri * 0.58, Math.sin(a) * ri * 0.58, s * w * 0.44);
    h.rotation.x = Math.PI / 2; h.scale.set(ri * 0.11, 0.02, ri * 0.11);
  }
  g.userData.r = R; return g;
}

/** Big agricultural tyre with chevron lugs (instanced). */
export function agriTire(p, R, w, x, y, z, rimM, side) {
  const g = tire(p, R * 0.94, w, x, y, z, rimM, side, MT.rubberS);
  const n = Math.round(R * 22), lug = new THREE.BoxGeometry(R * 0.16, R * 0.09, w * 0.5);
  const im = new THREE.InstancedMesh(lug, MT.rubberS, n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    [1, -1].forEach((sd, j) => {
      dummy.position.set(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, sd * w * 0.24);
      dummy.rotation.set(sd * 0.5, 0, a + Math.PI / 2); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      im.setMatrixAt(i * 2 + j, dummy.matrix);
    });
  }
  im.castShadow = true; g.add(im); g.userData.r = R; return g;
}

export function fender(p, R, w, x, y, z, m, arcLen) {
  const geo = new THREE.CylinderGeometry(R, R, w, 20, 1, true, -Math.PI / 2 + (Math.PI - (arcLen || Math.PI)) / 2, arcLen || Math.PI);
  geo.rotateX(Math.PI / 2);
  const f = add(p, geo, m, x, y, z); f.material = m.clone(); f.material.side = THREE.DoubleSide; return f;
}

/** Flashing beacon; registered on the station so the stage can blink it while working. */
export function beacon(st, p, x, y, z) {
  const g = grp(p, x, y, z); cylY(g, 0.07, 0.05, MT.black, 0, 0.025, 0, 12);
  const m = MT.amber.clone(); cylY(g, 0.06, 0.13, m, 0, 0.11, 0, 12); sph(g, 0.06, m, 0, 0.175, 0);
  (st.beacons = st.beacons || []).push(m); return g;
}

/** Seated driver facing +x (hi-vis vest, hard hat). */
export function operator(p, x, y, z, hatM) {
  const g = grp(p, x, y, z);
  rbox(g, 0.44, 0.09, 0.44, 0.04, MT.black, 0, 0.05, 0); rbox(g, 0.09, 0.55, 0.44, 0.04, MT.black, -0.22, 0.32, 0);
  rbox(g, 0.42, 0.13, 0.13, 0.05, MT.pants, 0.16, 0.16, 0.1); rbox(g, 0.42, 0.13, 0.13, 0.05, MT.pants, 0.16, 0.16, -0.1);
  rbox(g, 0.12, 0.36, 0.13, 0.04, MT.pants, 0.36, -0.04, 0.1); rbox(g, 0.12, 0.36, 0.13, 0.04, MT.pants, 0.36, -0.04, -0.1);
  rbox(g, 0.26, 0.42, 0.38, 0.1, MT.vest, -0.06, 0.42, 0); rbox(g, 0.27, 0.05, 0.39, 0.02, MT.refl, -0.06, 0.36, 0);
  rod(g, new V3(-0.04, 0.58, 0.2), new V3(0.24, 0.34, 0.24), 0.055, MT.vest); rod(g, new V3(-0.04, 0.58, -0.2), new V3(0.24, 0.34, -0.24), 0.055, MT.vest);
  sph(g, 0.035, MT.black, 0.26, 0.34, 0.24); sph(g, 0.035, MT.black, 0.26, 0.34, -0.24);
  sph(g, 0.11, MT.skin, -0.04, 0.75, 0);
  add(g, new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM || MT.hat, -0.04, 0.78, 0);
  cylY(g, 0.15, 0.02, hatM || MT.hat, -0.02, 0.78, 0, 16);
  return g;
}

/** Standing worker. */
export function worker(scene, x, z, ry, hatM) {
  const g = grp(scene, x, 0, z); g.rotation.y = ry;
  [0.09, -0.09].forEach((s) => { rbox(g, 0.13, 0.58, 0.13, 0.05, MT.pants, 0, 0.33, s); rbox(g, 0.22, 0.09, 0.14, 0.04, MT.black, 0.03, 0.045, s); });
  rbox(g, 0.24, 0.48, 0.4, 0.1, MT.vest, 0, 0.86, 0); rbox(g, 0.25, 0.05, 0.41, 0.02, MT.refl, 0, 0.8, 0); rbox(g, 0.25, 0.05, 0.41, 0.02, MT.refl, 0, 0.95, 0);
  rod(g, new V3(0, 1.04, 0.24), new V3(0.05, 0.64, 0.27), 0.055, MT.vest); rod(g, new V3(0, 1.04, -0.24), new V3(0.18, 0.7, -0.3), 0.055, MT.vest);
  sph(g, 0.12, MT.skin, 0, 1.22, 0);
  add(g, new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM || MT.hat, 0, 1.25, 0);
  cylY(g, 0.165, 0.02, hatM || MT.hat, 0.02, 1.25, 0, 16);
  shadows(g); return g;
}

/** Cab-over truck cab. Origin = rear-bottom of the cab, sitting on the chassis. */
export function truckCab(p, bodyM, x0) {
  const g = grp(p, x0, 1.12, 0);
  ext(g, [[0, 0], [1.62, 0], [1.68, 0.55], [1.62, 0.92], [1.47, 1.62], [1.26, 1.8], [0, 1.8]], [0.04, 0.08, 0.1, 0.1, 0.18, 0.2, 0.06], 2.2, bodyM, 0, 0, 0, 0.04);
  const ws = rod(g, new V3(1.635, 0.96, 0), new V3(1.49, 1.6, 0), 1, MT.glassD); ws.scale.x = 0.02; ws.scale.z = 1.85; ws.geometry = UB;
  [1, -1].forEach((s) => {
    rbox(g, 0.95, 0.62, 0.03, 0.06, MT.glassD, 1.0, 1.28, s * 1.1, 0.01); rbox(g, 0.28, 0.45, 0.03, 0.05, MT.glassD, 0.3, 1.36, s * 1.1, 0.01);
    box(g, 0.02, 1.05, 0.02, MT.black, 1.5, 0.55, s * 1.105); box(g, 0.02, 1.05, 0.02, MT.black, 0.48, 0.55, s * 1.105);
    rbox(g, 0.12, 0.035, 0.03, 0.01, MT.chrome, 0.62, 0.78, s * 1.12, 0.008);
    rod(g, new V3(1.42, 1.38, s * 1.1), new V3(1.7, 1.46, s * 1.36), 0.025, MT.black);
    rbox(g, 0.08, 0.4, 0.17, 0.03, MT.black, 1.72, 1.3, s * 1.38); rbox(g, 0.06, 0.15, 0.14, 0.03, MT.black, 1.72, 1.02, s * 1.33);
    rbox(g, 0.5, 0.06, 0.3, 0.02, MT.black, 1.15, -0.25, s * 0.98); rbox(g, 0.5, 0.06, 0.3, 0.02, MT.black, 1.15, -0.6, s * 0.98);
    box(g, 0.04, 0.62, 0.04, MT.black, 0.92, -0.4, s * 1.12);
    rbox(g, 0.06, 0.15, 0.34, 0.04, MT.lamp, 1.7, 0.32, s * 0.78); rbox(g, 0.06, 0.1, 0.14, 0.03, MT.amber, 1.7, 0.32, s * 1.02);
  });
  rbox(g, 0.07, 0.4, 1.25, 0.04, MT.black, 1.68, 0.6, 0);
  for (let i = 0; i < 4; i++) box(g, 0.02, 0.03, 1.15, MT.chrome, 1.72, 0.47 + i * 0.09, 0);
  rbox(g, 0.26, 0.3, 2.26, 0.06, MT.dark, 1.7, 0.05, 0);
  const sv = rbox(g, 0.34, 0.06, 2.1, 0.02, bodyM, 1.4, 1.78, 0); sv.rotation.z = -0.25;
  cylX(g, 0.035, 0.4, MT.chrome, 0.6, 1.86, 0.3, 10); cylX(g, 0.03, 0.32, MT.chrome, 0.6, 1.86, 0.4, 10);
  return g;
}

/** Glazed cab frame (4 posts + roof + glass) with a seated operator. Origin at floor centre. */
export function glassCab(p, x, y, z, o) {
  const g = grp(p, x, y, z), L = o.len, W = o.wid, H = o.h, M = o.mat;
  rbox(g, L, 0.08, W, 0.03, MT.dark, 0, 0.04, 0);
  [[L / 2 - 0.05, W / 2 - 0.05], [L / 2 - 0.05, -W / 2 + 0.05], [-L / 2 + 0.05, W / 2 - 0.05], [-L / 2 + 0.05, -W / 2 + 0.05]]
    .forEach(([a, b]) => rbox(g, 0.08, H, 0.08, 0.03, M, a, H / 2, b, 0.01));
  rbox(g, L + 0.12, 0.12, W + 0.14, 0.05, o.roof || M, 0, H + 0.02, 0);
  box(g, 0.02, H - 0.25, W - 0.14, MT.glass, L / 2 - 0.05, H / 2 + 0.05, 0);
  box(g, 0.02, H - 0.25, W - 0.14, MT.glass, -L / 2 + 0.05, H / 2 + 0.05, 0);
  box(g, L - 0.14, H - 0.25, 0.02, MT.glass, 0, H / 2 + 0.05, W / 2 - 0.05);
  box(g, L - 0.14, H - 0.25, 0.02, MT.glass, 0, H / 2 + 0.05, -W / 2 + 0.05);
  rod(g, new V3(L / 2 - 0.05, H * 0.8, W / 2), new V3(L / 2 + 0.2, H * 0.86, W / 2 + 0.16), 0.02, MT.black);
  rbox(g, 0.04, 0.24, 0.15, 0.03, MT.black, L / 2 + 0.22, H * 0.85, W / 2 + 0.18);
  [W / 2 - 0.2, -W / 2 + 0.2].forEach((zz) => rbox(g, 0.08, 0.09, 0.14, 0.02, MT.lamp, L / 2 + 0.03, H + 0.04, zz, 0.01));
  operator(g, -0.12, 0.08, 0, o.hat);
  const swh = add(g, new THREE.TorusGeometry(0.17, 0.025, 6, 16), MT.black, L / 2 - 0.32, 0.62, 0);
  swh.rotation.y = Math.PI / 2; swh.rotation.z = 0.6;
  return g;
}

export { rail };
