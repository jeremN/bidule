// L'Énergie — the journey of electricity, from where it is made to the plug of a house.
// The dam, the wind turbine and the solar farm make it; the substation and the big pylons carry it;
// in the village a bucket truck repairs a line, an electric car charges, and a lamp lights up at home.
// Electricity is drawn as friendly glowing pulses running along the cables. Safety message: we never touch,
// only the grown-up technicians do.
import * as THREE from 'three';
import { V3, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, toonMat, add, box, grp, cylGeo, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, extY, anchor, wp, shadows, freeze, gearShape } from '../kit/geo.js';
import { tire, beacon, truckCab, fender, hydraulic, operator } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { autumnTree, cone, barn, silo, roundBaleStack } from '../kit/props.js';
import { route, placeOn, person as walker, miniCar, traffic } from '../kit/life.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const HD = (h, d, y = 0) => { const [x, z] = Q(h, d); return new V3(x, y, z); };

/* ================= palette (defined once, shared) ================= */
const EM = {
  conc: std(0xcfcabd, 0.92, 0), concD: std(0xa9a496, 0.92, 0), rock: std(0x8f8476, 0.95, 0), rockD: std(0x6e6458, 0.95, 0),
  grass: std(0x6aa84e, 0.95, 0), pine: std(0x2f6b3e, 0.9, 0), trunk: std(0x6b4a32, 0.9, 0), gravel: std(0xb8b2a4, 0.95, 0),
  water: std(0x3d84d6, 0.12, 0.25), foam: std(0xeef8ff, 0.5, 0),
  pipeGlass: std(0x7fc4f0, 0.05, 0.2, { transparent: true, opacity: 0.5, depthWrite: false }), pipe: std(0x4f6f96, 0.4, 0.55),
  white: std(0xf3f4f7, 0.35, 0.1), greyL: std(0xc9ced6, 0.45, 0.3), grey: std(0x9aa1ad, 0.5, 0.45), dark: std(0x2c303c, 0.55, 0.3),
  galva: std(0xaab3be, 0.42, 0.75), cable: std(0x2a2c34, 0.6, 0.2), tank: std(0x8a9a8e, 0.5, 0.35), copper: std(0xc87a3a, 0.35, 0.8),
  red: std(0xd8402a, 0.4, 0.2), orange: std(0xf06a22, 0.4, 0.15), yel: std(0xf4b81c, 0.4, 0.15), blue: std(0x2f62d8, 0.35, 0.2),
  green: std(0x3aa46a, 0.45, 0.15), greenD: std(0x2a7a4e, 0.5, 0.15), lime: std(0xb8d84a, 0.45, 0.1),
  glassIns: std(0x6fbfb4, 0.15, 0.15), porc: std(0x8a4a30, 0.3, 0.05),
  wood: std(0x8a6644, 0.85, 0), woodL: std(0xc39a68, 0.8, 0), asphalt: std(0x4a4d5a, 0.95, 0),
  wall: std(0xf2e6d0, 0.85, 0), wallB: std(0xe8d0b0, 0.85, 0), roof: std(0xc0583a, 0.75, 0), slate: std(0x4a5266, 0.7, 0.1),
  floor: std(0xc89a68, 0.8, 0), tile: std(0xe8e2d6, 0.6, 0), paperY: std(0xf8e8a8, 0.9, 0), paperB: std(0xbfe0f4, 0.9, 0), paperP: std(0xf8c8d8, 0.9, 0),
  rug: std(0x5a8ad8, 0.9, 0), sofa: std(0x3a8a7a, 0.9, 0), pink: std(0xf28ab0, 0.8, 0), wool: std(0xf4f1e8, 0.95, 0), sheepH: std(0x3a3436, 0.8, 0),
  cow: std(0xf6f4ee, 0.85, 0), cowD: std(0x2a2628, 0.85, 0), skin: MT.skin, black: MT.black
};
const GLOW = new THREE.MeshBasicMaterial({ color: 0xfff07a });            // the electricity pulses
const WATERM = new THREE.MeshBasicMaterial({ color: 0xc8ecff });          // water dashes inside the penstock
const SUNM = new THREE.MeshBasicMaterial({ color: 0xffd23a }), RAYM = new THREE.MeshBasicMaterial({ color: 0xffa83a });
/** A material that can light up (emissiveIntensity animated). */
const lit = (c, e) => toonMat({ color: c, emissive: e, emissiveIntensity: 0 });
const PANELTEX = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#18357e'; x.fillRect(0, 0, 64, 128); x.fillStyle = '#2a4fae';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) x.fillRect(2 + i * 10.3, 2 + j * 12.4, 9, 11);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(40, 0); x.lineTo(0, 70); x.fill();
  return new THREE.CanvasTexture(c);
})();
const PANEL = std(0xffffff, 0.22, 0.35, { map: PANELTEX, emissive: 0x2a5cff, emissiveIntensity: 0 });

/* shared geometries: insulators (ribbed column, glass disc), pulses, water dashes, pole */
const V2 = (a, b) => new THREE.Vector2(a, b);
const INS = (() => { const p = [V2(0.001, 0), V2(0.12, 0)]; for (let i = 0; i < 7; i++) { const y = 0.08 + i * 0.13; p.push(V2(0.09, y), V2(0.22, y + 0.03), V2(0.22, y + 0.055), V2(0.09, y + 0.09)); } p.push(V2(0.1, 1), V2(0.001, 1)); return new THREE.LatheGeometry(p, 12); })();
const DISC = new THREE.LatheGeometry([V2(0.001, 0), V2(0.05, 0), V2(0.07, 0.04), V2(0.2, 0.05), V2(0.21, 0.07), V2(0.06, 0.11), V2(0.04, 0.15), V2(0.001, 0.15)], 12);
const PULSE = new THREE.SphereGeometry(1, 10, 8);
const DASH = new THREE.CylinderGeometry(1, 1, 1, 8); DASH.rotateZ(Math.PI / 2);
const POLEG = new THREE.CylinderGeometry(0.085, 0.14, 1, 8); POLEG.translate(0, 0.5, 0);
const HEMI = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const PINE = new THREE.ConeGeometry(1, 1, 8); PINE.translate(0, 0.5, 0);

/* ================= the machines ================= */
const DATA = {
  barrage: { short: 'Le barrage', full: 'Le barrage hydroélectrique', verb: 'Ouvrir', horn: 'bell',
    use: "Il retient l'eau d'un grand lac, et il s'en sert pour fabriquer de l'électricité.",
    how: "L'eau descend très vite dans un gros tuyau et fait tourner une turbine, comme un moulin. La turbine fait tourner l'alternateur, qui fabrique l'électricité." },
  eolienne: { short: "L'éolienne", full: "L'éolienne", verb: 'Souffler', horn: 'bell',
    use: "Un très grand moulin à vent, qui fabrique de l'électricité.",
    how: 'Le vent pousse ses trois grandes pales. Tout en haut, dans la nacelle, des engrenages font tourner une génératrice.' },
  solaire: { short: 'Le solaire', full: 'La centrale solaire', verb: 'Briller', horn: 'bell',
    use: "Des panneaux qui changent la lumière du soleil en électricité.",
    how: "Les panneaux tournent doucement pour regarder le soleil toute la journée. Une grosse batterie garde l'électricité pour la nuit." },
  poste: { short: 'Le poste', full: 'Le poste électrique', verb: 'Allumer', horn: 'bell',
    use: "C'est le carrefour de l'électricité : elle arrive de partout, et elle repart vers le village.",
    how: "Son gros transformateur change l'électricité pour qu'elle voyage très loin. C'est dangereux : seuls les techniciens y entrent." },
  ligne: { short: 'Les pylônes', full: 'La ligne à haute tension', verb: 'Voyager', horn: 'bell',
    use: 'Les pylônes portent les câbles électriques très haut, au-dessus des champs.',
    how: "L'électricité voyage très vite dans les câbles. Les isolateurs en verre l'empêchent de descendre dans le pylône." },
  nacelle: { short: 'La nacelle', full: 'Le camion nacelle', verb: 'Réparer', horn: 'horn',
    use: 'Il monte un technicien tout en haut, pour réparer les câbles.',
    how: "Il pose ses pieds pour être bien stable. Puis son grand bras se déplie et monte la nacelle, comme un ascenseur." },
  borne: { short: 'La borne', full: 'La borne de recharge', verb: 'Recharger', horn: 'horn',
    use: "Elle donne de l'électricité aux voitures électriques.",
    how: "On branche un gros câble dans la voiture. L'électricité remplit sa batterie, comme quand on fait le plein." },
  maison: { short: 'La maison', full: 'La maison', verb: 'Éclairer', horn: 'bell',
    use: "C'est là que l'électricité finit son voyage : pour la lampe, le frigo et la veilleuse.",
    how: "Elle entre par le compteur, puis des fils cachés dans les murs l'emmènent partout. On n'y touche jamais !" }
};
const ORDER = ['barrage', 'eolienne', 'solaire', 'poste', 'ligne', 'nacelle', 'borne', 'maison'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const BOLT = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M3-9L-4 1h4l-3 8 8-11H4l3-7z" fill="#ffd23a" stroke="#2a2440" stroke-width="1.2" stroke-linejoin="round"/>`;
const ICONS = {
  barrage: `<path d="M0 26h44v50H0z" fill="#3f86d8"/><path d="M42 14h9l26 62H42z" class="c"/><path d="M58 40l18 22h16" stroke="#9fd8f4" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="84" y="46" width="30" height="30" class="w"/><circle cx="99" cy="62" r="8" class="r"/><path d="M99 54v16M91 62h16" stroke="#fff" stroke-width="2"/><path d="M78 76q20-4 42 0" stroke="#3f86d8" stroke-width="5" fill="none"/>`,
  eolienne: GND + `<path d="M56 75l2.5-46h3l2.5 46z" class="w"/><rect x="50" y="22" width="20" height="9" rx="3" class="w"/><circle cx="72" cy="26" r="4" class="k"/>
    <path d="M72 26L76 0l4 2zM72 26l24 14-3 3zM72 26L47 38l-1-4z" class="w"/>${BOLT(90, 64)}`,
  solaire: GND + `<circle cx="94" cy="18" r="10" fill="#ffd23a"/><path d="M94 2v-4M108 18h4M104 8l3-3M80 18h-4" stroke="#ffa83a" stroke-width="3" stroke-linecap="round"/>
    <path d="M8 58l22-14h30l-22 14zM44 66l22-14h30l-22 14z" class="b"/><path d="M28 51h18M64 59h18" stroke="#9fb8f0" stroke-width="1.5"/><path d="M28 58v17M80 66v9" stroke="#8d96a6" stroke-width="3"/>`,
  poste: GND + `<rect x="34" y="34" width="42" height="34" rx="3" class="s"/><path d="M28 38v28M82 38v28" stroke="#8d96a6" stroke-width="5"/><path d="M44 34V18M55 34V14M66 34V18" stroke="#8a4a30" stroke-width="5" stroke-linecap="round"/>
    <path d="M4 50h12M4 60h12M104 50h12M104 60h12M10 44v31M110 44v31" stroke="#8d96a6" stroke-width="2"/><path d="M48 46l14 0-7 12z" fill="#ffd23a" stroke="#2a2440" stroke-width="1.5"/>`,
  ligne: GND + `<path d="M40 75l14-42h12l14 42M45 60h30M49 48h22M54 33L40 16h40L66 33" fill="none" stroke="#8d96a6" stroke-width="3" stroke-linejoin="round"/><path d="M40 16h40" stroke="#8d96a6" stroke-width="4"/>
    <path d="M0 26q20 6 42-2M78 24q22 8 42 2M0 32q30 8 60 0t60 0" stroke="#2a2f40" stroke-width="1.5" fill="none"/><g fill="#fff07a" stroke="#d8a020"><circle cx="14" cy="29" r="3"/><circle cx="100" cy="29" r="3"/><circle cx="32" cy="36" r="3"/></g>`,
  nacelle: GND + `<rect x="6" y="46" width="62" height="16" rx="3" class="w"/><path d="M68 40h18l10 10v12H68z" class="w"/><rect class="g" x="74" y="44" width="12" height="8"/>
    <path d="M30 46L52 18l26-10" stroke="#f3f4f7" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M30 46L52 18l26-10" stroke="#c9ced6" stroke-width="2" fill="none"/><rect x="74" y="0" width="16" height="14" rx="2" class="y"/>
    <circle class="k" cx="22" cy="66" r="8"/><circle class="k" cx="84" cy="66" r="8"/><path d="M60 62h28" stroke="#f06a22" stroke-width="3"/>`,
  borne: GND + `<rect x="86" y="24" width="18" height="51" rx="4" class="w"/><rect x="90" y="30" width="10" height="12" rx="2" fill="#3aa46a"/><path d="M86 52q-14 0-20 12" stroke="#2a2f40" stroke-width="3" fill="none"/>
    <path d="M6 58q2-18 22-20h20q14 0 22 16l2 10H6z" fill="#4fb8e8"/><rect class="g" x="28" y="42" width="30" height="12" rx="3"/><circle class="k" cx="22" cy="66" r="7"/><circle class="k" cx="60" cy="66" r="7"/>${BOLT(95, 36, 0.6)}`,
  maison: GND + `<path d="M14 40L60 10l46 30" fill="#c0583a" stroke="#8a3a2a" stroke-width="2"/><rect x="20" y="38" width="80" height="37" fill="#f2e6d0"/><rect x="30" y="48" width="16" height="14" fill="#ffd96a"/><rect x="72" y="48" width="16" height="14" fill="#ffd96a"/>
    <rect x="52" y="52" width="14" height="23" fill="#8a6644"/><circle cx="38" cy="55" r="9" fill="#fff07a" opacity=".45"/>`
};

/* ================= layout (h along the screen in the overview, d from the back to the front) ================= */
const CFG = {
  barrage: CF(-26, -22), eolienne: CF(2, -28), solaire: CF(26, -20), poste: CF(-12, -2),
  ligne: CF(24, -2), nacelle: CF(3, 13), borne: CF(-26, 18), maison: CF(28, 22, 0.2)
};
/** World position of a point given in a station's own frame. */
const LW = (id, lx, ly, lz) => { const c = CFG[id], co = Math.cos(c.yaw), si = Math.sin(c.yaw); return new V3(c.x + lx * co + lz * si, ly, c.z - lx * si + lz * co); };
const RIVER = [[-10, -21.4], [-4, -18], [2, -14.5], [10, -11.5], [20, -10], [30, -8.5], [40, -5.5], [50, -2], [58, 0]];
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot: -Math.PI / 4, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
const road = (pts, w = 3, col = '#8a8678', al = 0.9) => GP.push({ pts: pts.map(([h, d]) => Q(h, d)), w, col, al });
// fields (a patchwork), the river with its banks, the village road and paths
rect(-40, -2, 16, 14, '#94b85a', 0.6); rect(-40, 8, 16, 6, '#b8a858', 0.55); rect(42, -6, 12, 10, '#c4a850', 0.6, 'rgba(150,110,40,.25)'); rect(42, 4, 12, 6, '#94b85a', 0.55);
rect(-2, -6, 14, 8, '#9cbc60', 0.45); rect(10, 4, 10, 6, '#a8c468', 0.4);
road(RIVER, 5.2, '#7a9a5a', 0.7); road(RIVER, 3.4, '#3d84d6', 1); road(RIVER, 1.2, '#6ab0f0', 0.6);
road([[-52, 13], [52, 13]], 3.6, '#5a5d6a', 1); for (let h = -48; h < 48; h += 4) rect(h, 13, 1.8, 0.16, '#f3efe2');
rect(-5, 15.3, 24, 1.3, '#7a7d88', 0.9); rect(-12, 17.2, 56, 1.2, '#c8c0b0', 0.8);
road([[-34, 13], [-30, 0], [-24, -10], [-19, -15], [-14, -20]], 1.8, '#c8b088', 0.85);
road([[-17, 13], [-17, 3]], 2.4, '#8a8678'); road([[24, 13], [24, 17]], 1.6, '#c8b088'); road([[42, 13], [43, 8]], 1.6, '#c8b088');
blob(16, 30, 5, 'rgba(230,205,150,.85)'); blob(-26, 18, 7, 'rgba(90,92,104,.6)'); blob(-12, -2, 9, 'rgba(180,176,160,.6)');
blob(-30, -22, 12, 'rgba(110,100,80,.35)'); blob(26, -20, 12, 'rgba(150,190,90,.4)');

/* ================= shared state of one world instance ================= */
let WIND = 0.2;      // 0..1, how hard the wind blows (all the wind turbines feel it)
const ATT = {};      // where the network wires attach on each station (world positions)
const LANES = {};    // pulse lanes the stations want to boost

/* ---------- glowing pulses running along polylines (one instanced mesh per system) ---------- */
const _o = new THREE.Object3D(), _p = new V3(), _t = new V3(), XAX = new V3(1, 0, 0);
function pulses(parent, max, m = GLOW, geo = PULSE) {
  const im = new THREE.InstancedMesh(geo, m, max); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.layers.set(1); im.userData.dynamic = true; parent.add(im);
  _o.position.set(0, 0, 0); _o.quaternion.identity(); _o.scale.set(0, 0, 0); _o.updateMatrix();
  for (let i = 0; i < max; i++) im.setMatrixAt(i, _o.matrix);
  const lanes = []; let used = 0, T = 0;
  const measure = (L) => { L.cum = [0]; for (let i = 1; i < L.pts.length; i++) L.cum.push(L.cum[i - 1] + L.pts[i].distanceTo(L.pts[i - 1])); L.len = Math.max(0.01, L.cum[L.cum.length - 1]); };
  const at = (L, s) => { let i = 1; while (i < L.cum.length - 1 && L.cum[i] < s) i++; const a = L.pts[i - 1], b = L.pts[i], sl = L.cum[i] - L.cum[i - 1] || 1; _p.lerpVectors(a, b, (s - L.cum[i - 1]) / sl); _t.subVectors(b, a).normalize(); };
  return {
    lanes,
    /** A lane along pts (in parent space). o: { gap, n, speed, size, stretch, on } */
    lane(pts, o = {}) {
      const L = { pts, speed: o.speed || 4, size: o.size || 0.16, stretch: o.stretch || 1, boost: 1, grow: 1, on: o.on !== false };
      measure(L); L.n = Math.max(0, Math.min(o.n || Math.max(2, Math.round(L.len / (o.gap || 2))), max - used));
      L.i0 = used; used += L.n; L.front = L.on ? 1e9 : -1; L.tail = 0; L.off = Math.random() * L.len; lanes.push(L); return L;
    },
    setPts(L, pts) { L.pts = pts; measure(L); },
    start(L) { if (L && !L.on) { L.on = true; L.front = 0; } },
    stop(L) { if (L && L.on) { L.on = false; L.tail = 0; } },
    update(dt) {
      T += dt;
      lanes.forEach((L) => {
        const sp = L.speed * L.boost; L.off = (L.off + sp * dt) % L.len;
        if (L.on) { L.front = L.front < L.len ? L.front + sp * dt : 1e9; } else if (L.tail <= L.len + 1) L.tail += sp * dt;
        for (let i = 0; i < L.n; i++) {
          const s = (L.off + (i * L.len) / L.n) % L.len;
          const vis = s <= L.front && (L.on || s >= L.tail);
          const sc = vis ? L.size * L.grow * Math.min(1, s / 0.4, (L.len - s) / 0.4) * (1 + 0.22 * Math.sin(T * 9 + i * 1.7)) : 0;
          if (sc > 0.002) { at(L, s); _o.position.copy(_p); _o.quaternion.setFromUnitVectors(XAX, _t); _o.scale.set(sc * L.stretch, sc, sc); } else _o.scale.set(0, 0, 0);
          _o.updateMatrix(); im.setMatrixAt(L.i0 + i, _o.matrix);
        }
      });
      im.instanceMatrix.needsUpdate = true;
    }
  };
}

/* ---------- wires ---------- */
function sag(a, b, droop, n = 10) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * droop; o.push(p); } return o; }
function wire(p, pts, r = 0.035, m = EM.cable) { return add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r, 5, false), m); }
const _ya = new V3(0, 1, 0), _dv = new V3();
function setRod(m, a, b, r) { _dv.subVectors(b, a); const L = _dv.length() || 0.001; m.scale.set(r, L, r); m.position.copy(a).addScaledVector(_dv, 0.5); m.quaternion.setFromUnitVectors(_ya, _dv.multiplyScalar(1 / L)); }
const V = (x, y, z) => new V3(x, y, z);

