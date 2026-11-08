// La Base militaire — tanks, a bridge-laying tank, an amphibious vehicle, a helicopter, a drone, a fighter and a big transport plane.
// No fighting here: the machines show how they move, cross obstacles, fly and carry things.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { trackUnit, tire, operator, beacon } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp, autumnTree } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { fighter, transport, helicopter, AM } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const KM = {
  olive: std(0x5f6e3a, 0.6, 0.1), oliveD: std(0x46522a, 0.6, 0.1), sand: std(0xc8b07a, 0.7, 0), dark: std(0x2a2f2a, 0.6, 0.1), grey: std(0x8f96a6, 0.5, 0.3),
  white: std(0xf4f5f8, 0.4, 0.1), red: std(0xd8302a, 0.4, 0.1), blue: std(0x2f4fa8, 0.4, 0.1), glass: MT.glassD, water: std(0x3f7fd0, 0.15, 0.2),
  mud: std(0x7a5a3a, 0.9, 0), concrete: std(0xb7b9c3, 0.9, 0)
};

const DATA = {
  char: { short: 'Le char', full: 'Le char', verb: 'Rouler', horn: 'horn',
    use: 'Un véhicule très costaud, qui passe partout.',
    how: 'Ses chenilles lui permettent de grimper sur les bosses et de rouler dans la boue. Sa tourelle tourne sur elle-même.' },
  pontonnier: { short: 'Le poseur de pont', full: 'Le char poseur de pont', verb: 'Poser', horn: 'horn',
    use: 'Il transporte un pont pliant, pour traverser les fossés.',
    how: "Il déplie son pont comme un livre qu'on ouvre, et le pose de l'autre côté du fossé." },
  amphibie: { short: "L'amphibie", full: 'Le véhicule amphibie', verb: 'Nager', horn: 'horn',
    use: "Il roule sur la terre... et il flotte sur l'eau !",
    how: "Sa coque est étanche comme un bateau. Dans l'eau, des hélices à l'arrière le font avancer." },
  camion: { short: 'Le camion', full: 'Le camion de transport', verb: 'Charger', horn: 'horn',
    use: 'Il transporte les soldats et le matériel.',
    how: "Il a six grosses roues motrices pour passer partout. Sa bâche protège ce qu'il transporte." },
  helico: { short: "L'hélicoptère", full: "L'hélicoptère", verb: 'Décoller', horn: 'bell',
    use: 'Il décolle tout droit, sans piste, et peut se poser presque partout.',
    how: 'Son grand rotor tourne très vite et le soulève. La petite hélice de la queue l’empêche de tourner sur lui-même.' },
  drone: { short: 'Le drone', full: 'Le drone', verb: 'Envoler', horn: 'bell',
    use: "Un petit appareil sans pilote, qui prend des photos d'en haut.",
    how: 'On le pilote de loin avec une télécommande. Ses quatre hélices le font monter et tourner.' },
  chasse: { short: "L'avion de chasse", full: "L'avion de chasse", verb: 'Décoller', horn: 'bell',
    use: "Un avion très rapide, qui peut voler plus vite que le bruit !",
    how: "Son réacteur a une post-combustion : une grande flamme qui le pousse encore plus fort au décollage." },
  transport: { short: "L'avion cargo", full: "L'avion de transport", verb: 'Décharger', horn: 'bell',
    use: 'Un très gros avion qui transporte des véhicules et du matériel.',
    how: "Sa porte arrière s'ouvre et devient une rampe : les véhicules montent et descendent dedans." }
};
const ORDER = ['char', 'pontonnier', 'amphibie', 'camion', 'helico', 'drone', 'chasse', 'transport'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const OL = '#5f6e3a', OD = '#46522a';
const ICONS = {
  char: GND + `<rect x="10" y="54" width="86" height="16" rx="8" fill="${OD}"/><circle class="s" cx="22" cy="62" r="4"/><circle class="s" cx="40" cy="62" r="4"/><circle class="s" cx="58" cy="62" r="4"/><circle class="s" cx="76" cy="62" r="4"/>
    <path d="M14 54l8-12h64l8 12z" fill="${OL}"/><path d="M34 42q2-12 18-12h14q12 0 14 12z" fill="${OL}"/><rect x="74" y="33" width="42" height="5" rx="2" fill="${OD}"/>`,
  pontonnier: GND + `<path d="M0 74h30v-8H0zM90 74h30v-8H90z" fill="#7a5a3a"/><path d="M22 60L70 14l8 6-48 46z" fill="#c8b07a"/><rect x="12" y="56" width="60" height="14" rx="7" fill="${OD}"/><path d="M14 56l6-10h46l6 10z" fill="${OL}"/>`,
  amphibie: `<path d="M0 60q30 6 60 0t60 0V80H0z" fill="#3f7fd0"/><path d="M14 58l6-20h70l12 20z" fill="${OL}"/><rect x="44" y="28" width="22" height="10" rx="3" fill="${OD}"/><circle class="k" cx="30" cy="60" r="6"/><circle class="k" cx="50" cy="60" r="6"/><circle class="k" cx="70" cy="60" r="6"/><path d="M8 56h6" stroke="#fff" stroke-width="3"/>`,
  camion: GND + `<path d="M10 24q0-8 8-8h50q8 0 8 8v32H10z" fill="#7a8a52"/><rect x="78" y="32" width="30" height="24" rx="3" fill="${OL}"/><rect class="g" x="92" y="36" width="12" height="9"/><circle class="k" cx="24" cy="62" r="9"/><circle class="k" cx="46" cy="62" r="9"/><circle class="k" cx="94" cy="62" r="9"/>`,
  helico: GND + `<path d="M8 22h104" stroke="#2a2f2a" stroke-width="4" stroke-linecap="round"/><rect x="56" y="22" width="6" height="8" fill="#2a2f2a"/><path d="M30 44q0-14 22-14h26q16 0 22 14-6 12-22 12H50q-20 0-20-12z" fill="${OL}"/><path d="M32 44L4 40v-6h6l22 4z" fill="${OL}"/><circle cx="6" cy="36" r="7" fill="none" stroke="#2a2f2a" stroke-width="2"/><path class="ln" d="M42 66h52M50 56v10M84 56v10"/>`,
  drone: `<path d="M20 40h80M60 40v-6" stroke="#3a3f50" stroke-width="5" stroke-linecap="round"/><ellipse cx="20" cy="34" rx="16" ry="3" fill="#8f96a6"/><ellipse cx="100" cy="34" rx="16" ry="3" fill="#8f96a6"/><rect x="46" y="36" width="28" height="12" rx="5" fill="#3a3f50"/><circle cx="60" cy="54" r="5" fill="#1f2a44"/><path d="M48 70h24" stroke="#d3d8ea" stroke-width="3"/>`,
  chasse: GND + `<path d="M6 46l20-4h60q20 0 30 4-10 4-30 4H26z" fill="#8a94a6"/><path d="M40 46L70 28h8L66 46zM40 46L70 64h8L66 46z" fill="#7a8494"/><path d="M14 42L6 26h8l12 16z" fill="#7a8494"/><ellipse cx="88" cy="42" rx="10" ry="3" fill="#6ab0e0"/><path d="M6 46q-10-3-6-6" stroke="#ff8a2a" stroke-width="5" fill="none"/>`,
  transport: GND + `<path d="M6 44q0-10 12-10h70q18 0 24 10-6 10-24 10H30l-24-4z" fill="#7a8a6a"/><rect x="34" y="28" width="64" height="5" rx="2" fill="#6a7a5a"/><circle cx="52" cy="38" r="3" fill="#3a4232"/><circle cx="80" cy="38" r="3" fill="#3a4232"/><path d="M10 34L4 14h10l10 20z" fill="#7a8a6a"/><path d="M6 54L-4 70" stroke="#4a5444" stroke-width="6"/><rect x="0" y="58" width="16" height="9" rx="2" fill="${OD}"/>`
};

const CFG = {
  char: CF(-30, 14), pontonnier: CF(-24, 27), amphibie: CF(-4, 20), camion: CF(14, 5.5),
  helico: CF(30, 12), drone: CF(18, 22), chasse: CF(-36, -16), transport: CF(14, -12)
};
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 3, col = '#8a8678', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
rect(0, -29, 112, 7, '#4a4c5e'); for (let h = -50; h < 50; h += 5) rect(h, -29, 2.6, 0.24, '#f3efe2');
rect(0, -18, 104, 9, '#6a6e78'); rect(0, -18, 104, 0.18, '#f2b21c');
blob(-26, 22, 15, 'rgba(140,100,60,.75)'); blob(-30, 14, 7, 'rgba(120,85,50,.6)');
blob(-4, 20, 9, 'rgba(60,110,180,.0)'); blob(30, 12, 5, 'rgba(70,74,90,.9)'); blob(18, 22, 3, 'rgba(70,74,90,.9)');
road([[-44, 0], [44, 0]], 3.2); road([[0, 0], [0, -13]], 3); road([[14, 0], [14, 40]], 3); road([[-40, 0], [-40, 36]], 2.6, '#9a7a5a', 0.8);

export default {
  id: 'militaire', title: 'La Base militaire', titleHtml: 'La Base <span>militaire</span>',
  subtitle: 'Des chars qui passent partout, un pont qui se déplie, des hélicoptères et des avions très rapides.',
  welcome: 'Bienvenue sur la base ! Touche un engin pour voir comment il marche.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la base',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="18" width="24" height="7" rx="3.5"/><path d="M6 18l3-5h12l3 5M14 13V9h5M19 11h10"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false,
  overview: { w: 90, h: 62, focus: [0, 3, 0] },
  ground: { base: ['#7c8a6a', '#5d6a50', '#3e4a38'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 180); onUpdate((dt) => fx.update(dt));
    freeze(buildBase(grp(scene)));
    const spin = (obj, wheels, R = 0.4) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || R))); return d; }; };
    const along = (obj, r, s0, s1, d, ease = easeSine, yOff = 0) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k, yOff), ease);
    const dust = (p, n = 2, col = 0xb8a07a) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.5, 0.5), 0.2, rnd(-0.5, 0.5))), new V3(rnd(-0.5, 0.5), rnd(0.4, 1), rnd(-0.5, 0.5)), rnd(0.3, 0.6), col, 1.2); };
    // a tank hull with tracks, facing +x; returns { g, tracks }
    function hull(p, L = 6.4) {
      const g = grp(p); const tracks = [trackUnit(g, { len: L * 0.78, r: 0.42, w: 0.6, z: 1.25 }), trackUnit(g, { len: L * 0.78, r: 0.42, w: 0.6, z: -1.25 })];
      ext(g, [[-L / 2, 0.55], [L / 2 - 0.6, 0.55], [L / 2 + 0.2, 0.95], [L / 2 - 0.4, 1.5], [-L / 2 + 0.2, 1.55], [-L / 2, 1.2]], 0.06, 2.2, KM.olive, 0, 0, 0, 0.03);
      [1, -1].forEach((s) => rbox(g, L * 0.9, 0.12, 0.7, 0.03, KM.oliveD, 0, 1.15, s * 1.25, 0.01));
      rbox(g, 0.5, 0.2, 1.6, 0.05, KM.dark, -L / 2 + 0.5, 1.6, 0, 0.02);
      shadows(g); return { g, tracks };
    }

    /* ---- le char : le parcours de bosses ---- */
    (function () {
      const st = makeStation('char'), S = st.g;
      const H = hull(S); const m = H.g; st.m = m; st.tracks = H.tracks; st.lastX = 0;
      const tur = grp(m, -0.3, 1.55, 0); ext(tur, [[-1.6, 0], [1.2, 0], [1.6, 0.35], [1.1, 0.8], [-1.4, 0.85], [-1.8, 0.4]], 0.08, 2.1, KM.olive, 0, 0, 0, 0.03);
      const gun = grp(tur, 1.4, 0.45, 0); cylX(gun, 0.12, 4.2, KM.oliveD, 2.1, 0, 0, 10); cylX(gun, 0.18, 0.6, KM.oliveD, 0.3, 0, 0, 10);
      const hatch = grp(tur, -0.4, 0.86, 0.45); cylY(hatch, 0.32, 0.08, KM.oliveD, 0, 0, 0, 12); const cmd = operator(tur, -0.4, 0.3, 0.45); cmd.visible = false;
      rod(tur, new V3(-1.2, 0.85, -0.5), new V3(-1.4, 2.2, -0.6), 0.02, KM.dark);
      // the course: two bumps and a mud puddle
      const bumps = [[6, 1.1, 2.6], [12.5, 0.8, 2.2]].map(([x, h, r]) => { const b = add(S, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), KM.mud, x, 0, 0); b.scale.set(r, h, 2.6); return { x, h, r }; });
      const mud = add(S, new THREE.CircleGeometry(2.2, 20), std(0x5a4028, 0.3, 0.1), 17.5, 0.03, 0); mud.rotation.x = -Math.PI / 2; mud.scale.y = 0.7;
      const ground = (x) => { let y = 0; bumps.forEach((b) => { const u = (x - b.x) / b.r; if (Math.abs(u) < 1) y = Math.max(y, b.h * Math.sqrt(1 - u * u)); }); return y; };
      part(st, 'chenilles', 'les chenilles', anchor(m, 1.8, 1.0, 1.6), true);
      part(st, 'tourelle', 'la tourelle', anchor(tur, 0, 1.0, -0.8), true);
      part(st, 'bosses', 'les bosses', anchor(S, 6, 1.8, 1.4), false);
      part(st, 'chef', 'le chef de char', anchor(tur, -0.4, 1.9, 0.45), false);
      st.focusAt = anchor(m, 1.5, 1.2, 0); st.size = { w: 15, h: 7 }; st.tagAt = anchor(m, 0, 3.4, 0);
      st.update = (dt) => {
        roll(st, dt);
        const x = m.position.x, yf = ground(x + 1.6), yb = ground(x - 1.6); m.position.y = (yf + yb) / 2; m.rotation.z = Math.atan2(yf - yb, 3.2);
        if (st.moving && Math.random() < 0.5) dust(m.localToWorld(new V3(-3, 0, rnd(-1.3, 1.3))), 1, x > 15 ? 0x5a4028 : 0xb8a07a);
      };
      st.action = async function () {
        if (st.done) { st.moving = true; engineOn(55); await Promise.all([step('Le char recule au départ.', 'chenilles'), to(m.position, 'x', 0, 4)]); st.moving = false; st.done = false; }
        engineOn(55);
        await Promise.all([step('Le chef ouvre la trappe et sort la tête.', 'chef'), to(hatch.rotation, 'x', -1.8, 0.8)]); cmd.visible = true; pop(cmd, 0.4);
        st.moving = true;
        await Promise.all([step('Les chenilles avancent. Le char grimpe sur la bosse !', 'chenilles'), to(m.position, 'x', 9.3, 4.6, easeSine)]);
        await Promise.all([step('Il passe partout, même sur les bosses et dans la boue.', 'bosses'), to(m.position, 'x', 18, 4.6, easeSine)]);
        st.moving = false;
        await Promise.all([step('Sa tourelle tourne sur elle-même, pour regarder autour.', 'tourelle'), tw(3, (k) => (tur.rotation.y = Math.sin(k * Math.PI * 2) * 1.2), easeSine)]);
        cmd.visible = false; await to(hatch.rotation, 'x', 0, 0.6);
        chime(); st.done = true;
      };
    })();

    /* ---- le poseur de pont ---- */
    (function () {
      const st = makeStation('pontonnier'), S = st.g;
      // the ditch to cross
      const DX = 7.5, DW = 4.2;
      const ditch = grp(S, DX, 0, 0); rbox(ditch, DW, 0.12, 7, 0.05, std(0x3a2a1c, 0.9, 0), 0, -0.05, 0, 0.02); add(ditch, new THREE.PlaneGeometry(DW - 0.6, 6.6), KM.water, 0, -0.02, 0).rotation.x = -Math.PI / 2;
      [DW / 2, -DW / 2].forEach((x) => rbox(ditch, 0.3, 0.5, 7, 0.1, KM.mud, x, 0.1, 0, 0.02));
      const H = hull(S); const m = H.g; st.m = m; st.tracks = H.tracks; st.lastX = 0;
      rbox(m, 1.6, 0.6, 1.8, 0.1, KM.oliveD, -1.6, 1.85, 0, 0.02); operator(m, 2.0, 1.2, 0.5).scale.setScalar(0.85);
      // folding bridge: arm pivot at the front, half A on the arm, half B hinged at A's far end
      const BL = 4.6, BT = 0.3, BW = 3.0;
      const arm = grp(m, 3.0, 1.7, 0); const A = grp(arm); const B = grp(A, -BL, 0, 0);
      const deck = (g) => { rbox(g, BL, BT, BW, 0.05, KM.sand, -BL / 2, 0, 0, 0.02); for (let x = -BL + 0.3; x < 0; x += 0.45) box(g, 0.08, 0.02, BW - 0.2, KM.oliveD, x, BT / 2 + 0.01, 0); [BW / 2, -BW / 2].forEach((z) => rbox(g, BL, 0.4, 0.12, 0.03, KM.oliveD, -BL / 2, 0.1, z, 0.01)); };
      deck(A); deck(B); B.rotation.z = Math.PI; B.position.y = BT + 0.02; // folded on top of A, pointing back
      const span = 2 * BL;
      part(st, 'pont', 'le pont pliant', anchor(A, -BL / 2, 0.6, BW / 2), true);
      part(st, 'fosse', 'le fossé', anchor(ditch, 0, 0.6, 2.6), true);
      part(st, 'bras', 'le bras', anchor(arm, 0.2, 0.4, 0.9), false);
      st.focus = new V3(5.5, 2.5, 0); st.size = { w: 17, h: 9 }; st.tagAt = anchor(m, 0, 4, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('On replie le pont pour recommencer.', 'pont'), sleep(0.3)]);
          m.attach(arm); arm.position.set(3.0, 1.7, 0); arm.rotation.set(0, 0, 0); B.rotation.z = Math.PI; B.position.set(-BL, BT + 0.02, 0); m.position.x = 0; st.lastX = 0; pop(m, 0.5); st.done = false;
        }
        engineOn(55);
        const edge = DX - DW / 2 - 0.4; // where the front of the tank stops
        await Promise.all([step('Le char poseur de pont arrive devant le fossé.', 'fosse'), to(m.position, 'x', edge - 3.4, 3.2, easeSine)]);
        await Promise.all([step('Il lève son pont plié, tout droit vers le ciel.', 'bras'), to(arm.rotation, 'z', -Math.PI / 2 - 0.0, 2.2, easeSine)]);
        await Promise.all([step('Le pont se déplie, comme un livre qu’on ouvre...', 'pont'), to(B.rotation, 'z', 0, 2.6, easeSine), to(B.position, 'y', 0, 2.6)]);
        await Promise.all([step('...et il se pose de l’autre côté du fossé.', 'fosse'), to(arm.rotation, 'z', -Math.PI, 2.6, easeSine)]);
        S.attach(arm); await to(arm.position, 'y', 0.25, 0.8); thud(); for (let i = 0; i < 6; i++) fx.smoke(S.localToWorld(new V3(DX + DW / 2 + 1, 0.3, rnd(-1.5, 1.5))), new V3(0, 0.8, 0), 0.4, 0xb8a07a, 1);
        await Promise.all([step('Le pont est posé ! Le char roule dessus pour traverser.', 'pont'),
          tw(5, (k) => { const x = (edge - 3.4) + (span + 4) * k; m.position.x = x; const onB = x + 3.0 > edge && x - 3.0 < edge + span; m.position.y = onB ? BT / 2 + 0.05 : 0; }, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- l'amphibie ---- */
    (function () {
      const st = makeStation('amphibie'), S = st.g;
      // the pond with sloped banks
      const POND = 9, PW = 6;
      const water = add(S, new THREE.CircleGeometry(1, 32), KM.water, 7, 0.04, 0); water.rotation.x = -Math.PI / 2; water.scale.set(POND / 2 + 1, PW / 2 + 1, 1);
      const bank = add(S, new THREE.RingGeometry(1, 1.2, 32), KM.mud, 7, 0.03, 0); bank.rotation.x = -Math.PI / 2; bank.scale.set(POND / 2 + 0.8, PW / 2 + 0.8, 1);
      const m = grp(S, -4, 0, 0); st.m = m; st.lastX = -4;
      ext(m, [[-3.0, 0.5], [2.4, 0.5], [3.4, 1.3], [2.8, 1.9], [-3.0, 1.9]], 0.1, 2.4, KM.olive, 0, 0, 0, 0.03);
      rbox(m, 1.6, 0.6, 1.4, 0.2, KM.oliveD, -0.4, 2.2, 0, 0.02); cylX(m, 0.07, 1.2, KM.dark, 0.9, 2.3, 0, 8);
      [1, -1].forEach((s) => box(m, 0.6, 0.3, 0.04, KM.glass, 2.4, 1.55, s * 1.12));
      st.wheels = []; [2.0, 0.6, -0.8, -2.2].forEach((x) => [1, -1].forEach((s) => st.wheels.push(tire(m, 0.48, 0.38, x, 0.48, s * 1.2, KM.oliveD, s))));
      const props = [0.6, -0.6].map((z) => { const p = grp(m, -3.1, 0.7, z); for (let k = 0; k < 3; k++) { const b = box(p, 0.04, 0.5, 0.14, KM.dark, 0, 0.2, 0); const h = grp(p); h.add(b); h.rotation.x = (k / 3) * Math.PI * 2; } return p; });
      operator(m, 1.6, 1.6, 0.5).scale.setScalar(0.8);
      const shoreA = 7 - POND / 2 - 1, shoreB = 7 + POND / 2 + 1;
      const depth = (x) => (x > shoreA - 1 && x < shoreB + 1 ? clamp(Math.min(x - (shoreA - 1), (shoreB + 1) - x) * 0.35, 0, 0.9) : 0);
      part(st, 'coque', 'la coque étanche', anchor(m, 0, 2.0, 1.3), true);
      part(st, 'helices', 'les hélices', anchor(m, -3.2, 1.2, 0.8), false);
      part(st, 'roues', 'les roues', anchor(m, 0.6, 0.5, 1.5), true);
      part(st, 'eau', "l'eau", anchor(S, 7, 0.6, 2.4), false);
      st.focusAt = anchor(m, 0, 1.2, 0); st.size = { w: 15, h: 7 }; st.tagAt = anchor(m, 0, 3.4, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; roll(st, dt); const d = depth(m.position.x);
        m.position.y = -d + (d > 0.6 ? Math.sin(T * 2) * 0.05 : 0); m.rotation.x = d > 0.6 ? Math.sin(T * 1.3) * 0.03 : 0;
        if (st.swim && d > 0.6) { props.forEach((p) => (p.rotation.x += dt * 25)); if (Math.random() < 0.6) fx.smoke(m.localToWorld(new V3(-3.3, 0.6, rnd(-0.8, 0.8))), new V3(-1.2, 0.5, 0), 0.25, 0xe8f4ff, 0.8); }
      };
      st.action = async function () {
        if (st.done) { await Promise.all([step("L'amphibie revient au départ.", 'roues'), to(m.position, 'x', -4, 4)]); st.done = false; }
        engineOn(60);
        await Promise.all([step("Le véhicule roule tout droit vers l'eau...", 'roues'), to(m.position, 'x', shoreA + 0.5, 3.4, easeIn)]);
        thud(); for (let i = 0; i < 12; i++) fx.smoke(m.localToWorld(new V3(3, 0.4, rnd(-1.2, 1.2))), new V3(rnd(0, 2), rnd(1, 2.5), rnd(-1, 1)), 0.3, 0xe8f4ff, 0.9);
        st.swim = true;
        await Promise.all([step('Plouf ! Il flotte, comme un bateau.', 'coque'), to(m.position, 'x', shoreA + 3, 2.4, easeSine)]);
        await Promise.all([step("Ses hélices, à l'arrière, le font avancer sur l'eau.", 'helices'), to(m.position, 'x', shoreB - 1, 5, lin)]);
        st.swim = false;
        await Promise.all([step("Il ressort de l'autre côté. Il sait rouler et nager !", 'eau'), to(m.position, 'x', shoreB + 3.5, 3, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le camion de transport ---- */
    (function () {
      const st = makeStation('camion'), S = st.g;
      const m = grp(S, -6, 0, 0); st.m = m; st.lastX = -6;
      [0.42, -0.42].forEach((z) => rbox(m, 7.0, 0.3, 0.16, 0.03, MT.black, -0.4, 1.05, z));
      const cab = grp(m, 2.3, 1.2, 0); rbox(cab, 1.8, 1.7, 2.3, 0.15, KM.olive, 0, 0.85, 0, 0.03); box(cab, 0.05, 0.7, 1.9, KM.glass, 0.91, 1.25, 0); [1, -1].forEach((s) => box(cab, 0.8, 0.6, 0.04, KM.glass, 0.2, 1.25, s * 1.16)); rbox(cab, 0.9, 0.9, 2.1, 0.1, KM.oliveD, 1.25, 0.3, 0, 0.02);
      operator(cab, 0.1, 0.25, 0.5).scale.setScalar(0.85);
      rbox(m, 4.8, 0.2, 2.3, 0.04, KM.oliveD, -1.6, 1.35, 0, 0.01);
      const tarp = grp(m, -1.6, 1.45, 0); const tg = new THREE.CylinderGeometry(1.15, 1.15, 4.8, 18, 1, false, -Math.PI / 2, Math.PI); tg.rotateZ(Math.PI / 2); add(tarp, tg, std(0x7a8a52, 0.8, 0), 0, 0.85, 0).scale.y = 1.1; rbox(tarp, 4.8, 0.9, 2.3, 0.05, std(0x7a8a52, 0.8, 0), 0, 0.45, 0, 0.01);
      const flap = grp(m, -4.0, 2.75, 0); rbox(flap, 0.06, 1.3, 2.2, 0.02, std(0x6a7a48, 0.8, 0), 0, -0.65, 0, 0.01);
      st.wheels = []; [2.6, -1.0, -2.6].forEach((x) => [1, -1].forEach((s) => st.wheels.push(tire(m, 0.6, 0.45, x, 0.6, s * 1.05, KM.oliveD, s))));
      // crates waiting on the right, to be loaded
      const crates = [0, 1, 2].map((i) => rbox(S, 0.9, 0.7, 0.9, 0.05, KM.sand, 3 + i * 1.1, 0.35, 3.2, 0.02));
      const home = crates.map((c) => c.position.clone());
      const sold = [0, 1].map((i) => { const p = walker(S, 2.5 + i * 2, 4.4, { top: 0x5f6e3a, bottom: 0x46522a, hat: KM.oliveD }); p.rotation.y = Math.PI / 2; return p; });
      part(st, 'roues', 'les six roues', anchor(m, -1.8, 0.7, 1.5), true);
      part(st, 'bache', 'la bâche', anchor(tarp, 0, 2.2, 0.8), true);
      part(st, 'caisses', 'les caisses', anchor(S, 4, 1.3, 3.2), false);
      part(st, 'soldats', 'les soldats', anchor(sold[0], 0, 1.5, 0), false);
      st.focusAt = anchor(m, 0, 1.4, 1.5); st.size = { w: 15, h: 7 }; st.tagAt = anchor(m, 0, 3.6, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (st.done) { m.position.x = -6; st.lastX = -6; crates.forEach((c, i) => { S.attach(c); c.position.copy(home[i]); c.rotation.set(0, 0, 0); c.visible = true; }); pop(m, 0.4); st.done = false; }
        engineOn(55);
        await Promise.all([step('Le camion arrive et se gare près des caisses.', 'roues'), to(m.position, 'x', 0, 4, easeSine)]);
        engineOff();
        await Promise.all([step('On relève la bâche, à l’arrière.', 'bache'), to(flap.rotation, 'z', -1.4, 1)]);
        await step('Les soldats chargent les caisses dans le camion.', 'soldats');
        for (const [i, c] of crates.entries()) { const p0 = c.position.clone(), p1 = new V3(-3.0 + i * 0.4, 1.9, (i - 1) * 0.7); m.updateMatrixWorld(true); const w = S.worldToLocal(m.localToWorld(p1.clone())); await tw(1.1, (k) => c.position.set(p0.x + (w.x - p0.x) * k, p0.y + (w.y - p0.y) * k + Math.sin(k * Math.PI) * 1.2, p0.z + (w.z - p0.z) * k), easeSine); m.attach(c); thud(); }
        await Promise.all([step('On ferme la bâche, et en route !', 'bache'), to(flap.rotation, 'z', 0, 0.8)]);
        engineOn(55);
        await to(m.position, 'x', 8, 4, easeIn);
        st.done = true;
      };
    })();

    /* ---- l'hélicoptère ---- */
    (function () {
      const st = makeStation('helico'), S = st.g;
      const pad = add(S, new THREE.CircleGeometry(5.2, 32), std(0x464a5a, 0.9, 0), 0, 0.04, 0); pad.rotation.x = -Math.PI / 2;
      const hb = grp(S, 0, 0.06, 0); [[-1.4, 0, 0.5, 3.6], [1.4, 0, 0.5, 3.6], [0, 0, 2.4, 0.5]].forEach(([x, z, w, d]) => box(hb, w, 0.02, d, KM.white, x, 0, z));
      const ring = add(S, new THREE.RingGeometry(4.4, 4.7, 32), std(0xf2b21c, 0.6, 0), 0, 0.05, 0); ring.rotation.x = -Math.PI / 2;
      const Hc = helicopter(S); st.m = Hc; Hc.position.x = 1.6;
      const R = Hc.userData.rotor, TR = Hc.userData.tail;
      const sky = route([[1.6, 0, 0], [16, -10, 0], [10, -24, 0], [-10, -20, 0], [-14, -6, 0], [1.6, 0, 0]], true, 0.4);
      part(st, 'rotor', 'le grand rotor', anchor(R, 2.8, 0.3, 0), true);
      part(st, 'queue', "l'hélice de la queue", anchor(TR, 0, 0.6, 0.3), false);
      part(st, 'pilote', 'le pilote', anchor(Hc, 2.6, Hc.userData.Y + 0.8, 0.9), false);
      part(st, 'helipad', 'la plateforme', anchor(S, 3.5, 0.5, 3.5), true);
      st.focusAt = anchor(Hc, 0, 1.5, 0); st.size = { w: 17, h: 9 }; st.tagAt = anchor(Hc, 0, 5.4, 0);
      operator(Hc, 2.4, Hc.userData.Y - 0.4, 0.5).scale.setScalar(0.8);
      st.update = (dt) => { R.rotation.y += dt * (st.rpm || 0); TR.rotation.z += dt * (st.rpm || 0) * 1.6; if ((st.rpm || 0) > 12 && Hc.position.y < 4) for (let i = 0; i < 2; i++) { const a = rnd(0, 6.28); fx.smoke(S.localToWorld(new V3(Hc.position.x + Math.cos(a) * 4, 0.2, Hc.position.z + Math.sin(a) * 4)), new V3(Math.cos(a) * 2, 0.3, Math.sin(a) * 2), 0.4, 0xc8c0a8, 0.8); } };
      st.action = async function () {
        engineOn(100);
        await Promise.all([step('Le grand rotor se met à tourner, de plus en plus vite.', 'rotor'), tw(3, (k) => (st.rpm = 22 * k), lin), tone(90, 0, 3, 'sawtooth', 0.02, 160)]);
        await Promise.all([step("L'hélicoptère décolle tout droit, sans piste !", 'helipad'), to(Hc.position, 'y', 8, 3.5, easeSine)]);
        await Promise.all([step("La petite hélice de la queue l'empêche de tourner sur lui-même.", 'queue'),
          tw(12, (k) => { placeOn(Hc, sky, sky.len * k); Hc.position.y = 8 + Math.sin(k * Math.PI) * 4; Hc.rotation.z = -0.12; }, lin)]);
        Hc.rotation.z = 0; Hc.rotation.y = 0; Hc.position.x = 1.6; Hc.position.z = 0;
        await Promise.all([step('Il revient, et se pose tout doucement.', 'pilote'), to(Hc.position, 'y', 0, 4, easeSine)]);
        thud();
        await tw(2.5, (k) => (st.rpm = 22 * (1 - k)), lin); st.rpm = 0; engineOff(); chime();
      };
    })();

    /* ---- le drone ---- */
    (function () {
      const st = makeStation('drone'), S = st.g;
      const pad = add(S, new THREE.CircleGeometry(1.4, 24), std(0x464a5a, 0.9, 0), 0, 0.04, 0); pad.rotation.x = -Math.PI / 2;
      const D = grp(S); st.m = D;
      rbox(D, 0.8, 0.3, 0.5, 0.1, std(0x3a3f50, 0.5, 0.2), 0, 0.45, 0, 0.02); sph(D, 0.13, AM.win, 0.3, 0.25, 0);
      const props = [];
      [[0.6, 0.6], [0.6, -0.6], [-0.6, 0.6], [-0.6, -0.6]].forEach(([x, z]) => { rod(D, new V3(0, 0.5, 0), new V3(x, 0.55, z), 0.04, std(0x3a3f50, 0.5, 0.2)); cylY(D, 0.08, 0.12, KM.dark, x, 0.6, z, 8); const p = grp(D, x, 0.68, z); box(p, 0.7, 0.02, 0.07, KM.grey, 0, 0, 0); props.push(p); rod(D, new V3(x * 0.6, 0.35, z * 0.6), new V3(x * 0.6, 0.05, z * 0.6), 0.02, KM.dark); });
      const pilot = walker(S, -2.6, 1.6, { top: 0x5f6e3a, bottom: 0x46522a, hat: KM.oliveD }); pilot.rotation.y = 0.4;
      rbox(pilot, 0.3, 0.2, 0.2, 0.04, KM.dark, 0.35, 0.85, 0, 0.02);
      const tour = route([[0, 0], [6, -4], [4, -12], [-6, -10], [-7, -2], [0, 0]], true, 0.5);
      const cam = anchor(D, 0.3, 0.2, 0);
      part(st, 'helices', 'les quatre hélices', anchor(D, 0.6, 0.9, 0.6), true);
      part(st, 'camera', 'la caméra', cam, false);
      part(st, 'pilote', 'le pilote et sa télécommande', anchor(pilot, 0, 1.6, 0), true);
      st.focusAt = anchor(D, 0, 0, 0); st.size = { w: 11, h: 8 }; st.tagAt = anchor(D, 0, 2.2, 0);
      st.update = (dt) => props.forEach((p, i) => (p.rotation.y += dt * (st.rpm || 0) * (i % 2 ? 1 : -1)));
      st.action = async function () {
        st.rpm = 40; tone(420, 0, 2, 'sawtooth', 0.012, 480);
        await Promise.all([step('Le pilote allume le drone avec sa télécommande.', 'pilote'), sleep(1.2)]);
        await Promise.all([step('Ses quatre hélices le font monter tout droit.', 'helices'), to(D.position, 'y', 6, 3, easeSine)]);
        await Promise.all([step('Il vole au-dessus de la base, et sa caméra prend des photos.', 'camera'),
          tw(10, (k) => { placeOn(D, tour, tour.len * k, 6 + Math.sin(k * Math.PI * 2) * 1.2); D.rotation.z = -0.15; if (Math.random() < 0.02) ding(); }, lin)]);
        D.rotation.set(0, 0, 0); D.position.set(0, 6, 0);
        await Promise.all([step('Il revient se poser sur sa petite plateforme.', 'pilote'), to(D.position, 'y', 0, 3, easeSine)]);
        st.rpm = 0; chime();
      };
    })();

    /* ---- l'avion de chasse ---- */
    (function () {
      const st = makeStation('chasse'), S = st.g;
      // its shelter
      const sh = grp(S, -1, 0, 0); const sg = new THREE.CylinderGeometry(5, 5, 9, 24, 1, true, -Math.PI / 2, Math.PI); sg.rotateZ(Math.PI / 2); add(sh, sg, std(0x8a8e7a, 0.8, 0, { side: THREE.DoubleSide }), -1, 0, 0).scale.set(1, 1, 1.15);
      const F = fighter(S); st.m = F;
      const taxi = route([[0, 0], [8, 0], [13, -4], [16, -10], [22, -13], [30, -13]], false, 0.4); placeOn(F, taxi, 0);
      const RW = route([[30, -13], [140, -13]], false, 0);
      const wheels = F.userData.gear.flatMap((g) => g.children.filter((c) => c.userData && c.userData.r)); const spinW = spin(F, wheels, 0.3);
      part(st, 'reacteur', 'le réacteur', anchor(F, -5.2, F.userData.Y + 0.8, 0), true);
      part(st, 'cockpit', 'le cockpit', anchor(F, 2.6, F.userData.Y + 1.0, 0), true);
      part(st, 'ailes', 'les ailes en triangle', anchor(F, -3, F.userData.Y, 3.6), false);
      part(st, 'abri', "l'abri", anchor(sh, -1, 5.4, 2), false);
      st.focusAt = anchor(F, 0, 1.4, 0); st.size = { w: 20, h: 9 }; st.tagAt = anchor(F, 0, 4, 0);
      st.update = () => { spinW(); if (st.ab) { const p = wp(F.userData.nozzle); for (let i = 0; i < 3; i++) fx.fire(p, new V3(-Math.cos(F.rotation.y), 0, Math.sin(F.rotation.y)), 8, 0.4, rnd(0.3, 0.55)); } };
      st.action = async function () {
        if (st.done) { F.visible = true; F.rotation.set(0, 0, 0); F.userData.gear.forEach((g) => (g.scale.y = 1)); placeOn(F, taxi, 0); F.position.y = 0; pop(F, 0.6); st.done = false; await sleep(0.6); }
        engineOn(140);
        await Promise.all([step("L'avion de chasse sort de son abri, et roule vers la piste.", 'abri'), along(F, taxi, 0, taxi.len, 6, easeSine)]);
        st.ab = true; F.userData.burner.emissiveIntensity = 3;
        await Promise.all([step('Post-combustion ! Une grande flamme sort du réacteur.', 'reacteur'), tone(80, 0, 2, 'sawtooth', 0.04, 220), sleep(1.6)]);
        await Promise.all([step('Il fonce sur la piste, très, très vite...', 'ailes'), tw(3, (k) => placeOn(F, RW, 34 * k * k), lin)]);
        await Promise.all([step('...et il décolle en montant tout droit dans le ciel !', 'cockpit'),
          tw(1, (k) => F.userData.gear.forEach((g) => (g.scale.y = Math.max(0.01, 1 - k)))),
          tw(4, (k) => { placeOn(F, RW, 34 + 40 * k); F.position.y = 30 * k * k; F.rotation.z = Math.min(0.7, k * 1.4); }, lin)]);
        st.ab = false; F.userData.burner.emissiveIntensity = 0; engineOff(); F.visible = false; st.done = true;
      };
    })();

    /* ---- l'avion de transport ---- */
    (function () {
      const st = makeStation('transport'), S = st.g;
      const P = transport(S); st.m = P; const ramp = P.userData.ramp;
      // a small vehicle inside, that drives out down the ramp
      const jeep = grp(S); rbox(jeep, 2.6, 0.7, 1.5, 0.15, KM.olive, 0, 0.75, 0, 0.02); rbox(jeep, 1.0, 0.6, 1.4, 0.1, KM.oliveD, -0.4, 1.35, 0, 0.02); box(jeep, 0.05, 0.4, 1.2, KM.glass, 0.4, 1.4, 0);
      const jw = []; [[0.9, 1], [0.9, -1], [-0.9, 1], [-0.9, -1]].forEach(([x, s]) => jw.push(tire(jeep, 0.36, 0.26, x, 0.36, s * 0.75, KM.oliveD, s))); operator(jeep, 0, 0.9, 0.35).scale.setScalar(0.75);
      const IN = new V3(-2, P.userData.Y - 1.35, 0); jeep.position.copy(IN); jeep.rotation.y = Math.PI; jeep.visible = false;
      const spinJ = spin(jeep, jw, 0.36);
      part(st, 'rampe', 'la rampe', anchor(ramp, -2.4, 0.6, 1.4), false);
      part(st, 'helices', 'les quatre hélices', anchor(P, 2.6, P.userData.Y + 2.2, 7.4), true);
      part(st, 'soute', 'la grande soute', anchor(P, -1, P.userData.Y + 2.2, 0), true);
      part(st, 'vehicule', 'le véhicule', anchor(jeep, 0, 2, 0), false);
      st.focus = new V3(-6, 2.6, 0); st.size = { w: 24, h: 11 }; st.tagAt = anchor(P, 0, 9, 0);
      st.update = (dt) => { spinJ(); P.userData.props.forEach((p) => (p.rotation.x += dt * (st.rpm || 0))); };
      st.action = async function () {
        if (st.done) { jeep.visible = false; jeep.position.copy(IN); st.done = false; }
        st.rpm = 3;
        await Promise.all([step("L'avion cargo ouvre sa grande porte arrière...", 'soute'), to(ramp.rotation, 'z', -0.32, 3, easeSine)]);
        await Promise.all([step('...qui devient une rampe, jusqu’au sol.', 'rampe'), sleep(0.6)]);
        jeep.visible = true; engineOn(60);
        const p0 = IN.clone(), p1 = new V3(-12.6, 0, 0), p2 = new V3(-17, 0, 3.5);
        await Promise.all([step('Un véhicule sort de la soute en descendant la rampe.', 'vehicule'),
          tw(4, (k) => { const x = p0.x + (p1.x - p0.x) * k; jeep.position.set(x, x > -6.6 ? p0.y : Math.max(0, p0.y * (1 - (-6.6 - x) / 4.6)), 0); jeep.rotation.z = x < -6.6 && x > -11.2 ? -0.28 : 0; }, lin)]);
        await tw(2, (k) => { jeep.position.lerpVectors(p1, p2, k); jeep.rotation.y = Math.PI + 0.6 * k; jeep.rotation.z = 0; });
        await Promise.all([step("La porte se referme. L'avion est prêt à repartir !", 'soute'), to(ramp.rotation, 'z', 0.56, 3, easeSine)]);
        st.rpm = 0; chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the base around the machines ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
let RADAR = null, FLAG = null;
function buildBase(scene) {
  // control tower and radar beyond the runway
  { const g = at(scene, 6, -40); rbox(g, 4, 9, 4, 0.1, KM.concrete, 0, 4.5, 0, 0.02); rbox(g, 5, 2, 5, 0.1, KM.glass, 0, 10, 0, 0.02); rbox(g, 5.4, 0.3, 5.4, 0.05, KM.oliveD, 0, 11.1, 0, 0.02); }
  { const g = at(scene, -14, -40); cylY(g, 0.4, 4, KM.grey, 0, 2, 0, 10); const r = grp(g, 0, 4.3, 0); r.userData.dynamic = true; RADAR = r; const d = add(r, new THREE.SphereGeometry(2.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3), std(0xf4f5f8, 0.4, 0.1, { side: THREE.DoubleSide })); d.rotation.x = -1.2; }
  // hangars for the transport plane and the helicopters
  [[34, -40], [42, -30]].forEach(([h, d]) => { const g = at(scene, h, d); add(g, new THREE.CylinderGeometry(6, 6, 12, 24, 1, false, -Math.PI / 2, Math.PI), std(0x8a8e7a, 0.6, 0.1)).rotation.x = Math.PI / 2; box(g, 10, 5, 0.1, KM.dark, 0, 2.5, 6); });
  // barracks, mess hall and the flag
  [[-10, 8, 10, 4], [-10, 14, 10, 4], [4, 34, 8, 4]].forEach(([h, d, w, dd]) => { const g = at(scene, h, d); rbox(g, w, 2.6, dd, 0.08, std(0xc8c0a0, 0.8, 0), 0, 1.3, 0, 0.02); rbox(g, w + 0.4, 0.3, dd + 0.4, 0.05, KM.oliveD, 0, 2.75, 0, 0.02); for (let x = -w / 2 + 1; x < w / 2; x += 1.6) box(g, 0.7, 0.7, 0.05, KM.glass, x, 1.5, dd / 2 + 0.01); });
  { const g = at(scene, 0, 6); cylY(g, 0.07, 7, KM.white, 0, 3.5, 0, 8); const f = grp(g, 0, 6.2, 0); f.userData.dynamic = true; FLAG = f; [KM.blue, KM.white, KM.red].forEach((m, i) => box(f, 0.6, 1.2, 0.04, m, 0.3 + i * 0.6, 0, 0)); }
  // sandbags, crates, fences, trees
  for (let h = -46; h <= 46; h += 4) { if (Math.abs(h) < 4) continue; const g = at(scene, h, 40); rbox(g, 3.6, 0.6, 0.6, 0.2, KM.sand, 0, 0.3, 0, 0.02); }
  [[22, 4], [23.2, 4], [22.6, 5.1], [-18, 4]].forEach(([h, d]) => { const g = at(scene, h, d); rbox(g, 1.0, 0.8, 1.0, 0.05, KM.sand, 0, 0.4, 0, 0.02); });
  [[-46, -10], [46, -6], [-44, 34], [36, 30], [44, 18], [-48, 8], [24, 40], [-14, 40]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(scene, x, z, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0x6a8a3a, 0x4a7a3a, 0x7a9a4a]); });
  for (let h = -40; h <= 40; h += 10) { const [x, z] = Q(h, 2); lamp(scene, x, z, YAW + Math.PI / 2); }
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // jeeps on patrol along the main road
  const road = R([[-44, -1.1], [44, -1.1], [46, 0], [44, 1.1], [-44, 1.1], [-46, 0]], 0.1);
  const jeeps = [0, 1, 2].map(() => miniCar(scene, pick(['van', 'car']), 0x5f6e3a)); all.push(...jeeps);
  const t1 = traffic(road, jeeps, 3.4, { gap: 4 });
  // a squad jogging around the barracks
  const run = R([[-17, 5.5], [-3, 5.5], [-3, 16.5], [-17, 16.5]], 0.25);
  const squad = Array.from({ length: 6 }, () => walker(scene, 0, 0, { top: 0x5f6e3a, bottom: 0x46522a, hat: std(0x46522a, 0.6, 0.1) })); all.push(...squad);
  const t2 = traffic(run, squad, 1.6, { gap: 1.0 });
  let T = 0;
  onUpdate((dt) => { T += dt; t1.update(dt, all); t2.update(dt, all); if (RADAR) RADAR.rotation.y += dt * 1.2; if (FLAG) FLAG.rotation.y = Math.sin(T * 1.7) * 0.25; });
}
