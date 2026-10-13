# 坐姿普瑞赛斯 · 网页展示 v003

## 本地运行

在 `/home/harekasa/prts-3d` 执行：

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory web
```

打开 `http://127.0.0.1:8766/chibi-priestess/`。需要先固定正面时使用 `?paused&angle=0`；独立嵌入使用 `?embed`。

## 文件和行为

- `viewer.js`：GLB 加载、尺寸归一化、底部支点、整件旋转和弹簧形变。
- `index.html` / `style.css`：独立检查页面、动画控制和嵌入显示。
- `home-widget.js` / `home-widget.css`：首页手办、可折叠设置、音乐控制和偏好保存。
- `swarm.html` / `swarm.js`：头图内的太空小普群，单一渲染器，所有副本共享模型、材质和一份贴图。
- `physics.js`：Q弹弹簧和屏幕平面上的圆形碰撞计算，包含质量、碰撞冲量、回弹系数和边缘穿越。
- `assets/priestess-seated-v002.glb`：当前彩色模型，保持原件内容；灰模副本留在本项目作为历史。
- `assets/poster.png`：当前模型的正面静态渲染，用于加载与 WebGL 不可用时的退路。
- `assets/motion-reference.gif`：用户提供的坐姿动作参考，独立预览中默认不加载，手动展开后播放。
- `assets/friends-wine.m4a`：使用 ffmpeg 从博士提供的视频完整提取的 187.37 秒音乐，AAC 96 kbps，约 2.22 MiB。来源和参数见 `assets/music-source.json`。
- `vendor/three-r170/`：固定 Three.js 0.170.0 的官方 npm/CDN 文件及 MIT 许可证，来源和哈希记录在 `sources.json`。

默认 **2.7 秒一圈**（上一版为 5.4 秒），旋转周期可调整为 0.8–12 秒；Q弹强度可调为 0.3–1.8 倍。弹动使用欠阻尼弹簧，挤压后会拉伸回弹，并有轻微离地感。预览支持暂停、固定正侧背面、拖动和点击回弹。

首页左下角的「设置」可以展开或收起；Esc、关闭按钮或点击面板外均可收起。旋转速度、Q弹、音量等偏好保存在本地。**音乐每次进入页面默认关闭**，只在点击「音乐关」按钮后加载和播放；打开音乐会同时启用旋转和 Q弹，并将「仅漂浮」切回「漂浮 + Q弹」。关闭音乐保留当前动画设置。切换到后台、离开首页或关闭页面会暂停音轨，不会自动重新发声。

「我们需要更多小普」默认关闭。开启后，在头图中生成 2–36 只大小各异的小普，各自有旋转速度和弹动相位。子设置包含数量、整体大小、飞行速度、漂浮/Q弹状态、边框碰撞、互相碰撞及碰撞回弹。边框碰撞关闭后，小普从另一侧重新进入。碰撞使用屏幕平面的近似圆形边界，并非精确网格碰撞或布料/软体模拟；失速后有轻微巡航恢复。手机或高数量时会自动缩小小普，留出活动空间。小普层不接收鼠标事件，并为导航和下滑按钮保留顶部/底部空间。

减少动态效果偏好默认关闭自动播放和小普群，显式开启仍可播放。不可见的画面停动画，返回后继续；模型加载异常时主手办显示静态图。关闭小普群会移除其 iframe，释放渲染资源。

模型本身无骨骼、动作或 morph targets。动画发生在场景父节点上，原始网格没有被重写。当前效果没有独立发束/衣摆运动。

## 博客接入

同一运行包已复制到 `/home/harekasa/blog-source/source/priestess-chibi/`。`_config.yml` 将其设为 `skip_render`；`_config.butterfly.yml` 在页尾加载 `/priestess-chibi/home-widget.js`。iframe 使用独立 Three.js 依赖，不与原星空脚本共享场景。

博客当前本地静态预览为 `http://127.0.0.1:43271/`；该端口是本次隔离预览服务分配的。复现时，在博客目录运行 `npm run build`，然后用本地 HTTP 服务托管 `public/`。

未部署线上。本次网页检查记录见 [v003 验收](../../blender/checks/chibi-home-v003/README.md)，旧运行脚本保存在 `history/v002-runtime/`。模型原件、检查工程和造型截图见 [模型检查说明](../../blender/checks/chibi-seated-v002-textured/README.md)。

物理校验：`node web/chibi-priestess/tests/physics.test.mjs`。测试包含等质量/不同质量碰撞的动量及能量、墙壁反射、穿越边缘、关闭碰撞、密集小普稳定性和弹簧收敛。
