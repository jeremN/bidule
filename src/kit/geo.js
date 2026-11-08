// Materials and geometry primitives shared by every world.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { V3, rad, pick } from './util.js';

/* ---------- flat colors (Lambert, for scenery) ---------- */
export const C = {
  yel: 0xf4b42a, yelD: 0xd88f14, dark: 0x2b3040, darker: 0x1d2130, steel: 0x9aa4b6, chrome: 0xd6dde8,
  blue: 0x4f72f2, blueD: 0x3553c4, orange: 0xf06a2a, orangeD: 0xc9501c, red: 0xe5452c, white: 0xeef0f6,
  concrete: 0xb4b6c2, wet: 0x7f8394, dirt: 0xa8653a, dirtD: 0x7b4527, wood: 0xb98345, brick: 0xd2593a,
  brick2: 0xb94a31, asphalt: 0x2a2e3d, wheat: 0xe9b52f, wheatD: 0xc4902a, straw: 0xe8cf7a, leaf: 0x4c9a36
};

export const UB = new THREE.BoxGeometry(1, 1, 1);
export const ICO = new THREE.IcosahedronGeometry(1, 1); // rounder blobs: trees, bushes, rocks look softer (cartoon)
export const dummy = new THREE.Object3D();
export const tmpCol = new THREE.Color();

/* ---------- cartoon shading: three flat tones of light ---------- */
const TOON = (() => { const d = new Uint8Array([112, 182, 228, 240]); const t = new THREE.DataTexture(d, 4, 1, THREE.LuminanceFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
/** All materials go through here: a toon material (PBR-only options are dropped). */
export function toonMat(o = {}) {
  const p = Object.assign({}, o); delete p.roughness; delete p.metalness; delete p.envMapIntensity;
  return new THREE.MeshToonMaterial(Object.assign({ gradientMap: TOON }, p));
}
const MC = {};
export function mat(c) {
  if (typeof c === 'object') return c;
  if (!MC[c]) MC[c] = toonMat({ color: c });
  return MC[c];
}

/* ---------- PBR materials (machines) ---------- */
export function std(c, r, m, o) {
  return toonMat(Object.assign({ color: c }, o || {}));
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export const treadTex = canvasTex(64, 16, (x) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#000';
  for (let i = 0; i < 64; i += 8) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 4, 0); x.lineTo(i + 7, 8); x.lineTo(i + 4, 16); x.lineTo(i, 16); x.lineTo(i + 3, 8); x.closePath(); x.fill();
  }
});
treadTex.repeat.set(5, 1);
export const stripeTex = canvasTex(64, 64, (x) => {
  x.fillStyle = '#f2b01e'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#1d1f26';
  for (let i = -64; i < 128; i += 32) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 16, 64); x.lineTo(i + 80, 0); x.lineTo(i + 64, 0); x.closePath(); x.fill(); }
});
export const brickTex = canvasTex(128, 64, (x) => {
  x.fillStyle = '#d8cfc6'; x.fillRect(0, 0, 128, 64);
  for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
    const ox = row % 2 ? 16 : 0;
    x.fillStyle = pick(['#c4502f', '#b84529', '#cf5d36', '#a9402a']);
    x.fillRect(col * 32 + ox + 1, row * 8 + 1, 30, 6);
  }
});
export const MT = {
  yel: std(0xf2ae1c, 0.38, 0.18), yelD: std(0xcf8a12, 0.5, 0.25), dark: std(0x343846, 0.5, 0.4),
  black: std(0x1d1f26, 0.6, 0.3), shoe: std(0x30323b, 0.55, 0.65), steel: std(0x8d96a6, 0.32, 0.8),
  chrome: std(0xe3e8f0, 0.1, 1),
  rubber: std(0x17181d, 0.88, 0, { bumpMap: treadTex, bumpScale: 0.035 }),
  rubberS: std(0x17181d, 0.88, 0),
  glass: std(0x9fd2ef, 0.04, 0.5, { transparent: true, opacity: 0.36, depthWrite: false }),
  glassD: std(0x2a3f58, 0.06, 0.7),
  red: std(0xd8402a, 0.42, 0.25), white: std(0xf1f2f5, 0.32, 0.12), blue: std(0x3b61e6, 0.32, 0.25),
  orange: std(0xee6a26, 0.4, 0.18), orangeD: std(0xc8521c, 0.5, 0.2), grey: std(0xc2c5ce, 0.55, 0.15),
  concrete: std(0xb7b9c3, 0.9, 0), skin: std(0xf0c39a, 0.65, 0), vest: std(0xff8f1f, 0.7, 0),
  refl: std(0xe8eef5, 0.25, 0.6), pants: std(0x2f4a8a, 0.8, 0), hat: std(0xffd23a, 0.4, 0.05),
  wood: std(0xb98345, 0.85, 0), brick: std(0xffffff, 0.85, 0, { map: brickTex }),
  stripes: std(0xffffff, 0.5, 0.1, { map: stripeTex }),
  lamp: toonMat({ color: 0xfff3c8, emissive: 0xffe6a0, emissiveIntensity: 1.2 }),
  amber: toonMat({ color: 0xffa53a, emissive: 0xff8a1a, emissiveIntensity: 0.8 }),
  tail: toonMat({ color: 0xff4a3a, emissive: 0xd8201a, emissiveIntensity: 0.8 })
};

