// Le Recyclage — from the street to the factory: the bins are collected, the glass banks emptied, everything is sorted,
// the metal cans pulled out by a giant magnet, the plastic pressed into bales and loaded on a truck for the factory.
// Around it: the scrap yard and its grab crane, and the garden-waste shredder that makes compost.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone, beep } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, arc, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { tire, fender, hydraulic, operator, glassCab, truckCab, beacon } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp, autumnTree } from '../kit/props.js';
import { route, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, PI = Math.PI;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };

/* ================= palette ================= */
const RM = {
  white: std(0xf4f5f8, 0.35, 0.1), whiteD: std(0xd9dce4, 0.45, 0.15), green: std(0x2fae55, 0.4, 0.1), greenD: std(0x1f7a3e, 0.5, 0.1),
  mh: std(0x4cb53a, 0.4, 0.1), yel: std(0xf4c21c, 0.4, 0.15), yelD: std(0xcf9a10, 0.5, 0.2), blue: std(0x2f6fe0, 0.4, 0.15), blueD: std(0x2450b0, 0.5, 0.15),
  orange: std(0xf27a24, 0.4, 0.15), red: std(0xd8402a, 0.4, 0.15), grey: std(0x9aa0ae, 0.45, 0.5), greyL: std(0xc4c8d2, 0.5, 0.3), greyD: std(0x5a6070, 0.5, 0.4),
  dark: std(0x2c3140, 0.6, 0.2), wire: std(0x3a3f4a, 0.4, 0.8), concrete: std(0xc6c8d0, 0.9, 0), concreteD: std(0xa4a7b2, 0.9, 0),
  wood: std(0xc89a5a, 0.8, 0), woodD: std(0x7a5232, 0.8, 0), binBody: std(0x3e4c48, 0.6, 0.05),
  lidY: std(0xf4c21c, 0.45, 0.05), lidG: std(0x3aa14a, 0.5, 0.05), lidGr: std(0x6a7080, 0.5, 0.05),
  bank: std(0x3a9a50, 0.5, 0.05, { side: THREE.DoubleSide }), bankB: std(0x2f6fe0, 0.5, 0.05, { side: THREE.DoubleSide }),
  pBlue: std(0x7ac0f4, 0.2, 0.05), pClear: std(0xe2f2fa, 0.2, 0.05), pGreen: std(0x5ac080, 0.25, 0.05),
  gGreen: std(0x4caf5a, 0.15, 0.1), gWhite: std(0xd8eef2, 0.15, 0.1), gBrown: std(0xb0702e, 0.2, 0.1),
  paper: std(0xf2ecd8, 0.9, 0), paperB: std(0x9cc8f0, 0.9, 0), card: std(0xc89a5a, 0.9, 0),
  can: std(0xc0c8d4, 0.3, 0.8), canR: std(0xd8402a, 0.35, 0.5), canY: std(0xf2c21c, 0.35, 0.5), carton: std(0xf4f6fa, 0.6, 0), cartonB: std(0x3a7ae0, 0.6, 0),
  hedge: std(0x3f8f4a, 0.9, 0), grass: std(0x6fb85e, 0.95, 0), roof: std(0xc8583a, 0.75, 0), roofG: std(0x6a7086, 0.6, 0.3),
  cream: std(0xf3e6cc, 0.85, 0), peach: std(0xf2c09a, 0.85, 0), wallW: std(0xf4f1ea, 0.85, 0), wallY: std(0xf4dc9a, 0.85, 0),
  shutB: std(0x4a8ad8, 0.7, 0), shutG: std(0x5aa86a, 0.7, 0), shutR: std(0xc85a4a, 0.7, 0), door: std(0x6a3f2a, 0.7, 0),
  clad: std(0x2f8a50, 0.6, 0.2), cladW: std(0xe8ecf0, 0.5, 0.2), mud: std(0x7a5a3a, 0.95, 0), chips: std(0xc8945a, 0.95, 0), soil: std(0x5a4030, 0.95, 0),
  chuteB: std(0x2f6fe0, 0.4, 0.15, { side: THREE.DoubleSide }), chuteY: std(0xf4c21c, 0.4, 0.15, { side: THREE.DoubleSide }),
  hiVis: std(0xd8ff2a, 0.45, 0, { emissive: 0x3a4a00 }), hiOr: std(0xff7a1a, 0.45, 0, { emissive: 0x4a1800 }), helmet: std(0xffd21c, 0.35, 0.05),
  canShine: [0xe8402a, 0x2f7de0, 0xf4c21c, 0x3ab85a, 0xf07aa8].map((c) => std(c, 0.22, 0.55)), lid: std(0xe8ecf2, 0.18, 1.2),
  scrap: std(0x6e6874, 0.8, 0.3), leaf: std(0x5aa84a, 0.85, 0), bark: std(0x7a5232, 0.85, 0)
};
const bake = (g) => { shadows(g); freeze(g); return g; };

/* ---------- textures ---------- */
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
/** Rubber belt with cleats; along = 'u' (cleats across u) or 'v'. */
function beltTex(along = 'u') {
  return canvasTex(64, 64, (x) => {
    x.fillStyle = '#2b2d36'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#454957';
    for (let i = 0; i < 64; i += 32) { if (along === 'u') x.fillRect(i, 0, 7, 64); else x.fillRect(0, i, 64, 7); }
  });
}
const BALE_COLS = {
  plastic: ['#7ac0f4', '#e2f2fa', '#5ac080', '#b8dcf8', '#f2f6fa', '#3a8ae0'], paper: ['#f4efe0', '#e0d4b8', '#9cc8f0', '#d8dde6', '#f2c8a0', '#c89a5a'],
  mix: ['#7ac0f4', '#f2ecd8', '#c0c8d4', '#d8402a', '#f2c21c', '#5ac080', '#c89a5a', '#e2f2fa'], can: ['#c0c8d4', '#a8b0bc', '#d8402a', '#f2c21c', '#e0e4ea']
};
function baleTex(kind) {
  return canvasTex(128, 128, (x) => {
    x.fillStyle = { plastic: '#9fc8e8', paper: '#d8ccb0', mix: '#b8b0a0', can: '#9aa2ae' }[kind]; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 110; i++) {
      x.fillStyle = pick(BALE_COLS[kind]); x.save(); x.translate(rnd(0, 128), rnd(0, 128)); x.rotate(rnd(0, 3));
      if (kind === 'paper') x.fillRect(-13, -4, 26, 8); else { x.beginPath(); x.ellipse(0, 0, rnd(5, 11), rnd(3, 6), 0, 0, 7); x.fill(); }
      x.restore();
    }
  });
}
const BM = { plastic: std(0xffffff, 0.7, 0, { map: baleTex('plastic') }), paper: std(0xffffff, 0.85, 0, { map: baleTex('paper') }), mix: std(0xffffff, 0.85, 0, { map: baleTex('mix') }), can: std(0xffffff, 0.5, 0.3, { map: baleTex('can') }) };

/* ---------- little things that get recycled (lying versions for belts and heaps) ---------- */
const merge = (gs) => BufferGeometryUtils.mergeBufferGeometries(gs);
const cg = (rt, rb, h, y, seg = 10) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, y, 0); return g; };
const lying = (g, len, r) => { g.rotateZ(PI / 2); g.translate(len / 2, r, 0); return g; };
const IG = {
  bottle: lying(merge([cg(0.075, 0.075, 0.2, 0.1), cg(0.032, 0.075, 0.07, 0.235), cg(0.032, 0.032, 0.05, 0.295), cg(0.038, 0.038, 0.03, 0.33)]), 0.345, 0.075),
  glass: lying(merge([cg(0.07, 0.07, 0.22, 0.11), cg(0.027, 0.07, 0.07, 0.255), cg(0.026, 0.026, 0.11, 0.345)]), 0.4, 0.07),
  can: lying(cg(0.06, 0.06, 0.14, 0.07, 12), 0.14, 0.06),
  paper: (() => { const g = new THREE.BoxGeometry(0.34, 0.03, 0.25); g.translate(0, 0.015, 0); return g; })(),
  carton: (() => { const a = new THREE.BoxGeometry(0.13, 0.22, 0.13); a.translate(0, 0.11, 0); const b = new THREE.BoxGeometry(0.13, 0.04, 0.02); b.translate(0, 0.24, 0); return merge([a, b]); })()
};
/** A big food can (lying, along +x) for the magnet station, with silver lids as a second mesh. */
const BIGCAN = lying(cg(0.12, 0.12, 0.26, 0.13, 16), 0.26, 0.12);
const BIGLID = lying(merge([cg(0.122, 0.122, 0.025, 0.012, 16), cg(0.122, 0.122, 0.025, 0.248, 16)]), 0.26, 0.12);
const IM = { bottle: [RM.pBlue, RM.pClear, RM.pGreen], glass: [RM.gGreen, RM.gWhite, RM.gBrown], can: [RM.can, RM.canR, RM.canY], paper: [RM.paper, RM.paperB, RM.card], carton: [RM.carton, RM.cartonB] };
const IC = { bottle: [0x7ac0f4, 0xe2f2fa, 0x5ac080], glass: [0x4caf5a, 0xd8eef2, 0xb0702e], can: [0xc0c8d4, 0xd8402a, 0xf2c21c], paper: [0xf2ecd8, 0x9cc8f0, 0xc89a5a], carton: [0xf4f6fa, 0x3a7ae0] };
function item(p, k) { const m = add(p, IG[k], pick(IM[k])); m.scale.setScalar(1.5); m.rotation.y = rnd(0, 6.3); m.visible = false; m.castShadow = true; return m; }
/** A pool of items moving on belts and falling into bins. update() animates the falling ones. */
function itemPool(p, kinds, n) {
  const all = []; kinds.forEach((k) => { for (let i = 0; i < n; i++) all.push({ m: item(p, k), k, on: false }); });
  const P = {
    all,
    take(k) { const it = all.find((i) => i.k === k && !i.on); if (!it) return null; it.on = true; it.m.visible = true; it.state = 'belt'; it.s = 0; it.t = 0; it.z = rnd(-0.3, 0.3); it.m.rotation.y = rnd(0, 6.3); return it; },
    free(it) { it.on = false; it.m.visible = false; },
    reset() { all.forEach((it) => P.free(it)); },
    drop(it, b, dur, hop = 0.4, done) { it.state = 'drop'; it.t = 0; it.a = it.m.position.clone(); it.b = b; it.dur = dur; it.hop = hop; it.done = done; },
    update(dt) {
      all.forEach((it) => {
        if (!it.on || it.state !== 'drop') return;
        it.t += dt; const k = Math.min(1, it.t / it.dur);
        it.m.position.set(it.a.x + (it.b.x - it.a.x) * k, it.a.y + (it.b.y - it.a.y) * k * k + it.hop * 4 * k * (1 - k), it.a.z + (it.b.z - it.a.z) * k);
        it.m.rotation.x += dt * 5;
        if (k >= 1) { const d = it.done; it.state = 'rest'; it.m.rotation.x = 0; if (d) d(it); }
      });
    }
  };
  return P;
}

/* ---------- reusable pieces ---------- */
/** Belt conveyor from a to b ([x, y] in the parent's x-y plane). Returns { g, tex, L, ang, at(t, h) }. */
function conveyor(p, a, b, o = {}) {
  const w = o.w || 1.0, z = o.z || 0, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  const g = grp(p, a[0], a[1], z); g.rotation.z = ang;
  const tex = beltTex('u'); tex.repeat.set(L / 0.6, 1); const bm = std(0xffffff, 0.85, 0, { map: tex });
  const FM = o.frame || RM.green;
  box(g, L, 0.05, w, bm, L / 2, 0, 0);
  [1, -1].forEach((s) => {
    rbox(g, L + 0.1, 0.28, 0.07, 0.02, FM, L / 2, -0.13, s * (w / 2 + 0.06), 0.01);
    box(g, L, 0.16, 0.03, MT.black, L / 2, 0.1, s * (w / 2 - 0.03));
    if (o.rail) rail(g, [[0.3, 0.12, s * (w / 2 + 0.08)], [0.3, 0.5, s * (w / 2 + 0.08)], [L - 0.3, 0.5, s * (w / 2 + 0.08)], [L - 0.3, 0.12, s * (w / 2 + 0.08)]], 0.025, RM.yel);
  });
  cylZ(g, 0.17, w + 0.06, RM.grey, 0, -0.1, 0, 14); cylZ(g, 0.17, w + 0.06, RM.grey, L, -0.1, 0, 14);
  for (let x = 0.7; x < L - 0.3; x += 0.9) cylZ(g, 0.055, w, MT.steel, x, -0.32, 0, 8);
  if (o.motor !== false) { cylZ(g, 0.14, 0.4, RM.blueD, L - 0.05, -0.12, -(w / 2 + 0.3), 12); rbox(g, 0.3, 0.32, 0.2, 0.03, RM.dark, L - 0.05, -0.12, -(w / 2 + 0.55), 0.01); }
  if (o.legs !== false) {
    const n = Math.max(2, Math.round(L / 2.2) + 1);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + (i / (n - 1)) * (L - 0.5), px = a[0] + Math.cos(ang) * t, py = a[1] + Math.sin(ang) * t - 0.27;
      if (py < 0.25) continue;
      [1, -1].forEach((s) => box(p, 0.1, py, 0.1, FM, px, py / 2, z + s * (w / 2 + 0.06)));
      box(p, 0.07, 0.07, w + 0.16, FM, px, py * 0.4, z); box(p, 0.3, 0.04, 0.3, RM.dark, px, 0.02, z + (w / 2 + 0.06)); box(p, 0.3, 0.04, 0.3, RM.dark, px, 0.02, z - (w / 2 + 0.06));
    }
  }
  return { g, tex, L, ang, at: (t, h = 0.03) => new V3(a[0] + Math.cos(ang) * t - Math.sin(ang) * h, a[1] + Math.sin(ang) * t + Math.cos(ang) * h, z) };
}
/** 240 L wheelie bin, front (comb lip) facing +x, handle and wheels at the back. */
function wheelieBin(p, lidM, x = 0, z = 0, ry = 0) {
  const g = grp(p, x, 0, z); g.rotation.y = ry;
  ext(g, [[-0.3, 0.06], [0.3, 0.06], [0.35, 0.98], [-0.35, 0.98]], 0.04, 0.58, RM.binBody, 0, 0, 0, 0.02);
  rbox(g, 0.76, 0.06, 0.64, 0.02, RM.binBody, 0, 0.99, 0, 0.01);
  box(g, 0.05, 0.06, 0.5, MT.black, 0.37, 0.92, 0);
  cylZ(g, 0.025, 0.5, MT.black, -0.43, 0.97, 0, 6);
  [0.27, -0.27].forEach((zz) => { cylZ(g, 0.1, 0.06, MT.rubberS, -0.3, 0.1, zz, 12); cylZ(g, 0.05, 0.07, RM.greyL, -0.3, 0.1, zz, 8); });
  const lid = grp(g, -0.38, 1.02, 0); rbox(lid, 0.8, 0.05, 0.64, 0.02, lidM, 0.4, 0.02, 0, 0.01); box(lid, 0.08, 0.04, 0.36, lidM, 0.78, 0.0, 0);
  return { g, lid };
}
/** Glass bank (colonne à verre): bell body, two holes, lifting knob, bottom flaps that open. */
function glassBank(p, mat, label) {
  const g = grp(p);
  const pts = [[0.62, 0.08], [0.75, 0.1], [0.77, 0.3], [0.75, 1.32], [0.68, 1.52], [0.48, 1.68], [0.18, 1.76], [0.001, 1.77]].map(([r, y]) => new THREE.Vector2(r, y));
  add(g, new THREE.LatheGeometry(pts, 28), mat);
  cylY(g, 0.78, 0.08, RM.dark, 0, 0.12, 0, 28);
  [0.3, -0.3].forEach((x) => { const h = cylZ(g, 0.15, 0.06, MT.black, x, 1.22, 0.72, 16); h.rotation.x = 0; cylZ(g, 0.18, 0.04, RM.dark, x, 1.22, 0.7, 16); });
  decal(g, label, 0.9, 0.24, '#ffffff', 0, 0.75, 0.785, null);
  cylY(g, 0.05, 0.22, RM.grey, 0, 1.84, 0, 8); cylY(g, 0.14, 0.06, RM.dark, 0, 1.94, 0, 12); add(g, new THREE.TorusGeometry(0.1, 0.022, 6, 14), RM.grey, 0, 1.86, 0).rotation.x = PI / 2;
  const flaps = [1, -1].map((s) => { const f = grp(g, s * 0.74, 0.08, 0); rbox(f, 0.72, 0.05, 1.3, 0.04, RM.dark, -s * 0.37, 0, 0, 0.01); return f; });
  return { g, flaps };
}
/** Bale of sorted material, tied with wires. Origin at the bottom centre. */
function bale(p, kind, x = 0, y = 0, z = 0, ry = 0) {
  const g = grp(p, x, y, z); g.rotation.y = ry;
  rbox(g, 1.2, 1.0, 1.1, 0.05, BM[kind], 0, 0.5, 0, 0.02);
  [-0.4, 0, 0.4].forEach((u) => box(g, 0.03, 1.02, 1.12, RM.wire, u, 0.5, 0));
  return g;
}
/** Two-link arm: slew (y), boom, jib, tool that always hangs straight down. Pose by angles or by reach (R, Y) from the boom pivot. */
function ik(R, Y, l1, l2) {
  const d = Math.min(Math.hypot(R, Y), l1 + l2 - 0.01), c = clamp((d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2), -1, 1);
  const a2 = -Math.acos(c), a1 = Math.atan2(Y, R) - Math.atan2(l2 * Math.sin(a2), l1 + l2 * Math.cos(a2)); return [a1, a2];
}
function arm(slew, boom, jib, tool, l1, l2) {
  const A = { yaw: 0, a1: 0, a2: 0 };
  const apply = () => { slew.rotation.y = A.yaw; boom.rotation.z = A.a1; jib.rotation.z = A.a2; tool.rotation.z = -(A.a1 + A.a2); };
  const o = {
    A,
    setAng(yaw, a1, a2) { A.yaw = yaw; A.a1 = a1; A.a2 = a2; apply(); },
    set(yaw, R, Y) { const [a1, a2] = ik(R, Y, l1, l2); o.setAng(yaw, a1, a2); },
    fk() { return [l1 * Math.cos(A.a1) + l2 * Math.cos(A.a1 + A.a2), l1 * Math.sin(A.a1) + l2 * Math.sin(A.a1 + A.a2)]; },
    move(yaw, R, Y, d, ease = easeSine) { const y0 = A.yaw, [R0, Y0] = o.fk(); return tw(d, (k) => o.set(y0 + (yaw - y0) * k, R0 + (R - R0) * k, Y0 + (Y - Y0) * k), ease); },
    moveAng(yaw, a1, a2, d, ease = easeSine) { const s = { ...A }; return tw(d, (k) => o.setAng(s.yaw + (yaw - s.yaw) * k, s.a1 + (a1 - s.a1) * k, s.a2 + (a2 - s.a2) * k), ease); }
  };
  return o;
}
const walkTo = (o, b, dur, face = true) => {
  const a = o.position.clone(), dist = a.distanceTo(b);
  if (face && dist > 0.01) o.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
  return tw(dur, (k) => { o.position.lerpVectors(a, b, k); if (o.userData.walk) o.userData.walk(k * dist * 6); }, lin).then(() => o.userData.walk && o.userData.walk(0));
};
const setArms = (p, a) => p.userData.arms.forEach((m) => (m.rotation.z = a));

