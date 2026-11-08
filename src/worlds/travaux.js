// La Route — a village street being resurfaced, step by step, along one road that changes as you go:
// old cracked asphalt → milled → swept → tack coat → fresh hot asphalt → rolled → new white lines.
// Traffic still passes on the other lane, one way at a time, managed by two flaggers with their K10 paddles.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, beep } from '../kit/audio.js';
import { C, MT, ICO, dummy, tmpCol, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, toonMat, freeze } from '../kit/geo.js';
import { trackUnit, tire, fender, hydraulic, telescopic, beacon, operator, worker, truckCab, glassCab } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { autumnTree, lamp, cone, barrier } from '../kit/props.js';
import { route, placeOn, person, miniCar, traffic } from '../kit/life.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const LANE = 1.9; // works lane centre (front lane); the open lane is at −LANE

const DATA = {
  raboteuse: { short: 'La raboteuse', full: 'La raboteuse', verb: 'Raboter', horn: 'horn',
    use: 'Elle enlève le vieux goudron tout abîmé de la route.',
    how: 'Sous son ventre, un gros tambour plein de dents gratte la route. Un tapis roulant envoie les morceaux dans un camion.' },
  balayeuse: { short: 'La balayeuse', full: 'La balayeuse', verb: 'Balayer', horn: 'horn',
    use: 'Elle nettoie la route, comme un gros aspirateur.',
    how: 'Ses brosses rondes ramènent les petits morceaux vers le milieu, et un tuyau les aspire dans sa cuve.' },
  repandeuse: { short: 'La répandeuse', full: 'Le camion répandeuse', verb: 'Pulvériser', horn: 'horn',
    use: 'Il étale une colle sur la route, pour que le nouveau goudron tienne bien.',
    how: 'Sa citerne garde la colle bien chaude. À l’arrière, une longue rampe la pulvérise en petites gouttes.' },
  finisseur: { short: 'Le finisseur', full: 'Le finisseur', verb: 'Goudronner', horn: 'horn',
    use: 'Il pose le goudron tout neuf, encore tout chaud.',
    how: 'Un camion remplit sa trémie. Des vis étalent l’enrobé, et sa table chaude le lisse bien à plat.' },
  tandem: { short: 'Le tandem', full: 'Le compacteur tandem', verb: 'Tasser', horn: 'horn',
    use: 'Il écrase le goudron pour qu’il soit bien serré et solide.',
    how: 'Il a deux gros rouleaux en métal, très lourds, qui vibrent. Il roule en avant, puis en arrière.' },
  pneus: { short: 'Le compacteur à pneus', full: 'Le compacteur à pneus', verb: 'Pétrir', horn: 'horn',
    use: 'Il lisse le goudron et bouche tous les petits trous.',
    how: 'Il roule sur des pneus tout lisses. Il est rempli de sable et d’eau pour être très lourd.' },
  traceuse: { short: 'La traceuse', full: 'La traceuse', verb: 'Peindre', horn: 'bell',
    use: 'Elle peint les lignes blanches sur la route neuve.',
    how: 'Le conducteur suit des petits points avec une longue aiguille. Un pistolet peint, et des billes de verre font briller la ligne.' },
  fleche: { short: 'La flèche lumineuse', full: 'Le camion flèche lumineuse', verb: 'Signaler', horn: 'horn',
    use: 'Il protège le chantier et prévient les voitures.',
    how: 'Il lève un grand panneau avec une flèche orange qui clignote : les voitures doivent changer de côté.' },
  signaleur: { short: 'Le signaleur', full: 'Le signaleur et son panneau K10', verb: 'Faire passer', horn: 'bell',
    use: 'Il fait passer les voitures chacune leur tour.',
    how: 'Son panneau a un côté rouge : stop ! Et un côté vert : on passe. Il parle à son collègue avec un talkie-walkie.' }
};
const ORDER = ['raboteuse', 'balayeuse', 'repandeuse', 'finisseur', 'tandem', 'pneus', 'traceuse', 'fleche', 'signaleur'];

const GND = '<path class="gnd" d="M4 75H116"/>';
const CR = '#efe9d8', CRD = '#bdb6a0', HM = '#e8611e', HMD = '#b8461a', VY = '#f6c419', INKD = '#2c303c';
const ICONS = {
  raboteuse: GND + `<rect x="10" y="62" width="22" height="10" rx="5" fill="${INKD}"/><rect x="56" y="62" width="22" height="10" rx="5" fill="${INKD}"/>
    <circle cx="44" cy="62" r="9" fill="#8d96a6"/><path d="M38 56l3 3M48 56l-3 3M44 70v-4" stroke="${INKD}" stroke-width="2"/>
    <rect x="8" y="40" width="76" height="18" rx="4" fill="${CR}" stroke="${CRD}" stroke-width="2"/><rect x="10" y="26" width="24" height="16" rx="3" fill="${CR}" stroke="${CRD}" stroke-width="2"/>
    <path d="M38 22h26M40 22v18M62 22v18" stroke="${INKD}" stroke-width="3"/><path d="M80 48L116 24" stroke="${INKD}" stroke-width="7" stroke-linecap="round"/><circle cx="112" cy="18" r="3" fill="#6f6a60"/><circle cx="106" cy="22" r="2.5" fill="#6f6a60"/>`,
  balayeuse: GND + `<rect x="8" y="28" width="58" height="30" rx="6" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="8" y="46" width="58" height="5" fill="${HM}"/>
    <rect x="70" y="30" width="34" height="28" rx="4" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect class="g" x="86" y="34" width="14" height="11" rx="2"/>
    <circle class="k" cx="22" cy="64" r="8"/><circle class="k" cx="92" cy="64" r="8"/><ellipse cx="66" cy="72" rx="12" ry="4" fill="#5a4a32"/><path d="M56 72l-4 3M62 73l-2 4M70 73l2 4M76 72l4 3" stroke="#5a4a32" stroke-width="2"/>`,
  repandeuse: GND + `<rect x="10" y="26" width="62" height="26" rx="13" fill="#c8ccd4"/><path d="M24 26v26M44 26v26M62 26v26" stroke="#9aa0aa" stroke-width="2"/><rect x="76" y="28" width="30" height="26" rx="4" class="o"/><rect class="g" x="90" y="32" width="12" height="10" rx="2"/>
    <rect x="2" y="56" width="18" height="4" fill="${INKD}"/><path d="M4 62l-2 6M10 62v7M16 62l2 6" stroke="#5a3a24" stroke-width="2.5" stroke-linecap="round"/>
    <circle class="k" cx="30" cy="62" r="8"/><circle class="k" cx="48" cy="62" r="8"/><circle class="k" cx="92" cy="62" r="8"/>`,
  finisseur: GND + `<rect x="2" y="66" width="44" height="7" fill="#2a2a30"/><rect x="30" y="56" width="16" height="12" rx="2" fill="${VY}"/><path d="M42 28h40M46 28v20M78 28v20" stroke="${INKD}" stroke-width="3"/>
    <rect x="44" y="44" width="48" height="16" rx="3" fill="${VY}"/><path d="M90 40l24-10v26H92z" fill="#d09a10"/><rect x="48" y="58" width="44" height="13" rx="6.5" fill="${INKD}"/>
    <circle cx="56" cy="64.5" r="3" fill="#8d96a6"/><circle cx="70" cy="64.5" r="3" fill="#8d96a6"/><circle cx="84" cy="64.5" r="3" fill="#8d96a6"/><path d="M14 60q2-6 6 0M24 58q2-6 6 0" stroke="#d3d8ea" stroke-width="2" fill="none"/>`,
  tandem: GND + `<circle cx="24" cy="58" r="15" fill="#a8b0bc"/><circle cx="24" cy="58" r="5" fill="${INKD}"/><circle cx="96" cy="58" r="15" fill="#a8b0bc"/><circle cx="96" cy="58" r="5" fill="${INKD}"/>
    <rect x="12" y="36" width="96" height="10" rx="3" fill="${HM}"/><rect x="40" y="34" width="40" height="18" rx="3" fill="${HMD}"/><path d="M46 34V12M74 34V12" stroke="${INKD}" stroke-width="3"/><rect x="40" y="9" width="40" height="5" rx="2" fill="${HM}"/>`,
  pneus: GND + `<rect x="10" y="30" width="100" height="26" rx="5" fill="${HM}"/><rect x="44" y="12" width="32" height="20" rx="3" fill="${HMD}"/><rect class="g" x="49" y="16" width="22" height="11" rx="2"/>
    <rect x="12" y="54" width="22" height="20" rx="8" fill="#22232a"/><rect x="38" y="54" width="22" height="20" rx="8" fill="#22232a"/><rect x="62" y="54" width="22" height="20" rx="8" fill="#22232a"/><rect x="86" y="54" width="22" height="20" rx="8" fill="#22232a"/>`,
  traceuse: `<rect x="0" y="66" width="120" height="10" fill="#33343c"/><path d="M4 71h16M30 71h16" stroke="#fff" stroke-width="3"/>
    <rect x="50" y="44" width="50" height="14" rx="3" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="58" y="24" width="12" height="22" rx="5" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="74" y="24" width="12" height="22" rx="5" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="58" y="32" width="28" height="3" class="r"/>
    <path d="M100 60h18" stroke="${INKD}" stroke-width="2.5"/><circle cx="62" cy="62" r="6" class="k"/><circle cx="94" cy="64" r="4" class="k"/><path d="M50 56l-6 6" stroke="${INKD}" stroke-width="3"/><path d="M42 64v4" stroke="#fff" stroke-width="3"/>`,
  fleche: GND + `<rect x="4" y="10" width="40" height="34" rx="3" fill="#1d1f26"/><path d="M38 27H14M22 19l-8 8 8 8" stroke="#ffb03a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="6" y="44" width="68" height="16" rx="3" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><path d="M8 48l6 8M18 48l6 8M28 48l6 8" stroke="#e5452c" stroke-width="3"/><rect x="78" y="34" width="30" height="26" rx="4" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect class="g" x="92" y="38" width="12" height="10" rx="2"/><circle cx="92" cy="31" r="3" fill="#ffa53a"/>
    <circle class="k" cx="24" cy="64" r="8"/><circle class="k" cx="92" cy="64" r="8"/>`,
  signaleur: GND + `<circle cx="60" cy="16" r="8" fill="#f0c39a"/><path d="M51 14a9 7 0 0 1 18 0z" fill="#ffd23a"/><rect x="52" y="24" width="16" height="26" rx="5" fill="#ff8f1f"/><path d="M52 34h16M52 40h16" stroke="#e8eef5" stroke-width="2"/>
    <rect x="53" y="50" width="6" height="24" rx="2" fill="#2f4a8a"/><rect x="61" y="50" width="6" height="24" rx="2" fill="#2f4a8a"/><path d="M68 30l14-4" stroke="#ff8f1f" stroke-width="5" stroke-linecap="round"/>
    <path d="M84 18v54" stroke="${INKD}" stroke-width="3"/><circle cx="84" cy="18" r="12" fill="#e5452c" stroke="#fff" stroke-width="2.5"/><circle cx="30" cy="40" r="10" fill="#3aa46a" stroke="#fff" stroke-width="2.5"/><path d="M30 50v24" stroke="${INKD}" stroke-width="3"/>`
};

/* ---------- layout along the street (h = along the road, d = towards the front) ---------- */
const C_ = { raboteuse: 28, balayeuse: 17.5, repandeuse: 7, finisseur: -12, tandem: -24.5, pneus: -33, traceuse: -42, fleche: -51.5, signaleur: 48 };
const CFG = {};
Object.keys(C_).forEach((k) => (CFG[k] = CF(C_[k], LANE)));

const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, rot = -Math.PI / 4) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot, col, al }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const path = (pts, w, col, al = 1) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
// sidewalks, gutters, the village square and the side lanes
rect(0, 5.1, 130, 2.6, '#c9c2b4'); rect(0, -5.1, 130, 2.6, '#c9c2b4');
rect(-4, -14, 14, 9, '#d8cdb6'); // church square
path([[-4, -6], [-4, -26]], 3.2, '#b8ad98', 0.9); path([[34, 6], [36, 26]], 3, '#b8ad98', 0.8); path([[-22, 6], [-22, 18]], 3.4, '#a89d88', 0.9);
blob(-22, 15, 9, 'rgba(160,140,110,.55)'); // site base yard
blob(14, 20, 10, 'rgba(120,170,90,.5)'); blob(-40, -20, 12, 'rgba(120,170,90,.45)'); blob(40, -18, 10, 'rgba(110,160,80,.45)');

/* ---------- surfaces (canvas textures, world-fixed repeats) ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const speck = (x, w, h, n, cols, s = 2) => { for (let i = 0; i < n; i++) { x.fillStyle = pick(cols); x.fillRect(Math.random() * w, Math.random() * h, s, s); } };
let SURF = null;
function surfaces() {
  if (SURF) return SURF;
  // old asphalt, 8 × 4 m: grey, patched, full of cracks
  const old = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#74747c'; x.fillRect(0, 0, w, h); speck(x, w, h, 2600, ['#85858c', '#64646c', '#8e8e94', '#5c5c64']);
    for (let i = 0; i < 5; i++) { x.fillStyle = pick(['#5e5f68', '#686972', '#7e7f86']); x.fillRect(rnd(0, w), rnd(0, h), rnd(30, 110), rnd(20, 60)); }
    x.strokeStyle = '#484951'; x.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      let px = rnd(0, w), py = rnd(0, h), a = rnd(0, 6.28); x.lineWidth = rnd(0.9, 1.8); x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 12; k++) { a += rnd(-0.7, 0.7); px += Math.cos(a) * 7; py += Math.sin(a) * 5; x.lineTo(px, py); }
      x.stroke();
    }
    for (let i = 0; i < 3; i++) { const cx = rnd(40, w - 40), cy = rnd(30, h - 30); x.lineWidth = 1; for (let k = 0; k < 18; k++) { const ax = cx + rnd(-22, 22), ay = cy + rnd(-14, 14); x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + rnd(-9, 9), ay + rnd(-7, 7)); x.stroke(); } }
    x.fillStyle = '#3a3b44'; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(rnd(20, w - 20), rnd(20, h - 20), rnd(7, 14), rnd(5, 9), rnd(0, 3), 0, 7); x.fill(); }
  });
  // milled surface, 4 × 2 m: lighter, with the long grooves of the drum
  const mill = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#8e8f96'; x.fillRect(0, 0, w, h); speck(x, w, h, 1500, ['#a2a3a8', '#7a7b82', '#6e6f76']);
    for (let y = 1; y < h; y += 4) { x.fillStyle = 'rgba(70,70,78,.55)'; x.fillRect(0, y, w, 1.6); }
  });
  // asphalt: grey with aggregate, tinted by each material
  const asph = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7c7c80'; x.fillRect(0, 0, w, h); speck(x, w, h, 5200, ['#a8a8aa', '#5a5a60', '#909094', '#6a6a70'], 2); });
  SURF = { old, mill, asph };
  return SURF;
}
/** A flat strip on the road, from x = a to x = b (station-local), whose texture stays put while it grows. */
function layer(S, m, z, W, y, P) {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const mesh = add(S, g, m, 0, y, z); const t = m.map;
  if (t) t.repeat.y = W / P;
  const L = { mesh, a: 0, b: 0, set(a, b) {
    L.a = a; L.b = b; if (b - a < 0.01) { mesh.visible = false; return L; }
    mesh.visible = true; mesh.position.x = (a + b) / 2; mesh.scale.set(b - a, 1, W);
    if (t) { t.repeat.x = (b - a) / P; t.offset.x = a / P; } return L;
  } };
  return L;
}
const texMat = (tex, col, gloss) => { const t = tex.clone(); t.needsUpdate = true; return gloss ? std(col, gloss, 0.05, { map: t }) : toonMat({ color: col, map: t }); };