/* ---------- primitives ---------- */
export function add(p, geo, c, x, y, z) {
  const m = new THREE.Mesh(geo, mat(c)); m.position.set(x || 0, y || 0, z || 0); p.add(m); return m;
}
export function box(p, w, h, d, c, x, y, z) { const m = add(p, UB, c, x, y, z); m.scale.set(w, h, d); return m; }
export function grp(p, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); p.add(g); return g; }
const CG = {};
export function cylGeo(seg) { if (!CG[seg]) CG[seg] = new THREE.CylinderGeometry(1, 1, 1, seg); return CG[seg]; }
export function cylY(p, r, h, c, x, y, z, seg) { const m = add(p, cylGeo(seg || 16), c, x, y, z); m.scale.set(r, h, r); return m; }
export function cylZ(p, r, len, c, x, y, z, seg) {
  const g = grp(p, x, y, z); const m = add(g, cylGeo(seg || 16), c); m.rotation.x = Math.PI / 2; m.scale.set(r, len, r); return g;
}
export function cylX(p, r, len, c, x, y, z, seg) {
  const g = grp(p, x, y, z); const m = add(g, cylGeo(seg || 16), c); m.rotation.z = Math.PI / 2; m.scale.set(r, len, r); return g;
}
export function beam(p, a, b, t, c) {
  const d = new V3().subVectors(b, a), L = d.length(); const m = add(p, UB, c);
  m.scale.set(t, L, t); m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); return m;
}
export function rod(p, a, b, r, m, seg) {
  const d = new V3().subVectors(b, a), L = d.length(); const mm = add(p, cylGeo(seg || 8), m);
  mm.scale.set(r, L, r); mm.position.copy(a).addScaledVector(d, 0.5);
  mm.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize()); return mm;
}
export function rail(p, pts, r, m) { for (let i = 0; i < pts.length - 1; i++) rod(p, new V3(...pts[i]), new V3(...pts[i + 1]), r || 0.025, m || MT.yel); }
export function sph(p, r, m, x, y, z) { const s = add(p, new THREE.SphereGeometry(1, 14, 10), m, x, y, z); s.scale.setScalar(r); return s; }
export function anchor(p, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); p.add(o); return o; }
export const arc = (cx, cy, R, a0, a1, n) => {
  const o = []; for (let i = 0; i <= n; i++) { const a = rad(a0 + ((a1 - a0) * i) / n); o.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } return o;
};