/* ================= the world ================= */
export default {
  id: 'energie', title: "L'Énergie", titleHtml: "L'<span>Énergie</span>",
  subtitle: "D'où vient l'électricité de la prise ? Du barrage, du vent et du soleil, jusqu'à la lampe de la maison.",
  welcome: "Bienvenue ! Suis le voyage de l'électricité. Touche une machine pour voir comment elle marche.",
  hint: 'Touche une machine pour la découvrir.', backLabel: 'Tout le voyage',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3L8 18h7l-2 11 11-16h-7z"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: 56, tufts: false, outerColor: 0x1e3a24,
  forest: { dark: [0x1f4a2a, 0x275a30, 0x1a3f26, 0x2f6a36, 0x22502c], bush: [0x4f8a3a, 0x5a9a44, 0x3f7a34, 0x6aa84a] },
  overview: { w: 96, h: 64, focus: [0, 3, -1] },
  ground: { base: ['#8cb862', '#6f9c4e', '#4a7638'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, roll, step, onUpdate } = ctx;
    WIND = 0.2;
    const fx = createFx(scene, 160); onUpdate((dt) => fx.update(dt));
    freeze(buildScenery(grp(scene)));
    const spin = (obj, wheels, R = 0.4) => { const prev = obj.position.clone(); return () => { const dx = obj.position.x - prev.x, dz = obj.position.z - prev.z, ry = obj.rotation.y; const d = dx * Math.cos(ry) - dz * Math.sin(ry); prev.copy(obj.position); if (d) wheels.forEach((w) => (w.rotation.z -= d / (w.userData.r || R))); }; };
    const along = (obj, r, s0, s1, d, ease = easeSine, yOff = 0) => tw(d, (k) => placeOn(obj, r, s0 + (s1 - s0) * k, yOff), ease);
    const walkTo = (o, x, z, dur, sp = 9) => { const x0 = o.position.x, z0 = o.position.z; o.rotation.y = Math.atan2(-(z - z0), x - x0); let ph = 0; return tw(dur, (k) => { o.position.x = x0 + (x - x0) * k; o.position.z = z0 + (z - z0) * k; ph += 0.016 * sp; if (o.userData.walk) o.userData.walk(k < 1 ? ph : 0); }, lin).then(() => o.userData.walk && o.userData.walk(0)); };
    const foam = (p, n = 1) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.6, 0.6), 0.1, rnd(-0.6, 0.6))), new V3(rnd(0.3, 1.2), rnd(0.3, 0.8), rnd(-0.3, 0.3)), rnd(0.25, 0.45), 0xeef8ff, 1); };

    /* ---- le barrage : l'eau du lac fait tourner la turbine ---- */
    (function () {
      const st = makeStation('barrage'), S = st.g, P = pulses(S, 40), Wt = pulses(S, 70, WATERM, DASH);
      const d = grp(S), WL = 5, PZ = -0.6, TX = 8.2, TY = 1.0, TZ = 0.6;
      // the high plateau that holds the lake (rocky cliffs, grass on top), the lake itself
      const plat = [[-17.5, -6.5], [-13, -8.8], [-5, -9.1], [-0.9, -9.1], [-0.9, 9.1], [-5, 9.0], [-11.5, 8.3], [-16.5, 5.5], [-18.6, 0]], cr = [2.4, 2.4, 2.4, 0, 0, 2.4, 2.4, 2.4, 2.4];
      extY(d, plat, cr, WL - 0.3, EM.rock, 0, (WL - 0.3) / 2, 0, 0.25);
      extY(d, plat, cr, 0.3, EM.grass, 0, WL - 0.15, 0, 0.08);
      const lake = [[-15.8, -5.2], [-12, -7.6], [-5, -7.8], [-1.0, -7.8], [-1.0, 7.8], [-5, 7.6], [-11, 6.9], [-15, 4.4], [-16.7, 0]];
      extY(d, lake, [1.8, 1.8, 1.8, 0, 0, 1.8, 1.8, 1.8, 1.8], 0.25, EM.water, 0, WL - 0.07, 0, 0.05);
      [[-3, -8.5], [-7, -8.6], [-10.5, -8.2], [-14, -7.2], [-17.3, -3], [-17.6, 2.4], [-15.6, 6.2], [-9, 8.1], [-12.5, 7.7]].forEach(([x, z], i) => { const s = 0.7 + (i % 3) * 0.25; add(d, PINE, EM.pine, x, WL, z).scale.set(s * 0.55, s * 2.2, s * 0.55); cylY(d, 0.08, 0.3, EM.trunk, x, WL + 0.1, z, 6); });
      [[-6, 9.6, 1.1], [-12, 9.0, 0.8], [-18.5, 4, 1.2], [-17, -7.5, 1.0], [-3, -9.8, 0.9], [-9, -9.6, 1.3]].forEach(([x, z, s]) => { const r = add(d, ICO, EM.rockD, x, s * 0.4, z); r.scale.set(s * 1.2, s * 0.8, s); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); });
      // the dam wall: vertical on the lake side, sloped on the valley side, with joints, a crest road, railings and lamps
      const DZ = 9.2, slope = (y) => 3.9 - (3.35 * y) / 6.0;
      ext(d, [[-1.15, 0], [3.9, 0], [0.55, 6.0], [0.55, 6.3], [-1.15, 6.3]], [0, 0, 0.1, 0, 0], DZ * 2, EM.conc, 0, 0, 0, 0.04);
      for (let z = -8; z <= 8; z += 2) { const j = box(d, 0.05, 6.87, 0.07, EM.concD, 2.225 + 0.018, 3.0 + 0.01, z); j.rotation.z = 0.5094; }
      [1.5, 3, 4.5].forEach((y) => box(d, 0.04, 0.05, DZ * 2, EM.concD, slope(y) + 0.02, y, 0));
      box(d, 1.55, 0.05, DZ * 2, EM.asphalt, -0.3, 6.32, 0);
      [-1.08, 0.48].forEach((x) => { for (let z = -DZ + 0.3; z <= DZ; z += 1.2) box(d, 0.05, 0.8, 0.05, EM.galva, x, 6.7, z); rail(d, [[x, 7.1, -DZ + 0.3], [x, 7.1, DZ - 0.3]], 0.03, EM.galva); rail(d, [[x, 6.8, -DZ + 0.3], [x, 6.8, DZ - 0.3]], 0.02, EM.galva); });
      [-6, 3.5, 7.5].forEach((z) => { cylY(d, 0.05, 1.8, EM.dark, 0.48, 7.2, z, 6); rbox(d, 0.35, 0.08, 0.14, 0.02, EM.dark, 0.3, 8.1, z); rbox(d, 0.18, 0.06, 0.12, 0.02, MT.lamp, 0.22, 8.04, z, 0.01); });
      rbox(d, 5.4, 6.6, 0.7, 0.1, EM.concD, 1.3, 3.3, -DZ - 0.35, 0.04); ext(d, [[-1.15, 0], [3.9, 0], [0.55, 6.0], [0.55, 6.5], [-1.15, 6.5]], 0.05, 0.5, EM.concD, 0, 0, DZ + 0.25, 0.03); // abutments
      { const gh = grp(d, -0.3, 6.35, -6.8); rbox(gh, 1.4, 1.5, 1.6, 0.05, EM.wall, 0, 0.75, 0); ext(gh, [[-0.9, 0], [0.9, 0], [0, 0.6]], 0.03, 1.9, EM.roof, 0, 1.5, 0, 0.02); box(gh, 0.04, 0.9, 0.5, EM.dark, 0.71, 0.5, 0.3); box(gh, 0.04, 0.4, 0.5, MT.glassD, 0.71, 1.0, -0.4); }
      // spillway chute, on the far side
      for (let i = 0; i < 9; i++) { const y = 0.25 + i * 0.66; rbox(d, 0.5, 0.12, 2.6, 0.02, EM.greyL, slope(y) - 0.1, y, -4.4, 0.01); }
      // the gate (vanne) of the penstock and its hoist on the crest
      const gate = grp(S, -1.3, 3.6, PZ); const GY0 = 3.6, GY1 = 7.7;
      rbox(gate, 0.2, 2.4, 1.7, 0.05, EM.yel, 0, 0, 0, 0.02); for (let k = -1; k <= 1; k++) box(gate, 0.24, 0.08, 1.6, EM.yelD || EM.orange, 0, k * 0.7, 0); rod(gate, V(0, 1.2, 0), V(0, 3.6, 0), 0.04, EM.dark);
      [-1.05, 1.05].forEach((dz) => rbox(d, 0.3, 3.0, 0.25, 0.03, EM.blue, -1.3, 7.8, PZ + dz, 0.02));
      rbox(d, 0.5, 0.35, 2.4, 0.05, EM.blue, -1.3, 9.4, PZ, 0.02); rbox(d, 0.7, 0.55, 0.7, 0.06, EM.yel, -1.3, 9.85, PZ, 0.02); cylX(d, 0.14, 0.4, EM.dark, -0.85, 9.85, PZ, 10);
      // the penstock (transparent, to see the water inside), its rings and saddles
      const pc = new THREE.CatmullRomCurve3([V(0.4, 5.55, PZ), V(1.6, 5.1, PZ), V(3.5, 1.7, PZ), V(4.4, 1.04, PZ), V(5.4, 1.0, PZ), V(TX, TY, PZ)], false, 'catmullrom', 0.2);
      add(S, new THREE.TubeGeometry(pc, 60, 0.42, 14, false), EM.pipeGlass);
      for (let u = 0.08; u < 0.97; u += 0.075) { const p = pc.getPointAt(u), t = pc.getTangentAt(u); const r = add(d, new THREE.TorusGeometry(0.44, 0.045, 6, 18), EM.pipe, p.x, p.y, p.z); r.quaternion.setFromUnitVectors(new V3(0, 0, 1), t); }
      [0.3, 0.5, 0.68].forEach((u) => { const p = pc.getPointAt(u); rbox(d, 0.5, 0.5, 0.9, 0.05, EM.concD, p.x - 0.22, p.y - 0.42, PZ, 0.02); });
      [5.0, 6.4].forEach((x) => rbox(d, 0.5, 0.6, 0.9, 0.04, EM.concD, x, 0.3, PZ, 0.02));
      // the powerhouse, cut open on the front to see inside
      const PH = grp(d, 0, 0, 0), X0 = 5.2, X1 = 11.6, Z0 = -2.6, Z1 = 3.4, H = 5.6;
      rbox(PH, X1 - X0, H, 0.3, 0.03, EM.wall, (X0 + X1) / 2, H / 2, Z0, 0.02);
      [X0, X1].forEach((x) => { rbox(PH, 0.3, H, Z1 - Z0, 0.03, EM.wall, x, H / 2, (Z0 + Z1) / 2, 0.02); [-0.9, 1.4].forEach((z) => { rbox(PH, 0.06, 1.6, 1.4, 0.03, MT.glassD, x + Math.sign(x - 8) * 0.14, 3.7, z, 0.01); }); });
      rbox(PH, X1 - X0 + 0.5, 0.35, Z1 - Z0 + 0.3, 0.04, EM.concD, (X0 + X1) / 2, H + 0.15, (Z0 + Z1) / 2 - 0.15, 0.02);
      rbox(PH, X1 - X0 - 0.3, 0.22, Z1 - Z0 - 0.2, 0.03, EM.tile, (X0 + X1) / 2, 2.0, (Z0 + Z1) / 2 + 0.1, 0.02); // generator hall floor
      rbox(PH, X1 - X0 + 0.3, 0.12, Z1 - Z0, 0.02, EM.concD, (X0 + X1) / 2, 0.06, (Z0 + Z1) / 2, 0.01);
      rbox(PH, X1 - X0 + 0.32, 0.26, 0.32, 0.02, EM.red, (X0 + X1) / 2, H - 0.3, Z1 - 0.05, 0.01); // the cut edge, painted
      box(PH, 0.04, 0.8, 1.4, MT.black, X1 + 0.16, 0.45, TZ); // tailrace outlet
      // gantry crane inside, a control desk with its operator
      [Z0 + 0.25, Z1 - 0.35].forEach((z) => box(PH, X1 - X0 - 0.4, 0.14, 0.14, EM.dark, (X0 + X1) / 2, 4.8, z));
      rbox(PH, 0.35, 0.4, Z1 - Z0 - 0.6, 0.04, EM.yel, 9.9, 5.0, (Z0 + Z1) / 2, 0.02); rbox(PH, 0.5, 0.3, 0.5, 0.04, EM.dark, 9.9, 4.7, 0.8, 0.02); rod(PH, V(9.9, 4.55, 0.8), V(9.9, 3.9, 0.8), 0.02, EM.dark); add(PH, new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), EM.dark, 9.9, 3.85, 0.8).rotation.z = Math.PI;
      rbox(PH, 1.5, 0.9, 0.6, 0.04, EM.greyL, 6.3, 2.55, -1.9, 0.02); [6.0, 6.6].forEach((x) => { const s = rbox(PH, 0.5, 0.36, 0.04, 0.02, lit(0x6ab0f0, 0x3a7ad8), x, 3.25, -2.1, 0.01); s.material.emissiveIntensity = 0.6; });
      operator(PH, 6.3, 2.1, -1.0).rotation.y = Math.PI / 2;
      // the turbine (half of its spiral case cut away), the shaft and the alternator: they turn together
      const casing = add(d, new THREE.TorusGeometry(1.2, 0.4, 10, 24, Math.PI), EM.pipe, TX, TY, TZ); casing.rotation.x = -Math.PI / 2;
      cylY(d, 0.55, 0.9, EM.pipe, TX, 0.45, TZ, 16);
      const rot = grp(S, TX, 0, TZ); rot.userData.dynamic = true;
      { const run = grp(rot, 0, TY, 0); cylY(run, 0.78, 0.1, EM.copper, 0, 0.32, 0, 20); cylY(run, 0.66, 0.08, EM.copper, 0, -0.3, 0, 20); add(run, new THREE.ConeGeometry(0.25, 0.5, 12), EM.copper, 0, -0.1, 0).rotation.x = Math.PI;
        for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, b = grp(run); b.rotation.y = a; const bl = box(b, 0.42, 0.56, 0.05, EM.copper, 0.45, 0, 0); bl.rotation.y = 0.6; } }
      cylY(rot, 0.12, 2.9, EM.steel, 0, 2.3, 0, 10);
      { const rr = grp(rot, 0, 2.75, 0); cylY(rr, 1.0, 1.1, EM.dark, 0, 0, 0, 24); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rbox(rr, 0.2, 1.0, 0.24, 0.04, EM.copper, Math.cos(a) * 0.98, 0, Math.sin(a) * 0.98, 0.02).rotation.y = -a; }
        cylY(rr, 0.94, 0.06, EM.greyL, 0, 0.57, 0, 24); [0, Math.PI / 2].forEach((a) => { box(rr, 1.8, 0.04, 0.22, EM.yel, 0, 0.61, 0).rotation.y = a; }); cylY(rr, 0.28, 0.5, EM.red, 0, 0.85, 0, 14); }
      const stator = add(d, new THREE.LatheGeometry([V2(1.06, -0.6), V2(1.48, -0.6), V2(1.48, 0.6), V2(1.06, 0.6), V2(1.06, -0.6)], 32), EM.blue, TX, 2.75, TZ);
      add(d, new THREE.TorusGeometry(1.28, 0.12, 6, 32), EM.orange, TX, 3.36, TZ).rotation.x = Math.PI / 2; void stator;
      rail(d, [[TX - 1.9, 2.9, TZ + 1.9], [TX + 1.9, 2.9, TZ + 1.9]], 0.025, EM.yel); [TX - 1.9, TX, TX + 1.9].forEach((x) => box(d, 0.04, 0.8, 0.04, EM.yel, x, 2.5, TZ + 1.9));
      // tailrace and the river, the step-up transformer and the gantry where the line starts
      rbox(d, 6.5, 0.12, 3.2, 0.05, EM.water, 14.6, 0.06, TZ, 0.02); [TZ - 1.75, TZ + 1.75].forEach((z) => rbox(d, 6.2, 0.5, 0.3, 0.05, EM.concD, 14.5, 0.25, z, 0.02));
      const TR = grp(d, 13.8, 0, -3.0); rbox(TR, 1.8, 0.3, 1.4, 0.04, EM.conc, 0, 0.15, 0); rbox(TR, 1.4, 1.4, 1.0, 0.06, EM.tank, 0, 1.0, 0, 0.02); for (let i = 0; i < 6; i++) box(TR, 0.04, 1.0, 0.5, EM.tank, -0.55 + i * 0.22, 0.95, 0.75);
      [-0.45, 0, 0.45].forEach((x) => { add(TR, INS, EM.porc, x, 1.7, 0).scale.set(0.6, 0.7, 0.6); }); danger(TR, 0, 1.2, 0.51, 0.7);
      [12.4, 15.2].forEach((x) => latticePost(d, x, -3.9, 6.4)); latticeBeam(d, V(12.2, 6.3, -3.9), V(15.4, 6.3, -3.9));
      const gAtt = [12.9, 13.8, 14.7].map((x) => { for (let i = 0; i < 4; i++) add(d, DISC, EM.glassIns, x, 6.05 - i * 0.17, -3.9); return V(x, 5.3, -3.9); });
      ATT.barrage = gAtt.map((v) => LW('barrage', v.x, v.y, v.z));
      const cablePts = [V(TX + 1.5, 2.8, TZ - 0.4), V(X1 - 0.3, 3.6, -1.6), V(X1 + 0.6, 3.4, -1.6), V(13.8, 2.0, -2.6), V(13.8, 2.2, -3.0), V(13.8, 5.3, -3.9)];
      wire(d, cablePts, 0.05, EM.cable);
      gAtt.forEach((v, i) => i !== 1 && wire(d, [V(13.8 + (v.x - 13.8) * 0.5, 2.4, -3.0), V(v.x, 4.4, -3.6), v], 0.03, EM.cable));
      const out = P.lane(cablePts, { gap: 0.8, speed: 3.5, size: 0.14, on: false });
      // the water path: down the penstock, around the spiral, through the runner, out to the river
      const wpts = pc.getSpacedPoints(40); for (let a = Math.PI / 2; a >= 0; a -= Math.PI / 8) wpts.push(V(TX + Math.sin(a) * 1.2 * 0 + Math.cos(a) * 1.2, TY, TZ - Math.sin(a) * 1.2));
      wpts.push(V(TX, TY, TZ), V(TX, 0.35, TZ), V(X1 + 0.3, 0.25, TZ), V(X1 + 6, 0.2, TZ));
      const water = Wt.lane(wpts, { gap: 0.55, speed: 6, size: 0.12, stretch: 3.2, on: false });
      // a little rowing boat on the lake
      const boat = grp(S, -9, WL + 0.02, 1.5); boat.userData.dynamic = true;
      ext(boat, [[-0.9, 0], [0.7, 0], [1.1, 0.35], [-1.0, 0.35]], 0.08, 0.8, EM.red, 0, 0, 0, 0.03); rbox(boat, 0.2, 0.06, 0.78, 0.02, EM.woodL, 0, 0.3, 0);
      const fisher = walker(boat, -0.2, 0, { top: 0x3aa46a, hat: EM.yel }); fisher.position.y = -0.25; fisher.scale.setScalar(0.85); rod(boat, V(0, 0.8, 0.2), V(1.6, 1.6, 0.9), 0.012, EM.dark);
      freeze(d);
      const zoomA = anchor(S, TX - 0.2, 2.0, TZ), SZ = { w: 27, h: 12.5 };
      part(st, 'lac', 'le lac', anchor(S, -8, WL + 0.6, 4), true);
      part(st, 'vanne', 'la vanne', anchor(gate, 0, 1.3, 0.9), false);
      part(st, 'conduite', 'le gros tuyau', anchor(S, 2.7, 3.4, PZ + 0.4), true);
      part(st, 'turbine', 'la turbine', anchor(S, TX + 0.5, TY, TZ + 0.8), false);
      part(st, 'alternateur', "l'alternateur", anchor(S, TX + 1.2, 3.4, TZ + 1.2), true);
      part(st, 'riviere', 'la rivière', anchor(S, 15.5, 0.4, TZ + 1.4), false);
      st.focus = new V3(2, 3.2, 0); st.size = SZ; st.az = YAW + 0.5; st.tagAt = anchor(S, 2, 9.5, 0);
      let rpm = 0, T = 0;
      st.update = (dt) => {
        T += dt; rot.rotation.y += dt * rpm; P.update(dt); Wt.update(dt);
        boat.position.set(-8.5 + Math.cos(T * 0.12) * 3.5, WL + 0.02 + Math.sin(T * 1.3) * 0.03, 1 + Math.sin(T * 0.12) * 3); boat.rotation.y = -T * 0.12 + Math.PI; boat.rotation.z = Math.sin(T * 1.1) * 0.04;
        if (rpm > 1 && Math.random() < 0.5) foam(S.localToWorld(new V3(X1 + 0.6, 0.15, TZ)), 1);
      };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step("On referme la vanne : tout s'arrête doucement.", 'vanne'), to(gate.position, 'y', GY0, 2.2, easeSine), tw(2.4, (k) => (rpm = 6 * (1 - k)), lin)]);
          Wt.stop(water); P.stop(out); rpm = 0; st.done = false; await sleep(1.2);
        }
        await Promise.all([step("Là-haut, le grand lac garde beaucoup, beaucoup d'eau.", 'lac'), sleep(1.2)]);
        tone(220, 0, 2.5, 'triangle', 0.03, 90);
        await Promise.all([step("On ouvre la vanne : l'eau descend très vite dans le gros tuyau !", 'conduite'), to(gate.position, 'y', GY1, 2.4, easeSine), sleep(0.9).then(() => Wt.start(water))]);
        st.focusAt = zoomA; st.size = { w: 10, h: 7 };
        await Promise.all([step("L'eau fait tourner la turbine, comme un moulin.", 'turbine'), tw(3, (k) => (rpm = 6 * k), lin)]);
        await Promise.all([step("La turbine fait tourner l'alternateur. Et hop : il fabrique de l'électricité !", 'alternateur'), sleep(1.4).then(() => { P.start(out); ding(); })]);
        st.focusAt = null; st.size = SZ;
        await Promise.all([step("L'électricité part dans les câbles. L'eau, elle, retourne dans la rivière.", 'riviere'), sleep(1.5)]);
        chime(); st.done = true;
      };
    })();

    /* ---- l'éolienne ---- */
    (function () {
      const st = makeStation('eolienne'), S = st.g, P = pulses(S, 40);
      const E = turbine(S, true), FEATHER = 0.05, WORK = 1.3;
      E.yaw.rotation.y = 0.9; E.pitch.forEach((p) => (p.rotation.y = FEATHER));
      const d = grp(S);
      // the delivery kiosk at the foot and the first pole of the line
      const K = grp(d, 2.8, 0, 1.8); rbox(K, 1.8, 2.2, 1.3, 0.05, EM.white, 0, 1.1, 0, 0.02); rbox(K, 2.0, 0.15, 1.5, 0.04, EM.greenD, 0, 2.27, 0, 0.02); box(K, 0.6, 1.4, 0.04, EM.greenD, -0.3, 0.75, 0.66); for (let i = 0; i < 4; i++) box(K, 0.5, 0.04, 0.04, EM.grey, 0.45, 0.6 + i * 0.12, 0.67); danger(K, -0.3, 1.7, 0.69, 0.5);
      const pole = mvPole(d); pole.g.position.set(4.6, 0, 3.4);
      ATT.eolienne = pole.att.map((v) => LW('eolienne', v.x + 4.6, v.y, v.z + 3.4));
      freeze(d);
      const lanePts = [V(-1.4, TH + 0.85, 0.2), V(-0.3, TH + 0.6, 0.3), V(0, TH - 0.2, 0.39), V(0, TH * 0.66, 0.48), V(0, TH * 0.33, 0.56), V(0, 0.9, 0.6), V(0.4, 0.12, 1.1), V(2.0, 0.12, 1.6), V(2.6, 2.3, 1.8), V(4.6, 2.6, 3.0), V(4.6, 7.9, 3.4)];
      const out = P.lane(lanePts, { gap: 0.9, speed: 3.5, size: 0.14, on: false });
      // wind streaks
      const SM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
      const streaks = Array.from({ length: 14 }, () => { const m = add(S, DASH, SM); m.layers.set(1); m.visible = false; return { m, t: 1 + Math.random() }; });
      part(st, 'nacelle', 'la nacelle', anchor(E.yaw, -0.6, 1.05, 0.75), true);
      part(st, 'pales', 'les pales', anchor(E.yaw, 1.6, 3.6, 0.3), true);
      part(st, 'generatrice', 'la génératrice', anchor(E.yaw, -1.45, 1.2, 0.45), false);
      part(st, 'mat', 'le mât', anchor(S, 0, 5.2, 0.6), true);
      part(st, 'vent', 'le vent', anchor(S, 9, 13, 2.5), false);
      const SZ = { w: 17, h: 21 }, zoom = anchor(E.yaw, -0.3, 0.7, 0);
      st.focus = new V3(0.5, 9, 0); st.size = SZ; st.az = YAW + 0.45; st.tagAt = anchor(S, 0, TH + 7.2, 0);
      let rpm = 0;
      st.update = (dt) => {
        E.hub.rotation.x -= dt * rpm; E.slow.rotation.x -= dt * rpm; E.fast.forEach((f) => (f.rotation.x -= dt * rpm * 6)); P.update(dt);
        streaks.forEach((s) => {
          s.t += dt * 0.55;
          if (s.t >= 1) { if (WIND < 0.4 || Math.random() > 0.3) { s.m.visible = false; s.t = 0.999; return; } s.t = 0; s.y = rnd(5, 18); s.z = rnd(-6, 6); s.m.visible = true; }
          const k = s.t, x = 15 - 26 * k; s.m.position.set(x, s.y + Math.sin(k * 6 + s.z) * 0.3, s.z); s.m.scale.set(1.6 * Math.sin(k * Math.PI) + 0.01, 0.04, 0.04);
        });
      };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step("Le vent se calme. L'éolienne se repose.", 'pales'), tw(2.5, (k) => (rpm = 1.4 * (1 - k)), lin), tw(2.5, (k) => E.pitch.forEach((p) => (p.rotation.y = WORK + (FEATHER - WORK) * k))), to(E.yaw.rotation, 'y', 0.9, 2.5, easeSine)]);
          P.stop(out); WIND = 0.2; rpm = 0; st.done = false; await sleep(0.8);
        }
        WIND = 1; tone(300, 0, 2.2, 'sine', 0.02, 180);
        await Promise.all([step("Le vent se lève ! L'éolienne tourne sa tête face au vent.", 'vent'), to(E.yaw.rotation, 'y', 0, 3.2, easeSine)]);
        await Promise.all([step('Ses grandes pales pivotent, pour bien attraper le vent.', 'pales'), tw(2.2, (k) => E.pitch.forEach((p) => (p.rotation.y = FEATHER + (WORK - FEATHER) * k)))]);
        await Promise.all([step("Le vent pousse les pales, et l'hélice se met à tourner.", 'pales'), tw(3, (k) => (rpm = 1.4 * k), lin)]);
        st.focusAt = zoom; st.size = { w: 7, h: 5 };
        await Promise.all([step('Dans la nacelle, des engrenages font tourner la génératrice très, très vite.', 'generatrice'), to(E.cover.rotation, 'x', -1.9, 1.6, easeSine)]);
        await sleep(0.6); P.start(out); ding();
        await to(E.cover.rotation, 'x', 0, 1.4, easeSine);
        st.focusAt = null; st.size = SZ;
        await Promise.all([step("Elle fabrique de l'électricité, qui descend dans le mât jusqu'au câble.", 'mat'), sleep(1.5)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la centrale solaire ---- */
    (function () {
      const st = makeStation('solaire'), S = st.g, P = pulses(S, 70), d = grp(S);
      const ROWS = [-4.6, 0, 4.6], tables = [];
      ROWS.forEach((z) => [-4.5, 4.5].forEach((x) => tables.push({ t: trackerTable(d, x, z), z })));
      // fence, the inverter, the battery container (with its gauge), and the first pole of the line
      [[-9.8, -7.4, 9.8, -7.4], [9.8, -7.4, 9.8, 7.4], [9.8, 7.4, -9.8, 7.4]].forEach(([x0, z0, x1, z1]) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.4); for (let i = 0; i <= n; i++) cylY(d, 0.04, 1.4, EM.galva, x0 + ((x1 - x0) * i) / n, 0.7, z0 + ((z1 - z0) * i) / n, 6); [0.5, 1.0, 1.35].forEach((y) => rod(d, V(x0, y, z0), V(x1, y, z1), 0.012, EM.galva, 4)); });
      const INV = grp(d, -12, 0, -3.2); rbox(INV, 2.2, 0.2, 1.4, 0.04, EM.conc, 0, 0.1, 0); rbox(INV, 1.3, 1.8, 0.8, 0.05, EM.greyL, 0, 1.1, 0, 0.02); for (let i = 0; i < 5; i++) box(INV, 0.8, 0.04, 0.04, EM.grey, 0, 0.5 + i * 0.12, 0.41); rbox(INV, 0.4, 0.25, 0.04, 0.02, lit(0x6ab0f0, 0x3a7ad8), 0.25, 1.6, 0.41, 0.01).material.emissiveIntensity = 0.5; danger(INV, -0.35, 1.55, 0.42, 0.4);
      const C = grp(d, -13.8, 0, 1.9); const gauge = container(C);
      const pole = mvPole(d); pole.g.position.set(-17.8, 0, -2); pole.g.rotation.y = 0.4; pole.g.updateMatrix();
      ATT.solaire = pole.att.map((v) => { const w = v.clone().applyAxisAngle(_ya, 0.4); return LW('solaire', w.x - 17.8, w.y, w.z - 2); });
      // the sheep that keep the grass short between the panels
      const sheep = [[-6.5, 6.4, 0.4], [1.5, 6.6, 2.6], [9.2, 2.3, -1.2], [-3.5, 6.5, 1.8], [-9.1, -2.3, 3.4]].map(([x, z, r]) => sheepM(S, x, z, r));
      freeze(d);
      // the sun (a friendly one), hidden until the story
      const sun = grp(S, 0, 4, -12); sun.visible = false; sun.userData.dynamic = true;
      sph(sun, 1.1, SUNM, 0, 0, 0); const rays = grp(sun); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, c = add(rays, new THREE.ConeGeometry(0.22, 0.7, 6), RAYM, Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0); c.rotation.z = a - Math.PI / 2; }
      [0.38, -0.38].forEach((x) => sph(sun, 0.12, MT.black, x, 0.25, 1.0)); const smile = add(sun, new THREE.TorusGeometry(0.42, 0.06, 6, 16, Math.PI), MT.black, 0, -0.05, 1.0); smile.rotation.z = Math.PI;
      const sunAt = (ph) => sun.position.set(0, 1.5 + 12.5 * Math.cos(ph), 12.5 * Math.sin(ph));
      // pulses: each row to the inverter, inverter to the battery, and out to the line
      const rowL = ROWS.map((z) => P.lane([V(8.6, 1.5, z + 0.12), V(-8.7, 1.5, z + 0.12), V(-9.3, 0.12, z + 0.4), V(-9.4, 0.12, -2.6), V(-11.3, 1.0, -2.8)], { gap: 1.3, speed: 4, size: 0.13, on: false }));
      const batL = P.lane([V(-12.2, 1.2, -2.8), V(-12.3, 0.12, -2.2), V(-12.4, 0.12, 0.6), V(-12.6, 1.0, 0.75)], { gap: 0.8, speed: 3, size: 0.13, on: false });
      const outL = P.lane([V(-12.6, 1.4, -3.6), V(-13.5, 0.12, -3.6), V(-17.6, 0.12, -2.2), V(-17.8, 7.9, -2.0)], { gap: 0.9, speed: 3.5, size: 0.14, on: false });
      part(st, 'panneaux', 'les panneaux solaires', anchor(S, 4.5, 2.4, 4.9), true);
      part(st, 'soleil', 'le soleil', anchor(sun, 0, -1.6, 0), false);
      part(st, 'onduleur', "l'onduleur", anchor(S, -12, 2.1, -2.8), false);
      part(st, 'batterie', 'la grosse batterie', anchor(S, -13.8, 2.8, 3.1), true);
      part(st, 'moutons', 'les moutons', anchor(sheep[0], 0, 0.9, 0), true);
      st.focus = new V3(-5, 4.5, 0); st.size = { w: 30, h: 16 }; st.tagAt = anchor(S, -2, 5.5, 0);
      let track = 0, T = 0;
      st.update = (dt) => {
        T += dt; P.update(dt); rays.rotation.z += dt * 0.4;
        tables.forEach(({ t, z }) => { const a = clamp(Math.atan2(sun.position.z - z, sun.position.y - 1.55), -1.0, 1.0); t.rotation.x = a * track; });
        sheep.forEach((s, i) => { s.userData.head.rotation.z = -0.5 + Math.sin(T * 1.3 + i * 2) * 0.35; });
      };
      const setGauge = (n) => gauge.forEach((m, i) => (m.emissiveIntensity = i < n ? 1.2 : 0));
      st.action = async function () {
        if (st.done) { rowL.forEach((l) => P.stop(l)); P.stop(outL); P.stop(batL); setGauge(0); track = 0; st.done = false; await sleep(0.4); }
        sun.visible = true; sunAt(-1.3); sun.scale.setScalar(0.01); pop(sun, 0.8);
        await Promise.all([step('Le matin, le soleil se lève.', 'soleil'), tw(2.5, (k) => sunAt(-1.3 + 0.35 * k), easeSine)]);
        await Promise.all([step('Les panneaux solaires tournent pour le regarder.', 'panneaux'), tw(2.5, (k) => (track = k), easeSine)]);
        rowL.forEach((l, i) => setTimeout(() => P.start(l), i * 300)); PANEL.emissiveIntensity = 0;
        await Promise.all([step("Sa lumière devient de l'électricité !", 'panneaux'), tw(3.5, (k) => { sunAt(-0.95 + 0.95 * k); PANEL.emissiveIntensity = 0.55 * Math.min(1, k * 2); }, easeSine)]);
        P.start(batL);
        await Promise.all([step("La grosse batterie se remplit. Elle garde l'électricité pour la nuit.", 'batterie'), tw(4, (k) => { sunAt(0.8 * k); setGauge(Math.floor(k * 4.99)); }, lin)]);
        P.start(outL);
        await Promise.all([step("Le soir, le soleil se couche… et la batterie donne l'électricité gardée.", 'batterie'),
          tw(4, (k) => { sunAt(0.8 + 0.6 * k); PANEL.emissiveIntensity = 0.55 * (1 - k); setGauge(4 - Math.floor(k * 2.5)); if (k > 0.6) track = Math.max(0, 1 - (k - 0.6) * 2.5); }, easeSine)]);
        rowL.forEach((l) => P.stop(l)); P.stop(batL);
        await tw(0.6, (k) => sun.scale.setScalar(Math.max(0.01, 1 - k))); sun.visible = false; track = 0;
        chime(); st.done = true;
      };
    })();

    /* ---- le poste électrique ---- */
    (function () {
      const st = makeStation('poste'), S = st.g, P = pulses(S, 120), d = grp(S);
      rbox(d, 16.4, 0.08, 11.2, 0.1, EM.gravel, 0, 0.04, -0.25, 0.02);
      // fence all round with a gate in front, and the danger signs
      const FX = 8.2, FZ0 = -5.8, FZ1 = 5.3;
      const fenceSeg = (x0, z0, x1, z1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6)); for (let i = 0; i <= n; i++) cylY(d, 0.05, 2.1, EM.galva, x0 + ((x1 - x0) * i) / n, 1.05, z0 + ((z1 - z0) * i) / n, 6); [0.15, 0.7, 1.25, 1.8, 2.05].forEach((y) => rod(d, V(x0, y, z0), V(x1, y, z1), y > 2 || y < 0.2 ? 0.03 : 0.012, EM.galva, 4)); };
      fenceSeg(-FX, FZ0, FX, FZ0); fenceSeg(FX, FZ0, FX, FZ1); fenceSeg(-FX, FZ0, -FX, FZ1); fenceSeg(-FX, FZ1, -6.4, FZ1); fenceSeg(-4.2, FZ1, FX, FZ1);
      const gate = grp(S, -6.4, 0, FZ1); gate.userData.dynamic = true; rail(gate, [[0.05, 0.15, 0], [0.05, 1.95, 0], [2.1, 1.95, 0], [2.1, 0.15, 0], [0.05, 0.15, 0]], 0.035, EM.galva); for (let x = 0.3; x < 2.1; x += 0.25) rod(gate, V(x, 0.15, 0), V(x, 1.95, 0), 0.012, EM.galva, 4); const gsign = danger(gate, 1.1, 1.3, 0.04, 0.8);
      const signs = [danger(S, 0, 1.5, FZ1 + 0.04, 0.9), danger(S, 5, 1.5, FZ1 + 0.04, 0.9)];
      // the big transformer (it hums a little when working)
      const T = grp(S, 0, 0, 0.4); transformerM(T); T.userData.dynamic = true;
      // incoming gantry at the back (three lines), outgoing gantry on the right, busbars, breakers
      [-7.6, -2.8, 2.8, 7.6].forEach((x) => latticePost(d, x, -4.9, 7.1)); latticeBeam(d, V(-7.8, 7.0, -4.9), V(7.8, 7.0, -4.9));
      [-3.4, 3.4].forEach((z) => latticePost(d, 7.2, z, 7.3)); latticeBeam(d, V(7.2, 7.2, -3.6), V(7.2, 7.2, 3.6));
      const inX = [[-6.6, -5.6, -4.6], [-1, 0, 1], [4.6, 5.6, 6.6]], inAtt = inX.map((xs) => xs.map((x) => { for (let i = 0; i < 4; i++) add(d, DISC, EM.glassIns, x, 6.8 - i * 0.16, -4.9); return V(x, 6.2, -4.9); }));
      const outZ = [-2.4, 0, 2.4], outAtt = outZ.map((z) => { for (let i = 0; i < 4; i++) add(d, DISC, EM.glassIns, 7.2, 7.0 - i * 0.16, z); return V(7.2, 6.4, z); });
      ATT.posteIn = inAtt.map((s) => s.map((v) => LW('poste', v.x, v.y, v.z))); ATT.posteOut = outAtt.map((v) => LW('poste', v.x, v.y, v.z));
      // busbars on insulator columns, down to the transformer
      [-6, -3, 3, 6].forEach((x) => { box(d, 0.3, 3.0, 0.3, EM.galva, x, 1.5, -3.2); add(d, INS, EM.porc, x, 3.0, -3.2).scale.set(0.8, 1.5, 0.8); });
      rod(d, V(-6.6, 4.6, -3.2), V(6.6, 4.6, -3.2), 0.07, EM.galva, 8);
      inAtt.forEach((s) => wire(d, [s[1], V(s[1].x, 5.4, -4.0), V(s[1].x, 4.65, -3.2)], 0.03));
      wire(d, [V(0, 4.6, -3.2), V(0, 4.9, -1.5), V(0, 4.55, -0.05)], 0.04);
      // breakers on the way out
      outZ.forEach((z) => { box(d, 0.3, 2.2, 0.3, EM.galva, 4.6, 1.1, z); rbox(d, 0.6, 0.6, 0.5, 0.05, EM.greyL, 4.6, 2.5, z, 0.02); add(d, INS, EM.porc, 4.6, 2.8, z).scale.set(0.7, 1.4, 0.7); wire(d, [V(4.6, 4.2, z), V(5.9, 5.0, z), outAtt[outZ.indexOf(z)]], 0.03); });
      [-0.9, 0, 0.9].forEach((x, i) => wire(d, [V(x, 3.95, 0.95), V(2.6, 4.7, outZ[i] * 0.6), V(4.6, 4.2, outZ[i])], 0.03));
      // the control building, a cable trench, and a little lamp
      const B = grp(d, 5.4, 0, -1.9); rbox(B, 2.6, 2.4, 2.2, 0.04, MT.brick, 0, 1.2, 0, 0.02); rbox(B, 2.9, 0.2, 2.5, 0.04, EM.slate, 0, 2.5, 0, 0.02); box(B, 0.8, 1.6, 0.05, EM.dark, -0.6, 0.8, 1.11); box(B, 0.7, 0.5, 0.05, MT.glassD, 0.6, 1.5, 1.11); rbox(B, 0.5, 0.4, 0.3, 0.04, EM.greyL, 0.9, 0.5, 1.22, 0.02);
      freeze(d);
      // lanes: three lines in, down to the transformer; three out to the big line
      const inL = inAtt.map((s) => P.lane([s[1], V(s[1].x, 5.4, -4.0), V(s[1].x, 4.75, -3.2), V(0, 4.75, -3.2), V(0, 4.9, -1.5), V(0, 4.6, 0.4 - 0.45)], { gap: 1.0, speed: 3.5, size: 0.14, on: false }));
      const outL = [-0.9, 0, 0.9].map((x, i) => P.lane([V(x, 3.95, 0.95), V(2.6, 4.75, outZ[i] * 0.6), V(4.6, 4.3, outZ[i]), V(5.9, 5.1, outZ[i]), outAtt[i]], { gap: 0.9, speed: 5, size: 0.2, on: false }));
      // a technician who may go in, and a family who stays outside
      const tech = walker(S, -5.3, 7.4, { vest: true, hat: MT.hat }); tech.rotation.y = Math.PI / 2;
      const kid = walker(S, 2.2, 7.0, { kid: true, top: 0xf2b21c }), mum = walker(S, 3.2, 7.4, { top: 0xa45ad8 }); kid.rotation.y = mum.rotation.y = Math.PI / 2;
      part(st, 'arrivee', "l'électricité qui arrive", anchor(S, 0, 7.4, -4.9), false);
      part(st, 'transfo', 'le transformateur', anchor(T, 0, 3.6, 1.2), true);
      part(st, 'depart', 'le départ vers le village', anchor(S, 7.2, 7.6, 2.4), false);
      part(st, 'panneau', 'danger !', anchor(signs[0], 0, 0.4, 0.1), true);
      part(st, 'barriere', 'la barrière', anchor(S, 4, 2.3, FZ1), false);
      st.focus = new V3(0, 3.0, 0.5); st.size = { w: 19, h: 12 }; st.tagAt = anchor(S, 0, 8.6, 0); st.m = T;
      let hum = 0, Tt = 0;
      st.update = (dt) => { Tt += dt; P.update(dt); const s = 1 + hum * 0.006 * Math.sin(Tt * 70); T.scale.set(s, 1 + hum * 0.004 * Math.cos(Tt * 70), s); };
      const bump = (o) => tw(0.8, (k) => o.scale.setScalar((o.userData.s0 || 0.9) * (1 + Math.sin(k * Math.PI) * 0.5)), lin);
      st.action = async function () {
        if (st.done) {
          inL.concat(outL).forEach((l) => P.stop(l)); tech.position.set(-5.3, 0, 7.4); tech.rotation.y = Math.PI / 2; pop(tech, 0.4); st.done = false; await sleep(1.4);
        }
        inL.forEach((l, i) => setTimeout(() => P.start(l), i * 400));
        await Promise.all([step("Voici le poste électrique. L'électricité du barrage, du vent et du soleil arrive ici.", 'arrivee'), sleep(1.5)]);
        await Promise.all([step("Le gros transformateur la change, pour qu'elle puisse voyager très loin.", 'transfo'), tw(3.2, (k) => (hum = Math.sin(k * Math.PI) * 0.6 + 0.4), lin), tone(100, 0, 3, 'sawtooth', 0.025, 100)]);
        outL.forEach((l) => P.start(l)); (LANES.hv || []).forEach((l) => (l.boost = 1.8));
        await Promise.all([step('Elle repart sur les grands câbles, vers le village et les maisons.', 'depart'), sleep(2)]);
        (LANES.hv || []).forEach((l) => (l.boost = 1));
        signs.forEach((s) => (s.userData.s0 = 0.9)); gsign.userData.s0 = 0.8;
        await Promise.all([step("Attention ! Ici, c'est dangereux. Seuls les techniciens ont le droit d'entrer.", 'panneau'), bump(signs[0]), bump(signs[1]),
          (async () => { await walkTo(tech, -5.3, 6.2, 1.2); await to(gate.rotation, 'y', 1.4, 0.8); await walkTo(tech, -5.3, 3.0, 1.6); await walkTo(tech, -3, 2.4, 1.2); tech.rotation.y = Math.PI / 2; await to(gate.rotation, 'y', 0, 0.8); })()]);
        await Promise.all([step('Nous, on reste toujours derrière la barrière, et on ne touche à rien.', 'barriere'), tw(2.2, (k) => (kid.userData.arms[0].rotation.x = -Math.abs(Math.sin(k * Math.PI * 3)) * 2.4), lin)]);
        kid.userData.arms[0].rotation.x = 0; hum = 0.25;
        chime(); st.done = true;
      };
    })();

    /* ---- la ligne à haute tension ---- */
    (function () {
      const st = makeStation('ligne'), S = st.g;
      const PY = pylonCat(S, 13, true); st.m = null;
      ATT.ligne = PY.att.map((v) => LW('ligne', v.x, v.y, v.z));
      // a child with a kite, and a parent
      const kid = walker(S, -6, 4.5, { kid: true, top: 0xe5452c }), dad = walker(S, -8.2, 6.0, { top: 0x2f7de0 });
      const K0 = { kid: kid.position.clone(), dad: dad.position.clone() };
      const kite = grp(S); kite.userData.dynamic = true;
      ext(kite, [[0, 0.7], [0.45, 0], [0, -0.45], [-0.45, 0]], 0.02, 0.03, EM.red, 0, 0, 0, 0.01);
      ext(kite, [[0, 0.7], [0.45, 0], [0, 0]], 0.01, 0.04, EM.yel, 0, 0, 0, 0.01); ext(kite, [[0, -0.45], [-0.45, 0], [0, 0]], 0.01, 0.04, EM.yel, 0, 0, 0, 0.01);
      const tail = grp(kite, 0, -0.45, 0); [0, 1, 2, 3].forEach((i) => { rod(tail, V(0, -i * 0.35, 0), V(0.06, -(i + 1) * 0.35, 0), 0.008, EM.dark, 4); box(tail, 0.14, 0.08, 0.02, [EM.blue, EM.green, EM.orange, EM.pink][i], 0.04, -(i + 1) * 0.35, 0); });
      const string = add(S, cylGeo(4), EM.white);
      let kOff = new V3(-1.8, 5.2, -3.4), kOn = 1;
      part(st, 'pylone', 'le pylône', anchor(S, 1.2, 5.5, 1.2), true);
      part(st, 'cables', 'les câbles', anchor(S, 6.5, PY.att[2].y - 0.1, 2.95), true);
      part(st, 'isolateurs', 'les isolateurs', anchor(S, 0, PY.att[2].y + 1.0, 2.95), true);
      part(st, 'panneau', 'danger !', anchor(S, 0, 2.6, 1.4), false);
      part(st, 'enfant', 'le cerf-volant', anchor(kite, 0, 0.8, 0), false);
      st.focus = new V3(-1.5, 6.4, 1.5); st.size = { w: 24, h: 16 }; st.tagAt = anchor(S, 2, 7, 3);
      let T = 0; const hand = new V3(), kp = new V3();
      st.update = (dt) => {
        T += dt;
        kp.copy(kid.position).add(kOff); kp.x += Math.sin(T * 0.9) * 0.4; kp.y += Math.sin(T * 1.4) * 0.25;
        kite.position.copy(kp); kite.rotation.z = Math.sin(T * 1.2) * 0.25; kite.rotation.y = 0.3; tail.rotation.z = Math.sin(T * 2.2) * 0.3;
        kite.visible = kOn > 0.02; kite.scale.setScalar(Math.max(0.01, kOn));
        hand.set(0.25, 0.75, 0.15).applyAxisAngle(_ya, kid.rotation.y).multiplyScalar(0.72).add(kid.position);
        string.visible = kite.visible; setRod(string, hand, kp.clone().add(new V3(0, -0.4, 0)), 0.008);
      };
      st.action = async function () {
        if (st.done) { kid.position.copy(K0.kid); dad.position.copy(K0.dad); kid.rotation.y = dad.rotation.y = 0; kOff.set(-1.8, 5.2, -3.4); kOn = 1; pop(kid, 0.4); pop(dad, 0.4); st.done = false; await sleep(0.5); }
        await Promise.all([step('Les grands pylônes portent les câbles très haut, au-dessus des champs.', 'pylone'), sleep(1.2)]);
        (LANES.hv || []).forEach((l) => { l.boost = 2.4; l.grow = 1.5; });
        await Promise.all([step("L'électricité voyage dans les câbles, très, très vite !", 'cables'), sleep(2.2)]);
        (LANES.hv || []).forEach((l) => { l.boost = 1; l.grow = 1; });
        await Promise.all([step("Les isolateurs en verre l'empêchent de descendre dans le pylône.", 'isolateurs'), sleep(1)]);
        await Promise.all([step('Oh ! Un enfant veut faire voler son cerf-volant par ici…', 'enfant'), walkTo(kid, -3.5, 2.2, 2.6), tw(2.6, (k) => kOff.set(-1.8, 5.2 + 1.6 * k, -3.4 + 0.6 * k), easeSine)]);
        await Promise.all([step('Non ! Jamais de cerf-volant près des lignes électriques !', 'enfant'), walkTo(dad, -4.6, 3.4, 1.4), tw(1.8, (k) => { kOff.set(-1.8 * (1 - k) + 0.3 * k, 6.8 * (1 - k) + 0.9 * k, -2.8 * (1 - k) + 0.1 * k); kOn = 1 - k * 0.4; }, easeSine)]);
        // they go and play at the park, far from the wires
        const park = S.worldToLocal(HD(17, 30)); kid.rotation.y = dad.rotation.y = Math.atan2(-(park.z - kid.position.z), park.x - kid.position.x);
        await Promise.all([step('On va jouer au parc, loin des câbles. Là-bas, il peut voler !', 'enfant'), walkTo(kid, park.x, park.z, 7, 7), walkTo(dad, park.x - 1.2, park.z - 0.6, 7, 7)]);
        kOn = 1; await tw(2.5, (k) => kOff.set(1.5 * k, 0.9 + 4.2 * k, 0.2 - 2 * k), easeSine);
        chime(); st.done = true;
      };
    })();

    /* ---- le camion nacelle : une branche est tombée sur le câble ---- */
    (function () {
      const st = makeStation('nacelle'), S = st.g, P = pulses(S, 30);
      const TK = bucketTruck(st, S); const m = TK.g; st.m = m; st.wheels = TK.wheels;
      const ZT = 2.0, X0 = -16; m.position.set(0, 0, ZT);
      // work out where the bucket goes when the boom is up, then put the cable just in front of the technician
      const pose = (k) => { TK.turret.rotation.y = (Math.PI / 2) * k; TK.lb.rotation.z = 0.08 + (0.7 - 0.08) * k; TK.ub.rotation.z = (Math.PI - 0.16) + (0.15 - 0.7 - (Math.PI - 0.16)) * k; TK.bk.rotation.z = -(TK.lb.rotation.z + TK.ub.rotation.z); };
      pose(1); S.updateMatrixWorld(true); const tip = S.worldToLocal(TK.tech.localToWorld(new V3(0, 1.0, 0))); pose(0); S.updateMatrixWorld(true);
      const CZ = tip.z - 0.75, BX = tip.x, CY = tip.y + 0.15, droop = 0.35, PX = 6;
      const Ya = CY + droop * Math.sin(Math.PI * ((BX + PX) / (2 * PX)));
      const d = grp(S);
      [-PX, PX].forEach((x) => lvPole(d, Ya + 0.42).g.position.set(x - 0.2, 0, CZ));
      const A = V(-PX, Ya, CZ), B = V(PX, Ya, CZ), cpts = sag(B, A, droop, 16);
      wire(d, cpts, 0.05, MT.black);
      ATT.nacelleL = [LW('nacelle', -PX, Ya, CZ)]; ATT.nacelleR = [LW('nacelle', PX, Ya, CZ)];
      // the house that this cable feeds, and the tree that lost a branch
      const win = vhouse(d, 9.5, -10, 0, { wall: EM.wallB, w: 4.6 }).win;
      const drop = [V(PX, Ya, CZ), V(9.5, 2.9, -8.2)]; wire(d, sag(drop[0], drop[1], 0.25, 8), 0.03, MT.black);
      const tr = grp(d, BX - 1.2, 0, CZ - 2.8); cylY(tr, 0.32, 3.4, EM.trunk, 0, 1.7, 0, 8); [[0, 4.6, 0, 1.7], [0.9, 4.0, 0.8, 1.2], [-0.9, 4.2, -0.6, 1.3], [0.2, 5.6, -0.3, 1.2]].forEach(([x, y, z, s]) => { const b = add(tr, ICO, 0x4f9a3e, x, y, z); b.scale.setScalar(s); b.rotation.set(rnd(0, 3), rnd(0, 3), 0); }); rod(tr, V(0.2, 3.2, 0.2), V(0.6, 3.7, 0.9), 0.1, EM.trunk);
      freeze(d);
      // the fallen branch, lying on the cable
      const branch = grp(S, BX, CY - 0.05, CZ); branch.userData.dynamic = true; const BR0 = branch.position.clone();
      rod(branch, V(-1.4, 0.3, -0.2), V(1.3, -0.2, 0.3), 0.07, EM.trunk, 6); rod(branch, V(0.3, 0, 0.1), V(0.9, 0.5, 0.5), 0.04, EM.trunk, 5); rod(branch, V(-0.6, 0.15, 0), V(-1.0, 0.6, -0.4), 0.04, EM.trunk, 5);
      [[1.2, -0.1, 0.4], [0.9, 0.55, 0.5], [-1.1, 0.65, -0.4], [-1.4, 0.3, -0.1], [0.2, 0.3, 0.3]].forEach(([x, y, z]) => { const b = add(branch, ICO, 0x5aa84a, x, y, z); b.scale.setScalar(0.38); });
      const cones = [[-4.6, ZT + 1.5], [3.6, ZT + 1.5], [-1, ZT + 1.7]].map(([x, z]) => { const c = cone(S, x, z); c.visible = false; return c; });
      const L = P.lane(cpts, { gap: 1.1, speed: 3, size: 0.14, on: false });
      const LD = P.lane(sag(drop[0], drop[1], 0.25, 8), { gap: 0.9, speed: 3, size: 0.12, on: false });
      part(st, 'branche', 'la branche', anchor(branch, 0, 0.8, 0), true);
      part(st, 'camion', 'le camion', anchor(m, 1.6, 3.3, 1.2), false);
      part(st, 'stabilisateurs', 'les stabilisateurs', anchor(m, 0.9, 0.5, 1.4), false);
      part(st, 'nacelle', 'la nacelle', anchor(TK.bk, 0.0, 0.3, 0.5), true);
      part(st, 'technicien', 'le technicien', anchor(TK.tech, 0, 1.45, 0), false);
      part(st, 'cable', 'le câble', anchor(S, PX - 1.8, Ya - 0.2, CZ), true);
      const SZ = { w: 17, h: 10 };
      st.focus = new V3(-2.2, 3.4, -2.2); st.size = SZ; st.az = YAW + 0.7; st.tagAt = anchor(m, -1, 4.5, 0);
      m.position.x = X0; st.lastX = X0; TK.tech.visible = true;
      let T = 0;
      st.update = (dt) => { T += dt; roll(st, dt); TK.hyd.update(); P.update(dt); win.emissiveIntensity += ((st.power ? 1.1 : 0) - win.emissiveIntensity) * Math.min(1, dt * 3); };
      st.action = async function () {
        if (st.done) {
          await Promise.all([step('Le camion repart. Oh ! Encore une branche tombée…', 'branche'), tw(2, (k) => pose(1 - k), easeSine), tw(1.2, (k) => TK.legs.forEach((l) => (l.position.y = -0.62 * (1 - k))))]);
          engineOn(55); cones.forEach((c) => (c.visible = false)); await to(m.position, 'x', 14, 2.6, easeIn); engineOff();
          m.visible = false; m.position.x = X0; st.lastX = X0; branch.position.copy(BR0); branch.rotation.set(0, 0, 0); pop(branch, 0.5); P.stop(L); P.stop(LD); st.power = false; await sleep(0.8); m.visible = true; st.done = false;
        }
        await Promise.all([step("Oh ! Le vent a fait tomber une branche sur le câble. Dans cette maison, il n'y a plus de lumière.", 'branche'), sleep(0.6)]);
        engineOn(55); st.busyBeacon = true;
        await Promise.all([step('Le camion nacelle arrive pour réparer.', 'camion'), to(m.position, 'x', 0, 4.5, easeSine)]);
        engineOff(); cones.forEach((c, i) => setTimeout(() => pop(c, 0.4), i * 250));
        await Promise.all([step('Il pose ses pieds bien à plat, pour ne pas basculer.', 'stabilisateurs'), tw(1.6, (k) => TK.legs.forEach((l) => (l.position.y = -0.62 * k)), easeSine)]); thud();
        tone(140, 0, 3.5, 'sawtooth', 0.02, 170);
        await Promise.all([step('Le grand bras monte la nacelle tout là-haut. Le technicien a un casque et des gants spéciaux.', 'nacelle'), tw(5, (k) => pose(k), easeSine)]);
        await Promise.all([step("D'abord, on coupe le courant. Puis il enlève la branche, tout doucement.", 'technicien'), tw(1.5, (k) => (TK.tech.userData.arms[0].rotation.x = -2.4 * Math.sin(k * Math.PI)), lin)]);
        await tw(2.2, (k) => { branch.position.set(BR0.x + 0.8 * k, BR0.y * (1 - k * k) + 0.05, BR0.z + 1.2 * k); branch.rotation.z = -0.6 * k; branch.rotation.x = 1.0 * k; }, lin); thud();
        await Promise.all([step('Le bras redescend. On rallume le courant : la lumière revient !', 'cable'), tw(4, (k) => pose(1 - k), easeSine), sleep(1.5).then(() => { P.start(L); P.start(LD); st.power = true; ding(); })]);
        await tw(1.2, (k) => TK.legs.forEach((l) => (l.position.y = -0.62 * (1 - k))));
        await Promise.all([step('Merci, le technicien ! Les câbles, seuls les techniciens ont le droit de les toucher.', 'technicien'), sleep(0.5)]);
        chime(); st.done = true;
      };
    })();

    /* ---- la borne de recharge ---- */
    (function () {
      const st = makeStation('borne'), S = st.g, P = pulses(S, 50), d = grp(S);
      // the car park: green charging bays, a solar canopy, two charging posts fed by an underground cable
      rbox(d, 11.5, 0.06, 7.8, 0.1, EM.asphalt, -0.2, 0.03, 1.5, 0.02);
      [0, 3.4].forEach((z) => { box(d, 4.4, 0.02, 2.6, EM.green, -0.2, 0.065, z); ext(d, [[0.2, 0.6], [-0.35, -0.05], [0.0, -0.05], [-0.2, -0.6], [0.35, 0.05], [0.0, 0.05]], 0.02, 0.02, EM.white, -1.4, 0.08, z, 0.005).rotation.x = -Math.PI / 2; });
      [-1.7, 1.7, 5.1].forEach((z) => box(d, 4.6, 0.02, 0.1, EM.white, -0.2, 0.07, z));
      [[-2.6, -1.9], [2.6, -1.9]].forEach(([x, z]) => { rbox(d, 0.22, 3.4, 0.22, 0.03, EM.galva, x, 1.7, z, 0.01); rod(d, V(x, 3.0, z), V(x, 3.35, z + 2.2), 0.06, EM.galva); });
      { const cv = grp(d, 0, 3.45, 1.4); cv.rotation.x = 0.08; rbox(cv, 6.2, 0.12, 6.8, 0.03, EM.galva, 0, -0.08, 0, 0.01); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { rbox(cv, 1.18, 0.04, 2.16, 0.02, EM.greyL, -2.4 + i * 1.2, 0.0, -2.2 + j * 2.2, 0.01); box(cv, 1.12, 0.02, 2.1, PANEL, -2.4 + i * 1.2, 0.03, -2.2 + j * 2.2); } }
      const bornes = [0, 3.4].map((z) => borneM(d, 2.75, z));
      box(d, 0.5, 0.02, 7.0, std(0x3a3d48, 0.95, 0), 4.6, 0.065, -0.8);
      const pole = lvPole(d); pole.g.position.set(5.5, 0, -4.4); ATT.borne = [LW('borne', 5.5 + pole.att[0].x, pole.att[0].y, -4.4 + pole.att[0].z)];
      // a second car, already charging
      const car2 = eCar(d, 0xf2f2f6); car2.g.position.set(-0.2, 0, 0);
      const c2 = [V(2.55, 0.95, 0.2), V(2.0, 0.25, 0.25), V(1.75, 0.6, 0.0)]; wire(d, sag(c2[0], c2[2], 0.35, 8), 0.04, EM.dark);
      freeze(d); freeze(car2.g);
      const feed = P.lane([V(5.5, pole.att[0].y, -4.4), V(5.5, 0.12, -4.4), V(4.6, 0.1, -3.5), V(4.6, 0.1, 3.2), V(3.0, 0.1, 3.4), V(2.75, 1.2, 3.4)], { gap: 1.1, speed: 3, size: 0.13 });
      P.lane([V(4.6, 0.1, 0.2), V(3.0, 0.1, 0.1), V(2.75, 1.0, 0.1)].concat(sag(c2[0], c2[2], 0.35, 8)), { gap: 0.6, speed: 2.5, size: 0.11 }); void feed;
      // the main car, its driver, and the cable that hangs on the charging post
      const car = eCar(S, 0x4fb8e8); const m = car.g; st.m = m; st.wheels = car.wheels; m.position.set(0, 0, 3.4); freeze(car.body);
      const spinW = spin(m, car.wheels, 0.32);
      const driver = walker(m, -0.15, -0.32, { top: 0xa45ad8, hair: 0x8a5a2a }); driver.scale.setScalar(0.8); driver.position.y = 0.06;
      const mum = walker(S, 0, 0, { top: 0xa45ad8, hair: 0x8a5a2a }); mum.visible = false;
      const kid = walker(S, -1.2, 5.6, { kid: true, top: 0xf07aa8 }); kid.rotation.y = Math.PI / 2;
      const OUT = V(2.55, 0.85, 3.45), HOL = V(2.62, 1.15, 3.64);
      const NS = 10, segs = Array.from({ length: NS }, () => add(S, cylGeo(6), EM.dark)); const plug = grp(S); rbox(plug, 0.22, 0.14, 0.14, 0.03, EM.dark, 0, 0, 0, 0.01); rbox(plug, 0.1, 0.1, 0.1, 0.02, EM.green, -0.12, 0, 0, 0.01);
      const plugPos = HOL.clone(); let cablePts = [];
      const drawCable = () => { const a = OUT, b = plugPos, L = a.distanceTo(b), dr = clamp(1.4 - L * 0.4, 0.15, 0.9); cablePts = sag(a, b, dr, NS); for (let i = 0; i < NS; i++) setRod(segs[i], cablePts[i], cablePts[i + 1], 0.035); plug.position.copy(b); };
      drawCable(); const chg = P.lane(cablePts.map((p) => p.clone()), { gap: 0.3, speed: 2.2, size: 0.1, on: false });
      const IN = route([[-15, -5.4], [-9, -5.6], [-5.6, -4.2], [-4.4, -1.0], [-3.6, 2.2], [-2.0, 3.35], [0, 3.4]], false, 0.4);
      const LEAVE = route([[0, 3.4], [-2.2, 3.5], [-4.4, 2.3]], false, 0.4), GO = route([[-4.4, 2.3], [-4.9, -0.8], [-6.2, -4.2], [-9.5, -5.4], [-18, -5.6]], false, 0.4);
      part(st, 'voiture', 'la voiture électrique', anchor(m, -0.3, 1.6, 0.6), true);
      part(st, 'borne', 'la borne', anchor(S, 2.75, 1.9, 3.6), true);
      part(st, 'prise', 'la prise', car.port, false);
      part(st, 'cable', 'le câble', anchor(plug, 0, 0.3, 0), false);
      part(st, 'ombriere', 'des panneaux solaires', anchor(S, -2.2, 3.7, 3.6), false);
      st.focus = new V3(0.5, 1.4, 2.6); st.size = { w: 13, h: 8 }; st.az = YAW - 0.35; st.tagAt = anchor(m, 0, 2.4, 0);
      const screen = bornes[1].screen;
      st.update = (dt) => { spinW(); P.update(dt); };
      st.action = async function () {
        if (st.done) {
          m.visible = true; placeOn(m, IN, 0); engineOn(30); st.done = false; car.flap.rotation.y = 0;
          await Promise.all([step('Une voiture électrique arrive, presque vide.', 'voiture'), along(m, IN, 0, IN.len, 5.5, easeSine)]); engineOff();
        } else await Promise.all([step('Cette voiture est électrique. Sa batterie est presque vide.', 'voiture'), sleep(0.8)]);
        driver.visible = false; mum.visible = true; mum.position.set(-0.3, 0, 4.5); mum.rotation.y = 0;
        await Promise.all([step('Maman prend le câble de la borne de recharge.', 'borne'), walkTo(mum, 2.0, 4.6, 1.8)]);
        mum.rotation.y = Math.PI / 2; await to(car.flap.rotation, 'y', -1.6, 0.6);
        const p0 = plugPos.clone(), p1 = wp(car.port); S.worldToLocal(p1);
        await Promise.all([step('Elle le branche dans la voiture. Clic !', 'prise'), tw(1.6, (k) => { plugPos.lerpVectors(p0, p1, k); plugPos.y += Math.sin(k * Math.PI) * 0.4; drawCable(); }, easeSine)]);
        ding(); P.setPts(chg, cablePts.map((p) => p.clone())); P.start(chg);
        await Promise.all([step("L'électricité coule dans le câble et remplit la batterie.", 'cable'), tw(4.5, (k) => screen.forEach((sm, i) => (sm.emissiveIntensity = i < Math.floor(k * 4.99) ? 1.2 : 0)), lin)]);
        P.stop(chg); ding();
        await Promise.all([step("C'est plein ! On débranche, et la voiture repart, sans bruit et sans fumée.", 'voiture'), tw(1.4, (k) => { plugPos.lerpVectors(p1, HOL, k); plugPos.y += Math.sin(k * Math.PI) * 0.4; drawCable(); }, easeSine), to(car.flap.rotation, 'y', 0, 0.6)]);
        await walkTo(mum, -0.3, 4.5, 1.6); mum.visible = false; driver.visible = true;
        screen.forEach((sm) => (sm.emissiveIntensity = 0)); st.reversing = true;
        await tw(2.4, (k) => { placeOn(m, LEAVE, LEAVE.len * k); m.rotation.y += Math.PI; }, easeSine); st.reversing = false;
        await along(m, GO, 0, GO.len, 4, easeIn);
        m.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- la maison ---- */
    (function () {
      const st = makeStation('maison'), S = st.g, P = pulses(S, 80);
      const Hm = houseCut(S); // the cut-away house: returns lights and handles
      const pole = lvPole(Hm.d); pole.g.position.set(-7, 0, -4.8); const PA = V(-7 + pole.att[0].x, pole.att[0].y, -4.8 + pole.att[0].z);
      ATT.maison = [LW('maison', PA.x, PA.y, PA.z)];
      const BR = V(-5.3, 3.0, -2.3); wire(Hm.d, sag(PA, BR, 0.3, 8), 0.035, MT.black); rbox(Hm.d, 0.2, 0.12, 0.12, 0.02, EM.dark, -5.25, 3.0, -2.3, 0.01);
      freeze(Hm.d);
      const WY = 2.78, WZ = -2.84;
      const inL = P.lane(sag(PA, BR, 0.3, 8).concat([V(-5.0, 3.0, -2.6), V(-4.55, WY, WZ), V(-4.55, 2.0, WZ), V(-4.0, 2.05, WZ)]), { gap: 0.7, speed: 2.5, size: 0.11, on: false });
      const lampL = P.lane([V(-4.0, 2.05, WZ), V(-4.0, WY, WZ), V(1.62, WY, WZ), V(1.62, 0.35, WZ), V(1.45, 0.26, -2.4), V(1.45, 1.75, -2.4)], { gap: 0.5, speed: 2.5, size: 0.09, on: false });
      const fridgeL = P.lane([V(-3.9, 2.05, WZ), V(-3.9, WY - 0.08, WZ), V(-3.0, WY - 0.08, WZ), V(-3.0, 2.15, WZ)], { gap: 0.45, speed: 2.2, size: 0.09, on: false });
      const nightL = P.lane([V(-4.1, 2.05, WZ), V(-4.1, WY + 0.08, WZ), V(2.3, WY + 0.08, WZ), V(2.3, 0.9, WZ), V(2.3, 0.85, -2.55)], { gap: 0.5, speed: 2.5, size: 0.09, on: false });
      const dad = walker(S, 0.4, 1.0, { top: 0x2f7de0 }), kid = walker(S, 3.2, 0.5, { kid: true, top: 0xf2b21c }); dad.position.y = kid.position.y = 0.2; dad.rotation.y = Math.PI; kid.rotation.y = -Math.PI / 2;
      const D0 = dad.position.clone(), K0 = kid.position.clone();
      part(st, 'compteur', 'le compteur', anchor(S, -4.55, 2.3, -2.7), true);
      part(st, 'lampe', 'la lampe', anchor(S, 1.45, 2.05, -2.3), true);
      part(st, 'frigo', 'le frigo', anchor(S, -3.0, 2.3, -2.0), true);
      part(st, 'veilleuse', 'la veilleuse', anchor(S, 2.3, 1.15, -2.45), false);
      part(st, 'prise', 'la prise protégée', anchor(S, 2.85, 0.6, -2.78), false);
      st.focus = new V3(0.2, 1.5, 0); st.size = { w: 11.5, h: 6.4 }; st.tagAt = anchor(S, 0, 5.6, 0);
      let hum = 0, T = 0;
      st.update = (dt) => { if (!T) Hm.d.traverse((n) => { if (n.isMesh && Hm.noShadow.includes(n.material)) n.castShadow = false; }); T += dt; P.update(dt); Hm.lampHalo.opacity = Hm.lamp.emissiveIntensity * 0.22; Hm.nightHalo.opacity = Hm.night.emissiveIntensity * 0.3; Hm.fridge.position.x = Hm.fx0 + Math.sin(T * 60) * 0.006 * hum; Hm.night.emissiveIntensity = Hm.nightOn ? 0.9 + Math.sin(T * 2) * 0.25 : 0; };
      st.action = async function () {
        if (st.done) {
          [inL, lampL, fridgeL, nightL].forEach((l) => P.stop(l)); Hm.lamp.emissiveIntensity = 0; Hm.nightOn = false; Hm.blanket.visible = false;
          dad.position.copy(D0); kid.position.copy(K0); kid.rotation.set(0, -Math.PI / 2, 0); dad.rotation.y = Math.PI; pop(kid, 0.4); st.done = false; await sleep(0.6);
        }
        P.start(inL);
        await Promise.all([step("Le soir, l'électricité arrive à la maison par le câble. Elle passe dans le compteur.", 'compteur'), sleep(2.2)]);
        await Promise.all([step("Papa appuie sur l'interrupteur. Clic ! La lampe s'allume.", 'lampe'),
          (async () => { await walkTo(dad, -1.05, 0.9, 1.8); dad.rotation.y = Math.PI; dad.userData.arms[1].rotation.x = 1.3; ding(); await sleep(0.4); dad.userData.arms[1].rotation.x = 0; P.start(lampL); await sleep(1.0); await tw(0.6, (k) => (Hm.lamp.emissiveIntensity = 1.5 * k)); })()]);
        P.start(fridgeL); hum = 1;
        await Promise.all([step('Le frigo ronronne : il garde les aliments bien au frais.', 'frigo'), tone(70, 0, 3, 'sawtooth', 0.02, 72),
          (async () => { await walkTo(dad, -1.0, 2.0, 0.7); await walkTo(dad, -2.4, 2.0, 0.8); await walkTo(dad, -2.4, -1.1, 1.2); await to(Hm.door.rotation, 'y', -1.7, 0.6); Hm.inner.emissiveIntensity = 1; await sleep(1.2); await to(Hm.door.rotation, 'y', 0, 0.6); Hm.inner.emissiveIntensity = 0; })()]);
        hum = 0.3; P.start(nightL);
        await Promise.all([step("C'est l'heure de dormir. La veilleuse brille tout doucement.", 'veilleuse'),
          (async () => { await walkTo(kid, 3.75, -1.6, 1.4, 8); kid.rotation.set(0, 0, Math.PI / 2); kid.position.set(3.8, 0.95, -2.4); Hm.blanket.visible = true; pop(Hm.blanket, 0.5); Hm.nightOn = true; await sleep(1); await tw(0.8, (k) => (Hm.lamp.emissiveIntensity = 1.5 * (1 - k))); })()]);
        await Promise.all([step("Les prises et les fils, on n'y touche jamais. C'est le travail des grands !", 'prise'), tw(1.2, (k) => Hm.cover.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.8), lin)]);
        chime(); st.done = true;
      };
    })();

    buildNetwork(grp(scene), scene, onUpdate);
    buildLife(scene, onUpdate);
  }
};

