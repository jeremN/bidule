// Les Secours — a small French town with its fire station, police station and hospital.
// Everybody here helps: the big ladder saves a cat, the pump truck puts out a bin fire, the ambulances take care of people,
// the police help children cross and guide the traffic, the helicopter lands at the hospital and the boat fishes a ball out of the river.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { tire, fender, hydraulic } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp, autumnTree } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { body, skin, plate, fin, decal, hatch, AM } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };

/* ---------- textures and materials (defined once) ---------- */
function canvasTex(w, h, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
const diag = (a, b) => (x) => { x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.fillStyle = b; for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 16, 64); x.lineTo(i + 80, 0); x.lineTo(i + 64, 0); x.closePath(); x.fill(); } };
const chevTex = canvasTex(64, 64, diag('#f6d21c', '#d8202a'), 2);
const shutTex = canvasTex(32, 32, (x) => { x.fillStyle = '#d3d7df'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#9aa1ae'; for (let y = 0; y < 32; y += 4) x.fillRect(0, y, 32, 1); }, 2);
const brickT = canvasTex(128, 64, (x) => {
  x.fillStyle = '#d8cfc6'; x.fillRect(0, 0, 128, 64);
  for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { x.fillStyle = pick(['#b8432c', '#a93a26', '#c24d33', '#9c3824']); x.fillRect(c * 32 + (r % 2 ? 16 : 0) + 1, r * 8 + 1, 30, 6); }
}, 0.5);
const awn = (a, b) => canvasTex(64, 16, (x) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 8, 0, 8, 16); } });
const SM = {
  red: std(0xc81e28, 0.36, 0.25), redD: std(0x8e141c, 0.5, 0.2), white: std(0xf4f5f8, 0.35, 0.1), cream: std(0xefe2c8, 0.85, 0),
  alu: std(0xc9ced8, 0.3, 0.75), aluD: std(0x9aa1ae, 0.35, 0.7), dark: std(0x2a2f40, 0.6, 0.15), black: MT.black, chrome: MT.chrome,
  glass: MT.glassD, yel: std(0xf2d21c, 0.35, 0.1), blue: std(0x1c3f9a, 0.35, 0.2), blueL: std(0x2f6fe0, 0.35, 0.2), orange: std(0xf2781c, 0.45, 0.1),
  helmet: std(0xe9ecf2, 0.22, 0.55), navy: std(0x1c2440, 0.6, 0.1), shut: std(0xffffff, 0.35, 0.6, { map: shutTex }), chev: std(0xffffff, 0.45, 0.1, { map: chevTex }),
  brick: std(0xffffff, 0.85, 0, { map: brickT }), stone: std(0xdcd1b8, 0.9, 0), stoneD: std(0xb3a88f, 0.9, 0), slate: std(0x4c5468, 0.6, 0.2), tile: std(0xb8583a, 0.8, 0),
  conc: std(0xc4c6ce, 0.9, 0), wood: std(0x8a5a3a, 0.8, 0), woodL: std(0xb98a55, 0.8, 0), green: std(0x2f7a4a, 0.6, 0), hedge: std(0x3f8a3a, 0.9, 0),
  water: std(0x4f8fe0, 0.15, 0.2), sand: std(0xe8d29a, 0.95, 0), cat: std(0xf0922a, 0.7, 0), duck: std(0xf6d23a, 0.6, 0), beak: std(0xf27a1c, 0.5, 0),
  dRed: std(0xd8262a, 0.32, 0.2), dYel: std(0xf6c21a, 0.32, 0.15), warm: new THREE.MeshBasicMaterial({ color: 0xffd896 }),
  awnR: std(0xffffff, 0.8, 0, { map: awn('#ffffff', '#d8402a') }), awnB: std(0xffffff, 0.8, 0, { map: awn('#ffffff', '#2f6fe0') }), awnG: std(0xffffff, 0.8, 0, { map: awn('#ffffff', '#2f9a5a') }),
  lens: std(0x8a8f9a, 0.3, 0.2), fr: AM.fr
};
const SHUT = [std(0x3f7fb8, 0.7, 0), std(0x4f9a6a, 0.7, 0), std(0xd8d0b8, 0.7, 0), std(0x6aa8c8, 0.7, 0), std(0xb8504a, 0.7, 0)];
const WALLS = [std(0xf1e6d2, 0.85, 0), std(0xe8d8b8, 0.85, 0), std(0xf4ecdc, 0.85, 0), std(0xe6cfb0, 0.85, 0), std(0xd8c8b0, 0.85, 0)];
/** Two blue lights that flash in turn. */
const blues = () => [0, 1].map(() => std(0x2a5cff, 0.3, 0, { emissive: 0x2a5cff, emissiveIntensity: 0.15 }));
const flash = (L, on, T, f = 13) => { const a = Math.sin(T * f) > 0; L[0].emissiveIntensity = on && a ? 2.8 : 0.15; L[1].emissiveIntensity = on && !a ? 2.8 : 0.15; };
/** "Pin-pon" two-tone siren; returns stop(). */
function siren(kind = 'pompiers', secs = 8) {
  const [a, b, d] = kind === 'police' ? [880, 660, 0.26] : kind === 'samu' ? [700, 525, 0.42] : [740, 587, 0.36];
  const play = () => { tone(a, 0, d * 0.92, 'triangle', 0.05); tone(b, d, d * 0.92, 'triangle', 0.05); };
  play(); const id = setInterval(play, d * 2000 + 30); const t = setTimeout(() => clearInterval(id), secs * 1000);
  return () => { clearInterval(id); clearTimeout(t); };
}
const whistle = () => { tone(2600, 0, 0.18, 'sine', 0.06, 2900); tone(2600, 0.24, 0.5, 'sine', 0.06, 2500); };
const meow = () => { tone(720, 0, 0.35, 'sine', 0.06, 980); tone(980, 0.3, 0.3, 'sine', 0.05, 640); };
const bake = (g) => { shadows(g); freeze(g); return g; };

/* ---------- people ---------- */
function pompier(p, x = 0, z = 0, o = {}) {
  const g = walker(p, x, z, { top: 0x23305a, bottom: 0x23305a, hat: SM.helmet, vest: o.vest, skin: o.skin });
  if (!o.vest) [0.6, 0.82].forEach((y) => rbox(g, 0.25, 0.045, 0.37, 0.02, SM.yel, 0, y, 0, 0.01));
  return g;
}
const policier = (p, x = 0, z = 0) => { const g = walker(p, x, z, { top: 0x2a3f7a, bottom: 0x1c2440, hat: SM.navy }); rbox(g, 0.25, 0.05, 0.37, 0.02, SM.white, 0, 0.66, 0, 0.01); return g; };
const sit = (g, legs = 1.45, arms = 1.0) => { g.children[0].rotation.z = legs; g.children[1].rotation.z = legs; g.userData.arms.forEach((a) => (a.rotation.z = arms)); return g; };
const stand = (g) => { g.children[0].rotation.z = 0; g.children[1].rotation.z = 0; g.userData.arms.forEach((a) => (a.rotation.z = 0)); return g; };
const lie = (g) => { stand(g); g.rotation.set(0, 0, Math.PI / 2); return g; };

