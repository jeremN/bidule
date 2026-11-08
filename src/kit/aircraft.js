// Aircraft built in code, all facing +x with the wheels on y = 0. Shared by the airport and the air base.
import * as THREE from 'three';
import { V3 } from './util.js';
import { MT, std, grp, add, box, rbox, cylX, cylY, cylZ, rod, sph, ext, shadows, instanced } from './geo.js';
import { tire } from './parts.js';

export const AM = {
  white: std(0xf6f7fb, 0.3, 0.1), grey: std(0xc9ccd8, 0.4, 0.3), dark: std(0x2a2f40, 0.5, 0.2), win: std(0x1f2a44, 0.2, 0.1),
  fan: std(0x3a3f50, 0.4, 0.6), chrome: MT.chrome
};

/** A smooth body of revolution along x: prof = [[x, r], …] from nose (+x) to tail (−x). */
export function body(p, prof, m, y = 0, seg = 24) {
  const pts = prof.map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), x));
  const g = new THREE.LatheGeometry(pts, seg); g.rotateZ(-Math.PI / 2);
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

/**
 * Airliner, ~18 long, wingspan ~17. o: { tail: material, stripe: material }.
 * Returns the group with userData: { gear: [groups], fans: [meshes], doors: {front, rear, cargo} (local positions), Y (fuselage centre) }.
 */
export function airliner(parent, o = {}) {
  const g = grp(parent); const W = AM.white, Y = 2.3, tail = o.tail || std(0x2f6fe0, 0.35, 0.2), stripe = o.stripe || tail;
  body(g, [[9.1, 0], [8.9, 0.45], [8.4, 0.82], [7.6, 1.05], [6.6, 1.15], [-3.8, 1.15], [-6.0, 0.95], [-8.0, 0.55], [-9.2, 0.18]], W, Y);
  box(g, 15.6, 0.16, 2.33, stripe, -0.2, Y - 0.25, 0);
  // windows and cockpit
  const WIN = new THREE.BoxGeometry(0.22, 0.26, 0.05); const wins = [];
  for (let x = 5.6; x > -5.4; x -= 0.6) [1, -1].forEach((s) => wins.push([x, s]));
  instanced(g, WIN, wins.length, (i, d) => { const [x, s] = wins[i]; d.position.set(x, Y + 0.3, s * 1.14); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); return 0x1f2a44; });
  [1, -1].forEach((s) => { const c = box(g, 0.55, 0.3, 0.05, AM.win, 7.75, Y + 0.45, s * 0.86); c.rotation.y = -s * 0.5; });
  box(g, 0.05, 0.3, 0.9, AM.win, 8.2, Y + 0.48, 0).rotation.z = -0.6;
  // doors (outlined) on the right side (+z)
  [[6.3, 2.0], [-6.2, 1.7]].forEach(([x, h]) => box(g, 0.75, h * 0.8, 0.04, AM.grey, x, Y + 0.05, 1.12));
  box(g, 1.2, 0.9, 0.04, AM.grey, -3.3, Y - 0.55, 1.12);
  // wings, engines
  [1, -1].forEach((s) => {
    plate(g, [[1.8, s * 0.9], [-2.3, s * 8.6], [-3.4, s * 8.6], [-2.4, s * 0.9]], 0.22, W, Y - 0.55);
    rbox(g, 0.5, 0.5, 0.06, 0.02, tail, -3.0, Y - 0.25, s * 8.65, 0.01); // winglet tip
    const n = grp(g, 0.6, Y - 1.25, s * 3.3); cylX(n, 0.58, 2.3, W, 0, 0, 0, 20); cylX(n, 0.6, 0.25, AM.grey, 1.1, 0, 0, 20);
    const fan = cylX(n, 0.48, 0.05, AM.fan, 1.2, 0, 0, 16); g.userData.fans = (g.userData.fans || []).concat(fan); rbox(n, 0.9, 0.5, 0.12, 0.04, W, -0.3, 0.5, 0, 0.02);
    for (let k = 0; k < 6; k++) { const b = box(fan, 0.04, 0.9, 0.08, AM.dark, 0.02, 0, 0); b.rotation.x = (k / 6) * Math.PI; }
  });
  // tail
  fin(g, [[-6.0, 0.9], [-7.6, 3.6], [-8.7, 3.6], [-9.0, 0.5]], 0.18, tail).position.y = Y;
  [1, -1].forEach((s) => plate(g, [[-7.0, s * 0.3], [-8.6, s * 3.2], [-9.2, s * 3.2], [-8.9, s * 0.3]], 0.14, W, Y + 0.25));
  // landing gear
  const gear = [];
  const leg = (x, z, n) => { const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.9, 0), new V3(0, 0.45, 0), 0.08, AM.chrome, 6); for (let k = 0; k < n; k++) tire(lg, 0.42, 0.28, 0, 0.42, (k - (n - 1) / 2) * 0.36, AM.grey); gear.push(lg); return lg; };
  leg(6.6, 0, 2); leg(-0.9, 1.6, 2); leg(-0.9, -1.6, 2);
  g.userData.gear = gear; g.userData.Y = Y;
  g.userData.doors = { front: new V3(6.3, Y, 1.15), rear: new V3(-6.2, Y, 1.0), cargo: new V3(-3.3, Y - 0.55, 1.15) };
  shadows(g); return g;
}

