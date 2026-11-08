// La Fête foraine — a fairground seen as a collection of machines: the big wheel and its drive tyres, the merry-go-round
// and its gears and cranks, the bumper cars and their electric ceiling, the caterpillar, the roller coaster with its chain
// lift and brakes, the swing ride, the showman's truck that unfolds into a swinging boat, and the candy-floss machine.
import * as THREE from 'three';
import { V3, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeIO, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, std, add, box, grp, cylY, cylZ, cylX, rod, rail, rbox, ext, anchor, wp, shadows, freeze, dummy, gearShape } from '../kit/geo.js';
import { tire, truckCab, hydraulic, telescopic } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { autumnTree, lamp } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, TAU = Math.PI * 2, UP = new V3(0, 1, 0);
const DD = 4; // the whole fair sits a little forward on the island
const Q = (h, d) => [(h + d + DD) * S2, (d + DD - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const V = (x, y, z) => new V3(x, y, z);
/** Merge the still parts of a rigid group (moving children must be added afterwards). */
const bake = (g) => { shadows(g); freeze(g); return g; };

/* ---------------- materials ---------------- */
function stripeTex(a, b, horiz) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 64, 64); x.fillStyle = b; if (horiz) x.fillRect(0, 32, 64, 32); else x.fillRect(32, 0, 32, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function stripeMat(a, b, rx, ry, horiz, dbl) {
  const t = stripeTex(a, b, horiz); t.repeat.set(rx, ry);
  const o = { map: t }; if (dbl) o.side = THREE.DoubleSide; return std(0xffffff, 0.7, 0, o);
}
const DBL = { side: THREE.DoubleSide };
const FM = {
  red: std(0xe0383a, 0.4, 0.15), redD: std(0xa8283a, 0.5, 0.15), yel: std(0xf6c22a, 0.4, 0.15), gold: std(0xe8b850, 0.3, 0.8),
  blue: std(0x2f6fe0, 0.4, 0.15), blueD: std(0x23489e, 0.5, 0.15), white: std(0xf7f5ef, 0.4, 0.05), cream: std(0xf1e4c4, 0.7, 0),
  pink: std(0xf27aa8, 0.5, 0.05), mint: std(0x4fc4a4, 0.45, 0.1), purple: std(0x8a52d0, 0.4, 0.15), purpleD: std(0x5a3290, 0.5, 0.15),
  green: std(0x5ab84a, 0.5, 0.05), greenD: std(0x37853a, 0.5, 0.05), orange: std(0xf2862a, 0.45, 0.1), sky: std(0x8fd0f4, 0.5, 0.05),
  dark: std(0x2e3242, 0.5, 0.4), steel: MT.steel, chrome: MT.chrome, black: MT.black, glassD: MT.glassD,
  wood: std(0xc08a50, 0.8, 0), woodD: std(0x7a4e2e, 0.8, 0), plate: std(0xa4aab4, 0.35, 0.8), mirror: std(0xcfe4ff, 0.2, 0.4, { emissive: 0x5a7090, emissiveIntensity: 0.35 }),
  sugar: std(0xffb0d4, 1, 0), grain: std(0xffffff, 0.6, 0), lamp: MT.lamp, concrete: MT.concrete, tail: MT.tail, amber: MT.amber,
  net: std(0x7a8090, 0.4, 0.7, { emissive: 0x3aa0ff, emissiveIntensity: 0 }),
  head: std(0x9aa0aa, 0.3, 0.8, { emissive: 0xff7a2a, emissiveIntensity: 0 }),
  fil: std(0xffd0e6, 0.9, 0, { transparent: true, opacity: 0.7, depthWrite: false }),
  water: std(0x3f8fe0, 0.2, 0.2),
  stripe: stripeMat('#e0383a', '#fbf4e6', 1, 1), stripeB: stripeMat('#2f6fe0', '#fbf4e6', 1, 1), stripeP: stripeMat('#f27aa8', '#fff2f6', 1, 1),
  stripeG: stripeMat('#3fa84a', '#f6d23a', 1, 1),
  coneR: stripeMat('#e0383a', '#fbf4e6', 8, 1, false, true), coneB: stripeMat('#2f6fe0', '#fbf4e6', 8, 1, false, true),
  coneP: stripeMat('#8a52d0', '#f6c22a', 6, 1, false, true), hood: stripeMat('#4ab84a', '#f6d23a', 1, 3, true, true),
  scalY: std(0xf6c22a, 0.5, 0.1, DBL), scalW: std(0xf7f5ef, 0.5, 0.05, DBL), scalR: std(0xe0383a, 0.5, 0.1, DBL), scalB: std(0x2f6fe0, 0.5, 0.1, DBL)
};
const SPH = new THREE.SphereGeometry(1, 14, 10), HALF = new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, Math.PI / 2);
const ball = (p, r, m, x, y, z) => { const s = add(p, SPH, m, x, y, z); s.scale.setScalar(r); return s; };
const egg = (p, rx, ry, rz, m, x, y, z) => { const s = add(p, SPH, m, x, y, z); s.scale.set(rx, ry, rz); return s; };

/* people colours */
const SKIN = [0xf2c8a0, 0xd9a47a, 0xb07a52, 0xf6d8bc, 0x8a5a3a], HAIR = [0x2a1d18, 0x4a3022, 0x8a5a2a, 0xd8b060, 0x1b1b22];
const TOPS = [0xe5452c, 0x2f7de0, 0xf2b21c, 0x3aa46a, 0xa45ad8, 0xf07aa8, 0x24b6c8, 0xffffff], BOTS = [0x2a3550, 0x3a3a48, 0x5a4a3a, 0x24305a, 0x6a6a7a];
const PMC = new Map(); const pm = (hex) => { if (!PMC.has(hex)) PMC.set(hex, std(hex, 0.7, 0)); return PMC.get(hex); };
/** A seated child facing +x, the seat at the origin. o.up: arms up (it's fun!). */
function sitter(p, x, y, z, o = {}) {
  const g = grp(p, x, y, z), top = pm(o.top ?? pick(TOPS)), bot = pm(pick(BOTS)), skin = pm(pick(SKIN));
  [0.09, -0.09].forEach((s) => { rbox(g, 0.34, 0.12, 0.13, 0.05, bot, 0.13, 0.07, s); rbox(g, 0.12, 0.3, 0.12, 0.05, bot, 0.3, -0.08, s); });
  rbox(g, 0.22, 0.4, 0.34, 0.1, top, -0.04, 0.32, 0);
  [0.2, -0.2].forEach((s) => { const e = o.up ? V(0.06, 0.86, s * 1.3) : V(0.26, 0.34, s * 0.85); rod(g, V(-0.02, 0.46, s), e, 0.05, top); ball(g, 0.055, skin, e.x, e.y, e.z); });
  ball(g, 0.17, skin, -0.02, 0.66, 0); [0.06, -0.06].forEach((s) => ball(g, 0.022, MT.black, 0.14, 0.68, s));
  const h = add(g, HALF, pm(pick(HAIR)), -0.04, 0.68, 0); h.scale.setScalar(0.18); h.rotation.z = 0.35;
  g.scale.setScalar(o.s || 0.85); return g;
}

/* bulbs: unlit spheres, instanced (they glow; no real lights) */
const BULB = new THREE.SphereGeometry(1, 8, 6);
const BM = new THREE.MeshBasicMaterial({ color: 0xffffff }), BM2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BCOL = [0xfff1a0, 0xff8f7a, 0x9fdcff, 0xffb4e6, 0xc4ff9a], WARM = [0xfff1a0, 0xffe080];
const tmpC = new THREE.Color();
function bulbs(p, pts, r = 0.08, cols = BCOL, m = BM) {
  const im = new THREE.InstancedMesh(BULB, m, pts.length);
  pts.forEach((q, i) => { dummy.position.set(q[0], q[1], q[2]); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(r); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, tmpC.setHex(cols[i % cols.length])); });
  p.add(im); return im;
}
const ringPts = (r, y, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return [r * Math.sin(a), y, r * Math.cos(a)]; });
const linePts = (a, b, n, sag = 0) => Array.from({ length: n }, (_, i) => { const t = (i + 0.5) / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t]; });

