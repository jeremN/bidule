// Le Chemin de fer — the French railway and what makes trains run behind the scenes: the TGV and its catenary,
// the wire train, a level crossing, a switch and its signal box, a freight train at the grain silo,
// a tamping machine, and an old steam engine on the turntable of a museum roundhouse.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, UB, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { beacon, worker } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { autumnTree, barn, farmhouse, roundBaleStack, fence } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';
import { RT, GA, RM, xsec, tgv, ter, fretLoco, containerWagon, carWagon, hopperWagon, coveredWagon, tankWagon, shunter, steamLoco, picasso, tamper, catenaryCar, PITCH } from '../kit/rail-kit.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
// the lines, in layout coordinates (h along the screen in the overview, d from the back to the front)
const D1 = -16.4, D2 = -11.9, DM = -14.15, DS = 4, DF = 16, DV = -48, VH = 8, CW = RT + 5.5;
const SLEEP0 = -59.675, SLEEPP = 0.65; // every sleeper of every line sits at SLEEP0 + i·SLEEPP

const W = {
  stone: std(0xe9dfc8, 0.85, 0), stoneD: std(0xc9b998, 0.85, 0), slate: std(0x4a5266, 0.6, 0.15), tile: std(0xc0583a, 0.75, 0), tileD: std(0xa04a32, 0.75, 0),
  iron: std(0x2f6b4a, 0.45, 0.4), zinc: std(0x9aa3ad, 0.45, 0.5), cream: std(0xf3ead2, 0.8, 0), ochre: std(0xe8c890, 0.8, 0), pink: std(0xecc8b4, 0.8, 0), white: std(0xf4f2ec, 0.8, 0),
  shutB: std(0x4f7fb8, 0.6, 0), shutG: std(0x5a8a5a, 0.6, 0), door: std(0x6b3b2a, 0.7, 0), platform: std(0xbdb6aa, 0.9, 0), asphalt: std(0x555a66, 0.9, 0),
  rail: std(0x6e6862, 0.55, 0.5), railHead: std(0xd0d4da, 0.22, 0.9), mast: std(0x9aa3ad, 0.45, 0.6), wire: std(0x3a3430, 0.5, 0.4), insul: RM.insul,
  concrete: std(0xb7b9c3, 0.9, 0), hill: std(0x6f9e4a, 0.95, 0), hillD: std(0x5a8a3e, 0.95, 0), dark: std(0x0c0e14, 1, 0), wood: std(0x8a6a48, 0.85, 0),
  red: std(0xd8302a, 0.45, 0.1), signBlue: std(0x1f4f9a, 0.5, 0.1), cow: std(0xf6f2ea, 0.75, 0), cowB: std(0x7a4a2a, 0.75, 0), pinkM: std(0xf0a8a0, 0.7, 0),
  horn: std(0xe8dcc0, 0.5, 0), black: std(0x1c1e24, 0.6, 0.2), leaf: [0x4f9a3a, 0x3f8a32, 0x6aaa4a], leafD: [0x2f6a2a, 0x3a7a32, 0x2a5a26],
  green: std(0x2f5a3a, 0.7, 0), yellow: std(0xf2c21c, 0.5, 0.1), orange: std(0xf08a1c, 0.5, 0.1)
};
const ballastTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#8a8478'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) { x.fillStyle = pick(['#6f6a62', '#a39d92', '#7c766c', '#b5aea2', '#5f5a53']); x.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
W.ballast = std(0xffffff, 0.95, 0, { map: ballastTex });
const glow = (c, i = 0.1) => std(0x2a2a30, 0.4, 0, { emissive: c, emissiveIntensity: i });

/* ---------------- tracks ---------------- */
/** Straight track along x, from x0 to x1 at z: ballast, rails; sleepers are pushed to `sl` (instanced later). */
function track(p, x0, x1, z, o = {}) {
  const y = o.y || 0, L = x1 - x0, xc = (x0 + x1) / 2;
  if (o.ballast !== false) xsec(p, [[-2.25, 0], [2.25, 0], [1.6, 0.3], [-1.6, 0.3]], 0.05, L, W.ballast, xc, y, z, 0.02);
  [1, -1].forEach((s) => { box(p, L, 0.075, 0.075, W.railHead, xc, y + RT - 0.04, z + s * GA); box(p, L, 0.1, 0.028, W.rail, xc, y + RT - 0.12, z + s * GA); box(p, L, 0.03, 0.15, W.rail, xc, y + RT - 0.175, z + s * GA); });
  if (o.sl) { const st = o.align === false ? x0 + 0.3 : SLEEP0 + Math.ceil((x0 - SLEEP0) / SLEEPP) * SLEEPP; for (let x = st; x < x1 - 0.1; x += SLEEPP) o.sl.push([x, y, z, o.col || 0xa7a49c, 0]); }
}
/** A straight piece between two points on the ground (rails, curved tracks). */
function seg(p, a, b, y, w, h, m) { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); const s = box(p, L + 0.02, h, w, m, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); s.rotation.y = Math.atan2(-dz, dx); return s; }
/** Rails (and optionally ballast and sleepers) along a polyline of [x, z] points. */
function polyTrack(p, pts, o = {}) {
  const n = pts.length, nrm = pts.map((q, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return [-dz / L, dx / L]; });
  const sides = o.sides || [1, -1];
  sides.forEach((s) => { const r = pts.map((q, i) => [q[0] + nrm[i][0] * s * GA, q[1] + nrm[i][1] * s * GA]); for (let i = 0; i < n - 1; i++) { seg(p, r[i], r[i + 1], RT - 0.04, 0.075, 0.075, W.railHead); seg(p, r[i], r[i + 1], RT - 0.14, 0.05, 0.14, W.rail); } });
  if (o.ballast) for (let i = 0; i < n - 1; i++) seg(p, pts[i], pts[i + 1], 0.13, 3.6, 0.26, W.ballast);
  if (o.sl) { let acc = 0; for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); while (acc < L) { const t = acc / L; o.sl.push([a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t, o.col || 0x6b4a33, Math.atan2(-(b[1] - a[1]), b[0] - a[0])]); acc += SLEEPP; } acc -= L; } }
}
function sleepers(p, sl) {
  return instanced(p, UB, sl.length, (i, d) => { const [x, y, z, c, r] = sl[i]; d.position.set(x, y + 0.36, z); d.rotation.set(0, r, 0); d.scale.set(0.26, 0.14, 2.5); return c; });
}
/** A wall with an arched opening at the bottom (tunnel portals, roundhouse doors), in the x/y plane, t thick along z. */
function archWall(p, Wd, H, ow, oh, rise, t, m, x, y, z) {
  const pts = [[-Wd / 2, 0], [-ow / 2, 0], [-ow / 2, oh]];
  for (let i = 1; i < 12; i++) { const a = Math.PI - (i / 12) * Math.PI; pts.push([Math.cos(a) * ow / 2, oh + Math.sin(a) * rise]); }
  pts.push([ow / 2, oh], [ow / 2, 0], [Wd / 2, 0], [Wd / 2, H], [-Wd / 2, H]);
  return ext(p, pts, 0, t, m, x, y, z, 0.02);
}
const spinAx = (axles, ds) => axles.forEach((a) => (a.rotation.z -= ds / a.userData.r));
/** Show only the cars that are out of the tunnels (between lo and hi along x). */
const carsVis = (cars, mx, lo, hi) => cars.forEach((c) => (c.o.visible = mx + c.x - c.half < hi && mx + c.x + c.half > lo));

