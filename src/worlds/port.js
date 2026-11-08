// Le Port — a busy container port by the sea: a big ship pushed to the quay by tugs, the giant gantry crane that unloads it,
// the straddle carrier and the reach stacker that move the boxes, a truck and a freight train that take them away, and the pilot boat.
import * as THREE from 'three';
import { V3, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, cylGeo, rod, rail, sph, rbox, ext, extY, anchor, wp, shadows, freeze } from '../kit/geo.js';
import { tire, operator, beacon, truckCab, fender, hydraulic } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { autumnTree } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, PI = Math.PI;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const RAD = 58, SEA = -1.8, DQ = -14; // island radius, water level, quay edge (d)

/* ================= palette (made once, shared by everything) ================= */
const PM = {
  navy: std(0x1d3a7a, 0.5, 0.2), antif: std(0xc0302a, 0.65, 0.05), white: std(0xf4f5f8, 0.4, 0.1), cream: std(0xeae4d4, 0.6, 0.05),
  deck: std(0x4f7a62, 0.75, 0.05), hatch: std(0x7a8c84, 0.6, 0.25), grey: std(0x8f96a6, 0.5, 0.35), greyL: std(0xc6cad4, 0.5, 0.2),
  dark: std(0x2a2f3c, 0.6, 0.2), black: std(0x1d1f26, 0.6, 0.2), rubber: std(0x222428, 0.9, 0), rope: std(0xe8d6a0, 0.85, 0),
  red: std(0xd8302a, 0.45, 0.15), redD: std(0x9a1f1a, 0.5, 0.1), yel: std(0xf2b21c, 0.4, 0.2), yelD: std(0xc88a10, 0.5, 0.2),
  orange: std(0xf26a2a, 0.45, 0.1), green: std(0x2f7a54, 0.5, 0.15), greenD: std(0x1f5a3c, 0.55, 0.1),
  blue: std(0x2f6fe0, 0.4, 0.3), blueD: std(0x2453b8, 0.5, 0.3), teal: std(0x1f9aa8, 0.45, 0.15),
  concrete: std(0xb7b9c3, 0.9, 0), wall: std(0x8a8c98, 0.95, 0), steel: MT.steel, chrome: MT.chrome,
  glass: MT.glassD, glassL: MT.glass, lamp: MT.lamp, tail: MT.tail, amber: MT.amber,
  redLamp: std(0xff4a3a, 0.3, 0, { emissive: 0xff2010, emissiveIntensity: 1.2 }), greenLamp: std(0x4aff7a, 0.3, 0, { emissive: 0x10d040, emissiveIntensity: 1 }),
  wood: std(0x9a7a55, 0.85, 0), sand: std(0xe8d6a0, 0.9, 0), grass: std(0x5aa85a, 0.9, 0), roofR: std(0xc0503a, 0.7, 0.05)
};

// corrugated container sides: a canvas texture with ribs and a darker frame, tinted by the material colour
const RIB = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 64);
  for (let i = 4; i < 252; i += 8) { x.fillStyle = '#d2d2d2'; x.fillRect(i, 4, 3, 56); x.fillStyle = '#f2f2f2'; x.fillRect(i + 3, 4, 2, 56); }
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, 256, 4); x.fillRect(0, 60, 256, 4); x.fillRect(0, 0, 4, 64); x.fillRect(252, 0, 4, 64);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
})();
const CCOL = [0xd8402a, 0x2f6fe0, 0xee7a26, 0x3aa46a, 0xf2b21c, 0xe8eaf0, 0x8a2a3a, 0x1f9aa8, 0x7a5ad8, 0x8f96a6];
const CMC = {};
const cm = (col) => (CMC[col] || (CMC[col] = std(col, 0.55, 0.15, { map: RIB })));
let seed = 7; const srnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const scol = () => CCOL[Math.floor(srnd() * CCOL.length)];
const CL = 5.4, CW = 2.2, CH = 2.3; // a 20-foot box
/** A container sitting on (x, y, z) of p; along x unless `alongZ`. */
function boxC(p, col, x, y, z, alongZ) { const m = box(p, alongZ ? CW : CL, CH, alongZ ? CL : CW, cm(col), x, y + CH / 2, z); return m; }
/** A loose container (moves around): origin at its bottom centre, long side along x, with door bars at the back. */
function cont(p, col, x = 0, y = 0, z = 0) {
  const g = grp(p, x, y, z); box(g, CL, CH, CW, cm(col), 0, CH / 2, 0);
  [0.45, -0.45].forEach((zz) => box(g, 0.06, CH - 0.3, 0.06, PM.dark, -CL / 2 - 0.02, CH / 2, zz));
  [0.25, -0.25].forEach((zz) => box(g, 0.05, 0.08, 0.3, PM.dark, -CL / 2 - 0.03, CH / 2, zz));
  return g;
}
const bake = (g) => { shadows(g); freeze(g); return g; };
const Yv = new V3(0, 1, 0), _d = new V3();
/** A thin bar that can be re-stretched between two points every frame (ropes, cables). */
function seg(p, r, m) { const s = add(p, cylGeo(6), m); s.userData.dynamic = true; s.set = (a, b) => { _d.subVectors(b, a); const L = _d.length() || 0.001; s.scale.set(r, L, r); s.position.copy(a).addScaledVector(_d, 0.5); s.quaternion.setFromUnitVectors(Yv, _d.multiplyScalar(1 / L)); }; return s; }
/** A rubber tube along points (boat fenders). */
function tube(p, pts, r, m, closed) { const c = new THREE.CatmullRomCurve3(pts.map((q) => new V3(...q)), !!closed, 'catmullrom', 0.2); return add(p, new THREE.TubeGeometry(c, Math.max(8, pts.length * 6), r, 8, !!closed), m); }
/** Text on both sides of something (a decal per side). */
function decal2(p, text, w, h, col, x, y, z, bg) { decal(p, text, w, h, col, x, y, z, bg); const D = grp(p, x, y, -z); D.rotation.y = PI; decal(D, text, w, h, col, 0, 0, 0, bg); }

/* ================= the machines ================= */

/** Container ship facing +x, waterline at y = 0. Returns { g, d (baked), kp (a loose box on top), radar, ladder }. */
function containerShip(p, o = {}) {
  const g = grp(p), d = grp(g), H = o.hull || PM.navy, F = o.funnel || PM.red;
  const plan = [[-23, -5.5], [13, -5.5], [18.5, -4.6], [21.8, -2.6], [23.2, 0], [21.8, 2.6], [18.5, 4.6], [13, 5.5], [-23, 5.5]];
  const rr = [0.9, 2, 2, 1.5, 0.6, 1.5, 2, 2, 0.9];
  const sc = (k, kz = k) => plan.map(([x, z]) => [x * k, z * kz]);
  extY(d, plan, rr, 3.8, H, 0, 2.5, 0, 0.06);                         // topsides 0.6 → 4.4
  extY(d, sc(0.996, 0.985), rr, 1.9, PM.antif, 0, -0.35, 0, 0.04);   // red bottom paint, mostly under water
  extY(d, sc(1.003, 1.008), rr, 0.16, PM.white, 0, 0.62, 0, 0.02);   // white boot-top line
  extY(d, sc(0.97, 0.94), rr, 0.06, PM.deck, 0, 4.42, 0, 0.01);
  // raised forecastle with its bulwark, and a breakwater shield in front of the first containers
  const fc = [[13, -5.5], [18.5, -4.6], [21.8, -2.6], [23.2, 0], [21.8, 2.6], [18.5, 4.6], [13, 5.5]];
  extY(d, fc, [0.1, 2, 1.5, 0.6, 1.5, 2, 0.1], 1.3, H, 0, 5.0, 0, 0.04);
  extY(d, fc.map(([x, z]) => [x * 0.99, z * 0.93]), 0.5, 0.05, PM.deck, 0, 5.66, 0, 0.01);
  [1, -1].forEach((s) => { const w = rbox(d, 5.8, 1.7, 0.18, 0.05, PM.white, 12.4, 5.3, s * 2.6, 0.02); w.rotation.y = s * 0.32; });
  // bow: anchors in their hawse pipes, the name, a bow-thruster mark; stern: name and port
  [1, -1].forEach((s) => {
    cylZ(d, 0.45, 0.2, PM.black, 20.3, 3.7, s * 3.55, 12); const a = rbox(d, 0.25, 0.9, 0.12, 0.05, PM.dark, 20.3, 3.25, s * 3.62, 0.02); a.rotation.y = s * 0.55;
    rod(d, new V3(19.6, 2.9, s * 3.7), new V3(21.0, 2.9, s * 3.45), 0.07, PM.dark, 6);
    for (let i = 0; i < 6; i++) box(d, 0.3, 0.05, 0.04, PM.white, 22.3 - i * 0.18, 0.9 + i * 0.4, s * (1.6 - i * 0.05)); // draught marks
    cylX(d, 0.35, 0.04, PM.white, 19.5, 1.6, s * 4.85, 16).rotation.y = s * 0.38;
  });
  decal2(d, o.name || 'BIDULE', 5, 0.9, '#ffffff', 16.5, 3.4, 5.52, null);
  { const D = grp(d, -23.03, 3.0, 0); D.rotation.y = -PI / 2; decal(D, o.name || 'BIDULE', 4.4, 0.8, '#ffffff', 0, 0.4, 0, null); decal(D, 'MARSEILLE', 3.4, 0.5, '#ffffff', 0, -0.4, 0, null); }
  // forecastle gear: windlasses, bollards, foremast with its light
  [1.7, -1.7].forEach((z) => { cylZ(d, 0.38, 0.8, PM.greyL, 18.4, 6.1, z, 14); cylZ(d, 0.5, 0.06, PM.grey, 18.4, 6.1, z + 0.45, 14); rbox(d, 0.9, 0.4, 1.2, 0.05, PM.greenD, 17.2, 5.9, z, 0.02); });
  [[20.8, 1.6], [20.8, -1.6], [15, 4.6], [15, -4.6]].forEach(([x, z]) => { cylY(d, 0.16, 0.45, PM.black, x, 5.95, z - 0.25, 10); cylY(d, 0.16, 0.45, PM.black, x, 5.95, z + 0.25, 10); });
  rod(d, new V3(21.4, 5.7, 0), new V3(21.4, 9.6, 0), 0.08, PM.greyL, 8); sph(d, 0.14, PM.lamp, 21.4, 9.7, 0);
  rail(d, fc.slice(1, 6).map(([x, z]) => [x * 0.98, 6.3, z * 0.93]), 0.03, PM.greyL);
  // stern mooring deck
  [[-21.8, 4.2], [-21.8, -4.2], [-14, 4.8], [-14, -4.8]].forEach(([x, z]) => { cylY(d, 0.15, 0.4, PM.black, x - 0.25, 4.65, z, 10); cylY(d, 0.15, 0.4, PM.black, x + 0.25, 4.65, z, 10); });
  rail(d, [[-22.6, 4.45, 5.2], [-22.6, 5.0, 5.2], [-22.8, 5.0, 0], [-22.6, 5.0, -5.2], [-22.6, 4.45, -5.2]], 0.03, PM.greyL);
  // hatch covers, lashing bridges and the boxes: 5 bays of 20-footers, 4 rows across
  const bays = [9.6, 4.0, -1.6, -7.2, -12.8], rows = [-3.45, -1.15, 1.15, 3.45];
  const tiers = [[2, 3, 3, 2], [3, 3, 3, 3], [3, 3, 2, 3], [2, 3, 3, 3], [3, 2, 3, 2]];
  let kp = null; seed = o.seed || 7;
  bays.forEach((bx, i) => {
    rbox(d, 5.3, 0.45, 10.2, 0.05, PM.hatch, bx, 4.65, 0, 0.02);
    rows.forEach((rz, j) => { for (let t = 0; t < tiers[i][j]; t++) { const isKp = !o.noKp && i === 2 && j === 2 && t === tiers[i][j] - 1; if (isKp) kp = cont(g, 0xee7a26, bx, 4.9 + t * CH, rz); else boxC(d, scol(), bx, 4.9 + t * CH, rz); } });
  });
  [12.45, 6.8, 1.2, -4.4, -10.0].forEach((x) => { [-5.0, -2.3, 0, 2.3, 5.0].forEach((z) => box(d, 0.14, 4.6, 0.14, PM.greyL, x, 7.2, z)); rbox(d, 0.6, 0.06, 10.6, 0.02, PM.grey, x, 9.5, 0, 0.01); [5.3, -5.3].forEach((z) => rail(d, [[x - 0.3, 9.5, z], [x - 0.3, 10.4, z], [x + 0.3, 10.4, z]], 0.025, PM.yel)); });
  // accommodation block at the stern, bridge with its wings, funnel, mast, lifeboat
  rbox(d, 6.0, 7.0, 8.6, 0.1, PM.white, -19.2, 7.9, 0, 0.03);
  for (let y = 5.3; y < 11; y += 1.4) { box(d, 0.05, 0.5, 7.6, PM.glass, -16.19, y, 0); [4.31, -4.31].forEach((z) => box(d, 5.2, 0.5, 0.05, PM.glass, -19.2, y, z)); }
  rbox(d, 3.8, 1.6, 11.8, 0.1, PM.white, -18.1, 12.2, 0, 0.03); rbox(d, 4.1, 0.22, 12.0, 0.05, PM.white, -18.1, 13.1, 0, 0.02);
  { const ws = box(d, 0.06, 0.75, 11.2, PM.glass, -16.17, 12.35, 0); ws.rotation.z = -0.12; }
  [5.95, -5.95].forEach((z) => { box(d, 3.2, 0.7, 0.05, PM.glass, -18.1, 12.35, z); rod(d, new V3(-17, 11.4, z * 0.97), new V3(-17, 9.0, z * 0.78), 0.08, PM.white, 6); });
  rbox(d, 1.8, 1.2, 2.4, 0.1, PM.white, -19.4, 13.8, 0, 0.02); // monkey island
  ext(d, [[-1.25, 0], [1.0, 0], [0.75, 3.8], [-1.5, 3.8]], 0.1, 2.8, F, -21.2, 11.4, 0, 0.04);
  ext(d, [[-1.52, 3.3], [0.78, 3.3], [0.76, 3.82], [-1.55, 3.82]], 0.02, 2.86, PM.black, -21.2, 11.4, 0, 0.01);
  ext(d, [[-1.4, 1.6], [0.88, 1.6], [0.84, 2.3], [-1.45, 2.3]], 0.02, 2.86, PM.white, -21.2, 11.4, 0, 0.01);
  [1, -1].forEach((s) => { const st = grp(d, -21.1, 13.35, s * 1.44); st.rotation.x = s * PI / 2; cylY(st, 0.42, 0.04, F, 0, 0, 0, 5); });
  rod(d, new V3(-18.6, 14.4, 0), new V3(-18.6, 18.2, 0), 0.09, PM.white, 8); rod(d, new V3(-18.6, 17.0, -1.6), new V3(-18.6, 17.0, 1.6), 0.05, PM.white, 6);
  sph(d, 0.14, PM.lamp, -18.6, 18.3, 0); sph(d, 0.1, PM.redLamp, -18.6, 17.0, -1.6); sph(d, 0.1, PM.greenLamp, -18.6, 17.0, 1.6);
  // free-fall lifeboat on its ramp at the stern
  { const lb = grp(d, -22.7, 8.4, 0); lb.rotation.z = 0.5; rbox(lb, 3.2, 0.12, 1.3, 0.04, PM.grey, 0, -0.75, 0, 0.02); cylX(lb, 0.6, 2.4, PM.orange, 0, 0, 0, 14); sph(lb, 0.6, PM.orange, 1.2, 0, 0).scale.set(0.7, 0.6, 0.6); sph(lb, 0.6, PM.orange, -1.2, 0, 0).scale.set(0.3, 0.6, 0.6); rbox(lb, 1.0, 0.45, 0.8, 0.12, PM.orange, 0.2, 0.55, 0, 0.02); box(lb, 0.5, 0.15, 0.82, PM.glass, 0.4, 0.6, 0); }
  // pilot ladder on the side, rolled down to the water (only used by the waiting ship)
  let ladder = null;
  if (o.ladder) { ladder = grp(g, -2, 0, 5.56); [0.3, -0.3].forEach((x) => rod(ladder, new V3(x, 0.4, 0), new V3(x, 4.4, 0), 0.03, PM.rope, 4)); for (let y = 0.6; y < 4.4; y += 0.4) box(ladder, 0.66, 0.06, 0.1, PM.wood, 0, y, 0.02); }
  bake(d);
  const radar = grp(g, -19.4, 14.5, 0); radar.userData.dynamic = true; rbox(radar, 0.3, 0.12, 2.2, 0.04, PM.white, 0, 0.1, 0, 0.01); cylY(radar, 0.1, 0.2, PM.dark, 0, -0.05, 0, 8);
  shadows(g);
  return { g, d, kp, radar, ladder };
}

