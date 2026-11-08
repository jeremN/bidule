// La Montagne — a ski resort in winter: a little snowy village at the foot of a ski slope.
// The groomer prepares the slope at night, the snow cannon makes snow, the chairlift and the gondola carry people up,
// the snowplough and the snow blower clear the road and the car park, the snowmobile brings food to the mountain
// restaurant and the rescue helicopter helps a skier with a small bobo.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { trackUnit, tire, fender, operator, beacon, truckCab, hydraulic, strut } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { body, skin, plate, fin, decal, AM } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, UP = (3 * Math.PI) / 4; // UP: the machine faces up the slope
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ================= the mountain: one height function shared by the terrain, the trees, the lifts and the machines ================= */
const TOE = 9, SLOPE = 0.38, PH = -4; // the slope starts at d = −TOE; the ski run is centred on h = PH
function rawH(h, d) {
  const u = -d - TOE; if (u <= 0) return 0;
  const base = u < 4 ? (SLOPE * u * u) / 8 : SLOPE * (u - 2);
  const k = Math.min(1, u / 10), off = sstep(9, 14, Math.abs(h - PH));
  return base + 0.0022 * h * h * k + 0.7 * k * off * (Math.sin(h * 0.29 + 1.3) * Math.cos(d * 0.21 + 0.4) + 0.5 * Math.sin(h * 0.13 - d * 0.17));
}
const H = (h, d) => (-d <= TOE ? 0 : rawH(h, d) * sstep(-98, -66, d) * (1 - sstep(60, 82, Math.abs(h))));
const Hw = (x, z) => H((x - z) * S2, (x + z) * S2);
/** station-local (x, z) → world (x, z), and back */
const toW = (S, lx, lz) => { const c = Math.cos(S.rotation.y), s = Math.sin(S.rotation.y); return [S.position.x + lx * c + lz * s, S.position.z - lx * s + lz * c]; };
const toL = (S, wx, wz) => { const c = Math.cos(S.rotation.y), s = Math.sin(S.rotation.y), dx = wx - S.position.x, dz = wz - S.position.z; return [dx * c - dz * s, dx * s + dz * c]; };
const hdL = (S, h, d) => { const [x, z] = Q(h, d); return toL(S, x, z); };
/** ground height under a station-local point */
const gy = (S, lx, lz) => { const [x, z] = toW(S, lx, lz); return Hw(x, z) - S.position.y; };
/** sit object `o` (child of station S) on the snow, pitched along its heading */
function settle(S, o, fx = 1.5, bx = 1.5, lift = 0) {
  const c = Math.cos(o.rotation.y), s = Math.sin(o.rotation.y), x = o.position.x, z = o.position.z;
  const yf = gy(S, x + c * fx, z - s * fx), yb = gy(S, x - c * bx, z + s * bx);
  o.position.y = (yf * bx + yb * fx) / (fx + bx) + lift; o.rotation.z = Math.atan2(yf - yb, fx + bx);
}
const bake = (g) => { shadows(g); freeze(g); return g; };
const HEMI = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);

/* ================= palette (defined once, shared) ================= */
const PM = {
  red: std(0xd62a2a, 0.38, 0.2), redD: std(0xa31e22, 0.45, 0.2), orange: std(0xf2761c, 0.4, 0.2), orangeD: std(0xc4560f, 0.5, 0.2),
  yel: std(0xf6c01c, 0.38, 0.15), yelD: std(0xcf9612, 0.5, 0.2), blue: std(0x2f62d8, 0.4, 0.15), blueD: std(0x22489e, 0.45, 0.2),
  white: std(0xf2f4f8, 0.35, 0.1), grey: std(0xb6bbc8, 0.42, 0.5), greyD: std(0x6c7282, 0.5, 0.45), dark: std(0x2a2e3a, 0.55, 0.3),
  tower: std(0x9aa3b4, 0.45, 0.55), cable: std(0x34363e, 0.45, 0.7), conc: std(0xb4b6c0, 0.9, 0), wood: std(0x9a6438, 0.85, 0), woodD: std(0x6a4224, 0.85, 0),
  snow: std(0xb4bed6, 0.9, 0), cheese: std(0xf2c64a, 0.6, 0), bread: std(0xc0803a, 0.8, 0), green: std(0x2f8a4a, 0.5, 0.1),
  glass: MT.glassD, glassT: MT.glass, lamp: MT.lamp, tail: MT.tail, amber: MT.amber, black: MT.black, steel: MT.steel, chrome: MT.chrome, rubber: MT.rubberS
};
const dbl = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
const PMD = { red: dbl(PM.red), orange: dbl(PM.orange), yel: dbl(PM.yel), dark: dbl(PM.dark) };
const SC = {
  snow: 0xa8b2ca, wood: 0x8c5632, woodD: 0x5e3a20, woodL: 0xb07a48, stone: 0x9a98a8, stoneD: 0x77768a, roof: 0x4a3226, rock: 0x6e7288,
  plaster: 0xf0ebe0, conc: 0xb4b6c2, dark: 0x2b3040, red: 0xc8302a, green: 0x2f7a4a, blue: 0x2f5fa8, yel: 0xf2b21c, orange: 0xf06a2a, white: 0xf2f2f6
};
const WIN = new THREE.MeshBasicMaterial({ color: 0xffcf86 });
const HELMETS = [0xe5452c, 0x2f7de0, 0xf2f2f6, 0x1b1d24, 0xf2b21c, 0xa45ad8].map((c) => std(c, 0.3, 0.2));
const BONNETS = [0xe5452c, 0x2f7de0, 0xf2b21c, 0x3aa46a, 0xf07aa8, 0xffffff].map((c) => std(c, 0.85, 0));
const SKI_M = [std(0xe5452c, 0.3, 0.2), std(0x24b6c8, 0.3, 0.2), std(0xf2b21c, 0.3, 0.2), std(0x1b1d24, 0.3, 0.2)];

/* ================= the machines' cards ================= */
const DATA = {
  dameuse: { short: 'La dameuse', full: 'La dameuse', verb: 'Damer', horn: 'horn',
    use: 'Elle prépare les pistes pour les skieurs, pendant la nuit.',
    how: "Ses larges chenilles ne s'enfoncent pas dans la neige. Devant, une lame pousse la neige. Derrière, une fraise la rend toute lisse." },
  telesiege: { short: 'Le télésiège', full: 'Le télésiège', verb: 'Monter', horn: 'bell',
    use: 'Il monte les skieurs en haut de la piste, assis sur des sièges.',
    how: "Un grand câble tourne sans s'arrêter entre la gare du bas et la gare du haut. Chaque siège s'accroche au câble avec une pince." },
  telecabine: { short: 'La télécabine', full: 'La télécabine', verb: 'Monter', horn: 'bell',
    use: 'Des petites cabines fermées qui montent tout en haut de la montagne.',
    how: 'Les cabines sont accrochées à un câble, porté par de grands pylônes. Dedans, on est à l’abri, même quand il neige !' },
  canon: { short: 'Le canon à neige', full: 'Le canon à neige', verb: 'Enneiger', horn: 'horn',
    use: "Il fabrique de la neige quand il n'en tombe pas assez du ciel.",
    how: "Il souffle de l'eau en toutes petites gouttes. Dans l'air glacé, elles gèlent et deviennent de la neige !" },
  chasseneige: { short: 'Le chasse-neige', full: 'Le camion chasse-neige', verb: 'Déneiger', horn: 'horn',
    use: 'Il enlève la neige de la route, pour que les voitures puissent rouler.',
    how: 'Sa grande lame pousse la neige sur le côté. Derrière, il jette du sel pour que la route ne glisse pas.' },
  fraise: { short: 'La fraise à neige', full: 'La fraise à neige', verb: 'Souffler', horn: 'horn',
    use: 'Elle avale la neige et la souffle très loin.',
    how: 'Devant, de grosses vis tournent et attrapent la neige. Un ventilateur la souffle par une grande cheminée.' },
  motoneige: { short: 'La motoneige', full: 'La motoneige', verb: 'Livrer', horn: 'horn',
    use: 'Une moto des neiges, pour aller là où les voitures ne passent pas.',
    how: 'Elle a deux skis devant pour tourner, et une chenille derrière pour avancer dans la neige.' },
  helico: { short: "L'hélicoptère", full: "L'hélicoptère de secours", verb: 'Secourir', horn: 'bell',
    use: 'Il vient vite aider les skieurs qui se sont fait mal.',
    how: "Il peut se poser presque partout dans la montagne. Dedans, il y a un médecin et tout ce qu'il faut pour soigner." }
};
const ORDER = ['dameuse', 'telesiege', 'telecabine', 'canon', 'chasseneige', 'fraise', 'motoneige', 'helico'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const SNW = '<path d="M0 72q30-6 60 0t60 0V80H0z" fill="#e8eefb"/>';
const ICONS = {
  dameuse: SNW + `<rect x="24" y="50" width="70" height="22" rx="11" fill="#3a3c48"/><circle class="s" cx="36" cy="61" r="6"/><circle class="s" cx="52" cy="61" r="6"/><circle class="s" cx="68" cy="61" r="6"/><circle class="s" cx="84" cy="61" r="6"/>
    <path d="M28 50V38h30l4-14h22l6 26z" fill="#d62a2a"/><path class="g" d="M66 28h15l4 18H63z"/><rect x="62" y="20" width="24" height="4" rx="2" fill="#2a2e3a"/><circle cx="70" cy="18" r="2.5" fill="#ffa53a"/>
    <path d="M96 34q11 2 14 38h-9q-2-28-9-32z" fill="#d62a2a"/><rect x="6" y="54" width="18" height="12" rx="5" fill="#a31e22"/><path d="M2 70h22" stroke="#2a2e3a" stroke-width="3"/>`,
  telesiege: `<path d="M0 24L120 6" stroke="#34363e" stroke-width="2.5"/><rect x="92" y="10" width="6" height="66" fill="#9aa3b4"/><path d="M84 12h22" stroke="#9aa3b4" stroke-width="5"/>
    <path d="M48 17v26q0 6-6 6H28" fill="none" stroke="#6c7282" stroke-width="3"/><rect x="24" y="48" width="30" height="6" rx="3" fill="#2f62d8"/><rect x="22" y="32" width="6" height="20" rx="3" fill="#2f62d8"/>
    <circle cx="40" cy="36" r="5" fill="#f2c8a0"/><path d="M36 33a5 5 0 0 1 9 0z" fill="#e5452c"/><rect x="36" y="40" width="8" height="9" rx="3" fill="#2f7de0"/><path d="M44 50l12 2" stroke="#e5452c" stroke-width="3"/><path class="gnd" d="M4 75H116"/>`,
  telecabine: `<path d="M0 22L120 8" stroke="#34363e" stroke-width="2.5"/><path d="M60 15v12" stroke="#6c7282" stroke-width="3"/><rect x="38" y="26" width="44" height="42" rx="11" fill="#d62a2a"/>
    <rect class="g" x="43" y="33" width="34" height="15" rx="4"/><path d="M60 50v16" stroke="#a31e22" stroke-width="2"/><rect x="40" y="22" width="40" height="6" rx="3" fill="#b6bbc8"/>`,
  canon: SNW + `<path d="M46 72l8-26h8l8 26" fill="none" stroke="#6c7282" stroke-width="5"/><g transform="rotate(-22 58 40)"><rect x="34" y="24" width="46" height="30" rx="6" fill="#f2761c"/><ellipse cx="80" cy="39" rx="5" ry="15" fill="#c4560f"/><ellipse cx="34" cy="39" rx="4" ry="13" fill="#2a2e3a"/></g>
    <g fill="#fff" stroke="#b8c6e6"><circle cx="96" cy="18" r="4"/><circle cx="106" cy="28" r="3"/><circle cx="110" cy="12" r="3"/><circle cx="100" cy="36" r="2.5"/><circle cx="114" cy="22" r="2.5"/></g>`,
  chasseneige: GND + `<path d="M10 54l4-24h50l4 24z" fill="#f6c01c"/><path d="M68 58V24q0-4 4-4h16q5 0 6 5l3 33z" fill="#f2761c"/><rect class="g" x="80" y="25" width="13" height="12" rx="2"/>
    <circle cx="80" cy="17" r="3" fill="#ffa53a"/><path d="M100 40l16 8v26l-16-8z" fill="#f2761c"/><path d="M100 64l16 8" stroke="#2a2e3a" stroke-width="3"/><circle class="k" cx="26" cy="64" r="8"/><circle class="k" cx="84" cy="64" r="8"/>`,
  fraise: GND + `<path d="M14 58V36h26l4-14h22l2 36z" fill="#f6c01c"/><rect class="g" x="46" y="25" width="16" height="12" rx="2"/><rect x="70" y="40" width="20" height="14" rx="3" fill="#f6c01c"/>
    <circle cx="100" cy="56" r="13" fill="#cf9612"/><path d="M92 50l16 12M92 62l16-12" stroke="#2a2e3a" stroke-width="2.5"/><path d="M90 44V22q0-6 8-6h6" fill="none" stroke="#cf9612" stroke-width="7" stroke-linecap="round"/>
    <g fill="#fff" stroke="#b8c6e6"><circle cx="110" cy="12" r="4"/><circle cx="116" cy="22" r="3"/><circle cx="104" cy="6" r="3"/></g><circle class="k" cx="28" cy="64" r="9"/><circle class="k" cx="62" cy="64" r="9"/>`,
  motoneige: SNW + `<rect x="20" y="52" width="46" height="14" rx="7" fill="#2a2e3a"/><path d="M18 52h56l16-10h12l-4 12-20 4H18z" fill="#2f62d8"/><path d="M74 42l6-14" stroke="#9fd2ef" stroke-width="4"/><path d="M60 68h44q8 0 10-6" fill="none" stroke="#2a2e3a" stroke-width="4" stroke-linecap="round"/>
    <circle cx="52" cy="24" r="6" fill="#d62a2a"/><rect x="46" y="30" width="12" height="16" rx="4" fill="#d62a2a"/><path d="M52 34v6M49 37h6" stroke="#fff" stroke-width="2"/>`,
  helico: GND + `<path d="M10 20h100" stroke="#2a2e3a" stroke-width="4" stroke-linecap="round"/><rect x="57" y="20" width="6" height="8" fill="#2a2e3a"/><path d="M36 44q0-16 24-16h18q20 0 24 16-4 12-24 12H54q-18 0-18-12z" fill="#f6c01c"/>
    <path d="M38 48q4 8 18 8h22q18 0 22-10" fill="#d62a2a"/><path class="g" d="M84 32q14 2 16 12H84z"/><path d="M38 42L10 38v-6h6l22 6z" fill="#f6c01c"/><circle cx="10" cy="34" r="6" fill="#d62a2a"/>
    <path class="ln" d="M40 66h56M50 56v10M84 56v10M96 66q6 0 8-4"/><path d="M60 36v8M56 40h8" stroke="#fff" stroke-width="3"/>`
};

const CFG = {
  dameuse: CF(-4, -12, UP), telesiege: CF(18, -3, UP), telecabine: CF(-32, -3, UP), canon: CF(-16, -21),
  chasseneige: CF(-33, 38), fraise: CF(9, 33), motoneige: CF(-21, 7, UP), helico: CF(38, 6)
};

/* ================= painted ground ================= */
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes, rot = -Math.PI / 4) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 3, col = '#8a8678', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
road([[-58, 22], [58, 22]], 6, '#a4aec6', 0.9); road([[-58, 22], [58, 22]], 4.6, '#7a8096', 0.95); // main street with snowy verges
road([[-60, 38], [4, 38]], 5.6, '#a4aec6', 0.9); road([[-60, 38], [4, 38]], 4.4, '#6c7286', 0.95); // the road down to the valley
road([[-46, 19.3], [32, 19.3]], 1.5, '#848ea8', 0.9); // sidewalk
rect(21, 33, 32, 13, '#848aa0', 0.95); for (let h = 6.5; h <= 35; h += 2.6) { rect(h, 28.6, 0.14, 2.8, '#eef2fa'); rect(h, 37.4, 0.14, 2.8, '#eef2fa'); }
rect(PH, -3.5, 11, 21, '#a2acc4', 1, 'rgba(150,165,205,.35)', Math.PI / 4); // groomed snow at the foot of the run
road([[2, 12], [4, 2], [12, -2], [18, 2]], 2.2, '#a0aac2', 0.8); road([[-6, 12], [-14, 4], [-26, 2], [-30, 4]], 2.2, '#a0aac2', 0.8); road([[-21, 12], [-21, 2]], 2, '#a0aac2', 0.7);
blob(38, 6, 7, 'rgba(120,130,160,.45)'); blob(3, 13, 6, 'rgba(255,255,255,.5)');

