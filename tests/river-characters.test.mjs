import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from 'three';
import {VRMHumanoid} from '@pixiv/three-vrm';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {riverCharacterForIdentity,riverCharacters} from '../app/river/characters.ts';
import {dyeForMaterial,retargetRiverClip,riverAvatarMotions,shapeBvVertex} from '../app/river/avatar.ts';
import {readGlb,floats} from './helpers/river-gait.mjs';

const assetPath = url => new URL('../public'+url,import.meta.url);
async function motion(url) {
  const data=readFileSync(assetPath(url));
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
}
function skeletonVrm(g) {
  const nodes=g.nodes.map(n=>{
    const node=new T.Object3D(); node.name=n.name;
    if(n.matrix)node.applyMatrix4(new T.Matrix4().fromArray(n.matrix));
    else {
      if(n.translation)node.position.fromArray(n.translation);
      if(n.rotation)node.quaternion.fromArray(n.rotation);
      if(n.scale)node.scale.fromArray(n.scale);
    }
    return node;
  });
  g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>nodes[i].add(nodes[c])));
  const scene=new T.Scene();g.scenes[g.scene].nodes.forEach(i=>scene.add(nodes[i]));scene.updateMatrixWorld(true);
  const humanoid=new VRMHumanoid(Object.fromEntries(g.extensions.VRM.humanoid.humanBones.map(b=>[b.bone,{node:nodes[b.node]}])));
  scene.add(humanoid.normalizedHumanBonesRoot);
  return {scene,humanoid,meta:{metaVersion:'0'}};
}

test('selected identities map to distinct VRM models and only intended materials are dyed',()=>{
  assert.equal(riverCharacterForIdentity('alexx'),'alexx'); assert.equal(riverCharacterForIdentity('bv'),'bv');
  assert.notEqual(riverCharacters.alexx.model,riverCharacters.bv.model);
  assert.equal(dyeForMaterial('alexx','M00_Hair_HAIR').color,'#ff4335');
  assert.equal(dyeForMaterial('bv','F00_Tops_01_CLOTH').color,'#9451ca');
  for(const identity of ['alexx','bv'])for(const name of ['Face_SKIN','Body_SKIN','Eye_IRIS'])assert.equal(dyeForMaterial(identity,name),null);
  assert.equal(dyeForMaterial('bv','F00_Hair_HAIR'),null,'BV retains her original dark hair');
});

for(const [identity,definition] of Object.entries(riverCharacters)) {
  test(`${identity} preserves complete textured geometry, normalized skin weights and humanoid limbs`,()=>{
    const asset=readGlb(assetPath(definition.model)),g=asset.json;
    assert.ok(g.images.length>=10);
    const bones=new Set(g.extensions.VRM.humanoid.humanBones.map(b=>b.bone));
    for(const name of ['hips','spine','head','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftUpperArm','rightUpperArm','leftHand','rightHand'])assert.ok(bones.has(name),name);
    let vertices=0;
    for(const node of g.nodes.filter(n=>n.mesh!==undefined)) {
      assert.ok(node.skin!==undefined);
      for(const primitive of g.meshes[node.mesh].primitives) {
        assert.ok(primitive.attributes.JOINTS_0!==undefined);
        assert.ok(primitive.attributes.TEXCOORD_0!==undefined);
        const weights=floats(asset,primitive.attributes.WEIGHTS_0);vertices+=weights.length;
        for(const row of weights)assert.ok(row.every(Number.isFinite)&&Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-4);
      }
    }
    assert.ok(vertices>10000,'Full artist-authored geometry, not a billboard');
  });
  test(`${identity} runs a continuous in-place Sprint on its own rest pose`,async()=>{
    const vrm=skeletonVrm(readGlb(assetPath(definition.model)).json);
    const source=await motion(riverAvatarMotions.run);
    assert.equal(source.animations[0].name,'Sprint_Loop_Rig');
    const clip=retargetRiverClip(source,vrm,'Run');
    assert.ok(clip.duration>.6&&clip.duration<.75);
    assert.ok(clip.tracks.length>=20);
    const hip=clip.tracks.find(t=>t.name.endsWith('.position'));
    for(let i=0;i<hip.values.length;i+=3)assert.equal(Math.abs(hip.values[i])+Math.abs(hip.values[i+2]),0);
    for(const track of clip.tracks) {
      assert.ok([...track.values].every(Number.isFinite));
      if(track instanceof T.QuaternionKeyframeTrack) {
        const first=new T.Quaternion().fromArray(track.values),last=new T.Quaternion().fromArray(track.values,track.values.length-4);
        assert.ok(first.angleTo(last)<.015,`${track.name} closes at the loop seam`);
      }
    }
    const mixer=new T.AnimationMixer(vrm.scene);mixer.clipAction(clip).play();
    const samples={left:[],right:[]};
    for(let i=0;i<80;i++) {
      mixer.setTime(i*clip.duration/80);vrm.humanoid.update();vrm.scene.updateMatrixWorld(true);
      for(const side of ['left','right'])samples[side].push(vrm.humanoid.getRawBoneNode(side+'Foot').getWorldPosition(new T.Vector3()));
    }
    for(const points of Object.values(samples)) {
      assert.ok(points.every(p=>Number.isFinite(p.length())&&p.length()<3),'Retarget stays within human proportions');
      assert.ok(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>.2,'Actual running heel recovery, not a walk or locked legs');
      assert.ok(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))<.2,'No sideways ankle flailing');
    }
    const idle=retargetRiverClip(await motion(riverAvatarMotions.idle),vrm,'Idle');assert.ok(idle.tracks.length>=15);
    mixer.stopAllAction();mixer.uncacheRoot(vrm.scene);
  });
}

test('BV silhouette shaping preserves limb length and modifies front chest and rear hips smoothly',()=>{
 const chest=new T.Vector3(.065,1.095,-.12),hips=new T.Vector3(.09,.825,.1);
 assert.ok(shapeBvVertex(chest).z<chest.z-.01);
 assert.ok(shapeBvVertex(hips).z>hips.z+.015);
 assert.ok(shapeBvVertex(hips).x>hips.x);
 for(const p of [new T.Vector3(.5,1.1,0),new T.Vector3(.07,.1,0),new T.Vector3(0,1.4,0)])assert.ok(shapeBvVertex(p).distanceTo(p)<1e-6);
 for(let y=.5;y<1.4;y+=.002){const a=shapeBvVertex(new T.Vector3(.08,y,-.1)),b=shapeBvVertex(new T.Vector3(.08,y+.002,-.1));assert.ok(a.distanceTo(b)<.004);}
});