/** Harbour tug facing +x: rubber fenders all round, a fat bow fender, aft towing winch. Waterline y = 0. */
function tugBoat(p, col = PM.red, name = 'HERCULE') {
  const g = grp(p), d = grp(g);
  const plan = [[-4.4, -2.0], [2.2, -2.0], [3.8, -1.3], [4.6, 0], [3.8, 1.3], [2.2, 2.0], [-4.4, 2.0]], rr = [1.2, 1, 0.8, 0.5, 0.8, 1, 1.2];
  extY(d, plan, rr, 1.5, col, 0, 0.95, 0, 0.05); extY(d, plan.map(([x, z]) => [x * 0.99, z * 0.97]), rr, 0.9, PM.black, 0, -0.3, 0, 0.03);
  extY(d, plan.map(([x, z]) => [x * 0.93, z * 0.88]), 0.8, 0.05, PM.dark, 0, 1.72, 0, 0.01);
  const out = [[-4.0, 1.98], [-1, 2.05], [2.2, 2.02], [3.75, 1.35], [4.55, 0], [3.75, -1.35], [2.2, -2.02], [-1, -2.05], [-4.0, -1.98], [-4.45, 0]];
  tube(d, out.map(([x, z]) => [x * 1.02, 1.55, z * 1.04]), 0.17, PM.rubber, true);               // rubbing strake all round
  tube(d, [[2.4, 1.05, 2.0], [3.8, 1.05, 1.4], [4.7, 1.05, 0], [3.8, 1.05, -1.4], [2.4, 1.05, -2.0]], 0.42, PM.rubber); // big bow fender
  tube(d, [[2.8, 0.35, 1.7], [3.9, 0.35, 1.15], [4.5, 0.35, 0], [3.9, 0.35, -1.15], [2.8, 0.35, -1.7]], 0.3, PM.rubber);
  tube(d, [[-4.0, 1.0, 1.8], [-4.6, 1.0, 0.7], [-4.6, 1.0, -0.7], [-4.0, 1.0, -1.8]], 0.3, PM.rubber);  // stern fender
  [-3.0, -1.5, 0, 1.4].forEach((x) => [1, -1].forEach((s) => add(d, new THREE.TorusGeometry(0.3, 0.11, 6, 14), PM.rubber, x, 0.95, s * 2.12))); // old tyres hanging on the sides
  rail(d, [[-3.9, 1.75, 1.7], [-3.9, 2.25, 1.7], [-1.6, 2.25, 1.8]], 0.03, PM.white); rail(d, [[-3.9, 1.75, -1.7], [-3.9, 2.25, -1.7], [-1.6, 2.25, -1.8]], 0.03, PM.white);
  // deckhouse, the wheelhouse with windows all round, its roof, mast and lights
  rbox(d, 3.4, 1.1, 3.0, 0.1, PM.white, 0.4, 2.3, 0, 0.02); for (let i = 0; i < 3; i++) [1.51, -1.51].forEach((z) => cylZ(d, 0.16, 0.04, PM.glass, -0.6 + i * 0.9, 2.4, z, 12));
  rbox(d, 2.2, 1.25, 2.6, 0.08, PM.white, 0.9, 3.45, 0, 0.02); box(d, 2.26, 0.6, 2.66, PM.glass, 0.9, 3.55, 0);
  rbox(d, 2.7, 0.14, 3.1, 0.04, col, 0.95, 4.15, 0, 0.01);
  rod(d, new V3(0.4, 4.2, 0), new V3(0.4, 6.0, 0), 0.06, PM.white, 6); rod(d, new V3(0.4, 5.4, -0.6), new V3(0.4, 5.4, 0.6), 0.04, PM.white, 6);
  sph(d, 0.1, PM.lamp, 0.4, 6.1, 0); sph(d, 0.08, PM.lamp, 0.4, 5.6, 0); sph(d, 0.08, PM.redLamp, 1.0, 3.6, -1.38); sph(d, 0.08, PM.greenLamp, 1.0, 3.6, 1.38);
  rbox(d, 0.25, 0.1, 1.2, 0.03, PM.white, 0.4, 4.4, 0, 0.01);
  // twin funnels, fire-fighting water cannons
  [0.9, -0.9].forEach((z) => { rbox(d, 0.6, 1.6, 0.5, 0.08, PM.yel, -0.9, 3.3, z, 0.02); rbox(d, 0.62, 0.25, 0.52, 0.04, PM.black, -0.9, 4.05, z, 0.01); });
  [0.7, -0.7].forEach((z) => { cylY(d, 0.12, 0.25, PM.red, 1.6, 4.32, z, 8); cylX(d, 0.06, 0.6, PM.red, 1.9, 4.45, z, 8); });
  // aft deck: the towing winch, the towing staple over the stern; fore deck: bitts
  cylZ(d, 0.35, 1.2, PM.red, -2.2, 2.15, 0, 16); [0.62, -0.62].forEach((z) => cylZ(d, 0.55, 0.06, PM.redD, -2.2, 2.15, z, 16)); cylZ(d, 0.37, 1.0, PM.dark, -2.2, 2.15, 0, 16);
  rbox(d, 0.8, 0.4, 1.6, 0.04, PM.dark, -2.2, 1.85, 0, 0.02);
  rail(d, [[-3.8, 1.75, -1.3], [-3.8, 3.0, -1.0], [-3.8, 3.0, 1.0], [-3.8, 1.75, 1.3]], 0.08, PM.yel);
  [-3.4, 3.0].forEach((x) => [0.35, -0.35].forEach((z) => cylY(d, 0.12, 0.45, PM.black, x, 1.95, z, 10)));
  [1, -1].forEach((s) => add(d, new THREE.TorusGeometry(0.22, 0.06, 6, 14), PM.orange, 0.4, 2.5, s * 1.52));
  decal2(d, name, 1.8, 0.4, '#ffffff', -2.6, 1.15, 2.04, null);
  bake(d);
  const drum = cylZ(g, 0.38, 1.04, PM.rope, -2.2, 2.15, 0, 10); // the cable wound on the winch
  const towPt = anchor(g, -3.8, 2.9, 0), bowPt = anchor(g, 4.7, 1.1, 0);
  shadows(g); return { g, drum, towPt, bowPt };
}

/** Pilot boat facing +x: dark hull, grey foam collar, orange wheelhouse marked PILOTE. Waterline y = 0. */
function pilotBoat(p) {
  const g = grp(p), d = grp(g);
  const plan = [[-3.6, -1.5], [1.4, -1.5], [3.0, -0.95], [3.95, 0], [3.0, 0.95], [1.4, 1.5], [-3.6, 1.5]], rr = [0.6, 0.8, 0.8, 0.3, 0.8, 0.8, 0.6];
  extY(d, plan, rr, 1.1, PM.navy, 0, 0.7, 0, 0.04); extY(d, plan.map(([x, z]) => [x * 0.99, z * 0.96]), rr, 0.6, PM.antif, 0, -0.15, 0, 0.03);
  extY(d, plan.map(([x, z]) => [x * 0.94, z * 0.86]), 0.5, 0.05, PM.dark, 0, 1.26, 0, 0.01);
  tube(d, [[-3.6, 1.0, 1.55], [1.4, 1.0, 1.58], [3.0, 1.0, 1.02], [4.0, 1.0, 0], [3.0, 1.0, -1.02], [1.4, 1.0, -1.58], [-3.6, 1.0, -1.55], [-3.75, 1.0, 0]], 0.2, PM.greyL, true);
  ext(d, [[-1.9, 0], [1.2, 0], [1.6, 0.3], [1.0, 1.35], [-1.9, 1.35]], [0.05, 0.1, 0.2, 0.15, 0.1], 2.3, PM.orange, -0.2, 1.28, 0, 0.04);
  { const ws = box(d, 0.05, 0.8, 2.1, PM.glass, 1.08, 2.08, 0); ws.rotation.z = 0.55; }
  [1.16, -1.16].forEach((z) => { box(d, 1.6, 0.5, 0.04, PM.glass, -0.3, 2.25, z); });
  decal2(d, 'PILOTE', 1.9, 0.38, '#1d1f26', -0.6, 1.7, 1.17, null);
  rbox(d, 2.8, 0.1, 2.3, 0.04, PM.white, -0.6, 2.67, 0, 0.01);
  rail(d, [[-1.9, 2.75, 1.0], [-1.9, 3.0, 1.0], [0.5, 3.0, 1.0]], 0.025, PM.chrome); rail(d, [[-1.9, 2.75, -1.0], [-1.9, 3.0, -1.0], [0.5, 3.0, -1.0]], 0.025, PM.chrome);
  rod(d, new V3(-1.0, 2.7, 0), new V3(-1.0, 4.4, 0), 0.05, PM.white, 6);
  sph(d, 0.1, PM.lamp, -1.0, 4.45, 0); sph(d, 0.1, PM.redLamp, -1.0, 4.1, 0); // pilot signal: white over red
  cylY(d, 0.28, 0.2, PM.white, 0.0, 2.8, 0, 14); sph(d, 0.22, PM.white, 0.0, 2.9, 0).scale.y = 0.7; // radar dome
  rail(d, [[1.6, 1.3, 1.2], [1.6, 1.85, 1.2], [3.0, 1.85, 0.75], [3.6, 1.85, 0], [3.0, 1.85, -0.75], [1.6, 1.85, -1.2], [1.6, 1.3, -1.2]], 0.03, PM.chrome); // boarding rail at the bow
  rail(d, [[-3.4, 1.3, 1.3], [-3.4, 1.85, 1.3], [-3.6, 1.85, 0], [-3.4, 1.85, -1.3], [-3.4, 1.3, -1.3]], 0.03, PM.chrome);
  bake(d); shadows(g); return { g };
}

/** Ship-to-shore gantry crane, +x towards the sea. Returns parts that move. */
function stsCrane(S) {
  const G = grp(S), d = grp(G), C = PM.blue, CD = PM.blueD;
  const LX = 5.4, LZ = 6.5, GZ = 3.6, GY = 19.0;
  [[LX, LZ], [LX, -LZ], [-LX, LZ], [-LX, -LZ]].forEach(([x, z]) => {
    rbox(d, 1.2, GY - 1.6, 1.2, 0.08, C, x, (GY + 1.6) / 2, z, 0.03);
    rbox(d, 1.25, 1.0, 1.25, 0.05, MT.stripes, x, 2.1, z, 0.01);
    // bogies: an equaliser beam on two 4-wheel trucks running on the rail (along z)
    rbox(d, 1.0, 0.6, 5.4, 0.06, CD, x, 1.3, z, 0.02);
    [1.35, -1.35].forEach((bz) => { rbox(d, 0.9, 0.55, 2.4, 0.05, PM.dark, x, 0.75, z + bz, 0.02); for (let k = 0; k < 4; k++) cylX(d, 0.33, 0.34, PM.grey, x, 0.36, z + bz - 0.9 + k * 0.6, 12); });
    [2.8, -2.8].forEach((bz) => rbox(d, 0.5, 0.4, 0.25, 0.03, MT.stripes, x, 0.9, z + bz, 0.01)); // buffers
  });
  [LX, -LX].forEach((x) => { rbox(d, 1.3, 1.5, 2 * LZ + 1.2, 0.08, C, x, 13.2, 0, 0.03); [GZ, -GZ].forEach((z) => rbox(d, 1.2, 1.0, LZ - GZ + 1.0, 0.05, C, x, GY - 0.3, Math.sign(z) * (LZ + GZ) / 2, 0.02)); });
  [LZ, -LZ].forEach((z) => { rbox(d, 2 * LX, 1.1, 0.9, 0.06, C, 0, 13.2, z, 0.02); rod(d, new V3(LX, 13.8, z), new V3(1.2, GY - 0.6, z), 0.28, C, 6); rod(d, new V3(-LX, 13.8, z), new V3(-1.2, GY - 0.6, z), 0.28, C, 6); rbox(d, 2 * LX, 0.8, 0.8, 0.05, C, 0, GY - 0.6, z, 0.02); });
  // the trolley girders (land side) and the boom (over the water)
  [GZ, -GZ].forEach((z) => {
    rbox(d, 19.9, 1.6, 0.9, 0.06, C, -4.55, GY + 0.8, z, 0.02);
    ext(d, [[0, 0], [19.6, 0.4], [19.6, 1.3], [0, 1.6]], 0.05, 0.9, C, 5.4, GY, z, 0.02);
    rbox(d, 39.2, 0.12, 0.25, 0.03, PM.dark, 5.3, GY + 1.66, z, 0.01);             // trolley rail
    rail(d, [[-14.4, GY + 1.6, z + Math.sign(z) * 0.6], [-14.4, GY + 2.5, z + Math.sign(z) * 0.6], [24.6, GY + 2.3, z + Math.sign(z) * 0.6], [24.6, GY + 1.6, z + Math.sign(z) * 0.6]], 0.04, PM.yel); // walkway rail
    rbox(d, 39, 0.06, 0.8, 0.02, PM.grey, 5.2, GY + 1.6, z + Math.sign(z) * 0.85, 0.01);
    cylZ(d, 0.25, 0.7, PM.dark, 5.4, GY + 0.5, z, 12); // boom hinge
  });
  [-14.3, 24.8].forEach((x) => rbox(d, 0.8, 1.4, 2 * GZ + 0.9, 0.05, C, x, GY + 0.85, 0, 0.02));
  // A-frame with its tie rods holding the boom, a red warning light on top
  [GZ, -GZ].forEach((z) => {
    rod(d, new V3(LX, GY + 1.6, z), new V3(1.8, 31, z), 0.38, C, 8); rod(d, new V3(-LX, GY + 1.6, z), new V3(1.2, 31, z), 0.38, C, 8);
    rod(d, new V3(-LX + 1.2, 24, z), new V3(LX - 1.0, 24, z), 0.2, C, 6);
    [[13, GY + 1.5], [22.5, GY + 1.4]].forEach(([x, y]) => rod(d, new V3(1.8, 30.8, z), new V3(x, y, z), 0.1, PM.greyL, 6));
    rod(d, new V3(1.2, 30.8, z), new V3(-13.5, GY + 1.6, z), 0.1, PM.greyL, 6);
  });
  rbox(d, 1.4, 1.0, 2 * GZ + 1.2, 0.08, C, 1.5, 31.2, 0, 0.02); sph(d, 0.25, PM.redLamp, 1.5, 32, 0); sph(d, 0.2, PM.redLamp, 24.8, GY + 2.0, 0);
  // machinery house at the back with the hoist winches, a ladder up a leg
  rbox(d, 5.2, 3.2, 2 * GZ + 1.6, 0.12, PM.white, -11.6, GY + 3.2, 0, 0.03); rbox(d, 5.4, 0.3, 2 * GZ + 1.8, 0.05, C, -11.6, GY + 4.9, 0, 0.02);
  for (let x = -13.6; x < -9.5; x += 1.0) [1, -1].forEach((s) => box(d, 0.5, 0.6, 0.04, PM.glass, x, GY + 3.4, s * (GZ + 0.82)));
  decal2(d, 'BIDULE PORT', 4.4, 0.7, '#2453b8', -11.6, GY + 4.2, GZ + 0.82, null);
  for (let y = 2.8; y < GY - 0.5; y += 2.2) { const s = Math.round(y) % 2 ? 1 : -1; rod(d, new V3(-LX - 0.7, y, LZ - 0.6 * s), new V3(-LX - 0.7, y + 2.2, LZ + 0.6 * s), 0.05, PM.yel, 4); }
  rail(d, [[-LX - 0.75, 2.8, LZ - 0.7], [-LX - 0.75, GY, LZ - 0.7]], 0.03, PM.yel);
  bake(d);
  // trolley riding on the girders, the driver's cab hanging under it
  const trolley = grp(G, -4, GY + 1.7, 0); const td = grp(trolley);
  rbox(td, 3.2, 0.9, 2 * GZ + 1.0, 0.06, PM.white, 0, 0.5, 0, 0.02); rbox(td, 3.0, 0.1, 2 * GZ + 1.1, 0.03, CD, 0, 0.97, 0, 0.01);
  [1.2, -1.2].forEach((x) => [GZ, -GZ].forEach((z) => cylZ(td, 0.25, 0.4, PM.dark, x, 0.05, z, 10)));
  [0.5, -0.5].forEach((x) => [1.0, -1.0].forEach((z) => cylZ(td, 0.22, 0.3, PM.grey, x, -0.1, z, 10)));
  const cab = grp(trolley, 2.6, -2.9, 0); rbox(cab, 1.6, 1.8, 1.9, 0.12, PM.yel, 0, 0, 0, 0.03); box(cab, 0.05, 1.2, 1.6, PM.glass, 0.81, 0.1, 0); box(cab, 1.3, 0.05, 1.5, PM.glass, 0.1, -0.91, 0);
  [0.96, -0.96].forEach((z) => box(cab, 1.2, 0.9, 0.04, PM.glass, 0.1, 0.2, z)); rod(cab, new V3(0, 0.9, 0), new V3(0, 2.5, 0), 0.12, PM.grey, 6);
  operator(cab, -0.1, -0.85, 0).scale.setScalar(0.85);
  bake(td);
  // the spreader (a big yellow clamp) hanging on four ropes
  const spr = grp(G, -4, 12, 0); spreaderParts(spr, 'z');
  const ropes = [[0.5, 1.0], [0.5, -1.0], [-0.5, 1.0], [-0.5, -1.0]].map(([x, z]) => ({ s: seg(G, 0.04, PM.dark), x, z }));
  const a = new V3(), b = new V3();
  const update = () => { spr.position.x = trolley.position.x; ropes.forEach((r) => { a.set(trolley.position.x + r.x, GY + 1.6, r.z); b.set(spr.position.x + r.x * 0.9, spr.position.y + 1.25, r.z * 0.9); r.s.set(a, b); }); };
  update(); shadows(G);
  return { G, trolley, spr, cab, update, GY };
}
/** A spreader: origin at its underside (sits on the container top), long side along `axis`. */
function spreaderParts(g, axis) {
  const s = grp(g); if (axis === 'z') s.rotation.y = PI / 2;
  rbox(s, 1.6, 0.45, 1.5, 0.06, PM.yel, 0, 0.55, 0, 0.02);
  [0.45, -0.45].forEach((z) => rbox(s, 5.5, 0.32, 0.4, 0.04, PM.yel, 0, 0.3, z, 0.02));
  [2.6, -2.6].forEach((x) => { rbox(s, 0.42, 0.32, 2.3, 0.04, PM.yelD, x, 0.25, 0, 0.02); [1.0, -1.0].forEach((z) => { box(s, 0.25, 0.22, 0.25, PM.dark, x, 0.05, z); const f = rbox(s, 0.05, 0.5, 0.35, 0.02, PM.yel, x + Math.sign(x) * 0.25, -0.05, z, 0.01); f.rotation.z = Math.sign(x) * 0.4; }); });
  rbox(s, 1.3, 0.4, 1.2, 0.05, PM.dark, 0, 1.0, 0, 0.02); [0.4, -0.4].forEach((z) => cylX(s, 0.22, 0.16, PM.grey, 0, 1.15, z, 10));
  return s;
}