/* ---------- small props ---------- */
function brancard(p, x = 0, y = 0, z = 0, M) {
  const g = grp(p, x, y, z);
  rbox(g, 2.0, 0.07, 0.62, 0.03, SM.alu, 0, 0.7, 0, 0.01); rbox(g, 1.9, 0.12, 0.56, 0.05, M || SM.orange, 0, 0.79, 0, 0.02);
  rbox(g, 0.4, 0.1, 0.46, 0.05, SM.white, -0.72, 0.88, 0, 0.02);
  [1, -1].forEach((s) => {
    rod(g, new V3(0.7, 0.68, s * 0.24), new V3(-0.62, 0.12, s * 0.24), 0.025, SM.alu, 6); rod(g, new V3(-0.7, 0.68, s * 0.24), new V3(0.62, 0.12, s * 0.24), 0.025, SM.alu, 6);
    box(g, 0.3, 0.03, 0.03, SM.black, s * 1.12, 0.7, 0.26); box(g, 0.3, 0.03, 0.03, SM.black, s * 1.12, 0.7, -0.26);
    [0.65, -0.65].forEach((xx) => cylZ(g, 0.07, 0.05, SM.black, xx, 0.07, s * 0.24, 10));
  });
  shadows(g); return g;
}
function kitty(p) {
  const g = grp(p), M = SM.cat;
  sph(g, 1, M, 0, 0.2, 0).scale.set(0.3, 0.17, 0.16); sph(g, 0.14, M, 0.27, 0.36, 0);
  [0.06, -0.06].forEach((z) => { const e = add(g, new THREE.ConeGeometry(0.05, 0.1, 4), M, 0.29, 0.5, z); e.rotation.x = z * 2; sph(g, 0.025, MT.black, 0.39, 0.39, z); });
  sph(g, 0.03, std(0xf07a9a, 0.6, 0), 0.41, 0.34, 0);
  [[0.15, 0.08], [0.15, -0.08], [-0.15, 0.08], [-0.15, -0.08]].forEach(([x, z]) => cylY(g, 0.035, 0.16, M, x, 0.08, z, 6));
  rod(g, new V3(-0.26, 0.24, 0), new V3(-0.42, 0.42, 0), 0.03, M, 6); rod(g, new V3(-0.42, 0.42, 0), new V3(-0.38, 0.6, 0), 0.03, M, 6);
  shadows(g); return g;
}
function duck(p, s = 1, M = SM.duck) {
  const g = grp(p); sph(g, 1, M, 0, 0.12, 0).scale.set(0.24, 0.13, 0.15); sph(g, 0.1, M, 0.16, 0.3, 0);
  const b = sph(g, 1, SM.beak, 0.27, 0.28, 0); b.scale.set(0.07, 0.025, 0.05); [0.05, -0.05].forEach((z) => sph(g, 0.018, MT.black, 0.23, 0.33, z));
  g.scale.setScalar(s); shadows(g); return g;
}
function ballon(p) { const g = grp(p); sph(g, 0.24, SM.red, 0, 0, 0); const b = add(g, new THREE.TorusGeometry(0.24, 0.035, 6, 20), SM.white); b.rotation.y = Math.PI / 2; const b2 = add(g, new THREE.TorusGeometry(0.24, 0.035, 6, 20), SM.yel); b2.rotation.x = Math.PI / 2; shadows(g); return g; }
function bench(p, x, z, ry) {
  const g = grp(p, x, 0, z); g.rotation.y = ry || 0;
  [0.75, -0.75].forEach((xx) => { box(g, 0.08, 0.45, 0.45, SM.dark, xx, 0.23, 0); box(g, 0.08, 0.5, 0.06, SM.dark, xx, 0.7, -0.22); });
  [0.08, -0.08].forEach((zz) => rbox(g, 1.8, 0.05, 0.14, 0.02, SM.woodL, 0, 0.47, zz, 0.01));
  [0.6, 0.78].forEach((yy) => rbox(g, 1.8, 0.1, 0.04, 0.02, SM.woodL, 0, yy, -0.24, 0.01));
  shadows(g); return g;
}
function wheelieBin(p, x, z, ry, M) {
  const g = grp(p, x, 0, z); g.rotation.y = ry || 0; const C = M || SM.green;
  rbox(g, 0.62, 0.86, 0.66, 0.06, C, 0, 0.53, 0, 0.02); const lid = grp(g, -0.33, 0.97, 0); rbox(lid, 0.72, 0.06, 0.72, 0.04, C, 0.36, 0, 0, 0.01);
  box(g, 0.06, 0.06, 0.6, SM.dark, -0.34, 0.9, 0); [0.28, -0.28].forEach((zz) => cylZ(g, 0.11, 0.06, SM.black, -0.28, 0.11, zz, 10));
  shadows(g); return { g, lid };
}
function roundTree(p, x, z, s = 1, cols = [0x4a9a4a, 0x3f8a3a, 0x5aa85a]) {
  const g = grp(p, x, 0, z); cylY(g, 0.18 * s, 2.6 * s, 0x6b4a32, 0, 1.3 * s, 0, 8);
  for (let i = 0; i < 6; i++) { const m = add(g, ICO, pick(cols), rnd(-0.9, 0.9) * s, rnd(2.9, 4.0) * s, rnd(-0.9, 0.9) * s); m.scale.setScalar(rnd(0.9, 1.3) * s); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  shadows(g); return g;
}

/* ================= vehicles ================= */
/** French fire-engine crew cab (4 doors), front at x0 + 2.55, floor at y = 1.05. */
function fireCab(p, x0, L, label = 'POMPIERS') {
  const g = grp(p, x0, 1.05, 0), W = 2.45, M = SM.red;
  ext(g, [[0, 0], [2.45, 0], [2.56, 0.55], [2.5, 1.05], [2.32, 2.0], [2.12, 2.18], [0, 2.18]], [0.04, 0.08, 0.1, 0.12, 0.2, 0.16, 0.06], W, M, 0, 0, 0, 0.04);
  rbox(g, 2.1, 0.07, W - 0.12, 0.04, SM.white, 1.02, 2.19, 0, 0.02); // white roof
  const ws = box(g, 0.04, 0.9, W - 0.28, SM.glass, 2.435, 1.53, 0); ws.rotation.z = 0.185;
  box(g, 0.05, 0.06, W - 0.2, SM.black, 2.33, 2.0, 0);
  [1, -1].forEach((s) => {
    const Z = s * (W / 2 + 0.006);
    rbox(g, 0.92, 0.66, 0.03, 0.06, SM.glass, 1.76, 1.5, Z, 0.01); rbox(g, 0.82, 0.6, 0.03, 0.06, SM.glass, 0.62, 1.5, Z, 0.01);
    [2.3, 1.2, 0.06].forEach((x) => box(g, 0.025, 1.85, 0.03, SM.redD, x, 0.98, s * (W / 2 + 0.01)));
    [1.3, 0.18].forEach((x) => box(g, 0.14, 0.035, 0.04, SM.chrome, x, 1.08, s * (W / 2 + 0.03)));
    rod(g, new V3(2.3, 1.75, s * 1.2), new V3(2.62, 1.86, s * 1.48), 0.025, SM.black); rbox(g, 0.07, 0.44, 0.2, 0.03, SM.black, 2.64, 1.7, s * 1.5, 0.01); rbox(g, 0.06, 0.16, 0.16, 0.03, SM.black, 2.64, 1.36, s * 1.46, 0.01);
    rbox(g, 0.5, 0.06, 0.3, 0.02, SM.black, 0.5, -0.2, s * 1.1, 0.01); rbox(g, 0.5, 0.06, 0.3, 0.02, SM.black, 0.5, -0.55, s * 1.1, 0.01); // crew steps
    rbox(g, 0.06, 0.18, 0.36, 0.04, MT.lamp, 2.57, 0.36, s * 0.8, 0.01); rbox(g, 0.06, 0.12, 0.14, 0.03, MT.amber, 2.57, 0.36, s * 1.07, 0.01);
    box(g, 2.5, 0.13, 0.02, SM.yel, 1.24, 0.2, s * (W / 2 + 0.008)); // reflective band
    const D = grp(g); if (s < 0) D.rotation.y = Math.PI; decal(D, label, 0.95, 0.19, '#ffffff', s * 1.76, 0.62, W / 2 + 0.012, null);
    rbox(g, 0.12, 0.16, 0.3, 0.04, L[s > 0 ? 0 : 1], 2.57, 0.82, s * 0.85, 0.01); // grille flashers
  });
  rbox(g, 0.08, 0.36, 1.3, 0.04, SM.black, 2.55, 0.62, 0, 0.01); for (let i = 0; i < 4; i++) box(g, 0.02, 0.03, 1.2, SM.chrome, 2.6, 0.5 + i * 0.08, 0);
  rbox(g, 0.3, 0.3, W + 0.04, 0.06, SM.dark, 2.62, -0.18, 0, 0.02);
  { const t = decal(g, 'POMPIERS', 1.5, 0.22, '#ffffff', 2.535, 0.93, 0, null); t.rotation.y = Math.PI / 2; }
  // roof light bar
  rbox(g, 0.36, 0.08, 1.9, 0.03, SM.dark, 1.75, 2.26, 0, 0.01);
  [0.55, -0.55].forEach((z, i) => rbox(g, 0.32, 0.15, 0.55, 0.05, L[i], 1.75, 2.36, z, 0.02)); rbox(g, 0.3, 0.12, 0.5, 0.04, SM.white, 1.75, 2.35, 0, 0.02);
  return g;
}
/** Wheel set: [x, R, w, zAbs] → tyres in `wheels`, black fenders. */
function axles(m, list, wheels, rim = SM.alu) {
  list.forEach(([x, R, w, zz, fend]) => [1, -1].forEach((s) => { wheels.push(tire(m, R, w, x, R, s * zz, rim, s, MT.rubber)); if (fend) fender(m, R + 0.1, w + 0.06, x, R, s * zz, SM.dark, Math.PI * 0.6); }));
}
/** A truss ladder section along +x (bottom chords at y = 0). */
function ladderTruss(g, L, w, h) {
  [1, -1].forEach((s) => {
    box(g, L, 0.07, 0.06, SM.alu, L / 2, 0, s * w / 2); box(g, L, 0.05, 0.05, SM.alu, L / 2, h, s * w / 2);
    for (let x = 0.1; x < L; x += 0.52) { box(g, 0.035, h, 0.035, SM.aluD, x, h / 2, s * w / 2); if (x + 0.52 < L) rod(g, new V3(x, 0.02, s * w / 2), new V3(x + 0.52, h - 0.02, s * w / 2), 0.014, SM.aluD, 4); }
  });
  for (let x = 0.14; x < L; x += 0.3) cylZ(g, 0.022, w, SM.aluD, x, 0.03, 0, 6);
}

/** EPA (échelle pivotante automatique): turntable ladder truck. */
function epa(S) {
  const m = grp(S), d = grp(m), L = blues();
  [0.42, -0.42].forEach((z) => rbox(d, 7.4, 0.28, 0.16, 0.03, SM.black, -0.3, 0.82, z));
  fireCab(d, 1.0, L);
  rbox(d, 4.95, 0.9, 2.45, 0.1, SM.red, -1.55, 1.55, 0, 0.03); // low locker body x −4.03..0.92
  [1, -1].forEach((s) => {
    [-3.35, -2.05, -0.75].forEach((x) => { rbox(d, 1.2, 0.6, 0.03, 0.04, SM.shut, x, 1.6, s * 1.235, 0.01); box(d, 0.3, 0.035, 0.04, SM.chrome, x, 1.3, s * 1.25); });
    box(d, 4.9, 0.12, 0.02, SM.yel, -1.55, 1.17, s * 1.232); rbox(d, 4.9, 0.06, 0.1, 0.02, SM.alu, -1.55, 1.98, s * 1.2, 0.01);
    rbox(d, 0.05, 0.16, 0.26, 0.02, MT.tail, -4.06, 1.3, s * 0.9, 0.01); rbox(d, 0.05, 0.1, 0.18, 0.02, MT.amber, -4.06, 1.48, s * 0.9, 0.01);
    rbox(d, 0.16, 0.12, 0.3, 0.04, L[s > 0 ? 1 : 0], -3.9, 2.06, s * 1.05, 0.02);
  });
  box(d, 0.03, 0.5, 1.5, SM.chev, -4.05, 1.55, 0); rbox(d, 0.2, 0.18, 2.4, 0.04, SM.dark, -4.1, 0.85, 0, 0.02);
  rbox(d, 0.18, 0.5, 0.9, 0.04, SM.redD, 2.0, 3.45, 0, 0.02); // ladder rest on the cab roof
  cylY(d, 1.0, 0.18, SM.dark, -2.7, 2.08, 0, 24);
  bake(d);
  const wheels = []; axles(m, [[2.3, 0.5, 0.36, 0.98, false], [-2.4, 0.5, 0.48, 0.92, true]], wheels);
  // four stabiliser legs
  const outs = [];
  [0.6, -3.7].forEach((x) => [1, -1].forEach((s) => {
    const og = grp(m, x, 0.8, 0); if (s > 0) rbox(og, 0.32, 0.24, 2.2, 0.04, SM.dark, 0, 0, 0, 0.02);
    const bm = grp(og); rbox(bm, 0.22, 0.18, 1.1, 0.03, SM.redD, 0, 0, s * 0.62, 0.02);
    const jk = grp(bm, 0, 0, s * 1.18); cylY(jk, 0.1, 0.42, SM.red, 0, 0.05, 0, 12); box(jk, 0.21, 0.08, 0.21, SM.yel, 0, 0.2, 0);
    const rodM = cylY(jk, 0.065, 1, SM.chrome, 0, 0, 0, 10); const foot = grp(jk); rbox(foot, 0.44, 0.06, 0.44, 0.03, SM.dark, 0, -0.03, 0, 0.01);
    outs.push({ bm, rodM, foot, s });
  }));
  const setOut = (k) => { const a = clamp(k * 2, 0, 1), b = clamp(k * 2 - 1, 0, 1); outs.forEach((o) => { o.bm.position.z = o.s * 0.85 * a; const y = -0.2 - 0.54 * b; o.foot.position.y = y; o.rodM.scale.y = -y; o.rodM.position.y = y / 2; }); };
  setOut(0);
  // turntable with its control stand, the ladder and the cage
  const tt = grp(m, -2.7, 2.17, 0), td = grp(tt);
  cylY(td, 0.95, 0.14, SM.red, 0, 0.07, 0, 24);
  [0.5, -0.5].forEach((z) => ext(td, [[-0.6, 0.1], [0.9, 0.1], [0.5, 1.62], [0.1, 1.62]], 0.08, 0.12, SM.red, 0, 0, z, 0.02));
  rbox(td, 0.36, 0.95, 0.3, 0.04, SM.dark, -0.6, 0.6, 0.66, 0.02); rbox(td, 0.06, 0.25, 0.26, 0.02, SM.alu, -0.42, 0.95, 0.66, 0.01);
  [0.08, -0.08].forEach((z) => sph(td, 0.03, z > 0 ? MT.tail : std(0x3aff7a, 0.4, 0, { emissive: 0x2ad04a, emissiveIntensity: 0.6 }), -0.38, 1.0, 0.66 + z));
  const op = pompier(td, -0.95, 0.66); op.position.y = 0.14; op.scale.setScalar(0.85);
  bake(td);
  const elev = grp(tt, 0.3, 1.55, 0);
  const LS = 5.2, secs = []; let par = elev;
  for (let i = 0; i < 4; i++) { const g = grp(par, i ? 0.15 : 0, i ? 0.05 : 0, 0); const sd = grp(g); ladderTruss(sd, LS, 0.92 - i * 0.1, 0.38 - i * 0.04); if (i === 0) { [1, -1].forEach((s) => rbox(sd, 1.6, 0.36, 0.04, 0.02, SM.red, 0.9, 0.18, s * 0.48, 0.01)); } bake(sd); secs.push(g); par = g; }
  const cageA = grp(secs[3], LS, 0.02, 0), cage = grp(cageA), cd = grp(cage);
  rbox(cd, 0.3, 0.38, 0.5, 0.04, SM.dark, 0.06, -0.18, 0, 0.02);
  rbox(cd, 1.0, 0.08, 1.2, 0.03, SM.dark, 0.66, -0.38, 0, 0.01);
  [[0.18, 0.58], [0.18, -0.58], [1.14, 0.58], [1.14, -0.58]].forEach(([x, z]) => box(cd, 0.05, 1.0, 0.05, SM.alu, x, 0.12, z));
  rail(cd, [[0.18, 0.62, 0.58], [1.14, 0.62, 0.58], [1.14, 0.62, -0.58], [0.18, 0.62, -0.58]], 0.03, SM.alu);
  rbox(cd, 0.04, 0.5, 1.18, 0.02, SM.red, 1.15, -0.1, 0, 0.01); [0.6, -0.6].forEach((z) => rbox(cd, 0.98, 0.5, 0.04, 0.02, SM.red, 0.66, -0.1, z, 0.01));
  box(cd, 0.05, 0.08, 1.2, SM.white, 1.17, 0.08, 0); [0.62, -0.62].forEach((z) => box(cd, 0.98, 0.08, 0.05, SM.white, 0.66, 0.08, z));
  bake(cd);
  const fig = pompier(cage, 0.62, 0); fig.position.y = -0.34; fig.scale.setScalar(0.85);
  const ram = hydraulic(tt, anchor(tt, 1.0, 0.25, 0), anchor(elev, 1.6, -0.12, 0), { barrel: 1.0, mat: SM.redD, rb: 0.1 });
  shadows(m);
  return { g: m, wheels, L, tt, elev, secs, cage, fig, ram, setOut, LS };
}

/** FPT (fourgon pompe-tonne): pump and water-tank truck with roller-shutter lockers. */
function fpt(S) {
  const m = grp(S), d = grp(m), L = blues();
  [0.42, -0.42].forEach((z) => rbox(d, 7.2, 0.28, 0.16, 0.03, SM.black, -0.3, 0.82, z));
  fireCab(d, 1.1, L);
  rbox(d, 4.75, 2.1, 2.45, 0.12, SM.red, -1.33, 2.15, 0, 0.03); // x −3.7..1.05
  const lockers = [];
  [1, -1].forEach((s) => {
    [-2.85, -1.35, 0.15].forEach((x, i) => {
      if (s > 0 && i === 1) { // the locker that opens: equipment inside, the shutter rolls up
        rbox(d, 1.32, 1.7, 0.02, 0.02, SM.dark, x, 2.15, 1.228, 0.005);
        [1.65, 2.55].forEach((y) => box(d, 1.3, 0.04, 0.06, SM.alu, x, y, 1.26));
        [-0.38, 0, 0.38].forEach((dx, k) => cylZ(d, 0.18, 0.08, k === 1 ? SM.white : SM.blueL, x + dx, 1.86, 1.27, 16));
        cylY(d, 0.07, 0.45, SM.red, x - 0.4, 2.8, 1.27, 10); sph(d, 1, SM.helmet, x + 0.1, 2.72, 1.25).scale.set(0.15, 0.11, 0.06); rbox(d, 0.3, 0.3, 0.08, 0.03, SM.yel, x + 0.42, 2.74, 1.27, 0.01);
        return;
      }
      rbox(d, 1.32, 1.7, 0.03, 0.04, SM.shut, x, 2.15, s * 1.235, 0.01); box(d, 0.35, 0.04, 0.05, SM.chrome, x, 1.36, s * 1.25);
    });
    box(d, 4.7, 0.13, 0.02, SM.yel, -1.33, 1.2, s * 1.232);
    const D = grp(d); if (s < 0) D.rotation.y = Math.PI; decal(D, 'SAPEURS-POMPIERS', 3.4, 0.18, '#ffffff', s * -1.33, 3.1, 1.237, null);
    rbox(d, 0.16, 0.12, 0.3, 0.04, L[s > 0 ? 1 : 0], -3.55, 3.27, s * 1.05, 0.02);
    rbox(d, 0.05, 0.18, 0.28, 0.02, MT.tail, -3.73, 1.35, s * 0.95, 0.01); rbox(d, 0.05, 0.1, 0.2, 0.02, MT.amber, -3.73, 1.56, s * 0.95, 0.01);
    rail(d, [[-3.5, 3.2, s * 1.15], [-3.5, 3.45, s * 1.15], [0.85, 3.45, s * 1.15], [0.85, 3.2, s * 1.15]], 0.025, SM.alu);
  });
  // rear: pump panel shutter, chevrons, bumper, the hose reel on its frame
  rbox(d, 0.03, 1.3, 2.2, 0.04, SM.shut, -3.715, 2.45, 0, 0.01); box(d, 0.03, 0.42, 2.3, SM.chev, -3.72, 1.48, 0);
  rbox(d, 0.22, 0.2, 2.42, 0.04, SM.dark, -3.85, 0.85, 0, 0.02);
  [0.95, -0.95].forEach((z) => { rod(d, new V3(-3.7, 1.55, z), new V3(-4.15, 1.75, z), 0.04, SM.dark, 6); rod(d, new V3(-3.7, 2.2, z), new V3(-4.15, 1.75, z), 0.04, SM.dark, 6); });
  // roof: walkway, ladder, black suction hoses
  rbox(d, 4.4, 0.04, 2.2, 0.02, SM.aluD, -1.33, 3.22, 0, 0.01);
  { const lg = grp(d, -1.4, 3.32, 0.5); [0.22, -0.22].forEach((z) => box(lg, 4.0, 0.06, 0.05, SM.alu, 0, 0, z)); for (let x = -1.85; x <= 1.9; x += 0.3) cylZ(lg, 0.02, 0.44, SM.alu, x, 0, 0, 6); }
  [-0.35, -0.62].forEach((z) => cylX(d, 0.12, 3.6, SM.black, -1.4, 3.36, z, 12));
  bake(d);
  const reel = grp(m, -4.15, 1.75, 0); { cylZ(reel, 0.62, 0.06, SM.red, 0, 0, 0.8, 20); cylZ(reel, 0.62, 0.06, SM.red, 0, 0, -0.8, 20); cylZ(reel, 0.48, 1.55, std(0xd8d4c8, 0.8, 0), 0, 0, 0, 18); cylZ(reel, 0.12, 1.75, SM.dark, 0, 0, 0, 10); for (let k = 0; k < 6; k++) { const s = grp(reel); s.rotation.z = (k / 6) * Math.PI * 2; box(s, 0.05, 0.62, 0.05, SM.redD, 0, 0.31, 0.8); box(s, 0.05, 0.62, 0.05, SM.redD, 0, 0.31, -0.8); } }
  const shutter = grp(m, -1.35, 3.0, 1.36); rbox(shutter, 1.32, 1.7, 0.03, 0.04, SM.shut, 0, -0.85, 0, 0.01); box(shutter, 0.35, 0.04, 0.05, SM.chrome, 0, -1.64, 0.015);
  const wheels = []; axles(m, [[2.4, 0.5, 0.36, 0.98, false], [-2.2, 0.5, 0.5, 0.92, true]], wheels);
  shadows(m);
  return { g: m, wheels, L, reel, shutter };
}

/** Panel van (Renault Master-like, high roof): ambulances. o: { body, band, band2, text, color, label } */
function van(S, o) {
  const m = grp(S), d = grp(m), B = o.body, L = blues(), W = 2.05;
  ext(d, [[-2.8, 0.45], [2.55, 0.45], [2.78, 0.72], [2.74, 1.2], [2.15, 1.42], [1.4, 2.32], [1.2, 2.72], [-2.8, 2.72]], [0.05, 0.1, 0.1, 0.18, 0.15, 0.2, 0.18, 0.06], W, B, 0, 0, 0, 0.04);
  const ws = box(d, 0.03, 1.08, W - 0.22, SM.glass, 1.83, 1.92, 0); ws.rotation.z = 0.695;
  [1, -1].forEach((s) => {
    const Z = s * (W / 2 + 0.006);
    rbox(d, 0.62, 0.5, 0.03, 0.06, SM.glass, 1.24, 1.82, Z, 0.01);
    [2.05, 0.82, -0.62, -1.9].forEach((x) => box(d, 0.025, 1.85, 0.03, SM.dark, x, 1.5, s * (W / 2 + 0.008)));
    rbox(d, 0.7, 0.42, 0.03, 0.06, std(0xe6ecf2, 0.3, 0.2), -0.05, 2.05, Z, 0.01);
    box(d, 0.14, 0.035, 0.04, SM.chrome, 0.95, 1.5, s * (W / 2 + 0.02));
    rod(d, new V3(1.95, 1.8, s * 1.02), new V3(2.2, 1.85, s * 1.25), 0.025, SM.black); rbox(d, 0.06, 0.38, 0.18, 0.03, SM.black, 2.22, 1.76, s * 1.27, 0.01);
    box(d, 5.5, 0.26, 0.02, o.band, -0.1, 1.0, s * (W / 2 + 0.006)); if (o.band2) box(d, 5.5, 0.08, 0.02, o.band2, -0.1, 0.8, s * (W / 2 + 0.007));
    const D = grp(d); if (s < 0) D.rotation.y = Math.PI; decal(D, o.text, 2.6, 0.4, o.color, s * -1.0, 1.55, W / 2 + 0.012, null);
    if (o.star) { const g = grp(d, -1.45, 2.3, s * (W / 2 + 0.01)); [0, 1, 2].forEach((k) => { const b = box(g, 0.1, 0.5, 0.012, o.star, 0, 0, 0); b.rotation.z = (k * Math.PI) / 3; }); }
    rbox(d, 0.06, 0.18, 0.32, 0.04, MT.lamp, 2.74, 0.95, s * 0.68, 0.01); rbox(d, 0.06, 0.12, 0.12, 0.03, MT.amber, 2.72, 0.95, s * 0.92, 0.01);
    rbox(d, 0.05, 0.4, 0.14, 0.02, MT.tail, -2.82, 1.05, s * 0.93, 0.01);
    rbox(d, 0.22, 0.12, 0.34, 0.04, L[s > 0 ? 0 : 1], 1.05, 2.78, s * 0.55, 0.02); rbox(d, 0.18, 0.12, 0.22, 0.04, L[s > 0 ? 1 : 0], -2.65, 2.78, s * 0.85, 0.02);
  });
  rbox(d, 0.2, 0.08, 1.4, 0.03, SM.dark, 1.05, 2.74, 0, 0.01); rbox(d, 0.2, 0.1, 0.3, 0.03, SM.white, 1.05, 2.79, 0, 0.01);
  rbox(d, 0.08, 0.3, 1.1, 0.04, SM.black, 2.74, 0.98, 0, 0.01); rbox(d, 0.22, 0.26, W + 0.02, 0.06, SM.dark, 2.72, 0.6, 0, 0.02); rbox(d, 0.2, 0.22, W, 0.05, SM.dark, -2.85, 0.62, 0, 0.02);
  if (o.label) { const t = decal(d, o.label, 1.1, 0.2, o.color, 1.35, 2.53, 0, null); t.rotation.order = 'YXZ'; t.rotation.set(-0.46, Math.PI / 2, 0); }
  box(d, 0.01, 1.95, 1.9, std(0xdfe6ee, 0.6, 0), -2.815, 1.6, 0); // the inside, seen when the doors open
  rbox(d, 0.05, 0.08, 1.8, 0.02, SM.alu, -2.8, 0.62, 0, 0.01);
  bake(d);
  const doors = [1, -1].map((s) => { const h = grp(m, -2.86, 1.58, s * 1.0); const p = rbox(h, 0.05, 2.12, 0.98, 0.04, B, 0, 0, -s * 0.49, 0.01); void p;
    rbox(h, 0.03, 0.55, 0.8, 0.04, SM.glass, -0.02, 0.55, -s * 0.5, 0.01); box(h, 0.03, 0.45, 0.94, SM.chev, -0.03, -0.62, -s * 0.49); box(h, 0.03, 0.22, 0.94, o.band, -0.03, -0.12, -s * 0.49); return h; });
  const wheels = []; axles(m, [[1.95, 0.38, 0.26, 0.86, true], [-1.85, 0.38, 0.3, 0.84, true]], wheels, SM.dark);
  shadows(m);
  return { g: m, wheels, L, doors };
}

/** Police car (Peugeot 5008-like SUV) in the French "POLICE" livery. */
function policeCar(S) {
  const m = grp(S), d = grp(m), L = blues(), W = SM.white;
  ext(d, [[-2.3, 0.34], [2.15, 0.34], [2.32, 0.56], [2.26, 0.9], [1.15, 1.06], [-2.3, 1.08], [-2.34, 0.72]], [0.06, 0.1, 0.14, 0.2, 0.1, 0.1, 0.1], 1.86, W, 0, 0, 0, 0.05);
  ext(d, [[1.18, 1.02], [0.4, 1.56], [-1.95, 1.6], [-2.28, 1.1], [-2.3, 1.02]], [0.04, 0.15, 0.12, 0.12, 0.04], 1.68, W, 0, 0, 0, 0.04);
  { const ws = box(d, 0.03, 0.86, 1.5, SM.glass, 0.83, 1.335, 0); ws.rotation.z = 0.95; const rw = box(d, 0.03, 0.55, 1.4, SM.glass, -2.16, 1.39, 0); rw.rotation.z = -0.58; }
  [1, -1].forEach((s) => {
    rbox(d, 2.85, 0.36, 0.03, 0.08, SM.glass, -0.55, 1.3, s * 0.865, 0.01);
    [-0.35, -1.45].forEach((x) => box(d, 0.08, 0.4, 0.035, SM.black, x, 1.3, s * 0.87));
    box(d, 4.4, 0.2, 0.02, SM.blue, -0.05, 0.66, s * 0.936); box(d, 4.4, 0.035, 0.02, SM.red, -0.05, 0.52, s * 0.936);
    const D = grp(d); if (s < 0) D.rotation.y = Math.PI; decal(D, 'POLICE', 1.5, 0.26, '#1c3f9a', s * -0.4, 0.88, 0.945, null);
    [-0.35, 0.95].forEach((x) => box(d, 0.025, 0.7, 0.025, SM.dark, x, 0.75, s * 0.94));
    [0.75, -0.55].forEach((x) => box(d, 0.13, 0.03, 0.03, SM.dark, x, 0.96, s * 0.945));
    rod(d, new V3(1.08, 1.1, s * 0.85), new V3(1.18, 1.15, s * 1.0), 0.02, SM.black); rbox(d, 0.12, 0.13, 0.18, 0.04, W, 1.18, 1.17, s * 1.02, 0.01);
    rbox(d, 0.06, 0.1, 0.36, 0.04, MT.lamp, 2.28, 0.82, s * 0.62, 0.01); rbox(d, 0.06, 0.12, 0.3, 0.03, MT.tail, -2.33, 0.95, s * 0.68, 0.01);
    rbox(d, 0.3, 0.12, 0.45, 0.04, L[s > 0 ? 0 : 1], -0.55, 1.71, s * 0.42, 0.02);
  });
  rbox(d, 0.4, 0.07, 1.36, 0.03, SM.dark, -0.55, 1.63, 0, 0.01); rbox(d, 0.32, 0.14, 0.38, 0.03, W, -0.55, 1.71, 0, 0.01);
  { const t = decal(d, 'POLICE', 0.36, 0.1, '#1c3f9a', -0.37, 1.71, 0, null); t.rotation.y = Math.PI / 2; }
  rbox(d, 0.08, 0.2, 1.0, 0.04, SM.black, 2.3, 0.68, 0, 0.01); rbox(d, 0.2, 0.22, 1.9, 0.06, SM.dark, 2.28, 0.44, 0, 0.02); rbox(d, 0.2, 0.22, 1.9, 0.06, SM.dark, -2.3, 0.46, 0, 0.02);
  { const t = decal(d, 'POLICE', 1.0, 0.22, '#1c3f9a', 1.7, 1.0, 0, null); t.rotation.order = 'YXZ'; t.rotation.set(-Math.PI / 2 + 0.14, Math.PI / 2, 0); }
  const drv = sit(policier(d, 0.0, 0.36)); drv.position.y = 0.42; drv.scale.setScalar(0.8);
  bake(d);
  const wheels = []; axles(m, [[1.42, 0.36, 0.24, 0.8, true], [-1.42, 0.36, 0.24, 0.8, true]], wheels, SM.alu);
  shadows(m);
  return { g: m, wheels, L };
}

/** Police motorbike (BMW RT-like), white and blue, with its rider. */
function policeMoto(S) {
  const m = grp(S), d = grp(m), L = blues(), W = SM.white;
  ext(d, [[0.12, 0.5], [0.72, 0.55], [1.0, 0.92], [0.92, 1.22], [0.58, 1.3], [0.22, 1.05]], 0.08, 0.72, W, 0, 0, 0, 0.05);
  [1, -1].forEach((s) => { box(d, 0.6, 0.1, 0.02, SM.blue, 0.6, 0.9, s * 0.365); rbox(d, 0.08, 0.1, 0.12, 0.03, L[s > 0 ? 0 : 1], 0.97, 0.98, s * 0.2, 0.01);
    rbox(d, 0.55, 0.42, 0.24, 0.06, W, -0.7, 0.72, s * 0.38, 0.02); box(d, 0.56, 0.08, 0.01, SM.blue, -0.7, 0.75, s * 0.505);
    const D = grp(d); if (s < 0) D.rotation.y = Math.PI; decal(D, 'POLICE', 0.42, 0.1, '#1c3f9a', s * 0.62, 1.04, 0.37, null);
    cylZ(d, 0.09, 0.2, SM.alu, 0.18, 0.45, s * 0.38, 12); rod(d, new V3(0.5, 1.22, s * 0.18), new V3(0.45, 1.2, s * 0.4), 0.02, SM.black); rbox(d, 0.04, 0.06, 0.12, 0.01, SM.black, 0.62, 1.32, s * 0.36, 0.01); });
  rbox(d, 0.55, 0.26, 0.42, 0.1, W, 0.08, 1.05, 0, 0.02); rbox(d, 0.95, 0.12, 0.36, 0.05, SM.black, -0.45, 1.02, 0, 0.02);
  rbox(d, 0.5, 0.35, 0.48, 0.08, W, -0.98, 1.18, 0, 0.02); rbox(d, 0.04, 0.08, 0.3, 0.02, MT.tail, -1.24, 1.1, 0, 0.01);
  { const ws = box(d, 0.02, 0.45, 0.5, MT.glass, 0.82, 1.48, 0); ws.rotation.z = 0.5; }
  rod(d, new V3(-1.05, 1.35, 0), new V3(-1.05, 1.9, 0), 0.02, SM.dark, 4); rbox(d, 0.1, 0.1, 0.1, 0.02, L[0], -1.05, 1.92, 0, 0.01);
  [0.06, -0.06].forEach((z) => rod(d, new V3(0.78, 0.32, z), new V3(0.62, 0.9, z), 0.035, SM.alu, 6));
  cylX(d, 0.07, 0.7, SM.chrome, -0.6, 0.42, 0.22, 10); rbox(d, 0.4, 0.3, 0.4, 0.06, SM.dark, 0.0, 0.55, 0, 0.02);
  bake(d);
  const wheels = [tire(m, 0.32, 0.14, 0.78, 0.32, 0, SM.dark, 1, MT.rubber), tire(m, 0.32, 0.16, -0.72, 0.32, 0, SM.dark, 1, MT.rubber)];
  const rider = sit(walker(m, -0.32, 0, { top: 0x2a3f7a, bottom: 0x1c2440, hat: SM.white }), 1.3, 1.25); rider.position.y = 0.6; rider.scale.setScalar(0.9);
  shadows(m);
  return { g: m, wheels, L, rider };
}

/** Fire-brigade rescue boat: red hull, console, A-frame with a blue light, outboard engine, two crew in life jackets. */
function fireBoat(S) {
  const m = grp(S), d = grp(m), L = blues();
  extY(d, [[-2.6, -1.05], [1.4, -1.05], [2.95, 0], [1.4, 1.05], [-2.6, 1.05]], 0.3, 1.0, SM.red, 0, 0.0, 0, 0.04);
  extY(d, [[-2.45, -0.86], [1.32, -0.86], [2.6, 0], [1.32, 0.86], [-2.45, 0.86]], 0.25, 0.1, SM.dark, 0, 0.42, 0, 0.02);
  rail(d, [[-2.6, 0.55, -1.08], [1.4, 0.55, -1.08], [2.95, 0.55, 0], [1.4, 0.55, 1.08], [-2.6, 0.55, 1.08], [-2.6, 0.55, -1.08]], 0.11, std(0x3a3f4a, 0.7, 0));
  [1, -1].forEach((s) => { box(d, 3.9, 0.08, 0.02, SM.white, -0.6, 0.22, s * 1.06); const D = grp(d); if (s < 0) D.rotation.y = Math.PI; decal(D, 'POMPIERS', 2.2, 0.3, '#ffffff', s * -0.6, -0.02, 1.07, null); });
  rbox(d, 0.75, 0.9, 0.8, 0.08, SM.white, 0.25, 0.92, 0, 0.02); { const ws = box(d, 0.03, 0.4, 0.78, MT.glass, 0.68, 1.5, 0); ws.rotation.z = 0.5; }
  add(d, new THREE.TorusGeometry(0.15, 0.025, 6, 14), SM.black, -0.15, 1.35, 0).rotation.y = Math.PI / 2;
  add(d, new THREE.TorusGeometry(0.22, 0.07, 8, 16), SM.orange, 0.25, 1.0, 0.43);
  rbox(d, 0.5, 0.4, 1.4, 0.06, SM.dark, -1.1, 0.65, 0, 0.02);
  [1, -1].forEach((s) => rod(d, new V3(-1.75, 0.5, s * 0.85), new V3(-1.55, 2.2, s * 0.55), 0.04, SM.alu, 6)); rod(d, new V3(-1.55, 2.2, 0.55), new V3(-1.55, 2.2, -0.55), 0.04, SM.alu, 6);
  rbox(d, 0.2, 0.12, 0.5, 0.03, L[0], -1.55, 2.3, 0.15, 0.01); rbox(d, 0.2, 0.12, 0.5, 0.03, L[1], -1.55, 2.3, -0.15, 0.01); rod(d, new V3(-1.55, 2.2, -0.5), new V3(-1.6, 3.0, -0.5), 0.015, SM.dark, 4);
  rbox(d, 0.5, 0.7, 0.42, 0.12, SM.dark, -2.85, 0.9, 0, 0.02); rbox(d, 0.18, 0.7, 0.14, 0.04, SM.dark, -2.85, 0.3, 0, 0.02); box(d, 0.3, 0.06, 0.44, SM.white, -2.85, 1.02, 0);
  rail(d, [[2.1, 0.62, 0.5], [2.5, 0.95, 0.2], [2.5, 0.95, -0.2], [2.1, 0.62, -0.5]], 0.025, SM.alu);
  const helm = pompier(d, -0.45, 0.0, { vest: true }); helm.position.y = 0.45; helm.scale.setScalar(0.9);
  bake(d);
  const crew = pompier(m, 1.35, 0.25, { vest: true }); crew.position.y = 0.45; crew.scale.setScalar(0.9);
  const net = grp(crew, 0.18, 0.85, 0.22); rod(net, new V3(0, 0, 0), new V3(2.2, 0, 0), 0.025, SM.alu, 6);
  const ring = add(net, new THREE.TorusGeometry(0.3, 0.025, 6, 16), SM.yel, 2.45, 0, 0); ring.rotation.x = Math.PI / 2;
  const cone = add(net, new THREE.ConeGeometry(0.3, 0.45, 12, 1, true), std(0xffffff, 0.8, 0, { transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), 2.45, -0.22, 0); cone.rotation.x = Math.PI;
  net.rotation.z = 1.2; net.rotation.y = -0.2;
  shadows(m);
  return { g: m, L, net, crew };
}

/** Sécurité civile "Dragon" helicopter (EC145-like), red and yellow. userData: { rotor, tail, Y } */
function dragon(S) {
  const g = grp(S), Y = 1.55, R = SM.dRed, J = SM.dYel;
  const P = [[2.75, 0.06], [2.62, 0.5], [2.3, 0.82], [1.7, 1.0], [0.3, 1.05], [-1.0, 1.0], [-1.7, 0.8], [-2.3, 0.45], [-6.3, 0.2], [-6.6, 0.12]];
  body(g, P, R, Y, 28);
  skin(g, P, 2.62, -2.2, Math.PI / 2, Math.PI * 0.92, J, Y, 1.004, 10); // yellow belly and nose
  [-0.45, 0.45].forEach((dd) => skin(g, P, 2.6, 1.85, -Math.PI / 2 + dd, 0.8, AM.glassO, Y, 1.012, 4));
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(g, P, 2.58, 1.65, b - s * 0.28, 0.95, AM.glassO, Y, 1.014, 4); skin(g, P, 1.25, 0.2, b - s * 0.32, 0.55, AM.win, Y, 1.014, 3); skin(g, P, 0.05, -0.75, b - s * 0.32, 0.5, AM.win, Y, 1.014, 3); });
  hatch(g, P, Y, 0.7, 1.15, -0.85, 0.6, AM.line, R, null, [1, -1], 0.004);
  [1, -1].forEach((s) => { const D = grp(g); if (s < 0) D.rotation.y = Math.PI; decal(D, 'SÉCURITÉ CIVILE', 2.4, 0.24, '#ffffff', s * -4.1, Y + 0.02, 0.37, null); decal(D, 'DRAGON', 0.8, 0.2, '#ffffff', s * -0.9, Y + 0.25, 1.03, null); });
  rbox(g, 2.6, 0.55, 1.3, 0.25, R, -0.7, Y + 1.12, 0, 0.03); rbox(g, 1.2, 0.3, 1.0, 0.12, R, 0.4, Y + 1.0, 0, 0.02);
  [1, -1].forEach((s) => { rbox(g, 0.5, 0.25, 0.04, 0.05, SM.dark, 0.1, Y + 1.15, s * 0.66, 0.01); cylX(g, 0.13, 0.4, SM.dark, -2.05, Y + 1.15, s * 0.45, 10); });
  plate(g, [[-5.1, -1.15], [-5.0, 1.15], [-5.55, 1.15], [-5.7, -1.15]], 0.08, R, Y + 0.22);
  [1, -1].forEach((s) => fin(g, [[-5.05, -0.35], [-4.95, 0.45], [-5.5, 0.45], [-5.7, -0.35]], 0.06, J, s * 1.16).position.y = Y + 0.22);
  fin(g, [[-5.85, 0.1], [-6.3, 1.45], [-6.85, 1.45], [-6.7, 0.0]], 0.1, R).position.y = Y;
  sph(g, 0.07, AM.navR, -0.7, Y + 1.42, 0); sph(g, 0.06, AM.navW, -6.7, Y + 0.1, 0); [1, -1].forEach((s) => sph(g, 0.06, s > 0 ? AM.navG : AM.navR, -5.6, Y + 0.24, s * 1.2));
  // skids
  [1, -1].forEach((s) => {
    rod(g, new V3(-1.6, 0.06, s * 1.05), new V3(1.5, 0.06, s * 1.05), 0.055, SM.dark, 8); rod(g, new V3(1.5, 0.06, s * 1.05), new V3(1.85, 0.32, s * 1.05), 0.055, SM.dark, 8);
    [0.9, -1.0].forEach((x) => rod(g, new V3(x, 0.06, s * 1.05), new V3(x, Y - 0.8, s * 0.55), 0.05, SM.dark, 8));
  });
  // rescue hoist above the right door
  rod(g, new V3(0.5, Y + 0.95, 0.75), new V3(0.5, Y + 1.0, 1.42), 0.045, SM.alu, 6); rbox(g, 0.3, 0.22, 0.3, 0.05, SM.dark, 0.5, Y + 0.98, 1.5, 0.02);
  rod(g, new V3(0.5, Y + 0.85, 1.5), new V3(0.5, Y + 0.45, 1.5), 0.012, SM.dark, 4); sph(g, 0.05, SM.yel, 0.5, Y + 0.43, 1.5);
  sph(g, 0.12, SM.alu, 2.2, Y - 0.82, 0.3); // search light
  const pil = walker(g, 1.6, 0.35, { top: 0xf2781c, bottom: 0x23305a, hat: SM.white }); sit(pil); pil.position.y = Y - 0.95; pil.scale.setScalar(0.8);
  const rotor = grp(g, -0.6, Y + 1.75, 0); cylY(rotor, 0.12, 0.4, AM.metal, 0, -0.15, 0, 10); cylY(rotor, 0.3, 0.16, SM.dark, 0, 0.05, 0, 12);
  for (let k = 0; k < 4; k++) { const b = grp(rotor); b.rotation.y = (k / 4) * Math.PI * 2; box(b, 0.6, 0.1, 0.16, AM.metal, 0.4, 0.06, 0); rbox(b, 5.0, 0.05, 0.32, 0.05, SM.dark, 3.0, 0.1, 0, 0.01); box(b, 0.3, 0.052, 0.32, SM.yel, 5.35, 0.1, 0); }
  const tail = grp(g, -6.55, Y + 0.95, -0.12); cylZ(tail, 0.08, 0.12, AM.metal, 0, 0, 0, 8); for (let k = 0; k < 2; k++) { const b = grp(tail); box(b, 0.06, 1.0, 0.12, SM.dark, 0, 0.5, -0.04); b.rotation.z = k * Math.PI; }
  g.userData = { rotor, tail, Y };
  shadows(g); return g;
}