/* ---------------- DATA ---------------- */
const DATA = {
  tgv: { short: 'Le TGV', full: 'Le TGV', verb: 'Partir', horn: 'horn',
    use: 'Un train à grande vitesse, qui emmène les voyageurs très loin, très vite.',
    how: 'Il roule à l’électricité. Son pantographe, sur le toit, frotte contre un fil tout en haut : la caténaire.' },
  caten: { short: 'La caténaire', full: 'Le train de la caténaire', verb: 'Réparer', horn: 'horn',
    use: 'Il répare les fils électriques au-dessus des rails.',
    how: 'Sa nacelle monte jusqu’au fil. Avant, on coupe le courant : les ouvriers travaillent sans danger.' },
  pn: { short: 'Le passage à niveau', full: 'Le passage à niveau', verb: 'Faire passer', horn: 'bell',
    use: 'C’est là où la route croise les rails.',
    how: 'Quand un train arrive, les feux clignotent et les barrières descendent. Les voitures attendent.' },
  aiguillage: { short: "L'aiguillage", full: "L'aiguillage", verb: 'Changer de voie', horn: 'horn',
    use: 'Il permet à un train de changer de voie.',
    how: 'Dans son poste, l’aiguilleur tire un levier. Les aiguilles glissent, et le train part sur l’autre voie.' },
  fret: { short: 'Le train de fret', full: 'Le train de marchandises', verb: 'Charger', horn: 'horn',
    use: 'Il transporte des conteneurs, des voitures et des céréales.',
    how: 'Une grosse locomotive tire tous les wagons. Au silo, on remplit les wagons de blé par le toit.' },
  bourreuse: { short: 'La bourreuse', full: 'La bourreuse', verb: 'Tasser', horn: 'horn',
    use: 'Elle répare la voie quand elle n’est plus bien droite.',
    how: 'Ses pioches plongent dans les cailloux sous les rails et vibrent, pour bien les tasser.' },
  vapeur: { short: 'La locomotive à vapeur', full: 'La locomotive à vapeur', verb: 'Tourner', horn: 'bell',
    use: 'Une très vieille locomotive, qui se repose au musée.',
    how: 'Un feu chauffe de l’eau. La vapeur pousse les pistons, et les bielles font tourner les roues.' }
};
const ORDER = ['tgv', 'caten', 'pn', 'aiguillage', 'fret', 'bourreuse', 'vapeur'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const TR = '<path d="M2 70H118" stroke="#6a6f7a" stroke-width="3"/>';
const ICONS = {
  tgv: TR + `<path d="M2 10H118" stroke="#3a3430" stroke-width="2"/><path d="M40 10l-10 9 10 7" fill="none" stroke="#5a5f6c" stroke-width="3" stroke-linejoin="round"/>
    <path d="M4 64V28h66q28 0 42 26l4 10z" fill="#f1f3f7" stroke="#c9ccd8" stroke-width="1.5"/><path d="M80 30q14 4 22 18H82z" fill="#2a3f58"/><rect x="4" y="54" width="108" height="4" fill="#a8183c"/>
    <rect class="g" x="10" y="36" width="12" height="8" rx="2"/><rect class="g" x="28" y="36" width="12" height="8" rx="2"/><rect class="g" x="46" y="36" width="12" height="8" rx="2"/><circle class="k" cx="20" cy="66" r="4"/><circle class="k" cx="34" cy="66" r="4"/><circle class="k" cx="86" cy="66" r="4"/><circle class="k" cx="100" cy="66" r="4"/>`,
  caten: TR + `<path d="M2 12H118" stroke="#3a3430" stroke-width="2"/><rect x="10" y="44" width="100" height="16" rx="3" fill="#f6c419"/><rect x="82" y="26" width="26" height="22" rx="3" fill="#f6c419"/><rect class="g" x="92" y="30" width="12" height="9" rx="2"/>
    <path d="M26 44l20-16M46 44L26 28" stroke="#d09a12" stroke-width="3"/><rect x="18" y="22" width="36" height="5" fill="#5a5f6c"/><circle cx="30" cy="16" r="3.5" fill="#f0c39a"/><rect x="27" y="18" width="6" height="5" fill="#ff8f1f"/><circle cx="42" cy="16" r="3.5" fill="#f0c39a"/><rect x="39" y="18" width="6" height="5" fill="#ff8f1f"/>
    <circle class="k" cx="30" cy="64" r="5"/><circle class="k" cx="90" cy="64" r="5"/>`,
  pn: GND + `<rect x="14" y="30" width="4" height="44" fill="#5a5f6c"/><path d="M6 14l20 12M26 14L6 26" stroke="#d8302a" stroke-width="6"/><path d="M6 14l20 12M26 14L6 26" stroke="#fff" stroke-width="3"/>
    <circle cx="10" cy="36" r="5" fill="#ff3a2a"/><circle cx="22" cy="36" r="5" fill="#3a1010"/><rect x="34" y="50" width="10" height="20" rx="2" fill="#c3c7cf"/><rect x="40" y="50" width="76" height="6" rx="3" fill="#fff" stroke="#d8302a" stroke-width="1"/>
    <path d="M52 50v6M68 50v6M84 50v6M100 50v6" stroke="#d8302a" stroke-width="6"/>`,
  aiguillage: `<path d="M4 70H116M4 62H116" stroke="#6a6f7a" stroke-width="3"/><path d="M40 62q30 0 50-22h26M40 70q34 0 56-22h20" fill="none" stroke="#6a6f7a" stroke-width="3"/>
    <rect x="8" y="22" width="22" height="26" fill="#c4502f"/><rect class="g" x="8" y="12" width="22" height="12"/><path d="M5 12l14-8 14 8z" fill="#4a5266"/><rect x="58" y="18" width="3" height="40" fill="#5a5f6c"/><rect x="53" y="8" width="13" height="18" rx="3" fill="#1c1e24"/><circle cx="59.5" cy="13" r="3" fill="#4ad06a"/><circle cx="59.5" cy="21" r="3" fill="#4a1a1a"/>
    <rect x="72" y="22" width="34" height="18" rx="3" fill="#e8622a"/><rect class="g" x="92" y="12" width="12" height="12" rx="2"/>`,
  fret: TR + `<rect x="6" y="30" width="44" height="30" rx="3" fill="#cfd2d8"/><rect x="6" y="44" width="44" height="14" fill="#2f8a46"/><rect class="g" x="40" y="34" width="8" height="8" rx="1"/><rect x="48" y="44" width="4" height="14" fill="#f2c21c"/>
    <rect x="56" y="28" width="28" height="28" fill="#c8402a"/><rect x="86" y="28" width="28" height="28" fill="#2f5fb0"/><rect x="54" y="56" width="62" height="5" fill="#26292f"/>
    <circle class="k" cx="16" cy="64" r="5"/><circle class="k" cx="40" cy="64" r="5"/><circle class="k" cx="64" cy="64" r="4"/><circle class="k" cx="106" cy="64" r="4"/>`,
  bourreuse: TR + `<rect x="6" y="40" width="108" height="10" rx="2" fill="#f6c419"/><path d="M90 40V22h18l6 18z" fill="#f6c419"/><rect class="g" x="94" y="26" width="12" height="9" rx="1"/><path d="M8 40V22h18v18z" fill="#f6c419"/><rect class="g" x="11" y="26" width="12" height="9" rx="1"/>
    <rect x="36" y="28" width="46" height="12" rx="2" fill="#f6c419"/><path d="M30 50v16M36 50v16M44 50v16M50 50v16" stroke="#26292f" stroke-width="3"/><circle cx="17" cy="19" r="3" fill="#ff8a1a"/><circle cx="100" cy="19" r="3" fill="#ff8a1a"/>`,
  vapeur: TR + `<path d="M84 22q-6-10 4-14t14-2q8-6 14 2" fill="#e8ecf2" stroke="#c9ccd8"/><rect x="82" y="22" width="9" height="12" fill="#1c1e24"/><rect x="30" y="32" width="72" height="20" rx="10" fill="#2e6b3a"/><rect x="92" y="32" width="14" height="22" rx="4" fill="#1c1e24"/>
    <rect x="8" y="22" width="26" height="34" rx="2" fill="#2e6b3a"/><rect class="g" x="13" y="27" width="11" height="10" rx="2"/><rect x="4" y="18" width="34" height="5" rx="2" fill="#1c1e24"/>
    <circle cx="44" cy="62" r="9" fill="#b8282a"/><circle cx="66" cy="62" r="9" fill="#b8282a"/><circle cx="88" cy="62" r="9" fill="#b8282a"/><path d="M44 60h44" stroke="#d6dde8" stroke-width="3"/>`
};

const CFG = {
  tgv: CF(0, D1), caten: CF(30, D2), pn: CF(-10, DS), aiguillage: CF(-34, 21), fret: CF(14, DF), bourreuse: CF(36, DS), vapeur: CF(-30, -27)
};

// painted ground
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes, along = 'h') => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: along === 'h' ? -Math.PI / 4 : Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 3, col = '#8a8678', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
rect(0, -34, 46, 7, '#cfc6b4'); blob(0, -40, 9, 'rgba(200,190,170,.6)');
road([[2, -40], [4, -50], [0, -62]], 2.6, '#4f8fe0', 0.95); blob(2, -46, 5, 'rgba(70,120,200,.5)');
rect(-34, 38, 30, 13, '#e3c25a', 1, '#cfa947'); rect(-30, 50, 20, 8, '#d9b84f', 0.9, '#c49e40');
rect(22, 34, 38, 15, '#9bd06e', 0.85); blob(26, 36, 8, 'rgba(120,180,80,.6)');
rect(30, -30, 24, 10, '#c9d86a', 0.7); rect(40, 24, 14, 6, '#e3c25a', 0.8, '#cfa947');
rect(0, -6, 124, 3.8, '#5a5e6a'); for (let h = -60; h < 60; h += 4) rect(h, -6, 1.8, 0.14, '#f3efe2', 0.85);
rect(-10, 20, 52, 5.6, '#5a5e6a', 1, null, 'd');
rect(0, DM, 132, 9.5, '#8d8578', 0.9); rect(0, DS, 128, 5, '#8d8578', 0.9); rect(29, DF, 66, 5, '#8d8578', 0.9);
rect(-34, 23, 38, 10, '#a39a8a', 0.8); blob(-32, -30, 11, 'rgba(170,160,140,.75)'); rect(-22, -28, 10, 4, '#a39a8a', 0.8);
rect(5, 10, 14, 7, '#b8b2a6', 0.9); rect(-34, 1.7, 14, 2.4, '#b8b2a6', 0.9);
blob(-12, 40, 8, 'rgba(200,190,170,.6)'); blob(32, -33, 7, 'rgba(200,190,170,.5)');

