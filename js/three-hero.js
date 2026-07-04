/**
 * Three.js Hero — 首页星空粒子背景
 * 在 Butterfly 主题 #page-header 区域嵌入 Three.js Canvas，
 * 渲染深邃星空粒子系统，支持鼠标视差、缓慢旋转、响应式适配、PJAX 兼容。
 *
 * 依赖：Three.js (CDN importmap)
 */
import * as THREE from 'three';

// ============================================
// 配置
// ============================================
const CONFIG = {
  // 星星数量
  starCount: 1800,
  // 空间分布范围（半径）
  spreadRadius: 12,
  // 基础自转速度（弧度/秒）
  autoRotateSpeed: 0.04,
  // 鼠标视差强度（0-1，控制旋转幅度）
  mouseParallax: 0.4,
  // 相机位移视差（跟随鼠标平移，产生前景/背景深度差）
  cameraShift: 0.8,
  // 平滑插值系数
  lerpFactor: 0.03,
  // 相机 FOV
  cameraFov: 60,
  // 移动端星星数量倍率
  mobileStarRatio: 0.6,
  // 移动端像素比上限
  mobilePixelRatio: 1.5,
  desktopPixelRatio: Math.min(window.devicePixelRatio, 2),
  // 闪烁速度
  twinkleSpeed: 0.8,
};

// 星空配色 — 以白/蓝白为主，混入少量紫色调与博客主题呼应
const STAR_PALETTE = [
  new THREE.Color('#ffffff'),  // 纯白（主序星）
  new THREE.Color('#f8f0ff'),  // 微紫白
  new THREE.Color('#e8e0ff'),  // 淡紫白
  new THREE.Color('#d0d8ff'),  // 淡蓝白
  new THREE.Color('#c8d0f8'),  // 蓝白
  new THREE.Color('#fff8f0'),  // 暖白
  new THREE.Color('#f0f0ff'),  // 冷白
  new THREE.Color('#e0d8ff'),  // 浅紫
  new THREE.Color('#ffe8d0'),  // 暖黄白（少量）
  new THREE.Color('#d8e0ff'),  // 淡蓝
];

// ============================================
// 工具函数
// ============================================
function isHomePage() {
  const path = window.location.pathname;
  return path === '/' || path === '/index.html' || !!document.querySelector('#site-info');
}

function isMobile() {
  return window.innerWidth <= 768;
}

function lerp(current, target, factor) {
  return current + (target - current) * factor;
}

function randomFromPalette() {
  return STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)].clone();
}

// ============================================
// Three.js Hero 类
// ============================================
class ThreeHero {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.stars = null;          // 主星群
    this.brightStars = null;    // 亮星（大号光点）
    this.clock = new THREE.Clock();

    // 鼠标状态
    this.mouse = { x: 0, y: 0 };
    this.targetRotX = 0;
    this.targetRotY = 0;
    this.currentRotX = 0;
    this.currentRotY = 0;

    // 状态
    this.isRunning = false;
    this.animationId = null;

