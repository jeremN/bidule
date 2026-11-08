// Aircraft built in code, all facing +x with the wheels on y = 0. Shared by the airport and the air base.
import * as THREE from 'three';
import { V3 } from './util.js';
import { MT, std, toonMat, grp, add, box, rbox, cylX, cylY, cylZ, rod, sph, ext, shadows, instanced } from './geo.js';
import { tire } from './parts.js';

export const AM = {
  white: std(0xf6f7fb, 0.3, 0.1), grey: std(0xc9ccd8, 0.4, 0.3), dark: std(0x2a2f40, 0.5, 0.2), win: std(0x1f2a44, 0.2, 0.1),
  fan: std(0x3a3f50, 0.4, 0.6), chrome: MT.chrome, metal: std(0xa9b0bd, 0.3, 0.8), line: std(0x8a90a0, 0.5, 0.2),
  glass: std(0x6ab0e0, 0.05, 0.3, { transparent: true, opacity: 0.55, depthWrite: false }), glassO: std(0x5d9fd6, 0.08, 0.5),
  navR: toonMat({ color: 0xff4a3a, emissive: 0xff2010, emissiveIntensity: 1 }), navG: toonMat({ color: 0x4aff7a, emissive: 0x10d040, emissiveIntensity: 1 }),
  navW: toonMat({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 }),
  fr: { b: std(0x1f3f9f, 0.4, 0.1), w: std(0xf4f5f8, 0.4, 0.1), r: std(0xd8302a, 0.4, 0.1) }
};

/** Profile helper: radius at x by linear interpolation of [[x, r], …] (x decreasing). */
const rAt = (prof, x) => {
  for (let i = 0; i < prof.length - 1; i++) { const [x0, r0] = prof[i], [x1, r1] = prof[i + 1]; if (x <= x0 && x >= x1) return r0 + ((r1 - r0) * (x - x0)) / (x1 - x0 || 1); }
  return x > prof[0][0] ? prof[0][1] : prof[prof.length - 1][1];
};
/** A smooth body of revolution along x: prof = [[x, r], …] from nose (+x) to tail (−x). */
export function body(p, prof, m, y = 0, seg = 24) {
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), x)).sort((a, b) => a.y - b.y); // increasing: normals face out
  const g = new THREE.LatheGeometry(pts, seg); g.rotateZ(-Math.PI / 2);
  return add(p, g, m, 0, y, 0);
}
/**
 * A painted patch lying on a body of revolution (windows, doors, stripes, belly paint):
 * between x0 and x1, around the angle phi (0 = +z side, π/2 = underneath, −π/2 = on top), phiW wide.
 */
