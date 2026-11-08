// Le Colis — follow a present (a teddy bear!) from the big warehouse to a child's front door:
// the truck at the loading dock, the pallet truck, the shelf robots, the parcel sorter, the van and its parcel lockers,
// the electric cargo bike, the delivery drone and the little sidewalk robot.
import * as THREE from 'three';
import { V3, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone, beep } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { tire, fender, beacon, truckCab } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, PI = Math.PI;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const FL = 1.2; // the warehouse floor is raised to the height of a truck floor (the loading dock)

/* ---------- textures and materials (defined once) ---------- */
function canvasTex(w, h, draw, rx = 1, ry = rx) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}
const cladT = canvasTex(64, 64, (x) => { x.fillStyle = '#dde2ea'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 16) { x.fillStyle = '#aab3c2'; x.fillRect(i, 0, 4, 64); x.fillStyle = '#f4f6fa'; x.fillRect(i + 8, 0, 2, 64); } }, 3, 1);
const beltT = canvasTex(64, 16, (x) => { x.fillStyle = '#30343f'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#4c5260'; for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 5, 16); }, 12, 1);
const gridT = canvasTex(64, 64, (x) => { x.fillStyle = '#d6d9e0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#c2c6d0'; x.fillRect(0, 0, 64, 2); x.fillRect(0, 0, 2, 64); x.fillStyle = '#2a2f40'; x.fillRect(26, 26, 12, 12); x.fillStyle = '#ffffff'; x.fillRect(29, 29, 3, 3); x.fillRect(33, 33, 3, 3); }, 16, 18);
const slatT = canvasTex(32, 32, (x) => { x.fillStyle = '#cfd5de'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#8f98a8'; for (let y = 0; y < 32; y += 4) x.fillRect(0, y, 32, 1); }, 1, 3);
const labelT = canvasTex(64, 48, (x) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 48); x.fillStyle = '#1d1f26';
  for (let i = 6; i < 58; i += 3) x.fillRect(i, 28, i % 9 === 0 ? 2 : 1, 14);
  x.fillRect(6, 6, 32, 4); x.fillRect(6, 14, 22, 3); x.fillStyle = '#e0303a'; x.fillRect(46, 5, 12, 12);
});
const awnT = (a, b) => canvasTex(64, 16, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 8, 0, 8, 16); } });
const glow = (c, i = 0.2) => std(c, 0.3, 0, { emissive: c, emissiveIntensity: i });
const LM = {
  card: std(0xc99a5e, 0.85, 0), cardD: std(0xb07f45, 0.85, 0), tape: std(0xe8cf98, 0.55, 0), label: std(0xffffff, 0.6, 0, { map: labelT }),
  ribbon: std(0xe0303a, 0.45, 0.05), teddy: std(0xa8703c, 0.95, 0), teddyL: std(0xecc79c, 0.9, 0),
  white: std(0xf4f5f8, 0.35, 0.1), grey: std(0xc9ced8, 0.45, 0.4), greyD: std(0x8a93a3, 0.4, 0.5), dark: std(0x2a2f40, 0.6, 0.15), steel: std(0x5a6a8a, 0.45, 0.5),
  navy: std(0x1f3a7a, 0.38, 0.2), orange: std(0xf2781c, 0.38, 0.12), yel: std(0xf4b81c, 0.4, 0.15), yelD: std(0xc88a10, 0.5, 0.2),
  red: std(0xd8302a, 0.4, 0.15), green: std(0x2f9a5a, 0.45, 0.1), blue: std(0x2f6fe0, 0.4, 0.15), teal: std(0x1f8a8a, 0.42, 0.2), mint: std(0x3fb8a0, 0.4, 0.15),
  clad: std(0xffffff, 0.55, 0.35, { map: cladT }), slab: std(0xbfc2ca, 0.9, 0), floor: std(0xd2d4da, 0.8, 0), grid: std(0xffffff, 0.85, 0, { map: gridT }),
  belt: std(0xffffff, 0.7, 0, { map: beltT }), slat: std(0xffffff, 0.45, 0.5, { map: slatT }),
  rack: std(0x2f5fb8, 0.45, 0.3), beam: std(0xf27a1c, 0.42, 0.2), wood: std(0xc8a06a, 0.85, 0), woodD: std(0x9a7448, 0.85, 0), ply: std(0xd8bc8a, 0.85, 0),
  film: std(0xe6f2ff, 0.08, 0.1, { transparent: true, opacity: 0.3, depthWrite: false }), glassL: std(0x9fd2ef, 0.05, 0.4, { transparent: true, opacity: 0.4, depthWrite: false }),
  foam: std(0x1d1f26, 0.95, 0), bin: std(0xf2c21c, 0.85, 0), binD: std(0xd09a14, 0.85, 0), tote: std(0x2f6fe0, 0.6, 0),
  laser: std(0xff4a3a, 0.3, 0, { emissive: 0xff2a1a, emissiveIntensity: 0.4 }), screen: glow(0x5ab0ff, 0.7),
  lawn: std(0x5aa84a, 0.95, 0), hedge: std(0x3f8a3a, 0.9, 0), stone: std(0xdcd1b8, 0.9, 0), stoneD: std(0xb3a88f, 0.9, 0), slate: std(0x4c5468, 0.6, 0.2), tile: std(0xb8583a, 0.8, 0),
  conc: std(0xc4c6ce, 0.9, 0), helmet: std(0xf2781c, 0.3, 0.2), shirt: std(0x1f3a7a, 0.7, 0),
  awnR: std(0xffffff, 0.8, 0, { map: awnT('#ffffff', '#d8402a') }), awnB: std(0xffffff, 0.8, 0, { map: awnT('#ffffff', '#2f6fe0') }), awnG: std(0xffffff, 0.8, 0, { map: awnT('#ffffff', '#2f9a5a') }),
  warm: new THREE.MeshBasicMaterial({ color: 0xffd896 })
};
const WALLS = [std(0xf1e6d2, 0.85, 0), std(0xe8d8b8, 0.85, 0), std(0xf4ecdc, 0.85, 0), std(0xe6cfb0, 0.85, 0), std(0xf2d4c8, 0.85, 0)];
const SHUT = [std(0x3f7fb8, 0.7, 0), std(0x4f9a6a, 0.7, 0), std(0xd8d0b8, 0.7, 0), std(0x6aa8c8, 0.7, 0), std(0xb8504a, 0.7, 0)];
const DEST = [LM.red, LM.blue, LM.green]; // the sorter's three destinations
const BOW = new THREE.TorusGeometry(0.07, 0.024, 6, 14);
const CABLE = new THREE.CylinderGeometry(0.01, 0.01, 1, 6);
const bake = (g) => { shadows(g); freeze(g); return g; };

/* ================= small things: parcels, the teddy bear, pallets, cages ================= */
/** A cardboard parcel standing on y = 0, with tape, a shipping label and an optional coloured sticker. */
function colis(p, w, h, d, o = {}) {
  const g = grp(p);
  rbox(g, w, h, d, 0.025, o.m || LM.card, 0, h / 2, 0, 0.01);
  box(g, w + 0.006, 0.01, Math.min(0.1, d * 0.3), LM.tape, 0, h + 0.002, 0); box(g, 0.01, h * 0.35, Math.min(0.1, d * 0.3), LM.tape, w / 2 + 0.002, h * 0.82, 0);
  box(g, w * 0.42, h * 0.36, 0.01, LM.label, w * 0.12, h * 0.5, d / 2 + 0.006);
  if (o.dot) box(g, 0.09, 0.09, 0.012, o.dot, -w * 0.3, h * 0.72, d / 2 + 0.008);
  return g;
}
/** The teddy bear, sitting, facing +x (about 1.6·s tall). */
function teddy(p, s = 0.22) {
  const g = grp(p), T = LM.teddy, L = LM.teddyL;
  sph(g, 0.42, T, 0, 0.5, 0).scale.y = 1.12; sph(g, 0.28, L, 0.22, 0.45, 0).scale.x = 0.55;
  sph(g, 0.36, T, 0, 1.16, 0); sph(g, 0.15, L, 0.3, 1.08, 0).scale.x = 0.7; sph(g, 0.055, MT.black, 0.41, 1.12, 0);
  [1, -1].forEach((k) => {
    sph(g, 0.045, MT.black, 0.3, 1.26, k * 0.13); sph(g, 0.13, T, -0.02, 1.46, k * 0.26); sph(g, 0.07, L, 0.06, 1.46, k * 0.26);
    const a = sph(g, 0.14, T, 0.1, 0.7, k * 0.4); a.scale.set(1, 1.7, 1); a.rotation.x = k * 0.5;
    sph(g, 0.17, T, 0.22, 0.12, k * 0.24).scale.set(1.5, 0.9, 1);
  });
  sph(g, 0.08, LM.ribbon, 0.3, 0.86, 0).scale.set(0.6, 0.8, 2.2);
  g.scale.setScalar(s); return g;
}
/** Léo's present: a box with a red ribbon and a bow. `withBear`: a teddy hidden inside, and a lid that comes off. */
function teddyBox(p, withBear = false) {
  const g = grp(p), d = grp(g), w = 0.5, h = 0.37;
  rbox(d, w, h, w, 0.03, LM.card, 0, h / 2, 0, 0.01);
  box(d, w + 0.01, h, 0.08, LM.ribbon, 0, h / 2, 0); box(d, 0.08, h, w + 0.01, LM.ribbon, 0, h / 2, 0);
  box(d, 0.18, 0.11, 0.01, LM.label, 0.13, 0.12, w / 2 + 0.008); sph(d, 0.05, LM.ribbon, -0.14, 0.26, w / 2 + 0.006).scale.z = 0.25;
  bake(d);
  const lid = grp(g, 0, h, 0);
  rbox(lid, w + 0.02, 0.05, w + 0.02, 0.02, LM.cardD, 0, 0.02, 0, 0.008); box(lid, w + 0.03, 0.055, 0.08, LM.ribbon, 0, 0.02, 0); box(lid, 0.08, 0.055, w + 0.03, LM.ribbon, 0, 0.02, 0);
  [1, -1].forEach((k) => { const b = add(lid, BOW, LM.ribbon, k * 0.06, 0.1, 0); b.rotation.set(0, PI / 2, k * 0.5); b.scale.set(1, 1, 0.6); });
  sph(lid, 0.035, LM.ribbon, 0, 0.07, 0);
  bake(lid);
  let bear = null;
  if (withBear) { bear = grp(g); teddy(bear, 0.2); bear.visible = false; }
  return { g, lid, bear };
}
/** A wooden euro pallet (1.2 along x, 0.8 along z, 0.144 high). */
function pallet(p) {
  const g = grp(p);
  [-0.34, 0, 0.34].forEach((z) => box(g, 1.2, 0.022, 0.1, LM.woodD, 0, 0.011, z));
  [-0.53, 0, 0.53].forEach((x) => [-0.34, 0, 0.34].forEach((z) => box(g, 0.14, 0.078, 0.1, LM.wood, x, 0.061, z)));
  [-0.53, 0, 0.53].forEach((x) => box(g, 0.14, 0.022, 0.8, LM.woodD, x, 0.111, 0));
  [-0.34, -0.17, 0, 0.17, 0.34].forEach((z) => box(g, 1.2, 0.022, 0.12, LM.wood, 0, 0.133, z));
  return g;
}
/** A pallet with two layers of boxes wrapped in stretch film; optionally Léo's present on top. */
function loadedPallet(p, teddyOn = false) {
  const g = grp(p); pallet(g);
  for (let ly = 0; ly < 2; ly++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = -0.3 + i * 0.6, z = -0.2 + j * 0.4, y = 0.144 + 0.21 + ly * 0.43;
    rbox(g, 0.58, 0.42, 0.38, 0.02, (i + j + ly) % 2 ? LM.card : LM.cardD, x, y, z, 0.008);
    if (j === 1) box(g, 0.2, 0.12, 0.01, LM.label, x + 0.1, y, 0.395);
  }
  box(g, 1.22, 0.88, 0.82, LM.film, 0, 0.144 + 0.44, 0);
  if (teddyOn) teddyBox(g).g.position.set(0.18, 1.03, 0.05);
  else colis(g, 0.4, 0.28, 0.36).position.set(-0.25, 1.03, 0);
  bake(g); return g;
}
/** A roll cage (wire cart on castors), open at the front (+z). */
function rollCage(p, x, z, ry = 0) {
  const g = grp(p, x, 0, z); g.rotation.y = ry; const K = LM.greyD;
  box(g, 0.82, 0.05, 0.7, K, 0, 0.17, 0);
  [[0.38, 0.32], [0.38, -0.32], [-0.38, 0.32], [-0.38, -0.32]].forEach(([a, b]) => { cylY(g, 0.06, 0.08, MT.black, a, 0.07, b, 10); box(g, 0.03, 1.55, 0.03, K, a, 0.95, b); });
  for (let y = 0.4; y < 1.7; y += 0.22) { box(g, 0.8, 0.015, 0.015, K, 0, y, -0.33); [1, -1].forEach((s) => box(g, 0.015, 0.015, 0.68, K, s * 0.39, y, 0)); }
  return g;
}

/* ================= machines ================= */
/** Dock gate on the warehouse wall (outer face at x = 0): shelter, bumpers, roll-up door, dock leveller and a red/green light. */
function dockGate(p, z0 = 0) {
  const g = grp(p, 0, 0, z0), d = grp(g);
  [1, -1].forEach((s) => {
    rbox(d, 0.35, 4.2, 0.35, 0.03, LM.steel, -0.2, FL + 2.1, s * 1.95, 0.01);
    rbox(d, 0.55, 3.4, 0.4, 0.1, LM.foam, 0.27, FL + 1.7, s * 1.72, 0.03);
    rbox(d, 0.18, 0.28, 0.32, 0.04, MT.black, 0.09, FL - 0.22, s * 1.0, 0.01);
    rbox(d, 3.5, 0.16, 0.12, 0.04, LM.yel, 2.1, 0.08, s * 1.55, 0.02);
  });
  rbox(d, 0.35, 0.5, 4.3, 0.03, LM.steel, -0.2, FL + 4.0, 0, 0.01);
  rbox(d, 0.55, 0.5, 3.85, 0.1, LM.foam, 0.27, FL + 3.55, 0, 0.03);
  rbox(d, 0.55, 0.5, 3.6, 0.1, LM.greyD, -0.45, FL + 3.65, 0, 0.02); // the roll-up drum hood, inside
  box(d, 0.04, 0.3, 3.0, MT.stripes, 0.01, FL - 0.15, 0);
  box(d, 2.4, 0.02, 2.12, LM.dark, -1.2, FL - 0.02, 0); // leveller pit
  rbox(d, 0.12, 0.6, 0.3, 0.03, LM.dark, 0.06, FL + 1.6, -2.4, 0.01);
  const red = glow(0xff3a2a, 1.4), green = glow(0x2aff5a, 0.1);
  sph(d, 0.08, red, 0.13, FL + 1.75, -2.4).scale.x = 0.5; sph(d, 0.08, green, 0.13, FL + 1.45, -2.4).scale.x = 0.5;
  rod(d, new V3(0.05, FL + 3.0, 2.3), new V3(0.9, FL + 3.2, 2.2), 0.03, LM.dark); cylX(d, 0.1, 0.18, LM.dark, 0.95, FL + 3.2, 2.2, 10); cylX(d, 0.07, 0.02, MT.lamp, 1.05, FL + 3.2, 2.2, 10);
  bake(d);
  const lev = grp(g, -2.4, FL, 0); rbox(lev, 2.4, 0.08, 2.0, 0.02, LM.greyD, 1.2, -0.04, 0, 0.01); [1, -1].forEach((s) => box(lev, 2.4, 0.082, 0.12, MT.stripes, 1.2, -0.04, s * 0.94));
  const lip = grp(lev, 2.4, -0.02, 0); box(lip, 0.42, 0.04, 1.96, LM.greyD, 0.21, 0, 0); lip.rotation.z = -PI / 2;
  const door = grp(g, -0.12, FL + 3.4, 0); box(door, 0.06, 3.4, 3.2, LM.slat, 0, -1.7, 0); box(door, 0.08, 0.1, 3.2, LM.dark, 0, -3.36, 0);
  return { g, lev, lip, door, red, green };
}

