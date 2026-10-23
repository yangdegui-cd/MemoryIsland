import assert from 'node:assert/strict';
import {test} from 'node:test';
import {roadModuleZ, ROAD_MODULE_COUNT, ROAD_MODULE_LENGTH} from '../app/river/roadMotion.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('paving and piers keep moving toward the camera across each 2.2-unit boundary',()=>{
  for(const index of [10,12,13,18]) for(const boundary of [2.2,4.4,6.6,13.2]) {
    close(roadModuleZ(index,boundary+.01)-roadModuleZ(index,boundary-.01),.02);
    close(roadModuleZ(index,boundary-.01)-roadModuleZ(index,boundary+.01),-.02);
  }
});
test('full loop preserves piers and the four-module reference paving, including negative travel',()=>{
  assert.equal(ROAD_MODULE_COUNT%6,0);
  assert.equal(ROAD_MODULE_COUNT%4,0);
  const loop=ROAD_MODULE_COUNT*ROAD_MODULE_LENGTH;
  for(const index of [0,10,13,71]) for(const distance of [-1000,-2.21,0,2.21,1000]) {
    close(roadModuleZ(index,distance),roadModuleZ(index,distance+loop));
    assert.ok(roadModuleZ(index,distance)<=20&&roadModuleZ(index,distance)>20-loop-1e-8);
  }
});
