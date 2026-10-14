export const characters = {
  smile: {name:'笑小普', file:'priestess-smile-seated-v001.glb', poster:'priestess-smile-poster.png', triangles:23162},
  amiya: {name:'阿米娅', file:'amiya-seated-ear-rig-v001.glb', poster:'amiya-poster.png', triangles:23226},
  original: {name:'泪眼小普', file:'priestess-seated-v002.glb', poster:'poster.png', triangles:21984}
};
export function characterKey(value) {
  return Object.hasOwn(characters,value) ? value : 'smile';
}