/* ================= world description ================= */
const DATA = {
  echelle: { short: 'La grande échelle', full: 'Le camion grande échelle', verb: 'Monter', horn: 'horn',
    use: 'Une très grande échelle, pour aller tout en haut des maisons et des arbres.',
    how: "Elle sort ses pieds pour ne pas tomber. Puis elle se lève, tourne et s'allonge. Au bout, un pompier est dans la nacelle." },
  fpt: { short: 'Le fourgon pompe', full: 'Le fourgon pompe-tonne', verb: 'Arroser', horn: 'horn',
    use: "Le camion des pompiers qui éteint le feu. Il transporte de l'eau et des tuyaux.",
    how: "Dans son ventre, il y a une grande citerne d'eau. Sa pompe envoie l'eau très fort dans le tuyau." },
  vsav: { short: "L'ambulance rouge", full: "L'ambulance des pompiers", verb: 'Aider', horn: 'horn',
    use: "Elle vient aider les gens qui se sont fait mal, et les emmène à l'hôpital.",
    how: "Dedans, il y a un brancard, un lit à roulettes, et tout ce qu'il faut pour soigner." },
  samu: { short: 'Le SAMU', full: "L'ambulance du SAMU", verb: 'Arriver', horn: 'horn',
    use: "C'est l'ambulance de l'hôpital, avec un docteur à bord.",
    how: "Le docteur soigne déjà pendant le trajet. À l'hôpital, l'ambulance va tout droit aux urgences." },
  police: { short: 'La police', full: 'La voiture de police', verb: 'Traverser', horn: 'horn',
    use: 'Les policiers veillent à ce que tout le monde soit en sécurité.',
    how: 'Avec ses lumières bleues et sa sirène, tout le monde la voit et l’entend arriver.' },
  moto: { short: 'La moto', full: 'La moto de police', verb: 'Guider', horn: 'horn',
    use: 'Une moto rapide, qui se faufile partout, même dans les embouteillages.',
    how: 'Quand le feu tricolore est en panne, le motard guide les voitures avec son bras et son sifflet.' },
  helico: { short: "L'hélicoptère", full: "L'hélicoptère Dragon", verb: 'Décoller', horn: 'bell',
    use: "L'hélicoptère de la sécurité civile va très vite là où on a besoin de lui, même en montagne.",
    how: "Il peut se poser sur une petite plateforme, à côté de l'hôpital. Il a un treuil, pour remonter les gens avec un câble." },
  bateau: { short: 'Le bateau', full: 'Le bateau des pompiers', verb: 'Naviguer', horn: 'bell',
    use: 'Les pompiers ont aussi un bateau, pour aider sur la rivière.',
    how: "Son moteur, à l'arrière, fait tourner une hélice dans l'eau. Les pompiers portent des gilets pour flotter." }
};
const ORDER = ['echelle', 'fpt', 'vsav', 'samu', 'police', 'moto', 'helico', 'bateau'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const RD = '#c81e28', BL = '#1c3f9a';
const ICONS = {
  echelle: GND + `<path d="M24 46L80 8" stroke="#c9ccd8" stroke-width="8" stroke-linecap="round"/><path d="M24 46L80 8" stroke="#8f96a6" stroke-width="2.5" stroke-dasharray="2 4"/><rect x="74" y="2" width="16" height="11" rx="2" fill="${RD}"/>
    <rect x="6" y="44" width="76" height="16" rx="3" fill="${RD}"/><rect x="82" y="32" width="30" height="28" rx="4" fill="${RD}"/><rect class="g" x="94" y="36" width="14" height="10" rx="2"/><rect class="b" x="90" y="28" width="14" height="4" rx="1"/><circle class="k" cx="24" cy="62" r="8"/><circle class="k" cx="96" cy="62" r="8"/>`,
  fpt: GND + `<rect x="6" y="22" width="72" height="36" rx="4" fill="${RD}"/><rect class="s" x="12" y="27" width="18" height="24" rx="2"/><rect class="s" x="34" y="27" width="18" height="24" rx="2"/><rect class="s" x="56" y="27" width="18" height="24" rx="2"/>
    <rect x="78" y="30" width="32" height="28" rx="4" fill="${RD}"/><rect class="g" x="92" y="34" width="14" height="10" rx="2"/><rect class="b" x="86" y="26" width="14" height="4" rx="1"/><rect x="6" y="52" width="104" height="3" fill="#f2d21c"/><circle class="k" cx="24" cy="62" r="8"/><circle class="k" cx="94" cy="62" r="8"/>`,
  vsav: GND + `<path d="M8 22h70q8 0 12 6l14 14q6 2 6 8v8H8z" fill="${RD}"/><path d="M80 28l10 12H80z" fill="#9fd2ef"/><rect x="8" y="44" width="102" height="5" fill="#f2d21c"/><rect class="b" x="66" y="18" width="14" height="4" rx="1"/><rect x="20" y="30" width="30" height="6" rx="1" fill="#fff"/><circle class="k" cx="28" cy="62" r="7"/><circle class="k" cx="88" cy="62" r="7"/>`,
  samu: GND + `<path d="M8 22h70q8 0 12 6l14 14q6 2 6 8v8H8z" class="w"/><path d="M80 28l10 12H80z" fill="#9fd2ef"/><rect x="8" y="42" width="102" height="6" fill="${BL}"/><rect x="8" y="50" width="102" height="2" fill="#f2781c"/><rect class="b" x="66" y="18" width="14" height="4" rx="1"/><text x="32" y="38" font-size="12" font-weight="900" fill="${BL}" font-family="system-ui,sans-serif">SAMU</text><circle class="k" cx="28" cy="62" r="7"/><circle class="k" cx="88" cy="62" r="7"/>`,
  police: GND + `<path d="M8 44q0-6 6-8l14-2 14-12h34l16 12h14q8 2 8 10v12H8z" class="w"/><path d="M46 26h14v10H38zM64 26h10l12 10H64z" fill="#9fd2ef"/><rect x="10" y="46" width="98" height="5" fill="${BL}"/><rect x="10" y="52" width="98" height="1.5" fill="#d8202a"/><rect class="b" x="54" y="17" width="18" height="5" rx="2"/><circle class="k" cx="30" cy="60" r="8"/><circle class="k" cx="90" cy="60" r="8"/>`,
  moto: GND + `<circle class="k" cx="30" cy="60" r="12"/><circle class="k" cx="92" cy="60" r="12"/><path d="M30 60l22-14h30l10 14" stroke="#2a2f40" stroke-width="4" fill="none"/><path d="M70 26h16l8 20H72z" class="w"/><rect x="18" y="34" width="22" height="16" rx="3" class="w"/><rect x="20" y="40" width="18" height="3" fill="${BL}"/><rect x="42" y="38" width="30" height="7" rx="3" fill="#2a2f40"/><rect class="b" x="18" y="22" width="5" height="10" rx="1"/><path d="M88 22l6-6" stroke="#9fd2ef" stroke-width="4"/>`,
  helico: GND + `<path d="M8 18h96" stroke="#2a2f40" stroke-width="4" stroke-linecap="round"/><rect x="54" y="18" width="6" height="8" fill="#2a2f40"/><path d="M40 40q0-14 20-14h22q16 0 20 14-4 12-20 12H58q-18 0-18-12z" fill="${RD}"/><path d="M42 44h60q-4 8-20 8H58q-14 0-16-8z" fill="#f6c21a"/><path d="M86 30h10q6 4 6 10H86z" fill="#9fd2ef"/><path d="M42 38L8 34v-6h6l28 6z" fill="${RD}"/><rect x="4" y="24" width="6" height="12" fill="#f6c21a"/><path class="ln" d="M48 66h56M56 52v14M92 52v14"/>`,
  bateau: `<path d="M0 60q30 6 60 0t60 0V80H0z" fill="#3f7fd0"/><path d="M10 50h82l18-12-4 18q-2 8-12 8H18q-8 0-8-14z" fill="${RD}"/><rect x="10" y="49" width="96" height="4" fill="#3a3f4a"/><rect x="48" y="34" width="14" height="16" rx="2" class="w"/><path d="M32 50l4-24h14" stroke="#c9ccd8" stroke-width="3" fill="none"/><rect class="b" x="34" y="20" width="10" height="5" rx="1"/><rect x="6" y="36" width="8" height="14" rx="2" fill="#2a2f40"/><text x="42" y="61" font-size="7" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">POMPIERS</text>`
};
const CFG = {
  echelle: CF(-33, 9), fpt: CF(22, 10), vsav: CF(-24, 25), samu: CF(17, -13.8),
  police: CF(-20.5, -6), moto: CF(4, -6), helico: CF(38, -17), bateau: CF(-8, -38)
};

/* ---------- painted ground ---------- */
const GR = [], GB = [], GP = [];
const rect = (h, d, lh, ld, col, al = 1) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len: lh, wid: ld, rot: -Math.PI / 4, col, al }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const path = (pts, w, col, al = 1) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
const ROAD = '#4a4c5e', WALK = '#d2cbc0', LINE = '#f3efe2', GRAV = '#d6c49a', PAVE = '#ddd2bd';
rect(0, -40, 120, 18, '#3f7fd0'); for (let i = 0; i < 22; i++) rect(rnd(-44, 44), rnd(-46, -33), rnd(2, 6), 0.22, 'rgba(220,240,255,.4)');
rect(0, -29.2, 120, 4.4, '#d9cfba'); rect(0, -31.2, 120, 0.5, '#a89c84');
rect(0, -19.8, 120, 14.6, '#cdc6b6');
blob(-12, -26, 4, 'rgba(90,150,80,.7)'); blob(28, -12.5, 2.5, 'rgba(90,150,80,.6)'); blob(36, -26, 5, 'rgba(90,150,80,.7)');
rect(-33, -15, 22, 5, '#bdbdc6'); rect(-12, -10.45, 10.4, 1.9, '#5a5c6e'); for (let h = -16.5; h <= -7.5; h += 2.25) rect(h, -10.45, 0.12, 1.9, LINE);
rect(-20.2, -20, 3, 15, WALK); rect(17, -14.2, 16, 3.4, '#c4c6ce');
rect(0, -11, 120, 3, WALK); rect(0, -6, 120, 7, ROAD); rect(0, -1.5, 120, 2, WALK);
for (let h = -50; h < 50; h += 4.5) if (Math.abs(h - 4) > 5 && Math.abs(h + 20.5) > 2.5) rect(h, -6, 2.2, 0.16, LINE);
rect(4, -4, 5, 96, ROAD); rect(0.75, 18, 1.5, 37, WALK); rect(7.25, 18, 1.5, 37, WALK); rect(0.75, -20, 1.5, 15, WALK); rect(7.25, -20, 1.5, 15, WALK);
for (let d = -48; d < 42; d += 4.5) if (Math.abs(d + 6) > 7) rect(4, d, 0.16, 2.2, LINE);
for (let d = -9; d <= -3; d += 1) { rect(-20.5, d, 2.6, 0.5, LINE); rect(0.75, d, 1.5, 0.45, LINE); rect(7.25, d, 1.5, 0.45, LINE); }
for (let h = 2; h <= 6; h += 1) { rect(h, -11, 0.45, 2.4, LINE); rect(h, -1.5, 0.45, 1.8, LINE); }
rect(-0.6, -4.5, 0.2, 3, LINE); rect(8.6, -7.5, 0.2, 3, LINE); rect(2.5, -12.6, 3, 0.2, LINE); rect(5.5, 0.6, 3, 0.2, LINE);
rect(-24, 9, 48, 3.4, GRAV); rect(-24, 25, 48, 3.4, GRAV); rect(-20.5, 3.6, 2.4, 7.5, GRAV); rect(-8, 17, 2.2, 13, GRAV);
path([[-14, 13], [-6, 12.5], [-2.5, 17], [-6, 21.5], [-14, 21], [-16, 17], [-14, 13]], 1.6, GRAV);
blob(-38, 18, 4.2, 'rgba(232,210,154,.95)'); blob(-27, 31, 3, 'rgba(240,120,150,.5)'); blob(-12, 32, 3, 'rgba(250,210,80,.5)');
rect(27, 18, 38, 34, PAVE); rect(27, 10, 38, 4, ROAD); rect(27, 7.6, 38, 0.8, WALK); rect(27, 12.4, 38, 0.8, WALK);
blob(34, 21, 3.4, 'rgba(160,200,230,.6)');