/* ================= models ================= */
const TH = 12; // wind turbine tower height
/** Lattice "cat" pylon (French style): tapered body, two arms holding the crossbeam, glass insulator strings. */
function pylonCat(p, H = 13, detail = false) {
  const g = grp(p), M = EM.galva;
  const R = (a, b, r = 0.045) => rod(g, a, b, r, M, 5);
  const b = 1.55, w = 0.45, Hw = H * 0.6, Yb = H - 1.1, hw = (y) => b + ((w - b) * y) / Hw;
  const C = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  C.forEach(([sx, sz]) => { R(V(sx * b, 0, sz * b), V(sx * w, Hw, sz * w), 0.085); rbox(g, 0.6, 0.3, 0.6, 0.05, EM.conc, sx * b, 0.1, sz * b, 0.02); });
  const N = 6;
  for (let i = 0; i < N; i++) {
    const y0 = (Hw * i) / N, y1 = (Hw * (i + 1)) / N, a0 = hw(y0), a1 = hw(y1);
    for (let f = 0; f < 4; f++) { const [ax, az] = C[f], [bx, bz] = C[(f + 1) % 4]; R(V(ax * a0, y0, az * a0), V(bx * a1, y1, bz * a1), 0.03); R(V(bx * a0, y0, bz * a0), V(ax * a1, y1, az * a1), 0.03); R(V(ax * a1, y1, az * a1), V(bx * a1, y1, bz * a1), 0.035); }
  }
  // the cat head: arms splay from the waist up to the crossbeam, leaving a window for the middle wire
  [1, -1].forEach((sz) => [1, -1].forEach((sx) => {
    const o0 = V(sx * w, Hw, sz * w), o1 = V(sx * 0.32, Yb, sz * 2.4), i1 = V(sx * 0.32, Yb, sz * 0.75);
    R(o0, o1, 0.07); R(o0, i1, 0.055);
    [0.35, 0.7].forEach((t) => R(o0.clone().lerp(o1, t), o0.clone().lerp(i1, t + 0.15), 0.03));
  }));
  [[0.32, 0], [-0.32, 0], [0.32, 0.55], [-0.32, 0.55]].forEach(([x, dy]) => R(V(x, Yb + dy, -3.5 + dy * 0.6), V(x, Yb + dy, 3.5 - dy * 0.6), 0.045));
  for (let z = -3.2; z < 3.2; z += 0.8) [0.32, -0.32].forEach((x) => { R(V(x, Yb, z), V(x, Yb + 0.55, z + 0.4), 0.025); R(V(x, Yb + 0.55, z + 0.4), V(x, Yb, z + 0.8), 0.025); });
  [1, -1].forEach((sz) => { [0.32, -0.32].forEach((x) => R(V(x, Yb + 0.55, sz * 1.8), V(0, H + 0.5, sz * 2.3), 0.04)); R(V(0, Yb + 0.55, sz * 2.9), V(0, H + 0.5, sz * 2.3), 0.035); sph(g, 0.08, M, 0, H + 0.5, sz * 2.3); });
  const att = [-2.95, 0, 2.95].map((z) => { for (let i = 0; i < 9; i++) add(g, DISC, EM.glassIns, 0, Yb - 0.25 - i * 0.19, z); rbox(g, 0.18, 0.12, 0.3, 0.03, M, 0, Yb - 1.95, z, 0.01); return V(0, Yb - 2.0, z); });
  if (detail) {
    const y = 2.6; danger(g, 0, y, hw(y) + 0.06, 0.9);
    // anti-climb spikes, step bolts, a number plate
    C.forEach(([sx, sz]) => { const a = hw(3.4); for (let k = -3; k <= 3; k++) { const c = add(g, new THREE.ConeGeometry(0.03, 0.22, 4), EM.dark, sx * a + (sz === 1 ? 0 : 0), 3.4, sz * a * (k / 3.2)); c.rotation.z = sx * -1.2; } });
    for (let yy = 3.8; yy < Hw - 0.5; yy += 0.35) { const a = hw(yy); rod(g, V(a, yy, a), V(a + 0.18, yy, a), 0.015, EM.dark, 4); }
    rbox(g, 0.4, 0.24, 0.03, 0.02, EM.white, 0, 4.4, hw(4.4) + 0.03, 0.01); box(g, 0.28, 0.06, 0.035, EM.red, 0, 4.4, hw(4.4) + 0.04);
  }
  return { g, att };
}
function latticePost(p, x, z, H) {
  const g = grp(p, x, 0, z), a = 0.17; rbox(g, 0.7, 0.25, 0.7, 0.04, EM.conc, 0, 0.12, 0, 0.02);
  [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(([sx, sz], f, C) => { rod(g, V(sx * a, 0, sz * a), V(sx * a, H, sz * a), 0.035, EM.galva, 5); const [bx, bz] = C[(f + 1) % 4]; for (let y = 0; y < H - 0.5; y += 0.7) rod(g, V(sx * a, y, sz * a), V(bx * a, y + 0.7, bz * a), 0.015, EM.galva, 4); });
}
function latticeBeam(p, a, b) {
  const dir = new V3().subVectors(b, a), L = dir.length(); dir.normalize(); const side = new V3(-dir.z, 0, dir.x).multiplyScalar(0.18), up = V(0, 0.18, 0);
  const c = [side.clone().add(up), side.clone().sub(up), side.clone().negate().add(up), side.clone().negate().sub(up)];
  c.forEach((o) => rod(p, a.clone().add(o), b.clone().add(o), 0.035, EM.galva, 5));
  for (let s = 0; s < L - 0.3; s += 0.6) { const q0 = a.clone().addScaledVector(dir, s), q1 = a.clone().addScaledVector(dir, s + 0.6); rod(p, q0.clone().add(c[0]), q1.clone().add(c[1]), 0.014, EM.galva, 4); rod(p, q0.clone().add(c[2]), q1.clone().add(c[3]), 0.014, EM.galva, 4); }
}
/** Concrete pole with a crossarm and three pin insulators (medium-voltage line). */
function mvPole(p, H = 7.5) {
  const g = grp(p); add(g, POLEG, EM.conc).scale.set(1, H, 1);
  rbox(g, 0.12, 0.12, 2.0, 0.02, EM.galva, 0, H - 0.1, 0, 0.01); [1, -1].forEach((s) => rod(g, V(0, H - 0.9, 0), V(0, H - 0.15, s * 0.7), 0.025, EM.galva, 4));
  const att = [-0.85, 0, 0.85].map((z) => { add(g, INS, EM.white, 0, H - 0.04, z).scale.set(0.5, 0.38, 0.5); return V(0, H + 0.36, z); });
  return { g, att };
}
/** Low-voltage pole with its twisted cable hook. */
function lvPole(p, H = 6.2) {
  const g = grp(p); add(g, POLEG, EM.conc).scale.set(0.85, H, 0.85);
  rbox(g, 0.12, 0.2, 0.18, 0.03, EM.dark, 0.13, H - 0.4, 0, 0.01); cylY(g, 0.1, 0.06, EM.dark, 0, H + 0.02, 0, 8);
  return { g, att: [V(0.2, H - 0.42, 0)] };
}
/** The yellow danger triangle with its black lightning bolt (faces +z). */
function danger(p, x, y, z, s = 1, ry = 0) {
  const g = grp(p, x, y, z); g.rotation.y = ry; g.scale.setScalar(s);
  ext(g, [[-0.34, -0.29], [0.34, -0.29], [0, 0.33]], 0.04, 0.02, MT.black, 0, 0, -0.008, 0.004);
  ext(g, [[-0.3, -0.25], [0.3, -0.25], [0, 0.28]], 0.035, 0.03, EM.yel, 0, 0, 0, 0.005);
  ext(g, [[0.04, 0.17], [-0.07, -0.02], [0.0, -0.02], [-0.05, -0.2], [0.09, 0.03], [0.02, 0.03]], 0.008, 0.02, MT.black, 0, 0, 0.012, 0.003);
  return g;
}
/** Wind turbine: tower, nacelle (cover opens: shaft, gearbox, generator), hub with three pitching blades. */
function turbine(p, detail) {
  const g = grp(p), d = grp(g);
  cylY(d, 1.7, 0.25, EM.conc, 0, 0.12, 0, 24);
  add(d, new THREE.LatheGeometry([V2(0.001, 0), V2(0.52, 0), V2(0.5, TH / 3), V2(0.42, (TH * 2) / 3), V2(0.32, TH), V2(0.001, TH)], 24), EM.white);
  [[TH / 3, 0.505], [(TH * 2) / 3, 0.425]].forEach(([y, r]) => cylY(d, r, 0.06, EM.greyL, 0, y, 0, 24));
  [[0.45, 0x3aa46a], [0.8, 0x5ab874], [1.15, 0x8ccf9a]].forEach(([y, c]) => cylY(d, 0.53, 0.32, std(c, 0.5, 0), 0, y, 0, 24));
  if (detail) { rbox(d, 0.46, 0.95, 0.12, 0.05, EM.greyL, 0, 0.85, 0.5, 0.02); for (let i = 0; i < 3; i++) rbox(d, 0.7, 0.06, 0.3, 0.02, EM.galva, 0, 0.12 + i * 0.12, 0.75 + i * 0.12 * 0, 0.01); rail(d, [[-0.4, 0.4, 0.85], [-0.4, 1.0, 0.85]], 0.02, EM.galva); }
  freeze(d);
  const yaw = grp(g, 0, TH, 0); yaw.userData.dynamic = true;
  const n = grp(yaw);
  cylY(n, 0.36, 0.2, EM.greyL, 0, 0.0, 0, 18);
  ext(n, [[-2.0, 0.05], [1.25, 0.05], [1.25, 0.62], [-2.0, 0.62]], 0.08, 1.4, EM.white, 0, 0, 0, 0.04);
  const slow = grp(yaw, 0.55, 0.85, 0), fast = []; slow.userData.dynamic = true;
  if (detail) {
    rbox(n, 0.5, 0.4, 0.6, 0.06, EM.grey, 0.75, 0.75, 0, 0.02);           // main bearing
    rbox(n, 0.85, 0.72, 0.85, 0.1, std(0x5a7a9a, 0.45, 0.4), -0.2, 0.92, 0, 0.03); // gearbox
    cylX(n, 0.38, 1.0, EM.green, -1.45, 0.92, 0, 18); [-1.1, -1.45, -1.8].forEach((x) => cylX(n, 0.4, 0.05, EM.greenD, x, 0.92, 0, 18)); // generator with cooling rings
    rbox(n, 0.4, 0.3, 0.35, 0.04, EM.dark, -1.75, 0.55, 0.45, 0.02);
    cylX(slow, 0.13, 1.1, EM.steel, 0, 0, 0, 12); box(slow, 0.3, 0.06, 0.3, EM.yel, 0.1, 0, 0);
    const gear = new THREE.ExtrudeGeometry(gearShape(0.42, 0.36, 18), { depth: 0.1, bevelEnabled: false }); gear.rotateY(Math.PI / 2);
    const big = grp(slow, -0.45, 0, 0); add(big, gear, EM.yel); box(big, 0.12, 0.6, 0.06, EM.dark, 0.02, 0, 0);
    const f1 = grp(yaw, -0.85, 0.92, 0); f1.userData.dynamic = true; cylX(f1, 0.05, 0.5, EM.steel, 0, 0, 0, 8); cylX(f1, 0.26, 0.04, EM.red, -0.1, 0, 0, 18); box(f1, 0.05, 0.5, 0.06, EM.white, -0.1, 0, 0); fast.push(f1);
  }
  freeze(n);
  // the cover, hinged along its back top edge (opens like a car bonnet)
  const cover = grp(yaw, 0, 0.62, -0.7); cover.userData.dynamic = true;
  ext(cover, [[-2.0, 0], [1.25, 0], [1.45, 0.22], [1.32, 0.72], [-1.8, 0.78], [-2.05, 0.36]], 0.14, 1.4, EM.white, 0, 0, 0.7, 0.05);
  rod(cover, V(-1.6, 0.78, 0.7), V(-1.6, 1.3, 0.7), 0.02, EM.dark, 4); cylY(cover, 0.05, 0.05, MT.tail, -1.6, 1.33, 0.7, 8); rbox(cover, 0.2, 0.06, 0.06, 0.01, EM.dark, -1.45, 1.2, 0.7, 0.01);
  freeze(cover);
  // hub and blades
  const hub = grp(yaw, 1.35, 0.4, 0); hub.userData.dynamic = true;
  const nose = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateZ(-Math.PI / 2); nose.scale(1.2, 1, 1); add(hub, nose, EM.white, 0.05, 0, 0); cylX(hub, 0.5, 0.2, EM.white, -0.05, 0, 0, 16);
  const pitch = [];
  for (let k = 0; k < 3; k++) {
    const bg = grp(hub); bg.rotation.x = (k * Math.PI * 2) / 3; const pg = grp(bg, 0.25, 0.32, 0); pg.userData.dynamic = true;
    cylY(pg, 0.15, 0.5, EM.white, 0, 0.2, 0, 10);
    ext(pg, [[0.14, 0.4], [0.22, 1.3], [0.07, 5.4], [-0.05, 5.6], [-0.44, 1.6], [-0.16, 0.4]], [0.05, 0.3, 0.05, 0.05, 0.3, 0.05], 0.1, EM.white, 0, 0, 0, 0.03);
    ext(pg, [[0.085, 4.6], [0.07, 5.4], [-0.05, 5.6], [-0.12, 4.6]], 0.02, 0.105, EM.red, 0, 0, 0, 0.02);
    pitch.push(pg);
  }
  return { g, yaw, hub, pitch, cover, slow, fast };
}
/** Single-axis solar tracker table: posts, torque tube, panels (the panel table rotates). */
function trackerTable(p, x, z, n = 8) {
  const g = grp(p, x, 0, z);
  for (let i = 0; i < 4; i++) { const px = -((n - 1) * 1.04) / 2 + (i * (n - 1) * 1.04) / 3; rbox(g, 0.12, 1.5, 0.1, 0.02, EM.galva, px, 0.75, 0, 0.01); rbox(g, 0.3, 0.12, 0.3, 0.03, EM.conc, px, 0.06, 0, 0.01); }
  rbox(g, 0.35, 0.3, 0.32, 0.04, EM.grey, 0.5, 1.35, 0.25, 0.02);
  const tab = grp(g, 0, 1.55, 0); tab.userData.dynamic = true;
  cylX(tab, 0.07, n * 1.04 + 0.2, EM.galva, 0, 0, 0, 10);
  for (let i = 0; i < n; i++) { const px = (i - (n - 1) / 2) * 1.04; box(tab, 0.05, 0.06, 1.9, EM.galva, px - 0.4, 0.06, 0); rbox(tab, 1.0, 0.05, 2.0, 0.02, EM.greyL, px, 0.12, 0, 0.01); box(tab, 0.94, 0.02, 1.94, PANEL, px, 0.15, 0); }
  freeze(tab); return tab;
}
/** Battery storage container with a gauge (4 cells that light up). Returns the cell materials. */
function container(g) {
  const L = 5.6, W = 2.3, H = 2.5;
  rbox(g, L + 0.4, 0.2, W + 0.4, 0.04, EM.conc, 0, 0.1, 0); rbox(g, L, H, W, 0.04, EM.white, 0, 0.2 + H / 2, 0, 0.02);
  [1, -1].forEach((s) => { for (let x = -L / 2 + 0.2; x < L / 2; x += 0.3) box(g, 0.08, H - 0.2, 0.04, EM.greyL, x, 0.2 + H / 2, s * (W / 2 + 0.01)); });
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => box(g, 0.14, H + 0.02, 0.14, EM.dark, sx * (L / 2 - 0.05), 0.2 + H / 2, sz * (W / 2 - 0.05)));
  box(g, 0.05, H - 0.3, W - 0.4, EM.greyL, -L / 2 - 0.02, 0.2 + H / 2, 0); [-0.5, 0.5].forEach((z) => rod(g, V(-L / 2 - 0.06, 0.4, z), V(-L / 2 - 0.06, H, z), 0.025, EM.dark, 4));
  [0.6, -0.6].forEach((z) => { rbox(g, 0.5, 0.9, 0.9, 0.05, EM.greyL, L / 2 + 0.25, 1.2, z, 0.02); cylX(g, 0.3, 0.04, EM.dark, L / 2 + 0.51, 1.25, z, 14); });
  // the gauge on the long side: a battery shape with 4 cells, and a lightning bolt
  const gz = W / 2 + 0.05; rbox(g, 2.4, 1.0, 0.06, 0.12, EM.dark, 0.3, 1.45, gz, 0.02); rbox(g, 0.16, 0.4, 0.06, 0.04, EM.dark, 1.58, 1.45, gz, 0.01);
  const cells = [0, 1, 2, 3].map((i) => { const m = lit(0x2a5a3a, 0x4cff7a); rbox(g, 0.46, 0.72, 0.04, 0.05, m, -0.6 + i * 0.58, 1.45, gz + 0.03, 0.01); return m; });
  ext(g, [[0.12, 0.42], [-0.16, -0.05], [0.02, -0.05], [-0.1, -0.42], [0.2, 0.08], [0.02, 0.08]], 0.02, 0.04, EM.yel, -1.6, 1.45, gz + 0.02, 0.01);
  return cells;
}
function sheepM(p, x, z, ry) {
  const g = grp(p, x, 0, z); g.rotation.y = ry; const body = grp(g);
  const b = sph(body, 1, EM.wool, 0, 0.62, 0); b.scale.set(0.55, 0.36, 0.36); [[-0.3, 0.12], [0.3, 0.12], [-0.3, -0.12], [0.3, -0.12]].forEach(([lx, lz]) => cylY(body, 0.05, 0.42, EM.sheepH, lx, 0.21, lz, 6));
  sph(body, 0.22, EM.wool, -0.1, 0.8, 0); sph(body, 0.2, EM.wool, 0.2, 0.78, 0.05); freeze(body);
  const head = grp(g, 0.5, 0.72, 0); sph(head, 1, EM.sheepH, 0.14, 0, 0).scale.set(0.19, 0.15, 0.14); [1, -1].forEach((s) => { const e = sph(head, 1, EM.sheepH, 0.06, 0.05, s * 0.14); e.scale.set(0.06, 0.03, 0.1); });
  g.userData.head = head; return g;
}
/** Main power transformer: tank, radiators, conservator, porcelain bushings, cabinet. */
function transformerM(T) {
  const d = grp(T);
  rbox(d, 4.6, 0.5, 3.0, 0.05, EM.conc, 0, 0.25, 0, 0.02); [-0.9, 0.9].forEach((z) => box(d, 3.8, 0.12, 0.12, EM.dark, 0, 0.56, z));
  rbox(d, 3.0, 2.4, 2.1, 0.1, EM.tank, 0, 1.82, 0, 0.03); rbox(d, 3.1, 0.12, 2.2, 0.03, EM.tank, 0, 3.05, 0, 0.02);
  for (let x = -1.2; x <= 1.2; x += 0.6) box(d, 0.08, 2.2, 0.06, EM.tank, x, 1.8, 1.08);
  [1, -1].forEach((s) => { for (let i = 0; i < 7; i++) box(d, 0.05, 2.0, 1.5, EM.tank, s * (1.75 + i * 0.15), 1.85, 0); [0.95, 2.75].forEach((y) => cylX(d, 0.07, 1.1, EM.tank, s * 2.0, y, 0.6, 8)); });
  cylX(d, 0.34, 2.0, EM.tank, -0.2, 3.95, -0.8, 16); [-0.9, 0.5].forEach((x) => box(d, 0.08, 0.8, 0.08, EM.tank, x, 3.4, -0.8)); rod(d, V(0.3, 3.7, -0.8), V(0.6, 3.1, -0.4), 0.05, EM.tank); rbox(d, 0.2, 0.16, 0.16, 0.02, EM.grey, 0.45, 3.4, -0.6, 0.01);
  [-0.9, 0, 0.9].forEach((x) => { add(d, INS, EM.porc, x, 3.1, -0.45).scale.set(0.95, 1.4, 0.95); cylY(d, 0.1, 0.14, EM.galva, x, 4.55, -0.45, 10); add(d, INS, EM.porc, x, 3.1, 0.55).scale.set(0.7, 0.8, 0.7); cylY(d, 0.08, 0.1, EM.galva, x, 3.93, 0.55, 10); });
  rbox(d, 0.8, 1.0, 0.3, 0.04, EM.greyL, 1.0, 1.4, 1.2, 0.02); box(d, 0.02, 0.9, 0.02, EM.dark, 1.0, 1.4, 1.36); rbox(d, 0.5, 0.3, 0.03, 0.02, EM.white, -0.7, 1.6, 1.07, 0.01);
  danger(d, -0.7, 2.3, 1.08, 0.7);
  freeze(d);
}
/** Articulated bucket truck: cab, lockers, outriggers, turret, two booms, insulated bucket with a technician. */
function bucketTruck(st, p) {
  const g = grp(p), d = grp(g), W = EM.white;
  [0.45, -0.45].forEach((z) => rbox(d, 6.6, 0.26, 0.15, 0.03, MT.black, -0.5, 0.95, z, 0.01));
  truckCab(d, W, 1.25);
  rbox(d, 4.7, 0.95, 2.3, 0.06, W, -1.2, 1.6, 0, 0.02); box(d, 4.72, 0.14, 2.32, EM.orange, -1.2, 1.2, 0); box(d, 4.72, 0.05, 2.32, EM.yel, -1.2, 1.32, 0);
  [1, -1].forEach((s) => { for (let i = 0; i < 4; i++) { const x = -3.2 + i * 1.12; box(d, 0.03, 0.62, 0.02, EM.greyL, x - 0.5, 1.7, s * 1.16); rbox(d, 0.18, 0.05, 0.04, 0.01, MT.chrome, x - 0.15, 1.75, s * 1.17, 0.005); } });
  rbox(d, 0.06, 0.55, 2.0, 0.02, MT.stripes, -3.56, 1.55, 0, 0.01); [0.8, -0.8].forEach((z) => rbox(d, 0.06, 0.14, 0.22, 0.02, MT.tail, -3.58, 1.25, z, 0.01)); rbox(d, 0.3, 0.12, 2.2, 0.03, MT.black, -3.6, 0.85, 0, 0.01);
  box(d, 4.5, 0.04, 2.2, EM.greyL, -1.2, 2.09, 0); rail(d, [[-3.5, 2.1, 1.1], [-3.5, 2.6, 1.1], [-0.5, 2.6, 1.1], [-0.5, 2.1, 1.1]], 0.02, EM.yel);
  rbox(d, 0.2, 0.75, 0.2, 0.03, EM.dark, 0.85, 2.45, 0, 0.01); rbox(d, 0.2, 0.08, 0.6, 0.03, EM.dark, 0.85, 2.85, 0, 0.01); // boom rest
  cylY(d, 0.55, 0.3, EM.dark, -2.4, 2.25, 0, 18);
  rbox(d, 0.9, 0.5, 0.5, 0.05, EM.greyL, -0.4, 0.75, 0.95, 0.02); cylY(d, 0.25, 0.9, EM.greyL, -0.2, 0.75, -0.95, 12).rotation.z = Math.PI / 2;
  const legs = [];
  [[0.75, 1], [0.75, -1], [-3.3, 1], [-3.3, -1]].forEach(([x, s]) => { rbox(d, 0.28, 0.7, 0.28, 0.03, EM.yel, x, 1.05, s * 1.25, 0.01); const l = grp(g, x, 0, s * 1.25); l.userData.dynamic = true; cylY(l, 0.08, 0.7, EM.steel, 0, 0.98, 0, 8); cylY(l, 0.24, 0.06, EM.dark, 0, 0.66, 0, 12); legs.push(l); });
  freeze(d);
  const wheels = [];
  [[2.2, 0.36], [-1.7, 0.42]].forEach(([x, w]) => [1, -1].forEach((s) => { wheels.push(tire(g, 0.5, w, x, 0.5, s * 0.98, EM.greyL, s)); fender(g, 0.6, w + 0.06, x, 0.5, s * 0.98, MT.black, Math.PI * 0.5); }));
  beacon(st, g, 1.9, 2.95, 0.6); beacon(st, g, 1.9, 2.95, -0.6);
  // aerial device
  const turret = grp(g, -2.4, 2.4, 0); turret.userData.dynamic = true;
  rbox(turret, 1.0, 0.6, 0.9, 0.08, W, 0, 0.25, 0, 0.02); rbox(turret, 0.35, 0.35, 0.6, 0.04, EM.dark, -0.45, 0.2, 0, 0.02); box(turret, 1.02, 0.08, 0.92, EM.orange, 0, 0.05, 0);
  const lb = grp(turret, 0.25, 0.5, 0); rbox(lb, 3.8, 0.34, 0.34, 0.05, W, 1.9, 0, 0, 0.02); box(lb, 3.6, 0.06, 0.35, EM.orange, 1.9, -0.08, 0); cylZ(lb, 0.12, 0.5, EM.dark, 0, 0, 0, 10); cylZ(lb, 0.14, 0.9, EM.dark, 3.8, 0, 0.18, 12);
  const A = anchor(turret, 0.7, 0.05, 0), B = anchor(lb, 1.25, -0.2, 0); const hyd = hydraulic(turret, A, B, { barrel: 0.9, rb: 0.08, mat: EM.greyL });
  const ub = grp(lb, 3.8, 0, 0.36); rbox(ub, 2.8, 0.28, 0.28, 0.05, W, 1.4, 0, 0, 0.02); rbox(ub, 1.6, 0.26, 0.26, 0.05, EM.yel, 3.6, 0, 0, 0.02); cylZ(ub, 0.1, 0.4, EM.dark, 4.4, 0, 0, 10);
  const bk = grp(ub, 4.4, 0, 0);
  const bucket = grp(bk, -0.55, -0.5, 0.3); rbox(bucket, 0.85, 1.05, 0.8, 0.08, EM.yel, 0, 0, 0, 0.03); rbox(bucket, 0.92, 0.08, 0.86, 0.03, EM.dark, 0, 0.52, 0, 0.01); rbox(bucket, 0.2, 0.25, 0.15, 0.03, EM.dark, 0.38, 0.5, 0.3, 0.01); rod(bucket, V(0.0, 0.52, -0.4), V(0.0, 0.3, -0.55), 0.04, EM.dark);
  const tech = walker(bucket, -0.05, 0, { vest: true, hat: MT.hat }); tech.position.y = -0.5; tech.scale.setScalar(0.92);
  [-1, 1].forEach((s) => sph(tech, 0.07, MT.orange, 0, 0.5, s * 0.22)); // big insulating gloves
  lb.rotation.z = 0.08; ub.rotation.z = Math.PI - 0.16; bk.rotation.z = -(lb.rotation.z + ub.rotation.z);
  shadows(g);
  return { g, wheels, legs, turret, lb, ub, bk, tech, hyd };
}
/** Charging post: pillar, screen with 4 bars, green light ring, cable holster. */
function borneM(p, x, z) {
  const g = grp(p, x, 0, z);
  rbox(g, 0.7, 0.15, 0.6, 0.04, EM.conc, 0, 0.07, 0, 0.02); rbox(g, 0.45, 1.6, 0.34, 0.08, EM.white, 0, 0.95, 0, 0.02); rbox(g, 0.47, 0.18, 0.36, 0.05, EM.green, 0, 1.68, 0, 0.02);
  const ring = lit(0x3aa46a, 0x4cff7a); ring.emissiveIntensity = 0.8; box(g, 0.02, 0.9, 0.04, ring, -0.23, 0.95, 0.12);
  rbox(g, 0.03, 0.42, 0.26, 0.03, EM.dark, -0.235, 1.3, 0, 0.01);
  const screen = [0, 1, 2, 3].map((i) => { const m = lit(0x1e3a2a, 0x4cff7a); box(g, 0.02, 0.07, 0.18, m, -0.25, 1.17 + i * 0.085, 0); return m; });
  rbox(g, 0.12, 0.18, 0.16, 0.03, EM.dark, -0.1, 1.15, 0.2, 0.01); // holster
  ext(g, [[0.04, 0.09], [-0.05, -0.01], [0.0, -0.01], [-0.04, -0.09], [0.06, 0.02], [0.01, 0.02]], 0.005, 0.02, EM.yel, 0, 1.55, 0.18, 0.003);
  return { g, screen };
}
/** A small electric car (~3.1 long), wheels on y = 0, facing +x. */
function eCar(p, col) {
  const g = grp(p), body = grp(g), B = std(col, 0.3, 0.3), Wd = 1.5;
  ext(body, [[-1.55, 0.24], [1.5, 0.24], [1.62, 0.44], [1.58, 0.72], [0.75, 0.86], [0.1, 1.28], [-1.05, 1.3], [-1.5, 1.02], [-1.6, 0.55]], [0.1, 0.12, 0.15, 0.2, 0.3, 0.2, 0.25, 0.2, 0.1], Wd, B, 0, 0, 0, 0.05);
  ext(body, [[0.62, 0.9], [0.1, 1.21], [-0.98, 1.22], [-1.36, 0.98], [-1.36, 0.9]], [0.04, 0.1, 0.1, 0.06, 0.02], Wd + 0.02, MT.glassD, 0, 0, 0, 0.01);
  const ws = box(body, 0.03, 0.74, Wd - 0.2, MT.glassD, 0.44, 1.08, 0); ws.rotation.z = 0.9989;
  const rw = box(body, 0.03, 0.48, Wd - 0.25, MT.glassD, -1.29, 1.17, 0); rw.rotation.z = -0.99;
  box(body, 0.08, 0.32, Wd + 0.04, B, -0.36, 1.05, 0);
  [1, -1].forEach((s) => { rbox(body, 0.06, 0.1, 0.34, 0.03, MT.lamp, 1.58, 0.68, s * 0.5, 0.01); rbox(body, 0.06, 0.1, 0.3, 0.03, MT.tail, -1.58, 0.78, s * 0.5, 0.01); rbox(body, 0.16, 0.1, 0.12, 0.03, B, 0.6, 0.98, s * 0.8, 0.02); box(body, 0.02, 0.5, 0.02, EM.dark, 0.62, 0.62, s * (Wd / 2 + 0.005)); box(body, 0.02, 0.5, 0.02, EM.dark, -0.36, 0.62, s * (Wd / 2 + 0.005)); rbox(body, 0.14, 0.03, 0.03, 0.01, MT.chrome, 0.2, 0.78, s * (Wd / 2 + 0.01), 0.005);
    ext(body, [[0.06, 0.1], [-0.05, -0.01], [0.0, -0.01], [-0.04, -0.1], [0.07, 0.02], [0.02, 0.02]], 0.005, 0.02, EM.green, -0.9, 0.62, s * (Wd / 2 + 0.01), 0.003); });
  rbox(body, 0.12, 0.2, Wd - 0.1, 0.04, EM.dark, 1.58, 0.36, 0, 0.02); rbox(body, 0.12, 0.2, Wd - 0.1, 0.04, EM.dark, -1.58, 0.36, 0, 0.02);
  const flap = grp(g, 1.63, 0.6, -0.12); rbox(flap, 0.03, 0.16, 0.24, 0.03, B, 0, 0, 0.12, 0.01); flap.userData.dynamic = true; cylX(g, 0.07, 0.04, EM.dark, 1.61, 0.6, 0, 10);
  const wheels = [];
  [1.0, -1.0].forEach((x) => [1, -1].forEach((s) => wheels.push(tire(g, 0.32, 0.2, x, 0.32, s * 0.66, EM.greyL, s))));
  shadows(g);
  return { g, body, wheels, flap, port: anchor(g, 1.68, 0.6, 0) };
}
/** A village house (gable roof, door, windows with shutters, chimney). Returns { g, win } where win lights up. */
function vhouse(p, x, z, ry, o = {}) {
  const g = grp(p, x, 0, z); g.rotation.y = ry;
  const W = o.w || 4.2, D = o.d || 3.4, H = o.h || 2.6, wall = o.wall || EM.wall, roof = o.roof || EM.roof, sh = o.shut || EM.greenD;
  rbox(g, W, H, D, 0.05, wall, 0, H / 2, 0, 0.03); rbox(g, W + 0.1, 0.25, D + 0.1, 0.03, EM.concD, 0, 0.12, 0, 0.01);
  const RH = 1.45, al = Math.atan2(RH, D / 2), sl = Math.hypot(D / 2, RH) + 0.4;
  const gb = ext(g, [[0, 0], [D, 0], [D / 2, RH]], 0.02, W - 0.02, wall, -D / 2 * 0, H, 0, 0.01); gb.rotation.y = Math.PI / 2; gb.position.set(0, H, D / 2);
  [1, -1].forEach((s) => { const r = box(g, W + 0.5, 0.16, sl, roof, 0, H + RH / 2 + Math.cos(al) * 0.08, s * (D / 4 + Math.sin(al) * 0.08)); r.rotation.x = s * al; });
  box(g, W + 0.5, 0.12, 0.2, std(0x8a3a2a, 0.8, 0), 0, H + RH + 0.05, 0);
  rbox(g, 0.45, 1.0, 0.45, 0.03, MT.brick, W / 4, H + RH, -D / 5, 0.01);
  const win = lit(0x3a4a66, 0xffc24a);
  rbox(g, 0.75, 1.45, 0.08, 0.03, EM.wood, -W / 4, 0.75, D / 2 + 0.02, 0.01); sph(g, 0.04, MT.chrome, -W / 4 + 0.25, 0.75, D / 2 + 0.08);
  [[W / 4, 1.4], [-W / 4 + 1.0 > W / 2 - 0.6 ? 0 : W / 4 - 1.2, 1.4]].slice(0, 1).forEach(([wx, wy]) => { box(g, 0.7, 0.7, 0.06, win, wx, wy, D / 2 + 0.02); [1, -1].forEach((s) => box(g, 0.32, 0.72, 0.05, sh, wx + s * 0.55, wy, D / 2 + 0.04)); box(g, 0.8, 0.06, 0.14, EM.white, wx, wy - 0.4, D / 2 + 0.06); });
  [[-W / 4, 1.4], [W / 4, 1.4]].forEach(([wx, wy]) => { box(g, 0.7, 0.7, 0.06, win, wx, wy, -D / 2 - 0.02); });
  [1, -1].forEach((s) => box(g, 0.06, 0.6, 0.6, win, s * (W / 2 + 0.02), 1.4, 0));
  if (o.awning) { const a = box(g, W * 0.8, 0.06, 0.9, o.awning, 0, 2.15, D / 2 + 0.45); a.rotation.x = 0.3; }
  return { g, win };
}
/** The cut-away house: three rooms seen from the open front (kitchen, living room, child's bedroom). */
function houseCut(S) {
  const d = grp(S), o = {};
  rbox(d, 10.6, 0.25, 6.6, 0.03, EM.concD, 0, 0.12, 0, 0.01);
  [[-3.25, EM.tile], [0.2, EM.floor], [3.45, EM.floor]].forEach(([x, m], i) => box(d, [3.5, 3.4, 3.1][i], 0.04, 6.2, m, x, 0.24, 0));
  rbox(d, 10.6, 3.0, 0.22, 0.02, EM.wall, 0, 1.7, -3.1, 0.01); [-5.2, 5.2].forEach((x) => rbox(d, 0.22, 3.0, 6.4, 0.02, EM.wall, x, 1.7, 0, 0.01));
  [-1.5, 1.9].forEach((x) => rbox(d, 0.16, 3.0, 4.6, 0.02, EM.wall, x, 1.7, -0.8, 0.01));
  [[-3.3, 3.4, EM.paperY], [0.2, 3.2, EM.paperB], [3.55, 3.1, EM.paperP]].forEach(([x, w, m]) => box(d, w, 2.95, 0.02, m, x, 1.7, -2.98));
  const CEIL = std(0xf6f2ea, 0.8, 0), ROOFC = std(0xc0583a, 0.75, 0); o.noShadow = [CEIL, ROOFC];
  rbox(d, 10.6, 0.16, 4.0, 0.02, CEIL, 0, 3.26, -1.1, 0.01);
  { const al = Math.atan2(2.1, 3.7), r = box(d, 11.4, 0.2, Math.hypot(3.7, 2.1) + 0.3, ROOFC, 0, 4.25 + Math.cos(al) * 0.1, -1.85 - Math.sin(al) * 0.1); r.rotation.x = -al; box(d, 11.4, 0.18, 0.24, std(0x8a3a2a, 0.8, 0), 0, 5.3, 0.0); }
  [-5.2, 5.2].forEach((x) => { const gb = ext(d, [[0, 0], [3.3, 0], [0, 2.05]], 0.02, 0.22, EM.wall, x, 3.2, 0, 0.01); gb.rotation.y = Math.PI / 2; });
  rbox(d, 0.5, 1.3, 0.5, 0.03, MT.brick, 3.5, 5.0, -2.0, 0.01);
  // red cut edges, to show the house is opened like a doll's house
  [-5.2, -1.5, 1.9, 5.2].forEach((x) => box(d, 0.24, 3.0, 0.05, EM.red, x, 1.7, x === -1.5 || x === 1.9 ? 1.5 : 3.2)); box(d, 10.6, 0.17, 0.05, EM.red, 0, 3.26, 0.9);
  // kitchen: meter, panel, fridge (its door opens), table and chairs
  rbox(d, 0.32, 0.45, 0.14, 0.04, EM.lime, -4.55, 1.75, -2.9, 0.01); box(d, 0.2, 0.08, 0.02, MT.glassD, -4.55, 1.85, -2.82);
  rbox(d, 0.55, 0.7, 0.12, 0.03, EM.white, -4.0, 1.7, -2.9, 0.01); for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) box(d, 0.07, 0.14, 0.03, i === 0 ? EM.red : EM.dark, -4.2 + i * 0.1, 1.55 + r * 0.28, -2.83);
  const fx0 = -3.0, fr = grp(S, fx0, 0.26, -2.5); fr.userData.dynamic = true;
  rbox(fr, 0.82, 0.06, 0.74, 0.02, EM.white, 0, 0.03, 0, 0.01); rbox(fr, 0.82, 0.06, 0.74, 0.02, EM.white, 0, 1.87, 0, 0.01); [-0.38, 0.38].forEach((x) => rbox(fr, 0.06, 1.9, 0.74, 0.02, EM.white, x, 0.95, 0, 0.01)); box(fr, 0.8, 1.88, 0.04, EM.white, 0, 0.95, -0.35);
  const inner = lit(0xdff0ff, 0xeaf6ff); box(fr, 0.68, 1.75, 0.02, inner, 0, 0.95, -0.32); [0.5, 0.95, 1.4].forEach((y) => box(fr, 0.68, 0.02, 0.6, EM.paperB, 0, y, 0));
  [[-0.2, 0.62, EM.red], [0.05, 0.6, EM.yel], [0.22, 1.08, EM.green], [-0.15, 1.1, EM.white], [0.15, 1.52, EM.orange]].forEach(([x, y, m]) => rbox(fr, 0.14, 0.2, 0.14, 0.03, m, x, y, 0, 0.01));
  const door = grp(fr, -0.41, 0, 0.37); rbox(door, 0.82, 1.86, 0.07, 0.03, EM.white, 0.41, 0.95, 0, 0.01); rbox(door, 0.04, 0.5, 0.05, 0.02, EM.grey, 0.74, 1.2, 0.06, 0.01);
  [[0.3, 1.5, EM.red], [0.5, 1.6, EM.blue], [0.4, 1.3, EM.yel]].forEach(([x, y, m]) => cylZ(door, 0.05, 0.02, m, x, y, 0.045, 8)); box(door, 0.3, 0.36, 0.01, EM.paperY, 0.35, 0.7, 0.04);
  o.fridge = fr; o.fx0 = fx0; o.door = door; o.inner = inner;
  rbox(d, 1.0, 0.06, 0.8, 0.02, EM.woodL, -3.3, 0.95, 0.9, 0.01); [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(([x, z]) => box(d, 0.05, 0.7, 0.05, EM.wood, -3.3 + x, 0.6, 0.9 + z));
  [-0.75, 0.75].forEach((dz) => { rbox(d, 0.4, 0.05, 0.4, 0.02, EM.red, -3.3, 0.66, 0.9 + dz, 0.01); box(d, 0.4, 0.45, 0.04, EM.red, -3.3, 0.9, 0.9 + dz * 1.25); });
  // living room: sofa, floor lamp, coffee table, rug, switch, a picture
  rbox(d, 2.2, 0.42, 0.85, 0.08, EM.sofa, 0.1, 0.47, -2.45, 0.02); rbox(d, 2.2, 0.6, 0.22, 0.08, EM.sofa, 0.1, 0.9, -2.82, 0.02); [-1.0, 1.2].forEach((x) => rbox(d, 0.22, 0.6, 0.85, 0.08, EM.sofa, x, 0.6, -2.45, 0.02));
  [-0.45, 0.6].forEach((x) => rbox(d, 0.95, 0.12, 0.7, 0.06, std(0x4aa08a, 0.9, 0), x, 0.73, -2.4, 0.02)); rbox(d, 0.4, 0.3, 0.14, 0.06, EM.yel, -0.5, 0.95, -2.6, 0.02);
  box(d, 2.6, 0.02, 1.8, EM.rug, 0.2, 0.27, -0.6); rbox(d, 1.0, 0.05, 0.6, 0.02, EM.woodL, 0.2, 0.62, -1.0, 0.01); [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]].forEach(([x, z]) => box(d, 0.05, 0.36, 0.05, EM.wood, 0.2 + x, 0.43, -1.0 + z));
  cylY(d, 0.2, 0.04, EM.dark, 1.45, 0.28, -2.4, 14); cylY(d, 0.025, 1.6, EM.dark, 1.45, 1.08, -2.4, 6);
  const lamp = lit(0xfff3c8, 0xffd070); add(d, new THREE.CylinderGeometry(0.18, 0.32, 0.38, 16, 1, true), std(0xfff3c8, 0.8, 0, { side: THREE.DoubleSide, emissive: 0xffd070, emissiveIntensity: 0 }), 1.45, 1.95, -2.4);
  sph(d, 0.1, lamp, 1.45, 1.85, -2.4); o.lamp = lamp;
  const halo = (x, y, z, r, c) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); const h = sph(S, r, m, x, y, z); h.layers.set(1); return m; };
  o.lampHalo = halo(1.45, 1.9, -2.3, 0.75, 0xffd070); o.nightHalo = halo(2.3, 1.0, -2.5, 0.45, 0xffe08a);
  const shade = d.children[d.children.length - 2]; shade.material = lamp; // shade glows with the bulb
  rbox(d, 0.03, 0.2, 0.13, 0.02, EM.white, -1.41, 1.25, 0.9, 0.01); box(d, 0.03, 0.08, 0.05, EM.greyL, -1.39, 1.27, 0.9);
  box(d, 0.7, 0.5, 0.03, EM.woodL, 0.1, 2.05, -2.96); box(d, 0.6, 0.4, 0.02, EM.paperB, 0.1, 2.05, -2.94); sph(d, 0.08, EM.yel, 0.25, 2.15, -2.93);
  // child's bedroom: bed, blanket (when asleep), bedside table, night light, toys, protected socket
  rbox(d, 2.1, 0.35, 1.1, 0.04, EM.woodL, 3.65, 0.45, -2.4, 0.02); rbox(d, 2.0, 0.22, 1.0, 0.08, EM.white, 3.65, 0.72, -2.4, 0.02); rbox(d, 0.1, 0.9, 1.1, 0.04, EM.woodL, 2.62, 0.75, -2.4, 0.02);
  rbox(d, 0.45, 0.14, 0.7, 0.06, EM.paperB, 2.95, 0.88, -2.4, 0.03);
  const blanket = grp(S, 3.95, 0.88, -2.4); rbox(blanket, 1.35, 0.14, 1.04, 0.06, EM.blue, 0, 0, 0, 0.03); [[-0.3, 0.2], [0.2, -0.25], [0.4, 0.25]].forEach(([x, z]) => box(blanket, 0.12, 0.02, 0.12, EM.yel, x, 0.08, z)); blanket.visible = false; o.blanket = blanket;
  rbox(d, 0.45, 0.55, 0.4, 0.03, EM.white, 2.3, 0.52, -2.6, 0.01);
  const night = lit(0xfff0b0, 0xffd27a); const moon = grp(S, 2.3, 1.0, -2.6); moon.scale.setScalar(1.4); ext(moon, [[0.0, 0.18], [-0.13, 0.1], [-0.18, -0.02], [-0.1, -0.15], [0.06, -0.18], [-0.04, -0.06], [-0.05, 0.06]], 0.04, 0.1, night, 0, 0, 0, 0.02); sph(moon, 0.05, night, 0.08, 0.1, 0); cylY(moon, 0.1, 0.06, EM.white, 0, -0.18, 0, 12);
  o.night = night; o.nightOn = false;
  box(d, 0.26, 0.26, 0.03, EM.white, 2.85, 0.48, -2.96); const cover = grp(S, 2.85, 0.48, -2.92); cylZ(cover, 0.08, 0.06, EM.orange, 0, 0, 0.0, 12); cylZ(cover, 0.04, 0.05, EM.yel, 0, 0, 0.04, 10); o.cover = cover;
  [[4.4, 0.4, EM.red], [4.62, 0.4, EM.blue], [4.5, 0.62, EM.yel]].forEach(([x, y, m]) => rbox(d, 0.2, 0.2, 0.2, 0.03, m, x, y, 0.8, 0.01)); sph(d, 0.14, EM.pink, 3.4, 0.4, 1.4);
  box(d, 1.8, 0.02, 1.4, EM.pink, 3.6, 0.27, 0.5); box(d, 0.6, 0.8, 0.02, EM.paperY, 4.4, 2.0, -2.95); sph(d, 0.12, EM.orange, 4.4, 2.0, -2.93);
  // wires inside the walls (shown faintly)
  const WM = std(0xd8c0a0, 0.9, 0), WZ = -2.86;
  [[V(-4.0, 2.05, WZ), V(-4.0, 2.86, WZ)], [V(-4.1, 2.86, WZ), V(2.3, 2.86, WZ)], [V(1.62, 2.86, WZ), V(1.62, 0.35, WZ)], [V(-3.0, 2.86, WZ), V(-3.0, 2.15, WZ)], [V(2.3, 2.86, WZ), V(2.3, 0.85, WZ)], [V(-4.55, 2.86, WZ), V(-4.55, 2.0, WZ)]].forEach(([a, b]) => rod(d, a, b, 0.018, WM, 4));
  // garden: hedge at the back, fence, flowers, a swing, the mailbox
  for (let x = -5.6; x <= 5.6; x += 1.1) { const b = add(d, ICO, 0x3f8a3a, x, 0.6, -4.1); b.scale.set(0.75, 0.7, 0.6); }
  [[-6.2, -5.2, -6.2, 5.6], [6.2, -5.2, 6.2, 5.6]].forEach(([x0, z0, x1, z1]) => { for (let z = z0; z <= z1; z += 0.8) box(d, 0.08, 0.8, 0.08, EM.white, x0, 0.4, z); [0.35, 0.65].forEach((y) => box(d, 0.05, 0.06, z1 - z0, EM.white, x0, y, (z0 + z1) / 2)); });
  [[-5.8, 4.6, EM.red], [-5.4, 5.0, EM.yel], [5.6, 4.8, EM.pink], [5.2, 5.2, EM.red], [-4.8, 4.9, EM.pink]].forEach(([x, z, m]) => { cylY(d, 0.02, 0.4, EM.greenD, x, 0.2, z, 4); sph(d, 0.12, m, x, 0.42, z); });
  { const sw = grp(d, 7.6, 0, 2.5); [-0.9, 0.9].forEach((x) => { rod(sw, V(x, 0, -0.6), V(x * 0.9, 2.2, 0), 0.05, EM.woodL); rod(sw, V(x, 0, 0.6), V(x * 0.9, 2.2, 0), 0.05, EM.woodL); }); rod(sw, V(-0.9, 2.2, 0), V(0.9, 2.2, 0), 0.06, EM.woodL); [-0.25, 0.25].forEach((x) => rod(sw, V(x, 2.2, 0), V(x, 0.55, 0), 0.01, EM.dark, 4)); rbox(sw, 0.6, 0.05, 0.3, 0.02, EM.red, 0, 0.55, 0, 0.01); }
  { const mb = grp(d, 6.9, 0, -4.4); cylY(mb, 0.04, 1.0, EM.wood, 0, 0.5, 0, 6); rbox(mb, 0.35, 0.28, 0.45, 0.08, EM.yel, 0, 1.1, 0, 0.02); }
  o.d = d; return o;
}

