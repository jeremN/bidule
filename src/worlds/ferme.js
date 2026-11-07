// La Ferme — six agricultural machines, one field strip each.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, easeBack, lin } from '../kit/tween.js';
import { engineOn, thud, ding, chime } from '../kit/audio.js';
import {
  C, MT, UB, ICO, dummy, tmpCol, std, add, box, grp, cylY, cylZ, cylX, rod, rail, sph, rbox, ext, arc, anchor, beam, wp, shadows
} from '../kit/geo.js';
import { tire, agriTire, fender, hydraulic, strut, beacon, worker, glassCab } from '../kit/parts.js';
import { autumnTree, barn, silo, fence, farmhouse, pond, lamp } from '../kit/props.js';

/* Fields are laid out in parallel strips. u = across strips (towards the camera), v = along a strip. */
const S2 = Math.SQRT1_2;
const P = (u, v) => [(u + v) * S2, (u - v) * S2];
const YAW = Math.PI / 4;

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const furrowTex = canvasTex(16, 64, (x) => {
  for (let i = 0; i < 64; i += 8) { x.fillStyle = '#8a5432'; x.fillRect(0, i, 16, 4); x.fillStyle = '#5e3820'; x.fillRect(0, i + 4, 16, 4); }
});
furrowTex.repeat.set(1, 2);
const strawSide = canvasTex(64, 64, (x) => {
  x.fillStyle = '#e2bd55'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) { x.strokeStyle = Math.random() < 0.5 ? 'rgba(150,105,35,.45)' : 'rgba(255,240,180,.5)'; x.beginPath(); const px = Math.random() * 64, py = Math.random() * 64; x.moveTo(px, py); x.lineTo(px + rnd(-6, 6), py + rnd(-2, 2)); x.stroke(); }
});
const strawEnd = canvasTex(64, 64, (x) => {
  x.fillStyle = '#e8c766'; x.fillRect(0, 0, 64, 64);
  for (let r = 30; r > 2; r -= 3) { x.strokeStyle = r % 2 ? 'rgba(160,115,40,.55)' : 'rgba(255,240,190,.45)'; x.lineWidth = 1.5; x.beginPath(); x.arc(32, 32, r, 0, 7); x.stroke(); }
});
const FM = {
  red: std(0xc8322a, 0.38, 0.2), green: std(0x3f8f3a, 0.38, 0.2), blue: std(0x2f5fd0, 0.36, 0.22),
  lime: std(0x7cb342, 0.38, 0.2), limeD: std(0x5a8a2e, 0.45, 0.2), orange: std(0xe8762a, 0.4, 0.2),
  amber: std(0xf0a81e, 0.38, 0.2), cap: std(0x2f6f3a, 0.7, 0), grain: std(0xe9b52f, 0.75, 0), soil: std(0x7a4a2c, 0.95, 0)
};
const BALE_GEO = new THREE.CylinderGeometry(0.85, 0.85, 1.45, 28); BALE_GEO.rotateX(Math.PI / 2);
const BALE_MATS = [new THREE.MeshStandardMaterial({ map: strawSide, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: strawEnd, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: strawEnd, roughness: 0.9 })];
const newBale = (p, x, y, z) => { const b = new THREE.Mesh(BALE_GEO, BALE_MATS); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; p.add(b); return b; };

/* ---------- content ---------- */
const DATA = {
  tracteur: { short: 'Le tracteur', full: 'Le tracteur et sa charrue', verb: 'Labourer', horn: 'horn',
    use: 'Il tire des outils. Ici, la charrue retourne la terre.',
    how: "Ses grandes roues l'empêchent de s'enfoncer. Derrière, le relevage monte et descend l'outil." },
  semoir: { short: 'Le semoir', full: 'Le semoir', verb: 'Semer', horn: 'horn',
    use: 'Il plante les graines, bien en ligne.',
    how: 'Ses petits disques ouvrent la terre, et les graines tombent dedans une par une.' },
  pulve: { short: 'Le pulvérisateur', full: 'Le pulvérisateur', verb: 'Arroser', horn: 'horn',
    use: 'Il donne à boire et à manger aux plantes.',
    how: 'Ses grands bras se déplient comme des ailes, et des petits trous font une pluie fine.' },
  moissonneuse: { short: 'La moissonneuse', full: 'La moissonneuse-batteuse', verb: 'Moissonner', horn: 'horn',
    use: 'Elle coupe le blé et garde les grains.',
    how: 'Le rabatteur couche le blé, la barre coupe les tiges, et dedans on secoue pour séparer les grains de la paille.' },
  presse: { short: 'La presse', full: 'La presse à balles', verb: 'Botteler', horn: 'horn',
    use: 'Elle ramasse la paille et la roule en grosses balles.',
    how: "Le pick-up attrape la paille, la presse la roule en boule, puis la porte s'ouvre." },
  telescopique: { short: 'Le télescopique', full: 'Le chariot télescopique', verb: 'Empiler', horn: 'horn',
    use: 'Il soulève les balles de paille très haut.',
    how: "Son bras sort comme une longue-vue : c'est pour ça qu'on l'appelle télescopique." }
};
const ORDER = ['tracteur', 'semoir', 'pulve', 'moissonneuse', 'presse', 'telescopique'];
const GND = '<path class="gnd" d="M4 75H116"/>';
const TRACTOR_SVG = (cls, dx = 0) => `<g transform="translate(${dx},0)">
  <rect class="${cls}" x="56" y="38" width="44" height="16" rx="3"/><rect class="k" x="98" y="40" width="5" height="12"/>
  <rect class="k" x="38" y="14" width="26" height="28" rx="2"/><rect class="g" x="42" y="18" width="18" height="18"/><rect class="${cls}" x="35" y="11" width="32" height="5" rx="2"/>
  <rect class="k" x="72" y="22" width="3" height="16"/>
  <circle class="k" cx="50" cy="56" r="18"/><circle class="y" cx="50" cy="56" r="7"/>
  <circle class="k" cx="92" cy="65" r="10"/><circle class="y" cx="92" cy="65" r="4"/></g>`;
