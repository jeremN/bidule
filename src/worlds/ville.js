// La Ville — transports in a Japanese-inspired town: car, bus, tram, metro, shinkansen, cable car.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { C, MT, UB, ICO, dummy, tmpCol, mat, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, arc, anchor, beam, wp, shadows, instanced } from '../kit/geo.js';
import { tire, operator, beacon } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';

const S2 = Math.SQRT1_2;
const P = (u, v) => [(u + v) * S2, (u - v) * S2];
const YAW = Math.PI / 4;
const VM = {
  white: std(0xf4f5f8, 0.35, 0.1), cream: std(0xf1e6d2, 0.7, 0), wood: std(0x8a5a3a, 0.8, 0), woodD: std(0x5a3a2a, 0.8, 0),
  slate: std(0x3a4258, 0.6, 0.2), roofRed: std(0xb8322a, 0.6, 0.1), concrete: std(0xb7b9c3, 0.9, 0), steel: MT.steel,
  blue: std(0x1f4fb8, 0.35, 0.2), orange: std(0xf2a81e, 0.4, 0.2), green: std(0x2f9a5a, 0.38, 0.2), teal: std(0x2fb3b0, 0.35, 0.2),
  silver: std(0xd4d8e0, 0.25, 0.7), tram: std(0xf26a2a, 0.38, 0.2), cab: std(0xd8402a, 0.4, 0.2), grey: std(0x8f96a6, 0.5, 0.4),
  lantern: std(0xe8402a, 0.5, 0, { emissive: 0x9a1a10, emissiveIntensity: 0.9 }), paper: std(0xfff1d0, 0.6, 0, { emissive: 0xffc070, emissiveIntensity: 0.6 }),
  noren: std(0x23409a, 0.8, 0), sakura: std(0xf4b2cc, 0.8, 0), skin: MT.skin
};
const lampMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15 });

function windowsTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#c9ccd8'; x.fillRect(0, 0, 64, 128);
  for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) { x.fillStyle = Math.random() < 0.45 ? '#ffd27a' : pick(['#3a5a8a', '#2a3f66', '#4a6a9a']); x.fillRect(k * 16 + 3, r * 16 + 4, 10, 9); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const WIN = [windowsTex(), windowsTex(), windowsTex()];

/* ---------- scenery builders (local +z = street side) ---------- */
function house(p, x, z, ry, o = {}) {
  const g = grp(p, x, 0, z); g.rotation.y = ry; const w = o.w || 3, d = o.d || 2.6, h = o.h || 2.2;
  rbox(g, w, h, d, 0.05, o.wall || VM.cream, 0, h / 2, 0, 0.02);
  for (let i = -1; i <= 1; i++) box(g, 0.08, h, 0.04, VM.woodD, (i * w) / 3, h / 2, d / 2 + 0.02);
  box(g, w * 0.5, 0.9, 0.04, VM.woodD, 0, 1.0, d / 2 + 0.03);
  for (let i = 0; i < 6; i++) box(g, 0.03, 0.85, 0.05, VM.wood, -w * 0.22 + (i * w * 0.44) / 5, 1.0, d / 2 + 0.05);
  ext(g, [[-d / 2 - 0.35, 0], [d / 2 + 0.35, 0], [d / 2 + 0.2, 0.1], [0.08, 0.85], [-0.08, 0.85], [-d / 2 - 0.2, 0.1]], 0.05, w + 0.5, o.roof || VM.slate, 0, h, 0, 0.03).rotation.y = Math.PI / 2;
  if (o.shop) {
    for (let i = 0; i < 4; i++) box(g, w * 0.13, 0.55, 0.03, VM.noren, -w * 0.3 + i * w * 0.2, h - 0.45, d / 2 + 0.12);
    [-w / 2 + 0.3, w / 2 - 0.3].forEach((xx) => { const l = sph(g, 0.22, VM.lantern, xx, h - 0.5, d / 2 + 0.35); l.scale.y = 0.3; });
    rbox(g, 0.4, 1.4, 0.08, 0.03, VM.white, w / 2 + 0.25, h + 0.1, d / 2 - 0.2, 0.01);
  }
  shadows(g); return g;
}
function tower(p, x, z, ry, w, d, h) {
  const g = grp(p, x, 0, z); g.rotation.y = ry;
  const m = new THREE.MeshStandardMaterial({ map: WIN[Math.floor(Math.random() * 3)].clone(), roughness: 0.6, emissive: 0x1a1408, emissiveMap: null });
  m.map.needsUpdate = true; m.map.repeat.set(w / 1.6, h / 2.4);
  box(g, w, h, d, m, 0, h / 2, 0); box(g, w + 0.15, 0.2, d + 0.15, VM.slate, 0, h, 0);
  rbox(g, w * 0.3, 0.6, w * 0.3, 0.05, VM.grey, w * 0.2, h + 0.4, 0, 0.02);
  if (Math.random() < 0.6) rbox(g, 0.5, h * 0.4, 0.12, 0.03, pick([VM.cab, VM.orange, VM.white]), w / 2 + 0.2, h * 0.65, d / 2 - 0.3, 0.01);
  shadows(g); return g;
}
function sakuraTree(p, x, z, s = 1) {
  const g = grp(p, x, 0, z); g.scale.setScalar(s); cylY(g, 0.18, 2.2, VM.woodD, 0, 1.1, 0, 8);
  rod(g, new V3(0, 1.6, 0), new V3(0.7, 2.4, 0.2), 0.08, VM.woodD); rod(g, new V3(0, 1.8, 0), new V3(-0.6, 2.5, -0.3), 0.08, VM.woodD);
  for (let i = 0; i < 6; i++) { const m = add(g, ICO, pick([0xf4b2cc, 0xf7c6d8, 0xe99ab8, 0xfbd8e4]), rnd(-1, 1), rnd(2.3, 3.3), rnd(-1, 1)); m.scale.setScalar(rnd(0.7, 1.1)); m.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  shadows(g); return g;
}
function pine(p, x, z, s = 1) {
  const g = grp(p, x, 0, z); g.scale.setScalar(s); cylY(g, 0.15, 1.6, VM.woodD, 0, 0.8, 0, 8);
  [[1.6, 1.3, 1.1], [2.3, 1.0, 0.9], [2.9, 0.7, 0.7]].forEach(([y, r, h]) => { const c = add(g, new THREE.ConeGeometry(r, h, 7), 0x2f6a4a, rnd(-0.1, 0.1), y, 0); c.scale.y = 0.6; });
  shadows(g); return g;
}
function torii(p, x, z, ry, s = 1) {
  const g = grp(p, x, 0, z); g.rotation.y = ry; g.scale.setScalar(s);
  [-1.3, 1.3].forEach((xx) => { cylY(g, 0.16, 3.4, VM.cab, xx, 1.7, 0, 12); cylY(g, 0.2, 0.3, VM.woodD, xx, 0.15, 0, 12); });
  rbox(g, 3.4, 0.22, 0.3, 0.03, VM.cab, 0, 2.7, 0, 0.02);
  ext(g, [[-2.2, 0], [2.2, 0], [2.5, 0.28], [-2.5, 0.28]], 0.05, 0.4, VM.woodD, 0, 3.35, 0, 0.02);
  rbox(g, 4.2, 0.18, 0.36, 0.03, VM.cab, 0, 3.25, 0, 0.02);
  shadows(g); return g;
}
function pagoda(p, x, z, s = 1) {
  const g = grp(p, x, 0, z); g.scale.setScalar(s);
  for (let i = 0; i < 4; i++) {
    const y = i * 1.5, w = 2.6 - i * 0.35;
    rbox(g, w, 1.1, w, 0.05, VM.cab, 0, y + 0.55, 0, 0.02);
    const roof = add(g, new THREE.ConeGeometry((w + 1.4) * 0.72, 0.6, 4), VM.slate, 0, y + 1.35, 0); roof.rotation.y = Math.PI / 4;
  }
  cylY(g, 0.05, 1.6, VM.orange, 0, 6.8, 0, 6); for (let k = 0; k < 5; k++) cylY(g, 0.14, 0.04, VM.orange, 0, 6.2 + k * 0.25, 0, 10);
  shadows(g); return g;
}
function person(p, x, z, ry, o = {}) {
  const g = grp(p, x, 0, z); g.rotation.y = ry || 0; const s = o.kid ? 0.75 : 1; g.scale.setScalar(s);
  [0.08, -0.08].forEach((zz) => rbox(g, 0.12, 0.55, 0.12, 0.05, o.legs || MT.pants, 0, 0.3, zz));
  rbox(g, 0.24, 0.48, 0.38, 0.1, o.shirt || pick([VM.white, VM.blue, VM.green, VM.orange]), 0, 0.82, 0);
  sph(g, 0.12, VM.skin, 0, 1.2, 0);
  if (o.hat) { add(g, new THREE.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.hat, 0, 1.24, 0); cylY(g, 0.17, 0.02, o.hat, 0, 1.24, 0, 14); }
  else sph(g, 0.125, VM.woodD, -0.02, 1.25, 0).scale.y = 0.7;
  if (o.bag) rbox(g, 0.18, 0.32, 0.3, 0.05, o.bag, -0.2, 0.86, 0);
  shadows(g); return g;
}
function lanternPost(p, x, z) { const g = grp(p, x, 0, z); cylY(g, 0.05, 2.4, VM.woodD, 0, 1.2, 0, 6); rbox(g, 0.32, 0.42, 0.32, 0.05, VM.paper, 0, 2.55, 0, 0.02); rbox(g, 0.42, 0.06, 0.42, 0.02, VM.woodD, 0, 2.8, 0, 0.01); shadows(g); return g; }
function vending(p, x, z, ry) { const g = grp(p, x, 0, z); g.rotation.y = ry; rbox(g, 0.7, 1.7, 0.6, 0.05, pick([VM.cab, VM.white, VM.blue]), 0, 0.85, 0, 0.02); box(g, 0.55, 0.7, 0.02, VM.paper, 0, 1.2, 0.31); shadows(g); return g; }

/* ---------- vehicles ---------- */
function railTrack(p, x0, x1, z, o = {}) {
  const gauge = o.gauge || 0.75, y = o.y || 0;
  [gauge, -gauge].forEach((zz) => box(p, x1 - x0, 0.08, 0.08, MT.steel, (x0 + x1) / 2, y + 0.1, z + zz));
  if (o.sleepers !== false) instanced(p, UB, Math.floor((x1 - x0) / 0.6), (i, d) => { d.position.set(x0 + 0.3 + i * 0.6, y + 0.04, z); d.scale.set(0.22, 0.08, gauge * 2 + 0.6); d.rotation.set(0, 0, 0); return 0x5a4636; });
}
/** Railcar along x. ends: 'flat' | 'nose' (pointy front at +x) | 'tail' (pointy at -x) | 'round'. */
function railcar(p, x, L, o) {
  const g = grp(p, x, o.y || 0, 0), W = o.w || 1.5, H = o.h || 2.0, b = o.base || 0.45, half = L / 2;
  let pts;
  if (o.ends === 'nose') pts = [[-half, b], [half - 0.3, b], [half, b + 0.3], [half - 0.6, b + 0.75], [half - 1.9, H - 0.3], [half - 3.4, H], [-half, H]];
  else if (o.ends === 'tail') pts = [[-half + 0.3, b], [half, b], [half, H], [-half + 3.4, H], [-half + 1.9, H - 0.3], [-half + 0.6, b + 0.75], [-half, b + 0.3]];
  else pts = [[-half, b], [half, b], [half, H], [-half, H]];
  ext(g, pts, o.ends === 'flat' ? 0.25 : o.ends === 'round' ? 0.5 : 0.3, W, o.body, 0, 0, 0, 0.06);
  const winY = b + (H - b) * 0.62, inset = o.ends === 'nose' || o.ends === 'tail' ? 3.4 : 0.4;
  [1, -1].forEach((s) => {
    rbox(g, L - inset - 0.6, (H - b) * 0.28, 0.04, 0.08, MT.glassD, o.ends === 'nose' ? -inset / 2 + 0.1 : o.ends === 'tail' ? inset / 2 - 0.1 : 0, winY, s * (W / 2 + 0.005), 0.01);
    if (o.stripe) rbox(g, L - 0.4, 0.14, 0.03, 0.03, o.stripe, 0, b + (H - b) * 0.3, s * (W / 2 + 0.01), 0.01);
  });
  if (o.ends === 'nose') { const ws = rbox(g, 1.2, 0.35, W * 0.7, 0.12, MT.glassD, half - 2.2, H - 0.42, 0, 0.02); ws.rotation.z = -0.38; [0.35, -0.35].forEach((zz) => rbox(g, 0.1, 0.12, 0.25, 0.04, MT.lamp, half - 0.25, b + 0.35, zz, 0.01)); }
  if (o.ends === 'flat' || o.ends === 'round') { if (o.front) { rbox(g, 0.05, (H - b) * 0.38, W * 0.8, 0.08, MT.glassD, half + 0.01, winY, 0, 0.01); [0.45, -0.45].forEach((zz) => rbox(g, 0.05, 0.12, 0.22, 0.03, MT.lamp, half + 0.02, b + 0.3, zz * W / 1.5, 0.01)); } }
  const doors = (o.doors || []).map((dx) => [1, -1].map((s) => { const d = grp(g, dx, 0, s * (W / 2 + 0.025)); rbox(d, o.doorW || 0.9, (H - b) * 0.82, 0.03, 0.04, o.doorM || VM.grey, 0, b + (H - b) * 0.45, 0, 0.01); rbox(d, (o.doorW || 0.9) * 0.6, (H - b) * 0.32, 0.035, 0.04, MT.glassD, 0, b + (H - b) * 0.6, 0, 0.01); return d; })).flat();
  if (o.bogies !== false) [-(half - 1.3), half - 1.3].forEach((bx) => { rbox(g, 1.6, 0.25, W * 0.8, 0.05, MT.dark, bx, 0.3, 0, 0.02); [-0.45, 0.45].forEach((wx) => [1, -1].forEach((s) => cylZ(g, 0.2, 0.08, MT.black, bx + wx, 0.22, s * 0.68, 12))); });
  return { g, doors };
}

const DATA = {
  voiture: { short: 'La voiture', full: 'La voiture', verb: 'Rouler', horn: 'horn',
    use: 'Elle emmène la famille partout.',
    how: 'Le moteur fait tourner les roues. Au feu rouge, elle s’arrête pour laisser passer les piétons.' },
  car: { short: 'Le car', full: 'Le car', verb: 'Partir', horn: 'horn',
    use: 'Il transporte beaucoup de passagers d’une ville à l’autre.',
    how: 'Il s’arrête aux arrêts. Ses portes s’ouvrent toutes seules pour laisser monter les gens.' },
  tram: { short: 'Le tramway', full: 'Le tramway', verb: 'Démarrer', horn: 'bell',
    use: 'Il roule sur des rails au milieu des rues.',
    how: 'Son pantographe touche le fil au-dessus : l’électricité fait tourner ses moteurs.' },
  metro: { short: 'Le métro', full: 'Le métro', verb: 'Démarrer', horn: 'bell',
    use: 'Il roule sous la terre, dans des tunnels.',
    how: 'Il s’arrête pile devant les portes du quai, et toutes les portes s’ouvrent ensemble.' },
  shinkansen: { short: 'Le Shinkansen', full: 'Le Shinkansen', verb: 'Foncer', horn: 'bell',
    use: 'C’est un train à grande vitesse, au Japon.',
    how: 'Son long nez pointu l’aide à fendre l’air. Il roule sur un pont très haut pour aller tout droit.' },
  telepherique: { short: 'Le téléphérique', full: 'Le téléphérique', verb: 'Monter', horn: 'bell',
    use: 'Il monte en haut de la colline, accroché à un câble.',
    how: 'Une grande roue dans la gare tourne et tire le câble. La cabine glisse le long du câble.' }
};
const ORDER = ['voiture', 'car', 'tram', 'metro', 'shinkansen', 'telepherique'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  voiture: GND + `<path class="b" d="M14 60V46l10-4 10-14h40l14 14h14l4 6v12z" style="fill:#2fb3b0"/><path class="g" d="M38 30h16v12H30zM58 30h14l10 12H58z"/>
    <circle class="k" cx="34" cy="62" r="10"/><circle class="s" cx="34" cy="62" r="4"/><circle class="k" cx="88" cy="62" r="10"/><circle class="s" cx="88" cy="62" r="4"/><rect class="r" x="100" y="20" width="10" height="26" rx="3"/><circle cx="105" cy="26" r="3" fill="#ff4a3a"/><circle cx="105" cy="38" r="3" fill="#4ad06a"/>`,
  car: GND + `<rect x="6" y="20" width="106" height="44" rx="6" fill="#2f9a5a"/><rect class="w" x="6" y="46" width="106" height="8"/><rect class="g" x="12" y="26" width="84" height="14" rx="2"/><rect class="g" x="100" y="24" width="10" height="20" rx="2"/>
    <rect class="k" x="62" y="26" width="10" height="30"/><circle class="k" cx="28" cy="64" r="9"/><circle class="s" cx="28" cy="64" r="3.5"/><circle class="k" cx="92" cy="64" r="9"/><circle class="s" cx="92" cy="64" r="3.5"/>`,
  tram: GND + `<path class="ln" d="M2 10H118"/><path class="ln" d="M52 10L62 18 52 26"/><rect x="8" y="26" width="104" height="38" rx="10" fill="#f26a2a"/><rect class="w" x="8" y="50" width="104" height="6"/>
    <rect class="g" x="14" y="32" width="26" height="14" rx="2"/><rect class="g" x="46" y="32" width="26" height="14" rx="2"/><rect class="g" x="80" y="32" width="26" height="14" rx="2"/><path class="ln" d="M4 68H116"/>`,
  metro: GND + `<path d="M4 72V30a24 24 0 0 1 48 0v42" fill="#3a4258"/><path d="M12 72V32a16 16 0 0 1 32 0v40" fill="#11141c"/>
    <rect x="30" y="34" width="86" height="34" rx="5" fill="#d4d8e0"/><rect x="30" y="54" width="86" height="5" fill="#f2a81e"/><rect class="g" x="36" y="38" width="20" height="11" rx="2"/><rect class="g" x="62" y="38" width="20" height="11" rx="2"/><rect class="g" x="88" y="38" width="20" height="11" rx="2"/>`,
  shinkansen: GND + `<rect class="c" x="20" y="60" width="8" height="14"/><rect class="c" x="80" y="60" width="8" height="14"/><rect class="c" x="4" y="56" width="112" height="5"/>
    <path class="w" d="M4 54V36h60q30 0 50 18z"/><rect x="4" y="48" width="104" height="4" fill="#1f4fb8"/><path class="g" d="M70 38q14 2 22 10H70z"/><rect class="g" x="10" y="40" width="54" height="5" rx="2"/>`,
  telepherique: GND + `<path d="M70 75L96 30l20 45z" fill="#2f6a4a"/><path class="ln" d="M6 30L114 10"/><rect class="k" x="56" y="20" width="3" height="10"/>
    <rect x="44" y="28" width="28" height="22" rx="5" fill="#d8402a"/><rect class="g" x="48" y="32" width="9" height="9" rx="1"/><rect class="g" x="60" y="32" width="9" height="9" rx="1"/><rect class="c" x="4" y="30" width="18" height="44"/>`
};
const U = { telepherique: -28, shinkansen: -22, metro: -13, tram: -5, voiture: 4, car: 13 };
const CFG = {};
Object.entries(U).forEach(([id, u]) => { const [x, z] = P(u, id === 'telepherique' ? -14 : 0); CFG[id] = { x, z, yaw: YAW }; });

export default {
  id: 'ville', title: 'La Ville', titleHtml: 'La <span>Ville</span>',
  subtitle: 'Une ville japonaise pleine de transports : voiture, car, tramway, métro, train à grande vitesse et téléphérique.',
  welcome: 'Bienvenue en ville ! Touche un transport pour voir comment il marche.',
  hint: 'Touche un transport pour le découvrir.', backLabel: 'Toute la ville',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="22" height="16" rx="4"/><path d="M5 16h22M10 27l2-4M22 27l-2-4M11 3h10"/><circle cx="10" cy="19.5" r="1"/><circle cx="22" cy="19.5" r="1"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 38, outerColor: 0x1d3f7a,
  forest: { dark: [0x1f4a3a, 0x2a5a44, 0x173a30], bush: [0xf4b2cc, 0xe99ab8, 0xf7c6d8, 0x2f8a5a] },
  tuftColors: [0x3f9a6a, 0x2f7f5a, 0x5ab07a, 0x4c78ff],
  overview: { w: 66, h: 46, focus: [0, 3, 0] },
  zones: [[...P(-28, 10), 9.5], [...P(20, 0), 3]],
  segs: [[...P(-28, -18), ...P(-28, 10), 3], [...P(-22, -40), ...P(-22, 40), 3], [...P(-13, -28), ...P(-13, 30), 3.5], [...P(-5, -18), ...P(-5, 18), 3.5],
    [...P(4, -18), ...P(4, 18), 4], [...P(13, -18), ...P(13, 18), 4.5], [...P(-17, -18), ...P(-17, 18), 2.6], [...P(-9, -18), ...P(-9, 18), 2], [...P(0, -18), ...P(0, 18), 2.2], [...P(8.5, -18), ...P(8.5, 18), 2.4]],
  ground: {
    base: ['#8a92c8', '#6a73ad', '#4c5488'],
    rects: [
      { cx: P(4, 0)[0], cz: P(4, 0)[1], len: 40, wid: 7, rot: -Math.PI / 4, col: '#b9b6c8', al: 0.7 },
      { cx: P(13, 0)[0], cz: P(13, 0)[1], len: 40, wid: 7, rot: -Math.PI / 4, col: '#b9b6c8', al: 0.7 },
      { cx: P(-5, 0)[0], cz: P(-5, 0)[1], len: 40, wid: 6, rot: -Math.PI / 4, col: '#c9c4d4', al: 0.6 }
    ],
    blobs: [[...P(20, 0), 9, 'rgba(120,200,140,.45)'], [...P(-28, 10), 10, 'rgba(90,170,110,.55)']]
  },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 120);
    onUpdate((dt) => fx.update(dt));
    const at = (u, v) => P(u, v);

    /* ---------- the town ---------- */
    // Mount Fuji far behind the island
    { const f = grp(scene, -62, 0, -62); add(f, new THREE.ConeGeometry(34, 26, 28), std(0x5a6aa8, 0.9, 0), 0, 13, 0); const cap = add(f, new THREE.ConeGeometry(11.5, 8.8, 28), std(0xf4f6fb, 0.6, 0), 0, 21.6, 0); }
    // houses, shops and towers between the lines
    const rows = [[8.4, true]];
    rows.forEach(([u, shops]) => {
      for (let v = -17; v <= 17; v += 3.6) {
        if (Math.abs(v) < 3.2 && u > 0) continue;
        const [x, z] = at(u, v), r = Math.random();
        house(scene, x, z, YAW, { shop: shops && r < 0.5, roof: r < 0.25 ? VM.roofRed : VM.slate, w: 3.0, d: 2.2, h: rnd(1.5, 1.9) });
      }
    });
    [[18, -24, 3, 7], [22, -21, 2.6, 5], [14, 24, 3, 8], [19, 22, 2.4, 6], [6, 25, 2.6, 9], [-6, 26, 2.8, 7], [8, -25, 2.6, 6], [-4, -27, 3, 8]].forEach(([u, v, w, h]) => { const [x, z] = at(u, v); tower(scene, x, z, YAW, w, w, h); });
    for (let v = -17; v <= 17; v += 4.2) { const [x, z] = at(-1.15, v); const k = Math.round((v + 17) / 4.2) % 3; if (k === 0) sakuraTree(scene, x, z, 0.75); else if (k === 1) lanternPost(scene, x, z); else vending(scene, x, z, YAW); }
    [[-9, -16], [-9, -8], [-9, 8], [-9, 16]].forEach(([u, v]) => { const [x, z] = at(u, v); sakuraTree(scene, x, z, 0.8); });
    [[-9, -12], [-9, 12], [-9, 0]].forEach(([u, v]) => { const [x, z] = at(u, v); lanternPost(scene, x, z); });
    // front park with a torii and cherry trees
    { const [x, z] = at(20, 0); torii(scene, x, z, YAW - Math.PI / 2, 1.1); }
    [[19, -6], [22, -10], [24, 4], [19, 7], [25, -3], [21, 12], [17, -14], [26, 9]].forEach(([u, v], i) => { const [x, z] = at(u, v); sakuraTree(scene, x, z, rnd(0.9, 1.2)); });
    [[18, -2.5], [18, 2.5]].forEach(([u, v]) => { const [x, z] = at(u, v); lanternPost(scene, x, z); });
    [[22, -16], [24, 15], [16, 18], [16, -19]].forEach(([u, v]) => { const [x, z] = at(u, v); house(scene, x, z, YAW + Math.PI, { roof: VM.roofRed }); });
    [[10.5, -4], [10.5, 5]].forEach(([u, v]) => { const [x, z] = at(u, v); vending(scene, x, z, YAW); });
    [[20, -4, true], [21, 3, false], [23, 0, true]].forEach(([u, v, kid]) => { const [x, z] = at(u, v); person(scene, x, z, rnd(0, 6), { kid, hat: kid ? MT.hat : null, bag: kid ? VM.cab : null }); });

    /* ---- voiture + feux ---- */
    (function () {
      const st = makeStation('voiture'), S = st.g, START = -12, STOP = -4.2, END = 14;
      rbox(S, 40, 0.06, 4.2, 0.02, 0x30333d, 0, 0.03, 0, 0.01); [2.6, -2.6].forEach((z) => rbox(S, 40, 0.18, 1.0, 0.02, 0xc9c6d6, 0, 0.09, z, 0.01));
      for (let x = -19; x < 19; x += 2) if (Math.abs(x) > 2) box(S, 1.0, 0.02, 0.12, 0xf3efe2, x, 0.07, 0);
      for (let z = -1.8; z <= 1.8; z += 0.6) box(S, 1.6, 0.02, 0.36, 0xf3efe2, 0, 0.07, z);
      box(S, 0.12, 0.02, 4.2, 0xf3efe2, -1.5, 0.07, 0);
      const lights = [];
      [[-1.9, 2.4, 0], [1.9, -2.4, Math.PI]].forEach(([x, z, ry]) => {
        const g = grp(S, x, 0, z); g.rotation.y = ry; cylY(g, 0.07, 3.2, MT.dark, 0, 1.6, 0, 8); rod(g, new V3(0, 3.1, 0), new V3(0, 3.1, -1.3), 0.05, MT.dark);
        const hz = grp(g, 0, 3.0, -1.3); rbox(hz, 0.3, 0.3, 1.0, 0.05, MT.dark, 0, 0, 0, 0.02);
        const L = [0xff3a2a, 0xffb02a, 0x3ad06a].map((c, i) => { const m = lampMat(c); const d = cylX(hz, 0.11, 0.04, m, 0.16, 0, 0.3 - i * 0.3, 14); return m; });
        lights.push(L);
      });
      const setLight = (k) => lights.forEach((L) => L.forEach((m, i) => (m.emissiveIntensity = i === k ? 1.6 : 0.12)));
      setLight(0);
      const m = grp(S, START, 0, -1.05); st.m = m; st.lastX = START;
      ext(m, [[-1.55, 0.32], [1.55, 0.32], [1.62, 0.72], [1.05, 0.92], [0.55, 1.5], [-1.35, 1.52], [-1.6, 1.15]], [0.06, 0.12, 0.2, 0.15, 0.2, 0.2, 0.15], 1.45, VM.teal, 0, 0, 0, 0.05);
      [1, -1].forEach((s) => { rbox(m, 0.75, 0.42, 0.03, 0.06, MT.glassD, 0.05, 1.18, s * 0.73, 0.01); rbox(m, 0.7, 0.4, 0.03, 0.06, MT.glassD, -0.85, 1.19, s * 0.73, 0.01); box(m, 0.02, 0.6, 0.02, MT.black, -0.35, 0.75, s * 0.735); rbox(m, 0.1, 0.03, 0.02, 0.01, MT.chrome, 0.15, 0.82, s * 0.74, 0.005); });
      const ws = rbox(m, 0.03, 0.5, 1.2, 0.06, MT.glassD, 0.82, 1.2, 0, 0.01); ws.rotation.z = -0.95;
      [0.48, -0.48].forEach((z) => { rbox(m, 0.05, 0.14, 0.26, 0.04, MT.lamp, 1.62, 0.66, z, 0.01); rbox(m, 0.05, 0.12, 0.2, 0.03, MT.tail, -1.6, 0.8, z, 0.01); });
      const blink = MT.amber.clone(); [0.62].forEach((z) => { rbox(m, 0.05, 0.08, 0.12, 0.02, blink, 1.62, 0.66, z, 0.01); rbox(m, 0.05, 0.08, 0.12, 0.02, blink, -1.6, 0.66, z, 0.01); });
      rbox(m, 0.2, 0.18, 1.5, 0.05, MT.dark, 1.6, 0.4, 0, 0.02); rbox(m, 0.2, 0.18, 1.5, 0.05, MT.dark, -1.58, 0.4, 0, 0.02);
      operator(m, -0.3, 0.45, 0.3).scale.setScalar(0.85);
      st.wheels = [[1.0, 1], [1.0, -1], [-1.0, 1], [-1.0, -1]].map(([x, s]) => tire(m, 0.32, 0.22, x, 0.32, s * 0.7, MT.grey, s));
      const walkers = [person(S, 0.3, 3.4, Math.PI / 2, { kid: true, hat: MT.hat, bag: VM.cab }), person(S, -0.4, 3.9, Math.PI / 2, {})];
      part(st, 'feu', 'le feu', anchor(S, 1.9, 3.6, -1.1), true);
      part(st, 'roues', 'les roues', anchor(m, 1.0, 0.75, 0.75), true);
      part(st, 'pietons', 'les piétons', anchor(S, 0, 1.8, 0), false);
      part(st, 'clignotant', 'le clignotant', anchor(m, 1.65, 0.95, 0.62), false);
      st.focus = new V3(-2, 1, 0); st.size = { w: 15, h: 7 }; st.tagAt = anchor(m, 0, 2.6, 0);
      let T = 0; st.update = (dt) => { T += dt; roll(st, dt); blink.emissiveIntensity = st.blinking && Math.sin(T * 10) > 0 ? 1.6 : 0.1; };
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; walkers.forEach((w, i) => w.position.set(i ? -0.4 : 0.3, 0, i ? 3.9 : 3.4)); pop(m, 0.5); setLight(0); st.done = false; }
        engineOn(70);
        await Promise.all([step('Le feu est rouge : la voiture s’arrête.', 'feu'), to(m.position, 'x', STOP, 2.8, (k) => 1 - Math.pow(1 - k, 2))]);
        await Promise.all([step('Les piétons traversent sur le passage.', 'pietons'), ...walkers.map((w, i) => tw(3.4, (k) => { w.position.z = (i ? 3.9 : 3.4) - k * 7.2; w.position.y = Math.abs(Math.sin(k * 30)) * 0.04; }, lin))]);
        setLight(1); await sleep(0.8); setLight(2); ding();
        st.blinking = true;
        await Promise.all([step('Le feu passe au vert. Clignotant... et on y va !', 'clignotant'), sleep(1.4)]);
        await Promise.all([step('Le moteur fait tourner les roues.', 'roues'), to(m.position, 'x', END, 3.6, easeIn)]);
        st.blinking = false; setLight(0); st.done = true;
      };
    })();

    /* ---- car (autocar) ---- */
    (function () {
      const st = makeStation('car'), S = st.g, START = -16, STOP = 0, END = 16;
      rbox(S, 40, 0.06, 4.6, 0.02, 0x30333d, 0, 0.03, 0, 0.01); [2.8, -2.8].forEach((z) => rbox(S, 40, 0.18, 1.0, 0.02, 0xc9c6d6, 0, 0.09, z, 0.01));
      for (let x = -19; x < 19; x += 2) box(S, 1.0, 0.02, 0.12, 0xf3efe2, x, 0.07, 0);
      const stop = grp(S, 0.2, 0, 3.0); rbox(stop, 2.6, 0.08, 0.9, 0.02, VM.slate, 0, 2.2, 0.15); [-1.2, 1.2].forEach((x) => cylY(stop, 0.04, 2.2, MT.dark, x, 1.1, 0.5, 6)); rbox(stop, 2.4, 0.4, 0.06, 0.02, MT.glass, 0, 1.6, 0.55, 0.01); rbox(stop, 2.2, 0.08, 0.35, 0.02, VM.wood, 0, 0.45, 0.35, 0.01);
      cylY(stop, 0.04, 2.6, MT.dark, -1.6, 1.3, 0, 6); cylY(stop, 0.3, 0.05, VM.green, -1.6, 2.5, 0, 16).rotation.z = Math.PI / 2;
      const m = grp(S, START, 0, -0.9); st.m = m; st.lastX = START;
      const bus = railcar(m, 0, 8.4, { body: VM.green, stripe: VM.cream, ends: 'flat', front: true, w: 2.1, h: 2.9, base: 0.4, doors: [2.9, -0.6], doorW: 1.0, doorM: VM.cream, bogies: false });
      rbox(m, 0.06, 0.32, 1.2, 0.04, VM.paper, 4.22, 2.6, 0, 0.01);
      [1, -1].forEach((s) => { rod(m, new V3(4.1, 2.3, s * 1.0), new V3(4.5, 2.2, s * 1.25), 0.03, MT.black); rbox(m, 0.06, 0.4, 0.18, 0.04, MT.black, 4.5, 1.9, s * 1.27, 0.01); });
      operator(m, 3.4, 0.55, -0.45).scale.setScalar(0.9);
      st.wheels = [[2.8, 1], [2.8, -1], [-2.6, 1], [-2.6, -1]].map(([x, s]) => tire(m, 0.5, 0.32, x, 0.5, s * 0.92, MT.grey, s));
      const doorsCurb = bus.doors.filter((d) => d.position.z > 0);
      const riders = [[1.5, 3.9], [0.6, 4.2], [-0.4, 3.8]].map(([x, z], i) => person(S, x, z, Math.PI, { kid: i === 1, hat: i === 1 ? MT.hat : null, bag: i === 1 ? VM.cab : null }));
      const riderHome = riders.map((r) => r.position.clone());
      part(st, 'portes', 'les portes', anchor(m, 2.9, 2.2, 1.2), true);
      part(st, 'chauffeur', 'le chauffeur', anchor(m, 3.4, 2.5, -0.4), true);
      part(st, 'arret', "l'arrêt", anchor(stop, 0, 2.7, 0), true);
      part(st, 'passagers', 'les passagers', anchor(S, 0.6, 2.0, 4), false);
      st.focusAt = anchor(m, 0, 1.5, 1.5); st.size = { w: 15, h: 8 }; st.tagAt = anchor(m, 0, 3.6, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; riders.forEach((r, i) => { r.position.copy(riderHome[i]); r.visible = true; }); pop(m, 0.5); st.done = false; }
        engineOn(55);
        await Promise.all([step('Le car arrive et s’arrête à l’arrêt.', 'arret'), to(m.position, 'x', STOP, 4, (k) => 1 - Math.pow(1 - k, 2))]);
        await Promise.all([step('Pschhh ! Les portes s’ouvrent.', 'portes'), ...doorsCurb.map((d) => to(d.position, 'x', d.position.x - 0.95, 1.0))]);
        await step('Les passagers montent.', 'passagers');
        for (let i = 0; i < riders.length; i++) { const r = riders[i], tx = STOP + 2.9 - (i % 2) * 3.5; await tw(0.9, (k) => { r.position.x = riderHome[i].x + (tx - riderHome[i].x) * k; r.position.z = riderHome[i].z + (1.4 - riderHome[i].z) * k; }, lin); r.visible = false; }
        await Promise.all([step('Les portes se ferment. Bonjour, monsieur le chauffeur !', 'chauffeur'), ...doorsCurb.map((d) => to(d.position, 'x', d.position.x + 0.95, 1.0))]);
        await Promise.all([step('En route pour la prochaine ville !', null), to(m.position, 'x', END, 4, easeIn)]);
        st.done = true;
      };
    })();

    /* ---- tramway ---- */
    (function () {
      const st = makeStation('tram'), S = st.g, START = -14, STOP = 0.5, END = 15;
      rbox(S, 40, 0.05, 3.6, 0.02, 0x8a8ea0, 0, 0.03, 0, 0.01); railTrack(S, -20, 20, 0, { gauge: 0.7, sleepers: false });
      const WY = 4.3;
      for (let x = -18; x <= 18; x += 4.5) { const g = grp(S, x, 0, -2.1); cylY(g, 0.07, WY + 0.3, MT.dark, 0, (WY + 0.3) / 2, 0, 8); rod(g, new V3(0, WY + 0.15, 0), new V3(0, WY + 0.15, 2.1), 0.04, MT.dark); }
      rod(S, new V3(-20, WY, 0), new V3(20, WY, 0), 0.015, MT.black, 4);
      const plat = grp(S, STOP, 0, -2.6); rbox(plat, 10, 0.35, 1.4, 0.04, VM.concrete, 0, 0.18, 0, 0.02); rbox(plat, 3, 0.08, 1.2, 0.02, VM.slate, 0, 2.5, 0, 0.01); [-1.3, 1.3].forEach((x) => cylY(plat, 0.04, 2.3, MT.dark, x, 1.4, -0.4, 6));
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const car1 = railcar(m, 2.4, 4.8, { body: VM.white, stripe: VM.tram, ends: 'round', front: true, w: 1.9, h: 2.75, base: 0.3, doors: [1.2], doorW: 1.0, doorM: VM.tram });
      const car2 = railcar(m, -2.5, 4.8, { body: VM.white, stripe: VM.tram, ends: 'round', w: 1.9, h: 2.75, base: 0.3, doors: [-1.2], doorW: 1.0, doorM: VM.tram });
      rbox(m, 0.3, 2.2, 1.7, 0.08, MT.dark, -0.05, 1.45, 0, 0.02);
      rbox(m, 9.8, 0.25, 1.92, 0.08, VM.tram, -0.05, 0.42, 0, 0.02);
      const pan = grp(m, 2.4, 2.78, 0); rbox(pan, 0.8, 0.12, 0.8, 0.03, MT.dark, 0, 0, 0, 0.01);
      const low = grp(pan, 0.3, 0.08, 0); rod(low, new V3(0, 0, 0), new V3(-0.9, 0, 0), 0.03, MT.dark); const up = grp(low, -0.9, 0, 0); rod(up, new V3(0, 0, 0), new V3(0.9, 0, 0), 0.025, MT.dark);
      const shoe = grp(up, 0.9, 0, 0); rbox(shoe, 0.1, 0.05, 0.9, 0.02, MT.chrome, 0, 0, 0, 0.01);
      const setPan = (h) => { const a = Math.asin(clamp(h / 1.8, 0, 0.99)); low.rotation.z = -a; up.rotation.z = 2 * a; shoe.rotation.z = -a; };
      setPan(0.25);
      const doorsAll = [...car1.doors, ...car2.doors];
      part(st, 'pantographe', 'le pantographe', anchor(pan, -0.3, 0.9, 0), true);
      part(st, 'fil', 'le fil électrique', anchor(S, -4, WY + 0.3, 0), true);
      part(st, 'rails', 'les rails', anchor(S, -6, 0.3, 0.9), true);
      part(st, 'portes', 'les portes', anchor(m, 1.2, 1.9, 1), false);
      st.focusAt = anchor(m, 0, 2, 0); st.size = { w: 15, h: 8 }; st.tagAt = anchor(m, 0, 4.8, 0);
      let sp = 0;
      st.update = (dt) => { roll(st, dt); if (st.running) { sp -= dt; if (sp <= 0) { sp = rnd(0.15, 0.5); const p = wp(shoe, 0.05); for (let i = 0; i < 4; i++) fx.fire(p, new V3(rnd(-1, 1), rnd(-0.5, 0.5), rnd(-1, 1)), 2.5, 0.6, rnd(0.04, 0.08)); } } };
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; setPan(0.25); pop(m, 0.5); st.done = false; }
        await Promise.all([step('Le pantographe se lève et touche le fil.', 'pantographe'), tw(1.6, (k) => setPan(0.25 + k * (WY - 2.86 - 0.25)))]);
        engineOn(110); st.running = true;
        await Promise.all([step("L'électricité du fil fait tourner ses moteurs. Ding ding !", 'fil'), to(m.position, 'x', STOP, 5, easeSine)]);
        ding(); st.running = false;
        await Promise.all([step('Il s’arrête à la station. Les portes s’ouvrent.', 'portes'), ...doorsAll.map((d) => to(d.position, 'x', d.position.x - 0.95, 1.0))]);
        await sleep(0.8);
        await Promise.all(doorsAll.map((d) => to(d.position, 'x', d.position.x + 0.95, 1.0)));
        st.running = true;
        await Promise.all([step('Il roule sur des rails : pas besoin de volant !', 'rails'), to(m.position, 'x', END, 4, easeIn)]);
        st.running = false; st.done = true;
      };
    })();

    /* ---- métro ---- */
    (function () {
      const st = makeStation('metro'), S = st.g, START = -21, STOP = 2, END = 22;
      railTrack(S, -28, 28, 0);
      [[-27, -10], [12, 28]].forEach(([a, b], i) => {
        const L = b - a, c = (a + b) / 2;
        const hill = rbox(S, L, 4.2, 5.6, 1.6, std(0x4f8a5a, 0.9, 0), c, 2.0, 0, 0.1);
        const face = i ? a : b, dir = i ? -1 : 1;
        const portal = grp(S, face + dir * 0.05, 0, 0); portal.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        ext(portal, [[-2.4, 0], [-1.3, 0], [-1.3, 2.4], ...arc(0, 2.4, 1.3, 180, 0, 10), [1.3, 0], [2.4, 0], [2.4, 4.0], [-2.4, 4.0]], 0, 0.5, VM.concrete, 0, 0, 0, 0.03);
        box(portal, 2.6, 3.6, 0.1, 0x0b0d14, 0, 1.8, -0.2);
        [-1.6, 1.6].forEach((x) => (sakuraTree(S, c + x * 2, (i ? -1 : 1) * 1.2, 0.6).position.y = 4.1));
      });
      const plat = grp(S, STOP, 0, -2.0); rbox(plat, 15, 1.0, 1.8, 0.04, VM.concrete, 0, 0.5, -0.1, 0.02); rbox(plat, 15.4, 0.12, 2.6, 0.03, VM.slate, 0, 3.6, -0.3, 0.02);
      for (let x = -7; x <= 7; x += 3.5) cylY(plat, 0.08, 2.6, MT.dark, x, 2.3, -0.8, 8);
      const DOORX = [5.95, 3.75, 1.1, -1.1, -3.75, -5.95], screens = [];
      for (let x = -7; x <= 7.01; x += 0.7) { if (DOORX.some((d) => Math.abs(d - x) < 0.7)) continue; const g = grp(plat, x, 1.0, 0.75); rbox(g, 0.66, 1.2, 0.05, 0.03, MT.glass, 0, 0.6, 0, 0.01); }
      DOORX.forEach((x) => { const g = grp(plat, x, 1.0, 0.75); rbox(g, 1.0, 1.2, 0.05, 0.03, VM.orange, 0, 0.6, 0, 0.01); screens.push(g); });
      rbox(plat, 2.2, 0.5, 0.08, 0.03, VM.white, 0, 3.0, 0.7, 0.01);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const cars = [railcar(m, 4.85, 4.7, { body: VM.silver, stripe: VM.orange, ends: 'flat', front: true, doors: [1.1, -1.1], doorW: 0.9 }), railcar(m, 0, 4.7, { body: VM.silver, stripe: VM.orange, ends: 'flat', doors: [1.1, -1.1], doorW: 0.9 }), railcar(m, -4.85, 4.7, { body: VM.silver, stripe: VM.orange, ends: 'flat', doors: [1.1, -1.1], doorW: 0.9 })];
      [2.43, -2.43].forEach((x) => rbox(m, 0.3, 1.3, 1.1, 0.05, MT.dark, x, 1.2, 0, 0.02));
      const trainDoors = cars.flatMap((c) => c.doors);
      part(st, 'tunnel', 'le tunnel', anchor(S, -11, 4.6, 0), true);
      part(st, 'quai', 'le quai', anchor(plat, -3, 3.9, 0), true);
      part(st, 'portes', 'les portes', anchor(m, 1.1, 2.4, -1), false);
      st.focus = new V3(0, 1.5, 0); st.size = { w: 30, h: 9 }; st.tagAt = anchor(S, STOP, 5, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; st.done = false; }
        engineOn(120);
        await Promise.all([step('Le métro roule sous la terre, dans un tunnel...', 'tunnel'), to(m.position, 'x', -9, 2.6, lin)]);
        await Promise.all([step('...et il arrive à la station !', 'quai'), to(m.position, 'x', STOP, 3.4, (k) => 1 - Math.pow(1 - k, 2))]);
        engineOff(); ding();
        await Promise.all([step('Il s’arrête pile devant les portes du quai. Tout s’ouvre ensemble !', 'portes'),
          ...trainDoors.map((d) => to(d.position, 'x', d.position.x - 0.85, 1.1)), ...screens.map((d) => to(d.position, 'y', 2.2, 1.1))]);
        await sleep(1);
        await Promise.all([...trainDoors.map((d) => to(d.position, 'x', d.position.x + 0.85, 1.1)), ...screens.map((d) => to(d.position, 'y', 1.0, 1.1))]);
        engineOn(120);
        await Promise.all([step('Il repart dans le tunnel suivant.', 'tunnel'), to(m.position, 'x', END, 4.2, easeIn)]);
        st.done = true;
      };
    })();

    /* ---- shinkansen ---- */
    (function () {
      const st = makeStation('shinkansen'), S = st.g, DY = 3.6, START = 0, OUT = 46;
      rbox(S, 90, 0.6, 3.2, 0.05, VM.concrete, 0, DY - 0.3, 0, 0.02);
      [1.55, -1.55].forEach((z) => rbox(S, 90, 0.5, 0.12, 0.02, VM.concrete, 0, DY + 0.25, z, 0.01));
      for (let x = -44; x <= 44; x += 5) { cylY(S, 0.45, DY - 0.6, VM.concrete, x, (DY - 0.6) / 2, 0, 12); rbox(S, 1.3, 0.4, 2.8, 0.05, VM.concrete, x, DY - 0.75, 0, 0.02); }
      railTrack(S, -45, 45, 0, { y: DY, gauge: 0.7 });
      for (let x = -42; x <= 42; x += 7) { cylY(S, 0.05, 2.8, MT.dark, x, DY + 1.4, -1.5, 6); rod(S, new V3(x, DY + 2.7, -1.5), new V3(x, DY + 2.7, 0), 0.03, MT.dark); }
      rod(S, new V3(-45, DY + 2.6, 0), new V3(45, DY + 2.6, 0), 0.012, MT.black, 4);
      const plat = grp(S, 0, DY, 2.6); rbox(plat, 22, 0.5, 2.0, 0.04, VM.concrete, 0, -0.1, 0, 0.02); for (let x = -10; x <= 10; x += 5) { cylY(plat, 0.05, 1.6, MT.dark, x, 0.95, 0.8, 6); rbox(plat, 0.5, 0.3, 0.1, 0.02, VM.paper, x, 1.8, 0.8, 0.01); }
      [-10.5, 10.5].forEach((x) => { const g = grp(S, x, 0, 4.2); rbox(g, 1.2, DY + 0.2, 1.4, 0.05, VM.concrete, 0, (DY + 0.2) / 2, 0, 0.02); });
      const m = grp(S, START, DY, 0); st.m = m;
      const opt = { body: VM.white, stripe: VM.blue, w: 1.55, h: 2.0, base: 0.35 };
      const lead = railcar(m, 6.5, 7, { ...opt, ends: 'nose', doors: [-1.8] }), mid = railcar(m, 0, 6, { ...opt, ends: 'flat', doors: [2.2, -2.2] }), tail = railcar(m, -6.5, 7, { ...opt, ends: 'tail', doors: [1.8] });
      [3.05, -3.05].forEach((x) => rbox(m, 0.15, 1.5, 1.3, 0.05, MT.dark, x, 1.2, 0, 0.02));
      const pg = grp(m, 0, 2.0, 0); rbox(pg, 0.6, 0.1, 0.5, 0.02, MT.dark, 0, 0.05, 0, 0.01); rod(pg, new V3(0, 0.1, 0), new V3(0.3, 0.55, 0), 0.03, MT.dark); rbox(pg, 0.08, 0.04, 0.6, 0.01, MT.chrome, 0.3, 0.58, 0, 0.01);
      const allDoors = [...lead.doors, ...mid.doors, ...tail.doors];
      const passengers = [[-3, 3.0], [2, 3.2], [5, 2.9]].map(([x, z], i) => person(S, x, z, -Math.PI / 2, { kid: i === 1, hat: i === 1 ? MT.hat : null, bag: i === 1 ? VM.cab : null }));
      passengers.forEach((p) => (p.position.y = DY + 0.15));
      part(st, 'nez', 'le nez pointu', anchor(lead.g, 3.0, 1.8, 0), true);
      part(st, 'pont', 'le pont', anchor(S, -15, DY - 1, 1.6), true);
      part(st, 'quai', 'la gare', anchor(plat, 0, 3.4, 0), true);
      st.focus = new V3(0, DY, 0); st.size = { w: 32, h: 9 }; st.tagAt = anchor(m, 0, 3.4, 0);
      let streak = 0;
      st.update = (dt) => { if (st.fast) { streak -= dt; if (streak <= 0) { streak = 0.04; const p = wp(lead.g, 3.5); p.y += rnd(-0.5, 0.8); p.z += rnd(-1, 1); fx.smoke(p, new V3(-25, 0, 0), 0.15, 0xffffff, 0.35); } } };
      st.action = async function () {
        await Promise.all([step('Les passagers montent dans le train.', 'quai'), ...passengers.map((p, i) => tw(1.4, (k) => (p.position.z = 3.0 - k * 1.6), lin).then(() => (p.visible = false)))]);
        await step('Les portes se ferment. Attention au départ !', null);
        engineOn(140); st.fast = true;
        await Promise.all([step('Il accélère très, très vite... Son long nez pointu fend l’air !', 'nez'), to(m.position, 'x', OUT, 4.2, easeIn)]);
        m.visible = false; m.position.x = -OUT; await sleep(0.6); m.visible = true;
        await Promise.all([step('Le voilà qui revient, sur son grand pont !', 'pont'), to(m.position, 'x', START, 4.6, (k) => 1 - Math.pow(1 - k, 2.5))]);
        st.fast = false; engineOff(); chime();
        passengers.forEach((p, i) => { p.visible = true; p.position.z = 3.0; });
        await step('Arrivé à la gare. Tout le monde descend !', 'quai');
      };
    })();

    /* ---- téléphérique ---- */
    (function () {
      const st = makeStation('telepherique'), S = st.g, TOP = 22, HT = 9.5;
      const hill = grp(S, TOP + 2, 0, 0); add(hill, new THREE.CylinderGeometry(4.5, 8.5, HT, 18), std(0x3f7a52, 0.9, 0), 0, HT / 2, 0);
      [[-3, 2.5, -4], [4, 1.2, 5], [-6, 0.5, 4], [5, 2.2, -5], [1, 3.5, -6]].forEach(([x, y, z]) => pine(hill, x, z, 1.1).position.y = y);
      pagoda(hill, 1.5, -2, 0.8).position.y = HT;
      torii(S, TOP - 7.5, -2.6, Math.PI / 2, 0.8);
      sakuraTree(hill, 2.6, -3.4, 0.8).position.y = HT; sakuraTree(hill, -1.2, -3.8, 0.7).position.y = HT;
      const bot = grp(S, 0, 0, 0); rbox(bot, 3.6, 7.4, 3.6, 0.1, VM.cream, -2.3, 3.7, 0, 0.02); for (let y = 1.5; y < 7; y += 1.6) box(bot, 3.62, 0.08, 3.62, VM.woodD, -2.3, y, 0); ext(bot, [[-2.2, 0], [2.2, 0], [0, 0.9]], 0.05, 4.0, VM.slate, -2.3, 7.4, 0, 0.03).rotation.y = Math.PI / 2;
      const top = grp(S, TOP, HT, 0); rbox(top, 3.2, 2.8, 3.2, 0.1, VM.cream, 1.0, 1.4, 0, 0.02); ext(top, [[-2.0, 0], [2.0, 0], [0, 0.8]], 0.05, 3.6, VM.slate, 1.0, 2.8, 0, 0.03).rotation.y = Math.PI / 2;
      const wheelG = grp(bot, -0.3, 7.9, 0); wheelG.rotation.x = Math.PI / 2;
      const bull = grp(wheelG); cylY(bull, 1.0, 0.12, MT.dark, 0, 0, 0, 24); for (let k = 0; k < 6; k++) { const s = box(bull, 1.9, 0.08, 0.1, MT.yel, 0, 0.08, 0); s.rotation.y = (k * Math.PI) / 6; }
      const A = new V3(0.6, 7.9, 0), B = new V3(TOP - 0.6, HT + 3.2, 0), MIDX = TOP / 2;
      const pyl = grp(S, MIDX, 0, 0); const PH = (A.y + B.y) / 2 + 0.4;
      [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]].forEach(([x, z]) => rod(pyl, new V3(x, 0, z), new V3(x * 0.4, PH, z * 0.4), 0.06, MT.grey, 6));
      for (let y = 1; y < PH; y += 1.4) { const t = y / PH, w = 0.5 - t * 0.3; rod(pyl, new V3(-w, y, w), new V3(w, y + 1.4, w), 0.035, MT.grey, 5); }
      rbox(pyl, 0.4, 0.2, 1.6, 0.05, MT.dark, 0, PH, 0, 0.02);
      const cablePt = (s) => { const x = A.x + (B.x - A.x) * s, y = A.y + (B.y - A.y) * s + (PH - (A.y + B.y) / 2 - 0.1) * (1 - Math.pow(2 * s - 1, 2)); return new V3(x, y, 0); };
      [0.25, -0.25].forEach((z) => { for (let i = 0; i < 24; i++) { const a = cablePt(i / 24), b = cablePt((i + 1) / 24); a.z = b.z = z; rod(S, a, b, 0.025, MT.black, 4); } });
      const cab = grp(S, 0, 0, 0);
      const hanger = grp(cab); rbox(hanger, 0.6, 0.18, 0.7, 0.04, MT.dark, 0, 0, 0, 0.02); [0.2, -0.2].forEach((x) => cylZ(hanger, 0.1, 0.62, MT.steel, x, 0.08, 0, 10)); rod(hanger, new V3(0, 0, 0), new V3(0, -1.2, 0), 0.05, MT.dark);
      const box1 = grp(cab, 0, -2.3, 0); rbox(box1, 1.9, 1.4, 1.5, 0.3, VM.cab, 0, 0, 0, 0.04); [1, -1].forEach((s) => rbox(box1, 1.5, 0.55, 0.03, 0.08, MT.glassD, 0, 0.2, s * 0.76, 0.01)); [1, -1].forEach((s) => rbox(box1, 0.03, 0.55, 1.1, 0.08, MT.glassD, s * 0.96, 0.2, 0, 0.01)); rbox(box1, 1.95, 0.12, 1.55, 0.05, VM.white, 0, -0.35, 0, 0.01);
      person(box1, 0.3, 0, 0, { kid: true, hat: MT.hat }).position.y = -0.7;
      const place = (s) => { const p = cablePt(s); cab.position.set(p.x, p.y + 0.15, 0); };
      st.s = 0.06; place(st.s); st.m = cab;
      part(st, 'roue', 'la grande roue', anchor(bot, -0.3, 9.2, 1.2), true);
      part(st, 'cable', 'le câble', anchor(S, MIDX * 0.6, cablePt(0.3).y + 0.4, 0.4), true);
      part(st, 'cabine', 'la cabine', anchor(box1, 0, 1.0, 0), true);
      part(st, 'temple', 'le temple', anchor(hill, 1.5, HT + 6.5, -2), false);
      st.focusAt = anchor(cab, 0, -1.6, 0); st.size = { w: 14, h: 11 }; st.tagAt = anchor(cab, 0, 1.4, 0);
      st.update = (dt) => { if (st.moving) bull.rotation.y += dt * 2.2 * st.moving; };
      st.action = async function () {
        const up = st.s < 0.5;
        engineOn(90);
        st.moving = up ? 1 : -1;
        await Promise.all([step('La grande roue tourne et tire le câble.', 'roue'), sleep(1.4)]);
        await Promise.all([step(up ? 'La cabine monte la colline, accrochée au câble.' : 'On redescend tout doucement vers la ville.', 'cable'),
          tw(7, (k) => { st.s = up ? 0.06 + 0.88 * k : 0.94 - 0.88 * k; place(st.s); cab.rotation.z = Math.sin(k * Math.PI * 3) * 0.03; }, easeSine)]);
        st.moving = 0; engineOff(); ding();
        await step(up ? 'Arrivée au temple, tout en haut ! Quelle belle vue !' : 'Retour en bas. On remonte ?', up ? 'temple' : 'cabine');
      };
    })();
  }
};