/** Straddle carrier facing +x: two wheeled side frames, tall legs, the cab on top at the front, spreader in between. */
function straddleCarrier(p, st) {
  const g = grp(p), d = grp(g), Y = PM.yel, K = PM.black, W = 1.95, TOP = 8.2;
  [W, -W].forEach((z) => {
    rbox(d, 8.6, 0.7, 0.6, 0.06, Y, 0, 1.45, z, 0.02); // lower side beam
    [3.2, -3.2].forEach((x) => { rbox(d, 0.65, TOP - 1.6, 0.6, 0.06, Y, x, (TOP + 1.6) / 2, z, 0.02); rbox(d, 0.68, 0.5, 0.63, 0.03, MT.stripes, x, 2.1, z, 0.01); });
    rod(d, new V3(3.0, 2.0, z), new V3(-0.6, TOP - 0.4, z), 0.12, Y, 6); rod(d, new V3(-3.0, 2.0, z), new V3(0.6, TOP - 0.4, z), 0.12, Y, 6);
    rbox(d, 8.0, 0.65, 0.6, 0.06, Y, 0, TOP, z, 0.02); // top side beam
    [3.3, 1.1, -1.1, -3.3].forEach((x) => { rbox(d, 0.5, 0.5, 0.35, 0.04, K, x, 0.95, z, 0.02); });
    rbox(d, 0.5, 0.06, 0.4, 0.02, K, 4.2, 1.2, z, 0.01);
  });
  [3.2, -3.2].forEach((x) => rbox(d, 0.6, 0.6, 2 * W + 0.6, 0.06, Y, x, TOP + 0.05, 0, 0.02));
  // engines and hoist on the top beams, exhausts, cab up front, ladder, lamps
  [W, -W].forEach((z) => { rbox(d, 3.4, 0.9, 0.9, 0.08, Y, -1.4, TOP + 0.75, z, 0.02); for (let i = 0; i < 5; i++) box(d, 0.05, 0.5, 0.92, K, -2.6 + i * 0.5, TOP + 0.8, z); cylY(d, 0.07, 0.7, PM.steel, -2.8, TOP + 1.5, z, 8); });
  const cab = grp(d, 3.9, TOP - 1.3, 0); rbox(cab, 1.4, 1.75, 1.6, 0.1, Y, 0, 0.9, 0, 0.02); box(cab, 0.05, 1.1, 1.4, PM.glass, 0.71, 1.0, 0); [0.81, -0.81].forEach((z) => box(cab, 1.1, 0.95, 0.04, PM.glass, 0.05, 1.05, z)); box(cab, 1.0, 0.05, 1.3, PM.glass, 0.1, 0.0, 0);
  rbox(cab, 1.6, 0.12, 1.8, 0.04, K, 0, 1.82, 0, 0.01); operator(cab, -0.1, 0.1, 0).scale.setScalar(0.85);
  [0.6, -0.6].forEach((z) => rbox(cab, 0.06, 0.12, 0.3, 0.03, PM.lamp, 0.72, 1.7, z, 0.01));
  for (let y = 2.0; y < TOP - 0.3; y += 0.4) box(d, 0.04, 0.04, 0.45, K, -3.6, y, W + 0.35); rail(d, [[-3.6, 1.8, W + 0.12], [-3.6, TOP, W + 0.12]], 0.025, K); rail(d, [[-3.6, 1.8, W + 0.58], [-3.6, TOP, W + 0.58]], 0.025, K);
  [W, -W].forEach((z) => { rbox(d, 0.06, 0.14, 0.3, 0.03, PM.lamp, 4.33, 1.5, z, 0.01); rbox(d, 0.06, 0.14, 0.3, 0.03, PM.tail, -4.33, 1.5, z, 0.01); });
  decal2(d, 'BIDULE', 2.6, 0.45, '#1d1f26', 0, TOP, W + 0.31, null);
  bake(d);
  beacon(st, g, 3.9, TOP + 0.55, 0.5);
  const wheels = [];
  [3.3, 1.1, -1.1, -3.3].forEach((x) => [W, -W].forEach((z) => wheels.push(tire(g, 0.55, 0.42, x, 0.55, z, PM.grey, Math.sign(z)))));
  const spr = grp(g, 0, 5, 0); spreaderParts(spr, 'x');
  const ropes = [[1.6, 0.5], [1.6, -0.5], [-1.6, 0.5], [-1.6, -0.5]].map(([x, z]) => ({ s: seg(g, 0.035, PM.dark), x, z }));
  const a = new V3(), b = new V3();
  const update = () => ropes.forEach((r) => { a.set(r.x, TOP - 0.3, r.z * 3.6); b.set(r.x * 0.7, spr.position.y + 1.2, r.z * 0.8); r.s.set(a, b); });
  update(); shadows(g);
  return { g, wheels, spr, update, cab };
}

/** Reach stacker facing +x: heavy chassis, counterweight, cab in the middle, telescopic boom with a spreader across the front. */
function reachStacker(p, st) {
  const g = grp(p), d = grp(g), R = PM.red, K = PM.black;
  ext(d, [[-4.4, 0.55], [3.0, 0.55], [3.3, 0.9], [3.2, 1.7], [-4.0, 1.75], [-4.5, 1.3]], 0.12, 2.8, R, 0, 0, 0, 0.04);
  rbox(d, 1.3, 1.8, 2.9, 0.12, PM.dark, -4.0, 2.2, 0, 0.03); rbox(d, 1.32, 0.3, 2.92, 0.03, MT.stripes, -4.0, 1.65, 0, 0.01); // counterweight
  rbox(d, 2.0, 1.0, 2.4, 0.15, R, -2.6, 2.2, 0, 0.03); for (let i = 0; i < 6; i++) box(d, 0.05, 0.6, 2.42, K, -3.4 + i * 0.3, 2.25, 0); // engine hood
  cylY(d, 0.08, 1.1, PM.steel, -3.0, 3.1, -1.0, 8);
  // the cab: glass all round, the driver inside
  const cab = grp(d, -0.6, 1.75, 0.0); rbox(cab, 1.7, 0.2, 1.5, 0.05, K, 0, 0.1, 0, 0.01);
  [[0.8, 0.7], [0.8, -0.7], [-0.8, 0.7], [-0.8, -0.7]].forEach(([x, z]) => box(cab, 0.08, 1.8, 0.08, K, x, 1.0, z));
  box(cab, 1.56, 1.5, 1.36, PM.glassL, 0, 1.05, 0); rbox(cab, 1.9, 0.12, 1.7, 0.04, R, 0, 1.95, 0, 0.01);
  operator(cab, -0.1, 0.2, 0).scale.setScalar(0.85);
  [1, -1].forEach((s) => { rbox(d, 0.5, 0.06, 0.3, 0.02, K, -0.5, 1.2, s * 1.45, 0.01); rbox(d, 0.06, 0.12, 0.25, 0.03, PM.lamp, 3.28, 1.4, s * 1.1, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.03, PM.tail, -4.66, 2.6, s * 1.2, 0.01); });
  decal2(d, 'BIDULE', 2.2, 0.38, '#ffffff', 0.9, 1.2, 1.41, null);
  bake(d);
  beacon(st, g, -0.6, 3.85, 0);
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.9, 0.55, 1.9, 0.9, s * 1.05, PM.grey, s)); wheels.push(tire(g, 0.9, 0.55, 1.9, 0.9, s * 1.62, PM.grey, s)); wheels.push(tire(g, 0.8, 0.5, -2.8, 0.8, s * 1.35, PM.grey, s)); });
  [1, -1].forEach((s) => { fender(g, 1.0, 1.2, 1.9, 0.9, s * 1.35, PM.redD, PI * 0.5); });
  // boom: pivot at the back on top, an outer box and an inner box that slides out
  const PV = new V3(-3.2, 3.6, 0), LB = 8.0;
  const boom = grp(g, PV.x, PV.y, 0); boom.rotation.z = 0.12;
  rbox(boom, LB, 0.85, 0.75, 0.08, R, LB / 2, 0, 0, 0.02); cylZ(boom, 0.35, 1.2, PM.dark, 0, 0, 0, 12);
  rbox(boom, LB - 0.4, 0.06, 0.06, 0.01, PM.redD, LB / 2, 0.44, 0, 0.01);
  const inner = grp(boom, 0, 0, 0); rbox(inner, 5.0, 0.62, 0.55, 0.06, PM.greyL, LB - 2.3, 0, 0, 0.02);
  const tip = grp(inner, LB + 0.2, 0, 0); cylZ(tip, 0.3, 0.8, PM.dark, 0, 0, 0, 10);
  const head = grp(tip, 0, 0, 0); rbox(head, 0.9, 1.0, 0.9, 0.08, PM.dark, 0, -0.55, 0, 0.02);
  const spr = grp(head, 0, -1.3, 0); spreaderParts(spr, 'z');
  const cyls = [0.5, -0.5].map((z) => { const A = anchor(d, 1.4, 1.5, z), B = anchor(boom, 3.6, -0.4, z); return hydraulic(g, A, B, { barrel: 2.0, mat: PM.redD, rb: 0.14 }); });
  // aim(x, y): put the spreader's underside at machine-local point (x, y)
  const aim = (x, y) => { const tx = x - PV.x, ty = y + 1.3 - PV.y, L = Math.hypot(tx, ty), a = Math.atan2(ty, tx); boom.rotation.z = a; head.rotation.z = -a; inner.position.x = Math.max(0, Math.min(5, L - LB - 0.2)); };
  const update = () => cyls.forEach((c) => c.update());
  shadows(g); return { g, wheels, boom, inner, head, spr, aim, update };
}

/** Container truck: tractor (origin at the fifth wheel) and a skeletal trailer (origin at the king pin). */
function containerTruck(p, st, col = PM.blue) {
  const T = grp(p), d = grp(T);
  [0.42, -0.42].forEach((z) => rbox(d, 5.0, 0.3, 0.16, 0.03, PM.black, 1.3, 0.97, z));
  truckCab(d, col, 2.0);
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.14, 0.24, 0.02, PM.white, 3.0, 2.5, s * 0.6, 0.01); cylX(d, 0.28, 1.0, PM.chrome, 1.1, 0.9, s * 0.95, 14); rbox(d, 0.4, 0.5, 0.5, 0.04, PM.dark, 0.3, 0.85, s * 0.9, 0.02); });
  rbox(d, 2.4, 0.05, 2.05, 0.02, col, 3.1, 3.1, 0, 0.01); // stripe on the roof edge
  cylY(d, 0.09, 1.8, PM.chrome, 1.8, 2.4, 0.9, 10); cylY(d, 0.1, 0.1, PM.black, 1.8, 3.35, 0.9, 10);
  cylY(d, 0.5, 0.12, PM.dark, 0, 1.2, 0, 16); rbox(d, 0.8, 0.12, 1.6, 0.03, PM.dark, -0.3, 1.1, 0, 0.01);
  [1, -1].forEach((s) => { rbox(d, 1.4, 0.06, 0.55, 0.02, PM.dark, -0.3, 1.35, s * 1.0, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, PM.tail, -1.2, 1.0, s * 0.8, 0.01); });
  bake(d);
  const tw0 = []; [1, -1].forEach((s) => { tw0.push(tire(T, 0.52, 0.36, 3.3, 0.52, s * 0.92, PM.greyL, s)); tw0.push(tire(T, 0.52, 0.3, -0.3, 0.52, s * 0.82, PM.greyL, s)); tw0.push(tire(T, 0.52, 0.3, -0.3, 0.52, s * 1.14, PM.greyL, s)); });
  beacon(st, T, 3.0, 3.05, 0);
  const R = grp(p), e = grp(R);
  [0.5, -0.5].forEach((z) => { rbox(e, 8.4, 0.38, 0.18, 0.03, PM.dark, -3.5, 1.15, z, 0.01); });
  rbox(e, 2.1, 0.3, 2.3, 0.04, PM.dark, 0.25, 1.32, 0, 0.01); // gooseneck
  [-1.6, -7.0].forEach((x) => { rbox(e, 0.3, 0.3, 2.45, 0.04, PM.dark, x, 1.3, 0, 0.01); [1.05, -1.05].forEach((z) => box(e, 0.2, 0.15, 0.2, PM.yel, x, 1.48, z)); });
  for (let x = -2.6; x > -6.5; x -= 1.0) rbox(e, 0.12, 0.16, 2.2, 0.02, PM.dark, x, 1.25, 0, 0.01);
  [1, -1].forEach((s) => { rod(e, new V3(-1.4, 1.1, s * 0.85), new V3(-1.4, 0.18, s * 0.85), 0.06, PM.grey, 6); rbox(e, 0.3, 0.06, 0.3, 0.02, PM.grey, -1.4, 0.15, s * 0.85, 0.01);
    rbox(e, 0.04, 0.5, 0.5, 0.02, PM.black, -7.45, 0.75, s * 0.85, 0.01); rbox(e, 0.06, 0.14, 0.3, 0.02, PM.tail, -7.62, 1.05, s * 0.8, 0.01); rbox(e, 0.06, 0.1, 0.12, 0.02, PM.amber, -7.62, 1.05, s * 1.1, 0.01);
    rbox(e, 2.3, 0.06, 0.08, 0.02, PM.steel, -6.3, 0.7, s * 1.15, 0.01); });
  rbox(e, 0.12, 0.2, 2.3, 0.04, MT.stripes, -7.6, 0.75, 0, 0.01);
  bake(e);
  const tw1 = []; [-5.8, -7.0].forEach((x) => [1, -1].forEach((s) => { tw1.push(tire(R, 0.48, 0.3, x, 0.48, s * 0.82, PM.greyL, s)); tw1.push(tire(R, 0.48, 0.3, x, 0.48, s * 1.12, PM.greyL, s)); }));
  shadows(T); shadows(R);
  return { T, R, tw0, tw1, slot: new V3(-4.3, 1.45, 0) };
}

