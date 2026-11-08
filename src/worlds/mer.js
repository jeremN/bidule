// Sous la mer — a cut-away ocean: ships float on a see-through surface high above, and below it
// the sea floor lives (sand, rocks, coral, a wreck, fish, a turtle, a whale). Each machine shows how it
// floats, dives, lights up the dark or works on the bottom.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, rnd, pick } from '../kit/util.js';
import { tw, to, sleep, pop, easeIn, easeSine, lin } from '../kit/tween.js';
import { engineOn, engineOff, thud, ding, chime, tone } from '../kit/audio.js';
import { MT, ICO, std, toonMat, mat, add, box, grp, cylY, cylZ, cylX, cylGeo, rod, sph, rbox, ext, anchor, shadows, instanced, freeze } from '../kit/geo.js';
import { hydraulic, worker } from '../kit/parts.js';
import { createFx } from '../kit/fx.js';
import { route, placeOn, person as walker, traffic } from '../kit/life.js';
import { AM, body, skin, plate, fin, decal } from '../kit/aircraft.js';

const S2 = Math.SQRT1_2, YAW = Math.PI / 4, PI = Math.PI;
const Q = (h, d) => [(h + d) * S2, (d - h) * S2];
const CF = (h, d, yaw = YAW) => { const [x, z] = Q(h, d); return { x, z, yaw }; };
const SURF = 12; // height of the sea surface
const RAD = 50;

/* ================= materials ================= */
const SM = {
  navy: std(0x1f3f86, 0.4, 0.2), antif: std(0xb8402e, 0.6, 0.05), white: std(0xf3f4f7, 0.35, 0.1), deck: std(0x8e959e, 0.75, 0.1),
  orange: std(0xf06a26, 0.42, 0.1), yel: std(0xf4b81c, 0.38, 0.15), red: std(0xd8402a, 0.45, 0.1), blue: std(0x2f6fe0, 0.4, 0.15),
  black: std(0x24272f, 0.55, 0.2), dark: MT.dark, steel: MT.steel, grey: std(0xb8bdc8, 0.5, 0.3), cable: std(0x23252c, 0.6, 0.1),
  ycable: std(0xf2c21c, 0.6, 0.05), green: std(0x2f9a5a, 0.6, 0.05), wood: std(0x9a6a40, 0.85, 0), woodD: std(0x6a4a30, 0.9, 0),
  sub: std(0x2e333d, 0.55, 0.25), subD: std(0x1f232b, 0.6, 0.2), pile: std(0x6f7a8e, 0.6, 0.3), tube: std(0x4a5060, 0.7, 0.05),
  suit: std(0x1d2230, 0.7, 0), whale: std(0x3e5a86, 0.6, 0.05), whaleB: std(0xdfe6ef, 0.6, 0), shell: std(0x6a8a3a, 0.6, 0.05),
  gold: std(0xf2c23a, 0.25, 0.9),
  tankGlass: std(0x8fd0ff, 0.05, 0.2, { transparent: true, opacity: 0.38, depthWrite: false }),
  ballast: std(0x2f86e0, 0.2, 0.1, { transparent: true, opacity: 0.85 }),
  jelly: std(0xff9ad8, 0.2, 0, { transparent: true, opacity: 0.55, depthWrite: false })
};
const glow = (c, e) => toonMat({ color: c, emissive: e || c, emissiveIntensity: 1.2 });
const BEAMM = () => new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

/* ================= helpers ================= */
const bake = (g) => { shadows(g); freeze(g); return g; };
const Y1 = new V3(0, 1, 0), _a = new V3(), _d = new V3();
/** A rope / cable made of n straight pieces; set(points) bends it through the points (parent space). */
function rope(parent, n, r, m) {
  const segs = Array.from({ length: n }, () => { const s = add(parent, cylGeo(6), m); s.visible = false; return s; });
  return {
    segs,
    set(pts) {
      segs.forEach((s, i) => {
        if (i >= pts.length - 1) { s.visible = false; return; }
        _a.copy(pts[i]); _d.subVectors(pts[i + 1], _a); const L = _d.length(); if (L < 1e-4) { s.visible = false; return; }
        s.visible = true; s.scale.set(r, L, r); s.position.copy(_a).addScaledVector(_d, 0.5); s.quaternion.setFromUnitVectors(Y1, _d.multiplyScalar(1 / L));
      });
    }
  };
}
function bez(A, C, B, n) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; o.push(new V3(u * u * A.x + 2 * u * t * C.x + t * t * B.x, u * u * A.y + 2 * u * t * C.y + t * t * B.y, u * u * A.z + 2 * u * t * C.z + t * t * B.z)); } return o; }
const toS = (S, o, x = 0, y = 0, z = 0) => S.worldToLocal(o.localToWorld(new V3(x, y, z)));

/**
 * Ship hull surface: o = { L, B, D, bow, stern, rake, sheer, p, bul }. s runs from the keel (0) to the deck edge (1),
 * then up the bulwark (2). Keel at y = 0, bow at +x.
 */
