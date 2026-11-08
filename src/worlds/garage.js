// Le Garage — the family car has a flat tyre and won't start. A tow truck brings it in, the garage lifts it, changes the tyre,
// the oil and the battery, checks the headlights, washes it, and it fills up at the station before going home.
// The car's insides are shown in "cut-away" moments: the bonnet opens on the engine, the cover lifts on the pistons.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylGeo, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, arc, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { tire, fender, hydraulic, truckCab, beacon } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp } from '../kit/props.js';
import { route, person as walker, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };

/* ---------- textures and materials (defined once) ---------- */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}
const plateTex = canvasTex(256, 56, (x) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 56); x.fillStyle = '#1f4fbf'; x.fillRect(0, 0, 26, 56); x.fillRect(230, 0, 26, 56);
  x.fillStyle = '#fff'; x.font = '900 22px system-ui,sans-serif'; x.textAlign = 'center'; x.fillText('F', 13, 46);
  x.fillStyle = '#16181f'; x.font = '900 34px system-ui,sans-serif'; x.fillText('BI-123-DU', 128, 40);
  x.strokeStyle = '#16181f'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 253, 53);
});
const chevTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#f4f5f8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8302a';
  for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 16, 64); x.lineTo(i + 80, 0); x.lineTo(i + 64, 0); x.closePath(); x.fill(); }
}, 3, 1);
const brushTex = canvasTex(64, 8, (x) => { const c = ['#3b6fe6', '#9fc4ff', '#e8f0ff', '#2a56c8']; for (let i = 0; i < 16; i++) { x.fillStyle = c[i % 4]; x.fillRect(i * 4, 0, 4, 8); } }, 3, 1);
const pegTex = canvasTex(64, 64, (x) => { x.fillStyle = '#c8b48a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#7a6a4a'; for (let i = 4; i < 64; i += 8) for (let j = 4; j < 64; j += 8) x.fillRect(i, j, 2, 2); }, 4, 2);
const scr = (bg, draw) => canvasTex(128, 80, (x) => { x.fillStyle = bg; x.fillRect(0, 0, 128, 80); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round'; draw(x); });
const SCR = {
  off: scr('#10131a', () => {}),
  scan: scr('#1f4fbf', (x) => { x.beginPath(); x.moveTo(18, 52); x.lineTo(24, 40); x.lineTo(42, 38); x.lineTo(54, 26); x.lineTo(80, 26); x.lineTo(92, 38); x.lineTo(108, 42); x.lineTo(108, 52); x.closePath(); x.stroke(); x.beginPath(); x.arc(38, 54, 7, 0, 7); x.arc(90, 54, 7, 0, 7); x.fill(); for (let i = 0; i < 5; i++) x.fillRect(20 + i * 20, 68, 12, 5); }),
  bat: scr('#c8302a', (x) => { x.strokeRect(30, 24, 62, 38); x.fillRect(92, 34, 8, 18); x.fillRect(40, 42, 16, 5); x.fillRect(72, 36, 5, 16); x.fillRect(67, 42, 15, 5); }),
  ok: scr('#2fa05a', (x) => { x.lineWidth = 12; x.beginPath(); x.moveTo(38, 42); x.lineTo(56, 60); x.lineTo(92, 22); x.stroke(); }),
  beam: scr('#141820', (x) => { x.fillStyle = '#ffe680'; x.beginPath(); x.moveTo(10, 52); x.lineTo(64, 52); x.lineTo(84, 36); x.lineTo(118, 36); x.lineTo(118, 70); x.lineTo(10, 70); x.closePath(); x.fill(); x.strokeStyle = '#7a8a9a'; x.lineWidth = 2; x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 80); x.moveTo(0, 40); x.lineTo(128, 40); x.stroke(); })
};
const GM = {
  alloy: std(0xc9ced8, 0.25, 0.8), dark: std(0x2a2f3c, 0.55, 0.25), engine: std(0xaab1bd, 0.35, 0.75), engineD: std(0x5a606c, 0.5, 0.6),
  pipe: std(0x8a7a6a, 0.55, 0.7), black: MT.black, chrome: MT.chrome, glass: MT.glassD, glassT: MT.glass,
  yel: std(0xf2c21c, 0.4, 0.1), yelD: std(0xd89a14, 0.45, 0.1), white: std(0xf3f4f7, 0.35, 0.1), orange: std(0xf2781c, 0.4, 0.15),
  blue: std(0x2f5fc8, 0.4, 0.2), blueD: std(0x1f3f8f, 0.5, 0.2), green: std(0x2fa05a, 0.4, 0.1), red: std(0xd8302a, 0.4, 0.15),
  grey: std(0xb8bcc6, 0.5, 0.4), greyD: std(0x6a707c, 0.5, 0.4), alu: std(0xc8ccd4, 0.35, 0.7), lift: std(0x2f6fd8, 0.4, 0.25), liftD: std(0x1f4aa0, 0.45, 0.3),
  machine: std(0xd8302a, 0.4, 0.2), cap: std(0xd8302a, 0.6, 0), plate: std(0xffffff, 0.4, 0.05, { map: plateTex }),
  chev: std(0xffffff, 0.45, 0.1, { map: chevTex }), brush: std(0xffffff, 0.9, 0, { map: brushTex }), peg: std(0xffffff, 0.9, 0, { map: pegTex }),
  oilBlack: std(0x14120f, 0.15, 0.3), oilGold: std(0xe8a628, 0.15, 0.2, { emissive: 0x7a4a00, emissiveIntensity: 0.4 }),
  lampOff: std(0xe8eef6, 0.12, 0.4), tank: std(0x3a3f4a, 0.6, 0.3), cover: std(0x2a2d36, 0.4, 0.3),
  wall: std(0xf0e6d4, 0.9, 0), wallW: std(0xf6f4ef, 0.9, 0), roof: std(0x5a6274, 0.7, 0.2), conc: std(0xc4c6ce, 0.9, 0),
  wood: std(0xb98a55, 0.8, 0), woodD: std(0x8a5a3a, 0.8, 0), seat: std(0x2f7de0, 0.6, 0.1), coffee: std(0x5a2a22, 0.5, 0.2),
  leaf: std(0x3f8f3a, 0.9, 0), leafL: std(0x6ab84a, 0.9, 0), pot: std(0xc8643a, 0.8, 0), hedge: std(0x3a7a3a, 0.95, 0),
  beam: new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  water: std(0x6ab8f0, 0.1, 0.2, { transparent: true, opacity: 0.55, depthWrite: false })
};
const led = () => std(0x2aff6a, 0.3, 0, { emissive: 0x10d040, emissiveIntensity: 0.3 });
const RED = 0xd83a2a;
const bake = (g) => { shadows(g); freeze(g); return g; };

/* ---------- small helpers ---------- */
const _a = new V3(), _b = new V3(), _d = new V3(), YAX = new V3(0, 1, 0);
/** A rope / hose / oil stream: a thin cylinder stretched between two world points. */
function line(parent, r, m, seg = 6) {
  const g = grp(parent); const c = add(g, cylGeo(seg), m); g.visible = false;
  return {
    g, set(a, b) {
      _a.copy(a); _b.copy(b); parent.worldToLocal(_a); parent.worldToLocal(_b); _d.subVectors(_b, _a); const L = _d.length() || 0.001;
      g.position.copy(_a); g.quaternion.setFromUnitVectors(YAX, _d.multiplyScalar(1 / L)); c.scale.set(r, L, r); c.position.y = L / 2;
    }
  };
}
/** A hose that sags between two world points (two straight pieces). */
function hose(parent, r, m) {
  const A = line(parent, r, m, 8), B = line(parent, r, m, 8), mid = new V3();
  return { show(v) { A.g.visible = B.g.visible = v; }, set(a, b, sag = 0.5) { mid.lerpVectors(a, b, 0.5); mid.y = Math.max(0.08, Math.min(a.y, b.y) - sag); A.set(a, mid); B.set(mid, b); } };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const face = (g, x, z) => { g.rotation.y = Math.atan2(-(z - g.position.z), x - g.position.x); };
const point = (g, on) => { g.userData.arms[0].rotation.z = on ? 2.2 : 0; };
async function walkTo(g, x, z, spd = 1.7) {
  const x0 = g.position.x, z0 = g.position.z, dx = x - x0, dz = z - z0, L = Math.hypot(dx, dz); if (L < 0.02) return;
  g.rotation.y = Math.atan2(-dz, dx); g.userData.arms[0].rotation.z = 0;
  await tw(L / spd, (k) => { g.position.x = x0 + dx * k; g.position.z = z0 + dz * k; g.userData.walk(k * L * 4.2); }, lin);
  g.userData.walk(0);
}
/** People are a bit bigger here, next to real-size cars. */
function P(p, x, z, o = {}) { const g = walker(p, x, z, o); g.scale.setScalar(o.kid ? 0.95 : 1.32); return g; }
function mech(p, x, z) { const g = P(p, x, z, { top: 0x2f5fb8, bottom: 0x2f5fb8, hair: 0x4a3022 }); { const c = add(g, CAP_G, GM.cap, -0.01, 1.16, 0); c.scale.y = 0.62; rbox(g, 0.16, 0.025, 0.24, 0.02, GM.cap, 0.2, 1.17, 0, 0.01); } rbox(g, 0.25, 0.05, 0.37, 0.02, GM.orange, 0, 0.62, 0, 0.01); rbox(g, 0.05, 0.14, 0.1, 0.02, GM.red, -0.1, 0.5, -0.12, 0.01); shadows(g); return g; }
function sit(g, legs = 1.45) { g.children[0].rotation.z = legs; g.children[1].rotation.z = legs; return g; }
const CAP_G = new THREE.SphereGeometry(0.215, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const popTo = (o, s = 1, d = 0.5) => { o.visible = true; o.scale.setScalar(0.01); return tw(d, (k) => o.scale.setScalar(Math.max(0.01, k * s)), easeBack); };

/* ================= the family car (and its cousins) ================= */
// Facing +x, wheels on y = 0. Axles at x = ±1.3, wheel radius 0.33, width 1.76 (z = ±0.88).
const RA = -1.3, FA = 1.3, AR = 0.42, WR = 0.33, CW = 1.76, HW = 0.88;
const CARM = {};
const carMat = (c) => CARM[c] || (CARM[c] = std(c, 0.26, 0.4));
const PLATE = new THREE.PlaneGeometry(0.5, 0.11);
const plate = (p, x, y, z, ry) => { const m = add(p, PLATE, GM.plate, x, y, z); m.rotation.y = ry; return m; };
/** Road wheel: tyre + alloy rim; the still rim parts are merged, the tyre stays a separate mesh (userData.tyre). */
function wheel(p, x, y, z, s) {
  const w = tire(p, WR, 0.2, x, y, z, GM.alloy, s, MT.rubber);
  const ty = w.children[0]; w.remove(ty); freeze(w); w.add(ty); w.userData.tyre = ty; w.userData.r = WR; return w;
}
function car(p, o = {}) {
  const m = grp(p), d = grp(m), B = o.mat || carMat(o.color || RED), Lm = o.lamp || GM.lampOff, Am = o.amber || MT.amber;
  const R = { g: m, mat: B, lamp: Lm, amber: Am };
  // cabin + rear section, with the rear wheel arch cut out
  ext(d, [[-2.04, 0.3], [RA - AR - 0.03, 0.3], ...arc(RA, WR, AR, 180, 0, 10), [RA + AR + 0.03, 0.3], [0.86, 0.3], [0.86, 0.93], [-1.6, 1.0], [-2.0, 0.96], [-2.1, 0.74], [-2.08, 0.4]], 0.03, CW, B, 0, 0, 0, 0.04);
  // front wings with their arches; the engine bay is open between them, under the bonnet
  const fen = [[0.84, 0.3], [FA - AR - 0.03, 0.3], ...arc(FA, WR, AR, 180, 0, 10), [FA + AR + 0.03, 0.3], [2.0, 0.3], [2.1, 0.44], [2.1, 0.66], [1.98, 0.8], [0.84, 0.93]];
  [1, -1].forEach((s) => ext(d, fen, 0.03, 0.14, B, 0, 0, s * (HW - 0.07), 0.03));
  rbox(d, 0.14, 0.44, CW - 0.26, 0.04, B, 2.02, 0.6, 0); // nose
  rbox(d, 0.16, 0.16, CW - 0.04, 0.05, GM.dark, 2.05, 0.36, 0); // bumper
  rbox(d, 0.04, 0.13, o.ev ? 0.5 : 0.86, 0.04, o.ev ? GM.blue : MT.black, 2.1, 0.66, 0); // grille
  rbox(d, 0.04, 0.08, 1.1, 0.03, MT.black, 2.13, 0.38, 0); // lower intake
  box(d, 0.02, 0.06, 0.16, GM.chrome, 2.12, 0.66, 0); plate(d, 2.135, 0.5, 0, Math.PI / 2);
  [1, -1].forEach((s) => {
    const hl = rbox(d, 0.1, 0.11, 0.38, 0.04, Lm, 2.04, 0.74, s * 0.58, 0.02); hl.rotation.y = s * 0.25;
    rbox(d, 0.05, 0.05, 0.1, 0.02, Am, 2.06, 0.64, s * 0.74, 0.01);
    rbox(d, 0.06, 0.16, 0.3, 0.03, MT.tail, -2.06, 0.86, s * 0.6, 0.02); rbox(d, 0.04, 0.06, 0.12, 0.02, Am, -2.08, 0.74, s * 0.66, 0.01);
    const z = s * (CW / 2 - 0.1), zs = s * (HW + 0.004);
    rod(d, new V3(0.84, 0.95, z), new V3(0.0, 1.43, z), 0.045, B); // A pillar
    rbox(d, 0.1, 0.5, 0.05, 0.02, B, -0.5, 1.19, s * (CW / 2 - 0.09), 0.01); // B pillar
    rod(d, new V3(-1.42, 1.44, z), new V3(-1.97, 1.0, z), 0.07, B); // C pillar
    box(d, 2.95, 0.035, 0.05, MT.black, -0.55, 0.965, s * (CW / 2 - 0.06)); // window sill trim
    [0.82, -0.5, -1.62].forEach((x) => box(d, 0.014, 0.62, 0.012, GM.dark, x, 0.63, zs)); // door lines
    [0.15, -1.05].forEach((x) => box(d, 0.15, 0.03, 0.025, GM.chrome, x, 0.86, zs)); // handles
    rbox(d, 2.2, 0.08, 0.04, 0.02, MT.black, -0.2, 0.33, zs, 0.01); // sill
    rod(d, new V3(0.72, 0.98, s * 0.84), new V3(0.76, 1.0, s * 1.0), 0.025, MT.black); rbox(d, 0.1, 0.12, 0.2, 0.04, B, 0.76, 1.03, s * 1.05, 0.02); // mirrors
    rbox(d, 0.07, 0.03, 0.012, 0.01, Am, 1.62, 0.7, zs, 0.005); // side repeater
  });
  // glasshouse, roof with bars, wiper, spoiler, rear bumper and plate
  ext(d, [[0.88, 0.93], [0.02, 1.42], [-1.42, 1.45], [-1.98, 0.99], [-1.9, 0.95]], [0.02, 0.1, 0.12, 0.05, 0.02], CW - 0.18, GM.glass, 0, 0, 0, 0.03);
  rbox(d, 1.5, 0.07, CW - 0.22, 0.04, B, -0.7, 1.45, 0);
  [1, -1].forEach((s) => { rbox(d, 1.3, 0.04, 0.05, 0.02, MT.black, -0.7, 1.53, s * 0.62, 0.01); [-0.1, -1.3].forEach((x) => box(d, 0.08, 0.06, 0.06, MT.black, x, 1.5, s * 0.62)); });
  rod(d, new V3(0.75, 0.97, 0.1), new V3(0.5, 1.1, -0.45), 0.012, MT.black, 4);
  { const sp = rbox(d, 0.34, 0.05, CW - 0.3, 0.02, B, -1.52, 1.47, 0); sp.rotation.z = 0.12; } rbox(d, 0.16, 0.18, CW - 0.02, 0.05, GM.dark, -2.05, 0.4, 0); plate(d, -2.135, 0.62, 0, -Math.PI / 2);
  // underside: floor pan, rear axle, fuel tank, exhaust (pipes, silencers, the shiny tail pipe sticking out at the back)
  box(d, 3.3, 0.02, 1.2, GM.dark, -0.4, 0.29, 0); box(d, 0.08, 0.08, 1.3, GM.dark, RA, 0.3, 0);
  if (!o.lite) rbox(d, 0.75, 0.14, 0.8, 0.04, GM.tank, -0.7, 0.22, -0.2, 0.02);
  R.tank = anchor(m, -0.7, 0.12, 0.1);
  if (!o.ev) {
    rod(d, new V3(1.3, 0.42, 0.35), new V3(1.0, 0.16, 0.35), 0.035, GM.pipe); rod(d, new V3(1.0, 0.16, 0.35), new V3(-1.55, 0.16, 0.35), 0.033, GM.pipe);
    cylX(d, 0.07, 0.4, GM.pipe, 0.6, 0.16, 0.35, 10); cylX(d, 0.09, 0.55, GM.pipe, -0.35, 0.15, 0.35, 12);
    rbox(d, 0.5, 0.17, 0.42, 0.06, GM.pipe, -1.78, 0.2, 0.32, 0.02); cylX(d, 0.045, 0.32, GM.chrome, -2.08, 0.17, 0.42, 10);
    R.tip = anchor(m, -2.24, 0.17, 0.42);
  } else R.tip = anchor(m, -2.1, 0.3, 0.42);
  // the engine bay: floor, bulkhead, radiator, battery, air box, coolant and washer tanks
  box(d, 1.1, 0.03, CW - 0.28, GM.dark, 1.42, 0.43, 0); box(d, 0.02, 0.46, CW - 0.28, GM.dark, 0.875, 0.68, 0); box(d, 0.06, 0.34, 1.3, GM.engineD, 1.9, 0.62, 0);
  if (!o.lite) {
    rbox(d, 0.14, 0.14, 0.18, 0.03, GM.white, 1.8, 0.56, 0.58, 0.01); cylY(d, 0.04, 0.03, GM.red, 1.8, 0.645, 0.58, 10);
    cylY(d, 0.05, 0.05, GM.blue, 1.78, 0.62, -0.6, 10);
    if (!o.ev) {
      rbox(d, 0.42, 0.3, 0.84, 0.04, GM.engine, 1.5, 0.6, 0, 0.02); rbox(d, 0.46, 0.04, 0.88, 0.02, GM.engineD, 1.5, 0.755, 0, 0.01);
      [-0.3, -0.1, 0.1, 0.3].forEach((z) => cylY(d, 0.082, 0.01, MT.black, 1.5, 0.777, z, 14)); // cylinder bores
      rbox(d, 0.36, 0.14, 0.6, 0.03, GM.engineD, 1.5, 0.3, 0, 0.02); cylY(d, 0.03, 0.04, GM.chrome, 1.5, 0.21, 0.15, 8); // oil sump + drain plug
      rbox(d, 0.32, 0.18, 0.3, 0.05, MT.black, 1.08, 0.6, -0.45, 0.02); rod(d, new V3(1.18, 0.62, -0.32), new V3(1.36, 0.66, -0.2), 0.05, MT.black);
      [1, -1].forEach((s) => rod(d, new V3(1.5, 0.36, s * 0.3), new V3(FA, WR, s * 0.66), 0.03, GM.engineD)); // drive shafts
      add(d, new THREE.TorusGeometry(0.04, 0.012, 6, 12), GM.yel, 1.74, 0.8, -0.32).rotation.y = Math.PI / 2; // dipstick
    } else {
      rbox(d, 0.5, 0.26, 1.2, 0.05, GM.engineD, 1.45, 0.58, 0, 0.02); rbox(d, 0.4, 0.06, 0.8, 0.02, GM.blue, 1.45, 0.73, 0, 0.01);
      [0.3, -0.3].forEach((z) => rod(d, new V3(1.25, 0.6, z), new V3(0.9, 0.45, z * 1.2), 0.03, GM.orange));
    }
  }
  R.sump = anchor(m, 1.5, 0.19, 0.15); R.hook = anchor(m, 2.13, 0.36, 0); R.engine = anchor(m, 1.5, 0.8, 0.45); R.obd = anchor(m, 0.55, 0.55, HW);
  // battery (it can be lifted out)
  const mv = o.lite ? d : m; R.battery = battery(mv, 1.05, 0.45, 0.47);
  // fuel flap (or charging flap) on the right side
  R.flap = grp(mv, o.ev ? 1.45 : -1.55, o.ev ? 0.72 : 0.82, HW + 0.006); rbox(R.flap, 0.16, 0.16, 0.02, 0.06, B, 0.08, 0, 0, 0.008);
  cylZ(d, 0.05, 0.02, o.ev ? GM.blue : MT.black, o.ev ? 1.53 : -1.47, o.ev ? 0.72 : 0.82, HW - 0.004, 12);
  R.fill = anchor(m, o.ev ? 1.53 : -1.47, o.ev ? 0.72 : 0.82, HW + 0.02);
  // bonnet, hinged near the windscreen
  R.bonnet = grp(mv, 0.86, 0.935, 0); { const b = rbox(R.bonnet, 1.24, 0.05, CW - 0.06, 0.03, B, 0.62, -0.065, 0, 0.02); b.rotation.z = -0.105; }
  if (!o.lite && !o.ev) {
    // engine cover with the yellow oil cap; the four pistons hide under it
    R.cover = grp(m, 1.5, 0.79, 0); rbox(R.cover, 0.44, 0.06, 0.8, 0.03, GM.cover, 0, 0.0, 0, 0.02); rbox(R.cover, 0.2, 0.02, 0.3, 0.01, GM.engine, -0.05, 0.035, -0.1, 0.005);
    cylY(R.cover, 0.055, 0.04, GM.yel, 0.08, 0.03, 0.26, 12); R.cap = anchor(R.cover, 0.08, 0.1, 0.26);
    R.pistons = [-0.3, -0.1, 0.1, 0.3].map((z) => { const pg = grp(m, 1.5, 0.66, z); cylY(pg, 0.075, 0.12, GM.chrome, 0, 0.06, 0, 12); return pg; });
  }
  if (!o.lite) bake(d);
  // wheels in hubs (a hub can droop, or be squashed for a flat tyre)
  R.hubs = []; R.wheels = [];
  [FA, RA].forEach((x) => [1, -1].forEach((s) => {
    const h = grp(o.lite ? d : m, x, WR, s * 0.77); const w = wheel(h, 0, 0, 0, s); R.hubs.push(h); R.wheels.push(w);
  }));
  if (o.lite) bake(d);
  shadows(m); return R;
}
function battery(p, x, y, z) {
  const g = grp(p, x, y, z); rbox(g, 0.26, 0.2, 0.2, 0.03, MT.black, 0, 0.1, 0, 0.01);
  cylY(g, 0.025, 0.04, GM.red, 0.07, 0.22, 0.05, 8); cylY(g, 0.025, 0.04, GM.dark, -0.07, 0.22, 0.05, 8); box(g, 0.2, 0.06, 0.005, GM.green, 0, 0.12, 0.102);
  return g;
}
/** Wheels turn by how far the car really moved (works whatever group the car is in). */
function roller(C) {
  const prev = new V3(), cur = new V3(), f = new V3(); let init = false;
  const fn = () => {
    C.g.getWorldPosition(cur); if (!init || !fn.on) { prev.copy(cur); init = true; return; }
    f.set(1, 0, 0).transformDirection(C.g.matrixWorld); const dd = _d.subVectors(cur, prev).dot(f); prev.copy(cur);
    if (Math.abs(dd) > 1e-5 && Math.abs(dd) < 2) C.wheels.forEach((w) => (w.rotation.z -= dd / WR));
  };
  fn.on = true; return fn;
}
const setFlat = (C, on) => { const h = C.hubs[2]; h.scale.y = on ? 0.78 : 1; h.position.y = on ? WR * 0.78 : WR; };

/* ================= machines ================= */
/** Flatbed tow truck: the bed tilts on its frame and slides back to the ground; a winch at the front pulls the car up. */
function towTruck(st, S) {
  const m = grp(S), d = grp(m), W = GM.white, O = GM.orange;
  [0.45, -0.45].forEach((z) => rbox(d, 6.3, 0.24, 0.14, 0.03, MT.black, -0.9, 0.88, z));
  const cab = truckCab(d, W, 1.0);
  [1, -1].forEach((s) => {
    box(cab, 1.6, 0.14, 0.02, O, 0.82, 0.22, s * 1.112);
    const D = grp(cab); if (s < 0) D.rotation.y = Math.PI; decal(D, 'DÉPANNAGE', 1.1, 0.2, '#e8641a', s * 0.82, 0.55, 1.118, null);
    beacon(st, cab, 0.82, 1.84, s * 0.62);
  });
  rbox(cab, 0.3, 0.07, 1.5, 0.03, MT.black, 0.82, 1.83, 0, 0.01);
  rbox(d, 4.3, 0.14, 1.1, 0.03, GM.greyD, -1.1, 1.08, 0); // subframe
  rbox(d, 0.8, 0.45, 0.42, 0.05, GM.alu, -0.75, 0.68, 0.95, 0.02); box(d, 0.6, 0.03, 0.03, GM.dark, -0.75, 0.84, 1.17); // toolbox
  cylX(d, 0.25, 0.9, GM.alu, -0.75, 0.7, -0.95, 14); // fuel tank
  box(d, 0.03, 0.3, 2.0, GM.chev, -4.06, 0.62, 0); rbox(d, 0.12, 0.1, 2.1, 0.03, MT.black, -4.0, 0.45, 0, 0.01);
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.12, 0.28, 0.02, MT.tail, -4.1, 0.85, s * 0.8, 0.01); rbox(d, 0.04, 0.5, 0.5, 0.02, MT.black, -2.9, 0.55, s * 0.95, 0.01); });
  // tilting frame (pivot at the back of the chassis) and the bed that slides on it
  const tilt = grp(m, -3.1, 1.16, 0); rbox(tilt, 4.2, 0.14, 1.0, 0.03, GM.greyD, 1.9, 0.07, 0, 0.01); cylZ(tilt, 0.09, 1.2, GM.dark, 0, 0.07, 0, 12);
  const bed = grp(tilt, 0, 0.14, 0), bd = grp(bed);
  rbox(bd, 5.9, 0.1, 2.3, 0.03, GM.alu, 0.65, 0.05, 0, 0.01);
  for (let x = -2.0; x < 3.4; x += 0.45) box(bd, 0.05, 0.02, 2.2, GM.greyD, x, 0.105, 0);
  ext(bd, [[-2.3, 0.1], [-2.75, -0.03], [-2.75, -0.07], [-2.3, -0.1]], 0.01, 2.3, GM.alu, 0, 0, 0, 0.01);
  [1, -1].forEach((s) => { rbox(bd, 5.9, 0.24, 0.1, 0.02, O, 0.65, -0.02, s * 1.15, 0.01); [-1.6, 0.5, 2.6].forEach((x) => box(bd, 0.1, 0.05, 0.02, MT.amber, x, 0.0, s * 1.205)); box(bd, 0.04, 0.08, 0.12, MT.tail, -2.31, -0.02, s * 1.0); });
  rbox(bd, 0.12, 0.8, 2.3, 0.03, O, 3.55, 0.45, 0, 0.01); for (let z = -0.9; z <= 0.9; z += 0.3) box(bd, 0.13, 0.5, 0.05, W, 3.55, 0.5, z);
  rbox(bd, 0.3, 0.3, 0.1, 0.02, GM.greyD, 3.25, 0.3, 0.42, 0.01); rbox(bd, 0.3, 0.3, 0.1, 0.02, GM.greyD, 3.25, 0.3, -0.42, 0.01);
  cylZ(bd, 0.13, 0.75, GM.dark, 3.25, 0.3, 0, 14); cylZ(bd, 0.15, 0.5, MT.black, 3.25, 0.3, 0, 14); cylZ(bd, 0.1, 0.3, GM.red, 3.25, 0.3, 0.6, 12);
  bake(bd); bake(d);
  // straps over the four wheels (shown once the car is on)
  const straps = grp(bed); straps.visible = false;
  [1.9, -0.7].forEach((x) => [0.77, -0.77].forEach((z) => rail(straps, [[x - 0.35, 0.11, z], [x - 0.12, 0.62, z], [x + 0.12, 0.62, z], [x + 0.35, 0.11, z]], 0.025, GM.yel)));
  const ram = hydraulic(m, anchor(m, 0.0, 0.85, 0), anchor(tilt, 2.0, 0.0, 0), { barrel: 0.8, mat: GM.greyD, rb: 0.08 });
  const wheels = [];
  const big = (x, z, s, w) => { const t = tire(m, 0.46, w, x, 0.46, z, GM.alloy, s, MT.rubber); freeze(t); t.userData.r = 0.46; wheels.push(t); };
  [1, -1].forEach((s) => { big(1.45, s * 0.98, s, 0.3); big(-2.3, s * 1.0, s, 0.28); big(-2.3, s * 0.7, s, 0.28); fender(m, 0.58, 0.34, 1.45, 0.46, s * 0.98, GM.dark, Math.PI * 0.6); });
  shadows(m);
  return { g: m, wheels, tilt, bed, straps, ram, cab, winch: anchor(bed, 3.25, 0.3, 0) };
}

