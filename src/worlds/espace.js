// L'Espace — a floating spaceport island with a Moon corner and a Mars corner.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { C, MT, UB, ICO, dummy, tmpCol, mat, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, arc, anchor, beam, wp, shadows, instanced, toonMat, freeze } from '../kit/geo.js';
import { trackUnit, hydraulic, beacon, tire, operator } from '../kit/parts.js';
import { lamp } from '../kit/props.js';
import { createFx } from '../kit/fx.js';
import { route, person as walker, miniCar, traffic } from '../kit/life.js';

const YAW = Math.PI / 4;
const SM = {
  white: std(0xf4f5f8, 0.35, 0.1), off: std(0xdfe2ea, 0.45, 0.1), black: std(0x1b1d24, 0.5, 0.2), tank: std(0xd9772f, 0.75, 0.05),
  gold: std(0xe0b24a, 0.3, 0.9), silver: std(0xc9ced8, 0.25, 0.9), grey: std(0x8f96a6, 0.5, 0.4), red: std(0xd8402a, 0.42, 0.25),
  panel: std(0x2a4fa8, 0.2, 0.6), concrete: std(0xb7b9c3, 0.9, 0), suit: std(0xf2f3f6, 0.6, 0), visor: std(0xf2c14a, 0.1, 1),
  chute: std(0xf26a2a, 0.7, 0), chute2: std(0xffffff, 0.7, 0), mars: std(0xb8572e, 0.9, 0), moonRock: std(0x9a9ca8, 0.9, 0)
};
const nose = (r, h, seg) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(Math.max(0.001, r * Math.sqrt(1 - t * t * 0.98)), t * h)); } return new THREE.LatheGeometry(pts, seg || 24); };
const bell = (r, h) => new THREE.LatheGeometry([[r, -h], [r * 0.75, -h * 0.75], [r * 0.45, -h * 0.3], [r * 0.35, 0]].map(([a, b]) => new THREE.Vector2(a, b)), 20); // y increasing: lit from outside
function flagTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const x = c.getContext('2d');
  x.fillStyle = '#ff8a2a'; x.fillRect(0, 0, 128, 80); x.fillStyle = '#fff';
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 11 : 26; x.lineTo(64 + Math.cos(a) * r, 40 + Math.sin(a) * r); } x.fill();
  return new THREE.CanvasTexture(c);
}
function save(objs) { return objs.map((o) => ({ o, p: o.parent, pos: o.position.clone(), rot: o.rotation.clone(), sc: o.scale.clone() })); }
function restore(s) { s.forEach(({ o, p, pos, rot, sc }) => { p.add(o); o.position.copy(pos); o.rotation.copy(rot); o.scale.copy(sc); o.visible = true; }); }

const DATA = {
  fusee: { short: 'La fusée', full: 'La fusée', verb: 'Décoller', horn: 'bell',
    use: "Elle emporte des satellites dans l'espace.",
    how: "Elle brûle du carburant pour pousser très fort vers le haut. Quand un réservoir est vide, elle le lâche pour être plus légère." },
  navette: { short: 'La navette', full: 'La navette spatiale', verb: 'Décoller', horn: 'bell',
    use: "Elle part dans l'espace comme une fusée, et revient comme un avion.",
    how: 'Deux boosters et un gros réservoir orange l’aident à monter. Ils se détachent quand ils sont vides.' },
  transporteur: { short: 'Le transporteur', full: 'Le transporteur à chenilles', verb: 'Transporter', horn: 'horn',
    use: "Il emmène la fusée jusqu'au pas de tir.",
    how: 'Il est énorme et roule tout doucement. Ses vérins gardent la fusée bien droite.' },
  rover: { short: 'Le rover', full: 'Le rover martien', verb: 'Explorer', horn: 'bell',
    use: 'Il roule sur Mars pour étudier les cailloux.',
    how: 'Ses six roues grimpent sur les rochers. Il a une caméra pour voir et un bras pour percer.' },
  module: { short: 'Le module lunaire', full: 'Le module lunaire', verb: 'Alunir', horn: 'bell',
    use: 'Il pose les astronautes sur la Lune.',
    how: 'Ses moteurs freinent la descente, et ses grandes pattes amortissent l’atterrissage.' },
  station: { short: 'La station', full: 'La station spatiale', verb: 'Rejoindre', horn: 'bell',
    use: "C'est une maison dans l'espace, où vivent des astronautes.",
    how: "Elle tourne autour de la Terre. Ses grands panneaux solaires lui donnent l'électricité, et des capsules lui amènent les astronautes." },
  bus: { short: 'Le bus', full: 'Le bus des astronautes', verb: 'Embarquer', horn: 'horn',
    use: "Il emmène les astronautes jusqu'à la fusée.",
    how: "Leurs combinaisons sont lourdes : le bus les conduit au pied de la tour, puis un ascenseur les monte tout en haut." },
  capsule: { short: 'La capsule', full: 'La capsule', verb: 'Atterrir', horn: 'bell',
    use: 'Elle ramène les astronautes sur Terre.',
    how: "En revenant, elle chauffe très fort. Ses parachutes la freinent, puis des petites fusées l'aident à se poser." }
};
const ORDER = ['transporteur', 'bus', 'fusee', 'navette', 'station', 'capsule', 'rover', 'module'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  bus: GND + `<rect x="10" y="26" width="92" height="36" rx="12" fill="#c9ced8"/><rect class="g" x="20" y="32" width="60" height="12" rx="3"/><rect class="b" x="10" y="48" width="92" height="5"/><rect class="g" x="86" y="32" width="12" height="14" rx="3"/>
    <circle class="k" cx="30" cy="64" r="9"/><circle class="s" cx="30" cy="64" r="3.5"/><circle class="k" cx="84" cy="64" r="9"/><circle class="s" cx="84" cy="64" r="3.5"/>`,
  capsule: GND + `<path d="M30 10q14-12 28 0z" fill="#f26a2a"/><path d="M62 10q14-12 28 0z" fill="#ffffff" stroke="#c9ccd8"/><path class="ln" d="M30 10L54 42M58 10L56 42M62 10L60 42M90 10L62 42"/>
    <path class="w" d="M48 44h20l10 26H38z"/><rect class="k" x="36" y="68" width="44" height="5" rx="2"/><circle class="g" cx="58" cy="54" r="4"/>`,
  station: `<rect class="s" x="8" y="36" width="104" height="5" rx="2"/>
  <rect class="b" x="10" y="12" width="14" height="22"/><rect class="b" x="10" y="43" width="14" height="22"/><rect class="b" x="28" y="12" width="14" height="22"/><rect class="b" x="28" y="43" width="14" height="22"/>
  <rect class="b" x="78" y="12" width="14" height="22"/><rect class="b" x="78" y="43" width="14" height="22"/><rect class="b" x="96" y="12" width="14" height="22"/><rect class="b" x="96" y="43" width="14" height="22"/>
  <rect class="w" x="46" y="44" width="28" height="11" rx="5"/><rect class="w" x="56" y="30" width="9" height="26" rx="3"/><path class="w" d="M74 45h8l6 4-6 4h-8z"/>`,
  fusee: GND + `<rect class="c" x="34" y="66" width="52" height="8"/><rect class="w" x="52" y="20" width="16" height="46" rx="2"/><path class="w" d="M52 20q8-16 16 0z"/>
    <rect class="w" x="42" y="36" width="9" height="30" rx="2"/><rect class="w" x="69" y="36" width="9" height="30" rx="2"/><path class="w" d="M42 36q4.5-9 9 0zM69 36q4.5-9 9 0z"/>
    <rect class="k" x="52" y="40" width="16" height="3"/><rect class="r" x="20" y="10" width="4" height="56"/><rect class="r" x="24" y="30" width="28" height="3"/>`,
  navette: GND + `<rect class="o" x="54" y="10" width="20" height="56" rx="10"/><rect class="w" x="46" y="18" width="7" height="48" rx="3"/><rect class="w" x="75" y="18" width="7" height="48" rx="3"/>
    <path class="w" d="M30 66V30q4-16 8-16t8 16v36z"/><path class="w" d="M22 66l8-18v18zM46 66l8-18v18z"/><rect class="k" x="34" y="20" width="8" height="5" rx="2"/>`,
  transporteur: GND + `<rect class="k" x="8" y="58" width="44" height="14" rx="7"/><rect class="k" x="68" y="58" width="44" height="14" rx="7"/><rect class="s" x="6" y="48" width="108" height="10" rx="2"/>
    <rect class="c" x="20" y="40" width="80" height="8"/><rect class="w" x="54" y="8" width="12" height="32" rx="2"/><path class="w" d="M54 8q6-10 12 0z"/><rect class="r" x="80" y="10" width="4" height="30"/>`,
  rover: GND + `<circle class="k" cx="26" cy="64" r="9"/><circle class="k" cx="60" cy="64" r="9"/><circle class="k" cx="94" cy="64" r="9"/><path class="ln" d="M26 64L44 48H76L94 64M60 64L60 48"/>
    <rect class="w" x="32" y="36" width="58" height="14" rx="3"/><rect class="s" x="36" y="30" width="20" height="6"/><rect class="k" x="80" y="12" width="3" height="24"/><rect class="w" x="72" y="6" width="18" height="9" rx="2"/>
    <circle class="k" cx="78" cy="10.5" r="2"/><circle class="k" cx="85" cy="10.5" r="2"/><path class="ln" d="M90 44l14 6 4 12"/>`,
  module: GND + `<path class="yd" d="M34 46h52l6 10H28z"/><rect class="yd" x="30" y="40" width="60" height="8"/><path class="s" d="M42 40l6-20h24l6 20z"/><rect class="k" x="52" y="24" width="7" height="6"/><rect class="k" x="62" y="24" width="7" height="6"/>
    <path class="ln" d="M34 50L18 72M86 50L102 72M44 52L40 72M76 52L80 72"/><rect class="s" x="12" y="71" width="12" height="3"/><rect class="s" x="96" y="71" width="12" height="3"/>`
};
// Layout coordinates: h runs left → right on screen in the overview, d from the back (−) to the front (+).
const S2 = Math.SQRT1_2;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const CFG = {
  fusee: CF(-6, -28), navette: CF(-30, -20), transporteur: CF(30, -14, YAW + Math.PI), bus: CF(-1, -6, 3 * Math.PI / 4),
  rover: CF(-22, 18), module: CF(20, 18), station: CF(-36, 2), capsule: CF(0, 19)
};
const GB = [], GP = [];
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 2.4, col = '#c3bfd6', al = 0.85) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
road([[19, -14], [30, -14]], 7, '#b9b6c8', 0.9);
road([[-1, -4], [-1, -22]], 3.2);
road([[5, -8], [16, -8], [16, 6], [5, 6], [5, -8]], 2.6);
road([[5, -1], [-1, -1]], 2.4);
road([[-12, 4], [-4, 4], [-4, 9], [-12, 9], [-12, 4]], 1.6, '#d6d2e6', 0.8);
blob(-22, 18, 13, 'rgba(200,100,58,.95)'); blob(-22, 18, 9, 'rgba(214,118,70,.9)');
blob(20, 18, 12, 'rgba(225,226,236,.95)'); blob(20, 18, 8.5, 'rgba(235,236,244,.9)');
blob(-6, -28, 7, 'rgba(255,196,140,.35)'); blob(-30, -20, 6, 'rgba(255,196,140,.3)'); blob(22, -14, 7, 'rgba(255,196,140,.3)'); blob(0, 19, 6, 'rgba(255,220,180,.35)');