/* ================= the machines ================= */
/** French rear-loader garbage truck (white and green, low-entry cab). Returns { g, wheels, lift, blade, rip }. */
function bomTruck(st, p) {
  const g = grp(p), d = grp(g), W = RM.white, G = RM.green;
  [0.45, -0.45].forEach((z) => rbox(d, 8.4, 0.26, 0.16, 0.03, MT.black, -0.3, 0.86, z));
  // low-entry cab with a big windscreen
  ext(d, [[2.0, 0.42], [4.38, 0.42], [4.52, 0.62], [4.52, 1.38], [4.44, 1.5], [4.3, 2.78], [4.12, 2.98], [2.0, 2.98]], 0.06, 2.46, W, 0, 0, 0, 0.04);
  rbox(d, 2.58, 0.42, 2.5, 0.06, G, 3.27, 1.02, 0, 0.02);
  { const ws = box(d, 0.04, 1.3, 2.24, MT.glassD, 4.41, 2.14, 0); ws.rotation.z = 0.09; }
  box(d, 0.05, 0.05, 2.0, MT.black, 4.48, 1.55, 0);
  [1, -1].forEach((s) => {
    rbox(d, 1.05, 1.25, 0.03, 0.08, MT.glassD, 3.62, 2.12, s * 1.235, 0.01);
    rbox(d, 0.5, 0.5, 0.03, 0.06, MT.glassD, 3.72, 0.98, s * 1.262, 0.01);
    rbox(d, 0.8, 0.8, 0.03, 0.06, MT.glassD, 2.55, 2.25, s * 1.235, 0.01);
    box(d, 0.03, 2.4, 0.03, MT.black, 3.05, 1.7, s * 1.24); box(d, 0.03, 2.4, 0.03, MT.black, 4.22, 1.7, s * 1.24);
    rbox(d, 0.14, 0.04, 0.03, 0.01, MT.chrome, 3.2, 1.6, s * 1.27, 0.008);
    rod(d, new V3(4.35, 2.7, s * 1.15), new V3(4.75, 2.85, s * 1.45), 0.03, MT.black);
    rbox(d, 0.07, 0.55, 0.24, 0.03, MT.black, 4.78, 2.5, s * 1.5, 0.01); rbox(d, 0.06, 0.2, 0.18, 0.03, MT.black, 4.78, 2.05, s * 1.46, 0.01);
    rbox(d, 0.06, 0.16, 0.42, 0.04, MT.lamp, 4.55, 0.78, s * 0.78, 0.01); rbox(d, 0.06, 0.12, 0.16, 0.03, MT.amber, 4.55, 0.78, s * 1.08, 0.01);
    rbox(d, 0.55, 0.06, 0.34, 0.02, MT.black, 3.7, 0.42, s * 1.08, 0.01);
    rbox(d, 0.1, 0.12, 0.05, 0.02, MT.amber, 2.3, 0.95, s * 1.27, 0.01); // side indicator
  });
  rbox(d, 0.06, 0.36, 1.4, 0.04, MT.black, 4.54, 1.17, 0, 0.02); for (let i = 0; i < 3; i++) box(d, 0.02, 0.03, 1.3, MT.chrome, 4.58, 1.05 + i * 0.1, 0);
  rbox(d, 0.26, 0.26, 2.5, 0.06, RM.dark, 4.56, 0.5, 0, 0.02); rbox(d, 0.04, 0.16, 0.5, 0.02, MT.white, 4.7, 0.55, 0, 0.01);
  rbox(d, 0.8, 0.1, 0.22, 0.03, MT.amber, 3.4, 3.02, 0, 0.01); // roof light bar
  // the body: rounded box, green band, ribs, side writing
  rbox(d, 5.3, 2.45, 2.5, 0.22, W, -0.72, 2.25, 0, 0.04);
  rbox(d, 5.32, 0.5, 2.52, 0.05, G, -0.72, 1.45, 0, 0.02); rbox(d, 5.32, 0.08, 2.52, 0.02, G, -0.72, 1.84, 0, 0.01);
  for (let x = -3.05; x < 1.8; x += 0.95) box(d, 0.07, 1.5, 2.54, RM.whiteD, x, 2.65, 0);
  [1, -1].forEach((s) => { const D = grp(d, -0.72, 0, 0); if (s < 0) D.rotation.y = PI; decal(D, 'TRI SÉLECTIF', 3.0, 0.5, '#1f8a44', 0.2, 2.7, 1.275, null); });
  cylY(d, 0.07, 1.0, MT.steel, 1.95, 3.35, -0.95, 10); cylY(d, 0.09, 0.08, MT.black, 1.95, 3.88, -0.95, 10); // exhaust
  // side lockers, fuel tank, under-run guards
  rbox(d, 1.2, 0.5, 0.35, 0.05, RM.greyL, 1.2, 0.85, 1.0, 0.02); cylX(d, 0.3, 1.1, RM.greyL, 1.2, 0.8, -0.95, 14);
  [1, -1].forEach((s) => [0.55, 0.85].forEach((y) => box(d, 3.1, 0.06, 0.05, MT.steel, 1.1, y, s * 1.2)));
  // tailgate with the hopper (trémie)
  const TG = [[-3.3, 0.75], [-4.25, 0.75], [-4.7, 1.35], [-4.62, 2.75], [-4.05, 3.6], [-3.3, 3.6]];
  [1.17, -1.17].forEach((z) => ext(d, TG, 0.08, 0.14, W, 0, 0, z, 0.03));
  ext(d, [[-3.3, 2.35], [-4.42, 2.35], [-4.62, 2.75], [-4.05, 3.6], [-3.3, 3.6]], 0.08, 2.24, W, 0, 0, 0, 0.03);
  ext(d, [[-3.35, 0.75], [-4.25, 0.75], [-4.68, 1.35], [-4.5, 1.42], [-3.6, 1.0]], 0.04, 2.24, RM.greyD, 0, 0, 0, 0.02);
  box(d, 0.06, 1.4, 2.2, RM.dark, -3.4, 1.65, 0);
  rbox(d, 1.5, 0.5, 2.54, 0.04, G, -3.95, 1.45, 0, 0.01);
  [1, -1].forEach((s) => {
    rbox(d, 0.06, 0.55, 0.14, 0.02, MT.tail, -4.66, 2.1, s * 1.12, 0.01); rbox(d, 0.06, 0.14, 0.14, 0.02, MT.amber, -4.66, 2.45, s * 1.12, 0.01);
    rbox(d, 0.05, 0.4, 0.3, 0.01, MT.stripes, -4.72, 1.1, s * 0.95, 0.01);
    beacon(st, d, -3.6, 3.62, s * 0.9);
    // the riders' steps and grab handles
    rbox(d, 0.5, 0.06, 0.55, 0.02, RM.grey, -5.0, 0.5, s * 0.95, 0.01); rod(d, new V3(-4.75, 0.5, s * 0.75), new V3(-4.6, 0.85, s * 0.75), 0.03, RM.grey); rod(d, new V3(-4.75, 0.5, s * 1.15), new V3(-4.6, 0.85, s * 1.15), 0.03, RM.grey);
    rail(d, [[-4.62, 1.2, s * 0.62], [-4.76, 1.25, s * 0.62], [-4.76, 2.4, s * 0.62], [-4.58, 2.45, s * 0.62]], 0.028, MT.chrome);
    // decorative compaction rams on the tailgate walls
    rod(d, new V3(-3.5, 1.2, s * 1.26), new V3(-4.2, 3.0, s * 1.26), 0.08, RM.greyD, 10); rod(d, new V3(-3.85, 2.1, s * 1.26), new V3(-4.2, 3.0, s * 1.26), 0.045, MT.chrome, 8);
  });
  // bin lifter guides
  [0.55, -0.55].forEach((z) => box(d, 0.08, 1.05, 0.08, RM.dark, -4.74, 1.0, z)); box(d, 0.1, 0.1, 1.25, RM.dark, -4.74, 0.5, 0);
  bake(d);
  // moving parts: lifter, compaction blade, wheels, riders
  const lift = grp(g, -4.8, 1.05, 0);
  rbox(lift, 0.12, 0.28, 0.78, 0.03, RM.yel, 0.0, 0.0, 0, 0.01); [0.42, -0.42].forEach((z) => rbox(lift, 0.3, 0.14, 0.06, 0.02, RM.dark, 0.12, 0.0, z, 0.01));
  const blade = grp(g, -3.95, 2.3, 0); blade.rotation.z = -0.5;
  rbox(blade, 0.1, 1.15, 2.1, 0.03, RM.greyL, 0, -0.55, 0, 0.01); [-0.6, 0, 0.6].forEach((z) => box(blade, 0.14, 1.0, 0.06, RM.greyD, 0.02, -0.5, z));
  const wheels = [];
  [1, -1].forEach((s) => {
    wheels.push(tire(g, 0.52, 0.42, 3.3, 0.52, s * 0.98, RM.greyL, s)); fender(g, 0.62, 0.48, 3.3, 0.52, s * 0.98, RM.dark, PI * 0.55);
    [-1.2, -2.5].forEach((x) => { wheels.push(tire(g, 0.52, 0.5, x, 0.52, s * 0.95, RM.greyL, s)); fender(g, 0.62, 0.56, x, 0.52, s * 0.95, RM.dark, PI * 0.55); });
  });
  const rip = [1, -1].map((s) => { const r = walker(g, -5.0, s * 0.95, { vest: true, bottom: 0x2a3550 }); r.position.y = 0.53; setArms(r, 1.9); return r; });
  return { g, wheels, lift, blade, rip };
}

/** Truck with a knuckle crane behind the cab and a hook-lift skip. Returns { g, wheels, arm, tool, rams, setOut }. */
function craneTruck(st, p) {
  const g = grp(p), d = grp(g), Y = RM.yel;
  [0.45, -0.45].forEach((z) => rbox(d, 9.0, 0.3, 0.16, 0.03, MT.black, -0.2, 0.98, z));
  const cab = truckCab(d, RM.white, 2.75); rbox(cab, 1.64, 0.3, 2.24, 0.04, RM.green, 0.82, 0.32, 0, 0.02); beacon(st, cab, 0.6, 1.88, 0.6);
  // hook-lift subframe and arm, the skip
  rbox(d, 6.2, 0.2, 1.1, 0.03, RM.greyD, -1.6, 1.22, 0, 0.01);
  rbox(d, 0.26, 1.7, 0.9, 0.05, RM.greyD, 1.45, 2.05, 0, 0.02); rbox(d, 0.55, 0.14, 0.16, 0.03, RM.greyD, 1.2, 2.88, 0, 0.01); rbox(d, 0.12, 0.3, 0.16, 0.03, RM.greyD, 0.98, 2.75, 0, 0.01);
  [0.4, -0.4].forEach((z) => { rod(d, new V3(-1.0, 1.35, z), new V3(1.3, 2.1, z), 0.09, RM.greyD, 10); rod(d, new V3(0.2, 1.75, z), new V3(1.3, 2.1, z), 0.05, MT.chrome, 8); });
  const SK = grp(d, -1.7, 1.45, 0), SL = 5.8, SW = 2.4, SH = 1.75, SM = RM.greenD;
  rbox(SK, SL, 0.12, SW, 0.03, SM, 0, 0.06, 0, 0.01);
  [1, -1].forEach((s) => { rbox(SK, SL, SH, 0.08, 0.02, SM, 0, SH / 2, s * SW / 2, 0.01); rbox(SK, SL + 0.1, 0.12, 0.16, 0.03, SM, 0, SH, s * SW / 2, 0.01); for (let x = -SL / 2 + 0.4; x < SL / 2; x += 0.9) box(SK, 0.1, SH, 0.06, RM.greenD, x, SH / 2, s * (SW / 2 + 0.05)); });
  [1, -1].forEach((s) => rbox(SK, 0.08, SH, SW, 0.02, SM, s * SL / 2, SH / 2, 0, 0.01));
  rbox(SK, 0.16, 0.16, SW + 0.1, 0.03, SM, SL / 2, SH, 0, 0.01); cylZ(SK, 0.12, SW - 0.2, RM.dark, -SL / 2 + 0.1, -0.05, 0, 10);
  [1, -1].forEach((s) => { const D = grp(SK); if (s < 0) D.rotation.y = PI; decal(D, 'VERRE', 1.6, 0.4, '#ffffff', 0.6, 1.05, SW / 2 + 0.09, null); });
  // crane pedestal, outrigger housing
  cylY(d, 0.42, 0.4, RM.greyD, 2.15, 1.35, 0, 16); rbox(d, 0.4, 0.34, 2.3, 0.04, Y, 2.15, 1.0, 0, 0.02);
  // rear: lights, under-run bar; side guards
  rbox(d, 0.14, 0.2, 2.3, 0.03, MT.stripes, -4.6, 0.8, 0, 0.01); [0.85, -0.85].forEach((z) => rbox(d, 0.06, 0.16, 0.26, 0.02, MT.tail, -4.66, 1.05, z, 0.01));
  [1, -1].forEach((s) => { [0.55, 0.85].forEach((y) => box(d, 2.4, 0.06, 0.05, MT.steel, 0.4, y, s * 1.15)); rbox(d, 0.04, 0.45, 0.4, 0.02, MT.black, -4.0, 0.62, s * 0.95, 0.01); });
  cylX(d, 0.28, 0.9, RM.greyL, 0.6, 0.85, -0.95, 14);
  bake(d);
  // the crane
  const slew = grp(g, 2.15, 1.55, 0), l1 = 3.0, l2 = 2.7;
  rbox(slew, 0.66, 1.45, 0.62, 0.08, Y, 0, 0.72, 0, 0.02); cylY(slew, 0.4, 0.15, RM.dark, 0, 0.05, 0, 16);
  [1, -1].forEach((s) => { rbox(slew, 0.08, 0.5, 0.2, 0.02, RM.dark, -0.36, 0.7, s * 0.2, 0.01); cylX(slew, 0.03, 0.18, RM.red, -0.44, 0.85, s * 0.2, 6); });
  const boom = grp(slew, 0, 1.35, 0); rbox(boom, l1 + 0.3, 0.38, 0.34, 0.06, Y, l1 / 2 - 0.05, 0, 0, 0.02); cylZ(boom, 0.2, 0.46, RM.dark, 0, 0, 0, 12); cylZ(boom, 0.17, 0.42, RM.dark, l1, 0, 0, 12);
  const jib = grp(boom, l1, 0, 0); rbox(jib, l2 + 0.2, 0.3, 0.28, 0.05, Y, l2 / 2 - 0.15, 0, 0, 0.02); rbox(jib, 1.0, 0.22, 0.2, 0.03, RM.yelD, l2 - 0.4, 0, 0, 0.01); rbox(jib, 0.5, 0.45, 0.3, 0.04, Y, -0.15, 0.2, 0, 0.02);
  const tool = grp(jib, l2, 0, 0); rod(tool, new V3(0, 0, 0), new V3(0, -0.42, 0), 0.025, MT.black, 6);
  rbox(tool, 0.22, 0.2, 0.22, 0.04, RM.dark, 0, -0.5, 0, 0.01); add(tool, new THREE.TorusGeometry(0.09, 0.025, 6, 12, PI * 1.5), RM.grey, 0, -0.67, 0);
  const rams = [hydraulic(slew, anchor(slew, 0.25, 0.35, 0), anchor(boom, 1.2, -0.2, 0), { barrel: 0.9, mat: RM.yelD, rb: 0.1 }),
    hydraulic(boom, anchor(boom, l1 - 1.5, 0.22, 0), anchor(jib, -0.25, 0.38, 0), { barrel: 0.8, mat: RM.yelD, rb: 0.08 })];
  // outriggers, both sides
  const outs = [1, -1].map((s) => {
    const o = grp(g, 2.15, 1.0, s * 0.6); rbox(o, 0.26, 0.24, 1.2, 0.03, Y, 0, 0, 0, 0.01);
    cylY(o, 0.1, 0.6, RM.yelD, 0, -0.15, s * 0.55, 10); const foot = grp(o, 0, -0.45, s * 0.55); cylY(foot, 0.055, 0.8, MT.chrome, 0, 0.35, 0, 8); cylY(foot, 0.22, 0.06, RM.dark, 0, -0.03, 0, 14);
    return { o, foot, s };
  });
  const setOut = (k) => outs.forEach(({ o, foot, s }) => { o.position.z = s * (0.6 + 0.85 * clamp(k * 1.6, 0, 1)); foot.position.y = -0.45 - 0.5 * clamp((k - 0.5) * 2, 0, 1); });
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.55, 0.4, 3.65, 0.55, s * 0.95, RM.greyL, s)); [-2.1, -3.4].forEach((x) => { wheels.push(tire(g, 0.55, 0.5, x, 0.55, s * 0.95, RM.greyL, s)); fender(g, 0.66, 0.56, x, 0.55, s * 0.95, RM.dark, PI * 0.55); }); });
  return { g, wheels, arm: arm(slew, boom, jib, tool, l1, l2), tool, rams, setOut };
}