/** Two-post lift: blue columns, a beam on top, carriages with four swing arms. */
function postLift(S) {
  const g = grp(S), d = grp(g), Z = 1.6, M = GM.lift, D = GM.liftD;
  [1, -1].forEach((s) => {
    rbox(d, 0.44, 3.9, 0.34, 0.04, M, 0, 1.95, s * Z, 0.02); rbox(d, 0.75, 0.05, 0.6, 0.02, GM.dark, 0, 0.025, s * Z, 0.01);
    box(d, 0.14, 3.3, 0.02, GM.dark, 0, 2.1, s * (Z - 0.175)); box(d, 0.45, 0.3, 0.35, MT.stripes, 0, 3.55, s * Z);
    rod(d, new V3(-0.24, 0.3, s * Z), new V3(-0.24, 3.9, s * Z), 0.025, MT.black, 6);
  });
  rbox(d, 0.32, 0.34, 2 * Z + 0.36, 0.04, M, 0, 4.07, 0, 0.02);
  rbox(d, 0.34, 0.55, 0.3, 0.04, GM.dark, -0.42, 1.0, Z, 0.02); cylY(d, 0.1, 0.3, GM.greyD, -0.42, 1.43, Z, 10);
  rbox(d, 0.08, 0.32, 0.22, 0.02, GM.white, 0.25, 1.25, Z, 0.01); sph(d, 0.035, GM.green, 0.3, 1.32, Z); sph(d, 0.035, GM.red, 0.3, 1.18, Z);
  bake(d);
  const car = grp(g), arms = [];
  [1, -1].forEach((s) => {
    const cd = grp(car); rbox(cd, 0.36, 0.7, 0.16, 0.03, D, 0, 0.42, s * (Z - 0.25), 0.02); bake(cd);
    [0.18, -0.18].forEach((px) => {
      const pz = s * (Z - 0.32), a = grp(car, px, 0.12, pz), ad = grp(a);
      cylY(ad, 0.07, 0.14, D, 0, 0, 0, 10); rbox(ad, 1.08, 0.09, 0.15, 0.03, D, 0.54, 0, 0, 0.02); rbox(ad, 0.5, 0.07, 0.11, 0.02, GM.alu, 0.82, 0.01, 0, 0.01);
      cylY(ad, 0.09, 0.07, GM.dark, 1.04, 0.07, 0, 12); cylY(ad, 0.1, 0.03, GM.yel, 1.04, 0.115, 0, 12); bake(ad);
      const rest = px > 0 ? 0 : Math.PI, tx = Math.sign(px) * 1.05, tz = s * 0.62;
      a.rotation.y = rest; arms.push({ a, rest, eng: rest + wrap(Math.atan2(-(tz - pz), tx - px) - rest) });
    });
  });
  shadows(g); return { g, car, arms };
}

