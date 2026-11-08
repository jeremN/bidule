// Rail vehicles built in code for the railway world. Every vehicle faces +x, y = 0 is the top of the rails,
// the wheels run on z = ±GA. Still details are baked into a few meshes; moving parts stay separate.
import * as THREE from 'three';
import { V3, clamp } from './util.js';
import { MT, std, toonMat, grp, add, box, rbox, cylX, cylY, cylZ, rod, rail, sph, ext, freeze, shadows } from './geo.js';
import { decal } from './aircraft.js';
import { person, miniCar } from './life.js';
import { operator } from './parts.js';

export const RT = 0.62, GA = 0.75;
export const RM = {
  white: std(0xf1f3f7, 0.3, 0.15), grey: std(0xc3c7cf, 0.4, 0.3), greyD: std(0x5a5f6c, 0.5, 0.3), anth: std(0x343844, 0.45, 0.3),
  carm: std(0xa8183c, 0.38, 0.15), frame: std(0x26292f, 0.6, 0.3), wheel: std(0x3f424a, 0.4, 0.7), tyre: std(0xb5bbc5, 0.25, 0.9),
  insul: std(0x8a4a32, 0.35, 0.1), panto: std(0x9aa0aa, 0.35, 0.7), copper: std(0xc07a3a, 0.35, 0.8), spring: std(0x6a6f7a, 0.4, 0.6),
  blueT: std(0x1f4fa8, 0.35, 0.15), skyT: std(0x4fb0e8, 0.35, 0.15),
  fretG: std(0x2f8a46, 0.4, 0.15), fretY: std(0xf2c21c, 0.4, 0.15), fretGr: std(0xcfd2d8, 0.4, 0.25),
  orange: std(0xe8622a, 0.4, 0.15), cream: std(0xe9e1cb, 0.6, 0.05), creamD: std(0xcfc5aa, 0.6, 0.05), brown: std(0x8a4a2e, 0.7, 0.05), brownD: std(0x6a3824, 0.7, 0.05),
  redD: std(0xb02a22, 0.45, 0.1), ctrRed: std(0xc8402a, 0.55, 0.1), ctrBlue: std(0x2f5fb0, 0.55, 0.1), ctrGreen: std(0x2f8a5a, 0.55, 0.1),
  tank: std(0xeef0f2, 0.35, 0.2), steamG: std(0x2e6b3a, 0.35, 0.15), black: std(0x1c1e24, 0.45, 0.4), brass: std(0xd6a640, 0.25, 0.9), redW: std(0xb8282a, 0.45, 0.2),
  yel: std(0xf6c419, 0.38, 0.15), yelD: std(0xd09a12, 0.45, 0.2), coal: std(0x16171b, 0.9, 0), wood: std(0x8a6a48, 0.85, 0),
  picRed: std(0xc8302a, 0.4, 0.1), picCream: std(0xf0e2c0, 0.5, 0.05),
  fire: toonMat({ color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 0.2 })
};
const bake = (g) => { shadows(g); freeze(g); return g; };

/** Squeeze an extruded body's width (z) as a function of x, y — tapers a train's nose in plan. */
export function taperZ(mesh, f) {
  const a = mesh.geometry.attributes.position;
  for (let i = 0; i < a.count; i++) a.setZ(i, a.getZ(i) * f(a.getX(i), a.getY(i)));
  a.needsUpdate = true; mesh.geometry.computeVertexNormals(); return mesh;
}
/** A cross-section (in the z/y plane) extruded along x over L — roofs, ballast, rounded tops. */
export function xsec(p, pts, r, L, m, x, y, z, bev) {
  const g = grp(p, x, y, z); g.rotation.y = Math.PI / 2; ext(g, pts, r, L, m, 0, 0, 0, bev == null ? 0.02 : bev); return g;
}
/** A flat plate lying on a slope of a side profile: from (x0,y0) to (x1,y1), pushed out by `off` along the normal. */
function slab(p, x0, y0, x1, y1, off, w, t, m, inset = 0.1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;
  const b = rbox(p, L - inset * 2, t, w, 0.03, m, (x0 + x1) / 2 + nx * off, (y0 + y1) / 2 + ny * off, 0, 0.01);
  b.rotation.z = Math.atan2(dy, dx); return b;
}

/* ---------------- running gear ---------------- */
/** One wheelset: axle + two flanged wheels with a rim ring and a marker bar (so you can see it turn). */
export function axle(p, x, R = 0.46, o = {}) {
  const g = grp(p, x, R, 0);
  cylZ(g, 0.075, GA * 2 + 0.25, RM.wheel, 0, 0, 0, 10);
  [1, -1].forEach((s) => {
    cylZ(g, R, 0.13, RM.tyre, 0, 0, s * GA, 24); cylZ(g, R * 0.84, 0.136, RM.wheel, 0, 0, s * GA, 22);
    cylZ(g, R * 1.08, 0.035, RM.wheel, 0, 0, s * (GA - 0.08), 24); cylZ(g, R * 0.28, 0.17, RM.frame, 0, 0, s * GA, 12);
    box(g, R * 1.5, 0.07, 0.02, RM.tyre, 0, 0, s * (GA + 0.072));
    if (o.disc) cylZ(g, R * 0.66, 0.06, RM.tyre, 0, 0, s * 0.34, 18);
  });
  freeze(g); g.userData.r = o.flip ? -R : R; return g;
}
/** A bogie: side frames, axle boxes, coil springs, dampers, and n wheelsets. Returns { g, axles }. */
export function bogie(p, x, o = {}) {
  const n = o.n || 2, sp = o.sp || 2.5, R = o.R || 0.46, g = grp(p, x, 0, 0), d = grp(g), F = o.frame || RM.frame;
  const len = sp * (n - 1) + 1.4, xs = Array.from({ length: n }, (_, i) => -sp * (n - 1) / 2 + i * sp);
  [1, -1].forEach((s) => {
    rbox(d, len, 0.3, 0.14, 0.1, F, 0, R + 0.1, s * 1.0, 0.02);
    rbox(d, len * 0.5, 0.18, 0.12, 0.06, F, 0, R + 0.32, s * 1.0, 0.02);
    xs.forEach((ax) => {
      rbox(d, 0.42, 0.32, 0.2, 0.06, F, ax, R, s * 1.04, 0.02); cylZ(d, 0.13, 0.08, RM.greyD, ax, R, s * 1.16, 12);
      for (let k = 0; k < 4; k++) cylY(d, 0.12, 0.05, RM.spring, ax + 0.0, R + 0.22 + k * 0.07, s * 0.98, 10);
    });
    rod(d, new V3(-0.35, R + 0.05, s * 1.12), new V3(0.25, R + 0.45, s * 1.12), 0.045, RM.greyD, 6);
    if (o.yel) rbox(d, 0.3, 0.12, 0.05, 0.02, MT.yel, len / 2 - 0.3, R + 0.15, s * 1.08, 0.01);
  });
  rbox(d, 0.5, 0.3, 2.0, 0.06, F, 0, R + 0.12, 0, 0.02);
  bake(d);
  const axles = xs.map((ax) => axle(g, ax, R, o));
  return { g, axles };
}
/** Buffers, hook and screw coupling at one end (e = ±1) of a vehicle whose end face is at x = e·X. */
export function buffers(p, X, e, o = {}) {
  [0.88, -0.88].forEach((z) => { cylX(p, 0.11, 0.34, RM.frame, e * (X + 0.17), 1.06, z, 10); cylX(p, 0.07, 0.1, MT.chrome, e * (X + 0.36), 1.06, z, 8); cylX(p, 0.22, 0.05, MT.chrome, e * (X + 0.42), 1.06, z, 16); });
  rbox(p, 0.3, 0.12, 0.14, 0.03, RM.frame, e * (X + 0.15), 1.0, 0, 0.01);
  add(p, new THREE.TorusGeometry(0.08, 0.025, 6, 10), RM.frame, e * (X + 0.32), 0.96, 0).rotation.x = Math.PI / 2;
  if (o.head) rbox(p, 0.16, 0.42, 2.8, 0.03, o.head, e * (X + 0.04), 1.06, 0, 0.01);
}
const lampPair = (p, x, y, z, m, w = 0.14) => [1, -1].forEach((s) => rbox(p, 0.05, w, w * 1.6, 0.03, m, x, y, s * z, 0.01));