/** Counterbalance forklift. Returns { g, car, inner, wheels, setLift }. */
function forklift(st, p) {
  const g = grp(p), d = grp(g), Y = RM.yel;
  ext(d, [[-1.25, 0.28], [0.95, 0.28], [1.02, 0.5], [0.95, 0.95], [-0.15, 0.95], [-0.5, 1.12], [-1.25, 1.12]], 0.08, 1.1, Y, 0, 0, 0, 0.03);
  rbox(d, 0.55, 1.0, 1.16, 0.18, RM.dark, -1.15, 0.78, 0, 0.03); for (let i = 0; i < 4; i++) box(d, 0.02, 0.05, 0.7, MT.black, -1.43, 0.62 + i * 0.1, 0);
  rbox(d, 0.45, 0.1, 0.5, 0.04, MT.black, -0.4, 1.17, 0, 0.02); rbox(d, 0.1, 0.5, 0.5, 0.04, MT.black, -0.62, 1.42, 0, 0.02);
  operator(d, -0.42, 1.1, 0).scale.setScalar(0.85);
  rod(d, new V3(0.4, 0.95, 0), new V3(0.18, 1.45, 0), 0.035, MT.black); { const w = add(d, new THREE.TorusGeometry(0.15, 0.025, 6, 14), MT.black, 0.16, 1.48, 0); w.rotation.y = PI / 2; w.rotation.z = 0.5; }
  [[0.62, 0.5, 0.95], [0.62, -0.5, 0.95], [-0.78, 0.5, 1.12], [-0.78, -0.5, 1.12]].forEach(([x, z, y]) => rod(d, new V3(x, y, z), new V3(x * 0.92, 2.2, z), 0.04, MT.black, 6));
  rbox(d, 1.5, 0.06, 1.1, 0.02, MT.black, -0.08, 2.22, 0, 0.01); [-0.4, 0, 0.4].forEach((z) => box(d, 1.4, 0.07, 0.05, MT.black, -0.08, 2.2, z));
  [0.5, -0.5].forEach((z) => rbox(d, 0.08, 0.1, 0.12, 0.02, MT.lamp, 0.62, 2.12, z, 0.01)); beacon(st, d, -0.7, 2.25, 0);
  [0.34, -0.34].forEach((z) => box(d, 0.1, 2.2, 0.12, RM.dark, 1.12, 1.22, z)); box(d, 0.12, 0.1, 0.8, RM.dark, 1.12, 0.32, 0); box(d, 0.12, 0.1, 0.8, RM.dark, 1.12, 2.28, 0);
  [0.45, -0.45].forEach((z) => rod(d, new V3(0.55, 0.75, z), new V3(1.04, 1.1, z * 0.85), 0.05, MT.chrome, 8));
  cylY(d, 0.06, 1.8, MT.chrome, 1.12, 1.15, 0, 8);
  rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, -1.43, 1.0, 0.45, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, -1.43, 1.0, -0.45, 0.01);
  bake(d);
  const inner = grp(g, 1.18, 0, 0); [0.26, -0.26].forEach((z) => box(inner, 0.08, 2.0, 0.09, RM.greyD, 0, 1.15, z)); box(inner, 0.08, 0.1, 0.6, RM.greyD, 0, 2.15, 0);
  const car = grp(g, 1.26, 0.1, 0);
  rbox(car, 0.08, 0.42, 1.0, 0.02, RM.dark, 0, 0.28, 0, 0.01); [0.4, 0.0, -0.4].forEach((z) => box(car, 0.04, 0.9, 0.05, RM.dark, -0.02, 0.85, z)); box(car, 0.04, 0.05, 1.0, RM.dark, -0.02, 1.3, 0);
  [0.28, -0.28].forEach((z) => { rbox(car, 0.07, 0.6, 0.12, 0.02, MT.black, 0.03, 0.3, z, 0.01); rbox(car, 1.1, 0.05, 0.12, 0.02, MT.black, 0.6, 0.025, z, 0.01); });
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.34, 0.26, 0.55, 0.34, s * 0.47, RM.greyL, s)); wheels.push(tire(g, 0.26, 0.2, -0.88, 0.26, s * 0.45, RM.greyL, s)); });
  const setLift = (c) => { car.position.y = c; inner.position.y = Math.max(0, c - 1.0); };
  return { g, car, inner, wheels, setLift };
}

/** Tractor unit + curtain-sider trailer, open on its +z side. Returns { g, wheels, curtain }. */
function semi(p) {
  const g = grp(p), d = grp(g);
  [0.42, -0.42].forEach((z) => rbox(d, 6.4, 0.3, 0.16, 0.03, MT.black, 7.2, 1.0, z));
  const cab = truckCab(d, RM.green, 8.5); rbox(cab, 1.3, 0.55, 2.1, 0.2, RM.green, 0.55, 2.05, 0, 0.03);
  rbox(d, 0.9, 0.12, 1.2, 0.03, RM.dark, 5.5, 1.2, 0, 0.02); cylY(d, 0.07, 2.4, MT.chrome, 8.38, 2.3, 0.85, 10);
  [1, -1].forEach((s) => { cylX(d, 0.3, 1.2, MT.chrome, 7.3, 0.85, s * 0.95, 14); rbox(d, 0.6, 0.06, 0.3, 0.02, MT.black, 8.0, 0.6, s * 1.05, 0.01); });
  // the trailer
  rbox(d, 12.6, 0.18, 2.5, 0.03, RM.dark, -0.8, 1.4, 0, 0.01); rbox(d, 12.5, 0.05, 2.44, 0.01, RM.wood, -0.8, 1.51, 0, 0.01);
  [1, -1].forEach((s) => rbox(d, 12.6, 0.24, 0.08, 0.02, RM.greyL, -0.8, 1.27, s * 1.22, 0.01));
  rbox(d, 0.12, 2.6, 2.5, 0.05, RM.white, 5.45, 2.8, 0, 0.02);
  [-7.05, 5.38].forEach((x) => [1.2, -1.2].forEach((z) => rbox(d, 0.1, 2.5, 0.1, 0.02, RM.greyL, x, 2.78, z, 0.01)));
  rbox(d, 12.7, 0.12, 2.56, 0.03, RM.white, -0.8, 4.08, 0, 0.01); [1, -1].forEach((s) => rbox(d, 12.7, 0.2, 0.06, 0.02, RM.green, -0.8, 3.94, s * 1.26, 0.01));
  rbox(d, 0.08, 2.55, 2.45, 0.03, RM.white, -7.1, 2.78, 0, 0.01); box(d, 0.1, 2.5, 0.03, RM.greyL, -7.14, 2.78, 0); [0.6, -0.6].forEach((z) => rod(d, new V3(-7.16, 1.6, z), new V3(-7.16, 3.95, z), 0.025, MT.steel));
  const curtM = std(0xffffff, 0.7, 0, { map: canvasTex(64, 32, (x) => { x.fillStyle = '#2f6fe0'; x.fillRect(0, 0, 64, 32); x.fillStyle = '#2450b0'; x.fillRect(0, 0, 4, 32); }) });
  curtM.map.repeat.set(1, 1);
  rbox(d, 12.4, 2.4, 0.04, 0.02, RM.blue, -0.8, 2.78, -1.24, 0.01); for (let x = -6.8; x < 5.2; x += 0.6) box(d, 0.05, 2.38, 0.03, RM.blueD, x, 2.78, -1.27);
  { const D = grp(d, -0.8, 0, 0); D.rotation.y = PI; decal(D, 'RECYCLAGE', 5, 0.9, '#ffffff', 0, 2.9, 1.3, null); }
  for (let i = 0; i < 4; i++) rbox(d, 0.1, 2.4, 0.16, 0.05, RM.blue, 5.1 - i * 0.11, 2.78, 1.2, 0.02);
  [1, -1].forEach((s) => { rbox(d, 0.12, 0.9, 0.12, 0.02, RM.dark, 3.6, 0.85, s * 0.8, 0.01); rbox(d, 0.3, 0.06, 0.3, 0.02, RM.dark, 3.6, 0.4, s * 0.8, 0.01); [0.7, 1.0].forEach((y) => box(d, 6.2, 0.06, 0.05, MT.steel, -0.2, y, s * 1.22)); });
  rbox(d, 0.14, 0.2, 2.3, 0.03, MT.stripes, -7.1, 0.75, 0, 0.01); [0.9, -0.9].forEach((z) => rbox(d, 0.06, 0.14, 0.3, 0.02, MT.tail, -7.16, 1.15, z, 0.01));
  bake(d);
  const curtain = grp(g, 5.0, 2.78, 1.24); add(curtain, new THREE.BoxGeometry(1, 2.4, 0.04).translate(-0.5, 0, 0), curtM); curtain.scale.x = 0.01;
  const wheels = [];
  [1, -1].forEach((s) => {
    wheels.push(tire(g, 0.52, 0.4, 9.4, 0.52, s * 0.95, RM.greyL, s)); wheels.push(tire(g, 0.52, 0.5, 6.0, 0.52, s * 0.95, RM.greyL, s)); fender(g, 0.62, 0.56, 6.0, 0.52, s * 0.95, RM.dark, PI * 0.5);
    [-4.4, -5.5, -6.6].forEach((x) => { wheels.push(tire(g, 0.48, 0.45, x, 0.48, s * 1.0, RM.greyL, s)); });
  });
  rbox(g, 3.4, 0.08, 0.6, 0.02, RM.dark, -5.5, 1.08, 1.0, 0.01); rbox(g, 3.4, 0.08, 0.6, 0.02, RM.dark, -5.5, 1.08, -1.0, 0.01);
  return { g, wheels, curtain };
}

/** Wheeled material handler with an elevating cab and an orange-peel grab. */
function handler(p) {
  const g = grp(p), d = grp(g), M = RM.mh;
  rbox(d, 3.6, 0.7, 1.7, 0.1, RM.dark, 0, 1.0, 0, 0.02);
  [1.25, -1.25].forEach((x) => [1, -1].forEach((s) => { tire(d, 0.55, 0.36, x, 0.55, s * 0.72, RM.greyL, s); tire(d, 0.55, 0.36, x, 0.55, s * 1.12, RM.greyL, s); }));
  [[2.0, 1], [2.0, -1], [-2.0, 1], [-2.0, -1]].forEach(([x, s]) => { rod(d, new V3(Math.sign(x) * 1.6, 1.05, s * 0.6), new V3(Math.sign(x) * 2.4, 0.35, s * 1.35), 0.11, M, 8); cylY(d, 0.3, 0.08, RM.dark, Math.sign(x) * 2.42, 0.06, s * 1.38, 14); rod(d, new V3(Math.sign(x) * 2.42, 0.1, s * 1.38), new V3(Math.sign(x) * 2.42, 0.45, s * 1.38), 0.06, MT.chrome, 8); });
  cylY(d, 0.85, 0.22, RM.dark, 0, 1.45, 0, 20);
  bake(d);
  const up = grp(g, 0, 1.55, 0), U = grp(up);
  ext(U, [[-2.1, 0], [1.2, 0], [1.3, 0.3], [1.2, 1.1], [-1.6, 1.25], [-2.3, 1.0], [-2.4, 0.35]], 0.12, 2.0, M, 0, 0, 0, 0.04);
  rbox(U, 0.7, 1.05, 2.1, 0.25, RM.dark, -2.25, 0.6, 0, 0.03); for (let i = 0; i < 5; i++) box(U, 0.6, 0.04, 0.06, MT.black, -1.2, 1.27, -0.75 + i * 0.12);
  rbox(U, 0.9, 0.5, 0.6, 0.05, M, 0.6, 1.35, -0.6, 0.02); cylY(U, 0.07, 0.8, MT.steel, -1.6, 1.6, -0.6, 10); cylY(U, 0.09, 0.06, MT.black, -1.6, 2.02, -0.6, 10);
  [1, -1].forEach((s) => rail(U, [[-2.0, 1.2, s * 0.98], [-2.0, 1.6, s * 0.98], [0.4, 1.6, s * 0.98], [0.4, 1.12, s * 0.98]], 0.025, RM.yel));
  [1, -1].forEach((s) => rbox(U, 0.08, 0.12, 0.25, 0.02, MT.lamp, 1.28, 0.9, s * 0.7, 0.01));
  cylY(U, 0.18, 1.3, RM.dark, 0.5, 0.9, 0.62, 12);
  bake(U);
  // elevating cab on its column
  const riser = add(up, new THREE.CylinderGeometry(0.11, 0.11, 1, 10).translate(0, 0.5, 0), MT.chrome, 0.5, 1.5, 0.62);
  const cab = grp(up, 0.5, 1.6, 0.62); glassCab(cab, 0, 0, 0, { len: 1.4, wid: 1.0, h: 1.45, mat: M, roof: RM.dark });
  for (let i = 0; i < 4; i++) box(cab, 0.03, 1.1, 0.03, RM.dark, 0.78, 0.75, -0.36 + i * 0.24);
  const setCab = (r) => { cab.position.y = 1.6 + r; riser.scale.y = 0.1 + r; };
  // boom, stick, grab
  const l1 = 5.0, l2 = 4.0;
  const boom = grp(up, 0.9, 1.0, -0.25);
  ext(boom, [[0, -0.28], [2.6, -0.05], [l1 + 0.2, -0.22], [l1 + 0.2, 0.22], [2.6, 0.42], [0, 0.28]], 0.12, 0.5, M, 0, 0, 0, 0.03); cylZ(boom, 0.22, 0.62, RM.dark, 0, 0, 0, 12); cylZ(boom, 0.18, 0.56, RM.dark, l1, 0, 0, 12);
  const stick = grp(boom, l1, 0, 0); rbox(stick, l2 + 0.4, 0.36, 0.42, 0.06, M, l2 / 2 - 0.1, 0, 0, 0.02); rbox(stick, 0.6, 0.6, 0.36, 0.06, M, -0.25, 0.25, 0, 0.02);
  const tool = grp(stick, l2, 0, 0); rod(tool, new V3(0, 0, 0), new V3(0, -0.35, 0), 0.07, RM.dark, 8); cylY(tool, 0.24, 0.3, RM.dark, 0, -0.5, 0, 14); cylY(tool, 0.34, 0.2, RM.yel, 0, -0.75, 0, 14);
  const tines = [];
  const TP = [[0, 0.05], [0.25, -0.05], [0.42, -0.45], [0.38, -0.95], [0.1, -1.3], [0.0, -1.22], [0.22, -0.9], [0.25, -0.45], [0.08, -0.15], [-0.05, -0.05]];
  for (let i = 0; i < 5; i++) { const r = grp(tool, 0, -0.82, 0); r.rotation.y = (i / 5) * PI * 2; const h = grp(r, 0.24, 0, 0); ext(h, TP, 0.04, 0.18, RM.yel, 0, 0, 0, 0.02); cylZ(h, 0.06, 0.24, RM.dark, 0, 0, 0, 8); tines.push(h); }
  const setGrab = (o) => tines.forEach((h) => (h.rotation.z = -0.25 + 0.85 * o));
  const clump = grp(tool, 0, -1.55, 0); clump.visible = false;
  const SC = [RM.grey, RM.greyD, RM.red, RM.blue, RM.scrap];
  for (let i = 0; i < 9; i++) { const b = rbox(clump, rnd(0.3, 0.7), rnd(0.06, 0.15), rnd(0.12, 0.3), 0.02, pick(SC), rnd(-0.25, 0.25), rnd(-0.2, 0.2), rnd(-0.25, 0.25), 0.01); b.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); }
  const rams = [hydraulic(up, anchor(up, 1.7, 0.5, -0.25), anchor(boom, 1.8, -0.32, 0), { barrel: 1.4, mat: M, rb: 0.13 }),
    hydraulic(boom, anchor(boom, 1.6, 0.45, 0), anchor(stick, -0.45, 0.48, 0), { barrel: 1.7, mat: M, rb: 0.12 })];
  return { g, up, cab, setCab, tool, clump, setGrab, rams, arm: arm(up, boom, stick, tool, l1, l2) };
}

/** Tow-behind branch shredder. Returns { g, fly, roller, chute, outlet, wheels }. */
function shredder(p) {
  const g = grp(p), d = grp(g), O = RM.orange;
  [0.5, -0.5].forEach((z) => rbox(d, 4.6, 0.2, 0.14, 0.03, MT.black, 0, 0.75, z));
  [0.45, -0.45].forEach((z) => rod(d, new V3(1.9, 0.75, z), new V3(3.4, 0.68, 0), 0.06, RM.dark, 8)); add(d, new THREE.TorusGeometry(0.1, 0.03, 6, 12), RM.dark, 3.5, 0.68, 0).rotation.x = PI / 2;
  cylY(d, 0.05, 0.55, RM.dark, 2.9, 0.45, 0.2, 8); cylZ(d, 0.12, 0.08, MT.rubberS, 2.9, 0.12, 0.2, 10);
  rbox(d, 1.9, 1.2, 1.6, 0.12, O, 0.95, 1.45, 0, 0.03);
  for (let i = 0; i < 6; i++) box(d, 0.9, 0.05, 0.04, MT.black, 1.1, 1.2 + i * 0.1, 0.81);
  cylY(d, 0.06, 0.6, MT.steel, 1.5, 2.3, -0.4, 10); rbox(d, 0.14, 0.04, 0.14, 0.02, MT.black, 1.5, 2.62, -0.4, 0.01);
  rbox(d, 0.4, 0.3, 0.06, 0.02, RM.dark, 0.3, 1.6, 0.83, 0.01); [[0.2, RM.green], [0.4, RM.red]].forEach(([x, m]) => cylZ(d, 0.04, 0.05, m, x, 1.6, 0.87, 8));
  rbox(d, 1.1, 1.3, 1.5, 0.1, O, -0.55, 1.5, 0, 0.03);
  rbox(d, 1.8, 0.08, 1.2, 0.02, MT.steel, -2.0, 0.95, 0, 0.01);
  [1, -1].forEach((s) => { const w = rbox(d, 1.8, 0.75, 0.06, 0.02, O, -2.0, 1.32, s * 0.7, 0.01); w.rotation.y = s * 0.22; });
  rbox(d, 0.6, 0.15, 1.3, 0.04, O, -1.3, 1.92, 0, 0.02);
  rail(d, [[-2.9, 1.0, -1.0], [-2.9, 1.75, -1.0], [-2.9, 1.75, 1.0], [-2.9, 1.0, 1.0]], 0.035, RM.yel); rod(d, new V3(-2.9, 1.75, -0.4), new V3(-2.9, 1.75, 0.4), 0.05, RM.red);
  decal(d, 'ATTENTION', 0.9, 0.2, '#2a2f40', -0.55, 1.95, 0.76, '#f4c21c');
  bake(d);
  const fly = grp(g, -0.55, 1.5, 0.8); cylZ(fly, 0.48, 0.08, RM.dark, 0, 0, 0, 22); for (let i = 0; i < 4; i++) { const s = box(fly, 0.85, 0.08, 0.1, RM.yel, 0, 0, 0.04); s.rotation.z = (i * PI) / 4; } cylZ(fly, 0.1, 0.14, MT.steel, 0, 0, 0.04, 10);
  const roller = grp(g, -1.25, 1.22, 0); cylZ(roller, 0.22, 1.1, RM.yel, 0, 0, 0, 12); for (let i = 0; i < 6; i++) { const r = box(roller, 0.06, 0.5, 1.1, RM.yelD, 0, 0, 0); r.rotation.z = (i * PI) / 6; }
  const chute = grp(g, -0.55, 2.15, 0); cylY(chute, 0.22, 1.0, O, 0, 0.5, 0, 12); rod(chute, new V3(0, 0.95, 0), new V3(0.9, 1.45, 0), 0.22, O, 12); rbox(chute, 0.45, 0.2, 0.5, 0.06, O, 1.05, 1.55, 0, 0.02);
  const outlet = anchor(chute, 1.2, 1.4, 0);
  const wheels = [];
  [1, -1].forEach((s) => [-0.1, 0.75].forEach((x) => { wheels.push(tire(g, 0.36, 0.3, x, 0.36, s * 0.95, RM.greyL, s)); })); [1, -1].forEach((s) => fender(g, 0.48, 0.36, 0.33, 0.36, s * 0.95, O, PI * 0.5));
  return { g, fly, roller, chute, outlet, wheels };
}