/** Scissor lift: two runways that rise on crossed arms. set(h) moves everything. */
function scissorLift(S) {
  const g = grp(S), d = grp(g), Y = GM.yel, X0 = -1.3, LB = 2.6, bars = [], rams = [], runs = [];
  [1, -1].forEach((s) => {
    const z = s * 0.77; rbox(d, 4.0, 0.06, 0.56, 0.02, GM.dark, 0, 0.03, z, 0.01);
    const r = grp(g, 0, 0.14, z), rd = grp(r);
    rbox(rd, 4.4, 0.12, 0.56, 0.03, Y, 0, 0.06, 0, 0.01); [0.28, -0.28].forEach((zz) => rbox(rd, 4.4, 0.07, 0.04, 0.01, GM.yelD, 0, 0.15, zz, 0.01));
    [2.4, -2.4].forEach((x) => { ext(rd, [[0, 0], [0, 0.12], [Math.sign(x) * 0.4, 0]].map(([a, b]) => [x + a - Math.sign(x) * 0.2, b]), 0.01, 0.5, Y, 0, 0, 0, 0.01); });
    box(rd, 0.3, 0.125, 0.57, MT.stripes, 2.05, 0.06, 0); box(rd, 0.3, 0.125, 0.57, MT.stripes, -2.05, 0.06, 0);
    bake(rd); runs.push(r);
    [0.12, -0.12].forEach((dz, i) => { const b = add(g, new THREE.BoxGeometry(1, 0.09, 0.06), GM.yelD); b.position.z = z + dz; bars.push({ b, up: i === 0 }); });
    const A = anchor(g, X0 + 2.2, 0.1, z), Bk = anchor(g, 0, 0, z); rams.push({ h: hydraulic(g, A, Bk, { barrel: 0.5, mat: GM.dark, rb: 0.06 }), Bk });
  });
  bake(d);
  let H = -1;
  const set = (h) => {
    if (h === H) return; H = h; const th = Math.asin(clamp(h / LB, 0, 0.95)), c = LB * Math.cos(th);
    runs.forEach((r) => (r.position.y = 0.14 + h));
    bars.forEach(({ b, up }) => { b.scale.x = LB; b.position.x = X0 + c / 2; b.position.y = 0.1 + h / 2; b.rotation.z = up ? th : -th; });
    rams.forEach(({ h: hy, Bk }) => { Bk.position.x = X0 + c * 0.6; Bk.position.y = 0.1 + h * 0.6; hy.update(); });
  };
  set(0); shadows(g); return { g, set, top: (h) => 0.26 + h };
}

/** Oil drain caddy: a tank on castors with a telescopic funnel. */
function oilCaddy(p) {
  const g = grp(p), d = grp(g);
  rbox(d, 0.7, 0.06, 0.7, 0.03, GM.dark, 0, 0.13, 0, 0.01); [[0.28, 0.28], [0.28, -0.28], [-0.28, 0.28], [-0.28, -0.28]].forEach(([x, z]) => cylZ(d, 0.06, 0.05, MT.black, x, 0.06, z, 10));
  cylY(d, 0.3, 0.72, GM.yel, 0, 0.52, 0, 20); cylY(d, 0.31, 0.04, GM.dark, 0, 0.88, 0, 20); cylY(d, 0.31, 0.04, GM.dark, 0, 0.2, 0, 20);
  box(d, 0.03, 0.5, 0.06, GM.glassT, 0, 0.55, 0.3); rod(d, new V3(-0.3, 0.75, 0), new V3(-0.5, 1.15, 0), 0.025, GM.greyD); rod(d, new V3(-0.5, 1.15, 0.2), new V3(-0.5, 1.15, -0.2), 0.03, MT.black);
  bake(d);
  const tube = grp(g, 0, 0.95, 0); cylY(tube, 0.045, 0.7, GM.greyD, 0, -0.35, 0, 10);
  add(tube, new THREE.CylinderGeometry(0.36, 0.06, 0.26, 20, 1, true), std(0xd89a14, 0.45, 0.1, { side: THREE.DoubleSide }), 0, 0.13, 0);
  add(tube, new THREE.TorusGeometry(0.36, 0.02, 6, 24), GM.dark, 0, 0.26, 0).rotation.x = Math.PI / 2;
  shadows(g); return { g, tube };
}
/** Rolling tool chest (servante). */
function toolChest(p, x, z, M = GM.red) {
  const g = grp(p, x, 0, z); rbox(g, 0.75, 0.8, 0.5, 0.03, M, 0, 0.5, 0, 0.01);
  for (let i = 0; i < 4; i++) { box(g, 0.7, 0.012, 0.01, GM.dark, 0, 0.27 + i * 0.17, 0.252); box(g, 0.3, 0.025, 0.03, GM.chrome, 0, 0.33 + i * 0.17, 0.26); }
  rbox(g, 0.78, 0.05, 0.53, 0.02, GM.dark, 0, 0.92, 0, 0.01); [[0.3, 0.2], [0.3, -0.2], [-0.3, 0.2], [-0.3, -0.2]].forEach(([a, b]) => cylZ(g, 0.05, 0.04, MT.black, a, 0.05, b, 8));
  rod(g, new V3(-0.38, 0.85, 0.2), new V3(-0.48, 0.85, 0.2), 0.02, GM.chrome); rod(g, new V3(-0.38, 0.85, -0.2), new V3(-0.48, 0.85, -0.2), 0.02, GM.chrome); rod(g, new V3(-0.48, 0.85, 0.2), new V3(-0.48, 0.85, -0.2), 0.02, GM.chrome);
  return g;
}
/** Yellow oil can with a spout pointing +x. */
function oilCan(p) {
  const g = grp(p); rbox(g, 0.24, 0.3, 0.12, 0.04, GM.yel, 0, 0.15, 0, 0.01); rbox(g, 0.12, 0.05, 0.04, 0.02, MT.black, -0.04, 0.33, 0, 0.01);
  rod(g, new V3(0.08, 0.28, 0), new V3(0.2, 0.36, 0), 0.025, MT.black); box(g, 0.16, 0.1, 0.005, GM.white, 0, 0.14, 0.062);
  g.userData.spout = anchor(g, 0.22, 0.37, 0); return g;
}
/** Tyre changer: cabinet, turntable with jaws, a column with the mounting head, a bead breaker, pedals and an air gauge. */
function tyreChanger(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g), M = GM.machine;
  rbox(d, 0.95, 0.85, 0.8, 0.05, M, 0, 0.43, 0, 0.02); box(d, 0.96, 0.08, 0.81, GM.dark, 0, 0.04, 0);
  [-0.2, 0, 0.2].forEach((z) => rbox(d, 0.18, 0.05, 0.1, 0.02, GM.dark, 0.52, 0.06, z, 0.01)); // pedals
  rbox(d, 0.22, 1.35, 0.22, 0.04, M, -0.55, 1.5, 0, 0.02); rbox(d, 0.9, 0.14, 0.14, 0.03, M, -0.15, 2.14, 0, 0.01);
  rbox(d, 0.1, 0.5, 0.08, 0.02, GM.dark, 0.45, 0.55, 0.42, 0.01); rbox(d, 0.5, 0.06, 0.06, 0.02, GM.dark, 0.25, 0.45, 0.46, 0.01); rbox(d, 0.04, 0.22, 0.2, 0.02, GM.alu, 0.0, 0.45, 0.48, 0.01); // bead breaker
  cylZ(d, 0.09, 0.03, GM.white, 0.3, 1.2, 0.41, 16); cylZ(d, 0.095, 0.02, MT.black, 0.3, 1.2, 0.4, 16); rod(d, new V3(0.3, 1.1, 0.4), new V3(0.4, 0.6, 0.42), 0.015, MT.black); // air gauge
  bake(d);
  const tt = grp(g, 0, 0.87, 0); cylY(tt, 0.46, 0.05, GM.dark, 0, 0.02, 0, 24); cylY(tt, 0.12, 0.1, GM.alu, 0, 0.07, 0, 14);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; rbox(tt, 0.12, 0.07, 0.07, 0.02, GM.alu, Math.cos(a) * 0.3, 0.07, Math.sin(a) * 0.3, 0.01); }
  const head = grp(g, 0.2, 2.0, 0); rbox(head, 0.08, 0.55, 0.08, 0.02, GM.alu, 0, -0.25, 0, 0.01); rbox(head, 0.14, 0.1, 0.12, 0.03, MT.black, 0.04, -0.5, 0, 0.01);
  shadows(g); return { g, tt, head };
}
/** Wheel balancer: cabinet, shaft for the wheel, a hood that closes over it, a display with two lights. */
function balancer(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g), M = GM.machine;
  rbox(d, 0.9, 0.95, 0.6, 0.05, M, 0, 0.48, -0.1, 0.02); rbox(d, 0.92, 0.06, 0.62, 0.02, GM.dark, 0, 0.98, -0.1, 0.01);
  for (let i = 0; i < 5; i++) box(d, 0.1, 0.03, 0.12, GM.greyD, -0.32 + i * 0.13, 1.02, -0.25); // weights tray
  rbox(d, 0.5, 0.36, 0.06, 0.03, GM.dark, 0, 1.3, -0.35, 0.01); rod(d, new V3(0, 1.0, -0.35), new V3(0, 1.12, -0.35), 0.04, GM.dark);
  cylZ(d, 0.03, 0.55, GM.chrome, 0, 0.75, 0.42, 10); cylZ(d, 0.08, 0.1, GM.dark, 0, 0.75, 0.24, 14);
  bake(d);
  const disp = std(0xff4a3a, 0.3, 0, { emissive: 0xd8201a, emissiveIntensity: 0.25 });
  [-0.12, 0.12].forEach((xx) => rbox(g, 0.16, 0.12, 0.02, 0.02, disp, xx, 1.33, -0.31, 0.005));
  const hood = grp(g, 0, 1.05, 0.2); add(hood, (() => { const geo = new THREE.CylinderGeometry(0.48, 0.48, 0.34, 18, 1, true, -Math.PI / 2, Math.PI); geo.rotateX(-Math.PI / 2); return geo; })(), std(0x9aa1ae, 0.4, 0.4, { side: THREE.DoubleSide }), 0, -0.3, 0.38);
  hood.rotation.x = -1.3;
  shadows(g); return { g, hood, disp, shaft: anchor(g, 0, 0.75, 0.6) };
}
/** Diagnostic trolley with its computer. */
function diagCart(p) {
  const g = grp(p), d = grp(g), B = GM.blue;
  rbox(d, 0.6, 0.05, 0.45, 0.02, GM.dark, 0, 0.15, 0, 0.01); [[0.24, 0.18], [0.24, -0.18], [-0.24, 0.18], [-0.24, -0.18]].forEach(([x, z]) => cylZ(d, 0.05, 0.04, MT.black, x, 0.06, z, 8));
  cylY(d, 0.035, 1.05, GM.grey, -0.18, 0.68, 0, 8); rbox(d, 0.56, 0.04, 0.42, 0.02, B, 0, 0.55, 0, 0.01); rbox(d, 0.4, 0.2, 0.3, 0.03, GM.dark, 0, 0.67, 0, 0.01);
  rbox(d, 0.5, 0.04, 0.36, 0.02, B, 0.02, 1.02, 0.02, 0.01); rbox(d, 0.38, 0.02, 0.16, 0.01, GM.dark, 0.04, 1.05, 0.08, 0.005);
  rbox(d, 0.6, 0.42, 0.05, 0.02, GM.dark, 0, 1.36, -0.13, 0.01); rod(d, new V3(0.28, 1.0, -0.2), new V3(0.4, 1.0, -0.2), 0.02, GM.grey);
  add(d, new THREE.TorusGeometry(0.1, 0.015, 6, 14), MT.black, -0.24, 0.85, 0.05).rotation.y = Math.PI / 2; // coiled cable
  bake(d);
  const sm = new THREE.MeshBasicMaterial({ map: SCR.off }); add(g, new THREE.PlaneGeometry(0.52, 0.33), sm, 0, 1.36, -0.104);
  shadows(g); return { g, sm, plug: anchor(g, -0.24, 0.85, 0.1) };
}
/** Headlight tester (régloscope): an optical box on a column that slides along a floor rail. */
function reglo(p, x) {
  const g = grp(p, x, 0, 0), d = grp(g);
  [0.14, -0.14].forEach((xx) => box(d, 0.06, 0.04, 3.2, GM.greyD, xx, 0.02, 0)); bake(d);
  const col = grp(g, 0, 0, 1.4), cd = grp(col);
  rbox(cd, 0.5, 0.1, 0.5, 0.03, GM.dark, 0, 0.08, 0, 0.01); cylY(cd, 0.05, 1.3, GM.grey, 0.1, 0.75, 0, 10);
  rbox(cd, 0.5, 0.36, 0.42, 0.06, GM.yel, -0.05, 0.74, 0, 0.02); cylX(cd, 0.16, 0.05, MT.black, -0.32, 0.74, 0, 18); cylX(cd, 0.13, 0.06, GM.glassT, -0.33, 0.74, 0, 18);
  const v = rbox(cd, 0.28, 0.02, 0.3, 0.01, MT.chrome, 0.0, 1.0, 0, 0.005); v.rotation.z = 0.5; bake(cd);
  const sm = new THREE.MeshBasicMaterial({ map: SCR.off }); add(col, new THREE.PlaneGeometry(0.34, 0.22), sm, -0.05, 0.76, 0.215);
  shadows(g); return { g, col, sm };
}
/** Car-wash gantry: white columns, two side brushes, a top brush that follows the car, a foam arch and a dryer. */
const BRUSH_G = new THREE.CylinderGeometry(0.45, 0.45, 1.8, 20);
const TOPB_G = (() => { const g = new THREE.CylinderGeometry(0.42, 0.42, 2.0, 20); g.rotateX(Math.PI / 2); return g; })();
function washGantry(S) {
  const g = grp(S), d = grp(g), Z = 1.95, B = GM.blue, W = GM.white;
  [1, -1].forEach((s) => {
    rbox(d, 0.5, 3.1, 0.36, 0.05, W, 0, 1.55, s * Z, 0.02); rbox(d, 0.52, 0.5, 0.38, 0.05, B, 0, 2.9, s * Z, 0.02);
    rbox(d, 0.8, 0.14, 0.42, 0.03, GM.dark, 0, 0.07, s * Z, 0.01); box(d, 0.53, 0.1, 0.39, MT.stripes, 0, 0.3, s * Z);
    for (let y = 0.5; y < 2.5; y += 0.4) sph(d, 0.04, GM.dark, 0.3, y, s * (Z - 0.2));
    rbox(d, 0.4, 2.4, 0.1, 0.03, B, -0.36, 1.6, s * (Z - 0.12), 0.01); // dryer side nozzle
  });
  rbox(d, 0.6, 0.45, 2 * Z + 0.36, 0.06, B, 0, 3.25, 0, 0.02);
  rail(d, [[0.32, 0.4, Z - 0.2], [0.32, 2.85, Z - 0.2], [0.32, 2.85, -(Z - 0.2)], [0.32, 0.4, -(Z - 0.2)]], 0.03, GM.greyD); // foam arch
  for (let z = -1.4; z <= 1.4; z += 0.35) sph(d, 0.045, GM.dark, 0.32, 2.82, z);
  rbox(d, 0.5, 0.32, 2.6, 0.06, B, -0.42, 2.75, 0, 0.02); for (let z = -1.1; z <= 1.1; z += 0.22) box(d, 0.3, 0.02, 0.1, GM.dark, -0.42, 2.585, z); // dryer
  bake(d);
  const sb = [1, -1].map((s) => {
    const a = grp(g, 0.05, 0, s * 1.5); rod(a, new V3(0, 2.0, 0), new V3(0, 3.05, 0), 0.05, GM.greyD);
    const br = grp(a); add(br, BRUSH_G, GM.brush, 0, 1.1, 0); cylY(br, 0.47, 0.06, B, 0, 2.03, 0, 18); return { a, br, s };
  });
  const tb = grp(g, 0.05, 2.45, 0), tbr = grp(tb); add(tbr, TOPB_G, GM.brush); cylZ(tb, 0.05, 2.5, GM.greyD, 0, 0, 0, 8);
  [1.27, -1.27].forEach((z) => rbox(tb, 0.16, 0.16, 0.06, 0.02, B, 0, 0, z, 0.01));
  shadows(g); return { g, sb, tb, tbr, foam: anchor(g, 0.4, 2.9, 1.2), dryer: anchor(g, -0.42, 2.6, 1.2) };
}
/** Top of the car body at local x (for the brush to follow). */
function carTop(x) {
  if (x > 2.1 || x < -2.1) return 0; if (x > 1.98) return 0.7; if (x > 0.86) return 0.81 + ((1.98 - x) / 1.12) * 0.12;
  if (x > 0) return 0.93 + ((0.86 - x) / 0.86) * 0.55; if (x > -1.42) return 1.49; if (x > -1.98) return 1.49 - ((-1.42 - x) / 0.56) * 0.5; return 0.95;
}
/** Fuel pump with its display, two nozzles and a hose. */
function fuelPump(p, x, z) {
  const g = grp(p, x, 0, z), d = grp(g);
  rbox(d, 0.75, 1.7, 0.48, 0.06, GM.white, 0, 1.03, 0, 0.02); rbox(d, 0.78, 0.32, 0.5, 0.05, GM.green, 0, 2.02, 0, 0.02); box(d, 0.76, 0.1, 0.49, GM.green, 0, 0.5, 0);
  rbox(d, 0.6, 0.34, 0.03, 0.03, GM.dark, 0, 1.45, 0.24, 0.01); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) box(d, 0.06, 0.04, 0.02, GM.grey, -0.1 + i * 0.1, 1.08 + j * 0.07, 0.245);
  rbox(d, 0.08, 0.24, 0.14, 0.02, GM.dark, 0.39, 1.12, 0.12, 0.01); rbox(d, 0.08, 0.24, 0.14, 0.02, GM.dark, 0.39, 1.12, -0.12, 0.01);
  cylY(d, 0.04, 0.08, GM.dark, 0.3, 1.9, 0.12, 8); cylY(d, 0.04, 0.08, GM.dark, 0.3, 1.9, -0.12, 8);
  const n2 = nozzle(d, GM.yel); n2.position.set(0.44, 1.15, -0.12); rod(d, new V3(0.3, 1.9, -0.12), new V3(0.55, 0.9, -0.2), 0.03, MT.black, 6); rod(d, new V3(0.55, 0.9, -0.2), new V3(0.46, 1.3, -0.12), 0.03, MT.black, 6);
  { const t = decal(d, 'CARBURANT', 0.6, 0.14, '#ffffff', 0, 2.02, 0.255, null); void t; }
  bake(d);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const cx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv);
  const draw = (v) => { cx.fillStyle = '#0d1a10'; cx.fillRect(0, 0, 128, 64); cx.fillStyle = '#5aff7a'; cx.font = '900 30px monospace'; cx.textAlign = 'right'; cx.fillText(v.toFixed(1), 104, 32); cx.font = '900 18px monospace'; cx.fillText('L', 124, 32); cx.fillStyle = '#3a8a4a'; cx.fillRect(10, 44, 108 * Math.min(1, v / 40), 10); tex.needsUpdate = true; };
  draw(0); add(g, new THREE.PlaneGeometry(0.52, 0.26), new THREE.MeshBasicMaterial({ map: tex }), 0, 1.45, 0.258);
  const noz = nozzle(g, GM.green); noz.position.set(0.44, 1.15, 0.12);
  shadows(g); return { g, noz, home: noz.position.clone(), out: anchor(g, 0.3, 1.94, 0.12), draw };
}
/** Pump nozzle: spout along −y, hose end at +y. */
function nozzle(p, gripM) {
  const n = grp(p); rbox(n, 0.07, 0.24, 0.08, 0.02, GM.dark, 0, 0.04, 0, 0.01); rbox(n, 0.075, 0.1, 0.085, 0.02, gripM, 0, 0.1, 0, 0.01);
  rod(n, new V3(0, -0.07, 0), new V3(0, -0.26, 0), 0.018, GM.chrome); rbox(n, 0.02, 0.12, 0.1, 0.01, GM.dark, 0.05, -0.0, 0, 0.005);
  n.userData.tail = anchor(n, 0, 0.17, 0); return n;
}
/** EV charging post with a green light ring and a charge bar. */
function chargePost(p, x, z) {
  const g = grp(p, x, 0, z), d = grp(g);
  rbox(d, 0.5, 0.08, 0.4, 0.02, GM.conc, 0, 0.04, 0, 0.01); rbox(d, 0.38, 1.6, 0.28, 0.08, GM.white, 0, 0.88, 0, 0.02); rbox(d, 0.39, 0.22, 0.29, 0.06, GM.green, 0, 1.6, 0, 0.02);
  rbox(d, 0.26, 0.18, 0.02, 0.02, GM.dark, 0, 1.28, 0.14, 0.005); rbox(d, 0.1, 0.12, 0.08, 0.02, GM.dark, 0.2, 0.85, 0.0, 0.01);
  bake(d);
  const ring = led(); add(g, new THREE.TorusGeometry(0.08, 0.018, 6, 20), ring, 0, 1.02, 0.145);
  const bar = box(g, 0.2, 0.08, 0.01, std(0x5aff7a, 0.3, 0, { emissive: 0x2ad04a, emissiveIntensity: 0.8 }), -0.1, 1.28, 0.152); bar.geometry = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0); bar.scale.x = 0.05;
  shadows(g); return { g, ring, bar, out: anchor(g, 0.24, 0.85, 0) };
}