/* ================= the scenery (everything still, merged) ================= */
function at(p, h, d, yaw = YAW) { const [x, z] = Q(h, d); const g = grp(p, x, 0, z); g.rotation.y = yaw; return g; }
let ROTORS = [];
function buildScenery(root) {
  // hills at the back, the wind farm's other turbines on them
  const HILL = std(0x4c8238, 0.95, 0);
  [[-12, -41, 7.5, 1.5], [15, -42, 8.5, 1.6], [40, -33, 7, 1.3], [-44, -26, 7, 1.4]].forEach(([h, d, r, ht]) => { const [x, z] = Q(h, d); const m = add(root, HEMI, HILL, x, -0.05, z); m.scale.set(r, ht, r); });
  ROTORS = [];
  [[-12, -41, 0.3, 1.38], [15, -42, 0.2, 1.48]].forEach(([h, d, a, y]) => { const [x, z] = Q(h, d); const E = turbine(grp(root, x, y, z), false); E.g.parent.rotation.y = YAW; E.yaw.rotation.y = a; E.pitch.forEach((p) => (p.rotation.y = 1.3)); ROTORS.push(E); });
  // trees along the river and around the village, an orchard
  const G1 = [0x5aa84a, 0x4a9a3e, 0x6ab85a], G2 = [0x7ab84a, 0x5a9a3a, 0x8ac85a];
  [[-2, -20], [6, -17.5], [14, -15], [34, -12], [44, -9.5], [-16, -24], [22, -7], [-30, -8], [-46, 6], [-48, 18], [-34, 28], [-20, 30], [6, 33], [26, 33], [36, 29], [46, 14], [-8, 34], [-40, 10], [32, 5], [-4, 5], [10, 2], [-24, 6], [-31, 6], [-3, 43], [10, 38], [22, 42], [38, 33], [-24, 42], [-44, 30], [44, 24]].forEach(([h, d], i) => { const [x, z] = Q(h, d); autumnTree(root, x, z, i % 2 ? G1 : G2); });
  for (let i = 0; i < 6; i++) { const [x, z] = Q(-44 + (i % 3) * 3.4, 18 + Math.floor(i / 3) * 3.4); const t = autumnTree(root, x, z, [0x6ab84a, 0x5aa84a, 0x7ac85a]); t.scale.setScalar(0.7); sph(t, 0.18, EM.red, 0.6, 3.0, 0.6); sph(t, 0.18, EM.red, -0.5, 3.4, -0.4); }
  // the farm on the left, with its cows and hay
  barn(root, ...Q(-44, 0), YAW + Math.PI / 2); silo(root, ...Q(-48, -6), 7); roundBaleStack(root, ...Q(-36, 9), YAW, 3);
  [[-36, -4, 0.3], [-33, 0, 2.2], [-39, 3, 1.2]].forEach(([h, d, r]) => cow(at(root, h, d, r)));
  // a fence along the fields
  { const a = HD(-30, -10), b = HD(-30, 10); for (let t = 0; t <= 1.0001; t += 1 / 12) { const p = a.clone().lerp(b, t); box(root, 0.12, 0.8, 0.12, EM.wood, p.x, 0.4, p.z); } const L = a.distanceTo(b), m = a.clone().lerp(b, 0.5); [0.35, 0.65].forEach((y) => { const r = box(root, L, 0.06, 0.06, EM.wood, m.x, y, m.z); r.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); }); }
  // wheat field on the right with bales
  roundBaleStack(root, ...Q(44, -2), YAW + 0.5, 2);
  // the village: houses, a church, the bakery, the park
  [[-12, 22, 0, {}], [-4, 28, 0, { wall: EM.wallB, roof: EM.slate }], [6, 24, 0, { shut: EM.blue }], [-38, 25, 0.2, { wall: EM.wallB }], [41, 19, -0.3, { shut: EM.red }], [-20, 30, 0.1, { w: 3.6 }], [2, 33, 0, { wall: EM.wallB, awning: std(0xe5452c, 0.7, 0) }], [4, 41, 0.15, { shut: EM.red }], [30, 37, -0.1, { wall: EM.wallB, roof: EM.slate }], [-30, 36, 0.2, { shut: EM.blue, w: 3.8 }]].forEach(([h, d, r, o]) => { const [x, z] = Q(h, d); const H = vhouse(root, x, z, r, o); H.win.emissiveIntensity = 0.15; });
  { const g = at(root, -13, 38); rbox(g, 3.4, 3.6, 6.0, 0.05, std(0xe8dcc0, 0.85, 0), 0, 1.8, 0, 0.02); ext(g, [[-1.95, 0], [1.95, 0], [0, 2.0]], 0.02, 6.4, EM.slate, 0, 3.6, 0, 0.02);
    rbox(g, 1.8, 6.5, 1.8, 0.04, std(0xe8dcc0, 0.85, 0), 0, 3.25, -3.6, 0.02); add(g, new THREE.ConeGeometry(1.35, 3.2, 4), EM.slate, 0, 8.1, -3.6).rotation.y = Math.PI / 4; cylZ(g, 0.4, 0.05, EM.white, 0, 6.0, -2.68, 16); rod(g, V(0, 9.6, -3.6), V(0, 10.4, -3.6), 0.04, EM.dark); box(g, 0.5, 0.06, 0.06, EM.dark, 0, 10.2, -3.6); ext(g, [[-0.4, 0], [0.4, 0], [0.4, 1.2], [0, 1.6], [-0.4, 1.2]], 0.05, 0.06, EM.wood, 0, 0, 3.02, 0.02); }
  { const g = at(root, 17, 30); // the park
    [-1.4, 1.4].forEach((x) => { rod(g, V(x, 0, -0.8), V(x, 2.3, 0), 0.06, EM.red); rod(g, V(x, 0, 0.8), V(x, 2.3, 0), 0.06, EM.red); }); rod(g, V(-1.4, 2.3, 0), V(1.4, 2.3, 0), 0.07, EM.red); [-0.6, 0.6].forEach((x) => { [-0.2, 0.2].forEach((dx) => rod(g, V(x + dx, 2.3, 0), V(x + dx, 0.5, 0), 0.01, EM.dark, 4)); rbox(g, 0.5, 0.05, 0.25, 0.02, EM.yel, x, 0.5, 0, 0.01); });
    const sl = grp(g, 3.5, 0, 2); rail(sl, [[0, 0, -0.3], [0, 1.6, -0.3]], 0.04, EM.blue); rail(sl, [[0, 0, 0.3], [0, 1.6, 0.3]], 0.04, EM.blue); rbox(sl, 0.6, 0.06, 0.7, 0.02, EM.blue, 0, 1.6, 0, 0.01); const sd = box(sl, 2.6, 0.06, 0.6, EM.yel, 1.2, 0.85, 0); sd.rotation.z = -0.62;
    rbox(g, 2.2, 0.25, 2.2, 0.04, EM.woodL, -3.4, 0.12, 1.8, 0.02); box(g, 1.9, 0.05, 1.9, std(0xf0d890, 0.95, 0), -3.4, 0.22, 1.8); rbox(g, 1.6, 0.08, 0.4, 0.02, EM.woodL, 0, 0.45, -3, 0.01); }
  // the village transformer cabin (where the big line ends and the small ones start)
  { const g = at(root, 43, 7.5, YAW); rbox(g, 2.4, 2.7, 2.0, 0.05, EM.wallB, 0, 1.35, 0, 0.02); rbox(g, 2.6, 0.2, 2.2, 0.04, EM.slate, 0, 2.8, 0, 0.02); box(g, 0.9, 1.8, 0.05, EM.greenD, -0.4, 0.9, 1.01); for (let i = 0; i < 4; i++) box(g, 0.5, 0.05, 0.04, EM.grey, 0.6, 0.6 + i * 0.14, 1.02); danger(g, -0.4, 1.4, 1.06, 0.55); }
  // a fisherman on the river bank, reeds
  { const g = at(root, 26, -11.8, YAW + Math.PI / 2); walker(g, 0, 0, { top: 0x3aa46a, hat: EM.greenD }).scale.setScalar(0.9); rod(g, V(0.2, 0.9, 0.15), V(2.4, 2.0, 0.3), 0.012, EM.dark, 4); rbox(g, 0.4, 0.3, 0.3, 0.03, EM.blue, -0.4, 0.15, 0.4, 0.01); }
  RIVER.forEach(([h, d], i) => { if (i % 2) return; for (let k = 0; k < 5; k++) { const [x, z] = Q(h + rnd(-1.5, 1.5), d + (k % 2 ? 2.1 : -2.1)); cylY(root, 0.03, rnd(0.6, 1.0), EM.greenD, x, 0.4, z, 4); } });
  // a little bridge where the dam path meets the river side, benches, a bus stop
  { const g = at(root, -6, 17); rbox(g, 1.4, 0.08, 0.4, 0.02, EM.woodL, 0, 0.45, 0, 0.01); rbox(g, 1.4, 0.4, 0.06, 0.02, EM.woodL, 0, 0.7, -0.18, 0.01); [-0.6, 0.6].forEach((x) => box(g, 0.06, 0.45, 0.35, EM.dark, x, 0.22, 0)); }
  { const g = at(root, 12, 16.2); rbox(g, 2.6, 0.08, 1.0, 0.02, EM.dark, 0, 2.3, 0, 0.01); [-1.2, 1.2].forEach((x) => box(g, 0.08, 2.3, 0.08, EM.dark, x, 1.15, -0.4)); box(g, 2.4, 1.6, 0.04, MT.glass, 0, 1.3, -0.45); rbox(g, 1.8, 0.08, 0.35, 0.02, EM.woodL, 0, 0.5, -0.2, 0.01); }
  shadows(root); return root;
}
function cow(g) {
  rbox(g, 1.5, 0.75, 0.7, 0.25, EM.cow, 0, 1.0, 0, 0.05); [[-0.3, 0.36], [0.35, -0.36], [0.2, 0.36]].forEach(([x, z]) => box(g, 0.4, 0.4, 0.02, EM.cowD, x, 1.05, z));
  [[0.55, 0.22], [0.55, -0.22], [-0.55, 0.22], [-0.55, -0.22]].forEach(([x, z]) => cylY(g, 0.08, 0.7, EM.cow, x, 0.35, z, 6));
  rbox(g, 0.45, 0.4, 0.38, 0.12, EM.cow, 0.95, 1.05, 0, 0.03); rbox(g, 0.2, 0.22, 0.34, 0.08, EM.pink, 1.18, 0.95, 0, 0.02); [0.15, -0.15].forEach((z) => { sph(g, 0.04, MT.black, 1.15, 1.15, z); add(g, new THREE.ConeGeometry(0.04, 0.16, 6), EM.white, 0.9, 1.3, z * 1.3); });
  rod(g, V(-0.75, 1.2, 0), V(-0.85, 0.6, 0), 0.025, EM.cow, 4);
}

