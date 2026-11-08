// Military vehicles built in code, all facing +x with the wheels on y = 0 (used by the air base).
import * as THREE from 'three';
import { V3 } from './util.js';
import { MT, std, grp, add, box, rbox, cylX, cylY, cylZ, rod, rail, sph, ext, freeze, shadows } from './geo.js';
import { trackUnit, tire, fender } from './parts.js';
import { roundel } from './aircraft.js';

export const KM = {
  olive: std(0x5f6e3a, 0.6, 0.1), oliveD: std(0x46522a, 0.6, 0.1), oliveL: std(0x76854a, 0.6, 0.1), sand: std(0xc8b07a, 0.7, 0),
  dark: std(0x2a2f2a, 0.6, 0.1), grey: std(0x8f96a6, 0.5, 0.3), white: std(0xf4f5f8, 0.4, 0.1), red: std(0xd8302a, 0.4, 0.1),
  blue: std(0x2f4fa8, 0.4, 0.1), glass: MT.glassD, water: std(0x3f7fd0, 0.15, 0.2), mud: std(0x7a5a3a, 0.9, 0), concrete: std(0xb7b9c3, 0.9, 0),
  canvas: std(0x7a8a52, 0.85, 0), canvasD: std(0x66764a, 0.85, 0), rubber: std(0x22241f, 0.9, 0), metal: std(0x6a7064, 0.4, 0.6)
};
/** Merge the still parts of a rigid group into a few meshes (moving children must be added afterwards). */
const bake = (g) => { shadows(g); freeze(g); return g; };

/** Small headlight with its guard. */
function headlight(p, x, y, z) { cylX(p, 0.09, 0.08, KM.dark, x, y, z, 10); cylX(p, 0.07, 0.02, MT.lamp, x + 0.045, y, z, 10); rod(p, new V3(x - 0.05, y - 0.12, z), new V3(x + 0.08, y + 0.12, z), 0.015, KM.dark, 4); }
/** Little tricolour flag on a whip antenna. */
export function flag(p, x, y, z, h = 1.6) {
  rod(p, new V3(x, y, z), new V3(x, y + h, z), 0.015, KM.dark, 4);
  [[KM.blue, 0.1], [KM.white, 0.3], [KM.red, 0.5]].forEach(([m, dx]) => box(p, 0.2, 0.28, 0.01, m, x - dx, y + h - 0.16, z));
}

/**
 * Main-battle-tank hull (Leclerc-like), ~L long, tracks at z = ±1.25, hull top at y ≈ 1.55.
 * Returns { g, tracks } — the still details are baked.
 */