export default {
  id: 'rail', title: 'Le Chemin de fer', titleHtml: 'Le Chemin <span>de fer</span>',
  subtitle: 'Le TGV, le train de marchandises, l’aiguillage, le passage à niveau... et tous les engins qui font marcher les trains.',
  welcome: 'Bienvenue au chemin de fer ! Touche un train ou un engin pour voir comment il marche.',
  hint: 'Touche un train pour le découvrir.', backLabel: 'Tout le chemin de fer',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="18" height="19" rx="4"/><path d="M7 15h18M11 27l2-4M21 27l-2-4M9 27h14"/><circle cx="11.5" cy="19" r="1"/><circle cx="20.5" cy="19" r="1"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 60, tufts: false, outerColor: 0x163a22,
  forest: { dark: [0x1f4a2a, 0x2a5a32, 0x173a24, 0x24502c], bush: [0x4f9a3a, 0x3f8a32, 0x6aaa4a, 0x2f7a3a] },
  overview: { w: 100, h: 66, focus: [0, 3, -2] },
  ground: { base: ['#9cc464', '#7aa64c', '#557d3a'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 220); onUpdate((dt) => fx.update(dt));
    const L = grp(scene); L.rotation.y = YAW; freeze(buildLand(L));
    const LL = grp(scene); LL.rotation.y = YAW; // life, in layout coordinates
    const bake = (g) => { shadows(g); freeze(g); return g; };
    const puff = (p, n = 1, col = 0xe8ecf2, sz = 0.5, up = 1.2) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2))), new V3(rnd(-0.3, 0.3), up * rnd(0.8, 1.3), rnd(-0.3, 0.3)), sz * rnd(0.8, 1.2), col, rnd(1.4, 2.2)); };
    const whistle = () => { tone(1480, 0, 0.18, 'square', 0.03); tone(1480, 0.26, 0.5, 'square', 0.03); };
    const hornT = (f = 330) => { tone(f, 0, 0.6, 'sawtooth', 0.04); tone(f * 1.26, 0, 0.6, 'sawtooth', 0.03); };
    const suitcase = (p, col) => { const g = grp(p, -0.05, 0, -0.34); rbox(g, 0.36, 0.48, 0.2, 0.05, std(col, 0.5, 0.1), 0, 0.34, 0, 0.02); rod(g, new V3(0.1, 0.58, 0), new V3(0.18, 0.95, 0), 0.02, MT.black, 4); [0.12, -0.12].forEach((x) => cylZ(g, 0.04, 0.06, MT.black, x, 0.06, 0, 8)); return g; };
    const SKIN = [0xf2c8a0, 0xd9a47a, 0xb07a52, 0xf6d8bc, 0x8a5a3a], BAGS = [0xe5452c, 0x2f7de0, 0xf2b21c, 0x3aa46a, 0xa45ad8, 0xf07aa8];

    /* ---- le TGV ---- */
    (function () {
      const st = makeStation('tgv'), S = st.g;
      const T = tgv(S), m = T.g; m.position.y = RT; st.m = m; st.wheels = T.axles;
      const PU = CW - RT - 0.03 - 3.92, PD = T.panto.userData.min; T.panto.userData.set(PD); T.pantoB.userData.set(PD);
      const head = T.panto.userData.head, PX = 16.25 - 3.4;
      T.doors.forEach((d) => { d.userData.x0 = d.position.x; });
      const PAX = [[10.5, -3.5, 0.2], [8.0, -3.9, 0.9], [-8.2, -3.6, 0.5], [-10.4, -4.0, 0]];
      const pax = PAX.map(([x, z], i) => { const p = walker(S, x, z, { kid: i === 1, skin: pick(SKIN) }); p.position.y = 1.17; p.rotation.y = -Math.PI / 2; suitcase(p, BAGS[i]); return p; });
      const camA = anchor(S, 0, 2.6, -1.0);
      part(st, 'pantographe', 'le pantographe', anchor(head, 0, 0.15, 0.7), true);
      part(st, 'catenaire', 'la caténaire', anchor(S, PX + 3.2, CW + 0.1, 0.1), false);
      part(st, 'portes', 'les portes', anchor(T.T1.g, 4.15, 2.6, 1.5), false);
      part(st, 'voyageurs', 'les voyageurs', anchor(pax[0], 0, 1.7, 0), true);
      st.focusAt = camA; st.size = { w: 46, h: 14 }; st.tagAt = anchor(m, 0, 5.2, 0); st.el = 0.78;
      let sp = 0;
      st.update = (dt) => {
        roll(st, dt); carsVis(T.cars, m.position.x, -50.5, 50.5); camA.position.x = clamp(m.position.x * 0.6, -24, 24);
        if (st.spark) { sp -= dt; if (sp <= 0) { sp = 0.06; fx.fire(wp(head, 0.12), new V3(rnd(-1, 1), 1, rnd(-1, 1)), 1.5, 0.6, 0.07); } }
      };
      const doors = (open, dur = 1.0) => Promise.all(T.doors.map((d) => to(d.position, 'x', open ? d.userData.x0 - Math.sign(d.userData.x0) * 0.92 : d.userData.x0, dur)));
      const walk = (p, x1, z1, dur) => { const x0 = p.position.x, z0 = p.position.z; p.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); let ph = 0; return tw(dur, (k) => { p.position.x = x0 + (x1 - x0) * k; p.position.z = z0 + (z1 - z0) * k; ph += 0.25; p.userData.walk(ph); }, lin).then(() => p.userData.walk(0)); };
      const doorOf = (x) => (x > 0 ? 9.15 : -9.15);
      st.action = async function () {
        if (st.done) { m.position.x = 0; st.lastX = 0; pax.forEach((p, i) => { p.visible = true; p.position.set(PAX[i][0], 1.17, PAX[i][1]); p.rotation.y = -Math.PI / 2; }); st.done = false; }
        await Promise.all([step('Le TGV attend en gare. Les portes s’ouvrent, les voyageurs montent avec leurs valises.', 'voyageurs'), doors(true),
          ...pax.map((p, i) => sleep(0.4 + PAX[i][2]).then(() => walk(p, doorOf(p.position.x), -1.75, 1.8)).then(() => (p.visible = false)))]);
        await Promise.all([step('Les portes se ferment. Attention au départ !', 'portes'), doors(false), sleep(0.6).then(whistle)]);
        st.spark = true; ding();
        await Promise.all([step('Le pantographe se lève, et frotte contre le fil tout en haut : la caténaire. Elle donne l’électricité au train !', 'pantographe'),
          tw(2.2, (k) => T.panto.userData.set(PD + (PU - PD) * k), easeSine)]);
        await Promise.all([step('L’électricité fait tourner les moteurs. Le TGV accélère, très, très vite... et file dans le tunnel !', 'catenaire'),
          sleep(0.3).then(() => { engineOn(90); return to(m.position, 'x', 82, 5.5, easeIn); })]);
        st.spark = false; m.position.x = -82; st.lastX = -82; await sleep(0.8); st.spark = true;
        await Promise.all([step('Le voilà qui revient d’un grand voyage. Il ralentit... et s’arrête pile au quai.', 'pantographe'), to(m.position, 'x', 0, 6, (k) => 1 - Math.pow(1 - k, 2.6))]);
        engineOff(); chime(); st.spark = false;
        pax.forEach((p) => { p.visible = true; p.position.set(doorOf(p.position.x), 1.17, -1.75); });
        await Promise.all([step('Tout le monde descend ! Le pantographe se baisse : le TGV se repose.', 'voyageurs'), doors(true),
          tw(2, (k) => T.panto.userData.set(PU + (PD - PU) * k), easeSine),
          ...pax.map((p, i) => sleep(0.3 + PAX[i][2]).then(() => walk(p, PAX[i][0], PAX[i][1], 1.8)).then(() => (p.rotation.y = -Math.PI / 2)))]);
        await doors(false, 0.8);
        st.done = true;
      };
    })();

    /* ---- le train de la caténaire ---- */
    (function () {
      const st = makeStation('caten'), S = st.g;
      const C = catenaryCar(S), m = C.g; m.position.set(-10, RT, 0); st.m = m; st.lastX = -10; st.wheels = C.axles;
      beacon(st, m, 3.4, 4.06, 0.9); beacon(st, m, 4.8, 4.06, -0.9);
      const WX = 5.0, STOP = WX + 1.9, H0 = 0.3, H1 = CW - RT - 1.55 - C.floor;
      // the worn part on the wire, and the new one
      const old = grp(S, WX, CW, 0); rbox(old, 0.3, 0.22, 0.16, 0.04, std(0x6a4a32, 0.8, 0.2), 0, -0.05, 0, 0.01); cylY(old, 0.03, 0.4, std(0x6a4a32, 0.8, 0.2), 0, 0.25, 0, 6);
      const neu = grp(S, WX, CW, 0); rbox(neu, 0.3, 0.22, 0.16, 0.04, MT.chrome, 0, -0.05, 0, 0.01); cylY(neu, 0.03, 0.4, MT.chrome, 0, 0.25, 0, 6); rbox(neu, 0.1, 0.1, 0.2, 0.02, W.orange, 0.1, 0.02, 0, 0.01); neu.visible = false;
      const sign = grp(S, WX - 3, 0, -2.6); cylY(sign, 0.05, 1.6, MT.black, 0, 0.8, 0, 6); const lampC = glow(0x4ad06a, 0.2); rbox(sign, 0.5, 0.5, 0.06, 0.08, MT.black, 0, 1.8, 0, 0.01); cylZ(sign, 0.16, 0.05, lampC, 0, 1.8, 0.04, 14);
      part(st, 'nacelle', 'la nacelle', anchor(C.platform, 0, 1.3, 1.2), true);
      part(st, 'fil', 'le fil électrique', anchor(S, WX + 1.6, CW + 0.15, 0.2), true);
      part(st, 'ouvriers', 'les ouvriers', anchor(C.workers[0], 0, 1.5, 0), false);
      part(st, 'courant', 'le courant coupé', anchor(sign, 0, 2.2, 0), false);
      st.focus = new V3(0, 3.2, 0); st.size = { w: 24, h: 10 }; st.tagAt = anchor(m, 0, 5.0, 0);
      st.update = (dt) => roll(st, dt);
      const arms = (k) => C.workers.forEach((w) => w.userData.arms.forEach((a, i) => (a.rotation.z = k * (2.5 + i * 0.3))));
      st.action = async function () {
        if (st.done) { m.position.x = -10; st.lastX = -10; old.visible = true; old.scale.setScalar(1); neu.visible = false; lampC.emissiveIntensity = 0.2; lampC.color.setHex(0x4ad06a); lampC.emissive.setHex(0x4ad06a); pop(m, 0.5); st.done = false; }
        engineOn(70);
        await Promise.all([step('Le train de la caténaire arrive. Il vient réparer les fils électriques au-dessus des rails.', 'fil'), to(m.position, 'x', STOP, 5, easeSine)]);
        engineOff(); thud(); lampC.color.setHex(0xff3a2a); lampC.emissive.setHex(0xff3a2a); lampC.emissiveIntensity = 1.2;
        await Promise.all([step('D’abord, on coupe le courant dans le fil. Comme ça, il n’y a aucun danger pour les ouvriers !', 'courant'), sleep(1)]);
        engineOn(120);
        await Promise.all([step('La nacelle monte, monte... jusqu’au fil !', 'nacelle'), tw(4, (k) => C.setLift(H0 + (H1 - H0) * k), easeSine)]);
        engineOff();
        await Promise.all([step('Les ouvriers changent une vieille pièce usée, et serrent bien les boulons.', 'ouvriers'),
          tw(0.8, (k) => arms(k)), sleep(1.0).then(() => tw(0.6, (k) => old.scale.setScalar(Math.max(0.01, 1 - k)))).then(() => { old.visible = false; neu.visible = true; ding(); return pop(neu, 0.6); }).then(() => sleep(0.6)).then(ding)]);
        await tw(0.6, (k) => arms(1 - k));
        engineOn(120);
        await Promise.all([step('La nacelle redescend. On remet le courant : les trains peuvent repasser !', 'nacelle'), tw(3.5, (k) => C.setLift(H1 + (H0 - H1) * k), easeSine)]);
        lampC.color.setHex(0x4ad06a); lampC.emissive.setHex(0x4ad06a); lampC.emissiveIntensity = 0.2;
        engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le passage à niveau ---- */
    (function () {
      const st = makeStation('pn'), S = st.g, d = grp(S);
      // crossing deck, ramps
      rbox(d, 6, 0.2, 1.3, 0.03, W.concrete, 0, RT - 0.1, 0, 0.01);
      [1, -1].forEach((s) => { rbox(d, 6, RT, 1.5, 0.03, W.concrete, 0, RT / 2, s * 1.6, 0.01); for (let x = -2.5; x <= 2.5; x += 1.25) box(d, 0.03, 0.02, 1.4, std(0x8a8e98, 0.9, 0), x, RT + 0.005, s * 1.6); });
      xsec(d, [[-3.8, 0], [-2.35, 0], [-2.35, RT]], 0, 6, W.asphalt, 0, 0, 0, 0.01); xsec(d, [[2.35, 0], [3.8, 0], [2.35, RT]], 0, 6, W.asphalt, 0, 0, 0, 0.01);
      [1, -1].forEach((s) => { box(d, 0.15, 0.02, 2.6, std(0xf3efe2, 0.8, 0), s * 1.5 * 0, 0.02, s * 7.5); box(d, 3.0, 0.02, 0.25, std(0xf3efe2, 0.8, 0), s * 1.5, 0.02, s * 5.6); });
      // the two half-barriers and the two signal posts
      const lamps = [glow(0xff3a2a, 0.05), glow(0xff3a2a, 0.05)], boomL = glow(0xff3a2a, 0.05);
      const barrier = (x, z, ry) => {
        const g = grp(S, x, 0, z); g.rotation.y = ry; const b = grp(g);
        rbox(b, 0.55, 1.1, 0.5, 0.05, RM.grey, 0, 0.55, 0, 0.02); rbox(b, 0.6, 0.06, 0.55, 0.02, RM.greyD, 0, 1.13, 0, 0.01); rbox(b, 0.7, 0.15, 0.7, 0.02, W.concrete, 0, 0.07, 0, 0.01);
        bake(b);
        const boom = grp(g, 0, 0.95, 0.3); rbox(boom, 3.9, 0.12, 0.08, 0.04, W.white, 2.0, 0, 0, 0.01);
        for (let i = 0; i < 4; i++) box(boom, 0.45, 0.125, 0.085, W.red, 0.5 + i * 0.95, 0, 0);
        [1.4, 2.6, 3.8].forEach((xx) => sph(boom, 0.06, boomL, xx, 0.1, 0));
        rbox(boom, 0.6, 0.3, 0.12, 0.04, MT.black, -0.35, 0, 0, 0.01);
        boom.rotation.z = Math.PI / 2; return boom;
      };
      const post = (x, z, ry) => {
        const g = grp(S, x, 0, z); g.rotation.y = ry; const p = grp(g);
        cylY(p, 0.07, 3.3, W.white, 0, 1.65, 0, 8); rbox(p, 0.4, 0.15, 0.4, 0.02, W.concrete, 0, 0.07, 0, 0.01);
        [1, -1].forEach((s) => { const r = rbox(p, 1.4, 0.28, 0.03, 0.03, W.red, 0, 3.0, 0.06, 0.01); r.rotation.z = s * Math.PI / 4; const w = rbox(p, 1.25, 0.15, 0.035, 0.03, W.white, 0, 3.0, 0.08, 0.01); w.rotation.z = s * Math.PI / 4; });
        rbox(p, 1.0, 0.45, 0.06, 0.1, MT.black, 0, 2.15, 0.06, 0.01);
        bake(p);
        [0.27, -0.27].forEach((xx, i) => { cylZ(g, 0.15, 0.06, lamps[i], xx, 2.15, 0.11, 14); const v = add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.2, 14, 1, true, -Math.PI / 2, Math.PI), MT.black, xx, 2.2, 0.2); v.rotation.x = Math.PI / 2; v.rotation.y = 0; });
        return g;
      };
      const boomA = barrier(3.5, 3.4, Math.PI), boomB = barrier(-3.5, -3.4, 0);
      const postA = post(4.4, 4.3, 0), postB = post(-4.4, -4.3, Math.PI); void postB;
      // waiting cars
      const CARS = [['car', 0xe5452c, 1.45, 13, -1], ['van', 0xf2f2f6, 1.45, 17.5, -1], ['car', 0x2f7de0, -1.45, -7.6, 1]];
      const rampY = (z) => { const a = Math.abs(z); return a < 2.35 ? RT : a < 3.8 ? (RT * (3.8 - a)) / 1.45 : 0; };
      const cars = CARS.map(([k, c, x, z, dir]) => { const o = miniCar(S, k, c); o.position.set(x, 0, z); o.rotation.y = -dir * Math.PI / 2; o.userData.z0 = z; o.userData.dir = dir; o.userData.pz = z; return o; });
      const T = ter(S), m = T.g; m.position.set(-24, RT, 0); st.m = m; st.lastX = -24; st.wheels = T.axles;
      part(st, 'barrieres', 'les barrières', anchor(boomA, 2.2, 0.3, 0), true);
      part(st, 'feux', 'les feux rouges', anchor(postA, 0, 2.4, 0.3), true);
      part(st, 'train', 'le train', anchor(T.cars[0].o, 0, 4.4, 0), false);
      part(st, 'voitures', 'les voitures', anchor(cars[0], 0, 1.6, 0), false);
      st.focus = new V3(-2, 2, 3); st.size = { w: 34, h: 15 }; st.tagAt = anchor(postA, 0, 4.0, 0);
      let T0 = 0, bellT = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt);
        const on = st.blink && Math.sin(T0 * 7) > 0; lamps[0].emissiveIntensity = st.blink ? (on ? 1.6 : 0.05) : 0.05; lamps[1].emissiveIntensity = st.blink ? (on ? 0.05 : 1.6) : 0.05; boomL.emissiveIntensity = st.blink ? (on ? 1.4 : 0.1) : 0.05;
        if (st.blink) { bellT -= dt; if (bellT <= 0) { bellT = 0.5; tone(1250, 0, 0.12, 'triangle', 0.05); } }
        cars.forEach((c) => { const dz = (c.position.z - c.userData.pz) * c.userData.dir; c.userData.pz = c.position.z; if (dz) c.userData.wheels.forEach((w) => (w.rotation.z -= dz / 0.24)); c.position.y = rampY(c.position.z); });
      };
      const drive = (c, z1, dur, e = easeSine) => to(c.position, 'z', z1, dur, e);
      st.action = async function () {
        if (st.done) { m.position.x = -24; st.lastX = -24; pop(m, 0.5); cars.forEach((c) => { c.position.z = c.userData.z0; c.userData.pz = c.userData.z0; pop(c, 0.4); }); st.done = false; await sleep(0.5); }
        st.blink = true;
        await Promise.all([step('Un train approche ! Ding, ding, ding : les feux rouges clignotent.', 'feux'), to(m.position, 'x', -17, 3.5, easeSine),
          drive(cars[0], 6.3, 3.2), drive(cars[1], 10.0, 3.6), drive(cars[2], -6.3, 3.0)]);
        await Promise.all([step('Les barrières descendent. Les voitures s’arrêtent, et attendent.', 'barrieres'), to(boomA.rotation, 'z', 0, 2.6, easeSine), to(boomB.rotation, 'z', 0, 2.6, easeSine)]);
        hornT(392); engineOn(70);
        await Promise.all([step('Le train passe tranquillement sur le passage à niveau. Tuut, tuut !', 'train'), to(m.position, 'x', 18, 7, lin)]);
        engineOff(); st.blink = false;
        await Promise.all([step('Les barrières remontent, les feux s’éteignent. Les voitures peuvent repartir !', 'voitures'), to(boomA.rotation, 'z', Math.PI / 2, 2.4, easeSine), to(boomB.rotation, 'z', Math.PI / 2, 2.4, easeSine),
          sleep(2.0).then(() => Promise.all([drive(cars[0], -7.6, 3.6, easeIn), sleep(0.6).then(() => drive(cars[1], -4.6, 3.4, easeIn)), drive(cars[2], 16, 4, easeIn)]))]);
        chime(); st.done = true;
      };
    })();

    /* ---- l'aiguillage et le locotracteur ---- */
    (function () {
      const st = makeStation('aiguillage'), S = st.g, d = grp(S), sl = [];
      const zc = (x) => (x < -2 ? 0 : x > 12 ? 4.6 : 4.6 * (((x + 2) / 14) ** 2) * (3 - 2 * ((x + 2) / 14)));
      const PTS = []; for (let x = -19; x <= 17.51; x += 0.5) PTS.push([x, zc(x)]);
      const CUM = [0]; for (let i = 1; i < PTS.length; i++) CUM.push(CUM[i - 1] + Math.hypot(PTS[i][0] - PTS[i - 1][0], PTS[i][1] - PTS[i - 1][1]));
      const sAt = (x) => { const i = clamp(Math.floor((x + 19) / 0.5), 0, PTS.length - 2), t = (x - PTS[i][0]) / 0.5; return CUM[i] + (CUM[i + 1] - CUM[i]) * t; };
      const RD = route(PTS.map(([x, z]) => [x, z]), false, 0.5);
      track(d, -19, 17.5, 0, { sl, col: 0x6b4a33, align: false });
      polyTrack(d, PTS.filter(([x]) => x >= 1.0), { ballast: true, sl, col: 0x6b4a33 });
      // buffer stops
      [[17.6, 0], [17.6, 4.6]].forEach(([x, z]) => { const b = grp(d, x, 0, z); rbox(b, 0.5, 1.0, 2.6, 0.04, RM.frame, 0, 0.9, 0, 0.01); rbox(b, 0.12, 0.4, 2.8, 0.03, W.red, -0.3, 1.1, 0, 0.01); [0.88, -0.88].forEach((zz) => cylX(b, 0.2, 0.3, RM.frame, -0.4, 1.06, zz, 12)); rod(b, new V3(0.2, 1.3, 0), new V3(1.4, RT, 0), 0.08, RM.frame, 6); });
      // the point motor and the rods from the signal box
      rbox(d, 0.9, 0.38, 0.6, 0.05, RM.greyD, -2.9, 0.42, -2.0, 0.02);
      rail(d, [[-6.4, 0.25, -3.95], [-3.2, 0.25, -3.95], [-2.9, 0.25, -2.4]], 0.025, MT.steel); rail(d, [[-6.4, 0.18, -4.1], [-3.0, 0.18, -4.1], [-2.7, 0.18, -2.4]], 0.025, MT.steel);
      for (let x = -6.2; x < -3; x += 1.0) box(d, 0.06, 0.25, 0.4, W.wood, x, 0.12, -4.0);
      // signal box: brick ground floor, glazed cabin, hip roof, outside stairs, levers inside
      const PB = grp(d, -7.5, 0, -6.0);
      rbox(PB, 4.4, 2.6, 3.2, 0.05, MT.brick, 0, 1.3, 0, 0.02); rbox(PB, 4.6, 0.2, 3.4, 0.03, W.stoneD, 0, 2.7, 0, 0.01);
      [[2.15, 1.55], [2.15, -1.55], [-2.15, 1.55], [-2.15, -1.55]].forEach(([a, b]) => box(PB, 0.12, 2.0, 0.12, W.cream, a, 3.8, b));
      box(PB, 4.3, 0.12, 3.2, W.cream, 0, 3.22, 0); box(PB, 4.4, 0.12, 3.3, W.cream, 0, 4.82, 0);
      box(PB, 4.2, 1.5, 0.04, MT.glass, 0, 4.0, 1.55); box(PB, 0.04, 1.5, 3.0, MT.glass, 2.15, 4.0, 0); box(PB, 0.04, 1.5, 3.0, MT.glass, -2.15, 4.0, 0);
      for (let x = -1.4; x <= 1.4; x += 0.7) box(PB, 0.05, 1.5, 0.06, W.cream, x, 4.0, 1.56);
      box(PB, 4.3, 0.9, 0.06, W.cream, 0, 3.25 + 0.2, -1.56);
      { const r = add(PB, new THREE.ConeGeometry(3.4, 1.5, 4), W.slate, 0, 5.62, 0); r.rotation.y = Math.PI / 4; r.scale.set(1.0, 1, 0.78); }
      for (let i = 0; i < 9; i++) rbox(PB, 0.45, 0.1, 0.9, 0.02, W.stoneD, 2.55 + 0.22, 0.3 + i * 0.33, 1.4 - i * 0.35, 0.01);
      rail(PB, [[2.98, 0.3, 1.6], [2.98, 3.2, -1.2]], 0.03, MT.black);
      { const t = decal(PB, 'POSTE 1', 1.6, 0.4, '#ffffff', 0, 2.1, 1.62, '#1f4f9a'); void t; }
      for (let i = 0; i < 7; i++) { if (i === 3) continue; const x = -1.5 + i * 0.5; rod(PB, new V3(x, 3.25, 0.6), new V3(x + 0.1, 4.0, 0.6), 0.03, MT.steel, 6); sph(PB, 0.07, i % 2 ? W.red : W.signBlue, x + 0.1, 4.02, 0.6); }
      rbox(PB, 3.6, 0.3, 0.3, 0.03, RM.frame, 0, 3.4, 0.6, 0.01);
      bake(d);
      sleepers(S, sl);
      const lever = grp(PB, 0, 3.3, 0.6); rod(lever, new V3(0, 0, 0), new V3(0.1, 0.75, 0), 0.035, MT.steel, 6); sph(lever, 0.09, W.signBlue, 0.1, 0.78, 0); lever.rotation.z = 0.35;
      const man = walker(PB, 0.3, 0.2, { top: 0x2f4fa8, bottom: 0x2a3550 }); man.position.y = 3.28; man.rotation.y = -Math.PI / 2;
      // movable blades with their tie bars
      const blades = grp(S); [-GA + 0.08, GA - 0.22].forEach((z) => { box(blades, 4.6, 0.07, 0.06, W.railHead, -1.2, RT - 0.04, z); box(blades, 4.6, 0.1, 0.035, W.rail, -1.2, RT - 0.13, z); });
      [-3.2, -2.5].forEach((x) => box(blades, 0.06, 0.05, 2.0, MT.steel, x, RT - 0.17, -0.25)); box(blades, 0.06, 0.05, 0.6, MT.steel, -2.9, 0.45, -1.4);
      // the signal: a black target with a red and a green light
      const SG = grp(S, -6.5, 0, -2.7); cylY(SG, 0.08, 3.6, MT.black, 0, 1.8, 0, 8); rbox(SG, 0.5, 0.2, 0.5, 0.02, W.concrete, 0, 0.1, 0, 0.01);
      const sigHead = grp(SG, 0, 3.5, 0); sigHead.rotation.y = -0.7; rbox(sigHead, 0.7, 1.3, 0.12, 0.12, MT.black, 0, 0, 0, 0.02); rbox(sigHead, 0.78, 1.38, 0.08, 0.14, W.white, 0, 0, -0.04, 0.02);
      const sigG = glow(0x4ad06a, 0.05), sigR = glow(0xff3a2a, 1.4); cylZ(sigHead, 0.16, 0.06, sigG, 0, 0.3, 0.07, 14); cylZ(sigHead, 0.16, 0.06, sigR, 0, -0.3, 0.07, 14);
      // the shunter, its wagon, and the wagons waiting on the other track
      const SH = shunter(S), loco = SH.g; const TK = tankWagon(S, 0), wag = TK.g;
      const parked = coveredWagon(S, 0).g;
      const sP = sAt(13.4), sW1 = sP - PITCH, sL1 = sW1 - 8.31, L0 = 3.5, W0 = L0 + 8.31;
      placeOn(parked, RD, sP, RT);
      let sL = L0, sWg = W0; const setS = (a, b) => { spinAx(SH.axles, a - sL); spinAx(TK.axles, b - sWg); sL = a; sWg = b; placeOn(loco, RD, a, RT); placeOn(wag, RD, b, RT); };
      setS(L0, W0);
      part(st, 'aiguilles', 'les aiguilles', anchor(blades, -1.6, RT + 0.1, 0.1), true);
      part(st, 'poste', "le poste d'aiguillage", anchor(PB, 0, 5.4, 0.5), true);
      part(st, 'signal', 'le signal', anchor(sigHead, 0, 0.9, 0), false);
      part(st, 'locotracteur', 'le locotracteur', anchor(loco, 0, 4.2, 0), false);
      st.m = loco; st.focus = new V3(2, 2.5, 0.5); st.size = { w: 30, h: 13 }; st.tagAt = anchor(loco, 0, 4.6, 0); st.el = 0.72;
      let ex = 0;
      st.update = (dt) => { if (st.moving) { ex -= dt; if (ex <= 0) { ex = 0.18; puff(loco.localToWorld(SH.exhaust.clone()), 1, 0x8a8e98, 0.3, 1.4); } } };
      const signal = (green) => { sigG.emissiveIntensity = green ? 1.6 : 0.05; sigR.emissiveIntensity = green ? 0.05 : 1.4; };
      st.action = async function () {
        if (st.done) { blades.position.z = 0; lever.rotation.z = 0.35; signal(false); sL = L0; sWg = W0; setS(L0, W0); pop(wag, 0.5); st.done = false; await sleep(0.5); }
        engineOn(60); st.moving = true;
        await Promise.all([step('Le petit locotracteur pousse un wagon-citerne dans la gare de triage.', 'locotracteur'), tw(3, (k) => setS(L0 + 3.2 * k, W0 + 3.2 * k), easeSine)]);
        st.moving = false; engineOff();
        await Promise.all([step('Il doit aller sur l’autre voie ! Dans son poste, l’aiguilleur tire un grand levier.', 'poste'), to(lever.rotation, 'z', -0.45, 1.4, easeSine), sleep(1.6)]);
        thud();
        await Promise.all([step('Clac ! Les aiguilles glissent sur le côté. Le signal passe au vert.', 'aiguilles'), to(blades.position, 'z', 0.14, 1.0, easeSine), sleep(1.1).then(() => { signal(true); ding(); })]);
        engineOn(60); st.moving = true;
        await Promise.all([step('Le wagon prend l’autre voie, et rejoint les autres wagons.', 'signal'), tw(6, (k) => setS(L0 + 3.2 + (sL1 - L0 - 3.2) * k, W0 + 3.2 + (sW1 - W0 - 3.2) * k), easeSine)]);
        thud();
        await Promise.all([step('Clac, il décroche le wagon, et repart chercher le suivant.', 'locotracteur'), tw(5, (k) => setS(sL1 + (L0 - sL1) * k, sW1), easeSine)]);
        st.moving = false; engineOff(); signal(false); chime(); st.done = true;
      };
    })();

    /* ---- le train de marchandises au silo ---- */
    (function () {
      const st = makeStation('fret'), S = st.g, d = grp(S);
      // buffer stop
      { const b = grp(d, -17.8, 0, 0); rbox(b, 0.5, 1.0, 2.6, 0.04, RM.frame, 0, 0.9, 0, 0.01); rbox(b, 0.12, 0.4, 2.8, 0.03, W.red, 0.3, 1.1, 0, 0.01); rod(b, new V3(-0.2, 1.3, 0), new V3(-1.4, RT, 0), 0.08, RM.frame, 6); }
      // the grain silo: three concrete cells, an elevator head, a ladder, a little office
      const SX = -9.0, SZ = -6.6;
      const SC = std(0xddd6c6, 0.9, 0);
      [-3, 0, 3].forEach((o) => { cylY(d, 1.55, 9, SC, SX + o, 4.5, SZ, 20); for (let y = 1.2; y < 9; y += 1.5) cylY(d, 1.57, 0.05, std(0xb8b0a0, 0.9, 0), SX + o, y, SZ, 20); });
      rbox(d, 9.6, 1.0, 3.2, 0.05, SC, SX, 9.4, SZ, 0.02); rbox(d, 3.0, 2.2, 2.6, 0.05, W.cream, SX - 1.5, 11.0, SZ, 0.02); xsec(d, [[-1.5, 0], [1.5, 0], [0, 0.8]], 0.05, 3.2, W.tile, SX - 1.5, 12.1, SZ, 0.02);
      rail(d, [[SX + 4.7, 0, SZ + 0.6], [SX + 4.7, 9.4, SZ + 0.6]], 0.03, MT.steel); rail(d, [[SX + 4.7, 0, SZ + 1.1], [SX + 4.7, 9.4, SZ + 1.1]], 0.03, MT.steel); for (let y = 0.4; y < 9.4; y += 0.4) rod(d, new V3(SX + 4.7, y, SZ + 0.6), new V3(SX + 4.7, y, SZ + 1.1), 0.015, MT.steel, 4);
      decal(d, 'COOPÉRATIVE', 5.2, 0.8, '#2f6b4a', SX, 6.4, SZ + 1.62);
      rbox(d, 4, 2.6, 3, 0.05, W.cream, SX + 9, 1.3, SZ - 0.5, 0.02); xsec(d, [[-1.8, 0], [1.8, 0], [0, 1.0]], 0.05, 4.4, W.tile, SX + 9, 2.6, SZ - 0.5, 0.02); rbox(d, 0.8, 1.6, 0.04, 0.03, W.door, SX + 9, 0.8, SZ + 1.02, 0.01); rbox(d, 1.0, 0.7, 0.04, 0.03, MT.glassD, SX + 10.3, 1.6, SZ + 1.02, 0.01);
      [[SX + 6.5, SZ - 1], [SX + 7.2, SZ + 0.4]].forEach(([x, z]) => { const b = add(d, new THREE.CylinderGeometry(0.6, 0.6, 1.1, 16), RM.cream, x, 0.55, z); void b; });
      bake(d);
      // the train: locomotive, container wagon, car carrier, two grain hoppers
      const XC = [12.25, 12.25 - PITCH, 12.25 - 2 * PITCH, 12.25 - 3 * PITCH];
      const wagons = [containerWagon(S, XC[0]), carWagon(S, XC[1]), hopperWagon(S, XC[2]), hopperWagon(S, XC[3])];
      wagons.forEach((w) => (w.g.position.y = RT));
      const F = fretLoco(S), loco = F.g; const LX0 = 29, LX1 = XC[0] + 4.245 + 6.395; loco.position.set(LX0, RT, 0); st.m = loco;
      const hops = [wagons[2], wagons[3]];
      // two spouts that swing down over the hoppers
      const spouts = hops.map((h) => { const sg = grp(S, h.g.position.x, 7.8, SZ + 1.4); cylZ(sg, 0.25, 0.5, RM.greyD, 0, 0, 0, 10); const pipe = grp(sg); cylZ(pipe, 0.16, 5.5, std(0x9aa0aa, 0.4, 0.6), 0, 0, 2.75, 12); cylZ(pipe, 0.24, 0.4, RM.greyD, 0, 0, 5.4, 12); sg.rotation.x = 0.05; sg.userData.tip = anchor(pipe, 0, 0, 5.6); return sg; });
      const all = [{ o: loco, ax: F.axles, half: 6.4 }, ...wagons.map((w) => ({ o: w.g, ax: w.axles, half: 4.25 }))];
      const home = all.map((c) => c.o.position.x);
      part(st, 'locomotive', 'la locomotive', anchor(loco, 0, 4.7, 0), true);
      part(st, 'silo', 'le silo à grains', anchor(S, SX + 3, 9.9, SZ + 1.4), true);
      part(st, 'conteneurs', 'les conteneurs', anchor(wagons[0].g, 0, 4.2, 1.2), false);
      part(st, 'cereales', 'le blé', anchor(hops[0].g, 0, 4.6, 0.8), false);
      st.focus = new V3(8, 4.5, -2); st.size = { w: 52, h: 17 }; st.tagAt = anchor(loco, 0, 5.4, 0);
      let ex = 0, gr = 0;
      st.update = (dt) => {
        all.forEach((c) => { const x = c.o.position.x, p = c.o.userData.px ?? x; if (x !== p) spinAx(c.ax, x - p); c.o.userData.px = x; c.o.visible = x - c.half < 46; });
        if (st.smoke) { ex -= dt; if (ex <= 0) { ex = st.smoke > 1 ? 0.07 : 0.2; puff(loco.localToWorld(F.exhaust.clone()), 1, 0x7a7e88, 0.4, 2); } }
        if (st.grain) { gr -= dt; if (gr <= 0) { gr = 0.04; spouts.forEach((s, i) => throwClod(wp(s.userData.tip), wp(hops[i].hatches[1], -0.6), rnd(0.08, 0.14), 0xe9b52f)); } }
      };
      st.action = async function () {
        if (st.done) { all.forEach((c, i) => { c.o.position.x = home[i]; c.o.userData.px = home[i]; c.o.visible = true; pop(c.o, 0.5); }); st.done = false; await sleep(0.6); }
        await Promise.all([step('Voici le train de marchandises. Ses wagons transportent des conteneurs, des voitures... et des céréales !', 'conteneurs'), sleep(2.5)]);
        engineOn(55); st.smoke = 1;
        await Promise.all([step('La locomotive recule tout doucement, et s’accroche aux wagons. Clac !', 'locomotive'), to(loco.position, 'x', LX1, 3.4, easeSine)]);
        thud(); engineOff();
        await Promise.all([step('Au silo, de grands tuyaux descendent, et versent le blé dans les wagons, par le toit.', 'silo'),
          ...hops.map((h) => Promise.all(h.hatches.map((ht) => to(ht.rotation, 'x', 1.9, 1.0)))), ...spouts.map((s) => to(s.rotation, 'x', 0.43, 2.0, easeSine))]);
        st.grain = true; await sleep(3.0); st.grain = false;
        await Promise.all([step('Les wagons sont pleins ! Les tuyaux remontent, les trappes se ferment.', 'cereales'),
          ...spouts.map((s) => to(s.rotation, 'x', 0.05, 1.8, easeSine)), sleep(0.8).then(() => Promise.all(hops.flatMap((h) => h.hatches.map((ht) => to(ht.rotation, 'x', 0, 0.9)))))]);
        hornT(262); engineOn(55); st.smoke = 2;
        const x0 = all.map((c) => c.o.position.x);
        await Promise.all([step('Tuuut ! La locomotive tire tous les wagons. En route pour livrer les marchandises !', 'locomotive'), tw(9, (k) => all.forEach((c, i) => (c.o.position.x = x0[i] + 70 * k)), easeIn)]);
        st.smoke = 0; engineOff(); st.done = true;
      };
    })();

    /* ---- la bourreuse ---- */
    (function () {
      const st = makeStation('bourreuse'), S = st.g;
      const T = tamper(S), m = T.g;
      const i0 = Math.round((28.1 - SLEEP0) / SLEEPP); const X0 = SLEEP0 + i0 * SLEEPP - 36 + 3.0, REST = X0 - 4 * SLEEPP;
      m.position.set(REST, RT, 0); st.m = m; st.lastX = REST; st.wheels = T.axles;
      T.beacons.forEach((b) => beacon(st, m, b.x, b.y, b.z));
      const man = worker(S, X0 - 3.0, 3.4, Math.PI / 2); void man;
      part(st, 'bourroirs', 'les pioches', anchor(T.banks[0], 0, 0.4, 0.55), true);
      part(st, 'ballast', 'les cailloux du ballast', anchor(S, X0 - 1.5, 0.45, 1.9), false);
      part(st, 'traverse', 'la traverse', anchor(S, X0 - 3.0 + 0.0, 0.5, -1.3), false);
      part(st, 'cabine', 'la cabine', anchor(m, -6.5, 4.4, 0), true);
      st.focusAt = anchor(m, -1.5, 2.2, 0); st.size = { w: 22, h: 9 }; st.tagAt = anchor(m, 0, 5.2, 0); st.el = 0.75;
      let vib = 0;
      st.update = (dt) => { roll(st, dt); vib += dt * 60; T.banks.forEach((b) => (b.position.x = -3.0 + (st.vibe ? Math.sin(vib) * 0.03 : 0))); };
      const dust = () => T.banks.forEach((b) => { for (let i = 0; i < 2; i++) fx.smoke(wp(b, 0).add(new V3(rnd(-0.4, 0.4), 0.35, rnd(-0.4, 0.4))), new V3(rnd(-0.6, 0.6), rnd(0.4, 1), rnd(-0.6, 0.6)), rnd(0.2, 0.35), 0xa39d92, 1.0); });
      const cycle = async () => {
        await Promise.all(T.banks.map((b) => to(b.position, 'y', -0.75, 0.45, easeIn))); thud(); dust();
        st.vibe = true; tone(70, 0, 0.9, 'sawtooth', 0.05, 90);
        await tw(0.9, (k) => { const a = Math.sin(k * Math.PI) * 0.24; T.tines.forEach((t) => (t.rotation.z = -Math.sign(t.userData.xo) * a)); if (Math.random() < 0.3) dust(); }, lin);
        st.vibe = false;
        await Promise.all(T.banks.map((b) => to(b.position, 'y', 0, 0.4, easeSine)));
      };
      st.action = async function () {
        if (st.done) { st.reversing = true; engineOn(55); await Promise.all([step('La bourreuse recule un peu, pour recommencer.', 'cabine'), to(m.position, 'x', REST, 3)]); st.reversing = false; st.done = false; }
        engineOn(55);
        await Promise.all([step('La bourreuse arrive sur la voie. Ses gyrophares tournent : attention, on travaille !', 'cabine'), to(m.position, 'x', X0, 3.5, easeSine)]);
        await Promise.all([step('Avec tous les trains qui passent, les cailloux sous les rails bougent. La voie n’est plus bien droite.', 'ballast'), sleep(1.2)]);
        await Promise.all([step('Ses pioches plongent dans les cailloux et vibrent : brrr ! Elles tassent le ballast sous la traverse.', 'bourroirs'), cycle()]);
        await Promise.all([step('Elle avance d’une traverse, et elle recommence. Tac, brrr ! Tac, brrr !', 'traverse'), (async () => { for (let i = 1; i <= 3; i++) { await to(m.position, 'x', X0 + i * SLEEPP, 0.5, easeSine); await cycle(); } })()]);
        engineOff(); chime();
        await step('Voilà ! La voie est bien droite et solide. Les trains peuvent passer tranquillement.', 'ballast');
        st.done = true;
      };
    })();

    /* ---- la locomotive à vapeur et la plaque tournante ---- */
    (function () {
      const st = makeStation('vapeur'), S = st.g, d = grp(S), sl = [];
      const TR = 5.6, ANG = [67.5, 90, 112.5].map((a) => (a * Math.PI) / 180);
      // turntable pit: dark floor, stone coping, the circular rail
      add(d, new THREE.CircleGeometry(TR, 40), std(0x3a3630, 0.95, 0), 0, 0.04, 0).rotation.x = -Math.PI / 2;
      add(d, new THREE.RingGeometry(TR, TR + 0.5, 40), W.stoneD, 0, 0.16, 0).rotation.x = -Math.PI / 2;
      add(d, new THREE.CylinderGeometry(TR + 0.5, TR + 0.5, 0.16, 40, 1, true), W.stoneD, 0, 0.08, 0);
      add(d, new THREE.TorusGeometry(TR - 0.35, 0.05, 6, 48), W.railHead, 0, 0.12, 0).rotation.x = -Math.PI / 2;
      cylY(d, 0.6, 0.3, RM.frame, 0, 0.15, 0, 16);
      // the access track and the stall tracks
      track(d, TR + 0.4, 16, 0, { sl, col: 0x6b4a33, align: false });
      { const b = grp(d, 16.1, 0, 0); rbox(b, 0.4, 1.0, 2.4, 0.04, RM.frame, 0, 0.9, 0, 0.01); rbox(b, 0.12, 0.4, 2.6, 0.03, W.red, -0.25, 1.1, 0, 0.01); }
      ANG.forEach((a) => { const g = grp(d); g.rotation.y = a; track(g, TR + 0.4, 15.5, 0, { sl: null, ballast: false }); for (let x = TR + 0.6; x < 15.4; x += SLEEPP) box(g, 0.26, 0.14, 2.5, std(0x6b4a33, 0.9, 0), x, 0.36, 0); });
      // the roundhouse: three stalls with brick walls, arched doors, slate roofs and smoke vents
      const DG = std(0x2f5a3a, 0.7, 0);
      ANG.forEach((a, k) => {
        const g = grp(d); g.rotation.y = a; const R0 = 8.6, R1 = 16, h0 = R0 * Math.tan(Math.PI / 16), h1 = R1 * Math.tan(Math.PI / 16), H = 5.4;
        box(g, 0.4, H, 2 * h1 + 0.2, MT.brick, R1, H / 2, 0);
        [1, -1].forEach((s) => { const w = grp(g); w.rotation.y = -s * Math.PI / 16; box(w, R1 - R0 + 0.3, H, 0.35, MT.brick, (R0 + R1) / 2, H / 2, 0); });
        const fr = grp(g, R0, 0, 0); fr.rotation.y = Math.PI / 2; archWall(fr, 2 * h0 + 0.5, H, 3.0, 3.6, 1.0, 0.45, MT.brick, 0, 0, 0);
        rbox(fr, 2 * h0 + 0.7, 0.3, 0.6, 0.03, W.stoneD, 0, H + 0.1, 0, 0.01);
        extY(g, [[R0 - 0.5, -h0 - 0.4], [R1 + 0.4, -h1 - 0.4], [R1 + 0.4, h1 + 0.4], [R0 - 0.5, h0 + 0.4]], 0.05, 0.3, W.slate, 0, H + 0.15, 0, 0.03);
        rbox(g, 1.6, 0.7, 1.0, 0.05, W.slate, (R0 + R1) / 2, H + 0.85, 0, 0.02); cylY(g, 0.3, 1.2, RM.frame, (R0 + R1) / 2, H + 1.4, 0, 10);
        box(g, R1 - R0, 0.04, 1.2, std(0x22201c, 0.95, 0), (R0 + R1) / 2 + 0.3, 0.05, 0);
        if (k === 2) { const dd = grp(g, R0 + 0.3, 0, 0); rbox(dd, 0.12, 3.6, 2.9, 0.03, DG, 0, 1.8, 0, 0.01); box(dd, 0.14, 0.08, 2.9, RM.frame, 0, 1.0, 0); box(dd, 0.14, 0.08, 2.9, RM.frame, 0, 2.6, 0); }
        else [1, -1].forEach((s) => { const dd = grp(g, R0 - 0.25, 0, s * 1.5); dd.rotation.y = s * 1.9; rbox(dd, 0.1, 3.5, 1.45, 0.03, DG, 0, 1.75, -s * 0.72, 0.01); });
        if (k === 0) { const pc = picasso(g); pc.position.set(11.0, RT, 0); }
      });
      decal(d, 'MUSÉE', 2.0, 0.55, '#ffffff', 0, 5.0, -8.3, '#2f5a3a');
      bake(d);
      sleepers(S, sl);
      // the rotating bridge with its girders, deck, rails and railings, and the little hut
      const BR = grp(S), bd = grp(BR);
      [1, -1].forEach((s) => { rbox(bd, 2 * TR - 0.1, 0.6, 0.2, 0.04, DG, 0, 0.32, s * 1.05, 0.01); rail(bd, [[-TR + 0.2, 0.62, s * 1.55], [-TR + 0.2, 1.62, s * 1.55], [TR - 0.2, 1.62, s * 1.55], [TR - 0.2, 0.62, s * 1.55]], 0.03, MT.black); for (let x = -4; x <= 4; x += 2) rod(bd, new V3(x, 0.62, s * 1.55), new V3(x, 1.62, s * 1.55), 0.02, MT.black, 4); });
      for (let x = -TR + 0.4; x < TR - 0.2; x += SLEEPP) box(bd, 0.26, 0.12, 3.2, W.wood, x, 0.37, 0);
      track(bd, -TR + 0.05, TR - 0.05, 0, { ballast: false });
      [1, -1].forEach((e) => [1, -1].forEach((s) => cylZ(bd, 0.22, 0.12, RM.frame, e * (TR - 0.4), 0.18, s * 1.0, 12)));
      const hut = grp(bd, -TR + 0.9, 0.45, 1.95); rbox(hut, 1.1, 1.7, 0.9, 0.05, DG, 0, 0.85, 0, 0.02); rbox(hut, 1.3, 0.1, 1.1, 0.03, RM.frame, 0, 1.75, 0, 0.01); rbox(hut, 0.5, 0.5, 0.03, 0.03, MT.glassD, 0.1, 1.15, 0.46, 0.01);
      bake(bd);
      // the little steam engine
      const SL = steamLoco(S), loco = SL.g; const XL = 11.2; loco.position.set(XL, RT, 0); loco.rotation.y = Math.PI; st.m = loco;
      const smokeA = anchor(loco, SL.chimney.x, SL.chimney.y, 0);
      part(st, 'cheminee', 'la cheminée', anchor(loco, 3.35, 4.2, 0), false);
      part(st, 'bielles', 'les bielles', anchor(loco, 0, 0.7, -1.1), true);
      part(st, 'plaque', 'la plaque tournante', anchor(BR, -3, 1.2, -1.6), true);
      part(st, 'rotonde', 'la rotonde', anchor(S, 0, 6.6, -11), false);
      st.focus = new V3(3, 2.5, -4.5); st.size = { w: 32, h: 17 }; st.tagAt = anchor(loco, 0, 5, 0); st.el = 0.85;
      let run = 0, lastPuff = 0, T0 = 0;
      const setRun = (s) => { run = s; SL.setRun(s); if (s - lastPuff > 0.95) { lastPuff = s; puff(wp(smokeA), 2, 0xf2f4f8, 0.55, 2.2); tone(180, 0, 0.12, 'triangle', 0.05, 80); } };
      st.update = (dt) => { T0 += dt; if (st.fire) SL.fire.emissiveIntensity = 1.2 + Math.sin(T0 * 13) * 0.3; if (st.idle && Math.random() < dt * 4) puff(wp(smokeA), 1, 0xdfe2ec, 0.35, 1); };
      const toot = () => { tone(740, 0, 0.5, 'sine', 0.07); tone(932, 0, 0.5, 'sine', 0.05); tone(740, 0.6, 0.9, 'sine', 0.07); tone(932, 0.6, 0.9, 'sine', 0.05); };
      st.action = async function () {
        if (st.done) { S.attach(loco); BR.rotation.y = 0; loco.position.set(XL, RT, 0); loco.rotation.set(0, Math.PI, 0); run = 0; lastPuff = 0; SL.setRun(0); pop(loco, 0.6); st.done = false; await sleep(0.6); }
        st.fire = true; st.idle = true;
        await Promise.all([step('Au musée, une vieille locomotive se réveille. Dans sa cabine, un feu chauffe l’eau : ça fait de la vapeur !', 'cheminee'), sleep(2.6)]);
        toot(); st.idle = false;
        for (let i = 0; i < 6; i++) fx.smoke(loco.localToWorld(new V3(3.4, 0.65, (i % 2 ? 1 : -1) * 1.1)), new V3(0, 0.6, (i % 2 ? 1 : -1) * 1.2), 0.4, 0xffffff, 1.2);
        await Promise.all([step('La vapeur pousse les pistons, et les bielles font tourner les roues. Tchou, tchou !', 'bielles'),
          tw(6, (k) => { loco.position.x = XL - XL * k; setRun(XL * k); }, easeSine)]);
        BR.attach(loco);
        await Promise.all([step('Elle s’arrête sur la plaque tournante... qui tourne, avec la locomotive dessus !', 'plaque'), to(BR.rotation, 'y', -Math.PI / 2, 5, easeSine)]);
        const x0 = loco.position.x;
        await Promise.all([step('Elle rentre dans la rotonde, sa grande maison. Bonne nuit, la locomotive !', 'rotonde'), tw(5, (k) => { loco.position.x = x0 - 10.6 * k; setRun(XL + 10.6 * k); }, easeSine)]);
        toot(); st.fire = false; SL.fire.emissiveIntensity = 0.2; chime(); st.done = true;
      };
    })();

    buildLife(LL, onUpdate);
  }
};

