// Particle effects: fire (additive), smoke and dust puffs. Call fx.update(dt) every frame.
import * as THREE from 'three';
import { V3, rnd } from './util.js';
import { toonMat } from './geo.js';

export function createFx(scene, n = 320) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const fire = [0xfff4b0, 0xffc24a, 0xff7a2a].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pool = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, fire[0]); m.visible = false; m.frustumCulled = false; m.layers.set(1); scene.add(m); // layer 1: no ink outlines
    pool.push({ m, on: false, smokeMat: null });
  }
  let cursor = 0;
  function take() {
    for (let k = 0; k < n; k++) { const p = pool[(cursor + k) % n]; if (!p.on) { cursor = (cursor + k + 1) % n; return p; } }
    const p = pool[cursor]; cursor = (cursor + 1) % n; return p;
  }
  function emit(kind, pos, vel, life, s0, s1, color) {
    const p = take();
    p.on = true; p.kind = kind; p.t = 0; p.life = life; p.s0 = s0; p.s1 = s1; p.v = vel.clone();
    p.m.position.copy(pos); p.m.visible = true; p.m.scale.setScalar(s0);
    if (kind === 'fire') p.m.material = fire[Math.floor(Math.random() * 3)];
    else {
      if (!p.smokeMat) p.smokeMat = toonMat({ transparent: true, depthWrite: false });
      p.smokeMat.color.setHex(color || 0xdfe2ec); p.smokeMat.opacity = 0.6; p.m.material = p.smokeMat;
    }
  }
  return {
    fire(pos, dir, speed, spread, size) {
      const v = dir.clone().multiplyScalar(speed * rnd(0.8, 1.2)).add(new V3(rnd(-spread, spread), rnd(-spread, spread), rnd(-spread, spread)));
      emit('fire', pos, v, rnd(0.25, 0.45), size || rnd(0.25, 0.45), 0.05);
    },
    smoke(pos, vel, size, color, life) { emit('smoke', pos, vel, life || rnd(1.6, 2.6), size * 0.5, size * 1.8, color); },
    update(dt) {
      pool.forEach((p) => {
        if (!p.on) return;
        p.t += dt; const k = p.t / p.life;
        if (k >= 1) { p.on = false; p.m.visible = false; return; }
        p.m.position.addScaledVector(p.v, dt);
        if (p.kind === 'smoke') { p.v.multiplyScalar(1 - dt * 0.9); p.v.y += dt * 0.5; p.smokeMat.opacity = 0.6 * (1 - k); }
        p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      });
    }
  };
}