const ICONS = {
  tracteur: GND + `<path class="s" d="M4 66l10-14h14l-6 14z"/><rect class="k" x="20" y="50" width="16" height="4"/>` + TRACTOR_SVG('r'),
  semoir: GND + `<path class="b" d="M4 30h26l-3 22H8z"/><circle class="s" cx="11" cy="62" r="7"/><circle class="s" cx="25" cy="62" r="7"/><rect class="k" x="28" y="50" width="10" height="4"/>` + TRACTOR_SVG('gr'),
  pulve: GND + `<rect class="k" x="2" y="27" width="116" height="3"/><path d="M8 32v3M20 32v3M32 32v3M88 32v3M100 32v3M112 32v3" stroke="#2b3040" stroke-width="2"/>
    <rect class="o" x="18" y="36" width="72" height="9" rx="2"/><rect class="w" x="24" y="17" width="42" height="19" rx="9"/>
    <rect class="k" x="70" y="12" width="22" height="24" rx="2"/><rect class="g" x="74" y="16" width="15" height="14"/>
    <rect class="k" x="28" y="45" width="4" height="12"/><rect class="k" x="80" y="45" width="4" height="12"/>
    <circle class="k" cx="30" cy="64" r="10"/><circle class="s" cx="30" cy="64" r="4"/><circle class="k" cx="82" cy="64" r="10"/><circle class="s" cx="82" cy="64" r="4"/>`,
  moissonneuse: GND + `<rect class="lm" x="4" y="13" width="44" height="4" rx="2"/><rect class="lm" x="10" y="20" width="60" height="34" rx="4"/><rect class="wt" x="16" y="13" width="38" height="9" rx="2"/>
    <rect class="k" x="60" y="9" width="26" height="26" rx="2"/><rect class="g" x="64" y="13" width="18" height="18"/>
    <path class="lm" d="M70 42l22 8v10l-22-6z"/><rect class="lmd" x="90" y="50" width="26" height="14" rx="2"/><circle class="reel" cx="104" cy="42" r="9"/>
    <circle class="k" cx="56" cy="60" r="14"/><circle class="y" cx="56" cy="60" r="5"/><circle class="k" cx="20" cy="66" r="8"/><circle class="y" cx="20" cy="66" r="3"/>`,
  presse: GND + `<circle class="r" cx="28" cy="50" r="21"/><circle class="wt" cx="28" cy="50" r="14"/><circle class="reel" cx="28" cy="50" r="7"/>
    <circle class="k" cx="30" cy="68" r="7"/><rect class="k" x="46" y="54" width="16" height="4"/>
    <g transform="translate(20,4) scale(.85)">${TRACTOR_SVG('b')}</g>`,
  telescopique: GND + `<path class="tlb" d="M16 44L86 18"/><rect class="tl" x="12" y="42" width="66" height="15" rx="3"/>
    <rect class="k" x="42" y="20" width="18" height="24" rx="2"/><rect class="g" x="45" y="24" width="12" height="14"/>
    <rect class="k" x="86" y="8" width="4" height="22"/><circle class="wt" cx="103" cy="20" r="12"/><circle class="reel" cx="103" cy="20" r="5"/>
    <circle class="k" cx="26" cy="63" r="11"/><circle class="s" cx="26" cy="63" r="4"/><circle class="k" cx="64" cy="63" r="11"/><circle class="s" cx="64" cy="63" r="4"/>`
};
const U = { moissonneuse: -12, pulve: -6, semoir: 0, tracteur: 6, presse: 12 };
const CFG = {};
Object.entries(U).forEach(([id, u]) => { const [x, z] = P(u, 0); CFG[id] = { x, z, yaw: YAW }; });
{ const [x, z] = P(-3, -13); CFG.telescopique = { x, z, yaw: YAW }; }

/* ---------- shared machines ---------- */
function tractor(st, parent, bodyM, rimM) {
  const g = grp(parent), W = [];
  [1, -1].forEach((s) => {
    W.push(agriTire(g, 0.92, 0.52, 0, 0.92, s * 0.9, rimM || MT.yel, s));
    W.push(agriTire(g, 0.56, 0.34, 2.3, 0.56, s * 0.78, rimM || MT.yel, s));
    fender(g, 1.05, 0.6, 0, 0.92, s * 0.9, bodyM, Math.PI * 0.6);
    fender(g, 0.66, 0.4, 2.3, 0.56, s * 0.8, bodyM, Math.PI * 0.45);
    rbox(g, 0.3, 0.05, 0.22, 0.02, MT.black, 0.62, 0.6, s * 0.62); rbox(g, 0.3, 0.05, 0.22, 0.02, MT.black, 0.62, 0.95, s * 0.62);
    for (let k = 0; k < 5; k++) box(g, 0.05, 0.3, 0.02, MT.black, 1.3 + k * 0.18, 1.3, s * 0.455);
  });
  rbox(g, 1.2, 0.6, 1.1, 0.08, MT.dark, -0.05, 0.95, 0);
  rbox(g, 2.2, 0.42, 0.62, 0.06, MT.dark, 1.45, 0.8, 0);
  rbox(g, 0.2, 0.2, 1.45, 0.03, MT.dark, 2.3, 0.56, 0);
  ext(g, [[0.55, 0.98], [2.8, 0.98], [2.9, 1.3], [2.78, 1.65], [0.55, 1.72]], [0.04, 0.08, 0.12, 0.1, 0.04], 0.88, bodyM, 0, 0, 0, 0.03);
  rbox(g, 0.06, 0.52, 0.66, 0.03, MT.black, 2.9, 1.3, 0); for (let i = 0; i < 5; i++) box(g, 0.02, 0.025, 0.6, MT.chrome, 2.94, 1.1 + i * 0.09, 0);
  [0.26, -0.26].forEach((z) => rbox(g, 0.05, 0.1, 0.16, 0.02, MT.lamp, 2.92, 1.52, z, 0.01));
  rbox(g, 0.45, 0.28, 0.62, 0.04, MT.dark, 3.05, 0.8, 0); for (let i = 0; i < 4; i++) rbox(g, 0.09, 0.46, 0.82, 0.02, MT.dark, 3.2 + i * 0.1, 0.92, 0, 0.01);
  cylY(g, 0.065, 1.25, MT.black, 0.8, 2.3, -0.34, 10); const cp = cylY(g, 0.075, 0.03, MT.black, 0.82, 2.94, -0.34, 10); cp.rotation.z = 0.4;
  cylY(g, 0.08, 0.75, MT.dark, 0.8, 2.05, 0.34, 12); sph(g, 0.1, MT.black, 0.8, 2.45, 0.34);
  const cab = glassCab(g, -0.12, 1.25, 0, { len: 1.4, wid: 1.32, h: 1.55, mat: MT.black, roof: bodyM, hat: FM.cap });
  beacon(st, cab, -0.35, 1.6, 0.35);
  rbox(g, 0.3, 0.4, 0.5, 0.04, MT.dark, -0.95, 0.75, 0);
  const imp = grp(g, -1.05, 0.55, 0);
  const links = [
    strut(g, anchor(g, -0.25, 0.55, 0.36), anchor(imp, 0, 0, 0.42), 0.08, MT.dark),
    strut(g, anchor(g, -0.25, 0.55, -0.36), anchor(imp, 0, 0, -0.42), 0.08, MT.dark),
    hydraulic(g, anchor(g, -0.7, 1.3, 0), anchor(imp, 0, 0.72, 0), { barrel: 0.4, rb: 0.055, mat: MT.dark }),
    hydraulic(g, anchor(g, -0.35, 1.25, 0.3), anchor(imp, 0.05, 0.2, 0.42), { barrel: 0.45, rb: 0.06, mat: bodyM }),
    hydraulic(g, anchor(g, -0.35, 1.25, -0.3), anchor(imp, 0.05, 0.2, -0.42), { barrel: 0.45, rb: 0.06, mat: bodyM })
  ];
  return { g, wheels: W, imp, links, cab };
}
/** Instanced field items with a per-item scale (0 = hidden). */
function fieldItems(parent, geo, list, colors, matOpts) {
  const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts || {})), list.length);
  im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(im);
  list.forEach((it, i) => im.setColorAt(i, tmpCol.setHex(it.col || pick(colors))));
  im.write = () => {
    list.forEach((it, i) => {
      const k = Math.max(0.001, it.k);
      dummy.position.set(it.x, it.y || 0, it.z); dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.sx * k, it.sy * (it.ky == null ? k : it.ky), it.sz * k); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  };
  im.write(); return im;
}
function growStrip(parent, X0, w, m, y) {
  const g = new THREE.BoxGeometry(1, 0.06, w); g.translate(0.5, 0, 0);
  const s = add(parent, g, m, X0, y || 0.05, 0); s.scale.x = 0.001; s.receiveShadow = true; return s;
}