/* ---------------- pantograph ---------------- */
/** Single-arm pantograph on its insulators. set(h): head top h above the group origin. */
export function pantograph(p, x, y, o = {}) {
  const g = grp(p, x, y, 0), d = grp(g), L = o.L || 1.2, k = o.k || 1;
  [[0.55, 0.5], [0.55, -0.5], [-0.55, 0.5], [-0.55, -0.5]].forEach(([a, b]) => { cylY(d, 0.06, 0.3, RM.insul, a * k, 0.15, b * k, 8); [0.07, 0.15, 0.23].forEach((yy) => cylY(d, 0.1, 0.025, RM.insul, a * k, yy, b * k, 10)); });
  rbox(d, 1.35 * k, 0.07, 1.2 * k, 0.03, RM.greyD, 0, 0.33, 0, 0.01);
  cylX(d, 0.07, 0.6, RM.greyD, 0.3, 0.42, 0.25, 8); // lifting cylinder
  bake(d);
  const AX = -0.55 * k, AY = 0.4;
  const lo = grp(g, AX, AY, 0); rod(lo, new V3(0, 0, 0.4 * k), new V3(L, 0, 0.04), 0.035, RM.panto, 6); rod(lo, new V3(0, 0, -0.4 * k), new V3(L, 0, -0.04), 0.035, RM.panto, 6); cylZ(lo, 0.06, 0.85 * k, RM.greyD, 0, 0, 0, 8); cylZ(lo, 0.05, 0.14, RM.greyD, L, 0, 0, 8);
  const up = grp(g); rod(up, new V3(0, 0, 0), new V3(L, 0, 0), 0.026, RM.panto, 6); rod(up, new V3(0.2, -0.04, 0), new V3(L * 0.8, 0.02, 0), 0.012, RM.panto, 4);
  const head = grp(g); const HW = o.w || 1.75;
  [0.1, -0.1].forEach((xx) => { rbox(head, 0.06, 0.05, HW * 0.8, 0.02, RM.copper, xx, 0.07, 0, 0.01); rbox(head, 0.08, 0.04, HW * 0.8, 0.02, RM.greyD, xx, 0.03, 0, 0.01); });
  [1, -1].forEach((s) => { rod(head, new V3(0, 0.06, s * HW * 0.4), new V3(0, -0.12, s * HW * 0.52), 0.02, RM.panto, 4); rod(head, new V3(0, 0.0, s * 0.1), new V3(0, 0.0, -s * 0.1), 0.015, RM.panto, 4); });
  rod(head, new V3(0, -0.02, 0.3), new V3(0, -0.02, -0.3), 0.02, RM.panto, 4);
  const HH = 0.1;
  const set = (h) => {
    const a = Math.asin(clamp((h - AY - HH) / (2 * L), 0.015, 0.98));
    lo.rotation.z = a; up.position.set(AX + L * Math.cos(a), AY + L * Math.sin(a), 0); up.rotation.z = Math.PI - a;
    head.position.set(AX, AY + 2 * L * Math.sin(a), 0);
  };
  set(0); g.userData.set = set; g.userData.min = AY + HH + 0.05; g.userData.head = head;
  return g;
}

/* ---------------- TGV ---------------- */
const tgvTap = (x) => (x > 1.2 ? 1 - 0.34 * Math.pow(Math.min(1, (x - 1.2) / 4.8), 1.6) : 1);
/** TGV power car, nose at +x (≈12.2 long). Returns { g, axles, panto }. */
export function tgvPower(p, x, flip) {
  const g = grp(p, x, 0, 0); if (flip) g.rotation.y = Math.PI;
  const d = grp(g);
  const P = [[-5.9, 1.0], [3.4, 1.0], [5.0, 1.08], [5.75, 1.3], [5.8, 1.6], [5.2, 2.1], [3.9, 2.85], [2.4, 3.5], [1.0, 3.72], [-5.9, 3.72]];
  taperZ(ext(d, P, [0.05, 0.4, 0.5, 0.25, 0.35, 0.5, 0.7, 0.8, 0.6, 0.05], 2.9, RM.white, 0, 0, 0, 0.2), (xx) => tgvTap(xx));
  const zs = (xx) => 1.45 * tgvTap(xx) + 0.006;
  // windscreen with its dark surround, wipers
  slab(d, 3.95, 2.83, 2.35, 3.53, 0.2, 2.5, 0.03, RM.anth, 0.0); slab(d, 3.85, 2.88, 2.45, 3.48, 0.235, 2.1, 0.03, MT.glassD, 0.08);
  [0.45, -0.45].forEach((z) => { const w = rod(d, new V3(3.7, 3.08, z), new V3(3.2, 3.38, z + 0.25), 0.012, RM.frame, 4); void w; });
  // lower nose: headlights, a carmillon lip, the coupler hatch, snowplough
  [0.58, -0.58].forEach((z) => { const l = slab(d, 5.75, 1.68, 5.3, 2.05, 0.21, 0.36, 0.03, MT.lamp, 0.05); l.position.z = z; });
  rbox(d, 0.12, 0.26, 1.35, 0.08, RM.carm, 5.95, 1.42, 0, 0.02);
  rbox(d, 0.06, 0.08, 0.9, 0.03, RM.anth, 6.0, 1.15, 0, 0.01);
  ext(d, [[4.7, 0.25], [5.95, 0.4], [5.95, 0.85], [4.7, 0.85]], 0.1, 2.0, RM.anth, 0, 0, 0, 0.04);
  // sides: anthracite skirt band, carmillon stripe, cab door and window, cooling grilles, name
  [1, -1].forEach((s) => {
    box(d, 7.0, 0.36, 0.02, RM.anth, -2.3, 1.0, s * 1.456); box(d, 7.0, 0.1, 0.02, RM.carm, -2.3, 1.3, s * 1.456);
    rbox(d, 0.95, 0.5, 0.03, 0.08, MT.glassD, 2.0, 2.85, s * zs(2.0), 0.01);
    [[0.6, 1.9], [1.45, 1.9]].forEach(([xx, h]) => box(d, 0.025, h, 0.02, RM.greyD, xx, 2.1, s * 1.457)); box(d, 0.85, 0.025, 0.02, RM.greyD, 1.02, 3.05, s * 1.457);
    rod(d, new V3(0.5, 1.3, s * 1.5), new V3(0.5, 2.6, s * 1.5), 0.02, MT.chrome, 6); rbox(d, 0.12, 0.03, 0.04, 0.01, MT.chrome, 1.3, 2.05, s * 1.47, 0.005);
    [0.55, 0.85].forEach((yy) => rbox(d, 0.6, 0.05, 0.28, 0.02, RM.frame, 1.0, yy, s * 1.32, 0.01));
    for (let i = 0; i < 3; i++) {
      const gx = -4.8 + i * 1.6; rbox(d, 1.4, 1.0, 0.025, 0.05, RM.grey, gx, 2.85, s * 1.456, 0.01);
      for (let k = 0; k < 7; k++) box(d, 1.3, 0.04, 0.03, RM.greyD, gx, 2.43 + k * 0.14, s * 1.462);
    }
    rbox(d, 2.8, 0.3, 0.05, 0.03, RM.anth, -1.0, 0.55, s * 1.3, 0.01); // equipment skirt
    const t = decal(d, 'TGV', 1.6, 0.5, '#a8183c', -2.5, 1.85, s * 1.47); if (s < 0) t.rotation.y = Math.PI;
  });
  // roof: fairing, insulators and busbar, horn
  rbox(d, 4.4, 0.08, 1.9, 0.04, RM.grey, -3.4, 3.93, 0, 0.02);
  rod(d, new V3(-2.6, 4.1, 0.25), new V3(1.2, 4.1, 0.25), 0.03, MT.chrome, 6); [-1.6, 0.4].forEach((xx) => cylY(d, 0.06, 0.18, RM.insul, xx, 4.0, 0.25, 8));
  cylX(d, 0.07, 0.25, MT.chrome, 0.6, 3.82, -0.4, 8);
  // rear end: a dark gangway frame
  rbox(d, 0.12, 2.7, 2.2, 0.1, RM.anth, -6.1, 2.4, 0, 0.02);
  bake(d);
  const b1 = bogie(g, 3.0, { disc: true, sp: 2.5, flip }), b2 = bogie(g, -3.4, { disc: true, sp: 2.5, flip });
  const panto = pantograph(g, -3.4, 3.92);
  return { g, axles: [...b1.axles, ...b2.axles], panto };
}
/** TGV Duplex trailer (two decks), 9.9 long. o.door = ±1 (which end has the doors), o.cls = '1' | '2'. Returns { g, doors }. */
export function tgvTrailer(p, x, o = {}) {
  const g = grp(p, x, 0, 0), d = grp(g), e = o.door || 1;
  const P = [[-4.75, 1.18], [-3.75, 1.18], [-3.4, 0.68], [3.4, 0.68], [3.75, 1.18], [4.75, 1.18], [4.75, 4.05], [-4.75, 4.05]];
  ext(d, P, [0.02, 0.15, 0.15, 0.15, 0.15, 0.02, 0.05, 0.05], 2.9, RM.white, 0, 0, 0, 0.22);
  [1, -1].forEach((s) => {
    const z = s * 1.456;
    [-2.6, -0.87, 0.87, 2.6].forEach((xx) => { if (Math.abs(xx - e * 4.15) < 1.2) return; rbox(d, 1.4, 0.55, 0.03, 0.1, MT.glassD, xx, 1.38, z, 0.01); rbox(d, 1.4, 0.62, 0.03, 0.1, MT.glassD, xx, 3.0, z, 0.01); });
    rbox(d, 0.8, 0.55, 0.03, 0.1, MT.glassD, -e * 4.0, 3.0, z, 0.01);
    box(d, 9.4, 0.1, 0.02, RM.carm, 0, 2.2, z); box(d, 6.6, 0.3, 0.02, RM.anth, 0, 0.62, z);
    rbox(d, 1.0, 2.0, 0.02, 0.08, RM.anth, e * 4.15, 2.12, z, 0.01); // door opening
    const n = decal(d, o.cls || '2', 0.4, 0.5, '#a8183c', e * 3.2, 3.62, s * 1.47); if (s < 0) n.rotation.y = Math.PI;
  });
  rbox(d, 2.4, 0.26, 1.5, 0.08, RM.grey, -e * 1.5, 4.36, 0, 0.02);
  bake(d);
  const doors = [1, -1].map((s) => { const dg = grp(g, e * 4.15, 0, s * 1.48); rbox(dg, 0.86, 1.9, 0.04, 0.06, RM.white, 0, 2.12, 0, 0.01); rbox(dg, 0.5, 0.5, 0.045, 0.06, MT.glassD, 0, 2.6, 0, 0.01); box(dg, 0.86, 0.08, 0.05, RM.carm, 0, 1.3, 0); return dg; });
  return { g, doors };
}
/** A whole TGV: two power cars and two Duplex trailers, ≈44 long, centred on x = 0. */
export function tgv(p) {
  const g = grp(p);
  const A = tgvPower(g, 16.25), B = tgvPower(g, -16.25, true);
  const T1 = tgvTrailer(g, 5.0, { door: 1, cls: '1' }), T2 = tgvTrailer(g, -5.0, { door: -1, cls: '2' });
  const jb = [9.1, 0, -9.1].map((xx) => bogie(g, xx, { disc: true, sp: 2.5 }));
  const d = grp(g); [10.05, 0, -10.05].forEach((xx) => rbox(d, 0.4, 3.0, 2.3, 0.1, RM.anth, xx, 2.5, 0, 0.02)); bake(d);
  const cars = [{ o: A.g, x: 16.25, half: 6.15 }, { o: T1.g, x: 5, half: 5 }, { o: T2.g, x: -5, half: 5 }, { o: B.g, x: -16.25, half: 6.15 }];
  return { g, axles: [...A.axles, ...B.axles, ...jb.flatMap((b) => b.axles)], panto: A.panto, pantoB: B.panto, doors: [...T1.doors, ...T2.doors], cars, T1, T2 };
}