/** Semi-trailer truck: box trailer (rear at x = 0, floor at y = FL) and its cab-over tractor at the front. */
function semiTruck(p, o = {}) {
  const m = grp(p), d = grp(m), L = 10.5, W = 2.5, Y0 = FL, H = 2.7, TOP = Y0 + H;
  box(d, L, 0.12, W, LM.greyD, L / 2, Y0 - 0.06, 0); box(d, L - 0.2, 0.01, W - 0.16, LM.ply, L / 2, Y0 + 0.003, 0);
  box(d, L, 0.08, W, LM.white, L / 2, TOP - 0.04, 0); box(d, 0.06, H, W, LM.white, L - 0.03, Y0 + H / 2, 0);
  [1, -1].forEach((s) => {
    const open = o.open && s > 0;
    if (!open) {
      box(d, L, H, 0.05, LM.white, L / 2, Y0 + H / 2, s * (W / 2 - 0.025));
      for (let x = 0.8; x < L; x += 1.2) box(d, 0.05, H - 0.1, 0.02, LM.grey, x, Y0 + H / 2, s * (W / 2 + 0.005));
    } else {
      // curtain-sider with its curtain pulled back: stanchions and the bunched curtain at the front
      for (let x = 0.1; x < L; x += 2.6) box(d, 0.08, H, 0.08, LM.greyD, x, Y0 + H / 2, s * (W / 2 - 0.04));
      rbox(d, 0.5, H - 0.1, 0.18, 0.06, LM.navy, L - 0.4, Y0 + H / 2, s * (W / 2), 0.02);
      for (let x = L - 0.6; x < L; x += 0.12) box(d, 0.03, H - 0.12, 0.2, LM.navy, x, Y0 + H / 2, s * (W / 2 + 0.01));
    }
    if (!open) box(d, L - 0.15, H - 0.12, 0.02, LM.ply, L / 2, Y0 + H / 2, s * (W / 2 - 0.06));
    box(d, L, 0.16, 0.06, LM.greyD, L / 2, Y0 + 0.02, s * (W / 2 + 0.01)); box(d, L, 0.08, 0.06, LM.grey, L / 2, TOP - 0.04, s * (W / 2 + 0.01));
    [0.55, 0.85].forEach((y) => box(d, 3.6, 0.07, 0.04, LM.greyD, 6.4, y, s * 1.2)); [4.8, 6.4, 8.0].forEach((x) => box(d, 0.06, 0.5, 0.06, LM.greyD, x, 0.85, s * 1.2));
    for (let x = 0.6; x < L; x += 2.3) rbox(d, 0.1, 0.06, 0.03, 0.01, MT.amber, x, Y0 - 0.05, s * (W / 2 + 0.035), 0.005);
    box(d, 4.4, 0.05, 0.5, LM.dark, 2.8, 1.06, s * 1.0); rbox(d, 0.02, 0.5, 0.45, 0.01, MT.black, 0.55, 0.62, s * 1.0, 0.005);
    rbox(d, 0.06, 0.16, 0.44, 0.03, MT.tail, -0.13, 0.84, s * 0.88, 0.01); rbox(d, 0.065, 0.16, 0.12, 0.03, MT.amber, -0.135, 0.84, s * 1.06, 0.01);
    rbox(d, 0.12, H, 0.1, 0.02, LM.greyD, 0.06, Y0 + H / 2, s * (W / 2 - 0.05), 0.01);
  });
  box(d, 0.14, 0.2, W, LM.greyD, 0.07, TOP - 0.1, 0); box(d, 0.16, 0.22, W, LM.greyD, 0.08, Y0 - 0.11, 0);
  [0.5, -0.5].forEach((z) => box(d, L - 0.6, 0.28, 0.12, LM.dark, L / 2 + 0.2, Y0 - 0.26, z));
  [0.85, -0.85].forEach((z) => { rbox(d, 0.14, 1.0, 0.14, 0.02, LM.dark, 8.1, 0.55, z, 0.01); box(d, 0.3, 0.05, 0.3, LM.dark, 8.1, 0.04, z); });
  box(d, 0.06, 0.06, 1.7, LM.dark, 8.1, 0.7, 0); rod(d, new V3(8.1, 0.8, 0.95), new V3(8.3, 0.6, 1.15), 0.02, LM.greyD);
  box(d, 0.14, 0.18, 2.3, MT.stripes, -0.05, 0.55, 0); [0.9, -0.9].forEach((z) => rod(d, new V3(0.05, 0.6, z), new V3(0.05, Y0 - 0.2, z), 0.04, LM.dark));
  box(d, 0.02, 0.12, 0.5, LM.white, -0.14, 0.84, 0);
  [1, -1].forEach((s) => { const D = grp(d, 5.0, Y0 + 1.5, 0); D.rotation.y = s > 0 ? 0 : PI; if (o.open && s > 0) return; decal(D, 'BIDULE', 4.6, 1.0, '#1f3a7a', 0, 0.22, W / 2 + 0.02, null); decal(D, 'livraison de colis', 4.2, 0.4, '#f2781c', 0, -0.6, W / 2 + 0.02, null); });
  if (o.load) [[0.9, 0.42], [0.9, -0.42], [2.2, 0.42], [2.2, -0.42]].forEach(([x, z]) => { const P = loadedPallet(d); P.position.set(x, Y0, z); P.rotation.y = PI / 2; });
  if (o.tractor !== false) {
    [0.42, -0.42].forEach((z) => box(d, 5.4, 0.3, 0.12, LM.dark, 11.2, 0.86, z));
    box(d, 1.2, 0.1, 1.5, LM.dark, 9.4, 1.02, 0);
    truckCab(d, LM.navy, 12.2);
    ext(d, [[12.25, 2.88], [13.45, 2.88], [13.15, 3.4], [12.65, 3.8], [12.25, 3.84]], [0.04, 0.1, 0.2, 0.15, 0.04], 2.15, LM.navy, 0, 0, 0, 0.03);
    [1, -1].forEach((s) => {
      box(d, 1.5, 0.12, 0.02, LM.orange, 13.0, 1.95, s * 1.115);
      cylX(d, 0.3, 1.1, LM.grey, 11.0, 0.75, s * 0.95, 16); [10.5, 11.5].forEach((x) => box(d, 0.05, 0.64, 0.64, LM.dark, x, 0.75, s * 0.95));
      box(d, 1.0, 0.05, 0.62, LM.dark, 9.3, 1.12, s * 0.88); rbox(d, 0.02, 0.5, 0.55, 0.01, MT.black, 8.72, 0.72, s * 0.88, 0.005);
      rbox(d, 0.7, 0.45, 0.3, 0.04, LM.dark, 10.0, 0.8, s * 0.95, 0.02);
    });
    cylY(d, 0.09, 2.6, MT.chrome, 12.0, 2.2, 0.78, 10); cylY(d, 0.1, 0.12, MT.black, 12.0, 3.5, 0.78, 10);
    rail(d, [[12.15, 2.1, 0.2], [11.4, 1.85, 0.25], [10.6, 1.9, 0.25], [10.5, 1.6, 0.25]], 0.025, LM.red);
    rail(d, [[12.15, 2.1, -0.2], [11.4, 1.85, -0.25], [10.6, 1.9, -0.25], [10.5, 1.6, -0.25]], 0.025, LM.yel);
    [1, -1].forEach((s) => fender(d, 0.58, 0.42, 13.0, 0.5, s * 1.0, LM.navy, PI * 0.5));
  }
  bake(d);
  const wheels = [], W0 = (t) => { bake(t); wheels.push(t); };
  [1, -1].forEach((s) => {
    [1.5, 2.8, 4.1].forEach((x) => W0(tire(m, 0.5, 0.42, x, 0.5, s * 1.0, LM.grey, s)));
    if (o.tractor !== false) { W0(tire(m, 0.5, 0.34, 13.0, 0.5, s * 1.0, LM.grey, s)); [0.7, 1.04].forEach((z) => W0(tire(m, 0.5, 0.3, 9.3, 0.5, s * z, LM.grey, s))); }
  });
  const doors = [1, -1].map((s) => {
    const h = grp(m, -0.02, Y0 + H / 2, s * (W / 2 - 0.01)), lf = grp(h);
    rbox(lf, 0.05, H - 0.08, W / 2 - 0.02, 0.02, LM.white, -0.03, 0, -s * (W / 4), 0.01);
    [0.3, 0.9].forEach((k) => { rod(lf, new V3(-0.08, -H / 2 + 0.12, -s * k), new V3(-0.08, H / 2 - 0.12, -s * k), 0.022, MT.chrome, 6); box(lf, 0.06, 0.05, 0.22, LM.greyD, -0.09, -0.1, -s * (k + 0.1)); });
    box(lf, 0.02, 0.1, W / 2 - 0.12, MT.tail, -0.06, -H / 2 + 0.3, -s * (W / 4));
    bake(lf); if (o.open) h.rotation.y = s * 4.6; return h;
  });
  return { g: m, wheels, doors };
}

/** Electric stand-on pallet truck, forks toward +x. */
function palletJack(st, p) {
  const g = grp(p), d = grp(g), Y = LM.yel, K = LM.dark;
  ext(d, [[-0.55, 0.1], [0.28, 0.1], [0.3, 0.75], [0.12, 1.0], [-0.55, 1.0]], [0.04, 0.04, 0.12, 0.12, 0.06], 0.78, Y, 0, 0, 0, 0.03);
  rbox(d, 0.88, 0.12, 0.82, 0.04, K, -0.13, 0.14, 0, 0.02); box(d, 0.02, 0.14, 0.6, MT.stripes, 0.3, 0.24, 0);
  box(d, 0.02, 0.02, 0.79, K, -0.12, 1.0, 0); box(d, 0.02, 0.4, 0.02, K, -0.12, 0.8, 0.395);
  rbox(d, 0.48, 0.06, 0.7, 0.02, K, -0.8, 0.13, 0, 0.01); box(d, 0.42, 0.006, 0.62, MT.rubberS, -0.8, 0.165, 0);
  [1, -1].forEach((s) => rail(d, [[-0.55, 0.5, s * 0.38], [-0.98, 0.5, s * 0.38], [-0.98, 1.05, s * 0.38], [-0.55, 1.05, s * 0.38]], 0.022, K));
  rod(d, new V3(0.0, 0.98, 0), new V3(-0.25, 1.2, 0), 0.04, K); rbox(d, 0.14, 0.12, 0.52, 0.04, K, -0.28, 1.22, 0, 0.01);
  [1, -1].forEach((s) => cylZ(d, 0.035, 0.12, LM.red, -0.33, 1.24, s * 0.24, 8)); box(d, 0.01, 0.06, 0.14, LM.screen, -0.21, 1.25, 0);
  decal(d, 'BIDULE', 0.5, 0.12, '#1f3a7a', -0.15, 0.62, 0.4, null);
  bake(d);
  const forks = grp(g, 0.3, 0, 0);
  rbox(forks, 0.08, 0.25, 0.76, 0.02, K, 0.04, 0.2, 0, 0.01);
  [-0.3, 0, 0.3].forEach((z) => box(forks, 0.04, 0.85, 0.05, K, 0.04, 0.72, z)); [0.85, 1.15].forEach((y) => box(forks, 0.05, 0.05, 0.76, K, 0.04, y, 0));
  [0.28, -0.28].forEach((z) => { rbox(forks, 1.15, 0.07, 0.17, 0.02, K, 0.66, 0.095, z, 0.01); cylZ(forks, 0.035, 0.12, LM.grey, 1.1, 0.04, z, 8); });
  bake(forks);
  const dw = grp(g, -0.2, 0.13, 0.2); cylZ(dw, 0.13, 0.1, MT.rubberS, 0, 0, 0, 16); cylZ(dw, 0.07, 0.11, Y, 0, 0, 0, 10); dw.userData.r = 0.13; bake(dw);
  const driver = walker(g, -0.8, 0, { vest: true, hat: MT.hat }); driver.position.y = 0.16; driver.userData.arms.forEach((a) => (a.rotation.z = 0.9));
  beacon(st, g, -0.4, 1.0, -0.3);
  return { g, forks, wheels: [dw], driver };
}

/** Shelf-carrying warehouse robot (low and orange) with its lifting turntable. */
function shelfBot(p) {
  const g = grp(p), d = grp(g);
  rbox(d, 0.96, 0.28, 0.82, 0.12, LM.orange, 0, 0.2, 0, 0.03); rbox(d, 0.98, 0.08, 0.84, 0.06, LM.dark, 0, 0.07, 0, 0.02);
  [1, -1].forEach((s) => { box(d, 0.01, 0.06, 0.34, MT.glassD, s * 0.485, 0.22, 0); box(d, 0.6, 0.03, 0.01, LM.screen, 0, 0.27, s * 0.415); });
  decal(d, 'BIDULE', 0.4, 0.08, '#ffffff', 0, 0.17, 0.416, null);
  bake(d);
  const top = grp(g, 0, 0.34, 0); cylY(top, 0.3, 0.04, LM.greyD, 0, 0.02, 0, 24); cylY(top, 0.22, 0.05, LM.dark, 0, 0.03, 0, 20);
  [0, 1, 2, 3].forEach((i) => box(top, 0.08, 0.06, 0.08, LM.yel, Math.cos(i * PI / 2) * 0.24, 0.05, Math.sin(i * PI / 2) * 0.24)); bake(top);
  return { g, top };
}
/** Storage pod: four legs (the robot drives under), five levels of yellow fabric bins. */
function pod(p, withGift = false) {
  const g = grp(p), d = grp(g), K = LM.dark;
  [[0.52, 0.52], [0.52, -0.52], [-0.52, 0.52], [-0.52, -0.52]].forEach(([a, b]) => { box(d, 0.06, 0.48, 0.06, K, a, 0.24, b); box(d, 0.05, 2.0, 0.05, K, a, 1.47, b); });
  rbox(d, 1.1, 0.06, 1.1, 0.02, LM.greyD, 0, 0.48, 0, 0.01);
  for (let i = 0; i < 5; i++) {
    const y = 0.52 + i * 0.39;
    rbox(d, 1.06, 0.36, 1.06, 0.02, i % 2 ? LM.binD : LM.bin, 0, y + 0.18, 0, 0.01);
    [-0.18, 0.18].forEach((u) => { box(d, 0.015, 0.3, 1.075, K, u, y + 0.18, 0); box(d, 1.075, 0.3, 0.015, K, 0, y + 0.18, u); });
    box(d, 1.075, 0.025, 1.075, LM.white, 0, y + 0.22, 0);
    if (i < 4) [[0.25, -0.3, LM.blue], [-0.3, 0.32, LM.red]].forEach(([a, b, c], k) => { if ((i + k) % 2) box(d, 0.16, 0.08, 0.16, c, a, y + 0.38, b); });
  }
  rbox(d, 1.1, 0.04, 1.1, 0.02, K, 0, 2.48, 0, 0.01);
  bake(d);
  let gift = null;
  if (withGift) { gift = grp(g, 0.42, 1.31, 0.1); teddyBox(gift).g.scale.setScalar(0.62); }
  return { g, gift };
}
/** Picking workstation: a gantry with the pick-to-light, a screen, the table with the tote. */
function pickStation(p, x) {
  const g = grp(p, x, 0, 0), K = LM.dark;
  [0.95, -0.95].forEach((z) => { rbox(g, 0.12, 2.6, 0.12, 0.02, LM.navy, -0.5, 1.3, z, 0.01); box(g, 0.05, 1.8, 0.05, LM.yel, -0.62, 0.9, z * 0.92); });
  rbox(g, 0.16, 0.2, 2.02, 0.03, LM.navy, -0.5, 2.6, 0, 0.01);
  const lampM = std(0x2a8a3a, 0.3, 0, { emissive: 0x2aff5a, emissiveIntensity: 0.05 }); rbox(g, 0.14, 0.12, 0.5, 0.04, lampM, -0.58, 2.42, 0, 0.01);
  rbox(g, 0.62, 0.06, 1.0, 0.02, LM.grey, 0.3, 0.85, 1.1, 0.01); [[0.05, 0.7], [0.55, 0.7], [0.05, 1.5], [0.55, 1.5]].forEach(([a, b]) => box(g, 0.04, 0.82, 0.04, K, a, 0.41, b));
  rbox(g, 0.52, 0.28, 0.4, 0.04, LM.tote, 0.3, 1.02, 1.1, 0.01); box(g, 0.44, 0.01, 0.32, K, 0.3, 1.165, 1.1);
  box(g, 0.6, 0.06, 2.6, LM.greyD, 0.3, 0.8, 2.9); for (let z = 1.75; z < 4.2; z += 0.25) cylX(g, 0.03, 0.56, LM.grey, 0.3, 0.84, z, 8); [1.8, 4.0].forEach((z) => box(g, 0.5, 0.78, 0.05, K, 0.3, 0.39, z));
  rbox(g, 0.05, 0.36, 0.52, 0.03, K, -0.05, 1.55, -0.95, 0.01); box(g, 0.01, 0.3, 0.45, LM.screen, -0.025 + 0.06, 1.55, -0.95); rod(g, new V3(-0.05, 1.35, -0.95), new V3(-0.05, 0.0, -0.95), 0.03, K);
  box(g, 1.2, 0.02, 1.4, MT.rubberS, 0.65, 0.01, 0);
  bake(g);
  return { g, lampM, tote: new V3(x + 0.3, 1.18, 1.1) };
}