export function skin(p, prof, x0, x1, phi, phiW, m, y = 0, grow = 1.01, n = 8) {
  const pts = []; for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; pts.push(new THREE.Vector2(rAt(prof, x) * grow + 0.004, x)); }
  if (x0 > x1) pts.reverse();
  const g = new THREE.LatheGeometry(pts, Math.max(3, Math.ceil(phiW * 8)), phi - phiW / 2, phiW); g.rotateZ(-Math.PI / 2);
  return add(p, g, m, 0, y, 0);
}
/** A flat surface (wing, tail) from a planform in the x/z plane, `t` thick, at height y. */
export function plate(p, pts, t, m, y = 0, bevel = 0.03) {
  const g = grp(p, 0, y, 0); g.rotation.x = Math.PI / 2;
  ext(g, pts.map(([x, z]) => [x, z]), bevel, t, m, 0, 0, 0, Math.min(bevel, t * 0.3));
  return g;
}
/** A fin standing up from the x/y profile. */
export function fin(p, pts, t, m, z = 0) { const g = grp(p, 0, 0, z); ext(g, pts, 0.03, t, m, 0, 0, 0, 0.02); return g; }
/** French roundel (blue, white, red) facing +y; rotate the returned group to put it on a side. */
export function roundel(p, r, x, y, z) {
  const g = grp(p, x, y, z); cylY(g, r, 0.012, AM.fr.b, 0, 0, 0, 24); cylY(g, r * 0.66, 0.016, AM.fr.w, 0, 0, 0, 24); cylY(g, r * 0.34, 0.02, AM.fr.r, 0, 0, 0, 20);
  return g;
}
/** Painted text (airline name, registration) on a small plane facing +z. */
export function decal(p, text, w, h, color, x, y, z, bg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round((512 * h) / w); const k = c.getContext('2d');
  if (bg) { k.fillStyle = bg; k.fillRect(0, 0, c.width, c.height); }
  k.fillStyle = color; k.font = `900 ${Math.round(c.height * 0.78)}px system-ui, sans-serif`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(text, 256, c.height * 0.54, 500);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, y, z); p.add(m); return m;
}
/** A door outline painted on both sides of a round body: frame, panel and optionally a little window. */
export function hatch(g, P, Y, x, w, yLo, yHi, frame, panel, win, sides = [1, -1], lift = 0) {
  const r = rAt(P, x), a0 = Math.asin(Math.max(-0.95, Math.min(0.95, -yHi / r))), a1 = Math.asin(Math.max(-0.95, Math.min(0.95, -yLo / r))), wd = a1 - a0;
  sides.forEach((s) => {
    const c = s > 0 ? (a0 + a1) / 2 : Math.PI - (a0 + a1) / 2;
    skin(g, P, x + w / 2 + 0.035, x - w / 2 - 0.035, c, wd + 0.06, frame, Y, 1.006 + lift, 2); skin(g, P, x + w / 2, x - w / 2, c, wd, panel, Y, 1.01 + lift, 2);
    if (win) skin(g, P, x + w * 0.2, x - w * 0.2, s > 0 ? a0 + wd * 0.28 : Math.PI - a0 - wd * 0.28, wd * 0.22, win, Y, 1.014 + lift, 1);
  });
}
const nav = (g, x, y, z) => { sph(g, 0.07, z > 0 ? AM.navG : AM.navR, x, y, z); };
/** Engine nacelle along x (front at +x). Returns { g, fan } — the fan group spins on x. */
function nacelle(p, x, y, z, R, L, m) {
  const n = grp(p, x, y, z);
  body(n, [[L * 0.5, R * 0.86], [L * 0.47, R], [L * 0.25, R * 1.04], [-L * 0.2, R * 0.95], [-L * 0.45, R * 0.78], [-L * 0.5, R * 0.74]], m, 0, 28);
  const lip = add(n, new THREE.TorusGeometry(R * 0.88, R * 0.07, 8, 28), AM.metal, L * 0.5, 0, 0); lip.rotation.y = Math.PI / 2;
  cylX(n, R * 0.84, 0.06, AM.dark, L * 0.42, 0, 0, 24);
  const fan = grp(n, L * 0.45, 0, 0);
  body(fan, [[0.32, 0], [0.2, R * 0.2], [0, R * 0.3], [-0.05, R * 0.3]], AM.metal, 0, 14);
  box(fan, 0.04, 0.05, R * 0.2, AM.white, 0.16, R * 0.16, 0);
  for (let k = 0; k < 14; k++) { const b = grp(fan); b.rotation.x = (k / 14) * Math.PI * 2; const bl = box(b, 0.05, R * 0.55, 0.16, AM.fan, 0, R * 0.55, 0); bl.rotation.y = 0.5; }
  // hot exhaust cone at the back
  body(n, [[-L * 0.5, R * 0.6], [-L * 0.6, R * 0.5], [-L * 0.8, R * 0.08]], AM.metal, 0, 18);
  return { g: n, fan };
}

/**
 * Airliner, ~18.5 long, wingspan ~17. o: { tail: material, stripe: material, name: text }.
 * Returns the group with userData: { gear: [groups], fans: [groups], doors: {front, rear, cargo} (local positions), Y (fuselage centre) }.
 */