/* ================= the network: lines between the stations, with their pulses ================= */
function buildNetwork(root, scene, onUpdate) {
  const W = pulses(scene, 420);
  onUpdate((dt) => W.update(dt));
  const avg = (s) => s.reduce((a, v) => a.add(v), new V3()).multiplyScalar(1 / s.length);
  /** nodes: a list of attach points (fixed) or [h, d] for a new support of this kind. Returns one lane per wire. */
  function line(nodes, kind, o = {}) {
    const isFixed = (n) => n[0] instanceof V3;
    const cen = nodes.map((n) => (isFixed(n) ? avg(n) : HD(n[0], n[1])));
    const sets = nodes.map((n, i) => {
      if (isFixed(n)) return n.map((v) => v.clone());
      const a = cen[Math.max(0, i - 1)], b = cen[Math.min(nodes.length - 1, i + 1)], ry = Math.atan2(-(b.z - a.z), b.x - a.x);
      const s = kind === 'hv' ? pylonCat(root, o.H || 12) : kind === 'mv' ? mvPole(root) : lvPole(root);
      s.g.position.copy(cen[i]); s.g.rotation.y = ry; s.g.updateMatrixWorld(true);
      return s.att.map((v) => s.g.localToWorld(v.clone()));
    });
    const dir = new V3().subVectors(cen[cen.length - 1], cen[0]), perp = new V3(-dir.z, 0, dir.x).normalize();
    sets.forEach((s) => s.sort((p, q) => p.dot(perp) - q.dot(perp)));
    const lanes = [];
    for (let k = 0; k < sets[0].length; k++) {
      const path = [];
      for (let i = 0; i < sets.length - 1; i++) {
        const a = sets[i][Math.min(k, sets[i].length - 1)], b = sets[i + 1][Math.min(k, sets[i + 1].length - 1)];
        const sp = sag(a, b, a.distanceTo(b) * (o.sag || 0.03), 10); wire(root, sp, o.r || 0.035, o.m || EM.cable);
        if (i) sp.shift(); path.push(...sp);
      }
      lanes.push(W.lane(path, { gap: o.gap || 2.2, speed: o.speed || 5, size: o.size || 0.17 }));
    }
    return lanes;
  }
  const cabinHV = mvPole(root); { const p = HD(41.6, 4.6); cabinHV.g.position.copy(p); cabinHV.g.rotation.y = 0.3; cabinHV.g.updateMatrixWorld(true); }
  const cabinIn = cabinHV.att.map((v) => cabinHV.g.localToWorld(v.clone()));
  rod(root, cabinHV.g.position.clone().add(V(0, 0.5, 0)), HD(43, 7.5, 0.5), 0.05, EM.dark);
  line([ATT.barrage, ATT.posteIn[0]], 'hv', { gap: 2.2, sag: 0.025 });
  line([ATT.eolienne, [0, -17], [-6, -11], ATT.posteIn[1]], 'mv', { gap: 2.0, speed: 4.5, size: 0.15 });
  line([ATT.solaire, [4, -12], ATT.posteIn[2]], 'mv', { gap: 2.0, speed: 4.5, size: 0.15 });
  LANES.hv = line([ATT.posteOut, ATT.ligne, [36, -1.5], cabinIn], 'hv', { H: 13, gap: 2.4, speed: 6, size: 0.2 });
  const cabinLV = [HD(43, 6.4, 2.6)];
  line([cabinLV, [36, 15], ATT.maison, [14, 15], ATT.nacelleR], 'lv', { r: 0.045, m: MT.black, gap: 2.4, speed: 3.5, size: 0.14, sag: 0.025 });
  line([ATT.nacelleL, [-11, 6.5], [-19, 9], ATT.borne], 'lv', { r: 0.045, m: MT.black, gap: 2.4, speed: 3.5, size: 0.14, sag: 0.025 });
  shadows(root); freeze(root);
}