/** The parcel sorter: belt, infeed hood, scanner arch, three pushers and chutes with roll cages, end bin. */
const PX = [-1, 3.5, 8], BY = 0.85;
function sorter(p) {
  const g = grp(p), d = grp(g), K = LM.greyD;
  box(d, 24, 0.04, 0.9, LM.belt, 0, BY, 0);
  [1, -1].forEach((s) => box(d, 24, 0.16, 0.06, LM.grey, 0, BY + 0.02, s * 0.48));
  rbox(d, 24, 0.14, 1.0, 0.03, K, 0, BY - 0.12, 0, 0.01);
  for (let x = -11.5; x <= 11.6; x += 2.3) [1, -1].forEach((s) => { box(d, 0.08, BY - 0.18, 0.08, K, x, (BY - 0.18) / 2, s * 0.42); box(d, 0.2, 0.02, 0.2, K, x, 0.01, s * 0.42); });
  cylZ(d, 0.12, 1.0, LM.greyD, 12, BY - 0.05, 0, 14); rbox(d, 0.4, 0.35, 0.3, 0.04, LM.blue, 12, BY - 0.25, -0.65, 0.01);
  // infeed hood the parcels come out of, and its long feeding belt from the back
  rbox(d, 1.5, 1.1, 1.4, 0.08, LM.navy, -12.75, BY + 0.5, 0, 0.02); box(d, 0.02, 0.8, 1.0, LM.dark, -12.0, BY + 0.42, 0);
  rbox(d, 1.0, 0.1, 3, 0.03, K, -12.75, BY + 1.2, -2.0, 0.01); box(d, 0.8, 0.02, 2.9, LM.belt, -12.75, BY + 1.26, -2.0); box(d, 0.1, BY + 1.15, 0.1, K, -12.75, (BY + 1.15) / 2, -3.2);
  // scanner arch
  [1, -1].forEach((s) => rbox(d, 0.25, 2.1, 0.25, 0.04, LM.navy, -6, 1.05, s * 0.78, 0.02));
  rbox(d, 0.6, 0.45, 1.8, 0.06, LM.navy, -6, 2.2, 0, 0.02); box(d, 0.4, 0.02, 1.2, LM.screen, -6, 1.97, 0);
  decal(d, 'SCANNER', 1.3, 0.28, '#ffffff', -6, 2.2, 0.91, null);
  box(d, 0.03, 0.006, 0.9, LM.laser, -6, BY + 0.025, 0);
  rbox(d, 0.06, 0.45, 0.6, 0.03, LM.dark, -6.5, 1.5, -1.25, 0.01); box(d, 0.01, 0.38, 0.52, LM.screen, -6.47, 1.5, -1.25); cylY(d, 0.04, 1.3, LM.dark, -6.5, 0.65, -1.25, 8);
  // three pushers on the far side, three chutes and cages on the near side
  PX.forEach((x, i) => {
    rbox(d, 0.6, 0.38, 0.5, 0.05, LM.orange, x, BY + 0.1, -0.85, 0.02); box(d, 0.62, 0.05, 0.52, LM.dark, x, BY + 0.31, -0.85);
    const ch = grp(d, x, (BY + 0.55) / 2, 1.35); ch.rotation.x = 0.174;
    box(ch, 0.9, 0.04, 1.73, LM.grey, 0, 0, 0); [1, -1].forEach((s) => box(ch, 0.04, 0.26, 1.73, DEST[i], s * 0.47, 0.11, 0));
    [0.2, -0.2].forEach((dx) => box(d, 0.05, 0.5, 0.05, K, x + dx * 2, 0.25, 1.9));
    rollCage(d, x, 2.75); [[-0.15, 0.3], [0.18, 0.35], [0, 0.12]].forEach(([a, b], k) => colis(d, 0.32, 0.22, 0.3, { dot: DEST[i] }).position.set(x + a, 0.2 + k * 0.08, 2.75 + b - 0.25));
    cylY(d, 0.04, 2.4, K, x + 0.55, 1.2, 2.3, 8); rbox(d, 0.55, 0.42, 0.05, 0.05, DEST[i], x + 0.55, 2.2, 2.33, 0.02); cylZ(d, 0.11, 0.06, LM.white, x + 0.55, 2.2, 2.37, 16);
  });
  rbox(d, 1.2, 0.9, 1.2, 0.05, LM.greyD, 13.0, 0.45, 0, 0.02); box(d, 1.05, 0.02, 1.05, LM.dark, 13.0, 0.9, 0);
  bake(d);
  const paddles = PX.map((x) => { const pd = grp(g, x, BY + 0.12, -0.5); rbox(pd, 0.7, 0.2, 0.06, 0.02, LM.yel, 0, 0, 0, 0.01); cylZ(pd, 0.03, 0.5, MT.chrome, 0, 0, -0.25, 8); bake(pd); return pd; });
  return { g, paddles };
}

/** Panel van (Sprinter-like) facing +x, with two rear doors. */
function deliveryVan(p) {
  const m = grp(p), d = grp(m), B = LM.white, W = 2.0;
  ext(d, [[-2.8, 0.42], [2.6, 0.42], [2.82, 0.62], [2.8, 0.98], [2.5, 1.18], [1.8, 1.36], [1.1, 2.38], [0.85, 2.55], [-2.8, 2.55]], [0.05, 0.1, 0.12, 0.2, 0.25, 0.12, 0.25, 0.15, 0.05], W, B, 0, 0, 0, 0.04);
  const ws = box(d, 0.03, 1.12, W - 0.2, MT.glassD, 1.525, 1.92, 0); ws.rotation.z = 0.6;
  [1, -1].forEach((s) => {
    const Z = s * (W / 2 + 0.006);
    rbox(d, 0.7, 0.55, 0.03, 0.06, MT.glassD, 1.12, 1.8, Z, 0.01);
    [1.62, 0.45].forEach((x) => box(d, 0.025, 1.85, 0.03, LM.dark, x, 1.45, s * (W / 2 + 0.008)));
    if (s > 0) [-0.25, -1.75].forEach((x) => box(d, 0.025, 1.9, 0.03, LM.dark, x, 1.45, W / 2 + 0.008));
    box(d, 0.16, 0.035, 0.04, MT.chrome, 0.65, 1.5, s * (W / 2 + 0.02));
    box(d, 5.4, 0.22, 0.02, LM.orange, -0.05, 1.0, Z); box(d, 5.4, 0.06, 0.02, LM.navy, -0.05, 0.84, Z);
    const D = grp(d, -1.0, 1.75, 0); if (s < 0) D.rotation.y = PI; decal(D, 'BIDULE COLIS', 3.2, 0.42, '#1f3a7a', 0, 0, W / 2 + 0.012, null);
    rod(d, new V3(1.75, 1.75, s * 1.0), new V3(1.95, 1.78, s * 1.22), 0.025, LM.dark); rbox(d, 0.07, 0.36, 0.18, 0.03, LM.dark, 1.97, 1.72, s * 1.25, 0.01);
    rbox(d, 0.06, 0.16, 0.36, 0.04, MT.lamp, 2.76, 0.95, s * 0.66, 0.01); rbox(d, 0.06, 0.1, 0.12, 0.03, MT.amber, 2.74, 0.95, s * 0.9, 0.01);
    rbox(d, 0.05, 0.5, 0.14, 0.02, MT.tail, -2.82, 1.05, s * 0.92, 0.01);
    rbox(d, 0.3, 0.05, 0.25, 0.02, LM.dark, 0.95, 0.4, s * 0.9, 0.01);
  });
  rbox(d, 0.07, 0.3, 1.0, 0.04, LM.dark, 2.8, 0.78, 0, 0.01); for (let i = 0; i < 3; i++) box(d, 0.02, 0.025, 0.9, MT.chrome, 2.84, 0.7 + i * 0.08, 0);
  rbox(d, 0.22, 0.26, W + 0.02, 0.06, LM.dark, 2.72, 0.52, 0, 0.02); rbox(d, 0.22, 0.24, W, 0.05, LM.dark, -2.85, 0.55, 0, 0.02);
  box(d, 0.03, 0.12, 0.42, LM.white, 2.86, 0.5, 0);
  [-0.6, 0.6].forEach((z) => box(d, 3.2, 0.04, 0.05, LM.grey, -0.9, 2.57, z));
  box(d, 0.01, 1.95, 1.86, LM.ply, -2.815, 1.5, 0); [1.1, 1.75].forEach((y) => box(d, 0.03, 0.03, 1.8, LM.greyD, -2.83, y, 0));
  [1, -1].forEach((s) => [1.85, -1.75].forEach((x) => fender(d, 0.45, 0.32, x, 0.38, s * 0.86, LM.dark, PI * 0.62)));
  bake(d);
  // what we load inside shows against the back wall
  const load = [[-0.45, 0.55], [0.4, 0.55], [0, 1.2]].map(([z, y]) => { const c = colis(m, 0.06, 0.38, 0.5); c.position.set(-2.86, y, z); c.visible = false; return c; });
  const doors = [1, -1].map((s) => {
    const h = grp(m, -2.86, 1.5, s * 0.99);
    rbox(h, 0.05, 2.05, 0.97, 0.04, B, 0, 0, -s * 0.485, 0.01); rbox(h, 0.03, 0.55, 0.78, 0.04, MT.glassD, -0.02, 0.5, -s * 0.5, 0.01);
    box(h, 0.03, 0.2, 0.96, LM.orange, -0.03, -0.5, -s * 0.485); box(h, 0.03, 0.035, 0.14, MT.chrome, -0.04, -0.1, -s * 0.85);
    bake(h); return h;
  });
  const wheels = []; [1, -1].forEach((s) => [1.85, -1.75].forEach((x) => { const t = tire(m, 0.38, 0.26, x, 0.38, s * 0.86, LM.grey, s); bake(t); wheels.push(t); }));
  return { g: m, wheels, doors, load };
}
/** Parcel lockers ("consigne"): rows of little doors, a screen and a keypad; one door opens. */
function lockers(p, x, z) {
  const g = grp(p, x, 0, z), d = grp(g), W = 3.4, H = 2.1, D = 0.7, F = D / 2 + 0.02;
  rbox(d, W, H, D, 0.04, LM.mint, 0, H / 2 + 0.1, 0, 0.02); rbox(d, W + 0.1, 0.1, D + 0.1, 0.03, LM.dark, 0, 0.05, 0, 0.01);
  rbox(d, W + 0.4, 0.14, D + 0.5, 0.04, LM.navy, 0, H + 0.4, 0.1, 0.02); [1, -1].forEach((s) => box(d, 0.08, 0.3, 0.08, LM.navy, s * (W / 2 + 0.05), H + 0.22, 0.1));
  decal(d, 'CONSIGNE', 2.2, 0.32, '#ffffff', 0, H + 0.4, D / 2 + 0.36, null);
  const cols = [-1.35, -0.75, 0.75, 1.35];
  cols.forEach((cx) => { for (let r = 0; r < 5; r++) { const y = 0.36 + r * 0.38; if (cx === 0.75 && r === 1) continue; rbox(d, 0.56, 0.34, 0.03, 0.02, LM.white, cx, y, F, 0.008); box(d, 0.05, 0.05, 0.02, glow(0x2aff5a, 0.3), cx + 0.2, y + 0.11, F + 0.016); box(d, 0.03, 0.12, 0.03, LM.greyD, cx - 0.22, y, F + 0.02); } });
  rbox(d, 0.75, 1.9, 0.03, 0.03, LM.dark, 0, 1.05, F, 0.01); box(d, 0.5, 0.4, 0.01, LM.screen, 0, 1.45, F + 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(d, 0.08, 0.06, 0.02, LM.grey, -0.12 + i * 0.12, 0.95 - j * 0.09, F + 0.02);
  box(d, 0.54, 0.32, 0.02, LM.dark, 0.75, 0.74, F - 0.005);
  bake(d);
  const led = glow(0xff3a2a, 1.2); box(g, 0.05, 0.05, 0.02, led, 0.95, 0.85, F + 0.03);
  const door = grp(g, 0.47, 0.74, F + 0.01); rbox(door, 0.56, 0.34, 0.03, 0.02, LM.white, 0.28, 0, 0, 0.008); box(door, 0.03, 0.12, 0.03, LM.greyD, 0.5, 0, 0.02); bake(door);
  return { g, door, led, slot: new V3(x + 0.75, 0.6, z + 0.1) };
}

/** A bicycle wheel (spokes, tyre, hub) — origin at the hub. */
function bikeWheel(p, R, x, motor) {
  const w = grp(p, x, R, 0);
  add(w, new THREE.TorusGeometry(R - 0.025, 0.026, 8, 28), MT.rubberS); add(w, new THREE.TorusGeometry(R - 0.055, 0.012, 6, 28), MT.chrome);
  for (let i = 0; i < 6; i++) { const s = box(w, 2 * (R - 0.06), 0.008, 0.008, MT.chrome, 0, 0, 0); s.rotation.z = (i * PI) / 6; }
  cylZ(w, motor ? 0.09 : 0.03, motor ? 0.1 : 0.12, motor ? LM.dark : MT.chrome, 0, 0, 0, 12);
  bake(w); w.userData.r = R; return w;
}
/** Electric front-box cargo bike (bakfiets), facing +x, with its rider. */
function cargoBike(p) {
  const g = grp(p), d = grp(g), F = LM.teal, K = LM.dark, Rr = 0.33, Rf = 0.25;
  const tube = (a, b, r = 0.03, mm = F) => rod(d, new V3(...a), new V3(...b), r, mm, 8);
  tube([-0.42, 0.3, 0], [-0.62, 0.95, 0], 0.035);
  [0.07, -0.07].forEach((z) => { tube([-0.42, 0.3, z], [-0.95, Rr, z * 1.3], 0.022); tube([-0.58, 0.85, z], [-0.95, Rr, z * 1.3], 0.02); });
  tube([0.12, 0.28, 0], [0.04, 1.05, 0], 0.032, K); tube([-0.42, 0.28, 0], [1.3, 0.28, 0], 0.04); tube([-0.42, 0.3, 0], [0.08, 0.75, 0], 0.032);
  tube([1.3, 0.28, 0], [1.28, 0.72, 0], 0.04); [0.06, -0.06].forEach((z) => tube([1.29, 0.72, z], [1.38, Rf, z], 0.018, K));
  tube([0.12, 0.42, 0.06], [1.26, 0.46, 0.06], 0.012, MT.chrome);
  rod(d, new V3(0.03, 1.05, -0.3), new V3(0.03, 1.05, 0.3), 0.018, K); [1, -1].forEach((s) => cylZ(d, 0.03, 0.12, MT.black, 0.03, 1.05, s * 0.32, 8));
  cylY(d, 0.035, 0.03, MT.chrome, 0.06, 1.08, 0.2, 10); rbox(d, 0.26, 0.06, 0.15, 0.03, MT.black, -0.64, 0.98, 0, 0.01);
  const bat = rbox(d, 0.1, 0.34, 0.1, 0.03, K, -0.15, 0.53, 0, 0.01); bat.rotation.z = -0.75; box(d, 0.02, 0.04, 0.04, glow(0x2aff5a, 0.8), -0.1, 0.62, 0.05);
  rail(d, [[-0.6, 0.78, 0.15], [-1.25, 0.72, 0.15]], 0.015, K); rail(d, [[-0.6, 0.78, -0.15], [-1.25, 0.72, -0.15]], 0.015, K); box(d, 0.6, 0.02, 0.3, K, -0.95, 0.73, 0);
  fender(d, Rr + 0.05, 0.08, -0.95, Rr, 0, LM.dark, PI * 0.6);
  [1, -1].forEach((s) => rod(d, new V3(-0.3, 0.28, s * 0.06), new V3(-0.25, 0.02, s * 0.2), 0.012, K));
  const bx = grp(d, 0.72, 0.32, 0); box(bx, 0.95, 0.04, 0.72, LM.woodD, 0, 0.02, 0);
  [1, -1].forEach((s) => { box(bx, 0.03, 0.52, 0.72, F, s * 0.475, 0.28, 0); box(bx, 0.95, 0.52, 0.03, F, 0, 0.28, s * 0.36); });
  decal(bx, 'BIDULE', 0.7, 0.16, '#ffffff', 0, 0.3, 0.38, null);
  cylX(d, 0.05, 0.06, LM.dark, 1.24, 0.75, 0, 10); cylX(d, 0.04, 0.02, MT.lamp, 1.27, 0.75, 0, 10); box(d, 0.03, 0.05, 0.08, MT.tail, -1.26, 0.72, 0);
  bake(d);
  const lid = grp(g, 0.245, 0.86, 0); rbox(lid, 0.97, 0.04, 0.74, 0.02, F, 0.485, 0.02, 0, 0.01); box(lid, 0.4, 0.01, 0.2, LM.white, 0.5, 0.045, 0); bake(lid);
  const wheels = [bikeWheel(g, Rr, -0.95, true), bikeWheel(g, Rf, 1.38)];
  const crank = grp(g, -0.42, 0.3, 0); cylZ(crank, 0.1, 0.02, LM.dark, 0, 0, 0.05, 16);
  [1, -1].forEach((s) => { const a = box(crank, 0.03, 0.17, 0.02, LM.greyD, 0, s * 0.085, s * 0.07); void a; box(crank, 0.1, 0.02, 0.08, MT.black, 0, s * 0.17, s * 0.12); });
  bake(crank);
  const rider = walker(g, -0.66, 0, { top: 0x3aa46a, bottom: 0x2a3550, hat: LM.helmet }); rider.position.y = 0.5; rider.rotation.z = -0.22;
  rider.userData.arms.forEach((a) => (a.rotation.z = 1.25));
  return { g, wheels, crank, lid, rider, box: bx };
}

/** Delivery hexacopter with a winch: the parcel hangs from a hook at the end of a cable. */
function deliveryDrone(p) {
  const g = grp(p), d = grp(g), K = LM.dark;
  ext(d, [[-0.55, 0.0], [0.42, 0.0], [0.62, 0.12], [0.55, 0.3], [-0.4, 0.34], [-0.62, 0.16]], 0.08, 0.6, LM.white, 0, 0, 0, 0.04);
  box(d, 1.08, 0.07, 0.62, LM.orange, 0.0, 0.1, 0); sph(d, 0.09, MT.glassD, 0.58, 0.12, 0);
  decal(d, 'BIDULE', 0.55, 0.12, '#1f3a7a', -0.05, 0.22, 0.31, null);
  const props = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * PI) / 3 + PI / 6, ex = Math.cos(a), ez = Math.sin(a);
    rod(d, new V3(ex * 0.25, 0.26, ez * 0.25), new V3(ex, 0.3, ez), 0.035, K);
    cylY(d, 0.08, 0.14, K, ex, 0.33, ez, 12); cylY(d, 0.05, 0.03, MT.chrome, ex, 0.41, ez, 10);
    sph(d, 0.035, ex > 0.1 ? (ez > 0 ? glow(0x2aff5a, 1) : glow(0xff3a2a, 1)) : MT.lamp, ex * 1.06, 0.28, ez * 1.06);
    const pr = grp(g, ex, 0.44, ez); box(pr, 0.82, 0.012, 0.07, LM.grey, 0, 0, 0); sph(pr, 0.035, K, 0, 0.01, 0); bake(pr); props.push(pr);
  }
  [1, -1].forEach((s) => { rod(d, new V3(0.25, 0.02, s * 0.18), new V3(0.3, -0.33, s * 0.32), 0.02, K); rod(d, new V3(-0.25, 0.02, s * 0.18), new V3(-0.3, -0.33, s * 0.32), 0.02, K); rod(d, new V3(-0.5, -0.35, s * 0.32), new V3(0.5, -0.35, s * 0.32), 0.022, K); });
  rbox(d, 0.2, 0.1, 0.2, 0.03, K, 0, -0.03, 0, 0.01);
  bake(d);
  const cable = add(g, CABLE, LM.dark); cable.visible = false;
  const hook = grp(g, 0, -0.08, 0); rbox(hook, 0.1, 0.06, 0.08, 0.02, LM.yel, 0, -0.02, 0, 0.01);
  const setCable = (L) => { cable.scale.y = Math.max(0.001, L); cable.position.y = -0.08 - L / 2; cable.visible = L > 0.02; hook.position.y = -0.08 - L; };
  return { g, props, hook, setCable, Y: 0.39 };
}

