// La Forêt — a working forest: the harvester fells and cuts a tree, the forwarder carries the logs to the track,
// the log truck takes them to the sawmill, the chipper turns branches into chips for heating, and the forest is replanted.
// Gentle message: wood is useful, and we plant new trees so that the forest grows back.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, freeze, pile } from '../kit/geo.js';
import { tire, agriTire, fender, hydraulic, truckCab, operator, beacon, orient } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };

/* ---------- palette (materials defined once) ---------- */
const FM = {
  yel: std(0xf2b51c, 0.38, 0.2), yelD: std(0xc98d12, 0.5, 0.25), yelDS: std(0xf2b51c, 0.4, 0.2, { side: THREE.DoubleSide }),
  green: std(0x3f8a32, 0.4, 0.15), greenD: std(0x2c6324, 0.5, 0.15), lime: std(0xd8d23a, 0.45, 0.1),
  red: std(0xd8302a, 0.38, 0.2), redD: std(0x9e221c, 0.45, 0.2), orange: std(0xee6a26, 0.4, 0.18), orangeDS: std(0xee6a26, 0.4, 0.18, { side: THREE.DoubleSide }), orangeD: std(0xb84c18, 0.5, 0.2),
  blue: std(0x2f5fb8, 0.38, 0.2), blueD: std(0x22468a, 0.45, 0.2), white: std(0xf1f2f5, 0.35, 0.1), grey: std(0x8f96a6, 0.5, 0.35),
  bark: std(0x6e4b32, 0.95, 0), barkD: std(0x553826, 0.95, 0), birch: std(0xeee8dc, 0.8, 0), wood: std(0xe2b878, 0.8, 0), woodD: std(0xb98345, 0.85, 0),
  plank: std(0xeccb92, 0.75, 0), timber: std(0xa8743e, 0.85, 0), needle: std(0x2f6b3a, 0.85, 0), needleL: std(0x3f8a44, 0.85, 0), leaf: std(0x5aa040, 0.85, 0),
  chips: std(0xd9b06a, 0.95, 0), sawdust: std(0xeed29c, 0.95, 0), earth: std(0x6a4a30, 0.95, 0), wet: std(0x3a2c22, 0.6, 0), water: std(0x3f7fd0, 0.15, 0.2),
  roof: std(0x8a3a2a, 0.8, 0), wall: std(0xc89a62, 0.85, 0), stone: std(0x9a968c, 0.9, 0), shutter: std(0x3a8a5a, 0.6, 0), hose: std(0xc8c2b0, 0.7, 0)
};

const DATA = {
  abatteuse: { short: "L'abatteuse", full: "L'abatteuse", verb: 'Couper', horn: 'horn',
    use: 'Elle coupe les arbres, enlève les branches et découpe le tronc en morceaux.',
    how: 'Au bout de sa grue, une grosse tête attrape le tronc. Une scie le coupe, des rouleaux le font glisser et des couteaux enlèvent les branches.' },
  porteur: { short: 'Le porteur', full: 'Le porteur', verb: 'Charger', horn: 'horn',
    use: 'Il ramasse les morceaux de bois et les porte sur son dos.',
    how: 'Sa grue a une pince qui attrape plusieurs billes à la fois. Il a huit roues pour rouler partout dans la forêt.' },
  grumier: { short: 'Le grumier', full: 'Le camion grumier', verb: 'Charger', horn: 'horn',
    use: 'Ce gros camion emmène le bois jusqu’à la scierie.',
    how: 'Il a sa propre grue pour se charger tout seul. Le chauffeur s’assoit tout en haut de la grue !' },
  scierie: { short: 'La scierie', full: 'La scierie', verb: 'Scier', horn: 'bell',
    use: 'Ici, on transforme les troncs en planches.',
    how: 'Le tronc avance sur un chariot. Une grande scie, un ruban d’acier qui tourne très vite, le coupe en tranches.' },
  broyeuse: { short: 'La broyeuse', full: 'La broyeuse', verb: 'Broyer', horn: 'horn',
    use: 'Elle transforme les branches en petits copeaux de bois.',
    how: 'Les rouleaux avalent les branches, et un gros tambour les coupe en tout petits morceaux. Les copeaux servent à chauffer les maisons.' },
  planteur: { short: 'La planteuse', full: 'Le tracteur et sa planteuse', verb: 'Planter', horn: 'horn',
    use: 'Elle plante des jeunes arbres, pour que la forêt repousse.',
    how: 'Un disque ouvre un petit sillon dans la terre. Les planteurs, assis derrière, y posent les jeunes arbres un par un.' },
  pompiers: { short: 'Les pompiers', full: 'Le camion-citerne des pompiers', verb: 'Arroser', horn: 'horn',
    use: 'Il protège la forêt quand il fait très chaud et très sec.',
    how: 'Sa citerne est pleine d’eau. Il passe partout dans les chemins de la forêt, et son canon arrose très loin.' }
};
const ORDER = ['abatteuse', 'porteur', 'grumier', 'scierie', 'broyeuse', 'planteur', 'pompiers'];

const GND = '<path class="gnd" d="M4 75H116"/>';
const BK = '#8a5a3a', WE = '#e8c48a', LG = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WE}" stroke="${BK}" stroke-width="2"/>`;
const ICONS = {
  abatteuse: GND + `<rect x="98" y="8" width="9" height="62" rx="3" fill="${BK}"/><path d="M90 14l12-8 14 8-14 6z" class="gr"/><path d="M88 30l14-10 16 10-16 6z" class="gr"/>
    <rect class="y" x="8" y="44" width="70" height="18" rx="5"/><rect class="y" x="50" y="26" width="26" height="20" rx="3"/><rect class="g" x="54" y="29" width="18" height="13" rx="2"/>
    <path class="arm" d="M40 44L60 14L92 30"/><rect class="k" x="88" y="30" width="12" height="20" rx="3"/><circle class="k" cx="20" cy="66" r="9"/><circle class="k" cx="50" cy="66" r="8"/><circle class="k" cx="68" cy="66" r="8"/>`,
  porteur: GND + `<rect x="8" y="46" width="76" height="12" rx="4" fill="#2c6324"/><path d="M12 22v24M30 22v24M48 22v24" stroke="#343846" stroke-width="3"/>
    ${LG(18, 40)}${LG(28, 40)}${LG(38, 40)}${LG(23, 31)}${LG(33, 31)}<rect x="80" y="30" width="30" height="24" rx="4" fill="#3f8a32"/><rect class="g" x="84" y="33" width="14" height="12" rx="2"/>
    <path d="M60 46L70 16L52 22" fill="none" stroke="#f2b51c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="k" cx="16" cy="64" r="7"/><circle class="k" cx="34" cy="64" r="7"/><circle class="k" cx="82" cy="64" r="7"/><circle class="k" cx="100" cy="64" r="7"/>`,
  grumier: GND + `<rect class="k" x="8" y="52" width="92" height="6"/><path d="M14 24v28M40 24v28M66 24v28" stroke="#343846" stroke-width="3"/>
    ${LG(22, 46, 6)}${LG(34, 46, 6)}${LG(46, 46, 6)}${LG(58, 46, 6)}${LG(28, 35, 6)}${LG(40, 35, 6)}${LG(52, 35, 6)}
    <rect class="b" x="84" y="26" width="28" height="30" rx="4"/><rect class="g" x="96" y="30" width="12" height="11" rx="2"/><path d="M76 52V18" stroke="#f2b51c" stroke-width="5"/>
    <circle class="k" cx="22" cy="64" r="7"/><circle class="k" cx="38" cy="64" r="7"/><circle class="k" cx="98" cy="64" r="7"/>`,
  scierie: GND + `<path d="M6 22h108" stroke="#8a3a2a" stroke-width="6" stroke-linecap="round"/><circle cx="70" cy="36" r="10" class="s"/><circle cx="70" cy="64" r="10" class="s"/><path d="M60 36v28" stroke="#343846" stroke-width="2"/>
    <rect x="12" y="48" width="44" height="14" rx="7" fill="${BK}"/>${LG(12, 55, 7)}<rect x="80" y="52" width="34" height="5" fill="${WE}"/><rect x="82" y="60" width="32" height="5" fill="${WE}"/><rect x="84" y="68" width="30" height="5" fill="${WE}"/>`,
  broyeuse: GND + `<rect class="o" x="14" y="34" width="56" height="26" rx="5"/><path d="M14 40L2 48v8h12z" fill="#b84c18"/><path d="M56 34V18q0-6 8-6h18" fill="none" stroke="#ee6a26" stroke-width="7" stroke-linecap="round"/>
    <g fill="${WE}"><circle cx="92" cy="14" r="2.5"/><circle cx="100" cy="20" r="2"/><circle cx="96" cy="28" r="2.5"/><circle cx="106" cy="30" r="2"/></g><path d="M86 72q14-24 28 0z" fill="#d9b06a"/>
    <path d="M4 44l-2-10M8 44l2-12" stroke="#3f8f3a" stroke-width="3"/><circle class="k" cx="30" cy="64" r="7"/><circle class="k" cx="48" cy="64" r="7"/>`,
  planteur: GND + `<rect x="50" y="40" width="36" height="16" rx="4" fill="#3f8a32"/><rect class="g" x="56" y="22" width="20" height="18" rx="3"/><rect x="54" y="20" width="24" height="4" rx="2" fill="#2c6324"/>
    <circle class="k" cx="60" cy="62" r="11"/><circle class="k" cx="86" cy="66" r="7"/><rect class="k" x="22" y="50" width="30" height="5"/><circle class="k" cx="30" cy="62" r="5"/>
    <path d="M14 74l4-14 4 14zM4 74l4-12 4 12z" class="gr"/><path d="M18 60v14M8 62v12" stroke="${BK}" stroke-width="1.5"/>`,
  pompiers: GND + `<rect class="r" x="8" y="30" width="64" height="28" rx="4"/><rect x="8" y="46" width="64" height="4" fill="#f1f2f5"/><rect class="r" x="74" y="34" width="32" height="24" rx="4"/><rect class="g" x="88" y="38" width="14" height="10" rx="2"/>
    <rect class="b" x="84" y="29" width="14" height="5" rx="2"/><path d="M40 30l6-8h12" stroke="#343846" stroke-width="4" fill="none"/><path d="M58 22q22-18 50-10" stroke="#8fd0ff" stroke-width="3" stroke-dasharray="4 3" fill="none"/>
    <circle class="k" cx="24" cy="62" r="8"/><circle class="k" cx="90" cy="62" r="8"/>`
};

/* ---------- layout: (h, d) = (along the screen, back → front) ---------- */
const POS = { abatteuse: [-32, -15], porteur: [-28, 7], grumier: [-3, -4], scierie: [26, -17], broyeuse: [24, 8], planteur: [-6, 19], pompiers: [2, -25] };
const CFG = {}; Object.keys(POS).forEach((k) => (CFG[k] = CF(...POS[k])));
// clear ground around each station: [x0, x1, z] along the machine's own axes, radius (no trees there)
const CLEAR = { abatteuse: [-7, 8, -3, 8], porteur: [-6, 13, -1, 5.5], grumier: [-12, 18, -1.5, 5.5], scierie: [-10, 11, -1, 7.5], broyeuse: [-7, 5, -1.5, 6], planteur: [-12, 10, 0, 7], pompiers: [-11, 9, -2.5, 6.5] };
const ROAD = [[-52, -2], [-30, -4.5], [-12, -4], [4, -4], [16, -5], [22, -10], [26, -12]];
const ROAD2 = [[16, -5], [32, -2], [52, 2]];
const SPUR = [[-12, -4], [-10, -14], [-6, -25], [14, -26]];
const SKID = [[-36, -16], [-31, -8], [-29, 6], [-14, 6], [-12, -4]];
const TRAIL = [[4, 30], [14, 35], [30, 33], [38, 22], [36, 14], [28, 18], [14, 25]];
const HOUSE = [26, 29], GLADE = [9, -14];
const HZONES = [[...HOUSE, 7], [...GLADE, 4.5], [-20.5, 28, 3.5]], HSEGS = [];
Object.keys(CLEAR).forEach((k) => { const [h, d] = POS[k], [x0, x1, z, r] = CLEAR[k]; HSEGS.push([h + x0, d + z, h + x1, d + z, r], [h, d, h, d + 11, 6]); });
{ const [h, d] = POS.scierie; HSEGS.push([h + 1, d + 1, h + 9, d + 12, 6.5]); } // the sawmill is seen from the outfeed side: keep that view free of trees
[ROAD, ROAD2, SPUR].forEach((pl) => { for (let i = 0; i < pl.length - 1; i++) HSEGS.push([...pl[i], ...pl[i + 1], 2.6]); });
for (let i = 0; i < TRAIL.length; i++) HSEGS.push([...TRAIL[i], ...TRAIL[(i + 1) % TRAIL.length], 1.4]);
const ZONES = HZONES.map(([h, d, r]) => [...Q(h, d), r]);
const SEGS = HSEGS.map(([a, b, c, d, r]) => [...Q(a, b), ...Q(c, d), r]);
function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - (ax + dx * t), pz - (az + dz * t)); }
const freeAt = (x, z, m = 0) => !ZONES.some(([a, b, r]) => Math.hypot(x - a, z - b) < r + m) && !SEGS.some(([a, b, c, d, r]) => segDist(x, z, a, b, c, d) < r + m);

/* ---------- painted ground ---------- */
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const path = (pts, w, col, al = 0.9, closed = false) => GP.push({ pts: (closed ? [...pts, pts[0]] : pts).map(([h, d]) => Q(h, d)), w, col, al });
blob(-30, -6, 18, 'rgba(176,160,96,.55)'); blob(-6, 18, 13, 'rgba(120,84,52,.7)'); blob(26, -16, 13, 'rgba(184,150,108,.85)'); blob(24, 8, 8, 'rgba(176,150,100,.6)');
blob(...GLADE, 6, 'rgba(160,190,90,.5)'); blob(...HOUSE, 8, 'rgba(170,190,110,.55)'); blob(2, -25, 9, 'rgba(176,160,96,.45)');
rect(26, -16, 24, 12, '#b39470', 0.9);
path(SKID, 2.6, '#7a5a3a', 0.55); path(ROAD, 3.8, '#a8875e'); path(ROAD2, 3.4, '#a8875e'); path(SPUR, 3.0, '#a8875e', 0.85);
path(ROAD, 0.5, '#8a6a46', 0.5); path(TRAIL, 1.3, '#cbb48c', 0.85, true);

