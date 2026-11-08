// Ambient life: things that move on their own (traffic, people walking), so a world feels lived-in.
import * as THREE from 'three';
import { V3, rnd, pick } from './util.js';
import { MT, std, grp, rbox, cylZ, cylY, sph, box, add, shadows } from './geo.js';

/** A smooth path through [x, z] (or [x, z, y]) points. Returns { curve, len }. */
export function route(pts, closed = true, tension = 0.3) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z, y = 0]) => new V3(x, y, z)), closed, 'catmullrom', tension);
  return { curve, len: curve.getLength(), closed };
}

const tmpP = new V3(), tmpT = new V3();
/** Put `obj` at distance s along route r, its local +x pointing forward. */
export function placeOn(obj, r, s, yOff = 0) {
  let u = s / r.len;
  u = r.closed ? ((u % 1) + 1) % 1 : Math.min(1, Math.max(0, u));
  r.curve.getPointAt(u, tmpP); r.curve.getTangentAt(u, tmpT);
  obj.position.set(tmpP.x, tmpP.y + yOff, tmpP.z);
  obj.rotation.y = Math.atan2(-tmpT.z, tmpT.x);
}

/* ---------- people ---------- */
const SKIN = [0xf2c8a0, 0xd9a47a, 0xb07a52, 0xf6d8bc, 0x8a5a3a];
const HAIR = [0x2a1d18, 0x4a3022, 0x8a5a2a, 0xd8b060, 0x1b1b22];
const TOPS = [0xe5452c, 0x2f7de0, 0xf2b21c, 0x3aa46a, 0xa45ad8, 0xf07aa8, 0x24b6c8, 0xffffff];
const BOTS = [0x2a3550, 0x3a3a48, 0x5a4a3a, 0x24305a, 0x6a6a7a];
const mcache = new Map();
const m = (hex) => { if (!mcache.has(hex)) mcache.set(hex, std(hex, 0.75, 0)); return mcache.get(hex); };

/**
 * A little round-headed person facing +x (~1.25 tall). opts: { top, bottom, skin, hair, hat (material), vest (bool), kid (bool) }.
 * Returns the group with userData.walk(phase) to swing the legs and arms.
 */
export function person(parent, x = 0, z = 0, opts = {}) {
  const g = grp(parent, x, 0, z);
  const top = m(opts.top ?? pick(TOPS)), bot = m(opts.bottom ?? pick(BOTS)), skin = m(opts.skin ?? pick(SKIN));
  const legs = [0.08, -0.08].map((s) => { const l = grp(g, 0, 0.5, s); rbox(l, 0.14, 0.46, 0.14, 0.06, bot, 0, -0.23, 0); rbox(l, 0.2, 0.08, 0.14, 0.04, MT.black, 0.03, -0.46, 0); return l; });
  rbox(g, 0.24, 0.44, 0.36, 0.11, opts.vest ? MT.vest : top, 0, 0.72, 0);
  if (opts.vest) { rbox(g, 0.25, 0.04, 0.37, 0.02, MT.refl, 0, 0.66, 0); rbox(g, 0.25, 0.04, 0.37, 0.02, MT.refl, 0, 0.8, 0); }
  const arms = [0.22, -0.22].map((s) => { const a = grp(g, 0, 0.9, s); rbox(a, 0.11, 0.38, 0.11, 0.05, opts.vest ? MT.vest : top, 0, -0.18, 0); sph(a, 0.06, skin, 0, -0.38, 0); return a; });
  sph(g, 0.2, skin, 0, 1.12, 0);
  [0.07, -0.07].forEach((s) => sph(g, 0.025, MT.black, 0.18, 1.14, s));
  if (opts.hat) { add(g, new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), opts.hat, 0, 1.15, 0); cylY(g, 0.25, 0.025, opts.hat, 0.03, 1.15, 0, 16); }
  else { const h = add(g, new THREE.SphereGeometry(0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(opts.hair ?? pick(HAIR)), -0.02, 1.13, 0); h.rotation.z = 0.35; }
  if (opts.kid) g.scale.setScalar(0.72);
  g.userData.walk = (ph) => { const s = Math.sin(ph); legs[0].rotation.z = s * 0.5; legs[1].rotation.z = -s * 0.5; arms[0].rotation.z = -s * 0.45; arms[1].rotation.z = s * 0.45; };
  g.userData.arms = arms; shadows(g); return g;
}