export default {
  id: 'montagne', title: 'La Montagne', titleHtml: 'La <span>Montagne</span>',
  subtitle: 'Une station de ski en hiver : la dameuse, les remontées, le canon à neige, la motoneige et l’hélicoptère de secours.',
  welcome: 'Bienvenue à la montagne ! Touche un engin pour voir comment il marche.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la montagne',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 27l10-15 5 7 4-5 9 13z"/><path d="M9 16.5l3-1.5 2 2 2-1"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false, forest: false, outerColor: 0xaebcdc, sky: 0x13203c,
  lights: { hemi: [0xb0c4ff, 0x4a4878, 0.92], sun: [0xfff0dc, 1.05] },
  overview: { w: 92, h: 72, focus: [-6, 6, -6] },
  ground: { base: ['#9aa4bc', '#8f9ab4', '#7a85a4'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 260); onUpdate((dt) => fx.update(dt));
    const CHIM = [];
    { const m = buildMountain(grp(scene)); shadows(m); m.children.forEach((o) => { if (o.userData.terrain) o.castShadow = false; }); freeze(m); }
    { const v = buildVillage(grp(scene), CHIM); shadows(v); freeze(v); }
    buildTrees(scene);
    const LIT = scene.children.filter((o) => o.isLight).map((l) => [l, l.intensity]);
    const night = (k) => LIT.forEach(([l, i0]) => (l.intensity = i0 * (1 - 0.66 * k)));
    // a moving thing's travel since last frame, along its own heading (for wheels and tracks driven along curves)
    const travel = (obj) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; prev.copy(obj.position); return dx * Math.cos(ry) - dz * Math.sin(ry); }; };
    const along = (obj, r, s0, s1, d, ease = easeSine) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k), ease);
    const walkTo = (S, p, x, z, dur, lift = 0, fy = null) => {
      const x0 = p.position.x, z0 = p.position.z; p.rotation.y = Math.atan2(-(z - z0), x - x0);
      return tw(dur, (k) => { p.position.x = x0 + (x - x0) * k; p.position.z = z0 + (z - z0) * k; p.position.y = fy != null ? fy : gy(S, p.position.x, p.position.z) + lift; if (p.userData.walk) p.userData.walk(k * dur * 7); }, lin).then(() => p.userData.walk && p.userData.walk(0));
    };
    const puff = (p, n = 2, col = 0xf4f7ff, s = 0.4) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.4, 0.4), 0.1, rnd(-0.4, 0.4))), new V3(rnd(-0.6, 0.6), rnd(0.3, 0.9), rnd(-0.6, 0.6)), s, col, 1.1); };

    /* ---- la dameuse : la nuit, elle lisse la piste ---- */
    (function () {
      const st = makeStation('dameuse'), S = st.g;
      const D = groomer(st, S); const m = D.g; st.m = m; st.tracks = D.tracks; st.wheels = D.wheels; st.lastX = 0;
      operator(D.cab, -0.1, 0.45, 0.3, PM.redD);
      // two bumps of loose snow on the run, and the fresh corduroy left behind the tiller
      const mounds = [[8.5, 0.5, 1.4], [13, -0.8, 1.2]].map(([x, z, r]) => { const b = add(S, HEMI, PM.snow, x, gy(S, x, z) - 0.08, z); b.scale.set(r, 0.65, r * 0.9); b.userData.x = x; return b; });
      const X0 = -3.9, X1 = 15.2, cord = trailStrip(S, X0, X1, 4.2); const NSEG = cord.userData.n;
      const showTo = (x) => cord.geometry.setDrawRange(0, 12 * clamp(Math.round(((x - X0) / (X1 - X0)) * NSEG), 0, NSEG));
      showTo(X0);
      part(st, 'chenilles', 'les larges chenilles', anchor(m, 0.9, 0.6, 1.9), true);
      part(st, 'lame', 'la lame', anchor(D.blade, 0.3, 0.9, 1.6), true);
      part(st, 'fraise', 'la fraise', anchor(D.tiller, -2.2, 0.2, -1.6), true);
      part(st, 'phares', 'les phares', anchor(D.cab, 1.0, 1.95, 0), false);
      part(st, 'piste', 'la piste toute lisse', anchor(S, 6, gy(S, 6, 0) + 0.6, 2.2), false);
      const cam = anchor(m, 1.5, 1.5, 0); st.focusAt = cam; st.size = { w: 17, h: 10 }; st.az = YAW + 0.25; st.el = 0.8; st.tagAt = anchor(m, 0, 4.2, 0);
      // night falls only while the story plays: back to daylight at the end, on replay, and if the story stops for any reason
      let nightK = 0; const setNight = (k) => { nightK = k; night(k); D.lights(k); };
      st.update = (dt) => {
        if (!st.playing && nightK > 0) setNight(0);
        roll(st, dt); settle(S, m, 2.2, 2.2); D.update(dt, st.moving);
        const bx = m.position.x + 3.6;
        mounds.forEach((b) => { if (bx > b.userData.x - 1.2 && b.scale.y > 0.06) { b.scale.y = Math.max(0.05, b.scale.y - dt * 0.9); D.roll.scale.setScalar(Math.min(1, D.roll.scale.x + dt * 0.35)); } });
        if (st.till) showTo(m.position.x - 3.6);
        if (st.moving && Math.random() < 0.5) puff(m.localToWorld(new V3(-4.6, 0.3, rnd(-2, 2))), 1, 0xf4f7ff, 0.35);
      };
      st.action = async function () {
        st.playing = true;
        try { await story(); } finally { st.playing = false; setNight(0); st.moving = st.till = false; }
      };
      async function story() {
        setNight(0);
        if (st.done) {
          engineOn(55); st.moving = true;
          await Promise.all([step('La dameuse redescend en bas de la piste.', 'chenilles'), to(m.position, 'x', 0, 4, easeSine)]);
          st.moving = false; showTo(X0); mounds.forEach((b) => (b.scale.y = 0.65)); D.roll.scale.setScalar(0.2); st.done = false;
        }
        await Promise.all([step('Le soir, les skieurs sont rentrés. La dameuse allume ses phares.', 'phares'), tw(2.2, (k) => setNight(k))]);
        engineOn(55);
        await Promise.all([step("Elle monte la piste avec ses larges chenilles : elles ne s'enfoncent pas dans la neige.", 'chenilles'),
          to(D.blade.rotation, 'z', 0, 1.5), to(D.tiller.rotation, 'z', 0, 1.5), (st.till = st.moving = true), to(m.position, 'x', 5, 4.5, easeSine)]);
        await Promise.all([step('Devant, sa grande lame pousse la neige et efface les bosses.', 'lame'), to(m.position, 'x', 11, 5.5, lin)]);
        await Promise.all([step('Derrière, la fraise écrase la neige et dessine des petites lignes, comme du velours.', 'fraise'), to(m.position, 'x', 18.5, 6.5, easeSine)]);
        st.moving = false; engineOff();
        await Promise.all([step('Demain matin, la piste sera toute lisse pour les skieurs !', 'piste'), to(D.blade.rotation, 'z', 0.22, 1.2), to(D.tiller.rotation, 'z', -0.25, 1.2), tw(2.4, (k) => setNight(1 - k))]);
        st.till = false; D.roll.scale.setScalar(0.2); chime(); st.done = true;
      }
    })();

    /* ---- le télésiège ---- */
    (function () {
      const st = makeStation('telesiege'), S = st.g, G = 2.6, L = 30, YB = 3.4, V = 1.7;
      const tpl = chairTpl();
      const RW = ropeway(S, { L, gap: G, towers: [7.5, 15, 22.5], ht: 6.6, yb: YB, n: 13, kind: 'chair', make: () => tpl.clone() });
      const sLoad = RW.sUp(1.0), sOff = RW.sUp(L - 1.3), yTop = gy(S, L, 0) + 0.3;
      const riders = [skier(S, 0, 0, { top: 0x2f7de0, bottom: 0x24305a }), skier(S, 0, 0, { top: 0xf07aa8, bottom: 0x3a3a48, kid: true })];
      const home = [[0.4, G + 3.6], [1.4, G + 4.2]];
      const reset = () => riders.forEach((r, i) => { S.add(r); r.userData.sit(false); r.position.set(home[i][0], 0.3, home[i][1]); r.rotation.set(0, Math.PI / 2, 0); r.scale.setScalar(i ? 0.72 : 1); r.visible = true; });
      reset();
      // the way down: from the top of the lift to the run, then back to the bottom station
      const run = route([[L - 1.2, G, yTop], [L - 2.6, G + 2.4, yTop], ...[[L - 6, G + 1.6], [L - 8, 0], [L - 8.5, -G - 2.4], ...LANES[0][0].slice(2).map(([h, d]) => hdL(S, h, d)), [-7, -4.5], [-7.5, 4.5], [-2, 7.4], [1.0, G + 4.0]].map(([x, z]) => [x, z, gy(S, x, z) + 0.05])], false, 0.35);
      const grip = anchor(S, 1, YB, G), cam = anchor(S, 14, gy(S, 14, 0) + 3.5, 0), skiA = anchor(S, 0, 0, 0);
      part(st, 'gare', 'la gare du bas', anchor(S, -1.5, YB + 2.6, 0), true);
      part(st, 'cable', 'le câble', anchor(S, 11, gy(S, 11, 0) + 6.4, -G), true);
      part(st, 'pylone', 'les pylônes', anchor(S, 15, gy(S, 15, 0) + 4.5, 0), true);
      part(st, 'siege', 'le siège', grip, false);
      part(st, 'pince', 'la pince', grip, false);
      part(st, 'skieurs', 'les skieurs', skiA, false);
      st.focusAt = cam; st.size = { w: 22, h: 14 }; st.tagAt = anchor(S, 6, YB + 4.6, 0);
      st.run = true;
      st.update = (dt) => {
        if (st.run) RW.off += dt * V;
        if (st.cur) { grip.position.copy(st.cur.position); grip.position.y -= 0.1; cam.position.copy(st.cur.position); cam.position.y -= 1.5; }
        skiA.position.copy(riders[0].position); skiA.position.y += 1.7; if (st.ski) { cam.position.copy(riders[0].position); cam.position.y += 1; }
      };
      st.action = async function () {
        if (st.done) { reset(); pop(riders[0], 0.4); pop(riders[1], 0.4); riders[1].scale.setScalar(0.72); st.done = false; await sleep(0.5); }
        st.run = true;
        await Promise.all([step('Les skieurs arrivent au télésiège. Le câble tourne sans jamais s’arrêter.', 'gare'),
          walkTo(S, riders[0], 1.45, G + 0.45, 2.6, 0.3), walkTo(S, riders[1], 1.45, G - 0.45, 2.6, 0.3)]);
        riders.forEach((r) => (r.rotation.y = 0));
        st.run = false;
        let best = 0, bd = 1e9;
        RW.carriers.forEach((c, i) => { let d = (((sLoad - RW.sOf(i)) % RW.total) + RW.total) % RW.total; if (d < 1.5) d += RW.total; if (d < bd) { bd = d; best = i; } });
        const chair = RW.carriers[best], o0 = RW.off; st.cur = chair;
        await Promise.all([step('Un siège arrive derrière eux... Hop, ils s’assoient !', 'siege'), tw(bd / V, (k) => (RW.off = o0 + bd * k), lin)]);
        riders.forEach((r, i) => { chair.add(r); r.position.set(-0.2, i ? -2.91 : -3.05, i ? -0.45 : 0.42); r.rotation.set(0, 0, 0); r.userData.sit(true); }); thud();
        const o1 = RW.off, ride = sOff - sLoad;
        await Promise.all([step('La pince serre le gros câble, et le siège monte tout là-haut.', 'pince'), tw((ride * 0.5) / 2.2, (k) => (RW.off = o1 + ride * 0.5 * k), lin)]);
        await Promise.all([step('Le câble roule sur les petites roues des pylônes.', 'pylone'), tw((ride * 0.5) / 2.2, (k) => (RW.off = o1 + ride * (0.5 + 0.5 * k)), lin)]);
        riders.forEach((r) => { S.attach(r); r.userData.sit(false); r.rotation.set(0, 0, 0); r.position.y = yTop; }); st.cur = null; st.run = true; ding();
        await Promise.all([step('En haut, les skieurs descendent du siège...', 'skieurs'), sleep(1.2)]);
        st.ski = true;
        await Promise.all([step('...et ils redescendent la piste à ski. Youpi !', 'skieurs'),
          tw(16, (k) => riders.forEach((r, i) => { placeOn(r, run, Math.max(0, run.len * k - i * 1.6)); r.rotation.z = -0.12; }), lin)]);
        riders.forEach((r) => (r.rotation.z = 0)); st.ski = false; cam.position.set(14, gy(S, 14, 0) + 3.5, 0);
        chime(); st.done = true;
      };
    })();

    /* ---- la télécabine ---- */
    (function () {
      const st = makeStation('telecabine'), S = st.g, G = 3.0, L = 44, YB = 4.0, V = 2.0;
      const tpls = [PM.red, PM.white, PM.blue].map((c) => cabinTpl(c));
      const RW = ropeway(S, { L, gap: G, towers: [10, 20, 29, 37.5], ht: 8.2, yb: YB, n: 12, kind: 'gondola', make: (i) => tpls[i % 3].clone() });
      const sLoad = RW.sUp(0.6), sOff = RW.sUp(L - 0.8), yTop = gy(S, L, 0) + 0.3;
      const folks = [0, 1, 2].map((i) => { const p = walker(S, 0, 0, { hat: pick(BONNETS), kid: i === 2 }); return p; });
      const home = [[-1.8, G + 1.5], [-0.8, G + 1.8], [0.2, G + 1.5]];
      const reset = () => folks.forEach((p, i) => { S.add(p); p.position.set(home[i][0], 0.3, home[i][1]); p.rotation.set(0, -Math.PI / 2, 0); p.visible = true; });
      reset();
      const grip = anchor(S, 0.6, YB - 2, G), cam = anchor(S, 20, gy(S, 20, 0) + 4, 0), view = anchor(S, L - 3, yTop + 1.8, G + 1.6);
      part(st, 'gare', 'la gare', anchor(S, -2, YB + 2.8, 0), true);
      part(st, 'cabine', 'la cabine', grip, false);
      part(st, 'pylones', 'les grands pylônes', anchor(S, 20, gy(S, 20, 0) + 5.5, 0), true);
      part(st, 'sommet', 'tout en haut', view, false);
      part(st, 'cabines', 'les cabines', anchor(S, 29, gy(S, 29, 0) + 5, G), true);
      st.focusAt = cam; st.size = { w: 24, h: 16 }; st.el = 0.5; st.tagAt = anchor(S, 8, YB + 6, 0);
      st.run = true;
      st.update = (dt) => {
        if (st.run) RW.off += dt * V;
        if (st.cur) { grip.position.copy(st.cur.position); grip.position.y -= 2.2; cam.position.copy(st.cur.position); cam.position.y -= 2.5; }
      };
      st.action = async function () {
        if (st.done) { reset(); folks.forEach((p) => pop(p, 0.4)); folks[2].scale.setScalar(0.72); st.done = false; await sleep(0.5); }
        st.run = true;
        await Promise.all([step('Des promeneurs attendent dans la gare.', 'gare'), sleep(1.4)]);
        st.run = false;
        let best = 0, bd = 1e9;
        RW.carriers.forEach((c, i) => { let d = (((sLoad - RW.sOf(i)) % RW.total) + RW.total) % RW.total; if (d < 1.5) d += RW.total; if (d < bd) { bd = d; best = i; } });
        const cab = RW.carriers[best], o0 = RW.off; st.cur = cab;
        await Promise.all([step('Une cabine arrive tout doucement. Les portes s’ouvrent...', 'cabine'), tw(bd / V, (k) => (RW.off = o0 + bd * k), lin)]);
        await step('...et tout le monde monte dedans !', 'cabine');
        for (const [i, p] of folks.entries()) { await walkTo(S, p, 0.6 + (i - 1) * 0.35, G + 0.2, 0.9, 0.3); cab.add(p); p.position.set((i - 1) * 0.45, -3.52, i === 1 ? -0.3 : 0.25); p.rotation.set(0, i === 1 ? Math.PI : 0, 0); }
        ding();
        const o1 = RW.off, ride = sOff - sLoad;
        await Promise.all([step('La cabine s’accroche au câble, et elle s’envole au-dessus des sapins !', 'cabine'), tw((ride * 0.45) / 2.6, (k) => (RW.off = o1 + ride * 0.45 * k), lin)]);
        await Promise.all([step('Les grands pylônes portent le câble jusqu’en haut de la montagne.', 'pylones'), tw((ride * 0.55) / 2.6, (k) => (RW.off = o1 + ride * (0.45 + 0.55 * k)), lin)]);
        ding();
        for (const [i, p] of folks.entries()) { S.attach(p); p.rotation.set(0, 0, 0); p.position.y = yTop; walkTo(S, p, L - 2.2 - i * 0.45, G + 1.5 + (i % 2) * 0.5, 1.8, 0, yTop); }
        st.cur = null; st.run = true;
        await Promise.all([step('Tout en haut, quelle belle vue sur la montagne !', 'sommet'), sleep(2.6)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le canon à neige ---- */
    (function () {
      const st = makeStation('canon'), S = st.g; S.position.y = Hw(S.position.x, S.position.z);
      const B = grp(S); B.rotation.z = Math.atan((gy(S, 1, 0) - gy(S, -1, 0)) / 2); B.rotation.x = -Math.atan((gy(S, 0, 1) - gy(S, 0, -1)) / 2);
      const C = snowGun(B); st.m = C.g;
      // the hydrant it is plugged into, uphill
      const hyd = grp(S, -1.6, gy(S, -1.6, -2.2), -2.2); rbox(hyd, 0.9, 0.7, 0.7, 0.1, PM.greyD, 0, 0.3, 0, 0.03); rbox(hyd, 0.96, 0.08, 0.76, 0.03, PM.dark, 0, 0.66, 0, 0.01); add(hyd, HEMI, PM.snow, 0, 0.66, 0).scale.set(0.42, 0.12, 0.34);
      cylY(hyd, 0.06, 1.6, PM.yel, 0.35, 0.8, 0.25, 8); sph(hyd, 0.08, PM.red, 0.35, 1.62, 0.25); // a marker pole so the groomer sees it
      const hoseA = new V3(-1.2, gy(S, -1.2, -2.0) + 0.25, -2.0), hoseB = new V3(-0.3, gy(S, -0.3, -0.4) + 0.25, -0.4);
      [[0, PM.dark], [0.25, PM.yel]].forEach(([o, m]) => S.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(hoseA.clone().setX(hoseA.x + o), new V3(-0.9 + o, hoseA.y - 0.15, -1.1), hoseB.clone().setX(hoseB.x + o)), 12, o ? 0.04 : 0.07, 6), m)));
      const PX = 5.4, PZ = 0.3, pile = add(S, HEMI, PM.snow, PX, gy(S, PX, PZ) - 0.12, PZ); pile.scale.set(0.05, 0.05, 0.05);
      part(st, 'tuyau', 'le tuyau d’eau', anchor(S, -0.9, hoseA.y + 0.4, -1.1), false);
      part(st, 'ventilateur', 'le gros ventilateur', anchor(C.barrel, -0.8, 0.9, 0), true);
      part(st, 'tete', 'la tête qui tourne', anchor(C.barrel, 0.9, 0.9, 0), false);
      part(st, 'tas', 'la neige toute neuve', anchor(S, PX, gy(S, PX, PZ) + 1.4, PZ), false);
      part(st, 'roues', 'les roues', anchor(C.g, 0, 0.5, 1.1), true);
      st.focus = new V3(2.4, 1.2, 0); st.size = { w: 14, h: 8 }; st.el = 0.42; st.tagAt = anchor(C.g, 0, 3.6, 0);
      let rpm = 0, spray = 0;
      st.update = (dt) => {
        rpm += ((st.blow ? 28 : 0) - rpm) * Math.min(1, dt * 1.5); C.fan.rotation.x += rpm * dt;
        if (st.blow) {
          spray -= dt; if (spray <= 0) {
            spray = 0.05; const a = wp(C.nozzle), dir = a.clone().sub(wp(C.barrel)).normalize();
            fx.smoke(a.clone().add(new V3(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3))), dir.multiplyScalar(rnd(4, 7)).add(new V3(0, 0.6, 0)), rnd(0.25, 0.45), 0xf6f9ff, 1.5);
            throwClod(a, wp(pile).add(new V3(rnd(-1.4, 1.4), 0.4, rnd(-1.4, 1.4))), rnd(0.09, 0.16), 0xf4f8ff);
          }
        }
      };
      const grow = (a, b, d) => tw(d, (k) => { const s = a + (b - a) * k; pile.scale.set(2.4 * s, 1.3 * s, 2.2 * s); }, lin);
      st.action = async function () {
        if (st.done) { await Promise.all([step('La dameuse a étalé le tas. On recommence !', 'tas'), tw(1, (k) => pile.scale.multiplyScalar(0.9))]); pile.scale.setScalar(0.05); st.done = false; }
        await Promise.all([step("Il fait très froid, mais il n'est pas tombé assez de neige.", 'roues'), sleep(1.2)]);
        await Promise.all([step("Le canon boit de l'eau très froide, par son gros tuyau.", 'tuyau'), to(C.barrel.rotation, 'z', 0.32, 1.6, easeSine), tone(160, 0, 1.5, 'sine', 0.03, 120)]);
        st.blow = true; engineOn(90);
        await Promise.all([step('Son ventilateur souffle très fort... et les gouttes deviennent de la neige !', 'ventilateur'), grow(0.05, 0.5, 4.5)]);
        await Promise.all([step('Il tourne la tête pour mettre de la neige partout.', 'tete'), tw(5, (k) => (C.turret.rotation.y = Math.sin(k * Math.PI * 2) * 0.45), easeSine), grow(0.5, 1, 5)]);
        st.blow = false; engineOff();
        await Promise.all([step('Voilà un gros tas de neige toute neuve. La dameuse viendra l’étaler !', 'tas'), to(C.barrel.rotation, 'z', 0.08, 1.4, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le chasse-neige ---- */
    (function () {
      const st = makeStation('chasseneige'), S = st.g;
      const P = plough(st, S); const m = P.g; st.m = m; st.wheels = P.wheels; st.lastX = 0;
      // snow on the road ahead; a bank of snow grows on the side as the blade pushes it
      const X0 = 4.2, X1 = 33;
      const layer = box(S, X1 - X0, 0.3, 4.2, PM.snow, (X0 + X1) / 2, 0.15, 0);
      const bank = grp(S, X0, 0, -2.75); const bankM = rbox(bank, 1, 0.7, 1.1, 0.3, PM.snow, 0.5, 0.25, 0, 0.1); bank.scale.x = 0.01;
      const salt = grp(S); const saltM = box(salt, 1, 0.012, 3.8, std(0x5a6074, 0.25, 0.2), 0.5, 0.01, 0); salt.position.x = X0; salt.scale.x = 0.01;
      const car = miniCar(S, 'car', 0x2f7de0); add(car, HEMI, PM.snow, -0.12, 1.2, 0).scale.set(0.6, 0.14, 0.5); car.position.x = -12; car.visible = false;
      const clear = (bx) => { const a = clamp(bx, X0, X1); layer.scale.x = Math.max(0.01, X1 - a); layer.position.x = (a + X1) / 2; bank.scale.x = Math.max(0.01, a - X0); };
      part(st, 'lame', 'la lame', anchor(P.blade, 0.4, 0.9, 1.8), true);
      part(st, 'sel', 'le sel', anchor(m, -3.3, 1.2, 1.2), true);
      part(st, 'route', 'la route', anchor(S, 20, 0.6, 2.0), false);
      part(st, 'neige', 'la neige poussée', anchor(bank, 0.5, 1.2, -0.4), false);
      const cam = anchor(m, 1, 1.5, 0); st.focusAt = cam; st.size = { w: 17, h: 9 }; st.el = 0.85; st.tagAt = anchor(m, 0, 4.0, 0);
      let sT = 0;
      st.update = (dt) => {
        roll(st, dt); P.spinner.rotation.y += dt * (st.salting ? 18 : 0);
        if (st.pushing) { const bx = m.position.x + 4.3; clear(bx); if (Math.random() < 0.5) throwClod(m.localToWorld(new V3(3.2, 0.6, -1.9)), S.localToWorld(new V3(bx - 1, 0.6, -3.4)), rnd(0.12, 0.22), 0xf4f8ff); }
        if (st.salting) { salt.scale.x = Math.max(0.01, m.position.x - 3.2 - X0); sT -= dt; if (sT < 0) { sT = 0.04; throwClod(wp(P.spinner), S.localToWorld(new V3(m.position.x - rnd(3.6, 5.5), 0, rnd(-1.8, 1.8))), 0.04, 0xe8ecf6); } }
      };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('Il neige encore ! La route est de nouveau blanche.', 'route'), sleep(1)]);
          m.position.x = 0; st.lastX = 0; clear(X0); salt.scale.x = 0.01; car.visible = false; pop(m, 0.5); st.done = false; await sleep(0.5);
        }
        await Promise.all([step('Cette nuit, il a beaucoup neigé sur la route.', 'route'), sleep(1.4)]);
        engineOn(55);
        await Promise.all([step('Le chasse-neige arrive, et il baisse sa grande lame.', 'lame'), to(P.blade.rotation, 'z', 0, 1.4), to(m.position, 'x', 0.5, 1.4)]);
        st.pushing = true;
        await Promise.all([step('Il pousse la neige sur le côté de la route. Pfff, que c’est lourd !', 'neige'), to(m.position, 'x', 13, 6.5, easeIn)]);
        st.salting = true;
        await Promise.all([step('Derrière, il jette du sel. Le sel empêche la route de glisser.', 'sel'), to(m.position, 'x', 26, 6.5, lin)]);
        await to(m.position, 'x', 30.5, 2.5, easeSine); st.pushing = false; st.salting = false;
        await to(P.blade.rotation, 'z', 0.18, 0.8); engineOff();
        car.visible = true; car.position.set(-12, 0, 1.1); const spinC = travel(car);
        await Promise.all([step('La route est propre. Les voitures peuvent rouler sans glisser !', 'route'),
          tw(5, (k) => { car.position.x = -12 + 34 * k; const d = spinC(); car.userData.wheels.forEach((w) => (w.rotation.z -= d / 0.24)); }, lin)]);
        car.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- la fraise à neige ---- */
    (function () {
      const st = makeStation('fraise'), S = st.g;
      const F = blower(st, S); const m = F.g; st.m = m; st.wheels = F.wheels; st.lastX = 0;
      const X0 = 4.6, X1 = 25;
      const layer = box(S, X1 - X0, 0.45, 3.8, PM.snow, (X0 + X1) / 2, 0.22, 0);
      const heaps = [7, 12, 17, 22].map((x) => { const h = add(S, HEMI, PM.snow, x, -0.05, 7.6); h.scale.set(0.01, 0.01, 0.01); h.userData.x = x; return h; });
      part(st, 'vis', 'les grosses vis', anchor(F.blow, 0.5, 0.6, 1.4), true);
      part(st, 'cheminee', 'la cheminée', anchor(F.chute, 0, 1.9, 0.3), true);
      part(st, 'parking', 'le parking', anchor(S, 18, 0.8, -2.2), false);
      part(st, 'neige', 'la neige soufflée', anchor(S, 12, 2.2, 7.6), false);
      st.focus = new V3(11, 2, 3.5); st.size = { w: 22, h: 12 }; st.tagAt = anchor(m, 0, 4.4, 0);
      let sT = 0;
      st.update = (dt) => {
        roll(st, dt); F.augers.forEach((a, i) => (a.rotation.z += dt * (st.eat ? 9 : 0) * (i ? -1 : 1)));
        if (st.eat) {
          const bx = clamp(m.position.x + 4.9, X0, X1); layer.scale.x = Math.max(0.01, X1 - bx); layer.position.x = (bx + X1) / 2;
          sT -= dt; if (sT < 0) {
            sT = 0.035; const tip = wp(F.tip), yaw = F.chute.rotation.y, tx = m.position.x + 4 + Math.sin(yaw) * 6, tz = 7.6 + rnd(-1, 1);
            throwClod(tip, S.localToWorld(new V3(tx + rnd(-1.5, 1.5), 0.4, tz)), rnd(0.1, 0.2), 0xf4f8ff);
            if (Math.random() < 0.5) fx.smoke(tip, new V3(Math.sin(yaw) * 2.5, 2.2, 3.5).applyAxisAngle(new V3(0, 1, 0), S.rotation.y), 0.35, 0xf6f9ff, 1.2);
            heaps.forEach((h) => { if (Math.abs(h.userData.x - tx) < 2.6 && h.scale.y < 1.5) { h.scale.x = Math.min(2.6, h.scale.x + 0.06); h.scale.z = Math.min(2.0, h.scale.z + 0.05); h.scale.y = Math.min(1.5, h.scale.y + 0.04); } });
          }
        }
      };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('Il a encore neigé sur le parking !', 'parking'), sleep(0.6)]);
          m.position.x = 0; st.lastX = 0; layer.scale.x = 1; layer.position.x = (X0 + X1) / 2; heaps.forEach((h) => h.scale.setScalar(0.01)); F.chute.rotation.y = 0; pop(m, 0.5); st.done = false; await sleep(0.5);
        }
        await Promise.all([step('Il a tellement neigé que le parking est tout blanc.', 'parking'), sleep(1.2)]);
        engineOn(60); st.eat = true;
        await Promise.all([step('La fraise avance. Ses grosses vis tournent et avalent la neige.', 'vis'), to(m.position, 'x', 6, 5, easeSine)]);
        await Promise.all([step('Puis elle la souffle très loin, par sa cheminée. Pfffouuu !', 'neige'), to(m.position, 'x', 12, 5.5, lin)]);
        await Promise.all([step('On peut tourner la cheminée pour choisir où va la neige.', 'cheminee'), to(m.position, 'x', 20.5, 6, easeSine), tw(6, (k) => (F.chute.rotation.y = Math.sin(k * Math.PI * 2) * 0.5), lin)]);
        st.eat = false; engineOff();
        await Promise.all([step('Le parking est tout propre. Les voitures peuvent se garer !', 'parking'), sleep(1.2)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la motoneige ---- */
    (function () {
      const st = makeStation('motoneige'), S = st.g;
      const M = snowmobile(S); const m = M.g; st.m = m;
      const R = route([[0, 0], [5, 0.8], [10, -0.6], [15, 0.9], [20, -0.5], [25, 0.6], [29, -0.3], [32.2, -1.4]].map(([x, z]) => [x, z, 0]), false, 0.4);
      const sled = cargoSled(S); const cargo = sled.userData.cargo;
      const BACK = 3.1;
      const put = (s) => { placeOn(m, R, Math.max(BACK, s)); settle(S, m, 1.3, 1.3); placeOn(sled, R, Math.max(0, s - BACK)); settle(S, sled, 0.9, 0.9); };
      put(BACK);
      const hitchA = anchor(m, -1.55, 0.35, 0), hitchB = anchor(sled, 1.0, 0.3, 0); const bar = strut(S, hitchA, hitchB, 0.05, PM.dark);
      const [rx, rz] = hdL(S, -24.2, -28.2); const door = new V3(rx, gy(S, rx, rz) + 0.3, rz);
      const spinT = travel(m);
      part(st, 'traineau', 'le traîneau', anchor(sled, 0, 1.2, 0), true);
      part(st, 'chenille', 'la chenille', anchor(m, -0.8, 0.4, 0.5), true);
      part(st, 'skis', 'les skis', anchor(m, 1.4, 0.2, 0.6), false);
      part(st, 'pisteur', 'le pisteur', anchor(m, -0.35, 1.9, 0), false);
      part(st, 'restaurant', 'le restaurant', anchor(S, rx, door.y + 4.2, rz), false);
      const cam = anchor(m, 0, 1, 0); st.focusAt = cam; st.size = { w: 13, h: 8 }; st.el = 0.75; st.tagAt = anchor(m, 0, 2.6, 0);
      let s = BACK;
      st.update = () => {
        const d = spinT(); if (d) M.track.update(d); bar.update();
        if (st.moving && Math.random() < 0.7) puff(m.localToWorld(new V3(-1.6, 0.15, rnd(-0.3, 0.3))), 1, 0xf4f7ff, 0.3);
      };
      st.action = async function () {
        if (st.done) {
          engineOn(120);
          await Promise.all([step('La motoneige redescend au village.', 'chenille'), tw(5, (k) => { s = R.len - (R.len - BACK) * k; put(s); }, easeSine)]);
          cargo.forEach((c) => { sled.add(c); c.position.copy(c.userData.home); c.visible = true; }); st.done = false;
        }
        await Promise.all([step('Le pisteur a chargé le traîneau : du pain et du fromage pour le restaurant, là-haut !', 'traineau'), sleep(1.2)]);
        engineOn(120); st.moving = true;
        await Promise.all([step('La motoneige démarre. Sa chenille, derrière, la pousse dans la neige.', 'chenille'), tw(5, (k) => { s = BACK + (R.len * 0.38 - BACK) * k; put(s); }, easeIn)]);
        await Promise.all([step('Devant, ses deux skis glissent et la font tourner.', 'skis'), tw(5, (k) => { s = R.len * (0.38 + 0.34 * k); put(s); }, lin)]);
        await Promise.all([step('Elle grimpe là où une voiture resterait coincée !', 'pisteur'), tw(4.5, (k) => { s = R.len * (0.72 + 0.28 * k); put(s); }, easeSine)]);
        st.moving = false; engineOff();
        await step('Voilà le restaurant d’altitude. On livre le pain et le fromage. Bon appétit !', 'restaurant');
        for (const c of cargo) { S.attach(c); const p0 = c.position.clone(); await tw(0.7, (k) => c.position.set(p0.x + (door.x - p0.x) * k, p0.y + (door.y - p0.y) * k + Math.sin(k * Math.PI) * 0.8, p0.z + (door.z - p0.z) * k), easeSine); c.visible = false; ding(); }
        chime(); st.done = true;
      };
    })();

    /* ---- l'hélicoptère de secours ---- */
    (function () {
      const st = makeStation('helico'), S = st.g;
      // the pad
      const pad = add(S, new THREE.CylinderGeometry(5, 5.2, 0.16, 36), PM.conc, 0, 0.08, 0);
      const ring = add(S, new THREE.RingGeometry(4.2, 4.5, 36), std(0xf2b21c, 0.6, 0), 0, 0.17, 0); ring.rotation.x = -Math.PI / 2;
      const hb = grp(S, 0, 0.17, 0); [[-1.1, 0, 0.45, 3.2], [1.1, 0, 0.45, 3.2], [0, 0, 1.8, 0.45]].forEach(([x, z, w, d]) => box(hb, w, 0.02, d, PM.white, x, 0, z)); void pad;
      const Hc = rescueHeli(S); st.m = Hc; const U = Hc.userData; const PADY = 0.12; Hc.position.y = PADY;
      // the skier with a little bobo, the patroller who called for help, and the doctor
      const [tx, tz] = hdL(S, 29, -13), ty = gy(S, tx, tz);
      const pat = skier(S, tx, tz, { top: 0x24b6c8, bottom: 0x2a3550 }); pat.userData.skis.forEach((k) => (k.visible = false));
      const pad0 = new V3(0, 0, 0), toPad = new V3(-tx, 0, -tz).normalize(), LZ = new V3(tx, 0, tz).addScaledVector(toPad, 5.4); LZ.y = gy(S, LZ.x, LZ.z);
      const yawTo = Math.atan2(-(LZ.z - pad0.z), LZ.x - pad0.x);
      const sitPat = () => { S.add(pat); pat.userData.sit(true); pat.rotation.set(0, yawTo + Math.PI * 0.85, 0); pat.position.set(tx, ty - 0.42, tz); pat.visible = true; };
      sitPat();
      const skisX = grp(S, tx - toPad.x * 1.6, ty, tz - toPad.z * 1.6); [0.35, -0.35].forEach((a, i) => { const k = rbox(skisX, 0.1, 1.7, 0.05, 0.03, SKI_M[i], 0, 0.7, 0, 0.01); k.rotation.x = a; });
      const pis = walker(S, tx + 1.3, tz + 1.2, { top: 0xd62a2a, bottom: 0x1b1d24, hat: std(0x1b1d24, 0.8, 0) }); patrollerCross(pis); pis.position.y = gy(S, pis.position.x, pis.position.z); pis.rotation.y = yawTo + Math.PI;
      const doc = walker(S, 0, 0, { top: 0xf2f2f6, bottom: 0xd62a2a }); rbox(doc.userData.arms[1], 0.34, 0.26, 0.14, 0.04, PM.red, 0.05, -0.42, -0.06, 0.02); doc.visible = false;
      const [mx, mz] = hdL(S, 45.4, 12.4);
      part(st, 'rotor', 'le grand rotor', anchor(U.rotor, 2.6, 0.3, 0), true);
      part(st, 'patins', 'les patins', anchor(Hc, 0.4, 0.25, 1.1), true);
      part(st, 'queue', 'l’hélice dans la queue', anchor(U.fan, 0, 0, 0.3), false);
      part(st, 'skieur', 'le skieur', anchor(pat, 0, 1.4, 0), false);
      part(st, 'medecin', 'le médecin', anchor(doc, 0, 1.6, 0), false);
      part(st, 'cabinet', 'le cabinet du docteur', anchor(S, mx, 4.2, mz), false);
      const cam = anchor(Hc, 0, 1.5, 0); st.focusAt = cam; st.size = { w: 18, h: 11 }; st.tagAt = anchor(Hc, 0, 4.6, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; U.rotor.rotation.y += dt * (st.rpm || 0); U.fan.rotation.z += dt * (st.rpm || 0) * 2.2;
        if (st.wave) pis.userData.arms[0].rotation.x = -2.5 + Math.sin(T * 8) * 0.35; else pis.userData.arms[0].rotation.x = 0;
        if ((st.rpm || 0) > 14) { const ag = Hc.position.y - gy(S, Hc.position.x, Hc.position.z); if (ag < 5 && Math.random() < 0.8) { const a = rnd(0, 6.28); puff(S.localToWorld(new V3(Hc.position.x + Math.cos(a) * 3.5, gy(S, Hc.position.x, Hc.position.z) + 0.2, Hc.position.z + Math.sin(a) * 3.5)), 1, 0xf4f7ff, 0.45); } }
      };
      const fly = (a, b, y0, y1, d) => tw(d, (k) => { Hc.position.set(a.x + (b.x - a.x) * k, y0 + (y1 - y0) * k, a.z + (b.z - a.z) * k); Hc.rotation.z = -0.12 * Math.sin(k * Math.PI); }, easeSine);
      st.action = async function () {
        if (st.done) { sitPat(); pop(pat, 0.4); pis.visible = true; st.done = false; await sleep(0.5); }
        st.wave = true;
        await Promise.all([step('Oh ! Un skieur est tombé. Il a un petit bobo au genou. Le pisteur appelle les secours.', 'skieur'), sleep(1.5)]);
        engineOn(100);
        await Promise.all([step("L'hélicoptère de secours démarre. Son grand rotor tourne très vite.", 'rotor'), tw(3, (k) => (st.rpm = 24 * k), lin), tone(90, 0, 3, 'sawtooth', 0.02, 160)]);
        await to(Hc.position, 'y', 6, 2.4, easeSine);
        await to(Hc.rotation, 'y', yawTo, 1.2, easeSine);
        await Promise.all([step('Il vole très vite vers la piste...', 'queue'), fly(pad0, LZ, 6, LZ.y + 6, 5)]);
        await Promise.all([step('...et il se pose tout doucement sur la neige, à côté du skieur.', 'patins'), to(Hc.position, 'y', LZ.y, 3.2, easeSine)]);
        thud(); st.wave = false;
        await tw(1.5, (k) => (st.rpm = 24 - 12 * k), lin);
        S.updateMatrixWorld(true);
        const dp = S.worldToLocal(Hc.localToWorld(new V3(-0.1, 0, 1.9))); doc.position.set(dp.x, gy(S, dp.x, dp.z), dp.z); doc.visible = true; pop(doc, 0.4);
        await to(U.door.position, 'x', -0.55, 0.6);
        await Promise.all([step('Le médecin vient aider le skieur. Il regarde son genou...', 'medecin'), walkTo(S, doc, tx + toPad.x * 1.0, tz + toPad.z * 1.0, 2.2)]);
        pat.userData.sit(false); pat.position.y = ty; await sleep(0.6);
        await Promise.all([step('...et il l’emmène dans l’hélicoptère, bien au chaud.', 'medecin'), walkTo(S, doc, dp.x, dp.z, 3.2), walkTo(S, pat, dp.x + toPad.z * 0.6, dp.z - toPad.x * 0.6, 3.2)]);
        doc.visible = false; pat.visible = false; await to(U.door.position, 'x', 0, 0.6);
        await tw(1.2, (k) => (st.rpm = 12 + 12 * k), lin);
        await Promise.all([step('Hop ! Direction le cabinet du docteur, en bas.', 'cabinet'), to(Hc.position, 'y', LZ.y + 6, 2.2, easeSine)]);
        await to(Hc.rotation, 'y', yawTo + Math.PI, 1.2, easeSine);
        await fly(LZ, pad0, LZ.y + 6, 6, 5);
        await to(Hc.position, 'y', PADY, 3, easeSine); thud();
        await to(U.door.position, 'x', -0.55, 0.6);
        S.updateMatrixWorld(true); const dp2 = S.worldToLocal(Hc.localToWorld(new V3(-0.1, 0, 1.9)));
        [doc, pat].forEach((p, i) => { p.position.set(dp2.x + i * 0.6, 0, dp2.z); p.visible = true; });
        await Promise.all([step('Le médecin va bien soigner son genou. Il pourra vite skier à nouveau !', 'cabinet'), walkTo(S, doc, mx, mz, 3.4), walkTo(S, pat, mx + 0.6, mz, 3.6), tw(3, (k) => (st.rpm = 24 * (1 - k)), lin)]);
        doc.visible = false; pat.visible = false; st.rpm = 0; await to(U.door.position, 'x', 0, 0.6); engineOff();
        chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate, fx, CHIM);
  }
};

/* ================= people ================= */
/** A skier: helmet, goggles, skis and poles. userData.sit(on) folds the legs (skis stay flat). */
function skier(p, x, z, o = {}) {
  const g = walker(p, x, z, { hat: o.hat || pick(HELMETS), top: o.top, bottom: o.bottom, kid: o.kid });
  const legs = [g.children[0], g.children[1]], sm = o.ski || pick(SKI_M);
  rbox(g, 0.06, 0.1, 0.34, 0.03, PM.dark, 0.19, 1.16, 0, 0.01); // goggles
  const skis = legs.map((l) => { const s = grp(l, 0.04, -0.49, 0); rbox(s, 1.5, 0.04, 0.11, 0.02, sm, 0.12, 0, 0, 0.01); const t = rbox(s, 0.22, 0.04, 0.11, 0.02, sm, 0.92, 0.05, 0, 0.01); t.rotation.z = 0.45; return s; });
  g.userData.arms.forEach((a, i) => { rod(a, new V3(0.02, -0.36, 0), new V3(-0.38, -0.92, i ? -0.05 : 0.05), 0.016, PM.dark, 5); cylY(a, 0.06, 0.012, PM.dark, -0.33, -0.84, i ? -0.045 : 0.045, 8); a.rotation.z = -0.25; });
  g.userData.legs = legs; g.userData.skis = skis;
  g.userData.sit = (on) => { legs.forEach((l) => (l.rotation.z = on ? 1.25 : 0)); skis.forEach((s) => (s.rotation.z = on ? -1.25 : 0)); };
  shadows(g); return g;
}
/** The white cross of the ski patrol on a red jacket. */
function patrollerCross(g) { [[0.13, 1], [-0.13, -1]].forEach(([x]) => { box(g, 0.02, 0.22, 0.06, PM.white, x, 0.74, 0); box(g, 0.02, 0.06, 0.22, PM.white, x, 0.76, 0); }); shadows(g); }

/* ================= the machines ================= */
function wheel(p, R, w, x, y, z, rim) {
  const g = grp(p, x, y, z); cylZ(g, R, w, PM.rubber, 0, 0, 0, 20); cylZ(g, R * 0.66, w + 0.02, rim, 0, 0, 0, 16); cylZ(g, R * 0.28, w + 0.06, PM.dark, 0, 0, 0, 10);
  for (let i = 0; i < 4; i++) { const b = box(g, R * 1.1, 0.06, w + 0.03, PM.dark, 0, 0, 0); b.rotation.z = (i / 4) * Math.PI; }
  g.userData.r = R; return g;
}

/** PistenBully-like snow groomer (~9.6 long with blade and tiller). */
function groomer(st, p) {
  const g = grp(p), d = grp(g), R = PM.red, RD = PM.redD;
  const tracks = [1, -1].map((s) => trackUnit(g, { len: 4.5, r: 0.5, w: 1.3, z: s * 1.22, pitch: 0.3, frame: PM.dark }));
  const wheels = [];
  [1, -1].forEach((s) => [-1.25, -0.42, 0.42, 1.25].forEach((x) => wheels.push(wheel(g, 0.37, 0.9, x, 0.49, s * 1.22, PM.grey))));
  // hull between the tracks, track guards, engine housing behind the cab
  rbox(d, 4.3, 0.75, 1.15, 0.08, PM.dark, 0, 0.78, 0, 0.02);
  [1, -1].forEach((s) => { rbox(d, 4.8, 0.12, 1.45, 0.05, R, 0, 1.2, s * 1.22, 0.02); rbox(d, 4.8, 0.2, 0.06, 0.03, RD, 0, 1.1, s * 1.93, 0.01); });
  ext(d, [[-2.35, 1.2], [0.25, 1.2], [0.25, 2.2], [-2.0, 2.1], [-2.35, 1.85]], 0.1, 2.4, R, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => { rbox(d, 2.3, 0.18, 0.04, 0.02, PM.white, -1.05, 1.62, s * 1.2, 0.01); for (let i = 0; i < 6; i++) box(d, 0.05, 0.38, 0.04, PM.dark, -1.9 + i * 0.16, 1.85, s * 1.2); });
  for (let i = 0; i < 7; i++) box(d, 0.05, 0.04, 1.9, PM.dark, -1.9 + i * 0.28, 2.16, 0); // engine grille
  cylY(d, 0.08, 1.1, PM.chrome, -0.3, 2.55, -0.85, 10); cylY(d, 0.1, 0.08, PM.black, -0.3, 3.1, -0.85, 10); // exhaust
  rbox(d, 0.12, 0.5, 2.2, 0.04, PM.dark, -2.4, 1.6, 0, 0.02); [0.85, -0.85].forEach((z) => rbox(d, 0.06, 0.12, 0.25, 0.02, PM.tail, -2.47, 1.95, z, 0.01));
  // the cab: glazed all around, red posts, roof with a light bar and beacons, mirrors, steps
  const cab = grp(g, 1.1, 1.2, 0), c = grp(cab);
  rbox(c, 1.9, 0.5, 2.25, 0.06, R, 0, 0.25, 0, 0.02); rbox(c, 2.0, 0.14, 2.35, 0.06, R, 0, 1.78, 0, 0.02);
  [[0.92, 1.08], [0.92, -1.08], [-0.9, 1.08], [-0.9, -1.08]].forEach(([x, z]) => rbox(c, 0.09, 1.3, 0.09, 0.03, R, x, 1.1, z, 0.01));
  const ws = box(c, 0.03, 1.15, 2.05, PM.glass, 0.96, 1.12, 0); ws.rotation.z = 0.08;
  [1, -1].forEach((s) => { box(c, 1.72, 1.15, 0.03, PM.glass, 0, 1.12, s * 1.1); box(c, 0.04, 1.15, 0.04, R, 0.1, 1.12, s * 1.11); });
  box(c, 0.03, 1.0, 2.05, PM.glass, -0.94, 1.15, 0);
  rbox(c, 0.24, 0.18, 2.0, 0.04, PM.dark, 0.85, 1.94, 0, 0.02);
  [1, -1].forEach((s) => { rod(c, new V3(0.9, 1.5, s * 1.1), new V3(1.15, 1.6, s * 1.45), 0.025, PM.dark); rbox(c, 0.06, 0.34, 0.2, 0.02, PM.dark, 1.17, 1.5, s * 1.47, 0.01); rbox(c, 0.4, 0.06, 0.3, 0.02, PM.dark, 0.2, -0.25, s * 1.6, 0.01); rail(c, [[-0.95, 0.4, s * 1.14], [-0.95, 1.4, s * 1.14]], 0.025, PM.chrome); });
  rod(c, new V3(-0.6, 1.85, 0.8), new V3(-0.7, 2.7, 0.8), 0.012, PM.dark, 4); // antenna
  const lampM = std(0xfff3c8, 0.3, 0, { emissive: 0xffe6a0, emissiveIntensity: 0.4 }), lampL = [];
  [-0.75, -0.25, 0.25, 0.75].forEach((z) => { const l = rbox(c, 0.08, 0.13, 0.26, 0.04, lampM, 0.98, 1.94, z, 0.01); lampL.push(l); });
  [0.55, -0.55].forEach((z) => rbox(c, 0.08, 0.14, 0.2, 0.03, lampM, -0.98, 1.92, z, 0.01));
  [0.6, -0.6].forEach((z) => rbox(c, 0.06, 0.14, 0.3, 0.03, lampM, 0.97, 0.3, z, 0.01));
  beacon(st, c, -0.4, 1.85, 0.75); beacon(st, c, -0.4, 1.85, -0.75);
  bake(d); bake(c);
  // light beams (only at night)
  const beamM = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const bg = new THREE.ConeGeometry(1.8, 7, 18, 1, true); bg.rotateZ(Math.PI / 2); bg.translate(3.5, 0, 0);
  [0.5, -0.5].forEach((z) => { const b = add(cab, bg, beamM, 1.0, 1.9, z); b.rotation.z = -0.2; b.layers.set(1); });
  // front blade: push arms on a pivot, the curved moldboard with its wings, two rams
  const blade = grp(g, 2.25, 0.85, 0), bl = grp(blade, 1.45, -0.25, 0);
  [0.7, -0.7].forEach((z) => rbox(blade, 1.5, 0.18, 0.16, 0.04, PM.dark, 0.7, -0.12, z, 0.02));
  const prof = [[0.1, -0.6], [0.32, -0.6], [0.16, -0.2], [0.12, 0.25], [0.28, 0.58], [0.12, 0.62], [-0.06, 0.28], [-0.08, -0.22]];
  ext(bl, prof, 0.05, 4.1, R, 0, 0, 0, 0.02); rbox(bl, 0.08, 0.1, 4.1, 0.02, PM.steel, 0.3, -0.58, 0, 0.01);
  [1, -1].forEach((s) => { const w = grp(bl, 0, 0, s * 2.05); w.rotation.y = s * 0.55; ext(w, prof, 0.05, 1.1, R, 0, 0, s * 0.5, 0.02); rbox(w, 0.08, 0.1, 1.1, 0.02, PM.steel, 0.3, -0.58, s * 0.5, 0.01); });
  for (let z = -1.6; z <= 1.6; z += 0.8) rbox(bl, 0.3, 0.9, 0.08, 0.03, RD, -0.18, 0, z, 0.01); // back ribs
  bake(bl);
  const roll = grp(bl, 0.75, -0.35, 0); cylZ(roll, 0.32, 3.6, PM.snow, 0, 0, 0, 12); [1.8, -1.8].forEach((z) => sph(roll, 0.32, PM.snow, 0, 0, z)); roll.scale.setScalar(0.2);
  const rams = [0.55, -0.55].map((z) => hydraulic(g, anchor(g, 2.0, 1.45, z), anchor(bl, -0.15, 0.4, z), { barrel: 0.55, mat: PM.dark, rb: 0.07 }));
  blade.rotation.z = 0.22;
  // rear tiller: the arm, the drum hood, the shaft, and the rubber finisher that leaves the corduroy
  const tiller = grp(g, -2.4, 0.95, 0), ti = grp(tiller);
  [0.8, -0.8].forEach((z) => { const a = rbox(ti, 1.3, 0.2, 0.18, 0.05, PM.dark, -0.55, -0.15, z, 0.02); a.rotation.z = 0.25; });
  const hood = new THREE.CylinderGeometry(0.55, 0.55, 4.3, 18, 1, false, 0, Math.PI); hood.rotateX(Math.PI / 2); hood.rotateZ(Math.PI / 2);
  add(ti, hood, PMD.red, -1.45, -0.4, 0);
  [2.15, -2.15].forEach((z) => cylZ(ti, 0.57, 0.06, RD, -1.45, -0.4, z, 18));
  rbox(ti, 1.0, 0.08, 4.2, 0.03, PM.black, -2.35, -0.86, 0, 0.01).rotation.z = 0.12;
  for (let z = -2.05; z <= 2.05; z += 0.14) box(ti, 0.3, 0.03, 0.06, PM.black, -2.95, -0.94, z);
  rbox(ti, 0.4, 0.25, 4.3, 0.05, RD, -1.45, 0.18, 0, 0.02);
  bake(ti);
  const shaft = grp(tiller, -1.45, -0.4, 0); cylZ(shaft, 0.22, 4.1, PM.dark, 0, 0, 0, 10); for (let i = 0; i < 6; i++) { const b = box(shaft, 0.06, 0.8, 4.0, PM.steel, 0, 0, 0); b.rotation.z = (i / 6) * Math.PI; }
  tiller.rotation.z = -0.25;
  shadows(g);
  return {
    g, tracks, wheels, blade, tiller, cab, roll,
    lights(k) { lampM.emissiveIntensity = 0.4 + 2.2 * k; beamM.opacity = 0.16 * k; },
    update(dt, moving) { rams.forEach((r) => r.update()); if (moving) shaft.rotation.z += dt * 14; }
  };
}

/** the fresh corduroy behind the groomer: a strip lying on the snow, revealed with setDrawRange */
const CORD = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 32, 4); x.fillStyle = '#8a9ccc'; for (let i = 0; i < 32; i += 8) x.fillRect(i, 0, 3, 4); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
function trailStrip(S, x0, x1, w) {
  const n = Math.ceil((x1 - x0) / 0.5), pos = [], uv = [], zs = [-w / 2, 0, w / 2];
  const P = (x, z) => [x, gy(S, x, z) + 0.05, z];
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    for (let k = 0; k < 2; k++) {
      const za = zs[k], zb = zs[k + 1], a = P(xa, za), b = P(xb, za), c = P(xa, zb), e = P(xb, zb);
      pos.push(...a, ...c, ...b, ...b, ...c, ...e);
      const ua = ((za + w / 2) / w) * 12, ub = ((zb + w / 2) / w) * 12;
      uv.push(ua, xa * 0.3, ub, xa * 0.3, ua, xb * 0.3, ua, xb * 0.3, ub, xa * 0.3, ub, xb * 0.3);
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: CORD })); m.receiveShadow = true; S.add(m); m.userData.n = n; return m;
}

/* ---- ropeways: the haul rope loop, the towers with their sheave trains, the two terminals and the carriers ---- */
function ropeway(S, o) {
  const g = o.gap, fixed = grp(S), yT = gy(S, o.L, 0) + o.yb;
  const tops = o.towers.map((x) => new V3(x, gy(S, x, 0) + o.ht, 0));
  const pts = [new V3(0, o.yb, g), ...tops.map((t) => new V3(t.x, t.y, g)), new V3(o.L, yT, g)];
  for (let k = 1; k < 12; k++) { const a = Math.PI / 2 - (Math.PI * k) / 12; pts.push(new V3(o.L + g * Math.cos(a), yT, g * Math.sin(a))); }
  pts.push(new V3(o.L, yT, -g)); tops.slice().reverse().forEach((t) => pts.push(new V3(t.x, t.y, -g))); pts.push(new V3(0, o.yb, -g));
  for (let k = 1; k < 12; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 12; pts.push(new V3(-g * Math.cos(a), o.yb, g * Math.sin(a))); }
  const N = pts.length, cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + pts[i % N].distanceTo(pts[i - 1]));
  const total = cum[N];
  const at = (s, P, T) => {
    s = ((s % total) + total) % total; let i = 0; while (i < N - 1 && cum[i + 1] <= s) i++;
    const a = pts[i], b = pts[(i + 1) % N]; P.lerpVectors(a, b, (s - cum[i]) / (cum[i + 1] - cum[i])); if (T) T.subVectors(b, a).normalize(); return P;
  };
  for (let i = 0; i < N; i++) rod(fixed, pts[i], pts[(i + 1) % N], 0.045, PM.cable, 6);
  tops.forEach((t, i) => tower(fixed, t.x, gy(S, t.x, 0), t.y, g, i));
  const bw0 = terminal(fixed, 0, 0, 0, o, false), bw1 = terminal(fixed, o.L, yT - o.yb, Math.PI, o, true);
  // Detachable lift: in the terminals the carriers leave the rope and crawl on tyres, then speed up again to rope speed.
  // "u" is the rope's own length (the carriers are evenly spaced in u); a terminal stretches u, so the carriers slow down there.
  const VS = 0.3, eIn = o.kind === 'gondola' ? 1.5 : 1.4, eOut = o.kind === 'gondola' ? 3.9 : 4.0, DS = 0.025;
  const NS = Math.ceil(total / DS), uT = new Float32Array(NS + 1), Pq = new V3();
  for (let i = 1; i <= NS; i++) {
    at((i - 0.5) * (total / NS), Pq); const e = Math.min(Pq.x, o.L - Pq.x);
    uT[i] = uT[i - 1] + total / NS / (VS + (1 - VS) * sstep(eIn, eOut, e));
  }
  const U = uT[NS];
  const sAt = (u) => { u = ((u % U) + U) % U; let a = 0, b = NS; while (b - a > 1) { const m = (a + b) >> 1; if (uT[m] <= u) a = m; else b = m; } return (a + (u - uT[a]) / (uT[b] - uT[a] || 1)) * (total / NS); };
  const uOf = (s) => { const f = clamp(s / (total / NS), 0, NS), i = Math.min(NS - 1, Math.floor(f)); return uT[i] + (uT[i + 1] - uT[i]) * (f - i); };
  // more carriers, so the spacing on the line stays close to what it was at constant speed (they bunch up in the terminals)
  const n = Math.max(o.n, Math.round((0.85 * o.n * U) / total));
  const carriers = []; for (let i = 0; i < n; i++) { const c = o.make(i); S.add(c); carriers.push(c); }
  const P = new V3(), T = new V3(); let off = 0;
  const sOf = (i) => off + (U * i) / n;
  const place = () => carriers.forEach((c, i) => { at(sAt(sOf(i)), P, T); c.position.copy(P); c.rotation.y = Math.atan2(-T.z, T.x); });
  const sUp = (x) => { for (let i = 0; i <= tops.length; i++) { const a = pts[i], b = pts[i + 1]; if (x <= b.x) return uOf(cum[i] + (cum[i + 1] - cum[i]) * clamp((x - a.x) / (b.x - a.x), 0, 1)); } return uOf(cum[tops.length + 1]); };
  bake(fixed); place();
  return { carriers, total: U, sUp, sOf, get off() { return off; }, set off(v) { const d = v - off; off = v; bw0.rotation.y += d / g; bw1.rotation.y += d / g; place(); } };
}
function tower(p, x, y0, yTop, g, i) {
  const t = grp(p, x, 0, 0), M = PM.tower, hgt = yTop - 0.75 - y0;
  rbox(t, 1.4, 1.0, 1.4, 0.06, PM.conc, 0, y0 - 0.3, 0, 0.02);
  cylY(t, 0.27, hgt + 0.2, M, 0, y0 + hgt / 2, 0, 12); cylY(t, 0.38, 0.12, M, 0, y0 + 0.25, 0, 12);
  rbox(t, 0.55, 0.5, 0.6, 0.05, M, 0, yTop - 0.75, 0, 0.02); rbox(t, 0.34, 0.3, 2 * g + 0.8, 0.05, M, 0, yTop - 0.62, 0, 0.02);
  [1, -1].forEach((s) => {
    [0.13, -0.13].forEach((dz) => rbox(t, 1.95, 0.16, 0.06, 0.03, PM.greyD, 0, yTop - 0.3, s * g + dz, 0.01));
    rbox(t, 0.34, 0.3, 0.36, 0.04, PM.greyD, 0, yTop - 0.48, s * g, 0.01);
    [-0.72, -0.24, 0.24, 0.72].forEach((dx) => { cylZ(t, 0.17, 0.12, PM.dark, dx, yTop - 0.2, s * g, 14); cylZ(t, 0.07, 0.2, PM.steel, dx, yTop - 0.2, s * g, 8); });
    rod(t, new V3(-0.95, yTop - 0.3, s * g + s * 0.15), new V3(-0.95, yTop + 0.15, s * g + s * 0.22), 0.025, PM.greyD, 4); // rope catchers
    rod(t, new V3(0.95, yTop - 0.3, s * g + s * 0.15), new V3(0.95, yTop + 0.15, s * g + s * 0.22), 0.025, PM.greyD, 4);
  });
  // ladder, catwalk under the crossarm, the tower's number plate
  [0.16, -0.16].forEach((z) => rod(t, new V3(-0.36, y0 + 0.5, z), new V3(-0.36, yTop - 0.9, z), 0.025, PM.greyD, 4));
  for (let y = y0 + 0.7; y < yTop - 0.9; y += 0.38) rod(t, new V3(-0.36, y, 0.16), new V3(-0.36, y, -0.16), 0.018, PM.greyD, 4);
  rbox(t, 0.6, 0.05, 2 * g + 0.4, 0.02, PM.greyD, -0.5, yTop - 1.0, 0, 0.01); rail(t, [[-0.78, yTop - 1.0, -g - 0.2], [-0.78, yTop - 0.55, -g - 0.2], [-0.78, yTop - 0.55, g + 0.2], [-0.78, yTop - 1.0, g + 0.2]], 0.02, PM.greyD);
  rbox(t, 0.04, 0.3, 0.3, 0.03, PM.white, 0.3, y0 + 2.2, 0, 0.01); for (let k = 0; k <= i; k++) box(t, 0.02, 0.18, 0.04, PM.dark, 0.33, y0 + 2.2, -0.08 + k * 0.08);
  return t;
}
function terminal(p, x, y0, yaw, o, top) {
  const t = grp(p, x, y0, 0); t.rotation.y = yaw; const g = o.gap, yb = o.yb, gond = o.kind === 'gondola';
  const W = 2 * g + (gond ? 5.4 : 7), x0 = gond ? -g - 2.6 : -5.6, x1 = gond ? 3.4 : 3.6;
  if (top) rbox(t, x1 - x0 + 1, 6, W + 1, 0.2, SC.stoneD, (x0 + x1) / 2, -2.85, 0, 0.05);
  rbox(t, x1 - x0, 0.3, W, 0.1, PM.conc, (x0 + x1) / 2, 0.15, 0, 0.02);
  // bull wheel (turns with the rope) and the detach rail above it
  const bw = grp(t, 0, yb, 0); bw.userData.dynamic = true;
  add(bw, new THREE.TorusGeometry(g, 0.13, 8, 44), PM.grey).rotation.x = Math.PI / 2;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; rod(bw, new V3(0, 0.05, 0), new V3(Math.cos(a) * g, 0, Math.sin(a) * g), 0.06, PM.greyD, 6); }
  cylY(bw, 0.5, 0.35, PM.dark, 0, 0.1, 0, 14);
  const rl = add(t, new THREE.TorusGeometry(g, 0.06, 6, 44, Math.PI), PM.steel, 0, yb + 0.5, 0); rl.rotation.x = Math.PI / 2; rl.rotation.z = Math.PI / 2;
  [1, -1].forEach((s) => rod(t, new V3(0, yb + 0.5, s * g), new V3(x1 - 0.6, yb + 0.5, s * g), 0.06, PM.steel, 6));
  cylY(t, 0.25, 1.3, PM.dark, 0, yb + 0.85, 0, 12);
  if (!gond) {
    // the detachable chairlift terminal: a roof on a central spine
    rbox(t, 0.6, yb + 1.5, 0.8, 0.06, PM.greyD, -4.9, (yb + 1.5) / 2, 0, 0.02); rbox(t, 0.6, yb + 1.5, 0.8, 0.06, PM.greyD, 2.2, (yb + 1.5) / 2, 0, 0.02);
    rbox(t, 8.6, 0.4, 2 * g + 3.0, 0.3, PM.white, -1.2, yb + 1.6, 0, 0.04); rbox(t, 8.7, 0.16, 2 * g + 3.1, 0.06, PM.blue, -1.2, yb + 1.38, 0, 0.02);
    rbox(t, 8.4, 0.26, 2 * g + 2.8, 0.12, PM.snow, -1.2, yb + 1.9, 0, 0.04); rbox(t, 3.4, 1.0, 2.6, 0.12, PM.white, -1.9, yb + 2.4, 0, 0.03); rbox(t, 3.3, 0.18, 2.5, 0.08, PM.snow, -1.9, yb + 2.95, 0, 0.03);
    rbox(t, 0.12, 0.02, 2.4, 0.01, PM.yel, top ? -1 : 1.1, 0.31, g, 0.005); // boarding line
    // the queue gates and the lift attendant's hut (bottom only)
    if (!top) { for (let k = 0; k < 3; k++) cylY(t, 0.05, 1.0, PM.orange, -2.4 + k * 1.0, 0.8, g + 2.0, 8); rail(t, [[-2.4, 1.2, g + 2.0], [-0.4, 1.2, g + 2.0]], 0.03, PM.orange); }
    const h = top ? new THREE.Group() : grp(t, 3.0, 0.3, -(g + 2.4)); rbox(h, 1.8, 2.2, 1.8, 0.08, PM.white, 0, 1.1, 0, 0.03); box(h, 1.84, 0.8, 1.2, PM.glass, 0, 1.5, 0); box(h, 1.2, 0.8, 1.84, PM.glass, 0, 1.5, 0); rbox(h, 2.1, 0.2, 2.1, 0.06, PM.blue, 0, 2.3, 0, 0.02); rbox(h, 2.0, 0.18, 2.0, 0.08, PM.snow, 0, 2.48, 0, 0.03);
  } else {
    // the gondola station: a wooden and glass hall the cabins drive through
    const L = x1 - x0, cx = (x0 + x1) / 2, Hh = yb + 1.3;
    [1, -1].forEach((s) => {
      rbox(t, L, 1.3, 0.3, 0.06, SC.wood, cx, 0.95, s * (W / 2 - 0.15), 0.02);
      box(t, L - 0.2, Hh - 1.6, 0.08, PM.glassT, cx, 1.6 + (Hh - 1.6) / 2, s * (W / 2 - 0.15));
      for (let xx = x0 + 0.1; xx <= x1; xx += 1.6) rbox(t, 0.16, Hh, 0.34, 0.03, SC.woodD, xx, Hh / 2 + 0.3, s * (W / 2 - 0.15), 0.01);
    });
    rbox(t, 0.3, Hh, W, 0.06, SC.wood, x0 + 0.15, Hh / 2 + 0.3, 0, 0.02);
    rbox(t, L + 1.6, 0.45, W + 1.4, 0.3, PM.white, cx - 0.2, Hh + 0.5, 0, 0.04); rbox(t, L + 1.7, 0.5, W + 1.5, 0.1, PM.red, cx - 0.2, Hh + 0.2, 0, 0.02);
    rbox(t, L + 1.4, 0.3, W + 1.2, 0.14, PM.snow, cx - 0.2, Hh + 0.85, 0, 0.04); rbox(t, 3.6, 1.0, 2.8, 0.12, PM.white, -1.5, Hh + 1.4, 0, 0.03); rbox(t, 3.5, 0.18, 2.7, 0.08, PM.snow, -1.5, Hh + 1.95, 0, 0.03);
    rbox(t, 0.12, 0.02, 2.2, 0.01, PM.yel, top ? -0.8 : 0.6, 0.31, g, 0.005);
    for (let k = 0; k < 3; k++) rbox(t, 1.2, 0.45, 0.4, 0.05, SC.woodL, -2 + k * 1.6, 0.55, W / 2 - 0.6, 0.02); // benches
  }
  return bw;
}
/** chairlift chair: grip, hanger, 4-seat bench, safety bar with footrest. Origin on the rope. */
function chairTpl() {
  const t = new THREE.Group(), C = PM.greyD;
  rbox(t, 0.6, 0.3, 0.26, 0.06, PM.grey, 0, 0.0, 0, 0.02); [0.22, -0.22].forEach((x) => cylZ(t, 0.09, 0.36, PM.dark, x, 0.17, 0, 10));
  rod(t, new V3(0, -0.1, 0), new V3(0, -2.05, 0), 0.06, C, 8); rod(t, new V3(0, -2.05, 0), new V3(-0.42, -2.4, 0), 0.06, C, 8);
  rod(t, new V3(-0.42, -2.4, -1.15), new V3(-0.42, -2.4, 1.15), 0.05, C, 8);
  rbox(t, 0.62, 0.14, 2.24, 0.06, PM.blue, -0.08, -2.62, 0, 0.02);
  const bk = rbox(t, 0.12, 0.66, 2.24, 0.05, PM.blue, -0.44, -2.22, 0, 0.02); bk.rotation.z = -0.1;
  [1.14, -1.14].forEach((z) => rail(t, [[-0.44, -1.98, z], [0.2, -2.1, z], [0.2, -2.6, z]], 0.03, C));
  rail(t, [[-0.35, -1.95, 1.12], [0.42, -2.12, 1.12], [0.42, -2.12, -1.12], [-0.35, -1.95, -1.12]], 0.03, C);
  [0.5, -0.5].forEach((z) => rod(t, new V3(0.42, -2.12, z), new V3(0.62, -3.0, z), 0.03, C, 6)); rod(t, new V3(0.62, -3.0, -0.7), new V3(0.62, -3.0, 0.7), 0.035, C, 6);
  freeze(t); return t;
}
/** gondola cabin: grip, hanger, rounded body with a glass band all around. Origin on the rope. */
function cabinTpl(col) {
  const t = new THREE.Group();
  rbox(t, 0.66, 0.3, 0.3, 0.06, PM.grey, 0, 0.0, 0, 0.02); [0.24, -0.24].forEach((x) => cylZ(t, 0.09, 0.4, PM.dark, x, 0.17, 0, 10));
  rod(t, new V3(0, -0.1, 0), new V3(0, -1.0, 0), 0.07, PM.greyD, 8); rod(t, new V3(0, -1.0, 0), new V3(0, -1.65, 0.0), 0.05, PM.greyD, 8);
  rbox(t, 0.6, 0.1, 0.5, 0.04, PM.greyD, 0, -1.62, 0, 0.02);
  rbox(t, 1.72, 0.3, 1.56, 0.32, col, 0, -1.83, 0, 0.04); // roof
  rbox(t, 1.72, 0.9, 1.56, 0.32, col, 0, -3.18, 0, 0.04); // lower body
  rbox(t, 1.74, 0.12, 1.58, 0.3, PM.dark, 0, -3.66, 0, 0.02); // floor skirt
  [[0.8, 0.72], [0.8, -0.72], [-0.8, 0.72], [-0.8, -0.72]].forEach(([x, z]) => box(t, 0.1, 0.8, 0.1, col, x, -2.35, z));
  box(t, 0.04, 0.75, 1.36, PM.glassT, 0.84, -2.35, 0); box(t, 0.04, 0.75, 1.36, PM.glassT, -0.84, -2.35, 0);
  [1, -1].forEach((s) => { box(t, 1.5, 0.75, 0.04, PM.glassT, 0, -2.35, s * 0.76); box(t, 0.02, 1.6, 0.02, PM.dark, 0, -2.8, s * 0.79); });
  [1, -1].forEach((s) => rbox(t, 0.06, 0.6, 0.5, 0.02, PM.dark, s * 0.88, -3.05, 0, 0.01)); // ski holders
  freeze(t); return t;
}

/** Fan snow gun on a two-wheeled carriage, with a turret (turns) and a barrel (tilts). */
function snowGun(p) {
  const g = grp(p), car = grp(g);
  rbox(car, 1.8, 0.16, 0.5, 0.04, PM.greyD, -0.1, 0.45, 0, 0.02); cylZ(car, 0.07, 1.7, PM.dark, 0, 0.38, 0, 8);
  rod(car, new V3(0.6, 0.45, 0.25), new V3(2.0, 0.42, 0), 0.05, PM.greyD, 6); rod(car, new V3(0.6, 0.45, -0.25), new V3(2.0, 0.42, 0), 0.05, PM.greyD, 6);
  add(car, new THREE.TorusGeometry(0.1, 0.03, 6, 12), PM.dark, 2.08, 0.42, 0).rotation.x = Math.PI / 2;
  rod(car, new V3(1.6, 0.45, 0), new V3(1.6, 0.05, 0), 0.04, PM.dark, 6); rbox(car, 0.25, 0.04, 0.25, 0.02, PM.dark, 1.6, 0.03, 0, 0.01);
  rbox(car, 0.5, 0.6, 0.4, 0.05, PM.grey, -0.8, 0.8, 0, 0.02); box(car, 0.02, 0.18, 0.26, PM.glass, -0.54, 0.9, 0); sph(car, 0.05, PM.tail, -0.54, 1.05, 0.1); // control box
  [1, -1].forEach((s) => { const w = wheel(car, 0.38, 0.22, 0, 0.38, s * 0.92, PM.grey); void w; fender(car, 0.46, 0.26, 0, 0.38, s * 0.92, PM.greyD, Math.PI * 0.7); });
  bake(car);
  const turret = grp(g, 0, 0.55, 0), tt = grp(turret);
  cylY(tt, 0.42, 0.14, PM.greyD, 0, 0.07, 0, 18); cylY(tt, 0.2, 0.6, PM.orangeD, 0, 0.45, 0, 12);
  [0.86, -0.86].forEach((z) => { ext(tt, [[-0.35, 0.15], [0.35, 0.15], [0.2, 1.05], [-0.2, 1.05]], 0.08, 0.08, PM.orange, 0, 0, z, 0.01); cylZ(tt, 0.13, 0.12, PM.dark, 0, 0.95, z * 1.03, 12); });
  rbox(tt, 0.4, 0.14, 1.8, 0.04, PM.orangeD, 0, 0.2, 0, 0.02);
  bake(tt);
  const barrel = grp(turret, 0, 0.95, 0), bb = grp(barrel);
  const shell = new THREE.CylinderGeometry(0.72, 0.72, 1.9, 28, 1, true); shell.rotateZ(Math.PI / 2);
  add(bb, shell, PMD.orange, 0.15, 0, 0);
  [-0.8, 0.15, 1.1].forEach((x) => add(bb, new THREE.TorusGeometry(0.735, 0.05, 6, 30), PM.orangeD, x, 0, 0).rotation.y = Math.PI / 2);
  add(bb, new THREE.TorusGeometry(0.74, 0.08, 8, 30), PM.steel, 1.14, 0, 0).rotation.y = Math.PI / 2; // nozzle ring
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; cylX(bb, 0.035, 0.12, PM.chrome, 1.22, Math.cos(a) * 0.74, Math.sin(a) * 0.74, 6); }
  add(bb, new THREE.TorusGeometry(0.4, 0.025, 4, 24), PM.dark, -0.82, 0, 0).rotation.y = Math.PI / 2; // rear grille
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; rod(bb, new V3(-0.82, 0, 0), new V3(-0.82, Math.cos(a) * 0.72, Math.sin(a) * 0.72), 0.018, PM.dark, 4); }
  rbox(bb, 0.7, 0.3, 0.4, 0.05, PM.grey, -0.2, 0.82, 0, 0.02); // compressor box on top
  bake(bb);
  const fan = grp(barrel, -0.45, 0, 0); sph(fan, 0.16, PM.dark, 0, 0, 0); for (let k = 0; k < 7; k++) { const b = grp(fan); b.rotation.x = (k / 7) * Math.PI * 2; const bl = box(b, 0.06, 0.55, 0.22, PM.greyD, 0, 0.36, 0); bl.rotation.y = 0.45; }
  const nozzle = anchor(barrel, 1.25, 0, 0);
  barrel.rotation.z = 0.08;
  shadows(g); return { g, turret, barrel, fan, nozzle };
}