export function tankHull(p, L = 6.4) {
  const g = grp(p);
  const tracks = [trackUnit(g, { len: L * 0.78, r: 0.42, w: 0.6, z: 1.25 }), trackUnit(g, { len: L * 0.78, r: 0.42, w: 0.6, z: -1.25 })];
  const d = grp(g);
  // belly between the tracks, upper hull over them, sloped glacis
  rbox(d, L * 0.86, 0.5, 1.8, 0.1, KM.oliveD, 0.1, 0.75, 0, 0.02);
  ext(d, [[-L / 2, 0.98], [L / 2 - 0.55, 0.98], [L / 2 + 0.2, 1.08], [L / 2 - 0.45, 1.5], [-L / 2 + 0.15, 1.55], [-L / 2, 1.3]], 0.06, 2.3, KM.olive, 0, 0, 0, 0.03);
  [1, -1].forEach((s) => {
    rbox(d, L * 0.94, 0.08, 0.72, 0.02, KM.olive, -0.05, 1.02, s * 1.3, 0.01); // track guards
    // armoured side skirts in panels, a rubber flap below
    for (let i = 0; i < 6; i++) { const w = (L * 0.86) / 6; rbox(d, w - 0.05, 0.55, 0.08, 0.04, i === 5 ? KM.oliveL : KM.olive, L * 0.43 - w * (i + 0.5) + 0.05, 0.74, s * 1.62, 0.01); }
    box(d, L * 0.84, 0.12, 0.04, KM.rubber, 0, 0.42, s * 1.62);
    // stowage boxes on the guards, headlights, tow hooks, tail lights
    rbox(d, 1.3, 0.35, 0.55, 0.05, KM.oliveD, -1.6, 1.24, s * 1.3, 0.02); rbox(d, 0.9, 0.3, 0.5, 0.05, KM.oliveD, -0.2, 1.21, s * 1.3, 0.02);
    rbox(d, 0.04, 0.3, 0.45, 0.02, KM.dark, -0.95, 1.24, s * 1.3, 0.01);
    headlight(d, L / 2 - 0.1, 1.2, s * 1.2);
    add(d, new THREE.TorusGeometry(0.1, 0.03, 6, 12), KM.dark, L / 2 + 0.12, 0.85, s * 0.6).rotation.y = Math.PI / 2;
    rbox(d, 0.06, 0.1, 0.18, 0.02, MT.tail, -L / 2 - 0.02, 1.35, s * 0.95, 0.01);
    cylX(d, 0.08, 0.3, KM.dark, -L / 2 - 0.1, 1.1, s * 0.7, 8); // exhaust
  });
  // driver's hatch with periscopes, engine deck grilles, tow cable at the back, a jerrycan rack
  cylY(d, 0.32, 0.06, KM.oliveD, L / 2 - 1.1, 1.53, 0.0, 14); [-0.25, 0, 0.25].forEach((z) => rbox(d, 0.12, 0.08, 0.14, 0.02, KM.glass, L / 2 - 0.82, 1.5, z, 0.01));
  for (let i = 0; i < 7; i++) box(d, 0.06, 0.04, 1.8, KM.dark, -L / 2 + 0.45 + i * 0.22, 1.56, 0);
  rbox(d, 1.6, 0.04, 1.9, 0.02, KM.oliveD, -L / 2 + 1.1, 1.54, 0, 0.01);
  rod(d, new V3(-L / 2 - 0.02, 1.25, 0.9), new V3(-L / 2 - 0.02, 1.25, -0.9), 0.04, KM.metal, 6);
  [0.3, -0.3].forEach((z) => rbox(d, 0.18, 0.4, 0.28, 0.04, KM.oliveD, -L / 2 - 0.1, 1.05, z, 0.02));
  bake(d);
  shadows(g); return { g, tracks };
}