/** Diesel freight locomotive facing +x (cabs at both ends), and a flat container wagon. */
function locomotive(p) {
  const g = grp(p), d = grp(g), R = PM.red, K = PM.black;
  rbox(d, 12.0, 0.45, 2.8, 0.05, PM.dark, 0, 1.45, 0, 0.02);
  ext(d, [[-5.9, 1.65], [5.9, 1.65], [6.05, 2.6], [5.55, 3.5], [5.0, 3.85], [-5.0, 3.85], [-5.55, 3.5], [-6.05, 2.6]], [0.05, 0.05, 0.15, 0.2, 0.2, 0.2, 0.2, 0.15], 2.75, R, 0, 0, 0, 0.04);
  [1, -1].forEach((s) => {
    const ws = box(d, 0.05, 0.75, 2.2, PM.glass, s * 5.8, 3.1, 0); ws.rotation.z = s * 0.52; // windscreens
    ext(d, [[5.9, 1.7], [6.06, 2.6], [5.75, 2.75], [5.7, 1.7]].map(([x, y]) => [s * x, y]), 0.02, 2.77, PM.yel, 0, 0, 0, 0.01); // yellow warning nose
    [1, -1].forEach((zs) => { rbox(d, 0.06, 0.16, 0.24, 0.03, PM.lamp, s * 6.08, 2.25, zs * 0.85, 0.01); rbox(d, 0.06, 0.12, 0.16, 0.03, PM.tail, s * 6.08, 2.0, zs * 1.1, 0.01); });
    sph(d, 0.1, PM.lamp, s * 5.05, 3.75, 0);
    [0.95, -0.95].forEach((z) => { cylX(d, 0.2, 0.4, PM.dark, s * 6.15, 1.45, z, 12); cylX(d, 0.24, 0.06, PM.steel, s * 6.36, 1.45, z, 12); });
    rbox(d, 0.4, 0.25, 0.3, 0.04, PM.dark, s * 6.2, 1.2, 0, 0.01);
    [1, -1].forEach((zs) => { box(d, 0.6, 0.7, 0.04, PM.glass, s * 4.6, 3.0, zs * 1.385); box(d, 0.03, 1.6, 0.03, K, s * 4.2, 2.5, zs * 1.39); rail(d, [[s * 5.4, 1.2, zs * 1.42], [s * 5.4, 2.6, zs * 1.42]], 0.025, PM.yel); rbox(d, 0.45, 0.05, 0.3, 0.01, K, s * 5.2, 0.95, zs * 1.3, 0.01); });
  });
  [1, -1].forEach((zs) => { rail(d, [[-3.8, 2.2, zs * 1.42], [3.8, 2.2, zs * 1.42]], 0.025, PM.greyL); for (let x = -3.4; x < 3.6; x += 1.2) rbox(d, 0.9, 0.9, 0.04, 0.02, PM.redD, x, 2.85, zs * 1.385, 0.01); box(d, 9.0, 0.16, 0.03, PM.white, 0, 2.15, zs * 1.39); });
  decal2(d, 'BIDULE FRET', 3.2, 0.45, '#ffffff', 0, 3.42, 1.39, null);
  rbox(d, 9.6, 0.2, 2.0, 0.04, PM.grey, 0, 3.92, 0, 0.01); [-2.4, -1.0, 0.4].forEach((x) => { cylY(d, 0.5, 0.12, PM.dark, x, 4.05, 0, 16); });
  cylY(d, 0.12, 0.4, PM.dark, 2.0, 4.15, 0.3, 8); cylX(d, 0.07, 0.4, PM.chrome, 3.2, 4.05, -0.4, 8); // exhaust, horn
  [3.5, -3.5].forEach((x) => { rbox(d, 3.6, 0.7, 2.4, 0.08, PM.dark, x, 0.85, 0, 0.02); [1, -1].forEach((zs) => { for (let k = -1; k <= 1; k++) cylZ(d, 0.18, 0.08, PM.yel, x + k * 1.2, 0.95, zs * 1.22, 10); }); });
  rbox(d, 2.6, 0.5, 1.4, 0.05, PM.dark, 0, 0.95, 0, 0.02);
  bake(d);
  const wheels = []; [3.5, -3.5].forEach((x) => [-1.2, 0, 1.2].forEach((k) => wheels.push(tire(g, 0.5, 0.2, x + k, 0.5, 0.72, PM.dark, 1, PM.steel), tire(g, 0.5, 0.2, x + k, 0.5, -0.72, PM.dark, -1, PM.steel))));
  shadows(g); return { g, wheels };
}
function flatWagon(p) {
  const g = grp(p), d = grp(g);
  rbox(d, 13.0, 0.35, 2.6, 0.04, PM.greyL, 0, 1.3, 0, 0.02); [1.25, -1.25].forEach((z) => rbox(d, 13.0, 0.45, 0.12, 0.02, PM.grey, 0, 1.2, z, 0.01));
  [5.55, 0.15, -0.15, -5.55].forEach((x) => [1.05, -1.05].forEach((z) => box(d, 0.2, 0.18, 0.2, PM.yel, x, 1.55, z)));
  [1, -1].forEach((s) => { [0.95, -0.95].forEach((z) => { cylX(d, 0.18, 0.4, PM.dark, s * 6.65, 1.2, z, 12); cylX(d, 0.22, 0.05, PM.steel, s * 6.86, 1.2, z, 12); }); rbox(d, 0.3, 0.2, 0.3, 0.04, PM.dark, s * 6.6, 1.0, 0, 0.01); rbox(d, 2.6, 0.55, 2.1, 0.05, PM.dark, s * 4.6, 0.78, 0, 0.02); });
  add(d, new THREE.TorusGeometry(0.22, 0.03, 6, 14), PM.dark, -6.2, 1.9, 1.15); rod(d, new V3(-6.2, 1.4, 1.15), new V3(-6.2, 1.9, 1.15), 0.03, PM.dark, 4);
  bake(d);
  const wheels = []; [4.6, -4.6].forEach((x) => [-0.9, 0.9].forEach((k) => wheels.push(tire(g, 0.45, 0.18, x + k, 0.45, 0.72, PM.dark, 1, PM.steel), tire(g, 0.45, 0.18, x + k, 0.45, -0.72, PM.dark, -1, PM.steel))));
  shadows(g); return { g, wheels, slots: [new V3(2.85, 1.55, 0), new V3(-2.85, 1.55, 0)] };
}

/** Rail-mounted gantry crane over the track: two A-shaped leg frames, a girder across, a trolley with its cab and spreader. z runs across the track. */
function railGantry(p, z0, z1) {
  const g = grp(p), d = grp(g), O = PM.orange, H = 11, zc = (z0 + z1) / 2;
  [z0, z1].forEach((z) => {
    rbox(d, 7.6, 0.7, 0.9, 0.06, O, 0, 0.95, z, 0.02);
    [3.4, -3.4].forEach((x) => { rbox(d, 1.3, 0.5, 0.8, 0.04, PM.dark, x, 0.45, z, 0.02); [0.35, -0.35].forEach((k) => cylZ(d, 0.25, 0.3, PM.grey, x + k, 0.28, z, 10)); rbox(d, 0.4, 0.4, 0.4, 0.03, MT.stripes, x + Math.sign(x) * 0.85, 0.8, z, 0.01); });
    rod(d, new V3(3.4, 1.2, z), new V3(0.9, H, z), 0.35, O, 8); rod(d, new V3(-3.4, 1.2, z), new V3(-0.9, H, z), 0.35, O, 8);
    rod(d, new V3(2.3, 5.2, z), new V3(-2.3, 5.2, z), 0.18, O, 6);
  });
  [1.0, -1.0].forEach((x) => { rbox(d, 1.0, 1.3, Math.abs(z1 - z0) + 4.4, 0.06, O, x, H + 0.6, zc, 0.02); rbox(d, 0.25, 0.1, Math.abs(z1 - z0) + 4.2, 0.02, PM.dark, x, H + 1.3, zc, 0.01); });
  rbox(d, 3.0, 1.2, 1.6, 0.08, PM.white, 0, H + 1.9, z1 + 1.4, 0.02);
  for (let y = 1.6; y < H; y += 0.4) box(d, 0.45, 0.04, 0.04, PM.dark, -2.0, y, z1 - 0.5);
  sph(d, 0.18, PM.amber, 0, H + 2.6, z1 + 1.4);
  bake(d);
  const trolley = grp(g, 0, H + 1.35, zc); rbox(trolley, 2.8, 0.7, 2.2, 0.06, PM.white, 0, 0.35, 0, 0.02);
  const cab = grp(trolley, 1.8, -1.6, 0); rbox(cab, 1.2, 1.4, 1.4, 0.1, PM.yel, 0, 0, 0, 0.02); box(cab, 0.05, 0.9, 1.2, PM.glass, 0.61, 0.1, 0); operator(cab, -0.1, -0.68, 0).scale.setScalar(0.75);
  const spr = grp(g, 0, 6, zc); spreaderParts(spr, 'x');
  const ropes = [[1.2, 0.4], [1.2, -0.4], [-1.2, 0.4], [-1.2, -0.4]].map(([x, z]) => ({ s: seg(g, 0.035, PM.dark), x, z }));
  const a = new V3(), b = new V3();
  const update = () => { spr.position.z = trolley.position.z; ropes.forEach((r) => { a.set(r.x * 0.6, H + 1.3, trolley.position.z + r.z); b.set(r.x * 0.6, spr.position.y + 1.2, spr.position.z + r.z); r.s.set(a, b); }); };
  update(); shadows(g); return { g, trolley, spr, update };
}

/* ================= data, icons, layout ================= */
const DATA = {
  navire: { short: 'Le porte-conteneurs', full: 'Le porte-conteneurs', verb: 'Arriver', horn: 'horn',
    use: 'Un bateau géant qui transporte des boîtes en métal : les conteneurs.',
    how: "Il traverse la mer pendant des jours et des jours. Ses conteneurs sont empilés comme des briques de jeu." },
  pilote: { short: 'Le bateau-pilote', full: 'Le bateau-pilote', verb: 'Guider', horn: 'horn',
    use: "Il emmène le pilote jusqu'aux grands bateaux qui arrivent.",
    how: "Le pilote connaît très bien le port. Il grimpe à bord par une échelle de corde, et il montre le chemin au capitaine." },
  remorqueur: { short: 'Le remorqueur', full: 'Le remorqueur', verb: 'Remorquer', horn: 'horn',
    use: 'Un petit bateau très, très fort, qui tire et pousse les gros bateaux.',
    how: "Derrière, son treuil enroule un gros câble pour tirer. Devant, son nez en caoutchouc pousse sans rien abîmer." },
  portique: { short: 'Le portique', full: 'Le portique à conteneurs', verb: 'Décharger', horn: 'bell',
    use: 'Une grue géante qui sort les conteneurs du bateau.',
    how: 'Une petite cabine roule tout là-haut, sur la grande flèche. En dessous, une grosse pince attrape les conteneurs par les coins.' },
  cavalier: { short: 'Le cavalier', full: 'Le cavalier', verb: 'Transporter', horn: 'horn',
    use: "Il emporte les conteneurs du quai jusqu'aux piles.",
    how: "Il a de grandes jambes, comme un cheval très haut ! Il passe au-dessus du conteneur et le soulève entre ses jambes." },
  chariot: { short: 'Le chariot', full: 'Le chariot porte-conteneurs', verb: 'Charger', horn: 'horn',
    use: 'Il prend les conteneurs sur les piles et les pose sur les camions.',
    how: 'Son grand bras se lève et s’allonge. Au bout, une pince tient le conteneur bien serré.' },
  camion: { short: 'Le camion', full: 'Le camion porte-conteneur', verb: 'Livrer', horn: 'horn',
    use: 'Il emporte un conteneur sur la route, jusqu’au magasin.',
    how: 'Sa remorque est faite pour les conteneurs : quatre petits verrous les tiennent bien.' },
  train: { short: 'Le train', full: 'Le train de marchandises', verb: 'Charger', horn: 'horn',
    use: "Il emporte beaucoup de conteneurs d'un coup, très loin.",
    how: 'Un portique sur rails pose les conteneurs sur les wagons. Puis la locomotive tire tout le train.' }
};
const ORDER = ['navire', 'pilote', 'remorqueur', 'portique', 'cavalier', 'chariot', 'camion', 'train'];
const GND = '<path class="gnd" d="M4 75H116"/>', SEAI = '<path d="M0 62q15-4 30 0t30 0 30 0 30 0V80H0z" fill="#3f8fe0"/>';
const ICONS = {
  navire: SEAI + `<path d="M4 46h104l-8 18H14z" fill="#1d3a7a"/><path d="M14 64h86l2-5H12z" fill="#c0302a"/><rect x="10" y="20" width="16" height="26" fill="#f4f5f8"/><rect class="g" x="12" y="24" width="12" height="4"/><rect x="14" y="12" width="7" height="8" fill="#e5452c"/>
    <rect x="32" y="34" width="14" height="12" fill="#d8402a"/><rect x="46" y="34" width="14" height="12" fill="#2f6fe0"/><rect x="60" y="34" width="14" height="12" fill="#f2b21c"/><rect x="74" y="34" width="14" height="12" fill="#3aa46a"/><rect x="32" y="22" width="14" height="12" fill="#3aa46a"/><rect x="46" y="22" width="14" height="12" fill="#ee7a26"/><rect x="60" y="22" width="14" height="12" fill="#1f9aa8"/><rect x="74" y="22" width="14" height="12" fill="#d8402a"/>`,
  pilote: SEAI + `<path d="M14 50h80l-10 14H22z" fill="#1d3a7a"/><path d="M18 50h76" stroke="#c6cad4" stroke-width="5" stroke-linecap="round"/><path d="M34 48V32h32l10 16z" fill="#f26a2a"/><path class="g" d="M66 34l8 12h-8z"/><path d="M38 40h22" stroke="#1d1f26" stroke-width="3"/><path d="M44 32V18" stroke="#f4f5f8" stroke-width="2.5"/><circle cx="44" cy="17" r="3" fill="#fff"/><circle cx="44" cy="24" r="3" fill="#e5452c"/>`,
  remorqueur: SEAI + `<path d="M10 46h84q12 0 12 8l-6 10H18z" fill="#d8302a"/><path d="M96 48q12 0 12 8" stroke="#222428" stroke-width="7" fill="none" stroke-linecap="round"/><rect class="w" x="44" y="34" width="30" height="12" rx="2"/><rect class="w" x="50" y="22" width="22" height="12" rx="2"/><rect class="g" x="52" y="25" width="18" height="5"/><rect x="38" y="28" width="5" height="14" fill="#f2b21c"/><circle cx="24" cy="42" r="5" fill="#d8302a" stroke="#9a1f1a" stroke-width="2"/><path d="M4 42h14" stroke="#e8d6a0" stroke-width="2"/>`,
  portique: GND + `<path d="M4 75h40" stroke="#3f8fe0" stroke-width="6"/><path d="M54 74V22M84 74V22" stroke="#2f6fe0" stroke-width="5"/><path d="M8 20h110v6H8z" fill="#2f6fe0"/><path d="M60 20L70 4l8 16M70 4L16 20M70 4l44 16" stroke="#2f6fe0" stroke-width="2.5" fill="none"/><rect x="88" y="10" width="14" height="10" fill="#f4f5f8"/>
    <rect x="22" y="27" width="10" height="7" fill="#f2b21c"/><path class="ln" d="M27 34v14"/><rect x="18" y="48" width="18" height="10" fill="#ee7a26"/>`,
  cavalier: GND + `<rect class="y" x="22" y="14" width="74" height="7" rx="2"/><rect class="y" x="26" y="20" width="7" height="44"/><rect class="y" x="84" y="20" width="7" height="44"/><rect class="y" x="16" y="60" width="86" height="6" rx="2"/><rect class="y" x="88" y="8" width="16" height="14" rx="2"/><rect class="g" x="96" y="10" width="7" height="8"/>
    <rect x="38" y="36" width="40" height="18" fill="#2f6fe0"/><path class="ln" d="M44 22v14M72 22v14"/><circle class="k" cx="22" cy="70" r="5"/><circle class="k" cx="40" cy="70" r="5"/><circle class="k" cx="78" cy="70" r="5"/><circle class="k" cx="96" cy="70" r="5"/>`,
  chariot: GND + `<path d="M14 52h56v12H14z" fill="#d8302a"/><rect x="6" y="44" width="14" height="20" fill="#2b3040"/><rect class="g" x="38" y="34" width="16" height="16" rx="2"/><path d="M22 40L96 18" stroke="#d8302a" stroke-width="7" stroke-linecap="round"/><rect x="88" y="22" width="30" height="16" fill="#3aa46a"/><rect class="y" x="90" y="18" width="26" height="4"/>
    <circle class="k" cx="58" cy="66" r="9"/><circle class="k" cx="24" cy="68" r="7"/>`,
  camion: GND + `<rect x="10" y="32" width="66" height="22" fill="#d8402a"/><path class="ln" d="M20 32v22M30 32v22M40 32v22M50 32v22M60 32v22"/><rect class="k" x="8" y="54" width="72" height="4"/><rect class="b" x="80" y="30" width="26" height="28" rx="4"/><rect class="g" x="92" y="34" width="12" height="10"/>
    <circle class="k" cx="20" cy="64" r="7"/><circle class="k" cx="36" cy="64" r="7"/><circle class="k" cx="96" cy="64" r="7"/>`,
  train: GND + `<path d="M2 72h116" stroke="#8a7a6a" stroke-width="4"/><rect x="62" y="34" width="52" height="24" rx="4" fill="#d8302a"/><path d="M106 34l8 10v14h-8z" fill="#f2b21c"/><rect class="g" x="100" y="38" width="8" height="8"/><rect class="k" x="4" y="54" width="56" height="5"/><rect x="6" y="38" width="24" height="16" fill="#2f6fe0"/><rect x="32" y="38" width="24" height="16" fill="#3aa46a"/>
    <circle class="k" cx="14" cy="64" r="5"/><circle class="k" cx="48" cy="64" r="5"/><circle class="k" cx="72" cy="64" r="5"/><circle class="k" cx="104" cy="64" r="5"/>`
};

