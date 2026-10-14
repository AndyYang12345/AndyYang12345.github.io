import * as THREE from 'three';
import {clone as cloneSkin} from 'three/addons/utils/SkeletonUtils.js';
import {attachEarMotion} from './ear-motion.js?v=004';
import {characters,characterKey} from './characters.js?v=004';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {stepDiscs, springStep, kick} from './physics.js?v=003';

const canvas = document.getElementById('swarm');
const status = document.getElementById('swarm-status');
const selectedCharacter=characterKey(new URLSearchParams(location.search).get('character'));
const config = {earsEnabled:true,earStrength:1,playing:!matchMedia('(prefers-reduced-motion: reduce)').matches, elastic:true,
  period:2.7, strength:1.15, count:12, size:1, speed:1, edges:true, collide:false,
  restitution:.94, motion:'bounce'};
let renderer, scene, camera, template, observer, ready = false, destroyed = false;
let hostVisible = true, raf = 0, last = 0, time = 0, reportAt = 0, impacts = 0;
let bodies = [], bounds = {x:7, y:4.5}, effectiveSize = 1;
const send = data => { if (parent !== window) parent.postMessage(data, location.origin); };
const clamp = (n, lo, hi, fallback) => Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Number(n))) : fallback;

function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) {
      materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  textures.forEach(t => {t.source?.data?.close?.(); t.dispose();});
  materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}

function layoutSize() {
  // Keep a dense/mobile crowd inside the window instead of filling all free space.
  const packing = Math.sqrt((4 * bounds.x * bounds.y * .30) / (config.count * Math.PI * .55 ** 2));
  effectiveSize = Math.min(config.size, packing, bounds.x / 1.3, bounds.y / 1.3);
  for (const b of bodies) { b.radius = b.baseSize * effectiveSize * .55; b.mass = b.radius ** 2; }
}

function makeBody() {
  const pivot = new THREE.Group(), turn = new THREE.Group(), rubber = new THREE.Group();
  pivot.add(turn); turn.add(rubber);
  const instance=cloneSkin(template); // Geometry/material are shared; skeletons are independent.
  rubber.add(instance);
  scene.add(pivot);
  const baseSize = .72 + Math.random() * .92;
  const heading = Math.random() * Math.PI * 2;
  const velocity = .65 + Math.random() * .7;
  const body = {pivot, turn, rubber, baseSize, radius:baseSize * effectiveSize * .55,
    mass:1, x:0, y:0, vx:Math.cos(heading) * velocity, vy:Math.sin(heading) * velocity,
    yaw:Math.random() * Math.PI * 2, spinRate:.7 + Math.random() * .65, cruise:velocity,
    ears:selectedCharacter==='amiya' ? attachEarMotion(instance) : null, phase:Math.random(), squash:0, sv:0, pulse:-1, depth:(Math.random() - .5) * 2};
  body.mass = body.radius ** 2;
  for (let attempt = 0; attempt < 80; attempt++) {
    body.x = (Math.random() * 2 - 1) * Math.max(0, bounds.x - body.radius);
    body.y = (Math.random() * 2 - 1) * Math.max(0, bounds.y - body.radius);
    if (bodies.every(b => Math.hypot(b.x-body.x, b.y-body.y) > b.radius+body.radius+.1)) break;
  }
  return body;
}

function countChanged() {
  if (!ready) return;
  while (bodies.length > config.count) {
    const old=bodies.pop(); scene.remove(old.pivot);
    old.pivot.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose();});
  }
  layoutSize();
  while (bodies.length < config.count) bodies.push(makeBody());
  layoutSize(); render(); schedule();
}