/* ================= the land: tracks, catenary, station, village, viaduct, hills, farms ================= */
let CLOCK = null;
function buildLand(L) {
  const SL = [];
  // main line (two tracks, electrified), secondary line, freight siding, viaduct line
  track(L, -66, 66, D1, { sl: SL }); track(L, -66, 66, D2, { sl: SL });
  track(L, -64, 64, DS, { sl: SL }); track(L, -4, 64, DF, { sl: SL });
  // catenary: centre masts with a cantilever over each track, messenger wire with droppers, contact wire
  const msg = (h) => { const k = ((h % 10) + 10) % 10 / 10; return CW + 1.1 - 0.4 * Math.sin(Math.PI * k); };
  for (let h = -50; h <= 50; h += 10) {
    rbox(L, 0.8, 0.5, 0.8, 0.04, W.concrete, h, 0.25, DM, 0.02);
    [0.15, -0.15].forEach((o) => box(L, 0.05, 7.6, 0.34, W.mast, h + o, 4.3, DM)); box(L, 0.28, 7.6, 0.04, W.mast, h, 4.3, DM);
    [[D1, -1], [D2, 1]].forEach(([dt, s]) => {
      rod(L, new V3(h, CW + 1.2, DM), new V3(h, CW + 1.2, dt + s * 0.4), 0.04, W.mast, 6);
      rod(L, new V3(h, CW + 0.2, DM), new V3(h, CW + 1.15, dt + s * 0.35), 0.035, W.mast, 6);
      cylZ(L, 0.07, 0.35, W.insul, h, CW + 1.2, DM + s * 0.45, 8); cylZ(L, 0.07, 0.35, W.insul, h, CW + 0.25, DM + s * 0.45, 8);
      rod(L, new V3(h, CW + 0.55, dt + s * 0.25), new V3(h, CW + 0.02, dt), 0.025, W.mast, 4);
    });
  }
  [D1, D2].forEach((dt) => {
    rod(L, new V3(-66, CW, dt), new V3(66, CW, dt), 0.025, W.wire, 4);
    const pts = []; for (let h = -60; h <= 60; h += 2.5) pts.push([h, msg(h), dt]); rail(L, pts, 0.02, W.wire);
    for (let h = -58.75; h < 60; h += 2.5) rod(L, new V3(h, CW, dt), new V3(h, msg(h), dt), 0.01, W.wire, 3);
  });
  // tunnels for the main line, in two hills
  [1, -1].forEach((e) => {
    const hl = add(L, new THREE.SphereGeometry(1, 32, 18), W.hill, e * 62, 0, DM); hl.scale.set(13, 10.5, 17);
    const g = grp(L, e * 49.6, 0, DM); g.rotation.y = e > 0 ? -Math.PI / 2 : Math.PI / 2;
    archWall(g, 13.5, 10.2, 9.6, 6.0, 2.6, 1.4, W.stoneD, 0, 0, 0); rbox(g, 14, 0.5, 1.8, 0.05, W.stone, 0, 10.3, 0, 0.02); rbox(g, 1.0, 1.0, 1.5, 0.05, W.stone, 0, 8.4, 0.05, 0.02);
    box(L, 0.3, 9, 10, W.dark, e * 51.6, 4.5, DM);
    [[3, -6], [-2, 5], [5, 8], [0, -10], [-6, -2]].forEach(([a, b], i) => { const t = autumnTree(L, e * (62 + a), DM + b, i % 2 ? W.leaf : W.leafD); t.position.y = 10.5 * Math.sqrt(Math.max(0, 1 - (a / 13) ** 2 - (b / 17) ** 2)) - 0.4; });
  });
  // the viaduct at the back, between two hills, with its own track
  {
    const pts = [[-36.8, VH], [36.8, VH], [36.8, 0]];
    for (let i = 9; i >= 0; i--) {
      const x0 = -36 + i * 7.2 + 0.8, x1 = -36 + (i + 1) * 7.2 - 0.8, mx = (x0 + x1) / 2, r = (x1 - x0) / 2;
      pts.push([x1, 0], [x1, 3.8]); for (let k = 1; k < 10; k++) { const a = (k / 10) * Math.PI; pts.push([mx + Math.cos(a) * r, 3.8 + Math.sin(a) * r]); } pts.push([x0, 3.8], [x0, 0]);
    }
    pts.push([-36.8, 0]);
    ext(L, pts, 0, 4.0, W.stone, 0, 0, DV, 0.03);
    rbox(L, 73.6, 0.3, 4.6, 0.04, W.stoneD, 0, VH - 0.1, DV, 0.02);
    [1, -1].forEach((s) => rbox(L, 73.6, 0.8, 0.35, 0.04, W.stone, 0, VH + 0.4, DV + s * 2.1, 0.02));
    for (let i = 0; i <= 10; i++) rbox(L, 1.9, 0.6, 4.4, 0.05, W.stoneD, -36 + i * 7.2, 0.3, DV, 0.02);
    track(L, -48, 48, DV, { y: VH, sl: SL });
    [1, -1].forEach((e) => {
      const hl = add(L, new THREE.SphereGeometry(1, 28, 18), W.hillD, e * 46, 0, DV); hl.scale.set(11.5, 16, 11);
      const g = grp(L, e * 35.4, VH, DV); g.rotation.y = e > 0 ? -Math.PI / 2 : Math.PI / 2;
      archWall(g, 7.5, 6.8, 4.6, 4.0, 1.6, 1.0, W.stoneD, 0, 0, 0); box(L, 0.3, 5.4, 4.4, W.dark, e * 36.6, VH + 2.7, DV);
    });
  }
  // the station platform with its canopy (green columns, glass roof, wooden valance)
  rbox(L, 46, 1.17, 4.5, 0.05, W.platform, 0, 0.585, -20.15, 0.02);
  box(L, 46, 0.1, 0.32, W.stoneD, 0, 1.13, -18.05); box(L, 46, 0.02, 0.14, W.white, 0, 1.18, -18.55);
  for (let h = -14; h <= 14; h += 4) { cylY(L, 0.1, 3.5, W.iron, h, 1.17 + 1.75, -20.9, 10); cylY(L, 0.2, 0.3, W.iron, h, 1.3, -20.9, 10); cylY(L, 0.16, 0.2, W.iron, h, 4.7, -20.9, 10); [1, -1].forEach((s) => rod(L, new V3(h, 4.2, -20.9), new V3(h + s * 1.2, 4.8, -20.9), 0.04, W.iron, 4)); rod(L, new V3(h, 4.2, -20.9), new V3(h, 4.85, -18.6), 0.04, W.iron, 4); }
  { const r = rbox(L, 30, 0.14, 5.4, 0.04, std(0xbcd4e6, 0.2, 0.3), 0, 4.95, -20.2, 0.02); r.rotation.x = -0.05; }
  box(L, 30, 0.2, 0.2, W.iron, 0, 4.85, -20.9);
  { const pts = [[-15, 0]]; for (let x = -15; x < 15; x += 0.5) pts.push([x + 0.25, -0.45]); pts.push([15, -0.2], [15, 0.15], [-15, 0.15]); const f = ext(L, pts.map(([x, y]) => [x, y]), 0, 0.05, W.cream, 0, 4.9, -17.55, 0.005); void f; }
  // platform furniture: benches, clock, ticket stamping machines, bins, name boards, lamp posts
  [-11, -3, 7].forEach((h) => { const g = grp(L, h, 1.17, -21.8); rbox(g, 1.6, 0.08, 0.45, 0.02, W.wood, 0, 0.45, 0, 0.01); rbox(g, 1.6, 0.4, 0.06, 0.02, W.wood, 0, 0.75, -0.2, 0.01); [0.7, -0.7].forEach((x) => box(g, 0.06, 0.45, 0.4, W.iron, x, 0.22, 0)); });
  { const g = grp(L, 2, 4.35, -20.9); cylY(g, 0.03, 0.3, W.iron, 0, 0.15, 0, 6); cylZ(g, 0.38, 0.14, W.iron, 0, -0.25, 0, 20); [1, -1].forEach((s) => { cylZ(g, 0.32, 0.02, W.white, 0, -0.25, s * 0.075, 20); box(g, 0.04, 0.22, 0.02, MT.black, 0, -0.17, s * 0.09); box(g, 0.16, 0.04, 0.02, MT.black, 0.07, -0.25, s * 0.09); }); }
  [-6, 12].forEach((h) => { const g = grp(L, h, 1.17, -21.3); cylY(g, 0.05, 1.0, RM.greyD, 0, 0.5, 0, 6); rbox(g, 0.32, 0.4, 0.26, 0.05, W.orange, 0, 1.15, 0, 0.02); rbox(g, 0.2, 0.05, 0.04, 0.01, MT.black, 0, 1.2, 0.13, 0.005); });
  [-16, 4, 15].forEach((h) => cylY(L, 0.2, 0.75, std(0x2f6b4a, 0.6, 0.1), h, 1.55, -22.0, 12));
  [-19, 19].forEach((h) => { const g = grp(L, h, 1.17, -21.6); [0.9, -0.9].forEach((x) => cylY(g, 0.05, 2.4, RM.greyD, x, 1.2, 0, 6)); rbox(g, 2.4, 0.6, 0.08, 0.06, W.signBlue, 0, 2.3, 0, 0.01); decal(g, 'BIDULE', 2.1, 0.45, '#ffffff', 0, 2.3, 0.05); });
  { const g = grp(L, -8.5, 1.17, -21.3); [0.6, -0.6].forEach((x) => cylY(g, 0.05, 2.0, RM.greyD, x, 1.0, 0, 6)); rbox(g, 1.6, 0.9, 0.12, 0.05, std(0x1f2a44, 0.4, 0.2), 0, 2.2, 0, 0.01); [0, 1, 2].forEach((i) => box(g, 1.3, 0.08, 0.02, glow(0xffc24a, 0.6), 0, 2.45 - i * 0.22, 0.07)); }
  [-21, 21].forEach((h) => { const g = grp(L, h, 1.17, -19.0); cylY(g, 0.07, 3.6, W.iron, 0, 1.8, 0, 8); rbox(g, 0.4, 0.3, 0.4, 0.06, std(0xfff1c8, 0.4, 0, { emissive: 0xffd080, emissiveIntensity: 0.35 }), 0, 3.7, 0, 0.02); });
  // the station building: a two-storey pavilion with a mansard roof and a clock, two wings
  { const g = grp(L, 0, 0, -27.3);
    rbox(g, 10, 7, 6.2, 0.05, W.stone, 0, 3.5, 0, 0.02); xsec(g, [[-3.4, 0], [3.4, 0], [2.7, 1.5], [1.6, 2.3], [-1.6, 2.3], [-2.7, 1.5]], 0.1, 10.6, W.slate, 0, 7.0, 0, 0.03);
    rbox(g, 10.3, 0.3, 6.5, 0.04, W.stoneD, 0, 3.6, 0, 0.02); rbox(g, 10.4, 0.25, 6.6, 0.04, W.stoneD, 0, 7.0, 0, 0.02);
    [1, -1].forEach((s) => [[4.85, 3.0], [-4.85, 3.0]].forEach(([x]) => box(g, 0.45, 7, 0.45, MT.brick, x, 3.5, s * 3.0)));
    [1, -1].forEach((s) => { const z = s * 3.12;
      [-3, 0, 3].forEach((x) => {
        rbox(g, 1.5, 2.6, 0.06, 0.05, x === 0 ? W.door : MT.glassD, x, 1.4, z, 0.01); add(g, new THREE.CylinderGeometry(0.75, 0.75, 0.06, 16, 1, false, -Math.PI / 2, Math.PI), x === 0 ? W.door : MT.glassD, x, 2.7, z).rotation.x = Math.PI / 2;
        rbox(g, 1.15, 1.5, 0.06, 0.05, MT.glassD, x, 5.0, z, 0.01); [0.8, -0.8].forEach((o) => rbox(g, 0.45, 1.5, 0.08, 0.03, W.shutB, x + o, 5.0, z, 0.01)); rbox(g, 1.3, 0.12, 0.25, 0.02, W.stoneD, x, 4.2, z, 0.01); });
      rbox(g, 0.4, 0.4, 0.4, 0.04, W.stoneD, 0, 7.4, z * 0.9, 0.02); });
    rbox(g, 3.4, 1.0, 0.25, 0.05, W.slate, 0, 9.0, 1.9, 0.02); rbox(g, 1.6, 1.6, 0.6, 0.05, W.stone, 0, 8.4, 2.7, 0.02);
    decal(g, 'GARE', 3.2, 0.9, '#2a3550', 0, 3.95, 3.15);
    const ck = grp(g, 0, 8.4, 3.02); cylZ(ck, 0.62, 0.08, W.white, 0, 0, 0, 24); add(ck, new THREE.TorusGeometry(0.62, 0.06, 6, 24), MT.black, 0, 0, 0.04); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(ck, 0.05, 0.12, 0.02, MT.black, Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0.05); }
    const hands = grp(ck, 0, 0, 0.07); hands.userData.dynamic = true; const hh = grp(hands), mh = grp(hands); box(hh, 0.07, 0.34, 0.02, MT.black, 0, 0.15, 0); box(mh, 0.045, 0.5, 0.02, MT.black, 0, 0.23, 0.01); CLOCK = { hh, mh };
    [1, -1].forEach((e) => { const w = grp(g, e * 8.6, 0, 0.3); rbox(w, 7.2, 4.4, 5.4, 0.05, W.stone, 0, 2.2, 0, 0.02); xsec(w, [[-3.0, 0], [3.0, 0], [0.4, 1.7], [-0.4, 1.7]], 0.08, 7.6, W.slate, 0, 4.4, 0, 0.03); rbox(w, 7.4, 0.25, 5.6, 0.04, W.stoneD, 0, 4.4, 0, 0.02);
      [1, -1].forEach((s) => [-2.2, 0, 2.2].forEach((x) => { rbox(w, 1.2, 2.4, 0.06, 0.05, MT.glassD, x, 1.6, s * 2.72, 0.01); add(w, new THREE.CylinderGeometry(0.6, 0.6, 0.06, 14, 1, false, -Math.PI / 2, Math.PI), MT.glassD, x, 2.8, s * 2.72).rotation.x = Math.PI / 2; }));
      cylY(w, 0.3, 1.2, MT.brick, e * 2.5, 5.6, -1, 8); });
    // canopy over the front door on the square
    rbox(g, 6, 0.15, 1.6, 0.04, W.zinc, 0, 3.3, -3.9, 0.02); [-2.8, 2.8].forEach((x) => rod(g, new V3(x, 3.2, -4.6), new V3(x, 2.4, -3.15), 0.05, W.iron, 4)); }
  // the village behind the station, around its square and church
  const HOUSES = [[-17, -40, 0], [-10.5, -41.5, 0], [-4, -40.5, 0], [3, -41.5, 0], [10, -40, 0], [16.5, -41.5, 0], [24, -33.5, 0], [33, -36, 0], [39, -30, Math.PI / 2], [30, -26.5, Math.PI], [-18, 34, Math.PI / 2], [-17, 42, Math.PI / 2], [-3, 35, -Math.PI / 2], [-2.5, 42.5, -Math.PI / 2], [44, 30, 0]];
  HOUSES.forEach(([h, d, ry], i) => house(L, h, d, ry, i));
  { const g = grp(L, 25, 0, -42); rbox(g, 9, 5, 6, 0.05, W.stone, 0, 2.5, 0, 0.02); xsec(g, [[-3.4, 0], [3.4, 0], [0, 2.8]], 0.05, 9.4, W.slate, 0, 5.0, 0, 0.03);
    rbox(g, 3.2, 9.5, 3.2, 0.05, W.stone, -5.6, 4.75, 0, 0.02); { const sp = add(g, new THREE.ConeGeometry(2.4, 5.2, 4), W.slate, -5.6, 12.1, 0); sp.rotation.y = Math.PI / 4; }
    cylZ(g, 0.55, 0.08, W.white, -5.6, 7.6, 1.62, 18); box(g, 0.06, 0.4, 0.02, MT.black, -5.6, 7.75, 1.68); box(g, 0.3, 0.06, 0.02, MT.black, -5.5, 7.6, 1.68);
    rbox(g, 1.2, 2.2, 0.06, 0.05, W.door, -5.6, 1.1, 1.62, 0.01); [-1.5, 1.5].forEach((x) => { rbox(g, 0.8, 2.0, 0.06, 0.05, MT.glassD, x, 2.6, 3.02, 0.01); }); rod(g, new V3(-5.6, 14.6, 0), new V3(-5.6, 15.4, 0), 0.04, MT.black, 4); }
  // farms, fields, the meadow fence, hay bales
  barn(L, -36, 41, 0); farmhouse(L, -26, 45, 0); roundBaleStack(L, -44, 33, 0.3, 3); roundBaleStack(L, -22, 33, -0.2, 2);
  fence(L, [2, 25], [40, 25], 19); fence(L, [2, 25], [2, 42], 9); fence(L, [40, 25], [40, 40], 8); fence(L, [2, 42], [20, 46], 9);
  { const g = grp(L, 36, 0, 30); cylY(g, 0.9, 0.6, std(0x9aa0aa, 0.4, 0.6), 0, 0.3, 0, 16); cylY(g, 0.75, 0.05, std(0x4f8fe0, 0.2, 0.2), 0, 0.58, 0, 16); }
  // the little halt on the secondary line
  { const g = grp(L, -34, 0, 1.7); rbox(g, 13, 1.17, 1.6, 0.04, W.platform, 0, 0.585, 0, 0.02); box(g, 13, 0.02, 0.12, W.white, 0, 1.18, 0.55);
    const sh = grp(g, -2, 1.17, -0.3); [-1.3, 1.3].forEach((x) => box(sh, 0.08, 2.3, 0.08, W.iron, x, 1.15, -0.4)); box(sh, 2.7, 1.7, 0.05, MT.glass, 0, 1.2, -0.5); rbox(sh, 3.0, 0.1, 1.3, 0.03, W.iron, 0, 2.35, -0.1, 0.01); rbox(sh, 2.0, 0.08, 0.4, 0.02, W.wood, 0, 0.45, -0.3, 0.01);
    const sg = grp(g, 4, 1.17, -0.5); cylY(sg, 0.05, 2.2, RM.greyD, 0, 1.1, 0, 6); rbox(sg, 1.6, 0.45, 0.06, 0.05, W.signBlue, 0, 2.2, 0, 0.01); decal(sg, 'BIDULE', 1.4, 0.32, '#ffffff', 0, 2.2, 0.04); }
  // trees: plane trees along the road, poplars by the stream, orchards
  for (let h = -54; h <= 54; h += 7) { if (Math.abs(h + 10) < 5) continue; autumnTree(L, h, -2.6, W.leaf); }
  [[-6, -44], [7, -45], [-1, -36.5], [12, -36.5], [-22, -44], [20, -45], [-26, -35]].forEach(([h, d], i) => autumnTree(L, h, d, i % 2 ? W.leaf : W.leafD));
  [[5, -52], [-4, -54], [8, -50], [-1, -49]].forEach(([h, d]) => { const g = grp(L, h, 0, d); cylY(g, 0.18, 2.4, 0x5b3626, 0, 1.2, 0, 6); const c = add(g, new THREE.IcosahedronGeometry(1, 1), 0x3f7a32, 0, 4.4, 0); c.scale.set(0.9, 2.6, 0.9); });
  [[-48, 28], [-50, 14], [48, 12], [52, 4], [46, 40], [-8, 50], [8, 52], [-46, -2], [44, -4], [20, 48], [-30, 52], [52, -32]].forEach(([h, d], i) => autumnTree(L, h, d, i % 3 ? W.leaf : W.leafD));
  shadows(L);
  sleepers(L, SL);
  return L;
}