function hullGeo(o, s0, s1, opt = {}) {
  const { L, B, D } = o, bow = o.bow ?? 0.3, stern = o.stern ?? 0.85, rake = o.rake ?? D * 0.55, sheer = o.sheer ?? 0.35, p = o.p ?? 2.6, bul = o.bul ?? 0.35;
  const NX = 32, NS = opt.ns || 6, inset = opt.inset || 0, pos = [], idx = [];
  const W = (u) => { let w = u > 1 - bow ? Math.sqrt(Math.max(0, 1 - ((u - (1 - bow)) / bow) ** 2)) : 1; if (u < 0.12) w *= stern + (1 - stern) * Math.sqrt(u / 0.12); return Math.max(0.0005, (B / 2) * w - inset); };
  const K = (u) => rake * Math.max(0, (u - (1 - bow * 0.7)) / (bow * 0.7)) ** 2 + (o.lift ?? D * 0.12) * Math.max(0, (0.1 - u) / 0.1);
  const Hh = (u) => D + sheer * Math.max(0, (u - 0.55) / 0.45) ** 2;
  const pt = (u, s, sd) => {
    const k = K(u), h = Hh(u), w = W(u), x = -L / 2 + u * L;
    if (s <= 1) return [x, k + (h - k) * s, sd * w * Math.pow(1 - Math.pow(1 - s, p), 1 / p)];
    return [x, h + (s - 1) * bul, sd * w];
  };
  if (opt.deck) {
    for (let i = 0; i <= NX; i++) [-1, 1].forEach((sd) => { const q = pt(i / NX, 1, sd); pos.push(q[0], q[1] + (opt.dy || 0), q[2]); });
    for (let i = 0; i < NX; i++) { const a = i * 2, b = i * 2 + 1, c = i * 2 + 3, d = i * 2 + 2; idx.push(a, b, c, a, c, d); }
  } else {
    [1, -1].forEach((sd) => {
      const base = pos.length / 3;
      for (let i = 0; i <= NX; i++) for (let j = 0; j <= NS; j++) pos.push(...pt(i / NX, s0 + ((s1 - s0) * j) / NS, sd));
      const V = (i, j) => base + i * (NS + 1) + j;
      for (let i = 0; i < NX; i++) for (let j = 0; j < NS; j++) {
        const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
        if ((sd > 0) !== !!opt.flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
      }
    });
    if (!opt.noTransom) {
      const base = pos.length / 3;
      for (let j = 0; j <= NS; j++) { const s = s0 + ((s1 - s0) * j) / NS; pos.push(...pt(0, s, -1), ...pt(0, s, 1)); }
      for (let j = 0; j < NS; j++) { const a = base + 2 * j, b = a + 1, c = a + 3, d = a + 2; if (opt.flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A complete hull: antifouling under the waterline, boot stripe, topsides, bulwark and deck. */
function shipHull(p, o) {
  const g = grp(p), wl = o.wl ?? 0.45;
  add(g, hullGeo(o, 0, wl, { ns: 4 }), o.bottom);
  add(g, hullGeo(o, wl, wl + 0.07, { ns: 1 }), o.boot || SM.white);
  add(g, hullGeo(o, wl + 0.07, 1, { ns: 4 }), o.top);
  if (o.bul !== 0) { add(g, hullGeo(o, 1, 2, { ns: 1, noTransom: !o.closed }), o.top); add(g, hullGeo(o, 1, 2, { ns: 1, inset: 0.07, flip: true, noTransom: true }), o.inner || o.top); }
  if (o.band) add(g, hullGeo(o, o.band[0], o.band[1], { ns: 1, inset: -0.012, noTransom: true }), o.bandM);
  add(g, hullGeo(o, 0, 0, { deck: true, dy: 0.01 }), o.deck || SM.deck);
  return g;
}
/** A deckhouse block with rows of windows. */
function house(p, x, y, L, H, W, m, o = {}) {
  rbox(p, L, H, W, o.r ?? 0.08, m, x, y + H / 2, 0, 0.02);
  const n = Math.max(2, Math.round(L / 0.55)), wy = y + H * (o.wy ?? 0.62), wh = H * (o.wh ?? 0.3), wm = o.wm || MT.glassD;
  [1, -1].forEach((s) => { for (let i = 0; i < n; i++) rbox(p, (L / n) * 0.62, wh, 0.04, 0.015, wm, x - L / 2 + (L / n) * (i + 0.5), wy, s * (W / 2 + 0.005), 0.01); });
  if (o.front !== false) { const nf = Math.max(2, Math.round(W / 0.6)); for (let i = 0; i < nf; i++) rbox(p, 0.04, wh, (W / nf) * 0.62, 0.015, wm, x + L / 2 + 0.005, wy, -W / 2 + (W / nf) * (i + 0.5), 0.01); }
  rbox(p, L + 0.1, 0.06, W + 0.1, 0.02, o.trim || m, x, y + H, 0, 0.01);
}
/** The bridge: raked front windows, a window band all round, bridge wings with navigation lights. */
function bridge(p, x, y, L, H, W, m, roof) {
  ext(p, [[-L / 2, 0], [L / 2, 0], [L / 2 + 0.22, H * 0.5], [L / 2 + 0.05, H], [-L / 2, H]], [0.04, 0.04, 0.06, 0.08, 0.04], W, m, x, y, 0, 0.02);
  const fw = box(p, 0.04, H * 0.38, W * 0.9, MT.glassD, x + L / 2 + 0.155, y + H * 0.74, 0); fw.rotation.z = Math.atan(0.17 / (0.5 * H));
  for (let i = 1; i < 5; i++) { const mm = box(p, 0.06, H * 0.4, 0.04, m, x + L / 2 + 0.16, y + H * 0.74, -W * 0.45 + (W * 0.9 * i) / 5); mm.rotation.z = fw.rotation.z; }
  [1, -1].forEach((s) => {
    rbox(p, L * 0.82, H * 0.34, 0.04, 0.015, MT.glassD, x + 0.05, y + H * 0.72, s * (W / 2 + 0.005), 0.01);
    rbox(p, 0.7, 0.1, 0.9, 0.03, m, x + L / 2 - 0.4, y + H * 0.42, s * (W / 2 + 0.4), 0.02);
    rbox(p, 0.7, 0.32, 0.04, 0.02, m, x + L / 2 - 0.4, y + H * 0.6, s * (W / 2 + 0.83), 0.01);
    sph(p, 0.07, s > 0 ? AM.navG : AM.navR, x + L / 2 - 0.4, y + H * 0.82, s * (W / 2 + 0.83));
  });
  rbox(p, L + 0.35, 0.1, W + 0.25, 0.03, roof || m, x + 0.1, y + H + 0.05, 0, 0.02);
}
/** Mast with a yard, masthead light and antennas (the spinning radar is added by the caller). */
function mast(p, x, y, h, m = SM.white) {
  cylY(p, 0.07, h, m, x, y + h / 2, 0, 8); rbox(p, 0.12, 0.08, 1.5, 0.02, m, x, y + h * 0.62, 0, 0.01);
  sph(p, 0.07, AM.navW, x + 0.05, y + h + 0.05, 0); [0.5, -0.5].forEach((z) => rod(p, new V3(x, y + h * 0.62, z), new V3(x - 0.1, y + h * 0.62 + 0.8, z), 0.012, MT.black, 4));
  cylY(p, 0.18, 0.28, m, x + 0.05, y + h * 0.82, 0, 12); sph(p, 0.18, m, x + 0.05, y + h * 0.82 + 0.14, 0); // satellite dome
}
function radar(p, x, y, w = 1.4) { const g = grp(p, x, y, 0); g.userData.dynamic = true; cylY(g, 0.06, 0.12, MT.black, 0, 0, 0, 8); rbox(g, 0.12, 0.08, w, 0.03, SM.white, 0, 0.1, 0, 0.01); return g; }
function lifeboat(p, x, y, z, s) {
  const g = grp(p, x, y, z); rbox(g, 1.5, 0.32, 0.55, 0.14, SM.orange, 0, 0.16, 0, 0.03); rbox(g, 1.2, 0.3, 0.48, 0.13, SM.orange, 0, 0.42, 0, 0.03); rbox(g, 1.52, 0.04, 0.57, 0.02, SM.white, 0, 0.3, 0, 0.01);
  [-0.35, 0, 0.35].forEach((xx) => box(g, 0.2, 0.1, 0.5, MT.glassD, xx, 0.45, 0));
  [0.55, -0.55].forEach((xx) => { rod(g, new V3(xx, -0.5, -s * 0.45), new V3(xx, 0.8, -s * 0.25), 0.04, SM.grey, 6); rod(g, new V3(xx, 0.8, -s * 0.25), new V3(xx, 0.8, 0), 0.035, SM.grey, 6); });
}
function funnel(p, x, y, h, m, band, band2) {
  ext(p, [[-0.5, 0], [0.45, 0], [0.32, h], [-0.62, h]], [0.04, 0.04, 0.12, 0.12], 1.1, m, x, y, 0, 0.03);
  ext(p, [[-0.6, h - 0.38], [0.34, h - 0.38], [0.32, h], [-0.62, h]], 0.03, 1.13, band, x, y, 0, 0.02);
  if (band2) ext(p, [[-0.56, h - 0.62], [0.38, h - 0.62], [0.36, h - 0.48], [-0.58, h - 0.48]], 0.02, 1.13, band2, x, y, 0, 0.01);
  [0.2, -0.2].forEach((z) => cylY(p, 0.08, 0.3, MT.black, x - 0.2, y + h + 0.1, z, 8));
}
function lifering(p, x, y, z, s) { const t = add(p, new THREE.TorusGeometry(0.17, 0.05, 6, 14), SM.orange, x, y, z); if (s) t.rotation.y = 0; return t; }
function bollards(p, x, y, z) { [0.12, -0.12].forEach((dx) => cylY(p, 0.07, 0.22, MT.black, x + dx, y + 0.11, z, 8)); }
function rails(p, x0, x1, y, z, h = 0.5) { const n = Math.max(2, Math.round((x1 - x0) / 0.6)); for (let i = 0; i <= n; i++) rod(p, new V3(x0 + ((x1 - x0) * i) / n, y, z), new V3(x0 + ((x1 - x0) * i) / n, y + h, z), 0.018, SM.white, 4); rod(p, new V3(x0, y + h, z), new V3(x1, y + h, z), 0.022, SM.white, 4); }
/** Two-joint manipulator arm on (x, y, z), folded. Returns { sh, el, claw, tip }. */
function arm(p, x, y, z, s, m) {
  const sh = grp(p, x, y, z); cylZ(sh, 0.09 * s, 0.16 * s, MT.black, 0, 0, 0, 10);
  rbox(sh, 0.6 * s, 0.1 * s, 0.1 * s, 0.03, m, 0.3 * s, 0, 0, 0.01);
  const el = grp(sh, 0.6 * s, 0, 0); cylZ(el, 0.07 * s, 0.14 * s, MT.black, 0, 0, 0, 10);
  rbox(el, 0.5 * s, 0.08 * s, 0.08 * s, 0.03, m, 0.25 * s, 0, 0, 0.01);
  const claw = grp(el, 0.5 * s, 0, 0); cylX(claw, 0.06 * s, 0.1 * s, MT.dark, 0.03 * s, 0, 0, 8);
  [1, -1].forEach((k) => { const f = rbox(claw, 0.2 * s, 0.03 * s, 0.04 * s, 0.01, MT.steel, 0.15 * s, k * 0.04 * s, 0, 0.005); f.rotation.z = -k * 0.35; });
  const tip = anchor(claw, 0.22 * s, 0, 0);
  sh.rotation.z = 1.2; el.rotation.z = -2.4; return { sh, el, claw, tip };
}

/* fish: a little body and a tail, facing +x */
const FISH = (() => {
  const b = new THREE.SphereGeometry(1, 10, 6); b.scale(0.5, 0.24, 0.12);
  const t = new THREE.ConeGeometry(0.22, 0.32, 4); t.rotateZ(-PI / 2); t.scale(1, 1, 0.25); t.translate(-0.6, 0, 0);
  const f = new THREE.ConeGeometry(0.1, 0.2, 3); f.scale(1.4, 1, 0.25); f.translate(-0.05, 0.27, 0);
  return BufferGeometryUtils.mergeBufferGeometries([b, t, f]);
})();
/** An instanced school of fish swimming round a circle. */
function school(parent, n, cols, o) {
  const im = instanced(parent, FISH, n, () => pick(cols)); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
  const F = Array.from({ length: n }, () => ({ da: rnd(-0.5, 0.5) * (o.arc || 1), dr: rnd(-1, 1) * o.spread, dy: rnd(-1, 1) * o.spread * 0.45, ph: rnd(0, 6.28), s: o.size * rnd(0.8, 1.2) }));
  let T = rnd(0, 50); const D = new THREE.Object3D(), dir = o.dir || 1;
  return (dt) => {
    T += dt;
    F.forEach((f, i) => {
      const a = T * o.w * dir + f.da, r = o.r + f.dr + Math.sin(T * 0.7 + f.ph) * 0.3;
      D.position.set(o.x + Math.cos(a) * r, o.y + f.dy + Math.sin(T * 1.1 + f.ph) * 0.25, o.z + Math.sin(a) * r);
      D.rotation.set(0, Math.atan2(-Math.cos(a) * dir, -Math.sin(a) * dir) + Math.sin(T * 9 + f.ph) * 0.12, 0);
      D.scale.setScalar(f.s); D.updateMatrix(); im.setMatrixAt(i, D.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
  };
}
function fishMesh(p, col, s = 1) { const f = add(p, FISH, mat(col)); f.scale.setScalar(s); return f; }

/* ================= data ================= */
const DATA = {
  navire: { short: 'Le navire', full: 'Le navire océanographique', verb: 'Explorer', horn: 'horn',
    use: 'Un grand bateau de savants, qui étudient la mer.',
    how: "Son sonar dessine une carte du fond. Sa grue en A descend des appareils tout au fond de l'eau." },
  nautile: { short: 'Le sous-marin jaune', full: 'Le sous-marin de recherche', verb: 'Plonger', horn: 'bell',
    use: 'Il emmène trois personnes tout au fond de la mer, là où il fait tout noir.',
    how: 'Des poids lourds le font couler. Pour remonter, il les lâche, et il remonte comme un bouchon !' },
  rov: { short: 'Le robot', full: 'Le robot sous-marin', verb: 'Piloter', horn: 'bell',
    use: "Un robot sans personne dedans, qui explore le fond de la mer.",
    how: 'Il est attaché au bateau par un long câble. Les pilotes le conduisent en regardant ce que filme sa caméra.' },
  chalutier: { short: 'Le chalutier', full: 'Le chalutier', verb: 'Pêcher', horn: 'horn',
    use: 'Un bateau de pêche qui tire un grand filet.',
    how: 'Deux panneaux tirent le filet sur les côtés, pour qu’il reste bien ouvert, comme une grande bouche.' },
  cablier: { short: 'Le câblier', full: 'Le navire câblier', verb: 'Poser', horn: 'horn',
    use: 'Il pose de très longs câbles au fond de la mer.',
    how: "Le câble est enroulé dans le bateau. Il se déroule tout doucement pendant que le bateau avance. Internet passe dedans !" },
  eolienne: { short: "L'éolienne", full: "L'éolienne en mer", verb: 'Tourner', horn: 'bell',
    use: "Elle fabrique de l'électricité avec le vent de la mer.",
    how: 'Elle est plantée au fond de l’eau sur un grand pieu. Un petit bateau amène les techniciens qui la surveillent.' },
  sousmarin: { short: 'Le sous-marin', full: 'Le sous-marin', verb: 'Plonger', horn: 'horn',
    use: "Un très grand bateau qui sait naviguer sous l'eau.",
    how: "Pour plonger, il remplit ses ballasts d'eau. Pour remonter, il les vide en soufflant de l'air dedans." },
  plongeur: { short: 'Le plongeur', full: 'Le plongeur', verb: 'Plonger', horn: 'bell',
    use: "Il nage sous l'eau pour regarder les poissons.",
    how: "Il respire l'air de sa bouteille avec son détendeur. Ses palmes le font nager vite, comme un poisson." }
};
const ORDER = ['navire', 'nautile', 'rov', 'sousmarin', 'chalutier', 'cablier', 'eolienne', 'plongeur'];
const WAVE = (y) => `<path d="M0 ${y}q7.5-4 15 0t15 0t15 0t15 0t15 0t15 0t15 0t15 0" fill="none" stroke="#3f7fd0" stroke-width="3" stroke-linecap="round"/>`;
const SEA = (y) => `<path d="M0 ${y}q7.5-4 15 0t15 0t15 0t15 0t15 0t15 0t15 0t15 0V80H0z" fill="#3f7fd0" opacity=".22"/>`;
const GND = '<path class="gnd" d="M4 75H116"/>';
const ICONS = {
  navire: SEA(40) + WAVE(40) + `<path d="M10 34h96l-8 14H18z" fill="#1f3f86"/><path d="M14 44h88l-3 4H18z" fill="#b8402e"/><rect class="w" x="62" y="20" width="30" height="14" rx="2"/><rect class="w" x="70" y="10" width="20" height="10" rx="2"/>
    <rect class="g" x="74" y="12" width="14" height="5"/><rect class="g" x="66" y="24" width="22" height="4"/><rect class="w" x="52" y="16" width="7" height="18"/><path d="M12 34L22 10h4L18 34" fill="none" stroke="#f4b81c" stroke-width="4"/>
    <path class="ln" d="M20 12V62"/><rect class="s" x="14" y="62" width="12" height="10" rx="2"/>`,
  nautile: SEA(12) + `<path d="M70 44l40-10v26z" fill="#fff1b8" opacity=".6"/><path d="M16 46q0-18 30-18h18q16 0 18 18-2 14-18 14H46q-30 0-30-14z" fill="#f4b81c"/><circle class="w" cx="70" cy="52" r="10"/>
    <circle class="g" cx="74" cy="52" r="3.5"/><rect class="r" x="40" y="20" width="16" height="9" rx="3"/><path d="M14 40l-8-8v24l8-8z" fill="#f06a26"/><rect class="k" x="30" y="61" width="36" height="5" rx="2"/><path class="ln" d="M74 60l10 6 4-4"/>`,
  rov: SEA(10) + `<path class="ln" d="M56 4V22"/><rect class="y" x="28" y="22" width="62" height="16" rx="4"/><rect class="k" x="30" y="38" width="58" height="22" rx="2"/><rect class="s" x="36" y="42" width="30" height="7" rx="3"/>
    <circle class="k" cx="24" cy="48" r="7"/><circle class="k" cx="94" cy="48" r="7"/><circle class="g" cx="84" cy="54" r="4"/><path d="M92 58l10 8 6-3" fill="none" stroke="#9aa4b6" stroke-width="3"/><rect class="k" x="28" y="62" width="62" height="4" rx="2"/>`,
  sousmarin: SEA(22) + WAVE(22) + `<path d="M8 46q0-10 18-10h66q18 0 22 10-4 10-22 10H26q-18 0-18-10z" fill="#2e333d"/><path d="M52 36l3-16h18l2 16z" fill="#2e333d"/><rect x="62" y="10" width="3" height="10" fill="#2e333d"/>
    <path d="M10 46l-6-8v16z" fill="#2e333d"/><ellipse cx="84" cy="46" rx="12" ry="7" fill="#2f86e0" opacity=".8"/><ellipse cx="26" cy="46" rx="10" ry="7" fill="#2f86e0" opacity=".8"/>`,
  chalutier: SEA(30) + WAVE(30) + `<path d="M40 24h76l-8 14H48z" fill="#2f6fe0"/><rect class="w" x="86" y="10" width="20" height="14" rx="2"/><rect class="g" x="90" y="13" width="13" height="5"/><path d="M48 24V8h20v16" fill="none" stroke="#f06a26" stroke-width="4"/>
    <path d="M44 30L8 50l6 22h26l14-26z" fill="#2f9a5a" opacity=".55"/><g fill="#f06a26"><circle cx="16" cy="48" r="3"/><circle cx="30" cy="44" r="3"/><circle cx="44" cy="40" r="3"/></g><path d="M20 60l6-3v6zM30 64l6-3v6z" fill="#f4b81c"/>`,
  cablier: SEA(30) + WAVE(30) + `<path d="M6 22h106l-8 14H14z" fill="#f4f5f8" stroke="#2a2440" stroke-width="1.5"/><path d="M10 30h98l-4 6H14z" fill="#1f3f86"/><rect class="w" x="76" y="8" width="24" height="14" rx="2"/><rect class="g" x="80" y="11" width="16" height="5"/>
    <circle class="y" cx="40" cy="16" r="8"/><circle class="k" cx="40" cy="16" r="5"/><path d="M8 26q-2 30 20 48h90" fill="none" stroke="#24272f" stroke-width="3"/>`,
  eolienne: SEA(48) + WAVE(48) + `<rect class="w" x="57" y="16" width="6" height="34"/><rect class="y" x="55" y="44" width="10" height="12"/><rect class="s" x="56" y="56" width="8" height="20"/><circle class="w" cx="60" cy="14" r="4"/>
    <path class="w" d="M60 14L58 -2h4zM60 14l14 10-2 3zM60 14L46 24l2 3z"/><path d="M60 14L56 -6h8z" fill="#fff" stroke="#2a2440" stroke-width="1.5"/>`,
  plongeur: SEA(8) + `<path d="M26 40q0-6 10-6h40q10 0 10 6t-10 6H36q-10 0-10-6z" fill="#1d2230"/><rect class="y" x="40" y="26" width="34" height="8" rx="4"/><circle cx="90" cy="40" r="7" fill="#1d2230"/><rect class="g" x="92" y="35" width="6" height="6" rx="2"/>
    <path d="M26 38L6 32l2 8zM26 42L8 50l4 4z" fill="#f4b81c"/><g fill="none" stroke="#7fcdee" stroke-width="2"><circle cx="96" cy="24" r="3"/><circle cx="100" cy="14" r="4"/><circle cx="96" cy="4" r="3"/></g>`
};

const CFG = {
  navire: CF(-24, -14), rov: CF(-2, -22), chalutier: CF(20, -16), eolienne: CF(32, 6),
  cablier: CF(0, 0), sousmarin: CF(-30, 10), nautile: CF(-12, 24), plongeur: CF(8, 20)
};
const GR = [], GB = [], GP = [];
const rect = (h, d, len, wid, col, al = 1, stripes, rot = -PI / 4) => { const [cx, cz] = Q(h, d); GR.push({ cx, cz, len, wid, rot, col, al, stripes }); };
const blob = (h, d, r, col) => { const [x, z] = Q(h, d); GB.push([x, z, r, col]); };
// sand ripples, seagrass meadows, darker rocky patches
[[-6, -6, 30, 14, -0.6], [16, 6, 22, 10, -0.9], [-30, 28, 20, 10, -0.5], [10, -34, 24, 9, -0.75]].forEach(([h, d, l, w, r]) => rect(h, d, l, w, 'rgba(0,0,0,0)', 1, 'rgba(150,120,80,.18)', r));
[[-20, 30, 10], [-40, 4, 9], [36, -24, 9], [20, 26, 12], [2, 34, 8], [-8, -36, 9]].forEach(([h, d, r]) => blob(h, d, r, 'rgba(60,140,100,.55)'));
[[-34, -26, 10], [14, -36, 9], [40, 18, 8], [-44, 14, 7], [-8, -34, 6]].forEach(([h, d, r]) => blob(h, d, r, 'rgba(70,80,120,.6)'));
blob(22, 22, 13, 'rgba(255,190,150,.35)'); blob(-36, -2, 8, 'rgba(110,80,60,.35)');
const ZONES = Object.values(CFG).map(({ x, z }) => [x, z, 6]);

export default {
  id: 'mer', title: 'Sous la mer', titleHtml: 'Sous la <span>mer</span>',
  subtitle: 'Des bateaux qui flottent, des sous-marins qui plongent, un robot au fond de l’eau et une baleine qui passe.',
  welcome: 'Bienvenue sous la mer ! Touche un engin pour voir comment il marche.',
  hint: 'Touche un engin pour le découvrir.', backLabel: 'Toute la mer',
  brandIcon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9q3-3 6.5 0t6.5 0 6.5 0 6.5 0"/><path d="M8 22q0-6 8-6h4q6 0 6 6-1 5-6 5h-4q-8 0-8-5z"/><path d="M14 16v-4h4M8 22l-4-3v6z"/></svg>',
  data: DATA, order: ORDER, icons: ICONS, cfg: CFG,
  radius: RAD, sky: 0x0c2c58, outerColor: 0x123a66, zones: ZONES,
  lights: { hemi: [0xa8dcff, 0x2a3a78, 0.95], sun: [0xfff2d8, 1.1] },
  forest: { dark: [0x2a3a5e, 0x334670, 0x243252, 0x3d4a74, 0x1f2d4a], bush: [0xff6a8a, 0xf28a3a, 0xb05ae0, 0x3ad0c0, 0xf2d24a] },
  tuftColors: [0x3f9a5a, 0x2f8a4a, 0x5ab06a, 0x4a9a3a, 0x6abf7a],
  overview: { w: 92, h: 66, focus: [0, 6, 0] },
  ground: { base: ['#e2c890', '#c4a978', '#5f7aa8'], rects: GR, blobs: GB, paths: GP },

  build(ctx) {
    const { scene, makeStation, part, step, onUpdate } = ctx;
    const fx = createFx(scene, 240); onUpdate((dt) => fx.update(dt));
    freeze(buildSeabed(grp(scene)));
    const ups = []; onUpdate((dt) => ups.forEach((f) => f(dt)));
    const foam = (p, n = 1, s = 0.4) => { for (let i = 0; i < n; i++) fx.smoke(new V3(p.x + rnd(-0.4, 0.4), SURF + 0.05, p.z + rnd(-0.4, 0.4)), new V3(rnd(-0.4, 0.4), 0.15, rnd(-0.4, 0.4)), s, 0xffffff, 1.1); };
    const bubbles = (p, n = 1, s = 0.12) => { for (let i = 0; i < n; i++) fx.smoke(p.clone().add(new V3(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2))), new V3(rnd(-0.15, 0.15), rnd(1.2, 2), rnd(-0.15, 0.15)), s, 0xe8f6ff, rnd(1.6, 2.4)); };
    const wake = (m, x, z = 0) => { if (Math.random() < 0.6) foam(m.localToWorld(new V3(x, 0, z + rnd(-0.8, 0.8))), 1, rnd(0.3, 0.5)); };
    // the deep: dim the sun, the sky light and the water colour (no new light), so the lamps mean something.
    // A safety net brings the day back whenever no story is playing (stage blocks switching while busy).
    const LIT = scene.children.filter((o) => o.isLight).map((l) => [l, l.intensity]);
    const BG0 = scene.background && scene.background.isColor ? scene.background.clone() : null, BGN = new THREE.Color(0x020812);
    let dark = 0;
    const deep = (k) => { dark = k; LIT.forEach(([l, i0]) => (l.intensity = i0 * (1 - 0.82 * k))); if (BG0) scene.background.copy(BG0).lerp(BGN, k * 0.85); };
    onUpdate((dt) => { if (dark > 0 && !document.body.classList.contains('busy')) deep(Math.max(0, dark - dt * 1.5)); });
    const pingSnd = () => { tone(1500, 0, 0.35, 'sine', 0.07, 1200); tone(1500, 0.5, 0.25, 'sine', 0.025, 1200); };

    /* ---- le navire océanographique : sonar, grue en A et rosette ---- */
    (function () {
      const st = makeStation('navire'), S = st.g;
      const H = { L: 16, B: 3.4, D: 2.0, wl: 0.45, sheer: 0.45, top: SM.navy, bottom: SM.antif, boot: SM.white, deck: SM.deck, band: [0.86, 0.92], bandM: SM.white };
      const Y0 = SURF - H.D * H.wl, X0 = -10, m = grp(S, X0, Y0, 0); st.m = m;
      const d = grp(m); shipHull(d, H);
      house(d, 3.6, 2.0, 5.4, 1.1, 3.1, SM.white); house(d, 4.0, 3.1, 4.0, 1.0, 2.9, SM.white); bridge(d, 4.6, 4.1, 2.7, 1.0, 3.0, SM.white, SM.navy);
      mast(d, 4.1, 5.2, 2.8); funnel(d, 0.9, 2.0, 2.0, SM.white, SM.navy, SM.yel);
      [1, -1].forEach((s) => { lifeboat(d, 3.4, 3.15, s * 1.85, s); lifering(d, 1.4, 2.6, s * 1.56); cylX(d, 0.2, 0.6, SM.white, 6.0, 2.35, s * 1.25, 10); bollards(d, -7.0, 2.0, s * 1.2); bollards(d, 7.0, 2.4, s * 0.8);
        add(d, new THREE.TorusGeometry(0.16, 0.05, 6, 10), MT.black, 7.2, 1.55, s * 0.95).rotation.y = PI / 2; rbox(d, 0.35, 0.45, 0.08, 0.04, MT.black, 6.9, 1.4, s * 1.18, 0.02); });
      // the labs (containers) on the working deck, the winch, a small crane
      rbox(d, 2.4, 1.2, 1.25, 0.04, SM.blue, -1.8, 2.6, 0.75, 0.02); rbox(d, 2.4, 1.2, 1.25, 0.04, SM.white, -1.8, 2.6, -0.75, 0.02);
      [-2.6, -1.8, -1.0].forEach((x) => box(d, 0.03, 1.1, 1.27, std(0x2558c8, 0.5, 0.1), x, 2.6, 0.75)); rbox(d, 0.5, 0.8, 0.04, 0.02, SM.white, -1.1, 2.5, 1.39, 0.01); box(d, 0.6, 0.3, 0.03, MT.glassD, -2.2, 2.75, 1.39);
      decal(d, 'LABO', 1.0, 0.32, '#ffffff', -2.3, 2.95, 1.395);
      const wd = grp(d, -4.3, 2.55, 0); cylZ(wd, 0.45, 1.3, SM.yel, 0, 0, 0, 16); cylZ(wd, 0.36, 1.32, SM.cable, 0, 0, 0, 16); [0.66, -0.66].forEach((z) => { cylZ(wd, 0.55, 0.06, SM.yel, 0, 0, z, 18); rbox(wd, 0.6, 0.6, 0.08, 0.02, SM.dark, 0, -0.25, z * 1.12, 0.01); });
      cylY(d, 0.22, 1.0, SM.yel, 0.2, 2.5, -1.25, 12); const cb = rbox(d, 2.0, 0.2, 0.2, 0.04, SM.yel, -0.6, 3.2, -1.25, 0.02); cb.rotation.z = 0.35; sph(d, 0.07, MT.black, -1.5, 2.85, -1.25);
      // sonar dome under the hull, name, bow mast
      const dome = sph(d, 0.4, SM.black, 3.0, 0.02, 0); dome.scale.multiply(new V3(1.6, 0.6, 0.9));
      [1, -1].forEach((s) => { const n = decal(d, 'OCÉANIA', 2.4, 0.42, '#ffffff', 5.6, 1.6, s * 1.47); if (s < 0) n.rotation.y = PI; });
      cylY(d, 0.05, 1.6, SM.white, 7.3, 3.2, 0, 6); sph(d, 0.06, AM.navW, 7.3, 4.05, 0);
      bake(d);
      const rad = radar(m, 4.15, 6.95);
      // the A-frame on the stern, on two hydraulic rams
      const af = grp(m, -7.3, H.D, 0); af.rotation.z = -0.3;
      [1, -1].forEach((s) => { rbox(af, 0.24, 4.3, 0.24, 0.06, SM.yel, 0, 2.15, s * 1.35, 0.02); cylZ(af, 0.17, 0.36, SM.dark, 0, 0, s * 1.35, 12); });
      rbox(af, 0.32, 0.32, 3.0, 0.06, SM.yel, 0, 4.25, 0, 0.02); rbox(af, 0.08, 0.45, 0.22, 0.02, SM.yel, 0, 3.9, 0, 0.01); cylZ(af, 0.22, 0.1, SM.dark, 0, 3.85, 0, 16);
      const sheaveP = anchor(af, 0, 3.63, 0);
      const rams = [1, -1].map((s) => hydraulic(m, anchor(m, -5.5, H.D + 0.2, s * 1.35), anchor(af, 0, 2.0, s * 1.35), { barrel: 1.5, mat: SM.yel, rb: 0.1 }));
      // the rosette: a ring of water bottles around the sensors
      const ros = grp(S), rd = grp(ros), RT = 1.47, caps = [];
      [0.04, 0.95].forEach((y) => { const t = add(rd, new THREE.TorusGeometry(0.62, 0.035, 6, 24), SM.steel, 0, y, 0); t.rotation.x = PI / 2; });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; rod(rd, new V3(Math.cos(a) * 0.62, 0.02, Math.sin(a) * 0.62), new V3(Math.cos(a) * 0.62, 0.97, Math.sin(a) * 0.62), 0.025, SM.steel, 6); rod(rd, new V3(Math.cos(a) * 0.62, 0.97, Math.sin(a) * 0.62), new V3(0, RT, 0), 0.012, MT.black, 4); }
      for (let i = 0; i < 12; i++) { const a = ((i + 0.5) / 12) * PI * 2, x = Math.cos(a) * 0.45, z = Math.sin(a) * 0.45; cylY(rd, 0.085, 0.6, SM.grey, x, 0.5, z, 10); const c = grp(ros, x, 0.82, z); cylY(c, 0.09, 0.05, SM.blue, 0, 0, 0, 10); c.rotation.x = 0.9; caps.push(c); }
      cylY(rd, 0.13, 0.72, SM.dark, 0, 0.42, 0, 12); cylY(rd, 0.07, 0.12, SM.yel, 0, 0.84, 0, 10); sph(rd, 0.06, MT.black, 0, RT, 0); bake(rd);
      const cab = rope(S, 1, 0.025, SM.cable), wcab = rope(S, 1, 0.025, SM.cable);
      const L0 = 2.27, LMAX = 14.1; let len = L0;
      const hang = () => { const p = toS(S, sheaveP); ros.position.set(p.x, p.y - len - RT, p.z); cab.set([p, new V3(p.x, p.y - len, p.z)]); wcab.set([toS(S, m, -4.3, 3.0, 0), p]); };
      // the sonar ping (a cone of sound) and the coloured map it draws on the floor
      const pm = BEAMM(); pm.color.setHex(0x7af0ff); const cg = new THREE.ConeGeometry(4, 1, 24, 1, true); cg.translate(0, -0.5, 0);
      const ping = add(m, cg, pm, 3.0, -0.1, 0); ping.visible = false;
      const swTex = canvasTex(32, 128, (x, w, h) => { for (let y = 0; y < h; y++) { const k = Math.abs(y - h / 2) / (h / 2); x.fillStyle = `hsl(${200 - k * 190 + Math.sin(y * 0.7) * 12},85%,58%)`; x.fillRect(0, y, w, 1); } x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < w; i += 8) x.fillRect(i, 0, 1, h); });
      const swg = new THREE.PlaneGeometry(1, 7); swg.translate(0.5, 0, 0); swg.rotateX(-PI / 2);
      const swath = add(S, swg, std(0xffffff, 0.8, 0, { map: swTex }), 0, 0.04, 0); swath.visible = false;
      part(st, 'sonar', 'le sonar', anchor(m, 3.0, -0.2, 0.9), false);
      part(st, 'portique', 'la grue en A', anchor(af, 0, 4.3, 1.4), true);
      part(st, 'rosette', 'la rosette', anchor(ros, 0, 1.0, 0.6), true);
      part(st, 'labo', 'le laboratoire', anchor(m, -1.8, 3.2, 1.4), true);
      st.focus = new V3(-4, 6, 0); st.size = { w: 24, h: 18 }; st.tagAt = anchor(m, 2, 8.4, 0);
      let T = 0, sw0 = 0;
      st.update = (dt) => {
        T += dt; m.position.y = Y0 + Math.sin(T * 1.3) * 0.05; m.rotation.x = Math.sin(T * 0.8) * 0.012; rad.rotation.y += dt * 1.6;
        rams.forEach((r) => r.update()); hang();
        if (st.moving) wake(m, -8.3);
        if (swath.visible) swath.scale.x = Math.max(0.01, m.position.x + 3 - sw0);
      };
      const pingOnce = async () => { ping.visible = true; pingSnd(); await tw(1.1, (k) => { ping.scale.set(0.3 + k, k * (Y0 - 0.2), 0.3 + k); pm.opacity = 0.45 * (1 - k); }, lin); ping.visible = false; };
      st.action = async function () {
        if (st.done) { m.position.x = X0; af.rotation.z = -0.3; len = L0; caps.forEach((c) => (c.rotation.x = 0.9)); swath.visible = false; pop(m, 0.5); st.done = false; await sleep(0.6); }
        engineOn(48); st.moving = true;
        await Promise.all([step('Le navire océanographique arrive. À bord, il y a des savants et leurs laboratoires.', 'labo'), to(m.position, 'x', -5, 4, easeSine)]);
        sw0 = m.position.x + 3; swath.position.x = sw0; swath.visible = true;
        await Promise.all([step("Son sonar envoie des sons vers le fond. L'écho dessine une carte en couleurs !", 'sonar'), to(m.position, 'x', 0, 5, lin),
          (async () => { for (let i = 0; i < 4; i++) await pingOnce(); })()]);
        st.moving = false; engineOff();
        await Promise.all([step("La grue en A se penche au-dessus de l'eau, avec la rosette.", 'portique'), to(af.rotation, 'z', 0.6, 3, easeSine)]);
        await Promise.all([step('La rosette descend tout au fond de la mer...', 'rosette'), to({ get v() { return len; }, set v(x) { len = x; } }, 'v', LMAX, 6, easeSine)]);
        await step('...et ses bouteilles se ferment, pleines d’eau de mer.', 'rosette');
        for (const c of caps) { await to(c.rotation, 'x', 0, 0.15); if (caps.indexOf(c) % 3 === 0) ding(); }
        await Promise.all([step('On la remonte à bord. Les savants vont étudier cette eau !', 'labo'), (async () => { await to({ get v() { return len; }, set v(x) { len = x; } }, 'v', L0 + 0.5, 5, easeSine); await to(af.rotation, 'z', -0.3, 2.5, easeSine); len = L0; })()]);
        chime(); st.done = true;
      };
    })();

    /* ---- le sous-marin jaune (sous-marin de recherche, comme le Nautile) ---- */
    (function () {
      const st = makeStation('nautile'), S = st.g;
      const m = grp(S), Y0 = SURF - 0.75, YB = 1.65; m.position.y = Y0; st.m = m;
      const d = grp(m);
      const P = [[2.7, 0.05], [2.62, 0.45], [2.35, 0.78], [1.8, 0.98], [0.8, 1.05], [-1.3, 1.02], [-2.1, 0.85], [-2.6, 0.55], [-2.8, 0.3], [-2.85, 0.05]];
      body(d, P, SM.yel, 0, 28); skin(d, P, 2.5, -2.6, PI / 2, PI * 0.7, SM.white, 0, 1.012, 10);
      skin(d, P, 1.6, -1.8, 0.05, 0.12, SM.orange, 0, 1.02, 8); skin(d, P, 1.6, -1.8, PI - 0.05, 0.12, SM.orange, 0, 1.02, 8);
      // the titanium sphere in front, with three portholes (and the three people looking out)
      sph(d, 0.78, SM.white, 1.95, -0.5, 0);
      [0, 0.75, -0.75].forEach((a) => {
        const g = grp(d, 1.95 + Math.cos(a) * 0.76, -0.55, Math.sin(a) * 0.76); g.rotation.y = -a;
        cylX(g, 0.15, 0.06, MT.dark, 0, 0, 0, 16); sph(g, 0.085, MT.skin, 0.02, 0, 0); [0.03, -0.03].forEach((z) => sph(g, 0.014, MT.black, 0.1, 0.02, z));
        cylX(g, 0.13, 0.03, MT.glass, 0.06, 0, 0, 16); add(g, new THREE.TorusGeometry(0.15, 0.03, 6, 16), MT.chrome, 0.05, 0, 0).rotation.y = PI / 2;
      });
      // sail with its flashing light and lifting hook, propeller in its ring, fins
      ext(d, [[-0.7, 0], [0.7, 0], [0.55, 0.42], [-0.5, 0.5]], 0.1, 0.55, SM.yel, -0.2, 0.95, 0, 0.03); sph(d, 0.08, AM.navR, -0.1, 1.5, 0); rod(d, new V3(-0.5, 1.4, 0.1), new V3(-0.6, 2.1, 0.1), 0.015, MT.black, 4);
      add(d, new THREE.TorusGeometry(0.14, 0.04, 6, 12), SM.steel, 0.3, 1.52, 0);
      add(d, new THREE.TorusGeometry(0.5, 0.06, 8, 24), SM.orange, -2.95, 0, 0).rotation.y = PI / 2;
      fin(d, [[-2.3, 0.6], [-2.95, 1.25], [-3.25, 1.25], [-3.0, 0.4]], 0.08, SM.orange); fin(d, [[-2.3, -0.6], [-2.95, -1.2], [-3.25, -1.2], [-3.0, -0.4]], 0.08, SM.orange);
      [1, -1].forEach((s) => { plate(d, [[-2.3, s * 0.5], [-2.95, s * 1.15], [-3.2, s * 1.15], [-3.0, s * 0.4]], 0.06, SM.orange, 0); cylX(d, 0.12, 0.35, MT.dark, 0.6, -0.5, s * 0.98, 10); });
      // skids, sample basket, lamps on a front frame
      [1, -1].forEach((s) => { rbox(d, 3.6, 0.1, 0.12, 0.04, SM.steel, 0.2, -1.28, s * 0.62, 0.02); [1.4, -1.2].forEach((x) => rod(d, new V3(x, -1.25, s * 0.62), new V3(x, -0.85, s * 0.45), 0.04, SM.steel, 6)); });
      rbox(d, 0.65, 0.06, 0.95, 0.02, SM.steel, 2.85, -1.22, 0, 0.01); [0.47, -0.47].forEach((z) => rbox(d, 0.65, 0.22, 0.03, 0.01, SM.steel, 2.85, -1.1, z, 0.005)); rbox(d, 0.03, 0.22, 0.95, 0.01, SM.steel, 3.17, -1.1, 0, 0.005);
      rod(d, new V3(2.55, -1.2, 0.47), new V3(2.4, -0.9, 0.4), 0.025, SM.steel, 4); rod(d, new V3(2.55, -1.2, -0.47), new V3(2.4, -0.9, -0.4), 0.025, SM.steel, 4);
      rod(d, new V3(2.45, 0.35, 0.75), new V3(2.45, 0.35, -0.75), 0.04, SM.steel, 6);
      bake(d);
      const lampM = toonMat({ color: 0xfff3c8, emissive: 0xffe6a0, emissiveIntensity: 0.05 }), beams = [], BEAMO = 0.42;
      [[2.5, 0.35, 0.55], [2.5, 0.35, -0.55], [2.6, -1.0, 0.25], [2.6, -1.0, -0.25]].forEach(([x, y, z]) => { cylX(m, 0.09, 0.14, MT.dark, x, y, z, 10); cylX(m, 0.075, 0.03, lampM, x + 0.08, y, z, 10); });
      [[2.55, 0.35, 0.4, -0.35], [2.6, -1.0, -0.2, -0.75]].forEach(([x, y, z, tilt]) => { const g = new THREE.ConeGeometry(1.7, 6, 18, 1, true); g.translate(0, -3, 0); g.rotateZ(PI / 2); const bm = BEAMM(); const b = add(m, g, bm, x, y, z); b.rotation.z = tilt; b.visible = false; beams.push(b); });
      // the pool of light the lamps draw on the sand
      const spotM = BEAMM(); spotM.map = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      const spot = add(S, new THREE.CircleGeometry(1, 28), spotM, 5.0, 0.06, 0); spot.rotation.x = -PI / 2; spot.scale.set(2.6, 1.7, 1); spot.visible = false;
      const lamps = (k) => { lampM.emissiveIntensity = 0.05 + 2.4 * k; beams.forEach((b) => { b.visible = k > 0; b.material.opacity = BEAMO * k; }); spot.visible = k > 0; spotM.opacity = 0.5 * k; };
      const prop = grp(m, -2.95, 0, 0); for (let k = 0; k < 4; k++) { const b = grp(prop); b.rotation.x = (k / 4) * PI * 2; rbox(b, 0.06, 0.4, 0.14, 0.02, MT.dark, 0, 0.22, 0, 0.01); } cylX(prop, 0.1, 0.25, MT.dark, 0, 0, 0, 10);
      const A = arm(m, 2.2, -0.95, 0.5, 1, SM.steel); arm(m, 2.2, -0.95, -0.5, 1, SM.steel);
      const weights = [0.45, -0.45].map((z) => { const w = grp(m, -0.2, -1.12, z); rbox(w, 0.95, 0.24, 0.3, 0.04, std(0x5a5e6a, 0.7, 0.3), 0, 0, 0, 0.02); box(w, 0.02, 0.25, 0.31, SM.yel, 0.3, 0, 0); return w; });
      const wHome = weights.map((w) => w.position.clone());
      // the pebble to pick up: found where the claw lands
      const rock = add(S, ICO, std(0xd06a8a, 0.6, 0), 0, 0, 0); rock.scale.set(0.16, 0.12, 0.14);
      const REACH = [-0.25, -0.55];
      m.position.y = YB; A.sh.rotation.z = REACH[0]; A.el.rotation.z = REACH[1]; S.updateMatrixWorld(true); const rk = toS(S, A.tip); rock.position.set(rk.x, 0.12, rk.z); const rHome = rock.position.clone();
      A.sh.rotation.z = 1.2; A.el.rotation.z = -2.4; m.position.y = Y0;
      part(st, 'lests', 'les lests', anchor(m, -0.2, -1.2, 0.7), false);
      part(st, 'hublots', 'les hublots', anchor(m, 2.6, -0.5, 0.4), true);
      part(st, 'phares', 'les phares', anchor(m, 2.6, 0.4, 0.6), true);
      part(st, 'bras', 'le bras', anchor(A.el, 0.2, 0, 0.1), false);
      st.focusAt = anchor(m, 0.8, 0.3, 0); st.size = { w: 13, h: 10 }; st.tagAt = anchor(m, 0, 2.6, 0);
      let T = 0; st.float = true;
      st.update = (dt) => {
        T += dt; prop.rotation.x += dt * (st.rpm || 0);
        if (st.float) m.position.y = Y0 + Math.sin(T * 1.4) * 0.05;
        if (st.sink && Math.random() < 0.25) bubbles(m.localToWorld(new V3(rnd(-2, 2), 1.1, 0)), 1, 0.1);
      };
      st.action = async function () {
        deep(0); lamps(0);
        if (st.done) { m.position.set(0, Y0, 0); weights.forEach((w, i) => { m.add(w); w.position.copy(wHome[i]); w.rotation.set(0, 0, 0); }); S.add(rock); rock.position.copy(rHome); rock.rotation.set(0, 0, 0); pop(m, 0.5); st.done = false; await sleep(0.6); }
        await Promise.all([step('Le sous-marin jaune emmène trois personnes. Elles regardent par les hublots.', 'hublots'), sleep(2.5)]);
        st.sink = true; st.rpm = 4; st.float = false;
        // the deeper it goes, the darker it gets
        await Promise.all([step('Ses lests, très lourds, le font couler tout doucement vers le fond.', 'lests'), to(m.position, 'y', YB, 7, easeSine), tw(7, (k) => deep(k * k), lin)]);
        st.sink = false; thud();
        await Promise.all([step('Au fond, il fait tout noir. Il allume ses phares !', 'phares'), (async () => { ding(); await tw(0.6, (k) => lamps(k)); })()]);
        await Promise.all([step('Son bras attrape un joli caillou rose...', 'bras'), to(A.sh.rotation, 'z', REACH[0], 2, easeSine), to(A.el.rotation, 'z', REACH[1], 2, easeSine)]);
        A.claw.attach(rock); ding();
        await Promise.all([step('...et le range dans son panier.', 'bras'), to(A.sh.rotation, 'z', -0.05, 1.6, easeSine), to(A.el.rotation, 'z', -1.25, 1.6, easeSine)]);
        m.attach(rock); await tw(0.6, (k) => rock.position.lerp(new V3(2.85, -1.1, 0), k * 0.5)); await Promise.all([to(A.sh.rotation, 'z', 1.2, 1.2), to(A.el.rotation, 'z', -2.4, 1.2)]);
        weights.forEach((w) => S.attach(w)); thud();
        await Promise.all([step('Il lâche ses lests... et il remonte, comme un bouchon !', 'lests'),
          ...weights.map((w) => to(w.position, 'y', 0.12, 1.2, easeIn)),
          (async () => { await sleep(0.6); st.sink = true; await tw(5, (k) => lamps(1 - k)); lamps(0); })(),
          tw(8, (k) => deep(1 - k), easeSine),
          to(m.position, 'y', Y0, 8, easeSine)]);
        deep(0); lamps(0);
        st.sink = false; st.rpm = 0; st.float = true; chime(); st.done = true;
      };
    })();

    /* ---- le robot sous-marin (ROV) et son bateau ---- */
    (function () {
      const st = makeStation('rov'), S = st.g;
      const H = { L: 12.5, B: 3.2, D: 1.9, wl: 0.45, sheer: 0.4, top: SM.orange, bottom: SM.black, boot: SM.white, deck: SM.deck };
      const Y0 = SURF - H.D * H.wl, ship = grp(S, 0, Y0, 0);
      const d = grp(ship); shipHull(d, H);
      house(d, 2.6, 1.9, 3.6, 1.1, 2.9, SM.white); bridge(d, 3.0, 3.0, 2.4, 1.0, 2.9, SM.white, SM.orange); mast(d, 2.8, 4.1, 2.4);
      [0.4, -0.4].forEach((z) => cylY(d, 0.12, 1.0, SM.white, 1.1, 3.5, z, 10));
      [1, -1].forEach((s) => { lifering(d, 1.0, 2.5, s * 1.5); bollards(d, -5.6, 1.9, s * 1.15); cylX(d, 0.2, 0.6, SM.white, 4.6, 2.2, s * 1.1, 10); });
      // the pilots' room (a container) with a big screen, the umbilical winch
      rbox(d, 2.2, 1.3, 1.3, 0.05, SM.blue, -0.4, 2.55, 0.75, 0.02); rbox(d, 0.5, 0.9, 0.04, 0.02, SM.white, -1.2, 2.4, 1.41, 0.01);
      rbox(d, 1.2, 0.75, 0.05, 0.04, MT.black, 0.1, 2.75, 1.42, 0.01);
      const wd = grp(d, -2.4, 2.55, -0.5); cylZ(wd, 0.55, 1.05, SM.ycable, 0, 0, 0, 16); [0.55, -0.55].forEach((z) => { cylZ(wd, 0.66, 0.06, SM.dark, 0, 0, z, 18); rbox(wd, 0.7, 0.7, 0.08, 0.02, SM.dark, 0, -0.3, z * 1.1, 0.01); });
      [1, -1].forEach((s) => { const n = decal(d, 'POLLUX', 1.8, 0.38, '#ffffff', 4.2, 1.55, s * 1.42); if (s < 0) n.rotation.y = PI; });
      bake(d);
      const rad = radar(ship, 2.85, 5.6, 1.2);
      const fishTex = canvasTex(128, 80, (x) => { x.fillStyle = '#0b3a6a'; x.fillRect(0, 0, 128, 80); x.fillStyle = '#d6c08a'; x.fillRect(0, 62, 128, 18); x.fillStyle = '#ff8a2a'; x.beginPath(); x.ellipse(60, 38, 22, 12, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(40, 38); x.lineTo(24, 26); x.lineTo(24, 50); x.fill(); x.fillStyle = '#fff'; x.fillRect(64, 27, 5, 22); x.fillStyle = '#111'; x.beginPath(); x.arc(74, 34, 3, 0, 7); x.fill(); x.fillStyle = '#c86ad8'; x.fillRect(96, 44, 6, 20); x.fillRect(106, 50, 6, 14); });
      const scr = new THREE.MeshBasicMaterial({ map: fishTex, color: 0x0a0e18 }); const screen = add(ship, new THREE.PlaneGeometry(1.08, 0.64), scr, 0.1, 2.75, 1.448);
      const af = grp(ship, -5.6, H.D, 0); af.rotation.z = -0.35;
      [1, -1].forEach((s) => { rbox(af, 0.22, 3.4, 0.22, 0.05, SM.yel, 0, 1.7, s * 1.25, 0.02); cylZ(af, 0.15, 0.32, SM.dark, 0, 0, s * 1.25, 12); });
      rbox(af, 0.28, 0.28, 2.75, 0.05, SM.yel, 0, 3.35, 0, 0.02); rbox(af, 0.08, 0.4, 0.2, 0.02, SM.yel, 0, 3.05, 0, 0.01); cylZ(af, 0.2, 0.1, SM.dark, 0, 3.0, 0, 16);
      const sheaveP = anchor(af, 0, 2.8, 0);
      const rams = [1, -1].map((s) => hydraulic(ship, anchor(ship, -4.0, H.D + 0.2, s * 1.25), anchor(af, 0, 1.6, s * 1.25), { barrel: 1.2, mat: SM.yel, rb: 0.09 }));
      // the ROV: yellow float on top, black frame, six thrusters, a camera, lights and a claw
      const rv = grp(S), rd = grp(rv), props = [];
      [1, -1].forEach((s) => { rbox(rd, 2.0, 0.08, 0.12, 0.03, SM.dark, 0, 0.04, s * 0.6, 0.01); [0.85, -0.85].forEach((x) => rbox(rd, 0.08, 0.95, 0.08, 0.02, MT.black, x, 0.5, s * 0.6, 0.01)); rbox(rd, 1.8, 0.08, 0.08, 0.02, MT.black, 0, 0.95, s * 0.6, 0.01); rbox(rd, 1.8, 0.06, 0.06, 0.02, MT.black, 0, 0.45, s * 0.6, 0.01); });
      [0.85, -0.85].forEach((x) => rbox(rd, 0.08, 0.08, 1.2, 0.02, MT.black, x, 0.95, 0, 0.01));
      rbox(rd, 2.15, 0.56, 1.5, 0.14, SM.yel, 0, 1.24, 0, 0.04); rbox(rd, 2.17, 0.06, 1.52, 0.02, SM.white, 0, 1.0, 0, 0.01);
      cylX(rd, 0.15, 1.2, SM.steel, -0.15, 0.62, 0.25, 12); cylX(rd, 0.13, 1.0, SM.steel, -0.2, 0.62, -0.25, 12); rbox(rd, 0.5, 0.3, 0.4, 0.04, SM.dark, 0.3, 0.3, 0, 0.02);
      cylY(rd, 0.1, 0.18, MT.black, -0.4, 1.58, 0, 10); const br = add(rd, new THREE.ConeGeometry(0.08, 0.35, 8), SM.ycable, -0.4, 1.8, 0); void br;
      rbox(rd, 0.5, 0.05, 0.9, 0.01, SM.steel, 1.15, 0.12, 0, 0.005); [0.45, -0.45].forEach((z) => rbox(rd, 0.5, 0.2, 0.03, 0.01, SM.steel, 1.15, 0.22, z, 0.005)); rbox(rd, 0.03, 0.2, 0.9, 0.01, SM.steel, 1.4, 0.22, 0, 0.005);
      [0.55, 0.2, -0.2, -0.55].forEach((z) => { cylX(rd, 0.07, 0.12, MT.black, 1.0, 1.02, z, 10); cylX(rd, 0.06, 0.03, MT.lamp, 1.07, 1.02, z, 10); });
      const camG = grp(rv, 0.95, 0.72, 0.3); cylY(rd, 0.08, 0.1, MT.black, 0.95, 0.62, 0.3, 10);
      rbox(camG, 0.32, 0.2, 0.22, 0.05, SM.dark, 0.08, 0.1, 0, 0.02); cylX(camG, 0.08, 0.06, MT.chrome, 0.25, 0.1, 0, 12); cylX(camG, 0.06, 0.02, MT.glassD, 0.28, 0.1, 0, 12);
      const thr = (x, y, z, ry, vert) => { const t = grp(rv, x, y, z); t.rotation.y = ry; if (vert) t.rotation.z = PI / 2; const duct = add(t, new THREE.TorusGeometry(0.16, 0.045, 6, 16), MT.black); duct.rotation.y = PI / 2; const pp = grp(t); for (let k = 0; k < 3; k++) { const b = grp(pp); b.rotation.x = (k / 3) * PI * 2; box(b, 0.03, 0.14, 0.07, SM.orange, 0, 0.07, 0); } props.push(pp); };
      [[0.85, 0.62], [0.85, -0.62], [-0.85, 0.62], [-0.85, -0.62]].forEach(([x, z]) => thr(x * 1.05, 0.5, z * 1.08, Math.sign(x) * Math.sign(z) * -0.78, false));
      [0.5, -0.5].forEach((x) => thr(x, 1.55, 0, 0, true));
      bake(rd);
      const A = arm(rv, 0.85, 0.45, -0.35, 0.95, SM.steel);
      const cab = rope(S, 1, 0.035, SM.ycable), wcab = rope(S, 1, 0.035, SM.ycable);
      const RT = 1.95, L0 = 1.45, LD = 9.0; let len = L0; const off = new V3();
      const hang = () => { const p = toS(S, sheaveP); rv.position.set(p.x + off.x, p.y - len - RT + off.y, p.z + off.z); const top = toS(S, rv, -0.4, RT, 0); cab.set([p, top]); wcab.set([toS(S, ship, -2.4, 3.1, -0.5), p]); };
      const rock = add(S, ICO, std(0xb07a52, 0.8, 0), 0, 0, 0); rock.scale.set(0.15, 0.11, 0.14);
      const REACH = [-0.5, -0.65], GOFF = new V3(2.6, 0, 0.5);
      // pre-compute where the claw touches the floor, to put the pebble there
      af.rotation.z = 0.62; off.copy(GOFF); len = 99; S.updateMatrixWorld(true);
      { const p = toS(S, sheaveP); len = p.y - 0.25 - RT - off.y; }
      const LG = len; hang(); A.sh.rotation.z = REACH[0]; A.el.rotation.z = REACH[1]; S.updateMatrixWorld(true);
      { const r = toS(S, A.tip); rock.position.set(r.x, 0.1, r.z); } const rHome = rock.position.clone();
      A.sh.rotation.z = 1.2; A.el.rotation.z = -2.4; af.rotation.z = -0.35; off.set(0, 0, 0); len = L0; S.updateMatrixWorld(true); hang();
      part(st, 'cable', 'le câble', anchor(S, -7.7, 5, 0.3), true);
      part(st, 'helices', 'les hélices', anchor(rv, -0.9, 0.5, 0.7), false);
      part(st, 'camera', 'la caméra', anchor(camG, 0.25, 0.1, 0), true);
      part(st, 'pince', 'la pince', anchor(A.el, 0.3, 0, 0), false);
      part(st, 'ecran', "l'écran des pilotes", anchor(ship, 0.1, 3.1, 1.45), false);
      st.focus = new V3(-2, 6, 0); st.size = { w: 18, h: 17 }; st.tagAt = anchor(ship, 0, 6.4, 0); st.m = ship;
      let T = 0;
      st.update = (dt) => {
        T += dt; ship.position.y = Y0 + Math.sin(T * 1.2) * 0.05; ship.rotation.x = Math.sin(T * 0.9) * 0.012; rad.rotation.y += dt * 1.5;
        rams.forEach((r) => r.update()); hang(); props.forEach((p) => (p.rotation.x += dt * (st.rpm || 0)));
        if ((st.rpm || 0) > 5 && Math.random() < 0.2) bubbles(rv.localToWorld(new V3(-1, 0.5, rnd(-0.6, 0.6))), 1, 0.08);
      };
      const lenTo = (v, t, e) => to({ get v() { return len; }, set v(x) { len = x; } }, 'v', v, t, e);
      st.action = async function () {
        if (st.done) { af.rotation.z = -0.35; len = L0; off.set(0, 0, 0); rv.rotation.set(0, 0, 0); S.add(rock); rock.position.copy(rHome); rock.rotation.set(0, 0, 0); scr.color.setHex(0x0a0e18); pop(rv, 0.5); st.done = false; await sleep(0.6); }
        st.rpm = 2;
        await Promise.all([step('Le robot sous-marin est accroché à son câble. La grue le pose dans la mer.', 'cable'), (async () => { await lenTo(L0 + 0.4, 0.8); await to(af.rotation, 'z', 0.62, 3, easeSine); await lenTo(LD * 0.4, 2, easeSine); })()]);
        st.rpm = 8;
        await Promise.all([step('Il descend tout au fond. Son câble lui donne l’électricité et les ordres des pilotes.', 'cable'), lenTo(LG, 6, easeSine)]);
        await Promise.all([step('Ses hélices le font avancer et tourner, dans tous les sens !', 'helices'),
          tw(5, (k) => { off.x = GOFF.x * k + Math.sin(k * PI * 2) * 1.5; off.z = GOFF.z * k + Math.sin(k * PI * 2) * 1.2; off.y = Math.sin(k * PI) * 0.8; rv.rotation.y = Math.sin(k * PI * 2) * 0.7; }, easeSine)]);
        off.copy(GOFF); rv.rotation.y = 0; st.rpm = 3;
        scr.color.setHex(0xffffff);
        await Promise.all([step('Sa caméra filme le fond. Sur le bateau, les pilotes regardent sur leur écran !', 'ecran'), tw(3, (k) => (camG.rotation.z = -Math.sin(k * PI) * 0.5)), sleep(1)]);
        await Promise.all([step('Avec sa pince, il ramasse un petit caillou pour les savants.', 'pince'), to(A.sh.rotation, 'z', REACH[0], 2, easeSine), to(A.el.rotation, 'z', REACH[1], 2, easeSine)]);
        A.claw.attach(rock); ding();
        await Promise.all([to(A.sh.rotation, 'z', 0.1, 1.4, easeSine), to(A.el.rotation, 'z', -1.6, 1.4, easeSine)]);
        rv.attach(rock); await tw(0.5, (k) => rock.position.lerp(new V3(1.15, 0.25, 0), k * 0.6));
        await Promise.all([to(A.sh.rotation, 'z', 1.2, 1), to(A.el.rotation, 'z', -2.4, 1)]);
        st.rpm = 2;
        await Promise.all([step('Le câble le remonte jusqu’au bateau. Bravo, petit robot !', 'cable'),
          (async () => { await Promise.all([lenTo(LD * 0.35, 6, easeSine), to(off, 'x', 0, 4), to(off, 'z', 0, 4)]); await lenTo(L0 + 0.4, 1.5); await to(af.rotation, 'z', -0.35, 3, easeSine); await lenTo(L0, 0.5); })()]);
        st.rpm = 0; scr.color.setHex(0x0a0e18); chime(); st.done = true;
      };
    })();

    /* ---- le sous-marin : ballasts pleins d'air, puis pleins d'eau ---- */
    (function () {
      const st = makeStation('sousmarin'), S = st.g;
      const Y0 = SURF - 0.72, YD = 4.6, m = grp(S, 0, Y0, 0); st.m = m;
      const P = [[6.5, 0.02], [6.3, 0.5], [5.8, 0.86], [5.0, 1.05], [4.0, 1.12], [-3.0, 1.12], [-4.5, 0.95], [-5.6, 0.6], [-6.3, 0.26], [-6.6, 0.1]];
      const rAt = (x) => { for (let i = 0; i < P.length - 1; i++) { const [x0, r0] = P[i], [x1, r1] = P[i + 1]; if (x <= x0 && x >= x1) return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0); } return 0.1; };
      const seg = (x0, x1) => { const o = [[x0, rAt(x0)]]; P.forEach(([x, r]) => { if (x < x0 && x > x1) o.push([x, r]); }); o.push([x1, rAt(x1)]); return o; };
      const d = grp(m);
      body(d, seg(6.5, 5.3), SM.sub, 0, 28); body(d, seg(3.5, -3.2), SM.sub, 0, 28); body(d, seg(-4.8, -6.6), SM.sub, 0, 28);
      const tanks = [[5.3, 3.5], [-3.2, -4.8]].map(([a, b]) => {
        const g = body(m, seg(a, b), SM.tankGlass, 0, 28); void g;
        const xc = (a + b) / 2, r = Math.min(rAt(a), rAt(b)) * 0.92;
        cylX(d, r * 0.5, a - b, SM.subD, xc, 0, 0, 16); [a - 0.04, b + 0.04].forEach((x) => cylX(d, rAt(x) * 0.97, 0.05, SM.subD, x, 0, 0, 24));
        rbox(d, (a - b) * 0.6, 0.05, 0.4, 0.02, MT.black, xc, rAt(xc) + 0.02, 0, 0.01);
        const w = grp(m, xc, 0, 0); cylX(w, r, a - b - 0.12, SM.ballast, 0, 0, 0, 24);
        return { w, r, x: xc, len: a - b };
      });
      let fill = 0;
      const setFill = (f) => { fill = f; tanks.forEach((t) => { const k = Math.max(0.02, f); t.w.scale.y = k; t.w.position.y = -t.r * (1 - k); t.w.visible = f > 0.02; }); };
      setFill(0);
      // sail with its planes, masts, the hull number
      ext(d, [[1.3, 0], [3.7, 0], [3.55, 1.7], [3.25, 2.1], [1.7, 2.1], [1.4, 1.5]], 0.15, 0.72, SM.sub, 0, 0.95, 0, 0.04);
      [1, -1].forEach((s) => { plate(d, [[3.25, s * 0.35], [3.25, s * 1.3], [2.75, s * 1.3], [2.55, s * 0.35]], 0.07, SM.sub, 2.3); const n = decal(d, 'S 640', 1.1, 0.34, '#f4f5f8', 2.2, 2.55, s * 0.37); if (s < 0) n.rotation.y = PI; });
      cylY(d, 0.08, 0.5, SM.subD, 2.0, 3.2, 0, 8); rbox(d, 0.14, 0.12, 0.3, 0.03, SM.subD, 2.0, 3.45, 0, 0.01);
      // stern: cross-shaped rudders and planes, a seven-bladed propeller
      fin(d, [[-4.7, 0.6], [-5.6, 1.6], [-6.1, 1.6], [-5.95, 0.3]], 0.08, SM.sub); fin(d, [[-4.7, -0.6], [-5.6, -1.5], [-6.1, -1.5], [-5.95, -0.3]], 0.08, SM.sub);
      [1, -1].forEach((s) => plate(d, [[-4.7, s * 0.6], [-5.6, s * 1.6], [-6.1, s * 1.6], [-5.95, s * 0.3]], 0.08, SM.sub, 0));
      // deck: hatches, safety track; flood holes along the lower hull; small vents on top of the tanks
      [4.2, 0.6, -2.4].forEach((x) => cylY(d, 0.3, 0.06, SM.subD, x, rAt(x) - 0.01, 0, 14)); rbox(d, 7.5, 0.02, 0.06, 0.01, SM.subD, 0.4, 1.13, 0, 0.005);
      [1, -1].forEach((s) => { for (let x = -2.9; x <= 3.2; x += 0.5) rbox(d, 0.25, 0.08, 0.04, 0.02, MT.black, x, -0.62, s * 0.93, 0.01); });
      bake(d);
      const prop = grp(m, -6.62, 0, 0); for (let k = 0; k < 7; k++) { const b = grp(prop); b.rotation.x = (k / 7) * PI * 2; const bl = rbox(b, 0.08, 0.55, 0.22, 0.04, std(0xb08a4a, 0.3, 0.8), 0, 0.3, 0, 0.01); bl.rotation.y = 0.5; }
      add(prop, new THREE.ConeGeometry(0.15, 0.4, 12), SM.subD, -0.15, 0, 0).rotation.z = PI / 2;
      const peri = grp(m, 2.6, 2.9, 0); cylY(peri, 0.07, 1.5, SM.subD, 0, 0.75, 0, 10); rbox(peri, 0.22, 0.2, 0.18, 0.04, SM.subD, 0.03, 1.55, 0, 0.01); box(peri, 0.03, 0.08, 0.1, MT.glassD, 0.15, 1.56, 0); peri.position.y = 1.35;
      part(st, 'ballasts', 'les ballasts', anchor(m, 4.4, -0.4, 1.0), true);
      part(st, 'kiosque', 'le kiosque', anchor(m, 2.4, 2.8, 0.4), true);
      part(st, 'helice', "l'hélice", anchor(prop, 0, -0.5, 0.4), false);
      part(st, 'periscope', 'le périscope', anchor(peri, 0, 1.6, 0), false);
      st.focusAt = anchor(m, 0, 1, 0); st.size = { w: 22, h: 12 }; st.tagAt = anchor(m, 1, 4.3, 0);
      let T = 0; st.float = true;
      st.update = (dt) => {
        T += dt; prop.rotation.x += dt * (st.rpm || 0);
        if (st.float) m.position.y = Y0 + Math.sin(T * 1.2) * 0.05;
        if (st.spray && Math.random() < 0.7) tanks.forEach((t) => { const p = m.localToWorld(new V3(t.x + rnd(-0.5, 0.5), rAt(t.x) + 0.1, 0)); if (p.y > SURF - 0.3) fx.smoke(p, new V3(rnd(-0.3, 0.3), rnd(2, 3.5), rnd(-0.3, 0.3)), 0.25, 0xffffff, 0.9); else bubbles(p, 1, 0.12); });
        if (st.blow && Math.random() < 0.8) tanks.forEach((t) => bubbles(m.localToWorld(new V3(t.x + rnd(-0.7, 0.7), -rAt(t.x), rnd(-0.4, 0.4))), 1, 0.14));
        if (st.go && Math.random() < 0.3) bubbles(m.localToWorld(new V3(-6.8, 0, 0)), 1, 0.08);
      };
      st.action = async function () {
        if (st.done) { m.position.set(0, Y0, 0); m.rotation.set(0, 0, 0); peri.position.y = 1.35; setFill(0); pop(m, 0.5); st.done = false; await sleep(0.6); }
        st.float = true;
        await Promise.all([step("Le sous-marin flotte. Ses ballasts sont remplis d'air, comme des bouées.", 'ballasts'), sleep(2.5)]);
        st.spray = true; st.float = false; tone(300, 0, 2.5, 'sawtooth', 0.02, 120);
        await Promise.all([step("Il ouvre ses ballasts : l'eau entre, et l'air sort par le haut. Pchhhh !", 'ballasts'), tw(4.5, (k) => { setFill(k); m.position.y = Y0 - 0.9 * k; }, easeSine)]);
        st.spray = false; engineOn(40); st.rpm = 6; st.go = true;
        await Promise.all([step("Plus lourd, il plonge sous l'eau ! Son hélice le fait avancer.", 'helice'),
          tw(7, (k) => { m.position.x = 9 * k; m.position.y = Y0 - 0.9 + (YD - Y0 + 0.9) * Math.min(1, k * 1.3); m.rotation.z = -Math.sin(Math.min(1, k * 1.3) * PI) * 0.1; }, easeSine)]);
        st.go = false; st.rpm = 2; engineOff(); st.blow = true; tone(200, 0, 3, 'square', 0.015, 90);
        await Promise.all([step("Pour remonter, il souffle de l'air dans ses ballasts : l'eau s'en va. Blop, blop !", 'ballasts'), tw(4, (k) => setFill(1 - k), lin)]);
        st.blow = false;
        await Promise.all([step('Plus léger, il remonte, comme un ballon...', 'kiosque'), tw(5, (k) => { m.position.y = YD + (Y0 - YD) * k; m.rotation.z = Math.sin(k * PI) * 0.08; }, easeSine)]);
        st.float = true; st.rpm = 0;
        await Promise.all([step('...et il sort son périscope pour regarder dehors. Coucou !', 'periscope'), to(peri.position, 'y', 2.9, 1.5, easeSine)]);
        chime(); st.done = true;
      };
    })();

    /* ---- le chalutier et son grand filet ---- */
    (function () {
      const st = makeStation('chalutier'), S = st.g;
      const H = { L: 13, B: 3.3, D: 1.9, wl: 0.45, sheer: 0.5, top: SM.blue, bottom: SM.antif, boot: SM.white, deck: SM.deck, band: [0.84, 0.9], bandM: SM.white };
      const Y0 = SURF - H.D * H.wl, X0 = -2, m = grp(S, X0, Y0, 0); st.m = m;
      const d = grp(m); shipHull(d, H);
      house(d, 3.2, 1.9, 3.2, 1.1, 2.8, SM.white); bridge(d, 3.5, 3.0, 2.4, 0.95, 2.8, SM.white, SM.blue); mast(d, 3.2, 4.0, 2.6);
      cylY(d, 0.06, 2.4, SM.white, 5.6, 3.3, 0, 6); sph(d, 0.06, AM.navW, 5.6, 4.55, 0); rod(d, new V3(5.6, 4.0, 0), new V3(3.6, 5.6, 0), 0.015, MT.black, 4);
      // stern gantry with its two blocks, the net drum on its stands, the stern ramp, fish boxes
      [1, -1].forEach((s) => { rbox(d, 0.24, 3.5, 0.24, 0.05, SM.orange, -5.6, 1.9 + 1.75, s * 1.35, 0.02); cylZ(d, 0.18, 0.08, MT.black, -5.7, 1.9 + 3.05, s * 1.05, 14); rbox(d, 0.1, 0.4, 0.08, 0.02, SM.orange, -5.7, 1.9 + 3.3, s * 1.05, 0.01);
        rbox(d, 0.5, 1.1, 0.12, 0.03, SM.dark, -3.4, 2.4, s * 1.1, 0.01); bollards(d, 5.2, 2.2, s * 0.8); lifering(d, 1.8, 2.5, s * 1.42); });
      rbox(d, 0.32, 0.32, 3.0, 0.05, SM.orange, -5.6, 5.5, 0, 0.02);
      const rp = rbox(d, 1.5, 0.06, 1.3, 0.02, SM.dark, -6.1, 1.75, 0, 0.01); rp.rotation.z = 0.35;
      [[-1.2, 0.7, SM.blue], [-1.2, -0.7, SM.red], [-1.9, 0.7, SM.red], [-1.2, 0.7, SM.blue, 0.3]].forEach(([x, z, c, y = 0]) => rbox(d, 0.6, 0.3, 0.5, 0.04, c, x, 2.05 + y, z, 0.02));
      [1, -1].forEach((s) => { const n = decal(d, 'MARIE-JO', 2.0, 0.4, '#ffffff', 4.2, 1.45, s * 1.48); if (s < 0) n.rotation.y = PI; });
      bake(d);
      const rad = radar(m, 3.25, 6.0, 1.1);
      const fisher = worker(m, -1.5, -0.3, 0, MT.hat); fisher.position.y = 1.9;
      const drum = grp(m, -3.4, 2.75, 0); [1.05, -1.05].forEach((z) => cylZ(drum, 0.85, 0.07, SM.orange, 0, 0, z, 20)); cylZ(drum, 0.62, 2.05, SM.green, 0, 0, 0, 16); for (let i = 0; i < 6; i++) { const b = grp(drum); b.rotation.z = (i / 6) * PI * 2; box(b, 0.05, 0.05, 2.06, std(0x24804a, 0.7, 0), 0.62, 0, 0); }
      // the net: a big cone of mesh, floats on top, rollers below, the cod-end tied at the back
      const netTex = canvasTex(64, 64, (x) => { x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(235,255,210,1)'; x.lineWidth = 6; for (let i = 0; i <= 64; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(64, i); x.stroke(); } });
      netTex.repeat.set(8, 4);
      const NM = std(0x6ad890, 0.8, 0, { map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const net = grp(S), nb = grp(net); nb.scale.set(1, 0.65, 1);
      body(nb, [[0, 1.7], [-2.5, 1.35], [-5, 0.65], [-6.4, 0.55], [-6.8, 0.42]], NM, 0, 20); body(nb, [[0, 1.65], [-2.5, 1.3], [-5, 0.62], [-6.4, 0.52], [-6.8, 0.4]], std(0x3aa86a, 0.8, 0, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }), 0, 20);
      add(nb, new THREE.TorusGeometry(1.7, 0.05, 6, 28), SM.dark).rotation.y = PI / 2;
      for (let i = 0; i < 9; i++) { const a = (i / 8) * PI; sph(nb, 0.17, SM.orange, 0.05, Math.sin(a) * 1.72, Math.cos(a) * 1.72); sph(nb, 0.14, MT.black, 0.05, -Math.sin(a) * 1.72, Math.cos(a) * 1.72); }
      const tie = add(nb, new THREE.TorusGeometry(0.46, 0.07, 6, 16), SM.orange, -6.3, 0, 0); tie.rotation.y = PI / 2;
      const doors = [1, -1].map((s) => { const g = grp(S); rbox(g, 1.3, 0.9, 0.1, 0.12, SM.orange, 0, 0, 0, 0.02); rbox(g, 1.32, 0.08, 0.12, 0.02, MT.black, 0, 0.42, 0, 0.01); rbox(g, 1.32, 0.12, 0.12, 0.02, MT.black, 0, -0.42, 0, 0.01); g.userData.s = s; g.visible = false; return g; });
      const warps = doors.map(() => rope(S, 6, 0.05, SM.cable)), bridles = doors.map(() => rope(S, 1, 0.035, SM.cable));
      let spread = 1.2, netOn = false;
      const blocks = [1, -1].map((s) => anchor(m, -5.7, 1.9 + 2.85, s * 1.05));
      const placeRig = () => {
        doors.forEach((g, i) => { g.visible = netOn; g.position.set(net.position.x + 2.6 * net.scale.x, net.position.y + 0.1, g.userData.s * spread * net.scale.x); g.rotation.y = g.userData.s * 0.4; });
        warps.forEach((w, i) => { if (!netOn) { w.set([]); return; } const A = toS(S, blocks[i]), B = doors[i].position.clone().add(new V3(0.6, 0, 0)); w.set(bez(A, new V3((A.x + B.x) / 2, B.y + 0.3, (A.z + B.z) / 2), B, 6)); });
        bridles.forEach((b, i) => { if (!netOn) { b.set([]); return; } b.set([doors[i].position.clone().add(new V3(-0.6, 0, 0)), toS(S, nb, 0, 0, doors[i].userData.s * 1.7)]); });
      };
      const fishCols = [0xff8a2a, 0xf2d24a, 0x8ac8ff, 0xff6a8a, 0xffffff, 0xf2a03a];
      const fish = Array.from({ length: 10 }, (_, i) => { const f = fishMesh(S, fishCols[i % 6], 1.1); return f; });
      const fHome = fish.map((f, i) => new V3(-9 + (i % 5) * 0.9 + rnd(-0.2, 0.2), 5.2 + Math.floor(i / 5) * 0.9 + rnd(-0.2, 0.2), rnd(-0.9, 0.9)));
      const resetFish = () => fish.forEach((f, i) => { S.add(f); f.position.copy(fHome[i]); f.rotation.set(0, 0, 0); f.scale.setScalar(1.1); f.visible = true; f.userData.caught = false; });
      resetFish();
      part(st, 'filet', 'le filet', anchor(nb, -3.5, 1.3, 1.0), false);
      part(st, 'panneaux', 'les panneaux', anchor(doors[0], 0, 0.5, 0), false);
      part(st, 'enrouleur', "l'enrouleur", anchor(drum, 0, 0.85, 1.1), true);
      part(st, 'poissons', 'les poissons', anchor(fish[2], 0, 0.4, 0), true);
      st.focus = new V3(-2, 6, 0); st.size = { w: 26, h: 17 }; st.tagAt = anchor(m, 2, 6.6, 0);
      let T = 0;
      st.update = (dt) => {
        T += dt; m.position.y = Y0 + Math.sin(T * 1.25) * 0.06; m.rotation.x = Math.sin(T * 0.9) * 0.015; rad.rotation.y += dt * 1.6; placeRig();
        if (st.moving) wake(m, -6.8);
        fish.forEach((f, i) => { if (!f.userData.caught && f.parent === S && st.swim) { f.position.x += dt * 0.1; f.position.y += Math.sin(T * 2 + i) * dt * 0.1; } });
      };
      const NETX = () => m.position.x - 10.5;
      st.action = async function () {
        if (st.done) { m.position.x = X0; resetFish(); tie.visible = true; netOn = false; net.visible = false; pop(m, 0.5); st.done = false; await sleep(0.6); }
        engineOn(52); st.swim = true;
        net.visible = true; netOn = true; spread = 0.6;
        const p0 = new V3(m.position.x - 6.5, SURF - 0.8, 0);
        await Promise.all([step("Le chalutier part pêcher. Il déroule son grand filet à l'arrière.", 'enrouleur'),
          tw(4.5, (k) => { drum.rotation.z += 0.05; net.position.set(p0.x + (NETX() - p0.x) * k, p0.y + (6.4 - p0.y) * k, 0); net.scale.setScalar(0.15 + 0.85 * k); }, easeSine)]);
        await Promise.all([step('Les panneaux écartent le filet : il reste grand ouvert, comme une bouche !', 'panneaux'), to({ get v() { return spread; }, set v(x) { spread = x; } }, 'v', 3.2, 2.5, easeSine)]);
        st.moving = true;
        await Promise.all([step('Le bateau avance... et les poissons entrent dans le filet !', 'poissons'),
          tw(8, (k) => {
            m.position.x = X0 + 10 * k; net.position.x = NETX();
            fish.forEach((f, i) => { if (!f.userData.caught && net.position.x > f.position.x - 0.2) { f.userData.caught = true; nb.attach(f); to(f.position, 'x', -5.2 - (i % 4) * 0.3, 1.5); to(f.position, 'y', rnd(-0.3, 0.3), 1.5); to(f.position, 'z', rnd(-0.3, 0.3), 1.5); } });
          }, lin)]);
        st.moving = false; st.swim = false; engineOff();
        fish.forEach((f, i) => { if (!f.userData.caught) { f.userData.caught = true; nb.attach(f); f.position.set(-5.2 - (i % 4) * 0.3, rnd(-0.3, 0.3), rnd(-0.3, 0.3)); } });
        await Promise.all([step('On remonte le filet tout près de la surface.', 'filet'), to(net.position, 'y', SURF - 2.6, 3, easeSine), to({ get v() { return spread; }, set v(x) { spread = x; } }, 'v', 2.2, 3)]);
        tie.visible = false; ding();
        await Promise.all([step("Aujourd'hui, on ouvre le filet : hop ! Les poissons repartent nager.", 'poissons'),
          ...fish.map((f, i) => { S.attach(f); const t = new V3(f.position.x - rnd(5, 9), rnd(4, 8), rnd(-4, 4)); f.rotation.set(0, PI + rnd(-0.4, 0.4), 0); return (async () => { await sleep(i * 0.12); await tw(3, (k) => f.position.lerpVectors(f.position.clone(), t, k * 0.08), lin); })(); })]);
        await Promise.all([step('Au revoir les poissons ! Le filet s’enroule à nouveau.', 'enrouleur'),
          ...fish.map((f) => tw(1.2, (k) => f.scale.setScalar(Math.max(0.01, 1.1 * (1 - k))))),
          tw(3.5, (k) => { drum.rotation.z -= 0.05; const p1 = new V3(m.position.x - 6.5, SURF - 0.8, 0); net.position.lerp(p1, k * 0.25); net.scale.setScalar(Math.max(0.12, net.scale.x - 0.02)); spread = Math.max(0.6, spread - 0.03); }, lin)]);
        fish.forEach((f) => (f.visible = false)); netOn = false; net.visible = false; chime(); st.done = true;
      };
    })();

    /* ---- le navire câblier ---- */
    (function () {
      const st = makeStation('cablier'), S = st.g;
      const H = { L: 17, B: 3.6, D: 2.2, wl: 0.45, sheer: 0.5, top: SM.white, bottom: SM.navy, boot: SM.red, deck: SM.deck, band: [0.62, 0.68], bandM: SM.blue };
      const Y0 = SURF - H.D * H.wl, X0 = -6, m = grp(S, X0, Y0, 0); st.m = m;
      const d = grp(m); shipHull(d, H);
      house(d, 3.9, 2.2, 5.2, 1.2, 3.3, SM.white); house(d, 4.2, 3.4, 4.2, 1.1, 3.1, SM.white); bridge(d, 4.8, 4.5, 2.8, 1.0, 3.3, SM.white, SM.blue); mast(d, 4.3, 5.6, 3.0);
      funnel(d, 1.1, 2.2, 2.1, SM.white, SM.blue, SM.yel);
      [1, -1].forEach((s) => { lifeboat(d, 3.6, 3.45, s * 1.95, s); bollards(d, -7.6, 2.2, s * 1.2); lifering(d, 1.3, 2.8, s * 1.68); });
      // bow sheaves (a cable ship's big wheels), the cable engine and the stern wheel
      rbox(d, 1.5, 0.45, 1.7, 0.08, SM.yel, 8.4, 2.95, 0, 0.02); [-0.55, 0, 0.55].forEach((z) => { cylZ(d, 0.5, 0.18, SM.yel, 9.05, 3.05, z, 18); cylZ(d, 0.18, 0.22, SM.dark, 9.05, 3.05, z, 10); });
      rbox(d, 2.2, 0.5, 0.7, 0.06, SM.dark, -6.0, 2.45, 0, 0.02); [1, -1].forEach((s) => rbox(d, 2.0, 0.38, 0.05, 0.03, SM.yel, -6.0, 2.45, s * 0.37, 0.01)); for (let i = 0; i < 4; i++) cylZ(d, 0.13, 0.5, MT.black, -6.8 + i * 0.5, 2.75, 0, 10);
      [1, -1].forEach((s) => rbox(d, 1.3, 1.1, 0.08, 0.06, SM.yel, -8.5, 2.75, s * 0.32, 0.02));
      [1, -1].forEach((s) => { ext(d, [[-0.9, 0], [0.9, 0], [0.25, 1.35], [-0.25, 1.35]], 0.04, 0.16, SM.yel, -3.0, 2.2, s * 1.3, 0.02); });
      rod(d, new V3(-3.1, 4.65, 0), new V3(-5.0, 2.95, 0), 0.07, SM.cable, 6); rod(d, new V3(-5.0, 2.95, 0), new V3(-7.1, 2.95, 0), 0.07, SM.cable, 6); rod(d, new V3(-7.1, 2.95, 0), new V3(-8.6, 3.55, 0), 0.07, SM.cable, 6);
      [1, -1].forEach((s) => { const n = decal(d, 'ATLANTIQUE', 2.8, 0.42, '#1f3f86', 5.6, 1.7, s * 1.57); if (s < 0) n.rotation.y = PI; });
      bake(d);
      const rad = radar(m, 4.35, 7.6, 1.5);
      const drum = grp(m, -3.0, 3.5, 0); [1.12, -1.12].forEach((z) => cylZ(drum, 1.25, 0.1, SM.yel, 0, 0, z, 24)); cylZ(drum, 1.08, 2.14, SM.cable, 0, 0, 0, 24); for (let i = 0; i < 6; i++) cylZ(drum, 1.1, 0.03, std(0x50545e, 0.6, 0.2), 0, 0, -0.9 + i * 0.36, 24); [0, 1, 2].forEach((i) => { const b = grp(drum); b.rotation.z = (i / 3) * PI * 2; box(b, 0.5, 0.08, 2.3, SM.yel, 0.85, 0, 0); });
      const wheel = grp(m, -8.6, 2.85, 0); cylZ(wheel, 0.75, 0.3, SM.yel, 0, 0, 0, 22); cylZ(wheel, 0.3, 0.34, SM.dark, 0, 0, 0, 12); for (let i = 0; i < 3; i++) { const b = grp(wheel); b.rotation.z = (i / 3) * PI; box(b, 1.3, 0.1, 0.36, SM.dark, 0, 0, 0); }
      const down = rope(S, 14, 0.07, SM.cable), outP = anchor(m, -9.3, 2.75, 0);
      const XL = X0 - 9.3 - 4.5; // where the laid cable starts on the floor
      const laid = grp(S, XL, 0.1, 0); cylX(laid, 0.09, 1, SM.cable, 0.5, 0, 0, 10);
      { const g = grp(S); cylX(g, 0.09, 10, SM.cable, XL - 5, 0.1, 0, 10); cylX(g, 0.22, 0.9, SM.yel, XL - 4, 0.22, 0, 14); rbox(g, 0.8, 0.5, 0.8, 0.06, SM.yel, XL, 0.25, 0, 0.02); bake(g); }
      const pulseM = glow(0x7af0ff, 0x3ae0ff), pulses = Array.from({ length: 8 }, () => { const p = sph(S, 0.16, pulseM, 0, 0.12, 0); p.visible = false; return p; });
      let tdx = 0;
      part(st, 'bobine', 'la bobine de câble', anchor(drum, 0, 1.3, 1.1), true);
      part(st, 'roue', 'la grande roue', anchor(wheel, -0.2, 0.6, 0.3), true);
      part(st, 'cable', 'le câble', anchor(S, -6, 0.4, 0.5), false);
      st.focus = new V3(-2, 6, 0); st.size = { w: 30, h: 17 }; st.tagAt = anchor(m, 3, 9.6, 0);
      let T = 0, lastX = X0;
      st.update = (dt) => {
        T += dt; m.position.y = Y0 + Math.sin(T * 1.1) * 0.05; m.rotation.x = Math.sin(T * 0.7) * 0.01; rad.rotation.y += dt * 1.4;
        const dx = m.position.x - lastX; lastX = m.position.x; drum.rotation.z += dx / 1.1; wheel.rotation.z += dx / 0.75;
        const A = toS(S, outP); tdx = Math.max(XL + 0.01, A.x - 4.5); const B = new V3(tdx, 0.1, 0);
        down.set(bez(A, new V3(A.x - 1.4, 0.1, 0), B, 14)); laid.scale.x = tdx - XL;
        if (st.moving) wake(m, -8.8);
      };
      st.action = async function () {
        if (st.done) { m.position.x = X0; lastX = X0; pulses.forEach((p) => (p.visible = false)); pop(m, 0.5); st.done = false; await sleep(0.6); }
        await Promise.all([step('Le câblier transporte un câble très, très long, enroulé sur une grosse bobine.', 'bobine'), tw(2.5, (k) => (drum.rotation.z += 0.004))]);
        engineOn(46); st.moving = true;
        await Promise.all([step("Il avance tout doucement, et le câble se déroule par l'arrière, sur la grande roue.", 'roue'), to(m.position, 'x', 1, 7, easeSine)]);
        await Promise.all([step("Le câble descend, et se pose au fond de la mer, d'un pays à l'autre.", 'cable'), to(m.position, 'x', 7, 6, lin)]);
        st.moving = false; engineOff();
        pulses.forEach((p) => (p.visible = true));
        await Promise.all([step('Dans le câble, il y a des fils de verre. Internet passe dedans, comme de la lumière !', 'cable'),
          tw(6, (k) => pulses.forEach((p, i) => { const u = (k * 3 + i / 8) % 1, x0 = XL - 10; p.position.set(x0 + (tdx - x0) * u, 0.12, 0); }), lin)]);
        pulses.forEach((p) => (p.visible = false)); chime(); st.done = true;
      };
    })();

    /* ---- l'éolienne en mer et son bateau de service ---- */
    (function () {
      const st = makeStation('eolienne'), S = st.g;
      const TOP = SURF + 14.5, TP = SURF + 2.9, d = grp(S);
      cylY(d, 0.75, SURF - 1.2, SM.pile, 0, (SURF - 1.2) / 2 - 0.3, 0, 22); cylY(d, 0.85, 4.4, SM.yel, 0, SURF - 1.5 + 2.2, 0, 22); cylY(d, 0.9, 0.12, SM.dark, 0, SURF - 1.5, 0, 22);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2 + rnd(-0.2, 0.2), r = rnd(1.1, 2.6); const rr = add(d, ICO, i % 2 ? SM.grey : std(0x8a8e9c, 0.9, 0), Math.cos(a) * r, 0.15, Math.sin(a) * r); rr.scale.set(rnd(0.3, 0.55), rnd(0.2, 0.35), rnd(0.3, 0.55)); }
      // platform with railing, boat landing with its ladder
      cylY(d, 1.9, 0.14, SM.deck, 0, TP, 0, 24); cylY(d, 0.9, 0.5, SM.yel, 0, TP - 0.3, 0, 22);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; rod(d, new V3(Math.cos(a) * 1.82, TP, Math.sin(a) * 1.82), new V3(Math.cos(a) * 1.82, TP + 0.7, Math.sin(a) * 1.82), 0.025, SM.yel, 4); }
      [TP + 0.7, TP + 0.38].forEach((y) => { const t = add(d, new THREE.TorusGeometry(1.82, 0.03, 4, 32), SM.yel, 0, y, 0); t.rotation.x = PI / 2; });
      [0.42, -0.42].forEach((z) => { cylY(d, 0.12, TP - SURF + 1.6, SM.yel, -2.25, (TP + SURF - 1.6) / 2, z, 10); [SURF - 1.2, TP - 0.6].forEach((y) => rod(d, new V3(-2.25, y, z), new V3(-0.75, y, z * 0.6), 0.06, SM.yel, 6)); });
      for (let y = SURF - 1.4; y < TP + 0.6; y += 0.32) box(d, 0.05, 0.05, 0.6, SM.steel, -2.1, y, 0); [0.3, -0.3].forEach((z) => box(d, 0.05, TP - SURF + 2.1, 0.05, SM.steel, -2.1, (TP + SURF - 0.9) / 2, z));
      // white tower with its door, nacelle, the cable going down the J-tube and out along the floor
      add(d, new THREE.CylinderGeometry(0.42, 0.62, TOP - TP, 22), SM.white, 0, (TOP + TP) / 2, 0); rbox(d, 0.05, 0.9, 0.5, 0.05, SM.grey, -0.6, TP + 0.6, 0, 0.01);
      for (let i = 0; i < 3; i++) rbox(d, 0.3, 0.05, 0.6, 0.01, SM.deck, -0.9 + i * 0.12, TP + 0.1 + i * 0.18, 0, 0.01);
      rbox(d, 1.1, 1.05, 3.0, 0.15, SM.white, 0, TOP + 0.5, -0.25, 0.03); rbox(d, 1.12, 0.06, 3.02, 0.02, SM.grey, 0, TOP + 0.3, -0.25, 0.01); sph(d, 0.08, AM.navR, 0, TOP + 1.1, -0.9);
      rail0(d, TOP + 1.03);
      const cpath = [new V3(0.95, TP - 0.2, 0), new V3(0.95, 0.25, 0), new V3(1.6, 0.1, 0), new V3(15, 0.1, 0)];
      for (let i = 0; i < cpath.length - 1; i++) rod(d, cpath[i], cpath[i + 1], 0.1, SM.cable, 8);
      bake(d);
      function rail0(p, y) { for (let i = 0; i < 4; i++) rod(p, new V3(-0.45, y, -1.6 + i * 0.25), new V3(-0.45, y + 0.35, -1.6 + i * 0.25), 0.015, SM.yel, 4); rod(p, new V3(-0.45, y + 0.35, -1.6), new V3(-0.45, y + 0.35, -0.85), 0.018, SM.yel, 4); }
      const rotor = grp(S, 0, TOP + 0.5, 1.35); sph(rotor, 0.55, SM.white, 0, 0, 0.1).scale.multiply(new V3(1, 1, 1.45));
      for (let k = 0; k < 3; k++) { const b = grp(rotor); b.rotation.z = (k / 3) * PI * 2; ext(b, [[-0.32, 0.35], [0.5, 0.5], [0.42, 2.4], [0.14, 7.4], [-0.02, 7.6], [-0.14, 7.3], [-0.26, 2.2]], 0.06, 0.14, SM.white, 0, 0, 0, 0.03); ext(b, [[0.15, 6.6], [0.12, 7.4], [-0.02, 7.6], [-0.12, 7.3], [-0.1, 6.6]], 0.03, 0.16, SM.red, 0, 0, 0, 0.02); }
      // the crew transfer boat: a catamaran with a big rubber nose
      const BX0 = -17, BX1 = -5.85, b = grp(S, BX0, SURF - 0.55, 0), bd = grp(b);
      [0.8, -0.8].forEach((z) => { const h = grp(bd, 0, 0, z); shipHull(h, { L: 6.4, B: 0.9, D: 1.1, bow: 0.4, wl: 0.5, sheer: 0.25, bul: 0, top: SM.orange, bottom: SM.black, boot: SM.white, deck: SM.deck }); });
      rbox(bd, 5.6, 0.16, 2.5, 0.05, SM.deck, -0.2, 1.15, 0, 0.02); house(bd, 0.4, 1.23, 2.1, 1.15, 2.1, SM.white, { trim: SM.orange }); mast(bd, 0.2, 2.4, 1.2);
      rbox(bd, 0.4, 0.5, 2.6, 0.16, MT.black, 3.2, 1.05, 0, 0.03); rails(bd, -3.0, -0.8, 1.23, 1.2, 0.5); rails(bd, -3.0, -0.8, 1.23, -1.2, 0.5);
      bake(bd);
      const tech = worker(b, 2.3, 0, 0, SM.white); tech.position.y = 1.23; const tHome = tech.position.clone();
      const pulseM = glow(0xffe04a, 0xffc020), pulses = Array.from({ length: 7 }, () => { const p = sph(S, 0.17, pulseM, 0, 0, 0); p.visible = false; return p; });
      const plen = []; let PL = 0; for (let i = 0; i < cpath.length - 1; i++) { plen.push(cpath[i].distanceTo(cpath[i + 1])); PL += plen[i]; }
      const along = (u, out) => { let s = u * PL; for (let i = 0; i < plen.length; i++) { if (s <= plen[i]) return out.lerpVectors(cpath[i], cpath[i + 1], s / plen[i]); s -= plen[i]; } return out.copy(cpath[cpath.length - 1]); };
      part(st, 'pieu', 'le grand pieu', anchor(S, 0.8, 5, 0.6), true);
      part(st, 'pales', 'les pales', anchor(rotor, 0.3, 4.5, 0.2), true);
      part(st, 'bateau', 'le bateau de service', anchor(b, 1.2, 2.2, 1.2), false);
      part(st, 'technicien', 'le technicien', anchor(tech, 0, 1.5, 0), false);
      part(st, 'cable', 'le câble électrique', anchor(S, 8, 0.4, 0.3), false);
      st.focus = new V3(-2.5, 15, 0); st.size = { w: 18, h: 27 }; st.tagAt = anchor(S, 0, TOP + 2.2, 0); st.m = b;
      let T = 0; st.rpm = 0.35;
      st.update = (dt) => { T += dt; rotor.rotation.z -= dt * st.rpm; b.position.y = SURF - 0.55 + Math.sin(T * 1.6) * (b.position.x > BX1 - 0.3 ? 0.02 : 0.06); if (st.moving) wake(b, -3.2); };
      st.action = async function () {
        if (st.done) { b.position.x = BX0; b.add(tech); tech.position.copy(tHome); tech.rotation.set(0, 0, 0); pulses.forEach((p) => (p.visible = false)); st.rpm = 0.35; pop(b, 0.5); st.done = false; await sleep(0.6); }
        await Promise.all([step("L'éolienne est plantée au fond de la mer, sur un très grand pieu.", 'pieu'), sleep(2.5)]);
        engineOn(70); st.moving = true;
        await Promise.all([step("Le petit bateau de service arrive. Il pousse son gros nez contre l'échelle.", 'bateau'), to(b.position, 'x', BX1, 6, easeSine)]);
        st.moving = false; thud();
        S.attach(tech); tech.rotation.set(0, 0, 0);
        await Promise.all([step("Le technicien monte à l'échelle, pour vérifier l'éolienne.", 'technicien'),
          (async () => { const p0 = tech.position.clone(); await tw(1, (k) => tech.position.set(p0.x + (-2.45 - p0.x) * k, p0.y + (SURF + 1.0 - p0.y) * k, 0)); await to(tech.position, 'y', TP + 0.12, 3.5, lin); await to(tech.position, 'x', -1.2, 0.8); })()]);
        engineOff();
        await Promise.all([step('Le vent souffle fort : les grandes pales tournent, tournent !', 'pales'), tw(4, (k) => (st.rpm = 0.35 + 1.4 * k)), tone(110, 0, 4, 'sawtooth', 0.012, 160)]);
        pulses.forEach((p) => (p.visible = true));
        const tmp = new V3();
        await Promise.all([step("Elle fabrique de l'électricité, qui part dans un câble sous la mer, jusqu'aux maisons.", 'cable'),
          tw(7, (k) => pulses.forEach((p, i) => p.position.copy(along((k * 3 + i / 7) % 1, tmp))), lin)]);
        pulses.forEach((p) => (p.visible = false)); chime(); st.done = true;
      };
    })();

    /* ---- le plongeur ---- */
    (function () {
      const st = makeStation('plongeur'), S = st.g;
      // the dive boat: an inflatable with its console, outboard engine and dive flag
      const BY = SURF - 0.3, boat = grp(S, 0, BY, 0), bd = grp(boat);
      shipHull(bd, { L: 4.4, B: 1.5, D: 0.6, bow: 0.4, wl: 0.5, sheer: 0.2, bul: 0, top: SM.white, bottom: SM.navy, boot: SM.white, deck: SM.deck });
      [0.82, -0.82].forEach((z) => { cylX(bd, 0.3, 3.4, SM.tube, -0.5, 0.65, z, 16); sph(bd, 0.3, SM.tube, -2.2, 0.65, z); });
      { const tg = new THREE.TorusGeometry(0.82, 0.3, 10, 16, PI); tg.rotateX(PI / 2); tg.rotateY(PI / 2); add(bd, tg, SM.tube, 1.2, 0.65, 0); }
      [[0.82, 1], [-0.82, -1]].forEach(([z]) => rbox(bd, 3.0, 0.05, 0.06, 0.02, SM.orange, -0.4, 0.83, z * 1.32, 0.01));
      rbox(bd, 0.6, 0.6, 0.7, 0.08, SM.white, 0.4, 0.9, 0, 0.02); const ws = box(bd, 0.04, 0.35, 0.65, MT.glass, 0.72, 1.32, 0); ws.rotation.z = 0.4; add(bd, new THREE.TorusGeometry(0.12, 0.02, 6, 12), MT.black, 0.62, 1.25, 0).rotation.y = PI / 2;
      rbox(bd, 0.5, 0.7, 0.42, 0.12, MT.black, -2.4, 1.0, 0, 0.03); rbox(bd, 0.12, 0.8, 0.12, 0.03, MT.black, -2.45, 0.35, 0, 0.01); rbox(bd, 0.52, 0.06, 0.44, 0.02, SM.white, -2.4, 1.2, 0, 0.01);
      cylY(bd, 0.03, 1.6, SM.white, -1.7, 1.4, -0.6, 6); ext(bd, [[0, 0], [0.35, 0], [0.35, 0.5], [0, 0.5]], 0.0, 0.02, SM.white, -1.7, 1.65, -0.6, 0.005); ext(bd, [[0.35, 0], [0.85, 0], [0.62, 0.25], [0.85, 0.5], [0.35, 0.5]], 0.0, 0.02, SM.blue, -1.7, 1.65, -0.6, 0.005);
      [-1.2, -1.45].forEach((x) => { cylY(bd, 0.11, 0.6, SM.yel, x, 0.85, -0.45, 10); cylY(bd, 0.03, 0.12, SM.steel, x, 1.2, -0.45, 6); });
      bake(bd);
      const driver = walker(boat, 0.0, -0.25, { top: 0xe5452c }); driver.position.y = 0.55;
      // the diver, built lying along +x (head in front, tank on the back)
      const D = grp(S), B = grp(D), dd = grp(B);
      rbox(dd, 0.75, 0.3, 0.42, 0.12, SM.suit, 0, 0, 0, 0.03); rbox(dd, 0.55, 0.34, 0.46, 0.12, SM.blue, 0.05, 0.02, 0, 0.03); rbox(dd, 0.1, 0.32, 0.44, 0.04, MT.black, -0.3, 0, 0, 0.01); box(dd, 0.06, 0.08, 0.05, SM.steel, -0.3, -0.14, 0);
      cylX(dd, 0.14, 0.75, SM.yel, -0.05, 0.3, 0, 14); sph(dd, 0.14, SM.yel, 0.32, 0.3, 0).scale.multiply(new V3(0.5, 1, 1)); cylX(dd, 0.05, 0.12, SM.steel, 0.4, 0.3, 0, 8);
      sph(dd, 0.16, SM.suit, 0.53, 0.04, 0); rbox(dd, 0.06, 0.13, 0.24, 0.04, MT.black, 0.66, 0.07, 0, 0.01); rbox(dd, 0.03, 0.09, 0.2, 0.03, MT.glass, 0.695, 0.07, 0, 0.01); rbox(dd, 0.02, 0.08, 0.18, 0.02, MT.skin, 0.67, 0.07, 0, 0.005);
      cylX(dd, 0.04, 0.08, MT.black, 0.68, -0.07, 0, 8); rod(dd, new V3(0.68, -0.07, 0.03), new V3(0.4, 0.3, 0.1), 0.02, MT.black, 4);
      bake(dd);
      const legs = [0.11, -0.11].map((z) => { const l = grp(B, -0.36, -0.02, z); rbox(l, 0.8, 0.14, 0.15, 0.06, SM.suit, -0.4, 0, 0, 0.02); const f = rbox(l, 0.55, 0.03, 0.26, 0.06, SM.yel, -0.98, -0.02, 0, 0.01); f.rotation.z = 0.15; return l; });
      [0.26, -0.26].forEach((z) => { const a = grp(B, 0.28, -0.02, z); rbox(a, 0.5, 0.11, 0.11, 0.05, SM.suit, -0.24, 0, 0, 0.02); sph(a, 0.06, SM.suit, -0.5, 0, 0); a.rotation.y = z > 0 ? 0.25 : -0.25; });
      const qSit = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, PI / 2, 'ZYX'));
      const qSwim = (yaw, pitch) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ'));
      const SIT = new V3(-0.6, BY + 1.3, 0.8);
      const homeD = () => { S.add(D); D.position.copy(SIT); B.quaternion.copy(qSit); legs.forEach((l) => (l.rotation.z = 1.45)); st.sit = true; };
      homeD();
      const slerpTo = (q, t) => { const q0 = B.quaternion.clone(); return tw(t, (k) => B.quaternion.slerpQuaternions(q0, q, k), easeSine); };
      const moveTo = (p, t, e = easeSine) => { const p0 = D.position.clone(); return tw(t, (k) => D.position.lerpVectors(p0, p, k), e); };
      part(st, 'masque', 'le masque', anchor(B, 0.7, 0.15, 0), true);
      part(st, 'bouteille', 'la bouteille', anchor(B, -0.05, 0.45, 0), true);
      part(st, 'palmes', 'les palmes', anchor(legs[0], -1.0, 0, 0), false);
      part(st, 'coraux', 'les coraux', anchor(S, 10.4, 1.6, 0.6), false);
      st.focusAt = anchor(D, 0, 0, 0); st.size = { w: 13, h: 10 }; st.tagAt = anchor(boat, 0, 2.6, 0); st.m = boat;
      let T = 0;
      st.update = (dt) => {
        T += dt; boat.position.y = BY + Math.sin(T * 1.5) * 0.05; boat.rotation.x = Math.sin(T * 1.1) * 0.02;
        if (!st.sit) legs.forEach((l, i) => (l.rotation.z = st.kick ? Math.sin(T * 9 + i * PI) * 0.35 * st.kick : l.rotation.z * 0.9));
        if (D.position.y < SURF - 0.6 && Math.random() < 0.12) { const p = B.localToWorld(new V3(0.7, 0.1, 0)); bubbles(p, 1, 0.1); }
      };
      st.action = async function () {
        if (st.done) { homeD(); pop(D, 0.4); st.done = false; await sleep(0.5); }
        await Promise.all([step('Le plongeur met son masque et sa bouteille. Il s’assoit au bord du bateau...', 'masque'), sleep(2.8)]);
        thud(); tone(500, 0, 0.4, 'sine', 0.06, 150); st.sit = false;
        await Promise.all([step('...et plouf ! Il bascule en arrière, dans l’eau.', 'masque'), slerpTo(qSwim(-PI / 2, -0.6), 1.4),
          (async () => { await moveTo(new V3(-0.6, SURF - 0.4, 2.6), 1.2); foam(D.getWorldPosition(new V3()), 8, 0.5); })()]);
        st.kick = 0.6;
        await Promise.all([step("Il respire l'air de sa bouteille avec son détendeur. Blop, blop, les bulles !", 'bouteille'),
          slerpTo(qSwim(0, -0.5), 2), moveTo(new V3(2.5, 7.2, 2.0), 5)]);
        st.kick = 1;
        await Promise.all([step('Ses palmes le font nager comme un poisson, jusqu’aux coraux.', 'palmes'), slerpTo(qSwim(0, -0.15), 2), moveTo(new V3(8.6, 2.9, 0.9), 6)]);
        st.kick = 0.3;
        await Promise.all([step('Il regarde les poissons et les jolis coraux... sans rien toucher !', 'coraux'),
          tw(5, (k) => B.quaternion.copy(qSwim(Math.sin(k * PI * 2) * 0.5, -0.1)), lin)]);
        st.kick = 0.8;
        await Promise.all([step('Il remonte tout doucement, et retourne au bateau. Quelle belle plongée !', 'bouteille'),
          slerpTo(qSwim(PI, 0.6), 2), moveTo(new V3(-0.4, SURF - 0.55, 2.4), 7)]);
        st.kick = 0; st.sit = true; await Promise.all([slerpTo(qSit, 0.8), ...legs.map((l) => to(l.rotation, 'z', 1.45, 0.8))]); await moveTo(SIT, 0.8);
        chime(); st.done = true;
      };
    })();

    // look down into the water, so the ships at the surface don't hide the machines on the bottom
    ctx.stations.forEach((s) => (s.el = s.id === 'eolienne' ? 0.62 : 0.95));
    buildLife(scene, onUpdate, fx, bubbles);
  }
};

/* ================= the sea floor and the sea surface ================= */
function at(p, h, d, yaw = YAW, y = 0) { const [x, z] = Q(h, d); const g = grp(p, x, y, z); g.rotation.y = yaw; return g; }
function coral(g, kind, col, s = 1) {
  const c = mat(col);
  if (kind === 'branch') { cylY(g, 0.12 * s, 0.6 * s, c, 0, 0.3 * s, 0, 8); for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + rnd(-0.3, 0.3), h = rnd(0.9, 1.6) * s, r = rnd(0.35, 0.7) * s; const tip = new V3(Math.cos(a) * r, h, Math.sin(a) * r); rod(g, new V3(0, 0.5 * s, 0), tip, 0.08 * s, c, 6); sph(g, 0.1 * s, c, tip.x, tip.y, tip.z); } }
  else if (kind === 'brain') { const m = add(g, new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), c); m.scale.set(0.8 * s, 0.6 * s, 0.8 * s); for (let i = 0; i < 4; i++) { const t = add(g, new THREE.TorusGeometry((0.2 + i * 0.15) * s, 0.025 * s, 4, 18), mat(0x2a2440)); t.rotation.x = PI / 2; t.position.y = (0.58 - i * 0.12) * s; t.scale.set(1, 1, 1); } }
  else if (kind === 'fan') { cylY(g, 0.05 * s, 0.4 * s, c, 0, 0.2 * s, 0, 6); ext(g, [[-0.9, 0.3], [0.9, 0.3], [1.2, 1.1], [0.6, 1.8], [-0.6, 1.8], [-1.2, 1.1]].map(([x, y]) => [x * s, y * s]), 0.4 * s, 0.05, c, 0, 0, 0, 0.01); }
  else if (kind === 'tube') { for (let i = 0; i < 4; i++) { const h = rnd(0.6, 1.4) * s, x = rnd(-0.3, 0.3) * s, z = rnd(-0.3, 0.3) * s; cylY(g, 0.16 * s, h, c, x, h / 2, z, 10); cylY(g, 0.12 * s, 0.02, mat(0x2a2440), x, h + 0.005, z, 10); } }
  else if (kind === 'table') { cylY(g, 0.1 * s, 0.6 * s, c, 0, 0.3 * s, 0, 8); cylY(g, 0.9 * s, 0.12 * s, c, 0, 0.62 * s, 0, 16); }
  else if (kind === 'anemone') { cylY(g, 0.3 * s, 0.35 * s, mat(0xb05ae0), 0, 0.18 * s, 0, 12); for (let i = 0; i < 14; i++) { const a = (i / 14) * PI * 2, r = rnd(0.05, 0.25) * s; const t = add(g, new THREE.ConeGeometry(0.05 * s, 0.45 * s, 5), c, Math.cos(a) * r, 0.55 * s, Math.sin(a) * r); t.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); } }
}
function starfish(p, x, z, col, s = 0.35) { const pts = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2, r = i % 2 ? 0.38 : 1; pts.push([Math.cos(a) * r * s, Math.sin(a) * r * s]); } const m = ext(p, pts, 0.03, 0.08, mat(col), x, 0.05, z, 0.02); m.rotation.set(-PI / 2, 0, rnd(0, 6)); }
function urchin(p, x, z) { const g = grp(p, x, 0.15, z); sph(g, 0.18, mat(0x4a2a6a), 0, 0, 0); for (let i = 0; i < 12; i++) { const v = new V3(rnd(-1, 1), rnd(-0.1, 1), rnd(-1, 1)).normalize(); rod(g, v.clone().multiplyScalar(0.1), v.clone().multiplyScalar(0.42), 0.012, mat(0x5a3a7a), 3); } }
function buildSeabed(scene) {
  const SEA = SM;
  // the reef in front-right, where the diver goes
  const reef = [[16, 19, 'branch', 0xff6a8a, 1.1], [18, 22, 'brain', 0xf2d24a, 1.2], [19, 18, 'fan', 0xb05ae0, 1.2], [21, 21, 'tube', 0xf28a3a, 1], [23, 24, 'table', 0x3ad0c0, 1.1],
    [20, 26, 'branch', 0xf28a3a, 1.3], [25, 20, 'fan', 0xe84a5a, 1.4], [26, 25, 'brain', 0xff9ad8, 1.3], [17, 25, 'anemone', 0xff9a6a, 1.2], [28, 22, 'branch', 0xb05ae0, 1.2],
    [23, 29, 'tube', 0x3ad0c0, 1.2], [29, 27, 'fan', 0xf2d24a, 1.1], [22, 16, 'brain', 0x8ad86a, 0.9], [15, 23, 'table', 0xff6a8a, 0.8], [27, 17, 'tube', 0xff6a8a, 0.9],
    // small coral patches elsewhere
    [-4, 30, 'branch', 0xf2d24a, 0.9], [2, 30, 'anemone', 0xff6a8a, 1], [-26, 22, 'fan', 0xff6a8a, 1.2], [-22, 18, 'brain', 0x3ad0c0, 1], [10, -8, 'tube', 0xb05ae0, 0.9],
    [36, -10, 'branch', 0xff9ad8, 1.1], [40, -4, 'fan', 0x3ad0c0, 1.1], [-14, -30, 'branch', 0xf28a3a, 1], [6, -34, 'brain', 0xe84a5a, 1.1], [-38, -16, 'tube', 0xf2d24a, 1], [42, 10, 'table', 0xb05ae0, 1]];
  reef.forEach(([h, d, k, c, s]) => coral(at(scene, h, d, rnd(0, 6)), k, c, s));
  [[14, 15], [24, 31], [30, 18], [-2, 10], [-18, 8], [8, -12], [-30, -6], [34, 0], [-6, 36], [4, 14], [12, 32], [-34, 24]].forEach(([h, d], i) => { const [x, z] = Q(h, d); starfish(scene, x, z, [0xf06a26, 0xe84a5a, 0xf2b81c][i % 3]); });
  [[19, 15], [26, 29], [-10, 32], [12, -6], [-28, 16], [38, -14], [-6, -28]].forEach(([h, d]) => { const [x, z] = Q(h, d); urchin(scene, x, z); });
  // shells
  for (let i = 0; i < 24; i++) { const a = rnd(0, 6.28), r = rnd(6, 42), s = add(scene, new THREE.SphereGeometry(1, 8, 5, 0, PI * 2, 0, PI / 2), mat(pick([0xf6e6d0, 0xf2c4b0, 0xfff2e0])), Math.cos(a) * r, 0, Math.sin(a) * r); s.scale.set(0.2, 0.1, 0.16); s.rotation.y = rnd(0, 3); }
  // the old wreck, lying on its side, with a treasure chest
  { const g = at(scene, -36, -2, YAW + 0.4, -0.7); g.rotation.z = 0.28;
    shipHull(g, { L: 11, B: 3.4, D: 2.4, wl: 0.3, sheer: 0.9, top: SEA.wood, bottom: SEA.woodD, boot: SEA.woodD, deck: std(0x8a6a48, 0.9, 0), inner: SEA.woodD, closed: true });
    for (let x = -4.5; x < 4.5; x += 0.45) [1, -1].forEach((s) => box(g, 0.05, 0.08, 0.02, SEA.woodD, x, 2.2, s * 1.72));
    rbox(g, 2.6, 1.2, 2.6, 0.06, SEA.wood, -3.6, 3.0, 0, 0.02); [-0.8, 0, 0.8].forEach((z) => box(g, 0.04, 0.4, 0.4, mat(0x2a2440), -2.3, 3.1, z));
    const hole = sph(g, 0.6, mat(0x2a2014), 1.0, 1.2, 1.55); hole.scale.multiply(new V3(1.3, 0.8, 0.2));
    cylY(g, 0.16, 2.2, SEA.woodD, 1.5, 3.4, 0, 8); for (let i = 0; i < 6; i++) add(g, new THREE.ConeGeometry(0.12, rnd(0.6, 1.2), 5), mat(0x3f9a5a), rnd(-3, 3), 2.6, rnd(-1, 1)); }
  { const g = at(scene, -31, -9, 0.5); cylY(g, 0.18, 6, SEA.woodD, 0, 0.18, 0, 8).rotation.z = PI / 2; rbox(g, 0.2, 0.2, 3.2, 0.05, SEA.woodD, 1.2, 0.2, 0, 0.02); }
  { const g = at(scene, -30, -1, 1.2); rbox(g, 1.0, 0.55, 0.65, 0.06, SEA.wood, 0, 0.28, 0, 0.02); box(g, 1.02, 0.08, 0.67, SEA.gold, 0, 0.3, 0); const lid = grp(g, 0, 0.56, -0.32); rbox(lid, 1.0, 0.12, 0.65, 0.06, SEA.wood, 0, 0.06, 0.32, 0.02); lid.rotation.x = -1.0;
    for (let i = 0; i < 9; i++) { const c = cylY(g, 0.09, 0.02, SEA.gold, rnd(-0.4, 0.4), 0.58 + rnd(0, 0.06), rnd(-0.2, 0.2), 12); c.rotation.x = rnd(-0.4, 0.4); } for (let i = 0; i < 6; i++) cylY(g, 0.09, 0.02, SEA.gold, rnd(0.6, 1.2), 0.01, rnd(-0.6, 0.6), 12); }
  { const g = at(scene, -27, -6, 2.0); rod(g, new V3(0, 0.1, 0), new V3(1.8, 0.1, 0), 0.08, mat(0x6a5a52)); rod(g, new V3(1.8, 0.1, 0), new V3(2.3, 0.1, 0.5), 0.07, mat(0x6a5a52)); rod(g, new V3(1.8, 0.1, 0), new V3(2.3, 0.1, -0.5), 0.07, mat(0x6a5a52)); add(g, new THREE.TorusGeometry(0.2, 0.05, 6, 12), mat(0x6a5a52), -0.15, 0.06, 0).rotation.x = PI / 2; }
  // rocks
  const clusters = [[-8, -34, 5], [14, -36, 4], [36, -22, 5], [-34, -26, 5], [40, 18, 4], [-44, 14, 3], [-18, 34, 3], [30, 34, 3], [-40, 30, 3], [2, -12, 2], [-16, -12, 2], [12, 12, 2], [-42, -14, 3], [44, -8, 3]];
  const rocks = []; clusters.forEach(([h, d, n]) => { for (let i = 0; i < n * 3; i++) { const [x, z] = Q(h + rnd(-n, n), d + rnd(-n, n)); rocks.push([x, z, rnd(0.4, 1.6) * (i < 2 ? 1.6 : 1)]); } });
  const ri = instanced(scene, ICO, rocks.length, (i, dm) => { const [x, z, s] = rocks[i]; dm.position.set(x, s * 0.25, z); dm.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); dm.scale.set(s * rnd(0.8, 1.3), s * rnd(0.5, 0.8), s * rnd(0.8, 1.3)); return pick([0x6f7590, 0x5d6584, 0x7a7f9a, 0x8a8ea6, 0x58607a]); });
  ri.frustumCulled = false;
  // buoys' chains and blocks (the buoys themselves bob, in buildLife)
  BUOYS.forEach(([h, d]) => { const [x, z] = Q(h, d); rbox(scene, 0.8, 0.4, 0.8, 0.04, SEA.grey, x, 0.2, z, 0.02); rod(scene, new V3(x, 0.3, z), new V3(x, SURF - 0.6, z), 0.03, MT.dark, 4); });
  // the sea surface: a see-through rippled plane high above, light shafts underneath
  const wt = canvasTex(256, 256, (x) => { x.fillStyle = '#3a9ee0'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(200,240,255,.5)'; x.lineWidth = 3; for (let i = 0; i < 26; i++) { const y0 = rnd(0, 256), x0 = rnd(0, 256), l = rnd(30, 80); x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + l / 2, y0 - 8, x0 + l, y0); x.stroke(); } x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 40; i++) x.fillRect(rnd(0, 256), rnd(0, 256), rnd(4, 20), 2); });
  wt.repeat.set(9, 9); WATER.tex = wt;
  const sm = std(0xffffff, 0.15, 0.1, { map: wt, transparent: true, opacity: 0.34, depthWrite: false });
  const surf = add(scene, new THREE.CircleGeometry(RAD + 14, 64), sm, 0, SURF, 0); surf.rotation.x = -PI / 2; surf.userData.dynamic = true; surf.castShadow = false; surf.receiveShadow = false;
  const shaft = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false });
  [[-14, -6], [6, 10], [-30, 20], [24, -4], [10, -24], [-8, 18]].forEach(([h, d]) => { const [x, z] = Q(h, d); const g = new THREE.CylinderGeometry(1.6, 3.2, SURF, 14, 1, true); const c = add(scene, g, shaft, x + 1.5, SURF / 2, z - 1); c.rotation.set(0.12, 0, 0.18); c.userData.dynamic = true; });
  return scene;
}
const WATER = { tex: null };
const BUOYS = [[38, -26, 'r'], [-16, -40, 'g'], [-44, -4, 'r'], [14, 38, 'g']];