/** Six-wheeled sidewalk delivery robot with its safety flag and a lid over the parcel compartment. */
function sidewalkBot(p) {
  const g = grp(p), d = grp(g), K = LM.dark;
  rbox(d, 0.74, 0.3, 0.54, 0.12, LM.white, 0, 0.35, 0, 0.03); rbox(d, 0.78, 0.1, 0.58, 0.05, K, 0, 0.22, 0, 0.02);
  box(d, 0.02, 0.08, 0.34, MT.glassD, 0.37, 0.42, 0); [0.1, -0.1].forEach((z) => sph(d, 0.025, LM.screen, 0.38, 0.42, z));
  [0.2, -0.2].forEach((z) => { rbox(d, 0.02, 0.04, 0.08, 0.01, MT.lamp, 0.385, 0.32, z, 0.005); rbox(d, 0.02, 0.04, 0.08, 0.01, MT.tail, -0.385, 0.34, z, 0.005); });
  box(d, 0.6, 0.05, 0.545, LM.orange, 0, 0.45, 0); box(d, 0.64, 0.01, 0.46, K, 0, 0.495, 0);
  decal(d, 'BIDULE', 0.36, 0.08, '#1f3a7a', -0.02, 0.33, 0.276, null);
  [1, -1].forEach((s) => box(d, 0.62, 0.05, 0.03, K, 0, 0.14, s * 0.31));
  rod(d, new V3(-0.3, 0.48, 0.2), new V3(-0.3, 1.55, 0.2), 0.01, K); ext(d, [[0, 0], [0.32, 0.09], [0, 0.18]], 0.01, 0.012, LM.orange, -0.3, 1.36, 0.2, 0); sph(d, 0.03, MT.amber, -0.3, 1.57, 0.2);
  bake(d);
  const wheels = [];
  [-0.25, 0, 0.25].forEach((x) => [1, -1].forEach((s) => { const w = grp(g, x, 0.11, s * 0.31); cylZ(w, 0.11, 0.08, MT.rubberS, 0, 0, 0, 14); cylZ(w, 0.055, 0.085, LM.orange, 0, 0, 0, 10); box(w, 0.1, 0.02, 0.09, K, 0, 0, 0); w.userData.r = 0.11; bake(w); wheels.push(w); }));
  const lid = grp(g, -0.33, 0.51, 0); rbox(lid, 0.67, 0.05, 0.5, 0.05, LM.white, 0.335, 0.02, 0, 0.015); box(lid, 0.12, 0.02, 0.3, LM.orange, 0.62, 0.03, 0); bake(lid);
  return { g, lid, wheels };
}