export default {
  id: 'foret', title: 'La Forêt', titleHtml: 'La <span>Forêt</span>',
  subtitle: "On coupe des arbres pour avoir du bois, on fait des planches à la scierie… et on replante pour que la forêt repousse !",
  welcome: 'Bienvenue dans la forêt ! Touche une machine pour voir comment elle travaille.',
  hint: 'Touche une machine pour la découvrir.', backLabel: 'Toute la forêt',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l-7 10h4l-6 8h18l-6-8h4z"/><path d="M16 21v7"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, outerColor: 0x14301e, zones: ZONES, segs: SEGS,
  forest: { dark: [0x163a24, 0x1b4429, 0x12301f, 0x21502f, 0x173a2a], bush: [0x2f6b3a, 0x3a7a3a, 0x285a33, 0x4a8a3a] },
  tuftColors: [0x4a8a3a, 0x3a7a34, 0x5a9a44, 0x2f6a30, 0x6aa84a],
  overview: { w: 90, h: 62, focus: [0, 3, 0] },
  ground: { base: ['#7a9a50', '#5c7e3e', '#3a5530'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 160); onUpdate((dt) => fx.update(dt));
    freeze(buildForest(grp(scene)));
    const exhaust = (o, x, y, z, n = 1) => { for (let i = 0; i < n; i++) fx.smoke(o.localToWorld(new V3(x, y, z)), new V3(rnd(-0.2, 0.2), rnd(1, 1.6), rnd(-0.2, 0.2)), rnd(0.15, 0.3), 0x8a8a92, 1.2); };
    const dust = (S, x, z, n = 4, col = 0xb8a07a) => { for (let i = 0; i < n; i++) fx.smoke(S.localToWorld(new V3(x + rnd(-0.6, 0.6), 0.2, z + rnd(-0.6, 0.6))), new V3(rnd(-0.6, 0.6), rnd(0.4, 1), rnd(-0.6, 0.6)), rnd(0.3, 0.6), col, 1.2); };
    /** Let `o` fall from where it is (reparented to S) down to height y, optionally sliding to x/z. */
    const fall = (S, o, y, dx = 0, dz = 0, d = 0.45) => { S.attach(o); const p = o.position.clone(); return tw(d, (k) => o.position.set(p.x + dx * k, p.y + (y - p.y) * k, p.z + dz * k), easeIn); };
    /** Move `o` (reparented to S) to S-local point P along an arc. */
    const hopTo = (S, o, P, d = 1, h = 1, rx) => { S.attach(o); const p = o.position.clone(), r0 = o.rotation.x; return tw(d, (k) => { o.position.set(p.x + (P.x - p.x) * k, p.y + (P.y - p.y) * k + Math.sin(k * Math.PI) * h, p.z + (P.z - p.z) * k); if (rx != null) o.rotation.x = r0 + (rx - r0) * k; }, easeSine); };
    const inM = (m, S, x, y, z) => { S.updateMatrixWorld(true); return m.worldToLocal(S.localToWorld(new V3(x, y, z))); };
    const clean = (list) => { list.forEach((o) => o.parent && o.parent.remove(o)); list.length = 0; };

    /* ---- l'abatteuse : couper un arbre et le découper en billes ---- */
    (function () {
      const st = makeStation('abatteuse'), S = st.g;
      const HV = harvester(st, S), m = HV.g, cr = HV.crane, H = HV.head; st.m = m; st.wheels = HV.wheels; st.links = [...cr.links, ...H.links];
      const X0 = -3.5, X1 = 0, TX = 6.5, TZ = -3.6, REST = new V3(4.9, 2.5, 0);
      m.position.x = X0; st.lastX = X0; cr.solve(REST);
      // the clearing: stumps, a branch pile and the edge of the forest behind
      const sc = grp(S); [[3.2, -6.5], [-2, -6.2], [10.5, -6.5], [1, 4.2], [-6, 3.8], [10.5, 2.4]].forEach(([x, z]) => stump(sc, x, z, rnd(0.2, 0.3)));
      branchPile(sc, -7, -4.5); logStack(sc, -4.5, 3.6, 3, 2.4); bake(sc);
      cylY(S, 0.27, 0.32, FM.bark, TX, 0.16, TZ, 12); cylY(S, 0.245, 0.02, FM.wood, TX, 0.33, TZ, 12);
      const SAW = 0.3, LS = 2.0, LR = [0.24, 0.21, 0.18];
      let T = null; const junk = [];
      function newTree() {
        const g = grp(S, TX, 0, TZ), logs = LR.map((r, i) => logY(g, LS, r, 0, SAW + LS * (i + 0.5), 0));
        const top = grp(g, 0, SAW + LS * 3, 0); cylY(top, 0.13, 2.6, FM.bark, 0, 1.3, 0, 8);
        const whorls = []; for (let i = 0; i < 7; i++) { const c = add(g, CONE, i % 2 ? FM.needle : FM.needleL, 0, 3.1 + i * 0.82, 0); const r = 1.55 - i * 0.17; c.scale.set(r, 1.25, r); c.rotation.y = i; whorls.push(c); }
        T = { g, logs, top, whorls };
      }
      newTree();
      part(st, 'tete', "la tête d'abattage", anchor(H.tl, -0.1, -0.35, 0.4), true);
      part(st, 'grue', 'la grue', anchor(cr.boom, 1.8, 0.3, 0.2), true);
      part(st, 'roues', 'les six roues', anchor(m, -2.2, 0.9, 1.5), false);
      part(st, 'scie', 'la scie', anchor(H.saw, 0.6, 0, 0.1), false);
      part(st, 'rouleaux', 'les rouleaux', anchor(H.rollers[0], 0, 0.1, 0.2), false);
      const pileAt = anchor(S, TX - 2.4, 0.9, TZ); part(st, 'billes', 'les billes de bois', pileAt, false);
      st.focusAt = anchor(S, 4.5, 2.2, -2); st.size = { w: 18, h: 10 }; st.tagAt = anchor(m, 0, 4.6, 0);
      st.update = (dt) => { roll(st, dt); if (st.moving && Math.random() < 0.3) exhaust(m, -0.9, 3.1, -0.5); };
      st.action = async function () {
        if (st.done) {
          st.moving = true; engineOn(55);
          await Promise.all([step("L'abatteuse recule. Un autre arbre attend !", 'roues'), to(m.position, 'x', X0, 3, easeSine), cr.go(REST, 2.2), to(H.tl.rotation, 'z', 0, 1.2), to(H.rot.rotation, 'y', 0, 1.2)]);
          st.moving = false; clean(junk); if (T) T.g.parent.remove(T.g); newTree(); pop(T.g, 0.8); await sleep(0.8); st.done = false;
        }
        engineOn(55); st.moving = true;
        await Promise.all([step("L'abatteuse avance vers un grand arbre.", 'roues'), to(m.position, 'x', X1, 3.2, easeSine)]);
        st.moving = false;
        // reach the trunk: the head's knives face the tree, its saw just above the ground
        const dx = TX - (X1 + HV.colX), dz = TZ, r = Math.hypot(dx, dz), G = new V3(HV.colX + (dx * (r - 0.42)) / r, SAW + 1.72, (dz * (r - 0.42)) / r);
        await Promise.all([step('Sa grue tend le bras, et la tête attrape le tronc.', 'grue'), cr.go(G, 3, 0.8), tw(1.2, (k) => H.open(k))]);
        await tw(0.6, (k) => H.open(1 - k)); thud();
        let saw = true; const bits = () => { if (!saw) return; S.updateMatrixWorld(true); const p = wp(H.saw); for (let i = 0; i < 2; i++) throwClod(p, p.clone().add(new V3(rnd(-1.5, 1.5), -p.y, rnd(-1.5, 1.5))), rnd(0.05, 0.09), 0xeed29c); };
        engineOn(140);
        await Promise.all([step('Bzzz ! La scie coupe le tronc, tout en bas.', 'scie'), tw(1.6, (k) => { H.saw.rotation.y = -1.15 * Math.sin(k * Math.PI); bits(); }, lin)]);
        saw = false; engineOn(55);
        H.tl.attach(T.g);
        await cr.go(new V3(G.x, G.y + 1.0, G.z), 1.2);
        // turn the head so the tree falls away from the machine, then tilt it down
        await to(H.rot.rotation, 'y', -cr.sl.rotation.y, 1.4, easeSine);
        await Promise.all([step("Tout doucement, l'arbre se couche par terre.", 'tete'), to(H.tl.rotation, 'z', -Math.PI / 2, 2.4, easeIn)]);
        thud(); S.updateMatrixWorld(true); { const tip = S.worldToLocal(T.g.localToWorld(new V3(0, 7, 0))); for (let i = 0; i < 8; i++) fx.smoke(S.localToWorld(new V3(tip.x + rnd(-1, 1), 0.3, tip.z + rnd(-2, 2))), new V3(rnd(-0.5, 0.5), rnd(0.3, 0.8), rnd(-0.5, 0.5)), 0.6, 0xb8a07a, 1.4); }
        await cr.go(new V3(G.x, G.y + 0.25, G.z), 1.0);
        // feed the trunk through the head: the knives strip the branches, the saw cuts logs
        const y0 = T.g.position.y; let f = 0; const base = [];
        const feedTo = (f1, d) => { const fa = f; return tw(d, (k) => {
          const nf = fa + (f1 - fa) * k, df = nf - f; f = nf; T.g.position.y = y0 - f; H.rollers.forEach((rl, i) => (rl.rotation.x += (i ? 1 : -1) * df / 0.2));
          T.whorls.forEach((w) => { if (w.parent === T.g && w.position.y - 0.5 <= f + 1.16) { junk.push(w); fall(S, w, 0.45, rnd(-0.4, 0.4), 0, 0.5).then(() => (w.scale.y = 0.7)); } });
        }, lin); };
        const offs = [[-0.27, 0], [0.27, 0], [0, 0.36]];
        engineOn(90);
        for (let i = 0; i < 3; i++) {
          await Promise.all([i === 0 ? step('Les rouleaux font glisser le tronc, et les couteaux enlèvent les branches !', 'rouleaux') : sleep(0), feedTo(LS * (i + 1), i === 0 ? 2.6 : 1.4)]);
          saw = true;
          await Promise.all([i === 0 ? step('Et la scie coupe le tronc en morceaux : des billes de bois !', 'scie') : sleep(0), tw(0.7, (k) => { H.saw.rotation.y = -1.15 * Math.sin(k * Math.PI); bits(); }, lin)]);
          saw = false;
          const lg = T.logs[i]; junk.push(lg); S.attach(lg); if (!base.length) base.push(lg.position.x, lg.position.z);
          const [ox, oy] = offs[i]; fall(S, lg, LR[i] + oy, base[0] + ox - lg.position.x, base[1] - lg.position.z, 0.5).then(thud);
        }
        await sleep(0.4);
        // the thin top and the last branches fall too: they will go to the chipper
        [...T.whorls.filter((w) => w.parent === T.g), T.top].forEach((o) => { junk.push(o); fall(S, o, 0.45, 0, 0, 0.6); });
        engineOn(55);
        await Promise.all([step('Voilà ! Les billes attendent le porteur, et les branches iront à la broyeuse.', 'billes'), to(H.tl.rotation, 'z', 0, 1.6), to(H.rot.rotation, 'y', 0, 1.6), cr.go(REST, 2.6, 0.6)]);
        T.g.parent.remove(T.g); T = null; chime(); st.done = true;
      };
    })();

    /* ---- le porteur : ramasser les billes et les porter au chemin ---- */
    (function () {
      const st = makeStation('porteur'), S = st.g;
      const FW = forwarder(st, S), m = FW.g, cr = FW.crane, gr = FW.grapple; st.m = m; st.wheels = FW.wheels; st.links = cr.links;
      const REST = new V3(-1.3, 4.2, 0); cr.solve(REST);
      const sc = grp(S); [[-4, 3.6], [3, 4.2], [8.5, -4.4], [-6.5, -3.2]].forEach(([x, z]) => stump(sc, x, z, 0.24)); branchPile(sc, 6, -4.6); bake(sc);
      // two little piles of logs left by the harvester, behind the machine
      const home = [[0.8, -3.3], [-3.6, -3.4]].map(([x, z]) => new V3(x, 0.17, z));
      const bundles = home.map((p) => { const b = logBundle(S, 3.4, 0.16, [FM.bark, FM.barkD]); b.position.copy(p); return b; });
      const slots = [new V3(-2.3, 1.7, 0), new V3(-2.3, 2.15, 0)];
      part(st, 'pince', 'la pince', anchor(gr.g, 0, -0.3, 0.4), true);
      part(st, 'grue', 'la grue', anchor(cr.boom, 1.6, 0.3, 0.2), false);
      part(st, 'chargement', 'les grands piquets', anchor(m, -3.0, 3.1, 1.2), true);
      part(st, 'roues', 'les huit roues', anchor(m, -2.5, 0.8, 1.6), false);
      st.focusAt = anchor(m, 0, 1.6, -1.2); st.size = { w: 15, h: 9 }; st.tagAt = anchor(m, 0, 4.6, 0);
      st.update = (dt) => { roll(st, dt); gr.rot.rotation.y = -cr.sl.rotation.y; if (st.moving && Math.random() < 0.3) exhaust(m, 4.3, 3.0, -0.45); };
      const grab = async (b, slot, text, key) => {
        const p = inM(m, S, b.position.x, b.position.y + 0.14 + 1.16, b.position.z);
        await Promise.all([text ? step(text, key) : sleep(0), cr.go(p, 2.4, 0.8), tw(1, (k) => gr.open(k))]);
        await tw(0.5, (k) => gr.open(1 - k)); gr.g.attach(b); thud();
        await cr.go(new V3(slot.x, slot.y + 0.14 + 1.16 + 0.4, slot.z), 2.4, 1.2);
        await tw(0.5, (k) => gr.open(k)); m.attach(b); b.rotation.set(0, 0, 0); await to(b.position, 'y', slot.y, 0.3); b.position.set(slot.x, slot.y, slot.z); thud();
      };
      st.action = async function () {
        if (st.done) {
          st.moving = true; st.reversing = true; engineOn(55);
          await Promise.all([step('Le porteur revient dans la clairière.', 'roues'), to(m.position, 'x', 0, 4, easeSine)]);
          st.moving = false; st.reversing = false;
          bundles.forEach((b, i) => { S.attach(b); b.rotation.set(0, 0, 0); b.position.copy(home[i]); pop(b, 0.5); }); await sleep(0.5); st.done = false;
        }
        engineOn(55);
        await grab(bundles[0], slots[0], 'La grue du porteur attrape les billes avec sa pince.', 'pince');
        await Promise.all([step('Il les pose sur son dos, entre les grands piquets.', 'chargement'), sleep(0.6)]);
        await grab(bundles[1], slots[1], 'Encore un tas ! La pince attrape plusieurs billes à la fois.', 'grue');
        await Promise.all([cr.go(REST, 1.8), tw(0.6, (k) => gr.open(1 - k))]);
        st.moving = true; engineOn(65);
        await Promise.all([step('Bien chargé, il roule jusqu’au chemin. Ses huit roues passent partout !', 'roues'), to(m.position, 'x', 11, 6, easeSine)]);
        st.moving = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- le grumier : charger le bois et partir à la scierie ---- */
    (function () {
      const st = makeStation('grumier'), S = st.g;
      const LT = logTruck(st, S), m = LT.g, cr = LT.crane, gr = LT.grapple; st.m = m; st.wheels = LT.wheels; st.links = cr.links;
      const X0 = -9, REST = new V3(-0.2, 3.6, 0); m.position.x = X0; st.lastX = X0; cr.solve(REST);
      // the two bundles the crane will take (no other logs behind: the truck's load stays easy to see)
      const sp = grp(S); [[-6.5, -4.2], [4.5, -5.0], [8.5, -3.6]].forEach(([x, z]) => stump(sp, x, z, 0.26)); branchPile(sp, -6.2, -5.6); bake(sp);
      const home = [new V3(-1.4, 0.21, -3.4), new V3(-1.4, 0.21, -2.6)];
      const bundles = home.map((p) => { const b = logBundle(S, 4.6, 0.2, [FM.bark, FM.barkD]); b.position.copy(p); return b; });
      const slots = [new V3(-1.8, 1.57, 0), new V3(-1.8, 2.12, 0)];
      part(st, 'grue', 'la grue', anchor(cr.boom, 1.5, 0.3, 0.2), true);
      part(st, 'chauffeur', 'le chauffeur, tout en haut', anchor(cr.sl, -0.15, 2.3, 0.5), false);
      part(st, 'bequilles', 'les béquilles', anchor(LT.legs[0].foot, 0, 0.3, 0.2), false);
      part(st, 'bois', 'le tas de bois', anchor(S, -1.4, 0.9, -3.0), true);
      st.focusAt = anchor(m, -0.5, 1.8, -1.4); st.size = { w: 17, h: 10 }; st.tagAt = anchor(m, 0, 4.6, 0);
      st.update = (dt) => { roll(st, dt); gr.rot.rotation.y = -cr.sl.rotation.y; if (st.moving && Math.random() < 0.3) exhaust(m, 3.0, 3.1, 0.9); };
      const legs = (k) => LT.legs.forEach((L) => { L.beam.position.z = L.s * (0.55 + 0.9 * Math.min(1, k * 2)); L.foot.position.y = -0.95 * Math.max(0, k * 2 - 1); });
      const grab = async (b, slot, text, key) => {
        const p = inM(m, S, b.position.x, b.position.y + 0.14 + 1.16, b.position.z);
        await Promise.all([text ? step(text, key) : sleep(0), cr.go(p, 2.6, 0.8), tw(1, (k) => gr.open(k))]);
        await tw(0.5, (k) => gr.open(1 - k)); gr.g.attach(b); thud();
        await cr.go(new V3(slot.x, slot.y + 0.14 + 1.16 + 0.5, slot.z), 2.6, 1.4);
        await tw(0.5, (k) => gr.open(k)); m.attach(b); b.rotation.set(0, 0, 0); await to(b.position, 'y', slot.y, 0.3); b.position.copy(slot); thud();
      };
      st.action = async function () {
        if (st.done) { m.position.x = X0; st.lastX = X0; legs(0); cr.solve(REST); bundles.forEach((b, i) => { S.attach(b); b.rotation.set(0, 0, 0); b.position.copy(home[i]); pop(b, 0.5); }); pop(m, 0.5); await sleep(0.6); st.done = false; }
        engineOn(60); st.moving = true;
        await Promise.all([step('Le camion grumier arrive au bord du chemin, près du tas de bois.', 'bois'), to(m.position, 'x', 0, 4, easeSine)]);
        st.moving = false; engineOn(45);
        await Promise.all([step('Il pose ses béquilles, pour être bien stable.', 'bequilles'), tw(1.8, legs, easeSine)]); thud();
        await grab(bundles[1], slots[0], 'Le chauffeur s’assoit tout en haut de la grue, et charge les grosses billes.', 'chauffeur');
        await grab(bundles[0], slots[1], 'Encore un tas ! Le camion est bien rempli.', 'grue');
        await Promise.all([step('Il replie sa grue et ses béquilles.', 'bequilles'), cr.go(REST, 2.2, 0.5), tw(1.8, (k) => legs(1 - k), easeSine), tw(0.6, (k) => gr.open(1 - k))]);
        engineOn(70); st.moving = true;
        await Promise.all([step('En route pour la scierie ! Tut tut !', 'grue'), to(m.position, 'x', 16, 5, easeIn)]);
        st.moving = false; engineOff(); st.done = true;
      };
    })();

    /* ---- la scierie : des troncs aux planches ---- */
    (function () {
      const st = makeStation('scierie'), S = st.g;
      const SM = sawmill(st, S), C = SM.carriage; st.m = SM.all;
      const R = 0.32, L = 3.0, Z1 = -0.14, Y1 = 1.03, slotP = (i) => { const z = -1.35 - i * 0.68; return new V3(-5, 1.4 + (-z - 0.95) * 0.196, z); };
      const deck = [0, 1, 2].map((i) => { const l = sawLog(SM.all, L, R, R); l.position.copy(slotP(i)); return l; });
      let onC = null; const junk = []; let stackH = SM.stackTop, slabN = 0;
      part(st, 'scie', 'la scie à ruban', SM.bladeAt, true);
      part(st, 'chariot', 'le chariot', anchor(C, 0.6, 0.8, -0.8), true);
      part(st, 'planches', 'les planches', anchor(S, 8.8, 1.3, 2.6), false);
      part(st, 'tronc', 'le tronc', anchor(S, -5, 1.4, -2.0), false);
      // seen a little from the outfeed side, so the big wheels of the band saw show their face
      st.focusAt = anchor(S, -0.6, 1.9, 0.2); st.size = { w: 12.5, h: 7.2 }; st.el = 0.5; st.az = CFG.scierie.yaw + 0.5; st.tagAt = anchor(S, 0, 5.6, -1);
      let puff = 0;
      st.update = (dt) => {
        if (st.saw) SM.wheels.forEach((w) => (w.rotation.x -= dt * 22));
        if (st.cut && onC && Math.abs(C.position.x) < 1.6 + L / 2) {
          for (let i = 0; i < 2; i++) throwClod(S.localToWorld(new V3(0.05, 0.9, 0.15)), S.localToWorld(new V3(rnd(-0.3, 1.2), 0, rnd(1.2, 2.4))), rnd(0.05, 0.09), 0xeed29c);
          puff -= dt; if (puff <= 0) { puff = 0.05; fx.smoke(S.localToWorld(new V3(0.2, rnd(0.8, 1.3), 0.3)), S.localToWorld(new V3(rnd(0.3, 1.2), rnd(0.5, 1.1), rnd(0.5, 1.2))).sub(S.localToWorld(new V3())), rnd(0.4, 0.7), 0xfff0cc, 1.2); }
        }
      };
      const pass = async (text, key, d) => {
        st.cut = true;
        await Promise.all([step(text, key), to(C.position, 'x', 4.8, d, easeSine)]);
        st.cut = false;
      };
      st.action = async function () {
        if (st.done) { clean(junk); C.position.x = -5; stackH = SM.stackTop; st.done = false; }
        st.saw = true; engineOn(110);
        // the first log rolls from the deck onto the carriage, the others roll down one place
        onC = deck.shift(); const p0 = onC.position.clone(), tgt = C.localToWorld(new V3(0, Y1, Z1)); S.worldToLocal(tgt);
        await Promise.all([step('Un gros tronc roule jusqu’au chariot.', 'tronc'),
          tw(1.6, (k) => { onC.position.set(p0.x, p0.y + (tgt.y - p0.y) * k + Math.sin(k * Math.PI) * 0.45, p0.z + (tgt.z - p0.z) * k); onC.rotation.x = -Math.PI * 2 * k; }, easeSine),
          ...deck.map((l, i) => { const a = l.position.clone(), b = slotP(i); return tw(1.6, (k) => { l.position.lerpVectors(a, b, k); l.rotation.x = -k * 2; }, easeSine); })]);
        onC.rotation.x = 0; C.attach(onC); thud();
        const nl = sawLog(SM.all, L, R, R); nl.position.copy(slotP(2)); pop(nl, 0.6); deck.push(nl);
        // first cut: the rounded side with its bark comes off
        setCut(onC, R, 0.24, L); const slab = slabMesh(C, R, 0.24, L); slab.position.copy(onC.position); junk.push(onC, slab);
        await pass('Le chariot avance, et la grande scie à ruban coupe le tronc !', 'scie', 4.5);
        await Promise.all([step("Le premier morceau, avec l'écorce, part sur le tas.", 'chariot'), hopTo(S, slab, new V3(4.6, -0.2 + slabN * 0.1, 3.6), 1.2, 1.2, -Math.PI / 2)]);
        slabN = (slabN + 1) % 4; thud();
        await Promise.all([step('Le chariot revient. Le tronc avance un tout petit peu...', 'chariot'), to(C.position, 'x', -5, 3, easeSine), to(onC.position, 'z', Z1 + 0.1, 3)]);
        setCut(onC, R, 0.14, L); const pl = plankMesh(C, R, 0.14, 0.24, L); pl.position.copy(onC.position); junk.push(pl);
        await pass('...et la scie coupe encore une tranche.', 'scie', 3.8);
        await Promise.all([step('Voilà une belle planche toute plate !', 'planches'), hopTo(S, pl, new V3(8.8, stackH + 0.24, 2.6), 1.4, 1.6, Math.PI / 2)]);
        stackH += 0.13; thud(); st.saw = false; engineOff();
        await Promise.all([step('Avec les planches, on fabrique des maisons, des meubles... et même des jouets !', 'planches'), to(C.position, 'x', -5, 3, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la broyeuse : des branches aux copeaux ---- */
    (function () {
      const st = makeStation('broyeuse'), S = st.g;
      const CH = chipper(st, S), m = CH.g, cr = CH.crane, gr = CH.grapple; st.m = m; st.wheels = CH.wheels; st.links = cr.links;
      const REST = new V3(-2.4, 4.3, 0.6); cr.solve(REST);
      const home = [new V3(-4.9, 0.3, -2.7), new V3(-4.3, 0.62, -2.9)];
      const bundles = home.map((p, i) => { const b = branchBundle(S, i); b.position.copy(p); return b; });
      const sc = grp(S); branchPile(sc, -5.6, -3.9); branchPile(sc, -3.6, -3.9); bake(sc);
      const heap = pile(S, -1.6, -4.3, 0.9, FM.chips); const H0 = 0.9;
      part(st, 'grue', 'la grue', anchor(cr.boom, 1.3, 0.3, 0.2), false);
      part(st, 'bouche', 'la grande bouche', anchor(m, -4.9, 1.7, 0.9), true);
      part(st, 'tambour', 'le tambour', anchor(CH.drum, 0, 0.6, 0.3), false);
      part(st, 'copeaux', 'les copeaux', anchor(S, -1.6, 1.4, -4.3), true);
      st.focusAt = anchor(m, -1.5, 1.6, -1.5); st.size = { w: 16, h: 9 }; st.tagAt = anchor(m, -1, 4.6, 0);
      let chip = 0;
      st.update = (dt) => {
        roll(st, dt); gr.rot.rotation.y = -cr.sl.rotation.y;
        if (st.spin) { CH.drum.rotation.z -= dt * 14; CH.rollers.forEach((r, i) => (r.rotation.z += dt * (i ? 6 : -6))); }
        if (chip > 0) { chip -= dt; S.updateMatrixWorld(true); const a = wp(CH.out); for (let i = 0; i < 3; i++) throwClod(a, S.localToWorld(new V3(-1.6 + rnd(-0.5, 0.5), 0.4 + heap.scale.y * 0.9, -4.3 + rnd(-0.5, 0.5))), rnd(0.07, 0.13), pick([0xd9b06a, 0xe8c48a, 0xc89a5a])); }
      };
      const feed = async (b, text, key) => {
        const p = inM(m, S, b.position.x, b.position.y + 0.1 + 1.16, b.position.z);
        await Promise.all([text ? step(text, key) : sleep(0), cr.go(p, 2.2, 0.8), tw(1, (k) => gr.open(k))]);
        await tw(0.4, (k) => gr.open(1 - k)); gr.g.attach(b);
        await cr.go(new V3(-5.0, 1.2 + 0.1 + 1.16 + 0.3, 0), 2.2, 1.2);
        await tw(0.4, (k) => gr.open(k)); m.attach(b); b.rotation.set(0, 0, 0); b.position.set(-5.0, 1.32, 0);
      };
      const swallow = async (b, text, key) => {
        const s0 = b.scale.x;
        await Promise.all([text ? step(text, key) : sleep(0), cr.go(REST, 1.6), tw(1.6, (k) => { b.position.x = -5.0 + 1.3 * k; b.scale.set(s0 * (1 - k) + 0.01, 1 - 0.6 * k, 1 - 0.6 * k); }, lin)]);
        b.visible = false; chip = 2.4; tone(70, 0, 2.2, 'sawtooth', 0.03, 50);
      };
      st.action = async function () {
        if (st.done) { bundles.forEach((b, i) => { S.attach(b); b.rotation.set(0, 0, 0); b.scale.setScalar(1); b.position.copy(home[i]); pop(b, 0.5); }); heap.scale.setScalar(H0); cr.solve(REST); st.done = false; }
        engineOn(70); st.spin = true;
        await Promise.all([step('La broyeuse se met en marche. Son gros tambour tourne très vite !', 'tambour'), sleep(1.4)]);
        await feed(bundles[1], 'Sa grue attrape les branches qui restent dans la forêt.', 'grue');
        await swallow(bundles[1], 'Elle les pose dans la grande bouche. Les rouleaux les avalent...', 'bouche');
        await Promise.all([step('Crrr ! Le tambour les coupe en tout petits morceaux : des copeaux !', 'copeaux'), tw(2.4, (k) => heap.scale.setScalar(H0 + 0.12 * k), lin)]);
        await feed(bundles[0], 'Encore des branches !', 'bouche');
        await swallow(bundles[0]);
        await Promise.all([step('Les copeaux serviront à chauffer les maisons et l’école, en hiver.', 'copeaux'), tw(2.4, (k) => heap.scale.setScalar(H0 + 0.12 + 0.12 * k), lin)]);
        st.spin = false; engineOff(); chime(); st.done = true;
      };
    })();

    /* ---- la planteuse : on replante la forêt ---- */
    (function () {
      const st = makeStation('planteur'), S = st.g;
      const PL = planter(st, S), m = PL.g; st.m = m; st.wheels = PL.wheels;
      const X0 = -9, X1 = 5.5, BACK = -3.7; m.position.x = X0; st.lastX = X0;
      // rows already planted last year, behind
      const sc = grp(S); for (let z = -2.6; z >= -6.2; z -= 1.2) for (let x = -11; x <= 10; x += 1.4) { const t = sapling(sc, x + rnd(-0.2, 0.2), z + rnd(-0.15, 0.15)); t.scale.setScalar(rnd(1.4, 2.1)); }
      [[-11, 3.4], [6, 3.6], [11, -1.5]].forEach(([x, z]) => stump(sc, x, z, 0.26)); bake(sc);
      const furrows = [0.55, -0.55].map((z) => { const f = box(S, 1, 0.03, 0.22, FM.earth, 0, 0.02, z); f.visible = false; return f; });
      const kids = []; let nextX = 0;
      part(st, 'tracteur', 'le tracteur', anchor(m, 1.3, 2.9, 0.4), true);
      part(st, 'planteurs', 'les planteurs', anchor(m, -2.5, 1.6, 0.7), true);
      part(st, 'disques', 'les disques', anchor(m, -3.1, 0.4, 0.75), false);
      const tAt = anchor(S, 0, 1.0, 0.55); part(st, 'arbres', 'les jeunes arbres', tAt, false);
      st.focusAt = anchor(S, -0.5, 1.3, -0.5); st.size = { w: 19, h: 8 }; st.tagAt = anchor(m, 0, 3.8, 0);
      const plantAlong = () => {
        const x = m.position.x + BACK;
        furrows.forEach((f) => { const x0 = X0 + BACK + 0.3; f.visible = x > x0; f.scale.x = Math.max(0.01, x - x0); f.position.x = (x + x0) / 2; });
        while (x >= nextX) { [0.55, -0.55].forEach((z) => { const t = sapling(S, nextX, z + rnd(-0.06, 0.06)); shadows(t); kids.push(t); pop(t, 0.5); }); nextX += 1.3; ding(); }
      };
      st.update = (dt) => { roll(st, dt); if (st.planting) plantAlong(); if (st.moving && Math.random() < 0.25) exhaust(m, 2.6, 2.6, 0.32); };
      st.action = async function () {
        if (st.done) { clean(kids); furrows.forEach((f) => (f.visible = false)); m.position.x = X0; st.lastX = X0; pop(m, 0.5); await sleep(0.6); st.done = false; }
        nextX = X0 + BACK + 1.5;
        await Promise.all([step('Ici, on a coupé des arbres. Alors maintenant, on en replante !', 'arbres'), sleep(1.2)]);
        engineOn(50); st.moving = true;
        await Promise.all([step('Le tracteur tire la planteuse. Les disques ouvrent un petit sillon dans la terre.', 'disques'), to(m.position, 'x', -4, 3.4, easeIn)]);
        nextX = m.position.x + BACK + 0.4; st.planting = true;
        await Promise.all([step('Les planteurs posent les jeunes arbres, un par un.', 'planteurs'), to(m.position, 'x', X1, 8, (k) => k)]);
        st.planting = false; st.moving = false; engineOff();
        tAt.position.x = kids.length ? kids[Math.floor(kids.length / 2)].position.x : 0;
        await Promise.all([step('Avec la pluie et le soleil, ils vont grandir, grandir...', 'arbres'), tw(3.4, (k) => kids.forEach((t, i) => t.scale.setScalar(1 + 1.6 * clamp(k * 1.3 - (i % 5) * 0.06, 0, 1))), easeSine)]);
        await Promise.all([step('Dans quelques années, ce sera de nouveau une belle forêt !', 'arbres'), sleep(1.4)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le camion-citerne des pompiers ---- */
    (function () {
      const st = makeStation('pompiers'), S = st.g;
      const FT = fireTruck(st, S), m = FT.g; st.m = m; st.wheels = FT.wheels;
      const X0 = -9, X1 = 3.0; m.position.x = X0; st.lastX = X0;
      // the pond (water point) with reeds and two ducks
      const PX = 6.4, PZ = -5.0;
      const water = add(S, new THREE.CircleGeometry(1, 32), FM.water, PX, 0.05, PZ); water.rotation.x = -Math.PI / 2; water.scale.set(2.8, 1.9, 1);
      const rim = add(S, new THREE.RingGeometry(1, 1.14, 32), FM.earth, PX, 0.04, PZ); rim.rotation.x = -Math.PI / 2; rim.scale.set(2.8, 1.9, 1);
      const sc = grp(S); for (let i = 0; i < 16; i++) { const a = rnd(0, Math.PI * 2); if (Math.sin(a) > 0.3) continue; const c = add(sc, REED, FM.needleL, PX + Math.cos(a) * 3.1, 0, PZ - Math.abs(Math.sin(a)) * 2.1); c.scale.set(1, rnd(0.8, 1.3), 1); }
      [[-6, -4.2], [-2, -5.2], [10.5, -2]].forEach(([x, z]) => stump(sc, x, z, 0.25)); bake(sc);
      const ducks = [0, 1].map(() => duck(S)); let T = 0;
      const wetM = add(S, new THREE.CircleGeometry(1, 24), FM.wet, -1.5, 0.03, -5.4); wetM.rotation.x = -Math.PI / 2; wetM.scale.set(0.01, 0.01, 1); wetM.visible = false;
      const hose = tube(S, 0.07, FM.hose); hose.g.visible = false;
      part(st, 'citerne', "la citerne d'eau", anchor(m, -0.5, 2.3, 1.2), true);
      part(st, 'canon', 'le canon à eau', anchor(FT.barrel, 0.8, 0.25, 0), true);
      part(st, 'tuyau', 'le tuyau', anchor(S, PX - 2.2, 0.6, PZ + 1.8), false);
      part(st, 'gyrophares', 'les gyrophares', anchor(m, 3.25, 3.45, 0.6), false);
      st.focusAt = anchor(m, 0.5, 1.6, -1.8); st.size = { w: 17, h: 9 }; st.tagAt = anchor(m, 0, 4.4, 0);
      let spray = 0; const A = new V3(), B = new V3();
      st.update = (dt) => {
        T += dt; roll(st, dt);
        ducks.forEach((d, i) => { const a = T * 0.3 + i * 2.6; d.position.set(PX + Math.cos(a) * 1.6, 0.05, PZ + Math.sin(a) * 0.9); d.rotation.y = -a - Math.PI / 2; d.position.y = 0.05 + Math.sin(T * 3 + i) * 0.02; });
        if (st.water) { spray -= dt; if (spray <= 0) { spray = 0.03; S.updateMatrixWorld(true); const a = wp(FT.nozzle); for (let i = 0; i < 2; i++) throwClod(a, S.localToWorld(new V3(-1.5 + rnd(-1.6, 1.6), 0, -5.4 + rnd(-1.0, 1.0))), rnd(0.08, 0.14), pick([0x9fd8ff, 0xd8f0ff, 0x6ab8f0])); } }
      };
      st.action = async function () {
        if (st.done) { m.position.x = X0; st.lastX = X0; FT.mon.rotation.y = 0; FT.barrel.rotation.z = 0; FT.level.scale.y = 0.05; wetM.visible = false; wetM.scale.set(0.01, 0.01, 1); pop(m, 0.5); await sleep(0.6); st.done = false; }
        engineOn(60); st.moving = true;
        const siren = setInterval(() => { tone(740, 0, 0.32, 'triangle', 0.04); tone(587, 0.36, 0.32, 'triangle', 0.04); }, 760);
        await Promise.all([step('Pin-pon ! Le camion des pompiers fait sa tournée dans la forêt.', 'citerne'), to(m.position, 'x', X1, 5, easeSine)]);
        clearInterval(siren); st.moving = false; engineOn(40);
        // the suction hose goes into the pond, the tank fills up
        S.updateMatrixWorld(true); S.worldToLocal(m.localToWorld(A.set(-0.8, 1.05, -1.12))); B.set(PX - 2.1, 0.1, PZ + 1.0); hose.g.visible = true;
        await Promise.all([step("Il s'arrête près de la mare, et pompe de l'eau pour remplir sa citerne.", 'tuyau'), tw(1.2, (k) => hose.set(A, A.clone().lerp(B, k)), easeSine)]);
        await Promise.all([tw(2.6, (k) => (FT.level.scale.y = 0.05 + 0.95 * k), lin), tone(110, 0, 2.4, 'sine', 0.05, 130)]);
        await tw(0.8, (k) => hose.set(A, B.clone().lerp(A, k)), easeSine); hose.g.visible = false;
        const tg = inM(m, S, -1.5, 0.6, -5.4), mp = FT.mon.position, yaw = Math.atan2(-(tg.z - mp.z), tg.x - mp.x);
        await Promise.all([step("L'été, quand il fait très chaud, la forêt devient toute sèche.", 'canon'), to(FT.mon.rotation, 'y', yaw, 1.6, easeSine), to(FT.barrel.rotation, 'z', 0.35, 1.6)]);
        st.water = true; wetM.visible = true;
        await Promise.all([step('Alors les pompiers arrosent, pour protéger la forêt du feu.', 'canon'), tw(3.4, (k) => { wetM.scale.set(0.3 + 2.4 * k, 0.3 + 1.8 * k, 1); FT.level.scale.y = 1 - 0.7 * k; }, lin)]);
        st.water = false;
        await Promise.all([step('Bravo les pompiers ! La forêt est bien protégée.', 'gyrophares'), to(FT.mon.rotation, 'y', 0, 1.4), to(FT.barrel.rotation, 'z', 0, 1.4)]);
        engineOff(); chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate, fx);
  }
};

/* ================= shared geometry ================= */
const CONE = new THREE.ConeGeometry(1, 1, 9); CONE.translate(0, 0.5, 0);
const REED = new THREE.ConeGeometry(0.06, 1.1, 4); REED.translate(0, 0.55, 0);
const bake = (g) => { shadows(g); freeze(g); return g; };
function mergeGeos(list) { return BufferGeometryUtils.mergeBufferGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))); }

/** A log standing along local y (bark, light end faces with a darker heart). */
function logY(p, L, r, x = 0, y = 0, z = 0, bark = FM.bark) {
  const g = grp(p, x, y, z); cylY(g, r, L, bark, 0, 0, 0, 12);
  [1, -1].forEach((s) => { cylY(g, r * 0.88, 0.02, FM.wood, 0, (s * L) / 2, 0, 12); cylY(g, r * 0.3, 0.026, FM.woodD, 0, (s * L) / 2, 0, 8); });
  return g;
}
/** A little bundle of 3 logs lying along x, bottom on y = −r. */
function logBundle(p, L, r, barks) {
  const g = grp(p); [[0, -0.95 * r], [0, 0.95 * r], [1.65 * r, 0]].forEach(([y, z], i) => { const l = logY(g, L, r * rnd(0.9, 1.05), 0, y, z, barks[i % barks.length]); l.rotation.z = Math.PI / 2; });
  shadows(g); return g;
}
/** A still stack of logs (rows decrease upwards). */
function logStack(p, x, z, n, L, r = 0.17, y0 = 0) {
  for (let row = 0; row < n; row++) for (let i = 0; i < n - row; i++) {
    const l = logY(p, L * rnd(0.94, 1.0), r * rnd(0.85, 1.1), x + rnd(-0.15, 0.15), y0 + r + row * r * 1.7, z + (i - (n - row - 1) / 2) * r * 2.02, i % 2 ? FM.bark : FM.barkD); l.rotation.z = Math.PI / 2;
  }
}
function stump(p, x, z, r) { cylY(p, r, 0.35, FM.bark, x, 0.17, z, 10); cylY(p, r * 0.9, 0.02, FM.wood, x, 0.35, z, 10); }
function branchPile(p, x, z) {
  for (let i = 0; i < 7; i++) rod(p, new V3(x + rnd(-1.2, 1.2), 0.1, z + rnd(-0.6, 0.6)), new V3(x + rnd(-1.2, 1.2), rnd(0.2, 0.6), z + rnd(-0.6, 0.6)), 0.04, FM.barkD, 5);
  for (let i = 0; i < 5; i++) { const b = add(p, ICO, i % 2 ? FM.needle : FM.needleL, x + rnd(-1, 1), 0.35, z + rnd(-0.5, 0.5)); b.scale.set(rnd(0.5, 0.8), rnd(0.3, 0.45), rnd(0.4, 0.6)); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
}
/** A bundle of branches lying along x, centred around y ≈ 0.3. */
function branchBundle(p, seed) {
  const g = grp(p);
  for (let i = 0; i < 5; i++) rod(g, new V3(-1.1, rnd(-0.2, 0.15), rnd(-0.25, 0.25)), new V3(1.1, rnd(-0.15, 0.2), rnd(-0.3, 0.3)), 0.045, FM.barkD, 5);
  for (let i = 0; i < 4; i++) { const b = add(g, ICO, (i + seed) % 2 ? FM.needle : FM.leaf, -0.8 + i * 0.55, rnd(0, 0.15), rnd(-0.15, 0.15)); b.scale.set(0.42, 0.3, 0.38); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  shadows(g); return g;
}
/** A young tree (about 0.7 tall). */
function sapling(p, x, z) {
  const g = grp(p, x, 0, z); cylY(g, 0.025, 0.35, FM.barkD, 0, 0.17, 0, 5);
  [[0.22, 0.32, 0.22], [0.17, 0.27, 0.4], [0.11, 0.22, 0.56]].forEach(([r, h, y], i) => { const c = add(g, CONE, i % 2 ? FM.needle : FM.needleL, 0, y, 0); c.scale.set(r, h, r); });
  return g;
}
/** Tube between two points (hoses): set(A, B). */
function tube(p, r, m) {
  const g = grp(p), c = add(g, new THREE.CylinderGeometry(1, 1, 1, 10), m); c.position.y = 0.5; const YA = new V3(0, 1, 0), d = new V3();
  return { g, set(A, B) { d.subVectors(B, A); const L = Math.max(0.01, d.length()); g.position.copy(A); g.quaternion.setFromUnitVectors(YA, d.multiplyScalar(1 / L)); c.scale.set(r, L, r); } };
}
function duck(p) {
  const g = grp(p); const w = std(0xf2f0e8, 0.7, 0), gr = std(0x2f7a4a, 0.5, 0.1), o = std(0xf2a020, 0.5, 0);
  sph(g, 0.18, w, 0, 0.08, 0).scale.set(0.26, 0.14, 0.17); sph(g, 0.09, gr, 0.17, 0.22, 0); rbox(g, 0.1, 0.03, 0.06, 0.01, o, 0.28, 0.21, 0, 0.005);
  sph(g, 0.08, w, -0.2, 0.15, 0).scale.set(0.08, 0.05, 0.06); shadows(g); return g;
}

/* ================= machines ================= */
/** A forestry cab: many windows, a roof window, work lights, mirrors, and the operator inside. Origin at floor centre. */
function forestCab(p, x, y, z, o) {
  const g = grp(p, x, y, z), L = o.L, W = o.W, H = o.H, M = o.M;
  rbox(g, L, 0.1, W, 0.03, MT.dark, 0, 0.05, 0);
  [[L / 2 - 0.06, W / 2 - 0.06], [L / 2 - 0.06, -W / 2 + 0.06], [-L / 2 + 0.06, W / 2 - 0.06], [-L / 2 + 0.06, -W / 2 + 0.06], [0.08, W / 2 - 0.06], [0.08, -W / 2 + 0.06]]
    .forEach(([a, b]) => rbox(g, 0.09, H, 0.09, 0.03, M, a, H / 2, b, 0.01));
  rbox(g, L, 0.32, W, 0.04, M, 0, 0.26, 0, 0.02);
  box(g, 0.02, H - 0.48, W - 0.16, MT.glass, L / 2 - 0.04, H / 2 + 0.2, 0); box(g, 0.02, H - 0.48, W - 0.16, MT.glass, -L / 2 + 0.04, H / 2 + 0.2, 0);
  [1, -1].forEach((s) => box(g, L - 0.14, H - 0.48, 0.02, MT.glass, 0, H / 2 + 0.2, s * (W / 2 - 0.04)));
  rbox(g, L + 0.18, 0.14, W + 0.14, 0.05, M, 0, H + 0.05, 0); box(g, L * 0.45, 0.02, W * 0.5, MT.glassD, 0.15, H + 0.13, 0);
  for (let i = 0; i < 4; i++) { const zz = -W / 2 + 0.22 + (i * (W - 0.44)) / 3; rbox(g, 0.1, 0.1, 0.15, 0.02, MT.lamp, L / 2 + 0.08, H + 0.04, zz, 0.01); rbox(g, 0.1, 0.1, 0.15, 0.02, MT.lamp, -L / 2 - 0.08, H + 0.04, zz, 0.01); }
  rod(g, new V3(L / 2 + 0.01, 0.5, 0.35), new V3(L / 2 + 0.01, 1.15, 0.05), 0.012, MT.black, 4);
  [1, -1].forEach((s) => { rod(g, new V3(L / 2 - 0.05, H * 0.8, s * W / 2), new V3(L / 2 + 0.16, H * 0.86, s * (W / 2 + 0.16)), 0.018, MT.black, 4); rbox(g, 0.04, 0.26, 0.16, 0.03, MT.black, L / 2 + 0.18, H * 0.86, s * (W / 2 + 0.18), 0.01); });
  box(g, 0.14, 0.03, 0.03, MT.chrome, -0.25, 0.85, W / 2 + 0.01); rail(g, [[-L / 2 + 0.12, 0.45, W / 2 + 0.06], [-L / 2 + 0.12, 1.4, W / 2 + 0.06]], 0.02, MT.black);
  operator(g, -0.1, 0.1, 0, o.hat);
  [0.3, -0.3].forEach((zz) => { rbox(g, 0.3, 0.08, 0.1, 0.02, MT.black, 0.05, 0.55, zz, 0.01); cylY(g, 0.025, 0.14, MT.black, 0.13, 0.65, zz, 6); });
  return g;
}

/** A knuckle-boom crane: slewing column, boom, stick, two rams, and an IK to put its tip anywhere (m frame). */
function makeCrane(m, x, y, z, o) {
  const M = o.mat, A = o.A, B = o.B, H = o.H;
  const sl = grp(m, x, y, z), sS = grp(sl), base = grp(m, x, y, z);
  cylY(base, o.ring || 0.5, 0.24, MT.dark, 0, 0.12, 0, 20); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; cylY(base, 0.03, 0.05, MT.steel, Math.cos(a) * (o.ring || 0.5) * 0.85, 0.25, Math.sin(a) * (o.ring || 0.5) * 0.85, 6); }
  cylY(sS, 0.29, H - 0.2, M, 0, 0.2 + (H - 0.2) / 2, 0, 16); rbox(sS, 0.5, 0.32, 0.56, 0.06, M, 0, H - 0.08, 0, 0.02);
  [1, -1].forEach((s) => rbox(sS, 0.42, 0.5, 0.06, 0.04, M, 0.05, H, s * 0.21, 0.01)); rbox(sS, 0.26, 0.26, 0.3, 0.04, M, 0.3, 0.55, 0, 0.02);
  rod(sS, new V3(-0.3, 0.3, 0.12), new V3(-0.25, H - 0.1, 0.18), 0.025, MT.black, 6); rod(sS, new V3(-0.3, 0.3, -0.12), new V3(-0.25, H - 0.1, -0.18), 0.025, MT.black, 6);
  const boom = grp(sl, 0, H, 0), bS = grp(boom);
  ext(bS, [[-0.28, -0.2], [A - 0.1, -0.13], [A + 0.13, 0], [A - 0.1, 0.13], [-0.28, 0.22]], 0.07, 0.3, M, 0, 0, 0, 0.02);
  cylZ(bS, 0.13, 0.5, MT.dark, 0, 0, 0, 12); cylZ(bS, 0.11, 0.4, MT.dark, A, 0, 0, 12); rbox(bS, 0.3, 0.18, 0.32, 0.03, M, 1.2, -0.2, 0, 0.01);
  [0.08, -0.08].forEach((zz) => rod(bS, new V3(0.1, 0.24, zz), new V3(A - 0.15, 0.16, zz), 0.024, MT.black, 6));
  const stick = grp(boom, A, 0, 0), kS = grp(stick);
  ext(kS, [[-0.5, 0.3], [-0.5, 0.06], [-0.2, -0.12], [B * 0.62, -0.1], [B * 0.62, 0.11], [-0.15, 0.15]], 0.05, 0.26, M, 0, 0, 0, 0.02);
  rbox(kS, B * 0.42, 0.15, 0.18, 0.02, o.inner || MT.steel, B * 0.78, 0, 0, 0.01); rbox(kS, 0.2, 0.22, 0.22, 0.03, M, B - 0.04, 0, 0, 0.01); cylZ(kS, 0.08, 0.3, MT.dark, B, -0.02, 0, 10);
  [0.06, -0.06].forEach((zz) => rod(kS, new V3(0, 0.17, zz), new V3(B * 0.6, 0.13, zz), 0.022, MT.black, 6));
  const hang = grp(stick, B, 0, 0);
  if (o.seat) o.seat(sS);
  [sS, bS, kS, base].forEach(bake);
  const links = [
    hydraulic(sl, anchor(sl, 0.4, 0.58, 0), anchor(boom, 1.2, -0.26, 0), { barrel: o.lift || 1.0, rb: 0.11, mat: M }),
    hydraulic(boom, anchor(boom, 0.75, 0.26, 0), anchor(stick, -0.42, 0.26, 0), { barrel: o.fold || 1.5, rb: 0.09, mat: M })
  ];
  const cur = new V3(), py = y + H, tmp = new V3();
  function solve(T) {
    const dx = T.x - x, dz = T.z - z, dy = T.y - py, r = Math.hypot(dx, dz);
    const D = clamp(Math.hypot(r, dy), Math.abs(A - B) + 0.05, A + B - 0.02);
    const q2 = -Math.acos(clamp((D * D - A * A - B * B) / (2 * A * B), -1, 1));
    const sc = Math.hypot(r, dy) > 0 ? D / Math.hypot(r, dy) : 1;
    const q1 = Math.atan2(dy * sc, r * sc) - Math.atan2(B * Math.sin(q2), A + B * Math.cos(q2));
    sl.rotation.y = Math.atan2(-dz, dx); boom.rotation.z = q1; stick.rotation.z = q2; hang.rotation.z = -(q1 + q2);
    cur.copy(T);
  }
  const polar = (P) => [Math.atan2(-(P.z - z), P.x - x), Math.hypot(P.x - x, P.z - z), P.y];
  function go(T, dur = 1.6, lift = 0) {
    const [a0, r0, y0] = polar(cur), [a1, r1, y1] = polar(T); let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    return tw(dur, (k) => { const a = a0 + da * k, r = r0 + (r1 - r0) * k; tmp.set(x + Math.cos(a) * r, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * lift, z - Math.sin(a) * r); solve(tmp); }, easeSine);
  }
  return { sl, boom, stick, hang, solve, go, cur, links };
}

/** Log grapple on a rotator; its grip centre is 1.16 below the crane tip. open(k), 0 = closed. */
function grapple(hang, M) {
  [1, -1].forEach((s) => rbox(hang, 0.1, 0.3, 0.04, 0.02, MT.dark, 0, -0.1, s * 0.08, 0.01));
  const rot = grp(hang); cylY(rot, 0.13, 0.22, MT.dark, 0, -0.3, 0, 14);
  const g = grp(rot, 0, -0.42, 0); rbox(g, 0.5, 0.26, 0.34, 0.05, M, 0, -0.08, 0, 0.02);
  cylX(g, 0.06, 0.6, MT.dark, 0, -0.24, 0.1, 10); cylX(g, 0.06, 0.6, MT.dark, 0, -0.24, -0.1, 10);
  [1, -1].forEach((s) => rod(g, new V3(0.22, 0.02, s * 0.06), new V3(0.22, -0.3, s * 0.26), 0.035, MT.chrome, 6));
  const jaws = [1, -1].map((s) => {
    const j = grp(g, 0, -0.24, s * 0.1), jj = grp(j); jj.rotation.y = -s * Math.PI / 2;
    [0.17, -0.17].forEach((xx) => ext(jj, [[0, 0.05], [0.14, 0.02], [0.5, -0.35], [0.48, -0.72], [0.04, -0.88], [0.02, -0.78], [0.36, -0.64], [0.36, -0.38], [0.02, -0.08]], 0.03, 0.07, M, 0, 0, xx, 0.015));
    rbox(jj, 0.08, 0.08, 0.42, 0.02, M, 0.42, -0.5, 0, 0.01);
    return j;
  });
  return { rot, g, jaws, open(k) { jaws.forEach((j, i) => (j.rotation.x = (i ? 1 : -1) * 0.75 * k)); } };
}

/** Harvester head (H7-like): rotator, tilt frame, feed rollers, delimbing knives, chain saw. Trunk axis at tl (0.42, y, 0). */
function harvHead(hang, M) {
  [1, -1].forEach((s) => rbox(hang, 0.1, 0.32, 0.05, 0.02, MT.dark, 0, -0.12, s * 0.1, 0.01));
  const rot = grp(hang, 0, -0.24, 0); cylY(rot, 0.14, 0.2, MT.dark, 0, 0, 0, 14); rbox(rot, 0.36, 0.12, 0.44, 0.03, MT.dark, -0.05, -0.14, 0, 0.01);
  [1, -1].forEach((s) => rbox(rot, 0.22, 0.32, 0.05, 0.02, MT.dark, -0.05, -0.3, s * 0.22, 0.01));
  const tl = grp(rot, 0, -0.42, 0), tS = grp(tl);
  cylZ(tS, 0.08, 0.52, MT.dark, 0, 0, 0, 10);
  ext(tS, [[-0.3, -0.02], [0.14, -0.02], [0.22, -0.28], [0.22, -0.98], [0.04, -1.12], [-0.3, -1.0]], 0.05, 0.56, M, 0, 0, 0, 0.03);
  rbox(tS, 0.1, 0.8, 0.6, 0.04, MT.dark, -0.33, -0.55, 0, 0.02); rbox(tS, 0.3, 0.14, 0.3, 0.03, MT.dark, -0.02, -1.08, -0.22, 0.01);
  rbox(tS, 0.02, 0.12, 0.57, 0.01, MT.black, -0.3, -0.25, 0, 0.005); cylY(tS, 0.06, 0.22, FM.blue, -0.36, -0.15, 0.2, 10); // colour marking can
  rod(tS, new V3(-0.25, -0.05, 0.15), new V3(-0.32, -0.6, 0.31), 0.025, MT.black, 6); rod(tS, new V3(-0.25, -0.05, -0.15), new V3(-0.32, -0.6, -0.31), 0.025, MT.black, 6);
  const knife = (y, s) => { const k = grp(tl, 0.2, y, s * 0.22), kg = grp(k, 0.22, 0, -s * 0.22); kg.rotation.y = s * 0.35; const t = add(kg, KNIFE, M); t.rotation.x = (s * Math.PI) / 2; return k; };
  const knives = [knife(-0.18, 1), knife(-0.18, -1), knife(-0.92, 1), knife(-0.92, -1)];
  const rollers = [], arms = [1, -1].map((s) => {
    const a = grp(tl, 0.12, -0.58, s * 0.25); rbox(a, 0.36, 0.14, 0.08, 0.03, M, 0.16, 0, 0, 0.01);
    const rl = grp(a, 0.3, 0, s * 0.17); cylX(rl, 0.2, 0.2, MT.dark, 0, 0, 0, 16); cylX(rl, 0.07, 0.24, MT.steel, 0, 0, 0, 8);
    for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2, b = box(rl, 0.2, 0.06, 0.04, MT.black, 0, Math.cos(an) * 0.2, Math.sin(an) * 0.2); b.rotation.x = an; }
    rollers.push(rl); return a;
  });
  const saw = grp(tl, -0.02, -1.08, -0.24); rbox(saw, 0.95, 0.04, 0.13, 0.02, MT.steel, 0.47, 0, 0, 0.01); rbox(saw, 0.97, 0.05, 0.02, 0.01, MT.black, 0.48, 0, 0.07, 0.005); rbox(saw, 0.97, 0.05, 0.02, 0.01, MT.black, 0.48, 0, -0.07, 0.005);
  bake(tS);
  const links = [hydraulic(rot, anchor(rot, -0.22, -0.2, 0), anchor(tl, -0.34, -0.5, 0), { barrel: 0.3, rb: 0.05, mat: MT.dark })];
  return {
    rot, tl, saw, rollers, links,
    open(k) { knives.forEach((kn, i) => (kn.rotation.y = (i % 2 ? 1 : -1) * 0.7 * k)); arms.forEach((a, i) => (a.rotation.y = (i ? 1 : -1) * 0.6 * k)); }
  };
}
const KNIFE = new THREE.TorusGeometry(0.27, 0.035, 5, 10, 1.9);

/** Ponsse/John Deere style 6-wheel harvester: front frame with bogie, cab and crane, articulated engine frame behind. */
function harvester(st, S) {
  const g = grp(S), d = grp(g), Y = FM.yel, K = MT.dark;
  // front frame with its bogie platform
  ext(d, [[0.5, 0.75], [3.9, 0.75], [4.25, 1.05], [4.15, 1.6], [0.5, 1.6]], 0.06, 1.4, Y, 0, 0, 0, 0.03);
  rbox(d, 0.25, 0.4, 1.8, 0.05, K, 4.3, 0.95, 0, 0.02); for (let i = 0; i < 4; i++) box(d, 0.04, 0.05, 1.3, MT.black, 4.2, 1.25 + i * 0.08, 0);
  [1, -1].forEach((s) => {
    rbox(d, 2.9, 0.12, 0.72, 0.03, Y, 2.25, 1.38, s * 1.12, 0.01); for (let x = 1.0; x < 3.7; x += 0.3) box(d, 0.12, 0.02, 0.6, MT.steel, x, 1.45, s * 1.12); // tread plate fenders
    rbox(d, 1.6, 0.3, 0.12, 0.04, K, 2.25, 0.6, s * 0.78, 0.01); cylZ(d, 0.2, 0.2, K, 2.25, 0.6, s * 0.78, 12); // bogie beam + pivot
    rbox(d, 0.06, 0.16, 0.26, 0.02, MT.lamp, 4.2, 1.45, s * 0.55, 0.01); rbox(d, 0.06, 0.1, 0.12, 0.02, MT.amber, 4.2, 1.45, s * 0.78, 0.01);
  });
  // articulation with its steering rams and hoses
  rbox(d, 0.7, 0.6, 0.8, 0.06, K, 0.25, 1.05, 0, 0.02); cylY(d, 0.12, 0.7, MT.steel, 0.25, 1.05, 0, 10);
  [1, -1].forEach((s) => { cylX(d, 0.07, 0.7, Y, 0.1, 1.05, s * 0.5, 10); cylX(d, 0.035, 0.4, MT.chrome, 0.5, 1.05, s * 0.5, 8); });
  for (let i = 0; i < 3; i++) rod(d, new V3(-0.2, 1.4, -0.2 + i * 0.2), new V3(0.7, 1.45, -0.25 + i * 0.25), 0.03, MT.black, 6);
  // rear frame: engine hood, grilles, exhaust, steps and rails
  ext(d, [[-3.55, 0.8], [0.0, 0.8], [0.0, 1.6], [-0.35, 2.25], [-3.3, 2.3], [-3.6, 1.95]], [0.04, 0.04, 0.1, 0.2, 0.2, 0.08], 1.45, Y, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => {
    rbox(d, 2.0, 0.12, 0.8, 0.03, Y, -2.15, 1.62, s * 1.12, 0.01); for (let x = -3.0; x < -1.2; x += 0.3) box(d, 0.12, 0.02, 0.66, MT.steel, x, 1.69, s * 1.12);
    for (let i = 0; i < 5; i++) box(d, 0.5, 0.04, 0.02, MT.black, -2.6, 1.7 + i * 0.1, s * 0.73); // side grille
    rbox(d, 0.06, 0.18, 0.12, 0.02, MT.tail, -3.6, 1.5, s * 0.55, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.lamp, -3.6, 2.1, s * 0.45, 0.01);
    rail(d, [[-3.2, 2.3, s * 0.68], [-3.2, 2.6, s * 0.68], [-0.8, 2.6, s * 0.68], [-0.6, 2.3, s * 0.68]], 0.025, Y);
  });
  for (let i = 0; i < 8; i++) box(d, 0.08, 0.03, 1.1, MT.black, -2.9 + i * 0.25, 2.29, 0); // top grille
  rbox(d, 0.25, 0.4, 1.7, 0.05, K, -3.7, 1.05, 0, 0.02); // rear bumper
  cylY(d, 0.08, 1.0, MT.steel, -0.85, 2.75, -0.48, 10); cylY(d, 0.1, 0.06, MT.black, -0.85, 3.27, -0.48, 10); cylY(d, 0.18, 0.4, MT.dark, -1.3, 2.45, 0.45, 12); // exhaust, air filter
  [0.95, 1.25, 1.55].forEach((y, i) => rbox(d, 0.35, 0.04, 0.22, 0.01, MT.black, 0.65 + i * 0.12, y - 0.2, 0.98, 0.01)); // steps to the cab
  rbox(d, 0.04, 0.3, 0.9, 0.02, MT.black, -1.8, 1.25, 0.735, 0.01);
  forestCab(d, 3.0, 1.62, 0.05, { L: 1.75, W: 1.7, H: 1.65, M: Y });
  decalOn(d, 'FOREST', 1.0, 0.22, '#2a2f40', -2.0, 1.95, 0.74);
  bake(d);
  const wheels = [];
  [1, -1].forEach((s) => { [1.55, 2.95].forEach((x) => wheels.push(agriTire(g, 0.62, 0.62, x, 0.62, s * 1.12, MT.dark, s))); wheels.push(agriTire(g, 0.76, 0.74, -2.15, 0.76, s * 1.12, MT.dark, s)); });
  const colX = 1.1, crane = makeCrane(g, colX, 1.6, 0, { mat: Y, A: 3.7, B: 3.5, H: 1.65, lift: 1.1, fold: 1.7 });
  const head = harvHead(crane.hang, Y);
  beacon(st, g, 3.0, 3.4, -0.6);
  shadows(g); return { g, wheels, crane, head, colX };
}

/** 8-wheel forwarder (John Deere style): engine and cab in front, load space with bunks and stakes, crane and grapple. */
function forwarder(st, S) {
  const g = grp(S), d = grp(g), M = FM.green, MD = FM.greenD, Y = FM.lime, K = MT.dark;
  ext(d, [[1.1, 0.75], [5.0, 0.75], [5.25, 1.05], [5.15, 1.6], [1.1, 1.6]], 0.06, 1.4, M, 0, 0, 0, 0.03);
  ext(d, [[3.45, 1.55], [5.1, 1.55], [5.15, 2.05], [4.9, 2.3], [3.45, 2.35]], [0.04, 0.06, 0.12, 0.15, 0.05], 1.5, M, 0, 0, 0, 0.03);
  rbox(d, 0.08, 0.5, 1.2, 0.03, K, 5.18, 1.85, 0, 0.01); for (let i = 0; i < 5; i++) box(d, 0.05, 0.04, 1.1, MT.black, 5.22, 1.67 + i * 0.09, 0);
  rbox(d, 0.25, 0.4, 1.8, 0.05, K, 5.3, 0.95, 0, 0.02);
  cylY(d, 0.08, 1.1, MT.steel, 4.2, 2.8, -0.5, 10); cylY(d, 0.1, 0.05, MT.black, 4.2, 3.35, -0.5, 10); cylY(d, 0.17, 0.4, K, 3.8, 2.5, 0.48, 12);
  [1, -1].forEach((s) => {
    rbox(d, 2.6, 0.12, 0.72, 0.03, M, 3.4, 1.38, s * 1.12, 0.01); rbox(d, 2.6, 0.06, 0.72, 0.02, Y, 3.4, 1.3, s * 1.12, 0.01);
    rbox(d, 1.6, 0.3, 0.12, 0.04, K, 3.4, 0.6, s * 0.78, 0.01); cylZ(d, 0.2, 0.2, K, 3.4, 0.6, s * 0.78, 12);
    rbox(d, 0.06, 0.15, 0.25, 0.02, MT.lamp, 5.2, 2.15, s * 0.5, 0.01); rbox(d, 1.6, 0.08, 0.02, 0.01, Y, 4.25, 1.75, s * 0.76, 0.005);
    rbox(d, 4.6, 0.3, 0.12, 0.04, K, -2.4, 0.6, s * 0.78, 0.01); cylZ(d, 0.2, 0.2, K, -2.5, 0.6, s * 0.78, 12); rbox(d, 2.6, 0.12, 0.72, 0.03, M, -2.5, 1.32, s * 1.12, 0.01);
  });
  rbox(d, 0.7, 0.6, 0.8, 0.06, K, 0.95, 1.05, 0, 0.02); cylY(d, 0.12, 0.7, MT.steel, 0.95, 1.05, 0, 10);
  // rear frame: load beam, bunks with stakes, headboard
  rbox(d, 5.6, 0.45, 0.9, 0.06, M, -2.0, 1.1, 0, 0.02); rbox(d, 0.25, 0.35, 1.9, 0.05, K, -4.85, 1.0, 0, 0.02);
  [1, -1].forEach((s) => rbox(d, 0.06, 0.16, 0.2, 0.02, MT.tail, -4.98, 1.15, s * 0.7, 0.01));
  [-0.85, -2.3, -3.75].forEach((x) => { rbox(d, 0.22, 0.2, 2.5, 0.04, K, x, 1.43, 0, 0.02); [1, -1].forEach((s) => { const p = rbox(d, 0.14, 1.55, 0.14, 0.04, MD, x, 2.25, s * 1.2, 0.02); p.rotation.x = -s * 0.06; }); });
  const hb = grp(d, -0.05, 1.45, 0); [1, -1].forEach((s) => rbox(hb, 0.14, 1.8, 0.14, 0.03, K, 0, 0.9, s * 1.15, 0.01)); for (let y = 0.25; y < 1.8; y += 0.3) box(hb, 0.06, 0.06, 2.3, K, 0, y, 0); for (let z = -0.9; z <= 0.9; z += 0.45) box(hb, 0.05, 1.7, 0.05, K, 0, 0.9, z);
  forestCab(d, 2.55, 1.62, 0.05, { L: 1.7, W: 1.65, H: 1.7, M });
  [0.95, 1.25].forEach((y, i) => rbox(d, 0.35, 0.04, 0.22, 0.01, MT.black, 1.7 + i * 0.1, y, 0.98, 0.01));
  decalOn(d, 'FORWARDER', 1.3, 0.22, '#f2e85a', 4.3, 1.95, 0.76);
  bake(d);
  const wheels = [];
  [1, -1].forEach((s) => [2.75, 4.05, -1.85, -3.15].forEach((x) => wheels.push(agriTire(g, 0.6, 0.6, x, 0.6, s * 1.12, MT.dark, s))));
  const crane = makeCrane(g, 0.55, 1.33, 0, { mat: Y, A: 3.4, B: 3.3, H: 1.55, lift: 1.0, fold: 1.6 });
  const gr = grapple(crane.hang, MD);
  beacon(st, g, 2.55, 3.45, -0.6);
  shadows(g); return { g, wheels, crane, grapple: gr };
}

/** Log truck with its own crane (high seat on the column), stakes and outriggers. */
function logTruck(st, S) {
  const g = grp(S), d = grp(g), K = MT.dark, B = FM.blue;
  [0.45, -0.45].forEach((z) => rbox(d, 9.0, 0.3, 0.16, 0.03, MT.black, -0.4, 1.0, z));
  truckCab(d, B, 2.7);
  rbox(d, 0.2, 1.4, 2.0, 0.06, K, 2.58, 1.85, 0, 0.02); // cab guard behind the cab
  [1, -1].forEach((s) => { cylX(d, 0.28, 1.0, MT.steel, 1.0, 0.85, s * 0.8, 14); rbox(d, 0.7, 0.4, 0.3, 0.04, K, 0.0, 0.85, s * 0.85, 0.02); });
  [1.0, -0.6, -2.2, -3.8].forEach((x) => { rbox(d, 0.22, 0.2, 2.5, 0.04, K, x, 1.27, 0, 0.02); [1, -1].forEach((s) => rbox(d, 0.14, 1.75, 0.14, 0.04, FM.blueD, x, 2.15, s * 1.18, 0.02)); });
  [1, -1].forEach((s) => { rbox(d, 0.04, 0.5, 0.45, 0.02, MT.black, -4.6, 0.65, s * 0.9, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, -4.85, 1.0, s * 0.85, 0.01); });
  rbox(d, 0.14, 0.24, 2.2, 0.03, MT.stripes, -4.88, 0.75, 0, 0.01);
  decalOn(d, 'BOIS', 1.0, 0.36, '#ffffff', 3.5, 2.55, 1.12);
  bake(d);
  // outriggers: a beam that slides out, a leg that goes down
  const legs = [1, -1].map((s) => { const beam = grp(g, 2.0, 0.95, s * 0.55); rbox(beam, 0.3, 0.26, 1.0, 0.04, FM.blueD, 0, 0, 0, 0.02); const foot = grp(beam, 0, 0, s * 0.45); rbox(foot, 0.22, 0.9, 0.22, 0.04, MT.dark, 0, -0.35, 0, 0.02); cylY(foot, 0.2, 0.08, MT.black, 0, -0.8, 0, 12); rbox(foot, 0.04, 0.2, 0.24, 0.01, MT.stripes, 0, -0.1, 0, 0.005); return { beam, foot, s }; });
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(tire(g, 0.52, 0.38, 3.05, 0.52, s * 0.95, FM.grey, s)); [-2.6, -3.8].forEach((x) => { wheels.push(tire(g, 0.52, 0.55, x, 0.52, s * 0.85, FM.grey, s)); fender(g, 0.62, 0.6, x, 0.52, s * 0.85, MT.dark, Math.PI * 0.5); }); });
  const seat = (sS) => { const sg = grp(sS, -0.1, 1.15, 0.45); rbox(sg, 0.6, 0.06, 0.6, 0.02, MT.dark, 0, 0, 0, 0.01); operator(sg, -0.05, 0.03, 0); rbox(sg, 0.8, 0.05, 0.75, 0.02, FM.blueD, 0, 1.15, 0, 0.01); [[0.35, 0.3], [0.35, -0.3], [-0.35, 0.3], [-0.35, -0.3]].forEach(([a, b]) => box(sg, 0.04, 1.12, 0.04, MT.dark, a, 0.58, b)); rail(sS, [[-0.2, 0.2, 0.3], [-0.2, 1.1, 0.4]], 0.02, MT.black); };
  const crane = makeCrane(g, 2.0, 1.15, 0, { mat: FM.yel, A: 3.3, B: 3.2, H: 2.0, lift: 1.2, fold: 1.6, seat });
  const gr = grapple(crane.hang, MT.dark);
  shadows(g); return { g, wheels, crane, grapple: gr, legs };
}

/** Sawmill: a band saw headrig, the carriage on rails, the log deck, the sawyer's booth, the roof and the plank stack. */
function sawmill(st, S) {
  const all = grp(S), d = grp(all), W = FM.woodD, K = MT.dark;
  // rails and the carriage track
  [-0.3, -0.95].forEach((z) => { box(d, 15, 0.08, 0.1, MT.steel, 0, 0.08, z); for (let x = -7; x <= 7; x += 0.7) box(d, 0.14, 0.06, 1.0, W, x, 0.03, -0.62); });
  // log deck: inclined skids from the back down to the carriage
  [-6.3, -5, -3.7].forEach((x) => { rod(d, new V3(x, 0.92, -0.95), new V3(x, 1.4, -3.4), 0.08, K, 6); cylY(d, 0.06, 1.4, K, x, 0.7, -3.4, 6); cylY(d, 0.06, 0.9, K, x, 0.45, -1.6, 6); });
  logStack(d, -5, -5.0, 4, 3.0, 0.3);
  // band saw headrig: a big orange C-frame, two large wheels (top one under a guard, bottom one in its pit housing),
  // the steel band running round them (the cutting strand faces the log at z = 0.1), the blade guides and the motor
  const saw = grp(all, 0, 0, 0), sw = grp(saw), O = FM.orange, WR = 0.78, WZ = 0.1 + WR, WY = [3.25, 0.35];
  rbox(sw, 0.34, 4.0, 1.3, 0.12, O, -0.5, 2.0, WZ + 0.25, 0.04); // the column (on the infeed side, behind the wheels)
  rbox(sw, 0.5, 0.36, 1.5, 0.08, O, -0.42, WY[0], WZ, 0.03); // arm to the top axle
  rbox(sw, 1.3, 0.3, 1.9, 0.08, K, -0.25, 0.15, WZ + 0.1, 0.03); // base plate
  rbox(sw, 0.7, 0.62, 1.9, 0.12, O, 0, 0.31, WZ + 0.05, 0.04); // pit housing of the bottom wheel
  rbox(sw, 0.72, 0.1, 1.92, 0.03, MT.stripes, 0.01, 0.6, WZ + 0.05, 0.01);
  add(sw, GUARD, FM.orangeDS, 0.02, WY[0], WZ).rotation.set(0, 0, Math.PI / 2); // top guard (half shell)
  add(sw, GUARDP, FM.orangeDS, -0.25, WY[0], WZ).rotation.set(0, Math.PI / 2, 0); // its back plate
  // the band: two straight strands + the bands over the wheel rims
  [0.1, WZ + WR].forEach((z) => { box(sw, 0.24, WY[0] - WY[1], 0.03, MT.chrome, 0, (WY[0] + WY[1]) / 2, z); });
  box(sw, 0.04, WY[0] - WY[1], 0.035, MT.black, -0.12, (WY[0] + WY[1]) / 2, 0.1); // the teeth
  // blade guides above and below the log, the tension handwheel, the motor and its belt
  rbox(sw, 0.4, 0.5, 0.36, 0.05, MT.dark, 0, 1.9, 0.12, 0.01); rbox(sw, 0.3, 0.16, 1.1, 0.04, O, -0.05, 2.05, 0.65, 0.01); cylY(sw, 0.06, 0.4, MT.steel, 0, 2.3, 0.65, 8);
  rbox(sw, 0.3, 0.2, 0.2, 0.04, MT.dark, 0, 0.62, 0.2, 0.01);
  cylX(sw, 0.2, 0.06, MT.dark, -0.72, WY[0] + 0.45, WZ + 0.5, 14); cylX(sw, 0.04, 0.16, MT.steel, -0.66, WY[0] + 0.45, WZ + 0.5, 8);
  rbox(sw, 0.9, 0.7, 0.8, 0.08, FM.blue, -1.25, 0.45, WZ + 0.6, 0.02); cylX(sw, 0.24, 0.2, K, -0.7, 0.45, WZ + 0.6, 12); for (let i = 0; i < 4; i++) box(sw, 0.86, 0.03, 0.03, FM.blueD, -1.25, 0.25 + i * 0.13, WZ + 1.01);
  rbox(sw, 0.5, 0.8, 0.1, 0.03, MT.dark, -0.5, 1.05, WZ + 1.01, 0.01); // belt cover
  rbox(sw, 0.06, 0.28, 0.5, 0.02, FM.yel, -0.68, 2.6, WZ + 0.25, 0.01); // the little sign
  const wheels = WY.map((y) => {
    cylX(saw, 0.11, 0.62, MT.steel, -0.28, y, WZ, 10); cylX(saw, 0.16, 0.12, MT.dark, 0.18, y, WZ, 12); // axle and hub cap
    const w = grp(saw, 0, y, WZ); cylX(w, WR - 0.02, 0.16, FM.white, 0, 0, 0, 32); add(w, BAND, MT.chrome).scale.set(0.24, WR, WR);
    cylX(w, WR * 0.72, 0.18, MT.dark, 0, 0, 0, 28); cylX(w, WR * 0.62, 0.2, FM.white, 0, 0, 0, 28);
    for (let i = 0; i < 3; i++) { const b = box(w, 0.22, WR * 1.5, 0.2, FM.red, 0, 0, 0); b.rotation.x = (i * Math.PI) / 3; }
    cylX(w, 0.17, 0.26, MT.dark, 0, 0, 0, 14); return w;
  });
  const bladeAt = anchor(saw, 0, 2.4, 0.1);
  // carriage with knees and dogs
  const carriage = grp(all, -5, 0, 0), cS = grp(carriage);
  rbox(cS, 3.4, 0.18, 1.25, 0.05, FM.red, 0, 0.62, -0.62, 0.02); rbox(cS, 3.2, 0.3, 1.0, 0.04, K, 0, 0.36, -0.62, 0.02);
  [-1, 0, 1].forEach((x) => { rbox(cS, 0.18, 0.5, 0.16, 0.03, FM.red, x, 0.95, -0.55, 0.01); rbox(cS, 0.12, 0.08, 0.3, 0.02, MT.steel, x, 1.2, -0.42, 0.01); });
  [-1.3, 1.3].forEach((x) => [-0.3, -0.95].forEach((z) => cylZ(cS, 0.14, 0.1, K, x, 0.2, z, 12)));
  rbox(cS, 0.4, 0.4, 0.5, 0.04, K, -1.5, 0.95, -0.95, 0.01);
  // sawyer's booth on stilts
  const bo = grp(d, 2.6, 0, -2.4); [[0.6, 0.6], [0.6, -0.6], [-0.6, 0.6], [-0.6, -0.6]].forEach(([a, b]) => box(bo, 0.1, 1.3, 0.1, K, a, 0.65, b));
  rbox(bo, 1.5, 0.1, 1.5, 0.03, K, 0, 1.3, 0, 0.01); rbox(bo, 1.5, 0.6, 1.5, 0.04, FM.blue, 0, 1.6, 0, 0.02); box(bo, 1.42, 0.8, 1.42, MT.glass, 0, 2.3, 0); rbox(bo, 1.7, 0.12, 1.7, 0.04, FM.roof, 0, 2.76, 0, 0.02);
  const op = operator(bo, 0, 1.36, 0); op.rotation.y = Math.PI * 0.85; rail(bo, [[0.8, 0, 0.75], [0.8, 1.3, 0.75]], 0.03, K);
  for (let i = 0; i < 5; i++) rbox(bo, 0.4, 0.04, 0.25, 0.01, K, 1.0 + i * 0.12, 0.25 + i * 0.25, 0.6, 0.01);
  // the roof on wooden posts, high enough to see under it, with its sign
  [[-7.2, -3.8], [7.2, -3.8], [-7.2, -1.6], [7.2, -1.6], [3.8, -1.6]].forEach(([x, z]) => box(d, 0.25, 4.6, 0.25, W, x, 2.3, z));
  [-3.8, -1.6].forEach((z) => box(d, 14.8, 0.3, 0.25, W, 0, 4.45, z));
  const rf = rbox(d, 15.4, 0.12, 3.4, 0.04, FM.roof, 0, 4.7, -2.7, 0.02); rf.rotation.x = 0.08;
  for (let x = -7.2; x <= 7.2; x += 0.6) { const r = box(d, 0.06, 0.06, 3.4, FM.redD, x, 4.78, -2.7); r.rotation.x = 0.08; }
  rbox(d, 3.6, 0.7, 0.1, 0.03, FM.wood, 0, 4.1, -1.42, 0.01); decalOn(d, 'SCIERIE', 3.2, 0.55, '#5a3418', 0, 4.1, -1.36);
  // outfeed rollers, the slab pile, sawdust, plank stack with stickers
  for (let x = 1.4; x < 7; x += 0.7) { cylZ(d, 0.08, 1.1, MT.steel, x, 0.75, 0.7, 10); } [1.4, 6.6].forEach((x) => [0.2, 1.2].forEach((z) => box(d, 0.08, 0.75, 0.08, K, x, 0.37, z))); box(d, 5.4, 0.08, 0.08, K, 4, 0.7, 0.15); box(d, 5.4, 0.08, 0.08, K, 4, 0.7, 1.25);
  pile(d, 1.2, 2.4, 0.6, FM.sawdust);
  const stack = grp(d, 8.8, 0, 2.6); [-1.1, 0, 1.1].forEach((x) => rbox(stack, 0.2, 0.2, 2.2, 0.03, K, x, 0.1, 0, 0.01));
  let y = 0.26; for (let row = 0; row < 4; row++) { for (let i = 0; i < 4; i++) rbox(stack, 3.0, 0.1, 0.42, 0.02, FM.plank, rnd(-0.05, 0.05), y, -0.75 + i * 0.5, 0.01); y += 0.08; [-1.1, 0, 1.1].forEach((x) => box(stack, 0.06, 0.05, 2.1, FM.woodD, x, y, 0)); y += 0.08; }
  [[11.6, 1.6, 0], [11.4, -1.8, 0.2]].forEach(([x, z, r]) => { const s2 = grp(d, x, 0, z); s2.rotation.y = r; let yy = 0.1; for (let row = 0; row < 6; row++) { for (let i = 0; i < 4; i++) rbox(s2, 3.0, 0.1, 0.42, 0.02, FM.plank, 0, yy, -0.75 + i * 0.5, 0.01); yy += 0.18; } });
  bake(d); bake(sw); bake(cS);
  return { all, carriage, saw, wheels, bladeAt, stackTop: y + 0.02 };
}
const GUARD = new THREE.CylinderGeometry(0.9, 0.9, 0.56, 24, 1, true, 0, Math.PI);
const GUARDP = new THREE.CircleGeometry(0.9, 24, 0, Math.PI);
const BAND = new THREE.CylinderGeometry(1, 1, 1, 36, 1, true); BAND.rotateZ(Math.PI / 2);
/** A sawable log: a circle cut by the plane z = c (keeps z ≤ c), lying along x. */
function cutLogGeo(r, c, L) {
  const s = new THREE.Shape();
  if (c >= r) s.absarc(0, 0, r, 0, Math.PI * 2, false); else { const a = Math.acos(c / r); s.absarc(0, 0, r, a, Math.PI * 2 - a, false); s.closePath(); }
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -L / 2); g.rotateY(-Math.PI / 2); return g;
}
function sawLog(p, L, r, c) { const m = new THREE.Mesh(cutLogGeo(r, c, L), [FM.wood, FM.bark]); m.castShadow = m.receiveShadow = true; p.add(m); m.userData.L = L; return m; }
function setCut(m, r, c, L) { m.geometry.dispose(); m.geometry = cutLogGeo(r, c, L); }
function slabMesh(p, r, c, L) {
  const a = Math.acos(c / r), s = new THREE.Shape(); s.absarc(0, 0, r, -a, a, false); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -L / 2); g.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(g, [FM.wood, FM.bark]); m.castShadow = m.receiveShadow = true; p.add(m); return m;
}
function plankMesh(p, r, c0, c1, L) {
  const h0 = Math.sqrt(r * r - c0 * c0), h1 = Math.sqrt(r * r - c1 * c1), s = new THREE.Shape();
  s.moveTo(c0, -h0); s.lineTo(c1, -h1); s.lineTo(c1, h1); s.lineTo(c0, h0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2); g.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(g, FM.plank); m.castShadow = m.receiveShadow = true; p.add(m); return m;
}

/** Forestry tractor (rear axle at x = 0), facing +x. */
function tractor(p, M, MD) {
  const g = grp(p), d = grp(g), K = MT.dark;
  rbox(d, 3.0, 0.45, 0.8, 0.08, K, 1.3, 0.78, 0, 0.02);
  ext(d, [[0.55, 0.98], [3.25, 0.98], [3.4, 1.18], [3.35, 1.62], [3.1, 1.8], [0.55, 1.82]], [0.04, 0.08, 0.12, 0.2, 0.1, 0.04], 0.95, M, 0, 0, 0, 0.03);
  rbox(d, 0.06, 0.55, 0.7, 0.04, K, 3.38, 1.38, 0, 0.01); for (let i = 0; i < 5; i++) box(d, 0.07, 0.03, 0.62, MT.black, 3.41, 1.18 + i * 0.1, 0);
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.12, 0.18, 0.03, MT.lamp, 3.33, 1.64, s * 0.3, 0.01); for (let i = 0; i < 4; i++) box(d, 0.5, 0.03, 0.02, MT.black, 2.5, 1.25 + i * 0.1, s * 0.48); });
  rbox(d, 0.4, 0.4, 0.9, 0.05, K, 3.6, 0.85, 0, 0.02);
  rail(d, [[3.6, 0.6, 0.5], [3.88, 0.95, 0.5], [3.88, 1.65, 0.38], [3.88, 1.65, -0.38], [3.88, 0.95, -0.5], [3.6, 0.6, -0.5]], 0.04, MT.black);
  rbox(d, 2.6, 0.06, 0.8, 0.02, MT.black, 1.6, 0.52, 0, 0.01); // belly guard
  forestCab(d, -0.1, 1.32, 0, { L: 1.5, W: 1.45, H: 1.5, M, hat: MT.hat });
  [1, -1].forEach((s) => fender(d, 0.95, 0.56, 0, 0.82, s * 0.95, MD, Math.PI * 0.6));
  cylY(d, 0.05, 0.75, MT.steel, 2.6, 2.15, 0.32, 8); cylY(d, 0.07, 0.05, MT.black, 2.6, 2.54, 0.32, 8);
  rbox(d, 0.35, 0.25, 0.5, 0.03, K, -0.75, 0.62, 0, 0.01); [0.3, -0.3].forEach((z) => rod(d, new V3(-0.2, 0.55, z), new V3(-0.75, 0.45, z), 0.04, K, 6));
  bake(d);
  const wheels = [];
  [1, -1].forEach((s) => { wheels.push(agriTire(g, 0.82, 0.5, 0, 0.82, s * 0.95, MD, s)); wheels.push(agriTire(g, 0.52, 0.36, 2.35, 0.52, s * 0.8, MD, s)); });
  return { g, wheels };
}

/** Wood chipper on a trailer (Jenz-like) towed by a forestry tractor: crane, feed table, rollers, drum, discharge chute. */
function chipper(st, S) {
  const g = grp(S), T = tractor(g, FM.green, FM.greenD); T.g.position.x = 1.8;
  const d = grp(g), O = FM.orange, OD = FM.orangeD, K = MT.dark;
  rbox(d, 1.6, 0.16, 0.2, 0.04, K, 0.3, 0.64, 0, 0.02); // drawbar
  ext(d, [[-4.0, 0.95], [-0.5, 0.95], [-0.3, 1.25], [-0.4, 2.3], [-4.0, 2.3]], [0.04, 0.1, 0.12, 0.08, 0.06], 1.9, O, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => { for (let i = 0; i < 6; i++) box(d, 0.03, 0.9, 0.02, OD, -3.6 + i * 0.32, 1.6, s * 0.96); rbox(d, 1.3, 0.08, 0.02, 0.01, MT.white, -1.3, 2.1, s * 0.96, 0.005); });
  rbox(d, 0.5, 1.2, 1.9, 0.06, OD, -4.15, 1.6, 0, 0.02); box(d, 0.2, 0.75, 1.3, MT.black, -4.35, 1.55, 0); // the mouth
  rbox(d, 1.6, 0.08, 1.4, 0.02, K, -5.1, 1.08, 0, 0.01); [1, -1].forEach((s) => { const w = rbox(d, 1.6, 0.5, 0.06, 0.02, K, -5.1, 1.32, s * 0.76, 0.01); w.rotation.x = s * 0.35; }); // feed table
  cylY(d, 0.12, 0.9, K, -5.6, 0.55, 0.5, 8); cylY(d, 0.12, 0.9, K, -5.6, 0.55, -0.5, 8);
  [1, -1].forEach((s) => { fender(d, 0.62, 0.5, -2.4, 0.5, s * 1.05, K, Math.PI * 0.55); fender(d, 0.62, 0.5, -3.4, 0.5, s * 1.05, K, Math.PI * 0.55); rbox(d, 0.06, 0.15, 0.2, 0.02, MT.tail, -4.42, 1.1, s * 0.8, 0.01); });
  // the drum's pulley on the side (it turns), and the chute
  decalOn(d, 'BROYEUR', 1.4, 0.3, '#ffffff', -2.2, 1.55, 0.97);
  bake(d);
  const drum = grp(g, -1.1, 1.45, 0.98); cylZ(drum, 0.42, 0.1, K, 0, 0, 0, 20); cylZ(drum, 0.12, 0.14, MT.steel, 0, 0, 0, 10); for (let i = 0; i < 3; i++) { const b = box(drum, 0.08, 0.76, 0.12, MT.steel, 0, 0, 0.02); b.rotation.z = (i * Math.PI) / 3; }
  const rollers = [1.27, 1.8].map((y) => { const r = grp(g, -4.5, y, 0); cylZ(r, 0.2, 1.2, MT.steel, 0, 0, 0, 12); for (let i = 0; i < 6; i++) { const b = box(r, 0.06, 0.46, 1.2, K, 0, 0, 0); b.rotation.z = (i * Math.PI) / 6; } return r; });
  const ch = grp(g, -2.6, 2.3, -0.3); ch.rotation.y = Math.PI / 2; cylY(ch, 0.32, 0.12, K, 0, 0.06, 0, 16);
  const pts = [[0, 0.1], [0, 1.2], [0.2, 1.65], [0.6, 1.9], [1.05, 1.85]]; for (let i = 0; i < pts.length - 1; i++) { rod(ch, new V3(pts[i][0], pts[i][1], 0), new V3(pts[i + 1][0], pts[i + 1][1], 0), 0.2, O, 12); sph(ch, 0.2, O, pts[i + 1][0], pts[i + 1][1], 0); }
  const hood = rbox(ch, 0.4, 0.1, 0.5, 0.03, OD, 1.25, 1.78, 0, 0.01); hood.rotation.z = -0.4; const out = anchor(ch, 1.25, 1.7, 0);
  const crane = makeCrane(g, -0.85, 2.28, 0.45, { mat: O, A: 3.0, B: 2.9, H: 1.1, lift: 0.9, fold: 1.4, ring: 0.42 });
  const gr = grapple(crane.hang, K);
  beacon(st, g, 1.7, 3.0, -0.5);
  shadows(g); return { g, wheels: T.wheels, crane, grapple: gr, drum, rollers, out };
}

/** Tractor + planting machine with two seated planters, seedling trays and coulter discs. */
function planter(st, S) {
  const g = grp(S), T = tractor(g, FM.green, FM.greenD), d = grp(g), K = MT.dark;
  rbox(d, 1.0, 0.14, 0.18, 0.03, K, -1.1, 0.55, 0, 0.01);
  rbox(d, 2.4, 0.14, 2.0, 0.04, FM.red, -2.7, 0.75, 0, 0.02); rbox(d, 2.3, 0.05, 1.9, 0.02, K, -2.7, 0.84, 0, 0.01);
  [1, -1].forEach((s) => {
    // seedling trays in front of each planter
    const rk = grp(d, -1.8, 0.85, s * 0.55); rbox(rk, 0.5, 0.06, 0.6, 0.02, FM.red, 0, 0.7, 0, 0.01); rbox(rk, 0.5, 0.06, 0.6, 0.02, FM.red, 0, 0.35, 0, 0.01); [[0.22, 0.27], [0.22, -0.27], [-0.22, 0.27], [-0.22, -0.27]].forEach(([a, b]) => box(rk, 0.04, 0.8, 0.04, K, a, 0.4, b));
    [0.38, 0.73].forEach((y) => { rbox(rk, 0.46, 0.08, 0.56, 0.02, FM.earth, 0, y + 0.06, 0, 0.01); for (let i = 0; i < 6; i++) { const c = add(rk, CONE, FM.needleL, -0.15 + (i % 3) * 0.15, y + 0.1, i < 3 ? 0.12 : -0.12); c.scale.set(0.07, 0.18, 0.07); } });
    const sg = grp(d, -2.75, 0.84, s * 0.55); rbox(sg, 0.45, 0.08, 0.45, 0.03, K, 0, 0.2, 0, 0.01); cylY(sg, 0.05, 0.2, K, 0, 0.1, 0, 6); const op = operator(sg, 0, 0.24, 0, FM.shutter); op.rotation.y = Math.PI;
    cylZ(d, 0.32, 0.03, MT.steel, -3.3, 0.32, s * 0.55, 20); rbox(d, 0.12, 0.5, 0.08, 0.02, K, -3.3, 0.6, s * 0.55, 0.01); // coulter disc
    [-0.12, 0.12].forEach((dz) => { const w = cylZ(d, 0.18, 0.06, MT.dark, -3.85, 0.18, s * 0.55 + dz, 12); w.rotation.x = dz * 2; }); rbox(d, 0.5, 0.06, 0.06, 0.02, K, -3.6, 0.4, s * 0.55, 0.01);
    rbox(d, 0.6, 0.06, 0.06, 0.02, MT.stripes, -3.9, 0.85, s * 0.9, 0.01);
  });
  bake(d);
  const wheels = [...T.wheels]; [1, -1].forEach((s) => wheels.push(tire(g, 0.35, 0.22, -2.4, 0.35, s * 1.15, FM.grey, s)));
  beacon(st, g, -0.1, 2.95, -0.5);
  shadows(g); return { g, wheels };
}

/** Forest fire tanker (CCF, "camion citerne feux de forêt"): a high 4x4 with a red crew cab under its protective roll cage,
 *  a rounded tank body with roller-shutter lockers, a white band, the roof cannon, a rear hose reel, blue lights and big off-road tyres. */
function fireTruck(st, S) {
  const g = grp(S), d = grp(g), R = FM.red, K = MT.dark, FX = 2.85, RX = -1.55, WR = 0.62;
  // chassis, axles with their differentials and springs: lots of space under the truck
  [0.48, -0.48].forEach((z) => rbox(d, 7.0, 0.28, 0.16, 0.03, MT.black, 0.3, 1.12, z));
  [FX, RX].forEach((x) => { cylZ(d, 0.09, 1.7, K, x, WR, 0, 10); sph(d, 0.24, K, x, WR, 0).scale.set(0.24, 0.22, 0.28); rod(d, new V3(x, WR + 0.1, 0), new V3(x + (x > 0 ? -0.9 : 0.9), 1.0, 0), 0.06, K, 8); // propshaft
    [1, -1].forEach((s) => { rbox(d, 1.3, 0.1, 0.14, 0.03, MT.black, x, 0.88, s * 0.5, 0.01); rod(d, new V3(x + 0.3, WR + 0.05, s * 0.65), new V3(x + 0.45, 1.05, s * 0.55), 0.04, MT.steel, 6); }); });
  // the crew cab (two rows of doors)
  const c = grp(d, 1.45, 1.3, 0);
  ext(c, [[0, 0], [2.45, 0], [2.52, 0.6], [2.42, 0.95], [2.22, 1.8], [2.02, 1.92], [0, 1.92]], [0.04, 0.1, 0.12, 0.12, 0.2, 0.18, 0.08], 2.3, R, 0, 0, 0, 0.05);
  box(c, 0.03, 0.88, 2.06, MT.glassD, 2.33, 1.38, 0).rotation.z = 0.23; // windscreen
  box(c, 0.05, 0.05, 2.1, MT.black, 2.4, 0.97, 0); rod(c, new V3(2.39, 1.0, 0.25), new V3(2.3, 1.45, 0.05), 0.012, MT.black, 4); rod(c, new V3(2.39, 1.0, -0.6), new V3(2.3, 1.45, -0.8), 0.012, MT.black, 4);
  [1, -1].forEach((s) => {
    rbox(c, 0.78, 0.6, 0.03, 0.06, MT.glassD, 1.72, 1.42, s * 1.15, 0.01); rbox(c, 0.72, 0.6, 0.03, 0.06, MT.glassD, 0.82, 1.42, s * 1.15, 0.01); rbox(c, 0.3, 0.5, 0.03, 0.05, MT.glassD, 0.2, 1.45, s * 1.15, 0.01);
    [2.2, 1.27, 0.38].forEach((x) => box(c, 0.025, 1.78, 0.02, MT.black, x, 0.92, s * 1.16)); box(c, 1.85, 0.02, 0.02, MT.black, 1.29, 0.04, s * 1.16);
    [1.4, 0.5].forEach((x) => rbox(c, 0.14, 0.04, 0.03, 0.01, MT.chrome, x, 1.0, s * 1.17, 0.008));
    rail(c, [[1.32, 0.35, s * 1.19], [1.32, 1.1, s * 1.19]], 0.018, MT.chrome);
    // steps in two levels, between the front wheel and the back of the cab
    [[-0.2, 0.5], [-0.55, 0.48]].forEach(([y, w]) => rbox(c, w, 0.05, 0.28, 0.02, MT.black, 0.3, y, s * 1.02, 0.01)); box(c, 0.04, 0.6, 0.04, MT.black, 0.06, -0.3, s * 1.12); box(c, 0.04, 0.6, 0.04, MT.black, 0.54, -0.3, s * 1.12);
    // big mirrors on arms
    rod(c, new V3(2.25, 1.55, s * 1.12), new V3(2.55, 1.62, s * 1.42), 0.022, MT.black, 6); rbox(c, 0.08, 0.46, 0.2, 0.03, MT.black, 2.58, 1.4, s * 1.45, 0.01); rbox(c, 0.02, 0.4, 0.15, 0.02, MT.glassD, 2.63, 1.4, s * 1.45, 0.005);
    rbox(c, 0.06, 0.16, 0.14, 0.03, MT.black, 2.55, 1.08, s * 1.36, 0.01);
    // headlights, indicators, white band
    rbox(c, 0.06, 0.18, 0.36, 0.05, MT.lamp, 2.52, 0.38, s * 0.78, 0.01); rbox(c, 0.06, 0.1, 0.14, 0.03, MT.amber, 2.52, 0.38, s * 1.04, 0.01);
    rbox(c, 2.42, 0.22, 0.03, 0.01, FM.white, 1.2, 0.18, s * 1.16, 0.01);
  });
  rbox(c, 0.06, 0.42, 1.25, 0.04, MT.black, 2.53, 0.62, 0); for (let i = 0; i < 4; i++) box(c, 0.02, 0.03, 1.15, MT.chrome, 2.57, 0.48 + i * 0.09, 0);
  rbox(c, 0.03, 0.22, 2.3, 0.01, FM.white, 2.5, 0.18, 0, 0.01);
  // roof: blue light bar, antenna
  rbox(c, 0.36, 0.1, 1.7, 0.04, K, 1.8, 1.97, 0, 0.01);
  const blues = [0.6, -0.6].map((z) => { const L = std(0x3a6aff, 0.3, 0, { emissive: 0x2a4aff, emissiveIntensity: 0.35 }); rbox(c, 0.3, 0.17, 0.4, 0.07, L, 1.8, 2.1, z, 0.02); return L; });
  rbox(c, 0.12, 0.1, 0.5, 0.03, MT.lamp, 1.8, 2.06, 0, 0.01); rod(c, new V3(0.4, 1.92, -0.6), new V3(0.4, 2.6, -0.6), 0.012, MT.black, 4);
  // bumper, bull bar and winch at the front
  rbox(d, 0.32, 0.3, 2.36, 0.06, K, 4.02, 1.18, 0, 0.02); cylZ(d, 0.13, 0.55, MT.steel, 4.12, 1.22, 0, 12); rbox(d, 0.1, 0.06, 0.14, 0.02, FM.red, 4.25, 1.22, 0, 0.01);
  rail(d, [[4.0, 1.0, 1.05], [4.3, 1.25, 1.05], [4.3, 1.95, 0.9], [4.3, 1.95, -0.9], [4.3, 1.25, -1.05], [4.0, 1.0, -1.05]], 0.04, K); [0.4, -0.4].forEach((z) => rail(d, [[4.3, 1.25, z], [4.3, 1.95, z]], 0.035, K));
  // the protective roll cage over the cab
  const CG = MT.steel;
  [1, -1].forEach((s) => { rail(d, [[4.12, 1.32, s * 1.2], [4.0, 2.25, s * 1.22], [3.68, 3.42, s * 1.12], [1.5, 3.42, s * 1.12], [1.38, 3.2, s * 1.12]], 0.05, CG); rail(d, [[2.4, 3.42, s * 1.12], [2.4, 3.22, s * 1.12]], 0.04, CG); });
  [3.68, 2.4, 1.5].forEach((x) => rail(d, [[x, 3.42, 1.12], [x, 3.42, -1.12]], 0.045, CG)); rail(d, [[2.4, 3.42, 1.12], [1.5, 3.42, -1.12]], 0.035, CG); rail(d, [[2.4, 3.42, -1.12], [1.5, 3.42, 1.12]], 0.035, CG);
  // the tank body: rounded, red, with a white band low down and roller-shutter lockers
  rbox(d, 4.5, 1.9, 2.3, 0.24, R, -0.95, 2.25, 0, 0.08);
  [1, -1].forEach((s) => {
    rbox(d, 4.46, 0.22, 0.03, 0.01, FM.white, -0.95, 1.48, s * 1.155, 0.01);
    [0.68, -0.47, -1.62].forEach((x) => {
      rbox(d, 1.05, 1.22, 0.04, 0.03, MT.steel, x, 2.28, s * 1.15, 0.01);
      for (let y = 1.76; y < 2.86; y += 0.085) box(d, 0.97, 0.014, 0.02, FM.grey, x, y, s * 1.17);
      rbox(d, 0.6, 0.05, 0.04, 0.02, MT.chrome, x, 1.74, s * 1.18, 0.01);
    });
    [1.24, 0.105, -1.045, -2.2].forEach((x) => box(d, 0.025, 1.85, 0.02, K, x, 2.25, s * 1.16)); // panel lines
    rbox(d, 0.08, 0.06, 0.04, 0.02, MT.amber, -3.0, 1.48, s * 1.17, 0.01); rbox(d, 0.08, 0.06, 0.04, 0.02, MT.amber, 1.1, 1.36, s * 1.17, 0.01);
    // auto-protection pipe with its little sprinklers under the body
    cylX(d, 0.03, 4.3, MT.steel, -0.95, 1.25, s * 1.12, 6); for (let x = -3.0; x < 1.2; x += 0.7) cylY(d, 0.035, 0.08, MT.dark, x, 1.2, s * 1.12, 6);
  });
  rbox(d, 0.5, 1.05, 0.04, 0.03, FM.white, -2.65, 2.22, 1.15, 0.01); for (let i = 0; i < 5; i++) box(d, 0.12, 0.015, 0.02, K, -2.48, 1.8 + i * 0.22, 1.17); // the water gauge
  // the top: anti-slip deck, hand rails, hose basket
  rbox(d, 4.2, 0.05, 2.0, 0.02, MT.steel, -0.95, 3.2, 0, 0.01);
  [1, -1].forEach((s) => { rail(d, [[1.1, 3.22, s * 1.02], [1.1, 3.55, s * 1.02], [-3.0, 3.55, s * 1.02], [-3.0, 3.22, s * 1.02]], 0.025, FM.white); [-0.3, -1.6].forEach((x) => rail(d, [[x, 3.22, s * 1.02], [x, 3.55, s * 1.02]], 0.02, FM.white)); });
  rbox(d, 1.0, 0.25, 0.8, 0.04, K, -2.2, 3.35, 0, 0.01); for (let i = 0; i < 3; i++) cylY(d, 0.3, 0.07, FM.hose, -2.2, 3.28 + i * 0.07, 0, 14);
  // the rear: a big hose reel, the ladder, lights and the bumper
  cylZ(d, 0.18, 1.8, K, -3.55, 2.15, 0, 12); cylZ(d, 0.42, 1.5, FM.hose, -3.55, 2.15, 0, 20); for (let z = -0.6; z <= 0.61; z += 0.3) cylZ(d, 0.425, 0.03, std(0xa89e88, 0.8, 0), -3.55, 2.15, z, 20);
  [0.82, -0.82].forEach((z) => { cylZ(d, 0.55, 0.06, FM.redD, -3.55, 2.15, z, 24); cylZ(d, 0.12, 0.12, MT.chrome, -3.55, 2.15, z * 1.08, 10); rbox(d, 0.4, 0.9, 0.08, 0.03, K, -3.35, 1.75, z * 1.1, 0.01); });
  rail(d, [[-3.24, 1.0, 1.0], [-3.24, 3.2, 1.0]], 0.025, MT.steel); rail(d, [[-3.24, 1.0, 1.16], [-3.24, 3.55, 1.16]], 0.025, MT.steel); for (let y = 1.2; y < 3.2; y += 0.28) rod(d, new V3(-3.24, y, 1.0), new V3(-3.24, y, 1.16), 0.018, MT.steel);
  [1, -1].forEach((s) => { rbox(d, 0.06, 0.2, 0.24, 0.02, MT.tail, -3.22, 1.45, s * 0.75, 0.01); rbox(d, 0.06, 0.1, 0.12, 0.02, MT.amber, -3.22, 1.6, s * 0.75, 0.01); });
  rbox(d, 0.25, 0.22, 2.3, 0.04, K, -3.3, 1.12, 0, 0.02); rbox(d, 0.04, 0.14, 2.0, 0.01, MT.stripes, -3.43, 1.12, 0, 0.005);
  // tool box (+z) and the suction hose stored on the other side (−z), between the wheels
  rbox(d, 1.7, 0.42, 0.34, 0.05, K, 0.15, 1.05, 1.0, 0.02); rbox(d, 1.6, 0.03, 0.02, 0.01, MT.chrome, 0.15, 1.18, 1.18, 0.005);
  cylX(d, 0.12, 1.9, FM.hose, 0.15, 1.05, -1.12, 12); [-0.6, 0.9].forEach((x) => cylX(d, 0.13, 0.06, K, x, 1.05, -1.12, 12));
  // mud flaps behind each wheel
  [FX, RX].forEach((x) => [1, -1].forEach((s) => rbox(d, 0.04, 0.5, 0.5, 0.02, MT.black, x - 0.78, 0.62, s * 1.0, 0.01)));
  decalOn(d, 'POMPIERS', 2.2, 0.24, '#ffffff', -0.5, 3.02, 1.17);
  bake(d);
  // blue lights at the back too (they blink with the ones on the cab)
  [0.85, -0.85].forEach((z, i) => rbox(g, 0.16, 0.14, 0.22, 0.05, blues[i], -3.05, 3.32, z, 0.02));
  const level = grp(g, -2.8, 1.75, 1.18); rbox(level, 0.16, 0.92, 0.03, 0.02, FM.water, 0, 0.46, 0, 0.01); level.scale.y = 0.05;
  st.beacons = blues;
  const mon = grp(g, -0.2, 3.22, 0); cylY(mon, 0.2, 0.2, K, 0, 0.1, 0, 12); cylY(mon, 0.07, 0.3, FM.grey, 0, 0.3, 0, 8);
  const barrel = grp(mon, 0, 0.42, 0); sph(barrel, 0.11, FM.grey, 0, 0, 0); cylX(barrel, 0.08, 0.9, FM.grey, 0.45, 0, 0, 10); cylX(barrel, 0.12, 0.22, FM.red, 0.95, 0, 0, 12); cylX(barrel, 0.09, 0.06, MT.dark, 1.08, 0, 0, 12);
  rod(barrel, new V3(-0.05, 0.08, 0), new V3(-0.3, 0.15, 0), 0.025, MT.black, 6);
  const nozzle = anchor(barrel, 1.12, 0, 0);
  const wheels = [];
  [1, -1].forEach((s) => [FX, RX].forEach((x) => { wheels.push(agriTire(g, WR, 0.5, x, WR, s * 1.0, FM.white, s)); fender(g, WR + 0.12, 0.6, x, WR, s * 1.0, MT.black, Math.PI * 0.62); }));
  shadows(g); return { g, wheels, mon, barrel, nozzle, level };
}
/** A painted word on a vehicle's +z side, kept in its own little group so freeze() leaves its texture alone. */
function decalOn(p, text, w, h, color, x, y, z) { const g = grp(p); g.userData.dynamic = true; decal(g, text, w, h, color, x, y, z); return g; }

/* ================= the forest around the machines ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
const PINE_T = new THREE.CylinderGeometry(0.1, 0.17, 1.8, 6); PINE_T.translate(0, 0.9, 0);
const PINE_C = mergeGeos([[1.25, 1.9, 1.9], [1.0, 1.7, 2.9], [0.72, 1.5, 3.8], [0.42, 1.2, 4.6]].map(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y, 0); return c; }));
const OAK_T = new THREE.CylinderGeometry(0.15, 0.26, 2.4, 7); OAK_T.translate(0, 1.2, 0);
const OAK_C = mergeGeos([[0, 3.1, 0, 1.5], [0.85, 2.7, 0.3, 1.0], [-0.75, 2.8, -0.4, 1.1], [0.1, 3.75, -0.4, 0.95], [-0.3, 2.6, 0.8, 0.9]].map(([x, y, z, s]) => { const c = new THREE.IcosahedronGeometry(1, 0); c.scale(s, s * 0.85, s); c.translate(x, y, z); return c; }));
const BIRCH_T = new THREE.CylinderGeometry(0.07, 0.11, 3.3, 6); BIRCH_T.translate(0, 1.65, 0);
const BIRCH_C = mergeGeos([[0, 3.5, 0, 0.85], [0.4, 3.0, 0.2, 0.6], [-0.35, 3.1, -0.2, 0.6], [0, 4.2, 0, 0.55]].map(([x, y, z, s]) => { const c = new THREE.IcosahedronGeometry(1, 0); c.scale(s, s * 1.3, s); c.translate(x, y, z); return c; }));
const STUMP_T = new THREE.CylinderGeometry(1, 1.1, 1, 9); STUMP_T.translate(0, 0.5, 0);
const STUMP_C = new THREE.CylinderGeometry(0.92, 0.92, 0.04, 9); STUMP_C.translate(0, 1.0, 0);
const MUSH_S = new THREE.CylinderGeometry(0.05, 0.06, 0.18, 6); MUSH_S.translate(0, 0.09, 0);
const MUSH_C = new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); MUSH_C.translate(0, 0.16, 0);
const FERN = mergeGeos([0, 1, 2, 3, 4].map((i) => { const c = new THREE.ConeGeometry(0.12, 0.9, 4); c.translate(0, 0.45, 0); c.rotateZ(0.7); c.rotateY((i / 5) * Math.PI * 2); return c; }));

function buildForest(scene) {
  const RAD = 54, trees = [];
  for (let gx = -RAD; gx <= RAD; gx += 2.7) for (let gz = -RAD; gz <= RAD; gz += 2.7) {
    const x = gx + rnd(-1, 1), z = gz + rnd(-1, 1); if (Math.hypot(x, z) > RAD - 1.5 || Math.random() < 0.1 || !freeAt(x, z)) continue;
    const u = Math.sin(x * 0.11) + Math.cos(z * 0.13) + rnd(-0.6, 0.6); // patches: pines here, oaks and birches there
    trees.push({ x, z, k: u > 0.3 ? 0 : u > -0.6 ? 1 : 2, s: rnd(0.85, 1.3), ry: rnd(0, 6.28) });
  }
  const kinds = [
    [PINE_T, [0x6b4a34, 0x5e4230], PINE_C, [0x2a6236, 0x2f6b3a, 0x336f3c, 0x285a33, 0x3a7a40]],
    [OAK_T, [0x5e4230, 0x6b4a34], OAK_C, [0x4f8f3a, 0x5a9a40, 0x467f34, 0x6aa848, 0x7aa83a]],
    [BIRCH_T, [0xeee8dc, 0xe4ded2], BIRCH_C, [0x8cc04a, 0x7ab040, 0x9ccb5a, 0xb8c84a]]
  ];
  kinds.forEach(([tg, tc, cg, cc], k) => {
    const list = trees.filter((t) => t.k === k); if (!list.length) return;
    const put = (i, d) => { const t = list[i]; d.position.set(t.x, 0, t.z); d.rotation.set(0, t.ry, 0); d.scale.setScalar(t.s); };
    instanced(scene, tg, list.length, (i, d) => { put(i, d); return pick(tc); });
    instanced(scene, cg, list.length, (i, d) => { put(i, d); return pick(cc); });
  });
  // stumps of the cut trees in the clearings, rocks, ferns and mushrooms under the trees
  const stumps = [];
  for (let i = 0; i < 400 && stumps.length < 46; i++) { const h = rnd(-42, -10), d = rnd(-24, 14), [x, z] = Q(h, d); if (Math.hypot(h + 30, d + 5) < 18 && freeAt(x, z, -2.5) && !freeAt(x, z)) stumps.push([x, z, rnd(0.18, 0.3), rnd(0.25, 0.45)]); }
  for (let i = 0; i < 300 && stumps.length < 70; i++) { const h = rnd(-18, 8), d = rnd(10, 28), [x, z] = Q(h, d); if (freeAt(x, z, -3.5) && !freeAt(x, z)) stumps.push([x, z, rnd(0.18, 0.28), rnd(0.25, 0.4)]); }
  const sPut = (i, d) => { const [x, z, r, h] = stumps[i]; d.position.set(x, 0, z); d.rotation.set(0, i, 0); d.scale.set(r, h, r); };
  instanced(scene, STUMP_T, stumps.length, (i, d) => { sPut(i, d); return 0x6e4b32; });
  instanced(scene, STUMP_C, stumps.length, (i, d) => { sPut(i, d); return 0xe2b878; });
  const under = (n, m) => { const o = []; for (let i = 0; i < n * 8 && o.length < n; i++) { const a = rnd(0, 6.28), r = rnd(6, RAD - 3), x = Math.cos(a) * r, z = Math.sin(a) * r; if (freeAt(x, z, m)) o.push([x, z]); } return o; };
  const ferns = under(140, 0.5); instanced(scene, FERN, ferns.length, (i, d) => { d.position.set(ferns[i][0], 0, ferns[i][1]); d.rotation.set(0, rnd(0, 6), 0); d.scale.setScalar(rnd(0.7, 1.3)); return pick([0x4a8a3a, 0x3a7a34, 0x5a9a44]); });
  const rocks = under(40, 0.5); instanced(scene, ICO, rocks.length, (i, d) => { d.position.set(rocks[i][0], 0.1, rocks[i][1]); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); const s = rnd(0.25, 0.6); d.scale.set(s, s * 0.6, s * 0.8); return pick([0x9a968c, 0x8a867c, 0xaaa69c]); });
  const shrooms = []; for (let i = 0; i < 18; i++) { const [x, z] = Q(...pick([[-14, 26], [6, -16], [34, 20], [-40, 6], [14, 14], [-18, -22]])); for (let k = 0; k < 3; k++) { const px = x + rnd(-1.5, 1.5), pz = z + rnd(-1.5, 1.5); if (freeAt(px, pz, -0.5)) shrooms.push([px, pz]); } }
  const mPut = (i, d) => { d.position.set(shrooms[i][0], 0, shrooms[i][1]); d.rotation.set(0, 0, 0); d.scale.setScalar(rnd(0.8, 1.5)); };
  instanced(scene, MUSH_S, shrooms.length, (i, d) => { mPut(i, d); return 0xf4efe4; });
  instanced(scene, MUSH_C, shrooms.length, (i, d) => { mPut(i, d); return pick([0xe5452c, 0xd8402a, 0xc8783a]); });
  // the forester's house: stone base, timber walls, roof, chimney, porch, shutters, wood pile, bench, a car
  { const g = at(scene, ...HOUSE);
    rbox(g, 6.2, 0.6, 4.4, 0.05, FM.stone, 0, 0.3, 0, 0.02); rbox(g, 6.0, 2.6, 4.2, 0.05, FM.wall, 0, 1.9, 0, 0.02);
    for (let y = 0.85; y < 3.2; y += 0.28) { box(g, 6.04, 0.04, 4.24, FM.woodD, 0, y, 0); }
    ext(g, [[-3.6, 3.15], [3.6, 3.15], [0, 5.3]], 0.05, 4.9, FM.roof, 0, 0, 0, 0.04); ext(g, [[-3.0, 3.2], [3.0, 3.2], [0, 5.0]], 0, 4.2, FM.wall, 0, 0, 0, 0.02);
    rbox(g, 0.7, 2.0, 0.7, 0.05, FM.stone, 1.8, 5.0, -0.8, 0.02); rbox(g, 0.8, 0.12, 0.8, 0.03, MT.dark, 1.8, 6.05, -0.8, 0.01);
    box(g, 0.9, 1.6, 0.06, std(0x7a4a2a, 0.7, 0), -1.4, 1.4, 2.12); sph(g, 0.05, MT.chrome, -1.1, 1.35, 2.16);
    [[0.6, 1.9], [2.1, 1.9]].forEach(([x, y]) => { box(g, 0.8, 0.8, 0.05, std(0xffd896, 0.4, 0, { emissive: 0xffc070, emissiveIntensity: 0.3 }), x, y, 2.12); box(g, 0.05, 0.8, 0.06, FM.wall, x, y, 2.14); [-0.6, 0.6].forEach((dx) => box(g, 0.38, 0.85, 0.05, FM.shutter, x + dx, y, 2.15)); rbox(g, 0.9, 0.18, 0.2, 0.03, FM.woodD, x, y - 0.5, 2.2, 0.01); for (let k = 0; k < 4; k++) sph(g, 0.08, pick([MT.red, FM.white, std(0xf07aa8, 0.6, 0)]), x - 0.3 + k * 0.2, y - 0.38, 2.22); });
    rbox(g, 6.4, 0.12, 1.6, 0.03, FM.timber, 0, 0.12, 2.9, 0.01); [-3, -0.6, 3].forEach((x) => box(g, 0.14, 2.4, 0.14, FM.timber, x, 1.3, 3.6)); const pr = rbox(g, 6.6, 0.1, 1.7, 0.03, FM.roof, 0, 2.6, 2.9, 0.01); pr.rotation.x = 0.18;
    const wp2 = grp(g, -3.6, 0, 0); wp2.rotation.y = Math.PI / 2; logStack(wp2, 0, 0, 4, 0.9, 0.14); box(wp2, 3, 0.08, 0.6, FM.roof, 0, 1.35, 0);
    const bench = grp(g, 1.5, 0, 3.4); rbox(bench, 1.6, 0.08, 0.4, 0.02, FM.timber, 0, 0.45, 0, 0.01); [-0.65, 0.65].forEach((x) => box(bench, 0.08, 0.45, 0.35, FM.timber, x, 0.22, 0));
    const car = miniCar(g, 'van', 0x3f8a32); car.position.set(4.8, 0, 2.6); car.rotation.y = Math.PI / 2;
  }
  // picnic table on the walking trail, a few signs and log benches
  { const g = at(scene, 34, 26); rbox(g, 2.0, 0.08, 0.8, 0.02, FM.timber, 0, 0.75, 0, 0.01); [-0.7, 0.7].forEach((z) => rbox(g, 2.0, 0.06, 0.3, 0.02, FM.timber, 0, 0.45, z, 0.01)); [-0.8, 0.8].forEach((x) => box(g, 0.08, 0.75, 0.8, FM.timber, x, 0.37, 0)); }
  [[-46, -3], [20, -6.5], [-11, -1.5]].forEach(([h, d], i) => { const g = at(scene, h, d); cylY(g, 0.06, 1.6, FM.timber, 0, 0.8, 0, 6); rbox(g, 1.1, 0.5, 0.06, 0.02, FM.wood, 0, 1.55, 0.04, 0.01); decal(g, ['FORÊT', 'SCIERIE', 'CHANTIER'][i], 1.0, 0.36, '#4a2a14', 0, 1.55, 0.075); });
  [[10, 24], [32, 30], [-2, 31]].forEach(([h, d]) => { const g = at(scene, h, d, YAW + 0.4); logY(g, 1.8, 0.22, 0, 0.22, 0).rotation.z = Math.PI / 2; });
  // roadside log piles along the track (still)
  [[-20, -8], [36, -6]].forEach(([h, d]) => { const g = at(scene, h, d); logStack(g, 0, 0, 4, 3.6, 0.18); });
  return scene;
}

/* ================= life: walkers, deer, a squirrel, birds, chimney smoke ================= */
function deer(p, stag) {
  const g = grp(p), M = std(0xa8683a, 0.8, 0), Lt = std(0xf0dcc0, 0.8, 0), K = MT.black;
  rbox(g, 1.0, 0.45, 0.4, 0.17, M, 0, 0.95, 0, 0.04); rbox(g, 0.12, 0.16, 0.16, 0.05, Lt, -0.52, 1.08, 0, 0.02);
  const legs = [[0.36, 0.12], [0.36, -0.12], [-0.36, 0.12], [-0.36, -0.12]].map(([x, z]) => { const l = grp(g, x, 0.8, z); rbox(l, 0.09, 0.78, 0.09, 0.03, M, 0, -0.38, 0, 0.01); rbox(l, 0.1, 0.06, 0.1, 0.02, K, 0, -0.77, 0, 0.01); return l; });
  const neck = grp(g, 0.4, 1.08, 0); const nk = rbox(neck, 0.18, 0.55, 0.2, 0.07, M, 0.08, 0.22, 0, 0.02); nk.rotation.z = -0.35;
  const head = grp(neck, 0.2, 0.5, 0); rbox(head, 0.34, 0.18, 0.18, 0.07, M, 0.12, 0, 0, 0.02); sph(head, 0.035, K, 0.3, 0.0, 0); [1, -1].forEach((s) => { sph(head, 0.022, K, 0.12, 0.05, s * 0.09); const e = rbox(head, 0.06, 0.16, 0.04, 0.02, M, 0.0, 0.14, s * 0.1, 0.01); e.rotation.x = s * 0.5; });
  if (stag) [1, -1].forEach((s) => { rod(head, new V3(0.02, 0.08, s * 0.05), new V3(-0.05, 0.42, s * 0.22), 0.018, std(0xe8dcc4, 0.7, 0), 4); rod(head, new V3(-0.02, 0.25, s * 0.13), new V3(0.12, 0.38, s * 0.18), 0.014, std(0xe8dcc4, 0.7, 0), 4); });
  g.userData.walk = (ph) => { const s = Math.sin(ph); legs[0].rotation.z = s * 0.4; legs[3].rotation.z = s * 0.4; legs[1].rotation.z = -s * 0.4; legs[2].rotation.z = -s * 0.4; };
  g.userData.graze = (k) => (neck.rotation.z = -1.2 * k);
  shadows(g); return g;
}
function squirrel(p) {
  const g = grp(p), M = std(0xc8642a, 0.8, 0);
  sph(g, 0.12, M, 0, 0.16, 0).scale.set(0.144, 0.12, 0.108); sph(g, 0.08, M, 0.14, 0.28, 0); [1, -1].forEach((s) => rbox(g, 0.03, 0.07, 0.03, 0.01, M, 0.13, 0.37, s * 0.04, 0.005)); sph(g, 0.015, MT.black, 0.21, 0.3, 0.04);
  const tail = grp(g, -0.12, 0.15, 0); [[0, 0.06, 0.07], [-0.06, 0.18, 0.08], [-0.04, 0.3, 0.08], [0.02, 0.38, 0.07]].forEach(([x, y, r]) => sph(tail, r, M, x, y, 0));
  g.userData.tail = tail; shadows(g); return g;
}
function bird(p, col) {
  const g = grp(p), M = std(col, 0.6, 0); sph(g, 0.14, M, 0, 0, 0).scale.set(0.22, 0.11, 0.11); sph(g, 0.08, M, 0.2, 0.06, 0); rbox(g, 0.08, 0.025, 0.04, 0.01, std(0xf2a020, 0.5, 0), 0.3, 0.05, 0, 0.005);
  const wings = [1, -1].map((s) => { const w = grp(g, 0, 0.04, s * 0.08); rbox(w, 0.22, 0.02, 0.36, 0.02, M, 0, 0, s * 0.18, 0.005); return w; });
  g.userData.flap = (a) => wings.forEach((w, i) => (w.rotation.x = (i ? -1 : 1) * a));
  return g;
}
function buildLife(scene, onUpdate, fx) {
  const R = (pts, t = 0.3) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // walkers and a family on the trail
  const trail = R(TRAIL, 0.4);
  const folks = [{}, { kid: true }, { top: 0x2f7de0 }, {}, { kid: true, top: 0xf2b21c }].map((o) => { const w = walker(scene, 0, 0, o); if (!o.kid) rbox(w, 0.16, 0.36, 0.3, 0.06, std(pick([0xd8402a, 0x2f6b3a, 0xf2b21c]), 0.7, 0), -0.2, 0.75, 0, 0.02); return w; });
  const t1 = traffic(trail, folks, 0.9, { gap: 1.0 });
  // deer: one family walking slowly in the glade, and grazing deer near the young trees
  const glade = R([[GLADE[0] - 2.5, GLADE[1]], [GLADE[0], GLADE[1] - 2], [GLADE[0] + 2.5, GLADE[1]], [GLADE[0], GLADE[1] + 2]], 0.5);
  const herd = [deer(scene, true), deer(scene), deer(scene)]; herd[2].scale.setScalar(0.7);
  const t2 = traffic(glade, herd, 0.5, { gap: 1.6 });
  const grazers = [[-22, 27, 0.3], [-19, 29, 2.2]].map(([h, d, r], i) => { const g = deer(scene, i === 0); const [x, z] = Q(h, d); g.position.set(x, 0, z); g.rotation.y = r; return g; });
  // a squirrel hopping between two stumps near the house
  const sq = squirrel(scene); const [sx, sz] = Q(20, 22), [ex, ez] = Q(22, 20.5); [[sx, sz], [ex, ez]].forEach(([x, z]) => { const s = grp(scene, x, 0, z); stump(s, 0, 0, 0.3); shadows(s); });
  // birds in the sky
  const sky = route([[-30, 8, 13], [0, -25, 15], [30, 5, 12], [5, 30, 14]], true, 0.5);
  const birds = [0x3a4a6a, 0xd8402a, 0x3a4a6a, 0x6a4a3a].map((c) => bird(scene, c));
  const chim = new V3(...(() => { const g = new THREE.Object3D(); const [x, z] = Q(...HOUSE); g.position.set(x, 0, z); g.rotation.y = YAW; g.updateMatrixWorld(true); const v = new V3(1.8, 6.2, -0.8).applyMatrix4(g.matrixWorld); return [v.x, v.y, v.z]; })());
  let T = 0, smoke = 0;
  onUpdate((dt) => {
    T += dt; t1.update(dt, folks); t2.update(dt, herd);
    grazers.forEach((g, i) => g.userData.graze(0.5 + 0.5 * Math.sin(T * 0.6 + i * 2)));
    const k = (Math.sin(T * 0.7) + 1) / 2, hop = Math.abs(Math.sin(T * 6)) * 0.2; sq.position.set(sx + (ex - sx) * k, 0.35 + hop * (k > 0.05 && k < 0.95 ? 1 : 0), sz + (ez - sz) * k); sq.rotation.y = Math.atan2(-(ez - sz), ex - sx) + (Math.cos(T * 0.7) < 0 ? Math.PI : 0); sq.userData.tail.rotation.z = Math.sin(T * 5) * 0.3;
    birds.forEach((b, i) => { placeOn(b, sky, T * 3.2 + i * 2.2); b.position.y += Math.sin(T * 2 + i) * 0.4 + i * 0.3; b.userData.flap(Math.sin(T * 12 + i) * 0.7); });
    smoke -= dt; if (smoke <= 0) { smoke = 0.35; fx.smoke(chim.clone(), new V3(rnd(-0.1, 0.1), 0.9, rnd(-0.1, 0.1)), 0.35, 0xe8e8f0, 2.6); }
  });
}
