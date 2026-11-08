// L'Aéroport — a whole airport: planes taking off and landing, and all the little vehicles that look after them.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, anchor, beam, wp, shadows, instanced, freeze } from '../kit/geo.js';
import { tire, operator, beacon, truckCab, glassCab, fender, hydraulic } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { lamp, autumnTree } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';
import { airliner, propPlane, AM, decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const XM = {
  yel: std(0xf2b21c, 0.4, 0.2), yelD: std(0xc88a10, 0.5, 0.2), red: std(0xd8302a, 0.35, 0.2), white: std(0xf4f5f8, 0.35, 0.1),
  grey: std(0x8f96a6, 0.5, 0.4), dark: std(0x2a2f40, 0.6, 0.1), glass: std(0x8ccaf0, 0.1, 0.2, { transparent: true, opacity: 0.75 }), glassD: MT.glassD,
  blue: std(0x2f6fe0, 0.35, 0.2), orange: std(0xf26a2a, 0.4, 0.2), green: std(0x3aa46a, 0.4, 0.1), tarmac: std(0x6a6e80, 0.9, 0), lime: std(0xc8e83a, 0.4, 0.1),
  bag: [std(0xe5452c, 0.6, 0), std(0x2f7de0, 0.6, 0), std(0xf2b21c, 0.6, 0), std(0x3aa46a, 0.6, 0), std(0xa45ad8, 0.6, 0)]
};

const DATA = {
  avion: { short: "L'avion", full: "L'avion de ligne", verb: 'Décoller', horn: 'bell',
    use: 'Il emmène des centaines de passagers très loin, très vite.',
    how: "Ses réacteurs le poussent très fort. Quand il va assez vite, l'air sous ses ailes le soulève." },
  passerelle: { short: 'La passerelle', full: 'La passerelle', verb: 'Embarquer', horn: 'bell',
    use: "C'est un couloir qui relie l'aéroport à la porte de l'avion.",
    how: "Elle s'allonge et tourne sur ses roues jusqu'à la porte. Les passagers marchent dedans, à l'abri." },
  bagages: { short: 'Les bagages', full: 'Le tapis à bagages', verb: 'Charger', horn: 'horn',
    use: 'Il monte les valises dans la soute de l’avion.',
    how: 'Un petit tracteur apporte les chariots de valises. Le tapis roulant les monte une par une.' },
  avitailleur: { short: "L'avitailleur", full: "Le camion avitailleur", verb: 'Faire le plein', horn: 'horn',
    use: "Il remplit les réservoirs de l'avion avec du carburant.",
    how: "Les réservoirs sont dans les ailes ! Un tuyau va jusqu'à la trappe, sous l'aile." },
  traiteur: { short: 'Le traiteur', full: 'Le camion traiteur', verb: 'Livrer', horn: 'horn',
    use: 'Il apporte les repas des passagers.',
    how: "Sa caisse monte jusqu'à la porte de l'avion, comme un ascenseur." },
  pushback: { short: 'Le pushback', full: 'Le tracteur pushback', verb: 'Pousser', horn: 'horn',
    use: "Il pousse l'avion en arrière pour le sortir de sa place.",
    how: "Un avion ne sait pas reculer tout seul ! Ce petit tracteur très fort le pousse avec une barre." },
  helice: { short: "L'avion à hélice", full: "Le petit avion à hélice", verb: 'Atterrir', horn: 'bell',
    use: 'Un petit avion pour faire de courts voyages.',
    how: "Son hélice tourne très vite et tire l'avion. Pour atterrir, il descend doucement vers la piste." },
  pompiers: { short: 'Les pompiers', full: "Le camion de pompiers de l'aéroport", verb: 'Arroser', horn: 'horn',
    use: "Il est toujours prêt, au cas où un avion aurait un problème.",
    how: "Il est énorme et très rapide. Son canon, sur le toit, lance de l'eau très loin." }
};
const ORDER = ['avion', 'helice', 'pushback', 'passerelle', 'bagages', 'avitailleur', 'traiteur', 'pompiers'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const PLANE = (fill = '#f4f5f8', tail = '#2f6fe0') => `<path d="M8 44q0-8 10-8h74q14 0 22 8-8 8-22 8H18q-10 0-10-8z" fill="${fill}" stroke="#c9ccd8" stroke-width="2"/><path d="M14 36L6 16h10l14 20z" fill="${tail}"/><path d="M50 46L36 66h12l20-20z" fill="#c9ccd8"/><rect x="40" y="52" width="14" height="7" rx="3" fill="#8f96a6"/><path d="M98 40h8" stroke="#1f2a44" stroke-width="4" stroke-linecap="round"/>`;
const ICONS = {
  avion: `<path d="M0 74H120" stroke="#d3d8ea" stroke-width="4"/><g transform="rotate(-14 60 40)">${PLANE()}</g><path d="M2 70h30" stroke="#f3efe2" stroke-width="3" stroke-dasharray="8 6"/>`,
  helice: GND + `<path d="M20 42q0-6 8-6h52q12 0 16 6-4 6-16 6H28q-8 0-8-6z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/><rect x="36" y="30" width="58" height="5" rx="2" fill="#e5452c"/><path d="M24 36L18 22h8l8 14z" fill="#e5452c"/><path d="M98 30v24" stroke="#2a2f40" stroke-width="4" stroke-linecap="round"/><circle class="k" cx="48" cy="58" r="5"/><circle class="k" cx="84" cy="58" r="5"/>`,
  pushback: GND + `<g transform="translate(-30,-6) scale(.8)">${PLANE()}</g><rect class="y" x="70" y="50" width="42" height="14" rx="4"/><rect class="g" x="96" y="44" width="10" height="8" rx="2"/><path class="ln" d="M70 58H60"/><circle class="k" cx="78" cy="66" r="6"/><circle class="k" cx="104" cy="66" r="6"/>`,
  passerelle: GND + `<rect x="2" y="16" width="20" height="40" fill="#c9ccd8"/><path d="M20 26h70v14H20z" fill="#e9ebf2" stroke="#9aa0b4" stroke-width="2"/><rect class="g" x="84" y="24" width="14" height="18" rx="3"/><path class="ln" d="M60 40v24M54 64h12"/><circle class="k" cx="56" cy="68" r="4"/><circle class="k" cx="64" cy="68" r="4"/><path d="M98 20q16 0 20 14v20H98z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/>`,
  bagages: GND + `<path d="M20 64L88 22" stroke="#2a2f40" stroke-width="8" stroke-linecap="round"/><rect x="36" y="44" width="10" height="8" fill="#e5452c" transform="rotate(-32 41 48)"/><rect x="56" y="32" width="10" height="8" fill="#2f7de0" transform="rotate(-32 61 36)"/><rect class="y" x="10" y="56" width="40" height="10" rx="3"/><circle class="k" cx="18" cy="68" r="5"/><circle class="k" cx="42" cy="68" r="5"/><path d="M86 8q20 0 30 14v30H86z" fill="#f4f5f8" stroke="#c9ccd8" stroke-width="2"/>`,
  avitailleur: GND + `<rect class="w" x="8" y="30" width="62" height="24" rx="10"/><rect x="8" y="40" width="62" height="5" fill="#e5452c"/><rect class="w" x="74" y="32" width="30" height="22" rx="3"/><rect class="g" x="88" y="36" width="12" height="9"/><path d="M40 30q10-20 40-22" stroke="#2a2f40" stroke-width="3" fill="none"/><path d="M60 8h56l4 6H60z" fill="#c9ccd8"/>
    <circle class="k" cx="22" cy="62" r="8"/><circle class="k" cx="44" cy="62" r="8"/><circle class="k" cx="92" cy="62" r="8"/>`,
  traiteur: GND + `<rect class="w" x="10" y="12" width="56" height="28" rx="3"/><path class="ln" d="M16 44l44 14M60 44L16 58"/><rect class="b" x="72" y="36" width="34" height="20" rx="3"/><rect class="g" x="88" y="40" width="12" height="9"/><rect class="k" x="10" y="56" width="96" height="5"/><circle class="k" cx="22" cy="64" r="7"/><circle class="k" cx="92" cy="64" r="7"/>`,
  pompiers: GND + `<rect x="8" y="26" width="98" height="30" rx="8" fill="#d8302a"/><rect class="g" x="84" y="30" width="16" height="12" rx="2"/><path d="M40 26l-6-10h16" stroke="#2a2f40" stroke-width="4" fill="none"/><path d="M50 16h30" stroke="#8ccaf0" stroke-width="3" stroke-dasharray="4 3"/>
    <circle class="k" cx="22" cy="62" r="9"/><circle class="k" cx="46" cy="62" r="9"/><circle class="k" cx="90" cy="62" r="9"/>`
};

// Layout (h along the screen in the overview, d from the back to the front)
const CFG = {
  avion: CF(-38, -14), helice: CF(-4, -14), pushback: CF(34, -2), passerelle: CF(-16, -2), bagages: CF(-16, -2), avitailleur: CF(10, -2), traiteur: CF(10, -2), pompiers: CF(-42, -1)
};
const GR = [], GB = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
rect(0, -12, 108, 34, '#77798c');                                       // tarmac
rect(0, -26, 112, 7, '#4a4c5e'); for (let h = -50; h < 50; h += 5) rect(h, -26, 2.6, 0.24, '#f3efe2');
for (let k = -2; k <= 2; k++) { rect(-44, -26 + k * 1.1, 4, 0.5, '#f3efe2'); rect(44, -26 + k * 1.1, 4, 0.5, '#f3efe2'); }
rect(0, -14, 110, 3.6, '#5c5e70'); rect(0, -14, 110, 0.16, '#f2b21c');
rect(0, 8.4, 70, 2.8, '#5c5e70'); [-16, 10, 34].forEach((h) => { rect(h, -2, 20, 0.16, '#f2b21c'); });
rect(0, 21, 100, 5, '#3a3c4e'); rect(0, 18, 100, 1.4, '#c9c4d8'); for (let h = -46; h < 46; h += 3) rect(h, 21, 1.4, 0.14, '#f3efe2');
rect(0, 28, 60, 8, '#4a4c5e', 1, '#5c5e70');
blob(0, -38, 9, 'rgba(120,200,140,.4)'); blob(-42, 0, 7, 'rgba(230,200,180,.5)'); blob(-34, -4, 3.5, 'rgba(60,50,60,.6)');

export default {
  id: 'aeroport', title: "L'Aéroport", titleHtml: "L'<span>Aéroport</span>",
  subtitle: "Des avions qui décollent et atterrissent, et tous les petits engins qui s'occupent d'eux.",
  welcome: "Bienvenue à l'aéroport ! Touche un avion ou un engin pour voir comment il marche.",
  hint: 'Touche un engin pour le découvrir.', backLabel: "Tout l'aéroport",
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18l10-2 6-10h3l-3 10 7-1 2-3h2l-1 5 1 5h-2l-2-3-7-1 3 10h-3l-6-10-10-2z"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 54, tufts: false,
  overview: { w: 90, h: 62, focus: [0, 3, 0] },
  ground: { base: ['#7c8ac8', '#5d6aa8', '#3e477e'], rects: GR, blobs: GB },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod, onUpdate } = ctx;
    const fx = createFx(scene, 160); onUpdate((dt) => fx.update(dt));
    freeze(buildAirport(grp(scene)));
    // keeps wheels turning for vehicles driven along curves
    const spin = (st, obj, wheels, R = 0.4) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || R))); }; };
    const along = (obj, r, s0, s1, d, ease = easeSine, yOff = 0) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k, yOff), ease);
    const exhaust = (obj, x, y, z, n = 1, col = 0xe8e8f0) => { for (let i = 0; i < n; i++) fx.smoke(obj.localToWorld(new V3(x, y, z + rnd(-0.2, 0.2))), new V3(-rnd(1, 2), rnd(0.2, 0.6), 0).applyAxisAngle(new V3(0, 1, 0), obj.rotation.y), rnd(0.2, 0.4), col, 1); };

    /* ---- l'avion de ligne : du taxiway jusqu'au ciel ---- */
    (function () {
      const st = makeStation('avion'), S = st.g;
      const P = airliner(S, { tail: XM.blue }); st.m = P;
      // path in station space: taxi along, turn onto the runway, take off along it
      const taxi = route([[0, 0], [8, 0], [12.5, -4.5], [16, -11], [22, -12], [30, -12]], false, 0.4), RUN = 96, DY = 0;
      placeOn(P, taxi, 0);
      const wheels = P.userData.gear.flatMap((g) => g.children.filter((c) => c.userData && c.userData.r));
      const spinW = spin(st, P, wheels, 0.42);
      part(st, 'reacteurs', 'les réacteurs', anchor(P, 1.4, P.userData.Y - 1.0, 3.9), true);
      part(st, 'ailes', 'les ailes', anchor(P, -2.6, P.userData.Y - 0.4, -6.5), true);
      part(st, 'roues', 'le train d’atterrissage', anchor(P, -0.9, 0.9, 2.2), false);
      part(st, 'cockpit', 'le cockpit', anchor(P, 8, P.userData.Y + 0.9, 0), true);
      part(st, 'piste', 'la piste', anchor(S, 26, 0.3, -12), false);
      st.focusAt = anchor(P, 0, 2, 0); st.size = { w: 26, h: 12 }; st.tagAt = anchor(P, 0, 6, 0);
      st.update = (dt) => { spinW(); P.userData.fans.forEach((f) => (f.rotation.x += dt * (st.thrust || 0.6) * 20)); if (st.thrust > 1.5 && Math.random() < 0.6) [3.3, -3.3].forEach((z) => exhaust(P, -1.2, P.userData.Y - 1.25, z, 1, 0xd8dce8)); };
      const RW = route([[30, -12], [30 + RUN, -12]], false, 0);
      st.action = async function () {
        if (st.done) { P.visible = true; P.rotation.set(0, 0, 0); P.userData.gear.forEach((g) => (g.scale.y = 1)); placeOn(P, taxi, 0); P.position.y = 0; pop(P, 0.6); st.done = false; await sleep(0.6); }
        st.thrust = 0.8; engineOn(110);
        await Promise.all([step("L'avion roule doucement vers la piste.", 'roues'), along(P, taxi, 0, taxi.len, 7, easeSine)]);
        await Promise.all([step('Le pilote pousse les manettes : les réacteurs rugissent !', 'reacteurs'), tw(1.6, (k) => (st.thrust = 0.8 + k * 2.4), lin), tone(120, 0, 1.6, 'sawtooth', 0.03, 260)]);
        let x = 0;
        await Promise.all([step("Il fonce sur la piste, de plus en plus vite...", 'piste'), tw(5, (k) => { x = 30 * k * k; placeOn(P, RW, x); }, lin)]);
        await Promise.all([step("...et hop ! L'air sous les ailes le soulève.", 'ailes'),
          tw(4, (k) => { placeOn(P, RW, 30 + 26 * k + 4 * k * k); P.position.y = 7 * k * k; P.rotation.z = Math.min(0.2, k * 0.5); }, lin)]);
        await Promise.all([step('Il rentre ses roues, et monte dans le ciel. Bon voyage !', 'roues'), tw(1.2, (k) => P.userData.gear.forEach((g) => (g.scale.y = Math.max(0.01, 1 - k)))),
          tw(5, (k) => { placeOn(P, RW, 60 + 30 * k); P.position.y = 7 + 26 * k; }, lin)]);
        st.thrust = 0.6; engineOff(); P.visible = false; st.done = true;
      };
    })();

    /* ---- le petit avion à hélice : il atterrit ---- */
    (function () {
      const st = makeStation('helice'), S = st.g;
      const P = propPlane(S, 0xe5452c); st.m = P;
      const LAND = route([[-80, -12], [-14, -12], [8, -12], [12, -10], [12.5, -5], [8, -1.5], [0, 0]], false, 0.35);
      const TD = 66; // distance where the wheels touch the runway
      placeOn(P, LAND, LAND.len); P.rotation.y += 0;
      const wheels = P.userData.gear.flatMap((g) => g.children.filter((c) => c.userData && c.userData.r)); const spinW = spin(st, P, wheels, 0.25);
      part(st, 'helice', "l'hélice", anchor(P.userData.prop, 0.2, 0.9, 0), true);
      part(st, 'ailes', 'les ailes', anchor(P, 0.7, 2.0, -3.6), true);
      part(st, 'piste', 'la piste', anchor(S, -14, 0.3, -12), false);
      part(st, 'roues', 'les roues', anchor(P, -0.1, 0.4, 1.1), false);
      st.focusAt = anchor(P, 0, 1, 0); st.size = { w: 14, h: 8 }; st.tagAt = anchor(P, 0, 3.4, 0);
      st.update = (dt) => { spinW(); P.userData.prop.rotation.x += dt * (st.rpm || 0); };
      st.action = async function () {
        st.rpm = 40; engineOn(150);
        placeOn(P, LAND, 0); P.position.y = 12; P.rotation.z = -0.12;
        await Promise.all([step("Un petit avion arrive. Son hélice tourne très vite.", 'helice'), tw(5, (k) => { placeOn(P, LAND, TD * 0.62 * k); P.position.y = 12 - 8 * k; P.rotation.z = -0.12; }, lin)]);
        await Promise.all([step('Il descend tout doucement vers la piste...', 'ailes'), tw(3.5, (k) => { placeOn(P, LAND, TD * 0.62 + TD * 0.38 * k); P.position.y = 4 * (1 - k) * (1 - k); P.rotation.z = -0.12 * (1 - k) + 0.05 * k; }, lin)]);
        P.position.y = 0; P.rotation.z = 0; thud();
        for (let i = 0; i < 4; i++) fx.smoke(P.localToWorld(new V3(-0.1, 0.2, (i - 1.5) * 0.6)), new V3(-1, 0.3, 0), 0.3, 0xd8d8e0, 0.8);
        await Promise.all([step('Les roues touchent la piste : il a atterri !', 'roues'), along(P, LAND, TD, TD + 22, 3, (k) => 1 - Math.pow(1 - k, 2))]);
        st.rpm = 14;
        await Promise.all([step('Il quitte la piste et roule jusqu’à sa place.', 'piste'), along(P, LAND, TD + 22, LAND.len, 6, easeSine)]);
        st.rpm = 0; engineOff(); chime();
      };
    })();

    /* ---- les avions aux portes ---- */
    function gatePlane(S, tail) { const P = airliner(S, { tail }); return P; }

    /* ---- pushback ---- */
    (function () {
      const st = makeStation('pushback'), S = st.g;
      const P = gatePlane(S, XM.red); P.position.set(0, 0, 0);
      const tug = grp(S); st.m = tug;
      // a low, heavy tug: the hitch end (+x) faces the plane; the driver sits in a small glazed cab
      ext(tug, [[-1.7, 0.3], [1.7, 0.3], [1.82, 0.55], [1.7, 0.95], [-1.6, 0.95], [-1.8, 0.62]], 0.1, 2.1, XM.yel, 0, 0, 0, 0.03);
      rbox(tug, 3.3, 0.06, 2.0, 0.02, XM.dark, -0.05, 0.97, 0, 0.01); // anti-slip deck
      [1.84, -1.86].forEach((x) => { rbox(tug, 0.14, 0.24, 1.9, 0.04, MT.stripes, x, 0.62, 0, 0.01); [0.7, -0.7].forEach((z) => rbox(tug, 0.16, 0.3, 0.3, 0.05, MT.black, x + Math.sign(x) * 0.05, 0.42, z, 0.02)); });
      [0.62, -0.62].forEach((z) => { rbox(tug, 0.06, 0.12, 0.26, 0.03, MT.lamp, 1.84, 0.8, z, 0.01); rbox(tug, 0.06, 0.1, 0.18, 0.03, MT.tail, -1.86, 0.8, z, 0.01); });
      const hitch = grp(tug, 1.95, 0.5, 0); rbox(hitch, 0.3, 0.2, 0.5, 0.04, XM.dark, 0, 0, 0, 0.02); cylY(hitch, 0.06, 0.4, MT.steel, 0.08, 0.05, 0, 8);
      glassCab(tug, -0.55, 0.95, -0.35, { len: 1.25, wid: 1.15, h: 1.05, mat: XM.yel, roof: XM.yelD, hat: XM.yel });
      rbox(tug, 1.6, 0.42, 0.62, 0.1, XM.yelD, -0.2, 1.17, 0.62, 0.02); for (let i = 0; i < 6; i++) box(tug, 0.06, 0.03, 0.5, XM.dark, -0.7 + i * 0.2, 1.39, 0.62); // engine cover + grille
      cylY(tug, 0.05, 0.9, MT.steel, -1.15, 1.5, 0.75, 8); cylY(tug, 0.07, 0.06, MT.black, -1.15, 1.96, 0.75, 8); // exhaust
      [1, -1].forEach((s) => { box(tug, 2.6, 0.04, 0.04, MT.steel, 0, 1.0, s * 1.07); rbox(tug, 0.5, 0.06, 0.25, 0.02, MT.black, -1.3, 0.35, s * 1.1, 0.01); }); // grab rails, step
      beacon(st, tug, -0.55, 2.08, -0.35);
      const tw0 = []; [[0.9, 1], [0.9, -1], [-0.9, 1], [-0.9, -1]].forEach(([x, s]) => { tw0.push(tire(tug, 0.4, 0.3, x, 0.4, s * 0.95, XM.grey, s)); fender(tug, 0.5, 0.36, x, 0.4, s * 0.95, XM.dark, Math.PI * 0.7); });
      const bar = grp(S); const barM = rod(bar, new V3(0, 0, 0), new V3(1, 0, 0), 0.08, XM.yelD, 6); bar.visible = false;
      // the tug drives up to the nose, couples, and pushes the plane back onto the taxiway
      const NOSE = 9.4;
      const back = route([[0, 0], [-4, 0], [-8, -2.5], [-11, -7.5], [-13, -12], [-20, -12]], false, 0.4);
      const tugIn = route([[NOSE + 9, 3], [NOSE + 5, 1.2], [NOSE + 2.7, 0]], false, 0.3);
      placeOn(tug, tugIn, 0);
      const backOn = (s) => { placeOn(P, back, s); P.rotation.y += Math.PI; };
      const spinT = spin(st, tug, tw0, 0.4); const Pw = P.userData.gear.flatMap((g) => g.children.filter((c) => c.userData && c.userData.r)); const spinP = spin(st, P, Pw, 0.42);
      part(st, 'tracteur', 'le tracteur', anchor(tug, 0, 2.0, 0), true);
      part(st, 'barre', 'la barre', anchor(tug, 2.4, 0.9, 0.3), false);
      part(st, 'avion', "l'avion", anchor(P, -2, P.userData.Y + 1.8, 0), true);
      st.focusAt = anchor(P, 4, 1, 0); st.size = { w: 26, h: 12 }; st.tagAt = anchor(tug, 0, 3, 0);
      const tmp = new V3(); const fwd = new V3();
      st.update = () => {
        spinT(); spinP();
        if (st.coupled) { // the tug stays glued to the nose, facing it
          fwd.set(Math.cos(P.rotation.y), 0, -Math.sin(P.rotation.y)); tmp.copy(P.position).addScaledVector(fwd, NOSE + 2.7);
          tug.position.copy(tmp); tug.rotation.y = P.rotation.y + Math.PI;
        }
      };
      st.action = async function () {
        if (st.done) { await Promise.all([step('Un nouvel avion est arrivé à cette porte.', 'avion'), tw(0.6, (k) => P.scale.setScalar(Math.max(0.01, 1 - k)))]); backOn(0); P.scale.setScalar(1); pop(P, 0.6); placeOn(tug, tugIn, 0); st.done = false; await sleep(0.7); }
        engineOn(60);
        await Promise.all([step("Le petit tracteur vient se mettre devant le nez de l'avion.", 'tracteur'), tw(3, (k) => placeOn(tug, tugIn, tugIn.len * k), easeSine)]);
        ding(); st.coupled = true;
        await Promise.all([step('Il accroche la roue avant avec sa barre.', 'barre'), sleep(1)]);
        await Promise.all([step("Et il pousse l'avion en arrière ! L'avion ne sait pas reculer tout seul.", 'avion'), tw(9, (k) => backOn(back.len * k * 0.62), easeSine)]);
        await Promise.all([step("Voilà, l'avion est sur le chemin. Il peut rouler vers la piste.", 'avion'), tw(3, (k) => backOn(back.len * (0.62 + 0.18 * k)), easeSine)]);
        st.coupled = false;
        const t0 = tug.position.clone(), r0 = tug.rotation.y;
        await tw(2.4, (k) => { tug.position.set(t0.x + 6 * k, 0, t0.z + 4 * k); tug.rotation.y = r0 + k * 0.6; });
        st.done = true;
      };
    })();

    /* ---- passerelle (gate 1) ---- */
    const G1 = {};
    (function () {
      const st = makeStation('passerelle'), S = st.g;
      const P = gatePlane(S, XM.green); G1.plane = P; G1.S = S;
      const door = P.userData.doors.front; // (6.3, Y, 1.15) on the +z side
      // rotunda at the terminal, a telescopic tunnel, a cab on wheels
      const rot = grp(S, door.x - 1.5, 0, 13.0); cylY(rot, 0.6, 2.9, XM.grey, 0, 1.45, 0, 12); rbox(rot, 1.8, 1.6, 1.8, 0.1, XM.white, 0, 2.9, 0, 0.02);
      const yawG = grp(rot, 0, 2.9, 0); const t1 = grp(yawG), t2 = grp(yawG);
      rbox(t1, 1.4, 1.5, 6.0, 0.1, XM.white, 0, 0, -3.0, 0.02); box(t1, 1.42, 0.5, 5.6, XM.glass, 0, 0.2, -3.0);
      rbox(t2, 1.25, 1.35, 6.0, 0.1, std(0xe6e8f0, 0.4, 0.1), 0, 0, -3.0, 0.02); box(t2, 1.27, 0.45, 5.6, XM.glass, 0, 0.2, -3.0);
      const cab = grp(t2, 0, 0, -6.0); rbox(cab, 1.8, 1.7, 1.6, 0.12, XM.white, 0, 0, -0.6, 0.02); rbox(cab, 1.5, 1.5, 0.5, 0.2, XM.dark, 0, 0, -1.5, 0.02);
      const wheelsG = grp(cab, 0, -2.58, 0); rod(wheelsG, new V3(0, 0.2, 0), new V3(0, 1.9, 0), 0.12, XM.grey, 8); rbox(wheelsG, 1.4, 0.3, 0.4, 0.05, XM.dark, 0, 0.25, 0, 0.02);
      const bw = [0.5, -0.5].map((x) => tire(wheelsG, 0.32, 0.26, x, 0, 0, XM.grey));
      // the tunnel aims at the door: unfolded length L
      const start = new V3(rot.position.x, 2.9, rot.position.z), target = new V3(door.x, 2.9, door.z + 0.2);
      const LMAX = start.distanceTo(target) - 1.8, LMIN = 6.6, yaw = Math.atan2(-(target.x - start.x), -(target.z - start.z));
      const setLen = (L) => { t2.position.z = -(L - 6.0); };
      yawG.rotation.y = yaw + 0.25; setLen(LMIN);
      // passengers inside the terminal
      const pax = [0, 1, 2, 3].map((i) => { const p = walker(S, rot.position.x - 1.6 + i * 0.7, rot.position.z + 1.6, { kid: i === 2 }); p.rotation.y = Math.PI / 2; return p; });
      const paxHome = pax.map((p) => p.position.clone());
      part(st, 'passerelle', 'la passerelle', anchor(t1, 0, 1.2, -3), true);
      part(st, 'roues', 'les roues', anchor(wheelsG, 0, -2.3, 0.4), false);
      part(st, 'porte', 'la porte', anchor(P, door.x, door.y + 1.2, door.z + 0.2), false);
      part(st, 'passagers', 'les passagers', anchor(S, rot.position.x, 2.2, rot.position.z + 1.6), false);
      st.focus = new V3(door.x - 1, 2.6, 7); st.size = { w: 18, h: 11 }; st.az = YAW + Math.PI; st.el = 0.85; st.tagAt = anchor(rot, 0, 5, 0);
      let curL = LMIN;
      st.update = () => { const d = (curL - (st.lastL || curL)); st.lastL = curL; if (d) bw.forEach((w) => (w.rotation.z -= d / 0.32)); };
      st.action = async function () {
        if (st.done) { await Promise.all([step('La passerelle se replie. Un autre avion arrive bientôt.', 'passerelle'), tw(3, (k) => { curL = LMAX + (LMIN - LMAX) * k; setLen(curL); yawG.rotation.y = yaw + 0.25 * k; })]); pax.forEach((p, i) => { p.position.copy(paxHome[i]); p.visible = true; }); st.done = false; }
        engineOn(130);
        await Promise.all([step("La passerelle tourne, et s'allonge vers l'avion.", 'passerelle'), tw(4.5, (k) => { curL = LMIN + (LMAX - LMIN) * k; setLen(curL); yawG.rotation.y = yaw + 0.25 * (1 - k); }, easeSine)]);
        engineOff(); thud();
        await Promise.all([step("Elle se colle bien contre la porte de l'avion.", 'porte'), sleep(1.2)]);
        await step('Les passagers marchent dedans, bien à l’abri, jusque dans l’avion.', 'passagers');
        for (const p of pax) { const p0 = p.position.clone(); await tw(0.9, (k) => { p.position.set(p0.x + (start.x - p0.x) * k, 0, p0.z + (start.z + 0.2 - p0.z) * k); p.userData.walk(k * 10); }, lin); p.visible = false; }
        await Promise.all([step("Tout le monde est à bord. Bon voyage !", 'porte'), sleep(0.8)]);
        chime(); st.done = true;
      };
    })();

    /* ---- tapis à bagages (gate 1, at the cargo door) ---- */
    (function () {
      const st = makeStation('bagages'), S = st.g; const P = G1.plane, cargo = P.userData.doors.cargo;
      const bl = grp(S, cargo.x - 0.6, 0, 5.6); bl.rotation.y = Math.PI / 2 - 0.05; st.m = bl;
      // chassis, the driver's seat at the back under a little roof, the belt on top
      ext(bl, [[-1.9, 0.35], [1.8, 0.35], [1.95, 0.6], [1.8, 0.85], [-1.9, 0.85]], 0.08, 1.5, XM.yel, 0, 0, 0, 0.02);
      [[1.2, 1], [1.2, -1], [-1.2, 1], [-1.2, -1]].forEach(([x, s]) => { tire(bl, 0.3, 0.22, x, 0.3, s * 0.75, XM.grey, s); fender(bl, 0.38, 0.26, x, 0.3, s * 0.75, XM.dark, Math.PI * 0.7); });
      rbox(bl, 0.12, 0.2, 1.4, 0.04, MT.black, 1.98, 0.55, 0, 0.02); rbox(bl, 0.08, 0.16, 1.3, 0.02, MT.stripes, -1.95, 0.6, 0, 0.01);
      rbox(bl, 0.9, 0.5, 0.65, 0.08, XM.yelD, -1.3, 1.1, 0.42, 0.02); operator(bl, -1.3, 0.85, 0.42).scale.setScalar(0.8);
      [[-0.9, 0.78], [-0.9, 0.06], [-1.75, 0.78], [-1.75, 0.06]].forEach(([x, z]) => box(bl, 0.05, 1.3, 0.05, XM.dark, x, 1.5, z)); rbox(bl, 1.0, 0.06, 0.85, 0.03, XM.yelD, -1.32, 2.17, 0.42, 0.01);
      box(bl, 0.03, 0.5, 0.65, XM.glass, -0.88, 1.6, 0.42); beacon(st, bl, -1.32, 2.2, 0.42);
      const belt = grp(bl, -0.6, 1.0, -0.2); const beltB = grp(belt); rbox(beltB, 4.6, 0.18, 0.8, 0.06, XM.dark, 2.3, 0, 0, 0.02);
      [0.42, -0.42].forEach((z) => { rbox(beltB, 4.6, 0.16, 0.06, 0.02, XM.yel, 2.3, 0.12, z, 0.01); for (let x = 0.3; x < 4.5; x += 0.55) cylZ(beltB, 0.06, 0.04, MT.steel, x, -0.04, z * 1.05, 8); rail(beltB, [[0.2, 0.2, z * 1.1], [0.2, 0.55, z * 1.1], [4.4, 0.55, z * 1.1], [4.4, 0.2, z * 1.1]], 0.02, XM.yel); });
      { const CL = new THREE.BoxGeometry(0.04, 0.05, 0.7); const cl = []; for (let x = 0.15; x < 4.5; x += 0.3) cl.push(x); instanced(beltB, CL, cl.length, (i, d) => { d.position.set(cl[i], 0.1, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); return 0x1d1f26; }); }
      rbox(beltB, 0.16, 0.3, 0.9, 0.06, MT.black, 4.62, 0.05, 0, 0.02); // rubber bumper against the plane
      const ramA = anchor(bl, 0.6, 0.85, -0.2), ramB = anchor(beltB, 2.6, -0.1, 0); const ram = hydraulic(bl, ramA, ramB, { barrel: 0.7, mat: XM.yelD, rb: 0.08 });
      belt.rotation.z = 0.05;
      // the baggage tractor and its carts
      const train = grp(S); const trw = [];
      ext(train, [[-0.95, 0.25], [0.9, 0.25], [1.0, 0.45], [0.85, 0.8], [0.3, 0.85], [-0.95, 0.85]], 0.08, 1.2, XM.blue, 0, 0, 0, 0.02);
      operator(train, -0.35, 0.8, 0).scale.setScalar(0.75); rbox(train, 0.16, 0.18, 1.1, 0.04, MT.black, 1.0, 0.4, 0, 0.02);
      [[0.6, 0.55], [0.6, -0.55], [-0.85, 0.55], [-0.85, -0.55]].forEach(([x, z]) => box(train, 0.05, 1.05, 0.05, XM.dark, x, 1.35, z)); rbox(train, 1.65, 0.07, 1.25, 0.03, XM.white, -0.12, 1.9, 0, 0.01);
      [0.4, -0.4].forEach((z) => rbox(train, 0.05, 0.1, 0.2, 0.02, MT.lamp, 1.0, 0.68, z, 0.01)); beacon(st, train, -0.12, 1.93, 0);
      [[0.6, 1], [0.6, -1], [-0.6, 1], [-0.6, -1]].forEach(([x, s]) => trw.push(tire(train, 0.25, 0.2, x, 0.25, s * 0.62, XM.grey, s)));
      const bags = [];
      [-2.6, -5.2].forEach((cx) => { const c = grp(train, cx, 0, 0); rbox(c, 2.2, 0.15, 1.3, 0.03, XM.grey, 0, 0.55, 0, 0.01); rail(c, [[-1.1, 0.6, 0.65], [-1.1, 1.4, 0.65], [1.1, 1.4, 0.65], [1.1, 0.6, 0.65]], 0.03, XM.grey); rail(c, [[-1.1, 0.6, -0.65], [-1.1, 1.4, -0.65], [1.1, 1.4, -0.65], [1.1, 0.6, -0.65]], 0.03, XM.grey); rbox(c, 2.3, 0.08, 1.35, 0.02, XM.blue, 0, 1.45, 0, 0.01); rod(c, new V3(1.1, 0.5, 0), new V3(1.5, 0.5, 0), 0.04, XM.dark);
          [0.66, -0.66].forEach((z) => { rbox(c, 0.55, 0.85, 0.03, 0.03, XM.blue, -0.82, 1.0, z, 0.01); rbox(c, 0.55, 0.85, 0.03, 0.03, XM.blue, 0.82, 1.0, z, 0.01); });
        [[0.3, 0.8, 0], [-0.4, 0.8, 0.1], [0.4, 1.15, 0.05]].forEach(([x, y, z], i) => { const b = rbox(c, 0.6, 0.38, 0.42, 0.06, XM.bag[(bags.length + i) % 5], x, y, z, 0.02); b.userData.home = { parent: c, pos: b.position.clone() }; bags.push(b); });
        [[0.75, 1], [0.75, -1], [-0.75, 1], [-0.75, -1]].forEach(([x, s]) => trw.push(tire(c, 0.2, 0.15, x, 0.2, s * 0.55, XM.grey, s))); });
      const TR = route([[-34, 10.4], [-20, 10.4], [-12, 8], [-8, 6.6], [-6, 6.5]], false, 0.3); placeOn(train, TR, 0);
      const spinT = spin(st, train, trw, 0.25);
      part(st, 'tapis', 'le tapis roulant', anchor(beltB, 2.6, 0.5, 0.4), true);
      part(st, 'chariots', 'les chariots à bagages', anchor(train, -3.8, 1.9, 0), false);
      part(st, 'soute', 'la soute', anchor(P, cargo.x, cargo.y + 0.3, cargo.z + 0.1), true);
      part(st, 'tracteur', 'le petit tracteur', anchor(train, 0, 1.8, 0), false);
      st.focus = new V3(cargo.x - 2, 1.6, 5); st.size = { w: 16, h: 9 }; st.el = 1.05; st.tagAt = anchor(bl, 0, 2.8, 0);
      st.update = () => { spinT(); ram.update(); };
      st.action = async function () {
        if (st.done) { bags.forEach((b) => { b.userData.home.parent.add(b); b.position.copy(b.userData.home.pos); b.rotation.set(0, 0, 0); b.visible = true; }); placeOn(train, TR, 0); st.done = false; }
        engineOn(60);
        await Promise.all([step('Le petit tracteur arrive avec les chariots pleins de valises.', 'chariots'), along(train, TR, 0, TR.len, 6, easeSine)]);
        await Promise.all([step('Le tapis roulant se lève jusqu’à la soute.', 'tapis'), to(belt.rotation, 'z', 0.17, 1.8, easeSine)]);
        S.updateMatrixWorld(true);
        await step('Les valises montent une par une. Hop, hop, hop !', 'soute');
        for (const b of bags) {
          const a = S.worldToLocal(wp(beltB, 0).add(new V3(0, 0.35, 0))), z = S.worldToLocal(beltB.localToWorld(new V3(4.4, 0.35, 0)));
          S.attach(b); const p0 = b.position.clone(); ding();
          await tw(0.5, (k) => b.position.lerpVectors(p0, a, k), easeSine);
          await tw(0.9, (k) => b.position.lerpVectors(a, z, k), lin); b.visible = false;
        }
        await Promise.all([step('Toutes les valises sont dans la soute. Le tapis redescend.', 'tapis'), to(belt.rotation, 'z', 0.05, 1.5)]);
        st.done = true;
      };
    })();

    /* ---- avitailleur (gate 2) ---- */
    const G2 = {};
    (function () {
      const st = makeStation('avitailleur'), S = st.g;
      const P = gatePlane(S, XM.orange); G2.plane = P; G2.S = S;
      const truck = grp(S); st.m = truck;
      [0.42, -0.42].forEach((z) => rbox(truck, 6.4, 0.3, 0.16, 0.03, MT.black, -0.3, 0.97, z));
      truckCab(truck, XM.white, 1.45);
      // oval tank with domed ends, a red band, the walkway and its folding rails on top
      const tank = grp(truck, -1.0, 2.05, 0); tank.scale.set(1, 0.92, 1); cylX(tank, 1.05, 4.3, XM.white, 0, 0, 0, 28);
      [2.15, -2.15].forEach((x) => { const d = sph(tank, 1.05, XM.white, x, 0, 0); d.scale.set(0.28, 1, 1); });
      [-1.1, 0.0, 1.1].forEach((x) => cylX(tank, 1.075, 0.06, XM.grey, x, 0, 0, 28)); // tank rings
      [1, -1].forEach((s) => { rbox(tank, 4.5, 0.2, 0.05, 0.02, XM.red, 0, -0.1, s * 1.04, 0.01); const D = grp(tank); if (s < 0) D.rotation.y = Math.PI; decal(D, 'JET A-1', 1.6, 0.36, '#d8302a', s * 0.6, 0.38, 1.0, null).rotation.x = -0.35; });
      rbox(truck, 3.6, 0.06, 0.6, 0.02, XM.grey, -1.0, 3.04, 0, 0.01); [0.32, -0.32].forEach((z) => rail(truck, [[-2.7, 3.06, z], [-2.7, 3.45, z], [0.7, 3.45, z], [0.7, 3.06, z]], 0.02, XM.yel));
      for (let i = 0; i < 4; i++) cylY(truck, 0.16, 0.08, XM.grey, -2.2 + i * 0.85, 3.05, 0, 12); // manholes
      // rear cabinet with the hose reel, ladder, bumper and lights
      rbox(truck, 0.9, 1.5, 2.2, 0.06, XM.white, -3.75, 1.75, 0, 0.02); box(truck, 0.04, 1.2, 1.9, XM.dark, -4.21, 1.8, 0);
      const reel = grp(truck, -3.75, 1.8, 0); cylZ(reel, 0.5, 1.5, XM.red, 0, 0, 0, 18); cylZ(reel, 0.35, 1.56, XM.dark, 0, 0, 0, 18);
      rail(truck, [[-4.24, 1.0, 0.75], [-4.24, 3.1, 0.75]], 0.025, XM.grey); rail(truck, [[-4.24, 1.0, 0.45], [-4.24, 3.1, 0.45]], 0.025, XM.grey); for (let y = 1.2; y < 3.1; y += 0.3) rod(truck, new V3(-4.24, y, 0.75), new V3(-4.24, y, 0.45), 0.02, XM.grey);
      rbox(truck, 0.16, 0.22, 2.2, 0.03, MT.stripes, -4.25, 0.72, 0, 0.01); [0.85, -0.85].forEach((z) => rbox(truck, 0.06, 0.14, 0.24, 0.02, MT.tail, -4.3, 0.95, z, 0.01));
      // side lockers between the axles, under-run guards
      [1, -1].forEach((s) => { rbox(truck, 1.2, 0.55, 0.06, 0.03, XM.grey, 0.5, 1.15, s * 1.05, 0.01); box(truck, 1.0, 0.03, 0.07, XM.dark, 0.5, 1.15, s * 1.07); [0.7, 0.4].forEach((y) => box(truck, 1.0, 0.06, 0.05, MT.steel, 0.5 - 0.0, y, s * 1.02)); });
      const tw1 = []; [1, -1].forEach((s) => { tw1.push(tire(truck, 0.55, 0.4, 2.3, 0.55, s * 0.9, XM.grey)); [-1.2, -2.4].forEach((x) => tw1.push(tire(truck, 0.55, 0.3, x, 0.55, s * 0.95, XM.grey, s))); [-1.2, -2.4].forEach((x) => fender(truck, 0.66, 0.36, x, 0.55, s * 0.95, XM.dark, Math.PI * 0.6)); });
      beacon(st, truck, 3.0, 3.0, 0);
      const man = walker(S, 0, 0, { vest: true, hat: XM.yel }); man.visible = false;
      const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new V3(), new V3(1, 0, 0)), 8, 0.06, 6), XM.dark); S.add(hose); hose.visible = false;
      // the fuel point is under the right wing
      const FP = new V3(-1.6, P.userData.Y - 0.9, 4.4);
      const IN = route([[24, 10.2], [12, 10.2], [0.5, 10.2]], false, 0.1); placeOn(truck, IN, 0);
      const spinT = spin(st, truck, tw1, 0.55);
      const gauge = grp(S, FP.x, FP.y - 0.4, FP.z); gauge.visible = false; rbox(gauge, 0.1, 0.12, 1.4, 0.02, XM.dark, 0, 0, 0, 0.01); const fill = rbox(gauge, 0.11, 0.1, 1.36, 0.02, XM.lime, 0, 0, 0, 0.01); fill.scale.z = 0.01;
      part(st, 'citerne', 'la citerne', anchor(truck, -1, 3.2, 0.8), true);
      part(st, 'tuyau', 'le tuyau', anchor(S, FP.x + 0.6, FP.y - 1.2, FP.z + 1.4), false);
      part(st, 'aile', "l'aile (le réservoir est dedans !)", anchor(P, -1.5, P.userData.Y - 0.2, 6), true);
      st.focus = new V3(-0.5, 2.0, 6.5); st.size = { w: 16, h: 9 }; st.el = 1.0; st.tagAt = anchor(truck, 0, 3.8, 0);
      const setHose = (a, b) => { const mid = a.clone().lerp(b, 0.5); mid.y -= 0.6; hose.geometry.dispose(); hose.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 14, 0.06, 6); };
      st.update = () => spinT();
      st.action = async function () {
        if (st.done) { hose.visible = false; gauge.visible = false; fill.scale.z = 0.01; placeOn(truck, IN, 0); man.visible = false; st.done = false; }
        engineOn(60);
        await Promise.all([step("Le camion avitailleur vient se garer sous l'aile.", 'citerne'), along(truck, IN, 0, IN.len, 6, easeSine)]);
        engineOff();
        S.updateMatrixWorld(true); const reelP = S.worldToLocal(wp(reel, 0));
        man.visible = true; man.position.set(reelP.x, 0, reelP.z + 1.4); pop(man, 0.4);
        hose.visible = true;
        await Promise.all([step("Le pompiste tire le tuyau jusqu'à la trappe, sous l'aile.", 'tuyau'),
          tw(2.2, (k) => { const tip = new V3(reelP.x + (FP.x - reelP.x) * k, reelP.y + (FP.y - reelP.y) * k, reelP.z + (FP.z - reelP.z) * k); setHose(reelP, tip); man.position.set(tip.x, 0, tip.z + 0.4); man.userData.walk(k * 12); reel.rotation.z = k * 8; }, easeSine)]);
        gauge.visible = true;
        await Promise.all([step("Le carburant coule dans les ailes. Ce sont les réservoirs de l'avion !", 'aile'), tw(4, (k) => { fill.scale.z = Math.max(0.01, k); }, lin), tone(180, 0, 3.6, 'sine', 0.02, 220)]);
        ding();
        await Promise.all([step('Le plein est fait ! On range le tuyau.', 'tuyau'), tw(1.8, (k) => { const tip = new V3(FP.x + (reelP.x - FP.x) * k, FP.y + (reelP.y - FP.y) * k, FP.z + (reelP.z - FP.z) * k); setHose(reelP, tip); man.position.set(tip.x, 0, tip.z + 0.4); man.userData.walk(k * 10); reel.rotation.z = 8 * (1 - k); })]);
        hose.visible = false; gauge.visible = false; man.visible = false; st.done = true;
      };
    })();

    /* ---- camion traiteur (gate 2, rear door) ---- */
    (function () {
      const st = makeStation('traiteur'), S = st.g; const P = G2.plane, rd = new V3(-6.2, P.userData.Y, -1.0); st.az = YAW + Math.PI;
      box(P, 0.75, 1.4, 0.04, AM.grey, -6.2, P.userData.Y + 0.05, -1.0);
      const truck = grp(S); st.m = truck;
      [0.42, -0.42].forEach((z) => rbox(truck, 6.0, 0.3, 0.16, 0.03, MT.black, -0.4, 0.97, z));
      truckCab(truck, XM.blue, 1.3);
      const sc = grp(truck, -1.6, 1.15, 0); const bars = [];
      for (let i = 0; i < 2; i++) [0.8, -0.8].forEach((z) => { bars.push(add(sc, new THREE.BoxGeometry(1, 0.1, 0.08), XM.grey, 0, 0, z)); bars.push(add(sc, new THREE.BoxGeometry(1, 0.1, 0.08), XM.grey, 0, 0, z * 0.9)); });
      const boxG = grp(sc, 0, 0.2, 0); rbox(boxG, 3.6, 2.2, 2.1, 0.08, XM.white, 0, 1.1, 0, 0.02); rbox(boxG, 3.62, 0.3, 2.12, 0.02, XM.blue, 0, 1.6, 0, 0.01);
      rbox(boxG, 3.7, 0.18, 2.2, 0.04, XM.grey, 0, 0.05, 0, 0.01); rbox(boxG, 1.2, 0.3, 1.0, 0.08, XM.grey, 0.6, 2.33, 0, 0.02); // floor frame, roof cooling unit
      for (let x = -1.4; x <= 1.4; x += 0.7) [1, -1].forEach((s) => box(boxG, 0.03, 2.0, 0.03, XM.grey, x, 1.1, s * 1.06)); // side posts
      [1, -1].forEach((s) => { const D = grp(boxG); if (s < 0) D.rotation.y = Math.PI; decal(D, 'REPAS', 1.8, 0.45, '#2f6fe0', 0, 0.95, 1.07, null); rbox(boxG, 0.1, 0.08, 0.1, 0.02, MT.amber, s * 1.75, 2.24, 0.95, 0.01); });
      const front = grp(boxG, -1.82, 0.05, 0); rbox(front, 0.9, 0.06, 1.1, 0.02, XM.grey, -0.45, 0, 0, 0.01); front.rotation.z = -Math.PI / 2;
      [0.52, -0.52].forEach((z) => rail(front, [[-0.08, 0.03, z], [-0.08, 0.6, z], [-0.85, 0.6, z], [-0.85, 0.03, z]], 0.022, XM.yel));
      const trolley = rbox(boxG, 0.5, 0.9, 0.4, 0.04, XM.grey, -1.2, 0.55, 0, 0.02);
      const tw1 = []; [1, -1].forEach((s) => { tw1.push(tire(truck, 0.5, 0.36, 2.1, 0.5, s * 0.9, XM.grey)); tw1.push(tire(truck, 0.5, 0.3, -2.2, 0.5, s * 0.95, XM.grey, s)); fender(truck, 0.62, 0.36, -2.2, 0.5, s * 0.95, XM.dark, Math.PI * 0.6);
        [0.75, 0.45].forEach((y) => box(truck, 2.6, 0.06, 0.05, MT.steel, -0.2, y, s * 1.0)); });
      rbox(truck, 0.14, 0.22, 2.1, 0.03, MT.stripes, -3.38, 0.75, 0, 0.01); [0.8, -0.8].forEach((z) => rbox(truck, 0.06, 0.14, 0.22, 0.02, MT.tail, -3.44, 0.98, z, 0.01));
      let lift = 0; const setLift = (h) => { lift = h; const n = 2, seg = Math.max(0.1, h / n), L = 2.6, ang = Math.asin(Math.min(0.95, seg / L));
        bars.forEach((b, i) => { const lvl = Math.floor(i / 4), a = i % 2 ? -ang : ang; b.position.y = lvl * seg + seg / 2; b.rotation.z = a; b.scale.x = L; }); boxG.position.y = 0.2 + h; };
      setLift(0);
      // the truck comes to the rear door, on the +z side, facing the plane
      const Z0 = -11, Z1 = -1.15 - 0.45 - 3.4; truck.rotation.y = Math.PI / 2; truck.position.set(rd.x - 0.2, 0, Z0);
      const spinT = spin(st, truck, tw1, 0.5);
      part(st, 'caisse', 'la caisse des repas', anchor(boxG, 0, 2.4, 0.8), true);
      part(st, 'ciseaux', 'les bras en ciseaux', anchor(sc, 0, 0.5, 1.0), false);
      part(st, 'porte', 'la porte arrière', anchor(P, rd.x, rd.y + 1.1, rd.z - 0.2), false);
      st.focus = new V3(rd.x, 2.6, -4.5); st.size = { w: 14, h: 9 }; st.tagAt = anchor(truck, 0, 4.8, 0);
      st.update = () => spinT();
      st.action = async function () {
        if (st.done) { truck.position.z = Z0; trolley.position.set(-1.2, 0.55, 0); trolley.visible = true; st.done = false; }
        engineOn(60);
        await Promise.all([step("Le camion traiteur arrive en marche arrière, avec les repas des passagers.", 'caisse'), to(truck.position, 'z', Z1, 5, easeSine)]);
        engineOff(); engineOn(140);
        await Promise.all([step("Sa caisse monte, monte... comme un ascenseur !", 'ciseaux'), tw(4, (k) => setLift(k * (rd.y - 1.2)), easeSine)]);
        engineOff();
        await Promise.all([step('Il ouvre sa porte devant celle de l’avion.', 'porte'), to(front.rotation, 'z', 0, 1)]);
        await Promise.all([step('On fait rouler les chariots de repas dans l’avion. Miam !', 'caisse'), to(trolley.position, 'x', -3.0, 1.4)]);
        trolley.visible = false; ding();
        await to(front.rotation, 'z', -Math.PI / 2, 0.8);
        engineOn(140); await Promise.all([step('La caisse redescend.', 'ciseaux'), tw(3, (k) => setLift((rd.y - 1.2) * (1 - k)), easeSine)]); engineOff();
        st.done = true;
      };
    })();

    /* ---- pompiers d'aéroport ---- */
    (function () {
      const st = makeStation('pompiers'), S = st.g;
      // the training fire: an old plane shape
      const pit = grp(S, 9, 0, -3); rbox(pit, 6, 0.1, 4, 0.05, std(0x3a3240, 0.9, 0), 0, 0.05, 0, 0.02);
      const mock = grp(pit); cylX(mock, 0.8, 5, XM.grey, 0, 1.0, 0, 12); rbox(mock, 1.2, 0.1, 5, 0.03, XM.grey, 0, 0.9, 0, 0.01); rbox(mock, 0.6, 1.4, 0.1, 0.03, XM.grey, -2.3, 1.6, 0, 0.01);
      const truck = grp(S); st.m = truck;
      // a big airport crash tender: forward cab with a huge windscreen, body with roll-up shutters, roof monitor
      ext(truck, [[1.55, 1.0], [3.45, 1.0], [3.75, 1.35], [3.7, 2.2], [3.35, 3.35], [3.1, 3.45], [1.55, 3.45]], [0.05, 0.1, 0.12, 0.25, 0.25, 0.1, 0.05], 2.5, XM.red, 0, 0, 0, 0.04);
      { const ws = box(truck, 0.05, 1.1, 2.2, MT.glassD, 3.55, 2.8, 0); ws.rotation.z = 0.32; box(truck, 0.06, 0.05, 2.2, XM.dark, 3.56, 2.78, 0).rotation.z = 0.32; }
      [1, -1].forEach((s) => {
        rbox(truck, 1.25, 0.85, 0.04, 0.08, MT.glassD, 2.55, 2.85, s * 1.25, 0.01); rbox(truck, 0.45, 0.7, 0.04, 0.06, MT.glassD, 3.3, 2.0, s * 1.25, 0.01);
        box(truck, 0.03, 2.3, 0.03, XM.dark, 1.95, 2.2, s * 1.26); box(truck, 0.18, 0.04, 0.04, MT.chrome, 2.2, 2.2, s * 1.28); // door seam, handle
        rod(truck, new V3(3.3, 3.0, s * 1.25), new V3(3.55, 3.15, s * 1.55), 0.025, XM.dark); rbox(truck, 0.06, 0.4, 0.2, 0.03, XM.dark, 3.58, 2.95, s * 1.6, 0.01); // mirror
        rbox(truck, 0.5, 0.06, 0.32, 0.02, MT.black, 2.6, 1.0, s * 1.15, 0.01); rbox(truck, 0.5, 0.06, 0.32, 0.02, MT.black, 2.6, 0.55, s * 1.15, 0.01); // steps
        rbox(truck, 0.06, 0.18, 0.4, 0.03, MT.lamp, 3.76, 1.45, s * 0.85, 0.01); rbox(truck, 0.06, 0.12, 0.16, 0.03, MT.amber, 3.76, 1.45, s * 1.13, 0.01);
      });
      rbox(truck, 0.2, 0.3, 2.5, 0.06, XM.dark, 3.8, 1.05, 0, 0.02); for (let i = 0; i < 3; i++) box(truck, 0.03, 0.06, 1.2, MT.chrome, 3.77, 1.55 + i * 0.12, 0);
      const bumperGun = grp(truck, 3.9, 1.25, 0); cylY(bumperGun, 0.12, 0.2, XM.dark, 0, 0, 0, 10); cylX(bumperGun, 0.05, 0.4, MT.chrome, 0.2, 0.08, 0, 8);
      // the body: lockers with roll-up shutters, a reflective band, rear ladder
      rbox(truck, 5.6, 2.45, 2.5, 0.25, XM.red, -1.3, 2.2, 0, 0.04); rbox(truck, 5.62, 0.22, 2.52, 0.04, XM.yel, -1.3, 1.4, 0, 0.01);
      [1, -1].forEach((s) => [[0.55, 0.9], [-0.6, 1.0], [-1.85, 1.0], [-3.1, 1.0]].forEach(([x, w]) => {
        rbox(truck, w, 1.4, 0.04, 0.05, XM.grey, x, 2.45, s * 1.25, 0.01); for (let y = 1.85; y < 3.15; y += 0.14) box(truck, w - 0.04, 0.02, 0.05, std(0x9aa0b0, 0.4, 0.5), x, y, s * 1.26);
        box(truck, 0.25, 0.04, 0.06, MT.chrome, x, 1.82, s * 1.27);
      }));
      rail(truck, [[-4.12, 0.9, 0.6], [-4.12, 3.45, 0.6]], 0.03, MT.steel); rail(truck, [[-4.12, 0.9, 0.2], [-4.12, 3.45, 0.2]], 0.03, MT.steel); for (let y = 1.1; y < 3.4; y += 0.3) rod(truck, new V3(-4.12, y, 0.6), new V3(-4.12, y, 0.2), 0.02, MT.steel);
      [0.95, -0.95].forEach((z) => rbox(truck, 0.06, 0.2, 0.25, 0.03, MT.tail, -4.12, 1.35, z, 0.01)); rbox(truck, 5.2, 0.05, 2.0, 0.02, XM.dark, -1.5, 3.44, 0, 0.01);
      const lights = []; [0.75, 0.25, -0.25, -0.75].forEach((z) => { const L = std(0x3a6aff, 0.3, 0, { emissive: 0x2a4aff, emissiveIntensity: 0.2 }); rbox(truck, 0.22, 0.16, 0.42, 0.05, L, 2.9, 3.53, z, 0.02); lights.push(L); });
      box(truck, 0.26, 0.08, 2.0, XM.dark, 2.9, 3.46, 0);
      const tw1 = []; [3.0, 0.4, -2.2].forEach((x) => [1, -1].forEach((s) => { tw1.push(tire(truck, 0.75, 0.5, x, 0.75, s * 1.15, XM.grey, s)); fender(truck, 0.86, 0.55, x, 0.75, s * 1.15, XM.dark, Math.PI * 0.55); }));
      const mon = grp(truck, 1.0, 3.42, 0); cylY(mon, 0.25, 0.4, XM.dark, 0, 0.2, 0, 12); const barrel = grp(mon, 0, 0.45, 0); cylX(barrel, 0.12, 1.4, XM.grey, 0.7, 0, 0, 10);
      const nozzle = anchor(barrel, 1.45, 0, 0);
      const DR = route([[-3, 0], [0.5, 0]], false, 0); placeOn(truck, DR, 0); const spinT = spin(st, truck, tw1, 0.75);
      part(st, 'canon', 'le canon à eau', anchor(barrel, 0.8, 0.4, 0), true);
      part(st, 'camion', 'le gros camion', anchor(truck, -1.5, 3.6, 1.2), true);
      part(st, 'exercice', "l'exercice", anchor(mock, 0, 2.6, 0), false);
      part(st, 'gyrophares', 'les gyrophares', anchor(truck, 2.9, 3.9, 0.75), false);
      st.focus = new V3(4.5, 2.4, -1); st.size = { w: 17, h: 9 }; st.tagAt = anchor(truck, 0, 5.4, 0);
      let T = 0, spray = 0;
      st.update = (dt) => {
        T += dt; spinT(); lights.forEach((L, i) => (L.emissiveIntensity = st.siren && Math.sin(T * 12 + i * Math.PI) > 0 ? 2.2 : 0.2));
        if (st.fire) for (let i = 0; i < 2; i++) fx.fire(wp(mock, 0).add(new V3(rnd(-2, 2), 1.2, rnd(-0.8, 0.8))), new V3(0, 1, 0), 3, 1.2, rnd(0.25, 0.5));
        if (st.water) { spray -= dt; if (spray <= 0) { spray = 0.03; const a = wp(nozzle, 0), dir = a.clone().sub(wp(barrel, 0)).normalize(); fx.smoke(a, dir.multiplyScalar(rnd(9, 12)).add(new V3(0, 2.5, 0)), rnd(0.2, 0.35), 0xd8f0ff, 0.9); } }
      };
      st.action = async function () {
        if (st.done) { placeOn(truck, DR, 0); barrel.rotation.set(0, 0, 0); mon.rotation.y = 0; st.done = false; }
        st.fire = true;
        await Promise.all([step("C'est un exercice : on allume un feu sur une fausse carcasse d'avion.", 'exercice'), sleep(1.5)]);
        engineOn(60); st.siren = true;
        const siren = setInterval(() => { tone(740, 0, 0.32, 'triangle', 0.05); tone(587, 0.36, 0.32, 'triangle', 0.05); }, 760);
        await Promise.all([step('Pin-pon ! Le gros camion arrive tout de suite.', 'camion'), along(truck, DR, 0, DR.len, 2.6, easeSine)]);
        clearInterval(siren); st.siren = false; engineOff();
        S.updateMatrixWorld(true);
        const tgt = truck.worldToLocal(wp(mock, 1.0)), mp = mon.position; const yaw = Math.atan2(-(tgt.z - mp.z), tgt.x - mp.x);
        await Promise.all([step('Son canon se tourne vers le feu.', 'canon'), to(mon.rotation, 'y', yaw, 1.2), to(barrel.rotation, 'z', 0.12, 1.2)]);
        st.water = true;
        await Promise.all([step("Pschhh ! Il lance de l'eau très loin.", 'canon'), sleep(2.2)]);
        st.fire = false;
        await Promise.all([step('Le feu est éteint. Bravo les pompiers !', 'exercice'), sleep(1.2)]);
        st.water = false; chime(); st.done = true;
      };
    })();

    buildLife(scene, onUpdate);
  }
};