/* ---------------- TER (regional train) ---------------- */
const terTap = (x) => (x > 2.6 ? 1 - 0.2 * Math.pow(Math.min(1, (x - 2.6) / 2.6), 1.5) : 1);
/** One TER car, nose at +x (≈10.3 long). Returns { g, axles, doors }. */
export function terCar(p, x, flip) {
  const g = grp(p, x, 0, 0); if (flip) g.rotation.y = Math.PI;
  const d = grp(g);
  const P = [[-4.85, 1.17], [3.3, 1.17], [4.5, 1.22], [4.95, 1.5], [5.0, 2.35], [4.7, 3.1], [3.9, 3.6], [-4.85, 3.6]];
  taperZ(ext(d, P, [0.03, 0.3, 0.35, 0.25, 0.4, 0.55, 0.5, 0.03], 2.9, RM.white, 0, 0, 0, 0.22), (xx) => terTap(xx));
  slab(d, 5.02, 2.3, 4.68, 3.15, 0.2, 2.35, 0.03, RM.anth, 0.0); slab(d, 4.98, 2.38, 4.72, 3.07, 0.235, 2.0, 0.03, MT.glassD, 0.05);
  rbox(d, 0.06, 0.45, 2.0, 0.05, RM.anth, 5.2, 2.05, 0, 0.01);
  rbox(d, 0.08, 0.5, 2.2, 0.1, RM.blueT, 5.18, 1.32, 0, 0.02);
  lampPair(d, 5.23, 1.78, 0.72, MT.lamp, 0.14); lampPair(d, 5.23, 1.78, 0.98, MT.tail, 0.09);
  rod(d, new V3(5.1, 2.5, 0.3), new V3(4.85, 2.9, 0.55), 0.012, RM.frame, 4);
  ext(d, [[4.1, 0.35], [5.15, 0.5], [5.15, 0.98], [4.1, 0.98]], 0.1, 2.1, RM.anth, 0, 0, 0, 0.04);
  [1, -1].forEach((s) => {
    const z = s * 1.456;
    box(d, 8.3, 0.55, 0.02, RM.blueT, -0.6, 1.28, z); box(d, 8.3, 0.09, 0.02, RM.skyT, -0.6, 1.66, z);
    box(d, 7.0, 0.88, 0.02, MT.glassD, -1.0, 2.5, z);
    for (let xx = -4.3; xx <= 2.4; xx += 1.35) box(d, 0.14, 0.9, 0.025, RM.white, xx, 2.5, s * 1.459);
    rbox(d, 0.75, 0.75, 0.03, 0.1, MT.glassD, 3.55, 2.55, s * 1.42, 0.01);
    rbox(d, 1.42, 2.15, 0.02, 0.06, RM.anth, -1.6, 2.22, z, 0.01);
    const t = decal(d, 'TER', 0.9, 0.38, '#ffffff', -3.8, 1.28, s * 1.47); if (s < 0) t.rotation.y = Math.PI;
  });
  rbox(d, 2.6, 0.32, 1.7, 0.08, RM.grey, -2.2, 3.95, 0, 0.02); rbox(d, 1.6, 0.25, 1.4, 0.08, RM.greyD, 1.3, 3.92, 0, 0.02);
  rbox(d, 0.12, 2.4, 2.2, 0.1, RM.anth, -5.0, 2.3, 0, 0.02);
  bake(d);
  const b = bogie(g, 2.9, { disc: true, sp: 2.3, flip });
  const doors = [1, -1].flatMap((s) => [1, -1].map((k) => { const dg = grp(g, -1.6 + k * 0.34, 0, s * 1.48); rbox(dg, 0.66, 2.0, 0.04, 0.05, RM.skyT, 0, 2.2, 0, 0.01); rbox(dg, 0.42, 0.9, 0.045, 0.05, MT.glassD, 0, 2.55, 0, 0.01); dg.userData.k = k; return dg; }));
  return { g, axles: b.axles, doors };
}
/** Two-car TER (≈20.6 long) centred on x = 0. */
export function ter(p) {
  const g = grp(p), A = terCar(g, 5.15), B = terCar(g, -5.15, true), J = bogie(g, 0, { disc: true, sp: 2.3 });
  const d = grp(g); rbox(d, 0.4, 2.6, 2.3, 0.1, RM.anth, 0, 2.3, 0, 0.02); bake(d);
  return { g, axles: [...A.axles, ...B.axles, ...J.axles], doors: [...A.doors, ...B.doors], cars: [{ o: A.g, x: 5.15, half: 5.3 }, { o: B.g, x: -5.15, half: 5.3 }] };
}