/** Leclerc-like turret: faceted, with a bustle, sights, smoke launchers and a long gun. Returns { g, gun, hatch, pivot }. */
export function mbtTurret(p, x, y) {
  const g = grp(p, x, y, 0), d = grp(g);
  ext(d, [[-2.0, 0.0], [1.2, 0.0], [1.75, 0.28], [1.6, 0.72], [-1.75, 0.8], [-2.1, 0.45]], 0.06, 2.3, KM.olive, 0, 0, 0, 0.03);
  ext(d, [[-1.4, 0.05], [1.0, 0.05], [1.45, 0.3], [1.3, 0.66], [-1.2, 0.7]], 0.05, 2.7, KM.olive, 0, 0, 0, 0.03); // side armour
  rbox(d, 0.6, 0.62, 0.95, 0.06, KM.oliveD, 1.65, 0.42, 0, 0.02); // mantlet
  // gunner's sight (left) and commander's panoramic sight (right)
  rbox(d, 0.55, 0.38, 0.45, 0.05, KM.oliveD, 0.6, 0.98, -0.75, 0.02); rbox(d, 0.05, 0.22, 0.3, 0.02, KM.glass, 0.88, 1.0, -0.75, 0.01);
  cylY(d, 0.15, 0.45, KM.oliveD, -0.2, 1.0, 0.75, 12); const hd = rbox(d, 0.38, 0.28, 0.32, 0.06, KM.oliveD, -0.2, 1.32, 0.75, 0.02); void hd; rbox(d, 0.04, 0.16, 0.24, 0.02, KM.glass, -0.0, 1.33, 0.75, 0.01);
  // smoke grenade launchers, both sides
  [1, -1].forEach((s) => { for (let i = 0; i < 4; i++) { const t = cylY(d, 0.06, 0.32, KM.dark, 0.2 - i * 0.18, 0.88, s * 1.25, 8); t.rotation.x = s * 0.6; } });
  // stowage basket on the bustle, antennas with a flag
  rail(d, [[-1.95, 0.8, 1.0], [-2.45, 1.15, 1.0], [-2.45, 1.15, -1.0], [-1.95, 0.8, -1.0]], 0.03, KM.dark);
  rbox(d, 0.4, 0.3, 1.6, 0.06, KM.canvasD, -2.2, 0.95, 0, 0.02);
  flag(d, -1.6, 0.8, -0.6, 1.8); rod(d, new V3(-1.6, 0.8, 0.85), new V3(-1.7, 2.3, 0.85), 0.012, KM.dark, 4);
  roundel(d, 0.2, -0.6, 0.4, 1.36).rotation.x = Math.PI / 2;
  bake(d);
  // gun on its trunnion: barrel with a thermal sleeve and a muzzle reference
  const pivot = grp(g, 1.7, 0.45, 0), gun = grp(pivot);
  cylX(gun, 0.13, 4.4, KM.oliveD, 2.4, 0, 0, 14); [1.1, 2.2, 3.3].forEach((x) => cylX(gun, 0.15, 0.06, KM.dark, x, 0, 0, 14));
  cylX(gun, 0.15, 0.25, KM.dark, 4.6, 0, 0, 14); rbox(gun, 0.12, 0.08, 0.08, 0.02, KM.dark, 4.6, 0.17, 0, 0.01);
  // commander's hatch (opens) and machine gun
  const hatch = grp(g, -0.6, 0.83, 0.45); cylY(hatch, 0.3, 0.07, KM.oliveD, 0, 0, 0, 14); rod(hatch, new V3(-0.1, 0.05, 0.15), new V3(-0.1, 0.05, -0.15), 0.02, KM.dark, 4);
  shadows(g); return { g, gun, hatch, pivot };
}