/** Orange snowplough truck: angled front blade, salt spreader with a spinning disc at the back. */
function plough(st, p) {
  const g = grp(p), d = grp(g), O = PM.orange;
  [0.42, -0.42].forEach((z) => rbox(d, 6.4, 0.3, 0.16, 0.03, MT.black, -0.4, 0.97, z, 0.01));
  const cab = truckCab(d, O, 1.35);
  // push plate on the front, salt hopper on the back with its grid, chute and lights
  rbox(d, 0.18, 0.95, 1.5, 0.04, PM.dark, 3.25, 0.75, 0, 0.02); [0.5, -0.5].forEach((z) => rbox(d, 0.5, 0.16, 0.14, 0.04, PM.dark, 3.45, 0.62, z, 0.02));
  const hop = grp(d, -1.0, 1.15, 0); hop.rotation.y = Math.PI / 2;
  ext(hop, [[-0.45, 0], [0.45, 0], [1.12, 0.8], [1.12, 1.45], [-1.12, 1.45], [-1.12, 0.8]], 0.06, 3.6, PM.yel, 0, 0, 0, 0.03);
  for (let x = -2.6; x <= 0.6; x += 0.4) box(d, 0.05, 0.05, 2.2, PM.dark, x, 2.62, 0);
  [1, -1].forEach((s) => { rbox(d, 3.6, 0.16, 0.06, 0.03, PM.yelD, -1.0, 2.1, s * 1.13, 0.01); rail(d, [[-2.75, 1.4, s * 0.6], [-2.95, 1.4, s * 0.6], [-2.95, 2.55, s * 0.6]], 0.025, PM.dark); });
  rbox(d, 0.5, 0.4, 0.5, 0.06, PM.dark, -2.9, 1.05, 0, 0.02);
  rbox(d, 0.14, 0.22, 2.1, 0.03, MT.stripes, -3.05, 0.72, 0, 0.01); [0.85, -0.85].forEach((z) => rbox(d, 0.06, 0.14, 0.22, 0.02, PM.tail, -3.1, 0.98, z, 0.01));
  cylY(d, 0.07, 1.2, PM.chrome, 1.25, 2.6, -0.9, 8);
  rbox(d, 0.28, 0.14, 1.6, 0.04, PM.dark, 2.6, 3.0, 0, 0.02); [0.4, -0.4].forEach((z) => rbox(d, 0.08, 0.12, 0.3, 0.02, PM.lamp, 2.75, 3.0, z, 0.01));
  bake(d);
  beacon(st, g, 2.45, 3.0, 0.65); beacon(st, g, 2.45, 3.0, -0.65); beacon(st, g, -2.9, 2.7, 0.0);
  const spinner = grp(g, -3.05, 0.6, 0); cylY(spinner, 0.38, 0.04, PM.dark, 0, 0, 0, 16); for (let k = 0; k < 4; k++) { const v = box(spinner, 0.7, 0.1, 0.03, PM.steel, 0, 0.06, 0); v.rotation.y = (k / 4) * Math.PI; }
  // the blade, angled to throw the snow to the side
  const blade = grp(g, 3.5, 0.55, 0), bb = grp(blade, 0.85, 0, 0); bb.rotation.y = 0.42;
  [0.45, -0.45].forEach((z) => rbox(blade, 0.9, 0.16, 0.14, 0.04, PM.dark, 0.4, 0, z, 0.02));
  const prof = [[0.05, -0.5], [0.24, -0.5], [0.08, -0.05], [0.12, 0.42], [0.32, 0.62], [0.14, 0.66], [-0.08, 0.4], [-0.12, -0.08]];
  ext(bb, prof, 0.05, 3.5, O, 0, 0, 0, 0.02); rbox(bb, 0.12, 0.12, 3.5, 0.02, PM.dark, 0.2, -0.5, 0, 0.01);
  for (let z = -1.4; z <= 1.4; z += 0.7) rbox(bb, 0.26, 0.8, 0.08, 0.03, PM.orangeD, -0.16, 0.05, z, 0.01);
  [1.72, -1.72].forEach((z) => { cylY(bb, 0.03, 1.4, PM.white, 0.0, 1.15, z, 6); for (let k = 0; k < 3; k++) cylY(bb, 0.035, 0.18, PM.red, 0.0, 0.62 + 0.36 * k + 0.27, z, 6); });
  bake(bb);
  blade.rotation.z = 0.18;
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.56, 0.42, 2.2, 0.56, s * 0.92, PM.grey, s)); wheels.push(tire(g, 0.56, 0.42, -1.5, 0.56, s * 0.92, PM.grey, s)); fender(g, 0.68, 0.46, -1.5, 0.56, s * 0.92, PM.dark, Math.PI * 0.6); });
  shadows(g); return { g, blade, spinner, wheels, cab };
}