/* ---------------- freight ---------------- */
/** Diesel freight locomotive (grey and green, six axles), 11.7 long. Returns { g, axles, exhaust }. */
export function fretLoco(p) {
  const g = grp(p), d = grp(g);
  const P = [[-5.8, 1.15], [5.8, 1.15], [5.85, 2.45], [5.35, 3.35], [4.7, 3.92], [-4.7, 3.92], [-5.35, 3.35], [-5.85, 2.45]];
  taperZ(ext(d, P, [0.04, 0.04, 0.2, 0.35, 0.3, 0.3, 0.35, 0.2], 2.9, RM.fretGr, 0, 0, 0, 0.15), (xx) => (Math.abs(xx) > 4.6 ? 1 - 0.07 * Math.min(1, (Math.abs(xx) - 4.6) / 1.4) : 1));
  [1, -1].forEach((e) => {
    // cab front: yellow nose, split windscreen, lights
    rbox(d, 0.08, 1.15, 2.5, 0.1, RM.fretY, e * 6.0, 1.85, 0, 0.02);
    [0.52, -0.52].forEach((z) => { const w = e > 0 ? slab(d, 5.95, 2.45, 5.45, 3.35, 0.16, 0.92, 0.03, MT.glassD, 0.08) : slab(d, -5.45, 3.35, -5.95, 2.45, 0.16, 0.92, 0.03, MT.glassD, 0.08); w.position.z = z; });
    lampPair(d, e * 6.05, 1.85, 0.85, e > 0 ? MT.lamp : MT.tail, 0.15); lampPair(d, e * 6.05, 1.85, 1.12, e > 0 ? MT.tail : MT.lamp, 0.08);
    rbox(d, 0.18, 0.12, 0.3, 0.04, MT.lamp, e * 5.15, 3.72, 0, 0.01);
    rod(d, new V3(e * 5.75, 2.6, 0.15), new V3(e * 5.55, 3.0, 0.45), 0.012, RM.frame, 4);
    // headstock with stripes, snowplough, buffers, coupling
    const hs = rbox(d, 0.2, 0.45, 2.9, 0.03, MT.stripes, e * 5.85, 1.0, 0, 0.01); void hs;
    ext(d, [[e * 5.2, 0.15], [e * 6.0, 0.2], [e * 6.0, 0.75], [e * 5.2, 0.75]], 0.05, 2.5, RM.frame, 0, 0, 0, 0.03);
    buffers(d, 5.95, e);
    [1, -1].forEach((s) => {
      rbox(d, 0.7, 1.75, 0.025, 0.06, RM.fretGr, e * 4.6, 2.35, s * 1.46, 0.01); box(d, 0.72, 0.025, 0.03, RM.greyD, e * 4.6, 3.24, s * 1.465);
      rbox(d, 0.5, 0.42, 0.03, 0.06, MT.glassD, e * 4.6, 2.85, s * 1.465, 0.01);
      rod(d, new V3(e * 4.15, 1.3, s * 1.5), new V3(e * 4.15, 2.9, s * 1.5), 0.02, MT.chrome, 6);
      [0.35, 0.7].forEach((yy) => rbox(d, 0.55, 0.05, 0.3, 0.02, RM.frame, e * 4.6, yy, s * 1.3, 0.01));
    });
  });
  [1, -1].forEach((s) => {
    const z = s * 1.452;
    box(d, 8.5, 1.05, 0.02, RM.fretG, 0, 1.72, z); box(d, 11.5, 0.12, 0.02, RM.fretY, 0, 1.18, z);
    for (let i = 0; i < 4; i++) { const gx = -2.85 + i * 1.9; rbox(d, 1.6, 0.85, 0.025, 0.05, RM.greyD, gx, 2.95, s * 1.455, 0.01); for (let k = 0; k < 6; k++) box(d, 1.5, 0.035, 0.03, RM.fretGr, gx, 2.6 + k * 0.14, s * 1.462); }
    const t = decal(d, 'FRET', 1.7, 0.55, '#ffffff', 0, 1.75, s * 1.47); if (s < 0) t.rotation.y = Math.PI;
    rod(d, new V3(-5.2, 1.2, s * 1.18), new V3(5.2, 1.2, s * 1.18), 0.03, RM.frame, 6);
  });
  // roof: fans, exhaust, horns, hatches
  [-2.2, 0.2].forEach((xx) => { cylY(d, 0.55, 0.12, RM.greyD, xx, 4.0, 0, 18); for (let k = 0; k < 4; k++) box(d, 1.0, 0.04, 0.05, RM.frame, xx, 4.08, -0.36 + k * 0.24); });
  rbox(d, 2.0, 0.12, 1.6, 0.05, RM.grey, 2.6, 3.98, 0, 0.02); cylY(d, 0.16, 0.35, RM.frame, 1.9, 4.15, 0.35, 10);
  [0.3, -0.3].forEach((z) => cylX(d, 0.06, 0.32, MT.chrome, 3.5, 4.0, z, 8));
  // under-frame: fuel tank, air reservoirs
  rbox(d, 2.3, 0.75, 2.4, 0.1, RM.frame, 0, 0.72, 0, 0.02); [0.9, -0.9].forEach((z) => cylX(d, 0.18, 2.0, RM.greyD, 0, 0.62, z * 1.25, 10));
  bake(d);
  const b1 = bogie(g, 3.4, { n: 3, sp: 1.75, R: 0.5 }), b2 = bogie(g, -3.4, { n: 3, sp: 1.75, R: 0.5 });
  const exhaust = new V3(1.9, 4.35, 0.35);
  return { g, axles: [...b1.axles, ...b2.axles], exhaust };
}
/** Common wagon under-frame: sole bars, headstocks, buffers, two bogies. Returns axles. */
function wagonBase(g, d, L, o = {}) {
  const F = o.frame || RM.frame, H = o.deck || 1.28;
  [1, -1].forEach((s) => rbox(d, L - 0.2, 0.34, 0.12, 0.03, F, 0, H - 0.12, s * 1.15, 0.01));
  for (let x = -L / 2 + 0.6; x < L / 2 - 0.4; x += 1.1) box(d, 0.1, 0.2, 2.3, F, x, H - 0.12, 0);
  [1, -1].forEach((e) => buffers(d, L / 2, e, { head: o.head || RM.redD }));
  const xb = L / 2 - 1.55;
  return [bogie(g, xb, { sp: 1.8, R: 0.42, yel: true }), bogie(g, -xb, { sp: 1.8, R: 0.42, yel: true })].flatMap((b) => b.axles);
}
export const WAGON_L = 7.6, PITCH = 7.6 + 0.89;
/** Flat wagon with two 20-foot containers. */
export function containerWagon(p, x, cols = [RM.ctrRed, RM.ctrBlue]) {
  const g = grp(p, x, 0, 0), d = grp(g), L = WAGON_L;
  const axles = wagonBase(g, d, L);
  [1.85, -1.85].forEach((cx, i) => {
    const m = cols[i % cols.length], y0 = 1.28;
    rbox(d, 3.5, 2.5, 2.42, 0.03, m, cx, y0 + 1.25, 0, 0.01);
    [1, -1].forEach((s) => { for (let k = -5; k <= 5; k++) box(d, 0.07, 2.3, 0.03, m, cx + k * 0.3, y0 + 1.25, s * 1.215); });
    [[1.72, 1.19], [1.72, -1.19], [-1.72, 1.19], [-1.72, -1.19]].forEach(([a, b]) => [0.06, 2.44].forEach((yy) => box(d, 0.14, 0.14, 0.14, RM.frame, cx + a, y0 + yy, b)));
    const ex = cx + Math.sign(cx) * 1.76; [-0.75, -0.3, 0.3, 0.75].forEach((z) => cylY(d, 0.025, 2.3, MT.chrome, ex + Math.sign(cx) * 0.02, y0 + 1.25, z, 6));
  });
  bake(d); return { g, axles };
}
/** Two-deck car-carrier wagon with little cars on it. */
export function carWagon(p, x, cols = [0xe5452c, 0x2f7de0, 0xf2f2f6, 0x3aa46a]) {
  const g = grp(p, x, 0, 0), d = grp(g), L = WAGON_L;
  const axles = wagonBase(g, d, L, { head: RM.greyD });
  rbox(d, L - 0.2, 0.1, 2.5, 0.02, RM.greyD, 0, 1.3, 0, 0.01); rbox(d, L - 0.2, 0.12, 2.5, 0.02, RM.greyD, 0, 3.05, 0, 0.01);
  [1, -1].forEach((s) => {
    for (let xx = -L / 2 + 0.2; xx <= L / 2 - 0.1; xx += (L - 0.4) / 6) box(d, 0.1, 3.4, 0.1, RM.greyD, xx, 2.95, s * 1.25);
    box(d, L - 0.2, 0.12, 0.12, RM.greyD, 0, 4.6, s * 1.25); box(d, L - 0.2, 0.08, 0.1, RM.greyD, 0, 3.6, s * 1.25);
    for (let i = 0; i < 6; i++) { const x0 = -L / 2 + 0.2 + i * (L - 0.4) / 6, x1 = x0 + (L - 0.4) / 6; rod(d, new V3(x0, 1.35, s * 1.25), new V3(x1, 3.0, s * 1.25), 0.03, RM.greyD, 4); rod(d, new V3(x0, 3.1, s * 1.25), new V3(x1, 4.55, s * 1.25), 0.03, RM.greyD, 4); }
  });
  [[1.8, 1.35], [-1.8, 1.35], [1.8, 3.11], [-1.8, 3.11]].forEach(([cx, cy], i) => { const c = miniCar(d, 'car', cols[i % cols.length]); c.position.set(cx, cy, 0); c.scale.setScalar(0.95); });
  bake(d); return { g, axles };
}
/** Covered hopper for grain, with three roof hatches (returned, they open). */
export function hopperWagon(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g), L = WAGON_L;
  const axles = wagonBase(g, d, L, { head: RM.greyD });
  ext(d, [[-3.3, 1.6], [3.3, 1.6], [3.72, 2.15], [3.72, 3.6], [-3.72, 3.6], [-3.72, 2.15]], 0.1, 2.85, RM.cream, 0, 0, 0, 0.05);
  ext(d, [[-1.3, 1.62], [1.3, 1.62], [0.4, 0.75], [-0.4, 0.75]], 0.05, 2.3, RM.creamD, 0, 0, 0, 0.03);
  rbox(d, 0.9, 0.15, 1.4, 0.03, RM.frame, 0, 0.72, 0, 0.01);
  xsec(d, [[-1.45, 0], [1.45, 0], [1.25, 0.32], [0, 0.48], [-1.25, 0.32]], 0.25, 7.4, RM.cream, 0, 3.58, 0, 0.03);
  [1, -1].forEach((s) => { for (let xx = -3.3; xx <= 3.3; xx += 0.83) box(d, 0.08, 1.95, 0.05, RM.creamD, xx, 2.6, s * 1.44); box(d, 7.4, 0.08, 0.05, RM.creamD, 0, 3.55, s * 1.44);
    const t = decal(d, 'CÉRÉALES', 3.2, 0.5, '#2f8a46', 0, 2.75, s * 1.475); if (s < 0) t.rotation.y = Math.PI; });
  rail(d, [[3.8, 1.4, -1.1], [3.8, 4.0, -1.1]], 0.025, RM.greyD); rail(d, [[3.8, 1.4, -0.7], [3.8, 4.0, -0.7]], 0.025, RM.greyD); for (let y = 1.6; y < 4; y += 0.3) rod(d, new V3(3.8, y, -1.1), new V3(3.8, y, -0.7), 0.018, RM.greyD, 4);
  box(d, 7.0, 0.04, 0.4, RM.greyD, 0, 4.08, -0.7);
  bake(d);
  const hatches = [-2.4, 0, 2.4].map((hx) => { const h = grp(g, hx, 4.08, 0.4); rbox(h, 1.5, 0.1, 0.75, 0.04, RM.creamD, 0, 0.05, -0.38, 0.01); box(h, 0.1, 0.06, 0.1, RM.frame, 0.6, 0.12, -0.7); return h; });
  return { g, axles, hatches, top: new V3(0, 4.1, 0) };
}
/** Covered goods van (brown, sliding doors). */
export function coveredWagon(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g), L = WAGON_L;
  const axles = wagonBase(g, d, L);
  rbox(d, L - 0.3, 2.6, 2.6, 0.05, RM.brown, 0, 2.6, 0, 0.02);
  xsec(d, [[-1.35, 0], [1.35, 0], [1.1, 0.25], [0, 0.38], [-1.1, 0.25]], 0.2, L - 0.1, RM.grey, 0, 3.88, 0, 0.03);
  [1, -1].forEach((s) => { for (let xx = -3.4; xx <= 3.4; xx += 0.68) box(d, 0.07, 2.5, 0.04, RM.brownD, xx, 2.6, s * 1.31); rbox(d, 2.0, 2.3, 0.05, 0.03, RM.brownD, 0, 2.5, s * 1.33, 0.01); box(d, 2.4, 0.06, 0.06, RM.frame, 0, 3.7, s * 1.36); box(d, 2.4, 0.06, 0.06, RM.frame, 0, 1.4, s * 1.36); });
  bake(d); return { g, axles };
}
/** Tank wagon (white, orange band). */
export function tankWagon(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g), L = WAGON_L;
  const axles = wagonBase(g, d, L);
  cylX(d, 1.25, L - 1.6, RM.tank, 0, 2.6, 0, 24); [1, -1].forEach((e) => { const c = sph(d, 1.25, RM.tank, e * (L / 2 - 0.8), 2.6, 0); c.scale.x = 0.45; });
  cylX(d, 1.27, 0.5, RM.orange, 0, 2.6, 0, 24); cylY(d, 0.35, 0.3, RM.tank, 0, 3.95, 0, 14); cylY(d, 0.4, 0.05, RM.greyD, 0, 4.1, 0, 14);
  [-2.3, 2.3].forEach((xx) => rbox(d, 0.3, 0.7, 2.2, 0.03, RM.frame, xx, 1.45, 0, 0.01));
  rail(d, [[-2.8, 4.4, 0.5], [2.8, 4.4, 0.5]], 0.025, RM.greyD); [-2.8, 0, 2.8].forEach((xx) => rod(d, new V3(xx, 3.75, 0.5), new V3(xx, 4.4, 0.5), 0.02, RM.greyD, 4));
  bake(d); return { g, axles };
}