/* ================= life ================= */
function buildLife(scene, onUpdate, fx, bubbles) {
  const ups = [];
  // fish schools
  ups.push(school(scene, 26, [0xf2d24a, 0xffe07a], { x: Q(-12, -4)[0], z: Q(-12, -4)[1], y: 6.5, r: 5, spread: 1.0, w: 0.35, size: 0.8, arc: 1.2 }));
  ups.push(school(scene, 34, [0xc8d8f0, 0xa8c0e0, 0xe0ecf8], { x: Q(-6, 14)[0], z: Q(-6, 14)[1], y: 9, r: 4, spread: 0.7, w: -0.5, dir: 1, size: 0.55, arc: 2 }));
  ups.push(school(scene, 18, [0xff8a2a, 0xff6a8a], { x: Q(14, 6)[0], z: Q(14, 6)[1], y: 3.5, r: 3.5, spread: 0.8, w: 0.45, size: 0.7, arc: 1.4 }));
  ups.push(school(scene, 22, [0x3ad0c0, 0x4a8ae0, 0xf2d24a], { x: Q(22, 22)[0], z: Q(22, 22)[1], y: 2.2, r: 5, spread: 1.6, w: 0.3, size: 0.5, arc: 6.28 }));
  ups.push(school(scene, 14, [0xb05ae0, 0xff9ad8], { x: Q(30, -6)[0], z: Q(30, -6)[1], y: 5, r: 3, spread: 0.8, w: -0.4, size: 0.65, arc: 1.5 }));
  // the whale, slowly going round the edge
  const W = whale(scene), wr = ring(0, 0, 44, 5.2), wtail = W.userData.tail, wfins = W.userData.fins; let ws = 0;
  // the turtle round the reef
  const Tt = turtle(scene), tr = ring(...Q(24, 24), 5, 3.4); let ts = 0;
  // jellyfish
  const jel = [[8, -6, 8], [-18, 4, 7.5], [30, -2, 9], [-4, -12, 9.5], [36, 22, 7]].map(([h, d, y]) => { const [x, z] = Q(h, d); const j = jellyfish(scene); j.position.set(x, y, z); j.userData.y = y; j.userData.ph = rnd(0, 6); return j; });
  // crabs walking sideways
  const crabs = [[-4, 12], [26, 10], [-20, -20], [10, 28]].map(([h, d]) => { const [x, z] = Q(h, d); const c = crab(scene); c.position.set(x, 0, z); c.rotation.y = rnd(0, 6); c.userData.p = c.position.clone(); c.userData.ph = rnd(0, 6); return c; });
  // clownfish around their anemone
  const [ax, az] = Q(17, 25); const clowns = [0, 1].map(() => { const f = add(scene, FISH, mat(0xff7a1a)); f.scale.setScalar(0.45); [0.1, -0.2].forEach((x) => cylX(f, 0.26, 0.07, mat(0xffffff), x, 0, 0, 10).scale.set(1, 1, 0.5)); return f; });
  // kelp swaying
  const kelps = []; [[-22, 30], [-19, 33], [-24, 34], [-17, 29], [-42, 20], [-40, 24], [34, -30], [37, -27], [6, 36], [-2, 38]].forEach(([h, d]) => { const [x, z] = Q(h, d); kelps.push(kelp(scene, x, z, rnd(4, 7))); });
  // buoys bobbing on the surface
  const buoys = BUOYS.map(([h, d, c]) => { const [x, z] = Q(h, d); const g = grp(scene, x, SURF, z); const m = std(c === 'r' ? 0xe5452c : 0x2fae5a, 0.4, 0.1);
    if (c === 'r') cylY(g, 0.45, 1.3, m, 0, 0.35, 0, 14); else add(g, new THREE.ConeGeometry(0.55, 1.5, 14), m, 0, 0.45, 0);
    cylY(g, 0.5, 0.15, SM.white, 0, -0.1, 0, 14); rod(g, new V3(0, 1, 0), new V3(0, 1.8, 0), 0.04, MT.dark, 4); sph(g, 0.1, MT.amber, 0, 1.9, 0); freeze(g); shadows(g); return g; });
  // sailboats going round on the surface
  const boats = [0, 1, 2].map((i) => sailboat(scene, [0xe5452c, 0x2f6fe0, 0xf2b21c][i]));
  const sr = route(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * PI * 2; return [Math.cos(a) * 46, Math.sin(a) * 46]; }), true, 0.5);
  const sail = traffic(sr, boats, 2.2, { gap: 5, y: SURF - 0.32 });
  // seagulls above
  const gulls = [0, 1, 2, 3].map(() => gull(scene));
  let T = 0;
  onUpdate((dt) => {
    T += dt; ups.forEach((f) => f(dt));
    ws += dt * 1.7; placeOn(W, wr, ws); W.position.y = 5.2 + Math.sin(T * 0.4) * 0.5; W.rotation.z = Math.sin(T * 0.4 + 1) * 0.04; wtail.rotation.z = Math.sin(T * 1.3) * 0.28; wfins.forEach((f, i) => (f.rotation.x = (i ? -1 : 1) * (0.2 + Math.sin(T * 0.9) * 0.15)));
    if (Math.random() < 0.01) { const p = W.localToWorld(new V3(4, 2, 0)); bubbles(p, 4, 0.2); }
    ts += dt * 1.1; placeOn(Tt, tr, ts); Tt.position.y = 3.4 + Math.sin(T * 0.8) * 0.3; Tt.userData.flip.forEach((f, i) => (f.rotation.x = Math.sin(T * 2.2 + (i % 2) * 0.4) * 0.5 * (i < 2 ? 1 : 0.5) * (i % 2 ? -1 : 1)));
    jel.forEach((j) => { const u = j.userData; j.position.y = u.y + Math.sin(T * 0.7 + u.ph) * 0.8; const s = 1 + Math.sin(T * 2.2 + u.ph) * 0.1; j.scale.set(s, 1 / s, s); });
    crabs.forEach((c) => { const u = c.userData; const k = Math.sin(T * 0.5 + u.ph) * 1.4; c.position.set(u.p.x + Math.sin(c.rotation.y) * k, Math.abs(Math.sin(T * 8)) * 0.03, u.p.z + Math.cos(c.rotation.y) * k); });
    clowns.forEach((f, i) => { const a = T * 1.4 + i * 2.6; f.position.set(ax + Math.cos(a) * 0.9, 1.0 + Math.sin(T * 2 + i) * 0.15, az + Math.sin(a) * 0.9); f.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); });
    kelps.forEach((k, i) => { k.rotation.z = Math.sin(T * 0.8 + i) * 0.07; k.rotation.x = Math.sin(T * 0.6 + i * 2) * 0.05; });
    buoys.forEach((b, i) => { b.position.y = SURF - 0.15 + Math.sin(T * 1.5 + i) * 0.08; b.rotation.z = Math.sin(T * 1.1 + i) * 0.06; });
    sail.update(dt, []); boats.forEach((b) => (b.rotation.x = Math.sin(T * 1.2) * 0.04));
    gulls.forEach((g, i) => { const a = T * 0.35 + (i * PI) / 2, r = 14 + i * 3; g.position.set(Math.cos(a) * r - 4, SURF + 9 + Math.sin(T + i) * 0.8, Math.sin(a) * r - 4); g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); g.userData.w.forEach((w, k) => (w.rotation.x = (k ? 1 : -1) * Math.sin(T * 5 + i) * 0.45)); });
    if (WATER.tex) { WATER.tex.offset.x += dt * 0.012; WATER.tex.offset.y += dt * 0.006; }
    if (Math.random() < 0.05) { const [x, z] = Q(pick([2, -16, 36, -34]), pick([-12, -12, -22, -26])); bubbles(new V3(x, 0.4, z), 1, 0.12); }
  });
}
function ring(cx, cz, r, y) { return route(Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r, y]; }), true, 0.5); }
function whale(scene) {
  const g = grp(scene), d = grp(g);
  const P = [[8, 0.05], [7.8, 0.7], [7.2, 1.3], [6, 1.75], [4, 2.0], [1, 1.95], [-2, 1.6], [-4.5, 1.0], [-6, 0.55], [-7, 0.32], [-7.2, 0.2]];
  body(d, P, SM.whale, 0, 28); skin(d, P, 7.7, -5.5, PI / 2, 1.9, SM.whaleB, 0, 1.01, 12);
  for (let i = -2; i <= 2; i++) skin(d, P, 7.4, 2.2, PI / 2 + i * 0.25, 0.04, std(0xb8c4d4, 0.6, 0), 0, 1.02, 6);
  [1, -1].forEach((s) => { sph(d, 0.13, MT.black, 5.9, 0.15, s * 1.68); sph(d, 0.05, SM.white, 5.98, 0.18, s * 1.74); });
  for (let i = 0; i < 7; i++) sph(d, 0.13, std(0x34507a, 0.7, 0), 7.6 - i * 0.45, 0.65 + i * 0.12, rnd(-0.3, 0.3));
  rod(d, new V3(7.85, -0.35, 0.5), new V3(5.4, -0.5, 1.6), 0.04, MT.black, 4); rod(d, new V3(7.85, -0.35, -0.5), new V3(5.4, -0.5, -1.6), 0.04, MT.black, 4);
  fin(d, [[-2.5, 1.3], [-3.5, 2.1], [-3.8, 2.1], [-4.2, 0.9]], 0.25, SM.whale);
  bake(d);
  const fins = [1, -1].map((s) => { const f = grp(g, 3.6, -0.9, s * 1.6); plate(f, [[0.4, 0], [-0.5, 0], [-2.0, s * 4.6], [-1.4, s * 4.9]], 0.18, SM.whaleB, 0); return f; });
  const tail = grp(g, -6.9, 0, 0); plate(tail, [[0.3, 0], [-1.0, 2.6], [-1.9, 2.8], [-1.4, 0.4], [-1.7, 0], [-1.4, -0.4], [-1.9, -2.8], [-1.0, -2.6]], 0.18, SM.whale, 0);
  g.userData.tail = tail; g.userData.fins = fins; shadows(g); return g;
}
function turtle(scene) {
  const g = grp(scene), d = grp(g);
  const sh = add(d, new THREE.SphereGeometry(1, 18, 10, 0, PI * 2, 0, PI / 2), SM.shell); sh.scale.set(0.95, 0.42, 0.75);
  cylY(d, 0.9, 0.08, mat(0xe8d48a), 0, -0.02, 0, 20).scale.set(1, 1, 0.78);
  [[0.25, 0], [-0.3, 0], [0, 0.4], [0, -0.4], [0.5, 0.3], [0.5, -0.3], [-0.55, 0.3], [-0.55, -0.3]].forEach(([x, z]) => { const p = sph(d, 0.24, std(0x4a6a2a, 0.6, 0), x, 0.33 - Math.hypot(x, z) * 0.18, z); p.scale.multiply(new V3(1, 0.25, 1)); });
  sph(d, 0.24, mat(0x9ab86a), 1.05, 0.05, 0).scale.multiply(new V3(1.2, 0.85, 0.9)); [1, -1].forEach((s) => sph(d, 0.05, MT.black, 1.25, 0.12, s * 0.13));
  bake(d);
  const flip = [];
  [[0.45, 1, 1.0], [0.45, -1, 1.0], [-0.6, 1, 0.5], [-0.6, -1, 0.5]].forEach(([x, s, L]) => { const f = grp(g, x, 0, s * 0.6); plate(f, [[0.15, 0], [-0.15, 0], [-0.5 * L, s * L], [-0.2 * L, s * L * 1.05]], 0.06, mat(0x8aa85a), 0); flip.push(f); });
  g.userData.flip = flip; shadows(g); g.scale.setScalar(1.1); return g;
}
function jellyfish(scene) {
  const g = grp(scene); const dm = add(g, new THREE.SphereGeometry(0.6, 16, 8, 0, PI * 2, 0, PI / 2), SM.jelly); dm.scale.y = 0.75;
  add(g, new THREE.SphereGeometry(0.32, 12, 6, 0, PI * 2, 0, PI / 2), glow(0xff7ac8, 0xb02a80), 0, 0.02, 0).scale.y = 0.6;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; rod(g, new V3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), new V3(Math.cos(a) * 0.45 + rnd(-0.1, 0.1), -rnd(1.2, 1.8), Math.sin(a) * 0.45), 0.012, SM.jelly, 3); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; rod(g, new V3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1), new V3(Math.cos(a) * 0.2, -1.0, Math.sin(a) * 0.2), 0.05, SM.jelly, 5); }
  return g;
}
function crab(scene) {
  const g = grp(scene), m = mat(0xe8502a), d = grp(g);
  sph(d, 0.32, m, 0, 0.22, 0).scale.multiply(new V3(1, 0.45, 0.75));
  [1, -1].forEach((s) => { for (let i = 0; i < 3; i++) rod(d, new V3(-0.1 + i * 0.12, 0.2, s * 0.2), new V3(-0.2 + i * 0.15, 0.02, s * 0.5), 0.025, m, 4);
    rod(d, new V3(0.2, 0.22, s * 0.15), new V3(0.42, 0.3, s * 0.28), 0.04, m, 4); sph(d, 0.1, m, 0.48, 0.32, s * 0.3).scale.multiply(new V3(1.3, 0.8, 0.8));
    rod(d, new V3(0.22, 0.28, s * 0.07), new V3(0.26, 0.42, s * 0.08), 0.015, m, 3); sph(d, 0.04, MT.black, 0.26, 0.44, s * 0.08); });
  freeze(d); shadows(g); g.scale.setScalar(1.1); return g;
}
function kelp(scene, x, z, h) {
  const g = grp(scene, x, 0, z), col = mat(pick([0x5a8a2a, 0x6a9a3a, 0x4a7a2a]));
  for (let k = 0; k < 3; k++) { const ox = rnd(-0.3, 0.3), oz = rnd(-0.3, 0.3), hh = h * rnd(0.7, 1); let p = new V3(ox, 0, oz);
    for (let i = 0; i < 6; i++) { const q = new V3(ox + Math.sin(i * 1.3 + k) * 0.25, ((i + 1) / 6) * hh, oz + Math.cos(i * 1.1) * 0.2); rod(g, p, q, 0.04, col, 4); const l = box(g, 0.5, 0.04, 0.2, col, q.x + 0.2, q.y - 0.1, q.z); l.rotation.set(rnd(-0.3, 0.3), rnd(0, 3), 0.5); p = q; } }
  freeze(g); shadows(g); return g;
}
function sailboat(scene, col) {
  const g = grp(scene), d = grp(g), c = std(col, 0.4, 0.1);
  shipHull(d, { L: 4.2, B: 1.4, D: 0.75, bow: 0.45, wl: 0.4, sheer: 0.2, bul: 0.12, top: SM.white, bottom: c, boot: SM.white, deck: SM.wood });
  rbox(d, 1.2, 0.3, 0.8, 0.1, SM.white, -0.4, 0.88, 0, 0.02); box(d, 0.6, 0.12, 0.82, MT.glassD, -0.2, 0.9, 0);
  cylY(d, 0.05, 4.6, SM.white, 0.4, 3.05, 0, 8); cylX(d, 0.04, 2.1, SM.white, -0.6, 1.25, 0, 6);
  ext(d, [[0.35, 1.3], [-1.6, 1.3], [0.35, 5.2]], 0.0, 0.03, SM.white, 0, 0, 0.02, 0.005); ext(d, [[-1.0, 1.32], [-1.5, 1.32], [0.3, 4.5], [0.3, 4.0]], 0.0, 0.035, c, 0, 0, 0.02, 0.005);
  ext(d, [[0.5, 1.2], [2.0, 1.0], [0.5, 4.8]], 0.0, 0.03, SM.white, 0, 0, 0, 0.005); rod(d, new V3(0.4, 5.3, 0), new V3(2.1, 0.9, 0), 0.012, MT.black, 3);
  freeze(d); shadows(g); return g;
}
function gull(scene) {
  const g = grp(scene); sph(g, 0.3, SM.white, 0, 0, 0).scale.multiply(new V3(1, 0.4, 0.4)); sph(g, 0.1, SM.white, 0.28, 0.06, 0); add(g, new THREE.ConeGeometry(0.04, 0.16, 5), SM.yel, 0.42, 0.05, 0).rotation.z = -PI / 2;
  const w = [1, -1].map((s) => { const a = grp(g, 0, 0.05, 0); const b = box(a, 0.3, 0.03, 0.7, SM.grey, 0, 0, s * 0.35); void b; box(a, 0.22, 0.035, 0.22, MT.black, -0.02, 0, s * 0.62); return a; });
  g.userData.w = w; return g;
}
