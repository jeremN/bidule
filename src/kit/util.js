import * as THREE from 'three';

export const V3 = THREE.Vector3;
export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const reduceMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const $ = (s) => document.querySelector(s);