/* ---------------- shunting locomotive ---------------- */
/** Small orange shunting loco with an off-centre cab and a walkway all around, 7.2 long. Returns { g, axles, exhaust }. */
export function shunter(p) {
  const g = grp(p), d = grp(g), O = RM.orange, L = 7.2;
  rbox(d, L, 0.32, 2.8, 0.04, O, 0, 1.38, 0, 0.02);
  [1, -1].forEach((s) => { rbox(d, L - 1.0, 0.55, 0.14, 0.04, RM.frame, 0, 0.95, s * 1.08, 0.02); [1.8, -1.8].forEach((ax) => { rbox(d, 0.45, 0.4, 0.2, 0.05, RM.frame, ax, 0.5, s * 1.1, 0.02); for (let k = 0; k < 3; k++) cylY(d, 0.12, 0.05, RM.spring, ax, 0.82 + k * 0.07, s * 1.1, 10); }); });
  // long hood with doors and louvres
  ext(d, [[-3.45, 1.52], [0.15, 1.52], [0.15, 2.95], [-3.25, 2.95], [-3.45, 2.7]], [0.03, 0.03, 0.1, 0.15, 0.1], 1.8, O, 0, 0, 0, 0.05);
  [1, -1].forEach((s) => { for (let i = 0; i < 3; i++) { rbox(d, 0.95, 1.1, 0.025, 0.04, RM.orange, -2.85 + i * 1.05, 2.2, s * 0.91, 0.01); box(d, 0.95, 0.02, 0.03, RM.frame, -2.85 + i * 1.05, 2.78, s * 0.915); } for (let k = 0; k < 5; k++) box(d, 0.8, 0.035, 0.03, RM.frame, -2.85, 1.85 + k * 0.12, s * 0.92); });
  cylY(d, 0.12, 0.6, RM.frame, -2.2, 3.2, 0, 10);
  // cab: big windows on every side, overhanging roof
  rbox(d, 2.1, 2.3, 2.7, 0.1, O, 1.25, 2.67, 0, 0.03);
  [1, -1].forEach((s) => { rbox(d, 1.6, 0.85, 0.03, 0.08, MT.glassD, 1.25, 3.1, s * 1.36, 0.01); rbox(d, 0.55, 1.6, 0.03, 0.04, RM.orange, 1.85, 2.35, s * 1.365, 0.01); rbox(d, 0.32, 0.4, 0.035, 0.04, MT.glassD, 1.85, 2.85, s * 1.37, 0.01); });
  [1, -1].forEach((e) => [0.6, -0.6].forEach((z) => rbox(d, 0.03, 0.85, 1.0, 0.08, MT.glassD, 1.25 + e * 1.06, 3.1, z, 0.01)));
  rbox(d, 2.5, 0.12, 3.0, 0.05, RM.frame, 1.25, 3.87, 0, 0.02); cylX(d, 0.06, 0.3, MT.chrome, 1.25, 4.0, 0.4, 8);
  // short hood
  rbox(d, 1.05, 1.0, 1.6, 0.1, O, 2.95, 2.03, 0, 0.02); [0.3, -0.3].forEach((z) => box(d, 0.9, 0.03, 0.04, RM.frame, 2.95, 2.3, z * 2.7));
  // walkway railings, steps, end beams with stripes, lights
  [1, -1].forEach((s) => { rail(d, [[-3.4, 1.55, s * 1.32], [-3.4, 2.55, s * 1.32], [0.1, 2.55, s * 1.32], [0.1, 1.55, s * 1.32]], 0.025, MT.yel); rail(d, [[2.35, 1.55, s * 1.32], [2.35, 2.55, s * 1.32], [3.45, 2.55, s * 1.32], [3.45, 1.55, s * 1.32]], 0.025, MT.yel);
    [3.25, -3.25].forEach((xx) => [0.55, 0.9].forEach((yy) => rbox(d, 0.4, 0.05, 0.3, 0.02, RM.frame, xx, yy, s * 1.25, 0.01))); });
  [1, -1].forEach((e) => {
    rbox(d, 0.18, 0.45, 2.8, 0.03, MT.stripes, e * 3.55, 1.12, 0, 0.01); buffers(d, 3.62, e);
    lampPair(d, e * 3.65, 1.42, 0.95, MT.lamp, 0.12); rbox(d, 0.05, 0.16, 0.2, 0.03, MT.lamp, e * (e > 0 ? 3.48 : 3.47), e > 0 ? 2.25 : 2.75, 0, 0.01);
  });
  bake(d);
  const axles = [1.8, -1.8].map((ax) => axle(g, ax, 0.5));
  operator(g, 1.0, 1.55, 0.3).scale.setScalar(0.9);
  return { g, axles, exhaust: new V3(-2.2, 3.55, 0) };
}