/* ================= houses ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
/** A window with its frame and two shutters, on a wall facing +z at z. */
function fenetre(g, x, y, z, w = 0.8, h = 1.1, sh = SHUT[0]) {
  box(g, w + 0.14, h + 0.14, 0.04, LM.white, x, y, z + 0.01); box(g, w, h, 0.05, MT.glassD, x, y, z + 0.03); box(g, 0.04, h, 0.06, LM.white, x, y, z + 0.04);
  box(g, w + 0.24, 0.08, 0.14, LM.white, x, y - h / 2 - 0.07, z + 0.06);
  if (sh) [1, -1].forEach((s) => box(g, w / 2, h, 0.05, sh, x + s * (w * 0.75 + 0.04), y, z + 0.04));
}
/** French town house, its front (+z) facing the street (local frame `g` already placed). */
function house(g, o = {}) {
  const W = o.w || 5.5, D = o.d || 5, H = o.h || 5.4, wall = o.wall || pick(WALLS), roof = o.roof || pick([LM.slate, LM.tile, LM.tile]), sh = o.sh || pick(SHUT);
  rbox(g, W, H, D, 0.06, wall, 0, H / 2, 0, 0.02); rbox(g, W + 0.06, 0.5, D + 0.06, 0.03, LM.stoneD, 0, 0.25, 0, 0.01);
  const rg = grp(g, 0, H, 0); rg.rotation.y = PI / 2; ext(rg, [[-D / 2 - 0.35, 0], [D / 2 + 0.35, 0], [0, o.rh || 2.2]], 0.05, W + 0.3, roof, 0, 0, 0, 0.03);
  rbox(g, 0.6, 1.4, 0.6, 0.04, LM.stoneD, W * 0.25, H + 1.6, -D * 0.15, 0.02);
  const fl = Math.max(1, Math.round((H - 1) / 2.4)), n = Math.max(2, Math.round((W - 1.2) / 1.6)), back = grp(g); back.rotation.y = PI;
  for (let f = 0; f < fl; f++) for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 1.6, y = 1.5 + f * 2.4; fenetre(back, x, y, D / 2, 0.75, 1.1, sh);
    if (f === 0 && (o.shop || Math.abs(x - (o.door ?? 0)) < 1.2)) continue; fenetre(g, x, y, D / 2, 0.75, 1.1, sh);
  }
  if (o.shop) {
    box(g, W - 1.0, 1.7, 0.06, MT.glassD, 0.4, 1.35, D / 2 + 0.02); box(g, W - 0.6, 0.5, 0.08, o.shopCol || LM.green, 0, 2.5, D / 2 + 0.04); box(g, 0.9, 2.0, 0.06, LM.woodD, -W / 2 + 0.8, 1.0, D / 2 + 0.03);
    const a = grp(g, 0, 2.3, D / 2 + 0.05); box(a, W - 0.4, 0.04, 1.2, o.awning || LM.awnR, 0, -0.2, 0.55).rotation.x = 0.35;
    if (o.sign) decal(g, o.sign, W - 1.0, 0.36, '#ffffff', 0, 2.5, D / 2 + 0.09, null);
  } else if (!o.noDoor) box(g, 0.9, 2.0, 0.06, o.doorCol || LM.woodD, o.door ?? 0, 1.0, D / 2 + 0.03);
  return g;
}
/** Garden in front of a house (local frame): lawn, hedge or picket fence with a gate gap, flowers. */
function garden(g, x0, z0, w, dd, o, FLOW, PICK) {
  g.updateMatrixWorld(true);
  box(g, w, 0.04, dd, LM.lawn, x0, 0.02, z0);
  if (o.path != null) box(g, 0.9, 0.05, dd, LM.stone, o.path, 0.025, z0);
  const zf = z0 + dd / 2 - 0.1, gap = o.path ?? 99;
  if (o.hedge) [[-w / 2, gap - 0.6], [gap + 0.6, w / 2]].forEach(([a, b]) => { if (b - a > 0.2) rbox(g, b - a, 0.8, 0.5, 0.2, LM.hedge, x0 + (a + b) / 2, 0.4, zf, 0.04); });
  else { for (let x = -w / 2 + 0.1; x < w / 2; x += 0.3) if (Math.abs(x - gap) > 0.55) PICK.push(g.localToWorld(new V3(x0 + x, 0.42, zf))); }
  for (let i = 0; i < (o.flowers || 10); i++) FLOW.push(g.localToWorld(new V3(x0 + rnd(-w / 2 + 0.3, w / 2 - 0.3), 0.2, z0 + rnd(-dd / 2 + 0.3, dd / 2 - 0.4))));
}
function roundTree(p, x, z, s = 1, cols = [0x4a9a4a, 0x3f8a3a, 0x5aa85a]) {
  const g = grp(p, x, 0, z); cylY(g, 0.18 * s, 2.6 * s, 0x6b4a32, 0, 1.3 * s, 0, 8);
  for (let i = 0; i < 6; i++) { const m = add(g, ICO, pick(cols), rnd(-0.9, 0.9) * s, rnd(2.9, 4.0) * s, rnd(-0.9, 0.9) * s); m.scale.setScalar(rnd(0.9, 1.3) * s); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  return g;
}
function bench(p, x, z, ry) {
  const g = grp(p, x, 0, z); g.rotation.y = ry || 0;
  [0.75, -0.75].forEach((xx) => { box(g, 0.08, 0.45, 0.45, LM.dark, xx, 0.23, 0); box(g, 0.08, 0.5, 0.06, LM.dark, xx, 0.7, -0.22); });
  [0.08, -0.08].forEach((zz) => rbox(g, 1.8, 0.05, 0.14, 0.02, LM.wood, 0, 0.47, zz, 0.01)); [0.6, 0.78].forEach((yy) => rbox(g, 1.8, 0.1, 0.04, 0.02, LM.wood, 0, yy, -0.24, 0.01));
  return g;
}

/* ================= world data ================= */
const DATA = {
  semi: { short: 'Le camion', full: 'Le semi-remorque', verb: 'Se garer', horn: 'horn',
    use: "Un très long camion qui apporte à l'entrepôt des palettes pleines de colis.",
    how: "Il recule tout doucement contre le quai. Le niveleur, un petit pont, relie le camion à l'entrepôt." },
  transpalette: { short: 'Le transpalette', full: 'Le transpalette électrique', verb: 'Décharger', horn: 'horn',
    use: 'Il déplace les lourdes palettes, comme une petite fourmi très forte.',
    how: "Ses deux fourches glissent sous la palette et la soulèvent. Le cariste le conduit debout, à l'arrière." },
  robots: { short: 'Les robots', full: "Les robots de l'entrepôt", verb: 'Apporter', horn: 'bell',
    use: "De petits robots qui apportent les étagères aux préparateurs.",
    how: 'Ils se glissent sous une étagère, la soulèvent et la portent. Ils suivent des petits carrés dessinés par terre.' },
  trieuse: { short: 'La trieuse', full: 'La trieuse à colis', verb: 'Trier', horn: 'bell',
    use: 'Elle envoie chaque colis dans le bon chariot, selon là où il va.',
    how: "Un scanner lit l'étiquette du colis. Puis un poussoir le pousse sur le bon toboggan." },
  camionnette: { short: 'La camionnette', full: 'La camionnette de livraison', verb: 'Livrer', horn: 'horn',
    use: "Elle emporte les colis de l'entrepôt jusqu'en ville.",
    how: 'On la remplit par ses portes arrière. Le livreur dépose les colis chez les gens, ou dans une consigne.' },
  velo: { short: 'Le vélo cargo', full: 'Le vélo cargo électrique', verb: 'Pédaler', horn: 'bell',
    use: 'Un vélo avec une grande caisse devant, pour livrer au centre-ville.',
    how: 'Un petit moteur électrique aide la livreuse à pédaler. Pas de bruit, pas de fumée !' },
  drone: { short: 'Le drone', full: 'Le drone de livraison', verb: "S'envoler", horn: 'bell',
    use: "Il apporte un petit colis par les airs, jusque dans le jardin.",
    how: "Ses six hélices le font voler. Il ne se pose pas : il descend le colis au bout d'un fil." },
  livreur: { short: 'Le robot livreur', full: 'Le petit robot livreur', verb: 'Livrer', horn: 'bell',
    use: 'Un petit robot à six roues qui livre tout seul, sur le trottoir.',
    how: "Ses caméras l'aident à voir les gens et les obstacles. Le colis voyage bien à l'abri, sous son couvercle." }
};
const ORDER = ['semi', 'transpalette', 'robots', 'trieuse', 'camionnette', 'velo', 'drone', 'livreur'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const BOXI = (x, y, w = 14, h = 12) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#c99a5e"/><path d="M${x + w / 2} ${y}v${h * 0.45}" stroke="#e8cf98" stroke-width="2.5"/>`;
const ICONS = {
  semi: GND + `<rect class="w" x="4" y="20" width="76" height="38" rx="2"/><path d="M12 34h44" stroke="#1f3a7a" stroke-width="6"/><path d="M12 44h32" stroke="#f2781c" stroke-width="3"/><path d="M84 58V34q0-6 6-6h14q8 0 10 10v20z" fill="#1f3a7a"/><rect class="g" x="96" y="32" width="14" height="11" rx="2"/><rect class="k" x="4" y="58" width="110" height="5"/><circle class="k" cx="18" cy="66" r="7"/><circle class="k" cx="34" cy="66" r="7"/><circle class="k" cx="92" cy="66" r="7"/><circle class="k" cx="108" cy="66" r="7"/>`,
  transpalette: GND + `<rect x="56" y="64" width="44" height="6" fill="#9a7448"/><rect x="58" y="34" width="40" height="30" fill="#c99a5e"/><path d="M58 49h40M78 34v30" stroke="#b07f45" stroke-width="2"/>${BOXI(72, 20, 16, 14).replace('#c99a5e', '#e0303a')}<path d="M30 30v34h70" stroke="#2a2f40" stroke-width="5" fill="none"/><path d="M8 66V40q0-6 6-6h18v32z" fill="#f4b81c"/><path d="M28 34l-8-10h-6" stroke="#2a2f40" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="12" cy="18" r="6" fill="#f0c39a"/><rect x="6" y="24" width="12" height="16" rx="4" fill="#ff8f1f"/><circle class="k" cx="22" cy="70" r="5"/>`,
  robots: GND + `<rect x="34" y="8" width="52" height="50" rx="2" fill="#f2c21c"/><path d="M34 18h52M34 28h52M34 38h52M34 48h52M51 8v50M69 8v50" stroke="#c88a10" stroke-width="2"/><rect x="36" y="58" width="4" height="8" fill="#2a2f40"/><rect x="80" y="58" width="4" height="8" fill="#2a2f40"/><rect x="40" y="62" width="40" height="10" rx="4" fill="#f2781c"/><rect x="44" y="58" width="32" height="4" fill="#8a93a3"/>${BOXI(55, 21, 10, 8).replace('#c99a5e', '#e0303a')}`,
  trieuse: `<path d="M2 50h96" stroke="#30343f" stroke-width="8"/><path d="M2 56h96" stroke="#8a93a3" stroke-width="4"/><path d="M20 12h20v40h-4V18H24v34h-4z" fill="#1f3a7a"/><path d="M24 40h12" stroke="#ff4a3a" stroke-width="2"/>${BOXI(46, 34)}${BOXI(70, 32, 16, 14)}<path d="M84 56l18 18h14" stroke="#2f6fe0" stroke-width="7" fill="none" stroke-linejoin="round"/><rect x="66" y="40" width="4" height="10" fill="#f4b81c"/>`,
  camionnette: GND + `<path d="M8 22h70q6 0 10 4l16 16q10 2 12 8v14H8z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><path d="M80 28l14 14H80z" fill="#2a3f58"/><rect x="8" y="48" width="98" height="5" fill="#f2781c"/><path d="M16 36h44" stroke="#1f3a7a" stroke-width="5"/><circle class="k" cx="26" cy="66" r="9"/><circle class="k" cx="88" cy="66" r="9"/>`,
  velo: GND + `<circle cx="22" cy="60" r="13" fill="none" stroke="#2a2f40" stroke-width="4"/><circle cx="100" cy="64" r="9" fill="none" stroke="#2a2f40" stroke-width="4"/><path d="M22 60l18 0 12-30M40 60h56l4 4M34 30h10" stroke="#1f8a8a" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="58" y="34" width="38" height="24" rx="3" fill="#1f8a8a"/>${BOXI(68, 26, 16, 10)}<circle cx="30" cy="12" r="6" fill="#f0c39a"/><path d="M24 10a6 6 0 0 1 12 0z" fill="#f2781c"/><path d="M30 18l4 14" stroke="#3aa46a" stroke-width="7" stroke-linecap="round"/>`,
  drone: `<path d="M14 20h92" stroke="#2a2f40" stroke-width="4" stroke-linecap="round"/><ellipse cx="14" cy="15" rx="14" ry="3" fill="#c9ced8"/><ellipse cx="60" cy="15" rx="14" ry="3" fill="#c9ced8"/><ellipse cx="106" cy="15" rx="14" ry="3" fill="#c9ced8"/><path d="M42 22h36l-4 10H46z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="42" y="28" width="36" height="4" fill="#f2781c"/><path d="M60 32v24" stroke="#2a2f40" stroke-width="1.5"/>${BOXI(52, 56, 16, 14)}<path d="M20 76h80" stroke="#7cb342" stroke-width="5" stroke-linecap="round"/>`,
  livreur: GND + `<path d="M34 10v48" stroke="#2a2f40" stroke-width="2"/><path d="M34 10l18 6-18 6z" fill="#f2781c"/><rect x="24" y="38" width="66" height="26" rx="9" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="24" y="48" width="66" height="5" fill="#f2781c"/><rect class="g" x="80" y="42" width="8" height="6" rx="2"/><path d="M24 38q33-10 66 0" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><circle class="k" cx="34" cy="68" r="6"/><circle class="k" cx="57" cy="68" r="6"/><circle class="k" cx="80" cy="68" r="6"/>`
};

// Layout (h along the screen in the overview, d from the back to the front)
const CFG = {
  semi: CF(-8, -19), transpalette: CF(-17, -11), robots: CF(-36, -7.5), trieuse: CF(-26, -2.5),
  camionnette: CF(-13, 4.3), velo: CF(24.5, -5), drone: CF(25, -18.5), livreur: CF(5, 24.2)
};
const GR = [], GB = [];
const rect = (h, d, lh, ld, col, al = 1) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len: lh, wid: ld, rot: -Math.PI / 4, col, al }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const ROAD = '#4a4c5e', WALK = '#d2cbc0', LINE = '#f3efe2', YARD = '#5d6070', PAVE = '#ddd2bd', LAWN = '#79b85a';
rect(-26, -12, 37, 29, '#9a9ca8');
rect(3, -13, 22, 27, YARD); [-19, -11].forEach((d) => [-1.7, 1.7].forEach((o) => rect(4, d + o, 24, 0.16, '#f2b21c')));
rect(-1.5, 4.3, 38, 3.4, '#55586a'); for (let h = -18; h < 16; h += 3) rect(h, 4.3, 1.4, 0.14, LINE);
rect(0, 8, 104, 4.4, ROAD); for (let h = -48; h < 48; h += 4) rect(h, 8, 2, 0.18, LINE);
rect(2, 10.9, 100, 1.4, WALK); rect(32, 4.3, 28, 1.8, WALK);
rect(19, -11.5, 4, 37, ROAD); for (let d = -28; d < 4; d += 4) rect(19, d, 0.18, 2, LINE); rect(21.6, -11.5, 1.2, 33, WALK);
rect(33.5, -4.5, 23, 13, PAVE); for (let h = 23; h < 45; h += 2) rect(h, -4.5, 0.06, 13, '#cfc3ab');
rect(19.5, 27, 47, 4, ROAD); for (let h = -2; h < 43; h += 4) rect(h, 27, 2, 0.16, LINE); rect(19.5, 24.2, 47, 1.6, WALK); rect(-3, 17.5, 4, 19.4, ROAD);
rect(-31, 16.5, 22, 10, '#6a6c7a'); for (let h = -40; h <= -22; h += 2.6) { rect(h, 13.6, 0.12, 3.6, LINE); rect(h, 19.4, 0.12, 3.6, LINE); }
rect(25.5, -21, 6.5, 7, PAVE); rect(13.6, 1.4, 4.6, 2.2, PAVE);
[3, 9.5, 16, 22.5, 29, 35.5, 42].forEach((h) => { rect(h, 21.8, 6, 2.9, LAWN); rect(h, 13.3, 6, 3.4, LAWN); });
[33, 39, 45].forEach((h) => rect(h, -19.8, 5.8, 6.2, LAWN));
blob(-14, 20, 9, 'rgba(120,200,110,.5)'); blob(40, -20, 5, 'rgba(120,200,110,.4)');

export default {
  id: 'livraison', title: 'Le Colis', titleHtml: 'Le <span>Colis</span>',
  subtitle: "Suis le cadeau de Léo : de l'entrepôt jusqu'à sa porte, en camion, en robot, en vélo et même en drone !",
  welcome: "Bienvenue ! Aujourd'hui, on suit un colis très spécial : un cadeau pour Léo. Touche un engin pour voir comment il marche.",
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Tout le voyage',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l12-6 12 6v12l-12 6-12-6z"/><path d="M4 10l12 6 12-6M16 16v12M10 7l12 6"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 58, tufts: false,
  forest: { dark: [0x1f4a2e, 0x2a5a36, 0x183a2a, 0x2f6a3a, 0x214a33], bush: [0x4a8a3a, 0x3f7a34, 0x5a9a44, 0x6aa84c] },
  outerColor: 0x1a3226,
  overview: { w: 98, h: 64, focus: [0, 2, 0] },
  ground: { base: ['#8cbc6a', '#6f9f52', '#4f7a3e'], rects: GR, blobs: GB },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 120); onUpdate((dt) => fx.update(dt));
    freeze(buildWorld(grp(scene)));
    const spin = (obj, wheels) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const dd = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (dd) wheels.forEach((w) => (w.rotation.z -= dd / (w.userData.r || 0.3))); return dd; }; };
    const along = (obj, r, s0, s1, d, ease = easeSine) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k), ease);
    const hop = (o, p0, p1, d = 0.9, hgt = 0.8) => tw(d, (k) => o.position.set(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k + Math.sin(k * PI) * hgt, p0.z + (p1.z - p0.z) * k), easeSine);
    const local = (S, o) => { S.updateMatrixWorld(true); return S.worldToLocal(o.getWorldPosition(new V3())); };
    const blockers = [];

    /* ---- le semi-remorque : il recule contre le quai ---- */
    (function () {
      const st = makeStation('semi'), S = st.g;
      const K = semiTruck(S, { load: true }); const m = K.g; st.m = m; st.wheels = K.wheels;
      const DG = dockGate(S);
      const X0 = 7.5, XD = 0.24; m.position.x = X0; st.lastX = X0;
      const drv = walker(S, 0, 0, { top: 0x1f3a7a, bottom: 0x2a3550 }); drv.visible = false;
      part(st, 'remorque', 'la remorque', anchor(m, 5, FL + 2.9, 1.3), true);
      part(st, 'cabine', 'le tracteur', anchor(m, 13.2, 3.4, 1.1), true);
      part(st, 'portes', 'les portes arrière', anchor(K.doors[0], -0.1, 0.6, -0.6), false);
      part(st, 'porte', 'la porte du quai', anchor(DG.g, 0.2, FL + 3.3, 1.2), false);
      part(st, 'niveleur', 'le niveleur de quai', anchor(DG.lev, 1.4, 0.1, 0.8), false);
      st.focus = new V3(5.5, 2.2, 0); st.size = { w: 22, h: 8 }; st.az = YAW + 0.3; st.el = 0.72; st.tagAt = anchor(m, 7, 5.6, 0);
      const pipe = anchor(m, 12.0, 3.62, 0.78);
      st.update = (dt) => { roll(st, dt); if (st.reversing && Math.random() < 0.35) fx.smoke(wp(pipe), new V3(rnd(-0.3, 0.3), rnd(1.2, 1.8), rnd(-0.3, 0.3)), rnd(0.2, 0.35), 0x9aa0ac, 1.4); };
      const lights = (ok) => { DG.red.emissiveIntensity = ok ? 0.1 : 1.4; DG.green.emissiveIntensity = ok ? 1.6 : 0.1; };
      st.action = async function () {
        if (st.done) {
          lights(false);
          await Promise.all([step('Le camion vide repart. Un autre camion arrive !', 'cabine'), tw(1.2, (k) => { DG.lip.rotation.z = -PI / 2 * k; DG.door.scale.y = 0.03 + 0.97 * k; })]);
          DG.lev.rotation.z = 0; engineOn(48); await to(m.position, 'x', X0 + 8, 3, easeIn); engineOff();
          m.visible = false; m.position.x = X0; K.doors.forEach((h) => (h.rotation.y = 0)); await sleep(0.1); pop(m, 0.6); await sleep(0.6); st.done = false;
        }
        engineOn(48);
        drv.position.set(X0 - 0.7, 0, 1.9); drv.rotation.y = PI / 2; pop(drv, 0.4);
        await Promise.all([step("Le gros camion arrive à l'entrepôt. Le chauffeur ouvre les portes de la remorque.", 'portes'), tw(2, (k) => K.doors.forEach((h, i) => (h.rotation.y = (i ? -1 : 1) * 4.6 * k)), easeSine)]);
        drv.rotation.y = 0; let ph = 0;
        await tw(2.6, (k) => { drv.position.x = X0 - 0.7 + 12.6 * k; ph += 0.3; drv.userData.walk(ph); }, lin); drv.visible = false;
        st.reversing = true;
        await Promise.all([step('Il recule tout doucement vers le quai. Bip, bip, bip !', 'remorque'), to(m.position, 'x', XD, 6.5, easeSine)]);
        st.reversing = false; thud(); engineOff();
        await Promise.all([step("La grande porte de l'entrepôt monte.", 'porte'), tw(2.4, (k) => (DG.door.scale.y = 1 - 0.97 * k), easeSine), tone(180, 0, 2.2, 'sawtooth', 0.02, 240)]);
        await Promise.all([step("Le niveleur se déplie : c'est un petit pont entre l'entrepôt et le camion.", 'niveleur'),
          (async () => { await to(DG.lev.rotation, 'z', 0.14, 1.2); await to(DG.lip.rotation, 'z', 0, 1.0); await to(DG.lev.rotation, 'z', 0.004, 1.0); thud(); })()]);
        lights(true); chime();
        await step('Le feu passe au vert : on peut décharger les palettes de colis !', 'remorque');
        st.done = true;
      };
    })();

    /* ---- le transpalette électrique : il décharge une palette ---- */
    (function () {
      const st = makeStation('transpalette'), S = st.g; S.position.y = FL;
      const J = palletJack(st, S); const m = J.g; st.m = m; st.wheels = J.wheels;
      const PAL = loadedPallet(S, true); PAL.position.set(10.5, 0, 0);
      [12.0, 13.4].forEach((x) => loadedPallet(S).position.set(x, 0, 0));
      { const d = grp(S); [[1.9, 0.62, 1.6, 0.08], [1.9, -0.62, 1.6, 0.08], [1.1, 0, 0.08, 1.3], [2.7, 0, 0.08, 1.3]].forEach(([x, z, w, dd]) => box(d, w, 0.012, dd, LM.yel, x, 0.006, z)); bake(d); }
      const XIN = 9.62;
      part(st, 'fourches', 'les fourches', anchor(J.forks, 1.0, 0.15, 0.3), true);
      part(st, 'cariste', 'le cariste', anchor(J.driver, 0, 1.45, 0), false);
      part(st, 'palette', 'la palette de colis', anchor(PAL, 0, 1.4, 0.4), true);
      part(st, 'timon', 'le timon', anchor(m, -0.3, 1.35, 0.25), false);
      st.focus = new V3(5.5, 1.0, 0); st.size = { w: 13, h: 5 }; st.tagAt = anchor(m, 0, 2.6, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) { S.attach(PAL); PAL.position.set(10.5, 0, 0); PAL.rotation.set(0, 0, 0); J.forks.position.y = 0; m.position.x = 0; st.lastX = 0; pop(PAL, 0.5); pop(m, 0.5); await sleep(0.6); st.done = false; }
        engineOn(110);
        await Promise.all([step('Le transpalette électrique roule jusque dans le camion. Le cariste le conduit debout.', 'cariste'), to(m.position, 'x', XIN, 5, easeSine)]);
        J.forks.attach(PAL);
        await Promise.all([step('Ses fourches glissent sous la palette, et la soulèvent un tout petit peu.', 'fourches'), to(J.forks.position, 'y', 0.12, 1.4)]);
        st.reversing = true;
        await Promise.all([step('Il recule avec la palette pleine de colis. Bip, bip !', 'palette'), to(m.position, 'x', 1.0, 5, easeSine)]);
        st.reversing = false;
        await Promise.all([step("Il la pose dans l'entrepôt. Regarde : le cadeau de Léo, avec son ruban rouge, est tout en haut !", 'palette'), to(J.forks.position, 'y', 0, 1.0)]);
        S.attach(PAL); await to(m.position, 'x', -0.6, 1.2);
        engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- les robots : l'étagère vient jusqu'à la préparatrice ---- */
    (function () {
      const st = makeStation('robots'), S = st.g; S.position.y = FL;
      const R = shelfBot(S); const m = R.g; st.m = m; m.position.x = -5;
      const P = pod(S, true); const GIFT = P.gift, GH = GIFT.position.clone();
      { const d = grp(S); rbox(d, 0.5, 0.5, 1.0, 0.04, LM.dark, -6.0, 0.25, 0, 0.02); box(d, 0.02, 0.2, 0.3, LM.screen, -5.74, 0.35, 0); box(d, 1.2, 0.01, 1.0, LM.yel, -5.0, 0.006, 0); bake(d); }
      const PS = pickStation(S, 9.6);
      const wk = walker(S, 10.3, 0.1, { top: 0x2f6fe0, bottom: 0x2a3550 }); wk.rotation.y = PI;
      part(st, 'robot', 'le robot', anchor(m, 0.3, 0.45, 0.4), true);
      part(st, 'etagere', "l'étagère", anchor(P.g, 0, 2.7, 0.5), true);
      part(st, 'preparatrice', 'la préparatrice', anchor(wk, 0, 1.45, 0), false);
      part(st, 'lumiere', 'la lumière verte', anchor(S, 9.0, 2.5, 0.2), false);
      st.focus = new V3(4.2, 1.2, 0); st.size = { w: 16, h: 6 }; st.tagAt = anchor(P.g, 0, 3.0, 0);
      st.update = (dt) => { if (st.spin) R.top.rotation.y += dt * 5; };
      st.action = async function () {
        if (st.done) { S.attach(P.g); P.g.position.set(0, 0, 0); P.g.attach(GIFT); GIFT.position.copy(GH); GIFT.rotation.set(0, 0, 0); m.position.x = -5; PS.lampM.emissiveIntensity = 0.05; pop(GIFT, 0.4); await sleep(0.4); st.done = false; }
        await Promise.all([step('Ce petit robot orange se glisse tout doucement sous une étagère.', 'robot'), to(m.position, 'x', 0, 3.5, easeSine), tone(520, 0, 0.3, 'sine', 0.04, 700)]);
        st.spin = true;
        await Promise.all([step("Il tourne son plateau et soulève toute l'étagère. Quel costaud !", 'etagere'), to(P.g.position, 'y', 0.08, 1.6)]);
        st.spin = false; m.attach(P.g);
        await Promise.all([step("Il apporte l'étagère jusqu'à la préparatrice.", 'robot'), to(m.position, 'x', 8.3, 4.5, easeSine)]);
        PS.lampM.emissiveIntensity = 2.2; ding();
        const a = wk.userData.arms[0]; to(a.rotation, 'z', 1.5, 0.5);
        const p0 = local(S, GIFT); S.attach(GIFT);
        await Promise.all([step('La lumière verte lui montre le bon casier. Elle prend le cadeau de Léo !', 'preparatrice'), hop(GIFT, p0, PS.tote, 1.4, 0.4)]);
        to(a.rotation, 'z', 0, 0.5); PS.lampM.emissiveIntensity = 0.05;
        await Promise.all([step("Le robot remet l'étagère à sa place, puis va se recharger.", 'robot'), to(m.position, 'x', 0, 4, easeSine)]);
        S.attach(P.g); st.spin = true; await to(P.g.position, 'y', 0, 0.8); st.spin = false;
        await to(m.position, 'x', -5, 3, easeSine);
        chime(); st.done = true;
      };
    })();

    /* ---- la trieuse : scanner, poussoirs, toboggans ---- */
    (function () {
      const st = makeStation('trieuse'), S = st.g; S.position.y = FL;
      const T = sorter(S); st.m = T.g;
      const wk = walker(S, -12.4, 1.3, { vest: true }); wk.rotation.y = -PI / 2;
      const X0 = -12.8, V = 2.2;
      const items = [[0, 0, 0.5, 0.3, 0.4], [2, 1.3, 0.4, 0.35, 0.36], [-1, 2.6, 0.55, 0.25, 0.42], [1, 3.9], [0, 5.2, 0.38, 0.3, 0.34], [2, 6.5, 0.48, 0.4, 0.4]].map(([dst, t0, w, h, dd], i) => {
        const o = dst === 1 && i === 3 ? (() => { const b = teddyBox(S).g; box(b, 0.09, 0.09, 0.012, DEST[1], -0.14, 0.12, 0.256); b.scale.setScalar(0.8); const w0 = grp(S); w0.add(b); return w0; })() : colis(S, w, h, dd, { dot: dst >= 0 ? DEST[dst] : LM.yel });
        o.visible = false; return { o, dst, t0, ox: rnd(-0.12, 0.12) };
      });
      const teddyIt = items[3];
      let lastT = 0;
      function sim(t) {
        const ext = [0, 0, 0]; let laser = false;
        items.forEach((it) => {
          const o = it.o, tt = t - it.t0;
          if (tt < 0) { o.visible = false; it.scanned = false; return; }
          o.visible = true;
          const xEnd = it.dst >= 0 ? PX[it.dst] : 12.4, tArr = (xEnd - X0) / V;
          if (tt < tArr) {
            o.position.set(X0 + V * tt, BY + 0.02, 0); o.rotation.set(0, 0, 0);
            if (Math.abs(o.position.x + 6) < 0.35) laser = true;
            if (!it.scanned && o.position.x > -6) { it.scanned = true; if (t > lastT) beep(); }
            return;
          }
          const u = tt - tArr;
          if (it.dst < 0) { const k = Math.min(1, u / 0.5); o.position.set(12.4 + 0.6 * k, BY + 0.02 - 0.4 * k * k, 0); o.rotation.z = -0.6 * k; return; }
          if (u < 0.45) { const k = u / 0.45; o.position.set(xEnd, BY + 0.02, k * 0.75); o.rotation.set(0, 0, 0); ext[it.dst] = Math.max(ext[it.dst], k); return; }
          if (u < 0.9) ext[it.dst] = Math.max(ext[it.dst], 1 - (u - 0.45) / 0.45);
          const k = Math.min(1, (u - 0.45) / 0.9);
          if (k < 0.75) { const z = 0.75 + 1.45 * (k / 0.75); o.position.set(xEnd + it.ox * k, BY + 0.04 - (z - 0.5) * 0.176, z); o.rotation.set(0.174, 0, 0); }
          else { const k2 = (k - 0.75) / 0.25; o.position.set(xEnd + it.ox, 0.6 - 0.12 * k2, 2.2 + 0.4 * k2); o.rotation.set(0.174 * (1 - k2), 0, 0); }
        });
        T.paddles.forEach((pd, i) => (pd.position.z = -0.5 + 0.55 * ext[i]));
        LM.laser.emissiveIntensity = laser ? 2.6 : 0.4; lastT = t;
      }
      const run = (a, b) => tw(b - a, (k) => sim(a + (b - a) * k), lin);
      part(st, 'tapis', 'le tapis roulant', anchor(S, -9, BY + 0.3, 0.5), true);
      part(st, 'scanner', 'le scanner', anchor(S, -6, 2.5, 0.5), true);
      part(st, 'poussoir', 'le poussoir', anchor(T.paddles[1], 0, 0.25, 0), false);
      part(st, 'toboggan', 'le toboggan bleu', anchor(S, 3.5, 0.9, 1.6), false);
      part(st, 'colis', 'le cadeau de Léo', anchor(teddyIt.o, 0, 0.6, 0), false);
      part(st, 'chariot', 'le chariot de la ville', anchor(S, 3.5, 1.9, 2.75), false);
      st.focus = new V3(1.5, 1.2, 0.8); st.size = { w: 19, h: 6 }; st.tagAt = anchor(S, -6, 3.0, 0);
      st.update = (dt) => { if (st.run) beltT.offset.x -= dt * V * 0.5; };
      st.action = async function () {
        lastT = 0; sim(0); st.run = true; engineOn(140);
        await Promise.all([step('Voici la trieuse ! Les colis arrivent sur un grand tapis roulant.', 'tapis'), run(0, 4.6)]);
        await Promise.all([step("Ils passent sous l'arche du scanner. Bip ! Il lit l'étiquette de chaque colis.", 'scanner'), run(4.6, 8.4)]);
        await Promise.all([step('Le cadeau de Léo va en ville. Hop, le poussoir le pousse sur le toboggan bleu !', 'poussoir'), run(8.4, 11.8)]);
        await Promise.all([step('Il glisse jusque dans le chariot de la ville. Chaque couleur, c’est un endroit différent !', 'chariot'), run(11.8, 17.4)]);
        st.run = false; engineOff(); chime();
      };
    })();

    /* ---- la camionnette : chargement, route, consigne ---- */
    (function () {
      const st = makeStation('camionnette'), S = st.g;
      const Vn = deliveryVan(S); const m = Vn.g; st.m = m; st.wheels = Vn.wheels;
      { const d = grp(S); rollCage(d, -4.6, -1.3); bake(d); }
      const HOME = [[-4.75, 0.24, -1.3], [-4.45, 0.24, -1.22], [-4.6, 0.5, -1.3]].map((a) => new V3(...a));
      const pcs = HOME.map((p, i) => { const c = colis(S, 0.42, 0.26, 0.36, { dot: DEST[i % 3] }); c.position.copy(p); return c; });
      const wk = walker(S, -3.9, 0.6, { vest: true }); wk.rotation.y = PI;
      const L = lockers(S, 26.6, -2.6);
      const drv = walker(S, 0, 0, { top: 0xf2781c, bottom: 0x2a3550 }); drv.visible = false;
      const pc = colis(S, 0.4, 0.26, 0.34, { dot: LM.blue }); pc.visible = false;
      const XS = 21.5;
      part(st, 'camionnette', 'la camionnette', anchor(m, 0, 2.9, 0.6), true);
      part(st, 'portes', 'les portes arrière', anchor(Vn.doors[0], -0.1, 0.4, -0.5), false);
      part(st, 'colis', 'les colis de la ville', anchor(S, -4.6, 1.9, -1.3), false);
      part(st, 'consigne', 'la consigne', anchor(L.g, -0.9, 2.7, 0.4), true);
      part(st, 'casier', 'le petit casier', anchor(L.door, 0.3, 0.1, 0.1), false);
      st.focusAt = anchor(m, 2.2, 1.4, 0); st.size = { w: 17, h: 7 }; st.tagAt = anchor(m, 0, 3.8, 0);
      st.update = (dt) => roll(st, dt);
      const doors = (k) => Vn.doors.forEach((h, i) => (h.rotation.y = (i ? -1 : 1) * 1.9 * k));
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('La camionnette revient à l’entrepôt chercher d’autres colis.', 'camionnette'), (async () => { m.visible = false; await sleep(0.2); })()]);
          m.position.x = 0; st.lastX = 0; Vn.load.forEach((c) => (c.visible = false)); pcs.forEach((c, i) => { c.position.copy(HOME[i]); c.visible = true; });
          L.door.rotation.y = 0; L.led.emissive.setHex(0xff3a2a); pc.visible = false; drv.visible = false; pop(m, 0.6); await sleep(0.6); st.done = false;
        }
        await Promise.all([step('On ouvre les portes arrière, et on remplit la camionnette avec les colis pour la ville.', 'portes'), tw(1.2, doors, easeSine)]);
        for (const [i, c] of pcs.entries()) { await hop(c, c.position.clone(), new V3(-2.6, 1.2, (i - 1) * 0.4), 0.8, 0.6); c.visible = false; Vn.load[i].visible = true; thud(); }
        await Promise.all([step('Les portes se ferment. En route vers la ville !', 'camionnette'), tw(1.0, (k) => doors(1 - k), easeSine)]);
        engineOn(60);
        await to(m.position, 'x', XS, 6.5, easeSine); engineOff();
        drv.position.set(XS + 1.2, 0, -1.3); drv.rotation.y = 0; pop(drv, 0.4);
        let ph = 0;
        await Promise.all([step("Elle s'arrête près de la consigne : une grande armoire pleine de petites portes.", 'consigne'), tw(2, (k) => { drv.position.x = XS + 1.2 + 2.6 * k; ph += 0.3; drv.userData.walk(ph); }, lin)]);
        drv.userData.walk(0); drv.rotation.y = -PI / 2 + 0.6;
        [0, 0.15, 0.3, 0.45].forEach((s) => tone(900 + s * 600, s, 0.1, 'square', 0.03));
        await Promise.all([step('Le livreur tape un code sur l’écran... et une petite porte s’ouvre toute seule !', 'casier'), to(L.door.rotation, 'y', -1.7, 1.2, easeSine)]);
        pc.position.set(XS + 4.2, 0.95, -1.0); pc.visible = true;
        await Promise.all([step('Il range un colis dedans. Plus tard, la voisine viendra le chercher avec son code.', 'casier'), hop(pc, pc.position.clone(), L.slot, 1.2, 0.3)]);
        pc.visible = false; await to(L.door.rotation, 'y', 0, 0.8); L.led.emissive.setHex(0x2aff5a); thud(); chime();
        st.done = true;
      };
    })();

    /* ---- le vélo cargo : au centre-ville ---- */
    (function () {
      const st = makeStation('velo'), S = st.g;
      const B = cargoBike(S); const m = B.g; st.m = m;
      const RT = route([[0, 0], [4, 0.5], [8, -0.6], [11.5, -1.2], [14, -1.4]], false, 0.4); placeOn(m, RT, 0);
      blockers.push(() => wp(m));
      // the little depot of the bikes, and the bookshop at the end of the ride
      { const d = grp(S, -1.0, 0, -4.2); rbox(d, 2.6, 2.5, 2.4, 0.06, LM.teal, 0, 1.25, 0, 0.02); box(d, 1.8, 2.0, 0.04, LM.dark, 0.1, 1.0, 1.21); rbox(d, 2.9, 0.12, 2.7, 0.04, LM.navy, 0, 2.56, 0.1, 0.01); decal(d, 'BIDULE', 1.6, 0.32, '#ffffff', 0, 2.25, 1.23, null);
        for (let i = 0; i < 3; i++) box(d, 1.6, 0.04, 0.6, LM.greyD, 0.1, 0.5 + i * 0.6, 0.8); [[-0.4, 0.55], [0.3, 0.55], [0.1, 1.15], [-0.3, 1.75]].forEach(([x, y]) => colis(d, 0.4, 0.3, 0.35).position.set(x, y, 0.8)); bake(d); }
      const wk = walker(S, 0.3, -2.3, { top: 0x3aa46a, bottom: 0x2a3550 }); wk.rotation.y = -PI / 2; wk.userData.arms.forEach((a) => (a.rotation.z = 1.1));
      const shop = walker(S, 15, -3.9, { top: 0xa45ad8, bottom: 0x3a3a48 }); shop.rotation.y = -PI / 2; shop.userData.arms.forEach((a) => (a.rotation.z = 0.2));
      const HOME = new V3(0.3, 0.85, -1.85);
      const pc = colis(S, 0.42, 0.3, 0.36, { dot: LM.red }); pc.position.copy(HOME);
      const spinW = spin(m, B.wheels);
      part(st, 'caisse', 'la grande caisse', anchor(B.box, 0, 0.75, 0.4), true);
      part(st, 'moteur', 'le moteur électrique', anchor(m, -0.95, 0.35, 0.15), false);
      part(st, 'batterie', 'la batterie', anchor(m, -0.15, 0.6, 0.1), true);
      part(st, 'livreuse', 'la livreuse', anchor(B.rider, 0, 1.4, 0), false);
      part(st, 'libraire', 'la libraire', anchor(shop, 0, 1.5, 0), false);
      st.focusAt = anchor(m, 1.5, 0.9, -1); st.size = { w: 12, h: 5 }; st.tagAt = anchor(m, 0, 2.4, 0);
      let ph = 0;
      st.update = (dt) => { const dd = spinW(); if (dd) { B.crank.rotation.z -= dd * 2.2; ph += dd * 4; B.rider.userData.walk(ph); } };
      const lid = (open, d = 0.7) => to(B.lid.rotation, 'z', open ? 1.6 : 0, d);
      st.action = async function () {
        if (st.done) { S.attach(pc); pc.position.copy(HOME); pc.rotation.set(0, 0, 0); placeOn(m, RT, 0); pop(m, 0.5); pop(pc, 0.4); await sleep(0.5); st.done = false; }
        await lid(true);
        await Promise.all([step('Au centre-ville, c’est le vélo cargo qui livre. On pose le colis dans sa grande caisse.', 'caisse'), hop(pc, pc.position.clone(), local(S, B.box).add(new V3(0, 0.15, 0)), 1.2, 0.6)]);
        m.attach(pc); await lid(false);
        tone(300, 0, 1.2, 'sine', 0.02, 420);
        await Promise.all([step('La livreuse pédale... et son moteur électrique l’aide. Pas de bruit, et pas de fumée !', 'moteur'), along(m, RT, 0, 7.5, 5, easeIn)]);
        ding(); setTimeout(ding, 280);
        await Promise.all([step('Dring dring ! Elle passe entre les promeneurs, tout doucement.', 'livreuse'), along(m, RT, 7.5, RT.len, 4.5, (k) => 1 - (1 - k) * (1 - k))]);
        await lid(true);
        const p0 = local(S, pc); S.attach(pc);
        await Promise.all([step('Elle s’arrête devant la librairie, et donne le colis à la libraire. Merci !', 'libraire'), hop(pc, p0, new V3(15, 0.75, -3.5), 1.2, 0.5)]);
        await lid(false); chime(); st.done = true;
      };
    })();

    /* ---- le drone de livraison : jusque dans le jardin ---- */
    (function () {
      const st = makeStation('drone'), S = st.g;
      { const d = grp(S); rbox(d, 3.4, 0.25, 3.4, 0.06, LM.conc, 0, 0.125, 0, 0.02); add(d, new THREE.RingGeometry(1.15, 1.35, 32), LM.yel, 0, 0.26, 0).rotation.x = -PI / 2;
        [[0, 0.7, 0.3], [0, 0.3, 0.7]].forEach(([x, w, dd]) => box(d, w, 0.012, dd, LM.white, x, 0.257, 0)); [1, -1].forEach((s) => { box(d, 3.4, 0.08, 0.06, LM.yel, 0, 0.29, s * 1.7); box(d, 0.06, 0.08, 3.4, LM.yel, s * 1.7, 0.29, 0); });
        rbox(d, 0.6, 1.1, 0.5, 0.04, LM.dark, -2.4, 0.55, -1.2, 0.02); box(d, 0.01, 0.3, 0.36, LM.screen, -2.09, 0.85, -1.2);
        add(d, new THREE.RingGeometry(0.55, 0.75, 24), LM.red, 14, 0.03, -1.5).rotation.x = -PI / 2; add(d, new THREE.CircleGeometry(0.2, 16), LM.red, 14, 0.031, -1.5).rotation.x = -PI / 2;
        bake(d); }
      const D = deliveryDrone(S); const m = D.g; st.m = m; const Y0 = 0.25 + D.Y; m.position.set(0, Y0, 0);
      const pc = colis(D.hook, 0.32, 0.25, 0.32, { dot: LM.green }); pc.position.y = -0.3; [1, -1].forEach((s) => box(pc, 0.02, 0.06, 0.02, LM.dark, s * 0.08, 0.27, 0)); bake(pc);
      const kidW = grp(S, 14.9, 0, -3.0); const kid = walker(kidW, 0, 0, { kid: true, top: 0xf07aa8 }); kidW.rotation.y = PI / 2 + 0.3;
      const mum = walker(S, 16.2, -3.3, { top: 0x2f7de0 }); mum.rotation.y = PI / 2 + 0.6;
      const TG = new V3(14, 0, -1.5), FLY = 9;
      part(st, 'helices', 'les six hélices', anchor(m, 0.9, 0.5, 0.5), true);
      part(st, 'fil', 'le fil', anchor(D.hook, 0, 0.6, 0.05), false);
      part(st, 'colis', 'le colis', anchor(pc, 0, 0.35, 0.1), false);
      part(st, 'jardin', 'le jardin', anchor(S, 13, 0.6, -1.5), true);
      st.focus = new V3(7, 3.5, -0.8); st.size = { w: 20, h: 11 }; st.el = 1.2; st.tagAt = anchor(m, 0, 1.6, 0);
      let rpm = 0, T = 0;
      st.update = (dt) => { T += dt; D.props.forEach((p, i) => (p.rotation.y += dt * rpm * (i % 2 ? 1 : -1))); if (st.wave) kid.userData.arms[0].rotation.z = PI - 0.4 + Math.sin(T * 8) * 0.4; };
      const cable = { L: 0 }; const setL = (L) => { cable.L = L; D.setCable(L); };
      st.action = async function () {
        if (st.done) { D.hook.attach(pc); pc.position.set(0, -0.3, 0); pc.rotation.set(0, 0, 0); setL(0); pop(pc, 0.4); kid.userData.arms[0].rotation.z = 0; await sleep(0.4); st.done = false; }
        tone(380, 0, 2, 'sawtooth', 0.012, 520);
        await Promise.all([step('Le drone de livraison allume ses six hélices.', 'helices'), tw(2, (k) => (rpm = 40 * k), lin)]);
        await Promise.all([step('Il s’envole tout droit, avec un colis accroché sous son ventre.', 'colis'), to(m.position, 'y', FLY, 3.5, easeSine)]);
        st.wave = true;
        await Promise.all([step('Il vole au-dessus des toits, jusqu’au bon jardin. Quelqu’un lui fait coucou !', 'jardin'),
          tw(5, (k) => { m.position.x = TG.x * k; m.position.z = TG.z * k; m.rotation.z = -0.15 * Math.sin(k * PI); }, easeSine)]);
        await Promise.all([step('Il ne se pose pas : il descend le colis au bout d’un fil, tout doucement.', 'fil'), tw(4, (k) => setL((FLY - 0.38) * k), easeSine)]);
        thud(); const p0 = local(S, pc); S.attach(pc); pc.position.copy(p0); pc.position.y = 0;
        await Promise.all([step('Le crochet lâche le colis. Le fil remonte, et le drone rentre à la maison !', 'helices'), tw(2.5, (k) => setL((FLY - 0.38) * (1 - k)), easeSine)]);
        st.wave = false; kid.userData.arms[0].rotation.z = 0;
        await tw(4, (k) => { m.position.x = TG.x * (1 - k); m.position.z = TG.z * (1 - k); m.rotation.z = 0.15 * Math.sin(k * PI); }, easeSine);
        await to(m.position, 'y', Y0, 3, easeSine);
        await tw(1.5, (k) => (rpm = 40 * (1 - k)), lin); rpm = 0; chime(); st.done = true;
      };
    })();

    /* ---- le petit robot livreur : jusqu'à la porte de Léo ---- */
    (function () {
      const st = makeStation('livreur'), S = st.g;
      const H = leoHouse(S, 11, -6.7);
      const R = sidewalkBot(S); const m = R.g; st.m = m;
      const TB = teddyBox(m, true); TB.g.scale.setScalar(0.8); TB.g.position.set(0, 0.1, 0);
      const kidW = grp(S, 11, 0, -3.85); kidW.rotation.y = -PI / 2; const kid = walker(kidW, 0, 0, { kid: true, top: 0xf2b21c, bottom: 0x2f4a8a }); kidW.visible = false;
      const spinW = spin(m, R.wheels);
      part(st, 'drapeau', 'le drapeau orange', anchor(m, -0.3, 1.6, 0.2), true);
      part(st, 'roues', 'les six roues', anchor(m, 0.25, 0.12, 0.35), true);
      part(st, 'couvercle', 'le couvercle', anchor(R.lid, 0.35, 0.08, 0.2), false);
      part(st, 'leo', 'Léo', anchor(kidW, 0, 1.05, 0), false);
      part(st, 'nounours', 'le nounours', anchor(TB.g, 0, 0.9, 0), false);
      st.focus = new V3(8, 1.0, -1.8); st.size = { w: 10, h: 4.6 }; st.tagAt = anchor(m, 0, 1.9, 0);
      let ph = 0;
      st.update = () => { spinW(); if (st.jump) { ph += 0.25; kidW.position.y = Math.abs(Math.sin(ph)) * 0.25; } };
      st.action = async function () {
        if (st.done) {
          m.attach(TB.g); TB.g.position.set(0, 0.1, 0); TB.g.rotation.set(0, 0, 0); TB.lid.position.set(0, 0.37, 0); TB.lid.rotation.set(0, 0, 0); TB.lid.visible = true;
          TB.bear.visible = false; TB.bear.position.y = 0; kidW.visible = false; H.door.rotation.y = 0; R.lid.rotation.z = 0;
          m.position.set(0, 0, 0); m.rotation.y = 0; spinW(); pop(m, 0.5); await sleep(0.5); st.done = false;
        }
        tone(600, 0, 0.4, 'sine', 0.03, 900);
        await Promise.all([step('Pour le tout dernier bout de chemin, un petit robot livreur roule tout seul sur le trottoir.', 'roues'), to(m.position, 'x', 11, 6, easeSine)]);
        await Promise.all([step('Son drapeau orange aide tout le monde à bien le voir. Il a trouvé la maison de Léo !', 'drapeau'), to(m.rotation, 'y', PI / 2, 1.4, easeSine)]);
        await Promise.all([step("Il remonte l'allée, jusqu'à la porte.", 'roues'), to(m.position, 'z', -2.95, 3, easeSine)]);
        ding(); setTimeout(() => tone(990, 0, 0.5, 'sine', 0.08), 350);
        await Promise.all([step('Ding dong ! La porte s’ouvre : c’est Léo !', 'leo'), to(H.door.rotation, 'y', 1.4, 1.2, easeSine)]);
        kidW.visible = true; kidW.position.y = 0; await pop(kidW, 0.4);
        await Promise.all([step('Le couvercle du robot s’ouvre... Léo prend son colis.', 'couvercle'), to(R.lid.rotation, 'z', 1.7, 1.0)]);
        await to(TB.g.position, 'y', 0.3, 0.6);
        const p0 = local(S, TB.g); S.attach(TB.g); TB.g.rotation.set(0, -PI / 2, 0);
        await hop(TB.g, p0, new V3(11, 0.42, -3.45), 1.0, 0.3);
        TB.bear.visible = true; TB.bear.position.y = -0.2;
        await Promise.all([step("Il l'ouvre... C'est un nounours ! Quel beau cadeau !", 'nounours'),
          tw(1.2, (k) => { TB.lid.position.y = 0.37 + k * 0.6; TB.lid.rotation.z = k * 1.2; TB.lid.position.x = -k * 0.4; TB.bear.position.y = -0.2 + 0.42 * k; }, easeSine)]);
        TB.lid.visible = false; st.jump = true; chime(); await sleep(1.6); st.jump = false; kidW.position.y = 0;
        await to(R.lid.rotation, 'z', 0, 0.6);
        st.done = true;
      };
    })();

    buildLife(scene, onUpdate, blockers);
  }
};

