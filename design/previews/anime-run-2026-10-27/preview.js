import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

import { loadRiverAvatar } from './river-avatar.js';

const definitions = [
  {id:'C', identity:'alexx', number:'01', title:'Alexx · 赤红', detail:'亮红短发 · 红色上衣、长裤与鞋子'},
  {id:'B', identity:'bv', number:'02', title:'BV · 紫罗兰', detail:'紫黑长发 · 紫罗兰外套 · 深紫服装'},
];
const views = [];
let mode = 'Run', rate = 1;
const gltfLoader = new GLTFLoader();

const cards = document.querySelector('#cards');
for (const def of definitions) {
  const article = document.createElement('article'); article.className = 'card'; article.dataset.model = def.id;
  article.innerHTML = `<div class="viewer"><span class="status">加载模型…</span><canvas aria-label="${def.title}三维跑步预览"></canvas></div><div class="meta"><h2><span class="num">${def.number}</span>${def.title}</h2><p>${def.detail}</p><a class="source" href="https://github.com/madjin/vrm-samples/blob/master/vroid/stable/AvatarSample_${def.id}.vrm" target="_blank" rel="noopener">AvatarSample_${def.id} · 查看模型</a></div>`;
  cards.append(article);
  const host = article.querySelector('.viewer');
  const renderer = new THREE.WebGLRenderer({canvas:host.querySelector('canvas'), antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setClearColor(0,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(29,1,0.05,60); camera.position.set(1.7,1.3,3.45);
  const controls = new OrbitControls(camera,renderer.domElement); controls.target.set(0,.85,0); controls.enableDamping=true; controls.enablePan=false; controls.minDistance=1.4; controls.maxDistance=7; controls.maxPolarAngle=Math.PI*.52; controls.update();
  scene.add(new THREE.HemisphereLight(0xfff8eb,0xc4cfc2,.8));
  const key = new THREE.DirectionalLight(0xfff1dc,1.15); key.position.set(-3,6,5); key.castShadow=true; key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0001;key.shadow.normalBias=.015; scene.add(key);
  const rim = new THREE.DirectionalLight(0xddeeff,.65);rim.position.set(3,3,-3);scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.12,80),new THREE.MeshStandardMaterial({color:0xe5e6dc,roughness:.9})); floor.rotation.x=-Math.PI/2; floor.position.y=-.012; floor.receiveShadow=true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1,1.12,80),new THREE.MeshBasicMaterial({color:0xc2c9bb,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.01;scene.add(ring);
  const view = {renderer,scene,camera,controls,host,article,status:article.querySelector('.status'),mixer:null,vrm:null,actions:null};views.push(view);
  new ResizeObserver(() => { const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);
  const loader = new GLTFLoader();loader.register(parser => new VRMLoaderPlugin(parser));
  try {
    const avatar = await loadRiverAvatar(`./AvatarSample_${def.id}.vrm`, def.identity, {run:'./run.glb', idle:'./idle.glb'});
    const {vrm, runClip, idleClip} = avatar;
    scene.add(vrm.scene);
    const mixer = new THREE.AnimationMixer(vrm.scene);
    view.actions={Run:mixer.clipAction(runClip),Idle:mixer.clipAction(idleClip)};
    view.actions.Run.setEffectiveWeight(mode==='Run'?1:0).play();view.actions.Idle.setEffectiveWeight(mode==='Idle'?1:0).play();
    view.vrm=vrm;view.mixer=mixer;
    article.dataset.clip='Sprint_Loop_Rig';article.dataset.duration=String(runClip.duration);article.dataset.tracks=String(runClip.tracks.length);
    view.status.textContent='跑步 · 已加载';
  } catch(error) { view.status.textContent=`加载失败：${error.message}`;view.status.classList.add('error');console.error(error); }
}
function selectMode(value) {
  mode=value;
  document.querySelector('#run').setAttribute('aria-pressed',String(mode==='Run'));
  document.querySelector('#idle').setAttribute('aria-pressed',String(mode==='Idle'));
  for(const v of views) if(v.actions){
    v.actions.Run.fadeOut(.2);v.actions.Idle.fadeOut(.2);
    v.actions[mode].reset().setEffectiveWeight(1).fadeIn(.2).play();
  }
}
document.querySelector('#run').onclick=()=>selectMode('Run');document.querySelector('#idle').onclick=()=>selectMode('Idle');
for(const [id,position] of Object.entries({front:[0,1.3,3.7],side:[3.7,1.3,.1],back:[0,1.3,-3.7]}))document.getElementById(id).onclick=()=>{for(const v of views){v.camera.position.set(...position);v.controls.target.set(0,.85,0);v.controls.update();}};
document.querySelector('#rate').oninput=e=>{rate=Number(e.target.value);document.querySelector('#rateValue').textContent=rate.toFixed(2)+'×';};
let last=performance.now();
function animate(now) {
  const dt=Math.min((now-last)/1000,.05);last=now;
  for(const v of views){
    if(v.mixer){v.mixer.timeScale=rate;v.mixer.update(dt);v.vrm.update(dt);v.article.dataset.animationTime=v.actions.Run.time.toFixed(3);v.status.textContent=mode==='Run'?'跑步 · 循环播放':'站立';}
    v.controls.update();v.renderer.render(v.scene,v.camera);
  }
  requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();});requestAnimationFrame(animate);
