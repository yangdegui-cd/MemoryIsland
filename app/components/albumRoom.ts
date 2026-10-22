import * as THREE from 'three';

// Six square atlas faces require a cube. Every size below derives from its span.
export const ROOM_SPAN = 360;
export const palaceBounds = new THREE.Box3(
  new THREE.Vector3(-ROOM_SPAN / 2, -12, -ROOM_SPAN / 2),
  new THREE.Vector3(ROOM_SPAN / 2, ROOM_SPAN - 12, ROOM_SPAN / 2),
);
export const cameraBounds = palaceBounds.clone().expandByScalar(-ROOM_SPAN * .075);
export const focusBounds = palaceBounds.clone().expandByScalar(-ROOM_SPAN * .22);
export const navigation = {
  start: new THREE.Vector3(0, 50, 132),
  target: new THREE.Vector3(0, 88, -20),
  minDistance: ROOM_SPAN * .13,
  maxDistance: ROOM_SPAN * .64,
};

export function containCamera(position: THREE.Vector3, target: THREE.Vector3) {
  const x = target.x, y = target.y, z = target.z;
  target.clamp(focusBounds.min, focusBounds.max);
  position.x += target.x - x;
  position.y += target.y - y;
  position.z += target.z - z;
  // Intersect the viewing ray with the safe room, rather than clamping three
  // axes independently (which changes heading and makes the camera slide/jump).
  let fraction = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = position[axis] - target[axis];
    if (delta > 0) fraction = Math.min(fraction, (cameraBounds.max[axis] - target[axis]) / delta);
    if (delta < 0) fraction = Math.min(fraction, (cameraBounds.min[axis] - target[axis]) / delta);
  }
  position.lerpVectors(target, position, Math.max(0, fraction));
  position.clamp(cameraBounds.min, cameraBounds.max);
}

export function photoLayout(index: number) {
  const phase = index * 2.399963;
  const near = [
    [-.05, .23, .24], [.061, .155, .20], [-.19, .34, .13],
    [.20, .43, .05], [-.14, .12, .09], [.13, .56, -.04],
  ];
  const position = index < near.length
    ? new THREE.Vector3(...near[index] as [number, number, number]).multiplyScalar(ROOM_SPAN)
    : new THREE.Vector3(
      Math.sin(phase) * ROOM_SPAN * (.18 + index % 4 * .035),
      ROOM_SPAN * ([.15, .29, .44, .60, .73][index % 5] + Math.sin(phase) * .025),
      ROOM_SPAN * (-.05 - Math.floor((index - 6) / 7) * .045 + Math.cos(phase) * .025),
    );
  // Stable random print formats; live distance scaling is applied separately.
  const random = (seed: number) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const width = ROOM_SPAN * (.020 + random(index + 1) * .021);
  const formats = [1.24, .79, 1.08, 1.38, .86];
  const height = width * formats[Math.floor(random(index + 30) * formats.length)];
  const angles = new THREE.Vector3(
    [.05, -.07, .09, -.04][index % 4],
    [-.25, .32, -.65, .5, 2.65, 1.12, -2.7, .38, -.85, .16][index % 10],
    (index % 5 - 2) * .018,
  );
  return { position, width, height, angles, phase };
}

export const MAX_PHOTO_SCALE = 1.55;
export function photoScale(distance: number) {
  return THREE.MathUtils.lerp(MAX_PHOTO_SCALE, .62, THREE.MathUtils.smoothstep(distance, ROOM_SPAN * .15, ROOM_SPAN * .84));
}

export type PaperWindState = { bend: number };
export function stepPaperWind(state: PaperWindState, time: number, dt: number, phase: number) {
  // Smooth pressure bends the paper in its shader; no object translation or
  // rigid swinging is applied to the fixed suspension point.
  const wind = Math.sin(time * .43 + phase * .07) * .55 + Math.sin(time * .67 + phase * .13) * .2;
  state.bend = THREE.MathUtils.damp(state.bend,wind,1.8,Math.min(dt,.06));
}