/* scalloped valances */
const SCAL = new THREE.CircleGeometry(0.22, 10, Math.PI, Math.PI);
function scallopsRing(p, r, y, n, mats) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const m = add(p, SCAL, mats[i % mats.length], r * Math.sin(a), y, r * Math.cos(a)); m.rotation.y = a; m.scale.setScalar((TAU * r) / n / 0.44); } }
function scallopsLine(p, x0, x1, y, z, n, mats, ry = 0) { const w = (x1 - x0) / n; for (let i = 0; i < n; i++) { const m = add(p, SCAL, mats[i % mats.length], x0 + w * (i + 0.5), y, z); m.scale.setScalar(w / 0.44); m.rotation.y = ry; } }
/** Gear wheel (teeth around), axis z; flat: axis y. */
function gear(p, ro, n, th, m, x, y, z, flat) {
  const g = new THREE.ExtrudeGeometry(gearShape(ro, ro * 0.84, n), { depth: th, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -th / 2);
  if (flat) g.rotateX(Math.PI / 2); return add(p, g, m, x, y, z);
}
/** A painted sign board with a text. */
function sign(p, text, w, h, bg, fg, x, y, z, ry = 0) {
  const g = grp(p, x, y, z); g.rotation.y = ry;
  rbox(g, w + 0.2, h + 0.2, 0.1, 0.08, FM.gold, 0, 0, -0.03, 0.02); decal(g, text, w, h, fg, 0, 0, 0.03, bg); return g;
}

/* ---------------- the cards ---------------- */
const DATA = {
  roue: { short: 'La grande roue', full: 'La grande roue', verb: 'Tourner', horn: 'bell',
    use: 'Une roue géante avec des nacelles, pour voir toute la fête de tout en haut.',
    how: 'Un moteur fait tourner deux pneus. Les pneus frottent sur la roue et la font tourner. Les nacelles pendent et restent toujours droites.' },
  carrousel: { short: 'Le carrousel', full: 'Le carrousel', verb: 'Tourner', horn: 'bell',
    use: 'Le manège des chevaux de bois, qui tourne en musique.',
    how: 'Un moteur fait tourner une grande roue dentée sous le plancher. En haut, des manivelles font monter et descendre les chevaux.' },
  autos: { short: 'Les autos', full: 'Les autos tamponneuses', verb: 'Rouler', horn: 'horn',
    use: 'Des petites autos électriques qui se cognent tout doucement.',
    how: "Le plafond est un filet électrique. La perche de chaque auto le touche, et l'électricité fait marcher le moteur." },
  chenille: { short: 'La chenille', full: 'La chenille', verb: 'Tourner', horn: 'bell',
    use: 'Un petit train rond qui monte et descend sur des bosses.',
    how: 'Au milieu, un moteur fait tourner de grands bras. Les bras tirent les wagons sur des rails pleins de bosses.' },
  montagnes: { short: 'Les montagnes russes', full: 'Les montagnes russes', verb: 'Partir', horn: 'bell',
    use: 'Un petit train qui monte tout en haut, puis descend très vite.',
    how: "Une chaîne tire le train jusqu'en haut. Ensuite, il descend tout seul grâce à son poids. Les freins l'arrêtent à la fin." },
  chaises: { short: 'Les chaises volantes', full: 'Les chaises volantes', verb: 'Voler', horn: 'bell',
    use: 'Des chaises accrochées à des chaînes, qui volent en tournant.',
    how: 'Le moteur fait tourner le grand mât. Plus il tourne vite, plus les chaises s’envolent vers l’extérieur.' },
  convoi: { short: 'Le camion-manège', full: 'Le camion du forain', verb: 'Déplier', horn: 'horn',
    use: 'Un camion qui transporte un manège plié, et qui le déplie en arrivant.',
    how: 'Des vérins hydrauliques poussent avec de l’huile : ils posent les pieds et lèvent les bras du bateau balançoire.' },
  barbapapa: { short: 'La barbe à papa', full: 'La machine à barbe à papa', verb: 'Préparer', horn: 'bell',
    use: 'Elle transforme du sucre en un gros nuage rose, tout doux.',
    how: 'Au milieu, une petite tête chauffe le sucre et tourne très vite. Le sucre fondu sort en fils très fins, qu’on enroule sur un bâton.' }
};
const ORDER = ['roue', 'carrousel', 'autos', 'chenille', 'montagnes', 'chaises', 'convoi', 'barbapapa'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  roue: GND + `<path class="ln" d="M38 74L60 34L82 74M44 74L60 40L76 74"/><circle cx="60" cy="34" r="26" fill="none" stroke="#e0383a" stroke-width="4"/><circle cx="60" cy="34" r="4" class="k"/>
    <path class="ln" d="M60 8V60M34 34H86M42 16L78 52M78 16L42 52"/><rect x="54" y="58" width="12" height="10" rx="3" fill="#2f6fe0"/><rect x="82" y="30" width="12" height="10" rx="3" fill="#f6c22a"/><rect x="26" y="30" width="12" height="10" rx="3" fill="#4fc4a4"/><rect x="54" y="2" width="12" height="10" rx="3" fill="#f27aa8"/>`,
  carrousel: GND + `<path d="M14 28L60 8L106 28z" fill="#e0383a"/><rect x="14" y="28" width="92" height="8" fill="#f6c22a"/><rect x="56" y="36" width="8" height="32" fill="#8a52d0"/>
    <path class="ln" d="M30 36V68M90 36V68"/><path d="M20 52q4-8 14-6h10l4-6 4 4-4 8-14 2-4 8h-4z" fill="#fff" stroke="#2a2440" stroke-width="1.5"/><path d="M76 46q4-8 14-6h10l4-6 4 4-4 8-14 2-4 8h-4z" fill="#fff" stroke="#2a2440" stroke-width="1.5"/><rect x="8" y="68" width="104" height="6" rx="2" fill="#c08a50"/>`,
  autos: GND + `<path class="ln" d="M10 12H110M30 12V40M80 12V40"/><path d="M14 58q0-16 16-16h18q8 0 10 8l4 8z" fill="#e0383a"/><rect x="8" y="56" width="58" height="10" rx="5" class="k"/>
    <path d="M58 58q0-14 16-14h20q8 0 10 8l4 6z" fill="#2f6fe0"/><rect x="54" y="56" width="58" height="10" rx="5" class="k"/><path d="M76 56l4 2" stroke="#ffd23a" stroke-width="4"/><path d="M30 42V12M80 44V12" stroke="#2a2440" stroke-width="2"/><path d="M27 12l3-5 3 5M77 12l3-5 3 5" stroke="#ffd23a" stroke-width="2" fill="none"/>`,
  chenille: GND + `<path d="M10 64q10-18 24-6t24-4 24 4 24-6v14H10z" fill="#3fa84a"/><path d="M18 54q8-14 18-4M44 52q8-12 18-2M70 52q8-12 18-2" fill="none" stroke="#f6d23a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="100" cy="46" r="14" fill="#5ab84a"/><circle cx="104" cy="42" r="4" fill="#fff"/><circle cx="105" cy="42" r="2" class="k"/><path d="M100 52q5 3 9-1" class="ln"/><path class="ln" d="M96 33l-4-10M104 33l4-10"/><circle cx="92" cy="22" r="3" fill="#f27aa8"/><circle cx="108" cy="22" r="3" fill="#f27aa8"/>`,
  montagnes: GND + `<path d="M4 66L30 66L52 14Q58 6 64 16L84 56Q90 66 98 56L104 46L116 66" fill="none" stroke="#e0383a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <path class="ln" d="M44 74V32M56 74V12M66 74V22M78 74V46M100 74V50"/><rect x="62" y="16" width="16" height="10" rx="3" fill="#f6c22a" transform="rotate(62 70 21)"/><rect x="76" y="34" width="16" height="10" rx="3" fill="#2f6fe0" transform="rotate(62 84 39)"/>`,
  chaises: GND + `<rect x="57" y="18" width="6" height="56" fill="#f7f5ef" stroke="#2a2440" stroke-width="1.5"/><path d="M22 26L60 8L98 26z" fill="#2f6fe0"/><rect x="22" y="26" width="76" height="5" fill="#f6c22a"/>
    <path class="ln" d="M28 31L10 56M40 31L28 60M80 31L92 60M92 31L110 56"/><rect x="4" y="54" width="12" height="6" rx="2" fill="#e0383a"/><rect x="22" y="58" width="12" height="6" rx="2" fill="#4fc4a4"/><rect x="86" y="58" width="12" height="6" rx="2" fill="#f27aa8"/><rect x="104" y="54" width="12" height="6" rx="2" fill="#f6c22a"/>`,
  convoi: GND + `<rect x="6" y="52" width="80" height="8" fill="#5a3290"/><path class="ln" d="M14 52L44 16L74 52"/><path d="M26 44q18 10 36 0l4-8H22z" fill="#7a4e2e"/><path class="ln" d="M44 16V36"/>
    <rect x="88" y="34" width="24" height="26" rx="3" fill="#8a52d0"/><rect class="g" x="100" y="38" width="10" height="9"/><circle class="k" cx="20" cy="64" r="6"/><circle class="k" cx="34" cy="64" r="6"/><circle class="k" cx="102" cy="64" r="6"/><path class="ln" d="M10 60v14M80 60v14"/>`,
  barbapapa: GND + `<path d="M10 22h100l-6 12H16z" fill="#f27aa8"/><path d="M10 22h20l-4 12H16zM50 22h20l-2 12H52zM90 22h20l-6 12h-10z" fill="#fff"/><rect x="16" y="50" width="88" height="24" fill="#f7f5ef" stroke="#2a2440" stroke-width="1.5"/>
    <path d="M40 50q2-10 20-10t20 10z" fill="#c4c9d6"/><path class="ln" d="M86 50V30"/><circle cx="86" cy="26" r="11" fill="#ffb0d4"/><circle cx="80" cy="22" r="6" fill="#ffc4dc"/>`
};

/* ---------------- layout ---------------- */
const CFG = {
  roue: CF(-18, -26), montagnes: CF(13, -26),
  carrousel: CF(-33, -6), autos: CF(-13, -6), chaises: CF(5, -6), chenille: CF(26, -6),
  barbapapa: CF(-30, 15), convoi: CF(8, 15)
};
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 3, col = '#e4d6b2', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
road([[-44, 5], [36, 5]], 6); road([[-23, 5], [-23, -24]], 3.4); road([[28, 5], [28, 22]], 3);
[[-33, -6, 7], [-13, -6, 8], [5, -6, 8], [26, -6, 8], [-18, -26, 7], [13, -26, 9], [8, 15, 9], [-30, 15, 5]].forEach(([h, d, r]) => blob(h, d, r, 'rgba(214,196,150,.85)'));
blob(-44, 22, 9, 'rgba(110,150,80,.7)'); blob(44, -10, 10, 'rgba(110,150,80,.7)'); blob(-6, 28, 8, 'rgba(110,150,80,.6)'); blob(-40, -24, 8, 'rgba(110,150,80,.6)');
rect(28, 25, 15, 11, '#5e626e'); for (let h = 22.2; h <= 34; h += 2.6) rect(h, 25, 0.16, 9, '#f3efe2');
blob(-12, 27, 9, 'rgba(110,160,80,.75)'); blob(-26, 25, 7, 'rgba(110,160,80,.7)');
rect(-2, -38, 46, 9, 'rgba(150,170,110,.8)');

export default {
  id: 'fete', title: 'La Fête foraine', titleHtml: 'La Fête <span>foraine</span>',
  subtitle: 'La grande roue, le carrousel, les autos tamponneuses, les montagnes russes… et comment toutes ces machines font tourner les manèges.',
  welcome: 'Bienvenue à la fête foraine ! Touche un manège pour voir comment il marche.',
  hint: 'Touche un manège pour le découvrir.', backLabel: 'Toute la fête',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="13" r="9"/><path d="M16 4v18M7 13h18M9.6 6.6l12.8 12.8M22.4 6.6L9.6 19.4M10 29l6-16 6 16"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false, outerColor: 0x1f3a2a,
  forest: { dark: [0x1f4a2e, 0x2a5a36, 0x183a2a, 0x2f6a3a, 0x214a33], bush: [0x4a8a3a, 0xf27aa8, 0x5a9a44, 0xf6c22a] },
  overview: { w: 92, h: 64, focus: [0, 4, 0] },
  ground: { base: ['#d8c79e', '#c4b083', '#6f8f4f'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 160); onUpdate((dt) => fx.update(dt));
    freeze(buildFair(grp(scene)));
    let T = 0; onUpdate((dt) => { T += dt; BM2.color.setScalar(Math.sin(T * 5) > 0 ? 1 : 0.45); });
    const until = async (f) => { while (!f()) await sleep(0.05); };

    /* ---- la grande roue ---- */
    (function () {
      const st = makeStation('roue'), S = st.g, H = 10.6, R = 8, N = 12;
      const B = grp(S);
      // boarding platform with steps and railings
      rbox(B, 6, 0.6, 2.4, 0.06, FM.cream, 0, 0.3, -0.3, 0.02); rbox(B, 6.1, 0.08, 2.5, 0.03, FM.red, 0, 0.62, -0.3, 0.01);
      for (let i = 0; i < 3; i++) rbox(B, 0.4, 0.2 * (i + 1), 1.6, 0.03, FM.cream, -3.2 - (2 - i) * 0.4, 0.1 * (i + 1), -0.3, 0.01);
      rail(B, [[-2.9, 0.65, -1.5], [-2.9, 1.6, -1.5], [2.9, 1.6, -1.5], [2.9, 0.65, -1.5]], 0.035, FM.gold);
      rail(B, [[2.9, 1.6, -1.5], [2.9, 1.6, 0.8], [2.9, 0.65, 0.8]], 0.035, FM.gold);
      // the two A-frames, with braces
      [1, -1].forEach((s) => {
        const zf = s * 2.7, zt = s * 1.55;
        [5.6, -5.6].forEach((x) => { rbox(B, 0.9, 0.3, 0.9, 0.05, FM.concrete, x, 0.15, zf, 0.02);
          const P = (t, o) => V(x * (1 - t) + o * (1 - t * 0.7), H * t, zf + (zt - zf) * t);
          rod(B, P(0, 0.22), P(0.97, 0.22), 0.11, FM.white, 8); rod(B, P(0, -0.22), P(0.97, -0.22), 0.11, FM.white, 8);
          for (let k = 0; k < 10; k++) rod(B, P(k * 0.095, k % 2 ? 0.22 : -0.22), P((k + 1) * 0.095, k % 2 ? -0.22 : 0.22), 0.035, FM.red, 5); });
        const t = 0.42; rod(B, V(5.6 * (1 - t), H * t, zf + (zt - zf) * t), V(-5.6 * (1 - t), H * t, zf + (zt - zf) * t), 0.1, FM.red, 8);
        rod(B, V(5.6 * (1 - t), H * t, zf + (zt - zf) * t), V(0, H - 0.6, zt), 0.07, FM.red, 6); rod(B, V(-5.6 * (1 - t), H * t, zf + (zt - zf) * t), V(0, H - 0.6, zt), 0.07, FM.red, 6);
        rbox(B, 0.8, 1.0, 0.5, 0.06, FM.dark, 0, H, s * 1.5, 0.02);
      });
      [5.6, -5.6].forEach((x) => rod(B, V(x, 0.35, 2.7), V(x, 0.35, -2.7), 0.12, FM.white, 8));
      cylZ(B, 0.3, 3.6, FM.steel, 0, H, 0, 16);
      // the drive: an electric motor, two gearboxes, two tyres pressing on the drive ring
      const RT = R + 0.13, TR = 0.42, TA = 0.17, tx = Math.sin(TA) * (RT + TR), ty = H - Math.cos(TA) * (RT + TR);
      [1, -1].forEach((s) => { rbox(B, 0.36, ty, 0.36, 0.04, FM.dark, s * tx, ty / 2, 1.62, 0.02); rbox(B, 0.6, 0.6, 0.4, 0.06, FM.blueD, s * tx, ty, 1.6, 0.02); cylZ(B, 0.08, 0.5, FM.steel, s * tx, ty, 1.35, 8); });
      rbox(B, 3.6, 0.3, 0.8, 0.05, FM.dark, 0, 0.15, 1.65, 0.02);
      cylX(B, 0.34, 1.3, FM.blue, 0, 1.0, 1.65, 18); for (let i = -2; i <= 2; i++) cylX(B, 0.37, 0.04, FM.blueD, i * 0.2, 1.0, 1.65, 18);
      cylX(B, 0.07, 2 * tx - 0.6, FM.steel, 0, 1.0, 1.65, 8); [1, -1].forEach((s) => rod(B, V(s * (tx - 0.3), 1.0, 1.65), V(s * tx, ty - 0.3, 1.65), 0.07, FM.steel, 8));
      rbox(B, 0.5, 0.7, 0.4, 0.05, FM.yel, -2.8, 0.95, 1.75, 0.02); // control box
      bake(B);
      const tyres = [1, -1].map((s) => tire(S, TR, 0.3, s * tx, ty, 1.2, FM.yel, 1));
      // the wheel itself
      const W = grp(S, 0, H, 0); st.m = W; const D = grp(W);
      cylZ(D, 0.6, 2.4, FM.red, 0, 0, 0, 20); [1.05, -1.05].forEach((z) => cylZ(D, 1.0, 0.12, FM.white, 0, 0, z, 24));
      const TOR = new THREE.TorusGeometry(R, 0.12, 6, 96), TORI = new THREE.TorusGeometry(R - 1.1, 0.07, 6, 80);
      [0.85, -0.85].forEach((z) => { add(D, TOR, FM.white, 0, 0, z); add(D, TORI, FM.red, 0, 0, z); });
      add(D, new THREE.TorusGeometry(R, 0.13, 6, 96), FM.steel, 0, 0, 1.2); // drive ring
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU, c = Math.cos(a), s = Math.sin(a);
        [1, -1].forEach((zs) => { rod(D, V(0.9 * c, 0.9 * s, zs * 1.05), V(R * c, R * s, zs * 0.85), 0.045, FM.white, 6); const b = (i + 0.5) / 24 * TAU; rod(D, V((R - 1.1) * c, (R - 1.1) * s, zs * 0.85), V(R * Math.cos(b), R * Math.sin(b), zs * 0.85), 0.035, FM.red, 5); });
        if (i % 2 === 0) rod(D, V(R * c, R * s, 0.85), V(R * c, R * s, 1.2), 0.04, FM.steel, 5);
      }
      for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + (i / N) * TAU; cylZ(D, 0.07, 1.9, FM.steel, R * Math.cos(a), R * Math.sin(a), 0, 8); }
      bake(D);
      const bp = []; [0.95, -0.95].forEach((z) => { for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU; bp.push([(R + 0.05) * Math.cos(a), (R + 0.05) * Math.sin(a), z]); } });
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; for (let k = 1; k <= 4; k++) bp.push([(1 + k * 1.6) * Math.cos(a), (1 + k * 1.6) * Math.sin(a), 1.1]); }
      bulbs(W, bp, 0.09, BCOL, BM2);
      // the gondolas: they hang on a pivot and stay level
      const cols = [FM.red, FM.yel, FM.blue, FM.mint, FM.pink, FM.purple];
      const gond = [], riders = [];
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (i / N) * TAU, pv = grp(W, R * Math.cos(a), R * Math.sin(a), 0), c = grp(pv), cm = cols[i % cols.length];
        const cb = grp(c);
        [0.62, -0.62].forEach((z) => rod(cb, V(0, 0, z), V(0, -0.45, z * 0.9), 0.04, FM.dark, 6));
        rbox(cb, 1.5, 0.18, 1.45, 0.08, cm, 0, -0.5, 0, 0.03); egg(cb, 0.72, 0.2, 0.7, cm, 0, -0.42, 0); ball(cb, 0.09, FM.gold, 0, -0.2, 0);
        [[0.64, 0.64], [0.64, -0.64], [-0.64, 0.64], [-0.64, -0.64]].forEach(([x, z]) => box(cb, 0.06, 0.8, 0.06, FM.gold, x, -1.0, z));
        rbox(cb, 1.4, 0.1, 1.4, 0.04, FM.dark, 0, -1.92, 0, 0.02);
        rbox(cb, 1.36, 0.6, 0.06, 0.03, cm, 0, -1.6, 0.66, 0.01); rbox(cb, 1.36, 0.6, 0.06, 0.03, cm, 0, -1.6, -0.66, 0.01);
        rbox(cb, 0.06, 0.6, 1.36, 0.03, cm, 0.66, -1.6, 0, 0.01); rbox(cb, 0.06, 0.6, 0.6, 0.03, cm, -0.66, -1.6, 0.38, 0.01);
        rbox(cb, 1.38, 0.06, 0.08, 0.02, FM.white, 0, -1.28, 0.67, 0.01); rbox(cb, 1.38, 0.06, 0.08, 0.02, FM.white, 0, -1.28, -0.67, 0.01);
        [0.4, -0.4].forEach((x) => rbox(cb, 0.35, 0.3, 1.2, 0.04, FM.woodD, x, -1.72, 0, 0.01));
        bake(cb);
        const r = [sitter(c, -0.42, -1.58, 0.25, { s: 0.75 }), sitter(c, -0.42, -1.58, -0.25, { s: 0.75 })]; if (i % 3 !== 1) r.forEach((x) => (x.visible = false)); riders.push(r);
        gond.push(pv);
      }
      const fam = [walker(S, -6.5, -0.5, { kid: true }), walker(S, -7.3, -0.2, {})]; fam.forEach((f) => (f.rotation.y = 0));
      part(st, 'moteur', 'le moteur', anchor(B, 0, 1.4, 2.1), true);
      part(st, 'pneus', 'les pneus', anchor(S, tx, ty, 1.4), false);
      part(st, 'nacelles', 'les nacelles', anchor(S, R * Math.cos(-0.5), H + R * Math.sin(-0.5) - 1.2, 0.8), true);
      part(st, 'axe', "l'axe", anchor(S, 0, H, 1.8), false);
      st.focus = V(0, 9, 0); st.size = { w: 22, h: 21 }; st.tagAt = anchor(S, 0, H + R + 1.5, 0);
      st.update = () => { const a = W.rotation.z; gond.forEach((g) => (g.rotation.z = -a)); tyres.forEach((t) => (t.rotation.z = -a * (RT / TR))); };
      st.action = async function () {
        if (st.done) { fam.forEach((f, i) => { f.visible = true; f.position.set(-6.5 - i * 0.8, 0, -0.5 + i * 0.3); }); riders[0].forEach((x) => (x.visible = false)); st.done = false; }
        riders[0].forEach((x) => (x.visible = false));
        await Promise.all([step('Une famille monte dans la nacelle, en bas.', 'nacelles'),
          tw(2.6, (k) => fam.forEach((f, i) => { const x = -6.5 - i * 0.8 + (5.6 + i * 0.8) * k; f.position.x = x; f.position.y = x < -4.4 ? 0 : Math.min(0.6, (x + 4.4) * 0.5); f.userData.walk(k * 30); }), lin)]);
        fam.forEach((f) => (f.visible = false)); riders[0].forEach((x) => pop(x, 0.4));
        engineOn(40);
        const turn = tw(22, (k) => (W.rotation.z = -TAU * k), easeIO);
        await Promise.all([step('Le moteur démarre. Il fait tourner deux roues avec des pneus.', 'moteur'), sleep(3)]);
        await Promise.all([step('Les pneus frottent sur la roue et la poussent : toute la grande roue tourne !', 'pneus'), sleep(4)]);
        await Promise.all([step('Les nacelles pendent comme des balançoires : elles restent toujours bien droites.', 'nacelles'), sleep(5)]);
        await Promise.all([step('Tout en haut, on voit toute la fête foraine !', 'axe'), sleep(3)]);
        await Promise.all([step('Le moteur ralentit, et la roue s’arrête tout doucement.', 'moteur'), turn]);
        W.rotation.z = 0; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le carrousel ---- */
    (function () {
      const st = makeStation('carrousel'), S = st.g, RP = 4.6;
      const B = grp(S);
      cylY(B, RP + 0.55, 0.22, FM.cream, 0, 0.11, 0, 48); cylY(B, RP + 0.3, 0.14, FM.redD, 0, 0.29, 0, 48);
      for (let i = 0; i < 3; i++) rbox(B, 1.4, 0.11, 0.5, 0.03, FM.cream, 0, 0.055, RP + 0.75 + i * 0.01, 0.01);
      cylY(B, 0.26, 5.4, FM.gold, 0, 3.0, 0, 16); cylY(B, 1.28, 0.5, FM.dark, 0, 0.35, 0, 24); cylY(B, 1.3, 0.06, FM.gold, 0, 0.6, 0, 24);
      // the motor on the fixed centre, its pinion meshing with the ring gear of the platform
      rbox(B, 0.5, 0.2, 0.5, 0.04, FM.dark, 0.9, 0.7, 0.45, 0.02); cylY(B, 0.24, 0.55, FM.blue, 0.9, 1.08, 0.45, 18);
      for (let i = 0; i < 4; i++) cylY(B, 0.26, 0.04, FM.blueD, 0.9, 0.88 + i * 0.12, 0.45, 18); cylY(B, 0.04, 0.4, FM.steel, 0.9, 0.62, 0.45, 8);
      rbox(B, 0.4, 0.5, 0.3, 0.04, FM.yel, -0.6, 0.85, -0.7, 0.02);
      gear(B, 1.1, 24, 0.14, FM.gold, 0, 3.55, 0, true); // the crown gear for the cranks
      bake(B);
      const pin = gear(S, 0.3, 9, 0.2, FM.steel, 0.9, 0.72, 0.45, true); const PIN = Math.hypot(0.9, 0.45);
      // turning part: platform, ring gear, mirrors drum, canopy
      const ROT = grp(S); st.m = ROT; const D = grp(ROT);
      { const sh = new THREE.Shape(); sh.absarc(0, 0, RP, 0, TAU, false); const ho = new THREE.Path(); ho.absarc(0, 0, 1.4, 0, TAU, true); sh.holes.push(ho);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: false, curveSegments: 48 }); g.rotateX(-Math.PI / 2); add(D, g, FM.wood, 0, 0.36, 0); }
      add(D, new THREE.CylinderGeometry(RP + 0.02, RP + 0.02, 0.26, 48, 1, true), FM.red, 0, 0.48, 0);
      { const sh = new THREE.Shape(); sh.absarc(0, 0, 1.62, 0, TAU, false); sh.holes.push(new THREE.Path(gearShape(1.52, 1.4, 46).getPoints()));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 40 }); g.rotateX(-Math.PI / 2); add(D, g, FM.gold, 0, 0.62, 0); }
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; box(D, 0.05, 0.02, RP - 1.5, FM.woodD, 0, 0.61, 0).position.set(Math.sin(a) * (RP + 1.4) / 2, 0.61, Math.cos(a) * (RP + 1.4) / 2); D.children[D.children.length - 1].rotation.y = a; }
      const drum = add(D, new THREE.CylinderGeometry(1.3, 1.3, 1.9, 24, 1, true), FM.purple, 0, 2.85, 0); drum.material = FM.purple;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, m = rbox(D, 0.36, 0.7, 0.04, 0.05, i % 2 ? FM.mirror : FM.gold, 1.31 * Math.sin(a), 2.85, 1.31 * Math.cos(a), 0.01); m.rotation.y = a; }
      cylY(D, 1.36, 0.12, FM.gold, 0, 1.92, 0, 24); cylY(D, 1.36, 0.12, FM.gold, 0, 3.8, 0, 24);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; rod(D, V(0.5 * Math.sin(a), 3.95, 0.5 * Math.cos(a)), V(RP * Math.sin(a), 3.95, RP * Math.cos(a)), 0.06, FM.woodD, 6); }
      add(D, new THREE.CircleGeometry(RP, 40), FM.cream, 0, 3.86, 0).rotation.x = Math.PI / 2;
      add(D, new THREE.CylinderGeometry(RP, RP, 0.55, 48, 1, true), FM.red, 0, 4.13, 0);
      cylY(D, RP + 0.05, 0.08, FM.gold, 0, 4.42, 0, 48); cylY(D, RP + 0.05, 0.08, FM.gold, 0, 3.85, 0, 48);
      add(D, new THREE.ConeGeometry(RP + 0.25, 1.8, 32, 1, true), FM.coneR, 0, 5.36, 0);
      cylY(D, 0.35, 0.5, FM.gold, 0, 6.4, 0, 12); ball(D, 0.28, FM.gold, 0, 6.8, 0); rod(D, V(0, 6.9, 0), V(0, 7.8, 0), 0.03, FM.dark, 4); box(D, 0.6, 0.35, 0.02, FM.red, 0.3, 7.6, 0);
      scallopsRing(D, RP + 0.01, 3.86, 40, [FM.scalY, FM.scalW]);
      const rimB = []; ringPts(RP + 0.06, 4.13, 48).forEach((p) => rimB.push(p)); ringPts(1.38, 3.6, 16).forEach((p) => rimB.push(p)); ringPts(1.38, 2.1, 16).forEach((p) => rimB.push(p));
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; for (let k = 1; k <= 3; k++) { const r = (RP + 0.25) * (1 - k / 4.2); rimB.push([r * Math.sin(a), 4.5 + (1.8 * k) / 4.2, r * Math.cos(a)]); } }
      bulbs(ROT, rimB, 0.075, BCOL, BM2);
      // horses: outer ring and inner ring, each on its pole, with a crank on top
      const horses = [];
      const coats = [FM.white, FM.cream, FM.white, std(0x9a6a44, 0.6, 0), FM.white, FM.cream, std(0x3a3236, 0.6, 0), FM.white];
      const saddles = [FM.red, FM.blue, FM.pink, FM.mint, FM.purple, FM.yel];
      const ring = (n, r, a0, ph) => { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; horses.push({ a, r, ph: ph + (i % 2) * Math.PI }); } };
      ring(8, 3.6, 0, 0); ring(6, 2.45, Math.PI / 6, Math.PI / 2);
      horses.forEach((h, i) => {
        const g = grp(ROT, h.r * Math.sin(h.a), 0, h.r * Math.cos(h.a)); g.rotation.y = h.a + Math.PI / 2; // facing the way it turns
        const coat = coats[i % coats.length], sad = saddles[i % saddles.length], mane = i % 3 ? FM.yel : FM.woodD;
        const d = grp(g);
        cylY(d, 0.05, 3.9, FM.gold, 0, 1.6, 0, 8); [0.9, 2.6].forEach((y) => cylY(d, 0.075, 0.08, FM.gold, 0, y, 0, 10));
        egg(d, 0.62, 0.3, 0.26, coat, 0, 1.45, 0); ball(d, 0.28, coat, 0.38, 1.52, 0).scale.set(0.3, 0.3, 0.25);
        rod(d, V(0.45, 1.55, 0), V(0.72, 2.05, 0), 0.13, coat, 10);
        const hd = rbox(d, 0.44, 0.2, 0.19, 0.08, coat, 0.88, 2.02, 0, 0.03); hd.rotation.z = -0.55;
        [0.06, -0.06].forEach((z) => { box(d, 0.06, 0.14, 0.04, coat, 0.72, 2.24, z); ball(d, 0.025, MT.black, 0.86, 2.1, z * 1.7); });
        for (let k = 0; k < 5; k++) box(d, 0.1, 0.12, 0.06, mane, 0.5 + k * 0.05, 1.7 + k * 0.1, 0).rotation.z = -0.6;
        [0.11, -0.11].forEach((z) => { rod(d, V(0.38, 1.3, z), V(0.62, 1.08, z), 0.06, coat, 6); rod(d, V(0.62, 1.08, z), V(0.52, 0.86, z), 0.05, coat, 6); ball(d, 0.06, FM.gold, 0.52, 0.84, z);
          rod(d, V(-0.38, 1.3, z), V(-0.62, 0.98, z), 0.065, coat, 6); rod(d, V(-0.62, 0.98, z), V(-0.5, 0.74, z), 0.05, coat, 6); ball(d, 0.06, FM.gold, -0.5, 0.72, z); });
        rod(d, V(-0.6, 1.55, 0), V(-0.95, 1.05, 0), 0.07, mane, 6);
        rbox(d, 0.5, 0.05, 0.58, 0.04, FM.gold, -0.02, 1.73, 0, 0.01); rbox(d, 0.38, 0.12, 0.5, 0.05, sad, -0.02, 1.8, 0, 0.02); rbox(d, 0.08, 0.16, 0.4, 0.03, sad, -0.2, 1.86, 0, 0.01);
        [0.29, -0.29].forEach((z) => { rod(d, V(0, 1.75, z), V(0, 1.32, z), 0.012, FM.dark, 4); box(d, 0.12, 0.03, 0.08, FM.gold, 0, 1.3, z); });
        rod(d, V(0.98, 1.98, 0.08), V(0.25, 1.82, 0.08), 0.012, FM.gold, 4); rod(d, V(0.98, 1.98, -0.08), V(0.25, 1.82, -0.08), 0.012, FM.gold, 4);
        bake(d);
        if (i === 0 || i === 3 || i === 9 || i === 5) sitter(g, -0.08, 1.82, 0, { s: 0.7 });
        // crank on the radial shaft, just under the canopy
        const cg = grp(ROT, h.r * Math.sin(h.a), 3.62, h.r * Math.cos(h.a)); cg.rotation.y = h.a - Math.PI / 2;
        const ck = grp(cg); cylX(ck, 0.26, 0.06, FM.gold, 0.1, 0, 0, 16); cylX(ck, 0.04, 0.16, FM.dark, 0.1, 0.2, 0, 6);
        h.g = g; h.ck = ck;
        rod(D, V(1.15 * Math.sin(h.a), 3.62, 1.15 * Math.cos(h.a)), V(h.r * Math.sin(h.a), 3.62, h.r * Math.cos(h.a)), 0.035, FM.steel, 6);
        gear(D, 0.16, 8, 0.06, FM.steel, 1.2 * Math.sin(h.a), 3.62, 1.2 * Math.cos(h.a)).rotation.y = h.a + Math.PI / 2;
      });
      bake(D);
      // a family watching
      [[-2.5, 6.0, 0], [-1.7, 6.2, 0], [5.2, 3.6, 1]].forEach(([x, z, k]) => { const p = walker(S, x, z, k ? { kid: true } : {}); p.rotation.y = Math.PI / 2 + 0.3; });
      part(st, 'moteur', 'le moteur', anchor(S, 0.9, 1.4, 0.45), true);
      part(st, 'engrenages', 'la roue dentée', anchor(S, 0.4, 0.75, 1.5), false);
      part(st, 'manivelles', 'les manivelles', anchor(S, 0, 3.6, 3.6), false);
      part(st, 'chevaux', 'les chevaux', anchor(S, 2.5, 2.2, 2.5), true);
      st.focus = V(0, 3.2, 0); st.size = { w: 12, h: 9 }; st.tagAt = anchor(S, 0, 8.2, 0);
      st.w = 0; let nt = 0, ni = 0; const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 587];
      st.update = (dt) => {
        ROT.rotation.y += st.w * dt; const a = ROT.rotation.y;
        pin.rotation.y = a * (1.46 / 0.3);
        horses.forEach((h) => { const ph = a * 3 + h.ph; h.g.position.y = 0.28 * Math.sin(ph); h.ck.rotation.x = ph; });
        if (st.music) { nt -= dt; if (nt <= 0) { nt = 0.32; tone(TUNE[ni++ % TUNE.length], 0, 0.28, 'triangle', 0.025); } }
      };
      st.action = async function () {
        engineOn(38);
        await Promise.all([step('Au milieu du manège, le moteur se met en marche.', 'moteur'), tw(2, (k) => (st.w = 0.12 * k))]);
        await Promise.all([step('Son petit engrenage fait tourner la grande roue dentée… et tout le plancher tourne !', 'engrenages'), tw(4, (k) => (st.w = 0.12 + 0.43 * k))]);
        st.music = true;
        await Promise.all([step('En haut, des manivelles tournent : elles font monter et descendre les chevaux.', 'manivelles'), sleep(4)]);
        await Promise.all([step('Les miroirs brillent, les lumières clignotent. Au galop, petits chevaux !', 'chevaux'), sleep(4)]);
        await Promise.all([step('Le moteur ralentit, et le manège s’arrête tout doucement.', 'moteur'), tw(4.5, (k) => (st.w = 0.55 * (1 - k)), easeSine)]);
        st.w = 0; st.music = false; engineOff(); chime();
      };
    })();

    /* ---- les autos tamponneuses ---- */
    (function () {
      const st = makeStation('autos'), S = st.g, LX = 6.5, LZ = 4.0, RH = 4.45;
      const B = grp(S);
      rbox(B, 2 * LX + 1.4, 0.3, 2 * LZ + 1.4, 0.06, FM.dark, 0, 0.15, 0, 0.02); rbox(B, 2 * LX, 0.06, 2 * LZ, 0.02, FM.plate, 0, 0.32, 0, 0.01);
      for (let x = -LX + 1; x < LX; x += 1) box(B, 0.03, 0.02, 2 * LZ, FM.dark, x, 0.35, 0); for (let z = -LZ + 1; z < LZ; z += 1) box(B, 2 * LX, 0.02, 0.03, FM.dark, 0, 0.35, z);
      [[0, LZ + 0.12, 2 * LX + 0.5, 0.25], [0, -LZ - 0.12, 2 * LX + 0.5, 0.25]].forEach(([x, z, w, d]) => { rbox(B, w, 0.36, d, 0.1, MT.rubberS, x, 0.5, z, 0.03); rbox(B, w, 0.08, d + 0.04, 0.03, FM.yel, x, 0.72, z, 0.01); });
      [LX + 0.12, -LX - 0.12].forEach((x) => { rbox(B, 0.25, 0.36, 2 * LZ, 0.1, MT.rubberS, x, 0.5, 0, 0.03); rbox(B, 0.29, 0.08, 2 * LZ, 0.03, FM.yel, x, 0.72, 0, 0.01); });
      // posts, roof frame, the electric net under it, the friezes with the sign
      [[-LX - 0.45, -LZ - 0.45], [LX + 0.45, -LZ - 0.45], [-LX - 0.45, LZ + 0.45], [LX + 0.45, LZ + 0.45], [0, -LZ - 0.45], [0, LZ + 0.45]].forEach(([x, z]) => { cylY(B, 0.14, RH + 0.4, FM.steel, x, (RH + 0.4) / 2 + 0.3, z, 10); cylY(B, 0.22, 0.2, FM.gold, x, 0.4, z, 10); });
      [LZ + 0.45, -LZ - 0.45].forEach((z) => { rbox(B, 2 * LX + 1.2, 0.25, 0.2, 0.04, FM.red, 0, RH + 0.1, z, 0.02); rbox(B, 2 * LX + 1.2, 0.9, 0.12, 0.06, FM.yel, 0, RH + 0.75, z, 0.02); scallopsLine(B, -LX - 0.6, LX + 0.6, RH - 0.02, z + Math.sign(z) * 0.07, 30, [FM.scalR, FM.scalW], z > 0 ? 0 : Math.PI); });
      [LX + 0.45, -LX - 0.45].forEach((x) => { rbox(B, 0.2, 0.25, 2 * LZ + 1.1, 0.04, FM.red, x, RH + 0.1, 0, 0.02); rbox(B, 0.12, 0.9, 2 * LZ + 1.1, 0.06, FM.yel, x, RH + 0.75, 0, 0.02); });
      sign(B, 'AUTOS TAMPONNEUSES', 7.4, 0.62, '#e0383a', '#fff6d8', 0, RH + 0.75, LZ + 0.56);
      const NB = grp(B);
      for (let x = -LX; x <= LX + 0.01; x += 0.5) box(NB, 0.03, 0.03, 2 * LZ + 0.8, FM.net, x, RH, 0);
      for (let z = -LZ - 0.4; z <= LZ + 0.41; z += 0.5) box(NB, 2 * LX + 0.8, 0.03, 0.03, FM.net, 0, RH + 0.03, z);
      // the cash desk at the back corner
      { const k = grp(B, -LX - 1.6, 0, -LZ + 0.6); rbox(k, 1.5, 2.2, 1.4, 0.1, FM.blue, 0, 1.1, 0, 0.02); rbox(k, 1.2, 0.7, 0.04, 0.05, FM.glassD, 0, 1.5, 0.71, 0.01); rbox(k, 1.7, 0.2, 1.6, 0.06, FM.yel, 0, 2.3, 0, 0.02); add(k, HALF, FM.red, 0, 2.4, 0).scale.set(0.8, 0.5, 0.75); }
      // steps at the front
      [-3, 3].forEach((x) => rbox(B, 1.6, 0.16, 0.5, 0.03, FM.cream, x, 0.08, LZ + 0.95, 0.01));
      bake(B);
      const sb = []; [LZ + 0.53, -LZ - 0.53].forEach((z) => { for (let i = 0; i < 26; i++) sb.push([-LX - 0.4 + (i + 0.5) * ((2 * LX + 0.8) / 26), RH + 1.25, z]); });
      bulbs(S, sb, 0.09, BCOL, BM2);
      const kp = walker(S, -LX - 1.6, -LZ + 1.6, {}); kp.rotation.y = -Math.PI / 2; kp.visible = true;
      // the cars
      const colors = [FM.red, FM.blue, FM.yel, FM.mint];
      const cars = colors.map((col, i) => {
        const g = grp(S), d = grp(g);
        add(d, new THREE.TorusGeometry(1, 0.14, 8, 32), MT.rubberS, 0, 0.3, 0).scale.set(1.08, 0.72, 1); d.children[d.children.length - 1].rotation.x = Math.PI / 2;
        d.children[d.children.length - 1].scale.set(1.08, 0.72, 1);
        rbox(d, 2.0, 0.18, 1.36, 0.55, FM.dark, 0, 0.27, 0, 0.03);
        ext(d, [[-0.95, 0.32], [0.88, 0.32], [1.02, 0.5], [0.8, 0.72], [0.25, 0.72], [-0.5, 0.86], [-0.98, 1.08]], [0.05, 0.12, 0.15, 0.1, 0.1, 0.12, 0.1], 1.24, col, 0, 0, 0, 0.04);
        rbox(d, 1.4, 0.05, 1.27, 0.03, FM.gold, 0.1, 0.5, 0, 0.01);
        rbox(d, 0.14, 0.55, 1.0, 0.06, MT.black, -0.62, 1.1, 0, 0.02); rbox(d, 0.5, 0.12, 0.9, 0.05, MT.black, -0.35, 0.92, 0, 0.02);
        rod(d, V(0.55, 0.72, 0), V(0.3, 1.05, 0), 0.03, FM.dark, 6); const swh = add(d, new THREE.TorusGeometry(0.16, 0.03, 6, 16), FM.dark, 0.28, 1.08, 0); swh.rotation.y = Math.PI / 2; swh.rotation.x = 0.5;
        [0.4, -0.4].forEach((z) => ball(d, 0.07, FM.lamp, 0.98, 0.56, z));
        rod(d, V(-0.88, 1.0, 0), V(-0.88, RH - 0.1, 0), 0.03, FM.steel, 6); for (let k = 0; k < 5; k++) cylY(d, 0.06, 0.03, FM.dark, -0.88, 1.3 + k * 0.06, 0, 8);
        box(d, 0.08, 0.06, 0.3, FM.gold, -0.88, RH - 0.06, 0); box(d, 0.02, 0.4, 0.02, MT.chrome, -0.88, RH - 0.25, 0.08); ball(d, 0.06, FM.red, -0.88, 1.08, 0);
        bake(d);
        sitter(g, -0.35, 0.9, 0, { s: 0.8 });
        return g;
      });
      const loop = route([[-4.9, -1.4], [-3.6, -2.75], [3.6, -2.75], [4.9, -1.4], [4.9, 1.4], [3.6, 2.75], [-3.6, 2.75], [-4.9, 1.4]], true, 0.45);
      const LL = loop.len, dirs = [1, -1, 1, -1];
      const sim = cars.map((c, i) => ({ s: (LL / 4) * i + 1.0, v: 0, d: dirs[i], wob: 0 }));
      st.m = cars[0];
      part(st, 'filet', 'le filet électrique', anchor(S, 2.5, RH + 0.05, 2.6), true);
      part(st, 'perche', 'la perche', anchor(cars[0], -0.88, 2.6, 0), false);
      part(st, 'boudin', 'le boudin en caoutchouc', anchor(cars[1], 0.8, 0.35, 0.6), true);
      part(st, 'pilote', 'le pilote', anchor(cars[2], -0.3, 1.6, 0), false);
      st.focus = V(0, 2.2, 0); st.size = { w: 16, h: 9 }; st.tagAt = anchor(S, 0, RH + 2.0, 0);
      const wrap = (x) => ((x % LL) + LL + LL / 2) % LL - LL / 2;
      st.update = (dt) => {
        sim.forEach((c) => { const target = st.on ? c.d * 2.4 : 0; c.v += (target - c.v) * Math.min(1, dt * (st.on ? 1.1 : 2.2)); c.s += c.v * dt; c.wob *= Math.exp(-dt * 4); });
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
          const a = sim[i], b = sim[j], gap = wrap(b.s - a.s);
          if (Math.abs(gap) < 2.15 && (a.v - b.v) * Math.sign(gap) > 0.2) { const va = a.v; a.v = b.v * 0.85; b.v = va * 0.85; a.wob = rnd(-0.5, 0.5); b.wob = rnd(-0.5, 0.5); thud(); const p = cars[i].position.clone().lerp(cars[j].position, 0.5); S.localToWorld(p); for (let k = 0; k < 4; k++) fx.fire(p.clone().add(V(0, 0.7, 0)), V(rnd(-1, 1), 1, rnd(-1, 1)).normalize(), 2, 0.6, 0.12); }
          if (Math.abs(gap) < 2.1) { const push = (2.1 - Math.abs(gap)) / 2 * Math.sign(gap); a.s -= push; b.s += push; }
        }
        sim.forEach((c, i) => { placeOn(cars[i], loop, c.s); cars[i].rotation.y += (c.d < 0 ? Math.PI : 0) + c.wob * 0.5;
          if (st.on && Math.random() < 0.04) fx.fire(cars[i].localToWorld(V(-0.88, RH - 0.05, 0)), V(0, -1, 0), 1.5, 0.8, 0.08); });
      };
      st.action = async function () {
        await Promise.all([step('Le plafond est un grand filet de métal. On allume : l’électricité passe dedans.', 'filet'), tw(2.5, (k) => (FM.net.emissiveIntensity = Math.sin(k * Math.PI) * 0.9), lin)]);
        await Promise.all([step('La perche de chaque auto touche le filet. L’électricité descend jusqu’au moteur.', 'perche'),
          tw(2.5, (k) => { if (Math.random() < 0.25) cars.forEach((c) => fx.fire(c.localToWorld(V(-0.88, RH - 0.05, 0)), V(0, -1, 0), 1.5, 0.8, 0.1)); }, lin)]);
        st.on = true; engineOn(70);
        await Promise.all([step('Le pilote appuie sur la pédale : les autos roulent !', 'pilote'), sleep(3.5)]);
        await Promise.all([step('Boum ! Elles se tamponnent… et le gros boudin en caoutchouc les fait rebondir tout doucement.', 'boudin'), sleep(7)]);
        st.on = false; engineOff();
        await Promise.all([step('Fin du tour : on coupe le courant, et les autos s’arrêtent.', 'filet'), sleep(2)]);
        chime();
      };
    })();

    /* ---- la chenille ---- */
    (function () {
      const st = makeStation('chenille'), S = st.g, R = 4.7, NC = 9;
      const yAt = (a) => 0.95 + 0.42 * Math.sin(3 * a);
      const B = grp(S);
      // the bumpy round track: two rails, ties and posts
      [R - 0.42, R + 0.42].forEach((r) => { const pts = []; for (let i = 0; i < 120; i++) { const a = (i / 120) * TAU; pts.push(V(r * Math.sin(a), yAt(a) - 0.32, r * Math.cos(a))); } add(B, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.06, 6, true), FM.steel); });
      for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, y = yAt(a) - 0.4; const t = rbox(B, 0.12, 0.08, 1.05, 0.02, FM.dark, R * Math.sin(a), y, R * Math.cos(a), 0.01); t.rotation.y = a;
        if (i % 2 === 0) [R - 0.42, R + 0.42].forEach((r) => cylY(B, 0.06, y, FM.yel, r * Math.sin(a), y / 2, r * Math.cos(a), 6)); }
      // centre: fixed drum, motor and pinion on top
      cylY(B, 1.25, 1.9, FM.greenD, 0, 0.95, 0, 24); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, m = rbox(B, 0.5, 1.2, 0.05, 0.06, i % 2 ? FM.yel : FM.mirror, 1.27 * Math.sin(a), 0.95, 1.27 * Math.cos(a), 0.01); m.rotation.y = a; }
      cylY(B, 1.32, 0.12, FM.gold, 0, 1.9, 0, 24); cylY(B, 0.22, 4.4, FM.gold, 0, 2.2, 0, 12);
      rbox(B, 0.5, 0.35, 0.5, 0.04, FM.dark, 0.85, 2.25, 0.5, 0.02); cylY(B, 0.22, 0.5, FM.blue, 0.85, 2.65, 0.5, 16); cylY(B, 0.04, 0.4, FM.steel, 0.85, 2.15, 0.5, 6);
      add(B, new THREE.ConeGeometry(1.9, 1.1, 24, 1, true), FM.coneP, 0, 4.7, 0); cylY(B, 1.9, 0.2, FM.yel, 0, 4.15, 0, 24); scallopsRing(B, 1.9, 4.05, 20, [FM.scalY, FM.scalW]); ball(B, 0.22, FM.gold, 0, 5.35, 0);
      // the deck around, with a railing and a gap for the steps
      const deck = new THREE.RingGeometry(R + 1.0, R + 2.0, 40, 1, -Math.PI / 2 + 0.5, TAU - 1.0); deck.rotateX(-Math.PI / 2); add(B, deck, FM.wood, 0, 0.45, 0).material = FM.wood;
      add(B, new THREE.CylinderGeometry(R + 2.0, R + 2.0, 0.45, 40, 1, true, 0.5, TAU - 1.0), FM.greenD, 0, 0.225, 0);
      for (let i = 0; i <= 24; i++) { const a = 0.5 + (i / 24) * (TAU - 1.0); cylY(B, 0.035, 0.8, FM.gold, (R + 1.95) * Math.sin(a), 0.85, (R + 1.95) * Math.cos(a), 6); }
      add(B, new THREE.TorusGeometry(R + 1.95, 0.04, 4, 48, TAU - 1.0), FM.gold, 0, 1.25, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.5);
      for (let i = 0; i < 3; i++) rbox(B, 1.0, 0.15 * (i + 1), 0.4, 0.02, FM.wood, 0, 0.075 * (i + 1), R + 2.4 - i * 0.4, 0.01);
      sign(B, 'LA CHENILLE', 2.6, 0.5, '#3fa84a', '#fff6d8', 0, 4.15, 1.95);
      bake(B);
      const bb = []; ringPts(1.92, 4.3, 24).forEach((p) => bb.push(p)); ringPts(R + 1.95, 1.3, 36, 0.5).filter((p, i) => i <= 30).forEach((p) => bb.push(p));
      bulbs(S, bb, 0.08, BCOL, BM2);
      // the turning arms and the cars
      const SW = grp(S); st.m = SW;
      const crown = gear(SW, 0.65, 18, 0.14, FM.gold, 0, 2.3, 0, true);
      const pinion = gear(S, 0.22, 7, 0.14, FM.steel, 0.85, 2.3, 0.5, true); void crown;
      cylY(SW, 0.45, 0.4, FM.yel, 0, 2.0, 0, 16);
      const cars = [], kids = [];
      for (let i = 0; i < NC; i++) {
        const th = (i / NC) * TAU, cg = grp(SW); cg.rotation.y = th;
        const arm = grp(cg, 0, 2.05, 0.4); const ad = grp(arm); rbox(ad, 0.14, 0.14, R - 0.6, 0.03, FM.yel, 0, 0, (R - 0.6) / 2, 0.01); rbox(ad, 0.06, 0.24, R - 1.2, 0.02, FM.gold, 0, -0.12, (R - 0.6) / 2, 0.01); bake(ad);
        const c = grp(cg, 0, 0, R), d = grp(c);
        ext(d, [[-1.3, -0.2], [1.25, -0.2], [1.35, 0.15], [1.2, 0.36], [-1.2, 0.36], [-1.35, 0.15]], 0.08, 1.0, i % 2 ? FM.green : FM.greenD, 0, 0, 0, 0.03);
        rbox(d, 2.5, 0.06, 1.04, 0.03, FM.yel, 0, 0.37, 0, 0.01); rbox(d, 0.14, 0.4, 0.9, 0.04, FM.yel, -1.0, 0.55, 0, 0.02); rbox(d, 0.14, 0.4, 0.9, 0.04, FM.yel, 0.15, 0.55, 0, 0.02);
        rail(d, [[1.0, 0.36, 0.4], [1.0, 0.7, 0.4], [1.0, 0.7, -0.4], [1.0, 0.36, -0.4]], 0.03, FM.gold);
        [[0.9, 0.42], [0.9, -0.42], [-0.9, 0.42], [-0.9, -0.42]].forEach(([x, z]) => cylZ(d, 0.13, 0.08, MT.black, x, -0.2, z, 10));
        if (i === 0) { ball(d, 0.55, FM.green, 1.7, 0.55, 0); [0.2, -0.2].forEach((z) => { ball(d, 0.16, FM.white, 2.12, 0.78, z); ball(d, 0.08, MT.black, 2.24, 0.8, z); ball(d, 0.09, FM.pink, 2.12, 0.45, z * 1.9); rod(d, V(1.8, 1.0, z), V(1.9, 1.55, z * 1.8), 0.025, FM.dark, 4); ball(d, 0.09, FM.pink, 1.9, 1.58, z * 1.8); });
          const sm = add(d, new THREE.TorusGeometry(0.18, 0.03, 6, 12, Math.PI), FM.redD, 2.2, 0.48, 0); sm.rotation.set(Math.PI, Math.PI / 2, 0); sm.rotation.order = 'YXZ'; }
        if (i === NC - 1) add(d, new THREE.ConeGeometry(0.3, 0.7, 12), FM.green, -1.6, 0.35, 0).rotation.z = Math.PI / 2;
        bake(d);
        const hood = grp(c, 0, 0.36, 0.52); const hs = new THREE.CylinderGeometry(0.52, 0.52, 2.5, 18, 1, true, 0, Math.PI); hs.rotateZ(Math.PI / 2); add(hood, hs, FM.hood, 0, 0, -0.52);
        hood.rotation.x = Math.PI / 2;
        const k1 = sitter(c, -0.6, 0.38, 0, { s: 0.72, up: i % 2 === 0 }), k2 = sitter(c, 0.55, 0.38, 0, { s: 0.72 }); k1.visible = k2.visible = false; kids.push(k1, k2);
        cars.push({ th, c, arm, hood });
      }
      part(st, 'moteur', 'le moteur', anchor(S, 0.85, 3.0, 0.5), true);
      part(st, 'bras', 'les grands bras', anchor(cars[1].arm, 0, 0.2, 2.2), false);
      part(st, 'rails', 'les rails à bosses', anchor(S, 0, 0.8, R + 0.5), true);
      part(st, 'bache', 'la bâche', anchor(cars[0].hood, 0, 0.6, -0.3), false);
      st.focus = V(0, 1.8, 0); st.size = { w: 15, h: 9.5 }; st.tagAt = anchor(S, 0, 6.0, 0);
      st.w = 0;
      st.update = (dt) => {
        SW.rotation.y += st.w * dt; const a0 = SW.rotation.y; pinion.rotation.y = -a0 * (0.65 / 0.22);
        cars.forEach((o) => { const a = a0 + o.th, y = yAt(a); o.c.position.y = y; o.c.rotation.z = Math.atan((1.26 * Math.cos(3 * a)) / R); o.arm.rotation.x = -Math.atan2(y + 0.4 - 2.05, R - 0.6); });
      };
      st.action = async function () {
        if (st.done) { kids.forEach((k) => (k.visible = false)); st.done = false; }
        await step('Les enfants s’installent dans les wagons de la chenille.', 'rails'); kids.forEach((k, i) => setTimeout(() => pop(k, 0.4), i * 60));
        engineOn(42);
        await Promise.all([step('Au milieu, le moteur fait tourner une roue dentée… et les grands bras avec elle.', 'moteur'), tw(3, (k) => (st.w = 0.5 * k))]);
        await Promise.all([step('Les bras tirent les wagons sur les rails. Ça monte, ça descend, comme des vagues !', 'bras'), tw(3, (k) => (st.w = 0.5 + 0.35 * k))]);
        await Promise.all([step('Et maintenant, la bâche se ferme : la chenille met sa carapace !', 'bache'), tw(2.5, (k) => cars.forEach((o) => (o.hood.rotation.x = (Math.PI / 2) * (1 - k))), easeSine), sleep(3.5)]);
        await Promise.all([step('La bâche s’ouvre, la chenille ralentit… Coucou les enfants !', 'bache'), tw(2.5, (k) => cars.forEach((o) => (o.hood.rotation.x = (Math.PI / 2) * k)), easeSine), tw(4.5, (k) => (st.w = 0.85 * (1 - k)), easeSine)]);
        st.w = 0; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- les montagnes russes ---- */
    (function () {
      const st = makeStation('montagnes'), S = st.g;
      const P = [[-7, 3, 1.2], [-3, 3, 1.2], [0.5, 3, 1.2], [2.4, 3, 1.5], [6, 3, 4.4], [9.6, 3, 7.4], [11.4, 2.5, 8.3], [12.8, 1.1, 8.5], [13.1, -0.4, 8.4], [12.4, -2.2, 8.2], [10.6, -3.2, 7.6],
        [8.4, -3.3, 5.6], [6.4, -3.3, 2.8], [4.4, -3.3, 1.5], [2.4, -3.3, 1.6], [0.2, -3.3, 3.4], [-1.8, -3.3, 4.1], [-3.8, -3.3, 3.4], [-6, -3.3, 1.6], [-8.6, -2.9, 1.3], [-10.4, -1.4, 1.25], [-10.5, 1, 1.2], [-9.2, 2.7, 1.2]];
      const curve = new THREE.CatmullRomCurve3(P.map(([x, z, y]) => V(x, y, z)), true, 'centripetal');
      const L = curve.getLength(), NS = 480, pts = curve.getSpacedPoints(NS), tan = [], side = [];
      for (let i = 0; i < NS; i++) { const t = curve.getTangentAt(i / NS); tan.push(t); side.push(new V3().crossVectors(t, UP).normalize()); }
      const sAt = (x, z) => { let b = 0, bd = 1e9; for (let i = 0; i < NS; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; b = i; } } return (b / NS) * L; };
      const hAt = (s) => { s = ((s % L) + L) % L; const f = (s / L) * NS, i = Math.floor(f) % NS, k = f - Math.floor(f); return pts[i].y + (pts[(i + 1) % NS].y - pts[i].y) * k; };
      const B = grp(S);
      const off = (dx, dy) => new THREE.CatmullRomCurve3(pts.slice(0, NS).map((p, i) => p.clone().addScaledVector(side[i], dx).add(V(0, dy, 0))), true);
      [0.42, -0.42].forEach((dx) => add(B, new THREE.TubeGeometry(off(dx, 0), NS, 0.07, 6, true), FM.red));
      add(B, new THREE.TubeGeometry(off(0, -0.32), NS, 0.13, 8, true), FM.red);
      const m4 = new THREE.Matrix4(), upv = new V3(), sd = new V3(), tv = new V3();
      const basis = (u, o) => { curve.getPointAt(u, o.position); curve.getTangentAt(u, tv); sd.crossVectors(tv, UP).normalize(); upv.crossVectors(sd, tv); m4.makeBasis(tv, upv, sd); o.quaternion.setFromRotationMatrix(m4); };
      { const n = Math.floor(NS / 4), im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.07, 0.95), FM.dark, n); const o = new THREE.Object3D();
        for (let i = 0; i < n; i++) { basis(i / n, o); o.position.y -= 0.08; o.updateMatrix(); im.setMatrixAt(i, o.matrix); } B.add(im); }
      for (let i = 0; i < NS; i += 13) { const p = pts[i]; if (p.y < 1.0) continue; cylY(B, 0.12, p.y - 0.4, FM.white, p.x, (p.y - 0.4) / 2, p.z, 8); rbox(B, 0.5, 0.15, 0.5, 0.03, FM.concrete, p.x, 0.075, p.z, 0.01); }
      // the lift: chain motor at the bottom; brakes before the station; drive tyres in the station
      const sL0 = sAt(2.4, 3), sCr = sAt(11.4, 2.5), sBr = sAt(-8.6, -2.9), sSt = sAt(0, 3);
      rbox(B, 1.2, 0.7, 0.9, 0.06, FM.blueD, 2.3, 0.35, 1.9, 0.02); cylZ(B, 0.28, 0.6, FM.blue, 2.3, 0.95, 1.9, 14); rod(B, V(2.3, 0.95, 2.2), V(2.4, 1.15, 3.0), 0.05, FM.steel, 6);
      for (let k = 0; k < 9; k++) { const u = ((sBr + 1.5 + k * 0.9) % L) / L; const o = new THREE.Object3D(); basis(u, o); const f = rbox(B, 0.9, 0.22, 0.05, 0.02, FM.red, 0, 0, 0, 0.01); f.position.copy(o.position).add(V(0, -0.12, 0)); f.quaternion.copy(o.quaternion); }
      // station: platform, canopy, sign, stairs
      rbox(B, 8.6, 0.95, 1.6, 0.05, FM.cream, -3.1, 0.475, 4.45, 0.02); rbox(B, 8.6, 0.04, 0.14, 0.01, FM.yel, -3.1, 0.97, 3.72, 0.005);
      for (let i = 0; i < 4; i++) rbox(B, 0.45, 0.24 * (i + 1), 1.4, 0.02, FM.cream, 1.55 + (3 - i) * 0.45, 0.12 * (i + 1), 4.45, 0.01);
      [-7.2, -3.1, 1.0].forEach((x) => { cylY(B, 0.08, 2.8, FM.white, x, 2.35, 5.15, 8); cylY(B, 0.08, 2.8, FM.white, x, 2.35, 3.75, 8); });
      rbox(B, 9.2, 0.12, 2.1, 0.04, FM.stripe, -3.1, 3.8, 4.45, 0.02); rbox(B, 9.2, 0.4, 0.08, 0.03, FM.yel, -3.1, 3.6, 5.5, 0.01);
      scallopsLine(B, -7.7, 1.5, 3.4, 5.55, 22, [FM.scalR, FM.scalW]);
      sign(B, 'MONTAGNES RUSSES', 5.2, 0.6, '#2f6fe0', '#fff6d8', -3.1, 4.4, 5.3);
      rail(B, [[-7.3, 1.0, 5.2], [-7.3, 1.9, 5.2], [1.1, 1.9, 5.2]], 0.03, FM.gold);
      bake(B);
      const chainN = Math.floor((sCr - sL0) / 0.3), chain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), FM.dark, chainN); S.add(chain);
      let chOff = 0; const o3 = new THREE.Object3D();
      const putChain = () => { for (let j = 0; j < chainN; j++) { const s = sL0 + ((j * 0.3 + chOff) % (chainN * 0.3)); basis(s / L, o3); o3.position.addScaledVector(upv, -0.17); o3.updateMatrix(); chain.setMatrixAt(j, o3.matrix); } chain.instanceMatrix.needsUpdate = true; };
      putChain();
      const sprocket = gear(S, 0.3, 10, 0.1, FM.steel, 2.4, 1.15, 3.0);
      const stTyres = [-5.6, -3.6, -1.6, 0.2].map((x) => tire(S, 0.22, 0.12, x, 1.12, 3.0, FM.yel, 1));
      const bulb = []; for (let i = 0; i < NS; i += 6) { const p = pts[i]; bulb.push([p.x + side[i].x * 0.52, p.y + 0.02, p.z + side[i].z * 0.52]); }
      bulbs(S, bulb, 0.07, BCOL, BM);
      // the train: three cars, the kids have their hands up
      const cols = [FM.yel, FM.blue, FM.yel];
      const cars = cols.map((col, i) => {
        const g = grp(S), d = grp(g);
        rbox(d, 1.5, 0.12, 0.92, 0.04, FM.dark, 0, 0.26, 0, 0.02);
        [[0.5, 0.42], [0.5, -0.42], [-0.5, 0.42], [-0.5, -0.42]].forEach(([x, z]) => cylZ(d, 0.11, 0.1, MT.black, x, 0.18, z, 10));
        const prof = i === 0 ? [[-0.75, 0.3], [0.8, 0.3], [1.02, 0.5], [0.92, 0.88], [0.6, 0.98], [0.42, 0.76], [-0.75, 0.76]] : [[-0.75, 0.3], [0.72, 0.3], [0.8, 0.5], [0.6, 0.78], [-0.75, 0.78]];
        ext(d, prof, 0.08, 1.0, col, 0, 0, 0, 0.03); rbox(d, 1.5, 0.06, 1.03, 0.02, FM.red, -0.02, 0.55, 0, 0.01);
        rbox(d, 0.12, 0.55, 0.92, 0.05, MT.black, -0.66, 1.0, 0, 0.02); rail(d, [[0.2, 0.76, 0.45], [0.2, 1.0, 0.45], [0.2, 1.0, -0.45], [0.2, 0.76, -0.45]], 0.03, FM.gold);
        if (i === 0) [0.3, -0.3].forEach((z) => ball(d, 0.07, FM.lamp, 1.0, 0.62, z));
        bake(d);
        [0.24, -0.24].forEach((z) => sitter(g, -0.32, 0.76, z, { s: 0.68, up: true }));
        return g;
      });
      st.m = cars[0];
      const sim = { s: sSt, v: 0, mode: null }; let clk = 0;
      const place = () => cars.forEach((c, k) => basis((((sim.s - k * 1.75) % L) + L) % L / L, c));
      place();
      part(st, 'train', 'le train', anchor(cars[0], 0, 1.5, 0), true);
      part(st, 'chaine', 'la chaîne', anchor(S, 6, 5.0, 3.0), true);
      part(st, 'descente', 'la descente', anchor(S, 7.4, 4.6, -3.3), false);
      part(st, 'freins', 'les freins', anchor(S, -9.6, 1.6, 2.3), false);
      st.focus = V(1.2, 4.2, 0.6); st.size = { w: 27, h: 12 }; st.tagAt = anchor(S, 12.6, 10.5, 0);
      const G = 6;
      st.update = (dt) => {
        const m = sim.mode;
        if (m === 'push') { sim.v += (1.4 - sim.v) * Math.min(1, dt * 2); if (sim.s >= sL0) sim.mode = 'lift'; }
        else if (m === 'lift') { sim.v += (1.8 - sim.v) * Math.min(1, dt * 3); chOff += sim.v * dt; putChain(); sprocket.rotation.z -= sim.v * dt / 0.3; clk -= dt; if (clk <= 0) { clk = 0.22; tone(1400, 0, 0.03, 'square', 0.015); } if (sim.s - 1.75 >= sCr) sim.mode = 'free'; }
        else if (m === 'free') { const sm = sim.s - 1.75, gr = (hAt(sm + 0.4) - hAt(sm - 0.4)) / 0.8; sim.v = Math.max(0.6, sim.v + (-G * gr - 0.04 * sim.v) * dt); if (sim.s >= sBr) sim.mode = 'brake'; }
        else if (m === 'brake') { sim.v += (1.3 - sim.v) * Math.min(1, dt * 3); if (sim.s >= L + sSt - 2.5) sim.mode = 'arrive'; }
        else if (m === 'arrive') { sim.v = Math.max(0.25, Math.min(sim.v, (L + sSt - sim.s) * 0.9)); if (sim.s >= L + sSt) { sim.s = sSt; sim.v = 0; sim.mode = null; } }
        if (m) { sim.s += sim.v * dt; place(); const sp = m === 'push' || m === 'arrive' || m === 'brake' ? sim.v : 0; stTyres.forEach((t) => (t.rotation.z -= (sp * dt) / 0.22)); }
      };
      st.action = async function () {
        engineOn(48); sim.mode = 'push';
        await Promise.all([step('Tout le monde est bien attaché. Des roues avec des pneus poussent le train hors de la gare.', 'train'), until(() => sim.mode !== 'push')]);
        await Promise.all([step('La chaîne attrape le train et le tire tout en haut de la montée. Clic, clic, clic !', 'chaine'), until(() => sim.mode === 'free')]);
        engineOff();
        await Promise.all([step('Tout en haut… et ça descend ! Pas de moteur : le train roule tout seul, grâce à son poids.', 'descente'), until(() => sim.mode === 'brake' || sim.mode === 'arrive' || !sim.mode)]);
        await Promise.all([step('Les freins serrent le train et le ralentissent tout doucement.', 'freins'), until(() => !sim.mode)]);
        await step('Le train rentre en gare. Quel voyage !', 'train');
        chime();
      };
    })();

    /* ---- les chaises volantes ---- */
    (function () {
      const st = makeStation('chaises'), S = st.g, RC = 3.3, LC = 3.0, NS = 16, Y0 = 3.65, Y1 = 6.8;
      const B = grp(S);
      cylY(B, 2.4, 0.35, FM.cream, 0, 0.175, 0, 32); cylY(B, 2.0, 0.08, FM.gold, 0, 0.39, 0, 32);
      // the foot: a drum with a window on the motor and the gears
      add(B, new THREE.CylinderGeometry(1.6, 1.6, 1.6, 28, 1, true, 0.45, TAU - 0.9), FM.blue, 0, 1.2, 0).material = std(0x2f6fe0, 0.4, 0.15, DBL);
      cylY(B, 1.68, 0.14, FM.gold, 0, 2.05, 0, 28); cylY(B, 1.68, 0.1, FM.gold, 0, 0.42, 0, 28);
      for (let i = 0; i < 10; i++) { const a = 0.6 + (i / 9) * (TAU - 1.2), m = rbox(B, 0.4, 0.9, 0.04, 0.06, i % 2 ? FM.mirror : FM.yel, 1.62 * Math.sin(a), 1.2, 1.62 * Math.cos(a), 0.01); m.rotation.y = a; }
      rbox(B, 0.5, 0.2, 0.5, 0.04, FM.dark, 0, 0.5, 0.95, 0.02); cylY(B, 0.26, 0.55, FM.orange, 0, 1.15, 0.95, 16); for (let i = 0; i < 4; i++) cylY(B, 0.28, 0.04, FM.dark, 0, 0.95 + i * 0.13, 0.95, 16);
      // the fence around
      for (let i = 0; i < 30; i++) { const a = 0.3 + (i / 29) * (TAU - 0.6); cylY(B, 0.05, 1.0, FM.white, 6.8 * Math.sin(a), 0.5, 6.8 * Math.cos(a), 6); }
      [0.5, 0.95].forEach((y) => add(B, new THREE.TorusGeometry(6.8, 0.035, 4, 64, TAU - 0.6), FM.red, 0, y, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.3));
      bake(B);
      // the mast turns, the hat slides up and down on it
      const MG = grp(S); st.m = MG;
      const md = grp(MG); cylY(md, 0.36, 9.0, FM.white, 0, 4.9, 0, 16); for (let y = 2.6; y < 9; y += 0.8) cylY(md, 0.38, 0.18, FM.red, 0, y, 0, 16);
      gear(md, 0.62, 18, 0.16, FM.gold, 0, 0.78, 0, true); ball(md, 0.35, FM.gold, 0, 9.5, 0); rod(md, V(0, 9.8, 0), V(0, 10.8, 0), 0.03, FM.dark, 4); box(md, 0.7, 0.4, 0.02, FM.yel, 0.35, 10.55, 0);
      bake(md);
      const pinion = gear(S, 0.26, 8, 0.16, FM.steel, 0, 0.78, 0.92, true);
      const TOP = grp(MG, 0, Y0, 0), td = grp(TOP);
      cylY(td, 0.62, 1.2, FM.red, 0, 0.3, 0, 16); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; rod(td, V(0.5 * Math.sin(a), 0.1, 0.5 * Math.cos(a)), V(RC * Math.sin(a), 0, RC * Math.cos(a)), 0.06, FM.gold, 6); rod(td, V(0.5 * Math.sin(a), 0.9, 0.5 * Math.cos(a)), V(RC * Math.sin(a), 0.3, RC * Math.cos(a)), 0.04, FM.gold, 6); }
      add(td, new THREE.CylinderGeometry(3.75, 3.75, 0.5, 40, 1, true), FM.blue, 0, 0.4, 0); cylY(td, 3.8, 0.07, FM.gold, 0, 0.66, 0, 40); cylY(td, 3.8, 0.07, FM.gold, 0, 0.15, 0, 40);
      add(td, new THREE.ConeGeometry(3.95, 1.5, 32, 1, true), FM.coneB, 0, 1.4, 0); add(td, new THREE.CircleGeometry(3.75, 32), FM.cream, 0, 0.16, 0).rotation.x = Math.PI / 2;
      scallopsRing(td, 3.76, 0.16, 36, [FM.scalY, FM.scalR]);
      bake(td);
      bulbs(TOP, ringPts(3.8, 0.4, 44).concat(ringPts(2.4, 1.0, 20), ringPts(1.2, 1.6, 10)), 0.08, BCOL, BM2);
      const seatCols = [FM.red, FM.yel, FM.mint, FM.pink, FM.blue, FM.purple];
      const swings = [];
      for (let i = 0; i < NS; i++) {
        const a = (i / NS) * TAU, c = grp(TOP, RC * Math.cos(a), 0, -RC * Math.sin(a)); c.rotation.y = a; const w = grp(c), sdg = grp(w);
        [0.24, -0.24].forEach((x) => rod(sdg, V(x * 0.8, 0, 0), V(x, -LC, 0), 0.015, FM.steel, 4));
        rbox(sdg, 0.56, 0.07, 0.5, 0.04, seatCols[i % 6], 0, -LC - 0.03, 0, 0.02); rbox(sdg, 0.56, 0.5, 0.06, 0.04, seatCols[i % 6], 0, -LC + 0.22, 0.24, 0.02);
        rail(sdg, [[0.26, -LC + 0.2, -0.25], [-0.26, -LC + 0.2, -0.25]], 0.02, FM.gold); rail(sdg, [[0.2, -LC - 0.03, -0.25], [0.2, -LC - 0.4, -0.32], [-0.2, -LC - 0.4, -0.32], [-0.2, -LC - 0.03, -0.25]], 0.02, FM.gold);
        bake(sdg);
        const kid = sitter(w, 0, -LC + 0.02, 0.04, { s: 0.72, up: i % 3 === 0 }); kid.rotation.y = Math.PI / 2; kid.visible = false;
        swings.push({ w, kid });
      }
      part(st, 'chaises', 'les chaises', anchor(swings[2].w, 0, -LC + 0.6, 0), true);
      part(st, 'chapeau', 'le chapeau', anchor(TOP, 0, 1.8, 3.2), false);
      part(st, 'moteur', 'le moteur', anchor(S, 0, 1.5, 1.2), true);
      part(st, 'chaines', 'les chaînes', anchor(swings[4].w, 0, -1.4, 0), false);
      st.focus = V(0, 4.2, 0); st.size = { w: 15, h: 11.5 }; st.tagAt = anchor(S, 0, 11.4, 0);
      st.w = 0; let beta = 0;
      st.update = (dt) => {
        MG.rotation.y += st.w * dt; pinion.rotation.y = -MG.rotation.y * (0.62 / 0.26);
        let b = beta; for (let k = 0; k < 4; k++) b = Math.atan((st.w * st.w * (RC + LC * Math.sin(b))) / 9.8);
        beta += (b - beta) * Math.min(1, dt * 1.6); swings.forEach((s) => (s.w.rotation.z = beta));
      };
      st.action = async function () {
        if (st.done) { swings.forEach((s) => (s.kid.visible = false)); st.done = false; }
        await step('Les enfants s’assoient dans les petites chaises. On ferme la barre.', 'chaises');
        swings.forEach((s, i) => { if (i % 4 !== 3) setTimeout(() => pop(s.kid, 0.4), i * 50); });
        engineOn(40);
        await Promise.all([step('Le grand chapeau monte tout en haut du mât.', 'chapeau'), to(TOP.position, 'y', Y1, 4, easeSine)]);
        await Promise.all([step('En bas, le moteur fait tourner le grand mât… de plus en plus vite.', 'moteur'), tw(4, (k) => (st.w = 0.95 * k), easeIn)]);
        await Promise.all([step('Les chaises s’envolent vers l’extérieur ! Plus ça tourne vite, plus elles s’écartent.', 'chaines'), tw(3, (k) => (st.w = 0.95 + 0.5 * k)), sleep(5)]);
        await Promise.all([step('Ça ralentit… les chaises redescendent doucement, et le chapeau aussi.', 'chapeau'), tw(5, (k) => (st.w = 1.45 * (1 - k)), easeSine).then(() => to(TOP.position, 'y', Y0, 3.5, easeSine))]);
        st.w = 0; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le camion du forain et son bateau balançoire ---- */
    (function () {
      const st = makeStation('convoi'), S = st.g, AX0 = 4.0, AX1 = 8.5, X0 = -10;
      const M = grp(S); st.m = M; const wheels = [];
      // trailer
      const td = grp(M);
      [0.55, -0.55].forEach((z) => rbox(td, 12, 0.32, 0.2, 0.03, MT.black, 0, 1.0, z, 0.01));
      rbox(td, 12.1, 0.16, 2.5, 0.04, FM.purpleD, 0, 1.27, 0, 0.02);
      [1, -1].forEach((s) => {
        rbox(td, 12.1, 0.42, 0.06, 0.03, FM.purple, 0, 1.08, s * 1.26, 0.01); rbox(td, 12.1, 0.05, 0.08, 0.02, FM.gold, 0, 1.31, s * 1.27, 0.01); rbox(td, 12.1, 0.05, 0.08, 0.02, FM.gold, 0, 0.87, s * 1.27, 0.01);
        for (let x = -5.5; x <= 5.5; x += 1.1) if (x > -2.9 || x < -5.9) ball(td, 0.07, FM.yel, x, 1.08, s * 1.3);
        [-5.95, 5.95].forEach((x) => rbox(td, 0.06, 0.1, 0.12, 0.02, FM.amber, x, 1.08, s * 1.3, 0.01));
        rbox(td, 0.04, 0.5, 0.5, 0.02, MT.black, -6.0, 0.55, s * 0.95, 0.01); rbox(td, 0.06, 0.14, 0.3, 0.02, FM.tail, -6.08, 1.0, s * 0.85, 0.01);
        rod(td, V(3.4, 1.0, s * 0.85), V(3.4, 0.35, s * 0.85), 0.06, FM.steel, 6); rbox(td, 0.3, 0.06, 0.3, 0.02, FM.steel, 3.4, 0.32, s * 0.85, 0.01);
      });
      rbox(td, 0.12, 0.2, 2.3, 0.04, MT.stripes, -6.08, 0.72, 0, 0.01);
      // the leg hinges, the drive tyres' motor, the folded-arm rests
      [4.4, -4.4].forEach((x) => [1.5, -1.5].forEach((z) => { rbox(td, 0.4, 0.3, 0.3, 0.04, FM.dark, x, 1.45, z, 0.02); }));
      rbox(td, 0.6, 0.3, 0.6, 0.04, FM.blue, 0, 1.5, 0, 0.02); [0.7, -0.7].forEach((x) => { rbox(td, 0.12, 0.3, 0.2, 0.02, FM.dark, x, 1.5, 0.22, 0.01); rbox(td, 0.12, 0.3, 0.2, 0.02, FM.dark, x, 1.5, -0.22, 0.01); });
      bake(td);
      [-3.4, -4.45, -5.5].forEach((x) => [1, -1].forEach((s) => wheels.push(tire(M, 0.5, 0.36, x, 0.5, s * 0.98, FM.chrome, s))));
      // tractor (origin at its fifth wheel, under the king pin)
      const C = grp(M, 4.6, 0, 0), cd = grp(C);
      [0.42, -0.42].forEach((z) => rbox(cd, 5.0, 0.3, 0.16, 0.03, MT.black, 1.3, 0.97, z));
      truckCab(cd, FM.purple, 2.0);
      [1, -1].forEach((s) => { rbox(cd, 0.06, 0.14, 0.24, 0.02, FM.white, 3.0, 2.5, s * 0.6, 0.01); cylX(cd, 0.28, 1.0, FM.chrome, 1.1, 0.9, s * 0.95, 14); rbox(cd, 0.4, 0.5, 0.5, 0.04, FM.dark, 0.3, 0.85, s * 0.9, 0.02); });
      rbox(cd, 2.4, 0.05, 2.05, 0.02, FM.yel, 3.1, 3.1, 0, 0.01); [1.11, -1.11].forEach((z) => rbox(cd, 1.62, 0.14, 0.02, 0.01, FM.yel, 2.8, 1.87, z, 0.005));
      cylY(cd, 0.09, 1.8, FM.chrome, 1.8, 2.4, 0.9, 10); cylY(cd, 0.1, 0.1, MT.black, 1.8, 3.35, 0.9, 10);
      cylY(cd, 0.5, 0.12, FM.dark, 0, 1.2, 0, 16);
      [1, -1].forEach((s) => rbox(cd, 0.06, 0.1, 0.14, 0.02, FM.amber, 3.62, 3.15, s * 0.8, 0.01));
      bake(cd);
      [1, -1].forEach((s) => { wheels.push(tire(C, 0.52, 0.36, 3.3, 0.52, s * 0.92, FM.chrome, s)); wheels.push(tire(C, 0.52, 0.3, -0.3, 0.52, s * 0.82, FM.chrome, s)); wheels.push(tire(C, 0.52, 0.3, -0.3, 0.52, s * 1.14, FM.chrome, s)); });
      wheels.forEach((w) => (w.userData.r = w.userData.r || 0.5));
      // the stabiliser legs: an outrigger slides out, then a hydraulic leg pushes a foot to the ground
      const legs = [[2.9, 1], [2.9, -1], [-2.7, 1], [-2.7, -1]].map(([x, s]) => {
        const og = grp(M, x, 1.05, s * 1.0); rbox(og, 0.24, 0.2, 1.2, 0.03, FM.yel, 0, 0, -s * 0.3, 0.01);
        const A = anchor(og, 0, 0.1, s * 0.3); const foot = grp(og, 0, -0.35, s * 0.3); rbox(foot, 0.45, 0.06, 0.45, 0.02, FM.dark, 0, -0.03, 0, 0.01); const Bf = anchor(foot, 0, 0, 0);
        const h = hydraulic(og, A, Bf, { barrel: 0.35, mat: FM.yel, rb: 0.08 }); return { og, foot, h, s };
      });
      // the axle block, lifted by four telescopic legs
      const AX = grp(M, 0, AX0, 0); cylZ(AX, 0.22, 3.4, FM.steel, 0, 0, 0, 14); [1.5, -1.5].forEach((z) => rbox(AX, 0.6, 0.6, 0.3, 0.06, FM.dark, 0, 0, z, 0.02)); ball(AX, 0.18, FM.gold, 0, 0.35, 1.5); ball(AX, 0.18, FM.gold, 0, 0.35, -1.5);
      const tele = []; [4.4, -4.4].forEach((x) => [1.5, -1.5].forEach((z) => tele.push(telescopic(M, anchor(M, x, 1.5, z), anchor(AX, 0, 0, z), { n: 3, stage: 3.0, r: 0.15 }))));
      // the boat (origin: middle of the deck), resting on the drive tyres
      const BT = grp(M, 0, 3.1, 0), bd = grp(BT);
      const keel = []; for (let i = 0; i <= 12; i++) { const x = -3.6 + (i / 12) * 7.2; keel.push([x, 5.4 - Math.sqrt(6.6 * 6.6 - x * x)]); }
      ext(bd, keel.concat([[4.2, 0.5], [4.5, 1.25], [4.1, 1.15], [3.4, 0.3], [-3.4, 0.3], [-4.1, 1.15], [-4.5, 1.25], [-4.2, 0.5]]), 0.06, 2.0, FM.woodD, 0, 0, 0, 0.04);
      [1, -1].forEach((s) => { rbox(bd, 7.0, 0.14, 0.06, 0.03, FM.gold, 0, -0.35, s * 1.02, 0.01); rbox(bd, 6.8, 0.4, 0.08, 0.03, FM.wood, 0, 0.5, s * 0.94, 0.01); rbox(bd, 6.9, 0.06, 0.12, 0.02, FM.gold, 0, 0.72, s * 0.94, 0.01);
        for (let x = -2.4; x <= 2.4; x += 1.2) { cylZ(bd, 0.16, 0.05, FM.gold, x, -0.05, s * 1.02, 12); cylZ(bd, 0.11, 0.06, FM.glassD, x, -0.05, s * 1.02, 12); } });
      [-2.6, -1.4, 1.4, 2.6].forEach((x) => rbox(bd, 0.35, 0.3, 1.7, 0.04, FM.red, x, 0.45, 0, 0.02));
      [4.45, -4.45].forEach((x) => { rod(bd, V(x, 1.2, 0), V(x, 2.0, 0), 0.025, FM.dark, 4); box(bd, 0.5, 0.32, 0.02, FM.yel, x - Math.sign(x) * 0.25, 1.82, 0); });
      ball(bd, 0.3, FM.gold, 4.45, 1.3, 0);
      sign(bd, 'LE BATEAU', 1.6, 0.36, '#e0383a', '#fff6d8', 0, -0.62, 1.07);
      bake(bd);
      const arms = [1.15, -1.15].map((z) => { const a = grp(BT, 0, 0.2, z), ad = grp(a); [0.12, -0.12].forEach((x) => rbox(ad, 0.08, 5.2, 0.1, 0.03, FM.yel, x, 2.6, 0, 0.01)); for (let y = 0.4; y < 5.0; y += 0.6) box(ad, 0.24, 0.05, 0.06, FM.yel, 0, y, 0); cylZ(ad, 0.25, 0.15, FM.dark, 0, 5.2, 0, 12); cylZ(ad, 0.2, 0.2, FM.gold, 0, 0, 0, 12); bake(ad); return a; });
      const kids = []; [-2.6, -1.4, 1.4, 2.6].forEach((x) => [0.45, -0.45].forEach((z) => { const k = sitter(BT, x + (x > 0 ? 0.25 : -0.25), 0.62, z, { s: 0.72, up: Math.random() < 0.5 }); k.rotation.y = x > 0 ? Math.PI : 0; k.visible = false; kids.push(k); }));
      const SWG = grp(AX);
      const dTyres = [0.7, -0.7].map((x) => tire(M, 0.28, 0.25, x, 1.66, 0, FM.yel, 1));
      const fold = () => {
        if (BT.parent !== M) { M.attach(BT); } BT.position.set(0, 3.1, 0); BT.rotation.set(0, 0, 0); SWG.rotation.z = 0;
        arms.forEach((a) => (a.rotation.z = -Math.PI / 2)); AX.position.y = AX0; kids.forEach((k) => (k.visible = false));
        legs.forEach((l) => { l.og.position.z = l.s * 1.0; l.foot.position.y = -0.35; });
      };
      fold(); M.updateMatrixWorld(true); legs.forEach((l) => l.h.update()); tele.forEach((t) => t.update());
      let lastX = 0;
      part(st, 'camion', 'le camion', anchor(C, 2.6, 3.6, 0), false);
      part(st, 'pieds', 'les pieds hydrauliques', anchor(legs[0].foot, 0, 0.3, 0.3), true);
      part(st, 'verins', 'les bras hydrauliques', anchor(M, 3.2, 3.6, 1.6), true);
      part(st, 'bateau', 'le bateau', anchor(BT, -3.5, 1.4, 1.0), false);
      part(st, 'pneus', 'les pneus', anchor(M, 0.7, 1.7, 0.3), false);
      st.focus = V(0, 4.0, 0); st.size = { w: 21, h: 11 }; st.tagAt = anchor(M, 0, 10, 0);
      st.update = () => {
        const dx = M.position.x - lastX; lastX = M.position.x; if (dx) wheels.forEach((w) => (w.rotation.z -= dx / 0.52));
        legs.forEach((l) => l.h.update()); tele.forEach((t) => t.update());
        dTyres.forEach((t) => (t.rotation.z = SWG.rotation.z * (6.6 / 0.28)));
      };
      st.action = async function () {
        if (st.done) { await Promise.all([step('On replie le manège, et le camion repart.', 'camion'), sleep(0.4)]); fold(); M.position.x = X0; lastX = X0; pop(M, 0.6); st.done = false; await sleep(0.7); }
        else if (M.position.x === 0) { M.position.x = X0; lastX = X0; pop(M, 0.5); await sleep(0.6); }
        engineOn(55);
        await Promise.all([step('Le camion du forain arrive, avec un manège plié sur sa remorque.', 'camion'), to(M.position, 'x', 0, 5, easeSine)]);
        await Promise.all([step('Des pieds hydrauliques sortent et se posent par terre : tout est bien stable.', 'pieds'),
          tw(1.4, (k) => legs.forEach((l) => (l.og.position.z = l.s * (1.0 + 0.9 * k))), easeSine).then(() => tw(1.6, (k) => legs.forEach((l) => (l.foot.position.y = -0.35 - 0.68 * k)), easeSine))]);
        thud();
        await Promise.all([step('Les grands bras hydrauliques s’allongent, et soulèvent l’axe tout en haut.', 'verins'), tone(70, 0, 4, 'sawtooth', 0.02, 110), to(AX.position, 'y', AX1, 4.5, easeSine)]);
        await Promise.all([step('Les bras du bateau se lèvent et s’accrochent à l’axe : c’est une grande balançoire !', 'bateau'), tw(3, (k) => arms.forEach((a) => (a.rotation.z = -Math.PI / 2 * (1 - k))), easeSine)]);
        thud(); SWG.attach(BT); kids.forEach((k, i) => setTimeout(() => pop(k, 0.4), i * 70));
        await Promise.all([step('Des pneus, sous le bateau, le poussent… et il se balance, de plus en plus haut !', 'pneus'),
          tw(10, (k) => (SWG.rotation.z = Math.sin(k * 10 * Math.PI) * 0.45 * Math.min(1, k * 1.6)), lin)]);
        await Promise.all([step('Le bateau ralentit, et s’arrête. Tout le monde a le sourire !', 'bateau'), tw(4, (k) => (SWG.rotation.z = Math.sin(k * 4 * Math.PI) * 0.45 * (1 - k)), lin)]);
        SWG.rotation.z = 0; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- la machine à barbe à papa ---- */
    (function () {
      const st = makeStation('barbapapa'), S = st.g;
      const K = grp(S); st.m = K;
      // the kiosk: back wall, sides, counter, striped roof, sign
      rbox(K, 3.6, 2.6, 0.12, 0.04, FM.cream, 0, 1.3, -1.1, 0.02); [1.8, -1.8].forEach((x) => rbox(K, 0.12, 2.6, 2.3, 0.04, FM.pink, x, 1.3, 0, 0.02));
      rbox(K, 3.6, 0.9, 0.5, 0.05, FM.white, 0, 0.45, 0.85, 0.02); rbox(K, 3.7, 0.08, 0.6, 0.03, FM.pink, 0, 0.93, 0.85, 0.01);
      for (let x = -1.5; x <= 1.5; x += 0.5) rbox(K, 0.24, 0.6, 0.03, 0.04, FM.pink, x, 0.45, 1.11, 0.01);
      const roof = rbox(K, 4.0, 0.1, 2.9, 0.04, FM.stripeP, 0, 2.75, 0.2, 0.02); roof.rotation.x = 0.12;
      scallopsLine(K, -2.0, 2.0, 2.52, 1.66, 12, [FM.scalW, std(0xf27aa8, 0.5, 0.05, DBL)]);
      sign(K, 'BARBE À PAPA', 2.6, 0.5, '#f27aa8', '#ffffff', 0, 3.25, -0.6);
      [1.75, -1.75].forEach((x) => rod(K, V(x, 0.95, 1.05), V(x, 2.6, 1.6), 0.04, FM.gold, 6));
      // bags of candy floss hanging and toffee apples on the counter
      [[-1.3, 0.5], [-1.0, 0.7], [1.0, 0.6], [1.3, 0.45]].forEach(([x, z], i) => { rod(K, V(x, 2.6, z), V(x, 2.2, z), 0.01, FM.dark, 3); egg(K, 0.18, 0.24, 0.18, i % 2 ? FM.sugar : FM.sky, x, 2.0, z); });
      [-1.2, -0.95, -0.7].forEach((x) => { ball(K, 0.1, FM.red, x, 1.05, 0.95); rod(K, V(x, 1.1, 0.95), V(x, 1.3, 0.95), 0.012, FM.wood, 3); });
      // the machine: stainless cabinet, the big bowl, the spinning head in the middle
      rbox(K, 1.0, 0.4, 0.9, 0.06, FM.plate, 0.3, 1.17, 0.55, 0.02); rbox(K, 0.3, 0.12, 0.04, 0.02, FM.dark, 0.3, 1.15, 1.01, 0.01); ball(K, 0.04, FM.tail, 0.5, 1.15, 1.02);
      const bowl = add(K, new THREE.CylinderGeometry(0.62, 0.42, 0.42, 32, 1, true), std(0xe2e8f0, 0.35, 0.5, DBL), 0.3, 1.58, 0.55); void bowl;
      add(K, new THREE.TorusGeometry(0.62, 0.03, 6, 32), FM.chrome, 0.3, 1.79, 0.55).rotation.x = Math.PI / 2;
      cylY(K, 0.42, 0.03, FM.plate, 0.3, 1.38, 0.55, 28); cylY(K, 0.05, 0.12, FM.dark, 0.3, 1.44, 0.55, 8);
      bake(K);
      const HD = grp(K, 0.3, 1.52, 0.55); cylY(HD, 0.14, 0.12, FM.head, 0, 0, 0, 16); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ball(HD, 0.018, MT.black, 0.142 * Math.sin(a), 0, 0.142 * Math.cos(a)); } cylY(HD, 0.15, 0.03, FM.dark, 0, 0.07, 0, 16); box(HD, 0.06, 0.04, 0.3, FM.dark, 0, 0.09, 0);
      const FIL = new THREE.TorusGeometry(1, 0.012, 4, 40); const fils = [0, 1, 2].map(() => { const f = add(K, FIL, FM.fil, 0.3, 1.55, 0.55); f.rotation.x = Math.PI / 2; f.visible = false; return f; });
      // the vendor, the stick, the cloud; a child and a parent waiting
      const ven = walker(K, -0.35, -0.45, { top: 0xffffff, bottom: 0x2a3550 }); ven.rotation.y = -Math.PI / 2; ven.scale.setScalar(1.3);
      add(ven, HALF, FM.pink, 0, 1.18, 0).scale.set(0.24, 0.2, 0.24);
      cylY(K, 0.1, 0.25, FM.glassD, -0.5, 1.05, 0.8, 12);
      const stick = grp(K, -0.5, 1.72, 0.8); cylY(stick, 0.012, 0.62, FM.cream, 0, -0.3, 0, 5);
      const cloud = grp(stick, 0, 0, 0); [[0, 0, 0, 0.2], [0.12, 0.06, 0.04, 0.14], [-0.1, 0.08, -0.05, 0.15], [0.02, 0.16, 0.06, 0.13], [0.04, -0.1, -0.08, 0.12], [-0.06, -0.05, 0.1, 0.13]].forEach(([x, y, z, r]) => ball(cloud, r, FM.sugar, x, y, z));
      cloud.scale.setScalar(0.01);
      const kid = walker(S, 0.7, 2.0, { kid: true, top: 0xf27aa8 }); kid.rotation.y = Math.PI / 2; const par = walker(S, 1.5, 2.3, {}); par.rotation.y = Math.PI / 2 + 0.3;
      const kidHand = new V3(0.62, 1.22, 1.72);
      part(st, 'tete', 'la tête chauffante', anchor(K, 0.3, 1.75, 0.6), true);
      part(st, 'bassine', 'la bassine', anchor(K, 0.85, 1.65, 0.75), false);
      part(st, 'baton', 'le bâton', anchor(stick, 0, 0.6, 0), false);
      part(st, 'marchand', 'le marchand', anchor(ven, 0, 1.6, 0), true);
      st.focus = V(0.2, 1.6, 0.5); st.size = { w: 6.5, h: 4.6 }; st.tagAt = anchor(S, 0, 4.0, 0);
      let spin = 0, ft = 0;
      st.update = (dt) => {
        HD.rotation.y += spin * dt;
        if (st.fils) { ft += dt; fils.forEach((f, i) => { const k = (ft * 0.8 + i / 3) % 1; f.visible = true; f.scale.setScalar(0.16 + k * 0.42); f.position.y = 1.53 + k * 0.08; }); } else fils.forEach((f) => (f.visible = false));
      };
      st.action = async function () {
        if (st.done) { K.attach(stick); stick.position.set(-0.5, 1.72, 0.8); stick.rotation.set(0, 0, 0); cloud.scale.setScalar(0.01); st.done = false; }
        await Promise.all([step('Le marchand verse du sucre au milieu de la machine, dans la petite tête.', 'tete'),
          tw(2, () => { if (Math.random() < 0.4) throwClod(wp(ven, 1.5).add(V(0.2, 0, 0)), wp(HD, 0.1), 0.04, 0xffffff); }, lin)]);
        engineOn(90);
        await Promise.all([step('La tête chauffe et tourne très, très vite. Le sucre fond, comme du caramel.', 'tete'), tw(2.5, (k) => { spin = 40 * k; FM.head.emissiveIntensity = 0.9 * k; }, lin)]);
        st.fils = true;
        await Promise.all([step('Le sucre sort par des trous minuscules, en fils très fins… comme une toile d’araignée !', 'bassine'), sleep(3)]);
        const c = V(0.3, 1.5, 0.55);
        await Promise.all([step('Le marchand tourne son bâton dans la bassine : les fils s’enroulent, et la barbe à papa grossit !', 'baton'),
          tw(5, (k) => { const a = k * TAU * 4, r = 0.32; stick.position.set(c.x + Math.cos(a) * r, c.y + 0.12, c.z + Math.sin(a) * r); stick.rotation.z = -1.0 * Math.min(1, k * 8); cloud.scale.setScalar(0.05 + 0.95 * k); }, lin)]);
        st.fils = false; engineOff(); tw(1.5, (k) => { spin = 40 * (1 - k); FM.head.emissiveIntensity = 0.9 * (1 - k); }, lin);
        S.attach(stick); const p0 = stick.position.clone();
        await Promise.all([step('Et voilà une belle barbe à papa toute rose ! Miam !', 'baton'), tw(2, (k) => { stick.position.lerpVectors(p0, kidHand, k); stick.position.y += Math.sin(k * Math.PI) * 0.5; stick.rotation.z = -1.0 * (1 - k); }, easeSine)]);
        ding(); chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the fairground around the rides ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
/** A stall facing local +z: counter, striped awning, sign; kind adds its own things. */
function stall(p, h, d, kind, ry = YAW) {
  const g = at(p, h, d, ry), W = 3.6;
  const [wall, awn, txt, bg] = { chichis: [FM.yel, FM.stripe, 'CHICHIS', '#e0383a'], canards: [FM.sky, FM.stripeB, 'PÊCHE AUX CANARDS', '#2f6fe0'], balles: [FM.mint, FM.stripeG, 'CHAMBOULE-TOUT', '#3fa84a'], bonbons: [FM.pink, FM.stripeP, 'CONFISERIE', '#8a52d0'] }[kind];
  rbox(g, W, 2.6, 0.12, 0.04, wall, 0, 1.3, -1.1, 0.02); [W / 2, -W / 2].forEach((x) => rbox(g, 0.12, 2.6, 2.3, 0.04, wall, x, 1.3, 0, 0.02));
  const roof = rbox(g, W + 0.4, 0.1, 2.9, 0.04, awn, 0, 2.75, 0.2, 0.02); roof.rotation.x = 0.12;
  scallopsLine(g, -W / 2 - 0.2, W / 2 + 0.2, 2.52, 1.66, 12, [FM.scalW, kind === 'canards' ? FM.scalB : FM.scalR]);
  sign(g, txt, W - 0.6, 0.45, bg, '#fff6d8', 0, 3.2, -0.6);
  if (kind !== 'canards') { rbox(g, W, 0.9, 0.5, 0.05, FM.white, 0, 0.45, 0.85, 0.02); rbox(g, W + 0.1, 0.08, 0.6, 0.03, awn, 0, 0.93, 0.85, 0.01); }
  if (kind === 'chichis') { rbox(g, 1.2, 0.5, 0.6, 0.04, FM.plate, -0.8, 1.2, 0.2, 0.02); for (let i = 0; i < 5; i++) rod(g, V(0.3 + i * 0.15, 0.97, 0.85), V(0.36 + i * 0.15, 1.35, 0.8), 0.04, FM.orange, 6); cylY(g, 0.2, 0.4, FM.glassD, 1.2, 1.17, 0.8, 12); }
  if (kind === 'balles') { [-1.0, 0, 1.0].forEach((x) => { rbox(g, 0.9, 0.08, 0.4, 0.02, FM.woodD, x, 1.4, -0.8, 0.01); [[-0.2, 0], [0, 0], [0.2, 0], [-0.1, 1], [0.1, 1], [0, 2]].forEach(([dx, row]) => cylY(g, 0.08, 0.2, [FM.red, FM.yel, FM.blue][row], x + dx, 1.55 + row * 0.2, -0.8, 10)); });
    for (let i = 0; i < 4; i++) ball(g, 0.09, FM.white, -1.2 + i * 0.25, 1.06, 0.85); }
  if (kind === 'bonbons') { for (let i = 0; i < 6; i++) { const x = -1.4 + i * 0.55; rod(g, V(x, 0.97, 0.85), V(x, 1.4, 0.85), 0.015, FM.white, 3); add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), [FM.pink, FM.yel, FM.mint, FM.red][i % 4], x, 1.5, 0.85).rotation.x = Math.PI / 2; }
    for (let i = 0; i < 5; i++) ball(g, 0.18, [FM.pink, FM.sky, FM.yel][i % 3], -1.2 + i * 0.6, 2.1, -0.6); }
  if (kind === 'canards') { rbox(g, W - 0.4, 0.6, 1.8, 0.4, FM.yel, 0, 0.3, 0.6, 0.03); add(g, new THREE.CircleGeometry(1, 28), FM.water, 0, 0.62, 0.6).rotation.x = -Math.PI / 2; g.children[g.children.length - 1].scale.set(1.45, 0.72, 1); rbox(g, 1.2, 0.5, 0.5, 0.15, FM.yel, 0, 0.62, 0.6, 0.02); }
  for (let i = 0; i < 6; i++) { const x = -W / 2 + 0.3 + i * ((W - 0.6) / 5); ball(g, 0.16, [FM.pink, FM.sky, FM.yel, FM.mint, FM.purple][i % 5], x, 2.25, 1.35); }
  return g;
}
function caravan(p, h, d, ry, col) {
  const g = at(p, h, d, ry);
  rbox(g, 5.2, 2.0, 2.2, 0.35, FM.cream, 0, 1.55, 0, 0.04); rbox(g, 5.25, 0.3, 2.25, 0.08, col, 0, 1.1, 0, 0.02); rbox(g, 5.25, 0.08, 2.25, 0.03, col, 0, 2.2, 0, 0.01);
  [-1.6, 0.2, 1.6].forEach((x) => rbox(g, 0.9, 0.55, 2.26, 0.12, FM.glassD, x, 1.85, 0, 0.01)); rbox(g, 0.7, 1.4, 0.05, 0.08, col, -0.6, 1.25, 1.11, 0.01);
  rbox(g, 0.9, 0.12, 0.5, 0.03, FM.dark, -0.6, 0.35, 1.4, 0.01); rbox(g, 0.8, 0.12, 0.6, 0.03, FM.cream, 0.3, 2.62, 0, 0.02);
  [1, -1].forEach((s) => { cylZ(g, 0.38, 0.25, MT.black, 0, 0.38, s * 1.05, 14); cylZ(g, 0.18, 0.27, FM.chrome, 0, 0.38, s * 1.05, 10); });
  rod(g, V(2.6, 0.6, 0.6), V(3.6, 0.5, 0), 0.05, FM.dark, 6); rod(g, V(2.6, 0.6, -0.6), V(3.6, 0.5, 0), 0.05, FM.dark, 6); cylY(g, 0.05, 0.5, FM.dark, 3.3, 0.25, 0, 6);
  return g;
}
const PARTY = [];
function buildFair(scene) {
  // stalls along the main alley and in the front row
  stall(scene, -3.6, -1.5, 'canards'); stall(scene, 15.5, -1.5, 'bonbons');
  stall(scene, -21, 14, 'balles'); stall(scene, -14, 14, 'chichis'); stall(scene, 21.5, 14, 'chichis'); stall(scene, -38, 13, 'bonbons');
  // the entrance arch at the end of the alley, with the ticket booth
  { const g = at(scene, 28, 14, YAW);
    [3.4, -3.4].forEach((x) => { cylY(g, 0.35, 5.2, FM.red, x, 2.6, 0, 16); for (let y = 0.6; y < 5.2; y += 0.9) cylY(g, 0.38, 0.2, FM.yel, x, y, 0, 16); ball(g, 0.5, FM.gold, x, 5.6, 0); });
    rbox(g, 7.6, 1.2, 0.3, 0.2, FM.purple, 0, 5.4, 0, 0.04); sign(g, 'FÊTE FORAINE', 5.4, 0.8, '#8a52d0', '#fff1a0', 0, 5.4, 0.2);
    ext(g, [[-2, 0], [2, 0], [0, 1.4]], 0.1, 0.3, FM.yel, 0, 6.0, 0, 0.03);
    PARTY.push({ g, pts: linePts([-3.6, 6.0, 0.25], [3.6, 6.0, 0.25], 18).concat(linePts([-3.6, 4.85, 0.25], [3.6, 4.85, 0.25], 18)), twinkle: true }); }
  { const g = at(scene, 33, 13, YAW); rbox(g, 1.8, 2.3, 1.6, 0.1, FM.red, 0, 1.15, 0, 0.02); rbox(g, 1.4, 0.7, 0.04, 0.06, FM.glassD, 0, 1.5, 0.81, 0.01); rbox(g, 2.1, 0.2, 1.9, 0.06, FM.yel, 0, 2.4, 0, 0.02); add(g, new THREE.ConeGeometry(1.2, 0.8, 16, 1, true), FM.coneR, 0, 2.9, 0); sign(g, 'TICKETS', 1.3, 0.3, '#f6c22a', '#2a2440', 0, 1.95, 0.84); }
  // light strings over the alley
  for (let h = -40; h <= 32; h += 8) {
    [2.0, 8.0].forEach((d) => { const g = at(scene, h, d); cylY(g, 0.07, 4.6, FM.dark, 0, 2.3, 0, 8); ball(g, 0.12, FM.gold, 0, 4.7, 0); });
    const [ax, az] = Q(h, 2.0), [bx, bz] = Q(h + 8, 8.0), [cx, cz] = Q(h, 8.0), [ex, ez] = Q(h + 8, 2.0);
    if (h < 32) { PARTY.push({ g: scene, pts: linePts([ax, 4.6, az], [bx, 4.6, bz], 14, 0.7).concat(linePts([cx, 4.6, cz], [ex, 4.6, ez], 14, 0.7)) }); }
  }
  // the showmen's caravans behind the rides, their generator truck, a washing line
  [[-30, -38, FM.blue], [-10, -40, FM.red], [-3, -36, FM.mint], [26, -38, FM.purple], [34, -32, FM.yel]].forEach(([h, d, c], i) => caravan(scene, h, d, YAW + (i % 2 ? 0.25 : -0.2), c));
  { const g = at(scene, 4, -40, YAW - 0.1); rbox(g, 3.0, 1.8, 1.8, 0.1, FM.green, -0.6, 1.4, 0, 0.02); rbox(g, 1.4, 1.6, 1.9, 0.2, FM.white, 1.7, 1.3, 0, 0.02); box(g, 0.04, 0.6, 1.5, FM.glassD, 2.42, 1.6, 0);
    [-1.4, 1.6].forEach((x) => [1, -1].forEach((s) => cylZ(g, 0.42, 0.3, MT.black, x, 0.42, s * 0.9, 14))); cylY(g, 0.07, 0.8, FM.dark, -1.6, 2.6, 0.6, 8); }
  { const a = Q(-10, -40), b = Q(-3, -36); [a, b].forEach(([x, z]) => cylY(scene, 0.04, 2.2, FM.dark, x + 1.6, 1.1, z + 1.6, 6)); const A = V(a[0] + 1.6, 2.1, a[1] + 1.6), Bp = V(b[0] + 1.6, 2.1, b[1] + 1.6); rod(scene, A, Bp, 0.01, FM.dark, 3);
    for (let i = 1; i < 6; i++) { const p = A.clone().lerp(Bp, i / 6); rbox(scene, 0.4, 0.5, 0.04, 0.03, [FM.pink, FM.sky, FM.yel, FM.white, FM.mint][i % 5], p.x, p.y - 0.28, p.z, 0.01).rotation.y = Math.atan2(-(Bp.z - A.z), Bp.x - A.x); } }
  // the car park
  [[22.2, 22], [24.8, 22], [27.4, 22], [32.6, 22], [24.8, 28.4], [30, 28.4], [32.6, 28.4]].forEach(([h, d], i) => { const c = miniCar(scene, i % 3 === 1 ? 'van' : 'car'); const [x, z] = Q(h, d); c.position.set(x, 0, z); c.rotation.y = YAW + Math.PI / 2 + (i > 3 ? Math.PI : 0); });
  // benches, bins, lamps, trees
  [[-28, 8.4], [-9, 8.4], [12, 8.4], [28, 8.4], [-14, 1.6], [22, 1.6]].forEach(([h, d], i) => { const g = at(scene, h, d, YAW + (d > 5 ? Math.PI : 0)); rbox(g, 1.6, 0.08, 0.5, 0.02, FM.woodD, 0, 0.45, 0, 0.01); rbox(g, 1.6, 0.4, 0.06, 0.02, FM.woodD, 0, 0.75, -0.22, 0.01); [0.65, -0.65].forEach((x) => box(g, 0.06, 0.45, 0.45, FM.dark, x, 0.22, 0));
    if (i % 2) { const b = at(scene, h + 1.6, d); cylY(b, 0.25, 0.8, FM.greenD, 0, 0.4, 0, 12); } });
  [[-42, 14], [-46, 0], [-42, -18], [-30, -26], [-34, 25], [42, -20], [44, -4], [20, -36], [-20, -42], [2, 30], [-6, 32], [16, 27], [42, 12], [-22, 31], [38, 20]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(scene, x, z, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6a9a3a, 0x4a8a3a, 0x7aaa4a]); });
  [[-34, 10], [-12, 10], [16, 10], [20, 1.5]].forEach(([h, d]) => { const [x, z] = Q(h, d); lamp(scene, x, z, YAW + Math.PI / 2); });
  // a family picnic on the lawn
  { const g = at(scene, -13, 26, YAW + 0.3); rbox(g, 2.4, 0.04, 1.8, 0.02, FM.stripe, 0, 0.02, 0, 0.01); egg(g, 0.3, 0.2, 0.22, FM.woodD, 0.6, 0.15, -0.4);
    [[-0.6, 0.3, 0, {}], [0.2, -0.5, Math.PI / 2, {}], [0.5, 0.5, -Math.PI / 2, { s: 0.65 }]].forEach(([x, z, ry, o]) => { const k = sitter(g, x, 0.18, z, Object.assign({ s: 1.0 }, o)); k.rotation.y = ry; }); }
  // people standing in queues and at the stalls
  [[-17, 9.3], [-16.2, 9.6], [-21, 17], [-20.4, 17.4], [-4, 1.6], [-3.3, 1.9], [15, 1.7], [-38, 16.4], [33, 15], [33.8, 15.3], [-14, 16.8], [21.5, 16.9]].forEach(([h, d], i) => { const [x, z] = Q(h, d); const p = walker(scene, x, z, i % 3 === 1 ? { kid: true } : {}); p.rotation.y = YAW + Math.PI / 2 + rnd(-0.4, 0.4); });
  return scene;
}

/* ================= life: families walking, balloons, ducks, a ball ================= */
function balloon(p, col, len, x, y, z) {
  const g = grp(p, x, y, z); rod(g, V(0, 0, 0), V(0, len, 0), 0.008, FM.dark, 3); egg(g, 0.24, 0.3, 0.24, col, 0, len + 0.28, 0); add(g, new THREE.ConeGeometry(0.05, 0.08, 6), col, 0, len - 0.02, 0);
  return g;
}
function buildLife(scene, onUpdate) {
  const all = [], cols = [FM.red, FM.yel, FM.blue, FM.pink, FM.mint, FM.purple];
  PARTY.forEach((s) => bulbs(s.g, s.pts, 0.085, BCOL, s.twinkle ? BM2 : BM));
  const R = (pts, t = 0.15) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const alley = R([[-42, 3.8], [32, 3.8], [34, 5], [32, 6.2], [-42, 6.2], [-44, 5]]);
  const fam = Array.from({ length: 16 }, (_, i) => walker(scene, 0, 0, i % 3 === 2 ? { kid: true } : {})); all.push(...fam);
  const bls = [];
  fam.forEach((p, i) => { if (i % 3 === 2 && i % 2 === 0) bls.push(balloon(p, cols[i % 6], 1.4, 0.05, 0.75, -0.3)); });
  const t1 = traffic(alley, fam, 1.2, { gap: 1.1 });
  const side = R([[-23.5, 4.5], [-23.5, -20], [-22.5, -21], [-21.5, -20], [-21.5, 4.5]], 0.2);
  const walkers2 = Array.from({ length: 5 }, (_, i) => walker(scene, 0, 0, i % 2 ? { kid: true } : {})); all.push(...walkers2);
  bls.push(balloon(walkers2[1], FM.red, 1.4, 0.05, 0.75, -0.3));
  const t2 = traffic(side, walkers2, 1.1, { gap: 1.1 });
  const park = R([[27.4, 5], [27.4, 21], [28.6, 21], [28.6, 5]], 0.2);
  const walkers3 = Array.from({ length: 4 }, (_, i) => walker(scene, 0, 0, i % 2 ? { kid: true } : {})); all.push(...walkers3);
  const t3 = traffic(park, walkers3, 1.0, { gap: 1.1 });
  // the balloon seller
  const [sx, sz] = Q(-8, 9.2); const seller = walker(scene, sx, sz, { top: 0xf2b21c }); seller.rotation.y = YAW + Math.PI / 2;
  const bunch = grp(scene, sx, 0.9, sz); bunch.userData.dynamic = true;
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = 0.3 + (i % 2) * 0.25; const g = grp(bunch); g.rotation.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); balloon(g, cols[i % 6], 1.5 + (i % 3) * 0.3, 0, 0, 0); void r; }
  // the ducks of the duck-fishing stall, going round
  { const [x, z] = Q(-3.6, -1.5); const ring = grp(scene, x, 0.66, z); ring.rotation.y = YAW; const inner = grp(ring, 0, 0, 0.6); const ducks = grp(inner);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, d = grp(ducks, Math.cos(a) * 1.25, 0, Math.sin(a) * 0.55); d.rotation.y = -a - Math.PI / 2; egg(d, 0.17, 0.1, 0.12, FM.yel, 0, 0.05, 0); ball(d, 0.08, FM.yel, 0.12, 0.17, 0); box(d, 0.08, 0.03, 0.06, FM.orange, 0.21, 0.16, 0); }
    shadows(ducks); ring.userData.ducks = ducks; ring.userData.n = 10; onUpdate((dt, t) => ducks.children.forEach((d, i) => { const a = (i / 10) * TAU + t * 0.4; d.position.set(Math.cos(a) * 1.25, Math.sin(t * 3 + i) * 0.02, Math.sin(a) * 0.55); d.rotation.y = -a - Math.PI / 2; })); }
  // a child throwing balls at the tin cans
  const [bx, bz] = Q(-21, 17.6); const thrower = walker(scene, bx, bz, { kid: true }); thrower.rotation.y = YAW + Math.PI / 2;
  const ballM = ball(scene, 0.09, FM.white, 0, -5, 0); const g0 = grp(scene); const [cx, cz] = Q(-21, 14); g0.position.set(cx, 0, cz); g0.rotation.y = YAW; g0.updateMatrixWorld(true); const tgt = g0.localToWorld(V(0, 1.7, -0.8)); const src = V(bx, 0.9, bz);
  let bt = 0;
  onUpdate((dt, t) => {
    t1.update(dt, all); t2.update(dt, all); t3.update(dt, all);
    bls.forEach((b, i) => (b.rotation.z = Math.sin(t * 1.5 + i) * 0.12));
    bunch.children.forEach((g, i) => (g.rotation.z = Math.cos((i / 9) * TAU) * 0.25 + Math.sin(t * 1.2 + i) * 0.06));
    bt += dt; const k = (bt % 3.2) / 0.9; if (k <= 1) { ballM.position.lerpVectors(src, tgt, k); ballM.position.y += Math.sin(k * Math.PI) * 0.9; } else ballM.position.y = -5;
    thrower.userData.arms[0].rotation.z = k <= 0.3 ? -2.4 + k * 6 : 0;
  });
}