const CFG = {
  navire: CF(2, -20), pilote: CF(36, -36), remorqueur: CF(37, -17.3), portique: CF(0.4, -7, 3 * PI / 4),
  cavalier: CF(-16, -7), chariot: CF(-30, 14.5, 3 * PI / 4), camion: CF(-25.7, 24), train: CF(12.5, 31)
};
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
rect(0, -7, 120, 14, '#a3a6b6');                                        // quay apron
rect(0, DQ + 0.35, 120, 0.7, '#e9e4d4'); rect(0, DQ + 0.9, 120, 0.25, '#f2b21c');
[-12.4, -1.6].forEach((d) => rect(0, d, 120, 0.5, '#5c5e70'));          // crane rails
rect(14, 9, 54, 18, '#7a7d90'); rect(-30, 14, 26, 22, '#7a7d90');       // the stacking yards
for (let h = -12; h <= 40; h += 4.6) rect(h + 2.3, 9, 0.18, 17, '#f3efe2', 0.6);
rect(-27, 24, 48, 3.6, '#5c5e70'); for (let h = -48; h < -6; h += 3) rect(h, 24, 1.4, 0.14, '#f3efe2');
rect(0, 31, 104, 3.4, '#8a7a6a'); [24.6, 34.2].forEach((d) => rect(14, d, 34, 0.5, '#5c5e70'));
rect(-11.5, 31, 4, 3.6, '#5c5e70'); rect(-11.5, 33.8, 4, 6, '#5c5e70', 0.9);
rect(0, 40, 100, 5.6, '#4a4c5e'); for (let h = -48; h < 48; h += 3) rect(h, 40, 1.4, 0.14, '#f3efe2');
rect(0, 43.6, 90, 1.8, '#d9d3e2');
blob(-20, 52, 10, 'rgba(110,170,100,.9)'); blob(20, 52, 10, 'rgba(110,170,100,.9)'); blob(0, 55, 9, 'rgba(120,180,110,.9)');
blob(-48, 6, 9, 'rgba(110,170,100,.6)'); blob(48, 8, 9, 'rgba(110,170,100,.7)'); blob(44, -8, 6, 'rgba(110,170,100,.6)');