function render() {
  if (!ready || destroyed) return;
  for (const b of bodies) {
    const size = b.baseSize * effectiveSize, yScale = 1 + b.squash;
    b.pivot.position.set(b.x, b.y, b.depth);
    b.pivot.scale.setScalar(size);
    b.pivot.rotation.z = Math.sin(time * .75 + b.phase * 6.28) * .14;
    b.turn.rotation.y = b.yaw;
    b.rubber.scale.set(1 / Math.sqrt(yScale), yScale, 1 / Math.sqrt(yScale));
    b.ears?.apply(1 / Math.sqrt(yScale),yScale);
  }
  renderer.render(scene, camera);
  // A compact DOM rendering summary supports accessibility/debugging without exposing mesh internals.
  canvas.dataset.count = String(bodies.length);
  canvas.dataset.character=selectedCharacter;
  canvas.dataset.earRigCount=String(bodies.filter(b=>b.ears).length);
  canvas.dataset.playing = String(config.playing);
  canvas.dataset.motion = config.motion;
  canvas.dataset.edges = String(config.edges); canvas.dataset.collide = String(config.collide);
  canvas.dataset.period = String(config.period); canvas.dataset.impacts = String(impacts);
  canvas.dataset.textureCount = String(renderer.info.memory.textures);
  canvas.dataset.range = bodies.length ? `${Math.min(...bodies.map(b=>b.baseSize)).toFixed(2)}–${Math.max(...bodies.map(b=>b.baseSize)).toFixed(2)}` : '';
  if (time >= reportAt) {
    reportAt = time + .25;
    canvas.dataset.positions = JSON.stringify(bodies.map(b=>[+b.x.toFixed(3),+b.y.toFixed(3),+b.radius.toFixed(3)]));
    canvas.dataset.bounds = JSON.stringify(bounds);
  }
}

function canAnimate() {return ready && !destroyed && config.playing && hostVisible && !document.hidden;}
function schedule() {
  if (canAnimate() && !raf) {last = 0; raf = requestAnimationFrame(tick);}
  else if (!canAnimate() && raf) {cancelAnimationFrame(raf); raf=0; last=0;}
}
function tick(now) {
  raf = 0;
  if (!canAnimate()) {last=0; return;}
  const dt = last ? Math.min((now-last)/1000, .05) : 0; last=now; time+=dt;
  const steps = Math.max(1, Math.ceil(dt * 120)), h = dt / steps;
  const elastic = config.elastic && config.motion !== 'drift';
  for (const b of bodies) {
    const pulse = Math.floor(time * 2 + b.phase);
    if (pulse !== b.pulse) {b.pulse=pulse; if (elastic) kick(b, config.strength);}
    b.yaw += dt * Math.PI * 2 / config.period * b.spinRate;
    // Gentle propulsion brings drift back after a lossy collision, so the star flight keeps going.
    const speed=Math.hypot(b.vx,b.vy);
    if (speed>1e-8 && config.motion!=='still') {
      const restored=speed+(b.cruise-speed)*(1-Math.exp(-dt*.5));
      b.vx*=restored/speed; b.vy*=restored/speed;
    }
  }
  for (let i=0; i<steps; i++) {
    stepDiscs(bodies, h, bounds, {edges:config.edges, collide:config.collide,
      restitution:config.restitution, speed:config.speed, moving:config.motion !== 'still'}, (b, impact)=>{
      impacts++; if (elastic) kick(b, config.strength, impact);
    });
    for (const b of bodies) springStep(b, h, config.strength);
  }
  for (const b of bodies) {
    const bounceVelocity=elastic ? .72 * Math.sin((time * 2+b.phase)*Math.PI*2) : 0;
    const flightVelocity=config.motion==='still' ? 0 : b.vy * config.speed;
    b.ears?.step(dt,bounceVelocity+flightVelocity,config.earsEnabled ? 'follow' : 'rest',config.earStrength);
  }
  render(); if (canAnimate()) raf=requestAnimationFrame(tick);
}

