import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {springStep, kick} from './physics.js?v=003';

import {attachEarMotion} from './ear-motion.js?v=004';
import {characters as profiles, characterKey} from './characters.js?v=004';

const $ = id => document.getElementById(id);
const canvas = $('character');
const stage = $('stage');
const params = new URLSearchParams(location.search);
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const character = characterKey(params.get('character'));
const profile = profiles[character];
const sourceURL = new URL('./assets/' + profile.file, import.meta.url);
let earMotion = null;
$('character-select').value = character;
$('character-name').textContent = profile.name;
$('poster').src = new URL('./assets/' + profile.poster, import.meta.url).href;
$('poster').alt = profile.name + '静态预览';
canvas.setAttribute('aria-label',profile.name+'三维手办；拖动旋转，点击轻弹');
$('ear-controls').hidden = character !== 'amiya';
$('model-spec').textContent = `${profile.triangles.toLocaleString()} 三角面 · 带颜色 GLB`;
$('model-note').textContent = character === 'amiya' ? '下降时耳朵收起，上升时轻轻向两侧摆。也可以切换固定耳姿观察。' : '普通刘海、浅拱眉和白色背部实验服，保留了开心的笑脸。';
const hop = () => state.elastic ? .115 * (1-Math.cos(state.time * 4*Math.PI)) / 2
  + (!state.playing && state.clickTime >= 0 ? .115 * (1-Math.cos(state.clickTime * 4*Math.PI)) / 2 : 0) : 0;
const verticalVelocity = () => state.elastic ? state.playing
  ? .115 * 2*Math.PI * Math.sin(state.time * 4*Math.PI)
  : state.clickTime >= 0 ? .115 * 2*Math.PI * Math.sin(state.clickTime * 4*Math.PI) : 0 : 0;
const state = {
  playing: !preference.matches && !params.has('paused'),
  elastic: true, period: 2.7, strength: 1.15, yaw: THREE.MathUtils.degToRad(Number(params.get('angle')) || 0),
  time: 0, clickTime:-1, squash: 0, sv: 0, pulse: -1, bumpUntil: 0, visible: true, hostVisible: true,
  earsEnabled:true, earStrength:1, dragging: false, ready: false, destroyed: false, raf: 0, last: 0,
};
let renderer, scene, camera, spin, deform, shadow, resizeObserver, intersectionObserver;
const cleanup = [];
const listen = (target, type, fn, options) => {
  target.addEventListener(type, fn, options);
  cleanup.push(() => target.removeEventListener(type, fn, options));
};