/** Unimog-like carrier with a front-mounted rotary snow blower. */
function blower(st, p) {
  const g = grp(p), d = grp(g), Y = PM.yel;
  [0.45, -0.45].forEach((z) => rbox(d, 5.4, 0.28, 0.16, 0.03, MT.black, 0.3, 1.0, z, 0.01));
  // short cab and bonnet
  const cab = grp(g, 0.2, 1.2, 0), c = grp(cab);
  ext(c, [[0, 0], [1.45, 0], [1.5, 0.75], [1.36, 1.55], [0.05, 1.6]], [0.05, 0.05, 0.1, 0.12, 0.08], 2.1, Y, 0, 0, 0, 0.03);
  const ws = box(c, 0.03, 0.72, 1.85, PM.glass, 1.44, 1.16, 0); ws.rotation.z = 0.17;
  [1, -1].forEach((s) => { rbox(c, 1.0, 0.65, 0.03, 0.05, PM.glass, 0.72, 1.12, s * 1.05, 0.01); rod(c, new V3(1.35, 1.25, s * 1.05), new V3(1.6, 1.35, s * 1.35), 0.025, PM.dark); rbox(c, 0.06, 0.36, 0.18, 0.02, PM.dark, 1.62, 1.28, s * 1.37, 0.01); rbox(c, 0.4, 0.06, 0.3, 0.02, PM.dark, 0.8, -0.3, s * 1.0, 0.01); });
  rbox(c, 1.4, 0.1, 2.15, 0.05, Y, 0.7, 1.64, 0, 0.02);
  bake(c); beacon(st, cab, 0.6, 1.7, 0);
  ext(d, [[1.6, 1.2], [3.05, 1.2], [3.1, 1.7], [2.95, 2.0], [1.6, 2.05]], [0.04, 0.06, 0.12, 0.1, 0.04], 1.7, Y, 0, 0, 0, 0.03);
  for (let i = 0; i < 5; i++) box(d, 0.03, 0.05, 1.1, PM.dark, 3.08, 1.35 + i * 0.1, 0);
  [0.7, -0.7].forEach((z) => rbox(d, 0.06, 0.14, 0.24, 0.03, PM.lamp, 3.09, 1.85, z, 0.01));
  rbox(d, 1.6, 0.5, 2.0, 0.06, PM.yelD, -1.2, 1.4, 0, 0.02); rbox(d, 0.9, 0.5, 0.8, 0.06, PM.dark, -1.3, 1.9, 0.4, 0.02); // rear platform and toolbox
  [0.8, -0.8].forEach((z) => rbox(d, 0.06, 0.14, 0.22, 0.02, PM.tail, -2.02, 1.4, z, 0.01));
  cylY(d, 0.06, 1.0, PM.chrome, 1.5, 2.3, -0.85, 8);
  rbox(d, 0.18, 1.0, 1.6, 0.04, PM.dark, 3.2, 1.0, 0, 0.02);
  bake(d);
  const wheels = [];
  [1, -1].forEach((s) => [2.4, -0.5].forEach((x) => { wheels.push(tire(g, 0.64, 0.42, x, 0.64, s * 0.98, PM.grey, s)); fender(g, 0.76, 0.48, x, 0.64, s * 0.98, PM.yelD, Math.PI * 0.6); }));
  // the blower: drum housing open at the front, two augers, impeller housing and the chute
  const bw = grp(g, 4.1, 0.62, 0), bh = grp(bw);
  const drum = new THREE.CylinderGeometry(0.62, 0.62, 2.6, 22, 1, true, (3 * Math.PI) / 4, (3 * Math.PI) / 2); drum.rotateX(Math.PI / 2);
  add(bh, drum, PMD.yel, 0, 0, 0);
  [1.3, -1.3].forEach((z) => cylZ(bh, 0.64, 0.06, Y, 0, 0, z, 22));
  rbox(bh, 0.2, 0.12, 2.6, 0.03, PM.steel, 0.35, -0.6, 0, 0.01);
  cylX(bh, 0.48, 0.5, Y, -0.75, 0.1, 0, 18); rbox(bh, 0.5, 0.6, 0.9, 0.06, PM.dark, -0.95, 0.25, 0, 0.02);
  bake(bh);
  const augers = [1, -1].map((s) => { const a = grp(bw, 0.05, 0, 0); cylZ(a, 0.07, 2.5, PM.dark, 0, 0, 0, 8); for (let k = 0; k < 9; k++) { const b = grp(a, 0, 0, s * (0.15 + k * 0.12)); b.rotation.z = s * k * 0.75; box(b, 0.05, 0.42, 0.14, PM.steel, 0, 0.3, 0); } bake(a); return a; });
  const chute = grp(bw, -0.75, 0.55, 0), chg = grp(chute);
  cylY(chg, 0.24, 1.1, Y, 0, 0.55, 0, 14); add(chg, new THREE.TorusGeometry(0.26, 0.05, 6, 16), PM.dark, 0, 0.1, 0).rotation.x = Math.PI / 2;
  const top = rbox(chg, 0.48, 0.8, 0.48, 0.12, Y, 0, 1.3, 0.25, 0.03); top.rotation.x = 0.8;
  const defl = rbox(chg, 0.5, 0.06, 0.55, 0.03, PM.dark, 0, 1.6, 0.65, 0.01); defl.rotation.x = 0.3;
  bake(chg);
  const tip = anchor(chute, 0, 1.55, 0.75);
  shadows(g); return { g, wheels, cab, blow: bw, augers, chute, tip };
}

