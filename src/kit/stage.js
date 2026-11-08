// The stage: DOM shell, renderer + "technicolour" post pass, painterly island, camera, UI and main loop.
// A world module describes its machines; createStage() does everything else.
import * as THREE from 'three';
import { V3, rad, clamp, rnd, pick, reduceMotion } from './util.js';
import { updateTweens, clearTweens, tw, lin } from './tween.js';
import { audio, say, stopVoice, initAudio, pickVoice, engineOff, hornSound, beep } from './audio.js';
import { C, ICO, mat, add, grp, instanced, shadows } from './geo.js';

const ICON_AGAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_TAGS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v10H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/><path id="tagsX" d="M3 3l18 18" opacity="0"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path id="muteX" d="M17 9l5 6M22 9l-5 6" opacity="0"/></svg>';
const ICON_HORN = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v6h5l11 7V6L9 13H4z"/><path d="M24 11l4-3M24 16h5M24 21l4 3"/></svg>';
const ICON_HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>';

function shell(world, root, homeHref) {
  root.innerHTML = `
<div class="stage" id="stage"><canvas id="c" aria-label="${world.title} en 3D. Glisse le doigt pour tourner autour."></canvas><div class="tags" id="tags"></div></div>
<div class="hud" id="hud">
  <header class="top" id="top">
    <a class="icon-btn home" data-home href="${homeHref}" aria-label="Accueil" title="Accueil">${ICON_HOME}</a>
    <a class="brand" id="brand" href="${homeHref}">${world.brandIcon || ''}<span>${world.title}</span></a>
    <button class="pill" id="back" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>${world.backLabel || 'Tout voir'}</button>
    <span class="spacer"></span>
    <button class="icon-btn" id="again" aria-label="Réécouter">${ICON_AGAIN}</button>
    <button class="icon-btn" id="tagsBtn" aria-pressed="false" aria-label="Cacher les bulles" title="Bulles d'info">${ICON_TAGS}</button>
    <button class="icon-btn" id="mute" aria-pressed="false" aria-label="Couper le son">${ICON_MUTE}</button>
  </header>
  <p class="caption" id="caption">${world.hint || 'Touche un engin pour le découvrir.'}</p>
  <div class="grow"></div>
  <section class="sheet" id="sheet" hidden aria-live="polite">
    <h2 id="sName"></h2><p class="use" id="sUse"></p><p class="how" id="sHow"></p>
    <div class="acts"><button class="go" id="go">${ICON_PLAY}<span id="goTxt"></span></button><button class="horn" id="horn" aria-label="Klaxon">${ICON_HORN}</button></div>
  </section>
  <nav class="dock" id="dock" aria-label="Les engins"></nav>
</div>
<div class="start" id="start">
  <a class="pill start-home" data-home href="${homeHref}">${ICON_HOME}Accueil</a>
  <p class="kicker">Bidule</p>
  <h1>${world.titleHtml || world.title}</h1>
  <p>${world.subtitle}</p>
  <button class="play" id="play" aria-label="Jouer"><span class="disc"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="#2a1704"/></svg></span><b>Jouer</b></button>
</div>`;
}