export function airliner(parent, o = {}) {
  const g = grp(parent); const W = AM.white, Y = 2.3, tail = o.tail || std(0x2f6fe0, 0.35, 0.2), stripe = o.stripe || tail;
  const P = [[9.2, 0], [9.12, 0.3], [8.9, 0.6], [8.45, 0.88], [7.7, 1.06], [6.6, 1.15], [-3.8, 1.15], [-5.6, 1.0], [-7.4, 0.68], [-8.8, 0.32], [-9.3, 0.14], [-9.4, 0.02]];
  body(g, P, W, Y, 32);
  skin(g, P, 7.0, -8.6, Math.PI / 2, 1.5, AM.grey, Y, 1.004, 12); // grey belly
  [0.22, Math.PI - 0.22].forEach((ph) => { skin(g, P, 8.3, -7.6, ph, 0.12, stripe, Y, 1.008, 14); skin(g, P, 7.9, -7.2, ph - Math.sign(Math.cos(ph)) * 0.16, 0.05, tail, Y, 1.008, 14); });
  skin(g, P, 9.2, 8.6, 0, Math.PI * 2, AM.dark, Y, 1.006, 4); // radome
  // cockpit: windscreen + side windows (glass on the nose, white posts between)
  [-0.2, 0.2].forEach((d) => skin(g, P, 8.5, 7.95, -Math.PI / 2 + d * 1.7, 0.6, AM.win, Y, 1.008, 4));
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(g, P, 7.9, 7.5, b - s * 0.75, 0.32, AM.win, Y, 1.008, 3); skin(g, P, 7.42, 7.1, b - s * 0.62, 0.28, AM.win, Y, 1.008, 3); });
  // windows
  const WIN = new THREE.BoxGeometry(0.2, 0.26, 0.06); const wins = [];
  for (let x = 5.6; x > -5.4; x -= 0.58) if (Math.abs(x + 0.3) > 0.4) [1, -1].forEach((s) => wins.push([x, s]));
  instanced(g, WIN, wins.length, (i, d) => { const [x, s] = wins[i]; d.position.set(x, Y + 0.3, s * 1.115); d.rotation.set(-s * 0.27, 0, 0); d.scale.set(1, 1, 1); return 0x1f2a44; });
  // doors: dark outline, white door, little window — both sides; the cargo door on the right
  hatch(g, P, Y, 6.3, 0.75, -0.75, 0.85, AM.line, W, AM.win); hatch(g, P, Y, -6.2, 0.7, -0.6, 0.75, AM.line, W, AM.win);
  skin(g, P, -2.7, -3.9, 0.58, 0.98, AM.line, Y, 1.006, 3); skin(g, P, -2.73, -3.87, 0.58, 0.94, W, Y, 1.009, 3);
  if (o.name !== false) [1, -1].forEach((s) => { const d = grp(g, 0, 0, 0); if (s < 0) d.rotation.y = Math.PI; const t = decal(d, o.name || 'BIDULE AIR', 3.6, 0.42, '#' + tail.color.getHexString(), s * 2.6, Y + 0.66, 0.96, null); t.rotation.x = -0.6; });
  // wing-to-body fairing, wings, flap fairings, winglets, lights
  const fair = sph(g, 1, W, -0.4, Y - 0.72, 0); fair.scale.set(3.6, 0.55, 1.2);
  const xte = (z) => -2.4 - (Math.abs(z) - 0.9) / 7.7;
  [1, -1].forEach((s) => {
    plate(g, [[1.8, s * 0.9], [-2.3, s * 8.6], [-3.4, s * 8.6], [-2.4, s * 0.9]], 0.22, W, Y - 0.55);
    plate(g, [[xte(1.4) + 0.5, s * 1.4], [xte(7.8) + 0.4, s * 7.8], [xte(7.8) - 0.02, s * 7.8], [xte(1.4) - 0.02, s * 1.4]], 0.24, AM.grey, Y - 0.55);
    plate(g, [[1.75, s * 1.0], [-2.3, s * 8.55], [-2.42, s * 8.55], [1.6, s * 1.0]], 0.25, AM.metal, Y - 0.55, 0.02); // leading edge
    [2.6, 4.8, 6.6].forEach((z) => { const f = sph(g, 1, AM.grey, xte(z) - 0.1, Y - 0.7, s * z); f.scale.set(0.95, 0.12, 0.13); });
    const wl = fin(g, [[0, 0], [0.55, 0], [0.12, 1.2], [-0.12, 1.2]], 0.08, tail, s * 8.62); wl.position.set(-2.9, Y - 0.5, s * 8.62); wl.rotation.x = -s * 0.25;
    nav(g, -2.6, Y - 0.5, s * 8.7);
    const E = nacelle(g, 0.9, Y - 1.25, s * 3.3, 0.6, 2.6, W);
    g.userData.fans = (g.userData.fans || []).concat(E.fan);
    ext(g, [[-0.9, -0.1], [1.4, -0.1], [0.6, 0.6], [-1.6, 0.6]], 0.08, 0.18, W, 0.5, Y - 0.75, s * 3.3, 0.02); // pylon
  });
  // tail: fin with a logo, rudder, tailplanes, APU exhaust, lights
  fin(g, [[-6.0, 0.9], [-7.6, 3.6], [-8.7, 3.6], [-9.0, 0.5]], 0.18, tail).position.y = Y;
  [1, -1].forEach((s) => { const L = grp(g, 0, 0, 0); if (s < 0) L.rotation.y = Math.PI; decal(L, 'B', 0.9, 0.9, '#ffffff', s * -7.85, Y + 2.3, 0.1, null); });
  [1, -1].forEach((s) => plate(g, [[-7.0, s * 0.3], [-8.6, s * 3.2], [-9.2, s * 3.2], [-8.9, s * 0.3]], 0.14, W, Y + 0.25));
  cylX(g, 0.1, 0.2, AM.dark, -9.42, Y, 0, 10);
  sph(g, 0.08, AM.navR, 0, Y + 1.17, 0); sph(g, 0.08, AM.navR, -1, Y - 1.15, 0); sph(g, 0.06, AM.navW, -9.45, Y + 0.05, 0);
  rod(g, new V3(4, Y + 1.12, 0), new V3(3.6, Y + 1.5, 0), 0.03, AM.dark, 4); // antenna
  // landing gear: nose (2 wheels) and two 4-wheel bogies
  const gear = [];
  const leg = (x, z, bog) => {
    const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.85, 0), new V3(0, 0.45, 0), 0.09, AM.chrome, 8); rod(lg, new V3(0, Y - 0.85, 0), new V3(0, 1.0, 0), 0.13, AM.grey, 8);
    rod(lg, new V3(0.05, 1.0, 0.05), new V3(0.25, 0.7, 0.05), 0.03, AM.grey, 4);
    if (bog) { box(lg, 1.0, 0.1, 0.12, AM.grey, 0, 0.45, 0); [0.36, -0.36].forEach((dx) => [0.2, -0.2].forEach((dz) => tire(lg, 0.4, 0.26, dx, 0.4, dz, AM.grey, Math.sign(dz)))); }
    else [0.18, -0.18].forEach((dz) => tire(lg, 0.36, 0.24, 0, 0.36, dz, AM.grey, Math.sign(dz)));
    gear.push(lg); return lg;
  };
  leg(6.6, 0, false); leg(-0.9, 1.6, true); leg(-0.9, -1.6, true);
  g.userData.gear = gear; g.userData.Y = Y;
  g.userData.doors = { front: new V3(6.3, Y, 1.15), rear: new V3(-6.2, Y, 1.0), cargo: new V3(-3.3, Y - 0.55, 1.15) };
  shadows(g); return g;
}