/** Snowmobile: two front skis, a track under the tunnel, the patroller riding it. */
function snowmobile(p) {
  const g = grp(p), d = grp(g), B = PM.blue;
  const tg = grp(g, -0.55, 0, 0); const track = trackUnit(tg, { len: 1.9, r: 0.21, w: 0.46, z: 0, pitch: 0.12, frame: PM.dark });
  rbox(d, 1.9, 0.12, 0.62, 0.04, PM.dark, -0.55, 0.6, 0, 0.02); [1, -1].forEach((s) => rbox(d, 1.8, 0.18, 0.05, 0.02, B, -0.6, 0.52, s * 0.31, 0.01));
  ext(d, [[0.2, 0.35], [1.25, 0.3], [1.6, 0.42], [1.4, 0.75], [0.7, 1.0], [0.3, 1.0], [0.1, 0.75]], [0.05, 0.1, 0.15, 0.15, 0.1, 0.05, 0.05], 0.95, B, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => rbox(d, 0.8, 0.14, 0.04, 0.04, PM.white, 0.9, 0.62, s * 0.475, 0.01));
  rbox(d, 0.06, 0.14, 0.36, 0.04, PM.lamp, 1.5, 0.62, 0, 0.01);
  const ws = rbox(d, 0.05, 0.42, 0.7, 0.05, PM.glassT, 0.62, 1.15, 0, 0.01); ws.rotation.z = 0.5;
  rod(d, new V3(0.15, 1.08, 0.42), new V3(0.15, 1.08, -0.42), 0.025, PM.dark, 6); [0.42, -0.42].forEach((z) => cylZ(d, 0.035, 0.12, PM.black, 0.15, 1.08, z, 8));
  rod(d, new V3(0.32, 0.95, 0), new V3(0.15, 1.08, 0), 0.03, PM.dark, 6);
  rbox(d, 1.25, 0.2, 0.52, 0.08, PM.black, -0.6, 0.78, 0, 0.02); rail(d, [[-1.25, 0.75, 0.3], [-1.45, 0.95, 0.3], [-1.45, 0.95, -0.3], [-1.25, 0.75, -0.3]], 0.025, PM.dark);
  rbox(d, 0.06, 0.1, 0.24, 0.02, PM.tail, -1.52, 0.66, 0, 0.01); rbox(d, 0.2, 0.3, 0.6, 0.04, PM.black, -1.55, 0.45, 0, 0.02);
  [1, -1].forEach((s) => {
    const sk = grp(d, 1.1, 0.05, s * 0.5); rbox(sk, 1.3, 0.05, 0.14, 0.02, PM.black, 0, 0, 0, 0.01); const tp = rbox(sk, 0.3, 0.05, 0.14, 0.02, PM.black, 0.72, 0.1, 0, 0.01); tp.rotation.z = 0.6;
    rod(d, new V3(1.1, 0.08, s * 0.5), new V3(1.05, 0.45, s * 0.42), 0.035, PM.dark, 6); rod(d, new V3(1.05, 0.35, s * 0.44), new V3(0.65, 0.42, s * 0.25), 0.025, PM.dark, 5); rod(d, new V3(1.05, 0.25, s * 0.45), new V3(0.65, 0.3, s * 0.25), 0.025, PM.dark, 5);
    cylY(d, 0.045, 0.3, PM.yel, 1.0, 0.42, s * 0.4, 8);
  });
  bake(d);
  const rider = operator(g, -0.3, 0.82, 0, std(0xd62a2a, 0.3, 0.2));
  rider.children[0].visible = false; rider.children[1].visible = false; // no backrest on a snowmobile
  rider.traverse((o) => { if (o.material === MT.vest) o.material = std(0xd62a2a, 0.75, 0); if (o.material === MT.refl) o.material = PM.white; if (o.material === MT.pants) o.material = PM.black; });
  box(rider, 0.02, 0.22, 0.07, PM.white, -0.2, 0.47, 0); box(rider, 0.02, 0.07, 0.22, PM.white, -0.2, 0.5, 0);
  shadows(g); return { g, track };
}
/** Little sled with crates of bread and wheels of cheese. */
function cargoSled(p) {
  const g = grp(p), d = grp(g);
  [0.42, -0.42].forEach((z) => { rbox(d, 1.9, 0.05, 0.08, 0.02, PM.dark, 0, 0.04, z, 0.01); const t = rbox(d, 0.3, 0.05, 0.08, 0.02, PM.dark, 1.05, 0.14, z, 0.01); t.rotation.z = 0.7; for (let x = -0.7; x <= 0.7; x += 0.7) rod(d, new V3(x, 0.05, z), new V3(x, 0.25, z), 0.025, PM.dark, 4); });
  rbox(d, 1.9, 0.08, 1.0, 0.03, PM.wood, 0, 0.3, 0, 0.01); [0.5, -0.5].forEach((z) => rail(d, [[-0.95, 0.32, z], [-0.95, 0.65, z], [0.95, 0.65, z], [0.95, 0.32, z]], 0.025, PM.red));
  rod(d, new V3(0.95, 0.3, 0), new V3(1.0, 0.3, 0), 0.04, PM.dark, 6);
  bake(d);
  const cargo = [];
  const crate = (x, z, fill) => { const c = grp(g, x, 0.34, z); rbox(c, 0.6, 0.36, 0.42, 0.03, PM.wood, 0, 0.18, 0, 0.01); fill(c); c.userData.home = c.position.clone(); cargo.push(c); };
  crate(-0.5, 0.0, (c) => { [-0.12, 0.12].forEach((z) => { const b = rbox(c, 0.5, 0.14, 0.16, 0.07, PM.bread, 0, 0.42, z, 0.03); b.rotation.y = 0.1; }); });
  crate(0.25, 0.0, (c) => { [-0.1, 0.12].forEach((z, i) => cylY(c, 0.17, 0.12, PM.cheese, i * 0.1 - 0.05, 0.42 + i * 0.12, z, 18)); });
  const can = grp(g, 0.75, 0.34, 0.25); cylY(can, 0.13, 0.42, PM.grey, 0, 0.21, 0, 14); cylY(can, 0.08, 0.1, PM.grey, 0, 0.47, 0, 12); can.userData.home = can.position.clone(); cargo.push(can);
  g.userData.cargo = cargo;
  shadows(g); return g;
}