/* ================= the airport around the machines ================= */
let RADAR = null;
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
function buildAirport(scene) {
  // terminal: long hall with glass front, roof, sign
  { const g = at(scene, -2, 14.5); rbox(g, 58, 5, 6.5, 0.1, XM.white, 0, 2.5, 0, 0.02); box(g, 56, 2.6, 0.06, XM.glass, 0, 2.6, -3.26); box(g, 56, 2.6, 0.06, XM.glass, 0, 2.6, 3.26);
    for (let x = -27; x <= 27; x += 3) box(g, 0.14, 3, 0.1, XM.grey, x, 2.6, -3.3);
    const roof = add(g, new THREE.CylinderGeometry(4.2, 4.2, 59, 24, 1, false, -Math.PI / 2.6, Math.PI / 1.3), std(0xd4d8e0, 0.3, 0.5)); roof.rotation.z = Math.PI / 2; roof.position.y = 3.1; roof.scale.z = 0.95;
    rbox(g, 9, 1.0, 0.2, 0.05, XM.blue, 0, 6.9, 3.6, 0.02); }
  // control tower beyond the runway
  { const g = at(scene, 0, -40); cylY(g, 1.4, 14, XM.white, 0, 7, 0, 16); cylY(g, 2.6, 0.4, XM.white, 0, 14.2, 0, 16); cylY(g, 2.4, 1.8, XM.glass, 0, 15.3, 0, 16); cylY(g, 2.7, 0.35, XM.blue, 0, 16.4, 0, 16);
    const radar = grp(g, 0, 17, 0); radar.userData.dynamic = true; RADAR = radar; rbox(radar, 2.4, 0.5, 0.1, 0.04, XM.white, 0, 0.3, 0, 0.01); cylY(g, 0.08, 0.6, XM.grey, 0, 16.8, 0, 6); }
  // fire station
  { const g = at(scene, -46, -1); rbox(g, 5, 4, 7, 0.1, XM.red, -2, 2, 0, 0.02); rbox(g, 5.2, 0.3, 7.2, 0.05, XM.white, -2, 4.1, 0, 0.02); box(g, 0.06, 3.2, 3, XM.dark, 0.52, 1.6, 0); }
  // hangar on the left
  { const g = at(scene, -36, -40); const hm = std(0xc9ccd8, 0.5, 0.4); add(g, new THREE.CylinderGeometry(6, 6, 12, 24, 1, false, -Math.PI / 2, Math.PI), hm).rotation.x = Math.PI / 2; box(g, 10, 5, 0.1, XM.dark, 0, 2.5, 6); }
  // fuel farm on the right
  [[40, -38], [44, -34]].forEach(([h, d]) => { const g = at(scene, h, d); cylY(g, 2.2, 3, XM.white, 0, 1.5, 0, 20); cylY(g, 2.25, 0.3, XM.red, 0, 2.6, 0, 20); });
  // runway lights, windsock
  for (let h = -50; h <= 50; h += 4) [-29.6, -22.4].forEach((d) => { const [x, z] = Q(h, d); const l = cylY(scene, 0.12, 0.25, std(0xffffff, 0.3, 0, { emissive: 0xfff0b0, emissiveIntensity: 0.8 }), x, 0.12, z, 6); l.castShadow = false; });
  { const g = at(scene, 20, -32); rod(g, new V3(0, 0, 0), new V3(0, 3.5, 0), 0.05, XM.grey); const s = add(g, new THREE.ConeGeometry(0.4, 2, 10, 1, true), std(0xf26a2a, 0.5, 0, { side: THREE.DoubleSide }), 1.0, 3.3, 0); s.rotation.z = Math.PI / 2 + 0.2; }
  // car park and trees on the land side
  for (let h = -26; h <= 26; h += 3.2) [26, 30].forEach((d) => { if (Math.random() < 0.75) { const c = miniCar(scene, pick(['car', 'kei', 'van', 'car'])); const [x, z] = Q(h, d); c.position.set(x, 0, z); c.rotation.y = YAW + Math.PI / 2 + (d > 28 ? Math.PI : 0); } });
  [[-36, 26], [-32, 30], [34, 26], [30, 32], [-40, 16], [42, 14], [-20, 36], [18, 36], [0, 36]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(scene, x, z, i % 2 ? [0x5aa85a, 0x4a9a4a, 0x6ab86a] : [0xf2b21c, 0xe8901e, 0xf6cf3a]); });
  for (let h = -40; h <= 40; h += 10) { const [x, z] = Q(h, 18.2); lamp(scene, x, z, YAW + Math.PI / 2); }
  return scene;
}