/* ---------- machine palette ---------- */
const TM = {
  cream: std(0xefe9d8, 0.42, 0.12), creamD: std(0xc9c2ac, 0.5, 0.15), ink: std(0x2e323e, 0.5, 0.35), inkL: std(0x4a505e, 0.5, 0.35),
  vy: std(0xf6c419, 0.4, 0.15), vyD: std(0xcf9a10, 0.5, 0.2), hm: std(0xe8611e, 0.4, 0.15), hmD: std(0xb8461a, 0.5, 0.2),
  drum: std(0xaab2be, 0.22, 0.9), pick: std(0x60666f, 0.4, 0.8), alu: std(0xc9cdd6, 0.3, 0.75), bed: std(0x9aa0aa, 0.45, 0.5),
  white: std(0xf4f5f8, 0.35, 0.1), red: std(0xd8302a, 0.4, 0.15), blue: std(0x2f6fe0, 0.4, 0.15), green: std(0x2f9a5a, 0.4, 0.1),
  bristle: std(0x3a2e22, 0.9, 0), brush: std(0x5a4632, 0.85, 0), hose: std(0x2a2c32, 0.7, 0.1), tank: std(0x3a6fd0, 0.45, 0.1),
  mat: std(0x8a6a44, 0.95, 0), sand: std(0xd8c08a, 0.9, 0), hot: std(0x26262c, 0.75, 0.1), mill: std(0x6f6d6a, 0.85, 0.1),
  tack: std(0x3a2618, 0.12, 0.2), paint: std(0xffffff, 0.5, 0), bead: std(0xe8f2ff, 0.15, 0.6), lampOff: std(0x5a4626, 0.5, 0.2),
  k10r: std(0xe0281e, 0.4, 0.05), k10g: std(0x1f9a4a, 0.4, 0.05), tarp: std(0x2f5a34, 0.85, 0)
};
const bake = (g) => { shadows(g); freeze(g); return g; };
let CHEV = null;
/** Red and white diagonal chevrons (back of the road-works trucks). */
function chevron() {
  if (!CHEV) CHEV = std(0xffffff, 0.4, 0.1, { map: canvasTex(64, 64, (x) => { x.fillStyle = '#f4f5f8'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8302a'; for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 16, 64); x.lineTo(i + 80, 0); x.lineTo(i + 64, 0); x.closePath(); x.fill(); } }) });
  CHEV.map.repeat.set(2, 1.4); return CHEV;
}
/** A tyre, its still parts merged. */
const wheel = (p, R, w, x, y, z, rimM, side, rubber) => { const t = tire(p, R, w, x, y, z, rimM, side, rubber); shadows(t); freeze(t); return t; };

/** Cab-over 3-axle tipper (benne TP). Faces +x, rear of the bed at x = −3.6. Returns { g, bed, gate, load, wheels, ram }. */
function tipper(p, cabM) {
  const g = grp(p), d = grp(g);
  [0.45, -0.45].forEach((z) => rbox(d, 6.6, 0.28, 0.16, 0.03, MT.black, -0.35, 0.98, z));
  truckCab(d, cabM, 1.35);
  [1, -1].forEach((s) => {
    cylX(d, 0.26, 0.9, TM.alu, 0.6, 0.82, s * 0.86, 14); rbox(d, 0.45, 0.42, 0.3, 0.03, MT.dark, -0.05, 0.85, s * 0.92);
    [0.55, 0.8].forEach((y) => rbox(d, 1.6, 0.06, 0.05, 0.01, MT.grey, -0.4, y, s * 1.12, 0.005)); box(d, 0.05, 0.4, 0.05, MT.dark, -1.15, 0.68, s * 1.1);
    rbox(d, 0.04, 0.42, 0.42, 0.02, MT.rubberS, -3.75, 0.62, s * 0.85, 0.01); rbox(d, 0.06, 0.14, 0.24, 0.02, MT.tail, -3.68, 0.95, s * 0.82, 0.01);
    cylX(d, 0.07, 0.4, MT.chrome, 0.95, 0.6, s * -0.7, 8);
  });
  rbox(d, 0.12, 0.12, 2.1, 0.02, MT.stripes, -3.66, 0.62, 0, 0.01); box(d, 0.05, 0.3, 0.05, MT.dark, -3.62, 0.8, 0.6); box(d, 0.05, 0.3, 0.05, MT.dark, -3.62, 0.8, -0.6);
  bake(d);
  const bed = grp(g, -3.55, 1.35, 0), B = TM.bed, bd = grp(bed);
  rbox(bd, 4.7, 0.1, 2.3, 0.02, B, 2.35, 0.05, 0, 0.01);
  [1, -1].forEach((s) => {
    ext(bd, [[0, 0], [4.7, 0], [4.7, 1.2], [0, 1.0]], 0.02, 0.07, B, 0, 0, s * 1.12, 0.01);
    rbox(bd, 4.7, 0.08, 0.12, 0.02, MT.dark, 2.35, 1.07, s * 1.14, 0.01);
    for (let x = 0.5; x < 4.6; x += 0.85) box(bd, 0.08, 1.0, 0.06, MT.dark, x, 0.52, s * 1.16);
    rbox(bd, 0.25, 0.12, 0.08, 0.02, MT.dark, 0.05, 0.08, s * 1.18, 0.01);
  });
  rbox(bd, 0.1, 1.35, 2.3, 0.02, B, 4.7, 0.68, 0, 0.01); rbox(bd, 0.55, 0.07, 2.3, 0.02, B, 4.95, 1.35, 0, 0.01);
  cylZ(bd, 0.09, 2.2, TM.tarp, 4.55, 1.38, 0, 10); // rolled-up tarp
  bake(bd);
  const gate = grp(bed, 0, 1.08, 0); rbox(gate, 0.08, 1.05, 2.3, 0.02, B, -0.05, -0.52, 0, 0.01); for (let z = -0.8; z <= 0.8; z += 0.8) box(gate, 0.1, 0.9, 0.08, MT.dark, -0.07, -0.5, z);
  const load = grp(bed, 2.35, 0.1, 0); const lm = add(load, new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), TM.mill); lm.scale.set(2.1, 0.9, 1.0); load.userData.mesh = lm;
  const ram = telescopic(g, anchor(g, 1.05, 0.95, 0), anchor(bed, 4.45, 0.0, 0), { n: 4, stage: 0.42, r: 0.13 });
  const wheels = [];
  [2.2, -1.95, -3.0].forEach((x, i) => [1, -1].forEach((s) => { wheels.push(wheel(g, 0.52, i ? 0.5 : 0.36, x, 0.52, s * 0.9, MT.grey, s)); if (!i) fender(g, 0.62, 0.42, x, 0.52, s * 0.9, cabM, Math.PI * 0.55); }));
  [1, -1].forEach((s) => rbox(g, 2.2, 0.06, 0.55, 0.02, MT.dark, -2.48, 1.15, s * 0.9, 0.01));
  shadows(g); return { g, bed, gate, load, wheels, ram };
}

/** Cold planer (W 200-like). Faces +x. Returns { g, drum, cv, tracks, chunks, drumX }. */
function planer(st, p) {
  const g = grp(p), d = grp(g), Cm = TM.cream, CD = TM.creamD, K = TM.ink;
  const tracks = [];
  [[1.9, 0.95], [1.9, -0.95], [-2.6, 0.95], [-2.6, -0.95]].forEach(([x, z]) => { const tg = grp(g, x, 0, 0); tracks.push(trackUnit(tg, { len: 1.6, r: 0.28, w: 0.4, z, frame: K })); cylY(d, 0.17, 0.42, K, x, 0.86, z, 14); cylY(d, 0.12, 0.3, MT.chrome, x, 0.78, z, 12); });
  // main frame, engine housing at the rear, low nose in front
  rbox(d, 6.4, 0.6, 2.3, 0.1, Cm, -0.45, 1.27, 0, 0.03);
  rbox(d, 2.3, 0.95, 2.2, 0.16, Cm, -2.3, 2.02, 0, 0.03);
  rbox(d, 1.7, 0.42, 2.0, 0.12, Cm, 1.75, 1.76, 0, 0.03);
  [1, -1].forEach((s) => {
    rbox(d, 6.42, 0.12, 0.04, 0.02, K, -0.45, 1.12, s * 1.15, 0.01); // dark band
    for (let k = 0; k < 7; k++) box(d, 0.05, 0.6, 0.03, K, -3.15 + k * 0.22, 2.02, s * 1.1); // cooling grilles
    rbox(d, 0.9, 0.5, 0.05, 0.04, CD, -1.2, 1.3, s * 1.17, 0.01); // service door
    rbox(d, 0.14, 0.04, 0.03, 0.01, MT.chrome, -0.85, 1.3, s * 1.2, 0.005);
    rbox(d, 1.75, 0.38, 0.07, 0.02, CD, -0.42, 0.22, s * 1.12, 0.01); // edge protector (side plate)
    rbox(d, 0.06, 0.12, 0.2, 0.02, MT.lamp, 2.62, 1.78, s * 0.75, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, -3.68, 1.4, s * 0.85, 0.01);
    rail(d, [[-1.15, 2.6, s * 1.18], [0.9, 2.6, s * 1.18]], 0.025, K); [-1.15, -0.1, 0.9].forEach((x) => rod(d, new V3(x, 1.58, s * 1.18), new V3(x, 2.6, s * 1.18), 0.025, K));
  });
  // ladder on the visible side
  for (let i = 0; i < 4; i++) rbox(d, 0.45, 0.04, 0.22, 0.01, K, -0.3, 0.3 + i * 0.32, 1.33, 0.01);
  [-0.55, -0.05].forEach((x) => rod(d, new V3(x, 0.25, 1.36), new V3(x, 1.58, 1.24), 0.025, K));
  // operator platform with consoles, canopy
  rbox(d, 2.1, 0.07, 2.36, 0.02, K, -0.12, 1.6, 0, 0.01);
  [0.55, -0.55].forEach((z) => { rbox(d, 0.4, 0.95, 0.5, 0.06, K, 0.7, 2.1, z, 0.02); const sc = rbox(d, 0.04, 0.24, 0.32, 0.02, MT.glassD, 0.6, 2.62, z, 0.01); sc.rotation.z = 0.5; [0.1, -0.1].forEach((dz) => cylY(d, 0.025, 0.15, MT.black, 0.78, 2.62, z + dz, 6)); });
  [[1.0, 1.1], [1.0, -1.1], [-1.25, 1.1], [-1.25, -1.1]].forEach(([x, z]) => rbox(d, 0.08, 1.65, 0.08, 0.02, K, x, 2.45, z, 0.01));
  rbox(d, 2.6, 0.1, 2.5, 0.05, Cm, -0.12, 3.3, 0, 0.02); rbox(d, 2.62, 0.05, 2.52, 0.02, K, -0.12, 3.24, 0, 0.01);
  [0.8, -0.8].forEach((z) => rbox(d, 0.08, 0.1, 0.18, 0.02, MT.lamp, 1.15, 3.28, z, 0.01));
  [1, -1].forEach((s) => { rod(d, new V3(1.0, 3.0, s * 1.1), new V3(1.25, 3.05, s * 1.35), 0.02, K); rbox(d, 0.05, 0.28, 0.16, 0.02, MT.black, 1.27, 2.98, s * 1.38, 0.01); });
  // engine top: exhaust, air intake, water filler
  cylY(d, 0.08, 0.7, MT.steel, -2.9, 2.75, -0.6, 10); cylY(d, 0.1, 0.06, MT.black, -2.9, 3.1, -0.6, 10); cylY(d, 0.18, 0.3, K, -2.0, 2.6, 0.55, 12); cylY(d, 0.14, 0.1, K, -1.7, 2.53, -0.5, 12);
  rbox(d, 0.12, 0.25, 2.3, 0.03, K, -3.7, 0.85, 0, 0.02); rbox(d, 0.06, 0.3, 1.0, 0.02, MT.stripes, -3.72, 1.5, 0, 0.01);
  // drum housing: top, front wall, moldboard behind
  rbox(d, 1.9, 0.12, 2.24, 0.03, K, -0.42, 0.98, 0, 0.01); rbox(d, 0.1, 0.8, 2.24, 0.02, K, 0.55, 0.55, 0, 0.01); rbox(d, 0.1, 0.75, 2.24, 0.02, K, -1.38, 0.5, 0, 0.01);
  rbox(d, 0.6, 0.35, 0.9, 0.05, K, 1.0, 0.95, 0, 0.02); // primary conveyor chute
  operator(d, 0.1, 1.64, 0.35).rotation.y = 0; // standing? seated driver on his stool
  bake(d);
  beacon(st, g, -0.12, 3.36, 0);
  // the cutting drum with its picks, spinning under the belly
  const drum = grp(g, -0.42, 0.52, 0); cylZ(drum, 0.46, 2.0, TM.drum, 0, 0, 0, 24);
  const pg = new THREE.ConeGeometry(0.05, 0.16, 6); pg.translate(0, 0.08, 0);
  const picks = new THREE.InstancedMesh(pg, TM.pick, 64); let n = 0;
  for (let i = 0; i < 64; i++) { const z = -0.95 + (i / 63) * 1.9, a = (z > 0 ? z : -z) * 9 + (i % 2) * Math.PI; dummy.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.46, z); dummy.rotation.set(0, 0, a - Math.PI / 2 + 0.35); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); picks.setMatrixAt(n++, dummy.matrix); }
  picks.castShadow = true; drum.add(picks);
  [1.02, -1.02].forEach((z) => cylZ(drum, 0.5, 0.05, K, 0, 0, z, 20));
  // discharge conveyor: slews and lifts at the nose
  const slew = grp(g, 2.75, 1.3, 0), cv = grp(slew); cv.rotation.z = 0.42;
  const cd = grp(cv);
  rbox(cd, 5.3, 0.1, 0.78, 0.02, K, 2.65, 0, 0, 0.01); [0.42, -0.42].forEach((z) => { rbox(cd, 5.3, 0.3, 0.06, 0.02, Cm, 2.65, 0.15, z, 0.01); rbox(cd, 5.3, 0.05, 0.08, 0.02, K, 2.65, 0.3, z, 0.01); });
  rbox(cd, 5.2, 0.03, 0.64, 0.01, MT.black, 2.6, 0.06, 0, 0.005);
  for (let x = 0.4; x < 5.2; x += 0.55) cylZ(cd, 0.05, 0.7, MT.steel, x, -0.1, 0, 8);
  rail(cd, [[0, -0.12, 0.38], [5.2, -0.12, 0.38]], 0.03, K); rail(cd, [[0, -0.12, -0.38], [5.2, -0.12, -0.38]], 0.03, K);
  for (let x = 0.3; x < 5.0; x += 0.65) { rod(cd, new V3(x, -0.12, 0.38), new V3(x + 0.32, -0.32, 0), 0.02, K); rod(cd, new V3(x + 0.32, -0.32, 0), new V3(x + 0.65, -0.12, -0.38), 0.02, K); }
  rail(cd, [[0.3, -0.32, 0], [5.0, -0.32, 0]], 0.03, K);
  ext(cd, [[4.7, 0.05], [5.5, 0.05], [5.5, 0.5], [4.9, 0.6]], 0.08, 0.92, Cm, 0, 0, 0, 0.02); cylZ(cd, 0.09, 0.72, MT.steel, 5.25, 0.0, 0, 10);
  rbox(cd, 0.25, 0.25, 0.9, 0.04, K, 2.4, 0.08, 0, 0.02); // fold joint
  rbox(cd, 0.06, 0.1, 0.2, 0.02, MT.lamp, 5.52, 0.3, 0, 0.01);
  bake(cd);
  st.links.push(hydraulic(g, anchor(g, 2.3, 1.75, 0.33), anchor(cv, 1.9, -0.12, 0.33), { barrel: 0.55, rb: 0.07, mat: K }), hydraulic(g, anchor(g, 2.3, 1.75, -0.33), anchor(cv, 1.9, -0.12, -0.33), { barrel: 0.55, rb: 0.07, mat: K }));
  // millings riding the belt
  const chunks = new THREE.InstancedMesh(ICO, TM.mill, 30); chunks.castShadow = true; cv.add(chunks); chunks.userData.u = Array.from({ length: 30 }, (_, i) => i / 30);
  shadows(g); return { g, drum, slew, cv, tracks, chunks, drumX: -0.42 };
}

/** Truck-mounted road sweeper. Returns { g, brushes, arms, wheels }. */
function sweeper(st, p) {
  const g = grp(p), d = grp(g), Wm = TM.white, O = MT.orange;
  [0.45, -0.45].forEach((z) => rbox(d, 6.0, 0.26, 0.16, 0.03, MT.black, -0.4, 0.92, z));
  truckCab(d, Wm, 0.9);
  // hopper with its rounded rear door, the auxiliary engine, the water tanks
  ext(d, [[-3.3, 1.1], [0.05, 1.1], [0.05, 2.75], [-2.9, 2.75], [-3.3, 2.4]], [0.05, 0.05, 0.15, 0.35, 0.1], 2.2, Wm, 0, 0, 0, 0.04);
  [1, -1].forEach((s) => {
    rbox(d, 3.36, 0.16, 0.03, 0.01, O, -1.6, 1.55, s * 1.11, 0.005); rbox(d, 3.36, 0.06, 0.03, 0.01, TM.blue, -1.6, 1.4, s * 1.11, 0.005);
    rbox(d, 2.0, 0.45, 0.32, 0.06, TM.tank, -1.7, 0.85, s * 0.95, 0.02); cylY(d, 0.08, 0.08, MT.black, -1.2, 1.1, s * 0.95, 10);
    rbox(d, 0.75, 0.9, 0.04, 0.04, std(0xe4e6ec, 0.4, 0.1), 0.42, 1.65, s * 1.11, 0.01); for (let k = 0; k < 6; k++) box(d, 0.6, 0.03, 0.02, MT.dark, 0.42, 1.35 + k * 0.1, s * 1.135);
    rbox(d, 0.06, 0.14, 0.22, 0.02, MT.tail, -3.32, 1.35, s * 0.82, 0.01); rbox(d, 0.04, 0.42, 0.4, 0.02, MT.rubberS, -3.25, 0.62, s * 0.85, 0.01);
  });
  rbox(d, 0.8, 1.65, 2.0, 0.1, Wm, 0.42, 1.95, 0, 0.03);
  rbox(d, 0.06, 0.3, 2.0, 0.02, MT.stripes, -3.34, 0.75, 0, 0.01);
  // suction nozzle under the chassis and its big ribbed hose up into the hopper
  rbox(d, 0.55, 0.22, 1.5, 0.05, MT.dark, -0.75, 0.2, 0, 0.02); rbox(d, 0.6, 0.06, 1.6, 0.02, MT.rubberS, -0.75, 0.06, 0, 0.01);
  rod(d, new V3(-0.75, 0.3, 0.55), new V3(-0.85, 1.4, 1.0), 0.17, TM.hose, 12);
  for (let i = 0; i <= 8; i++) { const t = i / 8; const r = add(d, new THREE.TorusGeometry(0.18, 0.03, 6, 14), TM.hose, -0.75 - 0.1 * t, 0.3 + 1.1 * t, 0.55 + 0.45 * t); r.rotation.x = Math.PI / 2 - 0.35; }
  // light bar at the back
  rbox(d, 0.2, 0.12, 1.8, 0.03, MT.dark, -3.0, 2.85, 0, 0.01);
  bake(d);
  [0.7, -0.7].forEach((z) => beacon(st, g, -3.0, 2.9, z)); beacon(st, g, 1.9, 2.95, 0.6);
  // two round brushes on swinging arms, between the axles
  const brushes = [], arms = [];
  [1, -1].forEach((s) => {
    const arm = grp(g, 0.45, 0.55, s * 0.6); arms.push(arm);
    rod(arm, new V3(0, 0, 0), new V3(0.15, -0.15, s * 0.55), 0.05, MT.dark); hydraulic(arm, anchor(arm, 0, 0.12, 0), anchor(arm, 0.1, 0, s * 0.5), { barrel: 0.3, rb: 0.04 }).update();
    const b = grp(arm, 0.15, -0.2, s * 0.6); b.rotation.x = s * 0.12; b.rotation.z = 0.12;
    cylY(b, 0.16, 0.18, MT.dark, 0, 0.05, 0, 14); cylY(b, 0.12, 0.08, TM.blue, 0, 0.17, 0, 12);
    add(b, new THREE.CylinderGeometry(0.16, 0.55, 0.22, 22, 1, true), std(0x3a2e22, 0.9, 0, { side: THREE.DoubleSide }), 0, -0.1, 0);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; rod(b, new V3(Math.cos(a) * 0.15, -0.0, Math.sin(a) * 0.15), new V3(Math.cos(a) * 0.58, -0.24, Math.sin(a) * 0.58), 0.03, k % 2 ? TM.bristle : TM.brush, 4); }
    cylY(b, 0.02, 0.1, MT.chrome, 0.3, 0.12, 0, 6);
    brushes.push(b);
  });
  const wheels = [];
  [1.75, -2.1].forEach((x, i) => [1, -1].forEach((s) => { wheels.push(wheel(g, 0.48, i ? 0.48 : 0.34, x, 0.48, s * 0.88, MT.grey, s)); if (!i) fender(g, 0.58, 0.4, x, 0.48, s * 0.88, Wm, Math.PI * 0.55); }));
  shadows(g); return { g, brushes, arms, wheels };
}