function syncControls(notify = true) {
  $('play').textContent = state.playing ? '暂停' : '播放';
  $('play').setAttribute('aria-pressed', String(state.playing));
  $('elastic').checked = state.elastic;
  $('speed').value = String(state.period);
  $('speed-value').value = `${state.period.toFixed(1)} 秒`;
  $('strength').value = String(state.strength);
  $('strength-value').value = `${state.strength.toFixed(2)} 倍`;
  if (notify && state.ready && parent !== window) parent.postMessage({type:'priestess-viewer-state',
    playing:state.playing, elastic:state.elastic, period:state.period, strength:state.strength},location.origin);
}
function render() {
  if (!state.ready || state.destroyed) return;
  spin.rotation.y = state.yaw;
  const yScale = 1 + state.squash;
  const widthScale = 1 / Math.sqrt(yScale);
  deform.scale.set(widthScale, yScale, widthScale);
  deform.position.y = hop();
  earMotion?.apply(widthScale,yScale);
  spin.rotation.z = state.squash * .06;
  shadow.scale.setScalar(1 + Math.max(0, -state.squash) * .6);
  renderer.render(scene, camera);
  $('angle').value = `${Math.round(THREE.MathUtils.euclideanModulo(state.yaw * 180 / Math.PI, 360))}°`;
  canvas.dataset.yaw = state.yaw.toFixed(4);
  canvas.dataset.verticalScale = yScale.toFixed(4);
  canvas.dataset.playing = String(state.playing);
  canvas.dataset.period = String(state.period);
  canvas.dataset.strength = String(state.strength);
  canvas.dataset.character = character;
  canvas.dataset.verticalVelocity = verticalVelocity().toFixed(4);
  canvas.dataset.hop = hop().toFixed(4);
  if (earMotion) {
    canvas.dataset.earAngle = earMotion.state.angle.toFixed(3);
    canvas.dataset.earTipAngle = earMotion.state.tip.toFixed(3);
    canvas.dataset.earLengthRatios = earMotion.lengthRatios().map(x=>x.toFixed(6)).join(',');
    canvas.dataset.earMode = $('ear-pose').value;
  }
}
function canAnimate() {
  return state.ready && !state.destroyed && state.visible && state.hostVisible && !document.hidden
    && (state.playing || state.bumpUntil > performance.now());
}
function tick(now) {
  state.raf = 0;
  if (!canAnimate()) { state.last = 0; return; }
  const dt = state.last ? Math.min((now - state.last) / 1000, .045) : 0;
  state.last = now;
  if (state.playing) {
    state.time += dt;
    if (!state.dragging) state.yaw += dt * 2 * Math.PI / state.period;
  }
  else if (state.clickTime >= 0) {
    state.clickTime += dt;
    if (state.clickTime >= .5) state.clickTime = -1;
  }
  // A squeeze impulse followed by an underdamped spring gives a visible stretch and rebound.
  const pulse = Math.floor(state.time * 2);
  if (pulse !== state.pulse) {
    state.pulse = pulse;
    if (state.playing && state.elastic) kick(state, state.strength);
  }
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    springStep(state, h, state.strength);
  }
  earMotion?.step(dt,verticalVelocity(),state.earsEnabled ? $('ear-pose').value : 'rest',state.earStrength);
  render();
  if (canAnimate()) state.raf = requestAnimationFrame(tick);
}
function schedule() {
  if (canAnimate() && !state.raf) { state.last = 0; state.raf = requestAnimationFrame(tick); }
  if (!canAnimate() && state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; state.last = 0; }
}
function bounce() {
  if (!state.ready) return;
  // A direct click is an explicit request for this brief motion, even when idle is paused.
  kick(state, state.strength, 1.3);
  state.clickTime = 0;
  state.bumpUntil = performance.now() + 1800;
  schedule();
}
function resize() {
  if (!renderer || state.destroyed) return;
  const {width, height} = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.set(0, 1.36, Math.max(4.75, 4.25 / camera.aspect));
  camera.lookAt(0, .94, 0);
  camera.updateProjectionMatrix();
  render();
}
function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(t => { t.source?.data?.close?.(); t.dispose(); });
  materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}
function dispose() {
  if (state.destroyed) return;
  state.destroyed = true;
  cancelAnimationFrame(state.raf);
  resizeObserver?.disconnect(); intersectionObserver?.disconnect();
  cleanup.forEach(fn => fn());
  if (scene) disposeObject(scene);
  renderer?.dispose();
}

async function init() {
  syncControls(false);
  renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true, powerPreference: 'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0x81768f, 2.4));
  const key = new THREE.DirectionalLight(0xfff5e8, 3.1); key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xe7ddff, 1.7); rim.position.set(3, 3, -3); scene.add(rim);
  spin = new THREE.Group(); deform = new THREE.Group(); spin.add(deform); scene.add(spin);

  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 7, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(64,41,77,.27)'); gradient.addColorStop(.5, 'rgba(64,41,77,.12)'); gradient.addColorStop(1, 'rgba(64,41,77,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.006; scene.add(shadow);

  const gltf = await new GLTFLoader().loadAsync(sourceURL.href);
  if (state.destroyed) { disposeObject(gltf.scene); return; }
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.length())) throw new Error('Invalid model bounds');
  const scale = 2 / size.y;
  gltf.scene.scale.multiplyScalar(scale);
  gltf.scene.position.add(new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale));
  deform.add(gltf.scene);
  gltf.scene.updateWorldMatrix(true,true);
  earMotion = character === 'amiya' ? attachEarMotion(gltf.scene) : null;
  if (character === 'amiya' && !earMotion) throw new Error('Missing independent ear bones');
  canvas.dataset.skinnedMeshCount = String(gltf.scene.getObjectsByProperty('isSkinnedMesh',true).length);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m?.isMeshStandardMaterial && !m.map) { m.roughness = .82; m.metalness = 0; }
    }
  });
  state.ready = true;
  canvas.dataset.loaded = 'true';
  $('poster').hidden = true; $('status').textContent = '';
  $('play').disabled = $('bounce').disabled = false;
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
  intersectionObserver = new IntersectionObserver(entries => {
    state.visible = entries[0].isIntersecting; schedule();
  }, {threshold: .01}); intersectionObserver.observe(stage);
  resize(); schedule();
  syncControls(false);
  if (parent !== window) parent.postMessage({type:'priestess-viewer-ready'},location.origin);
}

