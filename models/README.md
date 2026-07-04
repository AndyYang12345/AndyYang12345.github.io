# 3D Models

将你的 glTF/GLB 3D 模型文件放入此目录。

推荐格式：**.glb** (glTF Binary)，单文件便于管理。

模型将用于首页 Hero 区域的 Three.js 3D 角色展示动画。
默认加载路径：`/models/character.glb`

## 模型要求

- 三角面数：建议 < 50k（保证移动端性能）
- 材质：PBR 贴图（baseColor、normal、metallicRoughness）
- 尺寸：模型高度约 2-3 单位
- 格式：glTF 2.0（.glb 或 .gltf + 外部资源）