function buildRocket(p, s = 1) {
  const g = grp(p); g.scale.setScalar(s);
  const core = grp(g);
  cylY(core, 0.9, 8, SM.white, 0, 4, 0, 28); [1.2, 6.6].forEach((y) => cylY(core, 0.915, 0.35, SM.black, 0, y, 0, 28));
  const cb = add(core, bell(0.75, 1.0), SM.grey, 0, 0.05, 0);
  const upper = grp(g, 0, 8, 0);
  cylY(upper, 0.92, 0.3, SM.black, 0, 0.15, 0, 28); cylY(upper, 0.9, 2.0, SM.off, 0, 1.3, 0, 28);
  const sat = grp(upper, 0, 2.4, 0);
  rbox(sat, 0.9, 1.1, 0.9, 0.05, SM.gold, 0, 0.55, 0, 0.02); cylY(sat, 0.15, 0.4, SM.silver, 0, 1.25, 0, 10);
  const panels = [1, -1].map((sd) => { const h = grp(sat, 0, 1.0, sd * 0.47); const pnl = rbox(h, 0.8, 1.0, 0.04, 0.02, SM.panel, 0, -0.5, sd * 0.03, 0.01); return h; });
  const fair = [0, 1].map((k) => {
    const h = grp(upper, 0, 2.3, 0);
    const geo = new THREE.LatheGeometry([0, 0.1, 0.3, 0.55, 0.75, 0.9, 1].map((t) => new THREE.Vector2(Math.max(0.001, 0.95 * Math.sqrt(1 - Math.pow(Math.max(0, t - 0.35) / 0.65, 2) * 0.99)), t * 3.0)), 24, k * Math.PI, Math.PI);
    const m = add(h, geo, SM.white); m.material = SM.white.clone(); m.material.side = THREE.DoubleSide; return h;
  });
  const boosters = [1, -1].map((sd) => {
    const b = grp(g, 0, 0, sd * 1.38);
    cylY(b, 0.45, 6, SM.white, 0, 3, 0, 20); add(b, nose(0.45, 1.2, 20), SM.white, 0, 6, 0); cylY(b, 0.46, 0.25, SM.black, 0, 1.0, 0, 20);
    add(b, bell(0.4, 0.7), SM.grey, 0, 0.05, 0); rod(b, new V3(0, 5.2, -sd * 0.4), new V3(0, 5.2, -sd * 0.95), 0.06, SM.grey);
    return b;
  });
  const nozzles = [anchor(core, 0, -0.9, 0), ...boosters.map((b) => anchor(b, 0, -0.6, 0))];
  return { g, core, upper, sat, panels, fair, boosters, nozzles };
}
// astronaut, facing +x; ~1.4 tall at s = 1. g.userData.arms = [right (+z), left (-z)] pivot at the shoulders
function astronaut(p, x, y, z, s = 1) {
  const g = grp(p, x, y, z); g.scale.setScalar(s);
  [0.1, -0.1].forEach((sd) => { rbox(g, 0.18, 0.46, 0.18, 0.06, SM.suit, 0, 0.32, sd); rbox(g, 0.26, 0.12, 0.2, 0.04, SM.grey, 0.03, 0.06, sd); });
  rbox(g, 0.34, 0.52, 0.48, 0.12, SM.suit, 0, 0.8, 0);
  rbox(g, 0.06, 0.16, 0.24, 0.02, SM.grey, 0.19, 0.78, 0); box(g, 0.02, 0.08, 0.1, SM.red, 0.17, 0.95, 0.15); box(g, 0.02, 0.08, 0.1, SM.panel, 0.17, 0.95, -0.15);
  rbox(g, 0.24, 0.56, 0.44, 0.06, SM.off, -0.28, 0.84, 0);
  const arms = [1, -1].map((sd) => { const a = grp(g, 0.02, 1.0, sd * 0.3); rbox(a, 0.14, 0.44, 0.14, 0.05, SM.suit, 0, -0.2, 0); sph(a, 0.085, SM.off, 0, -0.45, 0); return a; });
  cylY(g, 0.15, 0.08, SM.grey, 0, 1.08, 0, 14);
  sph(g, 0.25, SM.suit, 0, 1.3, 0); const v = sph(g, 0.2, SM.visor, 0.11, 1.31, 0); v.scale.set(0.15, 0.165, 0.18);
  g.userData.arms = arms; return g;
}