/* ================= world description ================= */
const DATA = {
  benne: { short: 'Le camion-poubelle', full: 'Le camion-poubelle', verb: 'Ramasser', horn: 'horn',
    use: 'Il passe dans les rues pour vider les poubelles.',
    how: "Son bras lève la poubelle et la vide à l'arrière. Une grande pelle pousse tout au fond, pour faire de la place." },
  verre: { short: 'Le camion grue', full: 'Le camion grue du verre', verb: 'Vider', horn: 'horn',
    use: 'Il vide les colonnes à verre, où on jette les bouteilles et les pots.',
    how: "Sa grue attrape la colonne et la soulève au-dessus de la benne. Le fond s'ouvre, et le verre tombe dedans." },
  tri: { short: 'Le centre de tri', full: 'Le centre de tri', verb: 'Trier', horn: 'bell',
    use: 'Ici, on sépare les papiers, les bouteilles et les boîtes de conserve.',
    how: 'Un grand tapis roulant emmène tout dans une cabine. Des trieurs attrapent chaque chose et la mettent dans sa case.' },
  aimant: { short: "L'aimant géant", full: "L'aimant géant", verb: 'Attirer', horn: 'bell',
    use: 'Il attrape les boîtes de conserve en métal.',
    how: "C'est un aimant très puissant, au-dessus du tapis. Le métal saute et se colle à lui !" },
  presse: { short: 'La presse', full: 'La presse à balles', verb: 'Presser', horn: 'bell',
    use: 'Elle serre les bouteilles en plastique pour en faire de gros cubes.',
    how: 'Un énorme piston pousse très fort. Puis des fils de fer attachent le cube : ça s’appelle une balle.' },
  chariot: { short: 'Le chariot élévateur', full: 'Le chariot élévateur', verb: 'Charger', horn: 'horn',
    use: 'Il porte les balles jusqu’au camion qui part à l’usine.',
    how: 'Ses deux fourches glissent sous la balle et la soulèvent, comme un ascenseur.' },
  grappin: { short: 'La grue à grappin', full: 'La grue à grappin', verb: 'Attraper', horn: 'horn',
    use: 'Elle range la ferraille : les vieux vélos, les tuyaux, les morceaux de métal.',
    how: "Son grappin s'ouvre et se ferme comme une main géante. Sa cabine monte tout en haut, pour bien voir." },
  compost: { short: 'Le broyeur', full: 'Le broyeur de branches', verb: 'Broyer', horn: 'horn',
    use: 'Il transforme les branches du jardin en tout petits morceaux.',
    how: 'Des lames qui tournent très vite coupent les branches. Les copeaux deviendront du compost, une bonne terre pour les plantes.' }
};
const ORDER = ['benne', 'verre', 'tri', 'aimant', 'presse', 'chariot', 'grappin', 'compost'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  benne: GND + `<rect x="16" y="22" width="60" height="34" rx="7" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="16" y="42" width="60" height="8" fill="#2fae55"/><path d="M76 30h20q10 0 12 10v16H76z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect class="g" x="90" y="33" width="14" height="11" rx="2"/>
    <path d="M16 26L8 34v22h8z" fill="#dfe2ea"/><rect x="0" y="40" width="10" height="16" rx="2" fill="#3e4c48"/><rect x="-1" y="37" width="12" height="4" rx="1" fill="#f4c21c"/><circle class="k" cx="30" cy="62" r="8"/><circle class="k" cx="50" cy="62" r="8"/><circle class="k" cx="96" cy="62" r="8"/>`,
  verre: GND + `<rect x="8" y="34" width="58" height="22" rx="2" fill="#1f7a3e"/><rect class="w" x="82" y="34" width="26" height="22" rx="3"/><rect class="g" x="92" y="38" width="12" height="9"/><path d="M74 54V22L46 12" stroke="#f4c21c" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M46 12v8" stroke="#2a2f40" stroke-width="2"/>
    <path d="M34 42V30q0-10 12-10t12 10v12z" fill="#3a9a50"/><circle cx="42" cy="32" r="2" fill="#1d2130"/><circle cx="50" cy="32" r="2" fill="#1d2130"/><circle class="k" cx="22" cy="62" r="7"/><circle class="k" cx="40" cy="62" r="7"/><circle class="k" cx="96" cy="62" r="7"/>`,
  tri: GND + `<path d="M6 70L50 36" stroke="#2fae55" stroke-width="7" stroke-linecap="round"/><rect x="50" y="16" width="64" height="26" rx="3" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect class="g" x="56" y="20" width="52" height="11"/><circle cx="68" cy="26" r="4" fill="#f0c39a"/><circle cx="90" cy="26" r="4" fill="#f0c39a"/>
    <rect x="54" y="42" width="5" height="32" fill="#8f96a6"/><rect x="104" y="42" width="5" height="32" fill="#8f96a6"/><rect x="62" y="60" width="16" height="14" fill="#7ac0f4"/><rect x="82" y="60" width="16" height="14" fill="#f2ecd8"/><rect x="16" y="56" width="7" height="4" fill="#7ac0f4"/><rect x="30" y="47" width="8" height="3" fill="#f2ecd8"/>`,
  aimant: `<rect x="4" y="60" width="112" height="7" rx="3" fill="#2a2f40"/><path d="M38 44V24a22 22 0 0 1 44 0v20H70V24a10 10 0 0 0-20 0v20z" fill="#e5452c"/><rect x="38" y="38" width="12" height="6" fill="#c9ccd8"/><rect x="70" y="38" width="12" height="6" fill="#c9ccd8"/>
    <rect x="52" y="48" width="8" height="6" rx="1" fill="#c0c8d4"/><rect x="62" y="50" width="8" height="6" rx="1" fill="#d8402a"/><rect x="18" y="52" width="8" height="7" rx="1" fill="#c0c8d4"/><rect x="92" y="51" width="8" height="8" fill="#3a7ae0"/>`,
  presse: GND + `<path d="M40 12h40l-8 18H48z" fill="#2f6fe0"/><rect x="8" y="30" width="82" height="28" rx="3" fill="#2f6fe0"/><rect class="g" x="44" y="36" width="22" height="13"/><rect x="92" y="40" width="22" height="20" rx="2" fill="#7ac0f4"/><path d="M98 40v20M106 40v20" stroke="#2a2f40" stroke-width="2"/><rect x="8" y="58" width="82" height="6" fill="#2a2f40"/>`,
  chariot: GND + `<rect x="14" y="38" width="46" height="24" rx="4" fill="#f4c21c"/><path d="M24 38V16h26v22" stroke="#2a2f40" stroke-width="3" fill="none"/><rect x="62" y="12" width="5" height="54" fill="#2a2f40"/><path d="M66 64h30" stroke="#2a2f40" stroke-width="4"/><rect x="70" y="36" width="28" height="26" rx="2" fill="#7ac0f4"/><path d="M78 36v26M90 36v26" stroke="#2a2f40" stroke-width="2"/><circle class="k" cx="26" cy="64" r="7"/><circle class="k" cx="52" cy="64" r="8"/>`,
  grappin: GND + `<rect x="10" y="52" width="40" height="12" rx="3" fill="#2c3140"/><rect x="8" y="38" width="44" height="14" rx="4" fill="#4cb53a"/><rect class="g" x="34" y="20" width="14" height="14" rx="2"/><path d="M40 44L70 12l26 18" stroke="#4cb53a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M96 30v8" stroke="#2a2f40" stroke-width="3"/><path d="M86 52q0-14 10-14t10 14M90 54q2-10 6-12M102 54q-2-10-6-12" stroke="#f4c21c" stroke-width="4" fill="none" stroke-linecap="round"/><circle class="k" cx="18" cy="66" r="6"/><circle class="k" cx="42" cy="66" r="6"/>`,
  compost: GND + `<rect x="34" y="34" width="44" height="26" rx="4" fill="#f27a24"/><path d="M50 34V18h22" stroke="#f27a24" stroke-width="8" stroke-linejoin="round" fill="none"/><path d="M34 40L14 34v20l20-2z" fill="#c9ccd8"/><circle class="k" cx="58" cy="64" r="7"/>
    <path d="M86 18l8 3M90 26l6 1M84 24l3 5" stroke="#c8945a" stroke-width="3" stroke-linecap="round"/><path d="M92 74q8-16 22 0z" fill="#c8945a"/><path d="M2 40l18 6M8 36l4 6" stroke="#7a5232" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="38" r="4" fill="#5aa84a"/>`
};

const CFG = {
  benne: CF(-32, 7.4), verre: CF(-12, 11.6), tri: CF(-1, -12), aimant: CF(14.5, -12), presse: CF(31, -12),
  chariot: CF(30, -1), grappin: CF(30, -27), compost: CF(-30, -20)
};