function resize() {
  if (!renderer || destroyed) return;
  const w=innerWidth, h=innerHeight; if (!w || !h) return;
  bounds={x:4.5 * w/h, y:4.5};
  camera.left=-bounds.x; camera.right=bounds.x; camera.top=bounds.y; camera.bottom=-bounds.y;
  camera.updateProjectionMatrix(); renderer.setSize(w,h,false);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w<768 ? 1.25 : 1.5));
  layoutSize();
  // Bring all models into the resized window, even when motion is paused.
  for (const b of bodies) {b.x=clamp(b.x,-bounds.x+b.radius,bounds.x-b.radius,0); b.y=clamp(b.y,-bounds.y+b.radius,bounds.y-b.radius,0);}
  reportAt=0; render();
}

function configure(input) {
  if (!input || typeof input !== 'object') return;
  const previousCount=config.count;
  for (const k of ['playing','elastic','edges','collide','earsEnabled']) if (typeof input[k] === 'boolean') config[k]=input[k];
  config.earStrength=clamp(input.earStrength,0,1.5,config.earStrength);
  if (!config.earsEnabled) for(const b of bodies)b.ears?.setPose('rest');
  config.period=clamp(input.period,.8,12,config.period);
  config.strength=clamp(input.strength,.3,1.8,config.strength);
  config.count=Math.round(clamp(input.count,2,36,config.count));
  config.size=clamp(input.size,.5,1.8,config.size);
  config.speed=clamp(input.speed,.2,3,config.speed);
  config.restitution=clamp(input.restitution,.5,1,config.restitution);
  if (['bounce','drift','still'].includes(input.motion)) config.motion=input.motion;
  if (!config.elastic || config.motion==='drift') for (const b of bodies) b.squash=b.sv=0;
  if (previousCount !== config.count) countChanged();
  layoutSize(); reportAt=0; render(); schedule();
}

function onMessage(e) {
  if (e.origin!==location.origin || e.source!==parent) return;
  if (e.data?.type==='priestess-config') configure(e.data.config);
  if (e.data?.type==='priestess-visibility') {hostVisible=Boolean(e.data.visible); schedule();}
}
function dispose() {
  if (destroyed) return; destroyed=true; cancelAnimationFrame(raf); observer?.disconnect();
  for(const b of bodies)b.pivot.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose();});
  disposeModel(template); renderer?.dispose(); bodies=[];
  window.removeEventListener('message',onMessage);
}
window.addEventListener('message',onMessage);
document.addEventListener('visibilitychange',schedule);
window.addEventListener('pagehide', e=>{if (!e.persisted) dispose(); else {hostVisible=false; schedule();}});
window.addEventListener('pageshow',()=>{hostVisible=true; schedule();});

async function init() {
  renderer=new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setClearColor(0,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
  scene=new THREE.Scene(); camera=new THREE.OrthographicCamera(-7,7,4.5,-4.5,.05,50);
  camera.position.set(0,0,20);
  scene.add(new THREE.HemisphereLight(0xfff6ee,0x81768f,2.4));
  const key=new THREE.DirectionalLight(0xfff5e8,3.1); key.position.set(-3,5,8); scene.add(key);
  const rim=new THREE.DirectionalLight(0xe7ddff,1.7); rim.position.set(3,3,-3); scene.add(rim);
  resize();
  const gltf=await new GLTFLoader().loadAsync(new URL('./assets/'+characters[selectedCharacter].file,import.meta.url).href);
  if (destroyed) {disposeModel(gltf.scene); return;}
  const box=new THREE.Box3().setFromObject(gltf.scene), size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
  if (!(size.y>0)) throw new Error('Invalid model bounds');
  gltf.scene.scale.multiplyScalar(1/size.y); gltf.scene.position.sub(center.multiplyScalar(1/size.y));
  template=gltf.scene; ready=true; canvas.dataset.loaded='true'; status.textContent='';
  countChanged(); observer=new ResizeObserver(resize); observer.observe(document.body);
  send({type:'priestess-swarm-ready'}); schedule();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault(); ready=false; schedule(); status.textContent='小普暂时休息了，关闭后重新开启可恢复。'; send({type:'priestess-swarm-error'});});
}
init().catch(error=>{console.error('[Priestess swarm]',error); status.textContent='暂时无法唤醒小普群。'; send({type:'priestess-swarm-error'}); dispose();});