/** Rescue helicopter (H145-like): glazed nose, sliding door, skids, a shrouded tail fan. userData: { rotor, fan, door } */
function rescueHeli(p) {
  const g = grp(p), Y = 1.3, YL = PM.yel, R = PM.red, D = std(0x3a3f50, 0.5, 0.2);
  const P = [[3.0, 0.05], [2.9, 0.45], [2.55, 0.82], [1.9, 1.05], [0.6, 1.12], [-0.9, 1.05], [-1.7, 0.72], [-2.4, 0.38], [-5.7, 0.2], [-6.05, 0.18]];
  const f = grp(g, 0, Y, 0); f.scale.set(1, 1.1, 1);
  body(f, P, YL, 0, 30);
  skin(f, P, 2.95, -2.35, Math.PI / 2, 1.7, R, 0, 1.005, 12);
  skin(f, P, -5.0, -5.5, 0, Math.PI * 2, R, 0, 1.012, 3); skin(f, P, -2.45, -2.75, 0, Math.PI * 2, R, 0, 1.012, 3);
  [-0.42, 0.42].forEach((dd) => skin(f, P, 2.97, 2.25, -Math.PI / 2 + dd, 0.75, AM.glassO, 0, 1.012, 4));
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(f, P, 2.9, 1.95, b - s * 0.18, 1.05, AM.glassO, 0, 1.012, 4); skin(f, P, 1.75, 1.0, b - s * 0.4, 0.62, AM.win, 0, 1.01, 3); });
  skin(f, P, 0.75, -0.65, 0.05, 1.1, AM.dark, 0, 1.004, 3); // door opening (+z side)
  skin(f, P, 0.75, -0.65, Math.PI - 0.05, 1.1, AM.line, 0, 1.008, 3); skin(f, P, 0.7, -0.6, Math.PI - 0.05, 1.04, YL, 0, 1.012, 3); skin(f, P, 0.45, -0.25, Math.PI + 0.25, 0.4, AM.win, 0, 1.016, 2);
  skin(f, P, -1.0, -1.6, 0, Math.PI * 2, AM.line, 0, 1.006, 4); // rear clamshell doors outline
  const door = grp(f); skin(door, P, 0.72, -0.62, 0.05, 1.06, YL, 0, 1.02, 3); skin(door, P, 0.45, -0.25, -0.25, 0.4, AM.win, 0, 1.026, 2);
  // engine cowling, exhausts, mast
  rbox(g, 2.9, 0.5, 1.15, 0.22, YL, -0.75, Y + 1.32, 0, 0.03); [1, -1].forEach((s) => { cylX(g, 0.14, 0.4, D, -2.15, Y + 1.38, s * 0.42, 10); rbox(g, 0.6, 0.22, 0.04, 0.03, D, 0.2, Y + 1.36, s * 0.58, 0.01); });
  cylY(g, 0.12, 0.45, AM.metal, -0.25, Y + 1.75, 0, 10);
  // tail: stabiliser with end plates, the shrouded fan (fenestron) and its fin
  plate(g, [[-4.55, -1.15], [-4.45, 1.15], [-5.0, 1.15], [-5.1, -1.15]], 0.08, YL, Y + 0.05);
  [1, -1].forEach((s) => { const e = fin(g, [[-4.5, -0.25], [-5.1, -0.25], [-5.15, 0.45], [-4.75, 0.45]], 0.05, R, s * 1.17); e.position.y = Y + 0.05; });
  const duct = grp(g, -6.35, Y + 0.45, 0); add(duct, new THREE.TorusGeometry(0.45, 0.17, 10, 26), YL); { const dg = new THREE.CylinderGeometry(0.47, 0.47, 0.32, 24, 1, true); dg.rotateX(Math.PI / 2); add(duct, dg, PMD.dark); }
  for (let k = 0; k < 3; k++) { const b = box(duct, 0.04, 0.9, 0.04, D, 0, 0, -0.08); b.rotation.z = (k / 3) * Math.PI; }
  ext(g, [[-5.95, Y + 0.7], [-6.7, Y + 0.85], [-7.05, Y + 1.85], [-6.65, Y + 1.9], [-6.15, Y + 1.0]], 0.08, 0.13, YL, 0, 0, 0, 0.02);
  ext(g, [[-6.55, Y + 1.35], [-6.85, Y + 1.4], [-6.98, Y + 1.7], [-6.7, Y + 1.72]], 0.04, 0.15, R, 0, 0, 0, 0.01);
  const fan = grp(duct, 0, 0, 0.04); cylZ(fan, 0.1, 0.12, AM.metal, 0, 0, 0, 10); for (let k = 0; k < 10; k++) { const b = grp(fan); b.rotation.z = (k / 10) * Math.PI * 2; const bl = box(b, 0.12, 0.36, 0.02, D, 0, 0.22, 0); bl.rotation.y = 0.4; }
  // skids and cross tubes, searchlight, lights, antenna, the word SECOURS
  [1, -1].forEach((s) => {
    rod(g, new V3(-1.7, 0.07, s * 1.05), new V3(1.5, 0.07, s * 1.05), 0.06, PM.grey, 8); rod(g, new V3(1.5, 0.07, s * 1.05), new V3(1.95, 0.32, s * 1.05), 0.06, PM.grey, 8);
    [0.9, -1.1].forEach((x) => { rod(g, new V3(x, 0.07, s * 1.05), new V3(x, 0.55, s * 1.0), 0.055, PM.grey, 8); rod(g, new V3(x, 0.55, s * 1.0), new V3(x, Y - 0.62, s * 0.5), 0.055, PM.grey, 8); });
    rbox(g, 0.4, 0.05, 0.22, 0.02, PM.dark, -0.1, 0.42, s * 1.05, 0.01);
    sph(g, 0.06, s > 0 ? AM.navG : AM.navR, -4.8, Y + 0.12, s * 1.17);
    const dd = grp(g); if (s < 0) dd.rotation.y = Math.PI; decal(dd, 'SECOURS', 1.6, 0.28, '#d62a2a', s * -3.85, Y + 0.02, 0.34, null);
  });
  sph(g, 0.14, D, 2.3, Y - 1.0, 0.3); sph(g, 0.09, PM.lamp, 2.42, Y - 1.02, 0.3); sph(g, 0.07, AM.navW, -6.9, Y + 1.9, 0); sph(g, 0.08, AM.navR, -1.5, Y + 1.22, 0);
  rod(g, new V3(1.2, Y + 1.2, 0), new V3(1.0, Y + 1.6, 0), 0.02, D, 4);
  // main rotor
  const rotor = grp(g, -0.25, Y + 2.02, 0); cylY(rotor, 0.34, 0.2, D, 0, 0, 0, 14); sph(rotor, 0.22, D, 0, 0.12, 0).scale.y = 0.6;
  for (let k = 0; k < 4; k++) { const b = grp(rotor); b.rotation.y = (k / 4) * Math.PI * 2 + 0.3; box(b, 0.5, 0.08, 0.14, AM.metal, 0.4, 0.02, 0); rbox(b, 3.9, 0.05, 0.3, 0.05, D, 2.55, 0.04, 0, 0.01); box(b, 0.32, 0.052, 0.3, PM.yel, 4.35, 0.04, 0); }
  g.userData = { rotor, fan, door, Y };
  shadows(g); return g;
}