const POST_FRAG = `precision highp float;uniform sampler2D tDiffuse;uniform float uDpr;uniform float uTime;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 c=texture2D(tDiffuse,vUv).rgb;
  float l=dot(c,vec3(.299,.587,.114));
  c=mix(vec3(l),c,1.32);
  float sh=1.-smoothstep(.12,.55,l);
  c=mix(c,c*vec3(.76,.9,1.24)+vec3(0.,.012,.035),sh*.65);
  c=mix(c,c*vec3(1.08,1.,.86),smoothstep(.55,.95,l)*.45);
  vec2 p=gl_FragCoord.xy/uDpr;p=mat2(.7071,-.7071,.7071,.7071)*p;
  vec2 g=fract(p/3.4)-.5;
  float r=sqrt(clamp(1.-l*1.2,0.,1.))*.46;
  float dm=1.-smoothstep(r-.12,r+.12,length(g));
  c*=1.-dm*.22*sh;
  c+=(hash(gl_FragCoord.xy+fract(uTime)*91.)-.5)*.03;
  vec2 q=vUv-.5;float v=length(q*vec2(1.15,1.));
  c=mix(c,vec3(.03,.045,.09),smoothstep(.42,.95,v)*.8);
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Mount a world inside `root`. Returns a dispose() that stops the loop and frees the GPU.
 * opts.onHome: called when the brand link is used (client-side navigation).
 */
export function createStage(world, root, opts = {}) {
  const $ = (s) => root.querySelector(s);
  shell(world, root, opts.homeHref || import.meta.env.BASE_URL || '/');
  const stageEl = $('#stage'), canvas = $('#c');
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer) {
    const d = document.createElement('div'); d.className = 'nogl';
    d.textContent = "Le monde en 3D ne peut pas s'afficher sur cet appareil. Essaie avec un autre navigateur.";
    root.appendChild(d); $('#start').hidden = true; $('#hud').hidden = true; return () => { root.innerHTML = ''; };
  }
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const rt = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
    ? new THREE.WebGLMultisampleRenderTarget(4, 4) : new THREE.WebGLRenderTarget(4, 4);
  const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uDpr: { value: DPR }, uTime: { value: 0 } },
    depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: POST_FRAG
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ---------- scene ---------- */
  const RAD = world.radius || 26, SK = RAD / 26; // island radius; SK scales the scenery
  const L = world.lights || {};
  const scene = new THREE.Scene(); scene.background = new THREE.Color(world.sky || 0x0b1222);
  scene.add(new THREE.HemisphereLight(...(L.hemi || [0x9fb6ff, 0x3b2d60, 0.9])));
  const sun = new THREE.DirectionalLight(...(L.sun || [0xffd29a, 1.1])); sun.position.set(-24 * SK, 30 * SK, 16 * SK); sun.castShadow = true;
  sun.shadow.mapSize.set(RAD > 30 ? 4096 : 2048, RAD > 30 ? 4096 : 2048);
  const SC = RAD + 8;
  Object.assign(sun.shadow.camera, { left: -SC, right: SC, top: SC, bottom: -SC, near: 1, far: 100 * SK + 40 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun); scene.add(sun.target);

  const zones = world.zones || [], segs = world.segs || [];
  const isClear = (x, z) => !zones.some(([a, b, r]) => Math.hypot(x - a, z - b) < r) && !segs.some(([a, b, c, d, r]) => segDist(x, z, a, b, c, d) < r);

  // painted ground
  const G = world.ground;
  const gtex = (() => {
    const S = RAD > 30 ? 2048 : 1024, R = RAD, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
    const P = (wx, wz) => [((wx / R + 1) / 2) * S, ((wz / R + 1) / 2) * S], U = (w) => (w / (2 * R)) * S;
    const g = x.createRadialGradient(S * 0.48, S * 0.5, S * 0.04, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, G.base[0]); g.addColorStop(0.7, G.base[1]); g.addColorStop(1, G.base[2]);
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.lineCap = 'round'; x.lineJoin = 'round';
    (G.paths || []).forEach(({ pts, w, col, al }) => {
      x.globalAlpha = al; x.strokeStyle = col; x.lineWidth = U(w); x.beginPath();
      pts.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); x.globalAlpha = 1;
    });
    (G.rects || []).forEach(({ cx, cz, len, wid, rot, col, al, stripes }) => {
      const [a, b] = P(cx, cz);
      x.save(); x.translate(a, b); x.rotate(rot || 0); x.globalAlpha = al == null ? 1 : al; x.fillStyle = col;
      const w = U(len), h = U(wid); x.fillRect(-w / 2, -h / 2, w, h);
      if (stripes) { x.fillStyle = stripes; for (let i = -h / 2; i < h / 2; i += U(0.5)) x.fillRect(-w / 2, i, w, U(0.16)); }
      x.restore(); x.globalAlpha = 1;
    });
    (G.blobs || []).forEach(([wx, wz, r, col]) => {
      const [a, b] = P(wx, wz); const gg = x.createRadialGradient(a, b, 0, a, b, U(r));
      gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.beginPath(); x.arc(a, b, U(r), 0, 7); x.fill();
    });
    for (let i = 0; i < 14000 * SK * SK; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(20,16,50,.12)' : 'rgba(255,230,210,.08)'; x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  })();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(RAD, 96), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  if (world.floating) {
    // a floating island: rocky underside, stars all around
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD * 0.55, 6, 72, 3, true), new THREE.MeshLambertMaterial({ color: world.rimColor || 0x4a4560 }));
    rim.position.y = -3.02; scene.add(rim);
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(RAD * 0.55, 9, 40), mat(world.rimColor || 0x4a4560)); bottom.rotation.x = Math.PI; bottom.position.y = -10.5; scene.add(bottom);
    const sp = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = rnd(150, 260), q = Math.sqrt(1 - u * u);
      sp.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false })));
  } else {
    const outer = new THREE.Mesh(new THREE.CircleGeometry(90 * SK, 48), mat(world.outerColor || 0x0e1d22));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.04; outer.receiveShadow = true; scene.add(outer);
  }

  const F = world.forest || {};
  if (world.forest !== false) instanced(scene, ICO, Math.round(300 * SK), (i, d) => {
    const a = Math.random() * Math.PI * 2, r = RAD - 2.5 + Math.pow(Math.random(), 0.7) * 15, s = rnd(1.7, 3.4);
    d.position.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); d.scale.set(s, s * rnd(0.8, 1.3), s);
    return pick(F.dark || [0x10302a, 0x153a30, 0x0d2526, 0x1b4433, 0x0f2a33]);
  });
  if (world.forest !== false) instanced(scene, ICO, Math.round(170 * SK), (i, d) => {
    const a = Math.random() * Math.PI * 2, r = rnd(RAD - 5.5, RAD - 2.2), s = rnd(0.6, 1.3);
    d.position.set(Math.cos(a) * r, s * 0.45, Math.sin(a) * r); d.rotation.set(rnd(0, 3), rnd(0, 3), 0); d.scale.set(s, s * rnd(0.7, 1.1), s);
    return pick(F.bush || [0x3557d6, 0x2a46b8, 0x4a6ef0, 0x5a7dff]);
  });
  const TUFT = new THREE.ConeGeometry(0.13, 0.85, 4); TUFT.translate(0, 0.42, 0);
  const tufts = [];
  for (let c = 0; c < 70 * SK * SK && tufts.length < 640 * SK * SK; c++) {
    const a = Math.random() * Math.PI * 2, r = rnd(3, RAD - 5), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    if (!isClear(cx, cz)) continue;
    const n = 8 + Math.floor(Math.random() * 9);
    for (let k = 0; k < n; k++) { const x = cx + rnd(-1.3, 1.3), z = cz + rnd(-1.3, 1.3); if (isClear(x, z)) tufts.push([x, z]); }
  }
  if (tufts.length && world.tufts !== false) instanced(scene, TUFT, tufts.length, (i, d) => {
    const [x, z] = tufts[i]; d.position.set(x, 0, z); d.rotation.set(rnd(-0.35, 0.35), rnd(0, 3), rnd(-0.35, 0.35));
    const s = rnd(0.7, 1.4); d.scale.set(s, s * rnd(0.8, 1.4), s);
    return pick(world.tuftColors || [0x4c78ff, 0x355fe0, 0x6a8fff, 0x2c4fc4, 0x82a2ff]);
  });

  /* clods (dirt, grain, straw particles) */
  const clods = [];
  for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(ICO, mat(i % 2 ? C.dirt : C.dirtD)); m.visible = false; m.castShadow = true; scene.add(m); clods.push({ m, on: false }); }
  function throwClod(from, toP, size, color) {
    const c = clods.find((c) => !c.on); if (!c) return;
    c.on = true; c.t = 0; c.T = rnd(0.45, 0.75); c.s = size || rnd(0.12, 0.26);
    c.m.material = mat(color || (Math.random() < 0.5 ? C.dirt : C.dirtD));
    c.p = from.clone().add(new V3(rnd(-0.2, 0.2), rnd(-0.1, 0.1), rnd(-0.2, 0.2)));
    const tg = toP.clone().add(new V3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6)));
    c.v = new V3((tg.x - c.p.x) / c.T, (tg.y - c.p.y + 4.9 * c.T * c.T) / c.T, (tg.z - c.p.z) / c.T);
    c.m.visible = true; c.m.scale.setScalar(c.s); c.m.rotation.set(rnd(0, 3), rnd(0, 3), 0);
  }
  function updateClods(dt) {
    clods.forEach((c) => {
      if (!c.on) return; c.t += dt;
      if (c.t < c.T) { c.m.position.set(c.p.x + c.v.x * c.t, c.p.y + c.v.y * c.t - 4.9 * c.t * c.t, c.p.z + c.v.z * c.t); c.m.rotation.x += dt * 6; }
      else { const f = (c.t - c.T) / 0.6; c.m.scale.setScalar(Math.max(0.001, c.s * (1 - f))); if (f >= 1) { c.on = false; c.m.visible = false; } }
    });
  }

  /* ---------- stations ---------- */
  const stations = [];
  function makeStation(id) {
    const cfg = world.cfg[id]; const g = grp(scene, cfg.x, 0, cfg.z); g.rotation.y = cfg.yaw;
    const st = Object.assign({ id, g, A: {}, parts: [], wheels: [], tracks: [], links: [], lastX: 0, beepT: 0 }, world.data[id]);
    g.userData.st = st; stations.push(st); return st;
  }
  function part(st, key, label, obj, idle) { st.A[key] = obj; st.parts.push({ key, label, obj, idle }); }
  function roll(st, dt) {
    const x = st.m.position.x, dx = x - st.lastX; st.lastX = x;
    if (dx) { st.wheels.forEach((w) => (w.rotation.z -= dx / w.userData.r)); st.tracks.forEach((t) => t.update(dx)); }
    st.links.forEach((l) => l.update());
    if (st.reversing) { st.beepT -= dt; if (st.beepT <= 0) { beep(); st.beepT = 0.55; } }
  }

  /* ---------- UI refs ---------- */
  const sheetEl = $('#sheet'), captionEl = $('#caption'), startEl = $('#start'), dockEl = $('#dock'), tagsEl = $('#tags'), goBtn = $('#go');
  let current = null, busy = false, activeKey = null;
  function step(text, key) { captionEl.textContent = text; captionEl.hidden = false; activeKey = key || null; return say(text); }

  const updaters = [];
  const ctx = { THREE, scene, renderer, makeStation, part, roll, step, throwClod, isClear, stations, radius: RAD, onUpdate: (fn) => updaters.push(fn) };
  world.build(ctx);
  stations.forEach((st) => shadows(st.g));

  /* ---------- camera ---------- */
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const ELEV = rad(34);
  const OVAZ = (world.overview && world.overview.az) != null ? world.overview.az : Math.PI / 4;
  // the camera turns to see each machine from the side: azimuth = the station's yaw (or st.az)
  const nearAz = (a) => a + Math.round((az - a) / (Math.PI * 2)) * Math.PI * 2;
  let az = OVAZ, azT = az, V = 40, VT = 40, fx = 0.5, fxT = 0.5, fy = 0.5, fyT = 0.5, SW = 1, SH = 1;
  const ov = world.overview || { w: 44, h: 31, focus: [1.5, 2, 2.5] };
  const focus = new V3(...ov.focus), focusT = focus.clone();
  function computeView() {
    const topB = $('#top').getBoundingClientRect().bottom, dockT = dockEl.getBoundingClientRect().top;
    let L = 0, R = SW, T, B;
    if (!startEl.hidden) { VT = Math.max(34 * SK, (46 * SK * SH) / SW); fxT = 0.5; fyT = 0.5; focusT.set(...ov.focus); azT = nearAz(OVAZ); return; }
    if (current) {
      T = topB + 70; const sr = sheetEl.getBoundingClientRect();
      if (SW >= 760 && SW > SH) { L = sr.right + 8; B = dockT - 8; } else B = sr.top - 8;
      const fw = Math.max(80, R - L), fh = Math.max(80, B - T);
      VT = Math.max((current.size.h * SH) / fh, (current.size.w * SH) / fw);
      azT = nearAz(current.az != null ? current.az : current.g.rotation.y);
      if (current.focusAt) current.focusAt.getWorldPosition(focusT); // follows a moving machine
      else focusT.copy(current.g.localToWorld(current.focus.clone()));
    } else {
      T = (captionEl.hidden ? topB : captionEl.getBoundingClientRect().bottom) + 6; B = dockT - 6;
      const fw = Math.max(80, R - L), fh = Math.max(80, B - T);
      VT = Math.max((ov.h * SH) / fh, (ov.w * SH) / fw); focusT.set(...ov.focus); azT = nearAz(OVAZ);
    }
    fxT = (L + R) / 2 / SW; fyT = (T + B) / 2 / SH;
  }
  function resize() {
    SW = stageEl.clientWidth; SH = stageEl.clientHeight; if (!SW || !SH) return;
    renderer.setSize(SW, SH, false); rt.setSize(Math.round(SW * DPR), Math.round(SH * DPR)); computeView();
  }
  function updateCam(dt) {
    const k = 1 - Math.exp(-dt * 3.2);
    focus.lerp(focusT, k); V += (VT - V) * k; fx += (fxT - fx) * k; fy += (fyT - fy) * k; az += (azT - az) * (1 - Math.exp(-dt * 2.6));
    const a = SW / SH;
    cam.left = -fx * V * a; cam.right = (1 - fx) * V * a; cam.top = fy * V; cam.bottom = -(1 - fy) * V; cam.updateProjectionMatrix();
    cam.position.set(focus.x + Math.sin(az) * Math.cos(ELEV) * 120, focus.y + Math.sin(ELEV) * 120, focus.z + Math.cos(az) * Math.cos(ELEV) * 120);
    cam.lookAt(focus);
  }

  /* ---------- UI ---------- */
  world.order.forEach((id) => {
    const st = stations.find((s) => s.id === id);
    const b = document.createElement('button'); b.className = 'card'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<svg class="ic" viewBox="0 0 120 80" aria-hidden="true">${world.icons[id]}</svg><b>${st.short}</b>`;
    b.addEventListener('click', () => select(st)); dockEl.appendChild(b); st.card = b;
    const t = document.createElement('button'); t.className = 'tag name'; t.textContent = st.short; t.addEventListener('click', () => select(st)); tagsEl.appendChild(t); st.nameTag = t;
    st.partTags = st.parts.map((p) => {
      // a dot on the part, the label offset to the side with a short leader line, so the part stays visible
      const el = document.createElement('div'); el.className = 'tag part'; el.innerHTML = `<i></i><s></s><span>${p.label}</span>`;
      tagsEl.appendChild(el); return { p, el };
    });
  });
  function hop(st) {
    const m = st.m; if (st.hopping) return; st.hopping = true; const y0 = m.position.y;
    return tw(0.5, (k) => (m.position.y = y0 + Math.sin(k * Math.PI) * 0.3), lin).then(() => { m.position.y = y0; st.hopping = false; });
  }
  function select(st) {
    initAudio();
    if (busy || !startEl.hidden) return;
    if (current === st) { say(`${st.full}. ${st.use}`); hop(st); return; }
    current = st; activeKey = null;
    stations.forEach((s) => s.card.setAttribute('aria-pressed', String(s === st)));
    try { st.card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' }); } catch (e) { /* */ }
    $('#sName').textContent = st.full; $('#sUse').textContent = st.use; $('#sHow').textContent = st.how; $('#goTxt').textContent = st.verb + ' !';
    sheetEl.hidden = false; captionEl.hidden = true; $('#back').hidden = false; $('#brand').hidden = true;
    computeView(); hop(st); say(`${st.full}. ${st.use} ${st.how}`);
  }
  function overview() {
    if (busy) return; current = null; activeKey = null;
    stations.forEach((s) => s.card.setAttribute('aria-pressed', 'false'));
    sheetEl.hidden = true; $('#back').hidden = true; $('#brand').hidden = false;
    captionEl.textContent = world.hint || 'Touche un engin pour le découvrir.'; captionEl.hidden = false; computeView();
  }
  async function runAction() {
    if (!current || busy) return; initAudio();
    const st = current; busy = true; document.body.classList.add('busy'); goBtn.disabled = true; $('#back').disabled = true;
    try { await st.action(); } catch (e) { console.error(e); }
    engineOff(); busy = false; activeKey = null; document.body.classList.remove('busy'); goBtn.disabled = false; $('#back').disabled = false;
    $('#goTxt').textContent = 'Encore !';
  }
  goBtn.addEventListener('click', runAction);
  $('#horn').addEventListener('click', () => { initAudio(); if (current) { hornSound(current.horn); hop(current); } });
  $('#back').addEventListener('click', overview);
  root.querySelectorAll('#brand,[data-home]').forEach((a) => a.addEventListener('click', (e) => { if (opts.onHome) { e.preventDefault(); opts.onHome(); } }));
  $('#again').addEventListener('click', () => { initAudio(); if (audio.lastLine) say(audio.lastLine); });
  // info bubbles on/off, remembered on this device
  const setTags = (off) => {
    root.classList.toggle('no-tags', off); const b = $('#tagsBtn');
    b.setAttribute('aria-pressed', String(off)); b.setAttribute('aria-label', off ? 'Montrer les bulles' : 'Cacher les bulles'); $('#tagsX').setAttribute('opacity', off ? '1' : '0');
    try { localStorage.setItem('bidule.tags', off ? 'off' : 'on'); } catch (e) { /* private mode */ }
  };
  { let off = false; try { off = localStorage.getItem('bidule.tags') === 'off'; } catch (e) { /* */ } setTags(off); }
  $('#tagsBtn').addEventListener('click', () => setTags(!root.classList.contains('no-tags')));
  $('#mute').addEventListener('click', (e) => {
    audio.muted = !audio.muted; const b = e.currentTarget;
    b.setAttribute('aria-pressed', String(audio.muted)); b.setAttribute('aria-label', audio.muted ? 'Remettre le son' : 'Couper le son');
    $('#muteX').setAttribute('opacity', audio.muted ? '1' : '0'); if (audio.muted) { stopVoice(); engineOff(); }
  });
  root.classList.add('at-start');
  $('#play').addEventListener('click', () => { initAudio(); pickVoice(); startEl.hidden = true; root.classList.remove('at-start'); computeView(); say(world.welcome); });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* */ } });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return; const dx = e.clientX - drag.x;
    drag.moved += Math.abs(dx) + Math.abs(e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; azT -= dx * 0.006;
  });
  canvas.addEventListener('pointerup', (e) => {
    const d = drag; drag = null; if (!d || d.moved > 10 || !startEl.hidden) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(stations.map((s) => s.g), true)[0]; if (!hit) return;
    let o = hit.object; while (o && !o.userData.st) o = o.parent; if (o) select(o.userData.st);
  });
  canvas.addEventListener('pointercancel', () => (drag = null));

  const pv = new V3();
  function placeTags() {
    stations.forEach((st) => {
      const showName = !current && startEl.hidden;
      st.nameTag.classList.toggle('show', showName);
      if (showName) { st.tagAt.getWorldPosition(pv).project(cam); st.nameTag.style.transform = `translate(${((pv.x + 1) / 2) * SW}px,${((1 - pv.y) / 2) * SH}px)`; }
      let cx = SW * fx;
      if (current === st) { (st.focusAt || st.tagAt).getWorldPosition(pv).project(cam); cx = ((pv.x + 1) / 2) * SW; }
      st.partTags.forEach(({ p, el }) => {
        const on = current === st && activeKey === p.key, show = current === st && (on || (p.idle && !activeKey));
        el.classList.toggle('show', show); el.classList.toggle('on', on);
        if (show) {
          p.obj.getWorldPosition(pv).project(cam); const x = ((pv.x + 1) / 2) * SW, y = ((1 - pv.y) / 2) * SH;
          el.style.transform = `translate(${x}px,${y}px)`; el.classList.toggle('left', x < cx);
        }
      });
    });
  }

  let last = performance.now(), fc = 0, raf = 0, alive = true, ro = null;
  const maxDt = /[?&]fast/.test(location.search) ? 0.4 : 0.05; // ?fast: big steps for slow headless tests
  function frame(now) {
    const dt = Math.min(maxDt, (now - last) / 1000); last = now; fc++;
    updateTweens(dt);
    scene.updateMatrixWorld();
    stations.forEach((st) => {
      if (st.update) st.update(dt);
      (st.beacons || []).forEach((b) => (b.emissiveIntensity = busy && current === st ? 0.25 + 1.6 * Math.max(0, Math.sin((now / 1000) * 11)) : 0.35));
    });
    updateClods(dt);
    updaters.forEach((fn) => fn(dt, now / 1000));
    if (!startEl.hidden && !reduceMotion && !drag) azT += dt * 0.07;
    if (fc % (busy ? 6 : 20) === 0) computeView();
    updateCam(dt);
    postMat.uniforms.uTime.value = now / 1000;
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    placeTags();
    if (alive) raf = requestAnimationFrame(frame);
  }
  resize();
  try { ro = new ResizeObserver(resize); ro.observe(stageEl); } catch (e) { window.addEventListener('resize', resize); }
  V = VT; fx = fxT; fy = fyT; focus.copy(focusT);
  raf = requestAnimationFrame(frame);

  return function dispose() {
    alive = false; cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    clearTweens(); stopVoice(); engineOff();
    scene.traverse((o) => {
      if (o.geometry && !o.geometry.parameters?.shared) o.geometry.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose?.(); });
    });
    rt.dispose(); postMat.dispose(); renderer.dispose(); renderer.forceContextLoss();
    root.innerHTML = '';
  };
}
