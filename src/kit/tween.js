// Tiny promise-based tween engine, driven by the stage loop (updateTweens).
const tweens = [];

export const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const easeSine = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
export const easeIn = (k) => k * k;
export const easeBack = (k) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
export const lin = (k) => k;

/** Run fn(easedK) every frame for `dur` seconds. Resolves when done. */
export function tw(dur, fn, ease) {
  return new Promise((res) => {
    tweens.push({ t: 0, dur: Math.max(0.001, dur), fn, ease: ease || easeIO, res });
  });
}
export const sleep = (s) => tw(s, () => {}, lin);

/** Animate obj[key] to target. */
export function to(obj, key, target, dur, ease) {
  const from = obj[key];
  return tw(dur, (k) => { obj[key] = from + (target - from) * k; }, ease);
}

/** Pop an object in from a tiny scale. */
export function pop(o, dur) {
  o.visible = true;
  o.scale.setScalar(0.01);
  return tw(dur || 0.6, (k) => o.scale.setScalar(Math.max(0.01, k)), easeBack);
}

/** Drop every running tween (their promises never resolve, so leftover actions just stop). */
export function clearTweens() { tweens.length = 0; }

export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    t.fn(t.ease(k));
    if (k >= 1) { tweens.splice(i, 1); t.res(); }
  }
}
