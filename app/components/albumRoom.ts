import * as THREE from 'three';

// One source of truth for the visible six-sided room and navigation bounds.
export const roomBounds = new THREE.Box3(
  new THREE.Vector3(-12, -4, -43),
  new THREE.Vector3(12, 14, 22),
);
export const palaceScale = new THREE.Vector3(3.1, 3.0, 2.4);
export const palaceBounds = new THREE.Box3(
  new THREE.Vector3(-37.2, -4, -103.2), new THREE.Vector3(37.2, 50, 52.8),
);
// Leave clearance for the near plane, columns and window frames.
export const cameraBounds = palaceBounds.clone().expandByVector(new THREE.Vector3(-12, -2, -3));
export const focusBounds = new THREE.Box3(new THREE.Vector3(-5, 5, -65), new THREE.Vector3(5, 30, -15));

export function containCamera(position: THREE.Vector3, target: THREE.Vector3) {
  const x = target.x, y = target.y, z = target.z;
  target.clamp(focusBounds.min, focusBounds.max);
  // Move the eye with a constrained pan so reaching a wall cannot flip the view.
  position.x += target.x - x;
  position.y += target.y - y;
  position.z += target.z - z;
  position.clamp(cameraBounds.min, cameraBounds.max);
}