export default {
  id: 'secours', title: 'Les Secours', titleHtml: 'Les <span>Secours</span>',
  subtitle: 'La caserne des pompiers, la police et l’hôpital : tous les véhicules qui viennent nous aider.',
  welcome: 'Bienvenue en ville ! Ici, tout le monde aide. Touche un véhicule pour voir comment il marche.',
  hint: 'Touche un véhicule pour le découvrir.', backLabel: 'Toute la ville',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="10" rx="2"/><path d="M21 17h5l3 4v3h-8z"/><circle cx="9" cy="25" r="2.4"/><circle cx="24" cy="25" r="2.4"/><path d="M6 14L22 5M9 9h4"/><path d="M12 9.5l4-2.4"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false,
  forest: { dark: [0x1f4a2e, 0x2a5a36, 0x183a2a, 0x2f6a3a, 0x214a33], bush: [0x4a8a3a, 0x3f7a34, 0x5a9a44, 0x6aa84c] },
  outerColor: 0x1a3226,
  overview: { w: 92, h: 64, focus: [0, 3, 0] },
  ground: { base: ['#8cbc6a', '#6f9f52', '#4f7a3e'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 200); onUpdate((dt) => fx.update(dt));
    freeze(buildTown(grp(scene)));
    const blockers = []; // points (world) the ambient traffic must stop in front of
    const LIGHTS = { mode: 'auto', manual: null };
    let T = 0; onUpdate((dt) => (T += dt));
    const spin = (obj, wheels, R = 0.4) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || R))); }; };
    const along = (obj, r, s0, s1, d, ease = easeSine) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k), ease);
    const easeOut = (k) => 1 - (1 - k) * (1 - k);
    const walkTo = (p, x, z, d, face = true) => { const x0 = p.position.x, z0 = p.position.z; if (face) p.rotation.y = Math.atan2(-(z - z0), x - x0); return tw(d, (k) => { p.position.x = x0 + (x - x0) * k; p.position.z = z0 + (z - z0) * k; p.userData.walk(k * d * 7); }, lin).then(() => p.userData.walk(0)); };
    const arc = (o, p1, d, hgt = 1) => { const p0 = o.position.clone(); return tw(d, (k) => o.position.set(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k + Math.sin(k * Math.PI) * hgt, p0.z + (p1.z - p0.z) * k), easeSine); };
    const sprayAt = (from, dir) => fx.smoke(from, dir.clone().multiplyScalar(rnd(7, 9)).add(new V3(rnd(-0.3, 0.3), 1.6, rnd(-0.3, 0.3))), rnd(0.12, 0.22), 0xd8f0ff, 0.6);

    /* ---- la grande échelle : un chat dans l'arbre ---- */
    (function () {
      const st = makeStation('echelle'), S = st.g, X0 = -11;
      const E = epa(S); const m = E.g; st.m = m; st.wheels = E.wheels; m.position.x = X0; st.lastX = X0;
      // the tree with the cat on a branch, the little girl waiting
      const tree = grp(S, 7.6, 0, -6.6); cylY(tree, 0.34, 8.4, 0x6b4a32, 0, 4.2, 0, 10);
      rod(tree, new V3(0, 5.4, 0.1), new V3(-1.75, 7.25, 1.55), 0.13, std(0x6b4a32, 0.9, 0), 6); rod(tree, new V3(0, 6.5, 0), new V3(1.4, 8.1, -0.6), 0.12, std(0x6b4a32, 0.9, 0), 6);
      [[0, 9.8, -0.4, 2.2], [1.4, 9.0, -0.8, 1.6], [-1.3, 9.2, -0.9, 1.6], [0.5, 10.8, 0.4, 1.4], [-0.9, 8.4, -1.4, 1.3], [1.6, 7.9, 0.2, 1.2], [0.2, 8.6, 1.0, 1.1]].forEach(([x, y, z, s]) => { const c = add(tree, ICO, pick([0x4a9a4a, 0x3f8a3a, 0x5aa85a]), x, y, z); c.scale.setScalar(s); c.rotation.set(rnd(0, 3), rnd(0, 3), 0); });
      const cat = kitty(S); const CAT = new V3(5.9, 7.27, -5.0); cat.position.copy(CAT); cat.rotation.y = -0.5;
      const girl = walker(S, 0.4, 6.4, { kid: true, top: 0xf07aa8, hair: 0x8a5a2a }); girl.rotation.y = 1.05;
      const GIRL = girl.position.clone();
      part(st, 'echelle', "l'échelle", anchor(E.secs[1], 2.5, 0.5, 0), true);
      part(st, 'nacelle', 'la nacelle', anchor(E.cage, 0.66, 0.8, 0.6), false);
      part(st, 'pieds', 'les pieds', anchor(m, 0.6, 0.5, 1.9), false);
      part(st, 'chat', 'le petit chat', anchor(cat, 0, 0.7, 0), true);
      part(st, 'camion', 'le camion', anchor(m, -1.5, 2.3, 1.3), false);
      st.focus = new V3(1.5, 4.2, -1); st.size = { w: 24, h: 14 }; st.tagAt = anchor(m, 0, 4.6, 0);
      const ld = { yaw: 0, el: 0, e: 0 };
      const setL = () => { E.tt.rotation.y = ld.yaw; E.elev.rotation.z = ld.el; for (let i = 1; i < 4; i++) E.secs[i].position.x = 0.15 + ld.e; E.cage.rotation.z = -ld.el; };
      /** ladder state that puts the cage floor centre on point P (station space), truck at x = 0 */
      const solve = (P) => {
        const cx = -2.7, dx = P.x - cx, dz = P.z, yaw = Math.atan2(-dz, dx), hd = Math.hypot(dx, dz) - 0.3 - 0.66, dy = P.y + 0.2 - 3.72;
        const len = Math.hypot(hd, dy); return { yaw, el: Math.atan2(dy, hd), e: Math.max(0, (len - E.LS - 0.45) / 3) };
      };
      const lad = (A, d) => { const a = { ...ld }; return tw(d, (k) => { ld.yaw = a.yaw + (A.yaw - a.yaw) * k; ld.el = a.el + (A.el - a.el) * k; ld.e = a.e + (A.e - a.e) * k; setL(); }, easeSine); };
      st.update = (dt) => { roll(st, dt); E.ram.update(); flash(E.L, st.flash, T); };
      const reset = () => { ld.yaw = 0; ld.el = 0; ld.e = 0; setL(); E.setOut(0); m.position.x = X0; st.lastX = X0; S.attach(cat); cat.position.copy(CAT); cat.rotation.set(0, -0.5, 0); girl.position.copy(GIRL); girl.rotation.y = 1.05; girl.userData.arms.forEach((a) => (a.rotation.z = 0)); E.fig.userData.arms.forEach((a) => (a.rotation.z = 0)); };
      st.action = async function () {
        if (st.done) { reset(); pop(m, 0.5); st.done = false; await sleep(0.5); }
        meow(); girl.userData.arms[0].rotation.z = 2.6;
        await Promise.all([step("Miaou ! Un petit chat est monté tout en haut de l'arbre. Il n'ose plus descendre.", 'chat'), tw(1.5, (k) => (cat.rotation.z = Math.sin(k * 18) * 0.06))]);
        girl.userData.arms[0].rotation.z = 0;
        engineOn(55); st.flash = true; const stop = siren('pompiers', 4.5);
        await Promise.all([step('Pin-pon ! La grande échelle des pompiers arrive.', 'camion'), to(m.position, 'x', 0, 4.2, easeOut)]);
        stop(); thud();
        await Promise.all([step('Elle sort ses grands pieds, pour bien tenir et ne pas tomber.', 'pieds'), tw(2.6, (k) => E.setOut(k), lin)]);
        thud(); engineOn(140);
        const A = solve(new V3(CAT.x - 0.55, CAT.y - 0.35, CAT.z + 0.35));
        await step("L'échelle se lève, tourne, et s'allonge jusqu'au chat...", 'echelle');
        await lad({ yaw: 0, el: 0.42, e: 0 }, 1.6); await lad({ yaw: A.yaw, el: 0.42, e: 0 }, 1.8); await lad(A, 2.6);
        engineOff(); meow();
        E.fig.userData.arms.forEach((a) => (a.rotation.z = 1.4));
        await step('Le pompier, dans la nacelle, prend le petit chat tout doucement dans ses bras.', 'nacelle');
        S.updateMatrixWorld(true); const inCage = S.worldToLocal(E.cage.localToWorld(new V3(0.9, -0.34, 0.3)));
        await arc(cat, inCage, 1.0, 0.4); E.cage.attach(cat);
        const B = solve(new V3(GIRL.x - 1.25, 0.3, GIRL.z - 0.75));
        engineOn(140);
        await Promise.all([step("L'échelle redescend tout doucement jusqu'à la petite fille.", 'echelle'), (async () => { await lad({ yaw: A.yaw, el: A.el, e: Math.min(A.e, B.e) }, 1.4); await lad({ yaw: B.yaw, el: A.el, e: Math.min(A.e, B.e) }, 2.0); await lad(B, 2.4); })()]);
        engineOff(); S.attach(cat);
        girl.rotation.y = Math.PI; girl.userData.arms.forEach((a) => (a.rotation.z = 1.3));
        await Promise.all([step('Voilà ! Le chat retrouve la petite fille. Merci les pompiers !', 'chat'), arc(cat, new V3(GIRL.x - 0.35, 0.55, GIRL.z), 1.0, 0.5)]);
        ding(); E.fig.userData.arms.forEach((a) => (a.rotation.z = 0));
        engineOn(140);
        await lad({ yaw: B.yaw, el: 0.42, e: 0 }, 2.2); await lad({ yaw: 0, el: 0.42, e: 0 }, 1.8); await lad({ yaw: 0, el: 0, e: 0 }, 1.4);
        await tw(1.8, (k) => E.setOut(1 - k), lin);
        engineOff(); st.flash = false; chime(); st.done = true;
      };
    })();

    /* ---- le fourgon pompe : une poubelle en feu ---- */
    (function () {
      const st = makeStation('fpt'), S = st.g, X0 = -13;
      const F = fpt(S); const m = F.g; st.m = m; st.wheels = F.wheels; m.position.x = X0; st.lastX = X0;
      const bin = wheelieBin(S, 3.4, 2.75, 0, SM.green); const BIN = bin.g.position;
      const folks = [[7.2, 4.3, 0xf2b21c], [7.9, 3.4, 0x3aa46a]].map(([x, z, c]) => { const p = walker(S, x, z, { top: c }); p.rotation.y = Math.PI; return p; });
      const f1 = pompier(S), f2 = pompier(S); f1.visible = false; f2.visible = false;
      const lance = grp(f1, 0.3, 0.72, -0.12); cylX(lance, 0.05, 0.42, SM.chrome, 0.2, 0, 0, 8); cylX(lance, 0.07, 0.12, SM.black, 0, 0, 0, 8);
      const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new V3(), new V3(1, 0, 0)), 4, 0.06, 6), std(0xd8d4c8, 0.8, 0)); S.add(hose); hose.visible = false;
      const setHose = (a, b) => { const mid = a.clone().lerp(b, 0.5); mid.y = 0.05; const c = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, 0.5).setY(0.4), mid, b.clone().lerp(mid, 0.4).setY(0.06), b]); hose.geometry.dispose(); hose.geometry = new THREE.TubeGeometry(c, 24, 0.06, 6); };
      part(st, 'poubelle', 'la poubelle', anchor(bin.g, 0, 1.7, 0), false);
      part(st, 'rideaux', 'les rideaux', anchor(m, -1.35, 2.4, 1.3), true);
      part(st, 'tuyau', 'le tuyau', anchor(m, -4.15, 2.5, 0.6), false);
      part(st, 'lance', "la lance à eau", anchor(lance, 0.4, 0.2, 0), false);
      part(st, 'camion', 'la citerne (dedans !)', anchor(m, -1.5, 3.7, 0), true);
      st.focus = new V3(-1.5, 2, 1.2); st.size = { w: 21, h: 9 }; st.tagAt = anchor(m, 0, 4.6, 0);
      let fire = 0;
      st.update = (dt) => {
        roll(st, dt); flash(F.L, st.flash, T);
        if (fire > 0.05 && Math.random() < fire) { fx.fire(S.localToWorld(new V3(BIN.x + rnd(-0.2, 0.2), 1.05, BIN.z + rnd(-0.2, 0.2))), new V3(0, 1, 0), 2.2 * fire, 0.4, rnd(0.18, 0.32) * (0.5 + fire)); if (Math.random() < 0.15) fx.smoke(S.localToWorld(new V3(BIN.x, 1.6, BIN.z)), new V3(rnd(-0.2, 0.2), 1.2, rnd(-0.2, 0.2)), 0.35, 0x8a8a96, 2); }
        if (st.water) for (let i = 0; i < 2; i++) { const a = lance.localToWorld(new V3(0.42, 0, 0)), b = lance.localToWorld(new V3(1.4, 0, 0)); sprayAt(a, b.sub(a).normalize()); }
        if (st.steam && Math.random() < 0.3) fx.smoke(S.localToWorld(new V3(BIN.x, 1.1, BIN.z)), new V3(0, 0.9, 0), 0.3, 0xeef2f8, 1.6);
      };
      st.action = async function () {
        if (st.done) { m.position.x = X0; st.lastX = X0; pop(m, 0.5); bin.lid.rotation.z = 0; st.done = false; await sleep(0.5); }
        await Promise.all([step("Oh ! Une poubelle a pris feu dans la rue. On ne s'approche pas, et on appelle le 18 : les pompiers !", 'poubelle'), tw(2, (k) => (fire = 0.15 + 0.5 * k)), to(bin.lid.rotation, 'z', 0.5, 0.6)]);
        engineOn(60); st.flash = true; const stop = siren('pompiers', 5);
        await Promise.all([step('Pin-pon ! Le fourgon pompe arrive très vite.', 'camion'), to(m.position, 'x', 0, 4.4, easeOut)]);
        stop();
        S.updateMatrixWorld(true);
        const reelP = S.worldToLocal(F.reel.localToWorld(new V3(0, -0.3, 0.6)));
        [f1, f2].forEach((f, i) => { f.position.set(1.6 - i * 1.1, 0, 1.6); f.rotation.y = 0; pop(f, 0.4); });
        await Promise.all([step('Les pompiers descendent, ouvrent les rideaux, et déroulent le tuyau.', 'rideaux'), to(F.shutter.scale, 'y', 0.06, 1.2),
          walkTo(f2, -2.9, 1.9, 2.0),
          (async () => { await walkTo(f1, -4.2, 1.5, 1.6); hose.visible = true; const p0 = f1.position.clone(), p1 = new V3(0.9, 0, 2.75);
            f1.rotation.y = Math.atan2(-(p1.z - p0.z), p1.x - p0.x);
            await tw(2.6, (k) => { f1.position.lerpVectors(p0, p1, k); f1.userData.walk(k * 18); F.reel.rotation.z = k * 9; setHose(reelP, S.worldToLocal(lance.localToWorld(new V3(-0.05, 0, 0)))); }, lin); f1.userData.walk(0); f1.rotation.y = -0.02; })()]);
        S.updateMatrixWorld(true); setHose(reelP, S.worldToLocal(lance.localToWorld(new V3(-0.05, 0, 0))));
        f1.userData.arms.forEach((a) => (a.rotation.z = 1.25)); engineOn(160);
        st.water = true; tone(160, 0, 3.2, 'sawtooth', 0.015, 140);
        await Promise.all([step("La pompe envoie l'eau de la citerne dans le tuyau. Pschhh !", 'lance'), tw(3.2, (k) => (fire = Math.max(0, 0.65 * (1 - k * 1.2))), lin)]);
        fire = 0; st.water = false; st.steam = true; engineOff();
        await Promise.all([step('Le feu est éteint ! Bravo les pompiers.', 'poubelle'), sleep(1.2)]);
        f1.userData.arms.forEach((a) => (a.rotation.z = 0));
        const p1 = f1.position.clone();
        await Promise.all([step('On range le tuyau, et on ferme les rideaux.', 'tuyau'), tw(2.2, (k) => { const p = p1.clone().lerp(new V3(-4.2, 0, 1.5), k); f1.position.copy(p); f1.rotation.y = Math.PI; f1.userData.walk(k * 16); F.reel.rotation.z = 9 * (1 - k); setHose(reelP, new V3(p.x + 0.1, 0.75, p.z)); }, lin), to(F.shutter.scale, 'y', 1, 1.6)]);
        hose.visible = false; st.steam = false;
        await Promise.all([walkTo(f1, 1.6, 1.6, 1.6), walkTo(f2, 0.5, 1.6, 1.2)]);
        f1.visible = false; f2.visible = false; st.flash = false; chime(); st.done = true;
      };
    })();

    /* ---- l'ambulance des pompiers : une cheville tordue au parc ---- */
    (function () {
      const st = makeStation('vsav'), S = st.g, X0 = -15;
      const V = van(S, { body: SM.red, band: SM.yel, band2: SM.white, text: 'SAPEURS-POMPIERS', color: '#ffffff', label: 'POMPIERS' }); const m = V.g; st.m = m; st.wheels = V.wheels; m.position.x = X0; st.lastX = X0;
      bench(S, -5.6, 3.95, Math.PI);
      const man = walker(S, -5.6, 3.7, { top: 0x2f7de0, bottom: 0x3a3a48 }); const MAN = { p: man.position.clone() };
      const seat = () => { S.attach(man); man.rotation.set(0, Math.PI / 2, 0); man.position.set(MAN.p.x, 0, MAN.p.z); sit(man, 1.45, 0.4); man.position.y = 0.0; man.children[0].rotation.z = 1.2; man.children[1].rotation.z = 1.45; };
      const splint = rbox(man.children[0], 0.2, 0.26, 0.2, 0.04, SM.orange, 0.02, -0.36, 0, 0.02); splint.visible = false;
      seat();
      const br = brancard(m, -1.35, 0.45, 0); const BR = br.position.clone();
      const crew = [pompier(S), pompier(S)]; crew.forEach((c) => (c.visible = false));
      part(st, 'monsieur', 'le monsieur', anchor(man, 0, 1.5, 0), false);
      part(st, 'ambulance', "l'ambulance", anchor(m, 0, 3.0, 0.6), true);
      part(st, 'brancard', 'le brancard', anchor(br, 0, 1.0, 0.3), false);
      part(st, 'attelle', "l'attelle", anchor(man.children[0], 0, -0.4, 0.1), false);
      st.focus = new V3(-2.5, 1.5, 1.5); st.size = { w: 20, h: 9 }; st.tagAt = anchor(m, 0, 3.6, 0);
      st.update = (dt) => { roll(st, dt); flash(V.L, st.flash, T); };
      st.action = async function () {
        if (st.done) { m.visible = true; m.position.x = X0; st.lastX = X0; pop(m, 0.5); m.attach(br); br.position.copy(BR); br.rotation.set(0, 0, 0); seat(); splint.visible = false; st.done = false; await sleep(0.5); }
        tone(500, 0, 0.3, 'sine', 0.04, 380);
        await Promise.all([step("Aïe ! Ce monsieur a glissé dans le parc. Il s'est tordu la cheville.", 'monsieur'), tw(1.4, (k) => (man.rotation.z = Math.sin(k * Math.PI * 2) * 0.08))]);
        engineOn(60); st.flash = true; const stop = siren('pompiers', 4.5);
        await Promise.all([step("Pin-pon ! L'ambulance rouge des pompiers arrive.", 'ambulance'), to(m.position, 'x', 0, 4.2, easeOut)]);
        stop(); engineOff();
        crew.forEach((c, i) => { c.position.set(-3.4, 0, 0.9 - i * 1.8); c.rotation.y = 0; pop(c, 0.4); });
        await Promise.all([step('Les pompiers ouvrent les portes, et sortent le brancard : un lit à roulettes.', 'brancard'), tw(1, (k) => { V.doors[0].rotation.y = 1.9 * k; V.doors[1].rotation.y = -1.9 * k; })]);
        S.attach(br); const b0 = br.position.clone();
        await tw(1.6, (k) => { br.position.set(b0.x - 3.0 * k, b0.y * (1 - clamp((k - 0.6) / 0.4, 0, 1)), b0.z); }, lin);
        await Promise.all([tw(2, (k) => { br.position.x = b0.x - 3.0 - 0.9 * k; br.position.z = b0.z + 2.3 * k; br.position.y = 0; }, easeSine), walkTo(crew[0], -6.6, 2.6, 2), walkTo(crew[1], -4.0, 2.4, 2)]);
        splint.visible = true; pop(splint, 0.4); ding();
        await step("Ils mettent une attelle sur sa cheville, puis l'installent sur le brancard. Ça va aller !", 'attelle');
        br.attach(man); lie(man); man.position.set(0.66, 0.92, 0); man.rotation.set(0, 0, Math.PI / 2);
        br.updateMatrixWorld(true);
        crew.forEach((c) => (c.userData.arms.forEach((a) => (a.rotation.z = 1.1))));
        const b1 = br.position.clone();
        await Promise.all([step("Hop, dans l'ambulance !", 'brancard'), tw(2, (k) => { br.position.set(b1.x + 0.9 * k, 0, b1.z - 2.3 * k); crew[0].position.set(br.position.x - 1.3, 0, br.position.z); crew[0].userData.walk(k * 14); }, easeSine)]);
        await tw(1.4, (k) => { br.position.set(b1.x + 0.9 + 3.0 * k, b0.y * clamp(k / 0.4, 0, 1), b0.z); crew[0].position.set(br.position.x - 1.3, 0, br.position.z); crew[0].userData.walk(k * 10); }, lin);
        m.attach(br); crew.forEach((c) => { c.visible = false; c.userData.arms.forEach((a) => (a.rotation.z = 0)); });
        await tw(0.8, (k) => { V.doors[0].rotation.y = 1.9 * (1 - k); V.doors[1].rotation.y = -1.9 * (1 - k); }); thud();
        engineOn(60);
        await Promise.all([step("En route pour l'hôpital : là-bas, on va bien le soigner.", 'ambulance'), to(m.position, 'x', 23, 5, easeIn)]);
        m.visible = false; engineOff(); st.flash = false; chime(); st.done = true;
      };
    })();

    /* ---- le SAMU : arrivée aux urgences ---- */
    (function () {
      const st = makeStation('samu'), S = st.g;
      const V = van(S, { body: SM.white, band: SM.blue, band2: SM.orange, text: 'SAMU', color: '#1c3f9a', label: 'SAMU', star: SM.blueL }); const m = V.g; st.m = m;
      const IN = route([[-9, 9.3], [-5, 9.3], [-1.5, 7.2], [0.6, 3.6], [1.8, 1.0], [3.4, 0.5]], false, 0.35);
      placeOn(m, IN, IN.len); const spinV = spin(m, V.wheels, 0.38);
      const br = brancard(m, -1.35, 0.45, 0); const BR = br.position.clone();
      const mamie = walker(br, 0, 0, { top: 0xc87ab0, hair: 0xdadbe4 }); lie(mamie); mamie.position.set(0.66, 0.92, 0);
      const doc = walker(S, 0, 0, { top: 0xf4f5f8, bottom: 0xf4f5f8 }), amb = walker(S, 0, 0, { top: 0x2f6fe0, bottom: 0x23305a }); [doc, amb].forEach((c) => (c.visible = false));
      // the automatic doors of the emergency department
      const DOOR = new V3(-1.6, 0, -1.72);
      rbox(S, 2.5, 2.3, 0.03, 0.02, std(0xfff0c8, 0.6, 0, { emissive: 0xffe0a0, emissiveIntensity: 0.4 }), DOOR.x, 1.15, DOOR.z - 0.02, 0.01);
      const panels = [-0.6, 0.6].map((dx) => { const p = grp(S, DOOR.x + dx, 0, DOOR.z + 0.04); rbox(p, 1.2, 2.3, 0.05, 0.02, MT.glass, 0, 1.15, 0, 0.01); box(p, 1.2, 0.06, 0.06, SM.alu, 0, 2.28, 0); box(p, 0.05, 2.3, 0.06, SM.alu, -dx * 0.95, 1.15, 0); return p; });
      part(st, 'samu', "l'ambulance du SAMU", anchor(m, 0, 3.1, 0.6), true);
      part(st, 'urgences', 'les urgences', anchor(S, DOOR.x, 3.4, DOOR.z), true);
      part(st, 'portes', 'les portes arrière', anchor(m, -2.9, 1.8, 0.6), false);
      part(st, 'docteur', 'le docteur', anchor(doc, 0, 1.5, 0), false);
      st.focus = new V3(-0.5, 1.8, 2.5); st.size = { w: 18, h: 9 }; st.tagAt = anchor(m, 0, 3.6, 0);
      blockers.push(() => (m.visible && m.position.z > 3 && st.moving ? wp(m) : null));
      st.update = () => { spinV(); flash(V.L, st.flash, T); };
      st.action = async function () {
        if (st.done) { m.attach(br); br.position.copy(BR); br.rotation.set(0, 0, 0); br.attach(mamie); mamie.position.set(0.66, 0.92, 0); mamie.visible = true; st.done = false; }
        placeOn(m, IN, 0); pop(m, 0.5); st.flash = true; st.moving = true; engineOn(60); const stop = siren('samu', 5.5);
        await Promise.all([step("Le SAMU arrive à l'hôpital, avec ses lumières bleues et sa sirène.", 'samu'), along(m, IN, 0, IN.len, 5.5, easeOut)]);
        stop(); st.moving = false; engineOff();
        await Promise.all([step("Il se gare devant les urgences : là, on soigne les gens tout de suite.", 'urgences'), sleep(1)]);
        m.updateMatrixWorld(true);
        const rear = S.worldToLocal(m.localToWorld(new V3(-3.4, 0, 0)));
        [doc, amb].forEach((c, i) => { c.position.set(rear.x + 0.2, 0, rear.z + (i ? -0.9 : 0.9)); c.rotation.y = Math.PI; pop(c, 0.4); });
        await Promise.all([step('Le docteur et l’ambulancier ouvrent les portes, et sortent le brancard.', 'portes'), tw(1, (k) => { V.doors[0].rotation.y = 1.9 * k; V.doors[1].rotation.y = -1.9 * k; })]);
        S.attach(br); const b0 = br.position.clone(), b1 = new V3(rear.x - 1.0, 0, rear.z);
        await tw(1.8, (k) => { br.position.lerpVectors(b0, b1, k); br.position.y = b0.y * (1 - clamp((k - 0.55) / 0.45, 0, 1)); }, lin);
        panels.forEach((p, i) => to(p.position, 'x', DOOR.x + (i ? 1.75 : -1.75), 1.2)); ding();
        const b2 = new V3(DOOR.x, 0, DOOR.z + 1.1);
        await Promise.all([step("Les portes de l'hôpital s'ouvrent toutes seules. Bonjour madame !", 'urgences'),
          tw(2, (k) => { br.position.lerpVectors(b1, b2, k); br.rotation.y = -Math.PI / 2 * k; doc.position.set(br.position.x + 0.2, 0, br.position.z + 1.3); doc.rotation.y = Math.PI / 2; doc.userData.walk(k * 12); }, easeSine), walkTo(amb, b2.x + 0.9, b2.z + 0.2, 2)]);
        await Promise.all([step('Les docteurs de l’hôpital vont bien la soigner.', 'docteur'), tw(2.2, (k) => { br.position.z = b2.z - 3.4 * k; doc.position.z = br.position.z + 1.3; doc.userData.walk(k * 12); }, lin)]);
        br.visible = false; doc.visible = false;
        panels.forEach((p, i) => to(p.position, 'x', DOOR.x + (i ? 0.6 : -0.6), 1.2));
        await Promise.all([walkTo(amb, rear.x, rear.z - 0.9, 1.8)]);
        amb.visible = false; await tw(0.8, (k) => { V.doors[0].rotation.y = 1.9 * (1 - k); V.doors[1].rotation.y = -1.9 * (1 - k); }); thud();
        br.visible = true; doc.visible = false; m.attach(br); br.position.copy(BR); br.rotation.set(0, 0, 0); mamie.visible = false;
        st.flash = false; await step("L'ambulance est prête pour aider quelqu'un d'autre.", 'samu'); chime(); st.done = true;
      };
    })();

    /* ---- la voiture de police : les enfants traversent ---- */
    (function () {
      const st = makeStation('police'), S = st.g;
      const C = policeCar(S); const m = C.g; st.m = m; st.wheels = C.wheels; m.rotation.y = Math.PI; const CX0 = 8.2, CX1 = 4.0, CZ = -4.45; m.position.set(CX0, 0, CZ); st.lastX = CX0;
      const kids = [0, 1, 2].map((i) => { const k = walker(S, -0.4, 5.0 + i * 0.75, { kid: true }); k.rotation.y = Math.PI / 2; return k; });
      const maitresse = walker(S, 0.4, 7.4, { top: 0x3aa46a, hair: 0xd8b060 }); maitresse.rotation.y = Math.PI / 2;
      const group = [...kids, maitresse]; const homes = group.map((p) => p.position.clone());
      const cop = policier(S, 0, 0); cop.visible = false;
      const on = { stop: false };
      blockers.push(() => (on.stop ? S.localToWorld(new V3(-2.3, 0, 1.5)) : null), () => (on.stop ? S.localToWorld(new V3(2.3, 0, -1.5)) : null));
      part(st, 'enfants', 'les enfants', anchor(kids[1], 0, 1.4, 0), true);
      part(st, 'passage', 'le passage piéton', anchor(S, 0, 0.2, 2.2), false);
      part(st, 'gyrophares', 'les gyrophares', anchor(m, -0.55, 2.0, 0), false);
      part(st, 'policier', 'le policier', anchor(cop, 0, 1.6, 0), false);
      part(st, 'voiture', 'la voiture de police', anchor(m, 0, 2.2, 0), true);
      st.focus = new V3(2.2, 1.2, 0.6); st.size = { w: 17, h: 10 }; st.tagAt = anchor(m, 0, 2.8, 0);
      st.update = (dt) => {
        const x = m.position.x, dx = x - st.lastX; st.lastX = x; if (dx) st.wheels.forEach((w) => (w.rotation.z += dx / w.userData.r)); // the car faces −x
        flash(C.L, st.flash, T, 15);
      };
      st.action = async function () {
        if (st.done) { group.forEach((p, i) => { p.position.copy(homes[i]); p.rotation.y = Math.PI / 2; p.userData.arms.forEach((a) => (a.rotation.z = 0)); }); m.position.x = CX0; st.lastX = CX0; pop(m, 0.5); st.done = false; await sleep(0.5); }
        await Promise.all([step('Des enfants veulent traverser la rue, pour aller voir les canards.', 'enfants'), sleep(0.6)]);
        engineOn(55); st.flash = true; const stop = siren('police', 2.2);
        await Promise.all([step('La voiture de police arrive, et allume ses lumières bleues.', 'gyrophares'), to(m.position, 'x', CX1, 3, easeOut)]);
        stop(); engineOff();
        cop.position.set(CX1 - 0.2, 0, CZ + 1.3); cop.rotation.y = -Math.PI / 2; pop(cop, 0.4); on.stop = true;
        await walkTo(cop, 2.0, -1.0, 1.3);
        cop.rotation.y = Math.PI; cop.userData.arms[1].rotation.z = Math.PI / 2; cop.userData.arms[0].rotation.z = 0; on.stop = true; whistle();
        await Promise.all([step('Le policier lève la main : stop ! Les voitures s’arrêtent.', 'policier'), tw(1.2, (k) => (cop.rotation.y = Math.PI - Math.sin(k * Math.PI) * 0.9))]);
        cop.rotation.y = Math.PI / 2 + 0.6;
        await step('Les enfants traversent sur le passage piéton, bien en rang.', 'passage');
        await Promise.all(group.map((p, i) => sleep(i * 0.25).then(() => walkTo(p, p.position.x, -7.1 - i * 0.7 + (i === 3 ? -0.2 : 0), 4.2, true))));
        group.forEach((p) => { p.rotation.y = 0.3; p.userData.arms[0].rotation.z = 2.7; }); ding();
        await Promise.all([step('Tout le monde est passé. Merci monsieur le policier !', 'policier'), tw(1.4, (k) => group.forEach((p) => (p.userData.arms[0].rotation.z = 2.6 + Math.sin(k * 20) * 0.3)))]);
        on.stop = false; cop.userData.arms[1].rotation.z = 0;
        await walkTo(cop, CX1 - 0.2, CZ + 1.3, 1.3); cop.visible = false;
        st.flash = false; chime(); st.done = true;
      };
    })();

    /* ---- la moto de police : le feu en panne ---- */
    (function () {
      const st = makeStation('moto'), S = st.g;
      const M = policeMoto(S); const m = M.g; st.m = m; st.wheels = M.wheels;
      const PARK = new V3(-6.5, 0, 3.0), START = route([[-18, 2.8], [-11, 2.8], [-6.5, 3.0]], false, 0.3);
      m.position.copy(PARK); const spinM = spin(m, M.wheels, 0.32);
      const cop = policier(S, 0, 0); cop.visible = false; sph(cop, 0.05, SM.alu, 0.2, 1.05, 0);
      blockers.push(() => (st.walking && cop.visible ? wp(cop) : null));
      const head = anchor(S, 0, 4.6, 0);
      part(st, 'moto', 'la moto', anchor(m, 0, 1.7, 0.3), true);
      part(st, 'feu', 'le feu tricolore', anchor(S, -3.4, 4.2, 3.6), true);
      part(st, 'policier', 'le policier', anchor(cop, 0, 1.6, 0), false);
      part(st, 'carrefour', 'le carrefour', head, false);
      st.focus = new V3(-1.5, 1.4, 1.2); st.size = { w: 17, h: 10 }; st.tagAt = anchor(m, 0, 2.6, 0);
      st.update = () => { spinM(); flash(M.L, st.flash, T, 16); };
      st.action = async function () {
        LIGHTS.mode = 'blink'; tone(300, 0, 0.4, 'square', 0.03, 200);
        await Promise.all([step('Oh oh ! Le feu tricolore est en panne : il clignote orange. Les voitures ne savent plus qui doit passer.', 'feu'), sleep(1)]);
        placeOn(m, START, 0); pop(m, 0.4); M.rider.visible = true; st.flash = true; engineOn(90); const stop = siren('police', 3);
        await Promise.all([step('La moto de police arrive, en se faufilant.', 'moto'), along(m, START, 0, START.len, 3.4, easeOut)]);
        stop(); engineOff();
        M.rider.visible = false; cop.position.set(PARK.x + 0.4, 0, PARK.z + 0.75); cop.rotation.y = 0; cop.visible = true; st.walking = true;
        await walkTo(cop, 0, 0, 2.4); st.walking = false;
        whistle(); cop.rotation.y = 0;
        await Promise.all([step('Le policier se met au milieu du carrefour, avec son sifflet. Tuuut !', 'policier'), sleep(1)]);
        LIGHTS.mode = 'manual'; LIGHTS.manual = 'main'; cop.rotation.y = 0; cop.userData.arms[0].rotation.x = -Math.PI / 2; cop.userData.arms[1].rotation.x = Math.PI / 2;
        await Promise.all([step('Il tend les bras : stop pour cette rue ! Les autres voitures peuvent passer.', 'carrefour'), sleep(5.5)]);
        whistle(); LIGHTS.manual = 'cross'; cop.rotation.y = Math.PI / 2;
        await Promise.all([step('Coup de sifflet ! Maintenant, c’est le tour de celles-ci. Chacune son tour !', 'carrefour'), sleep(5.5)]);
        LIGHTS.mode = 'auto'; LIGHTS.manual = null; cop.userData.arms.forEach((a) => (a.rotation.x = 0)); ding(); st.walking = true;
        await Promise.all([step('Le feu est réparé ! Le motard remonte sur sa moto. Merci !', 'feu'), walkTo(cop, PARK.x + 0.4, PARK.z + 0.75, 2.4)]);
        st.walking = false;
        cop.visible = false; M.rider.visible = true; st.flash = false; chime();
      };
    })();

    /* ---- l'hélicoptère Dragon : retour à l'hôpital ---- */
    (function () {
      const st = makeStation('helico'), S = st.g;
      const pad = grp(S, 0.6, 0, 0);
      cylY(pad, 4.7, 0.12, std(0x8a8e9a, 0.9, 0), 0, 0.06, 0, 40); add(pad, new THREE.RingGeometry(4.0, 4.3, 40), SM.yel, 0, 0.13, 0).rotation.x = -Math.PI / 2;
      [[-1.2, 0, 0.45, 3.0], [1.2, 0, 0.45, 3.0], [0, 0, 2.0, 0.45]].forEach(([x, z, w, dd]) => box(pad, w, 0.02, dd, SM.white, x, 0.13, z));
      { const pl = std(0xffffff, 0.3, 0, { emissive: 0x9affb0, emissiveIntensity: 0.7 }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; cylY(pad, 0.09, 0.12, pl, Math.cos(a) * 4.55, 0.15, Math.sin(a) * 4.55, 8); } }
      { const ws = grp(S, -2.6, 0, -6.2); rod(ws, new V3(0, 0, 0), new V3(0, 3.2, 0), 0.05, SM.alu); const s = add(ws, new THREE.ConeGeometry(0.35, 1.8, 10, 1, true), std(0xf26a2a, 0.5, 0, { side: THREE.DoubleSide }), 0.9, 3.05, 0); s.rotation.z = Math.PI / 2 + 0.25; }
      const H = dragon(S); st.m = H; const R = H.userData.rotor, TR = H.userData.tail; const HP = new V3(0.6, 0, 0); H.position.copy(HP); H.rotation.y = Math.PI;
      const bed = brancard(S, -3.6, 0, -5.0, SM.blueL); bed.rotation.y = -Math.PI / 2; const BED = bed.position.clone(), BT = new V3(-3.0, 0, 2.6);
      const push = () => { nurses[0].position.set(bed.position.x, 0, bed.position.z - 1.45); nurses[1].position.set(bed.position.x, 0, bed.position.z + 1.45); };
      const nurses = [walker(S, 0, 0, { top: 0x8fd0e8, bottom: 0x8fd0e8 }), walker(S, 0, 0, { top: 0x8fd0e8, bottom: 0x8fd0e8 })]; nurses.forEach((n) => (n.visible = false));
      const hiker = walker(S, 0, 0, { top: 0x3aa46a, bottom: 0x5a4a3a, hat: std(0xd84a2a, 0.7, 0) }); rbox(hiker, 0.2, 0.42, 0.34, 0.06, std(0xd8802a, 0.7, 0), -0.2, 0.75, 0, 0.02); hiker.visible = false;
      const sky = { out: route([[0.6, 0, 9], [-5, 0, 10.5], [-14, -12, 15], [-30, -40, 22]], false, 0.3), back: route([[40, -30, 24], [18, -8, 14], [6, 0, 9.5], [0.6, 0, 8]], false, 0.3) };
      part(st, 'rotor', 'le grand rotor', anchor(R, 2.6, 0.3, 0), true);
      part(st, 'helipad', 'le grand H', anchor(pad, 2.6, 0.3, 3.0), true);
      part(st, 'treuil', 'le treuil', anchor(H, 0.5, H.userData.Y + 1.1, 1.55), false);
      part(st, 'infirmiers', 'les infirmiers', anchor(nurses[0], 0, 1.5, 0), false);
      st.focus = new V3(-1.5, 3, 0.5); st.size = { w: 20, h: 12 }; st.tagAt = anchor(H, 0, 4.4, 0);
      st.update = (dt) => { R.rotation.y += dt * (st.rpm || 0); TR.rotation.z += dt * (st.rpm || 0) * 1.7; if ((st.rpm || 0) > 12 && H.visible && H.position.y < 5) for (let i = 0; i < 2; i++) { const a = rnd(0, 6.28); fx.smoke(S.localToWorld(new V3(H.position.x + Math.cos(a) * 4, 0.25, Math.sin(a) * 4)), new V3(Math.cos(a) * 2, 0.3, Math.sin(a) * 2).applyAxisAngle(new V3(0, 1, 0), S.rotation.y), 0.35, 0xd8d4c8, 0.8); } };
      st.action = async function () {
        if (st.done) { bed.position.copy(BED); bed.visible = true; S.attach(hiker); hiker.visible = false; st.done = false; }
        engineOn(100);
        await Promise.all([step("Le Dragon, l'hélicoptère rouge et jaune, part en mission.", 'rotor'), tw(3, (k) => (st.rpm = 24 * k), lin), tone(90, 0, 3, 'sawtooth', 0.02, 160)]);
        await Promise.all([step("Il décolle tout droit, et file vers la montagne pour aider quelqu'un.", 'helipad'), to(H.position, 'y', 9, 3, easeSine)]);
        await tw(4, (k) => { placeOn(H, sky.out, sky.out.len * k * k); H.rotation.z = -0.15; }, lin);
        H.visible = false; engineOff(); await sleep(1.2);
        H.visible = true; engineOn(100);
        await Promise.all([step('Le voilà qui revient ! Il ramène un promeneur qui s’est fait mal au pied.', 'treuil'), tw(5, (k) => { placeOn(H, sky.back, sky.back.len * (1 - (1 - k) * (1 - k))); H.rotation.z = -0.12 * (1 - k); }, lin)]);
        H.rotation.set(0, Math.PI, 0); H.position.set(HP.x, 8, HP.z);
        await Promise.all([step('Il descend tout doucement sur le grand H, à côté de l’hôpital.', 'helipad'), to(H.position, 'y', 0, 4, easeSine)]);
        thud(); await tw(2.2, (k) => (st.rpm = 24 * (1 - k) + 6 * k), lin); st.rpm = 6; engineOff();
        push(); nurses.forEach((n) => { n.rotation.y = -Math.PI / 2; pop(n, 0.4); });
        await Promise.all([step('Les infirmiers arrivent avec un lit à roulettes.', 'infirmiers'),
          tw(3, (k) => { bed.position.lerpVectors(BED, BT, k); push(); nurses.forEach((n) => n.userData.walk(k * 16)); }, easeSine)]);
        S.attach(hiker); stand(hiker); hiker.position.set(-0.1, 0, 1.3); hiker.rotation.set(0, 0, 0); pop(hiker, 0.4);
        await walkTo(hiker, BT.x + 0.75, BT.z, 1.2);
        bed.attach(hiker); lie(hiker); hiker.position.set(0.66, 0.92, 0); hiker.rotation.set(0, 0, Math.PI / 2); ding();
        const b1 = bed.position.clone();
        await Promise.all([step("Hop, sur le lit ! À l'hôpital, on va soigner son pied.", 'infirmiers'),
          tw(4, (k) => { bed.position.lerpVectors(b1, BED, k); push(); nurses.forEach((n) => { n.rotation.y = Math.PI / 2; n.userData.walk(k * 20); }); }, easeSine)]);
        await tw(1.4, (k) => { bed.position.x = BED.x - 3.0 * k; push(); nurses.forEach((n) => { n.rotation.y = Math.PI; n.userData.walk(k * 8); }); }, lin);
        nurses.forEach((n) => (n.visible = false)); bed.visible = false; bed.position.copy(BED);
        await Promise.all([step('Le rotor s’arrête. Mission réussie !', 'rotor'), tw(2, (k) => (st.rpm = 6 * (1 - k)), lin)]);
        st.rpm = 0; chime(); st.done = true;
      };
    })();

    /* ---- le bateau des pompiers : le ballon dans la rivière ---- */
    (function () {
      const st = makeStation('bateau'), S = st.g;
      const B = fireBoat(S); const m = B.g; st.m = m; const HOME = new V3(-6, 0, 3.6); m.position.copy(HOME);
      const boy = walker(S, -2.2, 7.7, { kid: true, top: 0x2f7de0 }); boy.rotation.y = -Math.PI / 2; const BOY = boy.position.clone();
      const ball = ballon(S); const BALL = new V3(BOY.x + 0.35, 0.62, BOY.z - 0.15); ball.position.copy(BALL);
      const OUT = route([[-6, 3.6], [-2, 2.6], [1.2, 0.8], [3.4, 0.4]], false, 0.3), BACK = route([[3.4, 0.4], [5.8, -1.4], [4.6, -3.8], [0, -3.6], [-5, -1.0], [-9.5, 2.0], [-8, 3.5], [-6, 3.6]], false, 0.4);
      const BALLW = new V3(7.0, 0.12, 1.2);
      part(st, 'ballon', 'le ballon', anchor(ball, 0, 0.6, 0), false);
      part(st, 'gilets', 'les gilets de sauvetage', anchor(B.crew, 0, 1.4, 0), true);
      part(st, 'moteur', 'le moteur', anchor(m, -2.85, 1.6, 0), true);
      part(st, 'epuisette', "l'épuisette", anchor(B.net, 2.45, 0.3, 0), false);
      st.focus = new V3(0, 1, 3); st.size = { w: 20, h: 10 }; st.az = YAW + Math.PI; st.el = 0.7; st.tagAt = anchor(m, 0, 3.6, 0);
      st.update = (dt) => {
        flash(B.L, st.flash, T);
        m.position.y = Math.sin(T * 1.7) * 0.05; m.rotation.x = Math.sin(T * 1.3) * 0.025;
        if (st.drift) ball.position.y = 0.12 + Math.sin(T * 2.4) * 0.04;
        if (st.moving && Math.random() < 0.8) { const p = m.localToWorld(new V3(-3.0, 0.1, rnd(-0.6, 0.6))); fx.smoke(p, new V3(rnd(-0.4, 0.4), 0.3, rnd(-0.4, 0.4)), 0.3, 0xeaf6ff, 1.0); }
      };
      st.action = async function () {
        if (st.done) { S.attach(ball); ball.position.copy(BALL); ball.visible = true; st.done = false; }
        boy.userData.arms[0].rotation.z = 2.4;
        await arc(ball, new V3(BOY.x + 1.0, 0.12, BOY.z - 2.4), 1.0, 1.0);
        for (let i = 0; i < 8; i++) fx.smoke(S.localToWorld(new V3(ball.position.x, 0.2, ball.position.z)), new V3(rnd(-1, 1), rnd(1, 2), rnd(-1, 1)), 0.18, 0xeaf6ff, 0.8);
        st.drift = true; const b0 = ball.position.clone();
        await Promise.all([step('Oh non ! Le ballon du petit garçon est tombé dans la rivière. Le courant l’emporte.', 'ballon'), tw(3.6, (k) => { ball.position.x = b0.x + (BALLW.x - b0.x) * k; ball.position.z = b0.z + (BALLW.z - b0.z) * k; }, easeSine)]);
        boy.userData.arms[0].rotation.z = 0;
        engineOn(110); st.flash = true; tone(110, 0, 1.2, 'sawtooth', 0.03, 180);
        await Promise.all([step('Le bateau des pompiers démarre son moteur. Les pompiers ont des gilets, pour flotter.', 'gilets'), sleep(1.4)]);
        st.moving = true;
                await Promise.all([step("Il file sur l'eau jusqu'au ballon.", 'moteur'), along(m, OUT, 0, OUT.len, 4.4, easeSine)]);
        st.moving = false; st.drift = false;
        await Promise.all([step("Le pompier attrape le ballon avec son épuisette.", 'epuisette'), to(B.net.rotation, 'z', -0.4, 1.2)]);
        S.updateMatrixWorld(true); const ringP = S.worldToLocal(B.net.localToWorld(new V3(2.45, -0.15, 0)));
        await tw(0.6, (k) => ball.position.lerp(ringP, k)); B.net.attach(ball); ding();
        await to(B.net.rotation, 'z', 1.2, 1.2);
        st.moving = true;
        await Promise.all([step('Il revient au bord de la rivière...', 'moteur'), along(m, BACK, 0, BACK.len, 7, easeSine)]);
        st.moving = false; engineOff();
        S.attach(ball); boy.userData.arms.forEach((a) => (a.rotation.z = 1.3));
        await Promise.all([step('... et il rend le ballon au petit garçon. Merci les pompiers !', 'ballon'), arc(ball, BALL, 1.1, 1.4)]);
        ding(); boy.userData.arms.forEach((a) => (a.rotation.z = 0)); st.flash = false; chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate, blockers, LIGHTS);
  }
};

