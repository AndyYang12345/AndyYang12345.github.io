import * as THREE from './vendor/three-r170/build/three.module.js';

export function attachEarMotion(model) {
  model.updateWorldMatrix(true, true);
  const ears = [];
  for (const [side, sign] of [['L', 1], ['R', -1]]) {
    const base = model.getObjectByName(`Ear_${side}_Base`);
    const tip = model.getObjectByName(`Ear_${side}_Tip`);
    if (!base?.isBone || !tip?.isBone) return null;
    const controls = [base, tip].map(bone => {
      const world = bone.getWorldQuaternion(new THREE.Quaternion());
      return {bone, position:bone.position.clone(), quaternion:bone.quaternion.clone(),
        scale:bone.scale.clone(), axis:new THREE.Vector3(0,0,-1).applyQuaternion(world.invert()).normalize()};
    });
    const parentRotation = new THREE.Matrix4().makeRotationFromQuaternion(base.parent.getWorldQuaternion(new THREE.Quaternion()));
    base.matrixAutoUpdate = false;
    const length = base.getWorldPosition(new THREE.Vector3()).distanceTo(tip.getWorldPosition(new THREE.Vector3()));
    ears.push({sign, controls, parentRotation, inverseParent:parentRotation.clone().invert(), length});
  }
  const state = {angle:0, velocity:0, tip:0, tipVelocity:0};
  const target = (mode, vy, strength) => {
    if (mode === 'rest') return [0,0];
    if (mode === 'down') return [-6,-2];
    if (mode === 'up') return [22,7];
    const amount = THREE.MathUtils.clamp(Math.abs(vy) / .72, 0, 1) * strength;
    return vy >= 0 ? [22 * amount,7 * amount] : [-6 * amount,-2 * amount];
  };
  return {
    state,
    step(dt, vy, mode = 'follow', strength = 1) {
      const [angle, tip] = target(mode, vy, strength);
      const count = Math.max(1, Math.ceil(dt / (1/120))), h = dt / count;
      for (let i=0; i<count; i++) {
        state.velocity += (130 * (angle-state.angle) - 18 * state.velocity) * h;
        state.angle += state.velocity * h;
        state.tipVelocity += (95 * (tip-state.tip) - 15 * state.tipVelocity) * h;
        state.tip += state.tipVelocity * h;
      }
    },
    setPose(mode) {
      [state.angle,state.tip] = target(mode,0,1);
      state.velocity = state.tipVelocity = 0;
    },
    apply(widthScale, heightScale) {
      const inverseSquash = new THREE.Matrix4().makeScale(1/widthScale,1/heightScale,1/widthScale);
      for (const ear of ears) {
        const [base,tip] = ear.controls;
        const delta = new THREE.Quaternion().setFromAxisAngle(base.axis,ear.sign * THREE.MathUtils.degToRad(state.angle));
        base.bone.matrix.compose(base.position,base.quaternion.clone().multiply(delta),base.scale);
        // Cancel body squash in the ear's linear transform while its root follows the head.
        const compensation = ear.inverseParent.clone().multiply(inverseSquash).multiply(ear.parentRotation);
        base.bone.matrix.premultiply(compensation).setPosition(base.position);
        base.bone.matrixWorldNeedsUpdate = true;
        tip.bone.quaternion.copy(tip.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(tip.axis,ear.sign * THREE.MathUtils.degToRad(state.tip)));
      }
      model.updateWorldMatrix(true,true);
    },
    lengthRatios() {
      return ears.map(ear => ear.controls[0].bone.getWorldPosition(new THREE.Vector3())
        .distanceTo(ear.controls[1].bone.getWorldPosition(new THREE.Vector3())) / ear.length);
    }
  };
}