/* ================= life ================= */
function buildLife(scene, onUpdate) {
  const all = [];
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  // taxis and buses in front of the terminal
  const road = R([[-48, 19.9], [48, 19.9], [50, 21], [48, 22.1], [-48, 22.1], [-50, 21]], 0.1);
  const cars = ['taxi', 'van', 'taxi', 'car', 'kei', 'taxi'].map((k) => miniCar(scene, k, k === 'taxi' ? 0xf2f2f6 : undefined)); all.push(...cars);
  const t1 = traffic(road, cars, 3.6, { gap: 4 });
  // travellers on the sidewalk
  const walk = R([[-30, 17.6], [30, 17.6], [30, 18.6], [-30, 18.6]], 0.05);
  const folks = Array.from({ length: 8 }, (_, i) => walker(scene, 0, 0, { kid: i % 4 === 1 })); all.push(...folks);
  const t2 = traffic(walk, folks, 1.0, { gap: 1.2 });
  // an apron bus on the service road, far from the gates
  const apron = R([[22, 8.2], [46, 8.2], [46, 9.6], [22, 9.6]], 0.2);
  const bus = miniCar(scene, 'van', 0x2f6fe0); bus.scale.set(1.6, 1.2, 1.2); const t3 = traffic(apron, [bus], 2.6, { gap: 3 });
  // a plane flying in circles high up
  const sky = route([[-60, 10, 26], [0, -40, 30], [60, 10, 26], [0, 60, 24]], true, 0.5);
  const flyer = airliner(scene, { tail: XM.red }); flyer.userData.gear.forEach((g) => (g.visible = false)); flyer.scale.setScalar(0.6);
  let s = 0;
  const radar = RADAR;
  onUpdate((dt) => {
    t1.update(dt, all); t2.update(dt, all); t3.update(dt, [bus]);
    s += dt * 7; placeOn(flyer, sky, s); flyer.rotation.z = 0; flyer.rotation.x = -0.25;
    if (radar) radar.rotation.y += dt * 1.5;
  });
}