/** Tack-coat sprayer truck with an insulated tank and a rear spray bar. Returns { g, wings, nozzles, wheels }. */
function sprayer(st, p) {
  const g = grp(p), d = grp(g), O = MT.orange, K = TM.ink;
  [0.45, -0.45].forEach((z) => rbox(d, 6.6, 0.28, 0.16, 0.03, MT.black, -0.5, 0.98, z));
  truckCab(d, O, 1.15);
  cylX(d, 0.95, 4.1, TM.alu, -1.05, 2.25, 0, 30);
  [-2.9, -1.9, -0.9, 0.1, 0.85].forEach((x) => cylX(d, 0.975, 0.07, K, x, 2.25, 0, 30));
  [[-3.1, -1], [1.0, 1]].forEach(([x, s]) => { const e = sph(d, 0.95, TM.alu, x, 2.25, 0); e.scale.set(0.22, 1, 1); void s; });
  [-2.4, 0.2].forEach((x) => rbox(d, 0.25, 0.4, 1.6, 0.04, K, x, 1.2, 0, 0.02)); // saddles
  rbox(d, 3.2, 0.06, 0.7, 0.02, K, -1.05, 3.25, 0, 0.01); [0.35, -0.35].forEach((z) => { rail(d, [[-2.6, 3.25, z], [-2.6, 3.8, z], [0.5, 3.8, z], [0.5, 3.25, z]], 0.025, MT.yel); });
  cylY(d, 0.3, 0.2, TM.alu, -0.2, 3.25, 0, 16); cylY(d, 0.32, 0.05, K, -0.2, 3.37, 0, 16); // manhole
  cylY(d, 0.1, 1.0, K, -2.2, 3.55, -0.6, 10); cylY(d, 0.14, 0.06, K, -2.2, 4.07, -0.6, 10); // burner flue
  cylX(d, 0.12, 0.08, MT.white, -3.3, 2.6, 0.5, 14); cylX(d, 0.09, 0.02, MT.black, -3.35, 2.6, 0.5, 14); // thermometer
  for (let i = 0; i < 7; i++) rbox(d, 0.05, 0.03, 0.5, 0.01, K, -3.35, 0.9 + i * 0.36, 0.0, 0.005); [0.25, -0.25].forEach((z) => rod(d, new V3(-3.38, 0.9, z), new V3(-3.38, 3.3, z), 0.025, K));
  // rear platform, control box, hoses down to the bar
  rbox(d, 0.9, 0.06, 2.2, 0.02, K, -3.75, 0.9, 0, 0.01); rail(d, [[-4.15, 0.9, 1.1], [-4.15, 1.85, 1.1], [-4.15, 1.85, -1.1], [-4.15, 0.9, -1.1]], 0.025, MT.yel);
  rbox(d, 0.35, 0.6, 0.5, 0.05, MT.white, -3.4, 1.35, -0.75, 0.02); rbox(d, 0.02, 0.35, 0.35, 0.02, MT.glassD, -3.58, 1.4, -0.75, 0.01);
  [0.6, -0.6].forEach((z) => rod(d, new V3(-3.2, 1.25, z), new V3(-3.85, 0.42, z), 0.05, TM.hose, 8));
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.14, 0.22, 0.02, MT.tail, -4.0, 1.05, s * 0.95, 0.01); [0.55, 0.8].forEach((y) => rbox(d, 1.4, 0.06, 0.05, 0.01, MT.grey, -0.6, y, s * 1.12, 0.005)); });
  operator(d, -3.75, 0.93, 0.5).rotation.y = Math.PI; // the bar operator, standing at the back (on his seat)
  bake(d);
  beacon(st, g, 2.35, 2.95, -0.6);
  // spray bar with nozzles, two folding wings
  const bar = grp(g, -3.95, 0.42, 0); cylZ(bar, 0.07, 2.4, K, 0, 0, 0, 10); const nozzles = [];
  for (let z = -1.1; z <= 1.11; z += 0.2) { cylY(bar, 0.025, 0.12, MT.chrome, 0, -0.08, z, 6); nozzles.push(z); }
  bake(bar);
  const wings = [1, -1].map((s) => { const w = grp(bar, 0, 0, s * 1.2); cylZ(w, 0.06, 0.7, K, 0, 0, s * 0.35, 10); for (let z = 0.15; z < 0.7; z += 0.2) cylY(w, 0.025, 0.12, MT.chrome, 0, -0.08, s * z, 6); w.rotation.x = s * -1.4; return w; });
  const wheels = [];
  [2.0, -1.55, -2.6].forEach((x, i) => [1, -1].forEach((s) => { wheels.push(wheel(g, 0.52, i ? 0.5 : 0.36, x, 0.52, s * 0.9, MT.grey, s)); if (!i) fender(g, 0.62, 0.42, x, 0.52, s * 0.9, O, Math.PI * 0.55); }));
  [1, -1].forEach((s) => rbox(g, 2.2, 0.06, 0.55, 0.02, MT.dark, -2.08, 1.15, s * 0.9, 0.01));
  shadows(g); return { g, bar, wings, nozzles, wheels };
}

/** Tracked asphalt paver. Faces +x; screed rear edge at x ≈ −2.95. Returns { g, tracks, wings, load, augers, screed, exts }. */
function paver(st, p) {
  const g = grp(p), d = grp(g), Y = TM.vy, YD = TM.vyD, K = TM.ink;
  const tracks = [1.05, -1.05].map((z) => { const tg = grp(g, -0.2, 0, 0); return trackUnit(tg, { len: 3.0, r: 0.36, w: 0.42, z, frame: K, guard: true }); });
  rbox(d, 3.4, 0.55, 2.0, 0.08, Y, -0.25, 1.0, 0, 0.02);
  [1, -1].forEach((s) => { rbox(d, 3.3, 0.1, 0.12, 0.03, K, -0.25, 0.76, s * 1.0, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.lamp, 1.5, 1.2, s * 0.85, 0.01); });
  // hopper floor and slat conveyor, push rollers in front
  rbox(d, 2.1, 0.1, 2.2, 0.02, K, 2.0, 0.78, 0, 0.01); for (let x = 1.05; x < 3.0; x += 0.18) box(d, 0.06, 0.03, 0.9, MT.steel, x, 0.85, 0);
  rbox(d, 0.1, 0.4, 2.2, 0.02, YD, 3.05, 0.95, 0, 0.01);
  [0.7, -0.7].forEach((z) => { cylZ(d, 0.14, 0.38, MT.black, 3.2, 0.55, z, 14); rbox(d, 0.25, 0.25, 0.1, 0.02, K, 3.08, 0.55, z + 0.24 * Math.sign(z), 0.01); });
  // engine hood with grilles, the platform, two driver consoles and the canopy
  rbox(d, 1.4, 0.65, 1.9, 0.12, Y, 0.2, 1.6, 0, 0.03); [1, -1].forEach((s) => { for (let k = 0; k < 6; k++) box(d, 0.05, 0.4, 0.02, K, -0.25 + k * 0.18, 1.62, s * 0.96); });
  cylY(d, 0.07, 0.75, MT.steel, 0.6, 2.2, -0.6, 10); cylY(d, 0.09, 0.06, MT.black, 0.6, 2.58, -0.6, 10);
  rbox(d, 1.6, 0.08, 2.4, 0.02, K, -1.25, 1.32, 0, 0.01);
  [0.72, -0.72].forEach((z) => { rbox(d, 0.4, 0.55, 0.5, 0.05, K, -0.65, 1.62, z, 0.02); const sc = rbox(d, 0.04, 0.2, 0.3, 0.02, MT.glassD, -0.75, 1.95, z, 0.01); sc.rotation.z = 0.6; });
  [[-0.45, 1.12], [-0.45, -1.12], [-2.0, 1.12], [-2.0, -1.12]].forEach(([x, z]) => rbox(d, 0.07, 1.7, 0.07, 0.02, K, x, 2.17, z, 0.01));
  rbox(d, 2.0, 0.08, 2.5, 0.04, TM.white, -1.22, 3.05, 0, 0.02); rbox(d, 2.02, 0.05, 2.52, 0.02, Y, -1.22, 3.0, 0, 0.01);
  [1, -1].forEach((s) => rail(d, [[-2.05, 1.32, s * 1.18], [-2.05, 2.1, s * 1.18], [-0.45, 2.1, s * 1.18]], 0.025, K));
  operator(d, -1.0, 1.36, 0.62).rotation.y = 0;
  // auger tunnel, tow arms down to the screed
  rbox(d, 0.5, 0.22, 2.0, 0.03, K, -1.85, 0.7, 0, 0.01);
  [1, -1].forEach((s) => rod(d, new V3(0.9, 0.62, s * 1.32), new V3(-2.35, 0.55, s * 1.32), 0.06, Y, 8));
  [1, -1].forEach((s) => cylZ(d, 0.09, 0.3, K, 0.9, 0.62, s * 1.25, 10));
  bake(d);
  beacon(st, g, -1.22, 3.12, 0);
  // hopper wings: tip up to push the mix to the middle
  const wings = [1, -1].map((s) => { const w = grp(g, 2.0, 0.82, s * 1.05); const wd = grp(w);
    ext(wd, [[-1.05, 0], [1.05, 0], [1.05, 0.55], [-1.0, 0.45]], 0.03, 0.08, Y, 0, 0, 0, 0.01); rbox(wd, 2.1, 0.06, 0.12, 0.02, YD, 0, 0.53, 0, 0.01); bake(wd);
    w.rotation.x = s * -0.5; return w; });
  const load = grp(g, 2.0, 0.8, 0); [[0, 0, 0.45, 0.62], [-0.45, 0.02, -0.4, 0.55], [0.45, 0, -0.1, 0.6], [-0.3, 0, 0.4, 0.5]].forEach(([x, y, z, s]) => { const l = add(load, ICO, TM.hot, x, y, z); l.scale.set(s, s * 0.5, s); });
  // two augers (helical screws) across the width
  const augers = [1, -1].map((s) => { const a = grp(g, -2.15, 0.32, s * 0.95); cylZ(a, 0.05, 1.8, MT.steel, 0, 0, 0, 8);
    for (let i = 0; i < 26; i++) { const t = i / 25, ang = i * 0.75 * s, z = -0.88 + t * 1.76; const b = box(a, 0.05, 0.18, 0.1, MT.steel, Math.cos(ang) * 0.12, Math.sin(ang) * 0.12, z); b.rotation.z = ang; b.rotation.x = 0.3 * s; }
    bake(a); return a; });
  // the screed: heated plate, walkway with its rails, control boxes, side plates on the extensions
  const screed = grp(g, -2.6, 0.06, 0);
  rbox(screed, 0.6, 0.45, 2.4, 0.06, Y, 0, 0.27, 0, 0.02); rbox(screed, 0.64, 0.06, 2.42, 0.02, K, 0, 0.02, 0, 0.01);
  rbox(screed, 0.45, 0.06, 2.4, 0.02, K, -0.45, 0.45, 0, 0.01); rail(screed, [[-0.66, 0.45, 1.2], [-0.66, 1.1, 1.2], [-0.66, 1.1, -1.2], [-0.66, 0.45, -1.2]], 0.025, Y);
  for (let k = 0; k < 4; k++) box(screed, 0.02, 0.25, 0.3, K, 0.31, 0.3, -0.9 + k * 0.6);
  bake(screed);
  const exts = [1, -1].map((s) => { const e = grp(screed, -0.05, 0, s * 0.55); rbox(e, 0.55, 0.42, 1.25, 0.05, YD, 0, 0.25, s * 0.0, 0.02);
    rbox(e, 0.7, 0.55, 0.06, 0.02, Y, 0.05, 0.3, s * 0.62, 0.01); rbox(e, 0.32, 0.4, 0.25, 0.04, K, -0.35, 0.75, s * 0.4, 0.02); rbox(e, 0.02, 0.18, 0.18, 0.01, MT.glassD, -0.52, 0.8, s * 0.4, 0.01); bake(e); return e; });
  const scWorker = worker(screed, -0.45, 0.75, 0, MT.hat); scWorker.position.y = 0.48; scWorker.rotation.y = 0.2;
  shadows(g); return { g, tracks, wings, load, augers, screed, exts };
}

