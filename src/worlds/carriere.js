// La Carrière — an open-pit stone quarry: the rock is drilled, broken, loaded, hauled to the crusher,
// crushed, sorted into gravel by size, and leaves in a truck for the building sites. No explosives here.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { beacon, worker } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';
import { QM, BOULDER, bake, slab, rockHeap, excavator, haulTruck, wheelLoader, drillRig, roadTipper, waterTruck, conveyor } from '../kit/carriere-kit.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, DEG = Math.PI / 180;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
/** A station at (h, d) whose forward (+x) points along the map direction (uh, ud). */
const CU = (h, d, uh, ud) => { const [x, z] = Q(h, d), [fx, fz] = Q(uh, ud); return { x, z, yaw: Math.atan2(-fz, fx) }; };
/** Camera azimuth looking from the map direction (dh, dd). */
const camAz = (dh, dd) => { const [x, z] = Q(dh, dd); return Math.atan2(x, z); };
const polar = (deg, r) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)];

/* ---------- the pit: stepped benches around the back, a haul road spiralling up ---------- */
const BH = 2.6, R0 = 36, BWD = 5.5, ROUT = 60, RW = 4, TA = 8;
const rB = (k) => R0 + BWD * k;                       // inner radius of bench ring k (its top is at (k + 1)·BH)
const ringA = (k) => [-195 + 9 * k, 15 - 9 * k];       // angular range of ring k (map angle, degrees)
const rampA = (k) => [-185 + 40 * k, -155 + 40 * k];   // ramp k climbs from k·BH to (k + 1)·BH along the face of ring k

const RM = {
  face: [0xd8c7a4, 0xcfbb96, 0xd6c4a0, 0xcab590].map((c) => std(c, 0.95, 0, { side: THREE.DoubleSide })),
  strata: std(0xa8957a, 0.95, 0, { side: THREE.DoubleSide }), top: std(0xe2d4b2, 0.95, 0, { side: THREE.DoubleSide }),
  road: std(0xbfae90, 0.95, 0, { side: THREE.DoubleSide }), berm: std(0xb09d7c, 0.95, 0, { side: THREE.DoubleSide }),
  earth: std(0xb7a27e, 0.95, 0), water: std(0x4a8fd8, 0.12, 0.25), reed: std(0x6f9a3a, 0.8, 0), sand: std(0xe9bf6a, 0.95, 0),
  fine: std(0xa3a3a6, 0.95, 0), coarse: std(0x6e6964, 0.95, 0), stock: std(0x8f9aa8, 0.95, 0), pink: std(0xcf9f8c, 0.95, 0),
  cabin: std(0xf1f2f5, 0.5, 0.1), cabinB: std(0x2f6fe0, 0.45, 0.15), wood: MT.wood
};

const DATA = {
  foreuse: { short: 'La foreuse', full: 'La foreuse', verb: 'Forer', horn: 'horn',
    use: 'Elle fait de longs trous dans la roche, tout droit vers le bas.',
    how: 'Son grand mât se lève. Une longue tige tourne et tape très vite pour creuser un trou.' },
  briseroche: { short: 'Le brise-roche', full: 'Le brise-roche', verb: 'Casser', horn: 'horn',
    use: 'Il casse les rochers trop gros, en petits morceaux.',
    how: 'Au bout de son bras, il a un gros marteau. Le marteau tape très vite sur le rocher : tac-tac-tac !' },
  pelle: { short: 'La grosse pelle', full: 'La grosse pelle', verb: 'Charger', horn: 'horn',
    use: 'Une pelle géante qui remplit les tombereaux de cailloux.',
    how: 'Son godet est plus grand qu’une voiture ! Sa cabine tourne au-dessus des chenilles.' },
  tombereau: { short: 'Le tombereau', full: 'Le tombereau géant', verb: 'Transporter', horn: 'horn',
    use: 'Un camion énorme qui transporte les cailloux jusqu’au concasseur.',
    how: 'Ses roues sont plus grandes qu’un papa. Le chauffeur monte un escalier pour aller dans sa cabine !' },
  concasseur: { short: 'Le concasseur', full: 'Le concasseur', verb: 'Écraser', horn: 'bell',
    use: 'Il écrase les gros cailloux pour en faire des petits.',
    how: 'Deux mâchoires en acier serrent les cailloux très fort : crac ! Un grand volant les fait bouger.' },
  crible: { short: 'Le crible', full: 'Le crible', verb: 'Trier', horn: 'bell',
    use: 'Il trie les cailloux : les tout petits, les moyens et les gros.',
    how: 'C’est une grande passoire qui tremble. Les petits grains passent par les trous, les gros restent dessus.' },
  chargeuse: { short: 'La chargeuse', full: 'La chargeuse sur pneus', verb: 'Charger', horn: 'horn',
    use: 'Elle remplit les camions qui livrent le gravier aux chantiers.',
    how: 'Elle a un très grand godet devant. Pour tourner, elle se plie au milieu !' },
  arroseuse: { short: "L'arroseuse", full: 'Le camion arroseur', verb: 'Arroser', horn: 'horn',
    use: 'Il mouille les pistes pour qu’il n’y ait pas de poussière.',
    how: 'Il remplit sa grande citerne à l’étang. Derrière, des jets d’eau arrosent la piste.' }
};
const ORDER = ['foreuse', 'briseroche', 'pelle', 'tombereau', 'concasseur', 'crible', 'chargeuse', 'arroseuse'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  foreuse: GND + `<rect class="k" x="10" y="60" width="54" height="11" rx="5.5"/><rect class="o" x="12" y="42" width="34" height="18" rx="3"/><rect class="o" x="44" y="34" width="16" height="26" rx="2"/><rect class="g" x="47" y="38" width="10" height="9" rx="1"/>
    <path d="M60 52L76 40" stroke="#c8521c" stroke-width="6" stroke-linecap="round"/><rect class="o" x="74" y="4" width="9" height="68" rx="2"/><rect class="s" x="71" y="16" width="15" height="11" rx="2"/><path d="M78 27v48" stroke="#8d96a6" stroke-width="3"/><path d="M70 76h16" stroke="#a89060" stroke-width="3"/>`,
  briseroche: GND + `<rect class="k" x="6" y="60" width="54" height="12" rx="6"/><rect class="y" x="8" y="44" width="46" height="16" rx="4"/><rect class="y" x="34" y="28" width="18" height="18" rx="3"/><rect class="g" x="37" y="31" width="12" height="10" rx="2"/>
    <path class="arm" d="M50 46L74 22L88 34"/><rect class="k" x="84" y="32" width="10" height="26" rx="2"/><path d="M89 58v6" stroke="#8d96a6" stroke-width="4"/><path d="M74 75q4-12 15-12t15 12z" fill="#b8ad9a"/><path d="M84 58l-6-4M94 58l6-4" stroke="#f4b42a" stroke-width="2"/>`,
  pelle: GND + `<rect class="k" x="4" y="60" width="56" height="12" rx="6"/><rect class="y" x="6" y="44" width="48" height="16" rx="4"/><rect class="y" x="34" y="26" width="18" height="20" rx="3"/><rect class="g" x="37" y="29" width="12" height="11" rx="2"/>
    <path class="arm" d="M50 46L78 18L100 40"/><path d="M92 38h20l-4 18q-8 6-16-2z" class="yd"/><path d="M96 38q6-8 14 0" fill="#b8ad9a"/>`,
  tombereau: GND + `<path d="M6 30h70l6 14H14z" class="y"/><path d="M76 30h22l6 6H82z" class="yd"/><rect class="y" x="80" y="40" width="30" height="14" rx="2"/><rect class="g" x="86" y="36" width="12" height="8" rx="1"/><rect class="k" x="12" y="44" width="80" height="6"/>
    <circle class="k" cx="30" cy="60" r="14"/><circle class="s" cx="30" cy="60" r="6"/><circle class="k" cx="92" cy="60" r="14"/><circle class="s" cx="92" cy="60" r="6"/><path d="M16 28q20-8 40 0" fill="#b8ad9a"/>`,
  concasseur: GND + `<path d="M10 14h40l-10 18H20z" fill="#3f7fc8"/><rect x="18" y="32" width="26" height="26" rx="3" fill="#2c5b94"/><circle class="k" cx="40" cy="44" r="12"/><circle class="s" cx="40" cy="44" r="4"/><path class="ln" d="M40 32v24M28 44h24"/>
    <path d="M32 66L110 34" stroke="#2a2f40" stroke-width="6" stroke-linecap="round"/><g fill="#b8ad9a"><circle cx="54" cy="55" r="3"/><circle cx="70" cy="49" r="3"/><circle cx="86" cy="42" r="3"/></g><path class="ln" d="M44 58v16M80 46v28M104 36v38"/>`,
  crible: GND + `<path d="M24 22L84 34v12L24 34z" fill="#3f7fc8"/><path class="ln" d="M28 30l52 10M28 26l52 10"/><path class="ln" d="M34 36v38M74 44v30"/><path d="M84 46L104 62" stroke="#2a2f40" stroke-width="4" stroke-linecap="round"/>
    <path d="M90 75q12-18 26 0z" fill="#8e877d"/><path d="M50 75q10-14 22 0z" fill="#b5b0a6"/><path d="M4 75q10-14 22 0z" fill="#e0c79a"/>`,
  chargeuse: GND + `<rect class="y" x="10" y="38" width="44" height="18" rx="4"/><rect class="y" x="28" y="18" width="22" height="22" rx="3"/><rect class="g" x="32" y="22" width="14" height="12" rx="2"/><path class="arm" d="M52 46L84 30"/><path d="M80 16h22v24q-12 4-22-4z" class="yd"/>
    <circle class="k" cx="22" cy="60" r="12"/><circle class="s" cx="22" cy="60" r="5"/><circle class="k" cx="64" cy="60" r="12"/><circle class="s" cx="64" cy="60" r="5"/>`,
  arroseuse: GND + `<rect class="w" x="10" y="28" width="62" height="28" rx="12"/><rect class="b" x="10" y="40" width="62" height="5"/><rect class="o" x="76" y="30" width="30" height="26" rx="3"/><rect class="g" x="90" y="34" width="12" height="9"/>
    <circle class="k" cx="24" cy="62" r="8"/><circle class="k" cx="46" cy="62" r="8"/><circle class="k" cx="94" cy="62" r="8"/><g fill="#7fc4ff"><circle cx="6" cy="62" r="2"/><circle cx="2" cy="56" r="2"/><circle cx="8" cy="70" r="2"/><circle cx="3" cy="66" r="1.6"/></g>`
};