/** Little high-wing propeller plane (~6 long). userData.prop spins. */
export function propPlane(parent, color) {
  const g = grp(parent); const c = std(color || 0xe5452c, 0.35, 0.2), W = AM.white, Y = 1.1;
  const P = [[3.0, 0.28], [2.9, 0.42], [2.4, 0.56], [1.2, 0.64], [-0.6, 0.56], [-2.6, 0.22], [-3.3, 0.1]];
  body(g, P, W, Y, 24);
  skin(g, P, 3.0, 1.9, 0, Math.PI * 2, c, Y, 1.006, 4); // painted cowling
  [0.25, Math.PI - 0.25].forEach((ph) => skin(g, P, 1.9, -3.1, ph, 0.14, c, Y, 1.008, 10));
  skin(g, P, 1.55, 1.1, -Math.PI / 2, 1.9, AM.glassO, Y, 1.02, 3); // windscreen
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(g, P, 1.05, 0.15, b - s * 0.6, 0.55, AM.win, Y, 1.01, 3); skin(g, P, 0.0, -0.6, b - s * 0.55, 0.45, AM.win, Y, 1.01, 3); skin(g, P, 1.1, 0.1, b + s * 0.05, 0.9, AM.line, Y, 1.003, 3); });
  [1, -1].forEach((s) => { const d = grp(g); if (s < 0) d.rotation.y = Math.PI; const t = decal(d, 'F-BIDU', 1.4, 0.26, '#2a2f40', s * -1.6, Y + 0.02, 0.43, null); t.rotation.x = -0.1; });
  cylZ(g, 0.04, 0.22, AM.metal, 2.3, Y - 0.38, 0.3, 6); // exhaust
  plate(g, [[1.2, -4.6], [1.3, 4.6], [0.3, 4.6], [0.2, -4.6]], 0.12, W, Y + 0.62);
  [1, -1].forEach((s) => {
    rbox(g, 1.1, 0.13, 0.5, 0.03, c, 0.7, Y + 0.64, s * 4.4, 0.02); nav(g, 0.75, Y + 0.64, s * 4.68);
    plate(g, [[0.38, s * 1.4], [0.42, s * 3.4], [0.22, s * 3.4], [0.2, s * 1.4]], 0.13, AM.grey, Y + 0.62, 0.02); // flaps
    rod(g, new V3(0.6, Y - 0.3, s * 0.45), new V3(0.7, Y + 0.6, s * 2.0), 0.03, AM.grey);
  });
  fin(g, [[-2.0, 0.3], [-2.9, 1.5], [-3.3, 1.5], [-3.3, 0.1]], 0.1, c).position.y = Y;
  plate(g, [[-2.5, -1.4], [-2.6, 1.4], [-3.2, 1.4], [-3.2, -1.4]], 0.08, W, Y + 0.1);
  sph(g, 0.06, AM.navR, -3.3, Y + 1.5, 0);
  const prop = grp(g, 3.02, Y, 0); body(prop, [[0.36, 0], [0.2, 0.12], [0, 0.18], [-0.02, 0.18]], c, 0, 14);
  [0, 1].forEach((k) => { const h = grp(prop); h.rotation.x = k * Math.PI; const b = rbox(h, 0.05, 0.75, 0.13, 0.04, AM.dark, 0, 0.42, 0, 0.01); b.rotation.y = 0.35; box(h, 0.052, 0.08, 0.13, std(0xf2c21c, 0.4, 0.1), 0, 0.76, 0).rotation.y = 0.35; });
  const gear = [];
  [[1.8, 0], [-0.1, 0.8], [-0.1, -0.8]].forEach(([x, z]) => {
    const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.4, z ? -z * 0.4 : 0), new V3(0, 0.25, 0), 0.04, AM.grey);
    tire(lg, 0.25, 0.14, 0, 0.25, 0, AM.grey); const sp = sph(lg, 1, c, 0.03, 0.3, 0); sp.scale.set(0.38, 0.2, 0.11); // wheel spat
    gear.push(lg);
  });
  g.userData.prop = prop; g.userData.gear = gear; g.userData.Y = Y;
  shadows(g); return g;
}

