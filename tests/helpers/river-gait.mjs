import {readFileSync} from 'node:fs';
import {AnimationClip, AnimationMixer, Matrix4, Object3D, QuaternionKeyframeTrack, VectorKeyframeTrack, Vector3} from 'three';

export function readGlb(path) {
  const bytes=readFileSync(path),length=bytes.readUInt32LE(12);
  if(bytes.toString('utf8',0,4)!=='glTF')throw new Error('Expected GLB');
  return {json:JSON.parse(bytes.toString('utf8',20,20+length)),bin:bytes.subarray(28+length)};
}
export function floats(asset,index) {
  const accessor=asset.json.accessors[index],view=asset.json.bufferViews[accessor.bufferView];
  if(accessor.componentType!==5126)throw new Error('Expected float accessor');
  const size={SCALAR:1,VEC3:3,VEC4:4}[accessor.type];
  const offset=(view.byteOffset??0)+(accessor.byteOffset??0),stride=view.byteStride??size*4;
  return Array.from({length:accessor.count},(_,i)=>Array.from({length:size},(_,j)=>asset.bin.readFloatLE(offset+i*stride+j*4)));
}

// Evaluate exported animation through the same Three.js mixer as the browser.
// World trajectories expose knee/ankle problems that a loop-seam test misses.
export function measureGait(asset,name='Run',includeSamples=false) {
  const doc=asset.json,source=doc.animations.find(a=>a.name===name);
  const nodes=doc.nodes.map(n=>{
    const object=new Object3D();object.name=n.name??'';
    if(n.matrix)object.applyMatrix4(new Matrix4().fromArray(n.matrix));
    else {
      if(n.translation)object.position.fromArray(n.translation);
      if(n.rotation)object.quaternion.fromArray(n.rotation);
      if(n.scale)object.scale.fromArray(n.scale);
    }
    return object;
  });
  doc.nodes.forEach((n,i)=>(n.children??[]).forEach(child=>nodes[i].add(nodes[child])));
  const root=new Object3D();nodes.filter(n=>!n.parent).forEach(n=>root.add(n));
  const tracks=source.channels.filter(c=>['rotation','translation','scale'].includes(c.target.path)).map(c=>{
    const s=source.samplers[c.sampler],rot=c.target.path==='rotation';
    const Type=rot?QuaternionKeyframeTrack:VectorKeyframeTrack;
    return new Type(`${nodes[c.target.node].uuid}.${rot?'quaternion':c.target.path==='translation'?'position':'scale'}`,floats(asset,s.input).flat(),floats(asset,s.output).flat());
  });
  const clip=new AnimationClip(name,-1,tracks),mixer=new AnimationMixer(root);mixer.clipAction(clip).play();
  const names=['pelvis','Head','foot_l','foot_r','ball_l','ball_r','hand_l','hand_r'];
  const sampled=Object.fromEntries(names.map(n=>[n,[]]));
  const steps=132,dt=clip.duration/steps;
  for(let i=0;i<=steps;i++) {
    mixer.setTime(i*dt);root.updateMatrixWorld(true);
    for(const n of names)sampled[n].push(nodes.find(node=>node.name===n).getWorldPosition(new Vector3()).toArray());
  }
  const result={duration:clip.duration};
  for(const n of names) {
    const points=sampled[n],min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));
    const verticalSpeeds=points.slice(1).map((p,i)=>(p[1]-points[i][1])/dt);
    result[n]={lateral:max[0]-min[0],lift:max[1]-min[1],stride:max[2]-min[2],ground:min[1],peak:max[1],maxVerticalSpeed:Math.max(...verticalSpeeds.map(Math.abs))};
  }
  const speeds=[];
  for(const side of ['l','r']) {
    const toe=sampled['ball_'+side],feet=sampled['foot_'+side],ground=result['ball_'+side].ground;
    for(let i=1;i<feet.length;i++) if(toe[i][1]<ground+.025&&toe[i-1][1]<ground+.025) {
      const speed=Math.abs(feet[i][2]-feet[i-1][2])/dt;
      if(speed>.2)speeds.push(speed);
    }
  }
  speeds.sort((a,b)=>a-b);result.plantedSpeed=speeds[Math.floor(speeds.length/2)]??0;
  if(includeSamples)result.samples=sampled;
  mixer.stopAllAction();mixer.uncacheRoot(root);
  return result;
}
