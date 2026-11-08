// La Ville — transports in a Japanese-inspired town: car, bus, tram, metro, shinkansen, cable car.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { C, MT, UB, ICO, dummy, tmpCol, mat, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, arc, anchor, beam, wp, shadows, instanced, toonMat, freeze } from '../kit/geo.js';
import { tire, operator, beacon, truckCab } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp } from '../kit/props.js';
import { route, person as walker, miniCar, traffic } from '../kit/life.js';

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
const lampMat = (c) => toonMat({ color: c, emissive: c, emissiveIntensity: 0.15 });

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
  const m = toonMat({ map: WIN[Math.floor(Math.random() * 3)].clone(), roughness: 0.6, emissive: 0x1a1408, emissiveMap: null });
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
    how: 'Une grande roue dans la gare tourne et tire le câble. La cabine glisse le long du câble.' },
  poubelle: { short: 'Le camion-poubelle', full: 'Le camion-poubelle', verb: 'Ramasser', horn: 'horn',
    use: 'Il ramasse les poubelles de toute la ville.',
    how: "Derrière, un bras soulève la poubelle et la vide. Dedans, une grosse pelle tasse les déchets pour en mettre plus." },
  pompiers: { short: 'Les pompiers', full: 'Le camion de pompiers', verb: 'Sauver', horn: 'horn',
    use: 'Il vient au secours des gens... et des petits chats !',
    how: "Sa grande échelle tourne, se lève et s'allonge pour aller très haut." },
  bateau: { short: 'Le bateau-bus', full: 'Le bateau-bus', verb: 'Embarquer', horn: 'bell',
    use: 'Il transporte les passagers sur la rivière.',
    how: "Il s'arrête aux pontons comme un bus. Son hélice, sous l'eau, le fait avancer." }
};
const ORDER = ['voiture', 'car', 'poubelle', 'pompiers', 'tram', 'metro', 'bateau', 'shinkansen', 'telepherique'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  poubelle: GND + `<rect x="8" y="22" width="66" height="34" rx="8" fill="#3aa46a"/><rect class="w" x="8" y="44" width="66" height="5"/><rect class="w" x="76" y="30" width="30" height="26" rx="3"/><rect class="g" x="90" y="34" width="12" height="10"/>
    <rect x="0" y="36" width="10" height="18" rx="2" fill="#2a7a4a"/><circle class="k" cx="24" cy="62" r="9"/><circle class="k" cx="46" cy="62" r="9"/><circle class="k" cx="92" cy="62" r="9"/>`,
  pompiers: GND + `<path class="ln" d="M24 40L96 8" style="stroke:#c9ccd8;stroke-width:6"/><rect class="r" x="6" y="36" width="72" height="20" rx="3"/><rect class="r" x="78" y="28" width="32" height="28" rx="3"/><rect class="g" x="92" y="32" width="14" height="11"/>
    <rect class="b" x="88" y="22" width="12" height="6" rx="2"/><circle class="k" cx="22" cy="62" r="9"/><circle class="k" cx="44" cy="62" r="9"/><circle class="k" cx="94" cy="62" r="9"/>`,
  bateau: `<path d="M0 66q30 8 60 0t60 0V80H0z" fill="#4f8fe0"/><path class="w" d="M10 46h96l-10 18H18z"/><rect x="10" y="52" width="96" height="4" fill="#1f4fb8"/><rect class="g" x="28" y="28" width="56" height="18" rx="3"/><rect x="24" y="24" width="64" height="5" rx="2" fill="#1f4fb8"/><path class="ln" d="M14 46V20"/><path d="M14 20h12v8H14z" fill="#d8402a"/>`,
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
// Layout coordinates (like the building site): h runs left → right on screen in the overview, d from the back (−) to the front (+).
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const YAWF = -Math.PI / 4;           // along a street that comes towards the front
const FACE = { front: YAW, back: YAW + Math.PI, right: 3 * Math.PI / 4, left: -Math.PI / 4 }; // which way a building's street side (+z) looks
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const CFG = {
  poubelle: CF(-30, -11.5), pompiers: CF(16, -11.5), bateau: CF(-31, 4),
  voiture: CF(10, 9, YAWF), car: CF(28, 15.5), tram: CF(0, -17), metro: CF(0, 31), shinkansen: CF(4, -27), telepherique: CF(17, -4)
};

// painted ground
const GR = [], GB = [];
const rect = (h, d, len, wid, along, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: along === 'h' ? -Math.PI / 4 : Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const ROAD = '#34364a', WALK = '#c9c4d8', LINE = '#f3efe2';
// avenue (cars in front, tram behind), market street, side streets, the cross street
rect(-14, -11.5, 68, 4.4, 'h', ROAD); rect(-14, -8.6, 68, 1.6, 'h', WALK); rect(-14, -14.4, 68, 1.6, 'h', WALK);
rect(12, 15.5, 72, 4.4, 'h', ROAD); rect(12, 12.6, 72, 1.6, 'h', WALK); rect(12, 18.4, 72, 1.6, 'h', WALK);
[-22, -2].forEach((h) => { rect(h, 2, 4.4, 30, 'h', ROAD); rect(h - 2.9, 2, 1.4, 30, 'h', WALK); rect(h + 2.9, 2, 1.4, 30, 'h', WALK); });
rect(10, -9.6, 3.6, 4.2, 'd', ROAD);
for (let h = -46; h < 20; h += 3) rect(h, -11.5, 1.4, 0.14, 'h', LINE, 0.85);
for (let h = -24; h < 48; h += 3) rect(h, 15.5, 1.4, 0.14, 'h', LINE, 0.85);
[[-5, 15.5], [-19, 15.5]].forEach(([h, d]) => rect(h, d, 2.2, 4.4, 'h', LINE, 0.95, ROAD));
[[-2, 1], [-2, 7]].forEach(([h, d]) => rect(h, d, 2.2, 4.4, 'd', LINE, 0.95, ROAD));
// the river and its stone promenades
rect(-10, 4, 76, 7.4, 'h', '#b9b2cc'); rect(-10, 4, 76, 5, 'h', '#3f7fd0');
// plazas, park, gardens
blob(4, -21, 7, 'rgba(230,226,240,.55)'); blob(24, 23, 6, 'rgba(120,200,140,.5)'); blob(35, -4, 10, 'rgba(90,170,110,.55)'); blob(0, 26, 6, 'rgba(230,226,240,.5)');
blob(-34, -20, 8, 'rgba(120,200,140,.4)'); blob(-32, 22, 8, 'rgba(120,200,140,.4)');

export default {
  id: 'ville', title: 'La Ville', titleHtml: 'La <span>Ville</span>',
  subtitle: 'Une ville japonaise pleine de vie : des rues, une rivière, une gare, un temple. Et plein de transports !',
  welcome: 'Bienvenue en ville ! Touche un transport pour voir comment il marche.',
  hint: 'Touche un transport pour le découvrir.', backLabel: 'Toute la ville',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="22" height="16" rx="4"/><path d="M5 16h22M10 27l2-4M22 27l-2-4M11 3h10"/><circle cx="10" cy="19.5" r="1"/><circle cx="22" cy="19.5" r="1"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 46, outerColor: 0x1d3f7a, tufts: false,
  forest: { dark: [0x1f4a3a, 0x2a5a44, 0x173a30], bush: [0xf4b2cc, 0xe99ab8, 0xf7c6d8, 0x2f8a5a] },
  overview: { w: 74, h: 52, focus: [0, 3, 0] },
  ground: { base: ['#8a92c8', '#6a73ad', '#4c5488'], rects: GR, blobs: GB },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate, throwClod } = ctx;
    const fx = createFx(scene, 120);
    onUpdate((dt) => fx.update(dt));
    freeze(buildTown(grp(scene), onUpdate));

    /* ---- voiture + feux ---- */
    (function () {
      const st = makeStation('voiture'), S = st.g, START = -12, STOP = -4.2, END = 14;
      rbox(S, 34, 0.06, 4.2, 0.02, 0x30333d, 0, 0.03, 0, 0.01); [2.6, -2.6].forEach((z) => rbox(S, 34, 0.18, 1.0, 0.02, 0xc9c6d6, 0, 0.09, z, 0.01));
      for (let x = -16; x < 16; x += 2) if (Math.abs(x) > 2) box(S, 1.0, 0.02, 0.12, 0xf3efe2, x, 0.07, 0);
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
      const st = makeStation('telepherique'), S = st.g, TOP = 16, HT = 9.5;
      const hill = grp(S, TOP + 2, 0, 0); add(hill, new THREE.CylinderGeometry(4.5, 8.5, HT, 18), std(0x3f7a52, 0.9, 0), 0, HT / 2, 0);
      [[-3, 2.5, -4], [4, 1.2, 5], [-6, 0.5, 4], [5, 2.2, -5], [1, 3.5, -6]].forEach(([x, y, z]) => pine(hill, x, z, 1.1).position.y = y);
      pagoda(hill, 1.5, -2, 0.8).position.y = HT;
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
    /* ---- camion-poubelle ---- */
    (function () {
      const st = makeStation('poubelle'), S = st.g, START = -6, STOP = 0, END = 4;
      const G = std(0x3aa46a, 0.4, 0.2), GD = std(0x2a7a4a, 0.5, 0.2);
      const m = grp(S, START, 0, 0.9); st.m = m; st.lastX = START;
      [0.42, -0.42].forEach((z) => rbox(m, 6.2, 0.3, 0.16, 0.03, MT.black, -0.2, 0.97, z));
      truckCab(m, MT.white, 1.45);
      const body = grp(m, -1.2, 1.15, 0); rbox(body, 4.2, 1.9, 2.1, 0.3, G, 0, 0.95, 0, 0.04); rbox(body, 4.25, 0.25, 2.12, 0.04, MT.white, 0, 0.5, 0, 0.01);
      const rear = grp(m, -3.3, 1.15, 0); rbox(rear, 0.9, 2.0, 2.15, 0.2, GD, -0.35, 1.0, 0, 0.03); rbox(rear, 0.5, 0.6, 1.8, 0.1, MT.dark, -0.7, 0.45, 0, 0.02);
      const blade = grp(rear, -0.35, 1.7, 0); rbox(blade, 0.12, 1.0, 1.7, 0.03, MT.steel, 0, -0.5, 0, 0.01);
      const lifter = grp(m, -4.0, 0.95, 0); rbox(lifter, 0.15, 0.5, 1.2, 0.04, MT.dark, 0, 0.25, 0, 0.01);
      [0.85, -0.85].forEach((z) => { rbox(m, 0.06, 0.2, 0.18, 0.03, MT.tail, -4.1, 1.4, z, 0.01); });
      beacon(st, m, -1.2, 3.1, 0.6); beacon(st, m, -1.2, 3.1, -0.6);
      st.wheels = []; [1, -1].forEach((s) => { st.wheels.push(tire(m, 0.55, 0.4, 2.3, 0.55, s * 0.9, MT.grey)); [-1.2, -2.3].forEach((x) => st.wheels.push(tire(m, 0.55, 0.3, x, 0.55, s * 0.95, MT.grey, s))); });
      // the bin on the sidewalk and the bin man
      const binHome = new V3(-3.8, 0, 2.9);
      const bin = grp(S, binHome.x, 0, binHome.z); rbox(bin, 0.7, 1.0, 0.7, 0.08, std(0x2f7f5a, 0.6, 0), 0, 0.55, 0, 0.02); const lid = grp(bin, -0.35, 1.06, 0); rbox(lid, 0.75, 0.06, 0.72, 0.02, std(0x2a6a4a, 0.6, 0), 0.35, 0, 0, 0.01); [0.25, -0.25].forEach((z) => cylZ(bin, 0.09, 0.06, MT.black, -0.3, 0.1, z, 10));
      const man = walker(S, -1.8, 2.6, { vest: true, hat: std(0x3aa46a, 0.6, 0) }); man.rotation.y = Math.PI;
      part(st, 'benne', 'la benne', anchor(body, 0, 2.1, 0.8), true);
      part(st, 'leveur', 'le lève-conteneur', anchor(lifter, -0.1, 0.6, 0.7), false);
      part(st, 'eboueur', "l'éboueur", anchor(man, 0, 1.5, 0), true);
      part(st, 'poubelle', 'la poubelle', anchor(bin, 0, 1.3, 0), true);
      part(st, 'pelle', 'la pelle qui tasse', anchor(rear, -0.4, 2.3, 0.6), false);
      st.focusAt = anchor(m, -1.2, 1.2, 1.6); st.size = { w: 13, h: 7 }; st.tagAt = anchor(m, 0, 3.8, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; bin.position.copy(binHome); bin.rotation.set(0, 0, 0); man.position.set(-1.8, 0, 2.6); pop(m, 0.4); st.done = false; }
        engineOn(55);
        await Promise.all([step('Le camion-poubelle s’arrête devant la poubelle.', 'poubelle'), to(m.position, 'x', STOP, 3.6, (k) => 1 - Math.pow(1 - k, 2))]);
        await Promise.all([step("L'éboueur roule la poubelle jusqu'à l'arrière du camion.", 'eboueur'),
          tw(2, (k) => { bin.position.set(binHome.x + (-4.55 - binHome.x) * k, 0, binHome.z + (0.9 - binHome.z) * k); bin.rotation.y = k * 0.3; man.position.set(-1.8 - 1.2 * k, 0, 2.6 - 0.6 * k); man.userData.walk(k * 18); }, lin)]);
        bin.rotation.y = 0; lifter.attach(bin);
        const b0 = bin.position.clone();
        await Promise.all([step('Le lève-conteneur la soulève, et la vide dans la benne.', 'leveur'),
          tw(1.6, (k) => { bin.position.set(b0.x + 0.6 * k, b0.y + 1.8 * k, b0.z); bin.rotation.z = -k * 2.2; lid.rotation.z = k * 1.8; }, easeSine)]);
        for (let i = 0; i < 10; i++) throwClod(wp(bin, 0.4), wp(rear, 1.2), rnd(0.1, 0.18), pick([0x6a8a5a, 0x8a7a6a, 0xd8d8e0, 0x5a7aaa]));
        thud();
        await Promise.all([step('Dedans, une grosse pelle tasse les déchets.', 'pelle'), tw(1.8, (k) => (blade.rotation.z = Math.sin(k * Math.PI) * 1.1), easeSine)]);
        await tw(1.2, (k) => { bin.position.set(b0.x + 0.6 * (1 - k), b0.y + 1.8 * (1 - k), b0.z); bin.rotation.z = -(1 - k) * 2.2; lid.rotation.z = (1 - k) * 1.8; }, easeSine);
        S.attach(bin);
        await Promise.all([step("La poubelle est vide, on la remet à sa place. Au revoir !", 'eboueur'),
          tw(1.6, (k) => { bin.position.lerpVectors(bin.position.clone(), binHome, k); man.position.set(-3 + 1.2 * k, 0, 2.0 + 0.6 * k); man.userData.walk(k * 14); }, lin)]);
        bin.position.copy(binHome); bin.rotation.set(0, 0, 0);
        await Promise.all([step('Le camion repart vers la poubelle suivante.', 'benne'), to(m.position, 'x', END, 2.6, easeIn)]);
        st.done = true;
      };
    })();

    /* ---- camion de pompiers ---- */
    (function () {
      const st = makeStation('pompiers'), S = st.g, START = -10, STOP = 0;
      const R = std(0xd8302a, 0.35, 0.2);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      [0.42, -0.42].forEach((z) => rbox(m, 6.4, 0.3, 0.16, 0.03, MT.black, -0.3, 0.97, z));
      truckCab(m, R, 1.45);
      rbox(m, 4.4, 1.4, 2.2, 0.15, R, -1.0, 1.85, 0, 0.03); for (let x = -2.8; x <= 0.6; x += 0.9) [1, -1].forEach((s) => rbox(m, 0.8, 1.1, 0.04, 0.04, MT.steel, x, 1.85, s * 1.11, 0.01));
      rbox(m, 4.4, 0.1, 0.08, 0.02, MT.white, -1.0, 1.3, 1.12, 0.01); rbox(m, 4.4, 0.1, 0.08, 0.02, MT.white, -1.0, 1.3, -1.12, 0.01);
      const lights = []; [0.5, -0.5].forEach((z) => { const L = std(0x3a6aff, 0.3, 0, { emissive: 0x2a4aff, emissiveIntensity: 0.2 }); rbox(m, 0.3, 0.15, 0.3, 0.05, L, 2.7, 3.0, z, 0.02); lights.push(L); });
      st.wheels = []; [1, -1].forEach((s) => { st.wheels.push(tire(m, 0.55, 0.4, 2.3, 0.55, s * 0.9, MT.grey)); [-1.2, -2.3].forEach((x) => st.wheels.push(tire(m, 0.55, 0.3, x, 0.55, s * 0.95, MT.grey, s))); });
      const legs = [[0.8, 1], [0.8, -1], [-2.7, 1], [-2.7, -1]].map(([x, s]) => { const g = grp(m, x, 1.0, s * 1.0); const a = grp(g); rbox(a, 0.22, 0.22, 0.8, 0.03, MT.dark, 0, 0, s * 0.4); const f = grp(a, 0, 0, s * 0.8); rbox(f, 0.16, 0.9, 0.16, 0.03, MT.dark, 0, -0.45, 0); rbox(f, 0.4, 0.06, 0.4, 0.02, MT.dark, 0, -0.95, 0); a.scale.z = 0.3; f.position.y = 0.4; return { a, f }; });
      // turntable, ladder in three parts, basket
      const turn = grp(m, -2.4, 2.55, 0); cylY(turn, 0.6, 0.3, MT.dark, 0, 0, 0, 16);
      const lift = grp(turn, 0, 0.45, 0);
      const secs = [];
      [[3.0, 0.62], [2.9, 0.5], [2.8, 0.4]].forEach(([L, w], i) => { const g = grp(i ? secs[i - 1] : lift, i ? 0.4 : 0, 0.06, 0); [w / 2, -w / 2].forEach((z) => rbox(g, L, 0.08, 0.06, 0.02, i % 2 ? MT.steel : MT.white, L / 2, 0, z, 0.01)); for (let x = 0.3; x < L; x += 0.35) rod(g, new V3(x, 0, w / 2), new V3(x, 0, -w / 2), 0.02, MT.steel, 4); secs.push(g); });
      const basket = grp(secs[2], 2.8, 0, 0); const bk = grp(basket); rbox(bk, 0.8, 0.08, 1.0, 0.02, MT.dark, 0.3, -0.5, 0, 0.01); rail(bk, [[-0.1, -0.45, 0.5], [-0.1, 0.4, 0.5], [0.7, 0.4, 0.5], [0.7, -0.45, 0.5]], 0.03, MT.white); rail(bk, [[-0.1, 0.4, -0.5], [0.7, 0.4, -0.5]], 0.03, MT.white);
      const ff = walker(bk, 0.3, 0, { top: 0x2a3550, bottom: 0x2a3550, hat: std(0xe8e8f0, 0.4, 0.3) }); ff.position.set(0.3, -0.45, 0); ff.scale.setScalar(0.85);
      // the cat stuck up in the tree, and the little girl waiting for it
      const treeP = new V3(-2.5, 0, 3.7); const tree = sakuraTree(S, treeP.x, treeP.z, 1.45);
      const catHome = new V3(treeP.x + 0.3, 4.15, treeP.z - 0.4);
      const cat = grp(S, catHome.x, catHome.y, catHome.z); const cm = std(0xf2a83a, 0.7, 0); sph(cat, 0.16, cm, 0, 0.12, 0).scale.set(0.22, 0.15, 0.16); sph(cat, 0.1, cm, 0.16, 0.24, 0);
      [0.05, -0.05].forEach((z) => add(cat, new THREE.ConeGeometry(0.035, 0.08, 4), cm, 0.17, 0.33, z)); rod(cat, new V3(-0.18, 0.12, 0), new V3(-0.3, 0.32, 0), 0.025, cm, 4);
      const girl = walker(S, -0.5, 3.3, { kid: true, top: 0xf07aa8 }); girl.rotation.y = Math.PI;
      part(st, 'echelle', 'la grande échelle', anchor(secs[1], 2, 0.4, 0), true);
      part(st, 'pompier', 'le pompier', anchor(ff, 0, 1.6, 0), false);
      part(st, 'chat', 'le petit chat', anchor(cat, 0, 0.6, 0), true);
      part(st, 'gyrophares', 'les gyrophares', anchor(m, 2.7, 3.3, 0.5), false);
      part(st, 'bequilles', 'les béquilles', anchor(legs[0].f, 0, 0.1, 0), false);
      st.focusAt = anchor(m, -1, 2.4, 1.6); st.size = { w: 13, h: 9 }; st.tagAt = anchor(m, 0, 4.6, 0);
      let T = 0;
      st.update = (dt) => { T += dt; roll(st, dt); lights.forEach((L, i) => (L.emissiveIntensity = st.siren && Math.sin(T * 12 + i * Math.PI) > 0 ? 2.2 : 0.2)); };
      const setLadder = (yaw, pitch, ext) => { turn.rotation.y = yaw; lift.rotation.z = pitch; secs[1].position.x = 0.4 + ext * 2.4; secs[2].position.x = 0.4 + ext * 2.3; basket.rotation.z = -pitch; };
      setLadder(0, 0, 0); let lad = [0, 0, 0];
      const ladderTo = (y, p, e, d) => { const a = lad.slice(); lad = [y, p, e]; return tw(d, (k) => setLadder(a[0] + (y - a[0]) * k, a[1] + (p - a[1]) * k, a[2] + (e - a[2]) * k), easeSine); };
      st.action = async function () {
        if (st.done) { m.position.x = START; st.lastX = START; S.attach(cat); cat.position.copy(catHome); cat.rotation.set(0, 0, 0); pop(m, 0.4); st.done = false; }
        engineOn(60); st.siren = true;
        const siren = setInterval(() => { tone(740, 0, 0.32, 'triangle', 0.05); tone(587, 0.36, 0.32, 'triangle', 0.05); }, 760);
        await Promise.all([step('Pin-pon ! Les pompiers arrivent. Un petit chat est coincé dans l’arbre !', 'chat'), to(m.position, 'x', STOP, 4, (k) => 1 - Math.pow(1 - k, 2))]);
        clearInterval(siren); st.siren = false;
        await Promise.all([step('Les béquilles se posent pour que le camion reste bien droit.', 'bequilles'), ...legs.map((l) => Promise.all([to(l.a.scale, 'z', 1, 1), to(l.f.position, 'y', 0, 1)]))]);
        S.updateMatrixWorld(true);
        const cw = cat.getWorldPosition(new V3()); const loc = turn.parent.worldToLocal(cw.clone()), tl = turn.position;
        const dx = loc.x - tl.x, dz = loc.z - tl.z, yaw = Math.atan2(-dz, dx), R = Math.hypot(dx, dz) - 0.5, Hh = loc.y - tl.y - 0.45 + 0.2;
        const pitch = Math.atan2(Hh, R), L = Math.hypot(R, Hh), ext = clamp((L - 3.6) / 4.7, 0, 1);
        await Promise.all([step("La grande échelle tourne, se lève et s'allonge...", 'echelle'), ladderTo(yaw, pitch, ext, 4)]);
        await Promise.all([step('Le pompier attrape le petit chat. Miaou !', 'pompier'), tw(0.8, (k) => (ff.userData.arms[0].rotation.z = k * 1.4))]);
        bk.attach(cat); ding();
        await Promise.all([step("On redescend tout doucement. Le chat est sauvé !", 'chat'), ladderTo(yaw, 0.12, 0, 3.4), to(ff.userData.arms[0].rotation, 'z', 0, 1)]);
        S.attach(cat); const c0 = cat.position.clone(), c1 = new V3(-0.2, 0, 2.9);
        await Promise.all([step('Il le rend à la petite fille. Merci les pompiers !', 'chat'), tw(1.2, (k) => cat.position.set(c0.x + (c1.x - c0.x) * k, c0.y + (c1.y - c0.y) * k + Math.sin(k * Math.PI) * 0.6, c0.z + (c1.z - c0.z) * k), easeSine)]);
        await Promise.all([ladderTo(0, 0, 0, 2), ...legs.map((l) => Promise.all([to(l.a.scale, 'z', 0.3, 1), to(l.f.position, 'y', 0.4, 1)]))]);
        chime(); st.done = true;
      };
    })();

    /* ---- bateau-bus ---- */
    (function () {
      const st = makeStation('bateau'), S = st.g, START = -7, STOP = 2;
      // the wooden pier on the north bank
      const pier = grp(S, STOP, 0, -2.45); rbox(pier, 3.4, 0.14, 1.2, 0.03, std(0x8a5a3a, 0.8, 0), 0, 0.32, 0, 0.01); [-1.5, 0, 1.5].forEach((x) => cylY(pier, 0.08, 0.6, VM.woodD, x, 0.1, 0.5, 6)); lanternPost(pier, 1.5, -0.4);
      const m = grp(S, START, 0.02, 0.2); st.m = m;
      ext(m, [[-3.0, 0.0], [2.4, 0.0], [3.1, 0.35], [3.2, 0.62], [-3.1, 0.62]], [0.08, 0.15, 0.2, 0.08, 0.08], 1.8, VM.white, 0, 0, 0, 0.04);
      rbox(m, 6.2, 0.12, 1.84, 0.04, VM.blue, -0.05, 0.3, 0, 0.01);
      const cab = grp(m, -0.4, 0.62, 0); rbox(cab, 4.0, 0.1, 1.6, 0.03, VM.white, 0, 0.05, 0, 0.01); [[1.9, 0.75], [1.9, -0.75], [-1.9, 0.75], [-1.9, -0.75], [0, 0.75], [0, -0.75]].forEach(([x, z]) => rbox(cab, 0.07, 1.0, 0.07, 0.02, VM.white, x, 0.55, z, 0.01));
      box(cab, 3.8, 0.7, 1.52, MT.glass, 0, 0.55, 0); rbox(cab, 4.2, 0.14, 1.75, 0.06, VM.blue, 0, 1.1, 0, 0.02);
      const flag = grp(m, -3.0, 0.6, 0); rod(flag, new V3(0, 0, 0), new V3(0, 1.4, 0), 0.025, MT.dark); rbox(flag, 0.5, 0.32, 0.02, 0.01, VM.cab, 0.27, 1.22, 0, 0.005);
      const capt = walker(cab, 1.3, 0, { top: 0xffffff, bottom: 0x2a3550 }); capt.position.set(1.3, 0.1, 0); capt.scale.setScalar(0.8);
      const riders = [[1.2, -3.2], [2.0, -3.4], [2.8, -3.1]].map(([x, z], i) => { const p = walker(S, x, z, { kid: i === 1 }); p.position.y = 0.38; p.rotation.y = Math.PI / 2; return p; });
      const rHome = riders.map((r) => r.position.clone());
      part(st, 'bateau', 'le bateau-bus', anchor(m, 0, 2.2, 0), true);
      part(st, 'ponton', 'le ponton', anchor(pier, 0, 0.9, -0.3), true);
      part(st, 'passagers', 'les passagers', anchor(S, 2, 2.0, -3.3), false);
      part(st, 'capitaine', 'le capitaine', anchor(cab, 1.3, 1.6, 0), false);
      st.focusAt = anchor(m, 0, 1, -0.6); st.size = { w: 13, h: 6 }; st.tagAt = anchor(m, 0, 2.8, 0);
      let wake = 0;
      st.update = (dt) => { if (st.moving) { wake -= dt; if (wake <= 0) { wake = 0.08; const s = Math.cos(m.rotation.y) > 0 ? -3.1 : 3.1; fx.smoke(m.localToWorld(new V3(s, 0.1, rnd(-0.6, 0.6))), new V3(0, 0.2, 0), rnd(0.15, 0.3), 0xf4f8ff, 0.9); } m.position.y = 0.02 + Math.sin(performance.now() / 300) * 0.03; } };
      st.action = async function () {
        if (st.done) { m.position.x = START; m.rotation.y = 0; riders.forEach((r, i) => { r.position.copy(rHome[i]); r.visible = true; }); st.done = false; }
        engineOn(70); st.moving = true;
        await Promise.all([step('Le bateau-bus arrive en glissant sur la rivière.', 'bateau'), to(m.position, 'x', STOP, 5, (k) => 1 - Math.pow(1 - k, 2))]);
        st.moving = false; ding();
        await step('Il s’arrête au ponton. Les passagers montent à bord.', 'passagers');
        for (let i = 0; i < riders.length; i++) { const r = riders[i], p0 = r.position.clone(); await tw(0.8, (k) => r.position.set(p0.x, 0.38 + Math.sin(k * Math.PI) * 0.15, p0.z + (-0.6 - p0.z) * k), lin); r.visible = false; }
        await Promise.all([step('Le capitaine fait demi-tour...', 'capitaine'), to(m.rotation, 'y', Math.PI, 2.4, easeSine)]);
        st.moving = true;
        await Promise.all([step('...et le bateau repart sur l’eau. Au revoir !', 'bateau'), to(m.position, 'x', START, 5, easeIn)]);
        st.moving = false; st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the town ================= */
const TM = { water: std(0x4f8fe0, 0.15, 0.2), bank: std(0xb9b2cc, 0.9, 0), red: std(0xd8402a, 0.5, 0.1), deck: std(0x8a8ea0, 0.8, 0), hall: std(0xeef0f6, 0.6, 0.05) };
function placeQ(o, h, d, yaw = YAW) { const [x, z] = Q(h, d); o.position.set(x, o.position.y, z); o.rotation.y = yaw; return o; }
function at(p, h, d, yaw = YAW) { const g = grp(p); return placeQ(g, h, d, yaw); }
function H(p, h, d, face, o = {}) { const [x, z] = Q(h, d); return house(p, x, z, FACE[face], { w: 3.0, d: 2.4, h: rnd(1.6, 2.1), roof: Math.random() < 0.3 ? VM.roofRed : VM.slate, ...o }); }
function T(p, h, d, w, ht) { const [x, z] = Q(h, d); return tower(p, x, z, YAW, w, w, ht); }
function sak(p, h, d, s = 0.9) { const [x, z] = Q(h, d); return sakuraTree(p, x, z, s); }
function lan(p, h, d) { const [x, z] = Q(h, d); return lanternPost(p, x, z); }
function carBridge(p, h) {
  const g = at(p, h, 4, YAWF); rbox(g, 8.4, 0.2, 4.6, 0.04, TM.deck, 0, 0.1, 0, 0.02);
  [2.4, -2.4].forEach((z) => { rbox(g, 8.6, 0.55, 0.22, 0.06, TM.hall, 0, 0.45, z, 0.02); [-4.3, 4.3].forEach((x) => cylY(g, 0.18, 1.0, TM.red, x, 0.5, z, 10)); });
  shadows(g); return g;
}
function footBridge(p, h) {
  const g = at(p, h, 4, YAWF); rbox(g, 7.6, 0.22, 1.6, 0.05, std(0x8a5a3a, 0.8, 0), 0, 0.12, 0, 0.02);
  [0.8, -0.8].forEach((z) => { rail(g, [[-3.8, 0.2, z], [-1.5, 0.95, z], [1.5, 0.95, z], [3.8, 0.2, z]], 0.06, TM.red); for (let x = -3; x <= 3; x += 1.5) rod(g, new V3(x, 0.2, z), new V3(x, 0.85 - Math.abs(x) * 0.05, z), 0.04, TM.red, 6); });
  shadows(g); return g;
}
function duck(p) {
  const g = grp(p); const w = std(0xffffff, 0.6, 0);
  sph(g, 0.28, w, 0, 0.18, 0).scale.set(0.32, 0.2, 0.22); sph(g, 0.14, w, 0.22, 0.38, 0);
  add(g, new THREE.ConeGeometry(0.06, 0.14, 6), std(0xf2a81e, 0.6, 0), 0.36, 0.37, 0).rotation.z = -Math.PI / 2;
  [0.05, -0.05].forEach((z) => sph(g, 0.02, MT.black, 0.3, 0.42, z));
  shadows(g); return g;
}

function buildTown(scene, onUpdate) {
  // Mount Fuji far behind the island
  { const f = grp(scene, -62, 0, -62); add(f, new THREE.ConeGeometry(34, 26, 28), std(0x5a6aa8, 0.9, 0), 0, 13, 0); add(f, new THREE.ConeGeometry(11.5, 8.8, 28), std(0xf4f6fb, 0.6, 0), 0, 21.6, 0); }
  // the river: water, stone banks, bridges, cherry trees and lanterns along the promenades
  { const g = at(scene, -10, 4); box(g, 76, 0.06, 5, TM.water, 0, 0.03, 0); [2.55, -2.55].forEach((z) => rbox(g, 76, 0.3, 0.25, 0.05, TM.bank, 0, 0.15, z, 0.02)); }
  [-22, -2].forEach((h) => carBridge(scene, h)); { const g = at(scene, 10, 4, YAWF); [2.4, -2.4].forEach((z) => { rbox(g, 7.0, 0.5, 0.2, 0.05, TM.hall, 0, 0.35, z, 0.02); }); shadows(g); }
  [-14, 4].forEach((h) => footBridge(scene, h));
  for (let h = -44; h <= 24; h += 4.5) { if ([-22, -14, -2, 4, 10].some((b) => Math.abs(b - h) < 3)) continue; sak(scene, h, -0.3, rnd(0.75, 0.95)); sak(scene, h + 2, 8.3, rnd(0.75, 0.95)); }
  [-30, -18, -7, 15, 21].forEach((h) => { lan(scene, h, 0.2); lan(scene, h + 1.5, 7.8); });
  // avenue and market street: lamp posts
  for (let h = -40; h <= 20; h += 8) { const [x, z] = Q(h, -9.2); lamp(scene, x, z, YAW - Math.PI / 2); }
  for (let h = -20; h <= 40; h += 8) { const [x, z] = Q(h, 12.9); lamp(scene, x, z, YAW + Math.PI / 2); }
  // the tram line goes on to the left of the station
  { const g = at(scene, -33, -17); rbox(g, 26, 0.05, 3.6, 0.02, 0x8a8ea0, 0, 0.03, 0, 0.01); railTrack(g, -13, 13, 0, { gauge: 0.7, sleepers: false }); }
  // the station hall under the viaduct
  { const g = at(scene, 4, -22); rbox(g, 10, 3.0, 2.6, 0.08, TM.hall, 0, 1.5, 0, 0.02); box(g, 6, 2.0, 0.06, MT.glassD, 0, 1.2, 1.31); rbox(g, 3.4, 0.6, 0.12, 0.04, VM.blue, 0, 2.6, 1.36, 0.02); shadows(g); }
  // downtown towers behind the viaduct
  [[-24, -31, 3, 9], [-18.5, -33, 3.4, 13], [-13, -31.5, 3, 8], [-7, -34, 3.6, 15], [-1, -32, 3, 10], [10, -33, 3.6, 14], [16, -31, 3, 9], [22, -33, 3.2, 12], [27.5, -29, 2.8, 8]].forEach(([h, d, w, ht]) => T(scene, h, d, w, ht));
  // block between the avenue and the river
  [-18, -14.6, -11.2, -7.8].forEach((h, i) => { H(scene, h, -6.9, 'back', { shop: i % 2 === 0 }); H(scene, h, -1.7, 'front'); });
  H(scene, 3.4, -6.9, 'back', { shop: true }); H(scene, 3.4, -1.7, 'front');
  H(scene, 20, -7, 'back', { shop: true }); H(scene, 23.4, -7, 'back');
  // block between the river and the market street
  [-18, -14.6, -11.2, -7.8].forEach((h) => H(scene, h, 11.2, 'front', { shop: true }));
  H(scene, 3.4, 11.2, 'front', { shop: true }); [15, 18.4, 21.8].forEach((h) => H(scene, h, 11.2, 'front', { shop: Math.random() < 0.6 }));
  // shops facing the market street, the park with its torii
  [-19, -15.6, -12.2, -8.8, -5.4, 0, 3.4].forEach((h, i) => H(scene, h, 20.5, 'back', { shop: i % 3 !== 1 }));
  [14.5, 18].forEach((h) => H(scene, h, 20.5, 'back', { shop: true }));
  { const [x, z] = Q(31, 22.4); torii(scene, x, z, YAW, 1.1); }
  [[24, 23], [30, 24.5], [26.5, 26.5], [33, 21.5], [22.5, 26]].forEach(([h, d]) => sak(scene, h, d, rnd(0.9, 1.15)));
  [[25.5, 20.5], [28.5, 20.5]].forEach(([h, d]) => lan(scene, h, d));
  // left side of town: houses along the side street, pines
  [-7, -3.5, 10, 13].forEach((d) => H(scene, -26.4, d, 'right'));
  [[-35, 10], [-30, 14], [-36, -2], [-33, 24], [-28, 27]].forEach(([h, d]) => { const [x, z] = Q(h, d); pine(scene, x, z, rnd(1, 1.4)); });
  [[-30, 18, 'front'], [-26, 22.5, 'front'], [-34, 16, 'front']].forEach(([h, d, f]) => H(scene, h, d, f));
  [[-30, -14], [-36, -10], [-28, -20.5], [-34, -18]].forEach(([h, d]) => sak(scene, h, d, 1));
  // vending machines and lanterns here and there
  [[-9.6, 13], [1.6, 13], [12.6, 13], [-6.3, -8.8]].forEach(([h, d]) => { const [x, z] = Q(h, d); vending(scene, x, z, YAW + Math.PI); });
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  const R = (pts, t = 0.08) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // cars going round the block, one loop each way
  const inner = R([[-20.9, -10.4], [-3.1, -10.4], [-3.1, 14.4], [-20.9, 14.4]]), outer = R([[-23.1, -12.6], [-23.1, 16.6], [-0.9, 16.6], [-0.9, -12.6]]);
  const carsA = ['taxi', 'car', 'kei'].map((k) => miniCar(scene, k)), carsB = ['van', 'car', 'taxi', 'kei'].map((k) => miniCar(scene, k));
  all.push(...carsA, ...carsB);
  const t1 = traffic(inner, carsA, 3.6, { gap: 3.8 }), t2 = traffic(outer, carsB, 3.6, { gap: 3.8, offset: 7 });
  // people strolling along the river (over the little red bridges) and along the shops
  const river = R([[-14, 1], [4, 1], [4, 7], [-14, 7]], 0.05), market = R([[-19, 13], [-5, 13], [-5, 18], [-19, 18]], 0.05), park = R([[23.5, 21.2], [33, 21.6], [33, 25.5], [23.5, 25.8]], 0.3);
  const crowd = (n, kids) => Array.from({ length: n }, (_, i) => walker(scene, 0, 0, { kid: kids && i % 3 === 1 }));
  const pr = crowd(6, true), pm = crowd(5, true), pp = crowd(3, true); all.push(...pr, ...pm, ...pp);
  const w1 = traffic(river, pr, 1.1, { gap: 1.3 }), w2 = traffic(market, pm, 1.0, { gap: 1.3 }), w3 = traffic(park, pp, 0.8, { gap: 1.3 });
  // ducks on the river
  const pond = R([[-21, 3.2], [-15.5, 3.4], [-15.5, 4.8], [-21, 4.6]], 0.4);
  const ducks = [0, 1, 2].map(() => duck(scene)); const td = traffic(pond, ducks, 0.5, { gap: 0.6 });
  let T = 0;
  onUpdate((dt) => { T += dt; t1.update(dt, all); t2.update(dt, all); w1.update(dt, all); w2.update(dt, all); w3.update(dt, all); td.update(dt, ducks); ducks.forEach((d, i) => (d.position.y = Math.sin(T * 2 + i) * 0.03)); });
}