/** Six-wheeled army truck with a canvas cover. Returns { g, wheels, flap, tarp }. */
export function armyTruck(p) {
  const g = grp(p), d = grp(g), M = KM.olive, D = KM.oliveD;
  [0.42, -0.42].forEach((z) => rbox(d, 7.0, 0.3, 0.16, 0.03, MT.black, -0.4, 1.05, z));
  // cab: bonnet-less, square, with a split windscreen, mirrors, roof hatch
  const cab = grp(d, 2.3, 1.2, 0);
  ext(cab, [[-0.9, 0], [0.95, 0], [0.98, 0.85], [0.9, 1.65], [-0.9, 1.7]], [0.05, 0.1, 0.1, 0.12, 0.08], 2.3, M, 0, 0, 0, 0.03);
  [0.5, -0.5].forEach((z) => { const w = box(cab, 0.05, 0.62, 0.86, KM.glass, 0.95, 1.22, z); w.rotation.z = 0.06; });
  box(cab, 0.06, 0.7, 0.06, D, 0.96, 1.22, 0);
  [1, -1].forEach((s) => {
    rbox(cab, 0.9, 0.55, 0.04, 0.05, KM.glass, 0.3, 1.25, s * 1.16, 0.01); box(cab, 0.03, 1.1, 0.03, KM.dark, -0.2, 0.7, s * 1.17); box(cab, 0.16, 0.04, 0.04, KM.dark, 0.0, 0.85, s * 1.18);
    rod(cab, new V3(0.9, 1.4, s * 1.15), new V3(1.1, 1.5, s * 1.4), 0.02, KM.dark); rbox(cab, 0.06, 0.34, 0.18, 0.02, KM.dark, 1.12, 1.35, s * 1.42, 0.01);
    rbox(cab, 0.4, 0.06, 0.3, 0.02, KM.dark, 0.3, -0.25, s * 1.0, 0.01); // step
    headlight(cab, 1.0, 0.45, s * 0.85);
  });
  cylY(cab, 0.3, 0.06, D, -0.2, 1.72, 0.4, 14); // roof hatch
  for (let i = 0; i < 6; i++) box(cab, 0.03, 0.04, 1.2, KM.dark, 0.99, 0.15 + i * 0.09, 0); // grille
  rbox(cab, 0.25, 0.25, 2.4, 0.04, D, 1.05, -0.12, 0, 0.02); [0.6, -0.6].forEach((z) => add(cab, new THREE.TorusGeometry(0.08, 0.025, 6, 10), KM.dark, 1.2, -0.12, z).rotation.y = Math.PI / 2);
  rbox(cab, 0.04, 0.4, 0.6, 0.02, KM.oliveL, 0.99, 0.6, 0, 0.01); // number plate
  // cargo bed with drop sides, the canvas tilt on hoops
  rbox(d, 4.8, 0.2, 2.3, 0.04, D, -1.6, 1.35, 0, 0.01);
  [1, -1].forEach((s) => { rbox(d, 4.8, 0.5, 0.06, 0.02, M, -1.6, 1.65, s * 1.16, 0.01); for (let x = -3.8; x <= 0.6; x += 1.1) box(d, 0.06, 0.5, 0.08, D, x, 1.65, s * 1.17); });
  const tarp = grp(d, -1.6, 1.45, 0); const tg = new THREE.CylinderGeometry(1.15, 1.15, 4.8, 18, 1, true, -Math.PI / 2, Math.PI); tg.rotateZ(Math.PI / 2);
  add(tarp, tg, std(0x7a8a52, 0.85, 0, { side: THREE.DoubleSide }), 0, 0.85, 0).scale.y = 1.1; rbox(tarp, 4.8, 0.9, 2.3, 0.05, KM.canvas, 0, 0.45, 0, 0.01);
  for (let x = -2.0; x <= 2.0; x += 1.0) { const h = add(tarp, new THREE.TorusGeometry(1.16, 0.035, 5, 20, Math.PI), KM.canvasD, x, 0.85, 0); h.rotation.y = Math.PI / 2; h.scale.y = 1.1; }
  [1, -1].forEach((s) => { for (let x = -2.2; x <= 2.2; x += 0.55) box(tarp, 0.04, 0.12, 0.04, KM.dark, x, 0.1, s * 1.17); roundel(tarp, 0.28, 1.2, 0.5, s * 1.17).rotation.x = s * Math.PI / 2; });
  // fuel tank, toolbox, spare wheel, mud flaps, rear lights
  [1, -1].forEach((s) => { cylX(d, 0.28, 1.0, D, 0.6, 0.85, s * 0.95, 14); rbox(d, 0.7, 0.4, 0.35, 0.04, D, -1.0, 0.85, s * 1.0, 0.02); });
  [-4.0].forEach((x) => [0.9, -0.9].forEach((z) => { rbox(d, 0.04, 0.5, 0.45, 0.02, KM.rubber, x, 0.65, z, 0.01); rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, x - 0.02, 1.25, z, 0.01); }));
  bake(d);
  const flap = grp(g, -4.0, 2.75, 0); rbox(flap, 0.06, 1.3, 2.2, 0.02, std(0x6a7a48, 0.85, 0), 0, -0.65, 0, 0.01);
  for (let z = -0.9; z <= 0.9; z += 0.45) box(flap, 0.08, 0.05, 0.05, KM.dark, 0, -1.25, z);
  const wheels = [];
  [2.6, -1.0, -2.6].forEach((x) => [1, -1].forEach((s) => { wheels.push(tire(g, 0.6, 0.45, x, 0.6, s * 1.05, D, s, MT.rubber)); fender(g, 0.72, 0.5, x, 0.6, s * 1.05, D, Math.PI * 0.55); }));
  shadows(g); return { g, wheels, flap, tarp };
}