/** Léo's house (front at +z) with its front garden; the front door opens. */
function leoHouse(p, x, z) {
  const g = grp(p, x, 0, z), d = grp(g), W = 6, D = 5;
  house(d, { w: W, d: D, h: 5.4, wall: WALLS[4], roof: LM.tile, sh: SHUT[1], noDoor: true, door: 0 });
  box(d, 1.15, 2.25, 0.05, LM.white, 0, 1.12, D / 2 + 0.01); box(d, 0.92, 2.02, 0.04, LM.dark, 0, 1.01, D / 2 + 0.02);
  rbox(d, 1.7, 0.15, 0.9, 0.03, LM.stone, 0, 0.075, D / 2 + 0.45, 0.01);
  rbox(d, 1.6, 0.08, 0.8, 0.02, LM.tile, 0, 2.5, D / 2 + 0.4, 0.01); [1, -1].forEach((s) => rod(d, new V3(s * 0.7, 2.0, D / 2 + 0.02), new V3(s * 0.7, 2.46, D / 2 + 0.7), 0.025, LM.dark));
  sph(d, 0.1, LM.warm, 0.85, 1.9, D / 2 + 0.1); decal(d, '12', 0.32, 0.26, '#1f3a7a', -0.85, 1.9, D / 2 + 0.05, '#ffffff');
  box(d, W, 0.04, 3.3, LM.lawn, 0, 0.02, D / 2 + 1.65); box(d, 1.0, 0.05, 3.3, LM.stone, 0, 0.025, D / 2 + 1.65);
  [[-W / 2, -0.6], [0.6, W / 2]].forEach(([a, b]) => rbox(d, b - a, 0.7, 0.45, 0.2, LM.hedge, (a + b) / 2, 0.35, D / 2 + 3.05, 0.04));
  [-2.2, -1.4, 1.5, 2.3].forEach((xx, i) => { cylY(d, 0.02, 0.3, LM.green, xx, 0.15, D / 2 + 1.2, 6); sph(d, 0.12, [LM.red, LM.yel, LM.ribbon, LM.orange][i], xx, 0.32, D / 2 + 1.2); });
  { const mb = grp(d, 0.95, 0, D / 2 + 2.95); cylY(mb, 0.04, 1.0, LM.dark, 0, 0.5, 0, 8); rbox(mb, 0.3, 0.32, 0.4, 0.06, LM.yel, 0, 1.12, 0, 0.02); }
  bake(d);
  const door = grp(g, -0.45, 1.0, D / 2 + 0.045); rbox(door, 0.9, 2.0, 0.06, 0.02, LM.navy, 0.45, 0, 0, 0.01); sph(door, 0.045, MT.chrome, 0.8, 0, 0.05); rbox(door, 0.4, 0.4, 0.02, 0.05, MT.glassD, 0.45, 0.5, 0.03, 0.01); bake(door);
  return { g, door };
}