/* ---------- small vehicles for traffic ---------- */
const CAR_COLS = [0xe5452c, 0x2f7de0, 0xf2f2f6, 0xf2b21c, 0x3aa46a, 0x1b1d24, 0xf07aa8, 0x8fd0ff];
/** A chubby little car facing +x (~2.6 long). kind: 'car' | 'van' | 'kei' | 'taxi' */
export function miniCar(parent, kind = 'car', color) {
  if (kind === 'truck') return miniTruck(parent, color);
  const g = grp(parent); const body = m(color ?? pick(CAR_COLS));
  const L = kind === 'van' ? 3.0 : kind === 'kei' ? 2.2 : 2.6, H = kind === 'van' || kind === 'kei' ? 1.15 : 0.82;
  rbox(g, L, 0.5, 1.2, 0.2, body, 0, 0.5, 0);
  if (kind === 'car' || kind === 'taxi') { rbox(g, L * 0.55, 0.5, 1.08, 0.18, body, -0.12, 0.98, 0); box(g, L * 0.5, 0.36, 1.1, MT.glassD, -0.12, 0.98, 0); }
  else { rbox(g, L * 0.8, H - 0.3, 1.14, 0.18, body, -L * 0.08, 0.72 + (H - 0.3) / 2, 0); box(g, 0.04, 0.32, 0.98, MT.glassD, L * 0.33 - 0.02, 1.0, 0); box(g, L * 0.55, 0.3, 1.16, MT.glassD, -L * 0.1, 1.05, 0); }
  if (kind === 'taxi') rbox(g, 0.4, 0.14, 0.24, 0.05, m(0xffd23f), -0.12, 1.3, 0);
  [0.35, -0.35].forEach((zz) => { rbox(g, 0.05, 0.1, 0.2, 0.03, MT.lamp, L / 2, 0.58, zz, 0.01); rbox(g, 0.05, 0.1, 0.18, 0.03, MT.tail, -L / 2, 0.6, zz, 0.01); });
  const wheels = [];
  [L * 0.32, -L * 0.32].forEach((xx) => [0.56, -0.56].forEach((zz) => { const w = cylZ(g, 0.24, 0.16, MT.rubber, xx, 0.26, zz, 14); cylZ(g, 0.11, 0.17, MT.chrome, xx, 0.26, zz, 10); wheels.push(w); }));
  g.userData.wheels = wheels; shadows(g); return g;
}

/** A little tipper truck facing +x (~4.2 long). */
function miniTruck(parent, color) {
  const g = grp(parent); const cab = m(color ?? pick([0x2f7de0, 0xe5452c, 0xf2f2f6, 0x3aa46a]));
  rbox(g, 4.0, 0.25, 0.9, 0.05, MT.black, -0.1, 0.62, 0);
  rbox(g, 1.3, 1.4, 1.5, 0.22, cab, 1.35, 1.35, 0); box(g, 0.04, 0.6, 1.3, MT.glassD, 2.0, 1.6, 0); box(g, 0.7, 0.5, 1.52, MT.glassD, 1.5, 1.62, 0);
  rbox(g, 2.5, 1.0, 1.6, 0.1, MT.orange, -0.75, 1.25, 0); rbox(g, 2.3, 0.3, 1.4, 0.1, m(0xa86a44), -0.75, 1.72, 0);
  [0.45, -0.45].forEach((zz) => { rbox(g, 0.05, 0.12, 0.2, 0.03, MT.lamp, 2.0, 0.85, zz, 0.01); rbox(g, 0.05, 0.12, 0.2, 0.03, MT.tail, -2.02, 0.85, zz, 0.01); });
  const wheels = [];
  [1.35, -0.4, -1.3].forEach((xx) => [0.62, -0.62].forEach((zz) => { const w = cylZ(g, 0.36, 0.26, MT.rubber, xx, 0.36, zz, 14); cylZ(g, 0.17, 0.27, MT.grey, xx, 0.36, zz, 10); wheels.push(w); }));
  g.userData.wheels = wheels; shadows(g); return g;
}

/**
 * Ambient traffic on a closed route: n objects evenly spaced, each slowing down for
 * anything in front of it (other ambient things, or obstacles from `blockers()`).
 * Returns { items, update(dt) }.
 */
export function traffic(r, objs, speed = 3, opts = {}) {
  const items = objs.map((o, i) => ({ o, s: (r.len / objs.length) * i + (opts.offset || 0), v: speed, max: speed * rnd(0.9, 1.1) }));
  const fwd = new V3(), d = new V3();
  return {
    items,
    update(dt, others = []) {
      items.forEach((it) => {
        placeOn(it.o, r, it.s, opts.y || 0);
        fwd.set(Math.cos(it.o.rotation.y), 0, -Math.sin(it.o.rotation.y));
        let blocked = false;
        const look = opts.gap || 3.4;
        for (const ob of others) {
          if (ob === it.o) continue;
          d.subVectors(ob.position ? ob.position : ob, it.o.position); d.y = 0;
          const dist = d.length(); if (dist > look || dist < 0.01) continue;
          const ahead = d.dot(fwd) / dist;
          if (ahead > 0.55) { // the other one is in front of us; on a tie, the lower id goes first
            const back = ob.userData && ob.userData.fwd ? -d.dot(ob.userData.fwd) / dist : -1;
            if (!(back > 0.55 && it.o.id < ob.id)) { blocked = true; break; }
          }
        }
        it.o.userData.fwd = it.o.userData.fwd || new V3(); it.o.userData.fwd.copy(fwd);
        const target = blocked ? 0 : it.max;
        it.v += (target - it.v) * Math.min(1, dt * (blocked ? 6 : 1.5));
        it.s += it.v * dt;
        const wh = it.o.userData.wheels; if (wh) wh.forEach((w) => (w.rotation.z -= (it.v * dt) / (w.userData.r || 0.24)));
        if (it.o.userData.walk) { it.ph = (it.ph || rnd(0, 6)) + it.v * dt * 5.5; it.o.userData.walk(it.ph); }
      });
    }
  };
}