/* ---------------- steam locomotive (0-6-0 tank engine) ---------------- */
function spokedWheel(p, x, R, side, ph) {
  const g = grp(p, x, R, side * GA);
  cylZ(g, R, 0.13, RM.tyre, 0, 0, 0, 28); cylZ(g, R * 0.9, 0.14, RM.redW, 0, 0, 0, 28); cylZ(g, R * 0.8, 0.145, RM.black, 0, 0, 0, 28);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, s = box(g, R * 0.7, 0.07, 0.06, RM.redW, Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, side * 0.03); s.rotation.z = a; }
  cylZ(g, R * 0.24, 0.18, RM.redW, 0, 0, side * 0.02, 14);
  const cg = new THREE.CylinderGeometry(R * 0.78, R * 0.78, 0.08, 18, 1, false, ph - Math.PI / 2 - Math.PI * 0.35, Math.PI * 0.7); cg.rotateX(Math.PI / 2);
  add(g, cg, RM.black, 0, 0, side * 0.04);
  cylZ(g, 0.07, 0.25, MT.chrome, 0.28 * Math.cos(ph), 0.28 * Math.sin(ph), side * 0.08, 8);
  freeze(g); g.userData.r = R; return g;
}
/**
 * Little museum 0-6-0 tank engine, 8.6 long. Returns { g, setRun(dist) } — setRun turns the wheels and moves the rods.
 */
export function steamLoco(p) {
  const g = grp(p), d = grp(g), G = RM.steamG, K = RM.black, R = 0.62;
  // frames, footplate, buffer beams
  [1, -1].forEach((s) => rbox(d, 7.6, 0.6, 0.08, 0.03, K, 0, 0.95, s * 0.52, 0.01));
  rbox(d, 7.6, 0.07, 2.7, 0.02, K, 0, 1.48, 0, 0.01); [1, -1].forEach((s) => box(d, 7.6, 0.16, 0.03, RM.redW, 0, 1.38, s * 1.36));
  [1, -1].forEach((e) => { rbox(d, 0.22, 0.48, 2.8, 0.03, RM.redW, e * 3.95, 1.15, 0, 0.01); buffers(d, 4.05, e); cylY(d, 0.1, 0.25, RM.white, e * 4.0, 1.55, 0.95, 10); });
  // boiler, smokebox and door, chimney, domes, safety valves
  cylX(d, 0.72, 3.8, G, 1.0, 2.25, 0, 24); [2.6, 1.4, 0.2, -0.75].forEach((xx) => cylX(d, 0.735, 0.06, RM.brass, xx, 2.25, 0, 24));
  cylX(d, 0.78, 1.0, K, 3.4, 2.25, 0, 24); cylX(d, 0.66, 0.1, K, 3.93, 2.25, 0, 24); cylX(d, 0.18, 0.06, MT.chrome, 4.0, 2.25, 0, 10);
  box(d, 0.04, 0.05, 0.9, MT.chrome, 3.99, 2.5, 0); box(d, 0.04, 0.05, 0.9, MT.chrome, 3.99, 2.0, 0);
  cylY(d, 0.2, 0.75, K, 3.35, 3.2, 0, 14); cylY(d, 0.27, 0.12, K, 3.35, 3.6, 0, 14);
  { const dm = sph(d, 0.42, RM.brass, 1.6, 2.95, 0); dm.scale.y = 0.85; cylY(d, 0.42, 0.25, RM.brass, 1.6, 2.95, 0, 16); }
  { const sd = sph(d, 0.3, G, 0.4, 2.95, 0); sd.scale.y = 0.75; } [0.08, -0.08].forEach((z) => cylY(d, 0.06, 0.32, RM.brass, -0.55, 3.1, z, 8));
  [1, -1].forEach((s) => rail(d, [[3.5, 2.6, s * 0.8], [-0.5, 2.6, s * 0.8]], 0.02, MT.chrome));
  // cylinders, slide bars
  [1, -1].forEach((s) => { cylX(d, 0.32, 1.0, K, 3.35, R, s * 1.05, 18); cylX(d, 0.34, 0.06, MT.chrome, 2.85, R, s * 1.05, 18); cylX(d, 0.34, 0.06, MT.chrome, 3.85, R, s * 1.05, 18);
    box(d, 1.7, 0.04, 0.05, MT.chrome, 2.0, R + 0.13, s * 1.05); box(d, 1.7, 0.04, 0.05, MT.chrome, 2.0, R - 0.13, s * 1.05); });
  // side tanks with lining and a number plate
  [1, -1].forEach((s) => { rbox(d, 3.4, 1.25, 0.6, 0.05, G, 1.0, 2.13, s * 1.05, 0.02); box(d, 3.2, 0.04, 0.02, RM.brass, 1.0, 2.62, s * 1.36); box(d, 3.2, 0.04, 0.02, RM.brass, 1.0, 1.65, s * 1.36);
    const n = decal(d, '030', 0.8, 0.3, '#d6a640', 1.0, 2.15, s * 1.37, '#1c1e24'); if (s < 0) n.rotation.y = Math.PI; });
  // cab: walls, spectacle windows, side openings, curved roof
  rbox(d, 2.3, 2.1, 2.7, 0.05, G, -1.85, 2.55, 0, 0.02);
  [1, -1].forEach((s) => { rbox(d, 0.9, 1.0, 0.04, 0.2, K, -1.65, 2.85, s * 1.36, 0.01); cylX(d, 0.2, 0.05, MT.glassD, -0.7, 3.15, s * 0.75, 14); cylX(d, 0.24, 0.04, RM.brass, -0.69, 3.15, s * 0.75, 14); });
  xsec(d, [[-1.5, 0], [1.5, 0], [1.2, 0.28], [0, 0.4], [-1.2, 0.28]], 0.2, 2.6, K, -1.85, 3.58, 0, 0.02);
  cylX(d, 0.05, 0.3, RM.brass, -0.8, 3.9, 0, 8);
  // coal bunker with coal, the firebox glow inside the cab
  rbox(d, 0.9, 1.3, 2.6, 0.05, G, -3.5, 2.15, 0, 0.02);
  for (let i = 0; i < 9; i++) { const c = add(d, new THREE.IcosahedronGeometry(0.22, 0), RM.coal, -3.5 + ((i % 3) - 1) * 0.28, 2.85, (Math.floor(i / 3) - 1) * 0.7); c.rotation.set(i, i * 2, 0); }
  rbox(d, 0.05, 0.55, 0.7, 0.05, RM.fire, -1.0, 2.0, 0, 0.01);
  bake(d);
  // driving wheels, coupling rods, connecting rods, crossheads
  const xs = [1.6, 0, -1.6], wheels = [];
  [1, -1].forEach((s) => xs.forEach((x) => wheels.push(spokedWheel(g, x, R, s, s > 0 ? 0 : Math.PI / 2))));
  const rc = 0.28, Lm = 2.55;
  const sides = [1, -1].map((s) => {
    const cr = grp(g, 0, R, s * 0.9); rbox(cr, 3.6, 0.12, 0.06, 0.04, MT.chrome, 0, 0, 0, 0.01); [1.6, 0, -1.6].forEach((x) => cylZ(cr, 0.09, 0.1, RM.frame, x, 0, 0, 10));
    const mr = grp(g, 0, R, s * 1.0); rbox(mr, Lm, 0.12, 0.06, 0.04, MT.chrome, Lm / 2, 0, 0, 0.01); cylZ(mr, 0.11, 0.1, RM.frame, 0, 0, 0, 10);
    const ch = grp(g, 0, R, s * 1.05); rbox(ch, 0.3, 0.22, 0.12, 0.03, RM.frame, 0, 0, 0, 0.01);
    const pr = grp(g, 0, R, s * 1.05); cylX(pr, 0.04, 1, MT.chrome, 0.5, 0, 0, 8);
    return { s, cr, mr, ch, pr, ph: s > 0 ? 0 : Math.PI / 2 };
  });
  function setRun(dist) {
    const phi = -dist / R; wheels.forEach((w) => (w.rotation.z = phi));
    sides.forEach((q) => {
      const a = phi + q.ph, px = rc * Math.cos(a), py = rc * Math.sin(a);
      q.cr.position.x = px; q.cr.position.y = R + py;
      const cx = px + Math.sqrt(Lm * Lm - py * py);
      q.mr.position.set(px, R + py, q.mr.position.z); q.mr.rotation.z = Math.atan2(-py, cx - px);
      q.ch.position.x = cx; q.pr.position.x = cx; q.pr.scale.x = Math.max(0.05, 2.85 - cx);
    });
  }
  setRun(0);
  operator(g, -1.9, 1.5, -0.4, RM.black).scale.setScalar(0.95);
  return { g, setRun, chimney: new V3(3.35, 3.75, 0), fire: RM.fire };
}
/** The red-and-cream railcar with its little cab perched on the roof (static, museum piece). */
export function picasso(p) {
  const g = grp(p), d = grp(g), L = 10;
  rbox(d, L, 1.1, 2.8, 0.25, RM.picRed, 0, 1.75, 0, 0.04); rbox(d, L, 1.25, 2.8, 0.3, RM.picCream, 0, 2.9, 0, 0.04);
  xsec(d, [[-1.4, 0], [1.4, 0], [1.1, 0.3], [0, 0.42], [-1.1, 0.3]], 0.2, L - 0.1, RM.greyD, 0, 3.5, 0, 0.03);
  [1, -1].forEach((s) => { for (let xx = -4.0; xx <= 4.0; xx += 1.15) rbox(d, 0.9, 0.7, 0.03, 0.08, MT.glassD, xx, 2.95, s * 1.405, 0.01); box(d, L - 0.2, 0.08, 0.02, RM.picCream, 0, 2.28, s * 1.41); });
  [1, -1].forEach((e) => { rbox(d, 0.03, 0.6, 1.8, 0.06, MT.glassD, e * 5.0, 2.95, 0, 0.01); lampPair(d, e * 5.02, 1.6, 0.8, MT.lamp, 0.12); buffers(d, 5.0, e); });
  rbox(d, 1.8, 1.2, 1.9, 0.15, RM.picCream, -1.2, 4.2, 0, 0.03); rbox(d, 1.9, 0.12, 2.0, 0.05, RM.greyD, -1.2, 4.85, 0, 0.02);
  [1, -1].forEach((e) => rbox(d, 0.03, 0.55, 1.5, 0.05, MT.glassD, -1.2 + e * 0.91, 4.3, 0, 0.01)); [1, -1].forEach((s) => rbox(d, 1.2, 0.5, 0.03, 0.05, MT.glassD, -1.2, 4.3, s * 0.96, 0.01));
  rbox(d, 6.5, 0.7, 2.2, 0.06, RM.frame, 0, 0.85, 0, 0.02);
  bake(d);
  [3.3, -3.3].forEach((x) => axle(g, x, 0.48));
  shadows(g); return g;
}