listen($('character-select'),'change',e=>{
  const url = new URL(location.href); url.searchParams.set('character',e.target.value); location.href = url.href;
});
listen($('ears-enabled'),'change',e=>{state.earsEnabled=e.target.checked; if (!state.earsEnabled) earMotion?.setPose('rest'); render();});
listen($('ear-pose'),'change',e=>{
  earMotion?.setPose(e.target.value === 'follow' ? 'rest' : e.target.value); render();
});
listen($('ear-strength'),'input',e=>{state.earStrength=Number(e.target.value); $('ear-strength-value').value=state.earStrength.toFixed(2)+' 倍';});
listen($('play'), 'click', () => { state.playing = !state.playing; state.bumpUntil = 0; syncControls(); schedule(); });
listen($('bounce'), 'click', bounce);
listen($('speed'), 'input', e => { state.period = Number(e.target.value); syncControls(); render(); });
listen($('strength'), 'input', e => { state.strength = Number(e.target.value); syncControls(); });
listen($('elastic'), 'change', e => {
  state.elastic = e.target.checked;
  if (!state.elastic) { state.squash = state.sv = 0; render(); }
  syncControls();
});
for (const button of document.querySelectorAll('[data-angle]')) listen(button, 'click', () => {
  state.playing = false; state.bumpUntil = 0; state.yaw = THREE.MathUtils.degToRad(Number(button.dataset.angle));
  state.squash = state.sv = 0; syncControls(); schedule(); render();
});
let pointerStart = null;
listen(canvas, 'pointerdown', e => {
  if (!state.ready || e.button !== 0) return;
  pointerStart = {x: e.clientX, yaw: state.yaw, moved: false}; state.dragging = true;
  canvas.setPointerCapture(e.pointerId);
});
listen(canvas, 'pointermove', e => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  if (Math.abs(dx) > 5) pointerStart.moved = true;
  state.yaw = pointerStart.yaw + dx * .012; render();
});
listen(canvas, 'pointerup', () => {
  if (pointerStart && !pointerStart.moved) bounce();
  pointerStart = null; state.dragging = false;
});
listen(canvas, 'pointercancel', () => { pointerStart = null; state.dragging = false; });
listen(canvas, 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bounce(); } });
listen(document, 'visibilitychange', schedule);
listen(preference, 'change', e => {
  if (e.matches) { state.playing = false; state.bumpUntil = 0; state.squash = state.sv = 0; syncControls(); schedule(); render(); }
});
listen(window, 'message', e => {
  if (e.origin !== location.origin || e.source !== parent) return;
  if (e.data?.type === 'priestess-visibility') {
    state.hostVisible = Boolean(e.data.visible); schedule();
  }
  if (e.data?.type === 'priestess-config') {
    const config = e.data.config;
    if (!config || typeof config !== 'object') return;
    for (const key of ['playing','elastic']) if (typeof config[key] === 'boolean') state[key] = config[key];
    if (Number.isFinite(config.period)) state.period = THREE.MathUtils.clamp(config.period,.8,12);
    if (Number.isFinite(config.strength)) state.strength = THREE.MathUtils.clamp(config.strength,.3,1.8);
    if (typeof config.earsEnabled === 'boolean') {state.earsEnabled=config.earsEnabled; $('ears-enabled').checked=state.earsEnabled; if (!state.earsEnabled) earMotion?.setPose('rest');}
    if (Number.isFinite(config.earStrength)) {state.earStrength=THREE.MathUtils.clamp(config.earStrength,0,1.5); $('ear-strength').value=String(state.earStrength); $('ear-strength-value').value=state.earStrength.toFixed(2)+' 倍';}
    if (!state.elastic) state.squash = state.sv = 0;
    syncControls(); render(); schedule();
  }
});
listen(window, 'pagehide', e => { if (!e.persisted) dispose(); else { state.hostVisible = false; schedule(); } });
listen(window, 'pageshow', () => { state.hostVisible = true; schedule(); });
listen(canvas, 'webglcontextlost', e => {
  e.preventDefault(); state.ready = false; schedule(); $('poster').hidden = false;
  $('status').textContent = '显示已暂停，刷新页面可重试。'; $('play').disabled = $('bounce').disabled = true;
});
listen($('reference-toggle'), 'click', () => {
  const img = $('reference'); const show = img.hidden;
  img.hidden = !show;
  if (show) img.src = './assets/motion-reference.gif'; else img.removeAttribute('src');
  $('reference-toggle').textContent = show ? '收起动作参考' : '播放阿米娅动作参考';
  $('reference-toggle').setAttribute('aria-expanded', String(show));
});
init().catch(error => {
  console.error('[Chibi companions]', error);
  $('status').textContent = '暂时无法显示三维手办，先看看静态预览。';
  $('poster').hidden = false; canvas.hidden = true; dispose();
});
