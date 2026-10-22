"use client";

import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { offsetDate, type RiverChat } from './timeline';

type Props = { anchor: string; chats: RiverChat[]; paused: boolean; direction: number; strafe: number; onNear: (date: string | null) => void };
const SPACING = 18;
const curve = (z: number) => .0038 * (z - 4) ** 2;
const stone = '#e5dec9';

export default function RiverScene({ anchor, chats, paused, direction, strafe, onNear }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ paused, direction, strafe, onNear });
  live.current = { paused, direction, strafe, onNear };
  const [failed, setFailed] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [architectureFailed, setArchitectureFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const signature = chats.map(chat => chat.date).join(',');
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); return; }
    setFailed(false); setModelFailed(false); setArchitectureFailed(false); setReady(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '云海弧形长路：W/S 前后，A/D 左右，方向键移动，靠近传送门按 F 查看聊天');
    const scene = new T.Scene();
    scene.background = new T.Color('#92bfce');
    scene.fog = new T.FogExp2('#bdced3', .0035);
    const camera = new T.PerspectiveCamera(58, 1, .1, 600);
    camera.position.set(.4, 3.0, 9.8);
    camera.lookAt(2, 2, -27);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .16, .32, 1.5);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    scene.add(new T.HemisphereLight('#e8f7ff', '#a4977b', 1.3));
    const sun = new T.DirectionalLight('#fff0c6', 2.3); sun.position.set(-30, 38, -35); sun.target.position.set(0, 0, -12); scene.add(sun.target);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; sun.shadow.camera.near = 1; sun.shadow.camera.far = 135;
    sun.shadow.bias = -.00015; sun.shadow.normalBias = .025; sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new T.DirectionalLight('#fff3dc', .65); fill.position.set(-8, 12, 18); scene.add(fill);
    let disposed = false, modelReady = false, architectureReady = false;
    const finishLoading = () => { if (!disposed && modelReady && architectureReady) setReady(true); };
    const materials: T.Material[] = [];
    const geometries: T.BufferGeometry[] = [];
    const textures: T.Texture[] = [];
    function material(color: T.ColorRepresentation, extra: T.MeshStandardMaterialParameters = {}) {
      const m = new T.MeshStandardMaterial({ color, roughness: .62, metalness: .12, ...extra }); materials.push(m); return m;
    }
    const marble = material(stone);
    const gold = material('#bca371', { metalness: .65, roughness: .3 });
    const shadowStone = material('#839394');
    const white = material('#e9ebe2');
    const teal = material('#355f68');
    const dark = material('#253c49');
    const skin = material('#e7c8ac');
    function mesh(geometry: T.BufferGeometry, mat: T.Material, parent: T.Object3D, x = 0, y = 0, z = 0) {
      geometries.push(geometry); const object = new T.Mesh(geometry, mat); object.position.set(x, y, z); parent.add(object); return object;
    }
    function box(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
      return mesh(new T.BoxGeometry(w, h, d), mat, parent, x, y, z);
    }
    function sphere(parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, radius: number, scale: [number, number, number] = [1, 1, 1]) {
      const s = mesh(new T.SphereGeometry(radius, 18, 14), mat, parent, x, y, z); s.scale.set(...scale); return s;
    }
    function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      draw(canvas.getContext('2d')!); const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; textures.push(tex); return tex;
    }
    // Fixed sky and distant landmarks never receive the scrolling offset.
    const background = new T.TextureLoader().load('/art/river-clouds.jpg');
    background.colorSpace = T.SRGBColorSpace; textures.push(background); scene.background = background;
    const reflection = new T.TextureLoader().load('/art/river-sky.jpg'); reflection.colorSpace = T.SRGBColorSpace; reflection.mapping = T.EquirectangularReflectionMapping; textures.push(reflection); scene.environment = reflection;
    scene.environmentIntensity = .9;
    let seed = 42; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const sceneryLoader = new T.TextureLoader();
    function scenicSprite(path: string, x: number, y: number, z: number, w: number, h: number) {
      const tex = sceneryLoader.load(path); tex.colorSpace = T.SRGBColorSpace; textures.push(tex);
      const sm = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }); materials.push(sm);
      const sprite = new T.Sprite(sm); sprite.position.set(x, y, z); sprite.scale.set(w, h, 1); scene.add(sprite); return sprite;
    }
    const mainCity = scenicSprite('/art/river-main-city.png', 74, 26, -175, 86, 77);
    const floatingIslands = [
      { x: -62, y: 10, z: -140, w: 28, h: 29, phase: 0, horizontal: 2.8, vertical: 2.1 },
      { x: -23, y: 18, z: -190, w: 15, h: 17, phase: 1.8, horizontal: 1.6, vertical: 2.8 },
      { x: 4, y: 6, z: -150, w: 25, h: 26, phase: 3.2, horizontal: 3, vertical: 1.5 },
      { x: 29, y: 9, z: -185, w: 19, h: 20, phase: 5.1, horizontal: 2, vertical: 2.4 },
      { x: -95, y: -9, z: -180, w: 21, h: 23, phase: 2.2, horizontal: 1.4, vertical: 1.8 },
    ].map(spec => ({ ...spec, sprite: scenicSprite('/art/river-floating-island.png', spec.x, spec.y, spec.z, spec.w, spec.h) }));
    const movingWorld = new T.Group(); scene.add(movingWorld);
    // Road geometry keeps its curve; texture, balustrades and portals scroll along it.
    const roadTexture = canvasTexture(512, 512, ctx => {
      ctx.fillStyle = '#d9d4c7'; ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 128) {
        for (let x = -128; x < 512; x += 256) {
          const px = x + (y / 128 % 2) * 128; ctx.strokeStyle = '#aaa99f'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, y + 2, 252, 124);
          ctx.strokeStyle = '#eee8d7'; ctx.lineWidth = 2; ctx.strokeRect(px + 5, y + 5, 246, 118);
        }
      }
      ctx.strokeStyle = '#bca77d'; ctx.lineWidth = 5; for (const x of [26, 43, 469, 486]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
      ctx.strokeStyle = '#b7a37a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(256, 256, 90, 90, 0, 0, Math.PI * 2); ctx.stroke();
    });
    roadTexture.wrapS = roadTexture.wrapT = T.RepeatWrapping; roadTexture.repeat.set(1, 18); roadTexture.anisotropy = 4;
    const roadMat = material('#fff7e6', { map: roadTexture, roughness: .36, metalness: .22 });
    const roadGeo = new T.PlaneGeometry(8, 160, 12, 240); const positions = roadGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) { const z = -positions.getY(i) - 58; positions.setXYZ(i, positions.getX(i) + curve(z), -.03, z); }
    roadGeo.computeVertexNormals(); const roadSurface = mesh(roadGeo, roadMat, movingWorld);
    const railSegments: T.Group[] = [];
    for (let i = 0; i < 74; i++) {
      const rail = new T.Group(); movingWorld.add(rail); railSegments.push(rail);
      for (const side of [-1, 1]) {
        box(rail, marble, side * 4.12, .15, 0, .5, .4, 2.2);
        box(rail, marble, side * 4.12, 1.06, 0, .37, .18, 2.25);
        box(rail, marble, side * 4.12, .62, 0, .21, 1, .25);
        box(rail, gold, side * 4.12, 1.22, 0, .45, .12, .43);
        if (i % 3 === 0) mesh(new T.OctahedronGeometry(.17), gold, rail, side * 4.12, 1.46, 0);
      }
    }
    const activeDates = new Set(chats.map(chat => chat.date));
    const glowMat = material('#e1c78a', { emissive: '#ffd997', emissiveIntensity: 1.2, metalness: .5 });
    const portalShader = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false,
      uniforms: { time: { value: 0 }, uActive: { value: 1 }, uView: { value: reflection } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=vec2((position.x+1.01)/2.02,position.y/5.35);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        varying vec2 vUv;
        uniform float time,uActive;
        uniform sampler2D uView;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        float mist(vec2 p){return noise(p)*.57+noise(p*2.1)*.28+noise(p*4.3)*.15;}
        void main(){
          vec2 p=vUv-.5; float r=length(p*vec2(1.,.6));
          float n=mist(vUv*vec2(4.,7.)+vec2(time*.07,-time*.10));
          vec2 drift=vec2(sin(vUv.y*9.+time*.3),cos(vUv.x*6.-time*.2))*.012;
          vec3 view=texture2D(uView,vec2(.60+vUv.x*.38,.1+vUv.y*.80)+drift).rgb;
          float filament=pow(.5+.5*sin(n*19.+vUv.y*9.-time*.45),12.);
          float edge=pow(abs(p.x)*2.,12.)+pow(vUv.y,22.);
          vec3 col=mix(view*.72,vec3(.13,.54,.65),.24+n*.22);
          col+=vec3(.23,.7,.85)*filament*.32;
          col+=vec3(1.5,1.1,.55)*edge*.42;
          vec2 grid=vUv*vec2(18.,34.)+vec2(time*.035,-time*.13);
          vec2 cell=floor(grid);vec2 local=fract(grid)-.5;
          float star=smoothstep(.105,0.,length(local))*step(.91,hash(cell));
          col+=vec3(1.4,1.2,.75)*star*(.65+.35*sin(time+hash(cell)*6.));
          col=mix(vec3(.25,.29,.30),col,uActive);
          gl_FragColor=vec4(col,mix(.9,.93,uActive));
        }
      ` }); materials.push(portalShader);
    type Portal = { root: T.Group; material: T.ShaderMaterial; label: T.Sprite; labelMaterial: T.SpriteMaterial; light: T.Mesh; gems: T.Mesh[]; index: number; aura: T.Points; glowLight: T.PointLight; architecture?: T.Object3D; active?: boolean };
    const portals: Portal[] = [];
    const labelTexture = (date: string, active: boolean) => canvasTexture(768, 144, ctx => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '48px Georgia, serif'; ctx.shadowColor = '#193d56'; ctx.shadowBlur = 5; ctx.strokeStyle = '#284b5d'; ctx.lineWidth = 3; ctx.strokeText(date.replaceAll('-', '.'), 384, 66); ctx.fillStyle = active ? '#ffedc7' : '#516774'; ctx.fillText(date.replaceAll('-', '.'), 384, 66);
      ctx.font = '18px sans-serif'; ctx.shadowBlur = 0; ctx.fillStyle = active ? '#fff7dc' : '#5b7380'; ctx.fillText(active ? '✧  有一段回忆  ✧' : '—  安静的一天  —', 384, 113);
    });
    const sparkTexture = canvasTexture(32, 32, ctx => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff9dd'); g.addColorStop(.18, '#ffebbf'); g.addColorStop(.5, '#ffe8b955'); g.addColorStop(1, '#ffe8b900'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    });
    const auraGeometry = new T.BufferGeometry(); const sparkPositions = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const t = i / 240;
      let x: number, y: number;
      if (t < .72) { x = (i % 2 ? -1 : 1) * 1.08; y = .25 + t / .72 * 3.95; }
      else { const a = (t - .72) / .28 * Math.PI; x = Math.cos(a) * 1.08; y = 4.2 + Math.sin(a) * 1.28; }
      sparkPositions[i * 3] = x + (random() - .5) * .22; sparkPositions[i * 3 + 1] = y + (random() - .5) * .18; sparkPositions[i * 3 + 2] = (random() - .5) * .35;
    }
    auraGeometry.setAttribute('position', new T.BufferAttribute(sparkPositions, 3)); geometries.push(auraGeometry);
    const auraMaterial = new T.PointsMaterial({ color: new T.Color('#ffe2a0').multiplyScalar(1.5), map: sparkTexture, size: .10, transparent: true, opacity: .82, blending: T.AdditiveBlending, depthWrite: false }); materials.push(auraMaterial);
    for (let i = 0; i < 10; i++) {
      const group = new T.Group(); movingWorld.add(group);
      // Entire portal stands on an external bay, leaving the eight-unit road clear.
      box(group, marble, 0, -.2, 0, 4.2, .4, 3.5); box(group, marble, 0, .03, 0, 3.6, .12, 2.9);
      for (const side of [-1, 1]) {
        box(group, marble, side * 1.23, 2.15, 0, .4, 4.3, .5);
        box(group, gold, side * 1.23, 2.15, -.29, .06, 3.9, .08);
        box(group, marble, side * 1.23, .25, 0, .7, .4, .85);
        box(group, gold, side * 1.23, 4.2, 0, .65, .18, .75);
        mesh(new T.ConeGeometry(.28, .8, 4), gold, group, side * 1.23, 4.7, 0);
      }
      const arch = new T.Shape(); arch.moveTo(-1.42, 4.15); arch.quadraticCurveTo(-1.4, 5.25, 0, 5.9); arch.quadraticCurveTo(1.4, 5.25, 1.42, 4.15); arch.lineTo(1.1, 4.15); arch.quadraticCurveTo(1.05, 4.95, 0, 5.5); arch.quadraticCurveTo(-1.05, 4.95, -1.1, 4.15); arch.closePath();
      mesh(new T.ExtrudeGeometry(arch, { depth: .4, bevelEnabled: true, bevelSize: .07, bevelThickness: .05, bevelSegments: 2, steps: 1 }), marble, group, 0, 0, -.2);
      const surface = new T.Shape(); surface.moveTo(-1.01, .2); surface.lineTo(-1.01, 4.15); surface.quadraticCurveTo(-.95, 4.9, 0, 5.35); surface.quadraticCurveTo(.95, 4.9, 1.01, 4.15); surface.lineTo(1.01, .2); surface.closePath();
      const pm = portalShader.clone(); materials.push(pm); const light = mesh(new T.ShapeGeometry(surface), pm, group);
      const gems = [mesh(new T.OctahedronGeometry(.24), glowMat, group, 0, 5.8, .3)]; gems[0].scale.y = 1.6;
      const lm = new T.SpriteMaterial({ transparent: true, depthTest: false }); materials.push(lm);
      const label = new T.Sprite(lm); label.position.set(0, 7.3, 0); label.scale.set(5.6, 1.05, 1); group.add(label);
      const aura = new T.Points(auraGeometry, auraMaterial); group.add(aura);
      const glowLight = new T.PointLight('#91deed', 7, 11, 2); glowLight.position.set(0, 2, .5); group.add(glowLight);
      portals.push({ root: group, material: pm, label, labelMaterial: lm, light, gems, aura, glowLight, index: Number.NaN });
    }
    const bridgeInstances: { mesh: T.InstancedMesh; local: T.Matrix4; side: number }[] = [];
    const instanceTransform = new T.Object3D();
    const instanceMatrix = new T.Matrix4();
    const inactiveMaterial = new Map<T.Material, T.Material>();
    function inactive(original: T.Material) {
      let gray = inactiveMaterial.get(original);
      if (!gray) {
        gray = original.clone();
        if (gray instanceof T.MeshStandardMaterial) { gray.color.set('#758083'); gray.metalness = .08; gray.roughness = .78; gray.emissive.set(0); }
        inactiveMaterial.set(original, gray); materials.push(gray);
      }
      return gray;
    }
    new GLTFLoader().load('/models/river-architecture.glb', gltf => {
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(object => {
        if (object instanceof T.Mesh) {
          object.castShadow = true; object.receiveShadow = true;
          geometries.push(object.geometry);
          const mats = Array.isArray(object.material) ? object.material : [object.material]; materials.push(...mats);
          for (const mat of mats) if (mat instanceof T.MeshStandardMaterial && /ivory marble/i.test(mat.name)) { mat.roughness = .19; mat.metalness = .13; }
          for (const mat of mats) for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.push(value);
        }
      });
      for (const [name, side] of [['BridgeRoad', 0], ['BridgeLeftRail', -1], ['BridgeRightRail', 1], ['BridgeMedallion', 3]] as const) {
        const template = gltf.scene.getObjectByName(name);
        template?.traverse(source => {
          if (!(source instanceof T.Mesh)) return;
          const instanced = new T.InstancedMesh(source.geometry, source.material, railSegments.length);
          instanced.castShadow = true; instanced.receiveShadow = true;
          instanced.instanceMatrix.setUsage(T.DynamicDrawUsage); instanced.frustumCulled = false;
          movingWorld.add(instanced); bridgeInstances.push({ mesh: instanced, local: source.matrixWorld.clone(), side });
        });
      }
      if (bridgeInstances.length) { roadSurface.visible = false; railSegments.forEach(rail => { rail.visible = false; }); }
      const frameTemplate = gltf.scene.getObjectByName('Portal');
      if (frameTemplate) for (const portal of portals) {
        portal.root.children.forEach(child => { if (child !== portal.light && child !== portal.label && child !== portal.aura && child !== portal.glowLight) child.visible = false; });
        const detailed = frameTemplate.clone(true); portal.root.add(detailed); portal.architecture = detailed; portal.active = undefined;
        detailed.traverse(object => { if (object instanceof T.Mesh) object.userData.riverOriginalMaterial = object.material; });
      }
      root!.dataset.architecture = bridgeInstances.length && frameTemplate ? 'blender-glb' : 'fallback';
      architectureReady = true; finishLoading();
    }, undefined, () => { if (!disposed) { setArchitectureFailed(true); architectureReady = true; finishLoading(); } });
    // Original low-poly traveler. Root and camera remain fixed throughout movement.
    const traveler = new T.Group(); traveler.position.set(-.9, 0, 4); scene.add(traveler);
    const body = new T.Group(); traveler.add(body);
    mesh(new T.CylinderGeometry(.27, .36, .7, 12), teal, body, 0, 1.35, 0);
    mesh(new T.CylinderGeometry(.32, .48, .55, 12), white, body, 0, .95, 0);
    sphere(body, skin, 0, 1.98, 0, .26, [.85, 1.13, .95]);
    sphere(body, white, 0, 2.08, .07, .29, [1, 1.05, 1]);
    for (const side of [-1, 1]) {
      sphere(body, white, side * .22, 1.87, .12, .16, [.7, 1.9, .8]);
      mesh(new T.ConeGeometry(.11, .42, 6), gold, body, side * .25, 1.87, .16).rotation.z = side * .4;
    }
    const cape = mesh(new T.ConeGeometry(.55, 1.16, 5, 1, true), teal, body, 0, 1.24, .21); cape.rotation.y = Math.PI / 5; cape.scale.z = .55;
    const capeEdge = mesh(new T.ConeGeometry(.57, .1, 5, 1, true), gold, body, 0, .7, .21); capeEdge.scale.z = .55;
    box(body, gold, 0, 1.63, .35, .34, .06, .08);
    const legs: T.Group[] = [], arms: T.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new T.Group(); leg.position.set(side * .18, .9, 0); traveler.add(leg); legs.push(leg);
      mesh(new T.CylinderGeometry(.09, .075, .55, 10), skin, leg, 0, -.25, 0);
      mesh(new T.CylinderGeometry(.085, .11, .35, 10), dark, leg, 0, -.62, 0);
      box(leg, dark, 0, -.82, -.055, .19, .13, .33);
      const arm = new T.Group(); arm.position.set(side * .33, 1.58, 0); body.add(arm); arms.push(arm);
      mesh(new T.CylinderGeometry(.1, .08, .47, 10), white, arm, side * .035, -.19, 0); sphere(arm, skin, side * .05, -.48, 0, .08);
    }
    const fallbackParts = [...traveler.children];
    let mixer: T.AnimationMixer | undefined;
    let idleAction: T.AnimationAction | undefined, runAction: T.AnimationAction | undefined;
    let wasMoving = false;
    const skeletons = new Set<T.Skeleton>();
    new GLTFLoader().load('/models/river-traveler.glb', gltf => {
      gltf.scene.traverse(object => {
        if (object instanceof T.Mesh) {
          object.castShadow = true; object.receiveShadow = true;
          geometries.push(object.geometry);
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          materials.push(...mats);
          for (const mat of mats) { for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.push(value); }
          if (object instanceof T.SkinnedMesh) skeletons.add(object.skeleton);
        }
      });
      if (disposed) { gltf.scene.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(mat => mat.dispose()); } }); return; }
      gltf.scene.scale.setScalar(1.16); traveler.add(gltf.scene);
      fallbackParts.forEach(part => { part.visible = false; });
      mixer = new T.AnimationMixer(gltf.scene);
      const idle = gltf.animations.find(clip => /idle/i.test(clip.name));
      const run = gltf.animations.find(clip => /run/i.test(clip.name));
      if (idle) { idleAction = mixer.clipAction(idle); idleAction.play(); }
      if (run) runAction = mixer.clipAction(run);
      root!.dataset.model = 'blender-glb'; root!.dataset.animations = gltf.animations.map(clip => clip.name).join(',');
      modelReady = true; finishLoading();
    }, undefined, () => { if (!disposed) { setModelFailed(true); modelReady = true; finishLoading(); } });
    const shadowTex = canvasTexture(64, 64, ctx => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(32,51,59,.35)'); g.addColorStop(1, 'rgba(32,51,59,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
    const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }); materials.push(shadowMat);
    mesh(new T.PlaneGeometry(2.1, 2.1), shadowMat, traveler, 0, .01, 0).rotation.x = -Math.PI / 2;
    const particlesGeo = new T.BufferGeometry(); const particlePos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { particlePos[i * 3] = (random() - .5) * 35; particlePos[i * 3 + 1] = random() * 11; particlePos[i * 3 + 2] = -random() * 100; }
    particlesGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
    const particleMat = new T.PointsMaterial({ color: '#fff1c4', size: .07, transparent: true, opacity: .7, depthWrite: false }); materials.push(particleMat); geometries.push(particlesGeo);
    const particles = new T.Points(particlesGeo, particleMat); scene.add(particles);
    const keys = new Set<string>();
    let lane = -.9;
    let travel = 2.5, elapsed = 0, step = 0, last = 0, frame = 0, lastNear: string | null = null;
    const movementKeys = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight']);
    function keydown(e: KeyboardEvent) { if (!movementKeys.has(e.code) || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; e.preventDefault(); if (!live.current.paused) keys.add(e.code); }
    function keyup(e: KeyboardEvent) { keys.delete(e.code); }
    function clear() { keys.clear(); live.current.direction = 0; live.current.strafe = 0; last = 0; }
    function visibility() { clear(); }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    function resize() { const w = root!.clientWidth, h = root!.clientHeight; if (!w || !h) return; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w < 650 ? 65 : 58; camera.position.x = w < 650 ? -.9 : .4; camera.lookAt(w < 650 ? -.9 : 2, 2, -27); camera.updateProjectionMatrix();
      const imageAspect = 1672 / 941, viewAspect = w / h;
      background.repeat.set(.94 * Math.min(1, viewAspect / imageAspect), .94 * Math.min(1, imageAspect / viewAspect));
      background.offset.set((1 - background.repeat.x) / 2, (1 - background.repeat.y) / 2); }
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    function animate(now: number) {
      frame = requestAnimationFrame(animate); const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now; elapsed += dt;
      if (live.current.paused) keys.clear();
      const input = live.current.paused || document.hidden ? 0 : Math.max(-1, Math.min(1, live.current.direction + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)));
      const lateral = live.current.paused || document.hidden ? 0 : Math.max(-1, Math.min(1, live.current.strafe + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)));
      const normalize = input && lateral ? Math.SQRT1_2 : 1;
      travel += input * 10 * normalize * dt;
      lane = T.MathUtils.clamp(lane + lateral * 6 * normalize * dt, -2.65, 2.65);
      movingWorld.position.x = -.9 - lane;
      const moving = input !== 0 || lateral !== 0;
      traveler.rotation.y = T.MathUtils.lerp(traveler.rotation.y, -lateral * .45, .12);
      root!.dataset.traveler = traveler.position.toArray().join(','); root!.dataset.camera = camera.position.toArray().join(','); root!.dataset.distance = travel.toFixed(2); root!.dataset.lane = lane.toFixed(2); root!.dataset.moving = String(moving);
      roadTexture.offset.y = travel / (160 / 18);
      for (let i = 0; i < railSegments.length; i++) {
        const z = 20 - ((i * 2.2 - travel % 2.2 + 162.8) % 162.8); const rail = railSegments[i];
        rail.position.set(curve(z), 0, z); rail.rotation.y = Math.atan(.0076 * (z - 4));
        for (const child of rail.children) {
          const side = child.position.x > 0 ? 1 : -1;
          const closestIndex = Math.round((travel + 4 - z - 6) / SPACING);
          const portalZ = 4 - (closestIndex * SPACING - travel + 6);
          const portalSide = closestIndex % 2 === 0 ? 1 : -1;
          child.visible = !(side === portalSide && Math.abs(portalZ - z) < 1.9);
        }
      }
      let nearest: string | null = null, best = 7.3;
      for (const part of bridgeInstances) {
        for (let i = 0; i < railSegments.length; i++) {
          const rail = railSegments[i];
          instanceTransform.position.copy(rail.position); instanceTransform.rotation.copy(rail.rotation); instanceTransform.scale.setScalar(1);
          const index = Math.round((travel + 4 - rail.position.z - 6) / SPACING);
          const pz = 4 - (index * SPACING - travel + 6);
          if (part.side === 3 && i % 4 !== 1) instanceTransform.scale.setScalar(0);
          if (Math.abs(part.side) === 1 && part.side === (index % 2 === 0 ? 1 : -1) && Math.abs(pz - rail.position.z) < 1.9) instanceTransform.scale.setScalar(0);
          instanceTransform.updateMatrix(); instanceMatrix.multiplyMatrices(instanceTransform.matrix, part.local); part.mesh.setMatrixAt(i, instanceMatrix);
        }
        part.mesh.instanceMatrix.needsUpdate = true;
      }
      const center = Math.floor(travel / SPACING);
      for (let i = 0; i < portals.length; i++) {
        const index = center + i - 2; const distance = index * SPACING - travel + 6;
        const z = 4 - distance; const side = index % 2 === 0 ? 1 : -1; const portal = portals[i];
        portal.root.position.set(curve(z) + side * 6.35, 0, z);
        portal.root.rotation.y = side * -.46 + Math.atan(.0076 * (z - 4));
        portal.root.visible = z < 16 && z > -135;
        const date = offsetDate(anchor, index), active = activeDates.has(date);
        if (portal.index !== index) {
          const previous = portal.labelMaterial.map;
          if (previous) { previous.dispose(); const ti = textures.indexOf(previous); if (ti >= 0) textures.splice(ti, 1); }
          portal.labelMaterial.map = labelTexture(date, active); portal.labelMaterial.needsUpdate = true;
          portal.material.uniforms.uActive.value = active ? 1 : 0; portal.gems.forEach(gem => { gem.material = active ? glowMat : shadowStone; }); portal.index = index;
        }
        if (portal.architecture && portal.active !== active) {
          portal.architecture.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const original = object.userData.riverOriginalMaterial as T.Material | T.Material[];
            object.material = active ? original : Array.isArray(original) ? original.map(inactive) : inactive(original);
          });
          portal.active = active;
        }
        portal.aura.visible = active; portal.glowLight.visible = active;
        portal.material.uniforms.time.value = elapsed;
        const proximity = Math.hypot(distance, side * 6.35 - lane);
        if (proximity < best) { best = proximity; nearest = date; }
      }
      if (nearest !== lastNear) { lastNear = nearest; root!.dataset.near = nearest || ''; live.current.onNear(nearest); }
      step += (input || lateral) * dt * 13;
      for (let i = 0; i < 2; i++) { legs[i].rotation.x = moving ? Math.sin(step + i * Math.PI) * .5 : T.MathUtils.lerp(legs[i].rotation.x, 0, .15); arms[i].rotation.x = moving ? -Math.sin(step + i * Math.PI) * .3 : T.MathUtils.lerp(arms[i].rotation.x, 0, .15); }
      body.position.y = moving ? Math.abs(Math.sin(step)) * .045 : Math.sin(elapsed * 1.5) * .009;
      cape.rotation.x = .08 + Math.sin(elapsed * 2) * .035 + (moving ? .12 : 0);
      background.offset.x = (1 - background.repeat.x) / 2 + Math.sin(elapsed * .055) * .027;
      background.offset.y = (1 - background.repeat.y) / 2 + Math.sin(elapsed * .025) * .006;
      for (const island of floatingIslands) {
        island.sprite.position.x = island.x + Math.sin(elapsed * .22 + island.phase) * island.horizontal;
        island.sprite.position.y = island.y + Math.sin(elapsed * .31 + island.phase) * island.vertical;
      }
      root!.dataset.cloudOffset = background.offset.x.toFixed(5);
      root!.dataset.mainCity = mainCity.position.toArray().join(',');
      root!.dataset.floatingIsland = floatingIslands[0].sprite.position.toArray().map(v => v.toFixed(3)).join(',');
      if (mixer && moving !== wasMoving) {
        const next = moving ? runAction : idleAction, prev = moving ? idleAction : runAction;
        prev?.fadeOut(.18); next?.reset().fadeIn(.18).play(); wasMoving = moving;
      }
      mixer?.update(dt);
      root!.dataset.animation = runAction?.isRunning() && runAction.getEffectiveWeight() > .5 ? 'Run' : 'Idle';
      particles.position.y = Math.sin(elapsed * .25) * .3;
      composer.render();
    }
    frame = requestAnimationFrame(animate);
    function contextLost(e: Event) { e.preventDefault(); cancelAnimationFrame(frame); keys.clear(); setFailed(true); }
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      disposed = true; mixer?.stopAllAction(); skeletons.forEach(skeleton => skeleton.dispose()); bridgeInstances.forEach(part => part.mesh.dispose());
      cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); sun.shadow.dispose(); bloom.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  // Scene content is stable; input and modal state are read through live refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, signature]);
  return <><div ref={host} className="river-canvas"/>{!ready && !failed && <div className="river-loading" role="status"><span>✧</span>正在进入长河</div>}{architectureFailed && <div className="river-model-note" role="alert">场景模型载入失败，请刷新重试。</div>}{modelFailed && <div className="river-model-note" role="status">角色模型载入失败，暂用简化模型。</div>}{failed && <div className="river-unavailable" role="alert">三维场景暂时无法显示。请启用浏览器硬件加速并刷新页面。<button onClick={() => window.location.reload()}>重新打开</button></div>}</>;
}
