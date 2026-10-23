import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {test} from 'node:test';
import {riverCharacterForIdentity,riverCharacters} from '../app/river/characters.ts';
import {readGlb,floats,measureGait} from './helpers/river-gait.mjs';
import {RIVER_RUN_SPEED,RIVER_GAIT_RATE} from '../app/river/locomotion.ts';

function jointIndices(asset,index) {
  const a=asset.json.accessors[index],v=asset.json.bufferViews[a.bufferView];
  const width=a.componentType===5121?1:2;
  assert.ok(a.componentType===5121||a.componentType===5123);
  const offset=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??4*width;
  return Array.from({length:a.count},(_,i)=>Array.from({length:4},(_,j)=>width===1?asset.bin.readUInt8(offset+i*stride+j):asset.bin.readUInt16LE(offset+i*stride+j*width)));
}

test('logged-in identities select their corresponding complete character assets',()=>{
  assert.equal(riverCharacterForIdentity('alexx'),'alexx');
  assert.equal(riverCharacterForIdentity('bv'),'bv');
  assert.notEqual(riverCharacters.alexx.model,riverCharacters.bv.model);
});

for (const [identity,character] of Object.entries(riverCharacters)) test(`${identity} has a textured skin and looping, in-place Idle/Run actions`,()=>{
  const path=new URL('../public'+character.model,import.meta.url);assert.ok(existsSync(path));
  const asset=readGlb(path),g=asset.json;
  assert.ok(g.images?.length>0,'Author textures are embedded');
  assert.ok(g.skins?.some(s=>s.joints.length>=20),'Full limb and secondary-motion skeleton');
  const meshNodes=g.nodes.filter(n=>n.mesh!==undefined);
  const skins=meshNodes.filter(n=>n.skin!==undefined);assert.ok(skins.length>=6);
  assert.equal(skins.length,meshNodes.length,'Every model part follows the skeleton');
  for(const node of skins) for(const primitive of g.meshes[node.mesh].primitives) {
    assert.ok(primitive.attributes.JOINTS_0!==undefined);
    assert.ok(primitive.attributes.WEIGHTS_0!==undefined);
    const material=g.materials[primitive.material];
    if(material.pbrMetallicRoughness?.baseColorTexture) assert.ok(primitive.attributes.TEXCOORD_0!==undefined,'Textured material has UVs');
    assert.equal(material.alphaMode??'OPAQUE','OPAQUE','Body silhouette is geometry, not an alpha card');
    for(const weights of floats(asset,primitive.attributes.WEIGHTS_0)) {
      assert.ok(weights.every(w=>Number.isFinite(w)&&w>=0));
      assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-4,'All vertices have normalized skin weights');
    }
    const positions=floats(asset,primitive.attributes.POSITION);
    const weights=floats(asset,primitive.attributes.WEIGHTS_0),joints=jointIndices(asset,primitive.attributes.JOINTS_0);
    for(let i=0;i<positions.length;i++) {
      const [x,y]=positions[i];
      if(Math.abs(x)<.30&&y>.90&&y<1.10) for(let j=0;j<4;j++) {
        const bone=g.nodes[g.skins[node.skin].joints[joints[i][j]]].name;
        assert.ok(weights[i][j]<1e-5||!/arm|hand/.test(bone),'Hip vertices must not follow the hands while running');
      }
    }
  }
  const anatomy=meshNodes.find(n=>/authored head and neck/.test(n.name));assert.ok(anatomy,'Artist-authored head is present');
  const bounds=g.accessors[g.meshes[anatomy.mesh].primitives[0].attributes.POSITION];
  assert.ok(bounds.max[2]-bounds.min[2]>.12,'Head has physical depth');
  const clothing=g.materials.filter(m=>/Ranger/.test(m.name));assert.ok(clothing.length);
  for(const material of clothing) {
    assert.ok(material.normalTexture,'Clothing retains authored surface relief');
    assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture,'Leather and metal keep their different responses');
  }
  const hair=g.materials.find(m=>/Hair/.test(m.name));
  const color=hair.pbrMetallicRoughness.baseColorFactor;
  assert.ok(color,'Hair color survives the Blender to glTF export');
  if(identity==='alexx')assert.ok(color[0]>color[1]*5,'Alexx has red hair');
  else assert.ok(Math.max(...color.slice(0,3))<.03,'BV has black hair');
  for(const name of ['Idle','Run','Walk']) {
    const clip=g.animations.find(a=>a.name===name);assert.ok(clip,`${name} exported`);
    let changingChannels=0;
    for(const channel of clip.channels) {
      const sampler=clip.samplers[channel.sampler];
      const times=floats(asset,sampler.input),values=floats(asset,sampler.output);
      assert.ok(times.at(-1)[0]>0);
      const first=values[0],last=values.at(-1);
      assert.ok(first.every((v,i)=>Math.abs(v-last[i])<1e-5),`${name} loop closes`);
      const moving=values.some(row=>row.some((v,i)=>Math.abs(v-first[i])>.001));
      if(moving)changingChannels++;
      if(g.nodes[channel.target.node].name==='root'&&channel.target.path==='translation') assert.ok(!moving,'Animation must not move the scene root');
    }
    assert.ok(changingChannels>=4,`${name} animates several joints`);
    if(name==='Run') {
      const seamSpeeds=[0,0];
      const angle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,x,i)=>sum+x*b[i],0))/Math.hypot(...a)/Math.hypot(...b)));
      for(const channel of clip.channels) {
        if(channel.target.path!=='rotation'||!['thigh_l','thigh_r','calf_l','calf_r'].includes(g.nodes[channel.target.node].name))continue;
        const sampler=clip.samplers[channel.sampler],times=floats(asset,sampler.input),values=floats(asset,sampler.output);
        seamSpeeds[0]+=angle(values[0],values[1])/(times[1][0]-times[0][0]);
        seamSpeeds[1]+=angle(values.at(-2),values.at(-1))/(times.at(-1)[0]-times.at(-2)[0]);
      }
      assert.ok(Math.min(...seamSpeeds)>1,'Legs do not hold a still pose at the jog seam');
      assert.ok(Math.max(...seamSpeeds)/Math.min(...seamSpeeds)<1.2,'Loop entry/exit angular speeds match, not just the endpoint pose');
    }
  }
});