/** Fighter jet (Rafale-like, ~11 long). userData: { gear, nozzle (anchor at the exhaust), burner (material) } */
export function fighter(parent, col = 0x8a94a6) {
  const g = grp(parent); const M = std(col, 0.35, 0.3), D = std(0x5a6274, 0.4, 0.3), Y = 1.5;
  const P = [[6.1, 0], [5.6, 0.14], [5.0, 0.24], [3.6, 0.5], [1.5, 0.7], [-2.5, 0.75], [-4.6, 0.62], [-5.1, 0.55]];
  body(g, P, M, Y, 28);
  skin(g, P, 6.1, 5.3, 0, Math.PI * 2, D, Y, 1.006, 3); // radome
  rod(g, new V3(6.05, Y, 0), new V3(6.7, Y, 0), 0.025, AM.metal, 6); // pitot
  rod(g, new V3(4.4, Y + 0.38, 0.32), new V3(5.4, Y + 0.32, 0.18), 0.04, D, 6); // refuelling probe
  // spine and canopy with its frame, the pilot inside
  const sp = sph(g, 1, M, -0.5, Y + 0.45, 0); sp.scale.set(3.6, 0.42, 0.42);
  const can = sph(g, 1, AM.glass, 2.75, Y + 0.48, 0); can.scale.set(1.5, 0.44, 0.42);
  const fr = add(g, new THREE.TorusGeometry(0.44, 0.04, 6, 16, Math.PI), D, 2.2, Y + 0.48, 0); fr.rotation.y = Math.PI / 2; fr.scale.set(1, 1, 1);
  sph(g, 0.17, AM.white, 2.6, Y + 0.6, 0); sph(g, 0.12, AM.win, 2.72, Y + 0.6, 0).scale.set(0.7, 0.7, 1.1);
  // air intakes under the wing roots
  [1, -1].forEach((s) => {
    ext(g, [[1.5, -0.3], [-1.6, -0.3], [-1.6, 0.25], [1.1, 0.25]], 0.1, 0.5, M, 0, Y - 0.25, s * 0.72, 0.03);
    box(g, 0.05, 0.42, 0.38, AM.dark, 1.42, Y - 0.27, s * 0.72);
  });
  // delta wing with darker elevons, canards, wing-tip rails, roundels
  plate(g, [[1.2, 0.5], [-3.8, 4.6], [-4.8, 4.6], [-4.6, 0.5], [-4.6, -0.5], [-4.8, -4.6], [-3.8, -4.6], [1.2, -0.5]], 0.14, M, Y - 0.15);
  [1, -1].forEach((s) => {
    plate(g, [[-4.15, s * 0.9], [-4.35, s * 4.4], [-4.82, s * 4.4], [-4.62, s * 0.9]], 0.15, D, Y - 0.15, 0.02);
    rbox(g, 1.7, 0.1, 0.1, 0.04, AM.metal, -4.0, Y - 0.12, s * 4.62, 0.02); nav(g, -3.6, Y - 0.12, s * 4.7);
    roundel(g, 0.45, -3.5, Y - 0.06, s * 2.6);
    const r2 = roundel(g, 0.3, -3.0, Y + 0.1, s * 0.76); r2.rotation.x = s * Math.PI / 2;
    // drop tank on a pylon
    rbox(g, 0.8, 0.3, 0.06, 0.03, D, -1.6, Y - 0.38, s * 2.2, 0.01);
    body(g, [[-0.4, 0], [-0.8, 0.18], [-1.6, 0.22], [-2.6, 0.18], [-3.1, 0]], AM.grey, Y - 0.62, 14).position.z = s * 2.2;
  });
  plate(g, [[3.4, 0.4], [2.4, 1.6], [2.0, 1.6], [2.2, 0.4], [2.2, -0.4], [2.0, -1.6], [2.4, -1.6], [3.4, -0.4]], 0.08, D, Y + 0.05);
  // fin with the French flag, twin nozzles with afterburner
  fin(g, [[-2.4, 0.5], [-4.4, 2.8], [-5.0, 2.8], [-5.0, 0.4]], 0.12, M).position.y = Y;
  [[AM.fr.b, -4.15], [AM.fr.w, -4.4], [AM.fr.r, -4.65]].forEach(([m, x]) => box(g, 0.25, 0.5, 0.135, m, x, Y + 1.9, 0));
  sph(g, 0.05, AM.navW, -5.0, Y + 2.8, 0);
  const burner = std(0x3a3f50, 0.3, 0, { emissive: 0xff6a10, emissiveIntensity: 0 });
  [0.3, -0.3].forEach((z) => {
    const nz = grp(g, -5.2, Y, z); body(nz, [[0.2, 0.3], [-0.1, 0.3], [-0.45, 0.26]], std(0x3a3f50, 0.4, 0.7), 0, 16);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(nz, 0.3, 0.012, 0.06, AM.metal, -0.3, Math.cos(a) * 0.27, Math.sin(a) * 0.27).rotation.x = a; }
    cylX(nz, 0.22, 0.04, burner, -0.35, 0, 0, 16); cylX(nz, 0.23, 0.04, AM.dark, -0.1, 0, 0, 16);
  });
  const nozzle = grp(g, -5.8, Y, 0);
  const gear = [];
  [[3.4, 0, 2], [-1.2, 1.1, 1], [-1.2, -1.1, 1]].forEach(([x, z, n]) => {
    const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.6, 0), new V3(0, 0.3, 0), 0.05, AM.chrome, 6); rod(lg, new V3(0, Y - 0.6, 0), new V3(0, 0.7, 0), 0.08, AM.grey, 6);
    if (n === 2) [0.12, -0.12].forEach((dz) => tire(lg, 0.24, 0.14, 0, 0.24, dz, AM.grey, Math.sign(dz))); else tire(lg, 0.3, 0.2, 0, 0.3, 0, AM.grey);
    box(lg, 0.6, 0.5, 0.03, M, 0, Y - 0.85, (z ? Math.sign(z) : 1) * 0.2); // gear door
    gear.push(lg);
  });
  g.userData = { gear, nozzle, burner, Y };
  shadows(g); return g;
}

