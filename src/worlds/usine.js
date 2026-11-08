// L'Usine — a car factory: a car is built step by step, from a steel coil to the truck that takes it to the garages.
// Cut-away hall (no roof over the machines), yellow floor markings, robots, workers, and a parking of new cars outside.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone, beep } from '../kit/audio.js';
import { MT, std, toonMat, add, box, grp, cylGeo, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, freeze } from '../kit/geo.js';
import { tire, operator, beacon, truckCab, hydraulic, fender } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp, autumnTree } from '../kit/props.js';
import { route, placeOn, person, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };

/* ---------- palette (shared materials) ---------- */
const UM = {
  orange: std(0xf26a1a, 0.36, 0.2), rgrey: std(0x3f4452, 0.5, 0.4), white: std(0xf2f3f6, 0.35, 0.1), cream: std(0xeee6d4, 0.85, 0),
  blue: std(0x2f6fe0, 0.4, 0.2), blueD: std(0x2450b0, 0.45, 0.2), yel: std(0xf2b21c, 0.4, 0.2), yelD: std(0xc88a10, 0.5, 0.2),
  red: std(0xe0402a, 0.4, 0.15), green: std(0x3aa46a, 0.45, 0.1), dark: std(0x2a2f40, 0.6, 0.1), bare: std(0xb4bcc8, 0.28, 0.9),
  sheet: std(0xdde4ee, 0.16, 1), copper: std(0xd48a4a, 0.3, 0.8), wood: std(0xc8965a, 0.85, 0), alu: std(0xc9ced8, 0.35, 0.6),
  floor: std(0x6a7080, 0.85, 0.1), grate: std(0x4a505e, 0.7, 0.3), inside: std(0x50545f, 0.7, 0.2), light: std(0xd8dce4, 0.4, 0.2),
  mesh: std(0x2a3040, 0.95, 0, { transparent: true, opacity: 0.16, depthWrite: false }),
  glass: std(0x9ad4f4, 0.05, 0.3, { transparent: true, opacity: 0.22, depthWrite: false }),
  win: std(0x8cc4ec, 0.12, 0.3), asphalt: std(0x4a4e5e, 0.9, 0), roof: std(0xa8aebc, 0.6, 0.3),
  ledB: toonMat({ color: 0x6ab8ff, emissive: 0x3a98ff, emissiveIntensity: 1.2 }), ledG: toonMat({ color: 0x6aff8a, emissive: 0x20d040, emissiveIntensity: 1 }),
  ledR: toonMat({ color: 0xff6a5a, emissive: 0xff2a10, emissiveIntensity: 1 }), glow: toonMat({ color: 0xffa040, emissive: 0xff7a1a, emissiveIntensity: 1.4 })
};
const CARC = [0xe5302a, 0x2f7de0, 0xf2c21c, 0x3ab46a, 0xf4f5f8, 0xf07a2a, 0xe86aa8, 0x24b6c8, 0x8a5ad8];
const CARM = CARC.map((c) => std(c, 0.24, 0.35));
const bake = (g) => { shadows(g); freeze(g); return g; };