/* ================= the mountain: terrain, peaks, run markers, the restaurant ================= */
function at(p, h, d, yaw = YAW, y = 0) { const [x, z] = Q(h, d); const g = grp(p, x, y, z); g.rotation.y = yaw; return g; }
function buildMountain(root) {
  // terrain: a grid in (h, d) lifted by H, painted with a canvas (snow, the groomed run, rocks, old ski tracks)
  const h0 = -84, h1 = 84, d0 = -100, d1 = -TOE, NX = 84, ND = 64, pos = [], uv = [], idx = [];
  for (let j = 0; j <= ND; j++) for (let i = 0; i <= NX; i++) {
    const h = h0 + ((h1 - h0) * i) / NX, d = d0 + ((d1 - d0) * j) / ND, [x, z] = Q(h, d);
    pos.push(x, H(h, d) + 0.02, z); uv.push(i / NX, 1 - j / ND);
  }
  for (let j = 0; j < ND; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const x = cv.getContext('2d');
  const U = (h) => ((h - h0) / (h1 - h0)) * 1024, V = (d) => (1 - (d - d0) / (d1 - d0)) * 512;
  const gr = x.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#a6b0c8'); gr.addColorStop(1, '#9aa4bc'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) { const h = rnd(-80, 80), d = rnd(-98, -50); if (Math.abs(h - PH) < 14) continue; x.fillStyle = `rgba(${90 + rnd(0, 20)},${96 + rnd(0, 20)},${120 + rnd(0, 20)},${rnd(0.5, 0.85)})`; x.beginPath(); x.ellipse(U(h), V(d), rnd(4, 14), rnd(3, 9), rnd(0, 3), 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(150,165,205,.45)'; x.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { let h = rnd(-60, 60); if (Math.abs(h - PH) < 13) continue; x.beginPath(); x.moveTo(U(h), V(-60)); for (let d = -60; d < -12; d += 2) { h += Math.sin(d * 0.6 + i) * 0.9; x.lineTo(U(h), V(d)); } x.stroke(); }
  x.fillStyle = '#a8b2ca'; x.fillRect(U(PH - 10.5), V(-64), U(PH + 10.5) - U(PH - 10.5), V(d1) - V(-64));
  x.fillStyle = 'rgba(110,122,160,.45)'; for (let h = PH - 10.3; h < PH + 10.3; h += 0.55) x.fillRect(U(h), V(-64), 1.4, V(d1) - V(-64));
  for (let i = 0; i < 9000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(80,90,140,.07)' : 'rgba(255,255,255,.12)'; x.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2); }
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
  const terr = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex })); terr.receiveShadow = true; terr.userData.dynamic = true; terr.userData.terrain = true; root.add(terr);
  // the high peaks: rocky faces and snowy summits, behind the ski area and on its left flank (seen in the overview)
  const pk = new THREE.Mesh(massifGeo(PEAKS), new THREE.MeshLambertMaterial({ vertexColors: true }));
  pk.userData.dynamic = true; pk.userData.terrain = true; pk.receiveShadow = true; root.add(pk);
  // run markers: poles along both edges of the blue run, a sign at the top, orange nets at the bottom
  for (let d = -12; d > -58; d -= 4.5) [PH - 10.6, PH + 10.6].forEach((h, i) => { if (h < -12 && d < -17 && d > -25) return; const [px, pz] = Q(h, d), y = H(h, d); cylY(root, 0.06, 1.8, SC.blue, px, y + 0.9, pz, 6); cylY(root, 0.065, 0.3, i ? SC.orange : SC.dark, px, y + 1.65, pz, 6); });
  { const [px, pz] = Q(PH + 11.5, -40), y = H(PH + 11.5, -40), g = grp(root, px, y, pz); g.rotation.y = YAW; cylY(g, 0.06, 2.2, SC.dark, 0, 1.1, 0, 6); cylZ(g, 0.38, 0.06, SC.blue, 0, 2.2, 0.05, 20); cylZ(g, 0.42, 0.04, SC.white, 0, 2.2, 0.02, 20); }
  [[-16, -14], [8, 14]].forEach(([a, b]) => { for (let h = a; h < b; h += 2) { const [px, pz] = Q(h, -0.5); cylY(root, 0.05, 1.2, SC.dark, px, 0.6, pz, 6); } const g = at(root, (a + b) / 2 - 1, -0.5); box(g, b - a - 2, 0.7, 0.03, SC.orange, 0, 0.75, 0); });
  // the mountain restaurant, on its stone base, with tables and parasols on the snow
  { const h = -22, d = -31.5, y = H(h, d); chalet(root, h, d, { w: 8, dd: 6, fl: 1, y: y - 0.2, found: 3.4, sign: 'RESTAURANT' });
    for (let k = 0; k < 3; k++) { const g = at(root, h + 5.5, d - 1.5 + k * 2.2, YAW, H(h + 5.5, d - 1.5 + k * 2.2)); cylY(g, 0.5, 0.06, SC.woodL, 0, 0.75, 0, 12); cylY(g, 0.06, 0.75, SC.woodD, 0, 0.37, 0, 6); cylY(g, 0.04, 2.2, SC.dark, 0, 1.1, 0, 6); add(g, new THREE.ConeGeometry(1.2, 0.5, 8), k % 2 ? SC.red : SC.white, 0, 2.2, 0); [0.8, -0.8].forEach((z) => rbox(g, 0.4, 0.45, 0.4, 0.05, SC.woodL, 0, 0.22, z, 0.02)); } }
  // rocks poking out of the snow, with a snow cap
  const rocks = [];
  for (let i = 0; i < 140 && rocks.length < 46; i++) { const h = rnd(-62, 62), d = rnd(-64, -14); if (blocked(h, d)) continue; const [px, pz] = Q(h, d); rocks.push([px, H(h, d), pz, rnd(0.5, 1.4)]); }
  instanced(root, ICO, rocks.length, (i, dm) => { const [px, py, pz, s] = rocks[i]; dm.position.set(px, py + s * 0.2, pz); dm.rotation.set(rnd(0, 3), rnd(0, 3), 0); dm.scale.set(s * 1.3, s * 0.8, s); return pick([0x6e7288, 0x5e6278, 0x7a7e94]); });
  instanced(root, ICO, rocks.length, (i, dm) => { const [px, py, pz, s] = rocks[i]; dm.position.set(px, py + s * 0.62, pz); dm.rotation.set(0, rnd(0, 3), 0); dm.scale.set(s * 1.05, s * 0.32, s * 0.8); return 0xa8b2ca; });
  return root;
}