/** Big transport plane with four propellers and a rear ramp (A400M-like, ~20 long). userData: { props, ramp (group, rotation.z opens), gear, Y } */
export function transport(parent, col = 0x7a8a6a) {
  const g = grp(parent); const M = std(col, 0.45, 0.2), D = std(0x4a5444, 0.5, 0.2), Y = 2.6;
  const P = [[9.8, 0.05], [9.6, 0.7], [9.0, 1.15], [8.2, 1.5], [6.5, 1.75], [-4.5, 1.75], [-6.8, 1.4]];
  body(g, P, M, Y, 30);
  [-0.32, 0.32].forEach((d) => skin(g, P, 9.25, 8.6, -Math.PI / 2 + d * 1.25, 0.36, AM.win, Y, 1.01, 3));
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(g, P, 8.55, 8.1, b - s * 0.78, 0.4, AM.win, Y, 1.01, 3); skin(g, P, 8.0, 7.6, b - s * 0.7, 0.36, AM.win, Y, 1.01, 3); });
  rod(g, new V3(8.4, Y + 1.5, 0), new V3(10.2, Y + 1.2, 0), 0.06, D, 6); // refuelling probe
  hatch(g, P, Y, -4.0, 0.85, -1.0, 0.6, D, M, AM.win); hatch(g, P, Y, 7.0, 0.8, -1.1, 0.4, D, M, null);
  // troop doors, portholes, roundels
  [1, -1].forEach((s) => {
    const sd = grp(g); if (s < 0) sd.rotation.y = Math.PI;
    [5.5, 3.0, 0.5, -2.0].forEach((x) => { const w = cylZ(sd, 0.13, 0.06, AM.win, s * x, Y + 0.3, 1.72, 12); void w; });
    const r = roundel(sd, 0.55, s * -2.9, Y + 0.6, 1.66); r.rotation.x = Math.PI / 2 - 0.35;
  });
  const ramp = grp(g, -6.6, Y - 1.4, 0); rbox(ramp, 4.4, 0.18, 2.6, 0.05, D, -2.2, 0, 0, 0.02); ext(ramp, [[0, 0], [-4.3, 0], [-4.3, 0.3], [0, 2.7]], 0.05, 0.12, M, 0, 0, 1.3, 0.02); ext(ramp, [[0, 0], [-4.3, 0], [-4.3, 0.3], [0, 2.7]], 0.05, 0.12, M, 0, 0, -1.3, 0.02);
  for (let x = -0.5; x > -4.2; x -= 0.45) box(ramp, 0.05, 0.03, 2.4, AM.metal, x, 0.1, 0);
  const roof = grp(g, -6.6, Y + 1.4, 0); body(roof, [[0.2, 1.6], [-3.6, 1.0], [-6.0, 0.35]], M, 0); roof.children[0].scale.y = 0.55;
  ramp.rotation.z = 0.56;
  // high wing with flap fairings and lights
  plate(g, [[1.6, -12], [2.2, 12], [-0.6, 12], [-0.9, -12]], 0.3, M, Y + 1.6);
  [1, -1].forEach((s) => { plate(g, [[-0.35, s * 1.8], [-0.1, s * 11.5], [-0.62, s * 11.5], [-0.9, s * 1.8]], 0.32, D, Y + 1.6, 0.02); nav(g, 0.8, Y + 1.6, s * 12.05); [5.5, 9.4].forEach((z) => { const f = sph(g, 1, D, -0.7, Y + 1.4, s * z); f.scale.set(1.0, 0.16, 0.16); }); });
  const fair = sph(g, 1, M, 0.6, Y + 1.5, 0); fair.scale.set(3.6, 0.45, 1.3);
  const props = [];
  [-7.4, -3.6, 3.6, 7.4].forEach((z) => {
    const n = grp(g, 2.4, Y + 1.3, z);
    body(n, [[0.8, 0.42], [0.2, 0.55], [-1.6, 0.52], [-2.8, 0.3], [-3.2, 0.08]], M, 0, 18);
    cylZ(n, 0.1, 0.4, AM.dark, -0.8, -0.2, (z > 0 ? 1 : -1) * 0.55, 8); // exhaust
    const p = grp(n, 0.95, 0, 0); body(p, [[0.75, 0], [0.4, 0.22], [0, 0.34], [-0.1, 0.34]], D, 0, 16);
    for (let k = 0; k < 8; k++) { const h = grp(p); h.rotation.x = (k / 8) * Math.PI * 2; const b = ext(h, [[-0.12, 0.3], [0.12, 0.3], [0.2, 1.6], [0.02, 2.55], [-0.1, 2.5], [-0.08, 1.4]], 0.04, 0.06, D, 0, 0, 0, 0.01); b.rotation.y = Math.PI / 2 - 0.4; }
    props.push(p);
  });
  // T-tail with the French flag
  fin(g, [[-6.0, 1.4], [-8.2, 6.6], [-10.4, 6.6], [-11.4, 1.0]], 0.24, M).position.y = Y;
  plate(g, [[-9.0, -5.2], [-8.6, 5.2], [-10.6, 5.2], [-10.8, -5.2]], 0.2, M, Y + 6.4);
  [[AM.fr.b, -8.9], [AM.fr.w, -9.35], [AM.fr.r, -9.8]].forEach(([m, x]) => box(g, 0.45, 0.9, 0.26, m, x, Y + 4.6, 0));
  sph(g, 0.1, AM.navR, 0, Y + 1.76, 0);
  // sponsons for the main gear
  [1, -1].forEach((s) => rbox(g, 5, 1.2, 0.9, 0.3, M, 0.2, 0.9, s * 1.9, 0.04));
  const gear = [];
  [[7.4, 0, 2], [1.4, 1.9, 1], [0.2, 1.9, 1], [-1.0, 1.9, 1], [1.4, -1.9, 1], [0.2, -1.9, 1], [-1.0, -1.9, 1]].forEach(([x, z, n]) => {
    const lg = grp(g, x, 0, z);
    if (n === 2) { rod(lg, new V3(0, 1.4, 0), new V3(0, 0.45, 0), 0.08, AM.chrome, 6); [0.2, -0.2].forEach((dz) => tire(lg, 0.44, 0.3, 0, 0.44, dz, AM.grey, Math.sign(dz))); }
    else tire(lg, 0.46, 0.34, 0, 0.46, 0, AM.grey, Math.sign(z));
    gear.push(lg);
  });
  g.userData = { props, ramp, gear, Y };
  shadows(g); return g;
}