/* ================= data ================= */
const DATA = {
  depanneuse: { short: 'La dépanneuse', full: 'La dépanneuse à plateau', verb: 'Dépanner', horn: 'horn',
    use: 'Elle vient chercher les voitures en panne, pour les amener au garage.',
    how: "Son plateau penche et glisse jusqu'au sol. Un treuil tire la voiture avec un câble, pour la faire monter dessus." },
  pont: { short: 'Le pont élévateur', full: 'Le pont élévateur', verb: 'Soulever', horn: 'bell',
    use: 'Il soulève la voiture très haut, pour regarder dessous.',
    how: 'Ses bras glissent sous la voiture, puis ils montent le long des deux colonnes. Le mécanicien peut marcher dessous !' },
  vidange: { short: 'La vidange', full: 'La vidange du moteur', verb: 'Vidanger', horn: 'horn',
    use: "On change l'huile du moteur, pour qu'il reste en bonne santé.",
    how: "La vieille huile noire coule dans un grand entonnoir. Puis on verse de l'huile toute neuve dans le moteur." },
  pneus: { short: 'Les pneus', full: "Le démonte-pneu et l'équilibreuse", verb: 'Réparer', horn: 'bell',
    use: 'Deux machines pour changer un pneu crevé.',
    how: "Le démonte-pneu enlève le vieux pneu de la roue. L'équilibreuse fait tourner la roue très vite, pour vérifier qu'elle ne tremble pas." },
  diagnostic: { short: 'Le diagnostic', full: "L'ordinateur de diagnostic", verb: 'Chercher', horn: 'bell',
    use: 'Il parle avec la voiture, pour savoir ce qui ne va pas.',
    how: "On le branche sur la voiture avec un câble. Ici, il trouve que la batterie est fatiguée. Puis on vérifie les phares." },
  lavage: { short: 'Le lavage', full: 'Le portique de lavage', verb: 'Laver', horn: 'bell',
    use: 'Il lave la voiture tout seul, comme dans un grand bain.',
    how: "Il passe au-dessus de la voiture : de la mousse, de grosses brosses qui tournent, de l'eau pour rincer et du vent pour sécher." },
  station: { short: 'La station-service', full: 'La station-service', verb: 'Faire le plein', horn: 'horn',
    use: 'On y remplit le réservoir de la voiture. Et les voitures électriques se rechargent à la borne.',
    how: "Le pistolet de la pompe fait couler le carburant dans le réservoir. La borne donne de l'électricité à la batterie." }
};
const ORDER = ['depanneuse', 'pont', 'pneus', 'vidange', 'diagnostic', 'lavage', 'station'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const RD = '#d83a2a', BL = '#2f6fd8', IN = '#2a2f40';
const CAR = (x, y, s = 1, col = RD) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 18q0-7 7-8l12-1 10-9h22l11 9h6q6 1 6 8v6H0z" fill="${col}"/><path d="M31 3h9v6H23zM43 3h7l9 6H43z" fill="#9fd2ef"/><circle class="k" cx="15" cy="24" r="6"/><circle class="k" cx="56" cy="24" r="6"/><circle class="s" cx="15" cy="24" r="2.5"/><circle class="s" cx="56" cy="24" r="2.5"/></g>`;
const ICONS = {
  depanneuse: GND + `<rect x="4" y="46" width="84" height="7" rx="2" fill="#f2781c"/><rect x="86" y="26" width="28" height="34" rx="4" fill="#f3f4f7" stroke="#c9ccd8" stroke-width="1.5"/><rect class="g" x="98" y="31" width="13" height="11" rx="2"/><rect x="92" y="20" width="16" height="5" rx="2" fill="#f6b21a"/><rect x="4" y="53" width="110" height="7" rx="2" fill="${IN}"/>` + CAR(14, 16, 0.92) + `<circle class="k" cx="22" cy="66" r="8"/><circle class="k" cx="42" cy="66" r="8"/><circle class="k" cx="100" cy="66" r="8"/>`,
  pont: GND + `<rect x="14" y="8" width="9" height="67" rx="2" fill="${BL}"/><rect x="97" y="8" width="9" height="67" rx="2" fill="${BL}"/><rect x="14" y="6" width="92" height="6" rx="2" fill="${BL}"/>` + CAR(25, 18, 1) + `<path d="M23 46h20M97 46H80" stroke="#1f4aa0" stroke-width="4" stroke-linecap="round"/><rect x="50" y="56" width="10" height="19" rx="4" fill="#2f5fb8"/><circle cx="55" cy="52" r="5" fill="#f0c39a"/>`,
  pneus: GND + `<rect x="10" y="38" width="40" height="37" rx="4" fill="${RD}"/><rect x="10" y="10" width="8" height="30" fill="${RD}"/><rect x="10" y="10" width="34" height="6" fill="${RD}"/><ellipse cx="30" cy="35" rx="20" ry="6" class="k"/><ellipse cx="30" cy="34" rx="9" ry="3" class="s"/>
    <rect x="66" y="40" width="44" height="35" rx="4" fill="${RD}"/><circle class="k" cx="88" cy="38" r="17"/><circle class="s" cx="88" cy="38" r="9"/><circle cx="88" cy="38" r="3" fill="${IN}"/><rect x="74" y="18" width="12" height="7" rx="1" fill="#5aff7a"/>`,
  vidange: GND + CAR(18, 18, 1.1, '#2f6fd8') + `<path d="M64 20l22-18" stroke="#2f6fd8" stroke-width="5" stroke-linecap="round"/><path d="M40 52h26l-9 10h-8z" fill="#f2c21c"/><rect x="50" y="62" width="6" height="13" fill="#6a707c"/><path d="M53 44q-3 4 0 6 3-2 0-6z" fill="#14120f"/>`,
  diagnostic: GND + CAR(4, 30, 0.95) + `<rect x="78" y="12" width="36" height="24" rx="3" fill="${IN}"/><rect x="82" y="16" width="28" height="16" rx="2" fill="#c8302a"/><rect x="88" y="20" width="14" height="8" rx="1" fill="none" stroke="#fff" stroke-width="2"/><rect x="102" y="22" width="3" height="4" fill="#fff"/><rect x="94" y="36" width="4" height="30" fill="#b8bcc6"/><rect x="84" y="64" width="24" height="5" rx="2" fill="${IN}"/><path d="M78 50q-8 4-14 2" stroke="${IN}" stroke-width="2.5" fill="none"/>`,
  lavage: GND + `<rect x="8" y="6" width="8" height="69" rx="2" fill="#f3f4f7" stroke="#c9ccd8"/><rect x="104" y="6" width="8" height="69" rx="2" fill="#f3f4f7" stroke="#c9ccd8"/><rect x="8" y="4" width="104" height="8" rx="2" fill="${BL}"/><rect x="18" y="20" width="12" height="52" rx="6" fill="#7aa8ff"/><rect x="90" y="20" width="12" height="52" rx="6" fill="#7aa8ff"/>` + CAR(26, 44, 0.95) + `<g fill="#fff" stroke="#9fc4ff" stroke-width="1.5"><circle cx="50" cy="34" r="5"/><circle cx="62" cy="28" r="4"/><circle cx="72" cy="36" r="5"/><circle cx="40" cy="26" r="3"/></g>`,
  station: GND + `<rect x="10" y="20" width="26" height="55" rx="3" fill="#f3f4f7" stroke="#c9ccd8" stroke-width="1.5"/><rect x="10" y="16" width="26" height="9" rx="2" fill="#2fa05a"/><rect x="14" y="30" width="18" height="10" rx="1" fill="#0d1a10"/><rect x="16" y="33" width="12" height="4" fill="#5aff7a"/><path d="M36 34q16 2 18 18" stroke="${IN}" stroke-width="3" fill="none"/><rect x="50" y="48" width="8" height="10" rx="2" fill="#2fa05a"/>` + CAR(46, 44, 0.95)
};

const CFG = {
  depanneuse: CF(-12, 12.6), pont: CF(-20.5, -9), vidange: CF(-9.5, -9), pneus: CF(0.5, -9.8), diagnostic: CF(10.5, -9),
  lavage: CF(27, -8.5), station: CF(26, 6.5)
};
const GR = [], GB = [];
const rect = (h, d, len, wid, col, al = 1) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
rect(-1, 3.4, 80, 13, '#8a8880'); // forecourt
rect(0, 16, 104, 10, '#4a4e5c'); for (let h = -50; h < 50; h += 5) rect(h, 17.8, 2.4, 0.2, '#f3efe2'); rect(0, 14.2, 104, 0.12, '#f3efe2');
for (let h = -46; h < 46; h += 6) rect(h, 12.5, 0.12, 2.6, '#d8d4c8', 0.7);
rect(0, 10.3, 104, 1.5, '#cfc9bb'); rect(0, 21.8, 104, 1.6, '#cfc9bb'); rect(0, 9.55, 104, 0.15, '#9a968a'); rect(0, 21.0, 104, 0.15, '#9a968a');
[14, -38].forEach((h) => { for (let k = -4; k <= 4; k++) rect(h, 16 + k * 1.1, 2.6, 0.55, '#f3efe2', 0.95); });
rect(-5.25, -9.3, 43.6, 12.8, '#c8c4b8'); [-14.75, -4.5, 5.5].forEach((h) => rect(h, -9.3, 0.15, 12.6, '#f2c21c'));
rect(-20.5, -9, 6, 4.4, '#b0aca0', 0.8); rect(-9.5, -9, 5.4, 2.6, '#b0aca0', 0.8);
rect(27, -8, 15, 11, '#9aa6b8'); rect(27, -8.5, 9, 0.3, '#5a6270'); rect(-32.75, -8.5, 9.6, 9.2, '#e6d6bc');
rect(26, 4.6, 16, 9.6, '#a09c92'); rect(31.5, 3.5, 5.4, 2.8, '#3aa46a', 0.75);
[-36.5, -31.5, -26.5].forEach((h) => rect(h, 4.6, 0.12, 5, '#f3efe2'));
blob(-20.5, -9.5, 1.4, 'rgba(30,30,40,.35)'); blob(-9, -8.6, 1.1, 'rgba(30,30,40,.4)'); blob(12, -8.5, 0.9, 'rgba(30,30,40,.3)'); blob(26, 6, 1.2, 'rgba(30,30,40,.3)');

export default {
  id: 'garage', title: 'Le Garage', titleHtml: 'Le <span>Garage</span>',
  subtitle: "La voiture de la famille est en panne. La dépanneuse l'amène au garage, et tout le monde l'aide à repartir !",
  welcome: 'Bienvenue au garage ! Touche une machine pour voir comment on répare la voiture.',
  hint: 'Touche une machine pour la découvrir.', backLabel: 'Tout le garage',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l2-6 4-1 3-5h8l4 5 3 1v6z"/><circle cx="10" cy="21" r="3"/><circle cx="23" cy="21" r="3"/><path d="M6 27h20"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 50, tufts: false,
  forest: { dark: [0x1d4a2a, 0x245a30, 0x183c26, 0x2a5a36], bush: [0x3f8a3a, 0x4a9a42, 0x357a32] },
  overview: { w: 84, h: 58, focus: [2, 2, 2] },
  ground: { base: ['#93b874', '#7aa25e', '#557a44'], rects: GR, blobs: GB },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 220); onUpdate((dt) => fx.update(dt));
    { const s = buildGarage(grp(scene)); shadows(s); freeze(s); }
    const puff = (o, n = 3, col = 0xd8dce6) => { const p = wp(o); for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.1, 0.1), 0, rnd(-0.1, 0.1))), new V3(rnd(-0.3, 0.3), rnd(0.3, 0.7), rnd(-0.3, 0.3)), rnd(0.15, 0.3), col, 1.3); };
    const crank = () => { for (let i = 0; i < 3; i++) { tone(70, i * 0.42, 0.3, 'sawtooth', 0.05, 95); } };
    const hiss = (d = 1) => tone(3200, 0, d, 'sawtooth', 0.006, 2600);
    const hum = (d = 4) => tone(115, 0, d, 'sawtooth', 0.022, 135);

    /* ---- la dépanneuse ---- */
    (function () {
      const st = makeStation('depanneuse'), S = st.g;
      const T = towTruck(st, S), m = T.g; st.m = m; st.wheels = T.wheels; m.position.x = 12; st.lastX = 12;
      const am = MT.amber.clone(), C = car(S, { amber: am }), CX = -11; C.g.position.x = CX; setFlat(C, true); const spinC = roller(C);
      const dad = P(S, -10.6, -1.7, { top: 0x3aa46a, bottom: 0x2a3550 }); dad.rotation.y = -Math.PI / 2;
      const kid = P(S, -9.8, -1.6, { top: 0xf2b21c, bottom: 0xe5452c, kid: true }); kid.rotation.y = -Math.PI / 2; kid.userData.arms[1].rotation.z = 0.5;
      { const tri = grp(S, -15, 0, 0.3); tri.rotation.y = 0.5; ext(tri, [[-0.26, 0.05], [0.26, 0.05], [0, 0.5]], 0.02, 0.03, GM.red, 0, 0, 0, 0.01); ext(tri, [[-0.14, 0.12], [0.14, 0.12], [0, 0.36]], 0.01, 0.04, GM.white, 0, 0, 0, 0.01); rod(tri, new V3(0, 0.05, 0), new V3(0, 0, -0.2), 0.01, GM.dark); }
      const TILT = 0.24, SLIDE = -2.63, cable = line(S, 0.022, MT.black);
      part(st, 'pneu', 'le pneu crevé', anchor(C.hubs[2], 0, 0.2, 0.12), true);
      part(st, 'plateau', 'le plateau', anchor(T.bed, -1.2, 0.2, 1.2), true);
      part(st, 'treuil', 'le treuil', anchor(T.bed, 3.25, 0.5, 0.4), false);
      part(st, 'gyro', 'les gyrophares', anchor(T.cab, 0.82, 2.0, 0.62), false);
      st.focus = new V3(-1.2, 1.6, 0); st.size = { w: 28, h: 9 }; st.tagAt = anchor(S, 1, 4.4, 0);
      let T0 = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt); spinC(); T.ram.update(); if (cable.g.visible) cable.set(wp(T.winch), wp(C.hook));
        am.emissiveIntensity = !st.done && Math.sin(T0 * 6) > 0 ? 1.6 : 0.3;
      };
      st.action = async function () {
        if (st.done) {
          S.attach(C.g); C.g.position.set(CX, 0, 0); C.g.rotation.set(0, 0, 0); T.straps.visible = false; spinC.on = true;
          T.tilt.rotation.z = 0; T.bed.position.x = 0; m.position.x = 12; st.lastX = 12; st.done = false; await Promise.all([step('La voiture attend encore au bord de la route.', 'pneu'), sleep(0.6)]);
        }
        await step('Oh non ! La voiture de la famille a un pneu crevé. Elle ne peut plus rouler.', 'pneu');
        engineOn(70); st.reversing = true;
        await Promise.all([step('La dépanneuse arrive, avec ses gyrophares orange. Elle recule tout doucement.', 'gyro'), to(m.position, 'x', 0, 5, easeSine)]);
        st.reversing = false;
        await Promise.all([step("Le plateau penche, et il glisse vers l'arrière jusqu'au sol.", 'plateau'), (async () => { await to(T.tilt.rotation, 'z', TILT, 2, easeSine); await to(T.bed.position, 'x', SLIDE, 2.4, easeSine); })()]);
        thud(); cable.g.visible = true;
        await Promise.all([step('Le treuil tire la voiture avec son câble. Elle monte sur le plateau !', 'treuil'), tone(160, 0, 5.5, 'square', 0.012, 150), (async () => {
          await to(C.g.position, 'x', CX + 1.3, 1.4, easeSine);
          T.bed.attach(C.g); const p0 = C.g.position.clone(), r0 = C.g.rotation.z;
          await tw(4.5, (k) => { const a = clamp(k / 0.3, 0, 1); C.g.position.set(p0.x + (0.6 - p0.x) * k, p0.y + (0.115 - p0.y) * a, 0); C.g.rotation.z = r0 * (1 - a); }, easeSine);
        })()]);
        cable.g.visible = false; spinC.on = false; ding(); T.straps.visible = true;
        await Promise.all([step('Le plateau remonte, et on attache bien les roues avec des sangles.', 'plateau'), (async () => { await to(T.bed.position, 'x', 0, 2.4, easeSine); await to(T.tilt.rotation, 'z', 0, 2, easeSine); })()]);
        await Promise.all([step('En route pour le garage !', 'gyro'), to(m.position, 'x', 13, 4, easeIn)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le pont élévateur ---- */
    (function () {
      const st = makeStation('pont'), S = st.g;
      const L = postLift(S), C = car(S, {}), spinC = roller(C); C.g.position.x = -5; st.m = C.g;
      const mc = mech(S, 2.6, 2.3); face(mc, 0, 0);
      toolChest(S, -3.2, -2.6); shadows(S);
      part(st, 'colonnes', 'les colonnes', anchor(S, 0, 3.2, 1.8), true);
      part(st, 'bras', 'les bras', anchor(L.car, 0.75, 0.15, 1.0), false);
      part(st, 'pot', "le pot d'échappement", C.tip, false);
      part(st, 'roues', 'les roues', anchor(C.hubs[0], 0, 0, 0.15), false);
      st.focus = new V3(-0.8, 1.9, 0); st.size = { w: 11.5, h: 5.6 }; st.el = 0.4; st.tagAt = anchor(S, 0, 4.7, 0);
      st.update = () => {
        spinC(); const y = Math.max(0, L.car.position.y - 0.05); C.g.position.y = y;
        const dr = Math.min(1, y / 0.3) * 0.06; C.hubs.forEach((h) => (h.position.y = WR - dr));
      };
      const arms = (k) => L.arms.forEach((a) => (a.a.rotation.y = a.rest + (a.eng - a.rest) * k));
      st.action = async function () {
        if (st.done) { C.g.position.x = -5; L.car.position.y = 0; arms(0); mc.position.set(2.6, 0, 2.3); face(mc, 0, 0); st.done = false; await Promise.all([step('La voiture ressort... et on recommence !', 'colonnes'), sleep(0.5)]); }
        engineOn(45);
        await Promise.all([step("La voiture entre dans l'atelier, entre les deux colonnes du pont.", 'colonnes'), to(C.g.position, 'x', 0, 3.6, easeSine)]);
        engineOff();
        await Promise.all([step('Le mécanicien glisse les bras du pont sous la voiture.', 'bras'), (async () => { await walkTo(mc, 1.2, 2.25); face(mc, 0.6, 0.8); await tw(2.2, arms, easeSine); })()]);
        await walkTo(mc, 0.75, 1.72); face(mc, 0, 1.6); point(mc, true); ding();
        await Promise.all([step('Il appuie sur le bouton vert... Le pont monte, et la voiture avec !', 'colonnes'), hum(4.4), to(L.car.position, 'y', 1.95, 4.4, easeSine)]);
        point(mc, false);
        await Promise.all([step("Le mécanicien passe dessous. Là, c'est le pot d'échappement : la fumée du moteur sort par ce tuyau.", 'pot'), (async () => { await walkTo(mc, 1.1, 1.0); await walkTo(mc, -1.5, 0.75); face(mc, -2.6, 0.5); point(mc, true); })()]);
        await Promise.all([step('Les roues pendent dans le vide. Il peut les faire tourner avec la main !', 'roues'), (async () => {
          point(mc, false); await walkTo(mc, 1.3, 1.25); face(mc, 1.3, 0.6); point(mc, true);
          const w = C.wheels[0], r0 = w.rotation.z; await tw(2.6, (k) => (w.rotation.z = r0 - 16 * (1 - (1 - k) * (1 - k))), lin); point(mc, false);
        })()]);
        await walkTo(mc, 2.6, 2.3); face(mc, 0, 0);
        await Promise.all([step('Le pont redescend tout doucement.', 'colonnes'), hum(4.2), to(L.car.position, 'y', 0, 4.2, easeSine)]);
        await tw(1.6, (k) => arms(1 - k), easeSine);
        chime(); st.done = true;
      };
    })();

    /* ---- les pneus ---- */
    (function () {
      const st = makeStation('pneus'), S = st.g;
      const TC = tyreChanger(S, -1.3), BA = balancer(S, 1.7);
      // rack of new tyres and a pile of old ones
      const rk = grp(S, -3.3, 0, -0.5), rd = grp(rk);
      [0.5, -0.5].forEach((x) => { box(rd, 0.05, 1.5, 0.05, GM.greyD, x, 0.75, 0.3); box(rd, 0.05, 1.5, 0.05, GM.greyD, x, 0.75, -0.3); });
      [0.15, 0.9].forEach((y) => [0.3, -0.3].forEach((z) => box(rd, 1.05, 0.04, 0.04, GM.greyD, 0, y, z)));
      bake(rd);
      const TYG = (() => { const t = tire(S, WR, 0.2, 0, -5, 0, GM.alloy, 1, MT.rubber); const g = t.children[0].geometry; S.remove(t); return g; })();
      [-0.35, -0.12, 0.12, 0.35].forEach((x, i) => { add(rk, TYG, MT.rubber, x, 0.5, 0).rotation.y = Math.PI / 2; if (i > 0) add(rk, TYG, MT.rubber, x, 1.25, 0).rotation.y = Math.PI / 2; });
      const pile = grp(S, 3.7, 0, -0.9); for (let i = 0; i < 4; i++) { const t = add(pile, TYG, MT.rubberS, rnd(-0.05, 0.05), 0.1 + i * 0.2, rnd(-0.05, 0.05)); t.rotation.x = Math.PI / 2; }
      const mc = mech(S, 0.0, 1.45); face(mc, 0, 0);
      // the wheel with the flat tyre (a nail in the tread!)
      const W = wheel(S, -2.5, WR, 1.1, 1), ty = W.userData.tyre; const startPos = W.position.clone();
      const nail = grp(ty, 0, WR + 0.01, 0.04); cylY(nail, 0.012, 0.08, GM.grey, 0, 0, 0, 6); cylY(nail, 0.035, 0.012, GM.grey, 0, 0.04, 0, 8);
      const nt = add(S, TYG, MT.rubber, -3.65, 1.25, -0.5); nt.rotation.y = Math.PI / 2; const ntHome = nt.position.clone(), ntQ = nt.quaternion.clone();
      const weight = box(W, 0.05, 0.04, 0.03, GM.grey, 0, WR * 0.62, 0.11); weight.visible = false;
      const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), qUp = new THREE.Quaternion();
      /** Fly an object to a position (in S) and orientation, along a little arc. */
      const fly = (o, p1, q1, d = 1.6, lift = 0.6) => { const p0 = o.position.clone(), q0 = o.quaternion.clone(); return tw(d, (k) => { o.position.lerpVectors(p0, p1, k); o.position.y += Math.sin(k * Math.PI) * lift; o.quaternion.copy(q0).slerp(q1, k); }, easeSine); };
      part(st, 'pneu', 'le pneu', anchor(W, 0, 0, 0.12), true);
      part(st, 'demonte', 'le démonte-pneu', anchor(TC.g, -0.55, 2.3, 0), true);
      part(st, 'equilibreuse', "l'équilibreuse", anchor(BA.g, 0, 1.55, -0.3), true);
      part(st, 'poids', 'le petit poids', anchor(BA.shaft, 0, 0.3, 0.1), false);
      st.focus = new V3(0, 1.2, 0); st.size = { w: 10, h: 5.2 }; st.tagAt = anchor(S, 0, 3.2, 0);
      st.update = (dt) => { if (st.ttSpin) TC.tt.rotation.y += dt * st.ttSpin; if (st.balSpin) W.rotation.z -= dt * st.balSpin; };
      const ttTop = () => new V3(-1.3, 0.975, 0);
      st.action = async function () {
        if (st.done) {
          S.attach(W); W.position.copy(startPos); W.rotation.set(0, 0, 0); W.add(ty); ty.position.set(0, 0, 0); ty.rotation.set(0, 0, 0); ty.visible = true; ty.scale.setScalar(1);
          S.attach(nt); nt.position.copy(ntHome); nt.quaternion.copy(ntQ); nt.scale.setScalar(1); weight.visible = false; BA.hood.rotation.x = -1.3; BA.disp.emissive.setHex(0xd8201a); BA.disp.color.setHex(0xff4a3a); BA.disp.emissiveIntensity = 0.25;
          TC.tt.rotation.y = 0; st.done = false; await Promise.all([step('Une autre roue crevée arrive !', 'pneu'), sleep(0.5)]);
        }
        point(mc, true);
        await Promise.all([step('Voici la roue crevée. Regarde : il y a un clou dans le pneu ! Le mécanicien la pose sur le démonte-pneu.', 'pneu'), (async () => { await sleep(1.2); point(mc, false); await fly(W, ttTop().add(new V3(0, 0.1, 0)), qFlat, 1.8, 0.7); TC.tt.attach(W); thud(); })()]);
        st.ttSpin = 3; tone(90, 0, 4.5, 'sawtooth', 0.02, 100);
        await Promise.all([step('Le plateau tourne, et la machine enlève le vieux pneu.', 'demonte'), (async () => {
          await to(TC.head.position, 'y', 1.72, 1.2, easeSine); await sleep(1.0); S.attach(ty);
          await to(ty.position, 'y', ty.position.y + 0.3, 1.0, easeSine); await to(TC.head.position, 'y', 2.0, 0.8, easeSine);
          await fly(ty, new V3(3.7, 0.95, -0.9), qFlat, 1.6, 0.8); ty.visible = false; thud();
        })()]);
        st.ttSpin = 0;
        await Promise.all([step("Un pneu tout neuf prend sa place. Pschhh ! On le gonfle avec de l'air.", 'pneu'), (async () => {
          const tgt = ttTop().add(new V3(0, 0.1, 0)); await fly(nt, tgt.clone().add(new V3(0, 0.35, 0)), qFlat, 1.6, 0.6); await to(nt.position, 'y', tgt.y, 0.6, easeSine);
          W.attach(nt); hiss(1.6); await tw(1.6, (k) => nt.scale.setScalar(0.94 + 0.06 * k + Math.sin(k * Math.PI) * 0.05), lin); nt.scale.setScalar(1);
        })()]);
        await Promise.all([step("Sur l'équilibreuse, la roue tourne très, très vite, pour voir si elle tremble.", 'equilibreuse'), (async () => {
          S.attach(W); const sh = new V3(1.7, 0.75, 0.62);
          await fly(W, sh, qUp, 1.8, 0.6); thud(); await to(BA.hood.rotation, 'x', 0, 0.8, easeSine);
          st.balSpin = 0; tone(150, 0, 3.6, 'sawtooth', 0.02, 420); await tw(3.6, (k) => (st.balSpin = 40 * Math.sin(k * Math.PI)), lin); st.balSpin = 0;
          await to(BA.hood.rotation, 'x', -1.3, 0.8, easeSine);
        })()]);
        await Promise.all([step("Un petit poids sur la jante, et c'est parfait. La roue est réparée !", 'poids'), (async () => {
          W.rotation.z = 0; weight.visible = true; ding(); BA.disp.color.setHex(0x5aff7a); BA.disp.emissive.setHex(0x2ad04a); BA.disp.emissiveIntensity = 0.9; await sleep(1.5);
        })()]);
        chime(); st.done = true;
      };
    })();

    /* ---- la vidange ---- */
    (function () {
      const st = makeStation('vidange'), S = st.g;
      const SL = scissorLift(S), C = car(S, { color: 0x2f6fd8 }); st.m = C.g;
      const CY = (h) => SL.top(h); C.g.position.y = CY(0);
      const cad = oilCaddy(S); const CAD0 = new V3(3.4, 0, 1.7); cad.g.position.copy(CAD0);
      const tc = toolChest(S, 3.5, -1.5); const can = oilCan(S); can.position.set(3.5, 0.945, -1.5); const canHome = can.position.clone();
      const mc = mech(S, 2.9, 1.0); face(mc, 1.5, 0.3);
      const drain = line(S, 0.028, GM.oilBlack), pour = line(S, 0.02, GM.oilGold);
      const coverHome = C.cover.position.clone();
      part(st, 'moteur', 'le moteur', C.engine, true);
      part(st, 'bouchon', "le bouchon d'huile", C.cap, false);
      part(st, 'entonnoir', "l'entonnoir", anchor(cad.tube, 0, 0.3, 0.3), false);
      part(st, 'pistons', 'les pistons', anchor(C.g, 1.5, 0.95, 0.3), false);
      st.focus = new V3(0.6, 1.4, 0); st.size = { w: 10.5, h: 6.4 }; st.tagAt = anchor(S, 0, 3.4, 0);
      let H = 0, ph = 0;
      st.update = (dt) => {
        SL.set(H); C.g.position.y = CY(H);
        if (drain.g.visible) { const a = wp(C.sump), b = cad.tube.localToWorld(new V3(0, 0.15, 0)); drain.set(a, b); }
        if (pour.g.visible) { const a = wp(can.userData.spout), b = wp(C.cap); pour.set(a, b); }
        if (st.run) { ph += dt * 18; C.pistons.forEach((p, i) => (p.position.y = 0.7 + Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.05)); if (Math.random() < 0.3) puff(C.tip, 1); }
      };
      st.action = async function () {
        if (st.done) { H = 0; cad.g.position.copy(CAD0); cad.tube.position.y = 0.95; can.position.copy(canHome); can.rotation.set(0, 0, 0); mc.position.set(2.9, 0, 1.0); face(mc, 1.5, 0.3); st.done = false; }
        await Promise.all([step('Le mécanicien ouvre le capot. Regarde, voilà le moteur ! C’est lui qui fait avancer la voiture.', 'moteur'), (async () => { await to(C.bonnet.rotation, 'z', 1.15, 1.4, easeSine); point(mc, true); })()]);
        await step("Le moteur a besoin d'huile, comme toi tu as besoin de boire. Le bouchon jaune, c'est pour l'huile.", 'bouchon');
        point(mc, false);
        await Promise.all([step('Le pont ciseaux soulève la voiture. On approche le grand entonnoir.', 'entonnoir'), (async () => {
          await walkTo(mc, 3.6, 2.6); face(mc, 0, 0); hum(3); await tw(3, (k) => (H = 1.2 * k), easeSine);
          await tw(2.2, (k) => cad.g.position.set(3.4 + (1.5 - 3.4) * k, 0, 1.7 + (0.15 - 1.7) * k), easeSine); await to(cad.tube.position, 'y', 1.3, 1, easeSine);
        })()]);
        drain.g.visible = true;
        await Promise.all([step("On ouvre le bouchon du dessous : la vieille huile toute noire coule dans l'entonnoir.", 'entonnoir'), (async () => { for (let i = 0; i < 6; i++) { tone(260 - i * 12, i * 0.6, 0.15, 'sine', 0.04); } await sleep(4); })()]);
        drain.g.visible = false;
        await Promise.all([step("La voiture redescend. On verse de l'huile toute neuve, dorée comme du miel.", 'bouchon'), (async () => {
          await to(cad.tube.position, 'y', 0.95, 0.8); await tw(2, (k) => cad.g.position.set(1.5 + (3.4 - 1.5) * k, 0, 0.15 + (1.7 - 0.15) * k), easeSine);
          hum(3); await tw(3, (k) => (H = 1.2 * (1 - k)), easeSine);
          const cp = S.worldToLocal(wp(C.cap)); const tgt = new V3(cp.x + 0.43, cp.y + 0.6, cp.z);
          const p0 = can.position.clone(); await tw(1.4, (k) => { can.position.lerpVectors(p0, tgt, k); can.position.y += Math.sin(k * Math.PI) * 0.4; can.rotation.y = Math.PI * k; }, easeSine);
          await to(can.rotation, 'z', -1.1, 0.6, easeSine); pour.g.visible = true; await sleep(2.6); pour.g.visible = false; await to(can.rotation, 'z', 0, 0.5);
          const p1 = can.position.clone(); await tw(1.2, (k) => { can.position.lerpVectors(p1, canHome, k); can.position.y += Math.sin(k * Math.PI) * 0.3; can.rotation.y = Math.PI * (1 - k); }, easeSine);
        })()]);
        await Promise.all([step('Vroum ! Le moteur tourne. Sous le cache, les pistons montent et descendent très vite.', 'pistons'), (async () => {
          await tw(1, (k) => C.cover.position.set(coverHome.x, coverHome.y + 0.7 * k, coverHome.z - 1.3 * k), easeSine);
          engineOn(60); st.run = true; await sleep(3.6); st.run = false; engineOff(); C.pistons.forEach((p) => (p.position.y = 0.66));
          await tw(1, (k) => C.cover.position.set(coverHome.x, coverHome.y + 0.7 * (1 - k), coverHome.z - 1.3 * (1 - k)), easeSine);
          await to(C.bonnet.rotation, 'z', 0, 1.2, easeSine); thud();
        })()]);
        chime(); st.done = true;
      };
    })();

    /* ---- le diagnostic ---- */
    (function () {
      const st = makeStation('diagnostic'), S = st.g;
      const lm = std(0xeef3ff, 0.12, 0.4, { emissive: 0xfff2c0, emissiveIntensity: 0 }), C = car(S, { lamp: lm }); st.m = C.g;
      const DC = diagCart(S); const DC0 = new V3(-1.6, 0, 2.6); DC.g.position.copy(DC0);
      const RG = reglo(S, 3.05);
      const nb = battery(S, 3.0, 0, 1.9); const nbHome = nb.position.clone(); box(nb, 0.27, 0.04, 0.21, GM.green, 0, 0.17, 0);
      const ob = C.battery, obHome = ob.position.clone();
      const mc = mech(S, -0.6, 2.3); face(mc, 0, 0);
      const cable = hose(S, 0.018, MT.black);
      const beam = add(S, new THREE.CylinderGeometry(0.12, 0.16, 0.7, 16, 1, true), GM.beam, 2.42, 0.74, 0.58); beam.rotation.z = Math.PI / 2; beam.visible = false;
      part(st, 'ordi', "l'ordinateur", anchor(DC.g, 0, 1.6, -0.1), true);
      part(st, 'batterie', 'la batterie', anchor(C.g, 1.05, 0.75, 0.5), false);
      part(st, 'phares', 'les phares', anchor(C.g, 2.08, 0.78, 0.6), false);
      part(st, 'regloscope', 'le régloscope', anchor(RG.col, 0, 1.4, 0), true);
      st.focus = new V3(0.5, 1.2, 0.3); st.size = { w: 10.5, h: 5.4 }; st.tagAt = anchor(S, 0, 3.0, 0);
      st.update = () => { if (st.plugged) cable.set(wp(DC.plug), wp(C.obd), 0.35); };
      st.action = async function () {
        if (st.done) {
          lm.emissiveIntensity = 0; DC.sm.map = SCR.off; RG.sm.map = SCR.off; cable.show(false); st.plugged = false; DC.g.position.copy(DC0); RG.col.position.z = 1.4;
          C.g.attach(ob); ob.position.copy(obHome); ob.rotation.set(0, 0, 0); S.attach(nb); nb.position.copy(nbHome); nb.rotation.set(0, 0, 0); mc.position.set(-0.6, 0, 2.3); face(mc, 0, 0); st.done = false;
        }
        crank();
        await Promise.all([step('La voiture de la famille ne veut pas démarrer. Rrr... rrr... Rien !', 'batterie'), sleep(1.4)]);
        await Promise.all([step("Le mécanicien branche l'ordinateur sur la voiture, pour savoir ce qui ne va pas.", 'ordi'), (async () => {
          await Promise.all([tw(2.2, (k) => DC.g.position.set(-1.6 + 1.9 * k, 0, 2.6 - 0.95 * k), easeSine), walkTo(mc, -0.5, 2.0, 1.3)]);
          face(mc, 0.3, 1.6); st.plugged = true; cable.show(true); ding(); DC.sm.map = SCR.scan; await sleep(1.2);
        })()]);
        DC.sm.map = SCR.bat; tone(330, 0, 0.3, 'square', 0.03); tone(260, 0.35, 0.4, 'square', 0.03);
        await step("L'ordinateur a trouvé : la batterie est fatiguée !", 'ordi');
        await Promise.all([step('On ouvre le capot, et on met une batterie toute neuve, bien chargée.', 'batterie'), (async () => {
          await walkTo(mc, 1.0, 2.3); await walkTo(mc, 2.75, 1.45); face(mc, 1.6, 0.6); await to(C.bonnet.rotation, 'z', 1.15, 1.2, easeSine);
          S.attach(ob); const p0 = ob.position.clone(); await tw(1.4, (k) => { ob.position.set(p0.x + (2.4 - p0.x) * k, p0.y + Math.sin(k * Math.PI) * 0.6 * (1 - k) + (0 - p0.y) * k, p0.z + (2.2 - p0.z) * k); }, easeSine); thud();
          C.g.attach(nb); const n0 = nb.position.clone(); await tw(1.4, (k) => { nb.position.set(n0.x + (obHome.x - n0.x) * k, n0.y + (obHome.y - n0.y) * k + Math.sin(k * Math.PI) * 0.7, n0.z + (obHome.z - n0.z) * k); }, easeSine); ding();
          await to(C.bonnet.rotation, 'z', 0, 1.0, easeSine); thud();
        })()]);
        crank(); await sleep(0.8);
        await Promise.all([step('Vroum ! La voiture démarre, et ses phares s’allument.', 'phares'), (async () => { engineOn(55); DC.sm.map = SCR.ok; lm.emissiveIntensity = 1.6; for (let i = 0; i < 4; i++) { puff(C.tip, 2); await sleep(0.5); } })()]);
        await Promise.all([step('Le régloscope vérifie que les phares éclairent bien la route.', 'regloscope'), (async () => {
          await walkTo(mc, 3.9, 2.0); face(mc, 3.0, 1.4); await to(RG.col.position, 'z', 0.58, 1.2, easeSine);
          beam.position.z = 0.58; beam.visible = true; RG.sm.map = SCR.beam; ding(); await sleep(1.6); beam.visible = false; RG.sm.map = SCR.off;
          await to(RG.col.position, 'z', -0.58, 1.4, easeSine); beam.position.z = -0.58; beam.visible = true; RG.sm.map = SCR.beam; ding(); await sleep(1.6); beam.visible = false; RG.sm.map = SCR.off;
          await to(RG.col.position, 'z', 1.4, 1.4, easeSine);
        })()]);
        engineOff(); cable.show(false); st.plugged = false; chime(); st.done = true;
      };
    })();

    /* ---- le lavage ---- */
    (function () {
      const st = makeStation('lavage'), S = st.g;
      const CM = carMat(RED).clone(), clean = new THREE.Color(RED), dirty = new THREE.Color(0x8a6a4a); CM.color.copy(dirty);
      const C = car(S, { mat: CM }), spinC = roller(C); st.m = C.g; const CX = -5.6; C.g.position.x = CX;
      const G = washGantry(S); const GX = 3.4; G.g.position.x = GX;
      const foamM = std(0xffffff, 0.9, 0, { transparent: true, opacity: 0, depthWrite: false });
      const foam = [rbox(C.g, 4.3, 0.72, 1.86, 0.3, foamM, -0.02, 0.66, 0, 0.04), rbox(C.g, 2.5, 0.6, 1.66, 0.25, foamM, -0.62, 1.2, 0, 0.04)];
      const mudM = std(0x6a4a2a, 0.95, 0, { transparent: true, opacity: 1, depthWrite: false });
      [[1.5, 0.45], [0.4, 0.5], [-0.6, 0.42], [-1.6, 0.55], [1.0, 0.7]].forEach(([x, y]) => { const b = sph(C.g, 0.2, mudM, x, y, HW + 0.01); b.scale.set(0.3, 0.12, 0.02); });
      // the bay: side wall, back wall with the sign, a mat and a drain
      { const w = grp(S); box(w, 0.25, 3.6, 7.5, GM.wallW, 7.4, 1.8, -1.0); box(w, 15, 3.6, 0.25, GM.wallW, 0, 1.8, -4.6); box(w, 15.2, 0.5, 0.3, GM.blue, 0, 3.4, -4.6); box(w, 0.3, 0.5, 7.6, GM.blue, 7.4, 3.4, -1.0);
        rbox(w, 6, 1.2, 0.2, 0.1, GM.blue, 0, 4.4, -4.6, 0.02); decal(w, 'LAVAGE', 5.2, 1.0, '#ffffff', 0, 4.4, -4.48, null);
        [1.95, -1.95].forEach((z) => box(w, 8.2, 0.05, 0.16, GM.greyD, 0, 0.025, z)); bake(w); }
      part(st, 'portique', 'le portique', anchor(G.g, 0, 3.6, 1.9), true);
      part(st, 'mousse', 'la mousse', G.foam, false);
      part(st, 'brosses', 'les brosses', anchor(G.sb[0].a, 0, 1.4, 0.45), false);
      part(st, 'sechoir', 'le séchoir', G.dryer, false);
      st.focus = new V3(-0.6, 1.7, 0); st.size = { w: 14, h: 6.4 }; st.tagAt = anchor(S, 0, 4.4, 0);
      let mode = '';
      st.update = (dt) => {
        spinC(); const gx = G.g.position.x, xr = gx - C.g.position.x, top = carTop(xr), on = mode === 'brush';
        G.sb.forEach((b) => { b.br.rotation.y += dt * (on ? 9 : 0) * b.s; const tz = b.s * (on && top > 0 ? 1.33 : 1.5); b.a.position.z += (tz - b.a.position.z) * Math.min(1, dt * 5); });
        G.tbr.rotation.z += dt * (on ? 8 : 0); const ty = on && top > 0 ? top + 0.42 : 2.45; G.tb.position.y += (ty - G.tb.position.y) * Math.min(1, dt * 6);
        if (mode === 'foam' && Math.random() < 0.8) for (let i = 0; i < 2; i++) fx.smoke(G.g.localToWorld(new V3(0.3, rnd(0.6, 2.6), rnd(-1.6, 1.6))), new V3(rnd(-0.4, 0.4), -0.6, 0), rnd(0.15, 0.28), 0xffffff, 1.1);
        if (mode === 'brush' && Math.random() < 0.5) fx.smoke(G.g.localToWorld(new V3(0, rnd(0.6, 1.8), rnd(-1.0, 1.0))), new V3(0, 0.4, 0), 0.18, 0xffffff, 0.8);
        if (mode === 'rinse') for (let i = 0; i < 3; i++) fx.smoke(G.g.localToWorld(new V3(0.3, 2.7, rnd(-1.4, 1.4))), new V3(rnd(-0.3, 0.3), -4.5, 0), 0.07, 0x9fd8ff, 0.55);
        if (mode === 'dry' && Math.random() < 0.6) fx.smoke(G.g.localToWorld(new V3(-0.42, 2.4, rnd(-1.2, 1.2))), new V3(rnd(-1.5, -0.5), -1.2, 0), 0.12, 0xeef4ff, 0.6);
        if (mode === 'shine' && Math.random() < 0.4) fx.fire(C.g.localToWorld(new V3(rnd(-1.8, 1.8), rnd(0.6, 1.5), rnd(-0.9, 0.9))), new V3(0, 1, 0), 0.4, 0.1, 0.12);
      };
      const pass = (x1, d) => to(G.g.position, 'x', x1, d, easeSine);
      st.action = async function () {
        if (st.done) { CM.color.copy(dirty); mudM.opacity = 1; foamM.opacity = 0; C.g.position.x = CX; G.g.position.x = GX; st.done = false; }
        engineOn(45);
        await Promise.all([step('La voiture toute sale entre dans la station de lavage.', 'portique'), to(C.g.position, 'x', 0, 3.6, easeSine)]);
        engineOff(); mode = 'foam'; hiss(4.2);
        await Promise.all([step('Pschhh ! Le portique la couvre de mousse blanche.', 'mousse'), pass(-3.4, 4.2), tw(4.2, (k) => (foamM.opacity = 0.85 * k), lin)]);
        mode = 'brush'; tone(95, 0, 6, 'sawtooth', 0.02, 110);
        await Promise.all([step('Les grosses brosses tournent, et elles frottent toute la voiture.', 'brosses'), pass(GX, 6), tw(6, (k) => { foamM.opacity = 0.85 * (1 - k * 0.6); mudM.opacity = 1 - k; CM.color.lerpColors(dirty, clean, k); }, lin)]);
        mode = 'rinse'; hiss(4);
        await Promise.all([step("On rince avec de l'eau bien claire.", 'portique'), pass(-3.4, 4), tw(4, (k) => (foamM.opacity = 0.34 * (1 - k)), lin)]);
        mode = 'dry'; tone(400, 0, 4, 'sawtooth', 0.008, 300);
        await Promise.all([step('Le séchoir souffle très fort : fffff ! La voiture brille comme une neuve.', 'sechoir'), pass(GX, 4)]);
        mode = 'shine'; chime(); await sleep(1.6); mode = ''; st.done = true;
      };
    })();

    /* ---- la station-service ---- */
    (function () {
      const st = makeStation('station'), S = st.g;
      const C = car(S, {}), spinC = roller(C); st.m = C.g; const CX = -9; C.g.position.x = CX;
      const EV = car(S, { color: 0xf2f2f6, ev: true }); EV.g.position.set(4.4, 0, -3.1);
      const PU = fuelPump(S, -3.2, 1.55), CP = chargePost(S, 6.3, -1.45);
      // the island, the canopy and its pillars
      { const w = grp(S); rbox(w, 2.2, 0.16, 1.1, 0.05, GM.conc, -3.2, 0.08, 1.55, 0.02); box(w, 0.4, 0.17, 1.12, MT.stripes, -4.2, 0.085, 1.55); box(w, 0.4, 0.17, 1.12, MT.stripes, -2.2, 0.085, 1.55);
        [[-5.5, -4.8], [5.5, -4.8]].forEach(([x, z]) => { rbox(w, 0.4, 4.6, 0.4, 0.06, GM.white, x, 2.3, z, 0.02); box(w, 0.42, 0.4, 0.42, GM.green, x, 0.2, z); });
        rbox(w, 12.4, 0.36, 7.0, 0.08, GM.white, 0, 4.78, -1.6, 0.02); box(w, 12.5, 0.14, 7.1, GM.green, 0, 4.6, -1.6); for (let x = -5; x <= 5; x += 2.5) box(w, 1.6, 0.03, 0.4, GM.lampOff, x, 4.58, -1.6);
        rbox(w, 1.2, 0.18, 1.0, 0.05, GM.conc, 6.3, 0.09, -1.45, 0.02);
        bake(w); }
      const ev = EV.g; ev.updateMatrixWorld(true);
      const fuelHose = hose(S, 0.03, MT.black), evCable = hose(S, 0.028, MT.black); evCable.show(true); fuelHose.show(true);
      const dad = P(S, -0.9, 1.4, { top: 0x3aa46a, bottom: 0x2a3550 }); dad.visible = false;
      part(st, 'pompe', 'la pompe', anchor(PU.g, 0, 2.3, 0.2), true);
      part(st, 'pistolet', 'le pistolet', anchor(PU.noz, 0, 0.1, 0.05), false);
      part(st, 'ecran', "l'écran", anchor(PU.g, 0, 1.45, 0.26), false);
      part(st, 'borne', 'la borne', anchor(CP.g, 0, 1.75, 0.1), true);
      st.focus = new V3(0.6, 1.6, -0.8); st.size = { w: 18, h: 7 }; st.tagAt = anchor(S, 0, 5.4, 0);
      let T0 = 0, fuel = 0, charge = 0.3;
      st.update = (dt) => {
        T0 += dt; spinC();
        fuelHose.set(wp(PU.out), wp(PU.noz.userData.tail), 0.5); evCable.set(wp(CP.out), wp(EV.fill), 0.45);
        CP.ring.emissiveIntensity = 0.5 + 0.5 * Math.sin(T0 * (st.charging ? 6 : 2)); CP.bar.scale.x = Math.max(0.05, charge);
      };
      st.action = async function () {
        if (st.done) { C.g.position.x = CX; fuel = 0; PU.draw(0); charge = 0.3; st.done = false; }
        engineOn(45);
        await Promise.all([step('La voiture de la famille arrive à la station-service. Son réservoir est presque vide.', 'pompe'), to(C.g.position, 'x', 0, 4.2, easeSine)]);
        engineOff();
        await Promise.all([step('On ouvre la petite trappe, et on met le pistolet dedans.', 'pistolet'), (async () => {
          popTo(dad, 1.32); await walkTo(dad, -2.5, 1.55, 1.3); face(dad, -3.2, 1.55); await to(C.flap.rotation, 'y', -1.3, 0.6);
          const tgt = S.worldToLocal(wp(C.fill)).add(new V3(0, 0.06, 0.14));
          const n = PU.noz; S.attach(n); const s0 = n.position.clone(), q0 = n.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.35, 0, 0));
          await tw(1.6, (k) => { n.position.lerpVectors(s0, tgt, k); n.position.y += Math.sin(k * Math.PI) * 0.3; n.quaternion.copy(q0).slerp(q1, k); }, easeSine);
          await walkTo(dad, -1.6, 1.6, 1.3); face(dad, -1.5, 0.9); thud();
        })()]);
        await Promise.all([step('Glou glou... Le carburant coule dans le réservoir. Les chiffres tournent sur l’écran !', 'ecran'), tone(180, 0, 4.4, 'sine', 0.012, 200), tw(4.4, (k) => { const v = 38 * k; if (Math.abs(v - fuel) > 0.4 || k === 1) { fuel = v; PU.draw(v); } }, lin)]);
        st.charging = true;
        await Promise.all([step("Juste à côté, la voiture électrique se recharge à la borne. Elle, elle boit de l'électricité !", 'borne'), tw(4, (k) => (charge = 0.3 + 0.7 * k), lin)]);
        st.charging = false; ding();
        await Promise.all([step('Le plein est fait ! On raccroche le pistolet, et en route !', 'pistolet'), (async () => {
          const n = PU.noz; PU.g.attach(n); const l0 = n.position.clone(), lq = n.quaternion.clone();
          await walkTo(dad, -2.5, 1.55, 1.3); await tw(1.4, (k) => { n.position.lerpVectors(l0, PU.home, k); n.quaternion.copy(lq).slerp(new THREE.Quaternion(), k); }, easeSine);
          await to(C.flap.rotation, 'y', 0, 0.5); await walkTo(dad, -0.9, 1.4, 1.3); dad.visible = false;
          engineOn(45); await to(C.g.position, 'x', 9.5, 4, easeIn); engineOff();
        })()]);
        chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate, fx);
  }
};

