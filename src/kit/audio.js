// Voice (speech synthesis, French) and procedural sound effects (WebAudio).
export const audio = { muted: false, lastLine: '' };
let ac = null, eng = null, voice = null;

export function pickVoice() {
  try {
    const v = speechSynthesis.getVoices();
    voice =
      v.find((x) => /^fr/i.test(x.lang) && /google|amélie|amelie|audrey|thomas|marie|denise|aurélie/i.test(x.name)) ||
      v.find((x) => /^fr/i.test(x.lang)) || null;
  } catch (e) { /* no speech */ }
}
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* no speech */ }

/** Speak a line. Resolves when finished (or after a safety timeout). */
export function say(t) {
  audio.lastLine = t;
  return new Promise((res) => {
    let done = false;
    const fin = () => { if (!done) { done = true; res(); } };
    if (audio.muted || !('speechSynthesis' in window)) { setTimeout(fin, 350); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'fr-FR'; if (voice) u.voice = voice;
      u.rate = 0.95; u.pitch = 1.08; u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    } catch (e) { fin(); }
    setTimeout(fin, 900 + t.length * 80);
  });
}
export function stopVoice() { try { speechSynthesis.cancel(); } catch (e) { /* */ } }

export function initAudio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}

export function tone(f, start, dur, type, vol, f2) {
  if (!ac || audio.muted) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    const t0 = ac.currentTime + start;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (e) { /* */ }
}
export const beep = () => tone(1250, 0, 0.2, 'square', 0.035);
export const thud = () => tone(150, 0, 0.3, 'triangle', 0.14, 55);
export const ding = () => { tone(1320, 0, 0.5, 'sine', 0.1); tone(1980, 0, 0.3, 'sine', 0.04); };
export const chime = () => { tone(660, 0, 0.25); tone(880, 0.12, 0.35); tone(1320, 0.24, 0.4, 'sine', 0.1); };

export function hornSound(kind) {
  if (kind === 'bell') { ding(); setTimeout(ding, 280); return; }
  [0, 0.42].forEach((s) => { tone(330, s, 0.32, 'square', 0.045); tone(415, s, 0.32, 'square', 0.045); });
}

export function engineOn(freq) {
  if (!ac || audio.muted || eng) return;
  try {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), mg = ac.createGain();
    const l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq || 50;
    f.type = 'lowpass'; f.frequency.value = 280;
    g.gain.value = 0.045; l.type = 'square'; l.frequency.value = 9; lg.gain.value = 0.025;
    l.connect(lg); lg.connect(g.gain); o.connect(f); f.connect(g); g.connect(mg); mg.connect(ac.destination);
    const n = ac.currentTime;
    mg.gain.setValueAtTime(0, n); mg.gain.linearRampToValueAtTime(1, n + 0.5);
    o.start(); l.start();
    eng = { o, l, mg };
  } catch (e) { eng = null; }
}
export function engineOff() {
  if (!eng || !ac) return;
  try {
    const n = ac.currentTime;
    eng.mg.gain.cancelScheduledValues(n);
    eng.mg.gain.setValueAtTime(eng.mg.gain.value, n);
    eng.mg.gain.linearRampToValueAtTime(0, n + 0.6);
    eng.o.stop(n + 0.7); eng.l.stop(n + 0.7);
  } catch (e) { /* */ }
  eng = null;
}