/* ================= the town around the vehicles ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
/** A window with its frame and two shutters, on a wall facing +z at z. */
function fenetre(g, x, y, z, w = 0.8, h = 1.1, sh = SHUT[0]) {
  box(g, w + 0.14, h + 0.14, 0.04, SM.white, x, y, z + 0.01); box(g, w, h, 0.05, SM.glass, x, y, z + 0.03); box(g, 0.04, h, 0.06, SM.white, x, y, z + 0.04);
  box(g, w + 0.24, 0.08, 0.14, SM.white, x, y - h / 2 - 0.07, z + 0.06);
  if (sh) [1, -1].forEach((s) => box(g, w / 2, h, 0.05, sh, x + s * (w * 0.75 + 0.04), y, z + 0.04));
}
/** French town house, its front (+z) facing the street. */
function maison(p, h, d, yaw, o = {}) {
  const g = at(p, h, d, yaw), W = o.w || 5, D = o.d || 5, H = o.h || 5.4, wall = o.wall || pick(WALLS), roof = o.roof || pick([SM.slate, SM.tile, SM.tile]), sh = o.sh || pick(SHUT);
  rbox(g, W, H, D, 0.06, wall, 0, H / 2, 0, 0.02); rbox(g, W + 0.06, 0.5, D + 0.06, 0.03, SM.stoneD, 0, 0.25, 0, 0.01);
  const rg = grp(g, 0, H, 0); rg.rotation.y = Math.PI / 2; ext(rg, [[-D / 2 - 0.35, 0], [D / 2 + 0.35, 0], [0, o.rh || 2.2]], 0.05, W + 0.3, roof, 0, 0, 0, 0.03);
  rbox(g, 0.6, 1.4, 0.6, 0.04, SM.stoneD, W * 0.25, H + 1.6, -D * 0.15, 0.02);
  const fl = Math.max(1, Math.round((H - 1) / 2.4)), n = Math.max(2, Math.round((W - 1.2) / 1.6)), back = grp(g); back.rotation.y = Math.PI;
  for (let f = 0; f < fl; f++) for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 1.6, y = 1.5 + f * 2.4; fenetre(back, x, y, D / 2, 0.75, 1.1, sh); if (f === 0 && o.shop) continue; if (f === 0 && Math.abs(x - (o.door ?? 0)) < 1.2) continue; fenetre(g, x, y, D / 2, 0.75, 1.1, sh); if (f > 0 && o.balcony) rail(g, [[x - 0.6, y - 0.55, D / 2 + 0.3], [x - 0.6, y - 0.1, D / 2 + 0.3], [x + 0.6, y - 0.1, D / 2 + 0.3], [x + 0.6, y - 0.55, D / 2 + 0.3]], 0.02, SM.dark); }
  if (o.shop) { box(g, W - 1.0, 1.7, 0.06, SM.glass, 0.4, 1.35, D / 2 + 0.02); box(g, W - 0.6, 0.5, 0.08, o.shopCol || SM.green, 0, 2.5, D / 2 + 0.04); box(g, 0.9, 2.0, 0.06, SM.wood, -W / 2 + 0.8, 1.0, D / 2 + 0.03);
    const a = grp(g, 0, 2.3, D / 2 + 0.05); const aw = box(a, W - 0.4, 0.04, 1.2, o.awning || SM.awnR, 0, -0.2, 0.55); aw.rotation.x = 0.35;
    if (o.sign) decal(g, o.sign, W - 1.0, 0.36, '#ffffff', 0, 2.5, D / 2 + 0.09, null); }
  else box(g, 0.9, 2.0, 0.06, o.doorCol || SM.wood, o.door ?? 0, 1.0, D / 2 + 0.03);
  return g;
}
function trafficLight(p, h, d, yaw, M, ped) {
  const g = at(p, h, d, yaw); cylY(g, 0.07, 3.2, SM.dark, 0, 1.6, 0, 8);
  const hd = grp(g, 0.12, 2.7, 0); rbox(hd, 0.22, 0.9, 0.34, 0.05, SM.dark, 0, 0, 0, 0.02); box(hd, 0.02, 1.0, 0.44, SM.black, -0.11, 0, 0);
  [[M.r, 0.27], [M.a, 0], [M.g, -0.27]].forEach(([mm, y]) => { const s = sph(hd, 0.09, mm, 0.11, y, 0); s.scale.x = 0.5; box(hd, 0.12, 0.03, 0.22, SM.dark, 0.14, y + 0.12, 0); });
  if (ped) { rbox(g, 0.18, 0.4, 0.26, 0.04, SM.dark, -0.1, 1.9, 0, 0.02); }
  return g;
}
const TLM = { main: { r: null, a: null, g: null }, cross: { r: null, a: null, g: null } };
['main', 'cross'].forEach((k) => { TLM[k] = { r: std(0x6a1810, 0.4, 0, { emissive: 0xff2a1a, emissiveIntensity: 0 }), a: std(0x6a4a10, 0.4, 0, { emissive: 0xffa21a, emissiveIntensity: 0 }), g: std(0x10501c, 0.4, 0, { emissive: 0x2aff5a, emissiveIntensity: 0 }) }; });