/* ---------------- tamping machine ---------------- */
/**
 * Yellow tamping machine (≈17 long): two cabs, an engine hood, and under the frame the tamping banks
 * whose tines dive into the ballast. Returns { g, axles, banks, tines, frontCab, workCab }.
 */
export function tamper(p) {
  const g = grp(p), d = grp(g), Y = RM.yel, L = 17;
  rbox(d, L - 0.4, 0.46, 2.7, 0.05, Y, 0, 1.15, 0, 0.02); rbox(d, L - 1.2, 0.1, 2.75, 0.02, RM.frame, 0, 0.9, 0, 0.01);
  // front cab (+x): raised, sloped windscreen
  ext(d, [[5.6, 1.38], [8.35, 1.38], [8.5, 2.4], [8.2, 4.0], [5.6, 4.0]], [0.03, 0.05, 0.15, 0.2, 0.1], 2.8, Y, 0, 0, 0, 0.06);
  slab(d, 8.55, 2.45, 8.25, 3.95, 0.07, 2.4, 0.03, MT.glassD, 0.08);
  [1, -1].forEach((s) => { rbox(d, 2.0, 1.0, 0.03, 0.08, MT.glassD, 6.9, 3.2, s * 1.405, 0.01); rbox(d, 0.6, 2.2, 0.025, 0.05, Y, 6.0, 2.5, s * 1.405, 0.01); });
  rbox(d, 3.0, 0.12, 3.0, 0.04, RM.frame, 7.0, 4.05, 0, 0.02);
  lampPair(d, 8.62, 1.75, 0.9, MT.lamp, 0.15); lampPair(d, 8.62, 1.75, 1.15, MT.tail, 0.08); rbox(d, 0.05, 0.16, 0.3, 0.03, MT.lamp, 8.33, 3.9, 0, 0.01);
  // rear work cab (−x): big windows that look down at the tamping units
  ext(d, [[-8.4, 1.38], [-4.7, 1.38], [-4.7, 4.0], [-8.2, 4.0], [-8.5, 2.4]], [0.05, 0.03, 0.1, 0.2, 0.15], 2.8, Y, 0, 0, 0, 0.06);
  slab(d, -8.25, 3.95, -8.55, 2.45, 0.07, 2.4, 0.03, MT.glassD, 0.08);
  [1, -1].forEach((s) => { rbox(d, 2.6, 1.0, 0.03, 0.08, MT.glassD, -6.5, 3.2, s * 1.405, 0.01); rbox(d, 1.2, 0.6, 0.03, 0.08, MT.glassD, -5.4, 2.1, s * 1.405, 0.01); });
  rbox(d, 0.03, 1.0, 2.2, 0.08, MT.glassD, -4.68, 3.0, 0, 0.01);
  rbox(d, 4.0, 0.12, 3.0, 0.04, RM.frame, -6.5, 4.05, 0, 0.02);
  lampPair(d, -8.62, 1.75, 0.9, MT.tail, 0.1); lampPair(d, -8.62, 1.75, 1.15, MT.lamp, 0.14);
  // engine hood with louvres, exhaust, walkway railings
  rbox(d, 7.2, 1.7, 2.3, 0.15, Y, 1.7, 2.2, 0, 0.03);
  [1, -1].forEach((s) => { for (let i = 0; i < 3; i++) { rbox(d, 1.6, 1.0, 0.025, 0.05, RM.yelD, -0.4 + i * 2.0, 2.25, s * 1.16, 0.01); for (let k = 0; k < 6; k++) box(d, 1.5, 0.035, 0.03, RM.frame, -0.4 + i * 2.0, 1.85 + k * 0.15, s * 1.17); }
    rail(d, [[-4.5, 1.4, s * 1.35], [-4.5, 2.4, s * 1.35], [5.4, 2.4, s * 1.35], [5.4, 1.4, s * 1.35]], 0.025, RM.frame);
    rod(d, new V3(-4.0, 1.4, s * 1.35), new V3(-4.0, 2.4, s * 1.35), 0.02, RM.frame, 4); rod(d, new V3(2.0, 1.4, s * 1.35), new V3(2.0, 2.4, s * 1.35), 0.02, RM.frame, 4); });
  cylY(d, 0.14, 0.7, RM.frame, 3.8, 3.35, 0.5, 10); cylY(d, 0.35, 0.8, RM.greyD, 4.4, 3.3, -0.5, 14);
  // hydraulic cylinders above the tamping units, the lifting unit, the measuring trolleys
  [-3.0].forEach((tx) => [1, -1].forEach((s) => [0.4, -0.4].forEach((o) => { cylY(d, 0.11, 1.3, RM.yelD, tx + o, 2.0, s * GA, 10); cylY(d, 0.13, 0.08, RM.frame, tx + o, 2.65, s * GA, 10); })));
  rbox(d, 1.2, 0.5, 2.2, 0.05, Y, -0.6, 0.75, 0, 0.02); [1, -1].forEach((s) => [-0.95, -0.25].forEach((xx) => { cylZ(d, 0.16, 0.08, RM.frame, xx, 0.16, s * (GA - 0.07), 12); cylZ(d, 0.13, 0.08, RM.frame, xx, 0.14, s * (GA + 0.12), 10); }));
  [4.3, -1.8].forEach((xx) => { cylZ(d, 0.05, 1.7, RM.frame, xx, 0.2, 0, 8); [1, -1].forEach((s) => cylZ(d, 0.2, 0.06, RM.frame, xx, 0.2, s * GA, 12)); rod(d, new V3(xx, 0.25, 0), new V3(xx + 0.4, 0.92, 0), 0.04, RM.frame, 6); });
  // ends: stripes, buffers, steps
  [1, -1].forEach((e) => { rbox(d, 0.18, 0.5, 2.8, 0.03, MT.stripes, e * 8.4, 1.05, 0, 0.01); buffers(d, 8.5, e); [1, -1].forEach((s) => [0.45, 0.8].forEach((yy) => rbox(d, 0.45, 0.05, 0.3, 0.02, RM.frame, e * 7.6, yy, s * 1.25, 0.01))); });
  bake(d);
  const b1 = bogie(g, 6.4, { sp: 1.9, R: 0.42 }), b2 = bogie(g, -6.6, { sp: 1.9, R: 0.42 });
  // tamping banks: one per rail, four tines each (two each side of the sleeper, both sides of the rail)
  const banks = [], tines = [];
  [1, -1].forEach((s) => {
    const bk = grp(g, -3.0, 0, s * GA); banks.push(bk);
    rbox(bk, 1.3, 0.75, 0.5, 0.06, Y, 0, 1.1, 0, 0.02); [0.4, -0.4].forEach((o) => cylY(bk, 0.06, 1.2, MT.chrome, o, 1.9, 0, 8));
    rbox(bk, 1.0, 0.25, 0.75, 0.05, RM.frame, 0, 0.7, 0, 0.02);
    [0.33, -0.33].forEach((xo) => [0.28, -0.28].forEach((zo) => {
      const t = grp(bk, xo, 1.3, zo); t.userData.xo = xo; tines.push(t);
      rbox(t, 0.1, 1.1, 0.08, 0.03, RM.frame, 0, -0.55, 0, 0.01); rbox(t, 0.18, 0.12, 0.1, 0.03, RM.greyD, -Math.sign(xo) * 0.02, -1.12, 0, 0.01);
    }));
  });
  operator(g, -6.8, 1.45, 0.35).scale.setScalar(0.95);
  return { g, axles: [...b1.axles, ...b2.axles], banks, tines, beacons: [new V3(7.0, 4.1, 0.9), new V3(-6.5, 4.1, 0.9)] };
}