/** Little high-wing propeller plane (~6 long). userData.prop spins. */
export function propPlane(parent, color) {
  const g = grp(parent); const c = std(color || 0xe5452c, 0.35, 0.2), W = AM.white, Y = 1.1;
  body(g, [[3.0, 0], [2.95, 0.35], [2.4, 0.55], [1.2, 0.62], [-0.6, 0.55], [-2.6, 0.22], [-3.2, 0.12]], W, Y);
  box(g, 4.4, 0.1, 1.08, c, 0.2, Y - 0.05, 0);
  [1, -1].forEach((s) => { box(g, 0.9, 0.36, 0.04, AM.win, 0.9, Y + 0.32, s * 0.5); });
  plate(g, [[1.2, -4.6], [1.3, 4.6], [0.3, 4.6], [0.2, -4.6]], 0.12, W, Y + 0.62);
  [1, -1].forEach((s) => { rbox(g, 1.1, 0.13, 0.5, 0.03, c, 0.7, Y + 0.64, s * 4.4, 0.02); rod(g, new V3(0.6, Y - 0.3, s * 0.45), new V3(0.7, Y + 0.6, s * 2.0), 0.03, AM.grey); });
  fin(g, [[-2.0, 0.3], [-2.9, 1.5], [-3.3, 1.5], [-3.3, 0.1]], 0.1, c).position.y = Y;
  plate(g, [[-2.5, -1.4], [-2.6, 1.4], [-3.2, 1.4], [-3.2, -1.4]], 0.08, W, Y + 0.1);
  const prop = grp(g, 3.02, Y, 0); sph(prop, 0.16, c, 0.05, 0, 0).scale.set(0.24, 0.16, 0.16); [0, 1].forEach((k) => { const b = box(prop, 0.05, 1.5, 0.12, AM.dark, 0, 0, 0); b.rotation.x = k * Math.PI / 2; });
  const gear = [];
  [[1.8, 0], [-0.1, 0.8], [-0.1, -0.8]].forEach(([x, z]) => { const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.4, z ? -z * 0.4 : 0), new V3(0, 0.25, 0), 0.04, AM.grey); tire(lg, 0.25, 0.14, 0, 0.25, 0, AM.grey); gear.push(lg); });
  g.userData.prop = prop; g.userData.gear = gear; g.userData.Y = Y;
  shadows(g); return g;
}