const WALLS = ['cream', 'ochre', 'pink', 'white', 'cream', 'stone'], ROOFS = ['tile', 'tile', 'tileD', 'slate', 'tile'];
/** A village house: walls, gable roof, windows with shutters, a door and a chimney; its street side faces +z (turned by ry). */
function house(L, h, d, ry, i) {
  const g = grp(L, h, 0, d); g.rotation.y = ry;
  const w = 4.2 + (i % 3) * 0.8, dp = 3.6, ht = 3.2 + (i % 2) * 1.6, wm = W[WALLS[i % WALLS.length]], rm = W[ROOFS[i % ROOFS.length]], sh = i % 2 ? W.shutB : W.shutG;
  rbox(g, w, ht, dp, 0.04, wm, 0, ht / 2, 0, 0.02);
  xsec(g, [[-dp / 2 - 0.35, 0], [dp / 2 + 0.35, 0], [0, 1.7]], 0.04, w + 0.4, rm, 0, ht, 0, 0.03);
  const floors = ht > 4 ? [1.4, 3.3] : [1.5];
  floors.forEach((y, f) => { for (let x = -w / 2 + 0.9; x <= w / 2 - 0.8; x += 1.4) { if (f === 0 && Math.abs(x) < 0.6) continue; rbox(g, 0.7, 0.9, 0.06, 0.03, MT.glassD, x, y, dp / 2 + 0.01, 0.01); [0.5, -0.5].forEach((o) => rbox(g, 0.3, 0.9, 0.08, 0.02, sh, x + o, y, dp / 2 + 0.02, 0.01)); } });
  rbox(g, 0.85, 1.7, 0.06, 0.03, W.door, w > 4.6 ? 0.1 : -0.6, 0.85, dp / 2 + 0.01, 0.01);
  rbox(g, 0.5, 1.2, 0.5, 0.03, MT.brick, w / 2 - 0.8, ht + 1.1, -0.4, 0.01);
}