/* ---------- layout (h along the screen in the overview, d from the back to the front) ---------- */
const [fH, fD] = polar(-100, 39.5), [bH, bD] = polar(-132, 28.5);
const PELLE = [-9.75, -26.8], TRUCK = [PELLE[0] + 9, PELLE[1]];
const RAMP = { x0: 6, x1: 13, x2: 19, z: 11, H: 3.0, w: 6.4 };          // in the haul truck's station
const HOP = [TRUCK[0] + RAMP.x2 + 2, TRUCK[1] + RAMP.z];               // the crusher's hopper
const CRIB = [23.5, -3.5], CU0 = (() => { const dh = CRIB[0] - HOP[0], dd = CRIB[1] - HOP[1], l = Math.hypot(dh, dd); return [dh / l, dd / l]; })();
const LOAD = [8, 7], WATER = [-20, 14];
const CFG = {
  foreuse: CU(fH, fD, -Math.sin(-100 * DEG), Math.cos(-100 * DEG)),
  briseroche: CU(bH, bD, Math.cos(-132 * DEG), Math.sin(-132 * DEG)),
  pelle: CF(...PELLE), tombereau: CF(...TRUCK), concasseur: CF(...HOP), crible: CU(...CRIB, ...CU0),
  chargeuse: CF(...LOAD), arroseuse: CF(...WATER)
};

const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 5, col = '#c8b48e', al = 0.85) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
road([[0, -24], [-8, -14], [-18, -6], [-28, 0], [-34, 4], [-34, 10], [-30, 14], [-26, 11]], 6.5);           // haul road to the ramp
road([[-1, -24], [8, -18], [16, -14]], 6.5); road([[2, -16], [6, -2], [10, 6], [14, 10], [26, 10.4]], 5);
road([[-24, 14], [-2, 14], [6, 12]], 5.5, '#bfa882');                                                     // the dusty track the water truck sprays
road([[14, 10.4], [26, 10.4], [31, 10.5], [35.5, 13.5], [39, 19], [43, 26], [47, 33], [50, 40]], 4, '#6f6c6a', 0.95);                // asphalt road out of the quarry
rect(18, 27, 9, 5, '#9a958e', 0.9); rect(8, 25.6, 10, 4.5, '#8c8780', 0.9);
blob(-6, 8, 6, 'rgba(150,130,100,.35)'); blob(12, -6, 7, 'rgba(240,225,200,.35)'); blob(-14, -16, 5, 'rgba(120,105,85,.35)');
blob(28, 18, 4, 'rgba(110,140,90,.4)'); blob(-4, 30, 8, 'rgba(110,140,90,.35)'); blob(-30, 22, 6, 'rgba(110,140,90,.35)');