    // 粒子属性（用于闪烁动画）
    this.starBaseSizes = null;
    this.starTwinklePhases = null;
  }

  // ------------------------------------------
  // 初始化入口
  // ------------------------------------------
  init() {
    if (!isHomePage()) return;

    const header = document.querySelector('#page-header');
    if (!header) {
      console.warn('[ThreeHero] #page-header 未找到，跳过初始化');
      return;
    }

    if (!this._checkWebGL()) {
      console.warn('[ThreeHero] WebGL 不可用');
      return;
    }

    this._injectCanvas(header);
    this._initScene();
    this._createStarfield();
    this._initCamera();
    this._bindEvents();
    this._startLoop();
  }

  // ------------------------------------------
  // 销毁
  // ------------------------------------------
  destroy() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.scene = null;
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;

    this._unbindEvents();
    console.log('[ThreeHero] 已销毁');
  }

  // ------------------------------------------
  // WebGL 检测
  // ------------------------------------------
  _checkWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    } catch {
      return false;
    }
  }

  // ------------------------------------------
  // Canvas 注入
  // ------------------------------------------
  _injectCanvas(header) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'three-hero-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
      display: block;
    `;

    // 移除 header 的静态背景图，用星空 Canvas 完全覆盖
    header.style.backgroundImage = 'none';
    header.style.backgroundColor = '#050510';

    const computedPosition = getComputedStyle(header).position;
    if (computedPosition === 'static') {
      header.style.position = 'relative';
    }

    header.insertBefore(this.canvas, header.firstChild);
  }

  // ------------------------------------------
  // 场景初始化
  // ------------------------------------------
  _initScene() {
    this.scene = new THREE.Scene();

    const pixelRatio = isMobile()
      ? Math.min(CONFIG.mobilePixelRatio, window.devicePixelRatio)
      : Math.min(CONFIG.desktopPixelRatio, window.devicePixelRatio);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !isMobile(),
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
  }

  // ------------------------------------------
  // 星空粒子系统
  // ------------------------------------------
  _createStarfield() {
    const count = isMobile()
      ? Math.floor(CONFIG.starCount * CONFIG.mobileStarRatio)
      : CONFIG.starCount;

    // --- 主星群：PointsMaterial ---
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    this.starBaseSizes = new Float32Array(count);
    this.starTwinklePhases = new Float32Array(count);

    const radius = CONFIG.spreadRadius;

    for (let i = 0; i < count; i++) {
      // 球形均匀分布（拒绝采样，避免中心过密）
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.4 + Math.random() * 0.6); // 避免中心空洞

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // 颜色
      const color = randomFromPalette();
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // 大小：大部分小星，少量大星（power-law 分布）
      const sizeRand = Math.random();
      const baseSize = sizeRand < 0.85
        ? 0.01 + Math.random() * 0.03   // 85% 小星
        : sizeRand < 0.97
          ? 0.04 + Math.random() * 0.06  // 12% 中星
          : 0.08 + Math.random() * 0.12; // 3% 亮星

      sizes[i] = baseSize;
      this.starBaseSizes[i] = baseSize;

      // 随机闪烁相位
      this.starTwinklePhases[i] = Math.random() * Math.PI * 2;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 圆形光点贴图
    const spriteCanvas = this._createGlowTexture();
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas);

    const starMat = new THREE.PointsMaterial({
      size: 0.08,
      map: spriteTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });

    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);

    // --- 散布一些较大光晕点（Sprite）增加层次感 ---
    this._createGlowSprites(radius);
  }

  // ------------------------------------------
  // 光点贴图（径向渐变圆）
  // ------------------------------------------
  _createGlowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.6, 'rgba(200, 180, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return canvas;
  }

  // ------------------------------------------
  // 大型光晕 Sprite（散布在空间中的亮斑）
  // ------------------------------------------
  _createGlowSprites(radius) {
    const group = new THREE.Group();
    const glowCount = isMobile() ? 6 : 12;

    const glowTexture = new THREE.CanvasTexture(this._createGlowTexture());

    for (let i = 0; i < glowCount; i++) {
      const spriteMat = new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.25,
        color: randomFromPalette(),
      });

      const sprite = new THREE.Sprite(spriteMat);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.5 + Math.random() * 0.5);
      sprite.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      const s = 0.5 + Math.random() * 2.0;
      sprite.scale.set(s, s, 1);
      group.add(sprite);
    }

    this.brightStars = group;
    this.scene.add(group);
  }

  // ------------------------------------------
  // 相机
  // ------------------------------------------
  _initCamera() {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.cameraFov,
      aspect,
      0.1,
      50
    );
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);
  }

  // ------------------------------------------
  // 事件绑定
  // ------------------------------------------
  _bindEvents() {
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onPjaxComplete = this._handlePjaxComplete.bind(this);

    document.addEventListener('mousemove', this._onMouseMove, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    document.addEventListener('pjax:complete', this._onPjaxComplete);
  }

  _unbindEvents() {
    if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._onVisibilityChange) document.removeEventListener('visibilitychange', this._onVisibilityChange);
    if (this._onPjaxComplete) document.removeEventListener('pjax:complete', this._onPjaxComplete);
  }

  // ------------------------------------------
  // 鼠标移动 — 视差偏移
  // ------------------------------------------
  _handleMouseMove(event) {
    const header = document.querySelector('#page-header');
    if (!header) return;

    const rect = header.getBoundingClientRect();

    if (
      event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
    ) {
      this.mouse.x = 0;
      this.mouse.y = 0;
      return;
    }

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // ------------------------------------------
  // 窗口大小调整
  // ------------------------------------------
  _handleResize() {
    if (!this.canvas || !this.renderer || !this.camera) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const pixelRatio = isMobile()
      ? Math.min(CONFIG.mobilePixelRatio, window.devicePixelRatio)
      : Math.min(CONFIG.desktopPixelRatio, window.devicePixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
  }

  // ------------------------------------------
  // 页面可见性
  // ------------------------------------------
  _handleVisibilityChange() {
    if (document.hidden) {
      this.isRunning = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    } else {
      this.isRunning = true;
      this.clock.getDelta();
      this._animate();
    }
  }

  // ------------------------------------------
  // PJAX 页面切换
  // ------------------------------------------
  _handlePjaxComplete() {
    if (isHomePage()) {
      console.log('[ThreeHero] PJAX 返回首页，重新初始化');
      this.destroy();
      requestAnimationFrame(() => this.init());
    } else {
      this.destroy();
    }
  }

  // ------------------------------------------
  // 动画循环
  // ------------------------------------------
  _startLoop() {
    this.isRunning = true;
    this._animate();
  }

  _animate() {
    if (!this.isRunning) return;

    this.animationId = requestAnimationFrame(() => this._animate());

    if (!this.renderer || !this.scene || !this.camera) return;

    const delta = this.clock.getDelta();
    const dt = Math.min(delta, 0.1);
    const elapsed = this.clock.getElapsedTime();

    // --- 鼠标视差目标 ---
    this.targetRotX = this.mouse.y * CONFIG.mouseParallax;
    this.targetRotY = this.mouse.x * CONFIG.mouseParallax;

    // --- 平滑插值 ---
    this.currentRotX = lerp(this.currentRotX, this.targetRotX, CONFIG.lerpFactor);
    this.currentRotY = lerp(this.currentRotY, this.targetRotY, CONFIG.lerpFactor);

    // --- 相机位移视差（前景星比背景星移动更多，产生深度感）---
    const targetCamX = this.mouse.x * CONFIG.cameraShift * 0.6;
    const targetCamY = this.mouse.y * CONFIG.cameraShift * 0.4;
    this.camera.position.x = lerp(this.camera.position.x, targetCamX, CONFIG.lerpFactor);
    this.camera.position.y = lerp(this.camera.position.y, targetCamY, CONFIG.lerpFactor);
    this.camera.lookAt(0, 0, 0);

    // --- 旋转星空 ---
    if (this.stars) {
      // 基础缓慢自转（绕 Y 轴 + 轻微绕 X 轴）
      this.stars.rotation.y += CONFIG.autoRotateSpeed * dt;

      // 叠加鼠标视差
      this.stars.rotation.y += (this.currentRotY - this.stars.rotation.y % (Math.PI * 2)) * 0.01;
      this.stars.rotation.x = lerp(this.stars.rotation.x, this.currentRotX * 0.3, 0.02);

      // --- 星星闪烁 ---
      const sizeAttr = this.stars.geometry.getAttribute('size');
      if (sizeAttr && this.starBaseSizes) {
        const arr = sizeAttr.array;
        for (let i = 0; i < arr.length; i++) {
          // 正弦闪烁，每颗星有自己的相位
          const twinkle = 0.5 + 0.5 * Math.sin(
            elapsed * CONFIG.twinkleSpeed + this.starTwinklePhases[i]
          );
          // 亮星闪烁幅度更大
          const base = this.starBaseSizes[i];
          const amplitude = base > 0.06 ? 0.5 : 0.25;
          arr[i] = base * (1 - amplitude + amplitude * twinkle);
        }
        sizeAttr.needsUpdate = true;
      }
    }

    // 光晕也跟随旋转
    if (this.brightStars) {
      this.brightStars.rotation.y += CONFIG.autoRotateSpeed * 0.7 * dt;
      this.brightStars.rotation.x = lerp(
        this.brightStars.rotation.x,
        this.currentRotX * 0.2,
        0.02
      );
    }

    // --- 渲染 ---
    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================
// 启动
// ============================================
const heroInstance = new ThreeHero();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => heroInstance.init());
} else {
  heroInstance.init();
}

window.__threeHero = heroInstance;