/* ================= life ================= */
function buildLife(LL, onUpdate) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts, true, t);
  // cars on the road between the lines
  const roadR = R([[-56, -6.9], [56, -6.9], [57.4, -6], [56, -5.1], [-56, -5.1], [-57.4, -6]], 0.1);
  const cars = ['car', 'van', 'car', 'kei', 'truck', 'car'].map((k) => miniCar(LL, k)); all.push(...cars);
  const t1 = traffic(roadR, cars, 3.6, { gap: 4 });
  // travellers on the platform, some with a suitcase
  const plat = R([[-17, -22.0], [17, -22.0], [17.6, -21.75], [17, -21.5], [-17, -21.5], [-17.6, -21.75]], 0.1);
  const folks = Array.from({ length: 7 }, (_, i) => { const p = walker(LL, 0, 0, { kid: i % 4 === 2 }); if (i % 2 === 0) { const g = grp(p, -0.05, 0, -0.34); rbox(g, 0.34, 0.45, 0.2, 0.05, std(pick([0xe5452c, 0x2f7de0, 0xf2b21c, 0xa45ad8]), 0.5, 0.1), 0, 0.3, 0, 0.02); } return p; });
  const t2 = traffic(plat, folks, 0.9, { gap: 1.1, y: 1.17 });
  // people on the station square
  const sq = R([[-16, -35.5], [16, -35.5], [16, -32.5], [-16, -32.5]], 0.3);
  const town = Array.from({ length: 6 }, (_, i) => walker(LL, 0, 0, { kid: i % 3 === 1 })); all.push(...town);
  const t3 = traffic(sq, town, 1.0, { gap: 1.2 });
  // Normandy cows in the meadow: they graze, and look at the trains going by
  const cows = [[8, 30, 0.4], [14, 36, -2.2], [21, 31, 1.2], [27, 38, 2.8], [33, 29, -0.6], [11, 40, 1.8], [30, 34, 0.1]].map(([h, d, r]) => { const c = cow(LL, h, d); c.rotation.y = r; c.userData.ph = rnd(0, 6); return c; });
  // a little regional train crossing the viaduct, from tunnel to tunnel
  const vt = ter(LL); vt.g.position.set(-70, VH + RT, DV); let vx = -70, wait = 4;
  let T = 0;
  onUpdate((dt) => {
    T += dt; t1.update(dt, all); t2.update(dt, folks); t3.update(dt, all);
    if (wait > 0) wait -= dt; else { vx += dt * 7; vt.axles.forEach((a) => (a.rotation.z -= (dt * 7) / a.userData.r)); if (vx > 70) { vx = -70; wait = rnd(6, 12); } }
    vt.g.position.x = vx; carsVis(vt.cars, vx, -35.4, 35.4);
    cows.forEach((c) => { const ph = c.userData.ph + T * 0.35, g = Math.sin(ph) > 0.2; const hd = c.userData.head; hd.rotation.z += ((g ? -0.75 : 0.05) - hd.rotation.z) * Math.min(1, dt * 2); hd.rotation.y = Math.sin(ph * 0.7) * 0.5; c.userData.tail.rotation.x = Math.sin(T * 3 + c.userData.ph) * 0.3; });
    if (CLOCK) { const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60; CLOCK.mh.rotation.z = -(m / 60) * Math.PI * 2; CLOCK.hh.rotation.z = -(h / 12) * Math.PI * 2; }
  });
}
/** A Normandy cow: white with brown patches and "spectacles", pink muzzle, little horns, facing +x. */
function cow(p, h, d) {
  const g = grp(p, h, 0, d);
  rbox(g, 1.7, 0.85, 0.8, 0.3, W.cow, 0, 1.15, 0, 0.04);
  [[0.3, 0.2, 0.41, 0.5, 0.45], [-0.45, 0.1, -0.41, 0.6, 0.5], [-0.3, 0.35, 0.41, 0.45, 0.35], [0.4, 0.4, -0.41, 0.4, 0.3]].forEach(([x, y, z, w, hh]) => rbox(g, w, hh, 0.02, 0.1, W.cowB, x, 1.15 + y - 0.2, z, 0.005));
  [[0.6, 0.25], [0.6, -0.25], [-0.6, 0.25], [-0.6, -0.25]].forEach(([x, z]) => { rbox(g, 0.16, 0.8, 0.16, 0.05, W.cow, x, 0.4, z, 0.02); rbox(g, 0.17, 0.12, 0.17, 0.03, MT.black, x, 0.06, z, 0.01); });
  sph(g, 0.16, W.pinkM, -0.35, 0.72, 0);
  const head = grp(g, 0.85, 1.35, 0);
  rbox(head, 0.5, 0.42, 0.4, 0.15, W.cow, 0.22, 0, 0, 0.02); rbox(head, 0.22, 0.28, 0.36, 0.1, W.pinkM, 0.5, -0.08, 0, 0.02);
  [0.14, -0.14].forEach((z) => { rbox(head, 0.2, 0.18, 0.02, 0.06, W.cowB, 0.25, 0.05, z * 1.45, 0.005); sph(head, 0.035, MT.black, 0.36, 0.06, z * 1.45); rbox(head, 0.1, 0.14, 0.22, 0.04, W.cow, 0.08, 0.12, z * 2.3, 0.01); rod(head, new V3(0.12, 0.2, z), new V3(0.18, 0.36, z * 1.6), 0.03, W.horn, 5); });
  const tail = grp(g, -0.85, 1.45, 0); rod(tail, new V3(0, 0, 0), new V3(-0.05, -0.7, 0), 0.03, W.cow, 4); sph(tail, 0.06, W.cowB, -0.05, -0.72, 0);
  g.userData.head = head; g.userData.tail = tail; shadows(g); return g;
}
