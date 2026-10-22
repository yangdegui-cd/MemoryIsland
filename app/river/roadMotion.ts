// Recycle full road modules behind the camera. The pool length must preserve
// the three-module pier pattern and six-module paving medallion pattern.
export const ROAD_MODULE_LENGTH = 2.2;
export const ROAD_MODULE_COUNT = 72;
export function roadModuleZ(index: number, distance: number) {
  const length = ROAD_MODULE_COUNT * ROAD_MODULE_LENGTH;
  const offset = index * ROAD_MODULE_LENGTH - distance;
  return 20 - ((offset % length + length) % length);
}