export default {
  id: 'carriere', title: 'La Carrière', titleHtml: 'La <span>Carrière</span>',
  subtitle: 'Une grande carrière de pierres : on casse la roche, on la transporte, on l’écrase et on la trie pour faire du gravier.',
  welcome: 'Bienvenue à la carrière ! Ici, la roche devient du gravier pour les chantiers. Touche un engin pour voir comment il marche.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la carrière',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 27h26M5 27v-5h6v-5h6v-5h6v-5h4"/><path d="M8 22l2-2M14 17l2-2M20 12l2-2"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 56, tufts: false,
  forest: { dark: [0x2f5a2a, 0x3a6a30, 0x284a26, 0x46743a, 0x335f2f], bush: [0x6a8a3a, 0x5a7d34, 0x7a9a44, 0x4f7330] },
  overview: { w: 94, h: 66, focus: [0, 3, 0] },
  ground: { base: ['#d4c39f', '#bea883', '#8f7b5c'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 220); onUpdate((dt) => fx.update(dt));
    freeze(buildPit(grp(scene)));
    freeze(buildYard(grp(scene)));
    const STONE = 0xa89d88, STONE2 = 0x857a6a;
    const along = (obj, r, s0, s1, d, ease = easeSine, yOff = 0) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k, yOff), ease);
    /** keeps the wheels turning for a vehicle driven in any direction */
    const spinner = (obj, wheels) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || 0.5))); }; };
    const dust = (p, n = 2, col = 0xd8cbb0, s = 0.6) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.6, 0.6), 0.2, rnd(-0.6, 0.6))), new V3(rnd(-0.6, 0.6), rnd(0.4, 1.1), rnd(-0.6, 0.6)), rnd(0.5, 1) * s, col, rnd(1.2, 2)); };
    const exhaust = (obj, x, y, z) => fx.smoke(obj.localToWorld(new V3(x, y, z)), new V3(rnd(-0.2, 0.2), rnd(0.8, 1.4), rnd(-0.2, 0.2)), rnd(0.2, 0.35), 0x8a8a90, 1.4);
    const SH = {}; // what the stations share (the big excavator loads the haul truck, the truck feeds the crusher…)

    /* ---- la foreuse : sur le gradin, elle perce une rangée de trous ---- */
    (function () {
      const st = makeStation('foreuse'), S = st.g;
      const D = drillRig(S); const m = D.g; m.position.y = BH; st.m = m; st.tracks = D.tracks; st.links = D.links;
      D.mast.rotation.z = Math.PI / 2;
      const HOLE = new THREE.CircleGeometry(0.17, 14), CUT = new THREE.RingGeometry(0.17, 0.5, 14);
      const mkHole = (x) => { const h = grp(S, x, BH + 0.02, 0); add(h, HOLE, MT.black).rotation.x = -Math.PI / 2; add(h, CUT, std(0xe8dcc4, 0.95, 0), 0, -0.005, 0).rotation.x = -Math.PI / 2; return h; };
      const holes = [3.78, 5.58].map((x) => { const h = mkHole(x); h.visible = false; return h; });
      [-6.0, -7.8].forEach((x) => mkHole(x)); // yesterday's row, behind
      beacon(st, m, 0.6, 2.8, 0.55);
      part(st, 'mat', 'le grand mât', anchor(D.mast, 0.8, 3.5, 0.3), true);
      part(st, 'tige', 'la tige qui tourne', anchor(D.head, 0.2, -1.4, 0.25), false);
      part(st, 'chenilles', 'les chenilles', anchor(D.tracks[0].g, 0, 0.6, 0.35), true);
      part(st, 'trous', 'les trous', anchor(S, 4.7, BH + 0.3, 0.9), false);
      st.focusAt = anchor(m, 1.4, 2.6, 0); st.size = { w: 15, h: 11 }; st.tagAt = anchor(m, 0, 5.2, 0); st.el = 0.66;
      st.update = (dt) => {
        roll(st, dt);
        if (st.drill) { D.rod.rotation.y += dt * 16; if (Math.random() < 0.7) dust(wp(D.foot), 1, 0xe2d6bf, 0.5); }
        if (st.moving && Math.random() < 0.15) exhaust(m, -0.4, 3.0, -0.8);
      };
      const drill = async (hole, text, key) => {
        st.drill = true; tone(140, 0, 4, 'sawtooth', 0.02, 180);
        await Promise.all([step(text, key), to(D.head.position, 'y', 0.4, 4.2, lin)]);
        hole.visible = true; pop(hole, 0.4); st.drill = false;
        await to(D.head.position, 'y', 5.2, 1.6, easeSine);
      };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('La foreuse revient au départ.', 'chenilles'), to(D.mast.rotation, 'z', Math.PI / 2, 2), to(m.position, 'x', 0, 2.5)]);
          holes.forEach((h) => (h.visible = false)); st.done = false;
        }
        engineOn(58); st.moving = true;
        await Promise.all([step('La foreuse avance sur ses chenilles, au bord du gradin.', 'chenilles'), to(m.position, 'x', 1.0, 2.6, easeSine)]);
        await Promise.all([step('Elle lève son grand mât, tout droit vers le ciel.', 'mat'), to(D.mast.rotation, 'z', 0, 3.2, easeSine)]);
        await drill(holes[0], 'La tige tourne et descend : elle fait un trou dans la roche !', 'tige');
        await Promise.all([step('Elle avance un tout petit peu...', 'chenilles'), to(m.position, 'x', 2.8, 2.2, easeSine)]);
        await drill(holes[1], '...et elle fait un autre trou, juste à côté.', 'trous');
        await Promise.all([step('Avec tous ces trous, la roche sera plus facile à casser.', 'trous'), to(D.mast.rotation, 'z', Math.PI / 2, 3, easeSine)]);
        st.moving = false; chime(); st.done = true;
      };
    })();

    /* ---- le brise-roche : il casse un rocher trop gros ---- */
    (function () {
      const st = makeStation('briseroche'), S = st.g;
      const E = excavator(S, { k: 1.0, cab: -1, tool: 'hammer' }); const m = E.g; st.m = m; st.tracks = E.tracks; st.links = E.links;
      beacon(st, E.cab, -0.4, 1.75, -0.3);
      const BX = 5.2;
      const boulder = add(S, BOULDER, RM.face[1], BX, 0.85, 0); boulder.scale.set(1.35, 1.0, 1.2); boulder.rotation.set(0.3, 0.6, 0.1);
      const bits = Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * Math.PI * 2, r = i ? 0.9 : 0; const b = add(S, ICO, i % 2 ? QM.stone : QM.stoneD, BX + Math.cos(a) * r, 0.3, Math.sin(a) * r); b.userData.s = rnd(0.32, 0.5); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); b.visible = false; return b; });
      const REST = [3.4, 1.7, -2.0];
      E.reach(...REST);
      part(st, 'marteau', 'le marteau', anchor(E.tool, 1.4, 0, -0.45), true);
      part(st, 'bras', 'le bras', anchor(E.boom, 2.0, 0.9, -0.35), true);
      part(st, 'rocher', 'le gros rocher', anchor(S, BX, 2.2, -1.0), true);
      part(st, 'cabine', 'la cabine', anchor(E.cab, 0, 2.0, 0), false);
      st.focusAt = anchor(S, 2.6, 2.4, 0); st.size = { w: 13, h: 9 }; st.tagAt = anchor(m, 0, 5, 0);
      st.az = camAz(Math.sin(-132 * DEG), -Math.cos(-132 * DEG));
      let T = 0;
      st.update = (dt) => {
        T += dt; roll(st, dt);
        if (st.ham) { E.tool.position.x = 2.5 + Math.sin(T * 70) * 0.06; if (Math.random() < 0.5) { const t = wp(E.tip); throwClod(t, t.clone().add(new V3(rnd(-1.5, 1.5), -1, rnd(-1.5, 1.5))), rnd(0.06, 0.12), STONE); } if (Math.random() < 0.4) dust(wp(E.tip), 1, 0xe2d6bf, 0.4); }
        else E.tool.position.x = 2.5;
      };
      st.action = async function () {
        if (st.done) { bits.forEach((b) => (b.visible = false)); boulder.visible = true; pop(boulder, 0.6); await sleep(0.6); st.done = false; }
        engineOn(55);
        await Promise.all([step('Ce rocher est beaucoup trop gros pour le concasseur.', 'rocher'), sleep(2.2)]);
        await Promise.all([step('Le brise-roche lève son bras et pose son marteau dessus.', 'bras'), E.reachTo(BX, 4.8, -Math.PI / 2, 2.4, easeSine)]);
        await E.reachTo(BX, 4.15, -Math.PI / 2, 0.8, easeSine);
        st.ham = true; for (let i = 0; i < 18; i++) tone(260 + (i % 2) * 40, i * 0.16, 0.08, 'square', 0.05);
        await Promise.all([step('Tac-tac-tac ! Le marteau tape très, très vite.', 'marteau'), sleep(3)]);
        st.ham = false; thud(); boulder.visible = false;
        bits.forEach((b, i) => { b.visible = true; b.scale.setScalar(0.01); tw(0.5, (k) => b.scale.setScalar(b.userData.s * k)); });
        for (let i = 0; i < 10; i++) dust(S.localToWorld(new V3(BX, 0.5, 0)), 1, 0xd8cbb0, 1.2);
        await Promise.all([step('Crac ! Le rocher est cassé en petits morceaux.', 'rocher'), E.reachTo(BX - 0.3, 5.2, -1.9, 1.2, easeSine)]);
        await E.reachTo(...REST, 2, easeSine);
        chime(); st.done = true;
      };
    })();

    /* ---- la grosse pelle : elle remplit le tombereau ---- */
    (function () {
      const st = makeStation('pelle'), S = st.g;
      const E = excavator(S, { k: 1.45, cab: 1, tool: 'bucket', bucket: 1.35 }); const m = E.g; st.m = m; st.tracks = E.tracks; st.links = E.links;
      beacon(st, E.cab, -0.4, 1.75, 0.3);
      const heap = rockHeap(S, 0, 0, -6.8, 3.4, 2.2, 2.4, QM.stone, 16); bake(heap);
      for (let i = 0; i < 8; i++) { const r = add(S, BOULDER, i % 2 ? QM.stone : QM.stoneD, rnd(-3, 3), 0.25, -4 - rnd(0, 1)); r.scale.setScalar(rnd(0.25, 0.45)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
      const REST = [4.3, -0.25, -2.4];
      E.reach(...REST);
      const B = E.heap;
      part(st, 'godet', 'le godet', anchor(E.tool, 0.6, -0.2, 0.9), true);
      part(st, 'bras', 'le bras', anchor(E.boom, 2.2, 1.0, 0.35), true);
      part(st, 'cabine', 'la cabine', anchor(E.cab, 0, 2.0, 0), true);
      part(st, 'chenilles', 'les chenilles', anchor(E.tracks[0].g, 0, 0.6, 0.4), false);
      part(st, 'tas', 'les cailloux', anchor(S, 0, 2.6, -5.5), false);
      part(st, 'benne', 'la benne du tombereau', anchor(S, 7.8, 5.2, 0), false);
      st.focusAt = anchor(S, 2.5, 3.6, -1.5); st.size = { w: 17, h: 12 }; st.tagAt = anchor(m, -1.5, 5.6, 0);
      st.update = (dt) => roll(st, dt);
      /** one dig-and-dump cycle; `say` adds the spoken steps */
      SH.pelleCycle = async function (say) {
        const S0 = say ? step : () => Promise.resolve();
        if (SH.truckReset) await SH.truckReset();
        await Promise.all([S0('La grosse pelle tourne vers le tas de cailloux.', 'cabine'), to(E.tur.rotation, 'y', Math.PI / 2, 2.0, easeSine), E.reachTo(4.1, 0.9, -4.4, 2.0, easeSine)]);
        await Promise.all([S0('Elle plonge son grand godet dans les cailloux...', 'godet'), E.reachTo(3.7, -0.75, -4.3, 1.3, easeSine)]);
        const h = S.localToWorld(new V3(0, 1.2, -5)); for (let i = 0; i < 6; i++) throwClod(h, h.clone().add(new V3(rnd(-1, 1), 0, rnd(-1, 1))), rnd(0.15, 0.3), STONE);
        B.visible = true;
        await Promise.all([S0('...et il ressort tout plein. Il est plus grand qu’une voiture !', 'godet'), E.reachTo(3.3, 0.3, -2.1, 1.3, easeSine)]);
        await E.reachTo(3.8, 2.9, -2.1, 1.2, easeSine);
        await Promise.all([S0('La cabine tourne au-dessus des chenilles.', 'cabine'), to(E.tur.rotation, 'y', 0, 2.2, easeSine), E.reachTo(5.3, 3.4, -2.1, 2.2, easeSine)]);
        await Promise.all([S0('Et hop ! Les cailloux tombent dans la benne du tombereau.', 'benne'), E.reachTo(5.3, 3.4, -4.3, 0.8, easeSine).then(() => {
          const from = wp(E.tip), tg = S.localToWorld(new V3(7.8, 3.6, 0)); B.visible = false; thud();
          for (let i = 0; i < 14; i++) throwClod(from, tg, rnd(0.18, 0.32), i % 2 ? STONE : STONE2);
          if (SH.truckLoad) SH.truckLoad(0.5);
          for (let i = 0; i < 6; i++) dust(tg, 1, 0xd8cbb0, 1);
        })]);
        await E.reachTo(...REST, 1.8, easeSine);
      };
      st.action = async function () { engineOn(48); await SH.pelleCycle(true); chime(); };
    })();

    /* ---- le tombereau : de la pelle jusqu’à la trémie du concasseur ---- */
    (function () {
      const st = makeStation('tombereau'), S = st.g;
      const H = haulTruck(S); const m = H.g; st.m = m; st.links = H.links;
      beacon(st, m, 2.85, 4.72, -1.0);
      // the tipping ramp: an earth ramp, a platform, a concrete stop wall at the end
      const R = RAMP, rd = grp(S);
      ext(rd, [[R.x0, 0], [R.x1, R.H], [R.x2, R.H], [R.x2, 0]], 0, R.w, RM.earth, 0, 0, R.z, 0.02);
      ext(rd, [[R.x0 - 0.4, 0], [R.x1, R.H - 0.05], [R.x2 + 0.05, R.H - 0.05], [R.x2 + 0.05, 0]], 0, R.w + 0.8, std(0xa8936f, 0.95, 0), 0, 0, R.z, 0.02);
      [1, -1].forEach((s) => {
        for (let x = R.x0 + 1; x < R.x2; x += 1.3) { const y = x < R.x1 ? (R.H * (x - R.x0)) / (R.x1 - R.x0) : R.H; rbox(rd, 1.1, 0.55, 0.5, 0.08, QM.conc, x, y + 0.2, R.z + s * (R.w / 2 - 0.1), 0.02); }
      });
      rbox(rd, 0.7, 0.75, R.w, 0.05, QM.conc, R.x2 - 0.35, R.H + 0.37, R.z, 0.02); box(rd, 0.02, 0.4, R.w - 0.4, MT.stripes, R.x2 - 0.71, R.H + 0.42, R.z);
      rbox(rd, R.x2 - R.x1 - 1, 0.04, 0.12, 0.01, MT.white, (R.x1 + R.x2) / 2, R.H + 0.02, R.z, 0.005);
      bake(rd);
      // the route: from the big excavator, a U-turn, then backwards up the ramp
      const RA = route([[0, 0], [4, 0], [8, 2], [9.6, 6], [7.6, 9.6], [3, 11], [-1.5, 11]], false, 0.4);
      const XO = R.x2 - 2.95, XL = 0.85;
      const rampY = (x) => (x <= R.x0 ? 0 : x >= R.x1 ? R.H : (R.H * (x - R.x0)) / (R.x1 - R.x0));
      const settle = () => { const x = m.position.x, yF = rampY(x - 2.3), yR = rampY(x + 1.7); m.position.y = yR + ((yF - yR) * 1.7) / 4.0; m.rotation.z = Math.atan2(yF - yR, 4.0); };
      const spin = spinner(m, H.wheels), lip = anchor(H.bed, -1.7, 0.9, 0);
      let level = 0; const setLoad = (v) => { level = clamp(v, 0, 1); H.load.visible = level > 0.02; H.load.scale.set(1, Math.max(0.05, level), 1); };
      SH.truckLoad = (dv) => { const v0 = level; return tw(0.8, (k) => setLoad(v0 + dv * k)); };
      SH.truckReset = async () => { if (!st.done) return; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); H.bed.rotation.z = 0; setLoad(0); spin(); await pop(m, 0.6); st.done = false; };
      part(st, 'roues', 'les roues géantes', anchor(m, 2.3, 1.4, 2.6), true);
      part(st, 'cabine', 'la cabine', anchor(m, 2.85, 4.95, -1.45), true);
      part(st, 'escalier', "l'escalier", anchor(m, 4.3, 2.2, -1.2), false);
      part(st, 'benne', 'la benne', anchor(H.bed, 1.5, 2.7, 0), true);
      part(st, 'verins', 'les vérins', anchor(m, -0.4, 3.0, 1.2), false);
      part(st, 'tremie', 'la trémie', anchor(S, R.x2 + 2, R.H + 1.0, R.z + 2.6), false);
      st.focusAt = anchor(m, 0, 2.6, 0); st.size = { w: 17, h: 11 }; st.tagAt = anchor(m, 0.5, 5.4, 0);
      st.update = (dt) => { roll(st, dt); spin(); if (st.moving && Math.random() < 0.35) dust(m.localToWorld(new V3(-1.7, 0, rnd(-2.4, 2.4))), 1, 0xd8cbb0, 0.8); if (st.moving && Math.random() < 0.2) exhaust(m, 3.55, 4.1, 0.8); };
      st.action = async function () {
        if (st.done) await SH.truckReset();
        engineOn(46);
        if (level < 0.5) await Promise.all([step('La grosse pelle remplit la benne avec des cailloux.', 'benne'), (async () => { await SH.pelleCycle(false); if (level < 0.6) await SH.pelleCycle(false); })()]);
        engineOn(46); st.moving = true;
        await Promise.all([step('Le tombereau part vers le concasseur. Ses roues sont plus grandes qu’un papa !', 'roues'), along(m, RA, 0, RA.len, 7.5, easeSine)]);
        st.reversing = true; st.beepT = 0;
        await Promise.all([step('Bip, bip ! Il recule, tout en haut de la rampe.', 'cabine'), tw(6, (k) => { m.position.x = -1.5 + (XO + 1.5) * k; settle(); }, easeSine)]);
        st.reversing = false; st.moving = false;
        const into = wp(SH.hopper, 0.3);
        let sent = 0;
        await Promise.all([step('Sa benne se lève : les cailloux tombent dans la trémie !', 'verins'), to(H.bed.rotation, 'z', XL, 3.2, easeSine),
          sleep(1.2).then(() => { thud(); if (SH.hopperFill) SH.hopperFill(1); return tw(2, (k) => { setLoad(1 - k); H.load.position.x = 1.7 - 1.6 * k; const want = Math.floor(k * 22); while (sent < want) { throwClod(wp(lip), into, rnd(0.18, 0.34), sent % 2 ? STONE : STONE2); sent++; } }); })]);
        H.load.position.x = 1.7; setLoad(0);
        await Promise.all([step('La benne redescend. Le tombereau repart chercher d’autres cailloux.', 'benne'), to(H.bed.rotation, 'z', 0, 2.4, easeSine)]);
        st.moving = true;
        await tw(3.6, (k) => { m.position.x = XO - (XO - 3) * k; settle(); }, easeSine);
        st.moving = false; chime(); st.done = true;
      };
    })();

    /* ---- le concasseur : la trémie, les mâchoires, le tapis ---- */
    const crib = makeStation('crible');
    (function () {
      const st = makeStation('concasseur'), S = st.g;
      const d = grp(S);
      // the hopper on four legs, at the end of the truck ramp
      const hg = new THREE.CylinderGeometry(1, 0.37, 1.2, 4, 1, true); hg.rotateY(Math.PI / 4);
      add(d, hg, QM.plantIn, 0, 2.95, 0).scale.set(2.69, 1, 3.82);
      [[0, 2.7, 3.9, 0.15], [0, -2.7, 3.9, 0.15]].forEach(([x, z, l, t]) => rbox(d, l, 0.2, t, 0.03, QM.plantD, x, 3.55, z, 0.01));
      [1.95, -1.95].forEach((x) => rbox(d, 0.15, 0.2, 5.5, 0.03, QM.plantD, x, 3.55, 0, 0.01));
      [[1.85, 2.6], [1.85, -2.6], [-1.75, 2.6], [-1.75, -2.6]].forEach(([x, z]) => rbox(d, 0.26, 3.5, 0.26, 0.04, QM.plant, x, 1.75, z, 0.01));
      [2.6, -2.6].forEach((z) => { rod(d, new V3(1.85, 0.3, z), new V3(-1.75, 2.9, z), 0.06, QM.plantD, 6); rod(d, new V3(1.85, 2.9, z), new V3(-1.75, 0.3, z), 0.06, QM.plantD, 6); });
      rbox(d, 1.2, 0.35, 1.6, 0.04, QM.plantD, 0.15, 2.25, 0, 0.02); // feeder
      // the jaw crusher: a heavy steel frame (the near side is open, to see the jaws)
      ext(d, [[-0.95, 0.7], [1.15, 0.7], [1.25, 2.15], [-1.05, 2.25]], 0.05, 0.14, QM.plant, 0, 0, -0.75, 0.02);
      rbox(d, 2.3, 0.22, 0.16, 0.04, QM.plant, 0.15, 2.12, 0.75, 0.01); rbox(d, 2.1, 0.2, 0.16, 0.04, QM.plant, 0.1, 0.8, 0.75, 0.01);
      [-0.95, 1.15].forEach((x) => rbox(d, 0.2, 1.5, 0.16, 0.04, QM.plant, x, 1.45, 0.75, 0.01));
      slab(d, [-0.62, 2.05], [-0.22, 0.85], 0.22, 1.35, QM.wear); for (let i = 0; i < 5; i++) slab(d, [-0.5 + i * 0.075, 1.9 - i * 0.24], [-0.4 + i * 0.075, 1.9 - i * 0.24], 0.06, 1.35, MT.dark);
      rbox(d, 1.9, 0.6, 1.6, 0.06, QM.conc, 0.1, 0.3, 0, 0.02); // plinth
      rbox(d, 0.8, 0.7, 0.7, 0.06, MT.dark, -0.4, 0.95, -2.0, 0.02); cylX(d, 0.32, 0.9, std(0x2f7a4a, 0.5, 0.3), -0.4, 1.0, -2.0, 16); // motor
      rbox(d, 0.25, 0.55, 1.6, 0.04, MT.yel, 0.75, 1.55, -1.55, 0.02); // belt guard
      // operator platform with stairs and a little control cabin
      rbox(d, 1.6, 0.08, 1.4, 0.02, QM.grate, 2.6, 2.4, 1.2, 0.01); [[3.35, 1.85], [3.35, 0.55], [1.85, 1.85]].forEach(([x, z]) => rbox(d, 0.12, 2.4, 0.12, 0.02, QM.plant, x, 1.2, z, 0.01));
      rail(d, [[1.85, 2.45, 1.9], [1.85, 3.4, 1.9], [3.4, 3.4, 1.9], [3.4, 3.4, 0.5], [3.4, 2.45, 0.5]], 0.03, MT.yel);
      for (let i = 0; i < 8; i++) rbox(d, 0.32, 0.04, 0.8, 0.01, QM.grate, 3.75 + i * 0.3, 2.3 - i * 0.3, 1.5, 0.01);
      rod(d, new V3(3.7, 3.2, 1.92), new V3(6.1, 0.85, 1.92), 0.03, MT.yel);
      rbox(d, 1.4, 1.6, 1.3, 0.06, RM.cabin, 3.3, 0.8, -1.4, 0.02); box(d, 0.9, 0.55, 0.04, MT.glassD, 3.3, 1.15, -0.74); rbox(d, 1.5, 0.12, 1.4, 0.03, QM.plantD, 3.3, 1.66, -1.4, 0.01);
      bake(d);
      const hopperHeap = rockHeap(S, 0.1, 2.75, 0, 1.7, 0.9, 2.4, QM.stone, 10); hopperHeap.visible = false;
      SH.hopper = anchor(S, 0.1, 3.0, 0);
      SH.hopperFill = (v) => { hopperHeap.visible = v > 0.02; hopperHeap.scale.y = Math.max(0.05, v); hopperHeap.position.y = 2.6 + 0.15 * v; };
      // the swinging jaw and the two big flywheels
      const jaw = grp(S, 0.78, 2.15, 0); slab(jaw, [0, 0], [-0.42, -1.25], 0.26, 1.3, QM.wear); for (let i = 0; i < 5; i++) slab(jaw, [-0.08 - i * 0.075, -0.15 - i * 0.24], [-0.16 - i * 0.075, -0.13 - i * 0.24], 0.06, 1.3, MT.dark);
      rbox(jaw, 0.4, 0.4, 1.2, 0.05, QM.plantD, 0.1, 0.05, 0, 0.02);
      const fly = [1.05, -1.05].map((z) => { const f = grp(S, 0.78, 2.15, z); cylZ(f, 0.86, 0.16, MT.dark, 0, 0, 0, 28); cylZ(f, 0.7, 0.18, QM.plantD, 0, 0, 0, 24); cylZ(f, 0.18, 0.3, MT.steel, 0, 0, 0, 12); for (let k = 0; k < 4; k++) { const sp = box(f, 0.12, 1.3, 0.2, MT.dark, 0, 0, 0); sp.rotation.z = (k * Math.PI) / 4; } box(f, 0.3, 0.3, 0.22, MT.yel, 0.5, 0, 0); return f; });
      const chamber = [0, 1, 2].map((i) => { const r = add(S, ICO, QM.stone, 0.2 + i * 0.05, 1.9 - i * 0.4, (i - 1) * 0.3); r.scale.setScalar(0.32 - i * 0.07); r.visible = false; return r; });
      // the belt conveyor from under the crusher up to the screen
      S.updateMatrixWorld(true); crib.g.updateMatrixWorld(true);
      const A = new V3(0.3, 0.55, 0), Bw = crib.g.localToWorld(new V3(-2.05, 5.85, 0)), B = S.worldToLocal(Bw.clone());
      const belt = conveyor(S, A, B, { w: 0.95, color: [0xbdb09a, 0xa89c88, 0xcfc3ad], walk: 1, leg0: 3 });
      SH.feedBelt = belt;
      part(st, 'tremie', 'la trémie', anchor(S, 0, 3.9, 2.7), true);
      part(st, 'machoires', 'les mâchoires', anchor(S, 0.2, 1.45, 0.85), true);
      part(st, 'volant', 'le volant', anchor(fly[0], 0, 0.95, 0.12), false);
      part(st, 'tapis', 'le tapis roulant', anchor(belt.g, belt.L * 0.45, 0.6, 0), true);
      st.focus = new V3(1.6, 2.4, 2.0); st.size = { w: 15, h: 10 }; st.tagAt = anchor(S, 0, 4.8, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; const rpm = st.rpm || 0;
        fly.forEach((f) => (f.rotation.z -= dt * rpm)); jaw.rotation.z = rpm > 0.5 ? Math.sin(T * rpm) * 0.07 : jaw.rotation.z * 0.9;
        belt.update(dt);
        if (st.crush && Math.random() < 0.3) { const p = S.localToWorld(new V3(0.2, 1.6, 0.6)); throwClod(p, p.clone().add(new V3(rnd(-1, 1), -1.2, rnd(0.5, 1.5))), rnd(0.06, 0.1), STONE); }
      };
      st.action = async function () {
        engineOn(70);
        if (!hopperHeap.visible) { SH.hopperFill(1); pop(hopperHeap, 0.5); }
        await Promise.all([step('Les gros cailloux tombent dans la grande trémie.', 'tremie'), sleep(2)]);
        tone(70, 0, 2, 'sawtooth', 0.04, 110);
        await Promise.all([step('Le grand volant se met à tourner...', 'volant'), tw(2, (k) => (st.rpm = 9 * k), lin)]);
        chamber.forEach((c) => { c.visible = true; c.scale.setScalar(0.32); }); st.crush = true; belt.running = true;
        await Promise.all([step('...et les mâchoires en acier serrent les cailloux. Crac, crac !', 'machoires'),
          tw(3.5, (k) => { chamber.forEach((c, i) => c.scale.setScalar((0.32 - i * 0.07) * (1 - 0.6 * k))); SH.hopperFill(1 - 0.6 * k); if (Math.random() < 0.08) thud(); }, lin)]);
        belt.feed = true;
        await Promise.all([step('Les petits cailloux tombent sur le tapis roulant.', 'tapis'), sleep(2.5)]);
        await Promise.all([step('Le tapis les emmène tout en haut, jusqu’au crible.', 'tapis'), sleep(Math.min(6, belt.L / belt.speed + 0.5))]);
        belt.feed = false; st.crush = false; chamber.forEach((c) => (c.visible = false)); SH.hopperFill(0.4);
        await tw(1.8, (k) => (st.rpm = 9 * (1 - k)), lin); st.rpm = 0;
        await sleep(Math.min(3, belt.L / belt.speed)); belt.running = false; belt.fill(false);
        chime();
      };
    })();

    /* ---- le crible : la grande passoire qui tremble, et ses trois tas ---- */
    (function () {
      const st = crib, S = st.g;
      const t = grp(S);
      // steel tower with bracing, ladder and a walkway
      [[1.6, 1.4], [1.6, -1.4], [-1.6, 1.4], [-1.6, -1.4]].forEach(([x, z]) => rbox(t, 0.24, 4.0, 0.24, 0.03, QM.plant, x, 2.0, z, 0.01));
      [1.4, -1.4].forEach((z) => { rod(t, new V3(1.6, 0.3, z), new V3(-1.6, 3.7, z), 0.05, QM.plantD, 6); rod(t, new V3(1.6, 3.7, z), new V3(-1.6, 0.3, z), 0.05, QM.plantD, 6); });
      [1.6, -1.6].forEach((x) => { rod(t, new V3(x, 0.3, 1.4), new V3(x, 3.7, -1.4), 0.05, QM.plantD, 6); });
      rbox(t, 3.6, 0.2, 3.2, 0.03, QM.plantD, 0, 4.0, 0, 0.01);
      rbox(t, 3.8, 0.05, 0.7, 0.01, QM.grate, 0, 4.12, 1.95, 0.01); rail(t, [[-1.9, 4.15, 2.3], [-1.9, 5.05, 2.3], [1.9, 5.05, 2.3], [1.9, 4.15, 2.3]], 0.03, MT.yel);
      for (let y = 0.35; y < 4.1; y += 0.35) box(t, 0.04, 0.04, 0.5, MT.yel, -1.95, y, 2.2); [1.95, 2.45].forEach((z) => box(t, 0.04, 4.2, 0.04, MT.yel, -1.95, 2.1, z));
      // springs between the tower and the screen
      [[1.4, 1.1], [1.4, -1.1], [-1.4, 1.1], [-1.4, -1.1]].forEach(([x, z]) => { cylY(t, 0.13, 0.45, MT.red, x, 4.32 + (x > 0 ? 0 : 0.7), z, 10); });
      // collecting chutes under the screen
      const cg = new THREE.CylinderGeometry(0.9, 0.35, 0.9, 4, 1, true); cg.rotateY(Math.PI / 4);
      [[-0.9, 0], [0.6, 0], [2.1, 0]].forEach(([x, z]) => add(t, cg, QM.plantIn, x, 3.45, z).scale.set(0.9, 1, 1.5));
      bake(t);
      // the screen: an inclined box with three decks, its exciter on top
      const scr = grp(S, 0, 4.95, 0); scr.rotation.z = -0.24; const sd = grp(scr);
      [1.2, -1.2].forEach((z) => { rbox(sd, 4.4, 1.3, 0.1, 0.04, QM.plant, 0, 0.2, z, 0.02); for (let x = -1.8; x <= 1.8; x += 0.9) rbox(sd, 0.1, 1.32, 0.14, 0.02, QM.plantD, x, 0.2, z, 0.01); });
      [[-0.3, 0x7a7e86], [0.15, 0x6a6e76], [0.6, 0x5a5e66]].forEach(([y, c]) => { box(sd, 4.3, 0.04, 2.3, std(c, 0.6, 0.4), 0, y, 0); });
      for (let x = -2.0; x <= 2.0; x += 0.25) box(sd, 0.03, 0.03, 2.3, MT.dark, x, 0.63, 0); for (let z = -1.0; z <= 1.0; z += 0.25) box(sd, 4.3, 0.03, 0.03, MT.dark, 0, 0.63, z);
      rbox(sd, 0.9, 0.9, 2.5, 0.05, QM.plantD, -2.4, 0.55, 0, 0.02); // feed box
      cylZ(sd, 0.14, 2.6, MT.steel, 0.2, 1.15, 0, 12); [1.3, -1.3].forEach((z) => cylZ(sd, 0.45, 0.16, MT.yel, 0.2, 1.15, z, 20)); rbox(sd, 0.6, 0.5, 0.5, 0.05, MT.dark, -0.6, 1.1, 0.0, 0.02);
      bake(sd);
      const onScreen = Array.from({ length: 14 }, (_, i) => { const r = add(scr, ICO, i % 2 ? QM.stone : QM.stoneD, rnd(-1.8, 1.8), 0.75, rnd(-0.9, 0.9)); r.scale.setScalar(rnd(0.08, 0.16)); r.visible = false; return r; });
      // three radial conveyors make three piles: sand, fine gravel, coarse gravel
      const prods = [
        { A: new V3(2.3, 1.5, 0), B: new V3(7.4, 4.6, 0), m: RM.coarse, col: [0x6e6964, 0x5e5a56], size: 1.15, label: 'les gros graviers' },
        { A: new V3(0.5, 1.5, 1.0), B: new V3(1.8, 4.4, 6.6), m: RM.fine, col: [0xa3a3a6, 0x929296], size: 0.8, label: 'les petits graviers' },
        { A: new V3(0.5, 1.5, -1.0), B: new V3(1.8, 4.4, -6.6), m: RM.sand, col: [0xe9bf6a, 0xdcae58], size: 0.55, label: 'le sable' }
      ];
      const belts = prods.map((p, i) => conveyor(S, p.A, p.B, { w: 0.7, color: p.col, size: p.size, walk: i === 2 ? 1 : -1, walkway: false, leg0: 2.2, legStep: 2.6, speed: 2.6 }));
      const PILE = new THREE.ConeGeometry(1, 1, 16, 1, false); PILE.translate(0, 0.5, 0);
      const piles = prods.map((p) => { const dir = new V3(p.B.x - p.A.x, 0, p.B.z - p.A.z).normalize(); const c = p.B.clone().addScaledVector(dir, 0.7); const g = grp(S, c.x, 0, c.z); const k = add(g, PILE, p.m); k.scale.set(3.0, 2.7, 3.0); for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), r = rnd(0.5, 2.6); const s = add(g, ICO, p.m, Math.cos(a) * r, 2.7 * (1 - r / 3.0) - 0.05, Math.sin(a) * r); s.scale.setScalar(0.12 * p.size + 0.05); } bake(g); g.scale.setScalar(0.8); return g; });
      part(st, 'crible', 'le crible', anchor(scr, 0.6, 1.1, 1.3), true);
      part(st, 'grilles', 'les grilles à trous', anchor(scr, 1.2, 0.7, 1.1), false);
      part(st, 'tapis', 'le tapis', anchor(SH.feedBelt.head, -2.0, 0.6, 0), false);
      part(st, 'tas', 'les trois tas', anchor(piles[0], 0, 2.6, 0), true);
      st.focus = new V3(2.0, 2.6, 0); st.size = { w: 21, h: 12 }; st.tagAt = anchor(S, 0, 7.4, 0);
      st.az = camAz(0.15, 1);
      let T = 0;
      st.update = (dt) => {
        T += dt;
        scr.position.y = 4.95 + (st.shake ? Math.sin(T * 55) * 0.05 : 0); scr.position.x = st.shake ? Math.cos(T * 55) * 0.05 : 0;
        if (st.shake) onScreen.forEach((r) => { r.position.x += dt * 0.9; if (r.position.x > 2.1) r.position.x = -2; r.position.y = 0.72 + Math.abs(Math.sin(T * 30 + r.id)) * 0.08; });
        belts.forEach((b) => b.update(dt));
      };
      st.action = async function () {
        if (st.done) { await tw(0.6, (k) => piles.forEach((g) => g.scale.set(0.92 - 0.12 * k, 1 - 0.2 * k, 0.92 - 0.12 * k))); st.done = false; }
        const fb = SH.feedBelt; fb.running = true; fb.feed = true;
        await Promise.all([step('Le tapis roulant apporte les cailloux cassés, tout en haut du crible.', 'tapis'), sleep(3)]);
        st.shake = true; onScreen.forEach((r) => (r.visible = true)); tone(48, 0, 9, 'square', 0.015, 52);
        await Promise.all([step('Le crible tremble très vite, comme une grande passoire !', 'crible'), sleep(2.6)]);
        belts.forEach((b) => { b.running = true; b.feed = true; });
        await Promise.all([step('Les petits grains passent par les trous. Les gros restent sur la grille.', 'grilles'), sleep(3.2)]);
        await Promise.all([step('Chaque tapis fait son tas : le sable, les petits graviers et les gros graviers.', 'tas'),
          tw(4.5, (k) => piles.forEach((g) => { g.scale.y = 0.8 + 0.2 * k; g.scale.x = g.scale.z = 0.8 + 0.12 * k; }), lin)]);
        fb.feed = false; belts.forEach((b) => (b.feed = false)); await sleep(2);
        st.shake = false; onScreen.forEach((r) => (r.visible = false)); fb.running = false; fb.fill(false); belts.forEach((b) => { b.running = false; b.fill(false); });
        chime(); st.done = true;
      };
    })();

    /* ---- la chargeuse : elle remplit le camion, qui part au chantier ---- */
    (function () {
      const st = makeStation('chargeuse'), S = st.g;
      const L = wheelLoader(S); const m = L.g; st.m = m; st.links = L.links;
      beacon(st, m, -0.6, 3.6, 0.5);
      const PILE = new THREE.ConeGeometry(3.4, 2.8, 18, 1, false); PILE.translate(0, 1.4, 0);
      const pg = grp(S, -6.8, 0, -3); add(pg, PILE, RM.stock); for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28), r = rnd(0.6, 3.1); add(pg, ICO, RM.stock, Math.cos(a) * r, 2.8 * (1 - r / 3.4), Math.sin(a) * r).scale.setScalar(rnd(0.1, 0.18)); } bake(pg);
      const TK = roadTipper(S, MT.blue, MT.red); const truck = TK.g; truck.position.set(6.0, 0, 3.4);
      // the weighbridge with its little hut and a traffic light
      const wb = grp(S, 18, 0, 3.4);
      rbox(wb, 10, 0.2, 3.3, 0.04, std(0x7c828c, 0.5, 0.5), 0, 0.1, 0, 0.02); for (let x = -4.5; x <= 4.5; x += 1.5) box(wb, 0.05, 0.02, 3.2, MT.dark, x, 0.21, 0);
      [1, -1].forEach((s) => { rbox(wb, 1.0, 0.2, 3.3, 0.04, QM.conc, s * 5.4, 0.08, 0, 0.02); rbox(wb, 10, 0.12, 0.12, 0.02, MT.yel, 0, 0.26, s * 1.7, 0.01); });
      rbox(wb, 2.6, 2.3, 2.0, 0.08, RM.cabin, 0, 1.15, 3.6, 0.02); rbox(wb, 2.8, 0.15, 2.2, 0.04, RM.cabinB, 0, 2.35, 3.6, 0.02);
      box(wb, 1.2, 0.7, 0.04, MT.glassD, 0.5, 1.4, 4.61); box(wb, 0.7, 1.6, 0.04, RM.cabinB, -0.8, 0.85, 4.61); box(wb, 0.04, 0.7, 1.2, MT.glassD, 1.31, 1.4, 3.6);
      decal(wb, 'BASCULE', 2.0, 0.35, '#2f6fe0', 0, 2.05, 4.63);
      cylY(wb, 0.06, 2.6, MT.dark, 5.6, 1.3, 2.0, 8); rbox(wb, 0.3, 0.75, 0.3, 0.04, MT.black, 5.6, 2.6, 2.0, 0.02);
      bake(wb);
      const red = std(0xff3a2a, 0.5, 0, { emissive: 0xff2010, emissiveIntensity: 0.9 }), green = std(0x3aff6a, 0.5, 0, { emissive: 0x10d040, emissiveIntensity: 0 });
      sph(wb, 0.1, red, 5.6, 2.78, 2.17); sph(wb, 0.1, green, 5.6, 2.45, 2.17);
      const screenNum = decal(wb, '0 t', 0.8, 0.36, '#3aff6a', 0.5, 0.75, 4.63, '#1d1f26');
      const screen28 = decal(wb, '28 t', 0.8, 0.36, '#3aff6a', 0.5, 0.75, 4.635, '#1d1f26'); screen28.visible = false;
      const R1 = route([[-0.6, -3], [2.0, -3.3], [4.0, -5.0], [4.8, -7.0]], false, 0.4);
      const R2 = route([[4.8, -7.0], [5.2, -4.6], [5.3, -1.4]], false, 0.4);
      const OUT = route([[18, 3.4], [23, 3.5], [27.5, 6.5], [31, 12], [35, 19], [38, 25]], false, 0.4);
      const spinL = spinner(m, L.wheels), spinT = spinner(truck, TK.wheels);
      let prevA = 0, prevP = new V3();
      const bend = () => { const dA = Math.atan2(Math.sin(m.rotation.y - prevA), Math.cos(m.rotation.y - prevA)), ds = m.position.distanceTo(prevP); if (ds > 1e-4) L.front.rotation.y += (clamp((dA / ds) * 3.2 * (st.rev ? -1 : 1), -0.55, 0.55) - L.front.rotation.y) * 0.25; prevA = m.rotation.y; prevP.copy(m.position); };
      const home = () => { m.position.set(0.5, 0, -3); m.rotation.set(0, Math.PI, 0); L.front.rotation.y = 0; L.pose(-0.69, 0); L.heap.visible = false; prevA = m.rotation.y; prevP.copy(m.position); };
      home();
      part(st, 'godet', 'le godet', anchor(L.bucket, 0.8, 0.9, 1.9), true);
      part(st, 'bras', 'les bras', anchor(L.arms, 1.6, 0.4, 0.75), false);
      part(st, 'articulation', 'elle se plie ici', anchor(L.g, 0, 1.8, 1.2), false);
      part(st, 'roues', 'les grosses roues', anchor(L.g, -1.7, 1.2, 1.9), true);
      part(st, 'camion', 'le camion', anchor(truck, 0, 3.3, 0), false);
      part(st, 'bascule', 'la bascule', anchor(S, 18, 0.6, 5.3), false);
      st.focus = new V3(7, 2.2, 1.2); st.size = { w: 27, h: 12 }; st.tagAt = anchor(m, 0, 4.6, 0);
      st.update = (dt) => { roll(st, dt); spinL(); spinT(); if (st.moving && Math.random() < 0.2) exhaust(m, -2.2, 3.1, 0.45); };
      st.action = async function () {
        if (st.done) { home(); truck.visible = true; truck.position.set(6.0, 0, 3.4); truck.rotation.set(0, 0, 0); TK.load.visible = false; spinT(); green.emissiveIntensity = 0; red.emissiveIntensity = 0.9; screenNum.visible = true; screen28.visible = false; pop(truck, 0.5); await pop(m, 0.5); st.done = false; }
        engineOn(52); st.moving = true;
        await Promise.all([step('La chargeuse plonge son godet dans le tas de gravier.', 'godet'), to(m.position, 'x', -0.6, 1.8, easeSine)]);
        const h = S.localToWorld(new V3(-5.4, 1, -3)); for (let i = 0; i < 6; i++) throwClod(h, h.clone().add(new V3(rnd(-1, 1), 0, rnd(-1, 1))), rnd(0.1, 0.2), 0x8f9aa8);
        L.heap.visible = true; await L.poseTo(-0.55, 0.6, 1.2, easeSine);
        st.rev = true; st.reversing = true; st.beepT = 0;
        await Promise.all([step('Elle recule en tournant. Pour tourner, elle se plie au milieu !', 'articulation'), L.poseTo(-0.3, 0.6, 2), tw(4, (k) => { placeOn(m, R1, R1.len * k); m.rotation.y += Math.PI; bend(); }, easeSine)]);
        st.rev = false; st.reversing = false;
        await Promise.all([step('Elle lève son godet tout en haut...', 'bras'), L.poseTo(0.65, 0.6, 3.2, easeSine), tw(3.2, (k) => { placeOn(m, R2, R2.len * k); bend(); }, easeSine)]);
        L.front.rotation.y = 0;
        await Promise.all([step('...et elle vide le gravier dans le camion.', 'camion'), L.poseTo(0.65, -0.9, 1.2, easeSine).then(() => {
          const from = wp(L.bucket, -0.2), tg = truck.localToWorld(new V3(-1.45, 2.2, 0)); L.heap.visible = false; thud();
          for (let i = 0; i < 14; i++) throwClod(from, tg, rnd(0.1, 0.2), 0x8f9aa8); TK.load.visible = true; pop(TK.load, 0.6);
        }), sleep(2)]);
        await Promise.all([L.poseTo(-0.3, 0.6, 1.6), tw(1.6, (k) => { placeOn(m, R2, R2.len * (1 - 0.6 * k)); }, easeSine)]);
        st.moving = false;
        engineOn(60);
        await Promise.all([step('Le camion monte sur la bascule : on le pèse !', 'bascule'), to(truck.position, 'x', 18, 4, easeSine)]);
        screenNum.visible = false; screen28.visible = true; ding(); await sleep(1.2); red.emissiveIntensity = 0; green.emissiveIntensity = 1.2;
        await Promise.all([step('C’est bon ! Il part livrer le gravier au chantier. Au revoir !', 'camion'), along(truck, OUT, 0, OUT.len, 6, easeIn)]);
        truck.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- le camion arroseur : plus de poussière sur la piste ---- */
    (function () {
      const st = makeStation('arroseuse'), S = st.g;
      const W = waterTruck(S, MT.orange); const m = W.g; st.m = m;
      beacon(st, m, 2.9, 2.95, 0.5);
      // the little pond with reeds and two ducks
      const pd = grp(S, -1, 0, 6.2);
      const water = add(pd, new THREE.CircleGeometry(3.0, 30), RM.water, 0, 0.05, 0); water.rotation.x = -Math.PI / 2; water.scale.set(1.45, 1, 1);
      const bank = add(pd, new THREE.RingGeometry(3.0, 3.6, 30), std(0x9a8462, 0.95, 0), 0, 0.04, 0); bank.rotation.x = -Math.PI / 2; bank.scale.set(1.45, 1, 1);
      for (let i = 0; i < 16; i++) { const a = rnd(0.4, 2.8) + (i % 2 ? Math.PI : 0), r = rnd(3.2, 3.6); const x = Math.cos(a) * r * 1.45, z = Math.sin(a) * r; for (let k = 0; k < 3; k++) { const c = cylY(pd, 0.03, rnd(0.7, 1.3), RM.reed, x + rnd(-0.15, 0.15), 0.45, z + rnd(-0.15, 0.15), 4); c.rotation.z = rnd(-0.2, 0.2); } }
      for (let i = 0; i < 8; i++) { const a = rnd(0, 6.28); add(pd, ICO, QM.stoneD, Math.cos(a) * 4.4, 0.1, Math.sin(a) * 3.3).scale.set(rnd(0.25, 0.5), 0.2, rnd(0.25, 0.5)); }
      bake(pd);
      const ducks = [[1.2, -0.6], [2.0, 0.4]].map(([x, z]) => { const dk = grp(pd, x, 0.08, z); sph(dk, 0.22, MT.white, 0, 0.12, 0).scale.set(0.3, 0.18, 0.2); sph(dk, 0.1, std(0x2f7a4a, 0.5, 0), 0.22, 0.3, 0); box(dk, 0.12, 0.04, 0.07, MT.orange, 0.34, 0.29, 0); box(dk, 0.14, 0.1, 0.02, std(0xc8c8c8, 0.6, 0), -0.05, 0.2, 0.2); return dk; });
      // the hose from the pump down to the pond
      const hose = grp(S); rail(hose, [[0.9, 1.35, 1.2], [0.6, 0.3, 2.2], [0.0, 0.12, 3.4], [-0.6, 0.06, 4.4]], 0.07, std(0x2b5bbd, 0.6, 0)); hose.visible = false;
      const wet = add(S, new THREE.PlaneGeometry(1, 3.4), std(0x9a8566, 0.6, 0.1), 0, 0.04, 0); wet.rotation.x = -Math.PI / 2; wet.visible = false;
      const spin = spinner(m, W.wheels);
      part(st, 'citerne', 'la citerne', anchor(m, -1.2, 3.3, 1.2), true);
      part(st, 'jets', "les jets d'eau", anchor(m, -3.7, 0.6, 1.0), true);
      part(st, 'canon', 'le canon à eau', anchor(W.barrel, 0.5, 0.3, 0), false);
      part(st, 'etang', "l'étang", anchor(S, -1, 0.6, 9.2), false);
      part(st, 'piste', 'la piste', anchor(S, 12, 0.4, 2.2), false);
      st.focusAt = anchor(m, 1.5, 1.8, 0); st.size = { w: 17, h: 9.5 }; st.tagAt = anchor(m, 0, 4.4, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; spin(); ducks.forEach((dk, i) => { dk.position.x = (i ? 2.0 : 1.2) + Math.sin(T * 0.4 + i * 2) * 0.8; dk.rotation.y = Math.cos(T * 0.4 + i * 2) > 0 ? 0 : Math.PI; });
        if (st.spray) { const q = m.getWorldQuaternion(new THREE.Quaternion()); W.nozzles.forEach((n) => { if (Math.random() < 0.7) fx.smoke(wp(n), new V3(-2.2, -0.6, rnd(-0.7, 0.7)).applyQuaternion(q), rnd(0.12, 0.2), 0xcfe8ff, 0.7); }); }
        if (st.cannon) for (let i = 0; i < 2; i++) { const p = wp(W.tip), dir = wp(W.tip).sub(wp(W.barrel)).normalize(); fx.smoke(p, dir.multiplyScalar(rnd(7, 9)).add(new V3(0, 1, 0)), rnd(0.15, 0.25), 0xcfe8ff, 1.1); }
        if (st.fill && Math.random() < 0.4) fx.smoke(S.localToWorld(new V3(-0.6 + rnd(-0.3, 0.3), 0.1, 4.5)), new V3(0, 0.5, 0), 0.12, 0xe8f6ff, 0.6);
        if (st.dusty && Math.random() < 0.5) { const x = rnd(m.position.x + 3, 18); dust(S.localToWorld(new V3(x, 0.1, rnd(-1.5, 1.5))), 1, 0xd8cbb0, 1.1); }
        if (st.moving && Math.random() < 0.2) exhaust(m, 3.4, 2.9, -0.8);
      };
      st.action = async function () {
        if (st.done) { wet.visible = false; m.position.x = 0; W.barrel.rotation.y = 0; pop(m, 0.5); await sleep(0.5); st.done = false; }
        engineOn(50); hose.visible = true; pop(hose, 0.4); st.fill = true; tone(180, 0, 3, 'triangle', 0.02, 220);
        await Promise.all([step('Le camion arroseur remplit sa citerne avec l’eau de l’étang.', 'citerne'), sleep(3.4)]);
        st.fill = false; hose.visible = false; st.dusty = true;
        await Promise.all([step('Sur la piste, les gros camions font plein de poussière !', 'piste'), sleep(2.8)]);
        st.spray = true; st.moving = true; wet.visible = true;
        await Promise.all([step('Psssh ! Il arrose la piste en roulant.', 'jets'), tw(7, (k) => { m.position.x = 14 * k; const L0 = Math.max(0.01, m.position.x); wet.scale.x = L0; wet.position.x = -3.7 + L0 / 2; if (k > 0.35) st.dusty = false; }, easeSine)]);
        st.spray = false; st.moving = false; st.cannon = true;
        await Promise.all([step('Avec son canon, il peut aussi arroser très loin !', 'canon'), tw(3, (k) => (W.cannon.rotation.y = Math.sin(k * Math.PI * 2) * 0.8), lin)]);
        st.cannon = false;
        await Promise.all([step('La piste est mouillée : plus de poussière ! Tout le monde respire mieux.', 'piste'), sleep(2.6)]);
        chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the pit around the machines ================= */
const wpt = (deg, r, y) => { const [h, d] = polar(deg, r); const [x, z] = Q(h, d); return new V3(x, y, z); };
/** Sweep a closed (r, y) cross-section around the pit centre between two map angles. em[e] picks the material of edge e (−1: none). */
function sweep(p, a0, a1, n, prof, M, em, capM = 0) {
  const buf = M.map(() => []); const push = (mi, ...v) => v.forEach((q) => buf[mi].push(q.x, q.y, q.z));
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + (a1 - a0) * t, sec = prof(t, a).map(([r, y]) => wpt(a, r, y));
    if (prev) for (let e = 0; e < sec.length; e++) { const e2 = (e + 1) % sec.length; if (em[e] < 0) continue; push(em[e], prev[e], prev[e2], sec[e2], prev[e], sec[e2], sec[e]); }
    if (capM >= 0 && (i === 0 || i === n)) for (let e = 1; e < sec.length - 1; e++) push(capM, sec[0], sec[e], sec[e + 1]);
    prev = sec;
  }
  buf.forEach((b, mi) => { if (!b.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b, 3)); g.computeVertexNormals(); const mesh = new THREE.Mesh(g, M[mi]); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh); });
}
const jit = (a, k) => 0.32 * Math.sin(a * 0.23 + k * 1.7) + 0.2 * Math.sin(a * 0.71 + k * 3.1) + 0.1 * Math.sin(a * 2.3 + k);
function at(p, h, d, yaw = YAW, y = 0) { const [x, z] = Q(h, d); const g = grp(p, x, y, z); g.rotation.y = yaw; return g; }

function buildPit(scene) {
  for (let k = 0; k < 4; k++) {
    const [a0, a1] = ringA(k), base = k * BH, top = base + BH, ri = rB(k);
    // the bench: a leaning, uneven rock face with a strata ledge, a flat top
    sweep(scene, a0, a1, Math.round((a1 - a0) / 1.5), (t, a) => {
      const j = jit(a, k), e = Math.max(0.04, Math.min(1, (a - a0) / TA, (a1 - a) / TA)), hh = BH * e * e * (3 - 2 * e), y = base + hh, ln = 0.6 + (1 - e) * 3;
      return [[ri + j, base], [ROUT, base], [ROUT, y], [ri + j + ln, y], [ri + j + ln * 0.7, base + hh * 0.64], [ri + j + ln * 0.25, base + hh * 0.58], [ri + j + 0.06, base + 0.15 * e]];
    },
      [RM.face[k], RM.top, RM.strata], [-1, -1, 1, 0, 2, 0, 0], 0);
    // safety berm along the crest, open where the haul road arrives
    const gaps = [[rampA(k)[1] - 4, rampA(k + 1)[0] + 6]];
    let s0 = a0 + TA + 1;
    const seg = (b0, b1) => { if (b1 - b0 < 2) return; sweep(scene, b0, b1, Math.round((b1 - b0) / 2), (t, a) => { const j = jit(a, k); return [[ri + j + 0.7, top], [ri + j + 1.5, top], [ri + j + 1.25, top + 0.45], [ri + j + 0.95, top + 0.45]]; }, [RM.berm], [0, 0, 0, 0], 0); };
    gaps.forEach(([g0, g1]) => { seg(s0, Math.min(g0, a1 - TA - 1)); s0 = Math.max(s0, g1); }); seg(s0, a1 - TA - 1);
  }
  // the haul road: one ramp per bench, each climbing along the face of the next ring, then a flat landing
  for (let k = 0; k < 4; k++) {
    const [a0, a1] = rampA(k), base = k * BH, ri = rB(k);
    sweep(scene, a0, a1 + 9, 40, (t, a) => { const y = base + BH * Math.min(1, (a - a0) / (a1 - a0)) + 0.02; return [[ri - RW, base], [ri + 1.4, base], [ri + 1.4, y], [ri - RW, y]]; },
      [RM.road, RM.face[k]], [-1, -1, 0, 1], 1);
    // a little berm on the open side of the ramp
    sweep(scene, a0 + 3, a1 + 9, 30, (t, a) => { const y = base + BH * Math.min(1, (a - a0) / (a1 - a0)) + 0.02; return [[ri - RW + 0.15, y], [ri - RW + 0.75, y], [ri - RW + 0.55, y + 0.45], [ri - RW + 0.3, y + 0.45]]; }, [RM.berm], [0, 0, 0, 0], 0);
  }
  // fallen rocks at the foot of each face (not on the roads, not where the machines work)
  const rocks = [];
  for (let k = 0; k < 4; k++) {
    const [a0, a1] = ringA(k);
    for (let i = 0; i < 70; i++) {
      const a = rnd(a0 + 2, a1 - 2); if (a > rampA(k)[0] - 3 && a < rampA(k)[1] + 12) continue;
      if (k === 0 && ((a > -137 && a < -125) || (a > -118 && a < -100))) continue;
      if (k === 1 && a > -110 && a < -90) continue;
      const r = rB(k) + jit(a, k) - rnd(0.2, 1.6); rocks.push([a, r, k * BH, rnd(0.2, 0.7)]);
    }
  }
  instanced(scene, BOULDER, rocks.length, (i, d) => { const [a, r, y, s] = rocks[i]; d.position.copy(wpt(a, r, y + s * 0.3)); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.set(s * rnd(0.9, 1.4), s * 0.8, s * rnd(0.9, 1.3)); return pick([0xbfae8e, 0xa8977a, 0xcbbb98, 0x958670]); });
  // scree cones at the toe of the faces
  const SCREE = new THREE.ConeGeometry(1, 1, 10, 1); SCREE.translate(0, 0.5, 0);
  [[-60, 0], [-20, 0], [-170, 1], [-40, 1], [-150, 2], [-40, 2], [-150, 3], [-120, 3]].forEach(([a, k]) => { const p = wpt(a, rB(k) - 0.8, k * BH); const c = add(scene, SCREE, RM.face[(k + 1) % 4], p.x, p.y, p.z); c.scale.set(2.2, 1.6, 2.2); });
  // trees on the rim, all around the top of the quarry
  const trees = [];
  for (let i = 0; i < 90; i++) { const a = rnd(ringA(3)[0] + TA + 2, ringA(3)[1] - TA - 2), r = rnd(56.5, 59.5); trees.push([a, r, rnd(1.4, 2.6)]); }
  instanced(scene, ICO, trees.length * 2, (i, d) => { const [a, r, s] = trees[i >> 1]; const p = wpt(a, r, 4 * BH); if (i % 2) { d.position.set(p.x, p.y + s * 1.6, p.z); d.scale.set(s, s * 1.3, s); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); return pick([0x3f6f2f, 0x4f8a3a, 0x355f2a, 0x5e9a44]); } d.position.set(p.x, p.y + 0.6, p.z); d.scale.set(0.2, 1.2, 0.2); d.rotation.set(0, 0, 0); return 0x5b3e2a; });
  // a fence along the rim
  for (let a = ringA(3)[0] + TA + 1; a < ringA(3)[1] - TA - 1; a += 2.2) { const p = wpt(a, rB(3) + 2.6, 4 * BH); box(scene, 0.08, 1.0, 0.08, 0x7a6a50, p.x, p.y + 0.5, p.z); }
  for (let a = ringA(3)[0] + TA + 1; a < ringA(3)[1] - TA - 3.2; a += 2.2) { const p = wpt(a, rB(3) + 2.6, 4 * BH + 0.8), q = wpt(a + 2.2, rB(3) + 2.6, 4 * BH + 0.8); rod(scene, p, q, 0.025, std(0xe5452c, 0.6, 0), 4); }
  // warning signs at the bottom of the ramp
  { const p = wpt(-188, 32.5, 0); const g = grp(scene, p.x, 0, p.z); g.rotation.y = YAW; cylY(g, 0.06, 2.2, MT.grey, 0, 1.1, 0, 8); add(g, new THREE.CircleGeometry(0.45, 20), MT.white, 0, 2.2, 0.07); add(g, new THREE.RingGeometry(0.36, 0.45, 20), MT.red, 0, 2.2, 0.08); }
  shadows(scene); return scene;
}