/* ================= the warehouse, the yard and the town ================= */
function buildWorld(scene) {
  const FLOW = [], PICK = [];
  /* -- l'entrepôt, coupé pour voir dedans -- */
  {
    const W = at(scene, -26, -12), HH = 9.5;
    rbox(W, 36, FL, 28, 0.04, LM.slab, 0, FL / 2, 0, 0.02); box(W, 35.6, 0.02, 27.6, LM.floor, 0, FL + 0.003, 0);
    { const pl = add(W, new THREE.PlaneGeometry(16, 18), LM.grid, -9.5, FL + 0.012, -3); pl.rotation.x = -PI / 2; }
    box(W, 36, 0.3, 0.04, MT.stripes, 0, FL - 0.15, 14.01);
    [[0, 12.6, 35, 0.12], [-1.5, -3, 0.12, 18], [8, -4, 0.12, 20], [8, 6, 16, 0.12]].forEach(([x, z, w, dd]) => box(W, w, 0.01, dd, LM.yel, x, FL + 0.016, z));
    for (let i = 0; i < 4; i++) box(W, 1.4, FL * (i + 1) / 4, 0.32, LM.conc, 5.5, FL * (i + 1) / 8, 14.3 + (3 - i) * 0.32);
    rail(W, [[4.8, FL + 0.9, 14], [4.8, 0.9, 15.3]], 0.03, LM.yel); rail(W, [[6.2, FL + 0.9, 14], [6.2, 0.9, 15.3]], 0.03, LM.yel);
    // the steel structure: columns, eave beams, trusses, purlins
    for (let x = -18; x <= 18; x += 6) rbox(W, 0.35, HH - FL, 0.35, 0.03, LM.steel, x, FL + (HH - FL) / 2, -14, 0.01);
    [-18, 18].forEach((x) => rbox(W, 0.35, HH - FL, 0.35, 0.03, LM.steel, x, FL + (HH - FL) / 2, 14, 0.01));
    [-14, -10, -3, 4.5, 9].forEach((z) => rbox(W, 0.35, HH - FL, 0.35, 0.03, LM.steel, -18, FL + (HH - FL) / 2, z, 0.01));
    [-14, -10.5, 4.5, 9].forEach((z) => rbox(W, 0.35, HH - FL, 0.35, 0.03, LM.steel, 18, FL + (HH - FL) / 2, z, 0.01));
    box(W, 36.4, 0.5, 0.3, LM.steel, 0, HH, -14); [-18, 18].forEach((x) => box(W, 0.3, 0.5, 28.4, LM.steel, x, HH, 0));
    for (let x = -18; x <= 18; x += 6) { box(W, 0.16, 0.16, 8.6, LM.steel, x, HH + 1.1, -9.7); box(W, 0.16, 0.16, 8.6, LM.steel, x, HH, -9.7); for (let z = -14; z < -6; z += 2.8) rod(W, new V3(x, HH, z), new V3(x, HH + 1.1, z + 1.4), 0.04, LM.steel, 6); }
    for (let z = -13; z <= -6; z += 3.5) box(W, 36, 0.12, 0.12, LM.steel, 0, HH + 1.2, z);
    // roof only over the back, with skylights; hanging lamps
    box(W, 36.6, 0.14, 8.6, LM.clad, 0, HH + 1.32, -9.8); for (let x = -15; x <= 15; x += 6) box(W, 1.4, 0.16, 7.6, LM.glassL, x, HH + 1.33, -9.8);
    for (let x = -15; x <= 15; x += 6) for (let z = -10; z <= -10; z += 6) { rod(W, new V3(x, HH, z), new V3(x, HH - 1.2, z), 0.01, LM.dark, 4); cylY(W, 0.35, 0.18, LM.dark, x, HH - 1.25, z, 12); cylY(W, 0.28, 0.02, LM.warm, x, HH - 1.35, z, 12); }
    // back wall cladding with the big sign; left wall cut on a slope; right wall: upper band and panels between the docks
    for (let x = -15; x <= 15; x += 6) box(W, 6, HH + 1.3 - FL, 0.12, LM.clad, x, FL + (HH + 1.3 - FL) / 2, -14.08);
    decal(W, 'ENTREPÔT BIDULE', 13, 1.5, '#1f3a7a', 0, 7.6, -13.98, '#ffffff');
    [[-11, HH + 1.3], [-5, 7.5], [1, 4.0], [7, 2.2], [11.75, 1.2]].forEach(([z, h], i) => { const w = i === 4 ? 3.5 : 6; box(W, 0.12, h, w, LM.clad, -18.08, FL + h / 2, z); box(W, 0.16, 0.12, w, LM.dark, -18.08, FL + h, z); });
    box(W, 0.12, HH + 1.3 - FL - 4.4, 28, LM.clad, 18.08, FL + 4.4 + (HH + 1.3 - FL - 4.4) / 2, 0);
    box(W, 0.12, 4.4, 4.2, LM.clad, 18.08, FL + 2.2, -11.9); box(W, 0.12, 4.4, 3.6, LM.clad, 18.08, FL + 2.2, -3.0);
    // pallet racks along the back wall
    for (let x = 0.5; x < 16; x += 2.7) { [-12.8, -13.8].forEach((z) => box(W, 0.1, 7, 0.1, LM.rack, x, FL + 3.5, z)); }
    [FL + 0.15, FL + 2.0, FL + 3.85, FL + 5.7].forEach((y, lv) => {
      [-12.8, -13.8].forEach((z) => box(W, 15.6, 0.14, 0.08, LM.beam, 8.2, y, z));
      for (let x = 1.85; x < 16; x += 2.7) [-0.65, 0.65].forEach((o) => { if ((x * 3 + lv + o) % 4 < 0.6) return; const P = pallet(W); P.position.set(x + o, y + 0.07, -13.3); P.rotation.y = PI / 2; rbox(W, 1.0, 1.1, 0.8, 0.03, (lv + x) % 2 ? LM.card : LM.cardD, x + o, y + 0.78, -13.3, 0.01); });
    });
    // robot zone: safety fence with the window for the picking station, the chargers
    for (let x = -18; x <= -2; x += 2) { if (Math.abs(x + 9) < 0.1) continue; box(W, 0.06, 1.5, 0.06, LM.yel, x, FL + 0.75, 5.95); }
    box(W, 16, 0.05, 0.05, LM.yel, -10, FL + 1.45, 5.95); box(W, 16, 0.05, 0.05, LM.yel, -10, FL + 0.8, 5.95);
    for (let z = -12; z <= 6; z += 2) { if (Math.abs(z - 4.5) < 1.2) continue; box(W, 0.06, 1.5, 0.06, LM.yel, -1.6, FL + 0.75, z); }
    [[-12.5, 3.3], [5.7, 6]].forEach(([a, b]) => { box(W, 0.05, 0.05, b - a, LM.yel, -1.6, FL + 1.45, (a + b) / 2); box(W, 0.05, 0.05, b - a, LM.yel, -1.6, FL + 0.8, (a + b) / 2); });
    for (let z = -12; z <= -4; z += 2) { rbox(W, 0.4, 0.4, 0.9, 0.04, LM.dark, -17.6, FL + 0.2, z, 0.02); box(W, 0.02, 0.15, 0.3, LM.screen, -17.39, FL + 0.28, z); }
    // static pods in the grid
    [-16, -13.5, -11, -8.5, -6, -3.5].forEach((x) => [-9.5, -7, -2, 0.5].forEach((z, j) => { if ((x + j) % 3 === 0) return; pod(W).g.position.set(x, FL, z); }));
    // the office with glass walls and the yard fence/gate
    { const o = grp(W, 16, FL, 6.5); rbox(o, 3.1, 0.12, 5, 0.03, LM.dark, 0, 2.7, 0, 0.01); box(o, 3.0, 2.6, 0.06, LM.glassL, 0, 1.3, 2.5); box(o, 0.06, 2.6, 5, LM.glassL, -1.5, 1.3, 0);
      [[-1.5, 2.5], [1.5, 2.5], [-1.5, -2.5]].forEach(([a, b]) => box(o, 0.1, 2.7, 0.1, LM.white, a, 1.35, b)); rbox(o, 1.4, 0.06, 0.7, 0.02, LM.wood, 0.2, 0.75, 0.6, 0.01); box(o, 0.04, 0.3, 0.45, LM.screen, 0.2, 1.0, 0.3);
      decal(o, 'BUREAU', 1.5, 0.3, '#1f3a7a', 0, 2.95, 2.52, '#ffffff'); }
    // people standing at work: a picker at the far pods, a supervisor with a tablet
    { const a = walker(W, 12, -4, { vest: true }); a.rotation.y = 0.4; const b = walker(W, -14, 12.5, { top: 0x2f7de0 }); b.rotation.y = PI / 2; b.position.y = FL; a.position.y = FL; }
  }
  /* -- la cour des camions -- */
  {
    const Y = at(scene, -8, -11); const G2 = dockGate(Y); G2.door.scale.y = 0.03; G2.lip.rotation.z = 0; G2.lev.rotation.z = 0.004; G2.red.emissiveIntensity = 0.1; G2.green.emissiveIntensity = 1.6;
    const T2 = semiTruck(Y, { tractor: false, open: true }); T2.g.position.x = 0.24;
    const T3 = semiTruck(at(scene, 0, -24.4), { tractor: false }); void T3;
    const yf = grp(scene);
    for (let h = -7; h <= 15; h += 2.2) { const g = at(yf, h, -26.8); box(g, 0.06, 1.8, 0.06, LM.greyD, 0, 0.9, 0); box(g, 2.2, 0.04, 0.04, LM.greyD, 1.1, 1.75, 0); box(g, 2.2, 0.04, 0.04, LM.greyD, 1.1, 0.3, 0); }
    { const g = at(scene, 15.6, -3); rbox(g, 2.2, 2.6, 2.2, 0.06, LM.white, 0, 1.3, 0, 0.02); box(g, 2.0, 0.9, 0.05, MT.glassD, 0, 1.6, 1.11); rbox(g, 2.6, 0.14, 2.6, 0.03, LM.navy, 0, 2.66, 0, 0.01);
      const arm = grp(g, -0.9, 1.0, 1.6); cylY(g, 0.18, 1.0, LM.dark, -0.9, 0.5, 1.6, 10); for (let i = 0; i < 5; i++) box(arm, 0.1, 0.12, 0.8, i % 2 ? LM.white : LM.red, 0, 0, -0.4 - i * 0.8); arm.rotation.x = 1.2; }
    [[-4, -26.2], [6, -26.2], [14.8, -14], [14.8, -2]].forEach(([h, d]) => { const [x, z] = Q(h, d); lamp(scene, x, z, YAW + PI / 2); });
  }
  /* -- la consigne's pad and the service road -- */
  [[-18, 2.2], [-6, 2.2], [6, 2.2]].forEach(([h, d]) => { const [x, z] = Q(h, d); lamp(scene, x, z, YAW - PI / 2); });
  /* -- les maisons du devant (la petite rue) -- */
  [[3, 0], [9.5, 2], [22.5, 3], [29, 1], [35.5, 4], [42, 0]].forEach(([h, k]) => {
    const g = at(scene, h, 17.5); house(g, { w: 5.6, h: k % 2 ? 7.6 : 5.4, wall: WALLS[k], door: k % 2 ? -1.2 : 1.2 });
    garden(g, 0, 4.0, 6, 2.8, { path: k % 2 ? -1.2 : 1.2, hedge: k % 3 === 0, flowers: 8 }, FLOW, PICK);
    garden(g, 0, -4.2, 6, 3.2, { flowers: 6 }, FLOW, PICK);
    if (k % 2) { const c = miniCar(g, pick(['car', 'kei']), undefined); c.position.set(-1.8, 0, -4.4); c.rotation.y = PI / 2; }
  });
  { const g = at(scene, 16, 17.5); garden(g, 0, -4.2, 6, 3.2, { flowers: 6 }, FLOW, PICK); const sw = grp(g, 1.2, 0, -4.4); [-0.8, 0.8].forEach((x) => { rod(sw, new V3(x, 0, -0.5), new V3(x, 2.0, 0), 0.05, LM.red); rod(sw, new V3(x, 0, 0.5), new V3(x, 2.0, 0), 0.05, LM.red); }); rod(sw, new V3(-0.8, 2.0, 0), new V3(0.8, 2.0, 0), 0.05, LM.red); rbox(sw, 0.5, 0.05, 0.22, 0.02, LM.yel, 0, 0.5, 0, 0.01); [-0.2, 0.2].forEach((x) => rod(sw, new V3(x, 2.0, 0), new V3(x, 0.52, 0), 0.01, LM.dark)); }
  /* -- la place : boutiques, terrasse, arbres, bancs -- */
  house(at(scene, 28, -13.5), { w: 5.8, h: 5.4, shop: true, sign: 'BOULANGERIE', shopCol: LM.red, awning: LM.awnR, wall: WALLS[0] });
  house(at(scene, 34, -13.5), { w: 5.8, h: 5.4, shop: true, sign: 'CAFÉ', shopCol: LM.blue, awning: LM.awnB, wall: WALLS[2] });
  house(at(scene, 40, -13.5), { w: 5.8, h: 5.4, shop: true, sign: 'LIBRAIRIE', shopCol: LM.green, awning: LM.awnG, wall: WALLS[3] });
  [[32.4, -9.6], [35.6, -9.6]].forEach(([h, d]) => { const g = at(scene, h, d); cylY(g, 0.4, 0.04, LM.white, 0, 0.75, 0, 16); cylY(g, 0.05, 0.75, LM.dark, 0, 0.375, 0, 8); [1, -1].forEach((s) => { const c = grp(g, s * 0.7, 0, 0); box(c, 0.4, 0.04, 0.4, LM.navy, 0, 0.45, 0); box(c, 0.04, 0.45, 0.4, LM.navy, s * 0.2, 0.68, 0); }); });
  { const a = walker(scene, 0, 0, { top: 0xf07aa8 }); const [x, z] = Q(33.6, -8.7); a.position.set(x, 0, z); a.rotation.y = YAW - PI / 2; }
  [[26, 0.6], [32, 0.6], [38, 0.6], [44, -4]].forEach(([h, d]) => { const [x, z] = Q(h, d); roundTree(scene, x, z, 1.0, [0x6aa84c, 0x5a9a44, 0x7ab854]); });
  [[29, 1.2], [35, 1.2]].forEach(([h, d]) => { const [x, z] = Q(h, d); bench(scene, x, z, YAW + PI); });
  /* -- derrière la place : la base des drones et les maisons avec jardin -- */
  { const g = at(scene, 27, -25.2); house(g, { w: 5, d: 4, h: 3.6, wall: LM.white, roof: LM.slate, noDoor: true }); box(g, 2.2, 2.2, 0.06, LM.dark, 0, 1.1, 2.03); decal(g, 'BASE DES DRONES', 4.4, 0.42, '#ffffff', 0, 3.0, 2.05, '#1f3a7a'); }
  [[33, 1], [39, 3], [45, 2]].forEach(([h, k]) => { const g = at(scene, h, -25.5); house(g, { w: 5.6, h: k === 3 ? 5.4 : 7.6, wall: WALLS[k], door: 1.2 }); garden(g, 0, 6.2, 5.8, 6.2, { path: 1.2, flowers: 12 }, FLOW, PICK); });
  { const g = at(scene, 39, -20); const t = grp(g, 2.4, 0, 1.0); add(t, new THREE.CylinderGeometry(1.1, 1.1, 0.12, 20), LM.navy, 0, 0.75, 0); add(t, new THREE.CylinderGeometry(0.95, 0.95, 0.13, 20), LM.dark, 0, 0.76, 0); for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; cylY(t, 0.04, 0.75, LM.greyD, Math.cos(a) * 1.0, 0.375, Math.sin(a) * 1.0, 6); } }
  /* -- en face de l'entrepôt : le parking et le petit parc -- */
  for (let h = -39; h <= -23; h += 2.6) [14.6, 18.4].forEach((d) => { if (Math.random() < 0.7) { const c = miniCar(scene, pick(['car', 'kei', 'van', 'car'])); const [x, z] = Q(h, d); c.position.set(x, 0, z); c.rotation.y = YAW + (d < 16 ? PI / 2 : -PI / 2); } });
  [[-44, 14], [-42, 22], [-18, 14], [-14, 22], [-10, 17], [-16, 26], [-8, 25], [-45, -30], [-30, -29], [-12, -29], [48, 4], [47, 16], [48, -12], [-48, 0]].forEach(([h, d], i) => { const [x, z] = Q(h, d); roundTree(scene, x, z, rnd(0.9, 1.2), i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6a9a3a, 0x5a8a3a, 0x7aa84a]); });
  [[-12, 18.5, 0], [-15, 22, PI / 2]].forEach(([h, d, r]) => { const [x, z] = Q(h, d); bench(scene, x, z, YAW + r); });
  /* -- lampadaires le long de la grande rue -- */
  for (let h = -40; h <= 44; h += 12) { const [x, z] = Q(h, 11.5); lamp(scene, x, z, YAW + PI / 2); }
  for (let h = 2; h <= 42; h += 10) { const [x, z] = Q(h, 23.2); lamp(scene, x, z, YAW + PI / 2); }
  /* -- instanced flowers and picket fences -- */
  const FC = [0xf2b21c, 0xe5452c, 0xf07aa8, 0xffffff, 0xa45ad8];
  instanced(scene, new THREE.IcosahedronGeometry(0.13, 0), FLOW.length, (i, dm) => { dm.position.copy(FLOW[i]); dm.rotation.set(rnd(0, 3), rnd(0, 3), 0); dm.scale.setScalar(rnd(0.8, 1.3)); return pick(FC); });
  instanced(scene, new THREE.BoxGeometry(0.08, 0.8, 0.04), PICK.length, (i, dm) => { dm.position.copy(PICK[i]); dm.rotation.set(0, YAW, 0); dm.scale.set(1, 1, 1); return 0xf4f5f8; });
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate, blockers) {
  const R = (pts, t = 0.1, y = 0) => route(pts.map(([h, d]) => [...Q(h, d), y]), true, t);
  const cols = [0xe5452c, 0x2f7de0, 0xf2f2f6, 0xf2b21c, 0x3aa46a, 0x1b1d24, 0x8fd0ff, 0xa45ad8];
  const main = R([[-48, 7.1], [48, 7.1], [50, 8], [48, 8.9], [-48, 8.9], [-50, 8]]);
  const carsA = ['car', 'van', 'kei', 'truck', 'car', 'taxi', 'car'].map((k, i) => miniCar(scene, k, k === 'van' ? 0xf4f5f8 : cols[i]));
  const front = R([[-1, 26.2], [41, 26.2], [43, 27], [41, 27.8], [-1, 27.8], [-3, 27]]);
  const carsB = ['kei', 'car'].map((k, i) => miniCar(scene, k, cols[i + 4]));
  const cross = R([[18.1, 3.5], [18.1, -27], [19, -29], [19.9, -27], [19.9, 3.5], [19, 5]]);
  const carsC = ['car', 'van'].map((k, i) => miniCar(scene, k, cols[i + 6]));
  const walkers = [];
  const Wk = (pts, n, y = 0, opts = {}) => { const r = R(pts, 0.05, y); const ps = Array.from({ length: n }, (_, i) => walker(scene, 0, 0, { kid: i % 4 === 2, ...opts })); walkers.push(...ps); return traffic(r, ps, 1.0, { gap: 1.1, y }); };
  const w1 = Wk([[0, 10.5], [44, 10.5], [44, 11.2], [0, 11.2]], 6);
  const w2 = Wk([[26, -7.8], [43, -7.8], [43, 0.8], [26, 0.8]], 6);
  const w3 = Wk([[-25, -21.4], [-12, -21.4], [-12, -22.1], [-25, -22.1]], 3, FL, { vest: true });
  const w4 = Wk([[21.6, -26], [21.6, 2], [22.1, 2], [22.1, -26]], 3);
  // shelf robots carrying their pods along the aisle
  const bots = [0, 1, 2].map((i) => { const g = grp(scene); shelfBot(g); const p = pod(g).g; p.position.y = 0.08; if (i === 2) p.visible = false; return g; });
  const aisle = R([[-43, -15.5], [-29, -15.5], [-28.2, -16.25], [-29, -17], [-43, -17], [-43.8, -16.25]], 0.15, FL);
  const tb = traffic(aisle, bots, 1.1, { gap: 2.2, y: FL });
  const all = [...carsA, ...carsB, ...carsC, ...walkers];
  const tA = traffic(main, carsA, 3.4, { gap: 3.6 }), tB = traffic(front, carsB, 2.6, { gap: 3.6 }), tC = traffic(cross, carsC, 2.8, { gap: 3.6 });
  onUpdate((dt) => {
    const extra = blockers.map((f) => f());
    const others = all.concat(extra);
    tA.update(dt, others); tB.update(dt, others); tC.update(dt, others); [w1, w2, w3, w4].forEach((t) => t.update(dt, others)); tb.update(dt, bots);
  });
}