const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const path = (pts, w = 1.6, col = '#e8dcc0', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
blob(-30, 16, 22, 'rgba(150,215,120,.55)'); blob(-30, -22, 14, 'rgba(150,110,70,.75)'); blob(-34, -28, 9, 'rgba(120,90,60,.6)');
rect(19.25, -16.5, 63.5, 39, '#a9adb8'); rect(25, 9.3, 42, 1.0, '#d4d2d8');
rect(-1.5, 6, 98, 5.6, '#5d6070'); for (let h = -48; h < 46; h += 4) if (h < -8 || h > 2) rect(h, 6, 2, 0.16, '#f3efe2');
rect(-28.5, 2.7, 42, 1.0, '#d4d2d8'); rect(-28.5, 9.3, 42, 1.0, '#d4d2d8'); rect(-12, 11.6, 19, 3.2, '#6a6d7c'); for (let h = -20; h <= -4; h += 3) rect(h, 11.6, 0.12, 3.0, '#f3efe2');
rect(-12, 15.1, 10, 2.6, '#d4d2d8');
rect(30, -4.5, 22, 4, '#a8abb6'); rect(-1, -12, 9, 8.6, '#b0b2bc'); rect(30, -27, 22, 14, '#a29a92', 0.7);
for (let h = 6; h <= 16; h += 2.5) rect(h, -2, 0.14, 4, '#f3efe2');
path([[-48.5, 2.9], [-46, 10], [-48.5, 17.5], [-8, 17.5], [-6.5, 10], [-8, 2.9]], 1.4); path([[-44, 21], [-36, 21]], 2.2, '#e9d9a8');
path([[-10, -1], [-10, -8], [-20, -14], [-26, -16]], 2.6, '#9a8a78', 0.8);

export default {
  id: 'recyclage', title: 'Le Recyclage', titleHtml: 'Le <span>Recyclage</span>',
  subtitle: 'Des camions qui ramassent les poubelles, un centre de tri, un aimant géant, une presse... et la bouteille redevient une bouteille !',
  welcome: 'Bienvenue au recyclage ! Touche un engin pour voir comment il marche.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Tout le recyclage',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 9l3-5h4l3 5"/><path d="M24 13l2 4-2 4h-4"/><path d="M12 25H7l-2-4 2-4"/><path d="M19 7l2 2-2 2M22 23l-2 2 2 2M6 14l1-3 3 1"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false, outerColor: 0x1f4630,
  forest: { dark: [0x2f6a3a, 0x3a7a44, 0x285a34, 0x346e3c], bush: [0x5aa85a, 0x4a9a4a, 0x7ac06a, 0xe8d05a] },
  overview: { w: 84, h: 58, focus: [-4, 3, -6] },
  ground: { base: ['#8fc47c', '#73aa64', '#55894e'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 140); onUpdate((dt) => fx.update(dt));
    freeze(buildWorld(grp(scene)));
    const puff = (p, n = 3, col = 0xe8e4dc) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.4, 0.4), 0.1, rnd(-0.4, 0.4))), new V3(rnd(-0.5, 0.5), rnd(0.4, 1), rnd(-0.5, 0.5)), rnd(0.25, 0.45), col, 1.1); };
    const clink = () => tone(rnd(1800, 2600), 0, 0.12, 'sine', 0.05);
    const W = new V3();

    /* ---- le camion-poubelle : il vide une poubelle jaune ---- */
    (function () {
      const st = makeStation('benne'), S = st.g;
      const T = bomTruck(st, S), m = T.g, X0 = -8; m.position.x = X0; st.m = m; st.lastX = X0; st.wheels = T.wheels;
      // the bin shelter on the pavement: two bins stay, the yellow one waits in front
      const SH = grp(S, -5.3, 0, 4.1);
      rbox(SH, 3.4, 1.3, 0.1, 0.02, RM.wood, 0, 0.75, 0.5, 0.01); [1.7, -1.7].forEach((x) => rbox(SH, 0.1, 1.3, 1.1, 0.02, RM.wood, x, 0.75, 0, 0.01));
      for (let x = -1.5; x <= 1.5; x += 0.25) box(SH, 0.1, 1.25, 0.03, RM.woodD, x, 0.75, 0.44);
      { const r = rbox(SH, 3.7, 0.08, 1.4, 0.02, RM.roofG, 0, 1.5, 0.1, 0.01); r.rotation.x = 0.12; }
      wheelieBin(SH, RM.lidGr, -1.0, -0.15, PI / 2); wheelieBin(SH, RM.lidG, 1.0, -0.15, PI / 2);
      decal(SH, 'TRI', 0.6, 0.25, '#f4c21c', 0, 1.15, 0.56, '#2a2f40');
      bake(SH);
      const BIN = new V3(-5.3, 0, 2.6); const bin = wheelieBin(S, RM.lidY, BIN.x, BIN.z, PI / 2);
      const rip = T.rip[0], RIP = new V3(-5.0, 0.53, 0.95);
      const spill = ['paper', 'bottle', 'can', 'carton', 'paper', 'bottle', 'card'].map((k) => item(m, k === 'card' ? 'paper' : k));
      part(st, 'bras', 'le bras lève-poubelle', anchor(m, -4.9, 1.1, 0.75), true);
      part(st, 'pelle', 'la pelle qui tasse', anchor(m, -4.3, 3.0, 1.0), false);
      part(st, 'ripeurs', 'les ripeurs', anchor(m, -5.1, 1.9, 1.3), true);
      part(st, 'poubelle', 'la poubelle jaune', anchor(bin.g, 0, 1.2, 0), false);
      part(st, 'caisse', 'la caisse', anchor(m, -0.8, 3.5, 1.0), false);
      st.focusAt = anchor(m, -1.6, 1.6, 1.2); st.size = { w: 15, h: 7.5 }; st.tagAt = anchor(m, 0, 4.4, 0);
      st.update = (dt) => roll(st, dt);
      const rollBin = async (from, ryA, toP, ryB, d) => {
        await tw(d, (k) => {
          bin.g.position.lerpVectors(from, toP, k); const ry = ryA + (ryB - ryA) * k; bin.g.rotation.set(0, ry, 0.38 * Math.sin(Math.min(1, k * 1.3) * PI));
          rip.position.set(bin.g.position.x - Math.cos(ry) * 0.95, 0, bin.g.position.z + Math.sin(ry) * 0.95); rip.rotation.y = ry; rip.userData.walk(k * 14);
        }, easeSine);
        bin.g.rotation.z = 0; rip.userData.walk(0);
      };
      st.action = async function () {
        if (st.done) { m.position.x = X0; st.lastX = X0; pop(m, 0.5); st.done = false; await sleep(0.5); }
        engineOn(55);
        await Promise.all([step('Le camion-poubelle arrive dans la rue. Deux ripeurs sont debout à l’arrière.', 'ripeurs'), to(m.position, 'x', 0, 4.5, easeSine)]);
        S.attach(rip); setArms(rip, 0.3);
        await Promise.all([step('Le ripeur saute du marchepied et va chercher la poubelle jaune.', 'poubelle'), (async () => {
          await walkTo(rip, new V3(-4.5, 0, 1.7), 0.7); await walkTo(rip, new V3(-4.55, 0, 3.15), 0.8); await walkTo(rip, new V3(-5.3, 0, 3.4), 0.5); rip.rotation.y = PI / 2;
        })()]);
        setArms(rip, 1.2);
        await Promise.all([step('Il la roule jusqu’au camion, et l’accroche au bras.', 'bras'), rollBin(BIN, PI / 2, new V3(-5.18, 0, 0), 0, 2.2)]);
        S.updateMatrixWorld(true); T.lift.attach(bin.g); thud();
        await Promise.all([step('Le bras lève la poubelle... et la vide dans le camion !', 'bras'), tw(2.6, (k) => {
          const a = clamp(k / 0.35, 0, 1), b = clamp((k - 0.3) / 0.7, 0, 1); T.lift.position.y = 1.05 + 0.6 * a; T.lift.rotation.z = -2.3 * easeSine(b); bin.lid.rotation.z = 2.2 * clamp((k - 0.55) / 0.3, 0, 1);
        }, lin)]);
        m.updateMatrixWorld(true);
        spill.forEach((s, i) => { const p0 = m.worldToLocal(bin.g.localToWorld(new V3(rnd(-0.1, 0.1), 0.95, rnd(-0.2, 0.2)))); s.position.copy(p0); s.visible = true; const p1 = new V3(-3.9 + rnd(-0.2, 0.2), 1.2, rnd(-0.7, 0.7)); tw(0.5 + i * 0.08, (k) => { s.position.lerpVectors(p0, p1, k); s.position.y = p0.y + (p1.y - p0.y) * k * k; s.rotation.x += 0.2; }, lin).then(() => (s.visible = false)); });
        tone(220, 0, 0.5, 'triangle', 0.06, 110); await sleep(1.0);
        await tw(1.8, (k) => { T.lift.rotation.z = -2.3 * (1 - easeSine(clamp(k / 0.7, 0, 1))); T.lift.position.y = 1.65 - 0.6 * clamp((k - 0.65) / 0.35, 0, 1); bin.lid.rotation.z = 2.2 * (1 - clamp(k / 0.4, 0, 1)); }, lin);
        T.lift.position.y = 1.05; T.lift.rotation.z = 0; S.updateMatrixWorld(true); S.attach(bin.g); bin.g.position.y = 0;
        await Promise.all([step('La grande pelle pousse tout au fond. Comme ça, il y a plein de place !', 'pelle'),
          tw(2.6, (k) => (T.blade.rotation.z = k < 0.3 ? -0.5 - 0.5 * easeSine(k / 0.3) : k < 0.7 ? -1.0 + 1.6 * easeSine((k - 0.3) / 0.4) : 0.6 - 1.1 * easeSine((k - 0.7) / 0.3)), lin),
          rollBin(new V3(-5.18, 0, 0), 0, BIN, PI / 2, 2.2)]);
        bin.g.rotation.set(0, PI / 2, 0);
        setArms(rip, 0.3);
        await walkTo(rip, new V3(-4.55, 0, 3.15), 0.5); await walkTo(rip, new V3(-4.6, 0, 1.6), 0.8); await walkTo(rip, new V3(-5.0, 0, 1.0), 0.4);
        rip.position.copy(RIP); m.attach(rip); rip.position.copy(RIP); rip.rotation.set(0, 0, 0); setArms(rip, 1.9);
        await Promise.all([step('Le ripeur remonte sur son marchepied. Et en route vers la poubelle suivante !', 'ripeurs'), to(m.position, 'x', 8, 4, easeIn)]);
        st.done = true;
      };
    })();

    /* ---- le camion grue du verre ---- */
    (function () {
      const st = makeStation('verre'), S = st.g;
      const T = craneTruck(st, S), m = T.g, X0 = -5; m.position.x = X0; st.m = m; st.lastX = X0; st.wheels = T.wheels;
      rbox(S, 8.6, 0.1, 2.4, 0.03, RM.concrete, -0.6, 0.05, 3.8, 0.01);
      const BK = new V3(2.15, 0.1, 3.6), bank = glassBank(S, RM.bank, 'VERRE'); bank.g.position.copy(BK);
      glassBank(S, RM.bank, 'VERRE').g.position.set(-0.9, 0.1, 3.9); glassBank(S, RM.bankB, 'PAPIER').g.position.set(-3.2, 0.1, 3.9);
      const A = T.arm, FOLD = [PI / 2, 1.5, -2.95]; A.setAng(...FOLD);
      const bits = Array.from({ length: 18 }, () => item(m, 'glass'));
      const heap = add(m, new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2), RM.gGreen, -1.7, 1.57, 0); heap.scale.set(2.2, 0.05, 0.9);
      part(st, 'grue', 'la grue', anchor(T.tool, 0, 0.4, 0.3), true);
      part(st, 'colonne', 'la colonne à verre', anchor(bank.g, 0, 1.6, 0.6), true);
      part(st, 'benne', 'la benne', anchor(m, -1.7, 3.3, 1.25), false);
      part(st, 'pieds', 'les pieds stabilisateurs', anchor(m, 2.15, 0.5, 2.3), false);
      st.focusAt = anchor(m, 0.4, 2.4, 1.6); st.size = { w: 15, h: 9 }; st.tagAt = anchor(m, 1.5, 6.2, 0);
      st.update = (dt) => { roll(st, dt); T.rams.forEach((r) => r.update()); };
      st.action = async function () {
        if (st.done) { bits.forEach((b) => (b.visible = false)); heap.scale.y = 0.05; m.position.x = X0; st.lastX = X0; pop(m, 0.5); st.done = false; await sleep(0.5); }
        engineOn(55);
        await Promise.all([step('Le camion grue se gare à côté de la colonne à verre.', 'colonne'), to(m.position, 'x', 0, 4, easeSine)]);
        await Promise.all([step('Il sort ses pieds stabilisateurs, pour ne pas basculer.', 'pieds'), tw(1.8, (k) => T.setOut(k), easeSine)]);
        thud();
        await Promise.all([step('La grue se déplie, et va au-dessus de la colonne.', 'grue'), (async () => {
          await A.moveAng(PI / 2, 1.3, -1.5, 1.6); const [R, Y] = A.fk(); await A.move(1.5 * PI, R, Y, 2.0); await A.move(1.5 * PI, 3.6, 0.8, 1.2); await A.move(1.5 * PI, 3.6, -0.28, 1.0);
        })()]);
        m.updateMatrixWorld(true); T.tool.attach(bank.g); ding();
        await Promise.all([step('Elle l’accroche par son champignon, et la soulève très haut !', 'colonne'), A.move(1.5 * PI, 3.6, 3.6, 2.6)]);
        await A.move(PI, 3.6, 3.6, 2.2);
        await Promise.all([step('Le fond de la colonne s’ouvre. Les bouteilles tombent dans la benne : cling, cling !', 'benne'), (async () => {
          await tw(0.6, (k) => { bank.flaps[0].rotation.z = -1.3 * k; bank.flaps[1].rotation.z = 1.3 * k; });
          m.updateMatrixWorld(true); const p0 = m.worldToLocal(wp(bank.g));
          bits.forEach((b, i) => sleep(i * 0.09).then(() => { b.visible = true; const a = p0.clone().add(new V3(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4))), c = new V3(rnd(-3.6, 0.2), 1.6 + rnd(0, 0.25), rnd(-0.8, 0.8)); clink(); return tw(0.55, (k) => { b.position.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k * k, a.z + (c.z - a.z) * k); b.rotation.z += 0.3; }, lin); }));
          await tw(2.2, (k) => (heap.scale.y = 0.05 + 0.35 * k), lin);
          await tw(0.6, (k) => { bank.flaps[0].rotation.z = -1.3 * (1 - k); bank.flaps[1].rotation.z = 1.3 * (1 - k); });
        })()]);
        await Promise.all([step('La colonne vide retourne à sa place.', 'colonne'), (async () => { await A.move(1.5 * PI, 3.6, 3.6, 2.2); await A.move(1.5 * PI, 3.6, -0.28, 2.0); })()]);
        S.updateMatrixWorld(true); S.attach(bank.g); bank.g.position.copy(BK); bank.g.rotation.set(0, 0, 0); thud();
        await Promise.all([step('La grue se replie. Ce verre sera fondu, pour faire de nouvelles bouteilles !', 'grue'), (async () => {
          await A.move(1.5 * PI, 3.6, 1.6, 1.0); const [R, Y] = A.fk(); await A.move(PI / 2, R, Y, 2.0); await A.moveAng(...FOLD, 1.4); await tw(1.4, (k) => T.setOut(1 - k));
        })()]);
        chime(); st.done = true;
      };
    })();

    /* ---- le centre de tri ---- */
    (function () {
      const st = makeStation('tri'), S = st.g, B = grp(S);
      // the tipping floor with its push walls and the big heap
      rbox(B, 7.6, 0.12, 8, 0.05, RM.concreteD, -6.7, 0.06, 0, 0.02);
      for (let i = 0; i < 5; i++) { rbox(B, 0.8, 0.78, 1.56, 0.04, RM.concrete, -10.7, 0.4, -3.2 + i * 1.6, 0.02); if (i < 4) rbox(B, 0.8, 0.78, 1.56, 0.04, RM.concrete, -10.7, 1.2, -2.4 + i * 1.6, 0.02); }
      for (let i = 0; i < 4; i++) rbox(B, 1.56, 0.78, 0.8, 0.04, RM.concrete, -9.5 + i * 1.6, 0.4, -4.3, 0.02);
      const HC = new V3(-7.2, 0.1, 0.2), HS = new V3(2.8, 1.5, 2.6);
      const hm = add(B, new THREE.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI / 2), BM.mix, HC.x, HC.y, HC.z); hm.scale.copy(HS);
      const onHeap = (d) => { const a = rnd(0, PI * 2), e = rnd(0.05, 1.45); d.position.set(HC.x + Math.cos(a) * Math.cos(e) * HS.x * 0.98, HC.y + Math.sin(e) * HS.y * 0.98, HC.z + Math.sin(a) * Math.cos(e) * HS.z * 0.98); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.setScalar(1.5); };
      ['bottle', 'paper', 'can', 'carton'].forEach((k) => instanced(S, IG[k], 34, (i, d) => { onHeap(d); return pick(IC[k]); }));
      // the infeed belt up to the sorting cabin
      const C1 = conveyor(B, [-3.4, 0.45], [3.0, 3.75], { w: 1.3, rail: true });
      [1, -1].forEach((s) => rbox(B, 1.4, 0.6, 0.08, 0.02, RM.green, -3.2, 0.5, s * 0.78, 0.01)); rbox(B, 0.08, 0.6, 1.6, 0.02, RM.green, -3.95, 0.5, 0, 0.01);
      // the sorting cabin on its legs, bays underneath
      const CX = 6.7, CY = 3.0, CL = 7.4;
      rbox(B, CL, 0.2, 3.4, 0.03, RM.greyD, CX, CY, 0, 0.01);
      [3.1, 6.7, 10.3].forEach((x) => [1.6, -1.6].forEach((z) => box(B, 0.22, CY, 0.22, RM.green, x, CY / 2, z)));
      // tall walls at the back and the ends; the front is wide open (just a low wall and a hi-vis rail) so we see inside
      const WH = 3.3;
      rbox(B, CL, WH, 0.12, 0.02, RM.cladW, CX, CY + WH / 2, -1.65, 0.01); [3.0, 10.4].forEach((x) => rbox(B, 0.12, WH, 3.4, 0.02, RM.cladW, x, CY + WH / 2, 0, 0.01));
      [3.0, 10.4].forEach((x) => box(B, 0.14, 1.3, 2.2, MT.glass, x, CY + 1.9, 0)); // side windows
      box(B, CL - 0.3, 0.9, 0.04, RM.green, CX, CY + 1.2, -1.58); box(B, CL - 0.3, 0.05, 0.05, RM.yel, CX, CY + 1.68, -1.57);
      rbox(B, CL, 0.42, 0.1, 0.02, RM.cladW, CX, CY + 0.3, 1.66, 0.01); box(B, CL, 0.08, 0.12, RM.yel, CX, CY + 0.52, 1.67);
      rail(B, [[3.1, CY + 0.5, 1.68], [3.1, CY + 1.05, 1.68], [10.3, CY + 1.05, 1.68], [10.3, CY + 0.5, 1.68]], 0.04, RM.yel);
      [5.45, 7.85].forEach((x) => rod(B, new V3(x, CY + 0.5, 1.68), new V3(x, CY + 1.05, 1.68), 0.035, RM.yel));
      [3.07, 10.33].forEach((x) => box(B, 0.16, WH, 0.16, RM.greyD, x, CY + WH / 2, 1.68)); box(B, CL + 0.1, 0.16, 0.16, RM.greyD, CX, CY + WH - 0.05, 1.68);
      rbox(B, CL + 0.4, 0.25, 3.8, 0.04, RM.green, CX, CY + WH + 0.15, 0, 0.02); rbox(B, 1.6, 0.5, 1.0, 0.06, RM.greyL, 8.6, CY + WH + 0.5, -0.6, 0.02);
      [4.6, 6.7, 8.8].forEach((x) => box(B, 1.2, 0.06, 0.25, MT.lamp, x, CY + WH - 0.02, 0)); // ceiling lights
      { const D = grp(B, CX, 0, 0); decal(D, 'CABINE DE TRI', 3.4, 0.4, '#ffffff', 0, CY + WH + 0.15, 1.92, null); }
      // a chute in front of each sorter: what they pick falls through it into the bay under the floor
      const CHZ = 0.95, chutes = [[4.4, RM.chuteB], [6.8, RM.chuteY]];
      chutes.forEach(([x, cm]) => {
        add(B, new THREE.CylinderGeometry(0.42, 0.24, 0.5, 4, 1, true).rotateY(PI / 4), cm, x, CY + 0.35, CHZ);
        [0.33, -0.33].forEach((dx) => box(B, 0.06, 0.06, 0.62, MT.dark, x + dx, CY + 0.62, CHZ)); [0.33, -0.33].forEach((dz) => box(B, 0.62, 0.06, 0.06, MT.dark, x, CY + 0.62, CHZ + dz));
      });
      [[5.4], [7.8]].forEach(([x]) => rbox(B, 0.2, 2.4, 3.0, 0.03, RM.concrete, x, 1.2, -0.1, 0.01)); rbox(B, CL, 2.4, 0.2, 0.03, RM.concrete, CX, 1.2, -1.5, 0.01);
      const sign = (x, k, col) => { const g = grp(B, x, 2.3, 1.62); rbox(g, 1.2, 0.8, 0.08, 0.06, col, 0, 0, 0, 0.02); const it = add(g, IG[k], IM[k][0], -0.35, -0.1, 0.1); it.scale.setScalar(2.2); };
      sign(4.25, 'bottle', RM.yel); sign(6.6, 'paper', RM.blue);
      // stairs at the back
      for (let i = 0; i < 10; i++) box(B, 0.32, 0.06, 0.9, RM.yelD, 8.6 - i * 0.32, 0.3 + i * 0.3, -2.2); rod(B, new V3(8.9, 0, -2.6), new V3(5.4, 3.1, -2.6), 0.05, RM.yel); rail(B, [[8.9, 1.0, -2.65], [5.4, 4.1, -2.65]], 0.03, RM.yel);
      const C2 = conveyor(B, [3.2, 3.55], [10.9, 3.55], { w: 1.0, legs: false, frame: RM.greyL });
      rbox(B, 0.8, 0.06, 1.0, 0.02, MT.steel, 11.3, 3.3, 0, 0.01).rotation.z = -0.5;
      bake(B);
      // the sorters
      const wk = [[4.4, RM.hiVis, 0x2f7de0], [6.8, RM.hiOr, 0x2f4a8a], [9.1, RM.hiVis, 0xe5452c]].map(([x, vm, c]) => {
        const p = walker(S, x, -0.95, { vest: true, bottom: c, hat: RM.helmet }); p.position.y = CY + 0.1; p.rotation.y = -PI / 2; p.scale.setScalar(1.22); p.userData.armT = 0;
        p.traverse((o) => { if (o.material === MT.vest) o.material = vm; });
        p.userData.arms.forEach((a) => sph(a, 0.075, RM.chuteB, 0, -0.38, 0)); // blue gloves
        return p;
      });
      const bays = [[4.3, RM.pBlue], [6.6, RM.paper]].map(([x, mm]) => { const c = add(S, new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0), mm, x, 0, 0.5); c.scale.set(1.0, 0.3, 0.8); return c; });
      const pool = itemPool(S, ['bottle', 'paper', 'can'], 12);
      const P = [C1.at(0.4, 0.1), C1.at(C1.L - 0.15, 0.1), new V3(3.6, 3.62, 0), new V3(10.9, 3.62, 0)];
      const segs = []; for (let i = 0; i < P.length - 1; i++) segs.push({ a: P[i], b: P[i + 1], L: P[i].distanceTo(P[i + 1]) });
      const PL = segs.reduce((s, g) => s + g.L, 0);
      const pathAt = (s, out) => { for (const g of segs) { if (s <= g.L) return out.lerpVectors(g.a, g.b, s / g.L); s -= g.L; } return out.copy(P[P.length - 1]); };
      const PICK = { bottle: [4.4, 0, bays[0]], paper: [6.8, 1, bays[1]] };
      part(st, 'tas', 'le gros tas', anchor(S, -7.2, 2.0, 1.5), false);
      part(st, 'tapis', 'le tapis roulant', anchor(B, 0, 2.4, 0.8), true);
      part(st, 'trieurs', 'les trieurs', anchor(S, 5.6, 5.2, 0.6), true);
      part(st, 'cases', 'les cases', anchor(S, 5.4, 1.3, 1.6), false);
      st.tagAt = anchor(S, 6.7, 7.3, 0); st.el = 0.42; // a lower camera, to see under the cabin roof
      // wide view of the whole line, and a close view into the cabin while the sorters work
      const view = (close) => { if (close) { st.focus = new V3(6.8, CY + 0.5, 0.4); st.size = { w: 9.5, h: 6.6 }; } else { st.focus = new V3(0.8, 3.0, 0.5); st.size = { w: 21, h: 9 }; } };
      view(false);
      let spawnT = 0;
      st.update = (dt) => {
        if (st.run) { C1.tex.offset.x -= dt * 1.6 / 0.6; C2.tex.offset.x -= dt * 1.6 / 0.6; }
        if (st.feed) { spawnT -= dt; if (spawnT <= 0) { spawnT = 0.42; const k = Math.random() < 0.38 ? 'bottle' : Math.random() < 0.6 ? 'paper' : 'can'; pool.take(k); } }
        pool.all.forEach((it) => {
          if (!it.on || it.state !== 'belt') return;
          if (st.run) it.s += dt * 1.6; pathAt(it.s, it.m.position); it.m.position.z += it.z;
          const pk = PICK[it.k];
          if (pk && it.m.position.x >= pk[0] - 0.15) {
            // the sorter grabs it, lifts it over the belt edge and drops it in the chute; it lands in the bay under the floor
            const w = wk[pk[1]]; w.userData.armT = 0.5;
            pool.drop(it, new V3(pk[0], CY + 0.75, CHZ), 0.45, 0.5, () => pool.drop(it, new V3(pk[2].position.x + rnd(-0.4, 0.4), 0.25 + pk[2].scale.y * 0.6, pk[2].position.z + rnd(-0.4, 0.3)), 0.45, 0, () => { pool.free(it); pk[2].scale.y = Math.min(1.5, pk[2].scale.y + 0.03); }));
          }
          else if (it.s >= PL) pool.drop(it, new V3(11.8, 2.6, it.m.position.z), 0.35, 0.1, () => pool.free(it));
        });
        pool.update(dt);
        wk.forEach((w) => { if (w.userData.armT > 0) { w.userData.armT -= dt; const a = Math.sin((0.5 - w.userData.armT) * PI * 2) * 1.2 + 0.4; w.userData.arms[0].rotation.z = a; } else w.userData.arms[0].rotation.z = 0.3; });
      };
      st.action = async function () {
        view(false);
        if (st.done) { pool.reset(); bays.forEach((b) => (b.scale.y = 0.3)); st.done = false; }
        await Promise.all([step('Voici le centre de tri. Les camions-poubelles vident ici tout ce qu’ils ont ramassé.', 'tas'), sleep(1.5)]);
        st.run = true; st.feed = true; engineOn(90);
        await Promise.all([step('Le grand tapis roulant monte tout ça jusqu’à la cabine de tri.', 'tapis'), sleep(4)]);
        view(true);
        await Promise.all([step('Dans la cabine, les trieurs attrapent les bouteilles en plastique...', 'trieurs'), sleep(3.5)]);
        await Promise.all([step('...et les papiers. Chaque chose tombe dans sa case, en dessous.', 'cases'), sleep(3.5)]);
        st.feed = false;
        await Promise.all([step('Les boîtes de conserve restent sur le tapis : elles vont voir l’aimant géant !', 'tapis'), sleep(5)]);
        view(false); st.run = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- l'aimant géant (overband) ---- */
    (function () {
      const st = makeStation('aimant'), S = st.g, B = grp(S);
      const C = conveyor(B, [-3.6, 2.2], [4.4, 2.2], { w: 1.2 });
      { const ch = grp(B, -4.3, 2.75, 0); ch.rotation.z = -0.45; rbox(ch, 1.2, 0.06, 1.1, 0.02, MT.steel, 0, 0, 0, 0.01); [0.55, -0.55].forEach((z) => rbox(ch, 1.2, 0.3, 0.05, 0.02, MT.steel, 0, 0.12, z, 0.01)); }
      // gantry
      [-1.15, 1.15].forEach((x) => { [-1.4, 3.9].forEach((z) => box(B, 0.18, 4.8, 0.18, RM.yel, x, 2.4, z)); box(B, 0.2, 0.22, 5.5, RM.yel, x, 4.8, 1.25); });
      [-1.4, 3.9].forEach((z) => box(B, 2.5, 0.2, 0.2, RM.yel, 0, 4.8, z)); [-1.4, 3.9].forEach((z) => box(B, 2.3, 0.08, 0.08, RM.yel, 0, 1.0, z));
      // the overband: magnet housing between two drums, a cross belt running round it
      rbox(B, 1.4, 0.5, 2.6, 0.06, RM.blueD, 0, 3.55, 0.95, 0.02); for (let z = -0.1; z < 2.1; z += 0.25) box(B, 1.42, 0.12, 0.05, RM.greyD, 0, 3.85, z);
      [-0.75, 2.65].forEach((z) => cylX(B, 0.3, 1.45, RM.grey, 0, 3.55, z, 16));
      const tex = beltTex('v'); tex.repeat.set(1, 3.4 / 0.6); const bm = std(0xffffff, 0.85, 0, { map: tex });
      box(B, 1.36, 0.04, 3.4, bm, 0, 3.24, 0.95); box(B, 1.36, 0.04, 3.4, bm, 0, 3.86, 0.95);
      [0.76, -0.76].forEach((x) => rbox(B, 0.06, 0.5, 4.0, 0.02, RM.yel, x, 3.66, 0.95, 0.01)); // side plates kept above the belt: the stuck cans show underneath
      [[-0.6, -0.3], [0.6, -0.3], [-0.6, 2.2], [0.6, 2.2]].forEach(([x, z]) => rod(B, new V3(x, 3.95, z), new V3(x * 1.85, 4.7, z), 0.03, MT.black, 4));
      rbox(B, 0.5, 0.6, 0.5, 0.05, RM.dark, -0.95, 3.55, 2.65, 0.02);
      // the big red horseshoe on top, so everyone knows it's a magnet
      const U = grp(B, 0, 3.95, 0.95); const us = [[0.62, 0], ...arc(0, 0.62, 0.62, 0, 180, 12), [-0.62, 0], [-0.26, 0], ...arc(0, 0.62, 0.26, 180, 0, 8), [0.26, 0]];
      ext(U, us, 0, 0.3, RM.red, 0, 0, 0, 0.03); [0.44, -0.44].forEach((x) => rbox(U, 0.38, 0.2, 0.32, 0.03, RM.greyL, x, 0.06, 0, 0.01));
      // the skip for the cans and the cage for the cartons
      const SKP = grp(B, 0, 0, 3.4); rbox(SKP, 2.4, 0.1, 1.6, 0.02, RM.blue, 0, 0.05, 0, 0.01); [0.8, -0.8].forEach((z) => rbox(SKP, 2.4, 1.2, 0.07, 0.02, RM.blue, 0, 0.6, z, 0.01)); [1.2, -1.2].forEach((x) => rbox(SKP, 0.07, 1.2, 1.6, 0.02, RM.blue, x, 0.6, 0, 0.01));
      [1.15, -1.15].forEach((x) => box(SKP, 0.12, 0.12, 1.7, RM.blueD, x, 1.2, 0));
      const CG = grp(B, 5.5, 0, 0); rbox(CG, 1.8, 0.08, 1.8, 0.02, RM.greyD, 0, 0.04, 0, 0.01); [[0.9, 0.9], [0.9, -0.9], [-0.9, 0.9], [-0.9, -0.9]].forEach(([x, z]) => box(CG, 0.06, 1.4, 0.06, RM.greyD, x, 0.7, z));
      for (let y = 0.35; y <= 1.4; y += 0.35) { [0.9, -0.9].forEach((z) => box(CG, 1.8, 0.03, 0.03, RM.greyD, 0, y, z)); box(CG, 0.03, 0.03, 1.8, RM.greyD, 0.9, y, 0); }
      bake(B);
      const canHeap = add(S, new THREE.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2), BM.can, 0, 0.1, 3.4); canHeap.scale.set(1.0, 0.1, 0.7);
      const cartHeap = add(S, new THREE.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2), RM.carton, 5.5, 0.08, 0); cartHeap.scale.set(0.8, 0.1, 0.8);
      const pool = itemPool(S, ['can', 'carton'], 12);
      // big, shiny, colourful cans with silver lids (easy to see under the magnet), bigger milk cartons
      let ci = 0;
      pool.all.forEach((it) => {
        if (it.k === 'can') { it.m.geometry = BIGCAN; it.m.material = RM.canShine[ci++ % RM.canShine.length]; it.m.scale.setScalar(1.6); const l = add(it.m, BIGLID, RM.lid); l.castShadow = true; }
        else it.m.scale.setScalar(1.7);
      });
      const CANH = 0.24 * 1.6, OBY = 3.22 - CANH; // can height lying, and its y when stuck under the magnet belt
      part(st, 'aimant', "l'aimant géant", anchor(U, 0, 1.3, 0.2), true);
      part(st, 'tapis', 'le tapis', anchor(B, -2.4, 2.4, 0.7), true);
      part(st, 'conserves', 'les boîtes de conserve', anchor(S, 0, 3.0, 1.2), false);
      part(st, 'benne', 'la benne à métal', anchor(SKP, 0, 1.4, 0.8), false);
      st.tagAt = anchor(S, 0, 6.4, 1); st.az = CFG.aimant.yaw + 0.45; // a little from the side, to see both belts move
      // wide view of the station, and a close view on the magnet while the cans jump up
      const view = (close) => { if (close) { st.focus = new V3(0.2, 2.6, 1.5); st.size = { w: 7.5, h: 6.0 }; } else { st.focus = new V3(0.6, 2.6, 1.3); st.size = { w: 14, h: 9 }; } };
      view(false);
      let spawnT = 0;
      st.update = (dt) => {
        if (st.run) { C.tex.offset.x -= dt * 1.4 / 0.6; tex.offset.y -= dt * 1.6 / 0.6; }
        if (st.feed) { spawnT -= dt; if (spawnT <= 0) { spawnT = 0.5; const it = pool.take(Math.random() < 0.65 ? 'can' : 'carton'); if (it) it.m.position.set(-3.4, 2.25, it.z); } }
        pool.all.forEach((it) => {
          if (!it.on) return; const p = it.m.position;
          if (it.state === 'belt') {
            if (st.run) p.x += dt * 1.4;
            if (it.k === 'can' && p.x > -0.7) { it.state = 'jump'; it.t = 0; it.a = p.clone(); tone(1500, 0, 0.08, 'square', 0.02); }
            else if (p.x > 4.4) pool.drop(it, new V3(5.5 + rnd(-0.5, 0.5), 0.15 + cartHeap.scale.y * 0.5, rnd(-0.5, 0.5)), 0.5, 0.2, () => { pool.free(it); cartHeap.scale.y = Math.min(0.9, cartHeap.scale.y + 0.04); });
          } else if (it.state === 'jump') {
            it.t += dt; const k = Math.min(1, it.t / 0.25); p.set(it.a.x + (-0.2 - it.a.x) * k, it.a.y + (OBY - it.a.y) * k, it.a.z * (1 - k) + 0.15 * k); it.m.rotation.y += dt * 9; if (k >= 1) { it.state = 'ob'; it.m.rotation.y = rnd(-0.3, 0.3); }
          } else if (it.state === 'ob') {
            if (st.run) p.z += dt * 1.6; if (p.z > 2.75) pool.drop(it, new V3(rnd(-0.8, 0.8), 0.2 + canHeap.scale.y * 0.6, 3.4 + rnd(-0.4, 0.4)), 0.5, 0.1, () => { pool.free(it); canHeap.scale.y = Math.min(0.9, canHeap.scale.y + 0.04); clink(); });
          }
        });
        pool.update(dt);
      };
      st.action = async function () {
        view(false);
        if (st.done) { pool.reset(); canHeap.scale.y = 0.1; cartHeap.scale.y = 0.1; st.done = false; }
        st.run = true; st.feed = true; engineOn(80);
        await Promise.all([step('Sur ce tapis, il y a des boîtes de conserve et des briques de lait.', 'tapis'), sleep(2.5)]);
        view(true);
        await Promise.all([step('Au-dessus, un aimant géant ! Il attire le fer, très fort.', 'aimant'), sleep(2.5)]);
        await Promise.all([step('Hop ! Les boîtes de conserve sautent et se collent à l’aimant.', 'conserves'), sleep(3)]);
        st.feed = false;
        await Promise.all([step('Le petit tapis les emmène sur le côté, et elles tombent dans la benne.', 'benne'), sleep(3)]);
        view(false);
        await Promise.all([step('Les briques de lait ne sont pas attirées : elles continuent tout droit.', 'tapis'), sleep(3)]);
        st.run = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- la presse à balles ---- */
    (function () {
      const st = makeStation('presse'), S = st.g, B = grp(S), BL = RM.blue;
      // bottle bunker and the belt up to the hopper
      [1.45, -1.45].forEach((z) => rbox(B, 3.0, 1.2, 0.3, 0.03, RM.concrete, -8.6, 0.6, z, 0.01)); rbox(B, 0.3, 1.2, 3.2, 0.03, RM.concrete, -10.1, 0.6, 0, 0.01);
      { const h = add(B, new THREE.SphereGeometry(1, 16, 8, 0, PI * 2, 0, PI / 2), BM.plastic, -8.9, 0, 0); h.scale.set(1.2, 0.9, 1.2); }
      instanced(S, IG.bottle, 26, (i, d) => { const a = rnd(0, 6.3), e = rnd(0.1, 1.3); d.position.set(-8.9 + Math.cos(a) * Math.cos(e) * 1.18, Math.sin(e) * 0.88, Math.sin(a) * Math.cos(e) * 1.18); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.setScalar(1.5); return pick(IC.bottle); });
      const C = conveyor(B, [-7.9, 0.55], [-0.7, 4.5], { w: 1.0, frame: BL, rail: true });
      // the baler: ram housing, chamber with a window, hopper, bale channel, tying head, roller table
      rbox(B, 10.6, 0.3, 1.9, 0.04, RM.dark, -0.6, 0.15, 0, 0.02);
      rbox(B, 4.2, 1.5, 1.7, 0.1, BL, -3.7, 1.05, 0, 0.03); cylX(B, 0.5, 0.25, RM.dark, -5.9, 1.05, 0, 18); for (let x = -5.4; x < -2; x += 0.6) box(B, 0.06, 1.52, 1.72, RM.blueD, x, 1.05, 0);
      { const D = grp(B); decal(D, 'PRESSE', 1.6, 0.36, '#ffffff', -3.7, 1.25, 0.87, null); }
      rbox(B, 2.6, 0.3, 1.7, 0.02, BL, -0.3, 0.45, 0, 0.01); rbox(B, 2.6, 1.5, 0.12, 0.02, BL, -0.3, 1.05, -0.8, 0.01);
      rbox(B, 2.6, 0.25, 0.12, 0.02, BL, -0.3, 0.42, 0.82, 0.01); rbox(B, 2.6, 0.25, 0.12, 0.02, BL, -0.3, 1.72, 0.82, 0.01); [-1.55, 0.95].forEach((x) => rbox(B, 0.14, 1.5, 0.14, 0.02, BL, x, 1.05, 0.82, 0.01));
      box(B, 2.4, 1.05, 0.03, MT.glass, -0.3, 1.07, 0.84);
      { const hg = new THREE.CylinderGeometry(1.4, 1.05, 2.0, 4, 1, true); hg.rotateY(PI / 4); const h = add(B, hg, std(0x2f6fe0, 0.4, 0.15, { side: THREE.DoubleSide }), -0.3, 2.85, 0); h.scale.set(1.75, 1, 1.15); }
      rbox(B, 3.4, 0.28, 1.9, 0.03, BL, 2.7, 1.86, 0, 0.01); rbox(B, 3.4, 0.25, 1.9, 0.03, BL, 2.7, 0.45, 0, 0.01);
      [0.9, -0.9].forEach((z) => [0.85, 1.25, 1.6].forEach((y) => rbox(B, 3.4, 0.1, 0.1, 0.02, RM.blueD, 2.7, y, z, 0.01)));
      [0.55, -0.55].forEach((z) => { cylX(B, 0.12, 1.4, RM.dark, 2.4, 2.15, z, 10); cylX(B, 0.06, 0.8, MT.chrome, 3.4, 2.15, z, 8); });
      [1.15, -1.15].forEach((z) => rbox(B, 0.3, 2.9, 0.26, 0.03, RM.yel, 1.5, 1.45, z, 0.01)); rbox(B, 0.4, 0.3, 2.6, 0.03, RM.yel, 1.5, 3.0, 0, 0.01);
      for (let i = 0; i < 4; i++) { const z = -0.75 + i * 0.5; cylZ(B, 0.17, 0.2, RM.wire, 1.5, 3.4, z, 12); box(B, 0.04, 2.6, 0.04, MT.steel, 1.62, 1.75, z * 0.8); }
      rbox(B, 2.2, 0.1, 1.4, 0.02, RM.greyD, 5.6, 0.55, 0, 0.01); for (let x = 4.7; x < 6.6; x += 0.3) cylZ(B, 0.06, 1.3, MT.steel, x, 0.62, 0, 8); [0.65, -0.65].forEach((z) => [4.7, 6.5].forEach((x) => box(B, 0.08, 0.55, 0.08, RM.greyD, x, 0.27, z)));
      // power pack, hoses, control box
      rbox(B, 1.8, 0.9, 0.9, 0.06, RM.blueD, -3.6, 0.45, -1.7, 0.02); cylX(B, 0.25, 0.8, RM.dark, -3.4, 1.1, -1.7, 12); cylY(B, 0.1, 0.06, RM.red, -4.2, 0.93, -1.7, 10);
      [0.3, 0.6].forEach((dx) => { const tb = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(-4.2 + dx, 0.9, -1.4), new V3(-4.4 + dx, 1.8, -1.3), new V3(-4.6 + dx, 1.4, -0.85)), 10, 0.04, 6); add(B, tb, MT.black); });
      { const cb = grp(B, 3.2, 0, 1.7); box(cb, 0.1, 1.1, 0.1, RM.greyD, 0, 0.55, 0); rbox(cb, 0.5, 0.6, 0.25, 0.05, RM.greyL, 0, 1.35, 0, 0.02); [[-0.12, RM.green], [0.12, RM.red]].forEach(([x, m]) => cylZ(cb, 0.06, 0.06, m, x, 1.4, 0.14, 10)); cylZ(cb, 0.07, 0.04, MT.amber, 0, 1.2, 0.14, 10); }
      bake(B);
      // moving: the ram plate and its rod, the bottles in the chamber, the bale
      const plate = grp(S, -1.45, 1.05, 0); rbox(plate, 0.18, 1.2, 1.45, 0.03, RM.yel, 0, 0, 0, 0.01); cylX(plate, 0.16, 2.2, MT.chrome, -1.2, 0, 0, 12);
      const fill = add(S, new THREE.BoxGeometry(1, 1.15, 1.4).translate(0.5, 0.575, 0), BM.plastic, -1.36, 0.6, 0); fill.scale.set(2.3, 0.01, 1); fill.visible = false;
      const bg = grp(S, 1.0, 0.6, 0); const bb = bale(bg, 'plastic', 0.6, 0, 0); const wires = bb.children.slice(1);
      wires.forEach((w) => (w.visible = false)); bg.scale.x = 0.01; bg.visible = false;
      const stack = [[7.7, 0, 1.0, 0.1], [7.7, 0, -0.3, -0.05], [7.7, 1.0, 0.35, 0.15]].map(([x, y, z, r]) => bale(S, 'plastic', x, y, z, r));
      const pool = itemPool(S, ['bottle'], 14);
      part(st, 'tapis', 'le tapis roulant', anchor(B, -4.6, 2.8, 0.6), true);
      part(st, 'piston', 'le gros piston', anchor(plate, 0, 0.3, 0.9), true);
      part(st, 'trémie', "l'entrée de la presse", anchor(S, -0.3, 3.9, 1.0), false);
      part(st, 'fils', 'les fils de fer', anchor(S, 1.5, 3.6, 0.9), false);
      part(st, 'balle', 'la balle', anchor(bg, 0.6, 1.2, 0.5), false);
      st.focus = new V3(-1.2, 2.2, 0.6); st.size = { w: 19, h: 8 }; st.tagAt = anchor(S, -0.3, 5.0, 0);
      let spawnT = 0;
      const syncFill = () => { const x0 = plate.position.x + 0.09; fill.position.x = x0; fill.scale.x = Math.max(0.02, 1.0 - x0); };
      st.update = (dt) => {
        if (st.run) C.tex.offset.x -= dt * 1.5 / 0.6;
        if (st.feed) { spawnT -= dt; if (spawnT <= 0) { spawnT = 0.3; pool.take('bottle'); } }
        pool.all.forEach((it) => {
          if (!it.on || it.state !== 'belt') return;
          it.s += dt * 1.5; it.m.position.copy(C.at(Math.min(it.s, C.L), 0.12)); it.m.position.z += it.z;
          if (it.s >= C.L) pool.drop(it, new V3(rnd(-1.0, 0.6), 1.2, rnd(-0.5, 0.5)), 0.5, 0.3, () => { pool.free(it); fill.visible = true; fill.scale.y = Math.min(1, fill.scale.y + 0.06); });
        });
        pool.update(dt);
        syncFill();
      };
      const stroke = async (b0, b1) => {
        engineOn(70); tone(90, 0, 2.4, 'sawtooth', 0.03, 60);
        await tw(2.4, (k) => { plate.position.x = -1.45 + 2.3 * k; bg.scale.x = b0 + (b1 - b0) * k; }, easeSine); thud();
        await tw(1.4, (k) => (plate.position.x = 0.85 - 2.3 * k), easeSine); engineOff();
      };
      st.action = async function () {
        if (st.done) { bg.visible = false; bg.scale.x = 0.01; bg.position.x = 1.0; wires.forEach((w) => (w.visible = false)); fill.scale.y = 0.01; fill.visible = false; st.done = false; }
        st.run = true; st.feed = true; engineOn(60);
        await Promise.all([step('Le tapis roulant monte les bouteilles en plastique jusqu’à la presse.', 'tapis'), sleep(4.5)]);
        st.feed = false; await sleep(1.6); st.run = false; engineOff(); bg.visible = true;
        await Promise.all([step('Le gros piston pousse... et serre les bouteilles. Elles deviennent toutes plates !', 'piston'), (async () => { await stroke(0.01, 0.5); fill.scale.y = 0.01; })()]);
        st.run = true; st.feed = true; await sleep(2.2); st.feed = false; await sleep(1.6); st.run = false;
        await Promise.all([step('Encore une fois ! Ça fait un gros cube, bien serré.', 'piston'), (async () => { await stroke(0.5, 1.0); fill.scale.y = 0.01; fill.visible = false; })()]);
        await step('On attache le cube avec des fils de fer, pour qu’il reste bien fermé.', 'fils');
        for (const w of wires) { w.visible = true; ding(); await sleep(0.45); }
        await Promise.all([step('Voilà une balle de plastique ! Elle sort de la presse.', 'balle'), to(bg.position, 'x', 4.85, 3, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le chariot élévateur et le camion qui part à l'usine ---- */
    (function () {
      const st = makeStation('chariot'), S = st.g;
      const SM = semi(S), truck = SM.g, TZ = -3.5, TX0 = -1; truck.position.set(TX0, 0, TZ);
      const pre = [bale(truck, 'paper', -6.2, 1.53, -0.6), bale(truck, 'paper', -4.9, 1.53, -0.6), bale(truck, 'paper', -6.2, 1.53, 0.55), bale(truck, 'paper', -6.2, 2.53, -0.6)];
      const FK = forklift(st, S), fk = FK.g; st.m = fk;
      const BALES = [new V3(-3.1, 0, 2.6), new V3(-1.6, 0, 2.6)], DEST = [new V3(-3.6, 1.53, TZ + 0.6), new V3(-2.3, 1.53, TZ + 0.6)];
      const bales = BALES.map((p) => bale(S, 'plastic', p.x, 0, p.z));
      [[-5.0, 0, 2.6], [-5.0, 1.0, 2.6], [0.2, 0, 2.7]].forEach(([x, y, z]) => bale(S, x > 0 ? 'paper' : 'plastic', x, y, z, rnd(-0.08, 0.08)));
      const HOME = new V3(-2.3, 0, -0.45); fk.position.copy(HOME); fk.rotation.y = -PI / 2; FK.setLift(0.1);
      const prev = fk.position.clone();
      part(st, 'fourches', 'les fourches', anchor(FK.car, 0.6, 0.15, 0.4), true);
      part(st, 'balles', 'les balles de plastique', anchor(S, -2.3, 1.4, 3.1), true);
      part(st, 'camion', 'le camion pour l’usine', anchor(truck, 0, 4.4, 1.2), true);
      part(st, 'rideau', 'le rideau', anchor(truck, -2, 3.0, 1.3), false);
      st.focus = new V3(-0.5, 2.0, -0.4); st.size = { w: 20, h: 9 }; st.tagAt = anchor(fk, 0, 3.2, 0);
      st.update = (dt) => {
        const dx = fk.position.x - prev.x, dz = fk.position.z - prev.z, ry = fk.rotation.y, dd = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(fk.position);
        if (dd) FK.wheels.forEach((w) => (w.rotation.z -= dd / w.userData.r));
        if (dd < -0.001) { st.beepT = (st.beepT || 0) - dt; if (st.beepT <= 0) { beep(); st.beepT = 0.55; } }
      };
      const drive = (p1, ry1, d, ctrl) => { const p0 = fk.position.clone(), r0 = fk.rotation.y, c = ctrl || p0.clone().lerp(p1, 0.5); return tw(d, (k) => { const u = 1 - k; fk.position.set(u * u * p0.x + 2 * u * k * c.x + k * k * p1.x, 0, u * u * p0.z + 2 * u * k * c.z + k * k * p1.z); fk.rotation.y = r0 + (ry1 - r0) * k; }, easeSine); };
      const liftTo = (c, d) => { const c0 = FK.car.position.y; return tw(d, (k) => FK.setLift(c0 + (c - c0) * k), easeSine); };
      const carry = async (i, first) => {
        const b = bales[i], bp = BALES[i], dst = DEST[i];
        await Promise.all([first ? step('Les balles sont prêtes. Le chariot glisse ses deux fourches dessous.', 'fourches') : step('Et une autre ! Le chariot va chercher la balle suivante.', 'balles'), drive(new V3(bp.x, 0, bp.z - 1.86), -PI / 2, 2.4)]);
        fk.updateMatrixWorld(true); FK.car.attach(b);
        await liftTo(0.4, 0.9);
        await Promise.all([first ? step('Il soulève la balle, et l’emmène jusqu’au camion.', 'balles') : sleep(0.1), (async () => {
          await drive(new V3(bp.x - 1.2, 0, 0.4), 0, 1.8, new V3(bp.x, 0, 0.0));
          await Promise.all([drive(new V3(dst.x, 0, dst.z + 1.86 + 0.4), PI / 2, 2.4, new V3(dst.x + 0.2, 0, 0.3)), liftTo(1.75, 2.2)]);
          await drive(new V3(dst.x, 0, dst.z + 1.86), PI / 2, 0.9);
        })()]);
        await Promise.all([first ? step('Il pose la balle dans la remorque, tout doucement.', 'camion') : sleep(0.1), liftTo(1.63, 0.8)]);
        truck.updateMatrixWorld(true); truck.attach(b); b.position.y = 1.53; thud();
        await liftTo(1.56, 0.3);
        await drive(new V3(dst.x, 0, dst.z + 1.86 + 1.0), PI / 2, 1.2); await liftTo(0.1, 1.0);
      };
      st.action = async function () {
        if (st.done) {
          truck.visible = true; truck.position.set(TX0, 0, TZ); SM.curtain.scale.x = 0.01; bales.forEach((b, i) => { S.attach(b); b.position.copy(BALES[i]); b.rotation.set(0, 0, 0); });
          fk.position.copy(HOME); fk.rotation.y = -PI / 2; prev.copy(HOME); FK.setLift(0.1); pop(truck, 0.6); st.done = false; await sleep(0.6);
        }
        engineOn(70);
        await carry(0, true); await carry(1, false);
        await Promise.all([drive(HOME, -PI / 2, 2.4, new V3(-1.0, 0, 1.0))]);
        engineOff();
        await Promise.all([step('Le chauffeur ferme le rideau de la remorque.', 'rideau'), tw(2.2, (k) => (SM.curtain.scale.x = 0.01 + 12.0 * k), easeSine)]);
        engineOn(50);
        await Promise.all([step('Et le camion part à l’usine ! Là-bas, les bouteilles vont redevenir... des bouteilles !', 'camion'),
          tw(7, (k) => { const x = TX0 + 60 * k * k; const dx = x - truck.position.x; truck.position.x = x; SM.wheels.forEach((w) => (w.rotation.z -= dx / w.userData.r)); }, lin)]);
        truck.visible = false; engineOff();
        await Promise.all([step('C’est ça, le recyclage : rien ne se perd, tout se transforme !', 'balles'), sleep(1)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la grue à grappin de la ferraille ---- */
    (function () {
      const st = makeStation('grappin'), S = st.g;
      const H = handler(S), A = H.arm; st.m = H.g;
      const yawTo = (x, z) => Math.atan2(-z, x), PILE = new V3(6, 0, -2.5), SKIP = new V3(-6, 0, -3);
      const RP = Math.hypot(PILE.x, PILE.z) - 0.9, RS = Math.hypot(SKIP.x, SKIP.z) - 0.9, YP = yawTo(PILE.x, PILE.z), YS = yawTo(SKIP.x, SKIP.z);
      const REST = [0.15, 4.3, 0.9]; A.set(...REST); H.setGrab(0.2); H.setCab(0);
      // the scrap pile: a mound, bits of metal, pipes and two old bikes
      const B = grp(S);
      { const m = add(B, new THREE.SphereGeometry(1, 18, 9, 0, PI * 2, 0, PI / 2), RM.scrap, PILE.x, 0, PILE.z); m.scale.set(3.0, 1.7, 2.6); }
      const sc = [0x9aa4b6, 0x7a8494, 0xb8683a, 0x3a6ab0, 0xd8a03a, 0x5a5f6a, 0xc8ccd8];
      instanced(S, new THREE.BoxGeometry(0.7, 0.08, 0.25), 60, (i, d) => { const a = rnd(0, 6.3), e = rnd(0.05, 1.4); d.position.set(PILE.x + Math.cos(a) * Math.cos(e) * 2.95, Math.sin(e) * 1.65, PILE.z + Math.sin(a) * Math.cos(e) * 2.55); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.setScalar(rnd(0.7, 1.4)); return pick(sc); });
      instanced(S, new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), 22, (i, d) => { const a = rnd(0, 6.3), e = rnd(0.05, 1.3); d.position.set(PILE.x + Math.cos(a) * Math.cos(e) * 2.95, Math.sin(e) * 1.65, PILE.z + Math.sin(a) * Math.cos(e) * 2.55); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.setScalar(1); return pick(sc); });
      const bike = (x, y, z, rx, ry, col) => { const g = grp(B, x, y, z); g.rotation.set(rx, ry, 0); [0.55, -0.55].forEach((u) => add(g, new THREE.TorusGeometry(0.34, 0.035, 6, 18), MT.black, u, 0, 0)); [[[-0.55, 0], [0, 0.05]], [[0, 0.05], [0.42, 0.42]], [[-0.55, 0], [-0.15, 0.45]], [[-0.15, 0.45], [0.42, 0.42]], [[0, 0.05], [-0.15, 0.45]], [[0.55, 0], [0.42, 0.42]]].forEach(([a, b]) => rod(g, new V3(a[0], a[1], 0), new V3(b[0], b[1], 0), 0.03, col, 6)); rbox(g, 0.2, 0.05, 0.08, 0.02, MT.black, -0.17, 0.52, 0, 0.01); rod(g, new V3(0.4, 0.42, -0.2), new V3(0.4, 0.42, 0.2), 0.02, MT.black, 4); return g; };
      bike(PILE.x - 1.6, 1.15, PILE.z + 1.3, 0.5, 0.3, RM.red); bike(PILE.x + 1.2, 1.3, PILE.z + 1.5, -0.4, -0.6, RM.blue);
      // the skip (hook-lift container) and concrete blocks around the yard
      const SK = grp(B, SKIP.x, 0, SKIP.z); SK.rotation.y = 0.45;
      rbox(SK, 6.0, 0.15, 2.4, 0.02, RM.orange, 0, 0.25, 0, 0.01); [1.2, -1.2].forEach((z) => { rbox(SK, 6.0, 1.8, 0.08, 0.02, RM.orange, 0, 1.15, z, 0.01); for (let x = -2.6; x <= 2.6; x += 0.85) box(SK, 0.1, 1.8, 0.06, RM.orange, x, 1.15, z * 1.04); });
      [3, -3].forEach((x) => rbox(SK, 0.08, 1.8, 2.4, 0.02, RM.orange, x, 1.15, 0, 0.01)); rbox(SK, 0.2, 0.9, 0.3, 0.03, RM.dark, 3.15, 2.35, 0, 0.01); [[2.6, 1], [2.6, -1], [-2.6, 1], [-2.6, -1]].forEach(([x, s]) => cylZ(SK, 0.12, 0.2, RM.dark, x, 0.12, s * 0.9, 10));
      for (let i = 0; i < 7; i++) rbox(B, 1.56, 0.78, 0.8, 0.04, RM.concrete, -4.8 + i * 1.6 + 2, 0.4, -6.6, 0.02);
      bake(B);
      const heap = add(S, new THREE.SphereGeometry(1, 14, 7, 0, PI * 2, 0, PI / 2), RM.scrap, SKIP.x, 0.3, SKIP.z); heap.rotation.y = 0.45; heap.scale.set(2.4, 0.15, 0.9);
      const drops = Array.from({ length: 9 }, () => { const b = rbox(S, rnd(0.3, 0.7), rnd(0.06, 0.15), rnd(0.12, 0.3), 0.02, pick([RM.grey, RM.greyD, RM.red, RM.blue, RM.scrap]), 0, 0, 0, 0.01); b.visible = false; return b; });
      part(st, 'grappin', 'le grappin', anchor(H.tool, 0, -1.2, 0.6), true);
      part(st, 'cabine', 'la cabine qui monte', anchor(H.cab, 0.2, 1.7, 0.4), true);
      part(st, 'ferraille', 'la ferraille', anchor(S, PILE.x, 2.0, PILE.z + 2.2), false);
      part(st, 'benne', 'la grande benne', anchor(S, SKIP.x, 2.2, SKIP.z + 1.3), false);
      st.focus = new V3(0, 3.0, -1.5); st.size = { w: 19, h: 11 }; st.tagAt = anchor(H.up, 0, 5.2, 0);
      st.update = () => H.rams.forEach((r) => r.update());
      st.action = async function () {
        if (st.done) { heap.scale.y = 0.15; drops.forEach((b) => (b.visible = false)); st.done = false; }
        engineOn(60);
        await Promise.all([step('Ici, c’est la ferraille : des vieux vélos, des tuyaux, des morceaux de métal.', 'ferraille'), sleep(1.6)]);
        await Promise.all([step('La cabine de la grue monte tout en haut, pour bien voir.', 'cabine'), tw(2.2, (k) => H.setCab(2.2 * k), easeSine)]);
        await Promise.all([step('Le grappin s’ouvre comme une main...', 'grappin'), A.move(YP, RP, 3.2, 2.6), tw(1.4, (k) => H.setGrab(0.2 + 0.8 * k))]);
        await A.move(YP, RP, 0.9, 1.6); thud();
        await Promise.all([step('...et il se referme : il attrape la ferraille !', 'grappin'), tw(1.0, (k) => H.setGrab(1 - 0.9 * k))]);
        H.clump.visible = true;
        await A.move(YP, RP, 3.6, 1.6);
        await Promise.all([step('La grue tourne, et lâche tout dans la grande benne. Boum !', 'benne'), A.move(YS, RS, 3.0, 3.4)]);
        S.updateMatrixWorld(true); const p0 = S.worldToLocal(wp(H.clump)); H.clump.visible = false;
        await Promise.all([tw(0.8, (k) => H.setGrab(0.1 + 0.9 * k)), ...drops.map((b) => { b.visible = true; const a = p0.clone().add(new V3(rnd(-0.3, 0.3), rnd(-0.2, 0.2), rnd(-0.3, 0.3))), c = new V3(SKIP.x + rnd(-1.6, 1.6), 0.5 + rnd(0, 0.3), SKIP.z + rnd(-0.6, 0.6)); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); return tw(0.6, (k) => { b.position.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k * k, a.z + (c.z - a.z) * k); }, lin); })]);
        thud(); tone(120, 0, 0.5, 'square', 0.05, 60); puff(wp(H.clump).setY(1.5), 4, 0xc8c0b8); heap.scale.y = 0.6;
        await Promise.all([step('À l’usine, on fera fondre ce métal pour fabriquer des choses toutes neuves.', 'ferraille'), A.move(REST[0], REST[1], REST[2], 3), tw(1.2, (k) => H.setGrab(1 - 0.8 * k))]);
        await tw(1.8, (k) => H.setCab(2.2 * (1 - k)), easeSine);
        engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le broyeur de branches ---- */
    (function () {
      const st = makeStation('compost'), S = st.g;
      const SR = shredder(S); st.m = SR.g; SR.chute.rotation.y = -0.5;
      // the pile of branches waiting, the chips pile that grows
      const B = grp(S);
      const branch = (p, x, y, z, ry, rz, s = 1) => { const g = grp(p, x, y, z); g.rotation.set(0, ry, rz); rod(g, new V3(0, 0, 0), new V3(1.8 * s, 0, 0), 0.06 * s, RM.bark, 6); rod(g, new V3(0.7 * s, 0, 0), new V3(1.2 * s, 0.35 * s, 0.2), 0.035, RM.bark, 5); rod(g, new V3(1.1 * s, 0, 0), new V3(1.6 * s, -0.1, -0.35 * s), 0.03, RM.bark, 5); [[1.3, 0.4, 0.2], [1.7, 0.05, -0.3], [1.85, 0, 0.1], [1.0, 0.2, -0.1]].forEach(([a, b, c]) => { const l = add(g, ICO, RM.leaf, a * s, b * s, c * s); l.scale.setScalar(0.24 * s); }); return g; };
      for (let i = 0; i < 12; i++) branch(B, -6.6 + rnd(-0.6, 0.6), 0.1 + (i % 4) * 0.18, rnd(-1.0, 1.4), rnd(-0.6, 0.6), rnd(-0.1, 0.1));
      { const sg = grp(B, -4.6, 0, -1.6); box(sg, 0.08, 1.4, 0.08, RM.greyD, 0, 0.7, 0); ext(sg, [[-0.35, 0], [0.35, 0], [0, 0.6]], 0.04, 0.05, RM.yel, 0, 1.25, 0.06, 0.01); }
      bake(B);
      const chips = add(S, new THREE.ConeGeometry(1.5, 1.2, 12).translate(0, 0.6, 0), RM.chips, 4.6, 0, 1.6); chips.scale.set(0.5, 0.3, 0.5);
      const man = walker(S, -4.5, 1.0, { vest: true, hat: MT.hat, bottom: 0x3a5a3a }); man.rotation.y = 0;
      const carried = branch(S, 0, 0, 0, 0, 0, 0.9); carried.visible = false;
      const OUT = new V3(4.6, 0.6, 1.6);
      part(st, 'broyeur', 'le broyeur', anchor(SR.g, 0.9, 2.4, 0.7), true);
      part(st, 'entree', "l'entrée", anchor(SR.g, -2.6, 1.6, 0.9), true);
      part(st, 'tuyau', 'le tuyau', anchor(SR.outlet, 0, 0.3, 0), false);
      part(st, 'copeaux', 'les copeaux', anchor(S, 4.6, 1.2, 2.4), false);
      part(st, 'branches', 'les branches', anchor(S, -6.6, 1.2, 1.6), false);
      st.focus = new V3(-0.6, 1.8, 0.8); st.size = { w: 16, h: 7.5 }; st.tagAt = anchor(SR.g, 0, 3.8, 0);
      let rpm = 0, spray = 0;
      st.update = (dt) => {
        SR.fly.rotation.z -= dt * rpm; SR.roller.rotation.z += dt * (st.feeding ? 4 : 0);
        if (st.spray) { spray -= dt; if (spray <= 0) { spray = 0.05; throwClod(wp(SR.outlet), S.localToWorld(OUT.clone().add(new V3(rnd(-0.6, 0.6), chips.scale.y * 1.0, rnd(-0.6, 0.6)))), rnd(0.07, 0.13), pick([0xc8945a, 0xa8743a, 0x6aa84a])); } }
      };
      st.action = async function () {
        if (st.done) { chips.scale.set(0.5, 0.3, 0.5); st.done = false; }
        await Promise.all([step('Ici, on apporte les branches et l’herbe coupées dans les jardins.', 'branches'), sleep(1.2)]);
        engineOn(110);
        await Promise.all([step('Le broyeur démarre. Ses lames tournent très, très vite !', 'broyeur'), tw(1.6, (k) => (rpm = 22 * k), lin)]);
        await walkTo(man, new V3(-5.6, 0, 1.0), 0.8); man.rotation.y = 0; setArms(man, 1.0);
        const hold = () => { carried.position.set(man.position.x + 0.35, 0.95, man.position.z - 0.3); carried.rotation.set(0, 0, 0); };
        hold(); carried.visible = true; pop(carried, 0.3);
        await Promise.all([step('Le jardinier pousse une branche dans l’entrée. Jamais les mains dedans !', 'entree'), (async () => {
          const a = man.position.clone(), b = new V3(-4.7, 0, 0.55); man.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
          await tw(1.2, (k) => { man.position.lerpVectors(a, b, k); man.userData.walk(k * 8); hold(); }, lin); man.userData.walk(0); man.rotation.y = 0;
          const L = 1.62, x0 = carried.position.x; st.feeding = true; st.spray = true; tone(140, 0, 1.8, 'sawtooth', 0.04, 90);
          await tw(0.5, (k) => carried.position.set(x0 + (-1.3 - L - x0) * k, 1.0, 0.25 * (1 - k)), easeSine);
          await tw(1.8, (k) => { const s = Math.max(0.03, 1 - k); carried.scale.set(s, 1, 1); carried.position.x = -1.3 - L * s; }, lin);
          carried.visible = false; carried.scale.set(1, 1, 1); st.feeding = false; setArms(man, 0);
        })()]);
        await Promise.all([step('Crac, crac ! Les copeaux sortent par le tuyau et font un gros tas.', 'copeaux'), tw(3, (k) => { chips.scale.set(0.5 + 0.35 * k, 0.3 + 0.45 * k, 0.5 + 0.35 * k); }, lin)]);
        st.spray = false;
        await tw(1.2, (k) => (rpm = 22 * (1 - k)), lin); rpm = 0; engineOff();
        await walkTo(man, new V3(-4.5, 0, 1.0), 0.8); man.rotation.y = 0;
        await Promise.all([step('Avec le temps, ce tas devient du compost : une bonne terre pour faire pousser les plantes !', 'copeaux'), sleep(1)]);
        chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the neighbourhood and the recycling centre ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
/** A French suburban house (pavillon) facing the street (+z), its garden hedge and its bins on the pavement. */
function house(p, h, d, wall, shut, roofM = RM.roof, yaw = YAW) {
  const g = at(p, h, d, yaw), W = 4.4, D = 4.6, H = 2.8;
  rbox(g, W, H, D, 0.04, wall, 0, H / 2, 0, 0.02); rbox(g, W + 0.1, 0.25, D + 0.1, 0.02, RM.concreteD, 0, 0.12, 0, 0.01);
  ext(g, [[-D / 2 - 0.35, 0], [D / 2 + 0.35, 0], [0, 1.7]], 0.04, W + 0.5, roofM, 0, H, 0, 0.03).rotation.y = PI / 2;
  [1, -1].forEach((s) => ext(g, [[-D / 2, 0], [D / 2, 0], [0, 1.45]], 0, 0.08, wall, s * (W / 2 - 0.05), H, 0, 0.01).rotation.y = PI / 2);
  rbox(g, 0.5, 1.4, 0.5, 0.03, wall, 1.2, H + 1.2, -0.7, 0.01); rbox(g, 0.6, 0.1, 0.6, 0.02, RM.concreteD, 1.2, H + 1.9, -0.7, 0.01);
  rbox(g, 0.9, 1.95, 0.06, 0.03, RM.door, 0.25, 1.15, D / 2 + 0.02, 0.01); sph(g, 0.05, MT.chrome, 0.55, 1.15, D / 2 + 0.07); rbox(g, 1.3, 0.08, 0.7, 0.02, wall, 0.25, 2.3, D / 2 + 0.3, 0.01);
  [-1.35, 1.55].forEach((x) => { rbox(g, 0.95, 1.05, 0.06, 0.02, MT.white, x, 1.55, D / 2 + 0.02, 0.01); box(g, 0.75, 0.85, 0.04, MT.glassD, x, 1.55, D / 2 + 0.05); box(g, 0.04, 0.85, 0.06, MT.white, x, 1.55, D / 2 + 0.07); [1, -1].forEach((s) => rbox(g, 0.42, 1.0, 0.05, 0.02, shut, x + s * 0.7, 1.55, D / 2 + 0.05, 0.01)); });
  [1, -1].forEach((s) => { rbox(g, 0.06, 0.8, 0.7, 0.02, MT.white, s * (W / 2 + 0.01), 1.55, 0.6, 0.01); box(g, 0.04, 0.62, 0.52, MT.glassD, s * (W / 2 + 0.03), 1.55, 0.6); });
  // front garden: lawn, path, hedge with a little gate, letterbox
  rbox(g, W + 1.4, 0.04, 2.4, 0.01, RM.grass, 0, 0.02, D / 2 + 1.3, 0.01); rbox(g, 0.8, 0.05, 2.4, 0.01, RM.concrete, 0.25, 0.04, D / 2 + 1.3, 0.01);
  rbox(g, 2.0, 0.8, 0.5, 0.2, RM.hedge, -1.55, 0.4, D / 2 + 2.45, 0.03); rbox(g, 2.1, 0.8, 0.5, 0.2, RM.hedge, 1.9, 0.4, D / 2 + 2.45, 0.03);
  for (let x = -0.08; x <= 0.6; x += 0.12) box(g, 0.05, 0.75, 0.04, MT.white, x, 0.4, D / 2 + 2.45); box(g, 0.7, 0.05, 0.05, MT.white, 0.25, 0.7, D / 2 + 2.45);
  box(g, 0.06, 1.0, 0.06, RM.greyD, 2.95, 0.5, D / 2 + 2.6); rbox(g, 0.3, 0.25, 0.25, 0.04, RM.yel, 2.95, 1.1, D / 2 + 2.6, 0.01);
  // back garden: a tree and a fence
  const [tx, tz] = [-1.2, -D / 2 - 2.2]; cylY(g, 0.15, 1.8, 0x6a4a2a, tx, 0.9, tz, 8); [[0, 2.4, 0, 1.1], [0.5, 2.1, 0.3, 0.8], [-0.4, 2.0, -0.3, 0.8]].forEach(([a, b, c, s]) => { const m = add(g, ICO, pick([0x5aa85a, 0x4a9a4a, 0x7ab84a]), tx + a, b, tz + c); m.scale.setScalar(s); });
  for (let x = -W / 2 - 0.6; x <= W / 2 + 0.6; x += 0.5) box(g, 0.06, 0.9, 0.06, RM.wood, x, 0.45, -D / 2 - 3.4); box(g, W + 1.2, 0.08, 0.05, RM.wood, 0, 0.7, -D / 2 - 3.4);
  // bins out on the pavement
  wheelieBin(g, RM.lidY, -2.4, D / 2 + 3.05, -PI / 2); wheelieBin(g, Math.random() < 0.5 ? RM.lidGr : RM.lidG, -1.6, D / 2 + 3.05, -PI / 2);
  return g;
}
function tree(p, h, d, s = 1, cols) { const [x, z] = Q(h, d); const t = autumnTree(p, x, z, cols || pick([[0x5aa85a, 0x4a9a4a, 0x6ab86a], [0x6a9a3a, 0x4a8a3a, 0x7aa84a], [0x5ab06a, 0x3a9a5a, 0x7ac07a]])); t.scale.setScalar(s); return t; }
function bench(p, h, d, yaw) { const g = at(p, h, d, yaw); rbox(g, 1.6, 0.08, 0.45, 0.02, RM.wood, 0, 0.45, 0, 0.01); rbox(g, 1.6, 0.35, 0.06, 0.02, RM.wood, 0, 0.75, -0.22, 0.01); [0.7, -0.7].forEach((x) => box(g, 0.06, 0.45, 0.4, RM.dark, x, 0.22, 0)); }
function baleRow(p, h, d, yaw, n, kinds, rows = 2) { const g = at(p, h, d, yaw); for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) if (j === 0 || Math.random() < 0.7) bale(g, pick(kinds), i * 1.25, j * 1.0, rnd(-0.05, 0.05), rnd(-0.05, 0.05)); return g; }
function fenceRun(p, a, b) {
  const [ax, az] = Q(...a), [bx, bz] = Q(...b), L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5), ang = Math.atan2(-(bz - az), bx - ax);
  for (let i = 0; i <= n; i++) { const t = i / n; box(p, 0.08, 1.9, 0.08, RM.greenD, ax + (bx - ax) * t, 0.95, az + (bz - az) * t); }
  [0.2, 1.0, 1.8].forEach((y) => { const r = box(p, L, 0.05, 0.04, RM.greenD, (ax + bx) / 2, y, (az + bz) / 2); r.rotation.y = ang; });
  for (let i = 0; i < n * 8; i++) { const t = (i + 0.5) / (n * 8); const r = box(p, 0.02, 1.6, 0.02, RM.greenD, ax + (bx - ax) * t, 1.0, az + (bz - az) * t); r.rotation.y = ang; }
}
function buildWorld(scene) {
  // the street: houses with their bins on the pavement
  [[-46, RM.cream, RM.shutB], [-40.5, RM.peach, RM.shutG], [-35, RM.wallW, RM.shutR], [-29.5, RM.wallY, RM.shutB], [-24, RM.cream, RM.shutG], [-18.5, RM.wallW, RM.shutB]].forEach(([h, w, s], i) => house(scene, h, -3, w, s, i % 3 === 2 ? RM.roofG : RM.roof));
  [[10, RM.wallW, RM.shutG], [17, RM.wallY, RM.shutB], [24, RM.peach, RM.shutB], [31, RM.cream, RM.shutR], [38, RM.wallW, RM.shutB]].forEach(([h, w, s], i) => house(scene, h, 15.5, w, s, i % 2 ? RM.roofG : RM.roof, YAW + PI));
  [-46, -41, -28, -18, -9].forEach((h) => { const [x, z] = Q(h, 9.9); lamp(scene, x, z, YAW - PI / 2); });
  { const [x, z] = Q(-6, 1); lamp(scene, x, z, YAW + PI / 2); }
  // the park across the street: trees, benches, a playground, flower beds
  [[-46, 18.5], [-41, 16.6], [-27, 19.5], [-22, 20.5], [-31, 21.5], [-48, 21], [-17, 20.5], [-8, 19.5], [-35, 23]].forEach(([h, d], i) => tree(scene, h, d, i % 3 ? 1.1 : 0.9));
  bench(scene, -28, 16.4, YAW); bench(scene, -14, 16.4, YAW);
  { const g = at(scene, -40, 21.5); rbox(g, 0.12, 2.2, 0.12, 0.03, RM.red, -1.2, 1.1, 0.5, 0.01); rbox(g, 0.12, 2.2, 0.12, 0.03, RM.red, -1.2, 1.1, -0.5, 0.01); rbox(g, 1.2, 0.08, 1.2, 0.02, RM.yel, -1.2, 2.2, 0, 0.01);
    const sl = rbox(g, 2.6, 0.08, 0.7, 0.03, RM.blue, 0.0, 1.15, 0, 0.01); sl.rotation.z = -0.75; for (let i = 0; i < 6; i++) box(g, 0.06, 0.06, 0.7, RM.dark, -1.5, 0.3 + i * 0.32, 0);
    [2.0, 4.4].forEach((x) => { rod(g, new V3(x - 0.9, 0, -0.6), new V3(x, 2.2, -0.6), 0.06, RM.green); rod(g, new V3(x + 0.9, 0, -0.6), new V3(x, 2.2, -0.6), 0.06, RM.green); }); rod(g, new V3(2.0, 2.2, -0.6), new V3(4.4, 2.2, -0.6), 0.06, RM.green);
    [2.8, 3.6].forEach((x) => { rod(g, new V3(x, 2.2, -0.6), new V3(x, 0.55, -0.6), 0.015, MT.black); rbox(g, 0.45, 0.06, 0.25, 0.02, RM.orange, x, 0.52, -0.6, 0.01); });
    rbox(g, 2.4, 0.12, 2.0, 0.05, RM.wood, -4.0, 0.06, 0, 0.02); rbox(g, 2.2, 0.06, 1.8, 0.05, std(0xf0d890, 0.95, 0), -4.0, 0.12, 0, 0.02); }
  [[-34, 18.6], [-20, 17.8]].forEach(([h, d]) => { const g = at(scene, h, d); rbox(g, 2.4, 0.3, 1.2, 0.3, RM.woodD, 0, 0.15, 0, 0.03); for (let i = 0; i < 9; i++) { const f = sph(g, 0.16, pick([RM.red, RM.yel, std(0xf07aa8, 0.6, 0), MT.white]), rnd(-1, 1), 0.38, rnd(-0.45, 0.45)); f.scale.y = 0.6; } });
  // roundabout with flowers
  { const [x, z] = Q(-3, 6); cylY(scene, 2.2, 0.25, RM.concrete, x, 0.12, z, 24); cylY(scene, 2.0, 0.3, RM.grass, x, 0.16, z, 24); for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2; const f = sph(scene, 0.22, pick([RM.red, RM.yel, std(0xf07aa8, 0.6, 0)]), x + Math.cos(a) * 1.4, 0.38, z + Math.sin(a) * 1.4); f.scale.y = 0.6; } tree(scene, -3, 6, 0.8); }
  // the recycling centre: fence, gate, the big hall, weighbridge hut, bale stacks, car park
  fenceRun(scene, [5, 3.1], [46, 3.1]); fenceRun(scene, [-12.5, 3.1], [-5.5, 3.1]); fenceRun(scene, [-12.5, 3.1], [-12.5, -36]);
  { const g = at(scene, -5.5, 3.1); rbox(g, 0.25, 2.2, 0.25, 0.03, RM.yel, 0, 1.1, 0, 0.01); const s = at(scene, 5, 3.1); rbox(s, 0.25, 2.2, 0.25, 0.03, RM.yel, 0, 1.1, 0, 0.01);
    const sg = at(scene, -10.5, 2.0); box(sg, 0.1, 2.4, 0.1, RM.greyD, -0.9, 1.2, 0); box(sg, 0.1, 2.4, 0.1, RM.greyD, 0.9, 1.2, 0); rbox(sg, 2.3, 1.0, 0.1, 0.05, RM.green, 0, 2.3, 0, 0.02); decal(sg, 'RECYCLAGE', 2.0, 0.5, '#ffffff', 0, 2.3, 0.06, null); }
  { const g = at(scene, 3, -31); const L = 30, D = 10, H = 8;
    rbox(g, L, 3, D, 0.05, RM.clad, 0, 1.5, 0, 0.02); rbox(g, L, H - 3, D, 0.05, RM.cladW, 0, 3 + (H - 3) / 2, 0, 0.02);
    for (let x = -L / 2 + 0.5; x < L / 2; x += 1.0) box(g, 0.06, H - 0.2, D + 0.04, x % 5 === 0 ? RM.greyL : RM.whiteD, x, H / 2, 0);
    ext(g, [[-D / 2 - 0.4, 0], [D / 2 + 0.4, 0], [0, 2.2]], 0.05, L + 0.6, RM.roofG, 0, H, 0, 0.04).rotation.y = PI / 2;
    [-9, 0, 9].forEach((x) => { rbox(g, 5, 5.4, 0.1, 0.03, RM.greyD, x, 2.7, D / 2 + 0.02, 0.01); for (let y = 0.3; y < 5.4; y += 0.3) box(g, 4.9, 0.03, 0.04, RM.dark, x, y, D / 2 + 0.08); rbox(g, 5.4, 0.25, 0.25, 0.04, RM.yel, x, 5.5, D / 2 + 0.1, 0.01); });
    decal(g, 'CENTRE DE TRI', 10, 1.3, '#1f7a3e', 0, 6.8, D / 2 + 0.06, '#ffffff');
    for (let x = -12; x <= 12; x += 6) box(g, 2.5, 0.06, 1.2, MT.glass, x, H + 1.0, 2.2).rotation.x = -0.42;
    rbox(g, 6, 3.2, 3, 0.05, RM.white, L / 2 - 3, 1.6, D / 2 + 1.6, 0.02); for (let x = L / 2 - 5.4; x < L / 2 - 0.5; x += 1.2) box(g, 0.9, 0.9, 0.06, MT.glassD, x, 2.0, D / 2 + 3.12); }
  { const g = at(scene, -6, -3); rbox(g, 2.6, 2.4, 2.0, 0.05, RM.white, 0, 1.2, 0, 0.02); rbox(g, 3.0, 0.15, 2.4, 0.04, RM.green, 0, 2.47, 0, 0.01); box(g, 1.6, 0.8, 0.06, MT.glassD, 0, 1.5, 1.02); rbox(g, 0.12, 0.12, 0.12, 0.03, MT.amber, 0, 2.6, 0, 0.01); }
  baleRow(scene, -8, -23, YAW, 7, ['paper', 'plastic']); baleRow(scene, 1.5, -23, YAW, 5, ['can', 'paper']); baleRow(scene, 38.5, -19, YAW, 4, ['plastic'], 3); baleRow(scene, 41, -9, YAW, 4, ['paper', 'plastic']);
  for (let h = 3; h <= 15; h += 3) { const c = miniCar(scene, pick(['car', 'kei', 'van', 'car'])); const [x, z] = Q(h, -2); c.position.set(x, 0, z); c.rotation.y = YAW + PI / 2 + (Math.random() < 0.5 ? PI : 0); }
  // the garden-waste platform: compost windrows
  [[-36, -28.5], [-27, -29], [-18.5, -28]].forEach(([h, d]) => { const g = at(scene, h, d); const m = add(g, new THREE.SphereGeometry(1, 18, 8, 0, PI * 2, 0, PI / 2), RM.soil, 0, 0, 0); m.scale.set(4, 1.5, 1.5); });
  [[-22, -16], [-40, -22]].forEach(([h, d]) => { const g = at(scene, h, d); const m = add(g, new THREE.ConeGeometry(1.5, 1.4, 12).translate(0, 0.7, 0), RM.chips, 0, 0, 0); m.scale.set(1.2, 1, 1.2); });
  // trees around
  [[-50, -14], [-46, -36], [-12, -40], [20, -40], [44, -26], [48, -8], [46, 14], [-4, 16], [36, 26], [-24, 25]].forEach(([h, d], i) => { const [x, z] = Q(h, d); if (Math.hypot(x, z) < 50) tree(scene, h, d, i % 2 ? 1.3 : 1.1); });
  for (let h = 8; h <= 44; h += 7) { const [x, z] = Q(h, 9.9); lamp(scene, x, z, YAW - PI / 2); }
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const R = (pts, t = 0.15) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // cars on the avenue, round the roundabout
  const road = R([[0.5, 7.4], [44, 7.4], [46.5, 6], [44, 4.6], [0.5, 4.6], [-1.5, 3.2], [-4.5, 3.0], [-6.4, 6], [-4.5, 9.0], [-1.5, 8.8]], 0.2);
  const cars = ['car', 'van', 'kei', 'car', 'van'].map((k, i) => miniCar(scene, k, i === 1 ? 0xf4f5f8 : undefined));
  const t1 = traffic(road, cars, 3.6, { gap: 3.4 });
  // neighbours walking along the street and through the park, kids playing
  const walk = R([[-48, 2.9], [-8, 2.9], [-6.5, 10], [-8, 17.5], [-48, 17.5], [-46.5, 10]], 0.1);
  const folks = Array.from({ length: 7 }, (_, i) => walker(scene, 0, 0, { kid: i % 3 === 1 }));
  const t2 = traffic(walk, folks, 1.0, { gap: 1.2 });
  const play = R([[-44, 19.5], [-36, 19.5], [-36, 23], [-44, 23]], 0.4);
  const kids = Array.from({ length: 3 }, () => walker(scene, 0, 0, { kid: true }));
  const t3 = traffic(play, kids, 1.3, { gap: 1.0 });
  // workers in hi-vis crossing the yard
  const yard = R([[-6, -19.5], [22, -19.5], [22, -18], [-6, -18]], 0.1);
  const crew = Array.from({ length: 4 }, () => walker(scene, 0, 0, { vest: true, hat: MT.hat }));
  const t4 = traffic(yard, crew, 1.1, { gap: 1.2 });
  const all = [...cars];
  onUpdate((dt) => { t1.update(dt, all); t2.update(dt, folks); t3.update(dt, kids); t4.update(dt, crew); });
}