/** Articulated tandem roller. Returns { g, drums, sprays }. */
function tandemRoller(st, p) {
  const g = grp(p), H = TM.hm, HD = TM.hmD, K = TM.ink, RR = 0.58;
  const drums = [1.45, -1.45].map((x) => { const dr = grp(g, x, RR, 0); cylZ(dr, RR, 1.7, TM.drum, 0, 0, 0, 30); [0.86, -0.86].forEach((z) => { cylZ(dr, RR + 0.01, 0.04, K, 0, 0, z, 30); cylZ(dr, 0.18, 0.06, HD, 0, 0, z * 1.04, 12); }); dr.userData.r = RR; return dr; });
  const d = grp(g);
  [1.45, -1.45].forEach((x) => {
    const sx = Math.sign(x);
    [1, -1].forEach((s) => ext(d, [[-0.75, 0.25], [0.75, 0.25], [0.8, 1.05], [-0.8, 1.05]], 0.12, 0.12, H, x, 0.0, s * 0.95, 0.02)); // drum frame sides
    rbox(d, 1.7, 0.3, 2.0, 0.08, H, x, 1.3, 0, 0.03); // frame top
    rbox(d, 0.95, 0.42, 1.7, 0.12, H, x + sx * 0.05, 1.66, 0, 0.03); // water tank
    cylY(d, 0.12, 0.06, K, x + sx * 0.2, 1.9, 0.4, 12);
    rbox(d, 0.06, 0.06, 1.75, 0.02, K, x + sx * 0.66, 0.7, 0, 0.01); rbox(d, 0.06, 0.06, 1.75, 0.02, K, x - sx * 0.66, 0.7, 0, 0.01); // scrapers
    cylZ(d, 0.03, 1.75, MT.chrome, x + sx * 0.72, 1.12, 0, 6); for (let z = -0.75; z <= 0.76; z += 0.25) cylY(d, 0.02, 0.05, K, x + sx * 0.72, 1.08, z, 6); // sprinkler bar
    rbox(d, 0.06, 0.12, 0.22, 0.02, sx > 0 ? MT.lamp : MT.tail, x + sx * 0.82, 1.35, 0.7, 0.01); rbox(d, 0.06, 0.12, 0.22, 0.02, sx > 0 ? MT.lamp : MT.tail, x + sx * 0.82, 1.35, -0.7, 0.01);
    rbox(d, 0.04, 0.2, 1.0, 0.02, MT.stripes, x + sx * 0.84, 1.05, 0, 0.01);
  });
  rbox(d, 1.3, 0.75, 1.5, 0.1, HD, 0, 1.1, 0, 0.03); for (let k = 0; k < 5; k++) box(d, 0.05, 0.4, 0.02, K, -0.4 + k * 0.2, 1.1, 0.76);
  cylY(d, 0.22, 0.25, K, 0, 0.6, 0, 14); // articulation
  [1, -1].forEach((s) => { for (let i = 0; i < 2; i++) rbox(d, 0.35, 0.04, 0.2, 0.01, K, 0.0, 0.5 + i * 0.35, s * 0.85, 0.01); });
  cylY(d, 0.06, 0.55, MT.steel, -0.5, 1.9, -0.55, 10);
  bake(d);
  const cab = glassCab(g, 0, 1.48, 0, { len: 1.3, wid: 1.4, h: 1.45, mat: H, roof: HD, hat: MT.hat }); beacon(st, cab, -0.3, 1.55, 0.4); bake(cab);
  const sprays = [1.45 + 0.72, -1.45 - 0.72];
  shadows(g); return { g, drums, sprays, RR };
}

/** Pneumatic-tyred roller. Returns { g, wheels, hatch }. */
function tyreRoller(st, p) {
  const g = grp(p), H = TM.hm, HD = TM.hmD, K = TM.ink, R = 0.52;
  const wheels = [];
  [[1.6, [-0.7, 0, 0.7]], [-1.6, [-1.05, -0.35, 0.35, 1.05]]].forEach(([x, zs]) => zs.forEach((z) => { const w = wheel(g, R, 0.42, x, R, z, MT.grey, Math.sign(z) || 1, MT.rubberS); w.userData.r = R; wheels.push(w); }));
  const d = grp(g);
  ext(d, [[-2.15, 1.12], [2.15, 1.12], [2.35, 1.4], [2.2, 2.05], [-2.2, 2.05], [-2.35, 1.4]], 0.12, 2.25, H, 0, 0, 0, 0.04); // ballast body
  [1.6, -1.6].forEach((x) => { rbox(d, 1.25, 0.16, 2.3, 0.04, K, x, 1.08, 0, 0.01); [1, -1].forEach((s) => rbox(d, 0.4, 0.5, 0.08, 0.03, K, x, 0.85, s * 1.2, 0.01)); });
  [1, -1].forEach((s) => {
    rbox(d, 0.9, 0.5, 0.04, 0.06, HD, 0.0, 1.55, s * 1.13, 0.01); rbox(d, 0.14, 0.04, 0.03, 0.01, MT.chrome, 0.3, 1.55, s * 1.16, 0.005); // ballast door
    rbox(d, 0.06, 0.12, 0.22, 0.02, MT.lamp, 2.3, 1.75, s * 0.8, 0.01); rbox(d, 0.06, 0.12, 0.22, 0.02, MT.tail, -2.3, 1.75, s * 0.8, 0.01);
    for (let i = 0; i < 4; i++) rbox(d, 0.35, 0.04, 0.22, 0.01, K, 0.65, 0.65 + i * 0.35, s * 1.18, 0.01);
  });
  [1.6, -1.6].forEach((x) => { rbox(d, 0.08, 0.35, 2.3, 0.02, TM.mat, x + Math.sign(x) * 0.6, 0.72, 0, 0.01); rbox(d, 0.08, 0.35, 2.3, 0.02, TM.mat, x - Math.sign(x) * 0.6, 0.72, 0, 0.01); cylZ(d, 0.03, 2.2, MT.chrome, x + Math.sign(x) * 0.68, 1.12, 0, 6); });
  rbox(d, 0.04, 0.2, 1.4, 0.02, MT.stripes, -2.37, 1.35, 0, 0.01);
  rbox(d, 1.2, 0.5, 1.9, 0.1, HD, -1.55, 2.3, 0, 0.03); for (let k = 0; k < 5; k++) box(d, 0.05, 0.3, 0.02, K, -1.95 + k * 0.2, 2.3, 0.96); cylY(d, 0.06, 0.6, MT.steel, -1.9, 2.8, -0.6, 10);
  bake(d);
  const hatch = grp(g, 1.25, 2.1, 0.35); rbox(hatch, 0.7, 0.06, 0.7, 0.03, HD, 0.35, 0.03, 0, 0.01); box(hatch, 0.3, 0.05, 0.05, MT.chrome, 0.55, 0.08, 0);
  const sand = add(g, new THREE.CircleGeometry(0.3, 14), TM.sand, 1.6, 2.1, 0.35); sand.rotation.x = -Math.PI / 2;
  const cab = glassCab(g, 0, 2.08, 0, { len: 1.4, wid: 1.5, h: 1.45, mat: H, roof: HD, hat: MT.hat }); beacon(st, cab, -0.4, 1.55, 0.4); bake(cab);
  shadows(g); return { g, wheels, hatch };
}

/** Ride-on road-marking machine. Gun on the −z side, at local (0.75, ·, −1.15). Returns { g, wheels, gun, umbrella }. */
function marker(st, p) {
  const g = grp(p), d = grp(g), Wm = TM.white, R = TM.red, K = TM.ink;
  rbox(d, 2.9, 0.32, 1.4, 0.08, Wm, -0.1, 0.48, 0, 0.02); rbox(d, 2.92, 0.08, 1.42, 0.02, R, -0.1, 0.36, 0, 0.01);
  [0.35, -0.35].forEach((z) => { cylY(d, 0.28, 0.85, Wm, 0.05, 1.07, z, 20); cylY(d, 0.285, 0.08, R, 0.05, 1.2, z, 20); sph(d, 0.28, Wm, 0.05, 1.5, z).scale.y = 0.35; cylY(d, 0.06, 0.06, MT.chrome, 0.05, 1.62, z, 8); cylX(d, 0.06, 0.05, MT.white, 0.33, 1.3, z, 10); });
  cylY(d, 0.2, 0.55, std(0xe8f2ff, 0.2, 0.3), 0.85, 0.92, 0.35, 16); cylY(d, 0.21, 0.06, R, 0.85, 1.22, 0.35, 16); // glass-bead hopper
  rbox(d, 0.8, 0.62, 1.3, 0.08, R, -1.15, 0.95, 0, 0.02); for (let k = 0; k < 5; k++) box(d, 0.04, 0.35, 0.02, K, -1.4 + k * 0.13, 0.95, 0.66); // engine + compressor
  cylY(d, 0.05, 0.4, MT.steel, -1.4, 1.45, -0.45, 8);
  // driver's seat on the left (gun side), the wheel, a small dashboard
  rbox(d, 0.45, 0.1, 0.45, 0.04, MT.black, -0.55, 0.75, -0.25, 0.02); rbox(d, 0.1, 0.45, 0.45, 0.04, MT.black, -0.78, 0.98, -0.25, 0.02);
  const op = operator(d, -0.55, 0.7, -0.25); op.scale.setScalar(0.9);
  rod(d, new V3(0.15, 0.65, -0.25), new V3(-0.05, 1.05, -0.25), 0.03, MT.black); const swh = add(d, new THREE.TorusGeometry(0.15, 0.022, 6, 14), MT.black, -0.06, 1.07, -0.25); swh.rotation.y = Math.PI / 2; swh.rotation.z = 0.6;
  rbox(d, 0.25, 0.3, 0.4, 0.04, K, 0.35, 0.85, -0.45, 0.02); rbox(d, 0.02, 0.18, 0.28, 0.01, MT.glassD, 0.22, 0.92, -0.45, 0.01);
  // spray carriage on the left, pointer needle out in front
  rbox(d, 0.12, 0.12, 1.0, 0.02, K, 0.75, 0.35, -0.95, 0.01); rbox(d, 0.4, 0.3, 0.25, 0.04, Wm, 0.75, 0.3, -1.15, 0.01);
  rod(d, new V3(1.2, 0.4, -0.6), new V3(2.6, 0.18, -1.15), 0.025, K); sph(d, 0.05, MT.red, 2.62, 0.16, -1.15); rod(d, new V3(2.62, 0.16, -1.15), new V3(2.62, 0.04, -1.15), 0.012, K);
  [0.45, -0.45].forEach((z) => rbox(d, 0.06, 0.1, 0.16, 0.02, MT.lamp, 1.35, 0.55, z, 0.01));
  // a stack of cones at the back
  for (let i = 0; i < 4; i++) add(d, new THREE.ConeGeometry(0.2, 0.55, 10), C.orange, -1.65, 0.6 + i * 0.12, 0.35);
  bake(d);
  const gun = grp(g, 0.75, 0.15, -1.15); cylY(gun, 0.05, 0.18, MT.chrome, 0.08, 0.05, 0, 8); cylY(gun, 0.05, 0.18, MT.chrome, -0.08, 0.05, 0, 8); cylY(gun, 0.04, 0.1, std(0xe8f2ff, 0.2, 0.3), -0.25, 0.08, 0, 8);
  const pole = grp(g, -0.95, 0.7, 0.4); cylY(pole, 0.03, 1.6, K, 0, 0.8, 0, 6); beacon(st, pole, 0, 1.62, 0);
  const umb = grp(g, -0.6, 0.7, -0.2); cylY(umb, 0.02, 1.7, MT.steel, 0, 0.85, 0, 6); const top = grp(umb, 0, 1.75, 0); add(top, new THREE.ConeGeometry(0.85, 0.32, 8, 1, true), std(0xf06a2a, 0.7, 0, { side: THREE.DoubleSide }), 0, 0, 0);
  const wheels = [];
  [1, -1].forEach((s) => wheels.push(wheel(g, 0.32, 0.22, -0.85, 0.32, s * 0.7, MT.grey, s)));
  rod(g, new V3(1.1, 0.55, 0), new V3(1.1, 0.25, 0), 0.04, K); wheels.push(wheel(g, 0.25, 0.16, 1.1, 0.25, 0, MT.grey, 1));
  shadows(g); return { g, wheels, gun };
}

