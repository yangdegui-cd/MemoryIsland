import * as THREE from 'three';

// One source of truth for the visible six-sided room and navigation bounds.
export const roomBounds = new THREE.Box3(
  new THREE.Vector3(-12, -4, -43),
  new THREE.Vector3(12, 14, 22),
);
// Leave clearance for the near plane, columns and window frames.
export const cameraBounds = roomBounds.clone().expandByVector(new THREE.Vector3(-3.1, -1.5, -1.5));
export const focusBounds = new THREE.Box3(new THREE.Vector3(-2, 1, -24), new THREE.Vector3(2, 4, -8));

export function containCamera(position: THREE.Vector3, target: THREE.Vector3) {
  const x = target.x, y = target.y, z = target.z;
  target.clamp(focusBounds.min, focusBounds.max);
  // Move the eye with a constrained pan so reaching a wall cannot flip the view.
  position.x += target.x - x;
  position.y += target.y - y;
  position.z += target.z - z;
  position.clamp(cameraBounds.min, cameraBounds.max);
}