const DATA = {
  pont: { short: 'Le pont roulant', full: 'Le pont roulant', verb: 'Soulever', horn: 'bell',
    use: 'Une grue accrochée tout en haut, pour soulever les choses très lourdes.',
    how: 'Il roule sur deux grandes poutres, au-dessus de tout le monde. Son crochet monte et descend avec des câbles.' },
  presse: { short: 'La presse', full: "La presse d'emboutissage", verb: 'Emboutir', horn: 'horn',
    use: "Elle transforme une feuille d'acier toute plate en morceau de voiture.",
    how: "Elle appuie très, très fort, d'un seul coup : boum ! La feuille prend la forme du moule, comme de la pâte à modeler." },
  soudeurs: { short: 'Les robots soudeurs', full: 'Les robots soudeurs', verb: 'Souder', horn: 'bell',
    use: 'Ces grands bras orange assemblent les pièces de la voiture.',
    how: 'Ils ont une épaule, un coude et un poignet, comme ton bras ! Au bout, une pince chauffe le métal pour coller les pièces.' },
  peinture: { short: 'La peinture', full: 'La cabine de peinture', verb: 'Peindre', horn: 'bell',
    use: 'Ici, la voiture toute grise devient toute colorée.',
    how: 'Des robots peintres soufflent la peinture en un nuage très fin. Ensuite, la voiture passe au four pour sécher.' },
  montage: { short: 'Le montage', full: 'La chaîne de montage', verb: 'Monter', horn: 'horn',
    use: 'Ici, on met le moteur et les roues dans la voiture.',
    how: 'La voiture avance, accrochée au plafond. Le moteur monte par en dessous, et les ouvriers vissent les roues.' },
  agv: { short: 'Le robot AGV', full: 'Le robot autonome', verb: 'Livrer', horn: 'bell',
    use: 'Un petit robot tout plat qui apporte les pièces, sans chauffeur.',
    how: "Il suit une ligne dessinée par terre. Ses capteurs voient les gens, et il s'arrête pour ne pas les toucher." },
  chariot: { short: 'Le chariot élévateur', full: 'Le chariot élévateur', verb: 'Ranger', horn: 'horn',
    use: 'Il transporte les palettes et les range tout en haut.',
    how: "Ses deux fourches glissent sous la palette, et son mât monte comme un ascenseur. Derrière, un gros poids l'empêche de basculer." },
  camion: { short: 'Le porte-voitures', full: 'Le camion porte-voitures', verb: 'Charger', horn: 'horn',
    use: 'Il emmène les voitures toutes neuves jusqu’aux garages.',
    how: 'Il a deux étages, comme un bus à étages. Les voitures montent par les rampes, à l’arrière.' }
};
const ORDER = ['pont', 'presse', 'soudeurs', 'peinture', 'montage', 'agv', 'chariot', 'camion'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const CAR = (x, y, s, col) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 20V12q2-6 9-6h12l9-10h18q8 0 10 10v14z" fill="${col}"/>`;
const ICONS = {
  pont: `<rect class="c" x="6" y="18" width="6" height="58"/><rect class="c" x="108" y="18" width="6" height="58"/><rect class="y" x="2" y="10" width="116" height="9" rx="2"/><rect class="k" x="48" y="19" width="24" height="8" rx="2"/><path class="ln" d="M56 27v18M64 27v18"/><rect class="y" x="53" y="44" width="14" height="7" rx="2"/><path class="ln" d="M60 51v5"/><circle class="s" cx="60" cy="65" r="10"/><circle class="k" cx="60" cy="65" r="3.5"/>`,
  presse: GND + `<rect class="b" x="20" y="4" width="80" height="18" rx="3"/><rect class="b" x="24" y="22" width="11" height="40"/><rect class="b" x="85" y="22" width="11" height="40"/><rect class="y" x="37" y="24" width="46" height="12" rx="1"/><rect class="k" x="40" y="36" width="40" height="5"/><path class="ln" d="M60 42v8M56 46l4 4 4-4"/><path d="M42 57h36" stroke="#c9d2e0" stroke-width="4" stroke-linecap="round"/><rect class="b" x="18" y="60" width="84" height="15" rx="2"/>`,
  soudeurs: GND + `<rect class="k" x="12" y="66" width="24" height="9" rx="2"/><path d="M24 64L32 36L64 30" fill="none" stroke="#f26a1a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="36" r="5" fill="#3f4452"/><path d="M64 30l8 12" stroke="#3f4452" stroke-width="5" stroke-linecap="round"/>${CAR(56, 55, 1, '#c4cad4')}<g fill="#ffc24a"><circle cx="74" cy="46" r="2.6"/><circle cx="80" cy="41" r="1.8"/><circle cx="70" cy="40" r="1.6"/><circle cx="82" cy="49" r="1.5"/></g>`,
  peinture: GND + `${CAR(44, 55, 1.05, '#e5302a')}<circle class="k" cx="56" cy="75" r="5"/><circle class="k" cx="94" cy="75" r="5"/><path d="M10 74L18 40L40 30" fill="none" stroke="#e9ecf2" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 30l6 6" stroke="#8f96a6" stroke-width="5" stroke-linecap="round"/><g fill="#ff7a6a" opacity=".75"><circle cx="54" cy="42" r="5"/><circle cx="62" cy="48" r="4"/><circle cx="58" cy="36" r="3"/><circle cx="66" cy="41" r="3"/></g>`,
  montage: `<rect class="k" x="0" y="6" width="120" height="5"/><path class="ln" d="M30 11v32M90 11v32M28 43h64"/>${CAR(26, 44, 1.05, '#2f7de0')}<rect class="s" x="44" y="62" width="18" height="9" rx="2"/><path class="ln" d="M53 71v6"/><circle class="k" cx="100" cy="66" r="7"/><circle class="s" cx="100" cy="66" r="3"/>`,
  agv: `<path d="M0 76H120" stroke="#f2c21c" stroke-width="3" stroke-dasharray="10 5"/><rect x="14" y="54" width="92" height="16" rx="6" fill="#d8dce4" stroke="#8f96a6" stroke-width="2"/><rect x="18" y="62" width="84" height="3" fill="#3a98ff"/><rect class="b" x="26" y="34" width="22" height="20" rx="2"/><rect class="r" x="52" y="38" width="20" height="16" rx="2"/><rect class="y" x="76" y="40" width="18" height="14" rx="2"/><rect class="k" x="100" y="50" width="6" height="5" rx="1"/>`,
  chariot: GND + `<rect x="14" y="44" width="50" height="22" rx="4" fill="#f2b21c"/><rect class="k" x="8" y="40" width="14" height="26" rx="3"/><path class="ln" d="M24 44V18h30v26"/><rect class="k" x="66" y="12" width="6" height="58"/><path d="M72 62h34" stroke="#2a2f40" stroke-width="4"/><rect class="d" x="74" y="55" width="30" height="5"/><g class="k"><rect x="76" y="41" width="26" height="6" rx="3"/><rect x="76" y="48" width="26" height="6" rx="3"/></g><circle class="k" cx="26" cy="68" r="7"/><circle class="k" cx="54" cy="68" r="8"/>`,
  camion: GND + `<rect x="92" y="38" width="22" height="26" rx="3" fill="#2f6fe0"/><rect class="g" x="104" y="42" width="8" height="9"/><path d="M6 60h86M6 34h84" stroke="#9aa0b4" stroke-width="4"/><path d="M10 34v26M50 34v26M88 34v26" stroke="#9aa0b4" stroke-width="3"/>${CAR(12, 39, 0.68, '#e5302a')}${CAR(50, 39, 0.68, '#f2c21c')}${CAR(12, 13, 0.68, '#3ab46a')}${CAR(50, 13, 0.68, '#2f7de0')}<circle class="k" cx="16" cy="68" r="6"/><circle class="k" cx="30" cy="68" r="6"/><circle class="k" cx="100" cy="68" r="7"/>`
};

// Layout: h along the screen in the overview, d from the back (−) to the front (+). The hall spans h −40…35, d −22…8.
const CFG = {
  pont: CF(-32, -11), presse: CF(-19, -9), soudeurs: CF(-6, -9), peinture: CF(7, -9), montage: CF(27, -9),
  agv: CF(-18, 1.5), chariot: CF(1, 2.5), camion: CF(24, 15)
};
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const YL = '#f2c21c';
// outside: yard, road, parkings
rect(18, 15, 60, 11, '#7a7e8e'); rect(0, 23.5, 96, 5, '#4a4e5e'); for (let h = -46; h < 46; h += 4) rect(h, 23.5, 2, 0.2, '#f3efe2');
rect(-18, 16, 22, 7, '#7a7e8e'); for (let h = -28; h <= -8; h += 2.5) rect(h, 14, 0.12, 3, '#f3efe2');
rect(42.5, 1, 12, 24, '#6a6e7e'); for (let d = -11; d <= 13; d += 2.6) { rect(40, d, 4.6, 0.12, '#f3efe2'); rect(45, d, 4.6, 0.12, '#f3efe2'); }
rect(-39, 15.5, 13, 9, '#d8d0c0');
// the hall floor, green walkways and yellow lines
rect(-2.5, -7, 75, 30, '#c7cad3');
[[-3.4, 2.4], [5.8, 2.0]].forEach(([d, w]) => { rect(-2.5, d, 74, w, '#7fbf8a'); rect(-2.5, d - w / 2, 74, 0.14, YL); rect(-2.5, d + w / 2, 74, 0.14, YL); });
[[-32, -11, 15, 10], [-19, -9, 13, 5.4], [-6, -9, 10, 8.4], [7, -9, 16, 6.4], [27, -9, 15, 5.6], [1, 2.5, 12, 3.4]].forEach(([h, d, l, w]) => {
  rect(h, d - w / 2, l, 0.14, YL); rect(h, d + w / 2, l, 0.14, YL); rect(h - l / 2, d, 0.14, w, YL); rect(h + l / 2, d, 0.14, w, YL);
});
rect(-19, -5.6, 10, 0.9, YL, 1, '#2a2f40'); rect(27, -5.9, 13, 0.6, YL, 1, '#2a2f40');
for (let k = 0; k < 6; k++) { rect(-11.5 + k * 0.8, 7.2, 0.4, 1.8, '#f3efe2'); rect(13 + k * 0.8, 7.2, 0.4, 1.8, '#f3efe2'); }
blob(-2.5, -7, 30, 'rgba(255,255,255,.08)'); blob(-40, 15, 6, 'rgba(255,255,255,.3)');
GP.push({ pts: [Q(-11.5, 8), Q(-11.5, 21)], w: 3, col: '#7a7e8e', al: 1 });

export default {
  id: 'usine', title: "L'Usine", titleHtml: "L'<span>Usine</span>",
  subtitle: "Une usine où l'on fabrique une voiture, étape par étape : la presse, les robots, la peinture, le montage… et le camion qui l'emporte.",
  welcome: "Bienvenue à l'usine ! Ici, on fabrique des voitures. Touche une machine pour voir comment elle marche.",
  hint: 'Touche une machine pour la découvrir.', backLabel: "Toute l'usine",
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 27V14l7 4v-4l7 4v-4l7 4V5h4v22z"/><path d="M8 22h3M15 22h3M22 22h3"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false,
  forest: { dark: [0x245a36, 0x2e6a3e, 0x1f4a32, 0x3a7a46], bush: [0x4a9a46, 0x5aae52, 0x3f8a3e, 0xf4b2cc] },
  overview: { w: 94, h: 64, focus: [-1.5, 3, 1.5] },
  ground: { base: ['#8cc06a', '#6aa452', '#4a7a3e'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    const fx = createFx(scene, 260); onUpdate((dt) => fx.update(dt));
    { const root = grp(scene), H = grp(root); H.rotation.y = YAW; buildFactory(H); freeze(root); }
    const spin = (obj, wheels, R = 0.33) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || R))); }; };
    const puff = (p, n = 2, col = 0xd8dce8, s = 0.3) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3))), new V3(rnd(-0.6, 0.6), rnd(0.3, 0.9), rnd(-0.6, 0.6)), s, col, 1.2); };
    const sparks = (p, n = 3) => { for (let i = 0; i < n; i++) fx.fire(p, new V3(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).normalize(), rnd(2, 4.5), 0.5, rnd(0.03, 0.07)); };

    /* ---- le pont roulant : il soulève une bobine d'acier ---- */
    (function () {
      const st = makeStation('pont'), S = st.g, dec = grp(S);
      const RY = 7.4, RZ = 4.6, RX = 7.0;
      // runway: two girders on columns (columns only at the ends, so nothing hides the hook)
      [-RZ, RZ].forEach((z) => {
        const s = Math.sign(z);
        [-RX, RX].forEach((x) => { rbox(dec, 0.5, RY - 0.5, 0.5, 0.05, UM.blueD, x, (RY - 0.5) / 2, z + s * 0.45, 0.02); rbox(dec, 0.6, 0.5, 0.9, 0.05, UM.blueD, x, RY - 0.45, z + s * 0.1, 0.02); rbox(dec, 0.9, 0.12, 0.9, 0.03, UM.dark, x, 0.06, z + s * 0.45, 0.01); });
        rbox(dec, 2 * RX + 0.6, 0.8, 0.36, 0.04, UM.blueD, 0, RY - 0.2, z, 0.02); box(dec, 2 * RX + 0.6, 0.1, 0.12, MT.steel, 0, RY + 0.25, z);
        [-RX - 0.3, RX + 0.3].forEach((x) => rbox(dec, 0.25, 0.4, 0.4, 0.04, MT.black, x, RY + 0.45, z, 0.02)); // end stops
      });
      // coils waiting on their wooden saddles
      const coilGeo = (g) => { cylZ(g, 0.85, 1.3, UM.sheet, 0, 0, 0, 30); cylZ(g, 0.3, 1.34, UM.dark, 0, 0, 0, 16); [0.7, 0.55, 0.42].forEach((r) => cylZ(g, r, 1.31, UM.bare, 0, 0, 0, 28)); [-0.35, 0.35].forEach((z) => { const b = add(g, new THREE.TorusGeometry(0.86, 0.025, 4, 30), MT.dark, 0, 0, z); b.rotation.set(0, 0, 0); }); return g; };
      const saddle = (x, z) => { [0.45, -0.45].forEach((dx) => { rbox(dec, 0.35, 0.3, 1.5, 0.04, UM.wood, x + dx, 0.15, z, 0.02); }); };
      [[-5.9, -1.0], [-5.9, 1.4], [-3.9, 1.4]].forEach(([x, z]) => { saddle(x, z); coilGeo(grp(dec, x, 1.0, z)); });
      saddle(-3.9, -1.0);
      const coil = coilGeo(grp(S, -3.9, 1.0, -1.0)); const coilHome = coil.position.clone();
      // the uncoiler: a cradle with two rollers, a straightener, and the steel strip that comes out
      const DX = 3.6, DZ = 0.6;
      rbox(dec, 2.4, 0.3, 1.9, 0.05, UM.blue, DX, 0.15, DZ, 0.02);
      [-0.75, 0.75].forEach((dx) => cylZ(dec, 0.18, 1.6, MT.steel, DX + dx, 0.32, DZ, 16));
      [-0.85, 0.85].forEach((dz) => rbox(dec, 1.6, 1.0, 0.12, 0.04, UM.yel, DX, 0.8, DZ + dz, 0.02));
      rbox(dec, 1.4, 1.5, 1.8, 0.08, UM.blue, DX + 2.6, 0.75, DZ, 0.03); rbox(dec, 1.42, 0.12, 1.82, 0.03, UM.yel, DX + 2.6, 1.45, DZ, 0.01);
      for (let i = 0; i < 4; i++) cylZ(dec, 0.1, 1.5, MT.chrome, DX + 2.1 + i * 0.33, 0.75 + (i % 2 ? 0.12 : -0.12), DZ + 0.0, 12);
      cylZ(dec, 0.22, 0.2, UM.rgrey, DX + 2.6, 1.0, DZ - 1.0, 14); rbox(dec, 0.5, 0.4, 0.4, 0.05, UM.rgrey, DX + 2.6, 0.5, DZ - 1.1, 0.02);
      const strip = grp(S, DX + 0.55, 0.78, DZ); const sg = new THREE.BoxGeometry(1, 0.03, 1.15); sg.translate(0.5, 0, 0); add(strip, sg, UM.sheet); strip.scale.x = 0.01;
      // bridge (two yellow box girders + end carriages), trolley with its hoist, hook block with a C-hook for coils
      const br = grp(S, 0.5, 0, 0), bd = grp(br);
      [0.5, -0.5].forEach((x) => { rbox(bd, 0.4, 0.95, 2 * RZ + 0.6, 0.05, UM.yel, x, RY + 0.85, 0, 0.02); for (let z = -RZ + 0.6; z < RZ; z += 1.2) box(bd, 0.42, 0.05, 0.04, UM.yelD, x, RY + 0.85, z); });
      [-RZ, RZ].forEach((z) => { rbox(bd, 2.2, 0.55, 0.55, 0.06, UM.yelD, 0, RY + 0.55, z, 0.02); [0.75, -0.75].forEach((x) => cylZ(bd, 0.18, 0.2, UM.dark, x, RY + 0.4, z, 12)); rbox(bd, 0.4, 0.35, 0.3, 0.04, UM.blue, 0.75, RY + 0.95, z * 0.92, 0.02); });
      rail(bd, [[0.85, RY + 1.35, -RZ], [0.85, RY + 1.35, RZ]], 0.025, UM.yelD); box(bd, 0.35, 0.04, 2 * RZ, UM.grate, 0.85, RY + 1.32 - 0.36, 0);
      rbox(bd, 1.5, 0.6, 0.06, 0.04, UM.yel, 0, RY + 0.85, RZ + 0.33, 0.01); decal(bd, '20 t', 1.3, 0.5, '#2a2440', 0, RY + 0.85, RZ + 0.37);
      bake(bd);
      const tr = grp(br, 0, RY + 1.33, -2.4), td = grp(tr);
      rbox(td, 1.5, 0.22, 1.4, 0.05, UM.orange, 0, 0.11, 0, 0.02); cylX(td, 0.34, 1.0, UM.rgrey, 0, 0.55, -0.15, 20); cylX(td, 0.36, 0.06, UM.orange, 0.5, 0.55, -0.15, 20); cylX(td, 0.36, 0.06, UM.orange, -0.5, 0.55, -0.15, 20);
      rbox(td, 0.5, 0.45, 0.4, 0.05, UM.blue, 0.45, 0.45, 0.5, 0.02); cylX(td, 0.17, 0.5, UM.blue, -0.2, 0.45, 0.5, 14); [0.5, -0.5].forEach((x) => [0.55, -0.55].forEach((z) => cylX(td, 0.12, 0.12, UM.dark, x, 0.0, z, 10)));
      bake(td);
      const cg = cylGeo(6), cables = [-0.12, 0.12].map((x) => { const c = add(tr, cg, MT.black, x, 0, 0); c.scale.set(0.025, 1, 0.025); return c; });
      const hk = grp(tr, 0, -3.2, 0), hd = grp(hk);
      rbox(hd, 0.5, 0.55, 0.36, 0.08, UM.yel, 0, 0.0, 0, 0.02); cylZ(hd, 0.2, 0.4, UM.rgrey, 0, 0.1, 0, 14); cylY(hd, 0.06, 0.3, MT.steel, 0, -0.42, 0, 8);
      const hook = add(hd, new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI * 1.4), MT.dark, 0, -0.7, 0); hook.rotation.z = -Math.PI * 0.2;
      // the C-hook (coil tong): top arm, spine at the back, a prong that goes into the coil's hole
      rbox(hd, 0.3, 0.18, 1.4, 0.05, UM.orange, 0, -0.78, -0.4, 0.02); rbox(hd, 0.3, 1.3, 0.2, 0.05, UM.orange, 0, -1.35, -1.05, 0.02);
      rbox(hd, 0.24, 0.24, 1.75, 0.08, UM.orange, 0, -1.95, -0.25, 0.02); rbox(hd, 0.26, 0.06, 0.26, 0.02, UM.dark, 0, -1.95, 0.64, 0.01);
      bake(hd);
      const HUP = -3.2, HDN = -5.78; // coil centre at RY+1.33+hk.y-1.95
      // a worker with the remote control
      const op = person(S, 1.5, 3.4, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); op.rotation.y = Math.PI / 2 + 0.5;
      rbox(op, 0.14, 0.24, 0.1, 0.03, UM.yel, 0.25, 0.7, 0.22, 0.01); rod(op, new V3(0.25, 0.82, 0.22), new V3(0.4, 2.2, 0.0), 0.012, MT.black, 4);
      part(st, 'poutres', 'les grandes poutres', anchor(dec, 2.5, RY + 0.3, RZ + 0.2), true);
      part(st, 'crochet', 'le crochet', anchor(hk, 0, -0.5, 0.25), true);
      part(st, 'bobine', "la bobine d'acier", anchor(coil, 0.0, 0.8, 0.6), false);
      part(st, 'derouleuse', 'la dérouleuse', anchor(S, DX + 1.4, 1.6, DZ + 1.0), false);
      part(st, 'cables', 'les câbles', anchor(tr, 0, -1.2, 0.1), false);
      st.focus = new V3(0, 4.2, 0); st.size = { w: 18, h: 11.5 }; st.tagAt = anchor(S, 0, RY + 2.6, 0);
      let T = 0;
      st.update = (dt) => { T += dt; const L = -hk.position.y - 0.25; cables.forEach((c) => { c.scale.y = L; c.position.y = -L / 2; }); if (st.unroll) coil.rotation.z -= dt * 1.5; };
      st.action = async function () {
        if (st.done) { S.attach(coil); coil.position.copy(coilHome); coil.rotation.set(0, 0, 0); strip.scale.x = 0.01; pop(coil, 0.5); st.done = false; await sleep(0.5); }
        const motor = () => tone(140, 0, 1.2, 'sawtooth', 0.02, 150);
        motor();
        await Promise.all([step('Le pont roulant roule tout là-haut, sur deux grandes poutres.', 'poutres'), to(br.position, 'x', coilHome.x, 3.2, easeSine), to(tr.position, 'z', coilHome.z - 1.4, 3.2, easeSine)]);
        await Promise.all([step('Le crochet descend, au bout de ses câbles.', 'cables'), to(hk.position, 'y', HDN, 3, easeSine)]);
        await Promise.all([step("Sa pince glisse dans le trou de la grosse bobine d'acier.", 'crochet'), to(tr.position, 'z', coilHome.z, 1.8, easeSine)]);
        hk.attach(coil); thud(); motor();
        await Promise.all([step('Hop, il la soulève ! Elle est aussi lourde que cinq éléphants.', 'bobine'), to(hk.position, 'y', HUP, 3.2, easeSine)]);
        motor();
        await Promise.all([step("Il glisse sur ses rails, et l'emporte jusqu'à la dérouleuse.", 'poutres'), to(br.position, 'x', DX, 4.5, easeSine), to(tr.position, 'z', DZ, 4.5, easeSine)]);
        await Promise.all([step('Il la pose tout doucement.', 'crochet'), to(hk.position, 'y', HDN, 3, easeSine)]);
        S.attach(coil); coil.position.set(DX, 1.0, DZ); thud();
        await to(tr.position, 'z', DZ - 1.4, 1.5, easeSine); to(hk.position, 'y', HUP, 2.5, easeSine);
        st.unroll = true;
        await Promise.all([step('La bobine se déroule, comme un rouleau de papier. Ces feuilles d’acier vont aller à la presse !', 'derouleuse'), tw(4.5, (k) => (strip.scale.x = 0.01 + 2.6 * k), lin)]);
        st.unroll = false; chime(); st.done = true;
      };
    })();

    /* ---- la presse d'emboutissage : une feuille plate devient une portière ---- */
    (function () {
      const st = makeStation('presse'), S = st.g, dec = grp(S);
      const BED = 1.1, CR = BED + 5.2;
      rbox(dec, 4.8, BED, 3.4, 0.1, UM.blue, 0, BED / 2, 0, 0.03); rbox(dec, 4.9, 0.14, 3.5, 0.04, UM.yel, 0, BED - 0.05, 0, 0.01);
      rbox(dec, 3.7, 0.12, 2.7, 0.03, UM.rgrey, 0, BED + 0.06, 0, 0.01); rbox(dec, 2.7, 0.32, 1.9, 0.04, UM.dark, 0, BED + 0.28, 0, 0.02);
      [[-1.9, 1.35], [1.9, 1.35], [-1.9, -1.35], [1.9, -1.35]].forEach(([x, z]) => { rbox(dec, 0.8, 5.25, 0.62, 0.06, UM.blue, x, BED + 2.6, z, 0.03); box(dec, 0.82, 0.12, 0.64, UM.blueD, x, BED + 1.6, z); });
      rbox(dec, 5.0, 1.9, 3.6, 0.12, UM.blue, 0, CR + 0.95, 0, 0.03); rbox(dec, 5.05, 0.25, 3.65, 0.04, UM.yel, 0, CR + 0.2, 0, 0.01);
      for (let x = -2; x <= 2; x += 1) box(dec, 0.12, 1.5, 0.1, UM.blueD, x, CR + 1.05, 1.82);
      cylY(dec, 0.33, 0.85, MT.steel, 0.9, CR - 0.42, 0, 14); cylY(dec, 0.33, 0.85, MT.steel, -0.9, CR - 0.42, 0, 14);
      // flywheel, motor, walkway, ladder
      cylZ(dec, 1.0, 0.35, UM.rgrey, -1.2, CR + 2.95, 0.7, 28); cylZ(dec, 0.25, 0.45, MT.steel, -1.2, CR + 2.95, 0.7, 14); rbox(dec, 1.6, 0.9, 0.9, 0.08, UM.orange, 1.1, CR + 2.35, -0.5, 0.02); cylX(dec, 0.3, 0.6, UM.rgrey, 0.1, CR + 2.35, -0.5, 16);
      rail(dec, [[-2.45, CR + 2.9, 1.75], [2.45, CR + 2.9, 1.75], [2.45, CR + 2.9, -1.75], [-2.45, CR + 2.9, -1.75]], 0.03, UM.yel);
      [[-2.45, 1.75], [2.45, 1.75], [2.45, -1.75], [-2.45, -1.75], [0, 1.75]].forEach(([x, z]) => rod(dec, new V3(x, CR + 1.9, z), new V3(x, CR + 2.9, z), 0.025, UM.yel, 4));
      [2.95, 3.3].forEach((x) => rod(dec, new V3(x, 0, -1.1), new V3(x, CR + 2.9, -1.1), 0.03, UM.yel, 4)); for (let y = 0.4; y < CR + 2.7; y += 0.4) rod(dec, new V3(2.95, y, -1.1), new V3(3.3, y, -1.1), 0.02, UM.yel, 4);
      rbox(dec, 0.5, 0.4, 0.3, 0.05, UM.white, -2.0, CR + 1.0, 1.82, 0.02); decal(dec, 'PRESSE', 1.8, 0.45, '#ffffff', 0.6, CR + 1.45, 1.83);
      // roller conveyors in and out, a stack of blanks, a cart of finished doors
      [[-4.3, 3.6], [4.3, 3.6]].forEach(([cx, L]) => {
        [0.75, -0.75].forEach((z) => { rbox(dec, L, 0.14, 0.1, 0.02, UM.rgrey, cx, 1.42, z, 0.01); [-L / 2 + 0.2, L / 2 - 0.2].forEach((dx) => box(dec, 0.08, 1.4, 0.08, UM.rgrey, cx + dx, 0.7, z)); });
        for (let x = cx - L / 2 + 0.15; x < cx + L / 2; x += 0.3) cylZ(dec, 0.05, 1.45, MT.steel, x, 1.48, 0, 10);
      });
      rbox(dec, 1.9, 0.9, 1.3, 0.05, UM.yel, -5.4, 0.45, 2.6, 0.02); for (let i = 0; i < 6; i++) rbox(dec, 1.6, 0.03, 1.1, 0.01, UM.sheet, -5.4, 0.92 + i * 0.035, 2.6, 0.005);
      rbox(dec, 1.5, 0.12, 1.3, 0.03, UM.rgrey, 5.3, 0.25, 2.7, 0.01); [[-0.7, 0.6], [0.7, 0.6], [-0.7, -0.6], [0.7, -0.6]].forEach(([dx, dz]) => box(dec, 0.06, 1.4, 0.06, UM.rgrey, 5.3 + dx, 0.95, 2.7 + dz));
      // light curtain at the front, control desk with buttons
      [-1.3, 1.3].forEach((x) => { rbox(dec, 0.12, 2.2, 0.12, 0.03, UM.yel, x, 1.1, 2.0, 0.01); });
      rbox(dec, 0.5, 1.1, 0.5, 0.05, UM.rgrey, -3.2, 0.55, 2.4, 0.02); const desk = rbox(dec, 0.7, 0.08, 0.5, 0.03, UM.yel, -3.2, 1.15, 2.4, 0.01); desk.rotation.z = -0.3;
      sph(dec, 0.07, MT.red, -3.25, 1.24, 2.25); sph(dec, 0.05, UM.green, -3.05, 1.2, 2.5); sph(dec, 0.05, UM.green, -3.05, 1.2, 2.3);
      fenceLine(dec, [[-6.3, -2.2], [-2.4, -2.2]]); fenceLine(dec, [[2.4, -2.2], [6.3, -2.2]]);
      bake(dec);
      const curtain = [-1.3, 1.3].map((x) => { const m = UM.ledG.clone(); for (let y = 0.4; y < 2.1; y += 0.3) box(S, 0.05, 0.12, 0.13, m, x, y, 2.07); return m; });
      const setCurtain = (on) => curtain.forEach((m) => { m.color.setHex(on ? 0xff6a5a : 0x6aff8a); m.emissive.setHex(on ? 0xff2a10 : 0x20d040); });
      const opr = person(S, -3.3, 3.0, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); opr.rotation.y = 0.9;
      // the slide (ram) with the upper die; piston rods disappear into the crown
      const sl = grp(S), sd = grp(sl);
      rbox(sd, 3.3, 1.1, 2.4, 0.08, UM.blue, 0, 4.85, 0, 0.03); box(sd, 3.3, 0.22, 0.02, MT.stripes, 0, 4.42, 1.21);
      rbox(sd, 2.7, 0.32, 1.9, 0.04, UM.dark, 0, 4.14, 0, 0.02); [0.9, -0.9].forEach((x) => cylY(sd, 0.2, 2.43, MT.chrome, x, 5.4 + 1.215, 0, 14));
      bake(sd);
      // the flat sheet, and the door it becomes
      const SH0 = new V3(-5.6, 1.55, 0);
      const sheet = rbox(S, 1.6, 0.035, 1.15, 0.02, UM.sheet, SH0.x, SH0.y, 0, 0.01);
      const door = grp(S, 0, 1.57, 0); door.rotation.x = -Math.PI / 2; door.visible = false;
      { const dd = grp(door, 0, 0, 0.02);
        ext(dd, [[-0.7, -0.5], [0.7, -0.5], [0.74, 0.02], [-0.7, 0.02]], 0.08, 0.06, UM.sheet, 0, 0, 0, 0.02);
        rbox(dd, 1.3, 0.06, 0.08, 0.02, UM.bare, 0, -0.18, 0.04, 0.01);
        rail(dd, [[-0.66, 0.02, 0], [-0.66, 0.52, 0], [0.38, 0.52, 0], [0.72, 0.04, 0]], 0.035, UM.sheet);
        rbox(dd, 0.16, 0.12, 0.08, 0.02, UM.bare, 0.4, -0.08, 0.02, 0.01); }
      part(st, 'coulisseau', 'le marteau de la presse', anchor(sl, 1.65, 4.85, 1.2), true);
      part(st, 'feuille', "la feuille d'acier", anchor(sheet, 0, 0.05, 0.55), true);
      part(st, 'tapis', 'le tapis roulant', anchor(S, -3.3, 1.5, 0.8), false);
      part(st, 'portiere', 'la portière', anchor(door, 0, -0.3, 0.1), false);
      st.focus = new V3(0, 3.6, 0); st.size = { w: 15, h: 10 }; st.tagAt = anchor(S, 0, CR + 3.4, 0);
      st.action = async function () {
        if (st.done) { door.visible = false; door.position.x = 0; sheet.position.copy(SH0); pop(sheet, 0.4); st.done = false; await sleep(0.4); }
        await Promise.all([step("Voici une feuille d'acier, toute plate et toute lisse.", 'feuille'), sleep(0.8)]);
        await Promise.all([step('Le tapis roulant la glisse dans la presse.', 'tapis'), to(sheet.position, 'x', 0, 3, easeSine)]);
        setCurtain(true); tone(90, 0, 1.2, 'sawtooth', 0.03, 60);
        await Promise.all([step('Attention… la presse descend, et appuie très, très fort. Boum !', 'coulisseau'), to(sl.position, 'y', -2.38, 1.6, easeIn)]);
        thud(); thud(); sheet.visible = false; door.visible = true;
        for (let i = 0; i < 8; i++) fx.smoke(S.localToWorld(new V3(rnd(-1.5, 1.5), 1.6, rnd(-1, 1))), new V3(rnd(-1, 1), rnd(0.2, 0.6), rnd(-1, 1)), 0.25, 0xe8eaf0, 0.9);
        await tw(0.4, (k) => (sl.position.y = -2.38 + Math.sin(k * Math.PI * 4) * 0.02 * (1 - k)), lin);
        await Promise.all([step('Elle remonte. La feuille plate est devenue une portière de voiture !', 'portiere'), to(sl.position, 'y', 0, 2.4, easeSine)]);
        setCurtain(false);
        await Promise.all([step("Le tapis l'emporte vers les robots soudeurs.", 'tapis'), to(door.position, 'x', 4.4, 3, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- les robots soudeurs : on pose le toit, puis on soude ---- */
    (function () {
      const st = makeStation('soudeurs'), S = st.g, dec = grp(S);
      rbox(dec, 9.4, 0.04, 7.6, 0.02, UM.floor, 0, 0.02, 0, 0.01);
      // skid conveyor
      [0.55, -0.55].forEach((z) => { rbox(dec, 10, 0.12, 0.16, 0.02, UM.rgrey, 0, 0.36, z, 0.01); for (let x = -4.8; x <= 4.8; x += 1.2) box(dec, 0.1, 0.32, 0.1, UM.rgrey, x, 0.16, z); for (let x = -4.8; x <= 4.8; x += 0.4) cylZ(dec, 0.05, 0.22, MT.steel, x, 0.44, z, 8); });
      // fences around the cell (back and sides), a roof rack behind, a control cabinet
      fenceLine(dec, [[-4.6, -1.4], [-4.6, -4.7], [4.6, -4.7], [4.6, -1.4]]); fenceLine(dec, [[-4.6, 1.4], [-4.6, 3.7]]); fenceLine(dec, [[4.6, 1.4], [4.6, 3.7]]);
      rbox(dec, 2.0, 0.9, 1.9, 0.05, UM.blue, 0, 0.45, -3.55, 0.02); rbox(dec, 1.8, 0.05, 1.7, 0.02, UM.dark, 0, 0.92, -3.55, 0.01);
      rbox(dec, 0.9, 1.9, 0.5, 0.06, UM.light, -3.7, 0.95, -3.4, 0.02); box(dec, 0.5, 0.3, 0.02, MT.glassD, -3.7, 1.4, -3.14); sph(dec, 0.06, MT.red, -3.55, 1.0, -3.14);
      bake(dec);
      const C = car(S, UM.bare, { wheels: false, glass: UM.inside }); const m = C.g; m.position.set(-3.6, 0.22, 0);
      [0.55, -0.55].forEach((z) => rbox(m, 3.8, 0.1, 0.14, 0.02, UM.blueD, 0, 0.25, z, 0.01)); // the skid
      const roof = C.roof; S.attach(roof); roof.position.set(0, 0.98, -3.55); bake(m);
      const roofHome = roof.position.clone();
      // four welding robots + one that carries the roof
      const W = [[-2.75, 2.35], [2.75, 2.35], [-2.5, -2.3], [2.5, -2.3]].map(([x, z]) => { const R = robot(S, x, z); weldGun(R); return R; });
      const Hd = robot(S, 0, -2.0); gripper(Hd);
      const restOf = (R) => { const sx = -Math.sign(R.g.position.x) || 0, sz = -Math.sign(R.g.position.z); return [new V3(sx * 0.35, 2.55, sz * 0.9), -1.3]; };
      [...W, Hd].forEach((R) => { const [P, t] = restOf(R); reach(R, P, t); });
      const lp = (R, x, y, z) => new V3(x - R.g.position.x, y - R.g.position.y, z - R.g.position.z);
      const weld = async (R, pts) => {
        for (const [x, y, z, t] of pts) { await go(R, lp(R, x, y, z), t, 0.9); R.spark = true; tone(2600 + rnd(0, 800), 0, 0.3, 'square', 0.012, 1900); await sleep(0.6); R.spark = false; }
        const [P, t] = restOf(R); await go(R, P, t, 1.0);
      };
      part(st, 'robots', 'les bras robots', anchor(W[0].a3, 0.6, 0.35, 0), true);
      part(st, 'pince', 'la pince à souder', anchor(W[1].tool, 0.5, 0.2, 0), false);
      part(st, 'caisse', 'la caisse de la voiture', anchor(m, 0.4, 1.0, 0.95), true);
      part(st, 'toit', 'le toit', anchor(roof, 0, 0.1, 0.6), false);
      part(st, 'coude', 'le coude', anchor(W[3].a3, 0, 0.3, 0), false);
      st.focus = new V3(0, 1.6, 0); st.size = { w: 13.5, h: 8 }; st.el = 0.82; st.tagAt = anchor(S, 0, 4.2, 0);
      const robots = [...W, Hd];
      st.update = () => robots.forEach((R) => { if (R.spark) sparks(wp(R.tip), 3); });
      st.action = async function () {
        if (st.done) { m.position.x = -3.6; S.attach(roof); roof.position.copy(roofHome); roof.rotation.set(0, 0, 0); pop(m, 0.5); st.done = false; await sleep(0.5); }
        await Promise.all([step("La caisse de la voiture arrive. Ce sont les morceaux d'acier, posés ensemble.", 'caisse'), to(m.position, 'x', 0, 3, easeSine)]);
        // the handling robot fetches the roof (the gripper turns so the roof stays straight)
        const above = (p, dy) => lp(Hd, p.x, p.y + dy, p.z);
        await Promise.all([step('Un robot va chercher le toit…', 'toit'), go(Hd, above(roof.position, 0.6), -Math.PI / 2, 1.4)]);
        await go(Hd, above(roof.position, 0.04), -Math.PI / 2, 0.8);
        Hd.tool.attach(roof); ding(); const a0 = Hd.a1.rotation.y;
        const keep = () => (Hd.a6.rotation.x = Hd.a1.rotation.y - a0);
        await go(Hd, above(roofHome, 0.9), -Math.PI / 2, 0.8, keep);
        const tgt = new V3(m.position.x - 0.68, m.position.y + 1.46, 0);
        await Promise.all([step('…et le pose sur la voiture, tout doucement.', 'toit'), (async () => { await go(Hd, lp(Hd, 1.4, 2.9, -1.4), -Math.PI / 2, 1.2, keep); await go(Hd, above(tgt, 0.6), -Math.PI / 2, 1.4, keep); await go(Hd, above(tgt, 0.04), -Math.PI / 2, 0.9, keep); })()]);
        m.attach(roof); roof.position.set(-0.68, 1.46, 0); roof.rotation.set(0, 0, 0); thud();
        await go(Hd, above(tgt, 0.8), -Math.PI / 2, 0.6, keep); Hd.a6.rotation.x = 0;
        go(Hd, ...restOf(Hd), 1.2);
        // spot welding all around
        await Promise.all([step('Les robots soudeurs se tournent… Regarde les étincelles !', 'pince'),
          weld(W[0], [[-1.5, 1.1, 0.95, -0.3], [-0.45, 1.15, 0.95, -0.3]]), weld(W[1], [[1.5, 1.0, 0.95, -0.3], [0.6, 1.15, 0.95, -0.3]]),
          weld(W[2], [[-1.4, 1.1, -0.95, -0.3], [-0.9, 1.75, -0.78, -1.1]]), weld(W[3], [[1.3, 1.05, -0.95, -0.3], [0.2, 1.75, -0.78, -1.1]])]);
        await Promise.all([step('Clic, clac ! Chaque point de soudure colle les pièces très fort.', 'robots'),
          weld(W[0], [[-1.0, 1.75, 0.78, -1.1]]), weld(W[1], [[0.1, 1.75, 0.78, -1.1]]), weld(W[2], [[-0.3, 1.1, -0.95, -0.3]]), weld(W[3], [[1.6, 1.75, -0.6, -1.1]])]);
        await Promise.all([step('La caisse est toute soudée. Elle part vers la peinture !', 'caisse'), to(m.position, 'x', 3.8, 3, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la cabine de peinture et le four ---- */
    (function () {
      const st = makeStation('peinture'), S = st.g, dec = grp(S);
      const X0 = -2.6, X1 = 3.4, ZW = 2.9, HH = 4.4, CX = 0.4;
      rbox(dec, X1 - X0, 0.12, 2 * ZW, 0.02, UM.grate, CX, 0.06, 0, 0.01); for (let x = X0 + 0.3; x < X1; x += 0.3) box(dec, 0.04, 0.02, 2 * ZW - 0.2, MT.black, x, 0.13, 0);
      // back wall with lights, side walls with doors, glass front, open ceiling frame
      rbox(dec, X1 - X0, HH, 0.14, 0.03, UM.white, CX, HH / 2, -ZW, 0.01); for (let x = X0 + 0.8; x < X1 - 0.4; x += 1.5) rbox(dec, 1.0, 0.3, 0.06, 0.03, MT.lamp, x, HH - 0.5, -ZW + 0.08, 0.01);
      [X0, X1].forEach((x) => { [-1, 1].forEach((s) => rbox(dec, 0.14, HH, ZW - 1.3, 0.03, UM.white, x, HH / 2, s * (1.3 + (ZW - 1.3) / 2), 0.01)); rbox(dec, 0.14, HH - 2.3, 2.6, 0.03, UM.white, x, 2.3 + (HH - 2.3) / 2, 0, 0.01); });
      box(dec, X1 - X0, 0.5, 0.06, UM.white, CX, 0.25, ZW); box(dec, X1 - X0 - 0.1, HH - 0.6, 0.03, UM.glass, CX, 0.5 + (HH - 0.6) / 2, ZW);
      for (let x = X0; x <= X1 + 0.01; x += 1.5) box(dec, 0.1, HH, 0.1, UM.white, x, HH / 2, ZW);
      [[-ZW], [ZW]].forEach(([z]) => box(dec, X1 - X0 + 0.1, 0.15, 0.15, UM.white, CX, HH, z)); [X0, X1].forEach((x) => box(dec, 0.15, 0.15, 2 * ZW, UM.white, x, HH, 0));
      for (let x = X0 + 1.5; x < X1; x += 1.5) box(dec, 0.08, 0.1, 2 * ZW, UM.light, x, HH, 0);
      decal(dec, 'PEINTURE', 2.4, 0.5, '#2f6fe0', CX, HH - 0.3, ZW + 0.06, '#ffffff');
      // conveyor through booth and oven
      [0.55, -0.55].forEach((z) => rbox(dec, 14, 0.1, 0.14, 0.02, UM.rgrey, 3.5, 0.3, z, 0.01));
      // pedestals for the robots
      [[-0.6, -2.35], [1.6, -2.35], [2.85, 2.4]].forEach(([x, z]) => rbox(dec, 1.0, 0.8, 1.0, 0.05, UM.light, x, 0.4, z, 0.02));
      // the oven: insulated tunnel with a warm glow, chimney
      const O0 = 3.8, O1 = 8.6, OC = (O0 + O1) / 2;
      const ovenIn = toonMat({ color: 0xff9a4a, emissive: 0xff6a1a, emissiveIntensity: 0.35 });
      const ovenGlass = std(0xffc890, 0.05, 0.1, { transparent: true, opacity: 0.22, depthWrite: false });
      // back wall solid; the wall facing us is a low band, a big window and a top band, so we see the car bake inside
      rbox(dec, O1 - O0, 2.7, 0.3, 0.05, UM.alu, OC, 1.35, -1.5, 0.02);
      rbox(dec, O1 - O0, 0.55, 0.3, 0.05, UM.alu, OC, 0.275, 1.5, 0.02); rbox(dec, O1 - O0, 0.5, 0.3, 0.05, UM.alu, OC, 2.45, 1.5, 0.02);
      [O0 + 0.1, O1 - 0.1].forEach((x) => rbox(dec, 0.2, 2.7, 0.3, 0.03, UM.alu, x, 1.35, 1.5, 0.01));
      box(dec, O1 - O0 - 0.3, 1.62, 0.03, ovenGlass, OC, 1.38, 1.6);
      rbox(dec, O1 - O0 + 0.2, 0.35, 3.4, 0.06, UM.alu, OC, 2.85, 0, 0.02);
      for (let x = O0 + 0.4; x < O1; x += 0.8) { box(dec, 0.08, 2.72, 0.06, UM.light, x, 1.4, -1.68); box(dec, 0.08, 0.06, 3.4, UM.light, x, 3.05, 0); box(dec, 0.06, 1.62, 0.05, UM.light, x, 1.38, 1.64); }
      // inside: warm glowing walls, ceiling heaters and the hot floor
      box(dec, O1 - O0 - 0.1, 2.3, 0.03, ovenIn, OC, 1.4, -1.33); box(dec, O1 - O0 - 0.1, 0.03, 2.6, ovenIn, OC, 2.66, 0); box(dec, O1 - O0 - 0.1, 0.03, 2.6, ovenIn, OC, 0.14, 0);
      for (let x = O0 + 0.6; x < O1 - 0.3; x += 0.9) box(dec, 0.5, 0.06, 2.4, UM.glow, x, 2.6, 0);
      [O0, O1].forEach((x) => { box(dec, 0.05, 0.12, 2.6, UM.glow, x, 2.6, 0); [-1.3, 1.3].forEach((z) => box(dec, 0.05, 2.5, 0.1, UM.glow, x, 1.3, z)); });
      cylY(dec, 0.3, 1.8, UM.alu, OC + 1.2, 3.9, -0.8, 14); cylY(dec, 0.36, 0.15, UM.rgrey, OC + 1.2, 4.8, -0.8, 14);
      rbox(dec, 1.4, 0.6, 0.08, 0.04, UM.white, OC - 0.6, 3.38, 1.55, 0.01); decal(dec, 'FOUR', 1.2, 0.45, '#e0402a', OC - 0.6, 3.38, 1.6);
      [-0.45, 0.45].forEach((dx) => box(dec, 0.06, 0.4, 0.06, UM.rgrey, OC - 0.6 + dx, 2.95, 1.55));
      sph(dec, 0.18, UM.white, OC + 1.0, 2.45, 1.66).scale.z = 0.3;
      bake(dec);
      const shut = [X0, X1].map((x) => rbox(S, 0.08, 2.25, 2.55, 0.03, UM.light, x, 3.3, 0, 0.01));
      // the car (own material: it changes colour)
      const pm = std(0xb4bcc8, 0.28, 0.9);
      const C = car(S, pm, { wheels: false, glass: UM.inside }); const m = C.g; m.position.set(-4.6, 0.26, 0); bake(m);
      [0.55, -0.55].forEach((z) => rbox(m, 3.8, 0.1, 0.14, 0.02, UM.blueD, 0, 0.25, z, 0.01));
      const P = [[-0.6, -2.35], [1.6, -2.35], [2.85, 2.4]].map(([x, z]) => { const R = robot(S, x, z, { mat: UM.white }); R.g.position.y = 0.8; bell(R); return R; });
      const lp = (R, x, y, z) => new V3(x - R.g.position.x, y - R.g.position.y, z - R.g.position.z);
      const restOf = (R) => [new V3(0.2, 2.2, -Math.sign(R.g.position.z) * 0.8), -1.2];
      P.forEach((R) => reach(R, ...restOf(R)));
      const COLS = [['rouge', 0xe5302a], ['bleue', 0x2f7de0], ['jaune', 0xf2c21c], ['verte', 0x3ab46a], ['rose', 0xe86aa8]];
      let ci = 0; const c0 = new THREE.Color(0xb4bcc8), c1 = new THREE.Color();
      const tmp = new V3();
      const sweep = async (R, a, b, t, dur) => { await go(R, lp(R, ...a), t, 0.8); R.spray = true; await go(R, lp(R, ...b), t, dur, null, lin); R.spray = false; };
      part(st, 'cabine', 'la cabine', anchor(S, X0 + 0.6, HH - 0.4, ZW), true);
      part(st, 'robots', 'les robots peintres', anchor(P[2].a3, 0.6, 0.3, 0), true);
      part(st, 'pistolet', 'le pistolet à peinture', anchor(P[1].tool, 0.4, 0.15, 0), false);
      part(st, 'four', 'le four', anchor(S, OC, 3.1, 1.6), true);
      part(st, 'caisse', 'la voiture', anchor(m, 0.6, 1.2, 0.9), false);
      st.focus = new V3(2.4, 1.6, 0); st.size = { w: 17, h: 8.5 }; st.el = 0.72; st.tagAt = anchor(S, CX, HH + 1.2, 0);
      st.update = (dt) => {
        P.forEach((R) => { if (R.spray) for (let i = 0; i < 2; i++) { const a = wp(R.tip), b = wp(R.tip2); tmp.subVectors(a, b).normalize().multiplyScalar(rnd(1.8, 2.6)).add(new V3(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4))); fx.smoke(a, tmp, 0.12, c1.getHex(), 0.55); } });
        if (st.bake && Math.random() < 0.3) fx.smoke(S.localToWorld(new V3(OC + 1.2, 4.9, -0.8)), new V3(rnd(-0.2, 0.2), 1, rnd(-0.2, 0.2)), 0.35, 0xf4e8e0, 1.6);
      };
      st.action = async function () {
        ovenIn.emissiveIntensity = 0.35;
        if (st.done) { m.position.x = -4.6; pm.color.copy(c0); pm.roughness = 0.28; pm.metalness = 0.4; pop(m, 0.5); st.done = false; await sleep(0.5); }
        const [name, hex] = COLS[ci++ % COLS.length]; c1.setHex(hex);
        await to(shut[0].position, 'y', 3.3, 0.8);
        await Promise.all([step('La caisse toute grise entre dans la cabine de peinture.', 'cabine'), to(m.position, 'x', CX, 3.2, easeSine)]);
        await Promise.all([step('Les robots peintres prennent leur pistolet.', 'robots'), to(shut[0].position, 'y', 1.2, 1), go(P[0], lp(P[0], -1.4, 1.0, -1.55), -0.4, 1.2), go(P[1], lp(P[1], 2.4, 1.0, -1.55), -0.4, 1.2), go(P[2], lp(P[2], 2.2, 1.1, 1.6), -0.4, 1.2)]);
        tone(300, 0, 6, 'sawtooth', 0.004, 320);
        await Promise.all([step(`Pschhh ! Ils soufflent une peinture ${name}, en nuage tout fin.`, 'pistolet'),
          sweep(P[0], [-1.4, 1.0, -1.55], [0.9, 1.0, -1.55], -0.4, 2.6), sweep(P[1], [2.4, 1.0, -1.55], [0.7, 1.0, -1.55], -0.4, 2.6), sweep(P[2], [2.2, 1.1, 1.6], [0.0, 1.1, 1.6], -0.4, 2.6),
          tw(4.2, (k) => { pm.color.lerpColors(c0, c1, k * 0.6); }, lin)]);
        await Promise.all([step('Le toit, les portières, le capot : tout est peint !', 'robots'),
          sweep(P[0], [0.9, 2.35, -0.3], [-1.2, 2.35, -0.3], -1.4, 2.2), sweep(P[1], [0.7, 2.35, -0.3], [2.2, 2.35, -0.3], -1.4, 2.2), sweep(P[2], [0.2, 0.75, 1.55], [2.0, 0.75, 1.55], -0.3, 2.2),
          tw(3.2, (k) => { pm.color.lerpColors(c0, c1, 0.6 + k * 0.4); pm.roughness = 0.28 - k * 0.1; pm.metalness = 0.4 - k * 0.25; }, lin)]);
        P.forEach((R) => go(R, ...restOf(R), 1.2));
        await to(shut[1].position, 'y', 3.3, 1);
        st.bake = true;
        await Promise.all([step('Maintenant, la voiture passe au four, pour que la peinture sèche. Comme un gâteau !', 'four'), to(m.position, 'x', OC, 3.5, easeSine), to(ovenIn, 'emissiveIntensity', 1.0, 3.5)]);
        await Promise.all([to(shut[1].position, 'y', 1.2, 0.8), sleep(1.6)]); await to(shut[1].position, 'y', 3.3, 0.8);
        await Promise.all([step('La voilà toute belle et toute brillante !', 'caisse'), to(m.position, 'x', 10.0, 3, easeSine), to(ovenIn, 'emissiveIntensity', 0.35, 3)]);
        st.bake = false; ovenIn.emissiveIntensity = 0.35; to(shut[1].position, 'y', 1.2, 1); chime(); st.done = true;
      };
      shut[0].position.y = 1.2; shut[1].position.y = 1.2;
    })();

    /* ---- la chaîne de montage : le moteur, puis les roues ---- */
    (function () {
      const st = makeStation('montage'), S = st.g, dec = grp(S);
      const RY = 5.0;
      // overhead conveyor: cantilever columns at the back, an I-beam rail
      [-6, 0, 6].forEach((x) => { rbox(dec, 0.4, RY + 0.5, 0.4, 0.04, UM.blueD, x, (RY + 0.5) / 2, -2.4, 0.02); rbox(dec, 0.3, 0.4, 2.6, 0.04, UM.blueD, x, RY + 0.4, -1.2, 0.02); rbox(dec, 0.9, 0.1, 0.9, 0.02, UM.dark, x, 0.05, -2.4, 0.01); });
      rbox(dec, 14.5, 0.08, 0.5, 0.02, UM.yel, 0, RY + 0.32, 0, 0.01); rbox(dec, 14.5, 0.36, 0.08, 0.02, UM.yel, 0, RY + 0.14, 0, 0.01); rbox(dec, 14.5, 0.08, 0.5, 0.02, UM.yel, 0, RY - 0.04, 0, 0.01);
      // wheel carts and the engine lift base
      [2.3, -2.3].forEach((z) => { rbox(dec, 1.8, 0.1, 0.8, 0.03, UM.blue, 1.6, 0.42, z, 0.01); [[-0.75, 0.3], [0.75, 0.3], [-0.75, -0.3], [0.75, -0.3]].forEach(([dx, dz]) => { cylZ(dec, 0.09, 0.06, MT.black, 1.6 + dx, 0.1, z + dz, 10); box(dec, 0.05, 0.3, 0.05, UM.rgrey, 1.6 + dx, 0.25, z + dz); }); rod(dec, new V3(2.5, 0.45, z), new V3(2.9, 1.05, z), 0.025, UM.rgrey, 6); });
      rbox(dec, 1.6, 0.25, 1.3, 0.05, UM.rgrey, -2.5, 0.12, 0, 0.02);
      rbox(dec, 0.6, 1.5, 0.4, 0.05, UM.light, 1.6, 0.75, -3.3, 0.02); box(dec, 0.45, 0.35, 0.02, MT.glassD, 1.6, 1.2, -3.09);
      bake(dec);
      // hanger: trolley on the rail, four posts, a carriage with forks that slides down the posts
      const hg = grp(S, -4.9, 0, 0), hd = grp(hg);
      [0.5, -0.5].forEach((x) => cylZ(hd, 0.1, 0.12, UM.dark, x, RY + 0.42, 0, 10)); rbox(hd, 1.4, 0.3, 0.3, 0.04, UM.orange, 0, RY - 0.25, 0, 0.02); rod(hd, new V3(0, RY - 0.4, 0), new V3(0, 4.55, 0), 0.06, UM.rgrey, 8);
      [1.2, -1.2].forEach((z) => rbox(hd, 5.0, 0.15, 0.15, 0.03, UM.orange, 0, 4.5, z, 0.01)); [2.45, -2.45].forEach((x) => rbox(hd, 0.15, 0.15, 2.55, 0.03, UM.orange, x, 4.5, 0, 0.01));
      [[2.45, 1.2], [2.45, -1.2], [-2.45, 1.2], [-2.45, -1.2]].forEach(([x, z]) => rod(hd, new V3(x, 4.5, z), new V3(x, 0.15, z), 0.05, UM.orange, 8));
      bake(hd);
      const cg = grp(hg, 0, 1.55, 0), cd = grp(cg);
      [1.2, -1.2].forEach((z) => rbox(cd, 5.0, 0.1, 0.1, 0.02, UM.rgrey, 0, 0, z, 0.01)); [1.0, -1.0].forEach((x) => { rbox(cd, 0.12, 0.08, 2.5, 0.02, UM.rgrey, x, 0, 0, 0.01); [0.55, -0.55].forEach((z) => rbox(cd, 0.2, 0.06, 0.2, 0.02, UM.dark, x, 0.06, z, 0.01)); });
      [[2.45, 1.2], [2.45, -1.2], [-2.45, 1.2], [-2.45, -1.2]].forEach(([x, z]) => cylY(cd, 0.09, 0.3, UM.dark, x, 0, z, 10));
      bake(cd);
      const pm = CARM[0];
      const C = car(cg, pm, { wheels: false }); const m = C.g; m.position.set(0, -0.25, 0); bake(m);
      // engine on a scissor lift
      const pf = grp(S, -2.5, 0.45, 0), pd = grp(pf); rbox(pd, 1.3, 0.1, 1.0, 0.03, UM.yel, 0, 0, 0, 0.01); bake(pd);
      const eng = grp(pf, 0, 0.35, 0), ed = grp(eng);
      rbox(ed, 0.62, 0.42, 0.7, 0.06, UM.alu, 0, 0, 0, 0.02); rbox(ed, 0.56, 0.16, 0.62, 0.04, MT.red, 0, 0.29, 0, 0.02); for (let i = 0; i < 4; i++) cylY(ed, 0.04, 0.1, MT.black, 0, 0.42, -0.24 + i * 0.16, 8);
      cylZ(ed, 0.12, 0.2, MT.black, 0.36, -0.08, 0.25, 12); rod(ed, new V3(-0.2, 0.2, 0.37), new V3(0.2, 0.2, 0.37), 0.05, MT.steel, 8); add(ed, new THREE.CylinderGeometry(0.18, 0.28, 0.5, 14), UM.rgrey, -0.48, -0.08, 0).rotation.z = Math.PI / 2;
      bake(ed);
      const sciss = [[-0.5, 0.5], [0.5, -0.5]].flatMap(([a, b]) => [0.42, -0.42].map((z) => ({ m: rod(S, new V3(), new V3(0, 1, 0), 0.04, UM.yelD, 6), a, b, z })));
      const aim = (o, A, B) => { const d = new V3().subVectors(B, A), L = d.length(); o.m.scale.set(0.04, L, 0.04); o.m.position.copy(A).addScaledVector(d, 0.5); o.m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); };
      // wheels waiting on the carts, workers with their screw guns
      const hubs = [[1.35, 1], [-1.35, 1], [1.35, -1], [-1.35, -1]];
      const W = hubs.map(([hx, s], i) => tire(S, 0.33, 0.22, 1.6 + (i % 2 ? -0.45 : 0.45), 0.8, s * 2.3, UM.alu, s));
      const wHome = W.map((w) => w.position.clone());
      const workers = [1, -1].map((s) => { const p = person(S, 1.6, s * 1.75, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); p.rotation.y = s * Math.PI / 2; rbox(p, 0.3, 0.12, 0.12, 0.03, UM.yel, 0.35, 0.62, 0.22, 0.01); return p; });
      const spinC = spin(m, W, 0.33);
      part(st, 'chaine', 'la chaîne au plafond', anchor(dec, 2.5, RY + 0.4, 0.3), true);
      part(st, 'moteur', 'le moteur', anchor(eng, 0.1, 0.45, 0.35), true);
      part(st, 'roues', 'les roues', anchor(W[0], 0, 0.35, 0.1), false);
      part(st, 'ouvriers', 'les ouvriers', anchor(workers[0], 0, 1.4, 0), false);
      part(st, 'voiture', 'la voiture', anchor(m, 0.3, 1.5, 0.9), false);
      st.focus = new V3(-0.6, 2.6, 0); st.size = { w: 17, h: 9 }; st.tagAt = anchor(S, 0, RY + 1.4, 0);
      st.update = () => {
        spinC();
        const y = pf.position.y; sciss.forEach((o) => aim(o, new V3(-2.5 + o.a, 0.25, o.z), new V3(-2.5 + o.b, y - 0.05, o.z)));
        if (st.vroom && Math.random() < 0.5) puff(m.localToWorld(new V3(-2.3, 0.3, 0.5)), 1, 0xd8dce8, 0.2);
      };
      st.action = async function () {
        if (st.done) {
          cg.attach(m); m.position.set(0, -0.25, 0); m.rotation.set(0, 0, 0); m.visible = true; hg.position.x = -4.9; cg.position.y = 1.55;
          pf.attach(eng); eng.position.set(0, 0.35, 0); eng.rotation.set(0, 0, 0);
          W.forEach((w, i) => { S.attach(w); w.position.copy(wHome[i]); w.rotation.set(0, 0, 0); });
          pop(m, 0.5); st.done = false; await sleep(0.5);
        }
        tone(110, 0, 2.5, 'sawtooth', 0.015, 110);
        await Promise.all([step('La voiture peinte avance, accrochée à la chaîne du plafond.', 'chaine'), to(hg.position, 'x', -3.9, 2.5, easeSine)]);
        await Promise.all([step("C'est le grand moment : le moteur monte par en dessous, et entre dans la voiture !", 'moteur'), to(pf.position, 'y', 1.4, 3, easeSine)]);
        m.attach(eng); thud(); to(pf.position, 'y', 0.45, 2, easeSine);
        await Promise.all([step('La chaîne la descend à la hauteur des ouvriers.', 'chaine'), to(hg.position, 'x', 1.6, 3, easeSine), to(cg.position, 'y', 0.7, 3, easeSine)]);
        await step('Les ouvriers vissent les quatre roues : bzzz, bzzz !', 'roues');
        for (const [i, w] of W.entries()) {
          const [hx, s] = hubs[i]; m.updateMatrixWorld(true); const t = S.worldToLocal(m.localToWorld(new V3(hx, 0.33, s * 0.8)));
          const p0 = w.position.clone();
          await tw(0.9, (k) => w.position.set(p0.x + (t.x - p0.x) * k, p0.y + (t.y - p0.y) * k + Math.sin(k * Math.PI) * 0.3, p0.z + (t.z - p0.z) * k), easeSine);
          m.attach(w); tone(820, 0, 0.5, 'square', 0.02, 900); await tw(0.5, (k) => (w.rotation.z = -k * 6), lin);
        }
        await Promise.all([step('La chaîne pose la voiture sur ses roues…', 'voiture'), to(cg.position, 'y', 0.25, 2, easeSine)]);
        S.attach(m); m.position.y = 0; to(cg.position, 'y', 0.12, 0.6);
        engineOn(70); st.vroom = true;
        await Promise.all([step('…et vroum ! Le moteur démarre pour la toute première fois !', 'voiture'), sleep(1.4)]);
        await to(m.position, 'x', 9.5, 3.5, easeIn);
        st.vroom = false; engineOff(); m.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- le robot autonome (AGV) ---- */
    (function () {
      const st = makeStation('agv'), S = st.g, dec = grp(S);
      const rt = route([[-5, 1.1], [0, 1.1], [4.6, 1.1], [5.7, 0], [4.6, -1.1], [0, -1.1], [-5, -1.1], [-6.1, 0]], true, 0.5);
      for (let s = 0; s < rt.len; s += 0.3) { const p = rt.curve.getPointAt(s / rt.len), t = rt.curve.getTangentAt(s / rt.len); const b = box(dec, 0.31, 0.012, 0.1, (Math.floor(s / 0.3) % 2) ? UM.yel : UM.dark, p.x, 0.01, p.z); b.rotation.y = Math.atan2(-t.z, t.x); }
      // pickup shelf (with a worker) and drop shelf by the line
      const shelf = (x, z, n) => { const g = grp(dec, x, 0, z); [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]].forEach(([a, b]) => box(g, 0.06, 1.6, 0.06, UM.blue, a, 0.8, b)); [0.5, 1.1].forEach((y) => rbox(g, 1.9, 0.05, 0.8, 0.02, UM.orange, 0, y, 0, 0.01));
        for (let i = 0; i < n; i++) rbox(g, 0.42, 0.28, 0.55, 0.04, [UM.blue, MT.red, UM.green, UM.yel][i % 4], -0.65 + (i % 4) * 0.45, 1.27, 0, 0.02); return g; };
      shelf(-5, 2.5, 4); shelf(0.2, -2.6, 2);
      rbox(dec, 1.2, 0.9, 0.7, 0.05, UM.light, 2.6, 0.45, -2.6, 0.02);
      bake(dec);
      const A = agv(S); const m = A.g; placeOn(m, rt, 0);
      const bins = [UM.blue, MT.red, UM.green].map((mt, i) => { const b = grp(S); rbox(b, 0.42, 0.3, 0.55, 0.04, mt, 0, 0.15, 0, 0.02); [-0.1, 0.1].forEach((dx) => cylY(b, 0.06, 0.12, MT.steel, dx, 0.32, 0, 8)); b.userData.i = i; return b; });
      const binHome = bins.map((b, i) => new V3(-5.45 + i * 0.45, 0.53, 2.5)); bins.forEach((b, i) => b.position.copy(binHome[i]));
      const drop = bins.map((b, i) => new V3(-0.3 + i * 0.45, 0.53, -2.6));
      const helper = person(S, -5, 3.4, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); helper.rotation.y = Math.PI / 2;
      const helper2 = person(S, 0.2, -3.5, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); helper2.rotation.y = -Math.PI / 2;
      const walker = person(S, 2.6, 3.2, { top: 0xf2b21c, bottom: 0x2a3550 }); walker.rotation.y = Math.PI / 2;
      const near = (x, z) => { let best = 0, bd = 1e9; for (let s = 0; s < rt.len; s += 0.05) { const p = rt.curve.getPointAt(s / rt.len), d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = s; } } return best; };
      const sStop = near(0.9, 1.1), sDrop = near(0.2, -1.1);
      let s = 0; const drive = (s1, d) => { const s0 = s; return tw(d, (k) => { s = s0 + (s1 - s0) * k; placeOn(m, rt, s); }, easeSine); };
      const led = (on) => { A.led.color.setHex(on ? 0xffb03a : 0x6ab8ff); A.led.emissive.setHex(on ? 0xff8a1a : 0x3a98ff); };
      part(st, 'robot', 'le robot AGV', anchor(m, 0, 0.6, 0.5), true);
      part(st, 'ligne', 'la ligne par terre', anchor(S, -2, 0.05, 1.2), true);
      part(st, 'capteur', 'le capteur', anchor(m, 0.78, 0.45, 0.35), false);
      part(st, 'caisses', 'les caisses de pièces', anchor(S, -5, 1.6, 2.6), false);
      st.focus = new V3(0, 0.9, 0.3); st.size = { w: 14, h: 6.5 }; st.tagAt = anchor(m, 0, 1.8, 0);
      let T = 0; st.update = (dt) => { T += dt; A.led.emissiveIntensity = st.wait ? 0.4 + Math.max(0, Math.sin(T * 10)) * 1.4 : 1.2; };
      const carry = async (b, p1, parent) => { const p0 = b.position.clone(); await tw(0.8, (k) => b.position.set(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k + Math.sin(k * Math.PI) * 0.4, p0.z + (p1.z - p0.z) * k), easeSine); parent.attach(b); thud(); };
      st.action = async function () {
        if (st.done) { bins.forEach((b, i) => { S.attach(b); b.position.copy(binHome[i]); b.rotation.set(0, 0, 0); pop(b, 0.4); }); walker.position.z = 3.2; s = 0; placeOn(m, rt, 0); st.done = false; await sleep(0.4); }
        await Promise.all([step("Voici le robot AGV. Il n'a pas de chauffeur : il se conduit tout seul !", 'robot'), tw(1.6, (k) => (m.position.y = Math.abs(Math.sin(k * Math.PI * 2)) * 0.05), lin)]);
        await step("L'ouvrier pose les caisses de pièces dessus.", 'caisses');
        for (const [i, b] of bins.entries()) { m.updateMatrixWorld(true); await carry(b, S.worldToLocal(m.localToWorld(new V3(-0.45 + i * 0.45, 0.39, 0))), m); }
        ding();
        await Promise.all([step('Il suit la ligne par terre, comme un petit train sans rails.', 'ligne'), drive(sStop, 3)]);
        st.wait = true; led(true); beep(); setTimeout(beep, 400);
        await Promise.all([step("Oh ! Quelqu'un passe devant. Son capteur le voit… il s'arrête !", 'capteur'),
          tw(3.2, (k) => { walker.position.z = 3.2 - 6.6 * k; walker.userData.walk(k * 24); }, lin)]);
        walker.userData.walk(0); st.wait = false; led(false);
        await Promise.all([step('La voie est libre : il repart.', 'ligne'), drive(sDrop, 4.5)]);
        await step('Il apporte les pièces aux ouvriers de la chaîne. Merci, petit robot !', 'caisses');
        for (const [i, b] of bins.entries()) await carry(b, drop[i], S);
        await drive(rt.len, 3.5); s = 0;
        chime(); st.done = true;
      };
    })();

    /* ---- le chariot élévateur ---- */
    (function () {
      const st = makeStation('chariot'), S = st.g, dec = grp(S);
      // pallet rack: two bays, two levels (blue frames, orange beams)
      const RX0 = 4.85, RX1 = 5.85, BY = [1.95, 3.7];
      [1.45, -1.45, -4.35].forEach((z) => { [RX0, RX1].forEach((x) => rbox(dec, 0.1, 4.6, 0.1, 0.02, UM.blue, x, 2.3, z, 0.01)); for (let y = 0.4; y < 4.4; y += 0.9) rod(dec, new V3(RX0, y, z), new V3(RX1, y + 0.6, z), 0.02, UM.blue, 4); rbox(dec, 1.2, 0.05, 0.25, 0.02, UM.rgrey, (RX0 + RX1) / 2, 0.03, z, 0.01); });
      BY.forEach((y) => [RX0, RX1].forEach((x) => { rbox(dec, 0.08, 0.14, 2.8, 0.02, UM.orange, x, y - 0.07, 0, 0.01); rbox(dec, 0.08, 0.14, 2.8, 0.02, UM.orange, x, y - 0.07, -2.9, 0.01); }));
      const pallet = (p, x, y, z) => { const g = grp(p, x, y, z); [-0.5, 0, 0.5].forEach((dz) => { rbox(g, 1.2, 0.1, 0.14, 0.02, UM.wood, 0, 0.07, dz, 0.01); }); for (let dx = -0.5; dx <= 0.5; dx += 0.25) rbox(g, 0.12, 0.025, 1.0, 0.01, UM.wood, dx, 0.135, 0, 0.005); [-0.5, 0.5].forEach((dx) => rbox(g, 0.12, 0.02, 1.0, 0.01, UM.wood, dx, 0.01, 0, 0.005)); return g; };
      [[5.35, 0, -2.9], [5.35, BY[1], 0], [5.35, BY[0], -2.9], [5.35, BY[1], -2.9]].forEach(([x, y, z], i) => { const g = pallet(dec, x, y, z); for (let k = 0; k < 4; k++) rbox(g, 0.5, 0.45, 0.45, 0.03, [UM.blue, MT.red, UM.yel, UM.green][(k + i) % 4], (k % 2 ? 0.27 : -0.27), 0.38, (k < 2 ? 0.25 : -0.25), 0.02); });
      fenceLine(dec, [[-5.8, -1.8], [-2.5, -1.8]]);
      bake(dec);
      // the pallet of wheels to put away
      const P0 = new V3(0.6, 0, 0);
      const pal = pallet(S, P0.x, 0, 0); [[0.27, 0.25], [-0.27, 0.25], [0.27, -0.25], [-0.27, -0.25]].forEach(([x, z]) => [0, 1].forEach((k) => { const t = grp(pal, x, 0.27 + k * 0.23, z); t.rotation.x = Math.PI / 2; add(t, new THREE.TorusGeometry(0.17, 0.1, 8, 18), MT.rubberS); cylZ(t, 0.12, 0.12, UM.alu, 0, 0, 0, 14); }));
      bake(pal);
      const F = forklift(S, st); const m = F.g; st.m = m; m.position.x = -4.8; st.lastX = -4.8; st.wheels = F.wheels;
      const ins = P0.x - 1.87, rack = (RX0 + RX1) / 2 - 1.87;
      part(st, 'fourches', 'les fourches', anchor(F.carriage, 0.9, 0.2, 0.35), true);
      part(st, 'mat', 'le mât', anchor(F.mast, 0.05, 2.0, 0.4), true);
      part(st, 'contrepoids', 'le gros poids', anchor(m, -1.4, 1.1, 0.5), false);
      part(st, 'etagere', "l'étagère", anchor(S, RX0, 3.0, 1.5), false);
      part(st, 'palette', 'la palette de roues', anchor(pal, 0, 0.8, 0.4), false);
      st.focus = new V3(0.6, 2.0, 0); st.size = { w: 14, h: 7.5 }; st.tagAt = anchor(m, 0, 3.1, 0);
      st.update = (dt) => roll(st, dt);
      const lift = (h, d) => tw(d, (k) => F.setLift(F.h + (h - F.h) * k), easeSine);
      st.action = async function () {
        if (st.done) { S.attach(pal); pal.position.copy(P0); pal.rotation.set(0, 0, 0); m.position.x = -4.8; st.lastX = -4.8; F.setLift(0); pop(pal, 0.4); pop(m, 0.5); st.done = false; await sleep(0.5); }
        engineOn(60);
        await Promise.all([step('Le chariot élévateur arrive devant une palette de roues.', 'palette'), to(m.position, 'x', ins - 1.2, 3, easeSine)]);
        await Promise.all([step('Ses deux fourches glissent sous la palette.', 'fourches'), to(m.position, 'x', ins, 1.8, easeSine)]);
        F.carriage.attach(pal);
        await Promise.all([step('Le mât monte, comme un ascenseur. La palette se soulève !', 'mat'), lift(0.3, 1.2)]);
        await to(m.position, 'x', rack - 1.3, 2.6, easeSine);
        await Promise.all([step("Tout là-haut, sur l'étagère…", 'etagere'), lift(BY[0] + 0.12, 2.6)]);
        await to(m.position, 'x', rack, 1.8, easeSine);
        await lift(BY[0], 0.8); S.attach(pal); pal.position.y = BY[0]; thud(); await lift(BY[0] - 0.12, 0.5);
        st.reversing = true;
        await Promise.all([step("Il recule : bip, bip ! Derrière, son gros poids l'empêche de basculer.", 'contrepoids'), to(m.position, 'x', -2.5, 3.5, easeSine), lift(0, 3.5)]);
        st.reversing = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le camion porte-voitures ---- */
    (function () {
      const st = makeStation('camion'), S = st.g;
      const K = carrier(S); const T = K.g; st.m = T; st.wheels = K.wheels; const up = K.up, ramps = K.ramps;
      K.links.forEach((l) => st.links.push(l));
      const WAIT = [-3.4, -8.2, -13.0, -17.8];
      const cols = [CARM[0], CARM[2], CARM[1], CARM[3]];
      const cars = WAIT.map((x, i) => { const c = car(S, cols[i], {}); bake(c.g); c.g.position.set(x, 0, 4.6); c.g.rotation.y = Math.PI; return c.g; });
      const homes = cars.map((c) => c.position.clone());
      // where each car goes: [deck ('up' or 'low'), x on the deck]
      const plan = [['up', -1.9], ['up', -7.1], ['low', -3.7], ['low', -8.7]];
      const order = [3, 2, 1, 0];
      const RF = -14.04, RT = -11.6, LD = 0.92, TILT = 0.158;
      const pitchOn = (x) => (x > RF && x < RT ? Math.atan2(LD, RT - RF) : 0), yOn = (x) => clamp((x - RF) / (RT - RF), 0, 1) * LD;
      const drive = async (c, deck, xd) => {
        const p = c.position; const r = route([[p.x, p.z], [-19.5, 4.4], [-22, 2.2], [-20, 0.1], [-16.5, 0], [RF, 0]], false, 0.4);
        await tw(r.len / 5.5, (k) => placeOn(c, r, r.len * k), easeSine);
        await tw(1.4, (k) => { const x = RF + (-11.0 - RF) * k; c.position.set(x, yOn(x), 0); c.rotation.set(0, 0, pitchOn(x)); }, lin);
        const host = deck === 'up' ? up : T; host.attach(c);
        const p0 = c.position.clone(), r0 = c.rotation.z, ty = deck === 'up' ? 0.04 : LD;
        await tw(2.2, (k) => { c.position.set(p0.x + (xd - (deck === 'up' ? 1.5 : 0) - p0.x) * k, p0.y + (ty - p0.y) * Math.min(1, k * 3), 0); c.rotation.z = r0 * (1 - Math.min(1, k * 3)); }, easeSine);
        thud();
      };
      part(st, 'camion', 'le camion', anchor(T, 3.2, 3.2, 1.1), true);
      part(st, 'etage', "l'étage du haut", anchor(up, -6, 0.5, 1.25), true);
      part(st, 'rampes', 'les rampes', anchor(T, -12.6, 0.6, 1.1), false);
      part(st, 'voitures', 'les voitures neuves', anchor(S, -10.6, 1.6, 5.2), true);
      st.focus = new V3(-7, 2.2, 1.8); st.size = { w: 27, h: 11 }; st.tagAt = anchor(T, -4, 5.2, 0);
      st.update = (dt) => { roll(st, dt); if (st.go && Math.random() < 0.6) puff(T.localToWorld(new V3(1.6, 0.4, -1.1)), 1, 0xc8ccd8, 0.25); };
      st.action = async function () {
        if (st.done) { T.visible = true; T.position.x = 0; st.lastX = 0; up.rotation.z = 0; cars.forEach((c, i) => { S.attach(c); c.position.copy(homes[i]); c.rotation.set(0, Math.PI, 0); pop(c, 0.5); }); pop(T, 0.6); st.done = false; await sleep(0.6); }
        await Promise.all([step('Le camion porte-voitures attend les voitures toutes neuves.', 'voitures'), ...ramps.map((r) => to(r.rotation, 'z', 0.348, 2, easeSine))]);
        tone(160, 0, 2.5, 'sawtooth', 0.015, 120);
        await Promise.all([step("L'étage du haut descend, comme un grand toboggan.", 'etage'), to(up.rotation, 'z', TILT, 2.6, easeSine)]);
        engineOn(70);
        await Promise.all([step('Une voiture monte… puis une autre. Elles vont tout en haut !', 'rampes'), (async () => { await drive(cars[order[0]], ...plan[0]); await drive(cars[order[1]], ...plan[1]); })()]);
        tone(160, 0, 2.5, 'sawtooth', 0.015, 200);
        await Promise.all([step("L'étage du haut remonte. Hop, les voitures sont bien rangées.", 'etage'), to(up.rotation, 'z', 0, 2.6, easeSine)]);
        await Promise.all([step("Deux autres voitures montent à l'étage du bas.", 'rampes'), (async () => { await drive(cars[order[2]], ...plan[2]); await drive(cars[order[3]], ...plan[3]); })()]);
        await Promise.all([step('Les rampes se relèvent…', 'rampes'), ...ramps.map((r) => to(r.rotation, 'z', -Math.PI / 2, 1.6, easeSine))]);
        st.go = true; engineOn(90);
        await Promise.all([step('…et le camion part livrer les voitures aux garages. Au revoir !', 'camion'), to(T.position, 'x', 24, 6, easeIn)]);
        st.go = false; engineOff(); T.visible = false; chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= machines ================= */
const ARCH = (() => { const g = new THREE.CylinderGeometry(0.43, 0.43, 1.8, 18, 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); return g; })();
/** A small modern hatchback facing +x, wheels on y = 0 (hubs at x ±1.35, z ±0.8, R 0.33). Returns { g, roof, wheels }. */
function car(p, M, o = {}) {
  const g = grp(p), sh = grp(g), D = UM.dark;
  ext(sh, [[-2.08, 0.3], [1.98, 0.3], [2.14, 0.46], [2.12, 0.74], [0.98, 0.96], [-1.95, 1.0], [-2.14, 0.86], [-2.18, 0.5]], [0.1, 0.12, 0.12, 0.25, 0.1, 0.12, 0.14, 0.1], 1.76, M, 0, 0, 0, 0.04);
  [1.35, -1.35].forEach((x) => add(sh, ARCH, D, x, 0.33, 0));
  ext(sh, [[0.96, 0.95], [0.12, 1.42], [-1.5, 1.44], [-1.98, 0.98]], [0.05, 0.12, 0.12, 0.05], 1.62, o.glass || MT.glassD, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => {
    rod(sh, new V3(0.96, 0.97, s * 0.79), new V3(0.12, 1.43, s * 0.79), 0.05, M, 6); rod(sh, new V3(-1.5, 1.44, s * 0.79), new V3(-1.98, 1.0, s * 0.79), 0.09, M, 6);
    box(sh, 0.12, 0.46, 0.06, M, -0.45, 1.2, s * 0.79);
    [0.95, -0.45, -1.55].forEach((x) => box(sh, 0.02, 0.55, 0.02, D, x, 0.68, s * 0.885)); [0.3, -0.85].forEach((x) => box(sh, 0.14, 0.035, 0.03, MT.chrome, x, 0.86, s * 0.89));
    rbox(sh, 0.12, 0.1, 0.16, 0.03, M, 0.86, 1.02, s * 0.96, 0.01);
    rbox(sh, 0.06, 0.1, 0.36, 0.03, MT.lamp, 2.11, 0.64, s * 0.55, 0.01); rbox(sh, 0.06, 0.12, 0.3, 0.03, MT.tail, -2.15, 0.8, s * 0.6, 0.01);
  });
  rbox(sh, 0.05, 0.14, 0.8, 0.03, D, 2.14, 0.5, 0, 0.01); rbox(sh, 0.1, 0.12, 1.72, 0.04, D, 2.1, 0.34, 0, 0.01); rbox(sh, 0.1, 0.12, 1.72, 0.04, D, -2.15, 0.36, 0, 0.01);
  box(sh, 0.02, 0.1, 0.42, MT.white, 2.17, 0.36, 0); box(sh, 0.02, 0.1, 0.42, MT.white, -2.21, 0.52, 0);
  const roof = grp(g, -0.68, 1.46, 0); rbox(roof, 1.66, 0.07, 1.64, 0.04, M, 0, 0, 0, 0.02);
  const wheels = [];
  if (o.wheels !== false) [1.35, -1.35].forEach((x) => [1, -1].forEach((s) => wheels.push(tire(g, 0.33, 0.22, x, 0.33, s * 0.8, UM.alu, s))));
  return { g, roof, wheels };
}

/* KUKA/FANUC-like six-axis robot: nested joints a1 (turn) → a2 (shoulder) → a3 (elbow) → a4 (forearm roll) → a5 (wrist) → a6 (flange) → tool. */
const L1 = 1.5, L2 = 1.6;
function robot(p, x, z, o = {}) {
  const M = o.mat || UM.orange, D = UM.rgrey;
  const g = grp(p, x, 0, z); let d = grp(g);
  rbox(d, 1.0, 0.22, 1.0, 0.06, UM.dark, 0, 0.11, 0, 0.02); [[0.38, 0.38], [0.38, -0.38], [-0.38, 0.38], [-0.38, -0.38]].forEach(([a, b]) => cylY(d, 0.05, 0.05, MT.steel, a, 0.24, b, 8));
  cylY(d, 0.45, 0.08, D, 0, 0.26, 0, 24); cylY(d, 0.4, 0.26, M, 0, 0.42, 0, 24); rbox(d, 0.22, 0.2, 0.3, 0.04, D, -0.45, 0.36, 0, 0.02);
  bake(d);
  const a1 = grp(g, 0, 0.55, 0); d = grp(a1);
  ext(d, [[-0.42, 0], [0.32, 0], [0.38, 0.22], [0.28, 0.62], [-0.28, 0.62], [-0.45, 0.3]], 0.08, 0.72, M, 0, 0, 0, 0.03);
  cylY(d, 0.13, 0.32, D, -0.3, 0.7, 0.18, 14); cylY(d, 0.14, 0.04, MT.steel, -0.3, 0.87, 0.18, 14);
  bake(d);
  const a2 = grp(a1, 0.15, 0.62, 0); d = grp(a2);
  cylZ(d, 0.3, 0.84, D, 0, 0, 0, 20); cylZ(d, 0.18, 0.9, M, 0, 0, 0, 16); cylZ(d, 0.17, 0.3, D, 0, 0, 0.58, 14); cylZ(d, 0.12, 0.04, MT.steel, 0, 0, 0.74, 14);
  ext(d, [[-0.24, -0.05], [0.24, -0.05], [0.18, L1], [-0.18, L1]], 0.12, 0.44, M, 0, 0, 0, 0.03);
  rod(d, new V3(-0.26, 0.05, -0.36), new V3(-0.12, 0.95, -0.36), 0.08, D, 10); rod(d, new V3(-0.12, 0.95, -0.36), new V3(-0.08, 1.2, -0.36), 0.04, MT.chrome, 8);
  rod(d, new V3(0.1, 0.1, 0.25), new V3(0.08, L1 - 0.1, 0.25), 0.035, MT.black, 6);
  bake(d);
  const a3 = grp(a2, 0, L1, 0); d = grp(a3);
  cylZ(d, 0.22, 0.58, D, 0, 0, 0, 18); cylZ(d, 0.12, 0.62, M, 0, 0, 0, 12);
  rbox(d, 0.62, 0.42, 0.46, 0.1, M, -0.22, 0.1, 0, 0.03); [0.1, -0.1].forEach((zz) => cylX(d, 0.09, 0.3, D, -0.62, 0.12, zz, 12));
  ext(d, [[0.05, -0.15], [1.28, -0.1], [1.28, 0.1], [0.05, 0.2]], 0.06, 0.3, M, 0, 0, 0, 0.02);
  rod(d, new V3(-0.3, 0.3, 0.12), new V3(1.1, 0.14, 0.12), 0.03, MT.black, 6);
  bake(d);
  const a4 = grp(a3, 1.3, 0, 0); d = grp(a4);
  cylX(d, 0.115, 0.16, M, 0.08, 0, 0, 16); [1, -1].forEach((s) => rbox(d, 0.26, 0.2, 0.05, 0.04, M, 0.24, 0, s * 0.1, 0.01));
  bake(d);
  const a5 = grp(a4, 0.3, 0, 0); d = grp(a5); cylZ(d, 0.09, 0.15, D, 0, 0, 0, 12); cylX(d, 0.07, 0.14, D, 0.08, 0, 0, 12); bake(d);
  const a6 = grp(a5, 0.15, 0, 0); d = grp(a6); cylX(d, 0.085, 0.04, MT.steel, 0.02, 0, 0, 14); bake(d);
  const tool = grp(a6, 0.04, 0, 0);
  return { g, a1, a2, a3, a4, a5, a6, tool, TL: 0.19, P: new V3(1, 2, 0), tau: -1 };
}
/** Point the tool tip at P (robot-local), the tool at angle tau in the arm plane (0 = straight out, −π/2 = down). Two-link IK, elbow up. */
function reach(R, P, tau) {
  R.P.copy(P); R.tau = tau;
  const r = Math.hypot(P.x, P.z), a1 = Math.atan2(-P.z, P.x);
  const wx = r - Math.cos(tau) * R.TL - 0.15, wy = P.y - Math.sin(tau) * R.TL - 1.17;
  const d = clamp(Math.hypot(wx, wy), Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.02), ph = Math.atan2(wy, wx);
  const al1 = ph + Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const al2 = al1 - (Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1)));
  R.a1.rotation.y = a1; R.a2.rotation.z = al1 - Math.PI / 2; R.a3.rotation.z = al2 - al1 + Math.PI / 2; R.a5.rotation.z = tau - al2;
}
const _gp = new V3();
function go(R, P1, t1, dur, after, ease = easeSine) {
  if (typeof after !== 'function') { ease = after || ease; after = null; }
  const P0 = R.P.clone(), t0 = R.tau, P = P1.clone();
  return tw(dur, (k) => { reach(R, _gp.copy(P0).lerp(P, k), t0 + (t1 - t0) * k); if (after) after(); }, ease);
}
/** Spot-welding gun (C-shaped, copper tips). */
function weldGun(R) {
  const d = grp(R.tool);
  rbox(d, 0.3, 0.28, 0.24, 0.05, UM.rgrey, 0.15, 0, 0, 0.02); cylX(d, 0.05, 0.1, UM.dark, 0.3, 0.1, 0.08, 8);
  rbox(d, 0.36, 0.07, 0.08, 0.02, MT.steel, 0.42, 0.13, 0, 0.01); rbox(d, 0.07, 0.13, 0.08, 0.02, MT.steel, 0.6, 0.08, 0, 0.01);
  rbox(d, 0.36, 0.07, 0.08, 0.02, MT.steel, 0.42, -0.15, 0, 0.01); rbox(d, 0.07, 0.11, 0.08, 0.02, MT.steel, 0.6, -0.1, 0, 0.01);
  cylY(d, 0.025, 0.05, UM.copper, 0.6, 0.0, 0, 8); cylY(d, 0.025, 0.05, UM.copper, 0.6, -0.05, 0, 8);
  bake(d); R.TL = 0.19 + 0.6; R.tip = anchor(R.tool, 0.6, -0.02, 0);
}
/** Paint robot rotary bell. */
function bell(R) {
  const d = grp(R.tool);
  cylX(d, 0.08, 0.36, UM.white, 0.18, 0, 0, 14); cylX(d, 0.05, 0.08, MT.steel, 0.4, 0, 0, 12);
  const c = add(d, new THREE.ConeGeometry(0.12, 0.12, 18, 1, true), MT.chrome, 0.48, 0, 0); c.rotation.z = Math.PI / 2;
  rod(d, new V3(0.02, 0.09, 0), new V3(0.3, 0.09, 0), 0.02, MT.black, 4);
  bake(d); R.TL = 0.19 + 0.52; R.tip = anchor(R.tool, 0.55, 0, 0); R.tip2 = anchor(R.tool, 0.2, 0, 0);
}
/** Vacuum gripper (frame with four suction cups) — for the roof. */
function gripper(R) {
  const d = grp(R.tool);
  cylX(d, 0.07, 0.18, UM.rgrey, 0.09, 0, 0, 12); rbox(d, 0.06, 0.08, 1.1, 0.02, UM.rgrey, 0.22, 0, 0, 0.01); rbox(d, 0.06, 1.1, 0.08, 0.02, UM.rgrey, 0.22, 0, 0, 0.01);
  [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].forEach(([y, z]) => { cylX(d, 0.02, 0.08, MT.steel, 0.28, y, z, 6); add(d, new THREE.ConeGeometry(0.07, 0.05, 12), MT.black, 0.33, y, z).rotation.z = Math.PI / 2; });
  bake(d); R.TL = 0.19 + 0.36; R.tip = anchor(R.tool, 0.36, 0, 0);
}

/** Flat autonomous mobile robot (AGV) with lidars, LED strip, e-stop and a small rack on top. Returns { g, led }. */
function agv(p) {
  const g = grp(p), d = grp(g), led = UM.ledB.clone();
  rbox(d, 1.5, 0.28, 0.95, 0.12, UM.light, 0, 0.2, 0, 0.03); rbox(d, 1.56, 0.08, 1.0, 0.06, UM.dark, 0, 0.1, 0, 0.02);
  rbox(d, 1.3, 0.05, 0.82, 0.04, UM.rgrey, 0, 0.36, 0, 0.01);
  [[0.66, 0.38], [-0.66, -0.38]].forEach(([x, z]) => { cylY(d, 0.08, 0.12, MT.black, x, 0.4, z, 12); cylY(d, 0.06, 0.04, UM.yel, x, 0.48, z, 12); });
  cylY(d, 0.07, 0.04, UM.yel, -0.62, 0.36, 0.3, 12); sph(d, 0.055, MT.red, -0.62, 0.4, 0.3);
  box(d, 0.02, 0.1, 0.3, MT.glassD, 0.76, 0.24, 0); [0.42, -0.42].forEach((z) => cylZ(d, 0.08, 0.06, MT.black, 0.45, 0.08, z, 10));
  // the rack the bins sit on
  [[0.6, 0.38], [0.6, -0.38], [-0.6, 0.38], [-0.6, -0.38]].forEach(([x, z]) => box(d, 0.04, 0.12, 0.04, MT.steel, x, 0.43, z));
  bake(d);
  rbox(g, 1.52, 0.04, 0.97, 0.05, led, 0, 0.2, 0, 0.01);
  return { g, led };
}

/** Counterbalance forklift facing +x: chassis, counterweight, overhead guard, two-stage mast. Returns { g, mast, inner, carriage, wheels, setLift(h), h }. */
function forklift(p, st) {
  const g = grp(p), d = grp(g), Y = UM.yel, D = UM.rgrey;
  ext(d, [[-0.85, 0.22], [0.95, 0.22], [0.98, 0.7], [0.6, 0.95], [-0.85, 1.0]], [0.04, 0.06, 0.1, 0.1, 0.05], 1.1, Y, 0, 0, 0, 0.03);
  ext(d, [[-1.55, 0.2], [-0.82, 0.2], [-0.82, 1.18], [-1.35, 1.18], [-1.6, 0.85]], [0.05, 0.03, 0.05, 0.15, 0.1], 1.16, D, 0, 0, 0, 0.03);
  box(d, 0.02, 0.22, 0.9, MT.stripes, -1.6, 0.5, 0); [0.4, -0.4].forEach((z) => rbox(d, 0.05, 0.1, 0.14, 0.02, MT.tail, -1.58, 0.9, z, 0.01));
  rbox(d, 0.5, 0.1, 0.5, 0.04, MT.black, -0.45, 1.05, 0, 0.02); rbox(d, 0.1, 0.5, 0.5, 0.04, MT.black, -0.7, 1.3, 0, 0.02);
  operator(d, -0.45, 1.0, 0);
  rod(d, new V3(0.5, 0.95, 0), new V3(0.25, 1.4, 0), 0.03, MT.black, 6); add(d, new THREE.TorusGeometry(0.16, 0.025, 6, 16), MT.black, 0.25, 1.42, 0).rotation.set(Math.PI / 2, 0.5, 0);
  [0.5, -0.5].forEach((z) => { rod(d, new V3(0.62, 0.9, z), new V3(0.45, 2.15, z), 0.04, UM.dark, 8); rod(d, new V3(-0.95, 1.15, z), new V3(-0.95, 2.15, z), 0.04, UM.dark, 8); rbox(d, 0.06, 0.08, 0.1, 0.02, MT.lamp, 0.5, 1.9, z * 1.1, 0.01); });
  rbox(d, 1.5, 0.06, 1.1, 0.03, UM.dark, -0.25, 2.17, 0, 0.01); for (let x = -0.8; x < 0.4; x += 0.3) box(d, 0.05, 0.04, 1.0, UM.dark, x, 2.22, 0);
  cylX(d, 0.17, 0.72, UM.white, -1.2, 1.4, 0, 16); [-0.95, -1.45].forEach((x) => box(d, 0.04, 0.2, 0.4, MT.black, x, 1.3, 0));
  rod(d, new V3(0.65, 0.75, 0.42), new V3(1.05, 1.0, 0.42), 0.04, MT.chrome, 6); rod(d, new V3(0.65, 0.75, -0.42), new V3(1.05, 1.0, -0.42), 0.04, MT.chrome, 6);
  const spot = add(d, new THREE.CircleGeometry(0.35, 20), new THREE.MeshBasicMaterial({ color: 0x3a8cff, transparent: true, opacity: 0.65, depthWrite: false }), 3.6, 0.03, 0); spot.rotation.x = -Math.PI / 2;
  [0.62, -0.62].forEach((z) => fender(d, 0.42, 0.3, 0.6, 0.35, z, Y, Math.PI * 0.6));
  bake(d);
  beacon(st, g, -0.8, 2.22, 0);
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.34, 0.26, 0.6, 0.34, s * 0.58, UM.dark, s)); wheels.push(tire(g, 0.27, 0.2, -1.05, 0.27, s * 0.5, UM.dark, s)); });
  // mast: outer channels (fixed), inner channels (slide), carriage with forks (slide)
  const mast = grp(g, 1.05, 0, 0), md = grp(mast);
  [0.36, -0.36].forEach((z) => rbox(md, 0.1, 2.3, 0.12, 0.02, D, 0.05, 1.15, z, 0.01)); [0.25, 2.25].forEach((y) => rbox(md, 0.1, 0.1, 0.84, 0.02, D, 0.05, y, 0, 0.01));
  cylY(md, 0.07, 1.4, D, -0.02, 0.85, 0, 12);
  bake(md);
  const inner = grp(mast), id = grp(inner);
  [0.26, -0.26].forEach((z) => rbox(id, 0.08, 2.2, 0.1, 0.02, MT.steel, 0.1, 1.2, z, 0.01)); rbox(id, 0.08, 0.1, 0.62, 0.02, MT.steel, 0.1, 2.25, 0, 0.01);
  cylY(id, 0.04, 1.4, MT.chrome, -0.02, 1.0, 0, 10); cylZ(id, 0.08, 0.12, D, 0.1, 2.32, 0, 12);
  bake(id);
  const carriage = grp(inner), cd = grp(carriage);
  rbox(cd, 0.08, 0.5, 0.95, 0.02, D, 0.16, 0.3, 0, 0.01); for (let z = -0.4; z <= 0.41; z += 0.2) box(cd, 0.04, 0.6, 0.04, D, 0.16, 0.85, z); box(cd, 0.05, 0.05, 0.95, D, 0.16, 1.15, 0);
  [0.28, -0.28].forEach((z) => { rbox(cd, 0.06, 0.5, 0.11, 0.01, UM.dark, 0.21, 0.3, z, 0.005); rbox(cd, 1.12, 0.05, 0.11, 0.01, UM.dark, 0.77, 0.065, z, 0.005); });
  bake(cd);
  const F = { g, mast, inner, carriage, wheels, h: 0, setLift(h) { F.h = h; carriage.position.y = Math.min(h, 1.4); inner.position.y = Math.max(0, h - 1.4); } };
  return F;
}

/** Car transporter: cab-over tractor + two-deck semi-trailer, tilting upper deck, folding rear ramps. Returns { g, up, ramps, wheels, links }. */
function carrier(p) {
  const g = grp(p), d = grp(g), A = UM.alu, D = UM.dark;
  // tractor
  [0.45, -0.45].forEach((z) => rbox(d, 5.0, 0.28, 0.16, 0.03, MT.black, 1.9, 0.95, z, 0.01));
  rbox(d, 0.3, 0.12, 2.3, 0.04, D, 4.3, 0.55, 0, 0.01);
  [1, -1].forEach((s) => cylX(d, 0.3, 0.85, MT.chrome, 1.78, 0.75, s * 0.85, 16));
  cylY(d, 0.55, 0.1, D, 0.75, 1.16, 0, 18); cylY(d, 0.08, 1.3, MT.chrome, 2.2, 2.4, -0.95, 10);
  [2.85, 0.75].forEach((x) => [1, -1].forEach((s) => fender(d, 0.62, 0.42, x, 0.5, s * 1.0, D, Math.PI * 0.6)));
  // trailer: side beams with the gooseneck, deck plates, front posts, lights
  [1.22, -1.22].forEach((z) => { ext(d, [[1.65, 1.3], [1.65, 1.62], [-0.95, 1.62], [-1.45, 1.0], [-11.6, 1.0], [-11.6, 0.72], [-1.6, 0.72], [-1.15, 1.3]], 0.05, 0.12, A, 0, 0, z, 0.02); rbox(d, 0.16, 1.45, 0.16, 0.03, A, 1.3, 1.6 + 0.72, z, 0.01); });
  rbox(d, 2.6, 0.1, 2.3, 0.02, D, 0.35, 1.57, 0, 0.01);
  [0.78, -0.78].forEach((z) => { rbox(d, 10.1, 0.08, 0.55, 0.02, D, -6.55, LDECK - 0.04, z, 0.01); const sl = rbox(d, 0.86, 0.08, 0.55, 0.02, D, -1.2, 1.26, z, 0.01); sl.rotation.z = 0.94; });
  for (let x = -11.2; x < -1.4; x += 1.2) box(d, 0.1, 0.1, 2.3, MT.black, x, 0.8, 0);
  [0.95, -0.95].forEach((z) => { rbox(d, 0.06, 0.14, 0.3, 0.02, MT.tail, -11.64, 0.85, z, 0.01); rbox(d, 0.04, 0.4, 0.5, 0.02, MT.black, -11.4, 0.4, z * 1.05, 0.01); });
  decal(d, 'BIDULE AUTOS', 3.2, 0.42, '#2f6fe0', -5.4, 0.86, 1.29);
  bake(d);
  truckCab(g, UM.blue, 2.35);
  const wheels = [];
  [[2.85, 0.5, 0.36, 1.0], [0.75, 0.5, 0.4, 0.95]].forEach(([x, R, w, z]) => [1, -1].forEach((s) => wheels.push(tire(g, R, w, x, R, s * z, UM.alu, s))));
  [-8.5, -9.4, -10.3].forEach((x) => [1, -1].forEach((s) => wheels.push(tire(g, 0.4, 0.3, x, 0.4, s * 0.95, UM.alu, s))));
  // upper deck, pivoting at the front
  const up = grp(g, 1.5, 3.05, 0), ud = grp(up);
  [1.22, -1.22].forEach((z) => { rbox(ud, 13.1, 0.26, 0.12, 0.03, A, -6.5, 0.02, z, 0.01); for (let x = -12.5; x < 0; x += 1.6) box(ud, 0.06, 0.45, 0.06, A, x, 0.35, z); rbox(ud, 13.1, 0.06, 0.06, 0.02, A, -6.5, 0.58, z, 0.01); });
  [0.78, -0.78].forEach((z) => rbox(ud, 13.0, 0.08, 0.55, 0.02, D, -6.5, 0.0, z, 0.01));
  for (let x = -12.6; x < 0; x += 1.2) box(ud, 0.1, 0.1, 2.4, MT.black, x, -0.08, 0);
  bake(ud);
  const links = [1.22, -1.22].map((z) => hydraulic(g, anchor(g, -6.1, 1.0, z * 1.02), anchor(up, -7.6, -0.08, z * 1.02), { barrel: 0.85, rb: 0.09, mat: UM.blue }));
  // folding ramps at the back
  const ramps = [0.78, -0.78].map((z) => { const r = grp(g, -11.6, LDECK, z), rd = grp(r); rbox(rd, 2.7, 0.06, 0.5, 0.02, A, -1.35, 0, 0, 0.01); for (let x = -2.5; x < 0; x += 0.3) box(rd, 0.04, 0.03, 0.48, D, x, 0.04, 0); bake(rd); r.rotation.z = -Math.PI / 2; return r; });
  shadows(g);
  return { g, up, ramps, wheels, links };
}
const LDECK = 0.92;

/* ================= the factory around the machines (built in (h, y, d) coordinates) ================= */
/** A safety fence: yellow posts, a see-through mesh panel and rails, along [h|x, d|z] points. */
function fenceLine(p, pts, H = 1.8) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2)), a = Math.atan2(-(z1 - z0), x1 - x0);
    for (let k = 0; k <= n; k++) { const t = k / n; rbox(p, 0.08, H, 0.08, 0.02, UM.yel, x0 + (x1 - x0) * t, H / 2, z0 + (z1 - z0) * t, 0.01); }
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const pnl = box(p, L, H - 0.25, 0.02, UM.mesh, mx, H / 2 + 0.05, mz); pnl.rotation.y = a;
    [0.15, H - 0.05].forEach((y) => { const r = box(p, L, 0.05, 0.05, UM.yel, mx, y, mz); r.rotation.y = a; });
  }
}
function buildFactory(H) {
  const F = (h, d) => [h, d];
  const H0 = -40, H1 = 35, DB = -22, DF = 8, WH = 9;
  // back wall: cream with a blue base, a band of windows, the factory name
  rbox(H, H1 - H0, WH, 0.4, 0.05, UM.cream, (H0 + H1) / 2, WH / 2, DB - 0.2, 0.02);
  box(H, H1 - H0, 0.9, 0.04, UM.blue, (H0 + H1) / 2, 0.45, DB + 0.02);
  for (let h = H0 + 2.5; h < H1 - 2; h += 4) box(H, 3.2, 1.6, 0.04, UM.win, h, 6.0, DB + 0.02);
  rbox(H, 22, 1.6, 0.1, 0.05, UM.white, -2.5, 8.1, DB + 0.05, 0.02); decal(H, 'BIDULE AUTOS', 20, 1.4, '#2f6fe0', -2.5, 8.1, DB + 0.12);
  // side walls sloping down towards the front (cut-away), with an exit door on the right for new cars
  const slope = (d) => 1.4 + (DF - d) * ((WH - 1.4) / (DF - (DB + 8)));
  const side = (h, polys) => { const g = grp(H, h, 0, 0); g.rotation.y = -Math.PI / 2; polys.forEach((pts) => ext(g, pts, 0.05, 0.4, UM.cream, 0, 0, 0, 0.02)); return g; };
  side(H0 - 0.2, [[[DB, 0], [DF, 0], [DF, 1.4], [DB + 8, WH], [DB, WH]]]);
  side(H1 + 0.2, [[[DB, 0], [-11, 0], [-11, slope(-11)], [DB + 8, WH], [DB, WH]], [[-7, 0], [DF, 0], [DF, 1.4], [-7, slope(-7)]], [[-11, 3.2], [-7, 3.2], [-7, slope(-7)], [-11, slope(-11)]]]);
  // front wall: low, with two openings
  [[H0, -14], [-9, 10], [16, H1]].forEach(([a, b]) => { rbox(H, b - a, 1.1, 0.3, 0.04, UM.cream, (a + b) / 2, 0.55, DF + 0.15, 0.02); box(H, b - a, 0.1, 0.34, UM.yel, (a + b) / 2, 1.12, DF + 0.15); });
  // columns, eave beams, light trusses (no roof over the machines), a narrow roof along the back
  const CH = [-40, -25.5, -12.75, 0.5, 18.5, 35];
  CH.forEach((h) => { [DB + 0.5, -5.0].forEach((d) => { rbox(H, 0.4, WH + 0.6, 0.4, 0.04, UM.blueD, h, (WH + 0.6) / 2, d, 0.02); rbox(H, 0.7, 0.12, 0.7, 0.02, UM.dark, h, 0.06, d, 0.01); }); box(H, 0.42, 0.9, 0.42, UM.yel, h, 0.9, -5.0); });
  rbox(H, H1 - H0, 0.4, 0.3, 0.03, UM.blueD, (H0 + H1) / 2, WH + 0.6, DB + 0.5, 0.01);
  CH.forEach((h) => {
    const y0 = WH + 0.6, y1 = WH + 1.6, a = DB + 0.5, b = -5.0, n = 10;
    rod(H, new V3(h, y0, a), new V3(h, y0, b), 0.07, UM.white, 6); rod(H, new V3(h, y1, a), new V3(h, y1, b), 0.07, UM.white, 6);
    for (let i = 0; i <= n; i++) { const d0 = a + ((b - a) * i) / n, d1 = a + ((b - a) * (i + 1)) / n; rod(H, new V3(h, y0, d0), new V3(h, y1, d0), 0.04, UM.white, 4); if (i < n) rod(H, new V3(h, i % 2 ? y0 : y1, d0), new V3(h, i % 2 ? y1 : y0, d1), 0.035, UM.white, 4); }
  });
  { const r = rbox(H, H1 - H0 + 0.6, 0.2, 4.4, 0.04, UM.roof, (H0 + H1) / 2, WH + 2.1, DB + 1.8, 0.02); r.rotation.x = 0.12; }
  // parts racks along the back wall
  for (let h = H0 + 2; h < H1 - 2; h += 3) {
    [h - 1.4, h + 1.4].forEach((x) => [-20.0, -21.1].forEach((d) => box(H, 0.08, 4.4, 0.08, UM.blue, x, 2.2, d)));
    [1.4, 2.8, 4.2].forEach((y) => [-20.0, -21.1].forEach((d) => box(H, 2.8, 0.1, 0.06, UM.orange, h, y, d)));
    [0, 1.4, 2.8].forEach((y, j) => { for (let k = 0; k < 4; k++) if ((k + j + Math.round(h)) % 5) rbox(H, 0.6, 0.5, 0.9, 0.04, [UM.blue, MT.red, UM.yel, UM.green, UM.light][(k * 3 + j + Math.round(h)) % 5], h - 1.0 + k * 0.67, y + 0.3, -20.55, 0.02); });
  }
  // a small glazed office inside, a coffee corner, fences along the back aisle
  { const g = grp(H, -34.5, 0, 3.6); rbox(g, 5, 0.1, 3.4, 0.02, UM.light, 0, 0.05, 0, 0.01); box(g, 5, 2.6, 0.08, UM.white, 0, 1.3, -1.7); box(g, 0.08, 2.6, 3.4, UM.white, -2.5, 1.3, 0);
    box(g, 5, 1.6, 0.04, UM.glass, 0, 1.6, 1.7); box(g, 0.04, 1.6, 3.4, UM.glass, 2.5, 1.6, 0); [[0, 1.7, 5, 0.08], [2.5, 0, 0.08, 3.4]].forEach(([x, z, w, dd]) => { box(g, w, 0.8, dd, UM.white, x, 0.4, z); box(g, w, 0.12, dd, UM.white, x, 2.6, z); });
    rbox(g, 1.6, 0.06, 0.8, 0.02, UM.wood, -0.8, 0.75, -1.0, 0.01); box(g, 0.06, 0.7, 0.6, UM.dark, -0.8, 0.38, -1.0); rbox(g, 0.5, 0.35, 0.05, 0.02, MT.glassD, -0.8, 1.0, -1.25, 0.01);
    cylY(g, 0.2, 0.4, UM.orange, 1.8, 0.2, -1.2, 10); sph(g, 0.45, UM.green, 1.8, 0.75, -1.2); }
  { const g = grp(H, -37.6, 0, -1.5); rbox(g, 0.8, 1.9, 0.7, 0.05, MT.red, 0, 0.95, 0, 0.02); box(g, 0.5, 0.7, 0.02, MT.glassD, 0.0, 1.3, 0.36); rbox(g, 1.2, 0.06, 1.2, 0.03, UM.white, 1.6, 0.9, 0.4, 0.01); cylY(g, 0.05, 0.9, UM.dark, 1.6, 0.45, 0.4, 6); }
  fenceLine(H, [[-12.5, -15.5], [-1.5, -15.5]]);
  // workers at benches
  [[-27, -15.8, Math.PI / 2], [23, -15.8, Math.PI / 2], [-11, 7.0, -1.2], [8.6, -14.5, 0.3]].forEach(([h, d, ry]) => { const p = person(H, h, d, { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white }); p.rotation.y = ry; });
  [-27, 23].forEach((h) => { rbox(H, 2.2, 0.08, 0.9, 0.02, UM.wood, h, 0.95, -16.8, 0.01); [-1, 1].forEach((s) => box(H, 0.06, 0.95, 0.8, UM.rgrey, h + s * 1.0, 0.47, -16.8)); });
  /* ---- outside ---- */
  // offices: two floors of glass and a blue band
  { const g = grp(H, -39, 0, 15.5); rbox(g, 12, 6.4, 7, 0.1, UM.white, 0, 3.2, 0, 0.03); [1.6, 4.4].forEach((y) => box(g, 11.6, 1.6, 7.06, UM.win, 0, y, 0)); for (let x = -5.5; x <= 5.5; x += 1.4) box(g, 0.12, 6.0, 7.1, UM.white, x, 3.1, 0);
    rbox(g, 12.4, 0.35, 7.4, 0.05, UM.blue, 0, 6.5, 0, 0.02); box(g, 2.2, 2.2, 0.1, UM.blueD, 3, 1.1, 3.52); decal(g, 'BUREAUX', 4, 0.8, '#ffffff', -2, 5.6, 3.56); }
  // finished cars in the parking, staff cars
  for (let k = 0; k < 9; k++) [[40, -9.7], [45, -9.7]].forEach(([h, d0], j) => { if ((k + j) % 7 === 3) return; const c = car(H, CARM[(k * 2 + j * 5) % CARM.length], {}); c.g.position.set(h, 0, d0 + k * 2.6); c.g.rotation.y = j ? Math.PI : 0; });
  [-26.75, -24.25, -21.75, -16.75, -14.25, -9.25].forEach((h, i) => { const c = miniCar(H, i % 3 ? 'car' : 'van'); c.position.set(h, 0, 16); c.rotation.y = Math.PI / 2; });
  // the sign by the road, flags, lamps, trees and bushes
  { const g = grp(H, -6, 0, 20.4); [-2, 2].forEach((x) => box(g, 0.3, 3.4, 0.3, UM.dark, x, 1.7, 0)); rbox(g, 5.4, 1.5, 0.3, 0.1, UM.blue, 0, 3.4, 0, 0.03); decal(g, 'BIDULE AUTOS', 4.8, 1.0, '#ffffff', 0, 3.4, 0.17); }
  [[-31, 20.5, 0xe5302a], [-29, 20.5, 0x2f7de0], [-27, 20.5, 0xf2c21c]].forEach(([h, d, c]) => { cylY(H, 0.06, 6, UM.white, h, 3, d, 6); box(H, 1.2, 0.8, 0.03, std(c, 0.6, 0), h + 0.62, 5.5, d); });
  for (let h = -44; h <= 40; h += 12) { const [x, z] = [h, 21]; const l = lamp(H, x, z, Math.PI / 2); void l; }
  [F(-46, 6), F(-47, -6), F(-44, -18), F(-30, -28), F(-10, -30), F(10, -30), F(28, -28), F(40, -20), F(49, 2), F(36, 22), F(-20, 21), F(-1, 21.6)].forEach(([h, d], i) => autumnTree(H, h, d, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6aaa3a, 0x4a8a3a, 0x8aba4a]));
  [[-3, 20.2], [3, 20.2], [-24, 12], [33, 13], [48, -6]].forEach(([h, d]) => { sph(H, 0.8, UM.green, h, 0.5, d).scale.y = 0.7; sph(H, 0.6, std(0x6abf5a, 0.8, 0), h + 0.7, 0.4, d + 0.3).scale.y = 0.7; });
  return H;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // workers walking along the green aisles
  const aisle = R([[-37, -3.4], [33, -3.4], [33.5, 5.8], [-37, 5.8]], 0.15);
  const crew = Array.from({ length: 7 }, (_, i) => person(scene, 0, 0, i % 3 ? { top: 0x2f5fb0, bottom: 0x24407a, hat: UM.white } : { vest: true, bottom: 0x24407a, hat: MT.hat })); all.push(...crew);
  const t1 = traffic(aisle, crew, 1.3, { gap: 1.2 });
  // cars and a van on the road in front
  const road = R([[-46, 22.6], [46, 22.6], [47, 23.5], [46, 24.4], [-46, 24.4], [-47, 23.5]], 0.1);
  const cars = [0, 1, 2, 3].map((i) => miniCar(scene, i === 2 ? 'van' : 'car')); all.push(...cars);
  const t2 = traffic(road, cars, 4.2, { gap: 4 });
  // people on the sidewalk by the offices
  const walk = R([[-44, 21], [-30, 21], [-30, 20], [-44, 20]], 0.3);
  const ppl = [0, 1].map(() => person(scene, 0, 0)); all.push(...ppl);
  const t3 = traffic(walk, ppl, 1.1, { gap: 1 });
  onUpdate((dt) => { t1.update(dt, all); t2.update(dt, all); t3.update(dt, all); });
}