/** Arrow-board truck (FLR). Panel hinged at the back of the roof. Returns { g, panel, ram, lamps, wheels }. */
function arrowTruck(st, p) {
  const g = grp(p), d = grp(g), Wm = TM.white, K = TM.ink;
  [0.45, -0.45].forEach((z) => rbox(d, 5.6, 0.26, 0.16, 0.03, MT.black, -0.4, 0.92, z));
  truckCab(d, Wm, 0.95);
  rbox(d, 3.9, 1.5, 2.2, 0.08, Wm, -1.05, 1.9, 0, 0.03);
  [1, -1].forEach((s) => {
    for (let x = -2.8; x < 0.7; x += 0.7) box(d, 0.35, 0.18, 0.03, x % 1.4 ? MT.red : TM.white, x, 1.25, s * 1.11);
    rbox(d, 3.92, 0.12, 0.03, 0.01, std(0xe5452c, 0.35, 0.1), -1.05, 1.25, s * 1.112, 0.005);
    rbox(d, 0.06, 0.14, 0.22, 0.02, MT.tail, -3.03, 1.0, s * 0.85, 0.01); rbox(d, 0.06, 0.14, 0.22, 0.02, MT.amber, -3.03, 1.2, s * 0.85, 0.01);
    [0.55, 0.8].forEach((y) => rbox(d, 1.6, 0.06, 0.05, 0.01, MT.grey, -1.2, y, s * 1.12, 0.005));
  });
  // red and white chevrons across the back
  rbox(d, 0.04, 1.4, 2.1, 0.02, chevron(), -3.02, 1.9, 0, 0.01);
  rbox(d, 0.12, 0.12, 2.1, 0.02, MT.stripes, -3.05, 0.62, 0, 0.01);
  bake(d);
  [0.7, -0.7].forEach((z) => beacon(st, g, 2.1, 2.94, z));
  // the panel: black face with amber lamps (arrow + corner flashers), hinged at the back of the roof
  const panel = grp(g, -2.95, 2.68, 0), pd = grp(panel);
  rbox(pd, 0.14, 1.75, 2.15, 0.05, MT.black, 0.0, 0.9, 0, 0.02); rbox(pd, 0.16, 0.08, 2.2, 0.02, MT.yel, 0, 1.8, 0, 0.01); rbox(pd, 0.16, 0.08, 2.2, 0.02, MT.yel, 0, 0.02, 0, 0.01);
  [1, -1].forEach((s) => rbox(pd, 0.16, 1.85, 0.08, 0.02, MT.yel, 0, 0.9, s * 1.1, 0.01));
  rbox(pd, 0.2, 0.25, 1.6, 0.04, K, 0.12, 0.25, 0, 0.02);
  bake(pd);
  const mk = () => std(0x6a4a20, 0.45, 0.1, { emissive: 0xff8a1a, emissiveIntensity: 0 });
  const lamps = { shaft: mk(), head: mk(), corner: mk() };
  const disc = (m, y, z, r = 0.085) => { cylX(panel, r, 0.05, m, -0.08, y, z, 14); cylX(panel, r * 1.25, 0.03, MT.dark, -0.065, y, z, 14); };
  for (let k = 0; k < 5; k++) disc(lamps.shaft, 0.9, 0.55 - k * 0.2);
  disc(lamps.head, 0.9, -0.5); for (let k = 1; k <= 3; k++) { disc(lamps.head, 0.9 + k * 0.17, -0.5 + k * 0.17); disc(lamps.head, 0.9 - k * 0.17, -0.5 + k * 0.17); }
  [[1.55, 0.88], [1.55, -0.88], [0.25, 0.88], [0.25, -0.88]].forEach(([y, z]) => disc(lamps.corner, y, z, 0.11));
  panel.rotation.z = -Math.PI / 2;
  const ram = hydraulic(g, anchor(g, -1.6, 2.66, 0), anchor(panel, -0.1, 0.9, 0), { barrel: 0.6, rb: 0.07, mat: K });
  const wheels = [];
  [1.75, -1.9].forEach((x, i) => [1, -1].forEach((s) => { wheels.push(wheel(g, 0.48, i ? 0.46 : 0.34, x, 0.48, s * 0.88, MT.grey, s)); if (!i) fender(g, 0.58, 0.4, x, 0.48, s * 0.88, Wm, Math.PI * 0.55); }));
  shadows(g); return { g, panel, ram, lamps, wheels };
}

/** Flagger holding a K10 paddle (red on one face, green on the other). Faces +x. Returns { g, paddle, radioArm }. */
function flagger(p, x, z, ry) {
  const f = person(p, x, z, { vest: true, hat: MT.hat, bottom: 0x2f4a8a });
  f.rotation.y = ry; const [armL, armR] = f.userData.arms;
  armL.rotation.z = 0.55; armL.rotation.x = -0.15;
  const pole = grp(armL, 0, -0.38, 0); pole.rotation.z = -0.55;
  rod(pole, new V3(0, -0.55, 0), new V3(0, 0.95, 0), 0.025, MT.dark, 6);
  const paddle = grp(pole, 0, 1.12, 0);
  cylX(paddle, 0.27, 0.025, TM.k10r, 0.015, 0, 0, 24); cylX(paddle, 0.27, 0.025, TM.k10g, -0.015, 0, 0, 24); cylX(paddle, 0.29, 0.02, MT.white, 0, 0, 0, 24);
  // walkie-talkie in the other hand
  const radio = grp(armR, 0, -0.42, 0); rbox(radio, 0.06, 0.16, 0.09, 0.02, MT.black, 0.03, 0.04, -0.02, 0.01); rod(radio, new V3(0.03, 0.1, -0.04), new V3(0.03, 0.24, -0.04), 0.008, MT.black, 4);
  shadows(f); return { g: f, paddle, radioArm: armR };
}