for(const [identity,character] of Object.entries(riverCharacters)) test(`${identity} uses a compact grounded gait without sideways ankle swings`,()=>{
  const gait=measureGait(readGlb(new URL('../public'+character.model,import.meta.url)));
  assert.ok(gait.duration/RIVER_GAIT_RATE>=.55&&gait.duration/RIVER_GAIT_RATE<=.75,'Quicker short steps retain a complete two-step running cycle');
  assert.ok(gait.pelvis.lift>.015&&gait.pelvis.lift<.03,'Weight transfer stays subtle without locking the hips');
  assert.ok(gait.pelvis.maxVerticalSpeed*RIVER_GAIT_RATE<.2,'No short vertical kick at the actual playback speed');
  assert.ok(gait.Head.lift<.05&&gait.Head.maxVerticalSpeed*RIVER_GAIT_RATE<.3,'Head motion remains restrained at the quicker cadence');
  for(const side of ['l','r']) {
    const foot=gait['foot_'+side],toe=gait['ball_'+side];
    assert.ok(foot.lift<.17,'Swing foot stays near the road');
    assert.ok(foot.maxVerticalSpeed*RIVER_GAIT_RATE<2,'Intermediate frames must not kick vertically when an IK knee straightens');
    assert.ok(foot.stride<.60,'Faster travel uses shorter steps, not a larger ankle sweep');
    assert.ok(foot.lateral<.09,'Shortening the step must not introduce sideways kicking');
    assert.ok(toe.ground>-.01,'Toes stay above the ground');
    assert.ok(gait['hand_'+side].stride<.50,'Hands retain a restrained swing rather than sweeping past the torso');
  }
  assert.ok(Math.abs(gait.foot_l.stride-gait.foot_r.stride)<.08,'Both legs take comparable steps');
  assert.ok(Math.abs(gait.plantedSpeed*character.scale*RIVER_GAIT_RATE-RIVER_RUN_SPEED)<.15,'Road speed matches the smaller planted-foot steps');
});