/** Fighter jet (~11 long). userData: { gear, nozzle (anchor at the exhaust), burner (material) } */
export function fighter(parent, col = 0x8a94a6) {
  const g = grp(parent); const M = std(col, 0.35, 0.3), D = std(0x5a6274, 0.4, 0.3), Y = 1.5;
  body(g, [[5.6, 0], [5.0, 0.2], [3.6, 0.48], [1.5, 0.7], [-2.5, 0.75], [-4.6, 0.62], [-5.2, 0.5]], M, Y);
  const can = sph(g, 1, std(0x6ab0e0, 0.05, 0.3, { transparent: true, opacity: 0.85 }), 2.6, Y + 0.45, 0); can.scale.set(1.4, 0.42, 0.42);
  plate(g, [[1.2, 0.5], [-3.8, 4.6], [-4.8, 4.6], [-4.6, 0.5], [-4.6, -0.5], [-4.8, -4.6], [-3.8, -4.6], [1.2, -0.5]], 0.14, M, Y - 0.15);
  plate(g, [[3.4, 0.4], [2.4, 1.6], [2.0, 1.6], [2.2, 0.4], [2.2, -0.4], [2.0, -1.6], [2.4, -1.6], [3.4, -0.4]], 0.08, D, Y + 0.05);
  fin(g, [[-2.4, 0.5], [-4.4, 2.8], [-5.0, 2.8], [-5.0, 0.4]], 0.12, M).position.y = Y;
  [1, -1].forEach((s) => { const i = grp(g, 0.8, Y - 0.35, s * 0.85); cylX(i, 0.32, 2.2, D, 0, 0, 0, 12); });
  const noz = cylX(g, 0.46, 0.5, std(0x3a3f50, 0.4, 0.6), -5.35, Y, 0, 16);
  const burner = std(0xff8a2a, 0.3, 0, { emissive: 0xff6a10, emissiveIntensity: 0 }); cylX(g, 0.36, 0.06, burner, -5.62, Y, 0, 16);
  const nozzle = grp(g, -5.8, Y, 0);
  const gear = [];
  [[3.4, 0], [-1.2, 1.1], [-1.2, -1.1]].forEach(([x, z]) => { const lg = grp(g, x, 0, z); rod(lg, new V3(0, Y - 0.6, 0), new V3(0, 0.3, 0), 0.05, AM.chrome, 6); tire(lg, 0.3, 0.2, 0, 0.3, 0, AM.grey); gear.push(lg); });
  g.userData = { gear, nozzle, burner, Y }; void noz;
  shadows(g); return g;
}

/** Big transport plane with four propellers and a rear ramp (~20 long). userData: { props, ramp (group, rotation.z opens), gear, Y } */
export function transport(parent, col = 0x7a8a6a) {
  const g = grp(parent); const M = std(col, 0.45, 0.2), D = std(0x4a5444, 0.5, 0.2), Y = 2.6;
  body(g, [[9.6, 0], [9.2, 0.9], [8.2, 1.5], [6.5, 1.75], [-4.5, 1.75], [-6.8, 1.4]], M, Y);
  [1, -1].forEach((s) => box(g, 1.1, 0.4, 0.05, AM.win, 8.4, Y + 0.6, s * 1.25).rotation.y = -s * 0.5);
  const ramp = grp(g, -6.6, Y - 1.4, 0); rbox(ramp, 4.4, 0.18, 2.6, 0.05, D, -2.2, 0, 0, 0.02); ext(ramp, [[0, 0], [-4.3, 0], [-4.3, 0.3], [0, 2.7]], 0.05, 0.12, M, 0, 0, 1.3, 0.02); ext(ramp, [[0, 0], [-4.3, 0], [-4.3, 0.3], [0, 2.7]], 0.05, 0.12, M, 0, 0, -1.3, 0.02);
  const roof = grp(g, -6.6, Y + 1.4, 0); body(roof, [[0.2, 1.6], [-3.6, 1.0], [-6.0, 0.35]], M, 0); roof.children[0].scale.y = 0.55;
  ramp.rotation.z = 0.56;
  plate(g, [[1.6, -12], [2.2, 12], [-0.6, 12], [-0.9, -12]], 0.3, M, Y + 1.6);
  const props = [];
  [-7.4, -3.6, 3.6, 7.4].forEach((z) => { const n = grp(g, 2.4, Y + 1.3, z); cylX(n, 0.5, 2.6, M, -0.4, 0, 0, 14); const p = grp(n, 0.95, 0, 0); sph(p, 0.3, D, 0, 0, 0).scale.set(0.6, 0.3, 0.3); for (let k = 0; k < 6; k++) { const b = box(p, 0.06, 2.6, 0.24, D, 0, 1.3, 0); const h = grp(p); h.add(b); h.rotation.x = (k / 6) * Math.PI * 2; } props.push(p); });
  fin(g, [[-6.0, 1.4], [-8.2, 6.6], [-10.4, 6.6], [-11.4, 1.0]], 0.24, M).position.y = Y;
  plate(g, [[-9.0, -5.2], [-8.6, 5.2], [-10.6, 5.2], [-10.8, -5.2]], 0.2, M, Y + 6.4);
  [1, -1].forEach((s) => rbox(g, 5, 1.2, 0.9, 0.3, M, 0.2, 0.9, s * 1.9, 0.04));
  const gear = [];
  [[7.4, 0], [1.2, 1.9], [-0.8, 1.9], [1.2, -1.9], [-0.8, -1.9]].forEach(([x, z]) => { const lg = grp(g, x, 0, z); tire(lg, 0.48, 0.34, 0, 0.48, 0, AM.grey); gear.push(lg); });
  g.userData = { props, ramp, gear, Y };
  shadows(g); return g;
}