/* ================= life: cars, people, birds, ducks, the other turbines ================= */
function buildLife(scene, onUpdate) {
  const R = (pts, t = 0.1) => route(pts.map(([h, d]) => Q(h, d)), true, t);
  const road = R([[-48, 12.2], [48, 12.2], [50, 13], [48, 13.8], [-48, 13.8], [-50, 13]]);
  const cars = [pick(['car', 'van']), 'car', 'kei', 'van'].map((k) => miniCar(scene, k)); const t1 = traffic(road, cars, 3.6, { gap: 4 });
  const walk = R([[-40, 17.4], [16, 17.4], [16.5, 18], [-40, 18], [-40.5, 17.7]], 0.2);
  const people = Array.from({ length: 6 }, (_, i) => walker(scene, 0, 0, { kid: i === 2 || i === 5 })); const t2 = traffic(walk, people, 1.2, { gap: 1.0 });
  const all = cars.concat(people);
  // birds circling high above, ducks on the river
  const BM = std(0xf4f5f8, 0.7, 0), BW = std(0x5a6070, 0.7, 0);
  const birds = Array.from({ length: 9 }, (_, i) => {
    const g = grp(scene); const b = sph(g, 1, BM, 0, 0, 0); b.scale.set(0.32, 0.14, 0.14); sph(g, 0.1, BM, 0.3, 0.06, 0); add(g, new THREE.ConeGeometry(0.04, 0.14, 5), EM.orange, 0.42, 0.05, 0).rotation.z = -Math.PI / 2;
    const wings = [1, -1].map((s) => { const w = grp(g, 0, 0.04, s * 0.06); box(w, 0.22, 0.03, 0.55, BW, 0, 0, s * 0.28); return w; }); g.userData.w = wings; g.userData.k = i; g.layers.set(0); return g;
  });
  const ducks = Array.from({ length: 4 }, () => { const g = grp(scene); const b = sph(g, 1, std(0xf2f2ea, 0.7, 0), 0, 0.12, 0); b.scale.set(0.28, 0.14, 0.18); sph(g, 0.1, std(0x2a7a4e, 0.6, 0), 0.22, 0.28, 0); add(g, new THREE.ConeGeometry(0.04, 0.12, 5), EM.orange, 0.34, 0.27, 0).rotation.z = -Math.PI / 2; shadows(g); return g; });
  const riv = R(RIVER.slice(1, 6).map(([h, d]) => [h, d - 0.6]).concat(RIVER.slice(1, 6).reverse().map(([h, d]) => [h, d + 0.6])), 0.3);
  const t3 = traffic(riv, ducks, 0.5, { gap: 0.6 });
  let T = 0;
  onUpdate((dt) => {
    T += dt; t1.update(dt, all); t2.update(dt, all); t3.update(dt, ducks);
    birds.forEach((g) => { const k = g.userData.k, flock = k < 5 ? 0 : 1, a = T * (flock ? 0.18 : -0.14) + k * 0.35, r = flock ? 22 : 28, c = flock ? HD(-24, -18) : HD(14, -6);
      g.position.set(c.x + Math.cos(a) * r, (flock ? 17 : 21) + Math.sin(T + k) * 0.6, c.z + Math.sin(a) * r); g.rotation.y = flock ? -a - Math.PI / 2 + Math.PI : -a - Math.PI / 2;
      g.userData.w.forEach((w, i) => (w.rotation.x = (i ? -1 : 1) * Math.sin(T * 9 + k) * 0.5)); });
    ROTORS.forEach((E, i) => (E.hub.rotation.x -= dt * (0.35 + WIND * 1.1) * (1 + i * 0.1)));
  });
}
