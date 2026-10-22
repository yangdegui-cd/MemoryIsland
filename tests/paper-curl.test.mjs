import assert from 'node:assert/strict';
import {curlPoint,turnProgress} from '../app/mood/paperCurl.ts';

for(const width of [280,500,700])for(const y of [-300,0,300]){
 for(const x of [0,width*.25,width*.5,width]){
  assert.deepEqual(curlPoint(x,y,width,0),{x,y,z:0});
  assert.deepEqual(curlPoint(x,y,width,1),{x:-x,y,z:0});
  for(let step=1;step<100;step++){
   const point=curlPoint(x,y,width,step/100);
   assert.ok(Object.values(point).every(Number.isFinite),'no invalid vertices during a fold');
   assert.ok(point.z>=0,'paper stays above the stationary page');
  }
 }
 for(let step=0;step<=100;step++)assert.deepEqual(curlPoint(0,y,width,step/100),{x:step===100?-0:0,y,z:0},'spine stays attached');
 const fold=curlPoint(width*.5,0,width,.5);
 assert.ok(fold.z>width*.05,'middle of the page actually bends');
 const before=curlPoint(width*.7,0,width,.9999),end=curlPoint(width*.7,0,width,1);
 assert.ok(Math.hypot(before.x-end.x,before.y-end.y,before.z-end.z)<width*.002,'paper lands without a position jump');
}
for(let step=1;step<=100;step++)assert.ok(turnProgress(step/100)>turnProgress((step-1)/100));
const h=.0001;
assert.ok((turnProgress(.5+h)-turnProgress(.5-h))/(2*h)>1.4,'one continuous curve without a midpoint stop');
console.log('PASS attached spine, curved paper, finite mesh, continuous landing and uninterrupted midpoint.');