/* ================= the yard: office, workshop, stockpiles, signs ================= */
function buildYard(scene) {
  // site office: two stacked cabins with an outside stair, the quarry sign
  { const g = at(scene, 18, 27); [0, 2.6].forEach((y, i) => { rbox(g, 6.2, 2.5, 2.5, 0.06, RM.cabin, 0, y + 1.25, 0, 0.02); rbox(g, 6.3, 0.14, 2.6, 0.03, RM.cabinB, 0, y + 2.5, 0, 0.01); rbox(g, 6.3, 0.14, 2.6, 0.03, RM.cabinB, 0, y + 0.07, 0, 0.01); for (let x = -2.2; x <= 2.2; x += 1.4) box(g, 0.9, 0.8, 0.04, MT.glassD, x, y + 1.45, -1.27); if (!i) box(g, 0.8, 1.9, 0.04, RM.cabinB, 2.6, 1.0, -1.27); });
    for (let i = 0; i < 9; i++) rbox(g, 0.3, 0.05, 0.9, 0.01, QM.grate, -3.4 - i * 0.28, 2.5 - i * 0.28, -0.6 + 0, 0.01);
    rbox(g, 1.2, 0.06, 1.0, 0.01, QM.grate, -3.6, 2.6, -0.6, 0.01); rail(g, [[-6.0, 0.9, -1.1], [-3.4, 3.5, -1.1], [-3.1, 3.5, -1.1]], 0.03, MT.yel);
    rbox(g, 5, 0.9, 0.12, 0.04, RM.cabinB, 0, 5.75, 0, 0.02); decal(g, 'CARRIÈRE', 4.6, 0.75, '#ffffff', 0, 5.75, -0.07).rotation.y = Math.PI; [-2.2, 2.2].forEach((x) => box(g, 0.1, 0.6, 0.1, MT.dark, x, 5.4, 0)); }
  // parked cars, a picnic table, flower pots
  [[5, 25.5, 0x2f7de0], [8, 25.5, 0xe5452c], [11, 25.5, 0xf2f2f6]].forEach(([h, d, c]) => { miniCar(at(scene, h, d, YAW - Math.PI / 2), 'car', c); });
  { const g = at(scene, 25, 24); rbox(g, 1.8, 0.08, 0.8, 0.02, MT.wood, 0, 0.75, 0, 0.01); [0.6, -0.6].forEach((z) => rbox(g, 1.8, 0.06, 0.3, 0.02, MT.wood, 0, 0.45, z, 0.01)); [-0.7, 0.7].forEach((x) => box(g, 0.08, 0.75, 0.08, MT.wood, x, 0.37, 0)); }
  // workshop: an open shed with a giant spare tyre, the fuel tank
  { const g = at(scene, -8, 27); [[-4, -2], [4, -2], [-4, 2], [4, 2], [0, 2], [0, -2]].forEach(([x, z]) => rbox(g, 0.25, 4.2, 0.25, 0.03, MT.grey, x, 2.1, z, 0.01)); rbox(g, 8.8, 0.25, 4.8, 0.05, std(0x8a3a2a, 0.6, 0.2), 0, 4.3, 0, 0.02); rbox(g, 8.4, 3.6, 0.15, 0.03, std(0xb9b2a4, 0.8, 0.1), 0, 2.2, 2.1, 0.01);
    rbox(g, 2.0, 0.9, 0.7, 0.04, MT.red, 2.6, 0.45, 1.5, 0.01); rbox(g, 1.6, 0.1, 0.8, 0.02, MT.wood, -2.6, 0.9, 1.5, 0.01); [-3.2, -2.0].forEach((x) => box(g, 0.08, 0.9, 0.7, MT.dark, x, 0.45, 1.5));
    for (let i = 0; i < 3; i++) { const t = add(g, new THREE.TorusGeometry(0.85, 0.36, 10, 22), MT.rubberS, -6.2, 0.36 + i * 0.72, 0); t.rotation.x = Math.PI / 2; }
    const tt = add(g, new THREE.TorusGeometry(0.9, 0.38, 10, 22), MT.rubberS, -6.0, 1.3, 2.4); tt.rotation.y = 0.3; }
  { const g = at(scene, 0, 22); cylX(g, 1.0, 4.2, std(0x3aa46a, 0.4, 0.2), 0, 1.6, 0, 20); [-1.5, 1.5].forEach((x) => { rbox(g, 0.3, 1.0, 1.6, 0.04, MT.dark, x, 0.5, 0, 0.01); }); rbox(g, 0.6, 1.5, 0.5, 0.05, MT.grey, 3.0, 0.75, 0.6, 0.02); decal(g, 'GAZOLE', 2.4, 0.5, '#ffffff', 0, 1.7, 1.02); }
  // extra stockpiles in the yard: pink chippings and grey ballast, a pile of big rocks for walls
  const PILE = new THREE.ConeGeometry(1, 1, 16); PILE.translate(0, 0.5, 0);
  [[-18, 32, 3.6, 2.8, RM.pink], [-28, 30, 3.0, 2.4, RM.coarse]].forEach(([h, d, r, hh, m]) => { const [x, z] = Q(h, d); add(scene, PILE, m, x, 0, z).scale.set(r, hh, r); for (let i = 0; i < 8; i++) { const a = rnd(0, 6.28), rr = rnd(0.4, r * 0.9); add(scene, ICO, m, x + Math.cos(a) * rr, hh * (1 - rr / r), z + Math.sin(a) * rr).scale.setScalar(0.18); } });
  { const [x, z] = Q(30, 30); for (let i = 0; i < 14; i++) { const a = rnd(0, 6.28), r = rnd(0, 2.4); const b = add(scene, BOULDER, pick([RM.face[0], RM.face[1], QM.stoneD]), x + Math.cos(a) * r, rnd(0.4, 1.2), z + Math.sin(a) * r); b.scale.setScalar(rnd(0.5, 0.9)); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); } }
  // entrance: a sign and a barrier by the road
  { const g = at(scene, 46, 21, YAW + 0.6); [-1.6, 1.6].forEach((x) => cylY(g, 0.08, 3.0, MT.dark, x, 1.5, 0, 8)); rbox(g, 3.8, 1.2, 0.12, 0.05, MT.yel, 0, 2.6, 0, 0.02); decal(g, 'CARRIÈRE', 3.4, 0.7, '#2b3040', 0, 2.6, 0.07); }
  // lamps, a few trees at the front
  [[-2, 18], [14, 16], [30, 6], [-14, 6], [6, -10]].forEach(([h, d]) => { const [x, z] = Q(h, d); lamp(scene, x, z, YAW); });
  [[-36, 20], [-30, 30], [-20, 38], [2, 38], [26, 36], [44, 16], [-44, 10], [12, 40]].forEach(([h, d]) => { const [x, z] = Q(h, d); const g = grp(scene, x, 0, z); cylY(g, 0.22, 2.4, 0x5b3e2a, 0, 1.2, 0, 8); for (let i = 0; i < 5; i++) add(g, ICO, pick([0x4f8a3a, 0x5e9a44, 0x3f6f2f]), rnd(-0.9, 0.9), rnd(2.4, 3.6), rnd(-0.9, 0.9)).scale.setScalar(rnd(0.9, 1.4)); });
  // workers standing around
  [[26, -13, 2.4], [16, 17, -0.5], [-24, -14, 0.8], [3, -8, 1.6], [-2, 30, 3.0], [29.5, 8, -1.2]].forEach(([h, d, f]) => { const [x, z] = Q(h, d); worker(scene, x, z, YAW + f); });
  { const p = wpt(-112, 39.5, BH); const w = worker(scene, p.x, p.z, YAW + 1.2); w.position.y = BH; }
  shadows(scene); return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  // a small haul truck going up and down the spiral road, all the way to the top
  const up = [];
  for (let k = 0; k < 4; k++) { const [a0, a1] = rampA(k), r = rB(k) - 1.8; for (let a = a0; a <= a1 + 0.01; a += 6) up.push(wpt(a, r, k * BH + (BH * (a - a0)) / (a1 - a0) + 0.05)); up.push(wpt(a1 + 5, r + 0.5, (k + 1) * BH + 0.05)); }
  const topY = 4 * BH + 0.05, turn = [wpt(-26, 53.5, topY), wpt(-22, 56.5, topY), wpt(-26, 58.5, topY), wpt(-30, 56.5, topY)];
  const foot = [[-33.4, 8], [-33.8, 12], [-31, 15.5], [-27.5, 13], [-29, 9], [-33.4, 8.6]].map(([h, d]) => { const [x, z] = Q(h, d); return new V3(x, 0.05, z); });
  const pts = [...up, ...turn, ...up.slice().reverse(), ...foot];
  const loop = { curve: new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2) }; loop.len = loop.curve.getLength(); loop.closed = true;
  const mini = haulTruck(scene); mini.g.scale.setScalar(0.45); mini.g.userData.wheels = mini.wheels; mini.load.visible = true;
  const t1 = traffic(loop, [mini.g], 3.2, { gap: 3 });
  // the site manager's pick-up on the pit floor
  const pick1 = route([[-16, -9], [-3, -11], [0, -6], [-4, -2], [-15, -3]].map(([h, d]) => Q(h, d)), true, 0.4);
  const car = miniCar(scene, 'van', 0xf2f2f6); all.push(car);
  const t2 = traffic(pick1, [car], 2.6, { gap: 3 });
  // workers walking in front of the office
  const walk = route([[10, 19], [24, 19], [25, 21.5], [10, 21.5]].map(([h, d]) => Q(h, d)), true, 0.3);
  const ppl = Array.from({ length: 4 }, () => walker(scene, 0, 0, { vest: true, hat: MT.hat })); all.push(...ppl);
  const t3 = traffic(walk, ppl, 1.2, { gap: 1.0 });
  onUpdate((dt) => { t1.update(dt, []); t2.update(dt, all); t3.update(dt, all); });
}