/* ---------------- catenary maintenance vehicle ---------------- */
/** Yellow two-axle catenary vehicle with a scissor-lift platform and two workers. Returns { g, axles, lift, setLift(h), workers, platform }. */
export function catenaryCar(p) {
  const g = grp(p), d = grp(g), Y = RM.yel, L = 11;
  rbox(d, L, 0.5, 2.8, 0.05, Y, 0, 1.2, 0, 0.02);
  [1, -1].forEach((s) => { rbox(d, L - 1.4, 0.5, 0.14, 0.04, RM.frame, 0, 0.8, s * 1.08, 0.02); [3.3, -3.3].forEach((ax) => { rbox(d, 0.45, 0.4, 0.2, 0.05, RM.frame, ax, 0.5, s * 1.1, 0.02); for (let k = 0; k < 3; k++) cylY(d, 0.12, 0.05, RM.spring, ax, 0.82 + k * 0.07, s * 1.1, 10); }); });
  // cab at +x
  ext(d, [[2.8, 1.45], [5.4, 1.45], [5.55, 2.4], [5.3, 3.95], [2.8, 3.95]], [0.03, 0.05, 0.15, 0.2, 0.1], 2.8, Y, 0, 0, 0, 0.06);
  slab(d, 5.6, 2.45, 5.33, 3.9, 0.07, 2.4, 0.03, MT.glassD, 0.08);
  [1, -1].forEach((s) => { rbox(d, 1.5, 0.95, 0.03, 0.08, MT.glassD, 4.2, 3.15, s * 1.405, 0.01); rbox(d, 0.6, 2.1, 0.025, 0.05, Y, 3.2, 2.5, s * 1.405, 0.01); rbox(d, 0.3, 0.35, 0.03, 0.04, MT.glassD, 3.2, 3.1, s * 1.41, 0.01); });
  rbox(d, 2.9, 0.12, 3.0, 0.04, RM.frame, 4.1, 4.0, 0, 0.02);
  lampPair(d, 5.65, 1.8, 0.9, MT.lamp, 0.15); lampPair(d, 5.65, 1.8, 1.15, MT.tail, 0.08);
  // workshop box behind the cab, toolboxes, cable drum
  rbox(d, 2.2, 2.0, 2.6, 0.08, RM.grey, 1.5, 2.45, 0, 0.02); [1, -1].forEach((s) => { rbox(d, 0.8, 1.7, 0.03, 0.04, RM.greyD, 1.6, 2.35, s * 1.31, 0.01); rbox(d, 0.5, 0.35, 0.03, 0.04, MT.glassD, 0.85, 2.9, s * 1.31, 0.01); });
  cylZ(d, 0.55, 0.9, RM.wood, -4.5, 2.05, 0, 16); cylZ(d, 0.42, 0.92, RM.copper, -4.5, 2.05, 0, 16);
  [1, -1].forEach((s) => rbox(d, 1.2, 0.45, 0.4, 0.04, RM.orange, -4.4, 1.68, s * 1.05, 0.01));
  [1, -1].forEach((e) => { rbox(d, 0.18, 0.45, 2.8, 0.03, MT.stripes, e * 5.55, 1.08, 0, 0.01); buffers(d, 5.62, e); });
  [1, -1].forEach((s) => [0.55, 0.9].forEach((yy) => rbox(d, 0.45, 0.05, 0.3, 0.02, RM.frame, 2.6, yy, s * 1.25, 0.01)));
  rbox(d, 3.2, 0.2, 1.9, 0.04, RM.frame, -1.9, 1.55, 0, 0.01);
  bake(d);
  const axles = [3.3, -3.3].map((ax) => axle(g, ax, 0.5));
  // scissor lift and platform
  const BX = -1.9, BY = 1.65, Lb = 2.8, lift = grp(g), bars = [];
  for (let i = 0; i < 2; i++) [1, -1].forEach((s) => [1, -1].forEach((k) => { const b = grp(lift, BX, 0, s * 0.8); rbox(b, Lb, 0.12, 0.08, 0.03, RM.yelD, 0, 0, 0, 0.01); b.userData = { i, k }; bars.push(b); }));
  const platform = grp(g, BX, 0, 0);
  rbox(platform, 3.6, 0.14, 2.4, 0.03, RM.greyD, 0, 0.07, 0, 0.01);
  [1, -1].forEach((s) => { rail(platform, [[-1.75, 0.14, s * 1.15], [-1.75, 1.15, s * 1.15], [1.75, 1.15, s * 1.15], [1.75, 0.14, s * 1.15]], 0.03, MT.yel); box(platform, 3.5, 0.15, 0.03, MT.yel, 0, 0.25, s * 1.17); rod(platform, new V3(0, 0.14, s * 1.15), new V3(0, 1.15, s * 1.15), 0.025, MT.yel, 4); });
  rail(platform, [[-1.75, 1.15, 1.15], [-1.75, 1.15, -1.15]], 0.03, MT.yel); rail(platform, [[1.75, 1.15, 1.15], [1.75, 1.15, -1.15]], 0.03, MT.yel);
  const workers = [[-0.6, 0.45], [0.7, -0.4]].map(([x, z]) => { const w = person(platform, x, z, { vest: true, hat: MT.hat }); w.position.y = 0.14; return w; });
  workers[1].rotation.y = Math.PI;
  function setLift(h) {
    const hs = h / 2, a = Math.asin(clamp(hs / Lb, 0.03, 0.98));
    bars.forEach((b) => { b.position.y = BY + hs * (b.userData.i + 0.5); b.rotation.z = b.userData.k * a; });
    platform.position.y = BY + h;
  }
  setLift(0.3);
  operator(g, 4.0, 1.5, 0.4).scale.setScalar(0.9);
  return { g, axles, setLift, workers, platform, floor: BY + 0.14 };
}