let FLAGS = [];
function buildTown(scene) {
  /* -- la rivière : quai, parapet, pont, ponton -- */
  { const qm = grp(scene); for (let h = -46; h <= 46; h += 4) { if (Math.abs(h - 4) < 5) continue; const g = at(qm, h, -31.2); rbox(g, 4.02, 0.5, 0.6, 0.04, SM.stone, 0, 0.25, 0, 0.02); }
    const posts = []; for (let h = -44; h <= 44; h += 1.2) if (Math.abs(h - 4) > 4.5 && Math.abs(h + 12) > 1.2) posts.push(h);
    instanced(scene, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), posts.length, (i, dd) => { const [x, z] = Q(posts[i], -31.2); dd.position.set(x, 0.95, z); dd.rotation.set(0, 0, 0); dd.scale.set(1, 1, 1); return 0x2a2f40; });
    [[-44, -13.2], [-10.8, -0.5], [8.5, 44]].forEach(([a, b]) => { const g = at(scene, (a + b) / 2, -31.2); box(g, b - a, 0.05, 0.05, SM.dark, 0, 1.38, 0); box(g, b - a, 0.04, 0.04, SM.dark, 0, 0.95, 0); });
    // stone bridge on the cross street
    { const g = at(scene, 4, -38.5); [1, -1].forEach((s) => { rbox(g, 0.5, 0.8, 15, 0.05, SM.stone, s * 2.75, 0.4, 0, 0.02); rbox(g, 0.6, 0.12, 15.1, 0.03, SM.stoneD, s * 2.75, 0.84, 0, 0.01); [-4, 0, 4].forEach((z) => { rbox(g, 1.2, 0.7, 1.0, 0.1, SM.stoneD, s * 3.4, 0.0, z, 0.02); lampPost(g, s * 2.75, z + 2); }); }); }
    // the boat pontoon
    { const g = at(scene, -14, -32.4); rbox(g, 6, 0.16, 1.6, 0.03, SM.woodL, 0, 0.12, 0, 0.01); for (let x = -2.8; x <= 2.8; x += 0.4) box(g, 0.04, 0.02, 1.58, SM.wood, x, 0.21, 0); [-2.6, 0, 2.6].forEach((x) => cylY(g, 0.12, 1.4, SM.wood, x, 0.5, -0.75, 8)); rail(g, [[-1.0, 0.2, 0.8], [-1.0, 0.0, 1.6]], 0.03, SM.dark); add(g, new THREE.TorusGeometry(0.3, 0.07, 8, 16), SM.orange, 3.1, 0.9, 0.85); }
    // boats moored on the other bank
    [[-30, -42, SM.white], [22, -42.5, SM.blueL]].forEach(([h, d, mm]) => { const g = at(scene, h, d); extY(g, [[-2, -0.7], [1.2, -0.7], [2.2, 0], [1.2, 0.7], [-2, 0.7]], 0.2, 0.6, mm, 0, 0.1, 0, 0.03); rbox(g, 1.0, 0.6, 0.9, 0.08, SM.white, -0.3, 0.6, 0, 0.02); }); }

  /* -- la caserne des pompiers -- */
  { const g = at(scene, -33, -22);
    rbox(g, 18, 6.6, 8, 0.08, SM.brick, 0, 3.3, 0, 0.02); rbox(g, 18.3, 0.35, 8.3, 0.04, SM.stone, 0, 6.75, 0, 0.02); rbox(g, 18.1, 0.6, 8.1, 0.04, SM.stoneD, 0, 0.3, 0, 0.01);
    [-6.6, -2.2, 2.2, 6.6].forEach((x, i) => {
      box(g, 3.8, 4.6, 0.08, SM.stone, x, 2.3, 4.02);
      if (i === 3) { box(g, 3.4, 4.2, 0.06, std(0x1a1d26, 0.9, 0), x, 2.1, 4.05); box(g, 3.4, 0.5, 0.1, SM.red, x, 3.95, 4.08); const t = grp(g, x, 0, 4.6); rbox(t, 2.4, 2.1, 2.4, 0.15, SM.red, 0, 2.05, 0, 0.03); box(t, 2.0, 0.8, 0.04, SM.glass, 0, 2.45, 1.21); rbox(t, 1.2, 0.14, 0.3, 0.03, std(0x2a5cff, 0.3, 0, { emissive: 0x2a5cff, emissiveIntensity: 0.8 }), 0, 3.15, 0.8, 0.01); rbox(t, 2.44, 0.3, 0.2, 0.05, SM.dark, 0, 0.95, 1.22, 0.02); box(t, 2.42, 0.12, 2.42, SM.yel, 0, 1.25, 0); [0.75, -0.75].forEach((xx) => rbox(t, 0.36, 0.16, 0.06, 0.03, MT.lamp, xx, 1.45, 1.22, 0.01)); [0.85, -0.85].forEach((xx) => { cylX(t, 0.45, 0.3, MT.rubberS, xx, 0.45, 0.6, 16); }); return; }
      box(g, 3.4, 4.2, 0.08, SM.red, x, 2.1, 4.06); for (let y = 0.6; y < 4.2; y += 0.6) box(g, 3.4, 0.04, 0.1, SM.redD, x, y, 4.08); box(g, 2.8, 0.4, 0.1, SM.glass, x, 3.0, 4.09);
    });
    decal(g, 'SAPEURS-POMPIERS', 9, 0.8, '#ffffff', 0, 5.55, 4.07, '#c81e28');
    [-8, -6.2, 6.2, 8].forEach((x) => fenetre(g, x, 5.4, 4.0, 0.7, 0.5, null));
    // tour de manœuvre (training tower)
    const t = grp(g, -10.6, 0, 4.4); rbox(t, 3.2, 12.5, 3.2, 0.06, SM.red, 0, 6.25, 0, 0.02); rbox(t, 3.5, 0.3, 3.5, 0.04, SM.stone, 0, 12.6, 0, 0.02);
    for (let y = 2.2; y < 12; y += 2.4) { box(t, 1.3, 1.5, 0.06, std(0x1a1d26, 0.9, 0), 0, y, 1.61); box(t, 0.06, 1.5, 1.3, std(0x1a1d26, 0.9, 0), 1.61, y, 0); box(t, 1.8, 0.1, 0.4, SM.stone, 0, y - 0.8, 1.78); }
    rail(t, [[-0.9, 0, 1.75], [-0.9, 11, 1.75]], 0.03, SM.alu); rail(t, [[-0.45, 0, 1.75], [-0.45, 11, 1.75]], 0.03, SM.alu); for (let y = 0.3; y < 11; y += 0.35) rod(t, new V3(-0.9, y, 1.75), new V3(-0.45, y, 1.75), 0.015, SM.alu, 4);
    const fl = grp(g, 10, 0, 4.6); cylY(fl, 0.06, 8, SM.white, 0, 4, 0, 8); const f = grp(fl, 0, 7.3, 0); f.userData.dynamic = true; FLAGS.push(f); [SM.fr.b, SM.fr.w, SM.fr.r].forEach((mm, i) => box(f, 0.6, 1.1, 0.03, mm, 0.3 + i * 0.6, 0, 0));
  }
  /* -- le commissariat -- */
  { const g = at(scene, -12, -21.5);
    rbox(g, 10, 6.2, 8, 0.08, SM.cream, 0, 3.1, 0, 0.02); rbox(g, 10.3, 0.3, 8.3, 0.04, SM.stoneD, 0, 6.35, 0, 0.02); rbox(g, 10.1, 1.0, 8.1, 0.04, SM.stone, 0, 0.5, 0, 0.01);
    for (let x = -3.6; x <= 3.6; x += 2.4) { fenetre(g, x, 4.4, 4.0, 0.9, 1.1, SM.blue); if (Math.abs(x) > 1) fenetre(g, x, 1.8, 4.0, 0.9, 1.1, SM.blue); }
    box(g, 1.8, 2.4, 0.08, SM.glass, 0, 1.2, 4.04); box(g, 2.2, 0.15, 0.6, SM.stone, 0, 2.5, 4.3); rbox(g, 2.6, 0.12, 1.4, 0.03, SM.stone, 0, 0.06, 4.6, 0.01);
    decal(g, 'POLICE', 3.6, 0.7, '#ffffff', 0, 3.25, 4.07, '#1c3f9a'); decal(g, 'POLICE NATIONALE', 4.8, 0.36, '#1c3f9a', 0, 5.75, 4.07, null);
    const lt = grp(g, 1.6, 2.7, 4.3); rbox(lt, 0.5, 0.4, 0.3, 0.05, std(0x2a5cff, 0.3, 0, { emissive: 0x2a5cff, emissiveIntensity: 0.9 }), 0, 0, 0, 0.02);
    const fl = grp(g, -4.4, 0, 4.6); cylY(fl, 0.05, 6.5, SM.white, 0, 3.25, 0, 8); const f = grp(fl, 0, 5.9, 0); f.userData.dynamic = true; FLAGS.push(f); [SM.fr.b, SM.fr.w, SM.fr.r].forEach((mm, i) => box(f, 0.5, 0.9, 0.03, mm, 0.25 + i * 0.5, 0, 0));
    [-6.0, 6.2].forEach((x) => { const c = miniCar(g, 'car', 0xf4f5f8); c.position.set(x, 0, -1.5); c.rotation.y = Math.PI / 2; });
  }
  /* -- l'hôpital -- */
  { const g = at(scene, 22, -23.6);
    rbox(g, 22, 10.6, 8, 0.08, SM.white, 0, 5.3, 0, 0.02); rbox(g, 22.3, 0.4, 8.3, 0.04, std(0x9fc8e0, 0.6, 0), 0, 10.8, 0, 0.02);
    for (let f = 0; f < 3; f++) { const y = 2.0 + f * 3.2; box(g, 22.02, 0.5, 8.02, std(0xbfe0f0, 0.7, 0), 0, y - 1.0, 0); for (let x = -10; x <= 10; x += 1.66) { if (f === 0 && x > -10 && x < -1) continue; box(g, 1.1, 1.3, 0.06, SM.glass, x, y + 0.4, 4.02); } [-2.6, -0.9, 0.8, 2.5].forEach((z) => { if (f === 0 && Math.abs(z - 1.4) < 1) return; box(g, 0.06, 1.3, 1.1, SM.glass, 11.02, y + 0.4, z); }); }
    const sign = grp(g, 6.5, 11.6, 3.6); rbox(sign, 6.4, 1.2, 0.2, 0.08, std(0x1c3f9a, 0.4, 0.1), 0, 0, 0, 0.02); decal(sign, 'HÔPITAL', 4.4, 0.8, '#ffffff', 0.8, 0, 0.11, null); rbox(sign, 1.0, 1.0, 0.06, 0.05, SM.white, -2.4, 0, 0.11, 0.02); decal(sign, 'H', 0.9, 0.9, '#1c3f9a', -2.4, 0, 0.15, null);
    box(g, 0.9, 2.2, 0.06, SM.glass, 11.03, 1.1, 1.4).rotation.y = Math.PI / 2; rbox(g, 0.3, 0.12, 1.4, 0.03, SM.white, 11.25, 2.4, 1.4, 0.01);
    // urgences wing with its canopy
    const u = grp(g, -5.5, 0, 6.0); rbox(u, 8.4, 4.0, 4.1, 0.06, SM.white, 0, 2.0, 0, 0.02); rbox(u, 8.6, 0.3, 4.3, 0.03, std(0x9fc8e0, 0.6, 0), 0, 4.1, 0, 0.01);
    [-3.0, 3.2].forEach((x) => fenetre(u, x, 2.0, 2.05, 1.2, 1.2, null));
    decal(u, 'URGENCES', 4.2, 0.62, '#ffffff', 0, 3.4, 2.07, '#d8202a');
    rbox(u, 3.4, 0.12, 0.6, 0.04, SM.white, -1.1, 2.75, 2.35, 0.02); box(u, 3.4, 0.1, 0.06, std(0xd8202a, 0.5, 0), -1.1, 2.72, 2.66);
  }
  /* -- les rues : lampadaires, feux, arbres d'alignement, mobilier -- */
  [-42, -34, -26, -18, -10, -2, 14, 22, 30, 38].forEach((h) => { const [x, z] = Q(h, -0.6); lamp(scene, x, z, YAW - Math.PI / 2); });
  [-36, -24, 10, 24, 34].forEach((h) => { const [x, z] = Q(h, -9.95); lamp(scene, x, z, YAW + Math.PI / 2); });
  for (let d = 4; d <= 36; d += 8) { let [x, z] = Q(-0.2, d); lamp(scene, x, z, YAW); [x, z] = Q(8.2, d + 4); lamp(scene, x, z, YAW + Math.PI); }
  trafficLight(scene, 0.4, -2.45, YAW + Math.PI, TLM.main, true); trafficLight(scene, 7.6, -9.7, YAW, TLM.main, true);
  trafficLight(scene, 0.5, -10.3, YAW + Math.PI / 2, TLM.cross, true); trafficLight(scene, 7.5, -2.45, YAW - Math.PI / 2, TLM.cross, true);
  [[-42, -9.95], [-30, -9.95], [-4, -9.95], [28, -9.95], [-38, -0.6], [-14, -0.6], [18, -0.6], [34, -0.6]].forEach(([h, d], i) => { const [x, z] = Q(h, d); roundTree(scene, x, z, 0.9, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6a9a3a, 0x5a8a3a, 0x7aa84a]); });
  [[26, -0.55], [-30, -0.55]].forEach(([h, d]) => { const [x, z] = Q(h, d); bench(scene, x, z, YAW + Math.PI); });
  /* -- le parc : haies, arbres, aire de jeux, bancs -- */
  for (let h = -44; h <= -2; h += 3) if (Math.abs(h + 1.5 + 20.5) > 2.6) { const g = at(scene, h + 1.5, 0.9); rbox(g, 2.8, 0.7, 0.7, 0.25, SM.hedge, 0, 0.35, 0, 0.04); }
  [[-44, 15], [-40, 31], [-34, 34], [-14, 34], [-4, 30], [-2, 6], [-10, 5], [-3.5, 21.5], [-18, 14], [-44, 4], [-20, 19], [-46, 22]].forEach(([h, d], i) => { const [x, z] = Q(h, d); (i % 3 ? roundTree : autumnTree)(scene, x, z, ...(i % 3 ? [rnd(0.9, 1.15)] : [[0x4a9a4a, 0x3f8a3a, 0x6ab86a]])); });
  { const g = at(scene, -38, 18); rbox(g, 1.0, 0.1, 3.0, 0.04, SM.red, 0, 1.0, 0.6, 0.02).rotation.x = -0.55; rail(g, [[-0.4, 0, -0.9], [-0.4, 1.9, -0.9]], 0.04, SM.yel); rail(g, [[0.4, 0, -0.9], [0.4, 1.9, -0.9]], 0.04, SM.yel); rbox(g, 1.0, 0.1, 0.9, 0.03, SM.yel, 0, 1.9, -1.1, 0.01);
    const s = grp(g, 3.0, 0, 0); [[-1.2], [1.2]].forEach(([x]) => { rod(s, new V3(x, 0, -0.8), new V3(x, 2.4, 0), 0.06, SM.blueL); rod(s, new V3(x, 0, 0.8), new V3(x, 2.4, 0), 0.06, SM.blueL); }); rod(s, new V3(-1.2, 2.4, 0), new V3(1.2, 2.4, 0), 0.06, SM.blueL);
    [-0.5, 0.5].forEach((x) => { rod(s, new V3(x - 0.18, 2.4, 0), new V3(x - 0.18, 0.6, 0), 0.015, SM.dark, 4); rod(s, new V3(x + 0.18, 2.4, 0), new V3(x + 0.18, 0.6, 0), 0.015, SM.dark, 4); rbox(s, 0.5, 0.06, 0.25, 0.02, SM.red, x, 0.58, 0, 0.01); });
    rbox(g, 1.6, 0.25, 1.6, 0.06, SM.woodL, -2.6, 0.12, 1.2, 0.02); }
  [[-11, 11.8, 0], [-1.4, 15.5, -Math.PI / 2], [-11, 22.4, Math.PI]].forEach(([h, d, r]) => { const [x, z] = Q(h, d); bench(scene, x, z, YAW + r); });
  { const g = at(scene, -9.5, 17); cylY(g, 1.2, 0.5, SM.stone, 0, 0.25, 0, 20); cylY(g, 1.0, 0.06, SM.water, 0, 0.48, 0, 20); }
  /* -- la place : platanes, fontaine, boutiques, maisons -- */
  { const g = at(scene, 34, 21); cylY(g, 2.4, 0.6, SM.stone, 0, 0.3, 0, 28); cylY(g, 2.1, 0.08, SM.water, 0, 0.56, 0, 28); cylY(g, 0.3, 1.6, SM.stone, 0, 1.2, 0, 12); cylY(g, 0.8, 0.15, SM.stone, 0, 1.9, 0, 16); }
  [[12, 4.6], [20, 4.6], [28, 4.6], [36, 4.6], [42, 14.8], [26, 26.5], [16, 26.5], [40, 27]].forEach(([h, d]) => { const [x, z] = Q(h, d); roundTree(scene, x, z, 1.05, [0x6aa84c, 0x5a9a44, 0x7ab854]); });
  [[24, 15.6, Math.PI], [30, 15.6, Math.PI], [16, 5.0, 0]].forEach(([h, d, r]) => { const [x, z] = Q(h, d); bench(scene, x, z, YAW + r); });
  maison(scene, 13, 33, YAW + Math.PI, { w: 6, h: 5.4, shop: true, sign: 'BOULANGERIE', shopCol: SM.red, awning: SM.awnR, wall: WALLS[0] });
  maison(scene, 19.5, 33, YAW + Math.PI, { w: 6, h: 7.6, balcony: true });
  maison(scene, 26, 33, YAW + Math.PI, { w: 6, h: 5.4, shop: true, sign: 'PHARMACIE', shopCol: SM.green, awning: SM.awnG, wall: WALLS[2] });
  maison(scene, 32, 32, YAW + Math.PI, { w: 5, h: 5.4 });
  [[45, 4], [45, 10], [44, 18]].forEach(([h, d], i) => maison(scene, h, d, YAW - Math.PI / 2, { w: 5, d: 4.5, h: i === 1 ? 7.6 : 5.4, balcony: i === 1 }));
  [[-2, 37], [-14, 38.5]].forEach(([h, d]) => maison(scene, h, d, YAW + Math.PI, { w: 6, h: 5.4 }));
  { const g = at(scene, 22, 22); [[-1.2, SM.awnB], [1.6, SM.awnR]].forEach(([x, aw]) => { const s = grp(g, x * 2, 0, 0); [[-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6]].forEach(([a, b]) => cylY(s, 0.04, 2.2, SM.dark, a, 1.1, b, 6)); rbox(s, 2.3, 0.08, 1.5, 0.03, aw, 0, 2.25, 0, 0.01); rbox(s, 2.0, 0.8, 1.2, 0.04, SM.woodL, 0, 0.4, 0, 0.02); [[-0.6, SM.red], [0, SM.orange], [0.6, SM.yel]].forEach(([xx, mm]) => sph(s, 0.25, mm, xx, 0.85, 0).scale.y = 0.125); }); }
  /* -- derrière : les arbres de la berge -- */
  [[-44, -27], [-24, -27.5], [38, -27.4], [44, -24], [10, -27.8], [-2, -27.8]].forEach(([h, d], i) => { const [x, z] = Q(h, d); roundTree(scene, x, z, 0.95, i % 2 ? [0x5aa85a, 0x4a9a4a] : [0x6a9a3a, 0x5a8a3a]); });
  return scene;
}
function lampPost(g, x, z) { cylY(g, 0.06, 2.6, SM.dark, x, 1.3, z, 8); sph(g, 0.18, SM.warm, x, 2.75, z); cylY(g, 0.2, 0.08, SM.dark, x, 2.95, z, 8); }