/* ================= the garage around the machines ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
const ALONG_D = YAW - Math.PI / 2; // local +x along +d
function roundTree(p, h, d, s = 1) {
  const g = at(p, h, d, 0); cylY(g, 0.18 * s, 2.6 * s, 0x6b4a32, 0, 1.3 * s, 0, 8);
  for (let i = 0; i < 6; i++) { const m = add(g, ICO, pick([0x4a9a4a, 0x3f8a3a, 0x5aa85a, 0x6ab84a]), rnd(-0.9, 0.9) * s, rnd(2.9, 4.0) * s, rnd(-0.9, 0.9) * s); m.scale.setScalar(rnd(0.9, 1.3) * s); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  return g;
}
function chair(p, x, z, M = GM.seat) {
  const g = grp(p, x, 0, z); rbox(g, 0.48, 0.07, 0.46, 0.03, M, 0, 0.45, 0, 0.01); rbox(g, 0.07, 0.48, 0.46, 0.03, M, -0.22, 0.72, 0, 0.01);
  [[0.18, 0.18], [0.18, -0.18], [-0.18, 0.18], [-0.18, -0.18]].forEach(([a, b]) => box(g, 0.035, 0.44, 0.035, GM.greyD, a, 0.22, b)); return g;
}
function plant(p, x, z, s = 1) { const g = grp(p, x, 0, z); cylY(g, 0.2 * s, 0.4 * s, GM.pot, 0, 0.2 * s, 0, 12); for (let i = 0; i < 5; i++) { const m = add(g, ICO, i % 2 ? GM.leaf : GM.leafL, rnd(-0.15, 0.15) * s, (0.6 + rnd(0, 0.5)) * s, rnd(-0.15, 0.15) * s); m.scale.setScalar(0.25 * s); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); } return g; }
function house(p, h, d, wc, rc) {
  const g = at(p, h, d), W = std(wc, 0.85, 0), Rf = std(rc, 0.75, 0.1), w = 5.6, dd = 4.6, H = 3.0;
  box(g, w, H, dd, W, 0, H / 2, 0); ext(g, [[-w / 2 - 0.3, 0], [w / 2 + 0.3, 0], [0, 2.0]], 0.05, dd + 0.5, Rf, 0, H, 0, 0.03);
  box(g, 0.8, 0.9, 0.8, GM.wall, 1.4, H + 1.2, -0.6);
  box(g, 0.9, 1.7, 0.06, GM.woodD, -1.6, 0.85, -dd / 2 - 0.02);
  [[0.4, 1.6], [1.8, 1.6], [-1.6, 2.4]].forEach(([x, y]) => { if (y > 2) return; box(g, 0.9, 0.8, 0.06, GM.glass, x, y, -dd / 2 - 0.02); box(g, 0.25, 0.85, 0.07, pick([GM.blue, GM.green, GM.red]), x - 0.58, y, -dd / 2 - 0.03); box(g, 0.25, 0.85, 0.07, GM.blue, x + 0.58, y, -dd / 2 - 0.03); });
  plant(g, -2.4, -dd / 2 - 0.5, 0.9); plant(g, 2.4, -dd / 2 - 0.5, 0.8);
  return g;
}
let KID = null, STEAM = null;
function buildGarage(g) {
  // ---- the workshop: back wall with the big sign, a roof over the back strip only (cut open), end walls, low partitions
  { const w = at(g, -5.25, -15.75); box(w, 43.6, 5.2, 0.3, GM.wall, 0, 2.6, 0); box(w, 43.7, 0.6, 0.34, GM.blue, 0, 4.75, 0); box(w, 43.7, 0.12, 0.36, GM.white, 0, 4.38, 0);
    box(w, 44.2, 0.25, 3.4, GM.roof, 0, 5.35, 1.55); cylX(w, 0.08, 44.2, GM.greyD, 0, 5.25, 3.3, 8); box(w, 44.2, 0.3, 0.12, GM.blue, 0, 5.3, 3.25);
    rbox(w, 10, 1.6, 0.25, 0.12, GM.blue, 0, 6.3, 0.3, 0.02); decal(w, 'GARAGE', 8.6, 1.3, '#ffffff', 0, 6.3, 0.44, null);
    // tool wall (pont bay), shelves of oil (vidange bay), a poster and a clock (diagnostic bay)
    box(w, 4.4, 1.7, 0.04, GM.peg, -17.4, 1.95, 0.17);
    for (let i = 0; i < 9; i++) { const t = box(w, 0.06, rnd(0.35, 0.6), 0.03, GM.chrome, -19.2 + i * 0.25, 2.35, 0.2); t.rotation.z = rnd(-0.2, 0.2); }
    for (let i = 0; i < 6; i++) { box(w, 0.05, 0.3, 0.04, pick([GM.red, GM.yel, GM.blue]), -19.1 + i * 0.4, 1.6, 0.21); box(w, 0.03, 0.2, 0.03, GM.chrome, -19.1 + i * 0.4, 1.35, 0.21); }
    [[-16.2, 2.2], [-15.8, 1.5], [-16.6, 1.5]].forEach(([x, y]) => { box(w, 0.4, 0.06, 0.04, GM.greyD, x, y, 0.21); box(w, 0.08, 0.2, 0.05, GM.woodD, x - 0.15, y - 0.1, 0.21); });
    for (let lv = 0; lv < 3; lv++) { box(w, 4.2, 0.05, 0.5, GM.greyD, -9.5, 0.6 + lv * 0.75, 0.4); for (let i = 0; i < 12; i++) rbox(w, 0.2, 0.3, 0.14, 0.03, pick([GM.yel, GM.blue, GM.red, GM.green]), -11.3 + i * 0.32, 0.79 + lv * 0.75, 0.42, 0.01); }
    [-11.6, -7.4].forEach((x) => box(w, 0.06, 2.3, 0.5, GM.greyD, x, 1.15, 0.4));
    box(w, 1.6, 2.2, 0.03, GM.yel, 10.5, 2.3, 0.17); box(w, 1.3, 0.8, 0.03, GM.blue, 10.5, 2.75, 0.19); box(w, 1.3, 0.3, 0.03, GM.red, 10.5, 1.75, 0.19);
    cylZ(w, 0.32, 0.05, GM.white, 3.5, 3.6, 0.19, 20); cylZ(w, 0.34, 0.03, GM.dark, 3.5, 3.6, 0.17, 20); box(w, 0.03, 0.22, 0.02, GM.dark, 3.5, 3.68, 0.22); box(w, 0.16, 0.03, 0.02, GM.dark, 3.56, 3.6, 0.22);
    // workbench with a vice, oil drums, a compressor, an extinguisher
    rbox(w, 2.6, 0.08, 0.8, 0.02, GM.wood, -13.2 + 0.0, 0.92, 0.7, 0.01); [[-14.4, 0.4], [-14.4, 1.0], [-12.0, 0.4], [-12.0, 1.0]].forEach(([x, z]) => box(w, 0.07, 0.9, 0.07, GM.greyD, x + 0.0, 0.45, z));
    rbox(w, 0.25, 0.2, 0.2, 0.03, GM.blueD, -12.4, 1.06, 0.7, 0.01); box(w, 0.3, 0.05, 0.05, GM.chrome, -12.4, 1.2, 0.85);
    [[-6.2, 0.6], [-5.5, 0.7]].forEach(([x, z]) => { cylY(w, 0.3, 0.9, GM.blue, x, 0.45, z, 16); cylY(w, 0.31, 0.04, GM.blueD, x, 0.3, z, 16); cylY(w, 0.31, 0.04, GM.blueD, x, 0.65, z, 16); });
    cylX(w, 0.32, 1.4, GM.red, 14.6, 0.5, 0.7, 16); rbox(w, 0.5, 0.35, 0.4, 0.04, GM.dark, 14.4, 1.0, 0.7, 0.02); cylZ(w, 0.14, 0.06, GM.dark, 14.9, 1.05, 0.95, 12);
    cylY(w, 0.11, 0.55, GM.red, 7.8, 0.6, 0.3, 12); cylY(w, 0.04, 0.1, MT.black, 7.8, 0.92, 0.3, 8);
    cylZ(w, 0.3, 0.12, GM.yel, 0.8, 2.8, 0.25, 16); cylZ(w, 0.18, 0.13, GM.dark, 0.8, 2.8, 0.25, 12); // air hose reel
  }
  // tyres stored on racks behind the tyre machines (instanced)
  { const ty = new THREE.CylinderGeometry(0.33, 0.33, 0.2, 14); ty.rotateX(Math.PI / 2); const pts = [];
    for (let i = 0; i < 14; i++) for (let j = 0; j < 2; j++) if (j === 0 || i % 5) pts.push([-1.6 + i * 0.245, 0.42 + j * 0.75]);
    instanced(g, ty, pts.length, (i, dd) => { const [u, y] = pts[i]; const [x, z] = Q(0.5 + u, -15.15); dd.position.set(x, y, z); dd.rotation.set(0, YAW + Math.PI / 2, 0); dd.scale.set(1, 1, 1); return 0x1d1f26; });
    const r = at(g, 0.5, -15.1); [0.0, 0.75].forEach((y) => box(r, 3.8, 0.05, 0.5, GM.greyD, 0, y + 0.06, 0)); [-1.9, 1.9].forEach((x) => box(r, 0.06, 1.6, 0.5, GM.greyD, x, 0.8, 0));
  }
  // end walls and partitions
  { const w = at(g, -27.1, -9.35, ALONG_D); box(w, 12.8, 5.2, 0.3, GM.wall, 0, 2.6, 0); box(w, 12.9, 0.6, 0.34, GM.blue, 0, 4.75, 0); box(w, 4.2, 1.3, 0.32, GM.glassT, 0.5, 1.9, 0); box(w, 4.3, 0.08, 0.36, GM.dark, 0.5, 1.25, 0); }
  { const w = at(g, 16.6, -9.35, ALONG_D); box(w, 12.8, 5.2, 0.3, GM.wall, 0, 2.6, 0); box(w, 12.9, 0.6, 0.34, GM.blue, 0, 4.75, 0); [-3, 1].forEach((x) => box(w, 2.2, 1.2, 0.32, GM.glassT, x, 2.6, 0)); }
  [-14.75, -4.5, 5.5].forEach((h) => { const w = at(g, h, -14.0, ALONG_D); box(w, 3.2, 1.4, 0.15, GM.wallW, 0, 0.7, 0); box(w, 3.3, 0.1, 0.2, GM.blue, 0, 1.43, 0); });
  // ---- the waiting room, open on top so we can look in
  { const w = at(g, -32.75, -13.2); box(w, 9.7, 3.2, 0.25, GM.wallW, 0, 1.6, 0); box(w, 9.8, 0.45, 0.3, GM.blue, 0, 3.0, 0);
    rbox(w, 3.6, 0.8, 0.16, 0.08, GM.blue, -2.5, 3.7, 0.1, 0.02); decal(w, 'ACCUEIL', 3.2, 0.6, '#ffffff', -2.5, 3.7, 0.19, null);
    box(w, 1.4, 1.0, 0.03, GM.yel, 2.2, 1.9, 0.14); box(w, 1.1, 0.4, 0.03, GM.red, 2.2, 2.0, 0.16); cylZ(w, 0.12, 0.05, MT.black, 1.85, 1.65, 0.16, 12); cylZ(w, 0.12, 0.05, MT.black, 2.55, 1.65, 0.16, 12); // car poster
    // the coffee machine, a water fountain
    rbox(w, 0.7, 1.75, 0.55, 0.05, GM.coffee, 3.6, 0.88, 0.45, 0.02); rbox(w, 0.56, 0.7, 0.03, 0.03, MT.black, 3.6, 1.25, 0.735, 0.01); box(w, 0.3, 0.12, 0.02, std(0x6ab0ff, 0.3, 0, { emissive: 0x3a7aff, emissiveIntensity: 0.6 }), 3.6, 1.45, 0.75);
    for (let i = 0; i < 4; i++) sph(w, 0.03, GM.white, 3.42 + i * 0.12, 1.2, 0.75); rbox(w, 0.34, 0.3, 0.12, 0.03, MT.black, 3.6, 0.6, 0.68, 0.01); cylY(w, 0.05, 0.1, GM.white, 3.6, 0.53, 0.68, 12);
    decal(w, 'CAFÉ', 0.5, 0.14, '#ffd896', 3.6, 1.7, 0.725, null);
    rbox(w, 0.4, 1.0, 0.35, 0.04, GM.white, 2.8, 0.5, 0.3, 0.02); cylY(w, 0.15, 0.4, GM.water, 2.8, 1.2, 0.3, 14);
    // chairs, a low table with magazines, a toy box
    for (let i = 0; i < 4; i++) { const c = chair(w, -3.6 + i * 0.6, 0.55); c.rotation.y = -Math.PI / 2; }
    rbox(w, 1.0, 0.06, 0.55, 0.02, GM.wood, -2.6, 0.38, 1.8, 0.01); box(w, 0.06, 0.36, 0.06, GM.woodD, -3.0, 0.18, 1.6); box(w, 0.06, 0.36, 0.06, GM.woodD, -2.2, 0.18, 2.0);
    [[-2.8, 1.75, GM.red], [-2.45, 1.85, GM.blue], [-2.6, 1.7, GM.yel]].forEach(([x, z, m], i) => { const b = box(w, 0.28, 0.02, 0.2, m, x, 0.42 + i * 0.015, z); b.rotation.y = i * 0.4; });
    rbox(w, 0.7, 0.4, 0.5, 0.04, GM.yel, 0.9, 0.2, 3.0, 0.02); [[0.8, GM.red], [1.0, GM.blue], [0.9, GM.green]].forEach(([x, m], i) => rbox(w, 0.16, 0.16, 0.16, 0.03, m, x, 0.48 + i * 0.05, 3.0 + (i - 1) * 0.12, 0.01));
    plant(w, -4.5, 0.6, 1.4); plant(w, 4.4, 3.5, 1.1);
  }
  { const w = at(g, -37.65, -8.6, ALONG_D); box(w, 9.4, 3.2, 0.25, GM.wallW, 0, 1.6, 0); box(w, 9.5, 0.45, 0.3, GM.blue, 0, 3.0, 0);
    // reception desk and the receptionist
    const dk = grp(w, 2.6, 0, -1.6); rbox(dk, 2.0, 1.05, 0.55, 0.04, GM.wood, 0, 0.53, 0, 0.02); rbox(dk, 2.1, 0.05, 0.65, 0.02, GM.white, 0, 1.08, 0, 0.01); rbox(dk, 0.5, 0.36, 0.04, 0.02, GM.dark, 0.3, 1.32, -0.15, 0.01); }
  { const w = at(g, -32.75, -3.9); box(w, 9.7, 0.3, 0.2, GM.wallW, 0, 0.15, 0); box(w, 9.7, 2.5, 0.04, GM.glassT, 0, 1.55, 0); box(w, 9.8, 0.3, 0.25, GM.blue, 0, 2.95, 0);
    for (let x = -4.8; x <= 4.81; x += 1.6) box(w, 0.07, 2.8, 0.1, GM.dark, x, 1.45, 0); box(w, 1.1, 0.35, 0.03, GM.yel, 3.4, 2.6, 0.08); }
  { const w = at(g, -27.9, -8.6, ALONG_D); box(w, 9.4, 0.3, 0.2, GM.wallW, 0, 0.15, 0); }
  // ---- tyre stack and sign between the workshop and the car wash; a tyre-pressure post at the station
  { const ty = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14); const pts = [];
    [[17.6, -4.5], [18.4, -5.4], [17.8, -6.4], [18.6, -3.6]].forEach(([h, d], k) => { const n = 3 + (k % 3); for (let i = 0; i < n; i++) pts.push([h, d, 0.11 + i * 0.23]); });
    [[-29.5, 8.4], [-29.0, 8.9]].forEach(([h, d]) => { for (let i = 0; i < 3; i++) pts.push([h, d, 0.11 + i * 0.23]); });
    instanced(g, ty, pts.length, (i, dd) => { const [h, d, y] = pts[i]; const [x, z] = Q(h, d); dd.position.set(x, y, z); dd.rotation.set(0, rnd(0, 3), 0); dd.scale.set(1, 1, 1); return 0x1d1f26; });
    const s = at(g, 18.1, -7.6); cylY(s, 0.06, 2.4, GM.greyD, 0, 1.2, 0, 8); rbox(s, 1.6, 0.6, 0.08, 0.04, GM.yel, 0, 2.5, 0, 0.02); decal(s, 'PNEUS', 1.4, 0.45, '#2a2f40', 0, 2.5, 0.05, null); }
  { const s = at(g, 34.5, 1.2); rbox(s, 0.4, 1.4, 0.3, 0.06, GM.blue, 0, 0.7, 0, 0.02); cylZ(s, 0.12, 0.04, GM.white, 0, 1.15, 0.16, 14); add(s, new THREE.TorusGeometry(0.16, 0.025, 6, 14), MT.black, 0.25, 0.7, 0.1); }
  // ---- the price sign of the station, by the road
  { const s = at(g, 37, 10.2); rbox(s, 0.5, 4.6, 0.5, 0.06, GM.white, 0, 2.3, 0, 0.02); rbox(s, 1.8, 2.4, 0.3, 0.06, GM.green, 0, 4.2, 0, 0.02);
    [3.7, 4.3, 4.9].forEach((y, i) => { box(s, 1.5, 0.4, 0.02, GM.dark, 0, y, 0.16); box(s, 0.3, 0.3, 0.02, [GM.yel, GM.green, GM.blue][i], -0.5, y, 0.175); }); }
  // ---- along the street: lamps, a bus stop with its bench, bins, bollards, a hydrant
  for (let h = -40; h <= 40; h += 13) { const [x, z] = Q(h, 9.7); lamp(g, x, z, YAW + Math.PI / 2); }
  { const b = at(g, -4.5, 9.9); rbox(b, 3.0, 0.08, 1.2, 0.03, GM.greyD, 0, 2.4, 0, 0.01); box(b, 3.0, 2.2, 0.04, GM.glassT, 0, 1.25, -0.55); [-1.45, 1.45].forEach((x) => box(b, 0.07, 2.4, 0.07, GM.greyD, x, 1.2, -0.55));
    rbox(b, 2.2, 0.06, 0.4, 0.02, GM.wood, 0, 0.45, -0.3, 0.01); [-0.9, 0.9].forEach((x) => box(b, 0.05, 0.45, 0.35, GM.greyD, x, 0.22, -0.3)); cylY(b, 0.05, 2.6, GM.greyD, 1.8, 1.3, -0.5, 8); rbox(b, 0.6, 0.6, 0.06, 0.04, GM.blue, 1.8, 2.5, -0.5, 0.02); }
  [[-20, 9.5], [8, 9.5], [-36, 9.5]].forEach(([h, d]) => { const b = at(g, h, d); rbox(b, 0.5, 0.9, 0.5, 0.06, GM.green, 0, 0.45, 0, 0.02); rbox(b, 0.56, 0.06, 0.56, 0.02, GM.dark, 0, 0.92, 0, 0.01); });
  for (let h = -8; h <= 6; h += 2) { const b = at(g, h, 9.4); cylY(b, 0.08, 0.7, GM.greyD, 0, 0.35, 0, 8); cylY(b, 0.085, 0.08, GM.white, 0, 0.55, 0, 8); }
  { const b = at(g, 20.5, 9.6); cylY(b, 0.15, 0.6, GM.red, 0, 0.3, 0, 12); sph(b, 0.15, GM.red, 0, 0.62, 0); cylX(b, 0.06, 0.4, GM.red, 0, 0.4, 0, 8); }
  // ---- cars parked in front of the waiting room, two cars waiting for their turn
  [[-36, 4.6, 0x3aa46a], [-31.5, 4.6, 0xf2f2f6]].forEach(([h, d, c]) => { const C = car(at(g, h, d, YAW + Math.PI / 2), { color: c, lite: true }); void C; });
  { const C = car(at(g, 8.5, 1.2, YAW), { color: 0x8a5ad8, lite: true }); void C; }
  // ---- little houses across the street, with their gardens
  [[-34, 0xf1e6d2, 0xc0583a], [-22, 0xe8d8b8, 0x4c5468], [-8, 0xf4ecdc, 0xc0583a], [6, 0xe6cfb0, 0xb8583a], [20, 0xf1e6d2, 0x4c5468], [32, 0xe8d8b8, 0xc0583a]].forEach(([h, wc, rc], i) => house(g, h, 28.5 + (i % 2) * 0.8, wc, rc));
  for (let h = -40; h <= 38; h += 2.4) { const f = at(g, h, 24.2); box(f, 0.08, 0.8, 0.08, GM.white, 0, 0.4, 0); box(f, 2.4, 0.08, 0.05, GM.white, 1.2, 0.65, 0); box(f, 2.4, 0.08, 0.05, GM.white, 1.2, 0.35, 0); }
  // ---- trees, hedges, flowers behind and around
  for (let h = -36; h <= 36; h += 6) { const w = at(g, h, -17.4); rbox(w, 5.4, 1.0, 0.9, 0.3, GM.hedge, 0, 0.5, 0, 0.05); }
  [[-40, -16], [-30, -20], [-18, -21], [-6, -20], [6, -21], [18, -20], [30, -19], [40, -14], [-44, -6], [-43, 4], [44, -2], [42, 14], [-28, 32.5], [-15, 33], [13, 32.5], [26, 32], [-2, 33]].forEach(([h, d], i) => roundTree(g, h, d, 0.9 + (i % 3) * 0.12));

  // ---- the family waiting in the waiting room (static), the kid at the window (moves a little)
  { const [x, z] = Q(-30.5, -4.6); KID = P(g, 0, 0, { top: 0xf07aa8, bottom: 0x2a3550, kid: true }); KID.position.set(x, 0, z); KID.rotation.y = Math.atan2(-S2, S2); KID.userData.dynamic = true; }
  { const [x, z] = Q(-35.75, -12.65); const mum = P(g, x, z, { top: 0xa45ad8, bottom: 0x2a3550 }); sit(mum); mum.position.y = -0.18; mum.rotation.y = Math.atan2(-S2, S2); mum.userData.arms[0].rotation.z = 0.9; mum.userData.arms[1].rotation.z = 0.9; rbox(mum, 0.22, 0.03, 0.3, 0.01, GM.red, 0.42, 0.62, 0, 0.005); }
  { const [x, z] = Q(-29.15, -12.0); const dad = P(g, x, z, { top: 0x24b6c8, bottom: 0x3a3a48 }); dad.rotation.y = Math.atan2(S2, -S2); dad.userData.arms[0].rotation.z = 0.9; cylY(dad, 0.045, 0.08, GM.white, 0.22, 0.6, 0.22, 10); STEAM = anchor(dad, 0.22, 0.75, 0.22); }
  { const [x, z] = Q(-36.95, -6.0); const rec = P(g, x, z, { top: 0xffffff, bottom: 0x2a3550 }); sit(rec); rec.position.y = -0.18; rec.rotation.y = Math.PI / 4; const c = chair(g, x, z, GM.dark); c.rotation.y = Math.PI / 4; }
  return g;
}

/* ================= life ================= */
function buildLife(scene, onUpdate, fx) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // cars on the street, both ways
  const road = R([[-46, 16.2], [46, 16.2], [48, 17.8], [46, 19.4], [-46, 19.4], [-48, 17.8]], 0.1);
  const cars = [0x2f7de0, 0xf2b21c, 0xf2f2f6, 0x3aa46a, 0xe5452c].map((c) => { const C = car(scene, { color: c, lite: true }); C.g.userData.wheels = null; return C.g; }); all.push(...cars);
  const t1 = traffic(road, cars, 4.2, { gap: 6 });
  // people on the pavements, crossing at the zebra crossings
  const walk = R([[-38, 10.3], [14, 10.3], [14, 21.8], [-38, 21.8]], 0.05);
  const folks = Array.from({ length: 6 }, (_, i) => P(scene, 0, 0, i === 2 ? { kid: true } : {})); all.push(...folks);
  const t2 = traffic(walk, folks, 1.2, { gap: 1.6 });
  // a mechanic going back and forth in front of the workshop
  const yard = R([[-26, -1.5], [2, -1.5], [2, 0.2], [-26, 0.2]], 0.2);
  const mechs = [mech(scene, 0, 0)]; all.push(...mechs);
  const t3 = traffic(yard, mechs, 1.0, { gap: 1.5 });
  let T = 0, sT = 0;
  onUpdate((dt) => {
    T += dt; t1.update(dt, all); t2.update(dt, all); t3.update(dt, all);
    if (KID) { KID.position.y = Math.abs(Math.sin(T * 2.2)) * 0.08; KID.userData.arms[0].rotation.z = 2.4 + Math.sin(T * 6) * 0.4; }
    sT -= dt; if (STEAM && sT <= 0) { sT = 0.5; fx.smoke(wp(STEAM), new V3(0, 0.35, 0), 0.06, 0xf4f4f4, 1.4); }
  });
}