/** [h, d, height, radius along h, radius along d, phase]: the summits around the resort */
const PEAKS = [
  [-60, -24, 30, 15, 15, 0.4], [-63, -47, 42, 17, 16, 2.1], [-78, -58, 36, 15, 17, 4.0], [-44, -70, 30, 15, 12, 1.2], // the left flank
  [76, -30, 30, 13, 15, 3.3], [70, -56, 40, 16, 17, 5.1], // the right flank, kept far out so it never hides the chairlift
  [-22, -84, 44, 22, 14, 0.9], [8, -88, 52, 22, 15, 2.7], [38, -84, 44, 20, 14, 4.4], [-60, -86, 38, 18, 14, 3.0], [60, -78, 34, 16, 13, 1.7] // the big ones behind
];
const massifIn = (h, d, m = 1) => PEAKS.some(([ph, pd, , rh, rd]) => ((h - ph) / (rh * m)) ** 2 + ((d - pd) / (rd * m)) ** 2 < 1);
/** One faceted mesh for all the peaks: grey rock on the steep faces, snow on the summits and on the gentle slopes. */
function massifGeo(list) {
  const pos = [], col = [], R = 10, A = 30, cSnow = new THREE.Color(0xb8c2da), cSnowB = new THREE.Color(0xc8d0e4), cRock = new THREE.Color(0x6a6e84), cRockD = new THREE.Color(0x52566c), c = new THREE.Color();
  const a = new V3(), b = new V3(), e = new V3(), n = new V3();
  list.forEach(([ph, pd, ht, rh, rd, f]) => {
    const V = [];
    for (let i = 0; i <= R; i++) {
      const r = i / R, row = [];
      for (let j = 0; j < A; j++) {
        const t = (j / A) * Math.PI * 2, wob = 1 + 0.16 * Math.sin(3 * t + f) + 0.09 * Math.sin(7 * t + 2 * f);
        const h = ph + Math.cos(t) * rh * r * wob, d = pd + Math.sin(t) * rd * r * wob;
        // ridges running down from the summit, a few jagged shoulders, the foot sunk into the snow
        const ridge = 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(1.5 * t + f)), 3), shoulder = 1 + 0.12 * Math.sin(5 * t + 3 * f) * Math.sin(Math.PI * r);
        const prof = i === 0 ? ht : ht * Math.pow(1 - r, 1.15) * (ridge + (1 - ridge) * (1 - r) * (1 - r)) * shoulder * (i < R ? 1 + (Math.random() - 0.5) * 0.12 : 1);
        const [x, z] = Q(h, d); row.push([x, H(h, d) - 0.8 + prof, z, prof / ht]);
        if (i === 0) break;
      }
      V.push(row);
    }
    const tri = (p, q, s) => {
      a.set(p[0], p[1], p[2]); b.set(q[0], q[1], q[2]); e.set(s[0], s[1], s[2]);
      n.crossVectors(b.clone().sub(a), e.clone().sub(a)).normalize(); if (n.y < 0) { [q, s] = [s, q]; n.negate(); }
      const fy = (p[3] + q[3] + s[3]) / 3, k = Math.random();
      if (fy > 0.52 + 0.12 * k || (n.y > 0.74 - 0.12 * fy && fy > 0.1)) c.copy(fy > 0.75 ? cSnowB : cSnow).multiplyScalar(0.96 + 0.06 * k);
      else c.copy(k < 0.4 ? cRockD : cRock).multiplyScalar(0.92 + 0.14 * Math.random());
      [p, q, s].forEach((v) => { pos.push(v[0], v[1], v[2]); col.push(c.r, c.g, c.b); });
    };
    for (let j = 0; j < A; j++) tri(V[0][0], V[1][j], V[1][(j + 1) % A]);
    for (let i = 1; i < R; i++) for (let j = 0; j < A; j++) { const j2 = (j + 1) % A; tri(V[i][j], V[i + 1][j], V[i + 1][j2]); tri(V[i][j], V[i + 1][j2], V[i][j2]); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}

/* ================= trees (instanced): snowy firs on the mountain and around the village ================= */
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const LANES = [
  [[[23, -31], [19, -28], [14, -27], [8, -27], [3, -25], [0, -22], [3.5, -18.5], [0.5, -15], [3.5, -11], [7.5, -7], [11, -4.5], [13, -3]], 3],
  [[[-21, 7], [-21, -8], [-20.5, -14], [-21.5, -20], [-22, -26]], 3.2]
];
function blocked(h, d) {
  if (massifIn(h, d, 0.8)) return true; // on the steep foot of a peak
  if (Math.abs(h - PH) < 12 && d < -4) return true; // the run
  if (h > 11.5 && h < 25 && d > -40 && d < 3) return true; // chairlift
  if (h > -38.5 && h < -25.5 && d > -54 && d < 4) return true; // gondola
  if (Math.hypot(h + 22, d + 31) < 8 || Math.hypot(h - 29, d + 12) < 8 || Math.hypot(h + 16, d + 21) < 5) return true; // restaurant, rescue, cannon
  return LANES.some(([pts, r]) => pts.some((p, i) => i && segD(h, d, pts[i - 1][0], pts[i - 1][1], p[0], p[1]) < r));
}
function firGeo(snow) {
  const parts = [[0.35, 1.25, 1.6], [1.15, 0.98, 1.45], [1.9, 0.66, 1.2]].map(([y, r, hh]) => {
    const k = snow ? 0.55 : 1, c = new THREE.ConeGeometry(r * k * (snow ? 1.07 : 1), hh * k, 8, 1);
    c.translate(0, y + hh - (hh * k) / 2 + (snow ? 0.03 : 0), 0); return c;
  });
  if (!snow) { const t = new THREE.CylinderGeometry(0.14, 0.2, 0.6, 6); t.translate(0, 0.3, 0); parts.push(t); }
  return BufferGeometryUtils.mergeBufferGeometries(parts.map((p) => p.toNonIndexed()));
}
function buildTrees(scene) {
  const T = [];
  for (let i = 0; i < 900 && T.length < 230; i++) {
    const h = rnd(-66, 66), d = rnd(-66, -10); if (blocked(h, d)) continue;
    if (Math.sin(h * 0.21) * Math.cos(d * 0.17) + Math.sin(h * 0.07 + d * 0.11) < -0.35) continue; // leave clearings between the groves
    const [x, z] = Q(h, d); T.push([x, H(h, d), z, rnd(0.8, 1.5)]);
  }
  // a ring of forest around the village, keeping the roads open
  for (let i = 0; i < 900 && T.length < 380; i++) {
    const a = rnd(0, Math.PI * 2), r = rnd(47, 66), h = Math.cos(a) * r, d = Math.sin(a) * r;
    if (d < -9 || Math.abs(d - 22) < 4.5 || (Math.abs(d - 38) < 6.5 && h < 6) || (h > 3 && h < 37 && d > 26 && d < 46) || Math.hypot(h + 47, d - 5) < 6.5 || Math.hypot(h - 44, d - 15.5) < 5.5) continue;
    const [x, z] = Q(h, d); T.push([x, 0, z, rnd(0.9, 1.6)]);
  }
  [[-48, 10], [-40, 12], [44, 3], [48, 9], [6, 10.5], [-12, 10], [26, 10], [50, 26], [-50, 30], [40, 44]].forEach(([h, d]) => { const [x, z] = Q(h, d); T.push([x, 0, z, rnd(0.8, 1.2)]); });
  const leaf = firGeo(false), snow = firGeo(true);
  const put = (dm, i) => { const [x, y, z, s] = T[i]; dm.position.set(x, y - 0.1, z); dm.rotation.set(0, (i * 1.7) % 6.28, 0); dm.scale.set(s, s * (0.9 + ((i * 37) % 10) / 25), s); };
  instanced(scene, leaf, T.length, (i, dm) => { put(dm, i); return [0x1f5a3e, 0x25664a, 0x1a4c36, 0x2c6e4e][i % 4]; });
  instanced(scene, snow, T.length, (i, dm) => { put(dm, i); return 0xaab4cc; });
}

/* ================= the village ================= */
function chalet(p, h, d, o = {}) {
  const W = o.w || 6, D = o.dd || 5, F = o.fl || 1, g = at(p, h, d, o.yaw == null ? YAW : o.yaw, o.y || 0);
  const sh = o.shut || pick([SC.green, SC.red, SC.blue]), a = 0.42, Hs = 1.2, Hw = Hs + F * 1.55, ta = Math.tan(a);
  if (o.found) rbox(g, W + 0.6, o.found, D + 0.6, 0.1, SC.stoneD, 0, -o.found / 2 + 0.1, 0, 0.03);
  rbox(g, W, Hs, D, 0.06, SC.stone, 0, Hs / 2, 0, 0.03);
  rbox(g, W - 0.12, Hw - Hs, D - 0.12, 0.04, o.wall || SC.wood, 0, (Hw + Hs) / 2, 0, 0.02);
  for (let y = Hs + 0.3; y < Hw; y += 0.32) { [1, -1].forEach((s) => { box(g, W - 0.1, 0.03, 0.02, SC.woodD, 0, y, s * (D / 2 - 0.05)); box(g, 0.02, 0.03, D - 0.1, SC.woodD, s * (W / 2 - 0.05), y, 0); }); }
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => box(g, 0.16, Hw - Hs, 0.16, SC.woodD, sx * (W / 2 - 0.05), (Hw + Hs) / 2, sz * (D / 2 - 0.05)));
  ext(g, [[-W / 2 + 0.06, 0], [W / 2 - 0.06, 0], [0, (W / 2) * ta]], 0, D - 0.12, o.wall || SC.wood, 0, Hw, 0, 0.02);
  // roof: two slabs with a thick layer of snow, wide overhangs
  const ox = 0.8, oz = 0.9, half = W / 2 + ox, ridge = Hw + (W / 2) * ta, Ls = half / Math.cos(a);
  [1, -1].forEach((s) => {
    const cx = (s * half) / 2, cy = ridge - (half / 2) * ta;
    rbox(g, Ls, 0.2, D + 2 * oz, 0.04, SC.roof, cx, cy + 0.1, 0, 0.02).rotation.z = -s * a;
    rbox(g, Ls + 0.06, 0.36, D + 2 * oz + 0.06, 0.17, SC.snow, cx + s * Math.sin(a) * 0.27, cy + 0.1 + Math.cos(a) * 0.27, 0, 0.06).rotation.z = -s * a;
    [1, -1].forEach((z) => { const fb = box(g, Ls, 0.12, 0.08, SC.woodL, cx, cy - 0.02, z * (D / 2 + oz)); fb.rotation.z = -s * a; });
  });
  { const cx = W * 0.22, cy = ridge - cx * ta; rbox(g, 0.55, 1.5, 0.55, 0.05, SC.stone, cx, cy + 0.6, -D * 0.2, 0.02); rbox(g, 0.68, 0.18, 0.68, 0.08, SC.snow, cx, cy + 1.42, -D * 0.2, 0.03); o.chim && o.chim.push(anchor(g, cx, cy + 1.6, -D * 0.2)); }
  // windows with shutters (lit inside), the door, a balcony on the front gable
  const win = (x, y, z, s, w = 0.62, hh = 0.78) => { box(g, w, hh, 0.04, WIN, x, y, z); box(g, w + 0.12, 0.08, 0.08, SC.woodD, x, y - hh / 2 - 0.04, z + s * 0.03); [1, -1].forEach((q) => box(g, w * 0.5, hh, 0.05, sh, x + q * (w * 0.75 + 0.02), y, z + s * 0.02)); };
  const winS = (x, y, z, s, w = 0.62, hh = 0.78) => { box(g, 0.04, hh, w, WIN, x, y, z); [1, -1].forEach((q) => box(g, 0.05, hh, w * 0.5, sh, x + s * 0.02, y, z + q * (w * 0.75 + 0.02))); };
  [1, -1].forEach((s) => {
    const z = s * (D / 2 + 0.01);
    if (s > 0) { box(g, 0.9, 1.75, 0.06, SC.woodD, -W * 0.28, 0.88, z); box(g, 0.3, 0.3, 0.07, WIN, -W * 0.28, 1.35, z); } else win(-W * 0.25, 0.75, z, s, 0.5, 0.5);
    win(W * 0.12, 0.75, z, s, 0.5, 0.5); if (W > 6.5) win(W * 0.33, 0.75, z, s, 0.5, 0.5);
    for (let f = 0; f < F; f++) [-W * 0.27, 0, W * 0.27].forEach((x) => win(x, Hs + 0.8 + f * 1.55, z, s));
    box(g, 0.5, 0.42, 0.05, WIN, 0, Hw + 0.55, z);
    [-1, 1].forEach((q) => winS(q * (W / 2 + 0.01), Hs + 0.8, (D / 4) * s, q));
  });
  const yb = Hw - 1.55 + 0.05, zb = D / 2 + 0.6;
  rbox(g, W * 0.86, 0.12, 1.15, 0.03, SC.woodD, 0, yb, zb - 0.02, 0.01);
  box(g, W * 0.86, 0.09, 0.1, SC.woodL, 0, yb + 0.95, zb + 0.5); box(g, W * 0.86, 0.06, 0.12, SC.snow, 0, yb + 1.02, zb + 0.5);
  for (let x = -W * 0.43 + 0.1; x < W * 0.43; x += 0.22) box(g, 0.11, 0.85, 0.04, SC.woodL, x, yb + 0.5, zb + 0.5);
  [1, -1].forEach((q) => { box(g, 0.09, 0.95, 1.1, SC.woodL, q * W * 0.43, yb + 0.5, zb); rod(g, new V3(q * W * 0.4, yb - 0.8, D / 2), new V3(q * W * 0.4, yb - 0.05, zb + 0.4), 0.05, SC.woodD, 4); });
  // a woodpile under the eaves, snow drifts at the corners
  { const wp0 = grp(g, W / 2 + 0.38, 0, -D * 0.1); rbox(wp0, 0.55, 1.1, D * 0.55, 0.04, SC.woodL, 0, 0.55, 0, 0.02); for (let y = 0.15; y < 1.1; y += 0.22) for (let z = -D * 0.25; z < D * 0.25; z += 0.22) cylX(wp0, 0.08, 0.57, SC.woodD, 0, y, z, 6); }
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => { const s = add(g, HEMI, SC.snow, sx * (W / 2 + 0.2), 0, sz * (D / 2 + 0.2)); s.scale.set(0.9, 0.45, 0.9); });
  if (o.sign) { decal(g, o.sign, Math.min(W * 0.7, o.sign.length * 0.42), 0.48, '#ffffff', 0, Hw + 0.02 + 0.1, D / 2 + 0.95, '#a31e22'); }
  if (o.cross) { box(g, 1.0, 1.0, 0.05, SC.white, 0, Hw + 0.6, D / 2 + 0.95); box(g, 0.7, 0.22, 0.07, SC.red, 0, Hw + 0.6, D / 2 + 0.96); box(g, 0.22, 0.7, 0.07, SC.red, 0, Hw + 0.6, D / 2 + 0.96); }
  return g;
}
function snowman(p, h, d, yaw = YAW) {
  const g = at(p, h, d, yaw); sph(g, 0.75, SC.snow, 0, 0.6, 0); sph(g, 0.52, SC.snow, 0, 1.55, 0); sph(g, 0.36, SC.snow, 0, 2.25, 0);
  const n = add(g, new THREE.ConeGeometry(0.07, 0.4, 8), SC.orange, 0.5, 2.25, 0); n.rotation.z = -Math.PI / 2;
  [0.12, -0.12].forEach((z) => sph(g, 0.045, SC.dark, 0.32, 2.36, z)); [1.4, 1.62, 1.84].forEach((y) => sph(g, 0.05, SC.dark, 0.5, y, 0));
  add(g, new THREE.TorusGeometry(0.36, 0.08, 6, 16), SC.red, 0, 1.92, 0).rotation.x = Math.PI / 2; box(g, 0.1, 0.5, 0.16, SC.red, 0.3, 1.75, 0.22);
  cylY(g, 0.36, 0.05, SC.dark, 0, 2.55, 0, 16); cylY(g, 0.24, 0.42, SC.dark, 0, 2.78, 0, 16);
  [1, -1].forEach((s) => rod(g, new V3(0, 1.65, s * 0.45), new V3(0.1, 2.15, s * 1.1), 0.035, SC.woodD, 4));
  return g;
}
function buildVillage(root, CHIM) {
  const C = { chim: CHIM };
  // north row (facing the slopes), south row (facing the street)
  [[-44, 15, 6], [-35.5, 15.5, 5.5], [-26, 15.5, 7.5, 2, 'HÔTEL'], [-16, 15, 6, 1, 'SKI'], [13, 15, 6], [22.5, 15.5, 6.5, 2], [31, 15.5, 5.5]].forEach(([h, d, w, fl, sign]) => chalet(root, h, d, Object.assign({ w, dd: 5.2, fl: fl || 1, sign }, C)));
  [[-37, 29.5, 6], [-28, 29.5, 7, 2], [-19, 29, 5.5], [-10.5, 29.5, 6.5, 2], [-1.5, 29.5, 5.5]].forEach(([h, d, w, fl]) => chalet(root, h, d, Object.assign({ w, dd: 5.2, fl: fl || 1, yaw: YAW + Math.PI }, C)));
  chalet(root, 44, 15.5, Object.assign({ w: 5.5, dd: 5, fl: 1, yaw: YAW + Math.PI, wall: SC.plaster, shut: SC.red, cross: true }, C)); // the doctor's
  // the chapel with its onion dome
  { const g = at(root, -47, 5, YAW + 0.3); rbox(g, 4.6, 3.8, 7, 0.08, SC.plaster, 0, 1.9, 0, 0.03);
    [1, -1].forEach((s) => { const r = rbox(g, 3.4, 0.2, 7.8, 0.04, SC.roof, s * 1.4, 4.75, 0, 0.02); r.rotation.z = -s * 0.75; const sn = rbox(g, 3.4, 0.3, 7.8, 0.12, SC.snow, s * 1.55, 4.95, 0, 0.04); sn.rotation.z = -s * 0.75; });
    ext(g, [[-2.3, 0], [2.3, 0], [0, 2.0]], 0, 6.9, SC.plaster, 0, 3.8, 0, 0.02);
    [-1.6, 0, 1.6].forEach((z) => [1, -1].forEach((s) => { box(g, 0.05, 1.2, 0.5, WIN, s * 2.31, 2.2, z); }));
    const t = grp(g, 0, 0, 4.4); rbox(t, 2.2, 7.4, 2.2, 0.06, SC.plaster, 0, 3.7, 0, 0.03); [1, -1].forEach((s) => { box(t, 0.6, 0.9, 0.05, SC.dark, 0, 6.2, s * 1.11); box(t, 0.05, 0.9, 0.6, SC.dark, s * 1.11, 6.2, 0); });
    box(t, 0.7, 1.4, 0.05, SC.woodD, 0, 0.7, 1.11); cylZ(t, 0.45, 0.06, SC.white, 0, 4.6, 1.12, 20); box(t, 0.04, 0.35, 0.03, SC.dark, 0, 4.7, 1.16);
    sph(t, 1.05, 0x3a7a68, 0, 8.1, 0).scale.set(1, 1.15, 1); add(t, HEMI, SC.snow, 0, 8.55, 0).scale.set(0.8, 0.35, 0.8); cylY(t, 0.3, 0.6, 0x3a7a68, 0, 9.3, 0, 10); sph(t, 0.35, 0x3a7a68, 0, 9.8, 0); cylY(t, 0.04, 0.9, SC.yel, 0, 10.5, 0, 6); box(t, 0.4, 0.06, 0.06, SC.yel, 0, 10.7, 0); }
  // the village square: a big Christmas tree with lights, snowmen, benches, a fountain frozen under the snow
  { const g = at(root, 3, 13.5); cylY(g, 0.25, 1.0, SC.woodD, 0, 0.5, 0, 8); [[1.0, 2.4, 2.5], [2.4, 1.9, 2.1], [3.6, 1.35, 1.8], [4.6, 0.8, 1.5]].forEach(([y, r, hh]) => { add(g, new THREE.ConeGeometry(r, hh, 10), 0x1f5a3e, 0, y + hh / 2 - 0.3, 0); add(g, new THREE.ConeGeometry(r * 0.5, hh * 0.5, 10), SC.snow, 0, y + hh - 0.3 - hh * 0.25 + 0.04, 0); });
    const bulbs = [0xff5a4a, 0xffd23a, 0x5ab4ff, 0xff8ad8, 0x8aff8a].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    for (let i = 0; i < 40; i++) { const t = i / 40, a = t * Math.PI * 9, y = 1.0 + t * 4.4, r = 2.4 * (1 - t * 0.85) + 0.05; sph(g, 0.1, bulbs[i % 5], Math.cos(a) * r, y, Math.sin(a) * r); }
    add(g, new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0xffe066 }), 0, 6.3, 0); }
  snowman(root, 9, 10, YAW + 0.5); snowman(root, -10, 34, YAW - 0.4);
  [[-3, 11], [9, 16.5], [-20, 19.9], [16, 19.9]].forEach(([h, d], i) => { const g = at(root, h, d, i > 1 ? YAW + Math.PI : YAW); rbox(g, 1.6, 0.1, 0.5, 0.03, SC.woodL, 0, 0.5, 0, 0.01); rbox(g, 1.6, 0.4, 0.08, 0.03, SC.woodL, 0, 0.8, -0.25, 0.01); [0.7, -0.7].forEach((x) => box(g, 0.08, 0.5, 0.5, SC.dark, x, 0.25, 0)); box(g, 1.5, 0.06, 0.4, SC.snow, 0, 0.58, 0); });
  // street lamps with garlands between them
  const lp = [];
  for (let h = -42; h <= 32; h += 9.25) { const [x, z] = Q(h, 19.8); lamp(root, x, z, YAW + Math.PI / 2); lp.push(new V3(x, 4.0, z)); }
  const GL = [0xffd796, 0xff8a5c, 0xfff0b0, 0x9fd0ff].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  for (let i = 1; i < lp.length; i++) for (let k = 1; k < 12; k++) { const t = k / 12, q = lp[i - 1].clone().lerp(lp[i], t); q.y -= Math.sin(Math.PI * t) * 0.9; sph(root, 0.09, GL[k % 4], q.x, q.y, q.z); }
  // the foot of the slopes: ticket hut, ski racks, piste map, a signpost
  { const g = at(root, 6, 4); rbox(g, 2.4, 2.4, 2, 0.08, SC.wood, 0, 1.2, 0, 0.02); box(g, 1.6, 0.8, 0.05, WIN, 0, 1.4, 1.02); rbox(g, 2.9, 0.2, 2.5, 0.04, SC.roof, 0, 2.5, 0, 0.02); rbox(g, 2.8, 0.25, 2.4, 0.1, SC.snow, 0, 2.7, 0, 0.03); decal(g, 'FORFAITS', 1.6, 0.3, '#ffffff', 0, 2.05, 1.05, '#2f5fa8'); }
  [[9, 7], [-12, 3]].forEach(([h, d]) => { const g = at(root, h, d); [0.9, -0.9].forEach((x) => box(g, 0.08, 1.1, 0.08, SC.dark, x, 0.55, 0)); box(g, 1.9, 0.06, 0.08, SC.dark, 0, 1.0, 0); for (let k = 0; k < 6; k++) { const s = box(g, 0.08, 1.6, 0.03, [SC.red, SC.blue, SC.yel, SC.white][k % 4], -0.7 + k * 0.28, 0.85, 0.1); s.rotation.x = -0.15; } });
  { const g = at(root, -7, 4.5); [1, -1].forEach((x) => box(g, 0.1, 2.2, 0.1, SC.woodD, x * 1.2, 1.1, 0)); box(g, 2.6, 1.5, 0.08, SC.white, 0, 1.6, 0.06); box(g, 2.4, 1.3, 0.02, 0xbcd0f0, 0, 1.6, 0.1);
    [[0.0, SC.blue], [-0.6, SC.red], [0.6, SC.dark]].forEach(([x, c], i) => { const l = box(g, 0.06, 1.0, 0.02, c, x, 1.6, 0.12); l.rotation.z = (i - 1) * 0.3; }); rbox(g, 2.8, 0.15, 0.4, 0.05, SC.snow, 0, 2.42, 0.05, 0.02); }
  // parked cars under a coat of snow, and the car park sign
  for (let h = 7.8; h <= 34; h += 2.6) [29.6, 36.6].forEach((d, j) => { if ((h * 7 + j * 3) % 5 < 1.2) return; const c = miniCar(root, pick(['car', 'car', 'van', 'kei'])); const [x, z] = Q(h, d); c.position.set(x, 0, z); c.rotation.y = YAW + (j ? Math.PI / 2 : -Math.PI / 2); add(c, HEMI, SC.snow, -0.1, 1.17, 0).scale.set(1.0, 0.12, 0.55); });
  { const g = at(root, 4.5, 27); cylY(g, 0.06, 2.4, SC.dark, 0, 1.2, 0, 6); decal(g, 'P', 0.7, 0.7, '#ffffff', 0, 2.3, 0.06, '#2f5fa8'); }
  // kids' sledges, skis planted in the snow, wooden fences
  [[-6, 8.5], [-5, 9.4]].forEach(([h, d], i) => { const g = at(root, h, d, YAW + i); rbox(g, 1.1, 0.08, 0.5, 0.03, SC.red, 0, 0.3, 0, 0.01); [0.22, -0.22].forEach((z) => { box(g, 1.2, 0.05, 0.05, SC.dark, 0, 0.05, z); box(g, 0.05, 0.25, 0.05, SC.dark, 0.4, 0.17, z); box(g, 0.05, 0.25, 0.05, SC.dark, -0.4, 0.17, z); }); });
  for (let i = 0; i < 8; i++) { const [x, z] = Q(-30 + i * 2.2, 41); box(root, 0.14, 1, 0.14, SC.woodD, x, 0.5, z); }
  return root;
}

/* ================= life: cars, people walking, skiers on the run, falling snow, smoke from the chimneys ================= */
function buildLife(scene, onUpdate, fx, CHIM) {
  const all = [];
  const R = (pts, closed = true, t = 0.1) => route(pts.map(([h, d, y = 0]) => { const [x, z] = Q(h, d); return [x, z, y]; }), closed, t);
  const road = R([[-50, 20.9], [50, 20.9], [52, 22], [50, 23.1], [-50, 23.1], [-52, 22]]);
  const cars = [['car', 0xe5452c], ['van', 0x2f7de0], ['car', 0xf2f2f6], ['kei', 0x3aa46a], ['car', 0x1b1d24]].map(([k, c], i) => {
    const car = miniCar(scene, k, c); add(car, HEMI, PM.snow, -0.12, k === 'van' || k === 'kei' ? 1.55 : 1.2, 0).scale.set(0.6, 0.12, 0.48);
    if (i % 2 === 0) rbox(car, 1.3, 0.3, 0.7, 0.14, PM.black, -0.2, k === 'van' || k === 'kei' ? 1.7 : 1.38, 0, 0.03); return car; });
  all.push(...cars); const t1 = traffic(road, cars, 3.2, { gap: 4 });
  const walk = R([[-44, 19.0], [30, 19.0], [30, 19.7], [-44, 19.7]], true, 0.05);
  const folks = Array.from({ length: 9 }, (_, i) => walker(scene, 0, 0, { hat: pick(BONNETS), kid: i % 4 === 1 })); all.push(...folks);
  const t2 = traffic(walk, folks, 1.0, { gap: 1.2 });
  // skiers coming down the run, from the top of the chairlift to its bottom, then (hidden) back up
  const run = R(LANES[0][0].map(([h, d]) => [h, d, H(h, d) + 0.04]), false, 0.35);
  const sk = Array.from({ length: 7 }, (_, i) => ({ o: skier(scene, 0, 0, { kid: i % 3 === 2 }), s: (run.len / 7) * i, v: rnd(2.8, 4.2) }));
  sk.forEach(({ o }) => { o.scale.setScalar(o.scale.x); o.userData.base = o.scale.x; });
  // falling snow
  const NF = 800, fp = new Float32Array(NF * 3), fv = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { fp[i * 3] = rnd(-62, 62); fp[i * 3 + 1] = rnd(0, 36); fp[i * 3 + 2] = rnd(-62, 62); fv[i] = rnd(0.9, 1.7); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false })); flakes.frustumCulled = false; scene.add(flakes);
  const chim = CHIM.map((a) => a.getWorldPosition(new V3())); let cT = 0;
  onUpdate((dt, t) => {
    t1.update(dt, all); t2.update(dt, all);
    sk.forEach((k) => {
      k.s += k.v * dt; if (k.s > run.len) k.s -= run.len;
      placeOn(k.o, run, k.s); k.o.rotation.z = -0.14; k.o.rotation.x = Math.sin(t * 2.4 + k.v) * 0.12;
      k.o.scale.setScalar(k.o.userData.base * clamp(Math.min(k.s, run.len - k.s) / 1.5, 0.01, 1));
    });
    for (let i = 0; i < NF; i++) { const j = i * 3; fp[j + 1] -= fv[i] * dt; fp[j] += Math.sin(t * 0.8 + i) * dt * 0.35; if (fp[j + 1] < 0) fp[j + 1] += 36; }
    fg.attributes.position.needsUpdate = true;
    cT -= dt; if (cT < 0 && chim.length) { cT = 0.3; fx.smoke(pick(chim), new V3(rnd(0.1, 0.4), rnd(0.5, 0.8), rnd(-0.2, 0.2)), 0.35, 0xdfe3ee, 3); }
  });
}