export default {
  id: 'espace', title: "L'Espace", titleHtml: "L'<span>Espace</span>",
  subtitle: 'Une vraie base spatiale : des fusées, une navette, le bus des astronautes, une station dans le ciel... Touche-les pour les faire décoller !',
  welcome: "Bienvenue dans l'espace ! Touche un engin pour le faire décoller.",
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la base',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3c5 4 6 10 4 17h-8C10 13 11 7 16 3z"/><path d="M12 20l-4 5h5M20 20l4 5h-5M14 24l2 5 2-5"/><circle cx="16" cy="12" r="2"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 46, floating: true, forest: false, tufts: false, sky: 0x05060f, rimColor: 0x3d3a52,
  lights: { hemi: [0xb8c8ff, 0x3a3050, 0.85], sun: [0xfff0d8, 1.15] },
  overview: { w: 80, h: 56, focus: [0, 3, 0] },
  ground: {
    base: ['#7d86b6', '#636c9e', '#4a5180'],
    blobs: GB, paths: GP
  },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene);
    onUpdate((dt) => fx.update(dt));
    const DOWN = new V3(0, -1, 0);
    const burn = (anchors, k = 1) => anchors.forEach((a) => { const p = wp(a); for (let i = 0; i < 3 * k; i++) fx.fire(p, DOWN, 9, 1.2, rnd(0.3, 0.55)); });
    const groundSmoke = (center, k = 1) => { for (let i = 0; i < 2 * k; i++) { const a = rnd(0, Math.PI * 2); fx.smoke(new V3(center.x + Math.cos(a), 0.6, center.z + Math.sin(a)), new V3(Math.cos(a) * rnd(3, 6), rnd(0.2, 1), Math.sin(a) * rnd(3, 6)), rnd(0.9, 1.5)); } };
    const countdown = async () => { for (const n of ['Trois...', 'Deux...', 'Un...']) { tone(880, 0, 0.18, 'square', 0.04); await step(n, null); } };

    freeze(buildBase(grp(scene), onUpdate));

    /* ---- fusée ---- */
    (function () {
      const st = makeStation('fusee'), S = st.g;
      rbox(S, 7, 0.6, 7, 0.1, SM.concrete, 0, 0.3, 0); box(S, 2.4, 0.04, 5, 0x2a2a33, 0, 0.62, 0);
      const R = buildRocket(S); R.g.position.y = 1.5; st.m = R.g;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => rbox(S, 0.4, 1.0, 0.4, 0.05, SM.grey, a * 1.0, 1.0, b * 1.0));
      const tw0 = grp(S, -3.2, 0.6, 0); const H = 15;
      [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]].forEach(([x, z]) => rod(tw0, new V3(x, 0, z), new V3(x, H, z), 0.07, SM.red, 6));
      for (let y = 0; y < H; y += 1.2) { rod(tw0, new V3(-0.5, y, 0.5), new V3(0.5, y + 1.2, 0.5), 0.04, SM.red, 5); rod(tw0, new V3(0.5, y, -0.5), new V3(-0.5, y + 1.2, -0.5), 0.04, SM.red, 5); rod(tw0, new V3(-0.5, y, 0.5), new V3(0.5, y, 0.5), 0.04, SM.red, 5); }
      sph(tw0, 0.15, MT.tail, 0, H + 0.2, 0);
      const arms = [6.5, 10.5].map((y) => { const a = grp(tw0, 0.5, y, 0); rbox(a, 1.75, 0.3, 0.6, 0.05, SM.grey, 0.88, 0, 0); rail(a, [[0.1, 0.15, 0.3], [1.7, 0.15, 0.3]], 0.03, SM.red); return a; });
      const saved = save([R.g, R.core, R.upper, R.sat, ...R.panels, ...R.fair, ...R.boosters]);
      const plume = add(R.core, new THREE.ConeGeometry(0.7, 4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 0, -2.6, 0);
      plume.rotation.x = Math.PI; plume.visible = false;
      part(st, 'tour', 'la tour de lancement', anchor(tw0, 0, 12.5, 0), true);
      part(st, 'boosters', 'les boosters', anchor(R.boosters[0], 0, 4.5, 0.6), true);
      part(st, 'etage', 'le premier étage', anchor(R.core, 0, 5, 1), false);
      part(st, 'coiffe', 'la coiffe', anchor(R.upper, 0, 4.5, 1), true);
      part(st, 'satellite', 'le satellite', anchor(R.sat, 0, 1.5, 0), false);
      const follow = anchor(R.g, 0, 7, 0); st.focusAt = follow; st.size = { w: 12, h: 20 }; st.tagAt = anchor(S, 0, 17, 0);
      st.update = () => {
        if (st.firing) { burn(st.nozz, 1); plume.scale.set(1 + rnd(-0.1, 0.1), 1 + rnd(-0.15, 0.15), 1); if (R.g.position.y < 6) groundSmoke(S.position, 1); }
      };
      st.action = async function () {
        if (st.done) { await Promise.all([step('Une nouvelle fusée est prête !', 'tour'), sleep(0.3)]); restore(saved); R.panels.forEach((p) => (p.rotation.x = 0)); arms.forEach((a) => (a.rotation.y = 0)); st.focusAt = follow; pop(R.g, 0.8); st.done = false; }
        await Promise.all([step('Les bras de la tour s’écartent.', 'tour'), ...arms.map((a) => to(a.rotation, 'y', -1.4, 1.6))]);
        await countdown();
        engineOn(34); st.nozz = [...R.nozzles]; st.firing = true; plume.visible = true;
        await Promise.all([step('Allumage ! Les moteurs crachent du feu.', null), tw(2.2, (k) => { R.g.position.x = rnd(-0.03, 0.03); R.g.position.y = 1.5 + k * 1.5; }, easeIn)]);
        await Promise.all([step('Et ça monte, de plus en plus vite !', 'boosters'), to(R.g.position, 'y', 16, 3.2, easeIn)]);
        // boosters away
        R.boosters.forEach((b) => S.attach(b)); st.nozz = [R.nozzles[0]];
        await Promise.all([step('Les boosters sont vides : ils se détachent.', 'boosters'), to(R.g.position, 'y', 24, 2.6, lin),
          ...R.boosters.map((b, i) => tw(2.6, (k) => { b.position.y -= 0.12; b.position.z += (i ? -1 : 1) * 0.05; b.rotation.x += (i ? -1 : 1) * 0.012; b.scale.setScalar(Math.max(0.01, 1 - k * 0.9)); }, lin))]);
        R.boosters.forEach((b) => (b.visible = false));
        S.attach(R.core); plume.visible = false; st.nozz = [anchor(R.upper, 0, -0.1, 0)]; st.focusAt = anchor(R.upper, 0, 2, 0);
        await Promise.all([step('Le premier étage se détache aussi.', 'etage'), to(R.upper.position, 'y', R.upper.position.y + 3, 2.2, lin),
          tw(2.2, (k) => { R.core.position.y -= 0.1; R.core.rotation.z += 0.01; R.core.scale.setScalar(Math.max(0.01, 1 - k * 0.9)); }, lin)]);
        R.core.visible = false; st.firing = false; plume.visible = false; engineOff();
        await Promise.all([step('La coiffe s’ouvre... voilà le satellite !', 'coiffe'), ...R.fair.map((f, i) => tw(1.8, (k) => { f.rotation.z = (i ? -1 : 1) * k * 1.3; f.position.x = (i ? -1 : 1) * k * 1.4; f.scale.setScalar(Math.max(0.01, 1 - k * 0.6)); }))]);
        R.fair.forEach((f) => (f.visible = false));
        await Promise.all([step('Il déplie ses panneaux solaires pour prendre l’énergie du Soleil.', 'satellite'), ...R.panels.map((p, i) => to(p.rotation, 'x', (i ? 1 : -1) * Math.PI / 2, 1.6, easeBack))]);
        chime(); st.done = true;
      };
    })();

    /* ---- navette spatiale ---- */
    (function () {
      const st = makeStation('navette'), S = st.g;
      rbox(S, 7, 0.6, 7, 0.1, SM.concrete, 0, 0.3, 0);
      const RW = { x0: 4, x1: 24, z: 9 };
      rbox(S, RW.x1 - RW.x0, 0.06, 3.4, 0.02, 0x30333d, (RW.x0 + RW.x1) / 2, 0.04, RW.z, 0.01);
      for (let x = RW.x0 + 1; x < RW.x1 - 0.5; x += 1.6) box(S, 0.8, 0.02, 0.12, 0xf3efe2, x, 0.08, RW.z);
      const stack = grp(S, 0, 0.6, 0); st.m = stack;
      const tank = grp(stack); cylY(tank, 1.05, 9.5, SM.tank, 0, 5.2, 0, 28); add(tank, nose(1.05, 2.0, 28), SM.tank, 0, 9.95, 0);
      const srbs = [1, -1].map((sd) => { const b = grp(stack, 0.3, 0, sd * 1.55); cylY(b, 0.45, 9, SM.white, 0, 4.9, 0, 20); add(b, nose(0.45, 1.1, 20), SM.white, 0, 9.4, 0); add(b, bell(0.4, 0.7), SM.grey, 0, 0.4, 0); [2, 7].forEach((y) => cylY(b, 0.46, 0.2, SM.black, 0, y, 0, 20)); return b; });
      // orbiter, built along +x (nose) with belly at y=0, then stood up against the tank
      const orb = grp(stack, -1.75, 1.2, 0); orb.rotation.z = Math.PI / 2;
      const ob = grp(orb, 0, -0.65, 0);
      ext(ob, [[0, 0.15], [5.6, 0.12], [6.4, 0.35], [6.9, 0.7], [6.6, 1.1], [5.8, 1.3], [0.4, 1.3], [0, 1.1]], [0.05, 0.1, 0.3, 0.3, 0.2, 0.1, 0.05, 0.05], 1.4, SM.white, 0, 0, 0, 0.04);
      rbox(ob, 6.6, 0.1, 1.42, 0.03, SM.black, 3.3, 0.14, 0, 0.01);
      [1, -1].forEach((sd) => { const w = extY(ob, [[0.6, 0.6 * sd], [4.6, 0.6 * sd], [1.9, 3.0 * sd], [0.4, 3.0 * sd]].map(([x, z]) => [x, z]), 0.08, 0.12, SM.white, 0, 0.3, 0, 0.02); box(ob, 3.0, 0.06, 0.25, SM.black, 1.6, 0.24, sd * 1.9).rotation.y = sd * 0.6; });
      ext(ob, [[0.2, 1.3], [1.6, 1.3], [0.9, 3.0], [0.3, 3.0]], 0.05, 0.16, SM.white, 0, 0, 0, 0.02);
      rbox(ob, 0.5, 0.18, 0.9, 0.06, SM.black, 6.0, 1.2, 0, 0.02);
      [[0.95, 0], [0.6, 0.35], [0.6, -0.35]].forEach(([y, z]) => { const e = add(ob, bell(0.22, 0.4), SM.grey, -0.05, y, z); e.rotation.z = Math.PI / 2; });
      const doors = [1, -1].map((sd) => { const h = grp(ob, 0, 1.3, sd * 0.68); rbox(h, 4.6, 0.06, 0.68, 0.02, SM.off, 3.1, 0.03, -sd * 0.34, 0.01); return h; });
      const arm = grp(ob, 5.2, 1.2, 0.45); const a1 = rod(arm, new V3(0, 0, 0), new V3(-2.2, 0, 0), 0.05, SM.off); const elbow = grp(arm, -2.2, 0, 0); rod(elbow, new V3(0, 0, 0), new V3(2.0, 0, 0), 0.045, SM.off);
      const osat = grp(ob, 3.0, 0.9, -0.1); rbox(osat, 1.2, 0.6, 0.7, 0.05, SM.gold, 0, 0, 0, 0.02);
      const gear = [[5.6, 0], [1.6, 0.5], [1.6, -0.5]].map(([x, z]) => { const g = grp(ob, x, 0.1, z); rod(g, new V3(0, 0, 0), new V3(0, -0.45, 0), 0.04, SM.grey); cylZ(g, 0.16, 0.12, MT.rubberS, 0, -0.5, 0, 12); g.visible = false; return g; });
      const chute = grp(ob, -0.4, 0.8, 0); const ch = add(chute, new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), SM.chute); ch.rotation.z = Math.PI / 2; ch.position.x = -2.4; ch.material = SM.chute.clone(); ch.material.side = THREE.DoubleSide;
      [[0.6, 0.6], [0.6, -0.6], [-0.6, 0.6], [-0.6, -0.6]].forEach(([y, z]) => rod(chute, new V3(0, 0, 0), new V3(-2.4, y, z), 0.01, SM.black, 4)); chute.visible = false;
      const tw0 = grp(S, -1.4, 0.6, -2.6); const H = 14;
      [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]].forEach(([x, z]) => rod(tw0, new V3(x, 0, z), new V3(x, H, z), 0.07, SM.grey, 6));
      for (let y = 0; y < H; y += 1.2) { rod(tw0, new V3(-0.5, y, 0.5), new V3(0.5, y + 1.2, 0.5), 0.04, SM.grey, 5); rod(tw0, new V3(-0.5, y, 0.5), new V3(0.5, y, 0.5), 0.04, SM.grey, 5); }
      sph(tw0, 0.15, MT.tail, 0, H + 0.2, 0);
      const nozz = [...srbs.map((b) => anchor(b, 0, -0.4, 0)), anchor(ob, -0.4, 0.7, 0)];
      const para = srbs.map((b) => { const c = add(b, new THREE.SphereGeometry(0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), SM.chute2, 0, 11.3, 0); c.visible = false; return c; });
      const saved = save([stack, tank, ...srbs, orb, ...doors, arm, elbow, osat, chute]);
      part(st, 'boosters', 'les boosters', anchor(srbs[0], 0, 6, 0.5), true);
      part(st, 'reservoir', 'le réservoir', anchor(tank, 0, 8, 1.1), true);
      part(st, 'navette', 'la navette', anchor(ob, 4, 1.6, 0), true);
      part(st, 'portes', 'les portes de la soute', anchor(ob, 3, 1.6, 0.7), false);
      part(st, 'bras', 'le bras robot', anchor(elbow, 1, 0.3, 0), false);
      part(st, 'parachute', 'le parachute', anchor(chute, -2.4, 0.8, 0), false);
      const follow = anchor(stack, 0, 7, 0); st.focusAt = follow; st.size = { w: 13, h: 19 }; st.tagAt = anchor(S, 0, 15, 0);
      st.update = () => { if (st.firing) { burn(st.nozz, 1); if (stack.position.y < 5) groundSmoke(S.position, 1); } };
      st.action = async function () {
        if (st.done) {
          await step('On remet la navette sur son pas de tir.', 'navette'); restore(saved);
          doors.forEach((d) => (d.rotation.x = 0)); para.forEach((c) => (c.visible = false)); arm.rotation.set(0, 0, 0); elbow.rotation.set(0, 0, 0); gear.forEach((g) => (g.visible = false)); chute.visible = false;
          st.focusAt = follow; pop(stack, 0.8); st.done = false;
        }
        await countdown();
        engineOn(32); st.nozz = [...nozz]; st.firing = true;
        await Promise.all([step('Allumage des moteurs et des boosters !', 'boosters'), to(stack.position, 'y', 14, 4.5, easeIn)]);
        srbs.forEach((b) => S.attach(b)); st.nozz = [nozz[2]];
        await Promise.all([step('Les boosters se détachent, et redescendent en parachute.', 'boosters'), to(stack.position, 'y', 22, 2.6, lin),
          ...srbs.map((b, i) => tw(2.6, (k) => { b.position.y -= 0.06; b.position.z += (i ? -1 : 1) * 0.04; b.rotation.x = (i ? -1 : 1) * k * 0.5; para[i].visible = k > 0.3; }, lin))]);
        srbs.forEach((b) => (b.visible = false));
        S.attach(tank); S.attach(orb); st.focusAt = anchor(orb, 3.5, 0, 0);
        await Promise.all([step('Le grand réservoir orange se détache à son tour.', 'reservoir'), to(orb.position, 'y', orb.position.y + 4, 2.4, lin),
          tw(2.4, (k) => { tank.position.y -= 0.08; tank.position.x += 0.04; tank.rotation.z += 0.006; tank.scale.setScalar(Math.max(0.01, 1 - k * 0.9)); }, lin)]);
        tank.visible = false; st.firing = false; engineOff();
        await Promise.all([step("Dans l'espace, la navette se met à plat.", 'navette'), to(orb.rotation, 'z', 0, 2.0)]);
        await Promise.all([step('Elle ouvre les portes de sa soute.', 'portes'), ...doors.map((d, i) => to(d.rotation, 'x', (i ? 1 : -1) * 2.2, 1.8))]);
        await Promise.all([step('Le bras robot sort un satellite.', 'bras'), to(arm.rotation, 'z', 0.9, 1.6), to(elbow.rotation, 'z', -1.6, 1.6), to(osat.position, 'y', 2.4, 1.6)]);
        S.attach(osat); tw(3, (k) => { osat.position.y += 0.02; osat.rotation.y += 0.01; }, lin);
        await Promise.all([to(arm.rotation, 'z', 0, 1.2), to(elbow.rotation, 'z', 0, 1.2), ...doors.map((d) => to(d.rotation, 'x', 0, 1.2))]);
        osat.visible = false;
        // back to Earth: glide onto the runway
        orb.position.set(RW.x0 - 9, 9, RW.z); orb.rotation.set(0, 0, -0.18); gear.forEach((g) => (g.visible = true)); st.focusAt = anchor(orb, 3.5, 0, 0);
        await Promise.all([step('Puis elle revient sur Terre, et atterrit comme un avion.', 'navette'),
          tw(4.2, (k) => { orb.position.x = RW.x0 - 9 + k * 12; orb.position.y = 1.22 + (9 - 1.22) * Math.pow(1 - k, 1.6); orb.rotation.z = -0.18 * (1 - k) + 0.05 * k; }, lin)]);
        thud(); chute.visible = true; pop(chute, 0.5);
        await Promise.all([step('Un parachute l’aide à freiner.', 'parachute'), to(orb.position, 'x', RW.x1 - 8, 3.0, (k) => 1 - Math.pow(1 - k, 2)), to(orb.rotation, 'z', 0, 0.6)]);
        chime(); st.done = true;
      };
    })();

    /* ---- transporteur à chenilles ---- */
    (function () {
      const st = makeStation('transporteur'), S = st.g, START = 0.6, END = 11;
      const vab = grp(S, START - 0.5, 0, 8); // the hangar sits behind the crawler, away from the camera
      rbox(vab, 7, 15, 7.5, 0.1, SM.off, 0, 7.5, 0); for (let z = -3; z <= 3; z += 1) box(vab, 7.05, 14.8, 0.06, 0xc9ccd8, 0, 7.4, z);
      rbox(vab, 7.2, 0.3, 7.7, 0.08, SM.panel, 0, 15.1, 0);
      const doors = [1, -1].map((s) => { const d = grp(vab, 3.56, 0, s * 1.05); rbox(d, 0.12, 13.5, 2.1, 0.03, SM.grey, 0, 6.75, 0); for (let y = 1; y < 13.5; y += 1) box(d, 0.14, 0.06, 2.1, 0x6a707e, 0, y, 0); return d; });
      const pad = grp(S, END, 0, 0); rbox(pad, 7, 0.5, 7, 0.1, SM.concrete, 0, 0.25, 0); [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([x, z]) => rbox(pad, 0.6, 1.6, 0.6, 0.05, SM.grey, x, 1.0, z));
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const trucks = [[2.3, 2.3], [2.3, -2.3], [-2.3, 2.3], [-2.3, -2.3]];
      st.tracks = [];
      trucks.forEach(([x, z]) => { const t = grp(m, x, 0, z); st.tracks.push(trackUnit(t, { len: 2.2, r: 0.36, w: 0.55, z: 0.34 }), trackUnit(t, { len: 2.2, r: 0.36, w: 0.55, z: -0.34 })); rbox(t, 1.8, 0.35, 1.3, 0.05, SM.grey, 0, 1.0, 0); });
      const plat = grp(m, 0, 1.35, 0);
      rbox(plat, 6.4, 0.6, 6.4, 0.1, SM.grey, 0, 0.3, 0); rbox(plat, 1.2, 1.0, 1.4, 0.08, SM.off, -2.4, 1.1, 2.4); rbox(plat, 1.2, 1.0, 1.4, 0.08, SM.off, 2.4, 1.1, -2.4);
      rail(plat, [[-3.1, 0.6, -3.1], [-3.1, 1.1, -3.1], [3.1, 1.1, -3.1]], 0.03, MT.yel);
      const mlp = grp(plat, 0, 0.6, 0); rbox(mlp, 5, 1.0, 4.6, 0.08, SM.black, 0, 0.5, 0);
      const twr = grp(mlp, -1.9, 1, -1.5); [[0.35, 0.35], [0.35, -0.35], [-0.35, 0.35], [-0.35, -0.35]].forEach(([x, z]) => rod(twr, new V3(x, 0, z), new V3(x, 10, z), 0.06, SM.red, 6)); for (let y = 0; y < 10; y += 1) rod(twr, new V3(-0.35, y, 0.35), new V3(0.35, y + 1, 0.35), 0.035, SM.red, 5);
      const R = buildRocket(mlp, 0.72); R.g.position.y = 1.0;
      beacon(st, plat, 2.9, 0.6, 2.9); beacon(st, plat, -2.9, 0.6, -2.9);
      trucks.forEach(([x, z]) => [0.5, -0.5].forEach((dz) => st.links.push(hydraulic(m, anchor(m, x + 0.5, 1.15, z + dz), anchor(plat, x + 0.5, 0.05, z + dz), { barrel: 0.25, rb: 0.08, mat: SM.grey }))));
      part(st, 'chenilles', 'les huit chenilles', anchor(st.tracks[0].g, 0, 0.5, 0.4), true);
      part(st, 'verins', 'les vérins', anchor(m, 2.8, 1.4, 2.8), true);
      part(st, 'fusee', 'la fusée', anchor(R.g, 0, 8, 0), true);
      part(st, 'hangar', 'le hangar', anchor(vab, 3.6, 12, 0), true);
      part(st, 'pas', 'le pas de tir', anchor(pad, 0, 2, 0), false);
      st.focusAt = anchor(m, 0, 4, 0); st.size = { w: 15, h: 15 }; st.tagAt = anchor(m, 0, 12, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) {
          engineOn(40); st.reversing = true; st.beepT = 0;
          await Promise.all([step('On retourne devant le grand hangar.', 'chenilles'), to(m.position, 'x', START, 6, easeSine), to(plat.position, 'y', 1.35, 1)]);
          st.reversing = false; st.done = false;
        }
        engineOn(40);
        await Promise.all([step('Les vérins soulèvent la plateforme.', 'verins'), to(plat.position, 'y', 1.75, 1.6)]);
        await Promise.all([to(m.position, 'x', END, 10, easeSine), (async () => { await step('Le transporteur roule tout doucement, sur huit chenilles.', 'chenilles'); await step("Il emmène la fusée jusqu'au pas de tir.", 'fusee'); })()]);
        await Promise.all([step('Arrivé ! Les vérins posent la fusée.', 'pas'), to(plat.position, 'y', 1.35, 1.6)]);
        chime(); st.done = true;
      };
    })();

    /* ---- rover martien ---- */
    (function () {
      const st = makeStation('rover'), S = st.g, START = -4.5, END = 4;
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const body = grp(m, 0, 1.0, 0);
      rbox(body, 1.9, 0.45, 1.25, 0.06, SM.white, 0, 0, 0); rbox(body, 1.95, 0.08, 1.3, 0.03, SM.gold, 0, 0.26, 0, 0.01);
      rbox(body, 0.7, 0.12, 0.5, 0.03, SM.grey, -0.4, 0.36, -0.3, 0.01);
      const rtg = grp(body, -1.15, 0.05, 0); cylX(rtg, 0.18, 0.6, SM.black, 0, 0, 0, 12); for (let k = 0; k < 6; k++) { const f = box(rtg, 0.5, 0.36, 0.02, SM.grey, 0, 0, 0); f.rotation.x = (k * Math.PI) / 6; }
      const wheels = [];
      [[0.85, 1], [0, 1], [-0.85, 1], [0.85, -1], [0, -1], [-0.85, -1]].forEach(([x, s]) => {
        const leg = grp(m, x, 0.32, s * 0.85); const w = grp(leg); cylZ(w, 0.3, 0.26, SM.grey, 0, 0, 0, 16); for (let k = 0; k < 8; k++) { const c = box(w, 0.06, 0.6, 0.27, SM.black, 0, 0, 0); c.rotation.z = (k * Math.PI) / 8; c.scale.y = 0.62; }
        cylZ(w, 0.12, 0.3, SM.off, 0, 0, 0, 10); w.userData.r = 0.3; wheels.push({ leg, w, x }); st.wheels.push(w);
        rod(m, new V3(x, 0.32, s * 0.85), new V3(x * 0.6, 0.85, s * 0.66), 0.035, SM.off);
      });
      [1, -1].forEach((s) => { rod(m, new V3(0.5, 0.85, s * 0.66), new V3(-0.6, 0.85, s * 0.66), 0.045, SM.off); });
      const mast = grp(body, 0.7, 0.2, 0.42); rod(mast, new V3(0, 0, 0), new V3(0, 1.3, 0), 0.05, SM.off);
      const head = grp(mast, 0, 1.4, 0); rbox(head, 0.36, 0.2, 0.55, 0.05, SM.white, 0, 0, 0); [0.12, -0.12].forEach((z) => cylX(head, 0.065, 0.06, SM.black, 0.19, 0, z, 12));
      const dishG = grp(body, -0.5, 0.35, -0.35); const dd = add(dishG, new THREE.CylinderGeometry(0.3, 0.05, 0.1, 16), SM.off, 0, 0.1, 0);
      const armG = grp(body, 0.95, -0.05, 0); const ua = grp(armG); rod(ua, new V3(0, 0, 0), new V3(0.75, 0, 0), 0.04, SM.off); const fa = grp(ua, 0.75, 0, 0); rod(fa, new V3(0, 0, 0), new V3(0.65, 0, 0), 0.035, SM.off);
      const turret = grp(fa, 0.65, 0, 0); rbox(turret, 0.2, 0.2, 0.2, 0.04, SM.grey, 0, 0, 0); const drill = cylY(turret, 0.03, 0.3, SM.silver, 0, -0.22, 0, 8);
      ua.rotation.z = 1.4; fa.rotation.z = -2.6; armG.rotation.y = 0;
      const rock = add(S, ICO, SM.mars, END + 2.4, 0.3, 0); rock.scale.set(0.6, 0.45, 0.6);
      const rings = [0, 1, 2].map(() => { const r = add(S, new THREE.TorusGeometry(0.5, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0 }), 0, 0, 0); r.rotation.x = Math.PI / 2; return r; });
      part(st, 'roues', 'les six roues', anchor(m, 0, 0.7, 1.1), true);
      part(st, 'camera', 'la caméra', anchor(head, 0, 0.35, 0), true);
      part(st, 'bras', 'le bras', anchor(fa, 0.3, 0.2, 0), true);
      part(st, 'antenne', "l'antenne", anchor(dishG, 0, 0.4, 0), false);
      st.focusAt = anchor(m, 0.6, 1, 0); st.size = { w: 8, h: 5 }; st.tagAt = anchor(m, 0, 3.2, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; roll(st, dt);
        wheels.forEach(({ leg, x }) => { const wx = m.position.x + x; leg.position.y = 0.32 + Math.max(0, Math.sin(wx * 2.3) * 0.12) + Math.max(0, Math.sin(wx * 3.7 + 1) * 0.06); });
        body.rotation.z = (wheels[0].leg.position.y - wheels[2].leg.position.y) * 0.4;
      };
      st.action = async function () {
        if (st.done) { st.reversing = true; st.beepT = 0; await Promise.all([step('Le rover repart explorer.', 'roues'), to(m.position, 'x', START, 3)]); st.reversing = false; st.done = false; }
        engineOn(90);
        await Promise.all([step('Le rover roule sur Mars. Ses roues grimpent sur les cailloux.', 'roues'), to(m.position, 'x', END, 5.5, easeSine)]);
        engineOff();
        await Promise.all([step('Il tourne sa caméra pour regarder autour de lui.', 'camera'), tw(2.4, (k) => (head.rotation.y = Math.sin(k * Math.PI * 2) * 0.8), lin)]);
        await Promise.all([step('Son bras sort la perceuse...', 'bras'), to(ua.rotation, 'z', -0.2, 1.4), to(fa.rotation, 'z', -0.9, 1.4)]);
        const tip = wp(turret); let dt0 = 0;
        await Promise.all([step('...et fait un petit trou dans la roche.', 'bras'), tw(2.2, (k) => { drill.rotation.y += 0.6; drill.position.y = -0.22 - k * 0.12; dt0 += 1; if (dt0 % 4 === 0) throwClod(tip, tip.clone().add(new V3(rnd(-0.5, 0.5), -0.4, rnd(-0.5, 0.5))), rnd(0.04, 0.08), 0xc0663a); }, lin)]);
        await Promise.all([to(ua.rotation, 'z', 1.4, 1.2), to(fa.rotation, 'z', -2.6, 1.2), to(drill.position, 'y', -0.22, 0.4)]);
        await Promise.all([step('Il envoie la photo vers la Terre !', 'antenne'), to(dishG.rotation, 'z', 0.7, 1),
          ...rings.map((r, i) => sleep(i * 0.5).then(() => { const p = S.worldToLocal(wp(dishG, 0.3)); r.position.copy(p); return tw(1.6, (k) => { r.position.y = p.y + k * 4; r.scale.setScalar(1 + k * 3); r.material.opacity = 0.9 * (1 - k); }, lin); }))]);
        dishG.rotation.z = 0; chime(); st.done = true;
      };
    })();

    /* ---- station spatiale ---- */
    (function () {
      const st = makeStation('station'), S = st.g, H = 11;
      const iss = grp(S, 0, H, 0); st.m = iss;
      // long truss along x, with lattice
      rbox(iss, 11.4, 0.36, 0.36, 0.04, SM.grey, 0, 0, 0, 0.01);
      for (let x = -5.4; x < 5.5; x += 0.6) { rod(iss, new V3(x, -0.19, 0.19), new V3(x + 0.6, 0.19, 0.19), 0.025, SM.silver, 4); rod(iss, new V3(x, 0.19, -0.19), new V3(x + 0.6, -0.19, -0.19), 0.025, SM.silver, 4); }
      // solar wings: each pivots around the truss (x axis)
      const wings = [-4.9, -3.6, 3.6, 4.9].map((x) => {
        const w = grp(iss, x, 0, 0); cylX(w, 0.22, 0.4, SM.silver, 0, 0, 0, 12);
        [1, -1].forEach((sd) => { rod(w, new V3(0, 0, sd * 0.2), new V3(0, 0, sd * 3.6), 0.03, SM.silver, 4); rbox(w, 0.95, 0.04, 3.2, 0.01, SM.panel, 0, 0, sd * 2.0, 0.005); box(w, 0.97, 0.05, 0.04, SM.gold, 0, 0, sd * 0.4); box(w, 0.97, 0.05, 0.04, SM.gold, 0, 0, sd * 3.6); });
        return w;
      });
      // radiators
      [-1.6, 1.6].forEach((x) => { const r = grp(iss, x, 0, -0.2); rbox(r, 0.7, 0.04, 2.2, 0.01, SM.white, 0, 0, -1.3, 0.005); });
      // pressurised modules under the truss: where the astronauts live
      const mod = grp(iss, 0, -1.25, 0);
      rod(iss, new V3(0, -0.2, 0), new V3(0, -0.7, 0), 0.14, SM.off, 10);
      [[-3.3, -2.0, 0.42, SM.white], [-2.0, -0.6, 0.55, SM.off], [-0.6, 0.6, 0.6, SM.white], [0.6, 2.3, 0.55, SM.off], [2.3, 3.1, 0.45, SM.white]].forEach(([a, b, r, mm]) => {
        cylX(mod, r, b - a - 0.04, mm, (a + b) / 2, 0, 0, 20); cylX(mod, r + 0.02, 0.06, SM.grey, a + 0.03, 0, 0, 20);
      });
      [[-3.3, 1], [-3.3, -1]].forEach(([x, sd]) => rbox(mod, 0.6, 0.03, 1.6, 0.01, SM.panel, x + 0.3, 0, sd * 1.25, 0.005));
      const cupola = grp(mod, -1.3, -0.55, 0); cylY(cupola, 0.28, 0.2, SM.off, 0, 0, 0, 8); cylY(cupola, 0.2, 0.06, MT.glassD || SM.black, 0, -0.12, 0, 8);
      for (let x = -1.8; x <= 1.8; x += 0.9) cylZ(mod, 0.08, 0.05, SM.black, x, 0.1, 0.6, 10);
      // docking port at +x, airlock hatch on the front of the white node
      const port = cylX(mod, 0.3, 0.3, SM.grey, 3.25, 0, 0, 16);
      const lock = grp(mod, -0.1, 0, 0.6); cylZ(lock, 0.3, 0.12, SM.grey, 0, 0, 0, 16);
      const hatch = grp(lock, -0.27, 0, 0.07); const hd = cylZ(hatch, 0.26, 0.05, SM.white, 0.27, 0, 0, 16);
      // capsule (nose towards the station, along -x)
      const cap = grp(S, 14, H - 1.25, 0); const capB = grp(cap); capB.rotation.z = Math.PI / 2;
      add(capB, new THREE.CylinderGeometry(0.38, 0.75, 1.0, 20), SM.white, 0, 0.5, 0); cylY(capB, 0.75, 0.9, SM.black, 0, -0.45, 0, 20);
      [1, -1].forEach((sd) => rbox(capB, 0.03, 0.8, 0.5, 0.01, SM.panel, sd * 0.76, -0.45, 0, 0.005));
      cylY(capB, 0.22, 0.14, SM.grey, 0, 1.06, 0, 14); [[0.55, 0.3], [0.55, -0.3]].forEach(([y, z]) => cylZ(capB, 0.08, 0.04, SM.black, 0.62 - (y - 0.55) * 0.3, y, z * 0.7, 10));
      const capJet = anchor(cap, 0.7, 0, 0);
      // the space-walker and his tether
      const walker = astronaut(mod, 0, 0, 0, 0.7); walker.visible = false;
      const tetherPts = Array.from({ length: 14 }, () => new V3());
      const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tetherPts), new THREE.LineBasicMaterial({ color: 0xffe28a })); mod.add(tether); tether.visible = false;
      const lockPt = new V3(-0.1, 0, 0.75), belt = new V3();
      const updTether = () => {
        belt.set(-0.18, 0.45, 0).multiplyScalar(0.7).applyEuler(walker.rotation).add(walker.position);
        tetherPts.forEach((q, i) => { const k = i / (tetherPts.length - 1); q.lerpVectors(lockPt, belt, k); q.y -= Math.sin(k * Math.PI) * 0.35; q.z += Math.sin(k * Math.PI) * 0.15; });
        tether.geometry.setFromPoints(tetherPts);
      };
      const saved = save([cap, walker]);
      part(st, 'panneaux', 'les panneaux solaires', anchor(wings[3], 0, 0, 3.4), true);
      part(st, 'modules', 'les modules', anchor(mod, -1.3, 0.6, 0.4), true);
      part(st, 'capsule', 'la capsule', anchor(cap, 0.2, 0.7, 0), false);
      part(st, 'sas', 'le sas', anchor(lock, 0, 0.3, 0.1), false);
      part(st, 'astronaute', "l'astronaute", anchor(walker, 0, 1.7, 0), false);
      part(st, 'cable', 'le câble', anchor(mod, -0.4, -0.5, 0.9), false);
      st.focusAt = anchor(iss, 1.5, -0.6, 0); st.size = { w: 16, h: 9 }; st.tagAt = anchor(iss, 0, 4, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; iss.position.y = H + Math.sin(T * 0.8) * 0.12; cap.position.y = iss.position.y - 1.25;
        if (walker.visible) updTether();
        if (st.jets) { const p = wp(capJet); fx.smoke(p, new V3(rnd(1, 2), rnd(-0.3, 0.3), rnd(-0.3, 0.3)), 0.25, 0xffffff, 0.5); }
      };
      const floatTo = (x, y, z, d) => Promise.all([to(walker.position, 'x', x, d, easeSine), to(walker.position, 'y', y, d, easeSine), to(walker.position, 'z', z, d, easeSine)]);
      st.action = async function () {
        if (st.done) {
          st.jets = true;
          await Promise.all([step("La capsule ramène l'équipage sur Terre.", 'capsule'), to(cap.position, 'x', 14, 3.5, easeIn)]);
          st.jets = false; restore(saved); walker.visible = false; wings.forEach((w) => (w.rotation.x = 0)); st.done = false;
        }
                await Promise.all([step("La station tourne autour de la Terre. Des astronautes vivent dedans !", 'modules'), sleep(0.4)]);
        await Promise.all([step('Ses panneaux solaires se tournent vers le Soleil, pour faire de l’électricité.', 'panneaux'), ...wings.map((w) => to(w.rotation, 'x', 0.9, 2.0))]);
        engineOn(110); st.jets = true;
        await Promise.all([step('Une capsule arrive avec de nouveaux astronautes.', 'capsule'), to(cap.position, 'x', 4.15, 5, (k) => 1 - Math.pow(1 - k, 2.5))]);
        st.jets = false; engineOff(); thud();
        await Promise.all([step('Elle s’accroche tout doucement à la station : c’est l’amarrage.', 'capsule'), sleep(0.6)]);
        await Promise.all([step('Un astronaute sort par le sas.', 'sas'), to(hatch.rotation, 'y', -1.9, 1.2)]);
        walker.position.set(-0.1, -0.35, 0.8); walker.rotation.set(0, -Math.PI / 2, 0); walker.visible = true; updTether(); tether.visible = true; pop(walker, 0.4);
        await Promise.all([step('Il est attaché par un câble, pour ne pas s’envoler !', 'cable'), floatTo(-0.6, 0.3, 1.5, 2.4), to(walker.rotation, 'z', 0.5, 2.4)]);
        await Promise.all([step("Dans l'espace, on flotte : il se tire avec les mains.", 'astronaute'), floatTo(-2.4, 0.9, 1.1, 3.0), to(walker.rotation, 'y', -Math.PI / 4, 3.0)]);
        const [ra] = walker.userData.arms; let n = 0;
        await Promise.all([step('Il répare un appareil avec ses outils.', 'astronaute'), tw(2.4, (k) => { ra.rotation.z = 1.4 + Math.sin(k * 30) * 0.25; if (++n % 5 === 0) fx.fire(wp(ra, 0.0), new V3(0, 1, 0), 2, 1.5, 0.08); }, lin)]);
        ra.rotation.z = 0;
        await Promise.all([step('Puis il rentre dans la station.', 'sas'), floatTo(-0.1, -0.35, 0.8, 3.0), to(walker.rotation, 'z', 0, 3.0), to(walker.rotation, 'y', -Math.PI / 2, 3.0)]);
        walker.visible = false; tether.visible = false;
        await to(hatch.rotation, 'y', 0, 0.8);
        chime(); st.done = true;
      };
    })();

    /* ---- module lunaire ---- */
    (function () {
      const st = makeStation('module'), S = st.g, HIGH = 12;
      const m = grp(S, 0, 0.02, 0); st.m = m;
      const desc = grp(m, 0, 1.2, 0);
      cylY(desc, 1.15, 0.9, SM.gold, 0, 0, 0, 8); cylY(desc, 1.18, 0.08, SM.black, 0, 0.46, 0, 8);
      add(desc, bell(0.35, 0.5), SM.grey, 0, -0.45, 0);
      const legs = [0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a); const lg = grp(desc);
        rod(lg, new V3(c * 0.95, 0.2, s * 0.95), new V3(c * 1.9, -1.05, s * 1.9), 0.05, SM.silver); rod(lg, new V3(c * 1.1, -0.35, s * 1.1), new V3(c * 1.8, -0.95, s * 1.8), 0.035, SM.silver);
        cylY(lg, 0.28, 0.06, SM.silver, c * 1.95, -1.15, s * 1.95, 14); return lg; });
      const ladder = grp(desc); rail(ladder, [[1.35, -0.1, 0.25], [1.9, -1.0, 0.25]], 0.025, SM.silver); rail(ladder, [[1.35, -0.1, -0.25], [1.9, -1.0, -0.25]], 0.025, SM.silver);
      for (let t = 0.1; t < 1; t += 0.18) rod(ladder, new V3(1.35 + t * 0.55, -0.1 - t * 0.9, 0.25), new V3(1.35 + t * 0.55, -0.1 - t * 0.9, -0.25), 0.02, SM.silver);
      const asc = grp(m, 0, 1.65, 0);
      ext(asc, [[-0.9, 0], [0.9, 0], [1.0, 0.6], [0.5, 1.2], [-0.6, 1.2], [-1.0, 0.7]], 0.08, 1.7, SM.silver, 0, 0, 0, 0.04);
      [[0.75, 0.75, 0.35], [0.75, 0.75, -0.35]].forEach(([x, y, z]) => { const w = box(asc, 0.05, 0.28, 0.22, SM.black, x + 0.18, y, z); w.rotation.z = -0.6; });
      rbox(asc, 0.4, 0.6, 0.5, 0.05, SM.off, 1.0, 0.3, 0, 0.02); rod(asc, new V3(-0.3, 1.2, 0.3), new V3(-0.3, 1.8, 0.5), 0.02, SM.grey); cylY(asc, 0.18, 0.04, SM.white, -0.3, 1.82, 0.5, 12);
      [[0.9, 0.9], [0.9, -0.9], [-0.9, 0.9], [-0.9, -0.9]].forEach(([x, z]) => rbox(asc, 0.15, 0.15, 0.15, 0.03, SM.grey, x, 0.9, z, 0.02));
      const ascN = anchor(asc, 0, -0.1, 0), descN = anchor(desc, 0, -0.95, 0);
      const astro = astronaut(m, 1.1, 1.35, 0); astro.visible = false;
      const flag = grp(S, 3.4, 0, 1.4); rod(flag, new V3(0, 0, 0), new V3(0, 1.8, 0), 0.025, SM.silver); rod(flag, new V3(0, 1.78, 0), new V3(0, 1.78, 0.9), 0.015, SM.silver);
      const fm = add(flag, new THREE.PlaneGeometry(0.9, 0.56), toonMat({ map: flagTex(), side: THREE.DoubleSide }), 0, 1.5, 0.45); fm.rotation.y = Math.PI / 2; flag.visible = false;
      const saved = save([m, desc, asc, astro]);
      part(st, 'moteur', 'le moteur', anchor(desc, 0, -0.6, 1.1), false);
      part(st, 'pattes', 'les pattes', anchor(legs[0], 1.4, -0.5, 1.4), true);
      part(st, 'astronaute', "l'astronaute", anchor(astro, 0, 1.6, 0), false);
      part(st, 'cabine', 'la cabine', anchor(asc, 0, 1.6, 0), true);
      part(st, 'drapeau', 'le drapeau', anchor(flag, 0, 2.1, 0.4), false);
      st.focusAt = anchor(m, 0.8, 1, 0); st.size = { w: 9, h: 9 }; st.tagAt = anchor(m, 0, 4, 0);
      st.update = () => {
        if (st.descBurn) { const p = wp(descN); for (let i = 0; i < 2; i++) fx.fire(p, DOWN, 5, 0.6, rnd(0.18, 0.3)); if (m.position.y < 2) { const a = rnd(0, 6.28); fx.smoke(new V3(p.x + Math.cos(a) * 0.5, 0.2, p.z + Math.sin(a) * 0.5), new V3(Math.cos(a) * 4, 0.3, Math.sin(a) * 4), 0.5, 0xc8cad6, 1.2); } }
        if (st.ascBurn) { const p = wp(ascN); for (let i = 0; i < 2; i++) fx.fire(p, DOWN, 5, 0.5, rnd(0.15, 0.25)); }
      };
      st.action = async function () {
        if (st.done) { restore(saved); astro.visible = false; flag.visible = false; st.done = false; }
        await Promise.all([step('Le module arrive au-dessus de la Lune.', 'cabine'), tw(1.2, (k) => (m.position.y = 0.02 + (HIGH - 0.02) * k), easeSine)]);
        engineOn(70); st.descBurn = true;
        await Promise.all([step('Le module descend tout doucement. Son moteur freine.', 'moteur'), to(m.position, 'y', 0.02, 6, (k) => 1 - Math.pow(1 - k, 2.2))]);
        st.descBurn = false; engineOff(); thud();
        await Promise.all([step('Ses pattes se posent sur la Lune, et amortissent le choc.', 'pattes'), tw(0.6, (k) => (m.position.y = 0.02 - Math.sin(k * Math.PI) * 0.1), lin)]);
        astro.visible = true; astro.position.set(1.1, 1.35, 0);
        await Promise.all([step("L'astronaute descend l'échelle.", 'astronaute'), tw(2.2, (k) => { astro.position.x = 1.1 + k * 0.85; astro.position.y = 1.35 - k * 1.35; }, lin)]);
        await tw(2.0, (k) => { astro.position.x = 1.95 + k * 1.3; astro.position.z = k * 1.0; astro.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.35; }, lin);
        flag.visible = true; pop(flag, 0.6);
        await step('Il plante un drapeau. Sur la Lune, on rebondit en marchant !', 'drapeau');
        await tw(1.6, (k) => { astro.position.x = 3.25 - k * 1.3; astro.position.z = 1 - k; astro.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.35; }, lin);
        astro.visible = false;
        engineOn(70); st.ascBurn = true;
        await Promise.all([step('Pour repartir, le haut décolle. Le bas reste sur la Lune.', 'cabine'), to(asc.position, 'y', 16, 4.5, easeIn)]);
        st.ascBurn = false; asc.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- bus des astronautes ---- */
    (function () {
      const st = makeStation('bus'), S = st.g, END = 15;
      // the crew building on the left of the road
      const hq = grp(S, -0.5, 0, -6.2); rbox(hq, 5.2, 3.2, 3.6, 0.1, SM.white, 0, 1.6, 0, 0.02); rbox(hq, 5.4, 0.25, 3.8, 0.05, SM.panel, 0, 3.3, 0, 0.02);
      for (let x = -1.8; x <= 1.8; x += 1.2) box(hq, 0.8, 0.7, 0.05, MT.glassD, x, 2.2, 1.81); box(hq, 1.2, 2.0, 0.06, MT.glassD, 0, 1.0, 1.82); rbox(hq, 1.8, 0.1, 0.9, 0.03, SM.panel, 0, 2.3, 2.2, 0.01);
      shadows(hq);
      // the silver van
      const m = grp(S, 0, 0, 0); st.m = m; st.lastX = 0;
      ext(m, [[-2.3, 0.45], [2.2, 0.45], [2.36, 0.7], [2.32, 1.3], [1.95, 2.12], [-2.25, 2.22], [-2.35, 1.6]], [0.08, 0.12, 0.12, 0.25, 0.3, 0.25, 0.12], 1.85, SM.silver, 0, 0, 0, 0.04);
      { const ws = rbox(m, 0.04, 0.72, 1.55, 0.1, MT.glassD, 2.16, 1.72, 0, 0.01); ws.rotation.z = -0.62; }
      [1, -1].forEach((s) => {
        rbox(m, 3.3, 0.48, 0.04, 0.1, MT.glassD, -0.45, 1.68, s * 0.93, 0.01); for (let x = -1.65; x <= 0.8; x += 0.82) box(m, 0.08, 0.5, 0.05, SM.silver, x, 1.68, s * 0.94); // windows + pillars
        rbox(m, 0.5, 0.45, 0.04, 0.08, MT.glassD, 1.65, 1.62, s * 0.93, 0.01);
        rbox(m, 4.5, 0.14, 0.04, 0.03, SM.panel, 0, 1.2, s * 0.94, 0.01); for (let y = 0.65; y < 1.1; y += 0.14) box(m, 4.4, 0.02, 0.04, SM.off, -0.05, y, s * 0.935); // blue band, ribs
        rod(m, new V3(2.05, 1.5, s * 0.9), new V3(2.3, 1.6, s * 1.12), 0.02, MT.black); rbox(m, 0.06, 0.32, 0.16, 0.03, MT.black, 2.32, 1.5, s * 1.14, 0.01); // mirrors
      });
      [0.6, -0.6].forEach((z) => { rbox(m, 0.05, 0.14, 0.26, 0.04, MT.lamp, 2.36, 0.9, z, 0.01); rbox(m, 0.05, 0.14, 0.2, 0.03, MT.tail, -2.36, 1.0, z, 0.01); });
      for (let i = 0; i < 4; i++) box(m, 0.03, 0.04, 0.8, MT.chrome, 2.37, 0.72 + i * 0.07, 0); // grille
      [2.4, -2.38].forEach((x) => rbox(m, 0.12, 0.2, 1.9, 0.05, MT.chrome, x, 0.5, 0, 0.02)); // bumpers
      [0.5, -0.5].forEach((z) => rbox(m, 0.16, 0.08, 0.3, 0.03, MT.amber, 1.6, 2.2, z, 0.01)); rbox(m, 0.05, 0.6, 1.2, 0.06, MT.glassD, -2.33, 1.7, 0, 0.01);
      const door = grp(m, 0.9, 0, -0.95); rbox(door, 0.9, 1.4, 0.05, 0.05, SM.off, 0, 1.3, 0, 0.01);
      st.wheels = [[1.5, 1], [1.5, -1], [-1.5, 1], [-1.5, -1]].map(([x, s]) => tire(m, 0.42, 0.28, x, 0.42, s * 0.82, MT.grey, s));
      operator(m, 1.5, 0.75, 0.4).scale.setScalar(0.85);
      const home = [[-0.6, -4.2], [0.2, -4.5], [1.0, -4.2]];
      const crew = home.map(([x, z]) => { const a = astronaut(S, x, 0, z, 0.9); a.rotation.y = Math.PI / 2; a.visible = false; shadows(a); return a; });
      part(st, 'bus', 'le bus', anchor(m, 0, 2.6, 0), true);
      part(st, 'astronautes', 'les astronautes', anchor(S, 0.2, 1.6, -3.4), false);
      part(st, 'porte', 'la porte', anchor(door, 0, 1.9, -0.1), false);
      part(st, 'batiment', 'le bâtiment des astronautes', anchor(hq, 0, 3.6, 1), true);
      st.focusAt = anchor(m, 0, 1.4, -2); st.size = { w: 12, h: 8 }; st.tagAt = anchor(m, 0, 3.4, 0);
      st.update = (dt) => roll(st, dt);
      const walk = (a, x0, z0, x1, z1, d) => { a.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); return tw(d, (k) => { a.position.set(x0 + (x1 - x0) * k, Math.abs(Math.sin(k * Math.PI * 6)) * 0.05, z0 + (z1 - z0) * k); a.userData.arms[0].rotation.z = Math.sin(k * 20) * 0.4; a.userData.arms[1].rotation.z = -Math.sin(k * 20) * 0.4; }, lin); };
      st.action = async function () {
        if (st.done) { st.reversing = true; st.beepT = 0; await Promise.all([step('Le bus rentre au bâtiment.', 'bus'), to(m.position, 'x', 0, 3)]); st.reversing = false; st.done = false; }
        engineOn(80);
        crew.forEach((a, i) => { a.visible = true; a.scale.setScalar(0.9); a.position.set(home[i][0], 0, home[i][1]); });
        await Promise.all([step('Les astronautes sortent, dans leurs grosses combinaisons.', 'astronautes'), to(door.position, 'x', 0.1, 0.8),
          ...crew.map((a, i) => sleep(i * 0.4).then(() => walk(a, home[i][0], home[i][1], 0.9, -1.2, 1.6)).then(() => (a.visible = false)))]);
        await Promise.all([step('Ils montent dans le bus. On ferme la porte.', 'porte'), to(door.position, 'x', 0.9, 0.8)]);
        await Promise.all([step("Le bus les emmène jusqu'au pied de la fusée.", 'bus'), to(m.position, 'x', END, 6, easeSine)]);
        await to(door.position, 'x', 0.1, 0.6);
        await Promise.all([step("Ils marchent jusqu'à la tour de lancement...", 'astronautes'),
          ...crew.map((a, i) => sleep(i * 0.45).then(() => { a.visible = true; return walk(a, END + 0.9, -1.2, END + 3.2 + i * 0.6, -6.2 - i * 0.3, 2.2); }))]);
        await Promise.all([step("...et un ascenseur les monte tout en haut. Bon voyage !", 'astronautes'), tw(1.2, (k) => crew.forEach((a) => (a.position.y = k * 2.5)), easeIn).then(() => tw(0.5, (k) => crew.forEach((a) => a.scale.setScalar(Math.max(0.01, 0.9 * (1 - k))))))]);
        crew.forEach((a) => (a.visible = false)); await to(door.position, 'x', 0.9, 0.6);
        chime(); st.done = true;
      };
    })();

    /* ---- capsule ---- */
    (function () {
      const st = makeStation('capsule'), S = st.g, HIGH = 32;
      const pad = add(S, new THREE.CircleGeometry(3.4, 32), 0xd6d2e6, 0, 0.04, 0); pad.rotation.x = -Math.PI / 2;
      const ring = add(S, new THREE.RingGeometry(2.2, 2.5, 32), 0xf26a2a, 0, 0.05, 0); ring.rotation.x = -Math.PI / 2;
      const m = grp(S, 0, HIGH, 0); st.m = m; m.visible = false;
      const body = grp(m);
      add(body, new THREE.CylinderGeometry(0.75, 1.45, 1.7, 24), SM.white, 0, 1.0, 0); cylY(body, 1.48, 0.25, SM.black, 0, 0.1, 0, 24);
      cylY(body, 0.55, 0.3, SM.grey, 0, 1.95, 0, 18);
      const hotM = std(0x3a2a2a, 0.6, 0, { emissive: 0xff5a1a, emissiveIntensity: 0 }); const shield = cylY(body, 1.46, 0.1, hotM, 0, -0.04, 0, 24);
      const hatch = grp(body, 0, 1.2, 0.9); hatch.rotation.x = -0.45; const hd = cylZ(hatch, 0.35, 0.08, SM.off, 0, 0, 0.05, 16);
      [[0.5, 1.5], [-0.5, 1.5]].forEach(([x, y]) => { const w = cylZ(body, 0.13, 0.05, MT.glassD, x, y, 0.85, 12); w.rotation.x = -0.4; });
      // three parachutes
      const chutes = [-1.6, 0, 1.6].map((x, i) => {
        const g = grp(m, x * 0.6, 2.2, (i - 1) * 0.6); const dome = add(g, new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), i === 1 ? SM.chute2 : SM.chute, x, 7.0, 0);
        dome.material = dome.material.clone(); dome.material.side = THREE.DoubleSide; dome.scale.y = 0.7;
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; rod(g, new V3(0, 0, 0), new V3(x + Math.cos(a) * 1.5, 7.0, Math.sin(a) * 1.5), 0.012, SM.black, 3); }
        g.visible = false; return g;
      });
      const astro = astronaut(S, 1.6, 0, 1.2, 0.9); astro.visible = false; astro.rotation.y = -Math.PI / 4;
      const bottom = anchor(m, 0, -0.1, 0);
      part(st, 'capsule', 'la capsule', anchor(m, 0, 2.6, 0), false);
      part(st, 'bouclier', 'le bouclier', anchor(m, 1.2, -0.1, 0.6), false);
      part(st, 'parachutes', 'les parachutes', anchor(m, 0, 9.4, 0), false);
      part(st, 'zone', "la zone d'atterrissage", anchor(S, 2.6, 0.4, 2), true);
      st.focusAt = anchor(m, 0, 3, 0); st.size = { w: 12, h: 13 }; st.tagAt = anchor(S, 0, 3, 0);
      st.update = () => {
        if (st.hot) { const p = wp(bottom); for (let i = 0; i < 4; i++) fx.fire(p, new V3(0, 1, 0), 6, 1.6, rnd(0.3, 0.6)); }
        if (st.retro) { const p = wp(bottom); for (let i = 0; i < 3; i++) fx.fire(p, DOWN, 6, 1.2, rnd(0.2, 0.35)); if (m.position.y < 2.5) groundSmoke(S.getWorldPosition(new V3()), 1); }
      };
      st.action = async function () {
        if (st.done) { m.visible = false; astro.visible = false; chutes.forEach((c) => { c.visible = false; c.scale.set(1, 1, 1); c.position.y = 2.2; }); hatch.rotation.x = -0.45; st.done = false; }
        m.position.set(0, HIGH, 0); m.rotation.set(0, 0, 0.25); m.visible = true;
        engineOn(130); st.hot = true;
        await Promise.all([step("Une capsule revient de l'espace. Elle chauffe très fort en traversant l'air !", 'bouclier'),
          to(m.position, 'y', 13, 4.2, lin), to(m.rotation, 'z', 0, 4.2), tw(4.2, (k) => (hotM.emissiveIntensity = Math.sin(k * Math.PI) * 1.6), lin)]);
        st.hot = false; engineOff();
        chutes.forEach((c) => { c.visible = true; c.scale.set(0.05, 0.05, 0.05); });
        await Promise.all([step("Pouf ! Les parachutes s'ouvrent pour la freiner.", 'parachutes'), ...chutes.map((c, i) => sleep(i * 0.2).then(() => tw(0.8, (k) => c.scale.setScalar(Math.max(0.05, k)), easeBack)))]);
        await Promise.all([step('Elle descend tout doucement en se balançant.', 'capsule'), to(m.position, 'y', 1.6, 6, lin), tw(6, (k) => (m.rotation.z = Math.sin(k * Math.PI * 4) * 0.06), lin)]);
        engineOn(90); st.retro = true;
        await Promise.all([step('Juste avant le sol, des petites fusées freinent encore.', 'capsule'), to(m.position, 'y', 0.02, 1.2, (k) => 1 - Math.pow(1 - k, 2))]);
        st.retro = false; engineOff(); thud();
        await Promise.all(chutes.map((c) => tw(1.2, (k) => { c.scale.y = Math.max(0.05, 1 - k); c.position.y = 2.2 - k * 1.8; })));
        chutes.forEach((c) => (c.visible = false));
        await to(hatch.rotation, 'x', -2.2, 0.9);
        astro.visible = true; pop(astro, 0.5);
        await Promise.all([step('Atterrissage réussi ! Les astronautes sont de retour sur Terre.', 'capsule'), tw(2, (k) => (astro.userData.arms[0].rotation.x = -1.8 - Math.sin(k * 20) * 0.5), lin)]);
        chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the base around the machines ================= */
function atQ(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
function buildBase(scene, onUpdate) {
  // the Earth, big in the sky behind the base
  { const [x, z] = Q(0, -78); const e = sph(scene, 9, std(0x3a7bd8, 0.6, 0), x, 30, z); const land = sph(scene, 9.1, std(0x5aa85a, 0.8, 0), x, 30, z); land.scale.set(9.1, 6.2, 7.4);
    const cl = sph(scene, 9.3, std(0xffffff, 0.9, 0, { transparent: true, opacity: 0.55 }), x, 30, z); cl.scale.set(9.3, 3.2, 9.3);
    land.userData.dynamic = cl.userData.dynamic = true; onUpdate((dt) => { land.rotation.y += dt * 0.04; cl.rotation.y += dt * 0.06; }); }
  // mission control: glass front, dish on the roof
  { const g = atQ(scene, 10.5, -1); rbox(g, 7, 3.6, 5, 0.12, SM.off, 0, 1.8, 0, 0.02); box(g, 6, 1.8, 0.06, MT.glassD, 0, 2.2, 2.52); rbox(g, 7.4, 0.3, 5.4, 0.05, SM.panel, 0, 3.75, 0, 0.02);
    rbox(g, 2, 0.12, 1.2, 0.03, SM.white, 0, 3.9, 2.4, 0.01); const hd = grp(g, -2.2, 4.6, -1); const d = add(hd, new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), SM.white); d.material = SM.white.clone(); d.material.side = THREE.DoubleSide; d.rotation.x = -0.8; cylY(g, 0.12, 0.8, SM.grey, -2.2, 4.2, -1, 8);
    cylY(g, 0.05, 2.2, SM.grey, 2.6, 4.9, -1.6, 6); sph(g, 0.1, MT.tail, 2.6, 6.05, -1.6); hd.userData.dynamic = true; shadows(g); onUpdate((dt) => (hd.rotation.y += dt * 0.2)); }
  // big dish antenna and fuel spheres
  { const g = atQ(scene, 14, -25); cylY(g, 0.35, 3, SM.grey, 0, 1.5, 0, 10); const hd = grp(g, 0, 3.2, 0); const d = add(hd, new THREE.SphereGeometry(2.6, 22, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), SM.white); d.material = SM.white.clone(); d.material.side = THREE.DoubleSide; d.rotation.x = -0.9; rod(hd, new V3(0, 0, 0), new V3(0, 1.5, 1.2), 0.05, SM.grey); hd.userData.dynamic = true; shadows(g); onUpdate((dt) => (hd.rotation.y += dt * 0.12)); }
  [[-17, -29], [-14, -32]].forEach(([h, d]) => { const g = atQ(scene, h, d); sph(g, 1.3, SM.white, 0, 2.1, 0); [0, 1, 2, 3].forEach((k) => rod(g, new V3(Math.cos(k * 1.57) * 0.8, 0, Math.sin(k * 1.57) * 0.8), new V3(Math.cos(k * 1.57) * 0.7, 1.6, Math.sin(k * 1.57) * 0.7), 0.07, SM.grey)); shadows(g); });
  // lamps along the roads
  [[4, -6, 0], [17, -4, Math.PI], [4, 4, 0], [-2.6, -16, 0], [-2.6, -8, 0], [-8, -9, Math.PI / 2], [-20, -9, Math.PI / 2]].forEach(([h, d, r]) => { const [x, z] = Q(h, d); lamp(scene, x, z, YAW + r); });
  // the Moon area: craters and grey rocks
  [[20, 18, 2.0], [26, 22, 1.4], [15, 13, 1.1], [24, 12, 0.9], [14, 23, 1.2]].forEach(([h, d, r]) => {
    const [x, z] = Q(h, d); const ring = add(scene, new THREE.TorusGeometry(r, r * 0.22, 6, 20), SM.moonRock, x, 0.05, z); ring.rotation.x = Math.PI / 2; ring.scale.z = 0.5;
    const hole = add(scene, new THREE.CircleGeometry(r * 0.85, 18), 0xb8bac6, x, 0.03, z); hole.rotation.x = -Math.PI / 2; });
  instanced(scene, ICO, 60, (i, d) => { const a = rnd(0, 6.28), r = rnd(4, 11); const [x, z] = Q(20 + Math.cos(a) * r, 18 + Math.sin(a) * r); d.position.set(x, 0.1, z); d.scale.setScalar(rnd(0.2, 0.6)); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); return pick([0xa8aab6, 0x8e909c, 0xc2c4d0]); });
  // the Mars area: red rocks, little hills, a dome for the explorers
  instanced(scene, ICO, 90, (i, d) => { const a = rnd(0, 6.28), r = rnd(5, 12); const [x, z] = Q(-22 + Math.cos(a) * r, 18 + Math.sin(a) * r); d.position.set(x, 0.1, z); d.scale.set(rnd(0.2, 0.7), rnd(0.15, 0.5), rnd(0.2, 0.7)); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); return pick([0x9a4a2a, 0xb85a32, 0x7a3a22]); });
  [[-30, 12, 2.6], [-14, 27, 2.0], [-28, 26, 1.8]].forEach(([h, d, r]) => { const [x, z] = Q(h, d); add(scene, new THREE.ConeGeometry(r, r * 0.8, 10), SM.mars, x, r * 0.4, z); });
  { const g = atQ(scene, -31, 20); const dm = add(g, new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xdfe8ff, 0.1, 0.1, { transparent: true, opacity: 0.55 })); dm.castShadow = false;
    rbox(g, 1.2, 1.4, 1.0, 0.1, SM.off, 0, 0.7, 0, 0.02); sph(g, 0.5, std(0x5ab05a, 0.8, 0), -1, 0.4, 0.6); sph(g, 0.4, std(0x4c9a4a, 0.8, 0), 0.9, 0.35, -0.8); rbox(g, 1.2, 1.2, 1.6, 0.2, SM.off, 0, 0.6, 3.0, 0.02); shadows(g); }
  // the crew who waves at visitors
  const crew = [[6, 11.5], [7.2, 10.5], [5, 12.6]].map(([h, d]) => { const [x, z] = Q(h, d); const a = astronaut(scene, x, 0, z, 1.1); a.rotation.y = -Math.PI / 4; a.userData.dynamic = true; shadows(a); return a; });
  { let T = 0; onUpdate((dt) => { T += dt; crew.forEach((a, i) => { const [r, l] = a.userData.arms; r.rotation.x = -(1.9 + Math.sin(T * 6 + i * 2) * 0.5) * (i === 1 ? 0.15 : 1); l.rotation.x = i === 1 ? 2.2 + Math.sin(T * 6) * 0.5 : 0.15; }); }); }
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const loop = R([[5, -8], [16, -8], [16, 6], [5, 6]], 0.15);
  const cars = [miniCar(scene, 'truck', 0xf2f2f6), miniCar(scene, 'kei', 0xf2f2f6), miniCar(scene, 'van', 0x2f5fd0)]; all.push(...cars);
  const t1 = traffic(loop, cars, 3, { gap: 4 });
  const walkLoop = R([[-12, 4], [-4, 4], [-4, 9], [-12, 9]], 0.2);
  const spacemen = [0, 1, 2].map(() => { const a = astronaut(scene, 0, 0, 0, 0.95); a.userData.walk = (ph) => { a.userData.arms[0].rotation.z = Math.sin(ph) * 0.4; a.userData.arms[1].rotation.z = -Math.sin(ph) * 0.4; a.children.forEach(() => {}); }; shadows(a); return a; });
  const techs = [0, 1].map(() => walker(scene, 0, 0, { top: 0xf2f2f6, bottom: 0x2a3550 }));
  all.push(...spacemen, ...techs);
  const t2 = traffic(walkLoop, [...spacemen, ...techs], 0.9, { gap: 1.2 });
  onUpdate((dt) => { t1.update(dt, all); t2.update(dt, all); });
}