/** Polygon with rounded corners (r = number or per-corner array). */
export function rshape(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], rr = Array.isArray(r) ? r[i] : r;
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const k = Math.min(rr, da / 2, db / 2);
    const p1 = [p[0] + ((a[0] - p[0]) / da) * k, p[1] + ((a[1] - p[1]) / da) * k];
    const p2 = [p[0] + ((b[0] - p[0]) / db) * k, p[1] + ((b[1] - p[1]) / db) * k];
    if (i === 0) s.moveTo(p1[0], p1[1]); else s.lineTo(p1[0], p1[1]);
    if (k > 0) s.quadraticCurveTo(p[0], p[1], p2[0], p2[1]);
  }
  s.closePath(); return s;
}
/** Side profile (x,y) extruded along z, centered, with bevel. */
export function ext(p, pts, r, depth, m, x, y, z, bev) {
  const b = bev == null ? 0.025 : bev;
  const g = new THREE.ExtrudeGeometry(rshape(pts, r), {
    depth: Math.max(0.002, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5
  });
  g.translate(0, 0, -Math.max(0.002, depth - 2 * b) / 2);
  return add(p, g, m, x, y, z);
}
/** Rounded box. */
export function rbox(p, w, h, d, r, m, x, y, z, bev) {
  const b = bev == null ? Math.min(0.025, w / 4, h / 4, d / 4) : bev;
  const W = w / 2 - b, H = h / 2 - b;
  return ext(p, [[-W, -H], [W, -H], [W, H], [-W, H]], Math.max(0, r - b), d, m, x, y, z, b);
}
/** Plan shape (x,z) extruded vertically, centered on y. */
export function extY(p, pts, r, h, m, x, y, z, bev) {
  const b = bev == null ? 0.03 : bev;
  const g = new THREE.ExtrudeGeometry(rshape(pts.map((q) => [q[0], -q[1]]), r), {
    depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6
  });
  g.translate(0, 0, -(h - 2 * b) / 2); g.rotateX(-Math.PI / 2);
  return add(p, g, m, x, y, z);
}
export function gearShape(ro, ri, n) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? ri : ro, h = (Math.PI / (n * 2)) * 0.5;
    const p1 = [Math.cos(a - h) * rr, Math.sin(a - h) * rr], p2 = [Math.cos(a + h) * rr, Math.sin(a + h) * rr];
    if (i === 0) s.moveTo(p1[0], p1[1]); else s.lineTo(p1[0], p1[1]);
    s.lineTo(p2[0], p2[1]);
  }
  s.closePath(); return s;
}

export function shadows(o) {
  o.traverse((n) => { if (n.isMesh) { n.castShadow = !(n.material && n.material.transparent); n.receiveShadow = true; } });
}
export function instanced(parent, geo, count, place) {
  const m = new THREE.InstancedMesh(geo, toonMat({ color: 0xffffff }), count);
  for (let i = 0; i < count; i++) {
    const c = place(i, dummy); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, tmpCol.setHex(c));
  }
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const PILE = new THREE.ConeGeometry(1.5, 1.2, 9, 1); PILE.translate(0, 0.6, 0);
export function pile(p, x, z, s, color) { const m = add(p, PILE, color || C.dirt, x, 0, z); m.scale.setScalar(s); return m; }
export const wp = (o, y) => { const v = o.getWorldPosition(new V3()); if (y) v.y += y; return v; };

/**
 * Merge every still mesh under `root` into one mesh per material (fewer draw calls, much faster on tablets).
 * Subtrees marked userData.dynamic, instanced meshes, multi-material meshes and meshes with children are left alone.
 */
export function freeze(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), m = new THREE.Matrix4();
  const buckets = new Map(), done = [];
  const walk = (o) => {
    if (o.userData && o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.children.length === 0 && o.geometry && o.visible) {
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      let b = buckets.get(key); if (!b) { b = { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] }; buckets.set(key, b); }
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const out = new THREE.BufferGeometry(); out.setAttribute('position', g.attributes.position);
      out.setAttribute('normal', g.attributes.normal || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
      out.setAttribute('uv', g.attributes.uv || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      out.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)); b.geos.push(out); done.push(o);
    }
    o.children.slice().forEach(walk);
  };
  walk(root);
  done.forEach((o) => o.parent.remove(o));
  buckets.forEach((b) => {
    const g = BufferGeometryUtils.mergeBufferGeometries(b.geos); if (!g) return;
    const mesh = new THREE.Mesh(g, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; root.add(mesh);
  });
  return root;
}