/** Transport helicopter (NH90-like, ~13 long with the tail). userData: { rotor, tail } */
export function helicopter(parent, col = 0x6a7a52) {
  const g = grp(parent); const M = std(col, 0.45, 0.2), D = std(0x3a4232, 0.5, 0.2), Y = 1.9;
  const P = [[3.4, 0.05], [3.25, 0.55], [2.9, 0.95], [2.2, 1.18], [0.5, 1.3], [-1.6, 1.25], [-2.8, 0.7], [-7.6, 0.28], [-8.0, 0.2]];
  body(g, P, M, Y, 28);
  // big glazed nose (see-through, with the pilots inside) and posts
  [-0.45, 0.45].forEach((d) => skin(g, P, 3.25, 2.55, -Math.PI / 2 + d, 0.8, AM.glassO, Y, 1.01, 4));
  [[0, 1], [Math.PI, -1]].forEach(([b, s]) => { skin(g, P, 3.2, 2.35, b - s * 0.15, 0.9, AM.glassO, Y, 1.01, 4); skin(g, P, 3.3, 2.4, b + s * 0.42, 0.45, AM.glassO, Y, 1.01, 4); skin(g, P, 2.2, 1.55, b - s * 0.3, 0.7, AM.win, Y, 1.01, 3); });
  hatch(g, P, Y, 0.3, 2.0, -0.8, 0.7, D, M, null);
  [0.65, -0.1].forEach((x) => hatch(g, P, Y, x, 0.6, 0.05, 0.5, D, AM.win, null, [1, -1], 0.01));
  // side cargo doors with windows
  [1, -1].forEach((s) => {
    const sd = grp(g); if (s < 0) sd.rotation.y = Math.PI;
    box(sd, 2.2, 0.05, 0.08, AM.metal, s * 0.3, Y + 0.78, 1.08); // door rail
    const r = roundel(sd, 0.3, s * -5.0, Y + 0.1, 0.42); r.rotation.x = Math.PI / 2;
  });
  // engine housing with intakes and exhausts, the rotor mast
  rbox(g, 2.8, 0.65, 1.6, 0.25, M, -0.6, Y + 1.3, 0, 0.03);
  [1, -1].forEach((s) => { cylX(g, 0.2, 0.2, AM.dark, 0.85, Y + 1.35, s * 0.5, 12); cylX(g, 0.16, 0.5, D, -2.1, Y + 1.4, s * 0.62, 10); rbox(g, 1.2, 0.3, 0.04, 0.03, D, -0.6, Y + 1.25, s * 0.81, 0.01); });
  sph(g, 0.22, D, 3.0, Y - 0.85, 0); sph(g, 0.1, AM.win, 3.15, Y - 0.88, 0); // camera ball
  // tail: fin, small wing, light
  fin(g, [[-6.8, 0.2], [-7.6, 2.0], [-8.2, 2.0], [-8.1, 0.0]], 0.12, M).position.y = Y;
  plate(g, [[-6.6, -1.0], [-6.5, 1.0], [-7.0, 1.0], [-7.1, -1.0]], 0.07, M, Y + 0.25);
  sph(g, 0.06, AM.navW, -8.1, Y + 0.1, 0); sph(g, 0.08, AM.navR, -1.4, Y + 1.66, 0);
  [1, -1].forEach((s) => nav(g, 0.2, Y - 0.8, s * 1.32));
  // wheels: two in the sponsons, two under the nose
  [1, -1].forEach((s) => { const sp = rbox(g, 1.8, 0.5, 0.5, 0.2, M, -0.9, 0.85, s * 1.25, 0.02); void sp; tire(g, 0.32, 0.22, -0.9, 0.32, s * 1.25, D, s); rod(g, new V3(-0.9, 0.32, s * 1.25), new V3(-0.9, 0.7, s * 1.25), 0.05, AM.chrome, 6); });
  rod(g, new V3(2.2, Y - 1.0, 0), new V3(2.2, 0.25, 0), 0.05, AM.chrome, 6); [0.12, -0.12].forEach((dz) => tire(g, 0.25, 0.14, 2.2, 0.25, dz, D, Math.sign(dz)));
  // main rotor with its hub, tail rotor
  const rotor = grp(g, -0.6, Y + 1.9, 0); cylY(rotor, 0.12, 0.5, AM.metal, 0, -0.2, 0, 10); cylY(rotor, 0.32, 0.18, D, 0, 0.05, 0, 12);
  for (let k = 0; k < 4; k++) { const b = grp(rotor); b.rotation.y = (k / 4) * Math.PI * 2; box(b, 0.7, 0.1, 0.16, AM.metal, 0.45, 0.06, 0); rbox(b, 5.8, 0.05, 0.36, 0.05, D, 3.6, 0.1, 0, 0.01); box(b, 0.3, 0.052, 0.36, std(0xf2c21c, 0.4, 0.1), 6.35, 0.1, 0); }
  sph(rotor, 0.2, D, 0, 0.22, 0).scale.y = 0.6;
  const tail = grp(g, -7.7, Y + 1.5, 0.22); cylZ(tail, 0.1, 0.12, AM.metal, 0, 0, 0, 8);
  for (let k = 0; k < 4; k++) { const b = grp(tail); box(b, 0.08, 1.2, 0.14, D, 0, 0.6, 0); b.rotation.z = (k / 4) * Math.PI * 2; }
  g.userData = { rotor, tail, Y };
  shadows(g); return g;
}