/** Eight-wheeled amphibious armoured vehicle (boat-shaped hull, trim vane, water jets). Returns { g, wheels, props, vane }. */
export function amphib(p) {
  const g = grp(p), d = grp(g), M = KM.olive, D = KM.oliveD;
  // boat-shaped hull: sloped bow, flat deck, slightly raked sides
  ext(d, [[-3.0, 0.5], [2.3, 0.5], [3.35, 1.25], [3.0, 1.75], [-2.8, 1.9], [-3.05, 1.6]], [0.05, 0.12, 0.12, 0.1, 0.06, 0.05], 2.5, M, 0, 0, 0, 0.04);
  ext(d, [[-2.7, 1.85], [2.2, 1.75], [2.6, 1.9], [-2.6, 2.05]], 0.05, 2.2, D, 0, 0, 0, 0.02); // deck plate
  [1, -1].forEach((s) => {
    for (let i = 0; i < 4; i++) rbox(d, 1.3, 0.5, 0.06, 0.04, M, 1.9 - i * 1.4, 1.45, s * 1.27, 0.01); // appliqué armour panels
    headlight(d, 3.05, 1.55, s * 0.9);
    rbox(d, 0.5, 0.06, 0.3, 0.02, KM.dark, 1.3, 1.05, s * 1.28, 0.01);
    rail(d, [[-2.4, 2.05, s * 1.05], [-0.6, 2.05, s * 1.05]], 0.025, KM.dark); // grab rails
    rbox(d, 0.06, 0.12, 0.2, 0.02, MT.tail, -3.06, 1.55, s * 0.9, 0.01);
  });
  // driver's and commander's hatches with periscopes, a small turret with its gun
  cylY(d, 0.28, 0.06, D, 2.0, 1.78, 0.55, 12); [0.35, 0.55, 0.75].forEach((z) => rbox(d, 0.1, 0.08, 0.14, 0.02, KM.glass, 2.32, 1.76, z, 0.01));
  ext(d, [[-0.7, 0], [0.6, 0], [0.8, 0.25], [0.55, 0.5], [-0.7, 0.5]], 0.06, 1.3, D, -0.3, 1.95, 0, 0.02);
  cylX(d, 0.07, 1.4, KM.dark, 1.0, 2.25, 0, 8); cylX(d, 0.1, 0.3, KM.dark, 0.4, 2.25, 0, 8);
  rbox(d, 0.3, 0.25, 0.3, 0.04, KM.dark, -0.3, 2.55, 0.35, 0.01); rbox(d, 0.04, 0.12, 0.2, 0.01, KM.glass, -0.14, 2.56, 0.35, 0.01);
  [1, -1].forEach((s) => { for (let i = 0; i < 3; i++) { const t = cylY(d, 0.05, 0.25, KM.dark, -0.5 + i * 0.16, 2.3, s * 0.72, 8); t.rotation.x = s * 0.6; } });
  flag(d, -1.4, 2.0, -0.7, 1.6);
  [1, -1].forEach((s) => roundel(d, 0.22, -1.6, 1.5, s * 1.31).rotation.x = s * Math.PI / 2);
  // rear door, water-jet housings
  rbox(d, 0.06, 0.9, 1.0, 0.04, D, -3.08, 1.2, 0, 0.02); box(d, 0.08, 0.04, 0.2, KM.dark, -3.12, 1.2, 0.3);
  [0.6, -0.6].forEach((z) => { cylX(d, 0.26, 0.4, KM.dark, -3.05, 0.75, z, 14); });
  bake(d);
  // trim vane folded on the bow (unfolds in the water)
  const vane = grp(g, 3.1, 1.3, 0); rbox(vane, 0.08, 0.9, 2.2, 0.03, D, 0, 0.45, 0, 0.01); vane.rotation.z = -0.35;
  const props = [0.6, -0.6].map((z) => { const pp = grp(g, -3.3, 0.75, z); for (let k = 0; k < 3; k++) { const h = grp(pp); h.rotation.x = (k / 3) * Math.PI * 2; box(h, 0.04, 0.22, 0.12, KM.metal, 0, 0.1, 0); } return pp; });
  const wheels = [];
  [2.0, 0.6, -0.8, -2.2].forEach((x) => [1, -1].forEach((s) => wheels.push(tire(g, 0.48, 0.38, x, 0.48, s * 1.2, D, s, MT.rubber))));
  shadows(g); return { g, wheels, props, vane };
}
