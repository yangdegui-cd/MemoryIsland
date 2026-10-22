import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { palaceBounds, cameraBounds, focusBounds, containCamera, photoLayout, photoScale, MAX_PHOTO_SCALE, stepPaperWind } from '../app/components/albumRoom.ts';

test('large orbit, zoom and pan requests stay inside the room without changing heading', () => {
  for (let i = 0; i < 10000; i++) {
    const position = new THREE.Vector3(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * .3)).multiplyScalar(2000);
    const target = new THREE.Vector3(Math.cos(i * .7), Math.sin(i * 1.3), Math.cos(i * 3.1)).multiplyScalar(600);
    const heading = position.clone().sub(target).normalize();
    containCamera(position, target);
    assert.ok(cameraBounds.containsPoint(position));
    assert.ok(focusBounds.containsPoint(target));
    assert.ok(heading.distanceTo(position.clone().sub(target).normalize()) < 1e-10);
    const settled = position.clone();
    containCamera(position, target);
    assert.ok(settled.distanceTo(position) < 1e-10);
  }
});

test('all 60 suspended prints fit inside the palace, including their lower corners and curl', () => {
  for (let i = 0; i < 60; i++) {
    const { position, width, height } = photoLayout(i);
    const radius = Math.hypot(width / 2, height) * MAX_PHOTO_SCALE + 5;
    assert.ok(palaceBounds.containsBox(new THREE.Box3(position.clone().addScalar(-radius), position.clone().addScalar(radius))), `photo ${i}`);
  }
});

test('distance scaling is continuous, bounded and follows the current view', () => {
  let previous = photoScale(0);
  for (let distance = 1; distance <= 1000; distance++) {
    const size = photoScale(distance);
    assert.ok(size <= previous && size >= .62 && size <= MAX_PHOTO_SCALE);
    assert.ok(previous - size < .01);
    previous = size;
  }
  assert.ok(photoScale(60) > photoScale(200) * 1.5);
});

test('paper wind stays smooth and stable across frame rates', () => {
  function simulate(fps) {
    const state = { bend: 0 };
    for (let frame = 1; frame <= fps * 60; frame++) {
      const previous = state.bend;
      stepPaperWind(state, frame / fps, 1 / fps, 7);
      assert.ok(Math.abs(state.bend - previous) < .03);
      assert.ok(Math.abs(state.bend) < 1);
    }
    return state;
  }
  const slow = simulate(30), fast = simulate(120);
  assert.ok(Math.abs(slow.bend - fast.bend) < .005);
});