export default {
  id: 'port', title: 'Le Port', titleHtml: 'Le <span>Port</span>',
  subtitle: 'Un grand port au bord de la mer : les bateaux arrivent, une grue géante décharge les conteneurs, des camions et des trains les emportent.',
  welcome: 'Bienvenue au port ! Touche un bateau ou une machine pour voir comment il travaille.',
  hint: 'Touche un bateau ou une machine.', backLabel: 'Tout le port',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h26l-4 6H7z"/><path d="M7 20v-5h6v5M13 20v-5h6v5M19 20v-8h6v8"/><path d="M2 29q3-2 6 0t6 0 6 0 6 0"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: RAD, tufts: false, forest: false, outerColor: 0x2f7fd0,
  overview: { w: 104, h: 74, focus: [Q(2, -4)[0], 3, Q(2, -4)[1]] },
  ground: { base: ['#b3b6c4', '#a5a8b8', '#9a9db0'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 220); onUpdate((dt) => fx.update(dt));
    makeSea(scene, onUpdate);
    freeze(buildPort(grp(scene)));
    const W = {}; // what the machines hand over to each other
    const loc = (S, h, d) => { S.updateMatrixWorld(true); const [x, z] = Q(h, d); const v = S.worldToLocal(new V3(x, 0, z)); return [v.x, v.z]; };
    const along = (obj, r, s0, s1, dur, ease = easeSine, yOff = 0) => tw(dur, (k) => placeOn(obj, r, s0 + (s1 - s0) * k, yOff), ease);
    const sOf = (r, x, z) => { let best = 0, bd = 1e9; const n = 400, P = new V3(); for (let i = 0; i <= n; i++) { r.curve.getPointAt(i / n, P); const dd = Math.hypot(P.x - x, P.z - z); if (dd < bd) { bd = dd; best = (i / n) * r.len; } } return best; };
    const spin = (obj, wheels, R = 0.5) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const dd = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (dd) wheels.forEach((w) => (w.rotation.z -= dd / (w.userData.r || R))); return dd; }; };
    const wake = (obj, x, z, speed, n = 1) => { for (let i = 0; i < n; i++) fx.smoke(obj.localToWorld(new V3(x, 0.15, z + rnd(-0.4, 0.4))), new V3(rnd(-0.4, 0.4), rnd(0.1, 0.4), rnd(-0.4, 0.4)), rnd(0.3, 0.6) * Math.min(2, 0.5 + speed), 0xf4f8ff, rnd(1.2, 2)); };
    const boatWake = (obj, len, half) => { const p = obj.userData.prev || obj.position.clone(); const v = obj.position.distanceTo(p) * 60; obj.userData.prev = obj.position.clone(); if (v > 0.15 && Math.random() < 0.7) { wake(obj, -len, 0, v); wake(obj, len * 0.9, half * (Math.random() < 0.5 ? 1 : -1), v * 0.5); } };
    const shipHorn = () => { tone(110, 0, 1.4, 'sawtooth', 0.05, 104); tone(165, 0, 1.4, 'sawtooth', 0.03, 158); };

    /* ---- le porte-conteneurs : il arrive, les remorqueurs le poussent, on l'amarre ---- */
    (function () {
      const st = makeStation('navire'), S = st.g; S.position.y = SEA;
      const SH = containerShip(S); const ship = SH.g; st.m = ship; W.ship = ship; W.kp = SH.kp; W.kpHome = SH.kp.position.clone(); W.kpState = 'ship'; W.shipRadar = SH.radar;
      // two helper tugs moored at the tug base, at the far end of the quay
      const homes = [loc(S, -33, -16.3), loc(S, -45, -16.3)];
      const tugs = [tugBoat(S, PM.red, 'HERCULE'), tugBoat(S, PM.red, 'SAMSON')];
      tugs.forEach((t, i) => { t.g.position.set(homes[i][0], 0, homes[i][1]); t.g.rotation.y = 0; });
      // mooring lines: ship bollards → quay bollards (the quay is at z ≈ +6, 1.8 above the water)
      const lines = [[[20.8, 6.2, 4.4], [29, 2.0, 6.6]], [[15, 6.2, 4.7], [8, 2.0, 6.6]], [[-14, 4.9, 4.9], [-6, 2.0, 6.6]], [[-21.8, 4.9, 4.4], [-30, 2.0, 6.6]]]
        .map(([a, b]) => { const A = new V3(...a), B = new V3(...b), M = A.clone().lerp(B, 0.5); M.y -= 0.5; const s1 = seg(S, 0.06, PM.rope), s2 = seg(S, 0.06, PM.rope); s1.set(A, M); s2.set(M, B); return { A, B, M, s1, s2 }; });
      const setLine = (l, k) => { const M = l.A.clone().lerp(l.M, k), B = l.A.clone().lerp(l.B, k); l.s1.set(l.A, M.lerp(l.M, 0)); l.s2.set(M, B); l.s1.visible = l.s2.visible = k > 0.01; };
      const sailor = walker(S, 0, 0, { vest: true, hat: PM.yel }); ship.add(sailor); sailor.position.set(19.5, 5.65, 3.6); sailor.rotation.y = -PI / 2;
      part(st, 'conteneurs', 'les conteneurs', anchor(ship, 4, 12, -4.2), true);
      part(st, 'capitaine', 'la passerelle du capitaine', anchor(ship, -16.6, 12.6, -5.5), true);
      part(st, 'remorqueurs', 'les remorqueurs', anchor(tugs[0].g, 0, 4.4, 0), false);
      part(st, 'amarres', 'les amarres', anchor(S, 8, 2.4, 6.2), false);
      st.focusAt = anchor(ship, -2, 5, 0); st.size = { w: 52, h: 22 }; st.az = YAW + PI; st.tagAt = anchor(ship, 0, 17, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; if (SH.radar) SH.radar.rotation.y += dt * 1.6;
        ship.position.y = Math.sin(T * 0.7) * 0.05; ship.rotation.x = Math.sin(T * 0.5) * 0.004;
        if (st.moving) { boatWake(ship, 22, 4.5); if (Math.random() < 0.6) wake(ship, 23.3, rnd(-1, 1), 1, 2); }
        tugs.forEach((t) => { t.g.position.y = Math.sin(T * 1.3 + t.g.position.x) * 0.08; if (st.moving) boatWake(t.g, 4.4, 1.8); });
      };
      const sail = (t, pts, dur, ease = easeSine) => { const r = route(pts, false, 0.35); return along(t.g, r, 0, r.len, dur, ease); };
      st.action = async function () {
        lines.forEach((l) => setLine(l, 0)); sailor.visible = false;
        ship.position.set(-80, 0, -10); st.moving = true; engineOn(38);
        await Promise.all([step("Le grand porte-conteneurs arrive de l'autre bout du monde.", 'conteneurs'), to(ship.position, 'x', 0, 9, (k) => 1 - (1 - k) * (1 - k))]);
        shipHorn();
        await Promise.all([step('Il est trop gros pour se garer tout seul. Deux remorqueurs viennent l’aider !', 'remorqueurs'),
          sail(tugs[0], [homes[0], [homes[0][0] + 5, homes[0][1] - 2], [-29, -12], [-24, -24], [0, -26.5], [12, -24], [12, -20.6]], 7), sail(tugs[1], [homes[1], [homes[1][0] + 5, homes[1][1] - 2], [-33, -14], [-26, -25], [-12, -24.5], [-12, -20.6]], 7)]);
        ding();
        const z0 = tugs.map((t) => t.g.position.z);
        await Promise.all([step('Ils le poussent tout doucement avec leur nez, contre le quai.', 'remorqueurs'),
          tw(6, (k) => { ship.position.z = -10 + 10 * k; tugs.forEach((t, i) => (t.g.position.z = z0[i] + 10 * k)); if (Math.random() < 0.5) tugs.forEach((t) => wake(t.g, -4.5, 0, 1.5, 2)); }, easeSine)]);
        thud(); st.moving = false; engineOff(); sailor.visible = true;
        await Promise.all([step('Les marins lancent les amarres. On les attache aux bollards du quai.', 'amarres'), tw(3, (k) => lines.forEach((l, i) => setLine(l, Math.min(1, Math.max(0, k * 1.6 - i * 0.2)))), lin)]);
        st.moving = true;
        await Promise.all([step('Le bateau est bien amarré. Le portique va pouvoir le décharger !', 'capitaine'),
          ...tugs.map((t, i) => { const r0 = t.g.rotation.y, p = t.g.position, z0 = p.z; return tw(2, (k) => { t.g.rotation.y = r0 - (PI / 2) * k; p.z = z0 - 2.5 * k; }).then(() => sail(t, [[p.x, p.z], [p.x - 6, p.z - 0.5], [-26 - i * 4, -16], [homes[i][0] - 3, homes[i][1] - 4], homes[i]], 7)).then(() => to(t.g.rotation, 'y', 0, 1)); })]);
        st.moving = false; chime();
      };
    })();

    /* ---- le bateau-pilote : il emmène le pilote jusqu'au bateau qui attend au large ---- */
    (function () {
      const st = makeStation('pilote'), S = st.g; S.position.y = SEA;
      const pon = grp(S, 0, 0, 2.4); rbox(pon, 9, 0.5, 1.6, 0.05, PM.wood, 0, 0.25, 0, 0.02); [3.6, -3.6].forEach((x) => [0.7, -0.7].forEach((z) => cylY(pon, 0.18, 0.6, PM.greyL, x, 0.2, z, 10)));
      [-4, 4].forEach((x) => cylY(pon, 0.12, 3.6, PM.dark, x, 0.6, 0.95, 8));
      { const [bx] = loc(S, 43.6, -33.6); const gw = box(pon, bx - 4.2, 0.08, 1.0, PM.greyL, (4.2 + bx) / 2, 1.5, 0); gw.rotation.z = Math.atan2(1.9, bx - 4.2); }
      const B = pilotBoat(S); const boat = B.g; st.m = boat; boat.position.set(0, 0, 0);
      const pil = walker(boat, 1.9, 0, { top: 0x1d3a7a, bottom: 0x2a3550, vest: true }); pil.position.y = 1.28;
      const SH = containerShip(S, { hull: PM.green, funnel: PM.blue, name: 'MARIN', ladder: true, noKp: true, seed: 3 }); const ship = SH.g; ship.scale.setScalar(0.72);
      const HOME = loc(S, -8, -52); ship.position.set(HOME[0], 0, HOME[1]);
      const side = new V3(HOME[0] - 1.44, 0, HOME[1] + 3.96 + 1.62);
      const out = route([[0, 0], [1.0, -0.6], [1.6, -2.4], [0, -4.6], [-4, -5.6], [-20, -8], [-34, side.z], [side.x, side.z]], false, 0.4);
      const back = route([[side.x, side.z], [side.x - 5, side.z - 0.4], [side.x - 9, side.z + 3], [side.x - 5, side.z + 7], [-20, -2], [-6, -2.6], [-2, -0.8], [0, 0]], false, 0.4);
      part(st, 'bateau', 'le grand bateau', anchor(ship, 0, 18, 0), false);
      part(st, 'pilote', 'le pilote', anchor(pil, 0, 1.4, 0), true);
      part(st, 'echelle', "l'échelle de corde", anchor(ship, -2, 3.0, 5.7), false);
      part(st, 'feux', 'les feux blanc et rouge', anchor(boat, -1.0, 4.4, 0), false);
      st.focusAt = anchor(boat, 0, 1.5, 0); st.size = { w: 30, h: 14 }; st.tagAt = anchor(boat, 0, 5.4, 0);
      let T = 0;
      st.update = (dt) => { T += dt; if (SH.radar) SH.radar.rotation.y += dt * 1.6; ship.position.y = Math.sin(T * 0.6) * 0.06; if (!st.moving) boat.position.y = Math.sin(T * 1.6) * 0.07; else { boat.position.y = 0.05; boat.rotation.z = 0.05; boatWake(boat, 3.6, 1.4); } if (st.shipMoving) boatWake(ship, 16, 3); };
      st.action = async function () {
        if (st.done) { ship.position.set(HOME[0], 0, HOME[1]); boat.add(pil); pil.position.set(1.9, 1.28, 0); pil.rotation.set(0, 0, 0); boat.position.set(0, 0, 0); boat.rotation.set(0, 0, 0); st.done = false; }
        await Promise.all([step('Un grand bateau attend au large. Il ne connaît pas le chemin du port.', 'bateau'), sleep(0.6)]);
        engineOn(90); st.moving = true;
        await Promise.all([step('Vroum ! Le bateau-pilote fonce vers lui sur les vagues.', 'feux'), along(boat, out, 0, out.len, 7, easeSine)]);
        st.moving = false; boat.rotation.z = 0; engineOff();
        S.attach(pil);
        const p0 = pil.position.clone(), lad = new V3(side.x, 0, HOME[1] + 3.96 + 0.35), top = new V3(side.x, 3.25, HOME[1] + 3.96 - 0.6);
        await step("Le pilote grimpe à l'échelle de corde, jusqu'en haut.", 'echelle');
        await tw(0.8, (k) => { pil.position.lerpVectors(p0, new V3(lad.x, p0.y, lad.z), k); pil.userData.walk(k * 8); });
        await tw(2.4, (k) => { pil.position.set(lad.x, p0.y + (top.y + 0.2 - p0.y) * k, lad.z); pil.userData.walk(k * 18); pil.rotation.y = PI / 2 - 0; }, lin);
        await tw(0.6, (k) => pil.position.set(lad.x, top.y, lad.z + (top.z - lad.z) * k));
        ship.attach(pil); ding();
        engineOn(60); st.moving = true; st.shipMoving = true;
        await Promise.all([step('Le pilote montre le chemin au capitaine. Le grand bateau avance doucement.', 'pilote'),
          to(ship.position, 'x', HOME[0] + 14, 9, easeSine), sleep(1).then(() => along(boat, back, 0, back.len, 8, easeSine))]);
        to(boat.rotation, 'y', 0, 0.8);
        st.moving = false; st.shipMoving = false; boat.rotation.z = 0; engineOff();
        await Promise.all([step('Le bateau-pilote est rentré au port. Bravo !', 'feux'), sleep(0.8)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le remorqueur : il tire une barge, puis la pousse contre le quai ---- */
    (function () {
      const st = makeStation('remorqueur'), S = st.g; S.position.y = SEA;
      const barge = grp(S), bd = grp(barge);
      extY(bd, [[-7, -2.5], [6, -2.5], [7.2, -1.5], [7.2, 1.5], [6, 2.5], [-7, 2.5]], 0.3, 1.8, PM.black, 0, 0.2, 0, 0.04);
      extY(bd, [[-6.8, -2.3], [5.9, -2.3], [7.0, -1.4], [7.0, 1.4], [5.9, 2.3], [-6.8, 2.3]], 0.3, 0.06, PM.redD, 0, 1.12, 0, 0.01);
      [2.55, -2.55].forEach((z) => rbox(bd, 13.8, 0.3, 0.15, 0.04, PM.yel, -0.2, 1.0, z, 0.01));
      [[6.4, 1.2], [6.4, -1.2], [-6.4, 1.2], [-6.4, -1.2]].forEach(([x, z]) => cylY(bd, 0.15, 0.4, PM.dark, x, 1.3, z, 10));
      [-3.0, 2.6].forEach((x) => [-1.15, 1.15].forEach((z) => boxC(bd, scol(), x, 1.15, z)));
      boxC(bd, 0xf2b21c, -3.0, 1.15 + CH, 1.15); boxC(bd, 0x2f6fe0, 2.6, 1.15 + CH, -1.15);
      bake(bd);
      const bow = anchor(barge, 7.2, 1.2, 0);
      const TG = tugBoat(S, PM.orange, 'BIDULE'); const tug = TG.g; st.m = tug;
      const IDLE = new V3(0, 0, -7.3); tug.position.copy(IDLE); tug.rotation.y = -PI / 2;
      const cable = seg(S, 0.05, PM.rope); cable.visible = false;
      const IN = route([[-14, -50], [-10, -34], [-8, -16], [0, -9], [14, -9], [24, -9]], false, 0.35), sB = sOf(IN, 0, -9), GAP = 13;
      part(st, 'nez', 'le nez en caoutchouc', anchor(tug, 4.7, 1.3, 0), true);
      part(st, 'treuil', 'le treuil', anchor(tug, -2.2, 2.6, 0), false);
      part(st, 'barge', 'la barge', anchor(barge, 0, 6, 0), true);
      part(st, 'cable', 'le câble', anchor(tug, -6, 2.4, 0), false);
      st.focusAt = anchor(tug, -4, 1.5, 0); st.size = { w: 32, h: 14 }; st.az = YAW + PI; st.tagAt = anchor(tug, 0, 6.4, 0);
      let T = 0; const a = new V3(), b = new V3();
      st.update = (dt) => {
        T += dt; barge.position.y = Math.sin(T * 0.9) * 0.05; if (!st.moving) tug.position.y = Math.sin(T * 1.3) * 0.08;
        if (cable.visible) { S.updateMatrixWorld(true); S.worldToLocal(TG.towPt.getWorldPosition(a)); S.worldToLocal(bow.getWorldPosition(b)); cable.set(a, b); }
        if (st.moving) { boatWake(tug, 4.4, 1.8); boatWake(barge, 7, 2.4); }
      };
      st.action = async function () {
        engineOn(70); st.moving = true; cable.visible = true; TG.drum.scale.set(1.15, 1, 1.15);
        placeOn(barge, IN, 0); placeOn(tug, IN, GAP);
        await Promise.all([step('Le remorqueur tire une grosse barge pleine de conteneurs, avec un câble très solide.', 'cable'),
          tw(10, (k) => { const s = sB * k; placeOn(barge, IN, s); placeOn(tug, IN, s + GAP); }, (k) => 1 - (1 - k) * (1 - k))]);
        const t0 = tug.position.clone();
        await Promise.all([step('Son treuil enroule le câble. Il tourne, il tourne...', 'treuil'), tw(2.4, (k) => { TG.drum.rotation.z = -k * 14; tug.position.x = t0.x - 3 * k; TG.drum.scale.set(1.15 + 0.25 * k, 1, 1.15 + 0.25 * k); }, easeSine)]);
        cable.visible = false;
        const p = tug.position.clone(); const AR = route([[p.x, p.z], [p.x + 4, p.z - 3], [p.x + 1, p.z - 8], [6, -19.5], [0, -18.5], [0, -16.3]], false, 0.35);
        await Promise.all([step('Maintenant, il vient poser son gros nez en caoutchouc contre la barge.', 'nez'), along(tug, AR, 0, AR.len, 6, easeSine)]);
        thud();
        await Promise.all([step('Et il la pousse tout doucement contre le quai. Il est petit, mais très fort !', 'barge'),
          (() => { const bx = barge.position.x, br = barge.rotation.y, bz = barge.position.z; return tw(6, (k) => { barge.position.set(bx * (1 - k), barge.position.y, bz * (1 - k)); barge.rotation.y = br * (1 - k); tug.position.set(0, tug.position.y, -16.3 + (16.3 - 7.3) * k); if (Math.random() < 0.6) wake(tug, -4.5, 0, 2, 2); }, easeSine); })()]);
        thud(); st.moving = false; engineOff(); chime();
      };
    })();

    /* ---- le portique : il sort un conteneur du bateau et le pose sur le quai ---- */
    (function () {
      const st = makeStation('portique'), S = st.g;
      const C = stsCrane(S); st.m = C.G; const { G, trolley, spr } = C;
      const Z0 = -8; G.position.z = Z0;
      const KP = new V3(); const kpLocal = () => { W.ship.updateMatrixWorld(true); S.updateMatrixWorld(true); const v = W.kp.getWorldPosition(new V3()); S.worldToLocal(v); return v; };
      KP.copy(kpLocal());
      W.kpQuay = (() => { const v = new V3(0, 0, 0); S.updateMatrixWorld(true); S.localToWorld(v); return v; })();
      part(st, 'fleche', 'la grande flèche', anchor(G, 17, C.GY + 2.4, 0), true);
      part(st, 'cabine', 'la cabine', anchor(C.cab, 0.9, 0, 1.0), false);
      part(st, 'pince', 'la pince', anchor(spr, 0, 1, 1.4), false);
      part(st, 'rails', 'les rails', anchor(G, -5.4, 0.6, 6.5), true);
      part(st, 'bateau', 'le bateau', anchor(S, 15, 9, 0), false);
      st.focus = new V3(5, 14, 0); st.size = { w: 46, h: 34 }; st.tagAt = anchor(G, 0, 33, 0);
      spr.position.y = 12;
      st.update = () => C.update();
      const lower = (y, d = 2.5) => to(spr.position, 'y', y, d, easeSine);
      st.action = async function () {
        // put things back: the box on the ship, the crane at its place
        if (W.kpState !== 'ship') { W.ship.add(W.kp); W.kp.position.copy(W.kpHome); W.kp.rotation.set(0, 0, 0); pop(W.kp, 0.5); W.kpState = 'ship'; }
        if (st.done) { G.position.z = Z0; trolley.position.x = -4; spr.position.y = 12; st.done = false; }
        engineOn(50);
        await Promise.all([step('Le portique roule sur ses rails, jusqu’au bon conteneur.', 'rails'), to(G.position, 'z', KP.z, 4, easeSine)]);
        await Promise.all([step('La cabine roule tout là-haut, sur la grande flèche, au-dessus du bateau.', 'cabine'), to(trolley.position, 'x', KP.x, 4.5, easeSine), lower(15, 4.5)]);
        await Promise.all([step('La grosse pince descend, et attrape le conteneur par les quatre coins. Clic !', 'pince'), lower(KP.y + CH, 3)]);
        ding(); spr.attach(W.kp); W.kpState = 'crane';
        await Promise.all([step('Hop ! Il le soulève, et le ramène au-dessus du quai.', 'fleche'), lower(17.6, 2.5).then(() => to(trolley.position, 'x', 0, 4.5, easeSine))]);
        await Promise.all([step('Il le pose tout doucement sur le quai. Le cavalier va venir le chercher !', 'pince'), lower(CH, 3.5)]);
        thud(); scene.attach(W.kp); W.kp.position.copy(W.kpQuay); W.kp.position.y = 0; W.kpState = 'quay';
        await lower(8, 2); engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le cavalier : du quai jusqu'à la pile ---- */
    (function () {
      const st = makeStation('cavalier'), S = st.g;
      const SC = straddleCarrier(S, st); const m = SC.g; st.m = m; st.wheels = SC.wheels; const spr = SC.spr;
      const P = loc(S, 0.4, -7), K = loc(S, 18, 9), K2 = loc(S, 18, 2);
      const R = route([[0, 0], [P[0], 0], [28, 0], [32.5, 2.2], [K2[0], K2[1]], [K[0], K[1]], [K[0], K[1] + 6]], false, 0.3);
      const sP = sOf(R, P[0], 0), sK = sOf(R, K[0], K[1]), sK2 = sOf(R, K2[0], K2[1]);
      const CARRY = 5.4; spr.position.y = CARRY + 0.6;
      const spinW = spin(m, SC.wheels, 0.55);
      part(st, 'jambes', 'les grandes jambes', anchor(m, 3.2, 4.5, 2.3), true);
      part(st, 'cabine', 'la cabine, tout en haut', anchor(SC.cab, 0.4, 1.4, 0.9), false);
      part(st, 'pince', 'la pince', anchor(spr, 1.5, 0.8, 1.2), false);
      part(st, 'pile', 'la pile de conteneurs', anchor(S, K[0], 3.2, K[1] + 1.5), false);
      st.focusAt = anchor(m, 0, 4, 0); st.size = { w: 22, h: 14 }; st.az = YAW + 0.35; st.tagAt = anchor(m, 0, 10, 0);
      st.update = (dt) => { spinW(); SC.update(); if (st.reversing) { st.beepT = (st.beepT || 0) - dt; if (st.beepT <= 0) { tone(1250, 0, 0.2, 'square', 0.035); st.beepT = 0.55; } } };
      st.action = async function () {
        if (st.done) { m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); spr.position.y = CARRY + 0.6; pop(m, 0.5); st.done = false; await sleep(0.5); }
        if (W.kpState !== 'quay') {
          await step('Le portique a posé un conteneur sur le quai.', 'pince');
          scene.attach(W.kp); W.kp.position.copy(W.kpQuay); W.kp.position.y = 0; W.kp.rotation.set(0, YAW, 0); pop(W.kp, 0.5); W.kpState = 'quay'; await sleep(0.6);
        }
        engineOn(60);
        await Promise.all([step('Le cavalier arrive. Il a de grandes jambes, comme un cheval très haut !', 'jambes'), along(m, R, 0, sP, 5, easeSine)]);
        engineOff();
        await Promise.all([step("Il se met juste au-dessus du conteneur, et l'attrape par le haut.", 'pince'), to(spr.position, 'y', CH, 2.2, easeSine)]);
        ding(); spr.attach(W.kp); W.kpState = 'carrier';
        engineOn(60);
        await to(spr.position, 'y', CARRY, 1.8, easeSine);
        await Promise.all([step("Il le soulève entre ses jambes, et l'emporte jusqu'aux piles.", 'jambes'), along(m, R, sP, sK, 8, easeSine)]);
        engineOff();
        await Promise.all([step('Il le pose sur la pile, bien rangé avec les autres.', 'pile'), to(spr.position, 'y', CH * 2, 2.2, easeSine)]);
        thud(); scene.attach(W.kp); W.kpState = 'yard';
        await to(spr.position, 'y', CARRY + 0.6, 1.6, easeSine);
        st.reversing = true; engineOn(60);
        await Promise.all([step('Bip, bip ! Il recule, et repart chercher le suivant.', 'cabine'), along(m, R, sK, sK2, 3.5, easeSine)]);
        st.reversing = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le camion (built first: the reach stacker needs it) ---- */
    const TRK = {};
    (function () {
      const st = makeStation('camion'), S = st.g; TRK.st = st; TRK.S = S;
      const K = containerTruck(S, st); TRK.K = K; st.m = K.T; W.tractor = K.T;
      const OUT = route([[-10, 0], [0, 0], [8, 0], [12, 1.8], [14.2, 6], [14.2, 8], [14.2, 12.5], [15.6, 14.2], [19.5, 14.8], [26, 14.8], [82, 14.8]], false, 0.3);
      const IN = route([[-44, 0], [-30, 0], [-10, 0], [0, 0], [6, 0]], false, 0.1);
      TRK.OUT = OUT; TRK.IN = IN;
      const s0 = sOf(OUT, 0, 0), sIn = sOf(IN, 0, 0);
      const pos = (r, s) => { placeOn(K.T, r, s); const pr = new V3(), P = new V3(); r.curve.getPointAt(Math.max(0, Math.min(1, (s - 6.4) / r.len)), pr); P.copy(K.T.position); K.R.position.copy(P); K.R.rotation.y = Math.atan2(-(P.z - pr.z), P.x - pr.x) || K.T.rotation.y; };
      TRK.park = () => pos(OUT, s0); TRK.park();
      const spinT = spin(K.T, K.tw0, 0.52), spinR = spin(K.R, K.tw1, 0.48);
      // the two gates: at the tunnel on the way in, at the fence on the way out
      const gate = (x, z, ry) => { const g = grp(S, x, 0, z); g.rotation.y = ry; cylY(g, 0.25, 1.1, PM.dark, 0, 0.55, 0, 10); const arm = grp(g, 0, 1.0, 0); for (let i = 0; i < 6; i++) box(arm, 0.7, 0.14, 0.1, i % 2 ? PM.white : PM.red, 0.4 + i * 0.7, 0, 0); return arm; };
      const armIn = gate(-14.3, 2.3, PI / 2), armOut = gate(17.2, 12.4, PI);
      part(st, 'remorque', 'la remorque', anchor(K.R, -4.3, 1.0, 1.3), true);
      part(st, 'verrous', 'les verrous', anchor(K.R, -1.6, 1.6, 1.05), false);
      part(st, 'cabine', 'la cabine du chauffeur', anchor(K.T, 2.8, 2.6, 1.1), true);
      part(st, 'barriere', 'la barrière', anchor(armOut, 2, 0.4, 0), false);
      st.focusAt = anchor(K.T, -2.5, 1.5, 0); st.size = { w: 24, h: 11 }; st.tagAt = anchor(K.T, 0, 5, 0);
      const vis = () => { [[K.T, 1, 3.2], [K.R, -3.8, 4]].forEach(([o, c, hl]) => { const x = o.position.x + c * Math.cos(o.rotation.y); o.visible = x + hl > -17.1 && x - hl < 66.5; }); };
      st.update = () => { spinT(); spinR(); vis(); };
      TRK.drive = async (r, a, b, dur, ease = easeSine) => tw(dur, (k) => pos(r, a + (b - a) * k), ease);
      st.action = async function () {
        if (W.tState !== 'truck') { await step('Le chariot pose un conteneur sur la remorque.', 'remorque'); await W.rsLoad(true); }
        engineOn(55);
        await Promise.all([step('Le camion démarre avec son conteneur. Attention, il traverse les rails !', 'cabine'), TRK.drive(OUT, s0, sOf(OUT, 14.2, 10), 6, easeIn)]);
        await Promise.all([step('La barrière se lève, et il sort du port.', 'barriere'), to(armOut.rotation, 'z', 1.4, 1)]);
        await Promise.all([step("Il roule sur la route, jusqu'au magasin, très loin.", 'remorque'), TRK.drive(OUT, sOf(OUT, 14.2, 10), OUT.len, 8, lin), sleep(2.5).then(() => to(armOut.rotation, 'z', 0, 1))]);
        if (W.T) W.T.visible = false; W.tState = 'gone';
        await Promise.all([step('Un peu plus tard, il revient avec sa remorque vide.', 'cabine'), to(armIn.rotation, 'z', 1.4, 1).then(() => TRK.drive(IN, 0, sIn, 7, (k) => 1 - (1 - k) * (1 - k)))]);
        TRK.park(); engineOff(); to(armIn.rotation, 'z', 0, 1); chime();
      };
    })();

    /* ---- le chariot porte-conteneurs : de la pile au camion ---- */
    (function () {
      const st = makeStation('chariot'), S = st.g;
      const RS = reachStacker(S, st); const m = RS.g; st.m = m; st.wheels = RS.wheels;
      const IDLE = -2.2; m.position.x = IDLE; st.lastX = IDLE;
      // its stack: three boxes along h, the top one is the one it takes
      const [kx, kz] = loc(S, -30, 8);
      boxC(S, 0x3aa46a, kx, 0, kz, true); boxC(S, 0x8a2a3a, kx, CH, kz, true);
      const T = cont(S, 0x2f6fe0, kx, CH * 2, kz); T.rotation.y = PI / 2; W.T = T; W.tState = 'stack';
      const THOME = T.position.clone();
      const PLACE = new V3(-3, 0, 0);
      RS.aim(4.0, 3.2);
      part(st, 'bras', 'le grand bras', anchor(RS.boom, 4.5, 0.6, 0.5), true);
      part(st, 'pince', 'la pince', anchor(RS.spr, 0, 0.8, 2.6), false);
      part(st, 'roues', 'les grosses roues', anchor(m, 1.9, 0.9, 1.9), false);
      part(st, 'camion', 'le camion', anchor(TRK.K.R, -4.3, 2.0, 1.4), false);
      st.focusAt = anchor(m, 0, 3, 0); st.size = { w: 26, h: 13 }; st.az = 3 * PI / 4 + 0.45; st.tagAt = anchor(m, 0, 6.5, 0);
      st.update = (dt) => { roll(st, dt); RS.update(); };
      let aimP = new V3(4.0, 3.2, 0);
      const aimTo = (x, y, d) => { const a = aimP.clone(); return tw(d, (k) => { aimP.set(a.x + (x - a.x) * k, a.y + (y - a.y) * k, 0); RS.aim(aimP.x, aimP.y); }, easeSine); };
      const reset = () => { m.position.set(IDLE, 0, 0); m.rotation.set(0, 0, 0); st.lastX = IDLE; aimP.set(5.4, 4.0, 0); RS.aim(4.0, 3.2); };
      const restack = () => { S.attach(T); T.position.copy(THOME); T.rotation.set(0, PI / 2, 0); T.visible = true; pop(T, 0.5); W.tState = 'stack'; };
      async function load(fast) {
        const f = fast ? 0.45 : 1, say = (t, k) => (fast ? sleep(0.01) : step(t, k));
        engineOn(55);
        await Promise.all([say("Le chariot s'approche de la pile de conteneurs.", 'roues'), to(m.position, 'x', 0, 2 * f, easeSine)]);
        await Promise.all([say('Son grand bras se lève et s’allonge... la pince attrape le conteneur du haut !', 'bras'), aimTo(kx, CH * 3, 3 * f)]);
        ding(); RS.spr.attach(T); W.tState = 'rs';
        await aimTo(kx - 0.6, CH * 3 + 1.2, 1 * f);
        st.reversing = !fast;
        await Promise.all([say('Il fait demi-tour, en tenant bien le conteneur.', 'pince'), tw(5 * f, (k) => { m.position.set(PLACE.x * k, 0, -4.5 * Math.sin(PI * k)); m.rotation.y = -PI * k; }, easeSine)]);
        st.reversing = false;
        S.updateMatrixWorld(true); TRK.K.R.updateMatrixWorld(true);
        const slot = m.worldToLocal(TRK.K.R.localToWorld(TRK.K.slot.clone()));
        await aimTo(slot.x, slot.y + CH + 0.6, 1.6 * f);
        await Promise.all([say('Il le pose tout doucement sur la remorque du camion.', 'camion'), aimTo(slot.x, slot.y + CH, 1.4 * f)]);
        thud(); TRK.K.R.attach(T); T.position.copy(TRK.K.slot); T.rotation.set(0, 0, 0); W.tState = 'truck';
        await aimTo(4.0, 3.2, 1.6 * f); engineOff(); st.done = true;
      }
      W.rsLoad = async (fast) => { reset(); if (W.tState !== 'stack') restack(); await sleep(0.4); await load(fast); };
      st.action = async function () {
        if (W.tState === 'truck') { await step('Le camion plein part livrer. Un camion vide arrive à sa place.', 'camion'); T.visible = false; TRK.park(); pop(TRK.K.T, 0.5); pop(TRK.K.R, 0.5); W.tState = 'gone'; await sleep(0.6); }
        if (st.done) { reset(); pop(m, 0.5); st.done = false; }
        if (W.tState !== 'stack') restack();
        await load(false);
        await Promise.all([step('Le camion est chargé ! Il peut partir livrer.', 'camion'), sleep(0.6)]);
        chime();
      };
    })();

    /* ---- le train de marchandises, et son portique sur rails ---- */
    (function () {
      const st = makeStation('train'), S = st.g;
      const train = grp(S); const L = locomotive(train); L.g.position.x = -13.5; L.g.rotation.y = PI;
      const wg = [flatWagon(train), flatWagon(train)]; wg[0].g.position.x = -0.5; wg[1].g.position.x = 13.3;
      st.m = train; const cars = [L.g, wg[0].g, wg[1].g];
      const wheels = [...L.wheels, ...wg[0].wheels, ...wg[1].wheels];
      const RG = railGantry(S, -6.4, 3.2); const crane = RG.g; crane.position.x = -1;
      // the stack row next to the track; the two boxes for this train are on top of it
      [[8.0, 1], [13.6, 2], [19.2, 1], [-9.2, 2]].forEach(([x, n]) => { for (let i = 0; i < n; i++) boxC(S, scol(), x, i * CH, -4); });
      const loads = [[-3.35, 0x3aa46a], [2.35, 0xd8402a]].map(([x, col]) => { const c = cont(S, col, x, 0, -4); return { c, home: c.position.clone(), x }; });
      part(st, 'locomotive', 'la locomotive', anchor(L.g, 0, 4.6, 0), true);
      part(st, 'wagons', 'les wagons', anchor(wg[0].g, 3, 1.8, 1.4), true);
      part(st, 'portique', 'le portique sur rails', anchor(crane, 1, 12.6, 3.2), false);
      st.focus = new V3(-1, 4, -1); st.size = { w: 42, h: 16 }; st.tagAt = anchor(crane, 0, 14, 0);
      let tx = 0, lastTx = 0;
      st.update = () => {
        RG.update(); const dx = tx - lastTx; lastTx = tx;
        if (dx) wheels.forEach((w) => (w.rotation.z -= (dx * (w.parent === L.g ? -1 : 1)) / (w.userData.r || 0.5)));
        train.position.x = tx; cars.forEach((c) => { const x = tx + c.position.x; c.visible = x + 6.8 > -54.6 && x - 6.8 < 27.8; });
      };
      const hoist = (y, d = 2) => to(RG.spr.position, 'y', y, d, easeSine);
      st.action = async function () {
        loads.forEach((l) => { if (l.c.parent !== S || !l.c.visible) { S.attach(l.c); l.c.position.copy(l.home); l.c.rotation.set(0, 0, 0); l.c.visible = true; pop(l.c, 0.5); } });
        if (st.done) { tx = 0; st.done = false; await sleep(0.5); }
        engineOn(45);
        for (const [i, l] of loads.entries()) {
          await Promise.all([step(i ? 'Et encore un ! Le train se remplit.' : 'Le portique sur rails attrape un conteneur sur la pile.', 'portique'), to(crane.position, 'x', l.x, 2.5, easeSine), to(RG.trolley.position, 'z', -4, 2.5, easeSine), hoist(4.6, 2.5)]);
          await hoist(CH, 1.6); ding(); RG.spr.attach(l.c);
          await hoist(5.2, 1.6);
          await Promise.all([i ? sleep(0.01) : step('Il le pose sur un wagon du train.', 'wagons'), to(RG.trolley.position, 'z', 0, 2.2, easeSine)]);
          await hoist(1.55 + CH, 1.8); thud(); const w = wg[0].g; w.attach(l.c);
          await hoist(5, 1.4);
        }
        await to(crane.position, 'x', -1, 2, easeSine); engineOff();
        tone(392, 0, 0.6, 'square', 0.05); tone(330, 0.7, 0.9, 'square', 0.05);
        engineOn(70);
        await Promise.all([step('Tuuut ! La locomotive tire tout le train, très loin.', 'locomotive'), tw(9, (k) => (tx = -100 * k), easeIn)]);
        loads.forEach((l) => (l.c.visible = false));
        await Promise.all([step('Voici un autre train, tout vide. Il attend ses conteneurs.', 'wagons'), tw(8, (k) => (tx = 62 * (1 - k)), (k) => 1 - (1 - k) * (1 - k))]);
        tx = 0; engineOff(); chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate, W);
  }
};

/* ================= the sea, and the land cut along the quay ================= */
function makeSea(scene, onUpdate) {
  const ground = scene.children.find((o) => o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && Math.abs(o.geometry.parameters.radius - RAD) < 1e-3);
  const outer = scene.children.find((o) => o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry' && o.geometry.parameters.radius > RAD + 1);
  // the land: the island disc minus the water behind the quay line, standing on a concrete/rock block down to the sea
  const k = DQ / RAD, a0 = Math.asin(k) - PI / 4, a1 = PI - Math.asin(k) - PI / 4, shape = new THREE.Shape();
  for (let i = 0; i <= 160; i++) { const a = a0 + ((a1 - a0) * i) / 160, X = Math.cos(a) * RAD, Z = Math.sin(a) * RAD; if (i) shape.lineTo(X, -Z); else shape.moveTo(X, -Z); }
  shape.closePath();
  if (ground) {
    const geo = new THREE.ShapeGeometry(shape, 1), p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * RAD) + 0.5, p.getY(i) / (2 * RAD) + 0.5);
    ground.geometry.dispose(); ground.geometry = geo;
  }
  const blk = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: -0.03 - (SEA - 0.6), bevelEnabled: false, curveSegments: 1 }), PM.wall);
  blk.rotation.x = -PI / 2; blk.position.y = SEA - 0.6; blk.receiveShadow = true; scene.add(blk);
  // the sea: the stage's outer disc, lowered, with painted ripples that drift slowly
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { const px = Math.random() * 256, py = Math.random() * 256, w = rnd(18, 40); x.strokeStyle = Math.random() < 0.7 ? 'rgba(255,255,255,1)' : 'rgba(150,180,220,1)'; x.lineWidth = rnd(2, 4); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + w / 2, py - 6, px + w, py); x.stroke(); }
  x.globalCompositeOperation = 'multiply'; x.fillStyle = '#d8e6ff'; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(36, 36);
  // tint: ripples are whiter than the water around them
  const m = new THREE.MeshLambertMaterial({ color: 0x3a86d8, map: t });
  if (outer) { outer.material = m; outer.position.y = SEA; }
  onUpdate((dt) => { t.offset.x += dt * 0.006; t.offset.y += dt * 0.003; });
}

/* ================= the port around the machines ================= */
function at(p, h, d, yaw = YAW, y = 0) { const [x, z] = Q(h, d); const g = grp(p, x, y, z); g.rotation.y = yaw; return g; }
function shed(p, h, d, len, wid, ht, col, yaw = YAW) {
  const g = at(p, h, d, yaw); rbox(g, len, ht, wid, 0.1, col, 0, ht / 2, 0, 0.03);
  const r = add(g, new THREE.CylinderGeometry(wid * 0.62, wid * 0.62, len + 0.4, 20, 1, false, -PI / 3.2, PI / 1.6), PM.greyL); r.rotation.z = PI / 2; r.position.y = ht - wid * 0.62 * Math.cos(PI / 3.2) + 0.02;
  for (let x = -len / 2 + 2; x < len / 2 - 1; x += 4) box(g, 3, 3.2, 0.06, PM.dark, x, 1.6, wid / 2 + 0.01);
  for (let x = -len / 2 + 1; x < len / 2; x += 1.6) box(g, 0.06, ht - 0.4, 0.04, PM.wall, x, ht / 2, wid / 2 + 0.02);
  return g;
}
function hill(scene, h, d, rh, rd, ry, cols) {
  const [x, z] = Q(h, d); const g = grp(scene, x, SEA - 1, z); g.rotation.y = YAW;
  const m = add(g, new THREE.SphereGeometry(1, 28, 14, 0, PI * 2, 0, PI / 2), PM.grass); m.scale.set(rh, ry, rd);
  for (let i = 0; i < 26; i++) { const a = rnd(0, PI * 2), r = Math.sqrt(Math.random()) * 0.82, hx = Math.cos(a) * r, hz = Math.sin(a) * r, yy = ry * Math.sqrt(Math.max(0, 1 - r * r));
    const t = add(g, ICO, pick(cols), hx * rh, yy + 0.8, hz * rd); t.scale.setScalar(rnd(1.2, 2.2)); t.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  return g;
}
function portal(p, h, d, yaw, w = 5, ht = 5) {
  const g = at(p, h, d, yaw); ext(g, [[-w / 2 - 0.8, 0], [w / 2 + 0.8, 0], [w / 2 + 0.8, ht + 0.8], [-w / 2 - 0.8, ht + 0.8]], 0.1, 1.2, PM.concrete, 0, 0, 0, 0.03);
  rbox(g, w, ht, 1.4, 0.4, PM.black, 0, ht / 2, 0.2, 0.02); rbox(g, w + 1.8, 0.4, 1.4, 0.05, PM.wall, 0, ht + 0.95, 0, 0.02);
  return g;
}
function buildPort(scene) {
  // quay furniture: the quay wall with fenders and ladders, bollards, crane rails
  for (let h = -54; h <= 54; h += 5) { const g = at(scene, h, DQ); rbox(g, 1.2, 1.4, 0.5, 0.15, PM.rubber, 0, SEA + 0.9, -0.2, 0.03); }
  for (let h = -50; h <= 50; h += 16) { const g = at(scene, h + 2.5, DQ); [0.3, -0.3].forEach((x) => rod(g, new V3(x, SEA + 0.2, -0.08), new V3(x, 0.4, -0.08), 0.03, PM.yel, 4)); for (let y = SEA + 0.4; y < 0; y += 0.35) box(g, 0.6, 0.04, 0.04, PM.yel, 0, y, -0.08); }
  for (let h = -52; h <= 52; h += 6) { const g = at(scene, h, DQ + 0.7); cylY(g, 0.22, 0.6, PM.black, 0, 0.3, 0, 12); cylY(g, 0.3, 0.12, PM.black, 0, 0.62, 0, 12); }
  rbox(at(scene, 0, DQ + 0.2), 112, 0.1, 0.4, 0.02, PM.white, 0, 0.05, 0, 0.01);
  [-12.4, -1.6].forEach((d) => rbox(at(scene, 0, d), 112, 0.12, 0.18, 0.02, PM.steel, 0, 0.06, 0, 0.01));
  // the stacking yard: rows across the quay (straddle carriers), and boxes by the reach stacker
  seed = 11;
  for (let h = -9.8; h <= 37; h += 4.6) {
    [3.2, 9, 14.8].forEach((d) => {
      if (Math.abs(h - 18) < 0.5) { if (d > 4) boxC(at(scene, h, d), d === 9 ? 0x3aa46a : scol(), 0, 0, 0, true); return; }
      if (d < 4 && Math.abs(h - 18) < 6) return;
      const n = 1 + Math.floor(srnd() * 3); for (let i = 0; i < n; i++) boxC(at(scene, h, d), scol(), 0, i * CH, 0, true);
    });
  }
  [[-38, 3, 2], [-38, 8, 3], [-24, 3, 1], [-24, 8, 2], [-34, 3, 3]].forEach(([h, d, n]) => { for (let i = 0; i < n; i++) boxC(at(scene, h, d), scol(), 0, i * CH, 0, false); });
  // rail track with sleepers, the gantry rails, level crossing, the fence and its gate
  { const g = at(scene, 0, 31); [0.72, -0.72].forEach((z) => rbox(g, 100, 0.16, 0.12, 0.02, PM.steel, -2, 0.2, z, 0.01)); for (let x = -50; x < 46; x += 0.9) rbox(g, 0.3, 0.12, 2.3, 0.02, PM.wood, x, 0.06, 0, 0.01); }
  [24.6, 34.2].forEach((d) => rbox(at(scene, 14, d), 36, 0.12, 0.16, 0.02, PM.steel, 0, 0.06, 0, 0.01));
  { const g = at(scene, -11.5, 31); [[-3.2, 2.6], [3.2, -2.6]].forEach(([x, z]) => { cylY(g, 0.08, 2.6, PM.white, x, 1.3, z, 8); [0.6, -0.6].forEach((r) => { const c = rbox(g, 1.2, 0.18, 0.05, 0.02, PM.red, x, 2.4, z, 0.01); c.rotation.z = r; }); sph(g, 0.14, PM.redLamp, x, 1.9, z + 0.1); }); }
  for (let h = -44; h <= 42; h += 3) { if (h > -15 && h < -8) continue; const g = at(scene, h, 36.5); cylY(g, 0.06, 2.2, PM.grey, 0, 1.1, 0, 6); if (h + 3 <= 42 && !(h + 3 > -15 && h + 3 < -8)) [0.4, 1.3, 2.1].forEach((y) => box(g, 3, 0.05, 0.05, PM.grey, 1.5, y, 0)); }
  { const g = at(scene, -6.4, 37.8); rbox(g, 2, 2.4, 2, 0.1, PM.white, 0, 1.2, 0, 0.02); box(g, 2.02, 0.8, 1.4, PM.glass, 0, 1.6, 0); rbox(g, 2.4, 0.2, 2.4, 0.05, PM.blue, 0, 2.5, 0, 0.02); }
  { const g = at(scene, -38.6, 27.8); rbox(g, 2, 2.4, 2, 0.1, PM.white, 0, 1.2, 0, 0.02); box(g, 2.02, 0.8, 1.4, PM.glass, 0, 1.6, 0); rbox(g, 2.6, 0.2, 2.6, 0.05, PM.blue, 0, 2.5, 0, 0.02); }
  // hills with the tunnels for the road and the railway
  hill(scene, -58, 30, 16, 20, 13, [0x3f8f4a, 0x4a9a4a, 0x5aa85a, 0x2f7a3a]); hill(scene, 57, 34, 17, 20, 13, [0x3f8f4a, 0x4a9a4a, 0x5aa85a, 0x6ab86a]);
  portal(scene, -42.8, 24, YAW + PI / 2, 4.6, 4.8); portal(scene, -42.1, 31, YAW + PI / 2, 4.6, 5.2); portal(scene, -44.3, 40, YAW + PI / 2, 6.4, 4.8); portal(scene, 40.3, 31, YAW - PI / 2, 4.6, 5.2); portal(scene, 40.8, 39.6, YAW - PI / 2, 6.4, 4.8);
  // buildings: the harbour master's tower, a workshop, warehouses on the land side
  { const g = at(scene, -47, -4); rbox(g, 6, 7, 6, 0.1, PM.cream, 0, 3.5, 0, 0.03); for (let y = 1.5; y < 7; y += 1.8) [3.01, -3.01].forEach((z) => box(g, 4.6, 0.8, 0.05, PM.glass, 0, y, z));
    cylY(g, 1.6, 4, PM.white, 0, 9, 0, 16); cylY(g, 2.4, 0.3, PM.blue, 0, 11.1, 0, 16); cylY(g, 2.2, 1.6, PM.glass, 0, 12, 0, 16); add(g, new THREE.ConeGeometry(2.6, 1.4, 16), PM.blue, 0, 13.5, 0);
    rod(g, new V3(0, 14, 0), new V3(0, 17, 0), 0.06, PM.grey, 6); [[PM.blue, 0], [PM.white, 0.5], [PM.red, 1.0]].forEach(([m, dx]) => box(g, 0.5, 0.8, 0.03, m, 0.25 + dx, 16.4, 0));
    decal2(g, 'CAPITAINERIE', 5, 0.7, '#2453b8', 0, 7.4, 3.02, null); }
  shed(scene, -48, 8, 12, 9, 6, PM.teal, YAW + PI / 2);
  { const g = at(scene, -40, -10); rbox(g, 6, 3, 4, 0.1, PM.yel, 0, 1.5, 0, 0.02); rbox(g, 6.4, 0.25, 4.4, 0.05, PM.dark, 0, 3.1, 0, 0.02); box(g, 2.4, 2.2, 0.05, PM.dark, -1.2, 1.1, 2.01); box(g, 1.6, 0.9, 0.05, PM.glass, 1.6, 1.8, 2.01);
    [[2.6, 3.2], [-2.6, 3.2]].forEach(([x, z]) => { rbox(g, 1.4, 0.08, 0.8, 0.02, PM.wood, x, 0.75, z, 0.01); [0.5, -0.5].forEach((k) => box(g, 0.06, 0.75, 0.06, PM.wood, x + k, 0.37, z)); cylY(g, 0.05, 2, PM.grey, x, 1, z, 6); add(g, new THREE.ConeGeometry(1, 0.5, 12), PM.red, x, 2.1, z); }); }
  shed(scene, -16, 49, 16, 7, 6, PM.roofR); shed(scene, 14, 49, 16, 7, 6, PM.blueD);
  { const g = at(scene, 0, 49); rbox(g, 6, 5, 6, 0.1, PM.cream, 0, 2.5, 0, 0.03); for (let y = 1.2; y < 5; y += 1.4) box(g, 4.6, 0.7, 0.05, PM.glass, 0, y, 3.01); rbox(g, 6.4, 0.3, 6.4, 0.05, PM.red, 0, 5.1, 0, 0.02); }
  // tug base: a floating pontoon at the end of the quay
  { const g = at(scene, -40.5, -15.6, YAW, SEA); rbox(g, 16, 0.5, 1.4, 0.05, PM.wood, 0, 0.25, 0, 0.02); for (let x = -7; x <= 7; x += 3.5) cylY(g, 0.15, 2.6, PM.dark, x, 1.0, -0.7, 8); }
  // light masts (no real lights: just the bright lamp heads)
  [[-14, 0], [36, 0], [-20, 20], [6, 20], [32, 20], [-44, 14]].forEach(([h, d]) => { const g = at(scene, h, d); cylY(g, 0.18, 18, PM.grey, 0, 9, 0, 8); rbox(g, 2.4, 1.0, 0.3, 0.05, PM.dark, 0, 18.2, 0, 0.02); for (let i = 0; i < 4; i++) rbox(g, 0.5, 0.35, 0.1, 0.03, PM.lamp, -0.9 + i * 0.6, 18.2, 0.16, 0.01); });
  // the breakwater, with its lighthouse at the tip and a fisherman
  { const A = Q(54, -14), B = Q(40, -42), dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), g = grp(scene, A[0], 0, A[1]); g.rotation.y = Math.atan2(-dz, dx);
    rbox(g, L, 0.9, 3.2, 0.2, PM.concrete, L / 2, 0.15, 0, 0.03);
    const rk = [0x8a8678, 0x9a968a, 0x7a776c, 0xa8a496];
    for (let x = 0; x < L + 2; x += 1.3) [1, -1].forEach((s) => { const r = add(g, ICO, pick(rk), x + rnd(-0.4, 0.4), SEA + 0.4 + rnd(0, 0.5), s * (2.1 + rnd(0, 0.8))); r.scale.set(rnd(0.9, 1.5), rnd(0.7, 1.1), rnd(0.9, 1.4)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); });
    const lh = grp(g, L + 0.5, 0.6, 0); add(lh, new THREE.CylinderGeometry(1.0, 1.5, 10, 20), PM.white, 0, 5, 0); [2.2, 5.6].forEach((y) => cylY(lh, 1.42 - y * 0.05, 1.2, PM.red, 0, y, 0, 20));
    cylY(lh, 1.6, 0.25, PM.dark, 0, 10.1, 0, 20); rail(lh, Array.from({ length: 21 }, (_, i) => [Math.cos(i * PI / 10) * 1.55, 10.7, Math.sin(i * PI / 10) * 1.55]), 0.03, PM.dark);
    cylY(lh, 0.85, 1.5, PM.glassL, 0, 11.0, 0, 16); sph(lh, 0.5, PM.lamp, 0, 11.0, 0); add(lh, new THREE.ConeGeometry(1.1, 1.0, 16), PM.red, 0, 12.25, 0); box(lh, 0.06, 1.6, 0.7, PM.dark, 1.42, 1.0, 0);
    const fm = walker(g, L * 0.45, 0.9, { top: 0x3aa46a, hat: PM.yel }); fm.position.y = 0.6; fm.rotation.y = -PI / 2; rod(fm, new V3(0.2, 0.9, 0.2), new V3(0.4, 2.6, 2.4), 0.02, PM.dark, 4);
    LH.beam = grp(lh, 0, 11, 0); LH.beam.userData.dynamic = true;
    [1, -1].forEach((s) => { const c = add(LH.beam, new THREE.CylinderGeometry(1.6, 0.25, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), s * 5.2, 0, 0); c.rotation.z = s * PI / 2; c.castShadow = false; });
  }
  // riprap all along the island edge (not on the quay side), trees and benches on the land side
  { const rk = [0x8a8678, 0x9a968a, 0x7a776c, 0xa8a496], k = DQ / RAD, a0 = Math.asin(k) - PI / 4, a1 = PI - Math.asin(k) - PI / 4;
    for (let a = a0 + 0.02; a < a1 - 0.02; a += 0.022) { const r = add(scene, ICO, pick(rk), Math.cos(a) * (RAD + 0.6), SEA + 0.5 + rnd(0, 0.4), Math.sin(a) * (RAD + 0.6)); r.scale.set(rnd(1.0, 1.8), rnd(0.8, 1.2), rnd(1.0, 1.8)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); } }
  [[-30, 47], [-26, 52], [-8, 53], [6, 54], [26, 50], [30, 46], [-36, 44], [36, 42], [-52, 0], [-50, 14], [50, 6], [52, 16], [46, -6]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(scene, x, z, i % 3 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0xf2b21c, 0xe8901e, 0xf6cf3a]); });
  [[-20, 44.6], [-4, 44.6], [12, 44.6], [28, 44.6]].forEach(([h, d]) => { const g = at(scene, h, d); rbox(g, 1.8, 0.1, 0.5, 0.02, PM.wood, 0, 0.5, 0, 0.01); rbox(g, 1.8, 0.5, 0.08, 0.02, PM.wood, 0, 0.8, -0.24, 0.01); [0.7, -0.7].forEach((x) => box(g, 0.08, 0.5, 0.45, PM.dark, x, 0.25, 0)); });
  // a viewing terrace by the breakwater with a telescope
  { const g = at(scene, 46, -10); rbox(g, 6, 0.2, 4, 0.05, PM.wood, 0, 0.1, 0, 0.01); rail(g, [[-3, 0.2, -2], [-3, 1.1, -2], [3, 1.1, -2], [3, 0.2, -2]], 0.04, PM.white); cylY(g, 0.06, 1.1, PM.dark, 1.5, 0.65, -1.2, 6); cylX(g, 0.12, 0.6, PM.blue, 1.5, 1.3, -1.2, 10); }
  shadows(scene); return scene;
}
const LH = {};

/* ================= life: cars, walkers, gulls, buoys, sailboats ================= */
function buildLife(scene, onUpdate, W) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const road = R([[-50, 38.8], [48, 38.8], [50, 40], [48, 41.2], [-50, 41.2], [-52, 40]], 0.1);
  const cars = ['car', 'van', 'truck', 'car', 'kei', 'taxi', 'car'].map((k) => miniCar(scene, k)); all.push(...cars);
  const t1 = traffic(road, cars, 3.6, { gap: 4.5 });
  const walk = R([[-36, 43.3], [34, 43.3], [34, 44.1], [-36, 44.1]], 0.05);
  const folks = Array.from({ length: 9 }, (_, i) => walker(scene, 0, 0, { kid: i % 3 === 1 })); all.push(...folks);
  const t2 = traffic(walk, folks, 1.0, { gap: 1.2 });
  const dock = R([[-42, -12], [-30, -12], [-30, -3], [-42, -3]], 0.2);
  const dockers = Array.from({ length: 3 }, () => walker(scene, 0, 0, { vest: true, hat: PM.yel }));
  const t3 = traffic(dock, dockers, 1.1, { gap: 1.4 });
  // gulls circling over the harbour, flapping
  const gw = std(0xf6f7fb, 0.6, 0), gg = std(0x9aa0b0, 0.6, 0);
  const gulls = Array.from({ length: 9 }, (_, i) => {
    const g = grp(scene); const b = sph(g, 1, gw, 0, 0, 0); b.scale.set(0.36, 0.17, 0.17); sph(g, 0.13, gw, 0.34, 0.08, 0); add(g, new THREE.ConeGeometry(0.05, 0.2, 6), PM.yel, 0.52, 0.06, 0).rotation.z = -PI / 2;
    const wings = [1, -1].map((s) => { const w = grp(g, 0, 0.05, 0); const m = box(w, 0.35, 0.03, 0.9, gg, 0, 0, s * 0.45); void m; box(w, 0.25, 0.035, 0.3, PM.dark, -0.05, 0, s * 0.85); return w; });
    shadows(g); return { g, wings, c: Q(rnd(-30, 40), rnd(-40, 10)), r: rnd(8, 18), y: rnd(10, 20), sp: rnd(0.25, 0.45) * (i % 2 ? 1 : -1), ph: rnd(0, 6) };
  });
  // buoys marking the channel (green on one side, red on the other) and two little sailboats
  const buoys = [[-20, -43, 1], [0, -43, 1], [20, -43, 1], [-30, -60, 0], [-10, -60, 0], [10, -60, 0]].map(([h, d, gr]) => {
    const [x, z] = Q(h, d); const g = grp(scene, x, SEA, z); const M = gr ? PM.green : PM.red;
    cylY(g, 0.7, 1.2, M, 0, 0.3, 0, 14); if (gr) cylY(g, 0.45, 1.2, M, 0, 1.5, 0, 12); else add(g, new THREE.ConeGeometry(0.55, 1.4, 12), M, 0, 1.6, 0);
    cylY(g, 0.72, 0.2, PM.white, 0, 0.7, 0, 14); sph(g, 0.15, gr ? PM.greenLamp : PM.redLamp, 0, 2.5, 0); shadows(g); return g;
  });
  const sails = [0xf4f5f8, 0xffd23f].map((col) => { const g = grp(scene); extY(g, [[-1.6, -0.6], [1.0, -0.6], [1.8, 0], [1.0, 0.6], [-1.6, 0.6]], 0.2, 0.6, PM.white, 0, 0.2, 0, 0.03); rod(g, new V3(0, 0.4, 0), new V3(0, 4.6, 0), 0.05, PM.grey, 6);
    ext(g, [[0.1, 0.6], [0.1, 4.4], [1.9, 0.7]], 0.05, 0.04, std(col, 0.7, 0), 0, 0, 0, 0.01); ext(g, [[-0.1, 0.8], [-0.1, 4.3], [-1.7, 0.8]], 0.05, 0.04, std(col, 0.7, 0), 0, 0, 0, 0.01); shadows(g); return g; });
  const sr = [route([[-58, -40], [-48, -46], [-44, -58], [-56, -66], [-68, -54]].map(([h, d]) => Q(h, d)), true, 0.5), route([[58, -40], [66, -52], [56, -64], [48, -52]].map(([h, d]) => Q(h, d)), true, 0.5)];
  let T = 0;
  onUpdate((dt) => {
    T += dt;
    t1.update(dt, W.tractor ? [...all, W.tractor] : all); t2.update(dt, all); t3.update(dt, dockers);
    gulls.forEach((q) => { const a = q.ph + T * q.sp; q.g.position.set(q.c[0] + Math.cos(a) * q.r, q.y + Math.sin(T * 0.8 + q.ph) * 0.8, q.c[1] + Math.sin(a) * q.r); q.g.rotation.y = -a + (q.sp > 0 ? -PI / 2 : PI / 2); q.g.rotation.x = q.sp > 0 ? 0.25 : -0.25; const f = Math.sin(T * 7 + q.ph) * 0.5; q.wings[0].rotation.x = -f; q.wings[1].rotation.x = f; });
    buoys.forEach((b, i) => { b.position.y = SEA + Math.sin(T * 1.4 + i) * 0.12; b.rotation.z = Math.sin(T * 1.1 + i * 2) * 0.08; });
    sails.forEach((g, i) => { placeOn(g, sr[i], T * 2.2 + i * 10); g.position.y = SEA + Math.sin(T * 1.5 + i) * 0.08; g.rotation.x = 0.12; });
    if (LH.beam) LH.beam.rotation.y += dt * 1.2;
  });
}