/** Transport helicopter (~13 long with the tail). userData: { rotor, tail } */
export function helicopter(parent, col = 0x6a7a52) {
  const g = grp(parent); const M = std(col, 0.45, 0.2), D = std(0x3a4232, 0.5, 0.2), Y = 1.9;
  body(g, [[3.4, 0], [3.1, 0.7], [2.2, 1.15], [0.5, 1.3], [-1.6, 1.25], [-2.8, 0.7], [-7.6, 0.28], [-8.0, 0.2]], M, Y);
  [1, -1].forEach((s) => { const w = box(g, 1.3, 0.6, 0.05, std(0x6ab0e0, 0.05, 0.2, { transparent: true, opacity: 0.85 }), 2.6, Y + 0.35, s * 0.86); w.rotation.y = -s * 0.5; box(g, 1.4, 1.0, 0.05, D, 0, Y - 0.1, s * 1.28); });
  rbox(g, 2.6, 0.6, 1.6, 0.2, M, -0.6, Y + 1.3, 0, 0.03);
  fin(g, [[-6.8, 0.2], [-7.6, 2.0], [-8.2, 2.0], [-8.1, 0.0]], 0.12, M).position.y = Y;
  [1, -1].forEach((s) => { rod(g, new V3(1.4, 0.15, s * 1.0), new V3(-1.8, 0.15, s * 1.0), 0.06, D, 6); rod(g, new V3(0.8, 0.15, s * 1.0), new V3(0.6, Y - 1.0, s * 0.7), 0.05, D); rod(g, new V3(-1.2, 0.15, s * 1.0), new V3(-1.2, Y - 1.0, s * 0.7), 0.05, D); });
  const rotor = grp(g, -0.6, Y + 1.9, 0); cylY(rotor, 0.25, 0.4, D, 0, 0, 0, 10);
  for (let k = 0; k < 4; k++) { const b = grp(rotor); box(b, 6.4, 0.05, 0.36, D, 3.2, 0.1, 0); b.rotation.y = (k / 4) * Math.PI * 2; }
  const tail = grp(g, -7.7, Y + 1.5, 0.22); for (let k = 0; k < 4; k++) { const b = grp(tail); box(b, 0.08, 1.2, 0.14, D, 0, 0.6, 0); b.rotation.z = (k / 4) * Math.PI * 2; }
  g.userData = { rotor, tail, Y };
  shadows(g); return g;
}