/* ================= life ================= */
function buildLife(scene, onUpdate, blockers, LIGHTS) {
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const cols = [0xe5452c, 0x2f7de0, 0xf2f2f6, 0xf2b21c, 0x3aa46a, 0x1b1d24, 0x8fd0ff, 0xa45ad8];
  const mainRoad = R([[-50, -4.5], [50, -4.5], [52.5, -6], [50, -7.5], [-50, -7.5], [-52.5, -6]], 0.1);
  const crossRoad = R([[2.5, -50], [2.5, 44], [4, 46.5], [5.5, 44], [5.5, -50], [4, -52.5]], 0.1);
  const carsA = ['car', 'van', 'kei', 'car', 'truck', 'car'].map((k, i) => miniCar(scene, k, cols[i]));
  const carsB = ['car', 'kei', 'van', 'car'].map((k, i) => miniCar(scene, k, cols[(i + 3) % cols.length]));
  const bus = miniCar(scene, 'van', 0x2f9a5a); bus.scale.set(1.7, 1.25, 1.15); carsA.push(bus);
  const walkers = [];
  const W = (pts, n, opts = {}) => { const r = R(pts, 0.05); const ps = Array.from({ length: n }, (_, i) => walker(scene, 0, 0, { kid: i % 4 === 2, ...opts })); walkers.push(...ps); return traffic(r, ps, 1.0, { gap: 1.1 }); };
  const tw1 = W([[-44, -1.25], [44, -1.25], [44, -2.0], [-44, -2.0]], 6);
  const tw2 = W([[-44, -11.7], [44, -11.7], [44, -12.3], [-44, -12.3]], 5);
  const tw3 = W([[-38, -28.2], [38, -28.2], [38, -29.4], [-38, -29.4]], 6);
  const tw4 = W([[-14, 13], [-6, 12.5], [-2.5, 17], [-6, 21.5], [-14, 21], [-16, 17]], 4);
  const tw5 = W([[10, 18], [38, 18], [38, 24], [10, 24]], 4);
  const all = [...carsA, ...carsB, ...walkers];
  const tA = traffic(mainRoad, carsA, 3.4, { gap: 3.6 }), tB = traffic(crossRoad, carsB, 3.2, { gap: 3.6 });
  // traffic lights: stop points in front of each approach
  const P = (h, d) => { const [x, z] = Q(h, d); return new V3(x, 0, z); };
  const stopMain = [P(0.3, -4.5), P(7.7, -7.5)], stopCross = [P(2.5, -10.7), P(5.5, -1.3)];
  let ph = 0, pt = 0; const DUR = [9, 2, 7, 2];
  const setL = (M, r, a, g) => { M.r.emissiveIntensity = r ? 1.8 : 0; M.a.emissiveIntensity = a ? 1.8 : 0; M.g.emissiveIntensity = g ? 1.8 : 0; };
  // ducks on the river
  const ducks = [duck(scene, 1.3, SM.white), duck(scene, 0.8), duck(scene, 0.8), duck(scene, 0.8)];
  const pond = R([[10, -35], [22, -40], [34, -36], [28, -42], [14, -42]], 0.3);
  let ds = 0, T = 0;
  onUpdate((dt) => {
    T += dt;
    let mainStop = false, crossStop = false;
    if (LIGHTS.mode === 'auto') {
      pt += dt; if (pt > DUR[ph]) { pt = 0; ph = (ph + 1) % 4; }
      mainStop = ph !== 0; crossStop = ph !== 2;
      setL(TLM.main, ph >= 2, ph === 1, ph === 0); setL(TLM.cross, ph < 2, ph === 3, ph === 2);
    } else {
      const on = Math.sin(T * 6) > 0; setL(TLM.main, false, on, false); setL(TLM.cross, false, on, false);
      if (LIGHTS.mode === 'manual') { mainStop = LIGHTS.manual === 'main'; crossStop = LIGHTS.manual === 'cross'; }
      ph = 0; pt = 0;
    }
    const extra = []; if (mainStop) extra.push(...stopMain); if (crossStop) extra.push(...stopCross);
    blockers.forEach((f) => { const p = f(); if (p) extra.push(p); });
    const others = all.concat(extra);
    tA.update(dt, others); tB.update(dt, others); [tw1, tw2, tw3, tw4, tw5].forEach((t) => t.update(dt, others));
    ds += dt * 0.8; ducks.forEach((d, i) => { placeOn(d, pond, ds - i * 0.9); d.position.y = Math.sin(T * 2 + i) * 0.02; });
    FLAGS.forEach((f, i) => (f.rotation.y = Math.sin(T * 1.6 + i) * 0.25));
  });
}
