import assert from 'node:assert/strict';
import {test} from 'node:test';
import {riverFacing,riverVelocity,RIVER_RUN_SPEED} from '../app/river/locomotion.ts';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('forward, reverse, sideways and diagonal travel face their actual direction',()=>{
  close(riverFacing(0,1,0,1),0);
  close(Math.abs(riverFacing(0,-1,0,1)),Math.PI);
  close(riverFacing(0,0,-1,1),Math.PI/2);
  close(riverFacing(0,0,1,1),-Math.PI/2);
  close(riverFacing(0,1,1,1),-Math.PI/4);
  close(riverFacing(1.2,0,0,1),1.2);
});
test('turns take the short arc across the back-facing seam and are frame-rate independent',()=>{
  const current=Math.PI-.02,target=-Math.PI+.02;
  const turned=riverFacing(current,Math.cos(target),-Math.sin(target),.1);
  close(turned-current,.04);
  let at30=0,at60=0;
  for(let i=0;i<30;i++)at30=riverVelocity(at30,RIVER_RUN_SPEED,1/30);
  for(let i=0;i<60;i++)at60=riverVelocity(at60,RIVER_RUN_SPEED,1/60);
  close(at30,at60);
  for(let i=0;i<60;i++)at60=riverVelocity(at60,0,1/60);
  assert.equal(at60,0,'Releasing input fully settles to idle');
});