export default {
  id: 'ferme', title: 'La Ferme', titleHtml: 'La <span>Ferme</span>',
  subtitle: "Six machines pour faire pousser le blé et ranger la paille. Touche-les pour voir comment elles marchent.",
  welcome: 'Bienvenue à la ferme ! Touche une machine pour voir comment elle marche.',
  hint: 'Touche une machine pour la découvrir.', backLabel: 'Toute la ferme',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="22" r="6"/><circle cx="25" cy="25" r="3"/><path d="M14 18V8h8l3 8h3v6M4 18h10"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  overview: { w: 46, h: 32, focus: [0.5, 2, 0.5] },
  tuftColors: [0x3f9a6a, 0x2f7f5a, 0x5ab07a, 0x3a6fd0, 0x2a8a8a, 0x4c78ff],
  forest: { bush: [0x2f8a5a, 0x2a6fb8, 0x3f9a6a, 0x4a6ef0] },
  zones: [
    [...P(-3, -12), 3.6], [...P(-3, -7.2), 1.8], [...P(-6, 14), 5], [...P(-11, 12), 2], [...P(-14, 10), 2], [...P(4, 14), 3.6],
    [...P(10, -14), 3.4], [...P(-17.6, 2.4), 2.8], [...P(-17.6, -2), 2.8], [...P(0, 12), 2.4]
  ],
  segs: [
    [...P(-12, -15), ...P(-12, 6), 3.4], [...P(-6, -9), ...P(-6, 8), 2.2], [...P(0, -9), ...P(0, 10), 2.2],
    [...P(6, -9), ...P(6, 10), 2.2], [...P(12, -9), ...P(12, 10), 2.2]
  ],
  ground: {
    base: ['#7a86c4', '#5b66a6', '#3d467e'],
    rects: [
      { cx: P(-12, -1)[0], cz: P(-12, -1)[1], len: 15, wid: 6.2, rot: -Math.PI / 4, col: '#c9a24a', al: 0.55 },
      { cx: P(-6, -1)[0], cz: P(-6, -1)[1], len: 14, wid: 3.8, rot: -Math.PI / 4, col: '#5f9a5a', al: 0.55 },
      { cx: P(0, -1)[0], cz: P(0, -1)[1], len: 14, wid: 3.8, rot: -Math.PI / 4, col: '#8a5a3a', al: 0.6 },
      { cx: P(6, -1)[0], cz: P(6, -1)[1], len: 14, wid: 3.8, rot: -Math.PI / 4, col: '#5f9a5a', al: 0.5 },
      { cx: P(12, -1)[0], cz: P(12, -1)[1], len: 14, wid: 3.8, rot: -Math.PI / 4, col: '#d9c27a', al: 0.45 }
    ],
    paths: [{ pts: [P(-20, 9), P(-6, 10), P(4, 10), P(17, 9)], w: 3.2, col: '#c79a92', al: 0.55 }, { pts: [P(-3, -16), P(-3, -6), P(-3, 9)], w: 2.4, col: '#c79a92', al: 0.4 }],
    blobs: [[...P(-6, 13), 7, 'rgba(255,196,140,.45)'], [...P(-3, -11), 6, 'rgba(255,196,140,.45)'], [...P(0, 0), 10, 'rgba(255,196,140,.25)']]
  },

  build(ctx) {
    const { scene, makeStation, part, roll, step, throwClod } = ctx;
    const W = (o, x, y, z) => o.localToWorld(new V3(x, y, z));

    /* scenery */
    { const [x, z] = P(-6, 14); barn(scene, x, z, YAW); }
    { const [x, z] = P(-11, 12); silo(scene, x, z, 7.5); }
    { const [x, z] = P(-14, 9.5); silo(scene, x, z, 6); }
    { const [x, z] = P(4, 14); farmhouse(scene, x, z, YAW); }
    { const [x, z] = P(10, -14); pond(scene, x, z, 2.2); }
    { const [x, z] = P(0, 12.5); const g = grp(scene, x, 0, z); g.rotation.y = YAW; [-0.95, 0.95].forEach((xx) => newBale(g, xx, 0.85, 0)); newBale(g, 0, 2.5, 0); shadows(g); }
    fence(scene, P(15, -10), P(15, 7), 10); fence(scene, P(-16, -15), P(-16, -6), 6);
    [[-19, -6], [-15, 15], [18, -4], [9, -18], [-21, 4], [16, 12]].forEach(([u, v], i) => { const [x, z] = P(u, v); autumnTree(scene, x, z, i % 2 ? [0xf2b21c, 0xe8901e, 0xf6cf3a] : [0xe8721e, 0xd13f1f, 0xf2a12a]); });
    { const [x, z] = P(-2, 10.5); lamp(scene, x, z, 1); }
    [[1.5, 10.5, 2.5], [-8, 9.5, 0.4], [13.5, -8, 2.2]].forEach(([u, v, r]) => { const [x, z] = P(u, v); worker(scene, x, z, r, FM.cap); });

    /* ---- tracteur + charrue ---- */
    (function () {
      const st = makeStation('tracteur'), S = st.g, X0 = -7, X1 = 5, FW = 3.2, START = X0 + 1.8, END = X1 + 1.8;
      box(S, X1 - X0, 0.04, FW, 0x5f9a4a, (X0 + X1) / 2, 0.02, 0);
      const plowed = growStrip(S, X0, FW, new THREE.MeshLambertMaterial({ map: furrowTex }));
      const grass = []; for (let i = 0; i < 230; i++) grass.push({ x: rnd(X0 + 0.1, X1 - 0.1), z: rnd(-FW / 2 + 0.1, FW / 2 - 0.1), sx: 1, sy: rnd(0.7, 1.4), sz: 1, ry: rnd(0, 3), k: 1 });
      const TU = new THREE.ConeGeometry(0.1, 0.5, 4); TU.translate(0, 0.25, 0);
      const gim = fieldItems(S, TU, grass, [0x4c9a4a, 0x3f8a3f, 0x5ab05a, 0x6ac06a]);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const T = tractor(st, m, FM.red); st.wheels = T.wheels; st.links = T.links;
      const p = grp(T.imp), colP = FM.blue;
      rbox(p, 0.2, 0.8, 1.0, 0.04, colP, -0.1, 0.35, 0);
      const A = new V3(-0.2, 0.62, 0), B = new V3(-3.5, 0.62, -1.3); beam(p, A, B, 0.18, colP);
      const bodies = [];
      for (let i = 0; i < 4; i++) {
        const q = A.clone().lerp(B, (i + 0.7) / 4.3);
        rbox(p, 0.12, 1.1, 0.1, 0.02, colP, q.x, 0.06, q.z);
        const mb = ext(p, [[0.3, -0.05], [-0.35, -0.05], [-0.55, 0.32], [-0.15, 0.4]], 0.06, 0.05, MT.steel, q.x, -0.5, q.z + 0.18, 0.01); mb.rotation.y = -0.6;
        const sh = add(p, new THREE.ConeGeometry(0.07, 0.3, 4), MT.steel, q.x + 0.35, -0.5, q.z); sh.rotation.z = -Math.PI / 2;
        bodies.push(anchor(p, q.x - 0.2, -0.35, q.z + 0.5));
      }
      rbox(p, 0.5, 0.1, 0.1, 0.02, colP, -3.3, 0.45, -1.3); tire(p, 0.3, 0.16, -3.55, -0.25, -1.55, MT.grey, -1);
      T.imp.position.y = 0.85; T.imp.rotation.z = -0.12;
      part(st, 'roues', 'les grandes roues', anchor(m, 0, 2.05, 1.15), true);
      part(st, 'relevage', 'le relevage', anchor(m, -1.05, 1.45, 0.5), true);
      part(st, 'charrue', 'la charrue', anchor(p, -1.8, 0.5, -0.6), true);
      part(st, 'cabine', 'la cabine', anchor(T.cab, 0, 1.9, 0), true);
      part(st, 'sol', 'la terre retournée', anchor(S, -2, 0.3, 0), false);
      st.focusAt = anchor(m, -1.4, 1.4, 0); st.size = { w: 11.5, h: 6.5 }; st.tagAt = anchor(m, 0.5, 3.6, 0);
      let ct = 0;
      st.update = (dt) => {
        roll(st, dt);
        if (st.plowing) {
          const front = m.position.x - 1.8;
          plowed.scale.x = clamp(front - X0, 0.001, X1 - X0);
          let dirty = false; grass.forEach((g) => { if (g.k > 0 && g.x < front) { g.k = 0; dirty = true; } }); if (dirty) gim.write();
          ct -= dt; if (ct <= 0) { ct = 0.12; const b = pick(bodies); const f = wp(b); throwClod(f, W(S, m.position.x - 2.4, 0.1, 1.1), rnd(0.08, 0.16)); }
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step("L'herbe a repoussé. On recommence !", 'sol'), to(m.position, 'x', START, 3),
            tw(1.2, (k) => { plowed.scale.x = Math.max(0.001, (X1 - X0) * (1 - k)); grass.forEach((g) => (g.k = k)); gim.write(); })]);
          st.reversing = false; st.done = false;
        }
        engineOn(46);
        await Promise.all([step('Le relevage descend la charrue dans la terre.', 'relevage'), to(T.imp.position, 'y', 0.55, 1.4), to(T.imp.rotation, 'z', 0, 1.4)]);
        st.plowing = true;
        await Promise.all([to(m.position, 'x', END, 6.5, easeSine), (async () => { await step('Le tracteur tire, et la charrue retourne la terre.', 'charrue'); await step("Ses grandes roues l'empêchent de s'enfoncer.", 'roues'); })()]);
        st.plowing = false;
        await Promise.all([step('Au bout du champ, le relevage remonte la charrue.', 'relevage'), to(T.imp.position, 'y', 0.85, 1.2), to(T.imp.rotation, 'z', -0.12, 1.2)]);
        await step('Voilà ! La terre est prête pour les graines.', 'sol');
        st.done = true;
      };
    })();

    /* ---- semoir ---- */
    (function () {
      const st = makeStation('semoir'), S = st.g, X0 = -7, X1 = 5, FW = 3.2, START = X0 + 1.7, END = X1 + 1.7;
      const soil = add(S, new THREE.BoxGeometry(X1 - X0, 0.06, FW), new THREE.MeshLambertMaterial({ map: furrowTex }), (X0 + X1) / 2, 0.04, 0);
      const ROWS = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25], seeds = [], sprouts = [];
      ROWS.forEach((z) => { for (let x = X0 + 0.25; x < X1 - 0.1; x += 0.32) { seeds.push({ x, y: 0.08, z, sx: 0.05, sy: 0.04, sz: 0.05, k: 0, col: 0xd9a63a }); sprouts.push({ x, y: 0.06, z, sx: 0.09, sy: 0.32, sz: 0.09, ry: rnd(0, 3), rz: rnd(-0.2, 0.2), k: 0 }); } });
      const sim = fieldItems(S, new THREE.SphereGeometry(1, 6, 4), seeds, [0xd9a63a]);
      const SP = new THREE.ConeGeometry(1, 1, 4); SP.translate(0, 0.5, 0);
      const spm = fieldItems(S, SP, sprouts, [0x5ac04a, 0x4caf3a, 0x6fd05a]);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const T = tractor(st, m, FM.green, MT.yel); st.wheels = T.wheels; st.links = T.links;
      const p = grp(T.imp), colD = FM.blue;
      rbox(p, 0.2, 0.7, 1.0, 0.04, colD, -0.1, 0.3, 0); rbox(p, 0.35, 0.2, 3.0, 0.04, MT.dark, -0.55, 0.02, 0);
      ext(p, [[-1.25, 0.15], [-0.25, 0.15], [-0.05, 1.05], [-1.45, 1.05]], 0.05, 2.9, colD, 0, 0, 0, 0.03);
      rbox(p, 1.48, 0.07, 2.95, 0.03, MT.dark, -0.75, 1.08, 0);
      const discs = [];
      ROWS.forEach((z) => {
        discs.push(cylZ(p, 0.24, 0.03, MT.steel, -0.6, -0.31, z, 16));
        rod(p, new V3(-0.75, 0.15, z), new V3(-0.62, -0.15, z), 0.025, MT.black);
        cylZ(p, 0.16, 0.08, MT.rubberS, -1.15, -0.39, z, 14);
        rod(p, new V3(-0.55, 0.0, z), new V3(-1.12, -0.35, z), 0.025, MT.dark);
      });
      [1, -1].forEach((s) => rail(p, [[-0.7, 0.15, s * 1.5], [-0.7, 1.3, s * 1.6], [-1.0, 1.35, s * 1.6]], 0.03, colD));
      T.imp.position.y = 0.85; T.imp.rotation.z = -0.1;
      part(st, 'relevage', 'le relevage', anchor(m, -1.05, 1.45, 0.5), true);
      part(st, 'tremie', 'la trémie à graines', anchor(p, -0.75, 1.3, 0.6), true);
      part(st, 'disques', 'les disques', anchor(p, -0.6, -0.1, 1.45), true);
      part(st, 'graines', 'les graines', anchor(S, -2, 0.3, 0.5), false);
      part(st, 'pousses', 'les pousses', anchor(S, 0, 0.6, 0), false);
      st.focusAt = anchor(m, -1.2, 1.4, 0); st.size = { w: 11.5, h: 6.5 }; st.tagAt = anchor(m, 0.5, 3.6, 0);
      st.update = (dt) => {
        roll(st, dt);
        if (st.sowing) {
          const dx = m.position.x - 1.65; let dirty = false;
          seeds.forEach((s) => { if (s.k === 0 && s.x > dx - 0.4 && s.x < dx) { s.k = 1; dirty = true; } });
          if (dirty) sim.write();
          discs.forEach((d) => (d.rotation.z -= dt * 6));
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(46); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Nouveau champ ! On recommence.', 'graines'), to(m.position, 'x', START, 3),
            tw(1, (k) => { sprouts.forEach((s) => (s.k = 1 - k)); seeds.forEach((s) => (s.k = 0)); spm.write(); sim.write(); })]);
          st.reversing = false; st.done = false;
        }
        engineOn(46);
        await Promise.all([step('Le relevage pose le semoir sur la terre.', 'relevage'), to(T.imp.position, 'y', 0.55, 1.3), to(T.imp.rotation, 'z', 0, 1.3)]);
        st.sowing = true;
        await Promise.all([to(m.position, 'x', END, 6.5, easeSine), (async () => { await step('Les disques ouvrent des petits sillons.', 'disques'); await step('Les graines tombent dedans, bien en ligne.', 'graines'); })()]);
        st.sowing = false;
        await Promise.all([to(T.imp.position, 'y', 0.85, 1), to(T.imp.rotation, 'z', -0.1, 1)]);
        await Promise.all([step('Quelques jours plus tard... les graines poussent !', 'pousses'),
          tw(2.4, (k) => { sprouts.forEach((s, i) => (s.k = clamp(k * 1.6 - (i % 7) * 0.08, 0, 1))); seeds.forEach((s) => (s.k = 1 - k)); spm.write(); sim.write(); }, lin)]);
        chime(); st.done = true;
      };
    })();

    /* ---- pulvérisateur ---- */
    (function () {
      const st = makeStation('pulve'), S = st.g, X0 = -6.5, X1 = 5, FW = 3.2, START = -3, END = 4.6;
      box(S, X1 - X0, 0.04, FW, 0x6a8a4a, (X0 + X1) / 2, 0.02, 0);
      const plants = [];
      [-1.2, -0.6, 0, 0.6, 1.2].forEach((z) => { for (let x = X0 + 0.3; x < X1 - 0.1; x += 0.4) { const s = rnd(0.16, 0.22); plants.push({ x, y: 0.1, z: z + rnd(-0.05, 0.05), sx: s, sy: s * 1.4, sz: s, ry: rnd(0, 3), k: 1, g: 0, b: s, col: 0x9ab84a }); } });
      const pim = fieldItems(S, ICO, plants, [0x9ab84a]);
      const cDry = new THREE.Color(0x9ab84a), cWet = new THREE.Color(0x3faa3a);
      function writePlants() { plants.forEach((p, i) => { const f = 1 + p.g * 0.8; p.sx = p.b * f; p.sy = p.b * 1.4 * f; p.sz = p.b * f; pim.setColorAt(i, tmpCol.copy(cDry).lerp(cWet, p.g)); }); pim.instanceColor.needsUpdate = true; pim.write(); }
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      [[1.6, 1], [1.6, -1], [-1.6, 1], [-1.6, -1]].forEach(([x, s]) => {
        st.wheels.push(tire(m, 0.72, 0.26, x, 0.72, s * 1.05, MT.grey, s));
        rbox(m, 0.16, 0.95, 0.14, 0.03, MT.dark, x, 1.2, s * 0.88);
      });
      rbox(m, 4.3, 0.3, 0.9, 0.06, MT.dark, 0, 1.72, 0);
      rbox(m, 1.3, 0.7, 1.3, 0.12, FM.orange, 0.5, 2.22, 0);
      for (let k = 0; k < 5; k++) box(m, 0.05, 0.3, 0.02, MT.black, 0.1 + k * 0.17, 2.2, 0.66);
      const cab = glassCab(m, 1.65, 1.88, 0, { len: 1.2, wid: 1.3, h: 1.45, mat: MT.black, roof: FM.orange, hat: FM.cap });
      beacon(st, cab, -0.3, 1.52, 0.35);
      cylX(m, 0.72, 2.0, MT.white, -0.95, 2.48, 0, 24);
      [[-1.95, -1], [0.05, 1]].forEach(([x]) => { const c = sph(m, 0.72, MT.white, x, 2.48, 0); c.scale.x = 0.3; });
      [-1.6, -0.3].forEach((x) => cylX(m, 0.74, 0.06, MT.dark, x, 2.48, 0, 24));
      cylY(m, 0.18, 0.12, MT.dark, -0.95, 3.22, 0, 14);
      rail(m, [[0.8, 0.4, 0.62], [0.8, 1.9, 0.62]], 0.025, MT.grey); for (let y = 0.6; y < 1.9; y += 0.3) rod(m, new V3(0.8, y, 0.62), new V3(1.05, y, 0.62), 0.02, MT.grey);
      rbox(m, 0.25, 0.9, 1.9, 0.04, FM.orange, -2.35, 1.55, 0);
      const wings = [], nozzles = [];
      [1, -1].forEach((s) => {
        const h = grp(m, -2.45, 1.25, s * 0.95), w = grp(h, 0, 0, 0); wings.push({ w, s });
        const zz = s * 0.35;
        rod(w, new V3(0, 0, zz), new V3(3.6, 0, zz), 0.04, FM.orange); rod(w, new V3(0, 0.5, zz), new V3(3.4, 0.15, zz), 0.035, FM.orange);
        for (let k = 0; k < 6; k++) { const x = k * 0.6; rod(w, new V3(x, 0, zz), new V3(x + 0.3, 0.5 - (x + 0.3) * 0.1, zz), 0.025, FM.orange); rod(w, new V3(x + 0.3, 0.5 - (x + 0.3) * 0.1, zz), new V3(x + 0.6, 0, zz), 0.025, FM.orange); }
        rod(w, new V3(0.05, -0.1, zz), new V3(3.6, -0.1, zz), 0.018, MT.black);
        for (let x = 0.2; x <= 3.6; x += 0.4) { cylY(w, 0.03, 0.12, MT.black, x, -0.15, zz, 6); nozzles.push(anchor(w, x, -0.22, zz)); }
        cylY(h, 0.07, 0.6, MT.dark, 0, 0.25, 0, 10);
        st.links.push(hydraulic(m, anchor(m, -2.0, 1.62, s * 0.62), anchor(w, 0.55, 0.3, zz), { barrel: 0.45, rb: 0.06, mat: MT.dark }));
      });
      part(st, 'verins', 'les vérins', anchor(m, -2.2, 2.0, 0.9), true);
      part(st, 'cuve', 'la cuve', anchor(m, -0.95, 3.4, 0), true);
      part(st, 'bras', 'les bras', anchor(wings[0].w, 2.2, 0.6, 0.35), true);
      part(st, 'buses', 'les buses', anchor(wings[0].w, 1.8, -0.3, 0.35), false);
      part(st, 'plantes', 'les plantes', anchor(S, 0, 0.6, 0), false);
      st.focusAt = anchor(m, -0.6, 1.6, 0); st.size = { w: 11, h: 9.5 }; st.tagAt = anchor(m, 0, 4.2, 0);
      let sprayT = 0;
      st.update = (dt) => {
        roll(st, dt);
        if (st.spraying) {
          sprayT -= dt;
          if (sprayT <= 0) { sprayT = 0.03; for (let i = 0; i < 3; i++) { const f = wp(pick(nozzles)); throwClod(f, new V3(f.x, 0.25, f.z), rnd(0.035, 0.06), 0xd8f0ff); } }
          const bx = m.position.x - 2.45; let dirty = false;
          plants.forEach((p) => { if (p.x > bx - 0.5 && p.x < bx + 0.5 && p.g < 1) { p.g = Math.min(1, p.g + dt * 1.6); dirty = true; } });
          if (dirty) writePlants();
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(56); st.reversing = true; st.beepT = 0;
          await Promise.all([step("Une semaine plus tard, les plantes ont soif.", 'plantes'), to(m.position, 'x', START, 3),
            tw(1.2, (k) => { plants.forEach((p) => (p.g = 1 - k)); writePlants(); })]);
          st.reversing = false; st.done = false;
        }
        engineOn(56);
        await Promise.all([step('Les vérins déplient les grands bras, comme des ailes.', 'verins'), ...wings.map(({ w, s }) => to(w.rotation, 'y', -s * Math.PI / 2, 2.2))]);
        st.spraying = true;
        await Promise.all([to(m.position, 'x', END, 6.5, easeSine), (async () => { await step('Des petits trous font une pluie fine.', 'buses'); await step('Les plantes boivent, et elles grandissent bien.', 'plantes'); })()]);
        st.spraying = false;
        await Promise.all([step('On replie les bras pour rentrer.', 'bras'), ...wings.map(({ w }) => to(w.rotation, 'y', 0, 2))]);
        st.done = true;
      };
    })();

    /* ---- moissonneuse-batteuse ---- */
    (function () {
      const st = makeStation('moissonneuse'), S = st.g, X0 = -7, X1 = 5.5, FW = 5.6, START = X0 - 4.3, END = X1 - 4.2;
      box(S, X1 - X0, 0.04, FW, 0xc49a3a, (X0 + X1) / 2, 0.02, 0);
      const stalks = [];
      for (let x = X0 + 0.15; x < X1 - 0.1; x += 0.3) for (let z = -FW / 2 + 0.15; z < FW / 2; z += 0.35) {
        const h = rnd(1.0, 1.25); stalks.push({ x: x + rnd(-0.06, 0.06), z: z + rnd(-0.06, 0.06), h, cut: false });
      }
      const stemG = new THREE.CylinderGeometry(0.02, 0.028, 1, 4); stemG.translate(0, 0.5, 0);
      const earG = new THREE.CylinderGeometry(0.05, 0.032, 0.26, 5); earG.translate(0, 0.13, 0);
      const stemM = new THREE.InstancedMesh(stemG, new THREE.MeshLambertMaterial({ color: 0xd9a838 }), stalks.length);
      const earM = new THREE.InstancedMesh(earG, new THREE.MeshLambertMaterial({ color: 0xf0c048 }), stalks.length);
      [stemM, earM].forEach((im) => { im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); S.add(im); });
      function writeWheat(k) {
        stalks.forEach((s, i) => {
          const hh = s.cut ? 0.16 : s.h * (k == null ? 1 : k);
          dummy.position.set(s.x, 0, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, Math.max(0.01, hh), 1); dummy.updateMatrix(); stemM.setMatrixAt(i, dummy.matrix);
          const ek = s.cut ? 0.001 : (k == null ? 1 : k);
          dummy.position.set(s.x, hh, s.z); dummy.scale.set(ek, ek, ek); dummy.updateMatrix(); earM.setMatrixAt(i, dummy.matrix);
        });
        stemM.instanceMatrix.needsUpdate = earM.instanceMatrix.needsUpdate = true;
      }
      writeWheat();
      const straw = growStrip(S, X0, 1.6, new THREE.MeshLambertMaterial({ color: C.straw }), 0.07);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const G = FM.lime, GD = FM.limeD;
      [1, -1].forEach((s) => {
        st.wheels.push(agriTire(m, 1.0, 0.62, 0.8, 1.0, s * 1.32, MT.grey, s), tire(m, 0.55, 0.32, -2.6, 0.55, s * 1.02, MT.grey, s));
        fender(m, 1.12, 0.7, 0.8, 1.0, s * 1.32, GD, Math.PI * 0.55);
      });
      ext(m, [[-3.3, 0.9], [1.6, 0.9], [1.7, 2.3], [1.3, 3.2], [-2.4, 3.2], [-3.4, 2.6]], [0.05, 0.05, 0.1, 0.15, 0.15, 0.1], 2.3, G, 0, 0, 0, 0.04);
      [1, -1].forEach((s) => { rbox(m, 4.6, 0.12, 0.04, 0.02, GD, -0.8, 1.35, s * 1.16, 0.01); for (let k = 0; k < 6; k++) box(m, 0.05, 0.45, 0.02, MT.black, -3.0 + k * 0.17, 2.4, s * 1.16); });
      rbox(m, 2.8, 0.7, 0.1, 0.03, G, -0.3, 3.55, 1.05); rbox(m, 2.8, 0.7, 0.1, 0.03, G, -0.3, 3.55, -1.05);
      rbox(m, 0.1, 0.7, 2.2, 0.03, G, -1.7, 3.55, 0); rbox(m, 0.1, 0.7, 2.2, 0.03, G, 1.1, 3.55, 0);
      const heap = sph(m, 1, FM.grain, -0.3, 3.25, 0); heap.scale.set(0.01, 0.01, 0.01);
      const cab = glassCab(m, 1.75, 2.55, 0, { len: 1.4, wid: 1.6, h: 1.6, mat: MT.black, roof: G, hat: FM.cap });
      beacon(st, cab, -0.4, 1.68, 0.5); beacon(st, cab, -0.4, 1.68, -0.5);
      rail(m, [[0.6, 0.3, 1.3], [1.0, 2.55, 1.3]], 0.03, MT.grey); for (let y = 0.5; y < 2.5; y += 0.3) { const t = (y - 0.3) / 2.25; rod(m, new V3(0.6 + t * 0.4, y, 1.3), new V3(0.95 + t * 0.4, y, 1.3), 0.02, MT.grey); }
      rbox(m, 0.6, 0.6, 2.0, 0.05, MT.dark, -3.45, 1.4, 0);
      const feeder = rbox(m, 1.7, 0.75, 1.1, 0.06, G, 2.55, 1.35, 0); feeder.rotation.z = -0.35;
      const hdr = grp(m, 3.6, 0, 0);
      rbox(hdr, 1.15, 0.08, 5.6, 0.02, GD, 0.05, 0.25, 0); rbox(hdr, 0.12, 0.9, 5.6, 0.03, G, -0.55, 0.68, 0);
      [2.8, -2.8].forEach((z) => ext(hdr, [[-0.6, 0.2], [0.9, 0.2], [1.15, 0.32], [0.0, 1.0], [-0.6, 1.0]], 0.04, 0.08, G, 0, 0, z, 0.01));
      rbox(hdr, 0.12, 0.06, 5.6, 0.01, MT.steel, 0.62, 0.22, 0, 0.005);
      for (let z = -2.7; z <= 2.7; z += 0.18) { const t = add(hdr, new THREE.ConeGeometry(0.03, 0.14, 4), MT.steel, 0.72, 0.22, z); t.rotation.z = -Math.PI / 2; }
      const auger = cylZ(hdr, 0.22, 5.3, MT.yel, -0.15, 0.48, 0, 14);
      [2.62, -2.62].forEach((z) => rod(hdr, new V3(-0.5, 1.1, z), new V3(0.45, 1.2, z), 0.04, G));
      const reel = grp(hdr, 0.45, 1.2, 0);
      cylZ(reel, 0.06, 5.4, MT.dark, 0, 0, 0, 8);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2, c = Math.cos(a) * 0.6, s = Math.sin(a) * 0.6;
        rod(reel, new V3(c, s, -2.6), new V3(c, s, 2.6), 0.03, MT.yel);
        [-2.4, 0, 2.4].forEach((z) => rod(reel, new V3(0, 0, z), new V3(c, s, z), 0.02, MT.dark));
        for (let z = -2.4; z <= 2.4; z += 0.6) rod(reel, new V3(c, s, z), new V3(c * 1.25, s * 1.25 - 0.08, z), 0.01, MT.black, 4);
      }
      const aug = grp(m, 1.0, 3.55, -1.25); aug.rotation.y = Math.PI;
      cylX(aug, 0.16, 4.4, G, 2.2, 0, 0, 14); [1.0, 2.6, 4.0].forEach((x) => cylX(aug, 0.19, 0.06, GD, x, 0, 0, 14));
      cylY(aug, 0.14, 0.45, GD, 4.35, -0.25, 0, 12); cylY(aug, 0.17, 0.4, G, 0, -0.2, 0, 14);
      [0.5, -0.5].forEach((z) => rbox(cab, 0.1, 0.08, 0.16, 0.02, MT.lamp, 0.72, 1.63, z, 0.01));
      // trailer + tractor waiting for the grain
      const TX = END + 1.0, TZ = -5.6, tr = grp(S, TX, 0, TZ);
      rbox(tr, 3.6, 0.12, 2.1, 0.03, FM.red, 0, 1.0, 0);
      [1.0, -1.0].forEach((z) => rbox(tr, 3.6, 0.9, 0.08, 0.03, FM.red, 0, 1.5, z));
      [1.76, -1.76].forEach((x) => rbox(tr, 0.08, 0.9, 2.1, 0.03, FM.red, x, 1.5, 0));
      rbox(tr, 3.0, 0.2, 0.9, 0.04, MT.dark, 0, 0.82, 0);
      [-0.55, 0.55].forEach((x) => [1, -1].forEach((s) => tire(tr, 0.45, 0.3, x, 0.45, s * 0.9, MT.grey, s)));
      beam(tr, new V3(-1.8, 0.8, 0), new V3(-2.6, 0.62, 0), 0.12, MT.dark);
      const theap = sph(tr, 1, FM.grain, 0, 1.1, 0); theap.scale.set(0.01, 0.01, 0.01);
      const ty = grp(S, TX - 2.6 - 1.05, 0, TZ); ty.rotation.y = Math.PI; tractor(st, ty, FM.green, MT.yel);
      const SG = new THREE.CylinderGeometry(0.1, 0.16, 1, 8); SG.translate(0, -0.5, 0);
      const stream = add(S, SG, FM.grain, TX, 3.05, TZ); stream.visible = false;
      st.grain = 0; st.reel = 0.6; st.load = 0;
      part(st, 'rabatteur', 'le rabatteur', anchor(hdr, 0.45, 2.0, 1.6), true);
      part(st, 'barre', 'la barre de coupe', anchor(hdr, 0.8, 0.4, 2.0), true);
      part(st, 'batteuse', 'la batteuse', anchor(m, -0.8, 2.2, 1.25), false);
      part(st, 'tremie', 'la trémie à grains', anchor(m, -0.3, 4.1, 0), true);
      part(st, 'vis', 'la vis de déchargement', anchor(aug, 2.4, 0.35, 0), true);
      part(st, 'remorque', 'la remorque', anchor(tr, 0, 2.2, 0), false);
      st.focusAt = anchor(m, 0.6, 2, -2.2); st.size = { w: 14, h: 10.5 }; st.tagAt = anchor(m, 0, 5, 0);
      let pt = 0;
      st.update = (dt) => {
        roll(st, dt);
        reel.rotation.z -= st.reel * dt; auger.rotation.z += st.reel * dt * 1.5;
        if (st.harvest) {
          const cutX = m.position.x + 4.25; let dirty = false;
          stalks.forEach((s) => { if (!s.cut && s.x < cutX) { s.cut = true; dirty = true; } }); if (dirty) writeWheat();
          straw.scale.x = clamp(m.position.x - 3.4 - X0, 0.001, X1 - X0);
          st.grain = clamp((m.position.x - START) / (END - START), 0, 1);
          pt -= dt; if (pt <= 0) { pt = 0.15; const f = W(m, -3.7, 1.3, 0); throwClod(f, W(m, -4.6, 0.1, rnd(-0.6, 0.6)), rnd(0.06, 0.1), C.straw); }
        }
        const k = st.grain; heap.scale.set(Math.max(0.01, 1.2 * k), Math.max(0.01, 0.55 * k), Math.max(0.01, 0.85 * k));
        const l = st.load; theap.scale.set(Math.max(0.01, 1.6 * l), Math.max(0.01, 0.6 * l), Math.max(0.01, 0.9 * l));
      };
      st.action = async function () {
        if (st.done) {
          engineOn(50); st.reversing = true; st.beepT = 0;
          stalks.forEach((s) => (s.cut = false));
          await Promise.all([step("Un an plus tard, le blé a repoussé !", 'rabatteur'), to(m.position, 'x', START, 3.4),
            tw(1.4, (k) => { writeWheat(Math.max(0.01, k)); straw.scale.x = Math.max(0.001, straw.scale.x * (1 - k)); st.load = Math.max(0, st.load * (1 - k)); }, easeBack)]);
          writeWheat(); st.reversing = false; st.done = false;
        }
        engineOn(50);
        await Promise.all([step('Le rabatteur tourne et couche le blé.', 'rabatteur'), to(st, 'reel', 4.5, 1.5)]);
        st.harvest = true;
        await Promise.all([to(m.position, 'x', END, 8.5, easeSine), (async () => {
          await step('La barre de coupe coupe les tiges.', 'barre');
          await step('Dedans, la batteuse secoue pour séparer les grains de la paille.', 'batteuse');
          await step('Les grains vont dans la trémie. La paille ressort derrière.', 'tremie');
        })()]);
        st.harvest = false;
        await Promise.all([to(st, 'reel', 0.6, 1.2), step('La vis de déchargement se déplie.', 'vis'), to(aug.rotation, 'y', Math.PI / 2, 2.2)]);
        stream.visible = true; stream.scale.y = 0.01;
        await Promise.all([step('Les grains coulent dans la remorque.', 'remorque'),
          to(stream.scale, 'y', 1.6, 0.4).then(() => Promise.all([to(st, 'grain', 0, 3.2, lin), to(st, 'load', Math.min(1, st.load + 0.6), 3.2, lin)])).then(() => to(stream.scale, 'y', 0.01, 0.3))]);
        stream.visible = false;
        await Promise.all([step('On replie la vis. Bravo !', 'vis'), to(aug.rotation, 'y', Math.PI, 2)]);
        st.done = true;
      };
    })();

    /* ---- presse à balles ---- */
    (function () {
      const st = makeStation('presse'), S = st.g, X0 = -7, X1 = 4, FW = 3.2, START = X0 + 2.3, END = X1 + 2.3;
      box(S, X1 - X0, 0.04, FW, 0xd9c27a, (X0 + X1) / 2, 0.02, 0);
      const lumps = []; for (let x = X0 + 0.1; x < X1; x += 0.2) lumps.push({ x, y: 0.12, z: rnd(-0.25, 0.25), sx: rnd(0.28, 0.42), sy: rnd(0.14, 0.22), sz: rnd(0.3, 0.45), ry: rnd(0, 3), k: 1 });
      const lim = fieldItems(S, ICO, lumps, [0xe8cf7a, 0xd9b95e, 0xf0dc8a]);
      const m = grp(S, START, 0, 0); st.m = m; st.lastX = START;
      const T = tractor(st, m, FM.blue, MT.grey); st.wheels = T.wheels; st.links = T.links;
      const bal = grp(m, -3.4, 0, 0), RB = FM.red;
      ext(bal, arc(0, 1.05, 0.9, -90, 90, 14), 0, 1.6, RB, 0, 0, 0, 0.03);
      rbox(bal, 0.7, 0.75, 1.6, 0.08, RB, 0.75, 0.62, 0);
      [0.82, -0.82].forEach((z) => { cylZ(bal, 0.5, 0.04, MT.white, 0.15, 1.05, z, 20); });
      const gate = grp(bal, 0, 1.95, 0);
      ext(gate, arc(0, -0.9, 0.9, 90, 270, 14), 0, 1.6, RB, 0, 0, 0, 0.03);
      [0.82, -0.82].forEach((z) => cylZ(gate, 0.35, 0.04, MT.white, -0.35, -0.9, z, 18));
      cylZ(gate, 0.06, 1.75, MT.dark, 0, 0, 0, 8);
      [1, -1].forEach((s) => { st.wheels.push(tire(bal, 0.42, 0.3, 0.1, 0.42, s * 1.0, MT.grey, s)); st.links.push(hydraulic(bal, anchor(bal, 0.3, 0.55, s * 0.86), anchor(gate, -0.4, -0.35, s * 0.86), { barrel: 0.6, rb: 0.06, mat: MT.dark })); });
      const pu = grp(bal, 1.15, 0.28, 0); rbox(pu, 0.5, 0.3, 1.9, 0.06, MT.dark, 0, 0, 0);
      const puR = grp(pu, 0.15, 0, 0);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; for (let z = -0.85; z <= 0.85; z += 0.17) rod(puR, new V3(Math.cos(a) * 0.12, Math.sin(a) * 0.12, z), new V3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, z), 0.012, MT.steel, 4); }
      beam(bal, new V3(0.9, 0.7, 0), new V3(2.35, 0.55, 0), 0.14, RB);
      rod(bal, new V3(2.3, 0.75, 0.15), new V3(0.9, 0.95, 0.15), 0.04, MT.dark);
      let bale = newBale(bal, 0, 1.05, 0); bale.scale.set(0.05, 0.05, 1);
      const field = [];
      part(st, 'pickup', 'le pick-up', anchor(pu, 0.1, 0.4, 0.9), true);
      part(st, 'presse', 'la presse', anchor(bal, 0, 2.15, 0), true);
      part(st, 'porte', 'la porte', anchor(gate, -0.7, -0.4, 0.85), false);
      const balleA = anchor(S, 0, 2, 0);
      part(st, 'balle', 'la balle de paille', balleA, false);
      part(st, 'tracteur', 'le tracteur', anchor(T.cab, 0, 1.9, 0), true);
      st.focusAt = anchor(m, -1.8, 1.4, 0); st.size = { w: 12, h: 6.5 }; st.tagAt = anchor(m, 0, 3.6, 0);
      st.update = (dt) => {
        roll(st, dt);
        if (st.baling) {
          puR.rotation.z -= dt * 8;
          const px = m.position.x - 2.25; let dirty = false, eaten = 0;
          lumps.forEach((l) => { if (l.k > 0 && l.x < px) { l.k = 0; dirty = true; } if (l.k === 0) eaten++; }); if (dirty) lim.write();
          const k = Math.max(0.05, eaten / lumps.length); bale.scale.set(k, k, 1);
        }
      };
      st.action = async function () {
        if (st.done) {
          engineOn(48); st.reversing = true; st.beepT = 0;
          await Promise.all([step('Le télescopique a rangé les balles. On recommence !', 'presse'), to(m.position, 'x', START, 3),
            tw(1, (k) => { field.forEach((b) => b.scale.setScalar(Math.max(0.01, 1 - k))); lumps.forEach((l) => (l.k = k)); lim.write(); })]);
          field.forEach((b) => S.remove(b)); field.length = 0; st.reversing = false; st.done = false;
        }
        engineOn(48); st.baling = true;
        await Promise.all([to(m.position, 'x', END, 6.5, easeSine), (async () => { await step('Le pick-up ramasse la paille.', 'pickup'); await step('Dedans, des courroies la roulent en grosse boule.', 'presse'); })()]);
        st.baling = false; bale.scale.set(1, 1, 1);
        await Promise.all([step("La balle est prête ! Les vérins ouvrent la porte.", 'porte'), to(gate.rotation, 'z', -1.45, 1.5)]);
        S.attach(bale); const b0 = bale.position.clone();
        balleA.position.set(b0.x - 1.6, 1.9, 0);
        await Promise.all([step('Et hop, la balle roule dehors !', 'balle'),
          tw(1.3, (k) => { bale.position.x = b0.x - 1.7 * k; bale.position.y = b0.y + (0.85 - b0.y) * Math.min(1, k * 1.6); bale.rotation.z = k * 2.2; }, easeIn).then(thud)]);
        field.push(bale);
        await to(gate.rotation, 'z', 0, 1.2);
        bale = newBale(bal, 0, 1.05, 0); bale.scale.set(0.05, 0.05, 1);
        st.done = true;
      };
    })();

    /* ---- chariot télescopique ---- */
    (function () {
      const st = makeStation('telescopique'), S = st.g, PICK = 3.8, STACK = 5.8;
      const m = grp(S); st.m = m;
      const R = FM.amber;
      [[1.3, 1], [1.3, -1], [-1.3, 1], [-1.3, -1]].forEach(([x, s]) => { st.wheels.push(agriTire(m, 0.62, 0.42, x, 0.62, s * 1.0, MT.grey, s)); fender(m, 0.72, 0.46, x, 0.62, s * 1.0, R, Math.PI * 0.6); });
      rbox(m, 3.3, 0.5, 1.3, 0.08, MT.dark, 0, 0.85, 0);
      rbox(m, 2.5, 0.75, 0.62, 0.14, R, -0.25, 1.35, -0.75); for (let k = 0; k < 6; k++) box(m, 0.05, 0.35, 0.02, MT.black, -1.2 + k * 0.17, 1.35, -1.07);
      cylY(m, 0.06, 0.9, MT.black, -1.1, 2.1, -0.85, 10);
      rbox(m, 0.5, 0.35, 1.4, 0.06, R, 1.75, 0.95, 0); rbox(m, 0.5, 0.45, 1.3, 0.06, MT.dark, -1.75, 1.0, 0);
      const cab = glassCab(m, 0.2, 1.08, 0.72, { len: 1.5, wid: 0.88, h: 1.5, mat: MT.black, roof: R, hat: FM.cap });
      beacon(st, cab, -0.4, 1.56, 0);
      const PV = new V3(-1.35, 1.6, -0.08), OUT = 3.6;
      const boom = grp(m, PV.x, PV.y, PV.z);
      rbox(boom, OUT, 0.46, 0.44, 0.08, R, OUT / 2, 0, 0);
      cylZ(boom, 0.1, 0.6, MT.chrome, 0, 0, 0, 10);
      const inner = grp(boom, 0, 0, 0);
      rbox(inner, 3.5, 0.32, 0.3, 0.05, MT.grey, 2.0, 0, 0);
      const car = grp(inner, 3.75, 0, 0);
      rbox(car, 0.12, 0.95, 1.15, 0.03, MT.dark, 0.06, 0, 0);
      [0.3, -0.3].forEach((z) => rod(car, new V3(0.1, 0, z), new V3(1.35, 0, z), 0.035, MT.steel, 6));
      rod(car, new V3(0.1, 0.25, 0), new V3(1.1, 0.25, 0), 0.03, MT.steel, 6);
      st.links.push(hydraulic(m, anchor(m, -0.15, 0.95, -0.08), anchor(boom, 1.45, -0.27, 0), { barrel: 1.0, rb: 0.11 }));
      st.links.push(hydraulic(inner, anchor(inner, 3.0, 0.22, 0), anchor(car, 0.0, 0.4, 0), { barrel: 0.35, rb: 0.055, mat: MT.dark }));
      function setCarriage(cx, cy) { const dx = cx - PV.x, dy = cy - PV.y, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx); boom.rotation.z = a; inner.position.x = Math.max(0, L - 3.75); car.rotation.z = -a; st.cx = cx; st.cy = cy; }
      function moveTo(cx, cy, dur) { const x0 = st.cx, y0 = st.cy; return tw(dur, (k) => setCarriage(x0 + (cx - x0) * k, y0 + (cy - y0) * k)); }
      const REST = [2.45, 2.6]; setCarriage(...REST);
      let pickBale = newBale(S, PICK, 0.85, -0.08);
      const stack = [];
      part(st, 'bras', 'le bras télescopique', anchor(boom, 2.0, 0.45, 0), true);
      part(st, 'verins', 'le vérin', anchor(m, 0.4, 1.0, -0.6), true);
      part(st, 'piques', 'les piques', anchor(car, 0.9, 0.3, 0.4), true);
      const balleA = anchor(S, STACK, 2, 0);
      part(st, 'balle', 'la pile de balles', balleA, false);
      st.focus = new V3(2.4, 2.4, 0); st.size = { w: 12, h: 8.5 }; st.tagAt = anchor(m, 0, 4, 0);
      st.update = (dt) => roll(st, dt);
      st.action = async function () {
        if (stack.length >= 3) {
          await Promise.all([step('La pile est complète ! On la range dans la grange.', 'balle'), tw(0.9, (k) => stack.forEach((b) => b.scale.setScalar(Math.max(0.01, 1 - k))))]);
          stack.forEach((b) => S.remove(b)); stack.length = 0;
        }
        engineOn(60);
        await Promise.all([step('Le bras descend devant la balle.', 'bras'), moveTo(PICK - 1.55, 0.85, 1.6)]);
        await Promise.all([step('Les piques entrent dans la paille.', 'piques'), moveTo(PICK - 0.92, 0.85, 1.0)]);
        car.attach(pickBale); ding();
        const n = stack.length, y = 0.85 + n * 1.7;
        await Promise.all([step('Le vérin lève le bras.', 'verins'), moveTo(PICK - 0.92, y + 0.55, 1.8)]);
        balleA.position.y = y + 1.1;
        await Promise.all([step('Le bras sort, comme une longue-vue !', 'bras'), moveTo(STACK - 0.92, y + 0.55, 2.0)]);
        await moveTo(STACK - 0.92, y + 0.02, 0.8);
        S.attach(pickBale); pickBale.position.set(STACK, y, -0.08); pickBale.rotation.set(0, 0, 0); thud();
        stack.push(pickBale);
        await Promise.all([step('On pose la balle tout en haut de la pile.', 'balle'), moveTo(STACK - 1.6, y + 0.3, 1.0)]);
        await moveTo(...REST, 1.8);
        pickBale = newBale(S, PICK, 0.85, -0.08); pop(pickBale, 0.6);
      };
    })();
  }
};