export default {
  id: 'travaux', title: 'La Route', titleHtml: 'La <span>Route</span>',
  subtitle: 'Dans la rue du village, on refait la route : on enlève le vieux goudron, on pose du neuf tout chaud, et on peint les lignes.',
  welcome: 'Bienvenue sur la route du village ! On la refait toute neuve, étape par étape. Touche un engin pour le voir travailler.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la route',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4l3 9h-6zM12 17h8M10 23h12M8 28h16"/><path d="M11 17l-3 11M21 17l3 11"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 58, tufts: false,
  forest: { dark: [0x2f5a2a, 0x3a6a30, 0x284a26, 0x46743a, 0x335f2f], bush: [0x6a8a3a, 0x5a7d34, 0x7a9a44, 0x4f7330] },
  overview: { w: 88, h: 56, focus: [0, 2, 0], az: YAW + 0.6 },
  ground: { base: ['#93b06c', '#74954f', '#4c6a3a'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 200); onUpdate((dt) => fx.update(dt));
    const SF = surfaces();
    freeze(buildVillage(grp(scene), SF));
    const L = (o, x, y, z) => o.localToWorld(new V3(x, y, z));
    const spinner = (obj, wheels) => { let px = obj.position.x; return () => { const dx = obj.position.x - px; px = obj.position.x; if (dx) wheels.forEach((w) => (w.rotation.z -= dx / (w.userData.r || 0.5))); }; };
    const until = async (fn, max) => { let t = 0; while (!fn() && t < max) { await sleep(0.25); t += 0.25; } };
    const LM = { mill: () => texMat(SF.mill, 0xffffff), fresh: () => texMat(SF.asph, 0x6c6c74), comp: () => texMat(SF.asph, 0x4e4e56), closed: () => texMat(SF.asph, 0x45454c, 0.42) };

    /* ---- la raboteuse ---- */
    (function () {
      const st = makeStation('raboteuse'), S = st.g, X0 = -5.5, START = -1, END = 2.5, TRK = 10.1;
      const milled = layer(S, LM.mill(), 0, 3.8, 0.03, 4);
      const R = planer(st, S), m = R.g; st.m = m; st.tracks = R.tracks; m.position.x = START; st.lastX = START;
      const T = tipper(S, TM.red); T.g.position.x = START + TRK; const spinT = spinner(T.g, T.wheels); T.ram.update();
      const lm = T.load.userData.mesh; let fill = 0; const setFill = (f) => { fill = f; T.load.visible = f > 0.02; lm.scale.set(2.1, 0.05 + 0.85 * f, 1.0); }; setFill(0);
      R.slew.rotation.y = 0.35; st.links.forEach((l) => l.update());
      const chunk = R.chunks, U = chunk.userData.u, Z = U.map(() => rnd(-0.22, 0.22));
      const writeChunks = (on) => { U.forEach((u, i) => { dummy.position.set(0.2 + u * 5.1, 0.14, Z[i]); dummy.rotation.set(u * 9, i, 0); dummy.scale.setScalar(on ? 0.09 + (i % 3) * 0.02 : 0.0001); dummy.updateMatrix(); chunk.setMatrixAt(i, dummy.matrix); }); chunk.instanceMatrix.needsUpdate = true; };
      writeChunks(false);
      milled.set(X0, START + R.drumX);
      part(st, 'tambour', 'le tambour à dents', anchor(R.drum, 0, 0.1, 1.15), true);
      part(st, 'tapis', 'le tapis roulant', anchor(R.cv, 3.2, 0.5, 0), true);
      part(st, 'camion', 'le camion', anchor(T.bed, 2.4, 1.5, 1.0), false);
      part(st, 'vieux', 'le vieux goudron', anchor(S, 4.5, 0.15, 1.6), false);
      st.focusAt = anchor(m, 3.2, 1.6, 0); st.size = { w: 19, h: 8 }; st.tagAt = anchor(m, 0, 4.2, 0);
      let T0 = 0, thr = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt); spinT();
        R.drum.rotation.z += dt * (st.rpm || 0);
        if (st.mill) {
          milled.set(X0, m.position.x + R.drumX);
          U.forEach((u, i) => (U[i] = (u + dt * 0.55) % 1)); writeChunks(true);
          if (Math.random() < 0.5) fx.smoke(L(m, R.drumX + 0.6, 0.3, rnd(-1.1, 1.1)), new V3(rnd(-0.3, 0.3), rnd(0.4, 0.9), rnd(0.2, 0.6)), rnd(0.25, 0.45), 0xb8b4aa, 1.1);
          thr -= dt; if (thr <= 0) { thr = 0.09; m.updateMatrixWorld(true); throwClod(L(R.cv, 5.5, 0.1, 0), L(T.bed, 2.0, 1.0, 0), rnd(0.08, 0.16), pick([0x6f6d6a, 0x5a5856, 0x84817c])); }
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(48); st.reversing = true; st.beepT = 0;
          await Promise.all([step('La raboteuse recule pour recommencer.', 'tambour'), to(m.position, 'x', START, 2.6), to(T.g.position, 'x', START + TRK, 2.6), tw(1, (k) => setFill(fill * (1 - k))), to(R.slew.rotation, 'y', 0.35, 2), tw(2.6, () => milled.set(X0, m.position.x + R.drumX))]);
          st.reversing = false; st.done = false;
        }
        engineOn(50);
        await Promise.all([step('Voici la raboteuse. Elle va enlever le vieux goudron tout abîmé.', 'vieux'), sleep(0.6)]);
        await Promise.all([step('Elle tourne son grand tapis roulant au-dessus du camion.', 'tapis'), to(R.slew.rotation, 'y', 0, 2.2, easeSine)]);
        await Promise.all([step('Sous son ventre, un gros tambour plein de dents se met à tourner.', 'tambour'), tw(1.6, (k) => (st.rpm = 14 * k), lin)]);
        st.mill = true;
        await Promise.all([to(m.position, 'x', END, 8, lin), to(T.g.position, 'x', END + TRK, 8, lin), tw(8, (k) => setFill(Math.max(fill, k)), lin),
          (async () => { await step('Elle avance tout doucement, et gratte la vieille route, miette par miette.', 'tambour'); await step('Le tapis roulant envoie tous les morceaux dans le camion.', 'tapis'); })()]);
        st.mill = false; writeChunks(false);
        await Promise.all([step('Le camion est plein ! Ces morceaux seront recyclés pour faire du goudron neuf.', 'camion'), tw(1.5, (k) => (st.rpm = 14 * (1 - k)), lin)]);
        st.rpm = 0; chime(); st.done = true;
      };
    })();

    /* ---- la balayeuse ---- */
    (function () {
      const st = makeStation('balayeuse'), S = st.g, X0 = -5.5, X1 = 5, START = -1.5, END = 2.2, BX = 0.6, SX = -0.75;
      layer(S, LM.mill(), 0, 3.8, 0.025, 4).set(X0, X1);
      const B = sweeper(st, S), m = B.g; st.m = m; st.wheels = B.wheels; m.position.x = START; st.lastX = START;
      // the millings left behind by the planer
      const N = 220, deb = Array.from({ length: N }, () => ({ x: rnd(X0 + 0.2, X1 - 0.2), z: rnd(-1.75, 1.75), s: rnd(0.05, 0.12), r: rnd(0, 6), t: -1 }));
      const dm = new THREE.InstancedMesh(ICO, toonMat({ color: 0xffffff }), N); dm.receiveShadow = true; S.add(dm);
      deb.forEach((c, i) => dm.setColorAt(i, tmpCol.setHex(pick([0x6f6d6a, 0x5a5856, 0x84817c, 0x4a4846]))));
      const reset = () => deb.forEach((c) => (c.t = c.x > START + BX + 0.6 ? -1 : 9));
      const write = () => { deb.forEach((c, i) => { let x = c.x, y = 0.05, z = c.z, s = c.s;
        if (c.t >= 9) s = 0.0001; else if (c.t >= 0) { const k = Math.min(1, c.t / 0.5); x = c.x + (m.position.x + SX - c.x) * k; z = c.z * (1 - k); y = 0.05 + Math.sin(k * Math.PI) * 0.15; s = c.s * (1 - k * 0.8); }
        dummy.position.set(x, y, z); dummy.rotation.set(c.r, c.r * 2, 0); dummy.scale.set(s, s * 0.6, s); dummy.updateMatrix(); dm.setMatrixAt(i, dummy.matrix); }); dm.instanceMatrix.needsUpdate = true; };
      reset(); write();
      part(st, 'brosses', 'les brosses rondes', anchor(B.brushes[0], 0, 0.3, 0.5), true);
      part(st, 'aspirateur', "l'aspirateur", anchor(m, SX, 0.5, 1.1), false);
      part(st, 'cuve', 'la cuve', anchor(m, -1.8, 2.9, 0.8), true);
      part(st, 'morceaux', 'les petits morceaux', anchor(S, 3.6, 0.15, 1.2), false);
      st.focusAt = anchor(m, 0.4, 1.2, 0); st.size = { w: 14, h: 7 }; st.tagAt = anchor(m, 0, 3.8, 0);
      st.update = (dt) => {
        roll(st, dt); B.brushes.forEach((b, i) => (b.rotation.y += dt * (st.rpm || 0) * (i ? 1 : -1)));
        if (st.sweep) {
          const bx = m.position.x + BX + 0.5; let any = false;
          deb.forEach((c) => { if (c.t < 0 && c.x < bx) c.t = 0; if (c.t >= 0 && c.t < 9) { c.t += dt; any = true; if (c.t > 0.5) c.t = 9; } });
          if (any || st.moving) write();
          if (Math.random() < 0.6) { const s = pick([1, -1]); fx.smoke(L(m, BX + 0.2, 0.15, s * 1.25), new V3(rnd(0, 0.5), rnd(0.3, 0.6), s * rnd(0.1, 0.4)), rnd(0.12, 0.22), 0xd8ecff, 0.8); }
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('La balayeuse recule. Oh ! Encore des petits morceaux.', 'morceaux'), to(m.position, 'x', START, 2.6)]);
          reset(); write(); st.reversing = false; st.done = false;
        }
        engineOn(52);
        await Promise.all([step('Après la raboteuse, il reste plein de petits morceaux sur la route.', 'morceaux'), sleep(0.6)]);
        await Promise.all([step('La balayeuse baisse ses brosses rondes, et elles se mettent à tourner.', 'brosses'), ...B.arms.map((a) => to(a.position, 'y', 0.41, 1.2)), tw(1.2, (k) => (st.rpm = 9 * k), lin)]);
        st.sweep = true; st.moving = true;
        await Promise.all([to(m.position, 'x', END, 7, lin),
          (async () => { await step('Les brosses ramènent les morceaux vers le milieu...', 'brosses'); await step("...et un gros aspirateur, sous le camion, avale tout ! Slurp !", 'aspirateur'); await step("Un peu d'eau empêche la poussière de s'envoler.", 'brosses'); })()]);
        st.moving = false; await sleep(0.6); st.sweep = false;
        await Promise.all([step('Tout est rangé dans sa grande cuve. La route est toute propre !', 'cuve'), ...B.arms.map((a) => to(a.position, 'y', 0.55, 1)), tw(1, (k) => (st.rpm = 9 * (1 - k)), lin)]);
        st.rpm = 0; chime(); st.done = true;
      };
    })();

    /* ---- la répandeuse ---- */
    (function () {
      const st = makeStation('repandeuse'), S = st.g, X0 = -7, X1 = 5, START = -2.3, END = 1.5, BAR = -3.95;
      layer(S, LM.mill(), 0, 3.8, 0.025, 4).set(X0, X1);
      const tack = layer(S, TM.tack, 0, 3.8, 0.035, 4).set(X0, START + BAR);
      const P = sprayer(st, S), m = P.g; st.m = m; st.wheels = P.wheels; m.position.x = START; st.lastX = START;
      part(st, 'citerne', 'la citerne bien chaude', anchor(m, -1.0, 3.3, 0.9), true);
      part(st, 'rampe', 'la rampe', anchor(P.bar, 0, 0.0, 1.3), true);
      part(st, 'colle', 'la colle', anchor(S, X0 + 1.5, 0.1, 1.2), false);
      part(st, 'cabine', 'la cabine', anchor(m, 2.0, 2.9, 0.9), false);
      st.focusAt = anchor(m, -0.6, 1.5, 0); st.size = { w: 15, h: 7.5 }; st.tagAt = anchor(m, 0, 4.4, 0);
      st.update = (dt) => {
        roll(st, dt);
        if (st.spray) { tack.set(X0, m.position.x + BAR); for (let i = 0; i < 3; i++) fx.smoke(L(m, BAR, 0.3, rnd(-1.85, 1.85)), new V3(rnd(-0.6, 0), -rnd(1.2, 2), 0), rnd(0.07, 0.12), 0x5a3a24, 0.35); }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Le camion recule pour recommencer.', 'cabine'), to(m.position, 'x', START, 2.6), ...P.wings.map((w, i) => to(w.rotation, 'x', (i ? 1 : -1) * 1.4, 1.5)), tw(2.6, () => tack.set(X0, Math.min(tack.b, m.position.x + BAR)))]);
          st.reversing = false; st.done = false;
        }
        engineOn(50);
        await Promise.all([step('Le camion répandeuse transporte une colle pour la route, bien au chaud dans sa citerne.', 'citerne'), sleep(0.5)]);
        await Promise.all([step("À l'arrière, sa longue rampe se déplie.", 'rampe'), ...P.wings.map((w) => to(w.rotation, 'x', 0, 1.6, easeSine))]);
        st.spray = true;
        await Promise.all([to(m.position, 'x', END, 7, lin),
          (async () => { await step('Il avance doucement, et la rampe pulvérise la colle en toutes petites gouttes.', 'rampe'); await step('On dirait un arrosoir !', 'colle'); })()]);
        st.spray = false;
        await Promise.all([step('Grâce à cette colle, le nouveau goudron va bien rester accroché à la route.', 'colle'), sleep(0.5)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le finisseur (et le camion qui le remplit) ---- */
    (function () {
      const st = makeStation('finisseur'), S = st.g, X0 = -8, X1 = 12, START = -4, END = -1, SCR = -2.95, DOCK = 7.0, AWAY = 9.6;
      layer(S, TM.tack, 0, 3.8, 0.025, 4).set(X0, X1);
      const fresh = layer(S, LM.fresh(), 0, 3.8, 0.04, 4).set(X0, START + SCR);
      const F = paver(st, S), m = F.g; st.m = m; st.tracks = F.tracks; m.position.x = START; st.lastX = START;
      const T = tipper(S, TM.blue); T.g.position.x = START + DOCK + 3; const spinT = spinner(T.g, T.wheels); T.ram.update();
      T.load.userData.mesh.material = TM.hot; const lm = T.load.userData.mesh; const setLoad = (f) => { T.load.visible = f > 0.02; lm.scale.set(2.1, 0.05 + 0.85 * f, 1.0); }; setLoad(1);
      const setHop = (f) => { F.load.visible = f > 0.02; F.load.scale.set(1, Math.max(0.01, f), 1); }; setHop(0.15);
      // two workers with rakes, beside the fresh asphalt
      const rakers = [[-6.0, 1.75, 0.3], [-3.2, -1.6, Math.PI - 0.3]].map(([x, z, ry]) => { const w = worker(S, x, z, ry, MT.hat); const rk = grp(w, 0.25, 0.75, 0.25); rod(rk, new V3(0, 0, 0), new V3(1.1, -0.72, 0), 0.025, MT.wood, 6); rbox(rk, 0.06, 0.08, 0.5, 0.02, MT.dark, 1.12, -0.74, 0, 0.01); return { w, rk }; });
      part(st, 'tremie', 'la trémie', anchor(F.wings[0], 0, 0.6, 0.2), true);
      part(st, 'vis', 'les vis en spirale', anchor(F.augers[0], 0, 0.1, 0.6), false);
      part(st, 'table', 'la table chauffante', anchor(F.exts[0], 0.1, 0.4, 0.6), true);
      part(st, 'camion', 'le camion', anchor(T.bed, 2.4, 1.5, 1.0), false);
      part(st, 'ouvriers', 'les ouvriers et leurs râteaux', anchor(rakers[0].w, 0, 1.5, 0), false);
      part(st, 'enrobe', "l'enrobé tout chaud", anchor(S, X0 + 1.0, 0.1, 0.6), false);
      st.focusAt = anchor(m, 2.2, 1.6, 0); st.size = { w: 17, h: 8 }; st.tagAt = anchor(m, 0, 4.0, 0);
      let T0 = 0, steam = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt); spinT(); T.ram.update();
        T.gate.rotation.z = -T.bed.rotation.z * 1.05;
        F.augers.forEach((a, i) => (a.rotation.z += dt * (st.aug || 0) * (i ? 1 : -1)));
        steam -= dt;
        if (steam <= 0) { steam = st.pave ? 0.07 : 0.35; const x = rnd(Math.max(X0, fresh.b - 4), fresh.b); if (fresh.b > X0 + 0.3) fx.smoke(L(S, x, 0.15, rnd(-1.6, 1.6)), new V3(0, rnd(0.5, 1.0), 0), rnd(0.25, 0.45), 0xeef0f6, 1.6); }
        if (st.pave) fresh.set(X0, m.position.x + SCR);
        if (st.rake) rakers.forEach((r, i) => (r.rk.rotation.y = Math.sin(T0 * 3 + i) * 0.35));
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Le finisseur recule. Un autre camion arrive.', 'camion'), to(m.position, 'x', START, 2.6), to(T.g.position, 'x', START + DOCK + 3, 2.6), tw(2.6, () => fresh.set(X0, Math.min(fresh.b, m.position.x + SCR))), ...F.exts.map((e, i) => to(e.position, 'z', (i ? -1 : 1) * 0.55, 1.5))]);
          setLoad(1); setHop(0.15); st.reversing = false; st.done = false;
        }
        engineOn(46); st.aug = 0;
        st.reversing = true; st.beepT = 0;
        await Promise.all([step("Un camion arrive en marche arrière, plein d'enrobé tout chaud.", 'camion'), to(T.g.position, 'x', START + DOCK, 3, easeSine)]);
        st.reversing = false; thud();
        let pour = true;
        (async () => { while (pour) { m.updateMatrixWorld(true); throwClod(L(T.bed, 0.1, 0.25, rnd(-0.6, 0.6)), L(m, 2.0, 1.0, 0), rnd(0.12, 0.2), pick([0x26262c, 0x303036, 0x1e1e24])); if (Math.random() < 0.4) fx.smoke(L(m, 2.0, 1.2, rnd(-0.6, 0.6)), new V3(0, 1, 0), 0.4, 0xeef0f6, 1.2); await sleep(0.08); } })();
        await Promise.all([step("Il lève sa benne, et verse l'enrobé dans la trémie du finisseur.", 'tremie'), to(T.bed.rotation, 'z', 0.75, 3.4, easeSine), tw(3.4, (k) => { setLoad(1 - k * 0.95); setHop(0.15 + 0.85 * k); }, lin)]);
        pour = false;
        await Promise.all([to(T.bed.rotation, 'z', 0, 2.2, easeSine), to(T.g.position, 'x', END + AWAY, 4, easeSine),
          step("Un tapis emmène l'enrobé vers l'arrière, et des vis en spirale l'étalent sur toute la largeur.", 'vis'), tw(1.5, (k) => (st.aug = 7 * k), lin)]);
        await Promise.all([step("La table s'élargit, juste à la bonne taille.", 'table'), ...F.exts.map((e, i) => to(e.position, 'z', (i ? -1 : 1) * 1.28, 1.6, easeSine))]);
        st.pave = true; st.rake = true;
        await Promise.all([to(m.position, 'x', END, 8, lin), tw(8, (k) => setHop(1 - 0.75 * k), lin),
          (async () => { await step('Le finisseur avance. Sa table chaude lisse le goudron, bien à plat.', 'table'); await step("Attention, c'est très chaud : ça fume !", 'enrobe'); await step('Les ouvriers arrangent les bords avec leurs râteaux.', 'ouvriers'); })()]);
        st.pave = false; st.rake = false; await tw(1.2, (k) => (st.aug = 7 * (1 - k)), lin); st.aug = 0;
        chime(); st.done = true;
      };
    })();

    /* ---- le compacteur tandem ---- */
    (function () {
      const st = makeStation('tandem'), S = st.g, X0 = -4, X1 = 4.5, START = -1.6, END = 1.9, FR = 1.45 + 0.58;
      layer(S, LM.fresh(), 0, 3.8, 0.025, 4).set(X0, X1);
      const comp = layer(S, LM.comp(), 0, 3.8, 0.035, 4).set(X0, START + FR);
      const Rr = tandemRoller(st, S), m = Rr.g; st.m = m; st.wheels = Rr.drums; m.position.x = START; st.lastX = START;
      part(st, 'rouleaux', 'les deux rouleaux', anchor(Rr.drums[0], 0, 0.2, 1.0), true);
      part(st, 'cabine', 'la cabine', anchor(m, 0, 3.1, 0.4), true);
      part(st, 'eau', "l'arrosage", anchor(m, 2.17, 1.15, 0.9), false);
      part(st, 'route', 'le goudron bien tassé', anchor(S, X0 + 1.2, 0.1, 1.2), false);
      st.focusAt = anchor(m, 0, 1.3, 0); st.size = { w: 12, h: 6.5 }; st.tagAt = anchor(m, 0, 3.0, 0);
      let T0 = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt);
        if (st.vib) { comp.set(X0, Math.max(comp.b, m.position.x + FR)); Rr.drums.forEach((d, i) => (d.position.y = Rr.RR + Math.sin(T0 * 70 + i) * 0.02)); }
        else Rr.drums.forEach((d) => (d.position.y = Rr.RR));
        if (st.water && Math.random() < 0.7) { const x = pick(Rr.sprays); fx.smoke(L(m, x, 1.05, rnd(-0.8, 0.8)), new V3(0, -1.4, 0), rnd(0.05, 0.09), 0xcfe8ff, 0.45); }
        if (st.vib && Math.random() < 0.15) fx.smoke(L(m, -2.1, 0.1, rnd(-0.8, 0.8)), new V3(0, 0.7, 0), 0.3, 0xeef0f6, 1.2);
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Le compacteur revient au début.', 'rouleaux'), to(m.position, 'x', START, 2.4), tw(2.4, (k) => comp.set(X0, comp.b + (START + FR - comp.b) * k))]);
          st.reversing = false; st.done = false;
        }
        engineOn(55);
        await Promise.all([step('Le compacteur tandem a deux gros rouleaux en métal, un devant et un derrière.', 'rouleaux'), sleep(0.4)]);
        st.water = true;
        await Promise.all([step("Il mouille ses rouleaux avec un peu d'eau, pour que le goudron ne colle pas.", 'eau'), sleep(1.4)]);
        st.vib = true;
        await Promise.all([to(m.position, 'x', END, 4.5, easeSine), step('Il avance en vibrant très fort, pour bien tasser.', 'rouleaux')]);
        st.reversing = true;
        await Promise.all([to(m.position, 'x', START + 0.8, 3.5, easeSine), step('Puis il recule...', 'rouleaux')]);
        st.reversing = false;
        await Promise.all([to(m.position, 'x', END, 3.5, easeSine), step('...et il repasse encore !', 'rouleaux')]);
        st.vib = false; st.water = false;
        await Promise.all([step('Le goudron est bien serré, tout lisse et tout solide.', 'route'), sleep(0.4)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le compacteur à pneus ---- */
    (function () {
      const st = makeStation('pneus'), S = st.g, X0 = -4.5, X1 = 4.5, START = -1.8, END = 1.8, FR = 1.6 + 0.52;
      layer(S, LM.comp(), 0, 3.8, 0.025, 4).set(X0, X1);
      const closed = layer(S, LM.closed(), 0, 3.8, 0.035, 4).set(X0, START + FR);
      const P = tyreRoller(st, S), m = P.g; st.m = m; st.wheels = P.wheels; m.position.x = START; st.lastX = START;
      part(st, 'pneus', 'les pneus tout lisses', anchor(m, 1.6, 0.4, 1.3), true);
      part(st, 'lest', 'le sable et l’eau', anchor(m, 1.6, 2.3, 0.35), false);
      part(st, 'cabine', 'la cabine', anchor(m, 0, 3.6, 0.4), true);
      part(st, 'route', 'la route bien lisse', anchor(S, X0 + 1.2, 0.1, 1.2), false);
      st.focusAt = anchor(m, 0, 1.6, 0); st.size = { w: 12, h: 7 }; st.tagAt = anchor(m, 0, 5.8, 0);
      let T0 = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt);
        if (st.knead) { closed.set(X0, Math.max(closed.b, m.position.x + FR)); m.position.y = Math.abs(Math.sin(T0 * 9)) * 0.025; P.wheels.forEach((w, i) => (w.scale.y = 1 - Math.abs(Math.sin(T0 * 9 + i)) * 0.03)); }
        else m.position.y = 0;
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Le compacteur à pneus revient au début.', 'pneus'), to(m.position, 'x', START, 2.4), tw(2.4, (k) => closed.set(X0, closed.b + (START + FR - closed.b) * k))]);
          st.reversing = false; st.done = false;
        }
        engineOn(50);
        await Promise.all([step('Ce compacteur roule sur des pneus tout lisses, sans aucun dessin.', 'pneus'), sleep(0.4)]);
        await Promise.all([step('Il est rempli de sable et d’eau, pour être très, très lourd.', 'lest'), to(P.hatch.rotation, 'z', 1.9, 1.2, easeSine)]);
        await to(P.hatch.rotation, 'z', 0, 0.8, easeSine);
        st.knead = true;
        await Promise.all([to(m.position, 'x', END, 4.5, easeSine), step('Ses pneus pétrissent le goudron, comme toi avec la pâte à modeler.', 'pneus')]);
        st.reversing = true;
        await Promise.all([to(m.position, 'x', START + 0.6, 3.2, easeSine), sleep(0.2)]);
        st.reversing = false;
        await to(m.position, 'x', END, 3.2, easeSine);
        st.knead = false; P.wheels.forEach((w) => (w.scale.y = 1));
        await Promise.all([step('Il bouche tous les petits trous : la pluie ne pourra pas entrer dans la route.', 'route'), sleep(0.4)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la traceuse ---- */
    (function () {
      const st = makeStation('traceuse'), S = st.g, X0 = -5, X1 = 4.5, START = -2.5, END = 2.8, GX = 0.75, LZ = -LANE, DL = 1.3, GAP = 1.5;
      layer(S, LM.closed(), 0, 3.8, 0.025, 4).set(X0, X1);
      // little pre-marking dots, then the dashes the gun paints over them
      for (let x = X0 + 0.3; x < X1; x += 0.7) box(S, 0.07, 0.01, 0.07, TM.paint, x, 0.04, LZ);
      const dashes = []; for (let x = X0 + 0.2; x + DL < X1 + 1.2; x += DL + GAP) { const b = box(S, DL, 0.012, 0.15, TM.paint, x + DL / 2, 0.045, LZ); b.userData.x0 = x; dashes.push(b); }
      const show = (gx) => dashes.forEach((b) => { const len = clamp(gx - b.userData.x0, 0, DL); b.visible = len > 0.02; b.scale.x = Math.max(0.01, len); b.position.x = b.userData.x0 + len / 2; });
      const M = marker(st, S), m = M.g; st.m = m; st.wheels = M.wheels; m.position.set(START, 0, LZ + 1.15); st.lastX = START;
      show(START + GX);
      part(st, 'peinture', 'les réservoirs de peinture', anchor(m, 0.05, 1.75, 0.35), true);
      part(st, 'aiguille', "l'aiguille", anchor(m, 2.6, 0.25, -1.15), false);
      part(st, 'pistolet', 'le pistolet', anchor(M.gun, 0, 0.2, 0), true);
      part(st, 'billes', 'les billes de verre', anchor(m, 0.85, 1.35, 0.35), false);
      st.focusAt = anchor(m, 0.4, 1.0, -0.6); st.size = { w: 9, h: 5 }; st.tagAt = anchor(m, 0, 2.4, 0);
      st.update = (dt) => {
        roll(st, dt);
        if (st.paint) {
          const gx = m.position.x + GX; show(gx);
          const on = dashes.some((b) => gx > b.userData.x0 && gx < b.userData.x0 + DL);
          if (on) { fx.smoke(L(M.gun, 0, 0.0, 0), new V3(rnd(-0.3, 0.3), rnd(0.1, 0.4), rnd(-0.2, 0.2)), 0.12, 0xffffff, 0.5); if (Math.random() < 0.6) fx.smoke(L(M.gun, -0.25, 0.0, 0), new V3(0, -0.6, 0), 0.05, 0xd8ecff, 0.4); }
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(60); st.reversing = true; st.beepT = 0;
          await Promise.all([step('La traceuse recule. On efface pour rejouer !', 'pistolet'), to(m.position, 'x', START, 2.4), tw(2.4, () => show(m.position.x + GX))]);
          st.reversing = false; st.done = false;
        }
        engineOn(62);
        await Promise.all([step('La traceuse va peindre les lignes blanches sur la route toute neuve.', 'peinture'), sleep(0.4)]);
        await Promise.all([step('Le conducteur suit les petits points, avec la longue aiguille, devant.', 'aiguille'), to(m.position, 'x', START + 0.4, 1.5, easeSine)]);
        st.paint = true;
        await Promise.all([to(m.position, 'x', END, 7.5, lin),
          (async () => { await step('Pschitt ! Le pistolet peint un trait... puis un espace... puis un trait.', 'pistolet'); await step('Des petites billes de verre tombent sur la peinture. La nuit, la ligne brillera dans les phares !', 'billes'); })()]);
        st.paint = false; chime(); st.done = true;
      };
    })();

    /* ---- le camion flèche lumineuse ---- */
    (function () {
      const st = makeStation('fleche'), S = st.g, START = -3;
      const A = arrowTruck(st, S), m = A.g; st.m = m; st.wheels = A.wheels; m.position.x = START; st.lastX = START; st.links.push(A.ram); A.ram.update();
      st.az = YAW - 0.85;
      part(st, 'panneau', 'le grand panneau', anchor(A.panel, -0.1, 1.75, 0.9), true);
      part(st, 'fleche', 'la flèche orange', anchor(A.panel, -0.15, 0.9, -0.5), false);
      part(st, 'gyrophares', 'les gyrophares', anchor(m, 2.1, 3.1, 0.7), false);
      part(st, 'camion', 'le camion', anchor(m, 0.5, 2.0, -1.1), true);
      st.focusAt = anchor(m, -0.8, 1.8, 0); st.size = { w: 12, h: 7.5 }; st.tagAt = anchor(m, 0, 5.4, 0);
      let T0 = 0;
      st.update = (dt) => {
        T0 += dt; roll(st, dt);
        const on = st.lit ? 1 : 0, ph = (T0 * 1.1) % 1;
        A.lamps.shaft.emissiveIntensity = on * (ph < 0.75 ? 2.2 : 0); A.lamps.head.emissiveIntensity = on * (ph > 0.3 && ph < 0.75 ? 2.2 : 0);
        A.lamps.corner.emissiveIntensity = on * ((T0 * 2.2) % 1 < 0.5 ? 2.4 : 0);
      };
      st.action = async function () {
        if (st.done) {
          st.lit = false;
          await Promise.all([step('Le camion replie son panneau et recule.', 'panneau'), to(A.panel.rotation, 'z', -Math.PI / 2, 2, easeSine)]);
          engineOn(46); st.reversing = true; st.beepT = 0; await to(m.position, 'x', START, 2.4); st.reversing = false; st.done = false;
        }
        engineOn(55);
        await Promise.all([step('Ce camion protège le chantier. Il se gare juste avant les ouvriers.', 'camion'), to(m.position, 'x', 0, 3.4, easeSine)]);
        engineOff();
        await Promise.all([step('Il lève son grand panneau, tout derrière.', 'panneau'), to(A.panel.rotation, 'z', 0, 2.6, easeSine)]);
        st.lit = true; ding();
        await Promise.all([step("Une grosse flèche orange s'allume et clignote.", 'fleche'), sleep(2)]);
        await Promise.all([step('Elle dit aux voitures : attention, chantier ! Passez de l’autre côté.', 'fleche'), sleep(1.5)]);
        chime(); st.done = true;
      };
      st.lit = true; A.panel.rotation.z = 0; m.position.x = 0; st.lastX = 0; st.done = true; // already working when we arrive
    })();

    /* ---- le signaleur (and the alternating traffic it controls) ---- */
    const TR = { phase: 0, last: -1, t: 0, manual: false, gap: 0 };
    let FR = null;
    (function () {
      const st = makeStation('signaleur'), S = st.g;
      const F = flagger(S, 0, -1.45, 0); FR = F; st.m = F.g;
      // a work sign and a few cones around him
      akSign(S, 1.6, 3.3, 0); [[-1.0, -1.1], [1.2, -1.15], [2.6, -1.2]].forEach(([x, z]) => cone(S, x, z));
      part(st, 'panneau', 'le panneau K10', anchor(F.paddle, 0, 0.35, 0), true);
      part(st, 'signaleur', 'le signaleur', anchor(F.g, 0, 1.45, 0), false);
      part(st, 'talkie', 'le talkie-walkie', anchor(F.radioArm, 0, -0.42, 0), false);
      part(st, 'voitures', 'les voitures', anchor(S, 4.5, 1.6, -LANE * 2), true);
      st.az = YAW + 0.6; st.focus = new V3(2.6, 1.0, -2.2); st.size = { w: 13, h: 7 }; st.tagAt = anchor(F.g, 0, 2.6, 0);
      const clear = () => cars.every((c) => c.state !== 'go' || c.dir * c.h > 50);
      st.action = async function () {
        TR.manual = true; TR.phase = 0;
        await Promise.all([step("Sur cette route, il ne reste qu'un seul côté pour passer.", 'voitures'), until(clear, 14)]);
        await step('Le signaleur montre le côté rouge de son panneau : stop ! Les voitures attendent.', 'panneau');
        await Promise.all([step('Il parle à son collègue, au bout du chantier, avec son talkie-walkie.', 'talkie'), to(F.radioArm.rotation, 'z', 2.6, 0.8, easeSine)]);
        await to(F.radioArm.rotation, 'z', 0, 0.6, easeSine);
        TR.phase = -1; TR.gap = 0; ding();
        await Promise.all([step('Il tourne son panneau : vert ! Les voitures passent, chacune leur tour.', 'panneau'), sleep(5)]);
        TR.phase = 0;
        await Promise.all([step("Puis il remet le rouge. Ce sera bientôt au tour des voitures d'en face.", 'panneau'), until(clear, 14)]);
        TR.last = -1; TR.t = 0; TR.manual = false; chime();
      };
    })();

    /* ---- traffic on the open lane, one way at a time ---- */
    const FL = flagger(grp(scene), 0, 0, 0); { const [x, z] = Q(-47.5, 0.45); FL.g.position.set(x, 0, z); FL.g.rotation.y = YAW + Math.PI; }
    const cars = Array.from({ length: 7 }, (_, i) => { const o = miniCar(scene, pick(['car', 'car', 'van', 'kei'])); return { o, dir: i < 4 ? -1 : 1, h: 0, v: 0, state: 'queue' }; });
    const qs = { '-1': cars.filter((c) => c.dir < 0), '1': cars.filter((c) => c.dir > 0) };
    const slot = (dir, i) => (dir > 0 ? -49.6 - i * 3.6 : 50 + i * 3.6);
    Object.values(qs).forEach((q) => q.forEach((c, i) => (c.h = slot(c.dir, i))));
    const placeCar = (c) => { const [x, z] = Q(c.h, -LANE); c.o.position.set(x, 0, z); c.o.rotation.y = c.dir > 0 ? YAW : YAW + Math.PI; c.o.visible = Math.abs(c.h) < 56.5; };
    onUpdate((dt) => {
      TR.gap -= dt; TR.t += dt;
      if (!TR.manual) {
        if (TR.phase !== 0) { if (TR.t > 13 || (!qs[TR.phase].length && TR.t > 2)) { TR.phase = 0; TR.t = 0; } }
        else if (TR.t > 1.5 && cars.every((c) => c.state !== 'go' || c.dir * c.h > 50)) { TR.phase = -TR.last; TR.last = TR.phase; TR.t = 0; TR.gap = 0.8; }
      }
      [1, -1].forEach((dir) => {
        const q = qs[dir];
        q.forEach((c, i) => {
          const target = slot(dir, i), dh = target - c.h, sp = Math.min(4.5, Math.abs(dh) * 1.6 + 0.3);
          c.v = Math.abs(dh) > 0.02 ? sp : 0; c.h += Math.sign(dh) * Math.min(Math.abs(dh), sp * dt);
        });
        const head = q[0];
        if (head && TR.phase === dir && TR.gap <= 0 && Math.abs(head.h - slot(dir, 0)) < 0.25) { q.shift(); head.state = 'go'; head.v = 1; TR.gap = 1.7; }
      });
      cars.forEach((c) => {
        if (c.state === 'go') { c.v = Math.min(5.5, c.v + dt * 3); c.h += c.dir * c.v * dt; if (c.dir * c.h > 64) { c.dir = -c.dir; c.state = 'queue'; qs[c.dir].push(c); } }
        placeCar(c); const wh = c.o.userData.wheels; if (wh && c.v) wh.forEach((w) => (w.rotation.z -= (c.v * dt) / 0.24));
      });
      // the paddles show green to the side whose turn it is
      const turn = (p, tgt) => { p.rotation.y += clamp(tgt - p.rotation.y, -dt * 5, dt * 5); };
      turn(FL.paddle, TR.phase === 1 ? Math.PI : 0); if (FR) turn(FR.paddle, TR.phase === -1 ? Math.PI : 0);
    });

    buildLife(scene, onUpdate);
  }
};

/* ================= the village street around the works ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
const VM = {
  walls: [0xf1e6d2, 0xe9d6b4, 0xf3eee4, 0xe6c9a8, 0xd8c8b0, 0xf0dcc0].map((c) => toonMat({ color: c })),
  tile: toonMat({ color: 0xc0583a }), slate: toonMat({ color: 0x5a6070 }), tileD: toonMat({ color: 0x9a4430 }),
  shutters: [0x4f7fc0, 0x5a9a6a, 0xc0584a, 0x8aa0b0, 0x2f6a5a].map((c) => toonMat({ color: c })),
  win: toonMat({ color: 0x2c3e5a }), door: toonMat({ color: 0x6b3b2a }), sill: toonMat({ color: 0xf6f3ec }), stone: toonMat({ color: 0xb0a690 }),
  plinth: toonMat({ color: 0x9a9284 }), hedge: toonMat({ color: 0x3f7a3a }), grass: toonMat({ color: 0x6f9a4a }), curb: toonMat({ color: 0xd8d4cc }),
  awn: toonMat({ color: 0xd8302a }), white: toonMat({ color: 0xf6f6f2 }), dark: toonMat({ color: 0x2b3040 }), wood: toonMat({ color: 0x9a6a40 }),
  church: toonMat({ color: 0xd8ccb0 }), metal: toonMat({ color: 0x7a8090 }), red: toonMat({ color: 0xd8302a }), blue: toonMat({ color: 0x2f4fa8 }), yel: toonMat({ color: 0xf2b21c })
};
/** Village house; facade towards local +z. */
function house(g, w, dp, floors, o = {}) {
  const H = floors * 2.6 + 0.3, wall = o.wall || pick(VM.walls), roof = o.roof || (Math.random() < 0.7 ? VM.tile : VM.slate), sh = o.sh || pick(VM.shutters);
  rbox(g, w, H, dp, 0.04, wall, 0, H / 2, 0, 0.02); rbox(g, w + 0.06, 0.45, dp + 0.06, 0.02, VM.plinth, 0, 0.22, 0, 0.01);
  const r = grp(g, 0, H, 0); r.rotation.y = Math.PI / 2; ext(r, [[-dp / 2 - 0.35, -0.05], [dp / 2 + 0.35, -0.05], [0, dp * 0.42]], 0.02, w + 0.5, roof, 0, 0, 0, 0.03);
  rbox(g, 0.5, 1.4, 0.5, 0.02, VM.stone, w * 0.3, H + dp * 0.3, -dp * 0.15, 0.02);
  const n = Math.max(1, Math.floor(w / 1.5)), sx = w / n;
  for (let f = 0; f < floors; f++) for (let i = 0; i < n; i++) {
    const x = -w / 2 + sx * (i + 0.5), y = 1.35 + f * 2.6;
    if (f === 0 && i === Math.floor(n / 2) && !o.shop) { box(g, 0.9, 1.9, 0.08, VM.door, x, 0.95 + 0.1, dp / 2 + 0.02); box(g, 1.1, 0.12, 0.4, VM.stone, x, 0.06, dp / 2 + 0.2); continue; }
    if (f === 0 && o.shop) continue;
    box(g, 0.62, 0.95, 0.06, VM.win, x, y, dp / 2 + 0.02); box(g, 0.74, 0.08, 0.16, VM.sill, x, y - 0.52, dp / 2 + 0.06);
    box(g, 0.04, 0.95, 0.07, VM.sill, x, y, dp / 2 + 0.04);
    [-1, 1].forEach((s) => box(g, 0.32, 0.98, 0.06, sh, x + s * 0.5, y, dp / 2 + 0.05));
  }
  if (o.shop) {
    box(g, w * 0.55, 1.5, 0.08, VM.win, -w * 0.15, 1.35, dp / 2 + 0.02); box(g, 0.9, 1.9, 0.08, VM.door, w * 0.33, 1.05, dp / 2 + 0.02);
    for (let i = 0; i < 7; i++) { const s = box(g, w / 7, 0.08, 1.1, i % 2 ? VM.white : o.shop, -w / 2 + (w / 7) * (i + 0.5), 2.35, dp / 2 + 0.5); s.rotation.x = 0.35; }
    box(g, w * 0.6, 0.35, 0.08, VM.dark, 0, 2.75, dp / 2 + 0.04);
  }
  return g;
}
/** Triangular road-works sign (AK5) on its stand, face towards local +x. */
function akSign(p, x, z, ry) {
  const g = grp(p, x, 0, z); g.rotation.y = ry;
  rod(g, new V3(0, 0, 0.35), new V3(0, 1.6, 0), 0.03, MT.dark, 6); rod(g, new V3(0, 0, -0.35), new V3(0, 1.6, 0), 0.03, MT.dark, 6); rod(g, new V3(-0.4, 0, 0), new V3(0, 1.6, 0), 0.03, MT.dark, 6);
  const t = grp(g, 0.05, 1.6, 0); t.rotation.y = Math.PI / 2;
  ext(t, [[-0.5, -0.32], [0.5, -0.32], [0, 0.55]], 0.06, 0.04, MT.red, 0, 0, 0, 0.01);
  ext(t, [[-0.38, -0.25], [0.38, -0.25], [0, 0.4]], 0.04, 0.05, MT.white, 0, 0, 0.01, 0.005);
  // the little worker with his shovel
  const k = grp(t, 0, 0, 0.04); sph(k, 0.045, MT.black, -0.02, 0.12, 0); const b = box(k, 0.07, 0.18, 0.02, MT.black, 0, 0.0, 0); b.rotation.z = -0.3; rod(k, new V3(0.02, 0.02, 0), new V3(0.18, -0.15, 0), 0.012, MT.black, 4); box(k, 0.2, 0.05, 0.02, MT.black, 0.14, -0.2, 0);
  shadows(g); return g;
}
function buildVillage(scene, SF) {
  // the road itself: old asphalt everywhere (the stations lay their new layers on top), kerbs, faded old lines
  const R = at(scene, 0, 0); layer(R, texMat(SF.old, 0xffffff), 0, 7.6, 0.012, 8).set(-66, 66);
  [3.85, -3.85].forEach((z) => rbox(R, 132, 0.14, 0.2, 0.02, VM.curb, 0, 0.07, z, 0.01));
  for (let x = -64; x < 64; x += 4) if (Math.abs(x) > 47) box(R, 2, 0.01, 0.14, std(0xcfcfc8, 0.8, 0), x, 0.02, 0);
  box(R, 132, 0.01, 0.12, std(0xcfcfc8, 0.8, 0), 0, 0.02, -3.55);
  [[-30, -0.7], [10, -2.6], [36, -1.2]].forEach(([x, z]) => cylY(R, 0.35, 0.02, MT.dark, x, 0.022, z, 16)); // manholes
  // houses behind the road (facades towards the street), with front gardens
  const back = [[-50, 7, 'n'], [-41.5, 6.5], [-33, 7.5, 'bakery'], [-24.5, 6], [-17, 6.5], [9.5, 7, 'cafe'], [18, 6.5], [26, 7], [34, 6], [42, 7.5], [50, 6]];
  back.forEach(([h, w, kind]) => {
    const g = at(scene, h, -11.5); house(g, w, 5, kind === 'n' ? 1 : 2, kind === 'bakery' ? { shop: VM.awn } : kind === 'cafe' ? { shop: VM.blue } : {});
    if (!kind) { rbox(g, w + 0.8, 0.6, 0.3, 0.04, VM.stone, 0, 0.3, 5.1, 0.02); rbox(g, w * 0.35, 0.7, 0.5, 0.15, VM.hedge, -w * 0.28, 0.65, 4.7, 0.05); }
  });
  // café terrace and bakery bench
  [[8.2, -7.3], [10.8, -7.3]].forEach(([h, d]) => { const g = at(scene, h, d); cylY(g, 0.35, 0.05, VM.white, 0, 0.75, 0, 12); cylY(g, 0.04, 0.75, VM.dark, 0, 0.37, 0, 6); cylY(g, 0.04, 2.0, VM.metal, 0, 1.0, 0, 6); add(g, new THREE.ConeGeometry(1.1, 0.45, 10), VM.awn, 0, 2.1, 0); [-0.55, 0.55].forEach((x) => { rbox(g, 0.35, 0.05, 0.35, 0.02, VM.wood, x, 0.45, 0, 0.01); rbox(g, 0.05, 0.4, 0.35, 0.02, VM.wood, x + Math.sign(x) * 0.17, 0.65, 0, 0.01); }); });
  { const g = at(scene, -33, -7.2); rbox(g, 1.6, 0.08, 0.4, 0.02, VM.wood, 0, 0.45, 0, 0.01); rbox(g, 1.6, 0.4, 0.06, 0.02, VM.wood, 0, 0.7, -0.2, 0.01); }
  // the church on its square, and the town hall with its flag
  { const g = at(scene, -4, -21);
    rbox(g, 6, 5, 11, 0.05, VM.church, 0, 2.5, -1, 0.02); const r = grp(g, 0, 5, -1); ext(r, [[-3.5, -0.05], [3.5, -0.05], [0, 2.6]], 0.02, 11.4, VM.slate, 0, 0, 0, 0.03);
    rbox(g, 3, 9, 3, 0.05, VM.church, 0, 4.5, 5.6, 0.02); add(g, new THREE.ConeGeometry(2.3, 5, 4), VM.slate, 0, 11.5, 5.6).rotation.y = Math.PI / 4;
    rod(g, new V3(0, 14, 5.6), new V3(0, 15.2, 5.6), 0.05, VM.dark); box(g, 0.6, 0.06, 0.06, VM.dark, 0, 14.8, 5.6);
    cylZ(g, 0.6, 0.1, VM.white, 0, 7.4, 7.12, 20); box(g, 1.2, 2.2, 0.08, VM.door, 0, 1.3, 7.12); add(g, new THREE.CylinderGeometry(0.6, 0.6, 0.08, 16, 1, false, 0, Math.PI), VM.door, 0, 2.4, 7.12).rotation.x = Math.PI / 2;
    [-1.5, 1.5].forEach((x) => box(g, 0.5, 1.6, 0.06, VM.win, x * 1.5, 3, 4.52)); }
  { const g = at(scene, 0.5, -11.5); house(g, 8, 5.5, 2, { wall: VM.walls[2], roof: VM.slate, sh: VM.shutters[3] }); rbox(g, 1.2, 1.0, 0.3, 0.05, VM.white, 0, 5.4, 2.8, 0.02); cylZ(g, 0.32, 0.06, VM.dark, 0, 5.4, 2.97, 16);
    rod(g, new V3(2.6, 0, 3.6), new V3(2.6, 6.5, 3.6), 0.04, VM.metal); [VM.blue, VM.white, VM.red].forEach((m, i) => box(g, 0.45, 0.8, 0.03, m, 2.85 + i * 0.45, 6.0, 3.6)); }
  // plane trees and lamps along the back pavement
  [-45.5, -28.5, -13, 5, 14, 22, 30, 38, 46].forEach((h, i) => { const [x, z] = Q(h, -7.2); autumnTree(scene, x, z, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6a9a3a, 0x4a7a3a, 0x7aaa4a]); });
  [-52, -37, -21, -8, 26, 42].forEach((h) => { const [x, z] = Q(h, -6.5); lamp(scene, x, z, YAW + Math.PI / 2); });
  // bus shelter
  { const g = at(scene, -21, -5.9); rbox(g, 2.6, 0.08, 1.1, 0.02, VM.metal, 0, 2.3, 0, 0.01); [-1.25, 1.25].forEach((x) => box(g, 0.06, 2.3, 0.06, VM.metal, x, 1.15, -0.5)); box(g, 2.5, 1.8, 0.03, MT.glass, 0, 1.3, -0.52); rbox(g, 2.0, 0.06, 0.35, 0.02, VM.wood, 0, 0.5, -0.3, 0.01); }
  // front side: grass verge, hedges, the site base, small houses further away
  [[-40, 9.5, 14], [-6, 9.5, 18], [20, 9.5, 14], [44, 9.5, 10]].forEach(([h, d, w]) => { const g = at(scene, h, d); rbox(g, w, 0.8, 0.8, 0.3, VM.hedge, 0, 0.45, 0, 0.08); });
  [[-46, 20, 7], [-12, 22, 8], [10, 21, 7], [28, 22, 8], [44, 19, 6.5]].forEach(([h, d, w]) => { const g = at(scene, h, d, YAW + Math.PI); house(g, w, 5, 1); });
  [[-52, 14], [-30, 18], [4, 16], [24, 15], [36, 18], [52, 13], [-18, 25], [16, 27]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(scene, x, z, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x7aa83a, 0x5a8a3a, 0x8aba4a]); });
  // site base: the hut, toilets, a container, piles of sand and gravel, spare cones and barriers
  { const g = at(scene, -24, 14.5, YAW + Math.PI);
    rbox(g, 6, 2.6, 2.4, 0.06, std(0xf4f5f8, 0.6, 0), 0, 1.4, 0, 0.02); rbox(g, 6.1, 0.15, 2.5, 0.03, MT.dark, 0, 0.08, 0, 0.01); rbox(g, 6.1, 0.12, 2.5, 0.03, MT.orange, 0, 2.72, 0, 0.01);
    for (let x = -2.4; x <= 2.4; x += 1.6) box(g, 0.9, 0.8, 0.05, VM.win, x, 1.6, 1.22); box(g, 0.9, 1.9, 0.05, std(0x2f6fe0, 0.6, 0), 2.6, 1.1, 1.22);
    rbox(g, 1.0, 0.3, 0.6, 0.04, MT.dark, 2.6, 0.15, 1.6, 0.01);
    rbox(g, 1.1, 2.2, 1.1, 0.08, std(0x2f9a5a, 0.6, 0), -4.0, 1.1, 0.2, 0.02); rbox(g, 1.2, 0.1, 1.2, 0.04, MT.white, -4.0, 2.25, 0.2, 0.01);
    rbox(g, 5.5, 2.4, 2.3, 0.06, std(0x2f6fe0, 0.6, 0.1), 1.0, 1.2, -3.6, 0.02); for (let x = -1.5; x <= 3.5; x += 0.35) box(g, 0.05, 2.2, 2.36, std(0x2556b8, 0.6, 0.1), x, 1.2, -3.6);
  }
  [[-16, 14, 0xd8c08a, 1.1], [-13, 15.5, 0x8a8e96, 1.0], [-30.5, 12.5, 0x6f6d6a, 0.9]].forEach(([h, d, c, s]) => { const [x, z] = Q(h, d); const m = add(scene, new THREE.ConeGeometry(1.6, 1.3, 10), toonMat({ color: c }), x, 0.65 * s, z); m.scale.setScalar(s); });
  for (let i = 0; i < 6; i++) { const [x, z] = Q(-19.5 + (i % 3) * 0.7, 12 + Math.floor(i / 3) * 0.7); for (let k = 0; k < 3; k++) add(scene, new THREE.ConeGeometry(0.28, 0.75, 10), C.orange, x, 0.4 + k * 0.14, z); }
  // the works: cones along the lane line, barriers at both ends, road-works signs
  for (let h = -45; h <= 45; h += 3) { const [x, z] = Q(h, -0.35); cone(scene, x, z); }
  [[-47.5, 1.3], [-47.5, 3.0], [46.6, 2.2], [46.6, 3.5]].forEach(([h, d]) => { const [x, z] = Q(h, d); barrier(scene, x, z, -Math.PI / 4); });
  { const [x, z] = Q(-57, 5.4); akSign(scene, x, z, YAW + Math.PI); }
  { const [x, z] = Q(52, -5.4); akSign(scene, x, z, YAW); }
  return scene;
}

/* ================= life: people on the pavements ================= */
function buildLife(scene, onUpdate) {
  const R = (pts, t = 0.05) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const back = R([[-54, -4.6], [54, -4.6], [54, -5.6], [-54, -5.6]]);
  const front = R([[-44, 4.6], [44, 4.6], [44, 5.6], [-44, 5.6]]);
  const ppl1 = Array.from({ length: 8 }, (_, i) => person(scene, 0, 0, { kid: i % 4 === 1 }));
  const ppl2 = Array.from({ length: 5 }, (_, i) => person(scene, 0, 0, { kid: i === 2 }));
  const t1 = traffic(back, ppl1, 1.1, { gap: 0.9 }), t2 = traffic(front, ppl2, 1.0, { gap: 0.9 });
  // a grandad and a child watching the big machines
  [[29, 6.6, 0.75, false], [30, 6.7, 0.75, true]].forEach(([h, d, s, kid]) => { const p = person(scene, ...Q(h, d), { kid }); p.rotation.y = YAW + Math.PI / 2; void s; });
  // a dog trotting with its owner
  const all = [...ppl1, ...ppl2];
  onUpdate((dt) => { t1.update(dt, all); t2.update(dt, all); });
}
