"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Entry } from './data';
import { palaceBounds, containCamera, ROOM_SPAN, navigation, photoLayout, photoScale, stepPaperWind, type PaperWindState } from './albumRoom';
import { createPaperGeometry, deformPaperPoint } from './albumPaper';
import { samplePhotos } from './albumPhotos';

type Props = { photos: Entry[]; onSelect: (photo: Entry) => void };
const paperVertex = `
  uniform float uBend, uPhase, uTime;
  uniform vec2 uSize;
  attribute float aSurface;
  varying float vSurface;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vUv = uv;
    vSurface = aSurface;
    vec3 p = position;
    float freeLength = 1. - uv.y;
    float loose = freeLength * freeLength;
    float side = (uv.x - .5) * 2.;
    // A fixed hanging print bends under wind pressure: a broad bow, torsion
    // across its width and a soft travelling ripple towards the free corners.
    // Both faces and the thin rim use the same deformation. The top stays still.
    float twist = sin(uTime * .72 + uPhase * .37);
    float ripple = sin(uTime * 1.1 - freeLength * 3.4 + side * 1.2 + uPhase * .21);
    p.z += loose * (uSize.y * .068 * uBend + uSize.x * .065 * side * twist);
    p.z += loose * freeLength * uSize.x * (.026 * side * side + .014 * ripple);
    p.x += loose * uSize.x * .004 * uBend;
    p.y += loose * uSize.y * .012 * (uBend * uBend + twist * twist * .35);
    vWorld = (modelMatrix * vec4(p, 1.)).xyz;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const paperFragment = `
  uniform float uHover;
  uniform sampler2D uMap;
  uniform vec2 uCover, uTile, uOffset;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  varying float vSurface;
  void main() {
    // Soft, slightly rounded print corners and even ivory margins.
    vec2 q = abs(vUv - .5) - vec2(.492);
    float edge = length(max(q, 0.)) + min(max(q.x,q.y),0.) - .008;
    float alpha = 1. - smoothstep(-fwidth(edge), fwidth(edge), edge);
    if(alpha < .02) discard;
    vec2 printUv = (vUv - vec2(.032,.082)) / vec2(.936,.886);
    vec2 crop = clamp((printUv - .5) * uCover + .5, .004, .996);
    vec3 picture = texture2D(uMap, crop * uTile + uOffset).rgb;
    float grain = (fract(sin(dot(vUv, vec2(1537.3,329.7))) * 43758.54) - .5) * .006;
    vec3 paper = vec3(.79,.74,.64) + grain;
    paper *= .97 + .03 * smoothstep(0.,.045,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
    vec2 feather = fwidth(vUv) * 1.3;
    float inside = smoothstep(.032,.032+feather.x,vUv.x) * (1.-smoothstep(.968-feather.x,.968,vUv.x))
                 * smoothstep(.082,.082+feather.y,vUv.y) * (1.-smoothstep(.968-feather.y,.968,vUv.y));
    vec3 col = mix(paper, picture, inside);
    if (vSurface > .5) col = mix(paper * .83, picture, inside * .025);
    if (vSurface > 1.5) col = paper * .65;
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 sunlight = normalize(vec3(160.,180.,-70.) - vWorld);
    float lit = abs(dot(normal, sunlight));
    col *= .74 + lit * .28;
    col += vec3(.026,.013,.004) * lit;
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float sheen = pow(abs(dot(normal, normalize(sunlight + viewDir))),42.) * .075;
    col += vec3(1.,.87,.65) * sheen * inside * (1.-step(.5,vSurface));
    col = mix(col, vec3(.10,.065,.035), smoothstep(150.,350.,vDepth) * .20);
    float rim = 1. - smoothstep(.012,.045,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
    col = col * (1. + uHover * .12) + uHover * rim * vec3(.50,.32,.12);
    gl_FragColor = vec4(col,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function MemoryScene({ photos, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [unsupported, setUnsupported] = useState(false);
  const [failed, setFailed] = useState(0);
  const signature = photos.map(p => p.id).join(',');

  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setUnsupported(true);
      return;
    }
    setUnsupported(false);
    setFailed(0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor('#160f0a');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '金色窗光中的三维回忆相册');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, .2, ROOM_SPAN * 2.5);
    camera.position.copy(navigation.start);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(navigation.target);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.rotateSpeed = .24;
    controls.zoomSpeed = .42;
    controls.panSpeed = .65;
    controls.minDistance = navigation.minDistance;
    controls.maxDistance = navigation.maxDistance;
    controls.minPolarAngle = Math.PI * .18;
    controls.maxPolarAngle = Math.PI * .82;
    controls.screenSpacePanning = true;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.update();

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(800, 500), .14, .5, .96);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const geometry = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const loader = new THREE.TextureLoader();
    let disposed = false;
    const keep = <T extends THREE.Object3D>(object: T): T => {
      const m = object as unknown as THREE.Mesh;
      if (m.geometry) geometry.add(m.geometry);
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(v => materials.add(v));
      return object;
    };
    const load = (url: string, ready: (texture: THREE.Texture) => void) => {
      loader.load(url, texture => {
        if (disposed) { texture.dispose(); return; }
        textures.add(texture);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        ready(texture);
      }, undefined, () => { if (!disposed) setFailed(v => v + 1); });
    };

    // Architecture surrounds the photographs in one continuous world, rather
    // than projecting a perspective illustration onto a second room.
    scene.background = new THREE.Color('#35271a');
    scene.fog = new THREE.FogExp2('#35271a', .003);

    // Six separately authored flat surface textures, mapped directly onto a
    // large enclosed room. No spherical projection of a perspective painting.
    const bronze = new THREE.MeshStandardMaterial({ color: '#997045', roughness: .47, metalness: .68 });
    materials.add(bronze);
    scene.add(new THREE.HemisphereLight('#ffe2af', '#493623', 2));
    const roomSize = palaceBounds.getSize(new THREE.Vector3());
    const roomGeometry = new THREE.BoxGeometry(roomSize.x, roomSize.y, roomSize.z);
    const uv = roomGeometry.attributes.uv;
    // BoxGeometry order: right, left, ceiling, floor, back, front.
    const faceTiles = [1, 3, 4, 5, 2, 0];
    for(let face = 0; face < 6; face++) {
      const tile = faceTiles[face], column = tile % 3, row = Math.floor(tile / 3);
      for(let corner = 0; corner < 4; corner++) {
        const vertex = face * 4 + corner;
        const u = 1 - uv.getX(vertex), v = uv.getY(vertex);
        // Inset samples prevent neighbouring atlas faces bleeding at their edges.
        uv.setXY(vertex, (column + .003 + u * .994) / 3, (1 - row + .003 + v * .994) / 2);
      }
    }
    const roomMaterial = new THREE.MeshBasicMaterial({side:THREE.BackSide,color:'#ffffff',toneMapped:false,fog:false});
    const room = keep(new THREE.Mesh(roomGeometry,roomMaterial));
    room.position.copy(palaceBounds.getCenter(new THREE.Vector3())); scene.add(room);
    load('/art/palace-six-face-atlas-v1.png', texture => {
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      roomMaterial.map = texture; roomMaterial.needsUpdate = true;
    });
    const dustData = new Float32Array(260 * 3);
    for(let i=0;i<260;i++) {
      dustData[i*3] = Math.sin(i*12.9)*ROOM_SPAN*.35;
      dustData[i*3+1] = Math.cos(i*4.1)*ROOM_SPAN*.30+ROOM_SPAN*.4;
      dustData[i*3+2] = Math.sin(i*7.7)*ROOM_SPAN*.38;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustData,3));
    const dust = keep(new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#ffdfa4',size:.045,transparent:true,opacity:.45,depthWrite:false})));
    scene.add(dust);

    const cards: { mesh: THREE.Mesh; pick: THREE.Mesh; pivot: THREE.Group; material: THREE.ShaderMaterial; phase: number; width:number; height:number; wind: PaperWindState }[] = [];
    const pickMaterial = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});materials.add(pickMaterial);
    const all: Entry[] = photos.length ? photos.slice(0, 60) : samplePhotos;
    const empty = new THREE.DataTexture(new Uint8Array([89, 70, 49, 255]), 1, 1); empty.needsUpdate = true; textures.add(empty);
    const atlasMaterials: THREE.ShaderMaterial[] = [];
    const clipGeometry = new THREE.BoxGeometry(.32,.44,.10);
    const loopGeometry = new THREE.TorusGeometry(.14,.026,6,16);
    const cordMaterial = new THREE.LineBasicMaterial({color:'#c1ad80',transparent:true,opacity:.095});
    materials.add(cordMaterial);
    all.forEach((photo, i) => {
      const { position, width, height, angles, phase } = photoLayout(i);
      const anchorY = palaceBounds.max.y - ROOM_SPAN * .025;
      const length = anchorY - position.y;
      const hanger = new THREE.Group(); hanger.position.set(position.x,anchorY,position.z);
      const pivot = new THREE.Group(); pivot.position.y = -length;
      pivot.rotation.set(angles.x, angles.y, angles.z);
      pivot.scale.setScalar(photoScale(position.distanceTo(camera.position)));
      hanger.add(pivot); scene.add(hanger);
      const plane = createPaperGeometry(width,height);
      const tile = photo.kind === 'sample' ? new THREE.Vector2(1 / 3, 1 / 2) : new THREE.Vector2(1, 1);
      const index = i % 6;
      const material = new THREE.ShaderMaterial({ vertexShader: paperVertex, fragmentShader: paperFragment, side: THREE.FrontSide, transparent: true, uniforms: {
        uHover: {value: 0}, uBend: { value: 0 }, uTime: {value: 0}, uSize: {value: new THREE.Vector2(width,height)}, uPhase: { value: phase }, uMap: { value: empty },
        uCover: { value: new THREE.Vector2(Math.min(1, width * .936 / (height * .886)), Math.min(1, height * .886 / (width * .936))) }, uTile: { value: tile },
        uOffset: { value: photo.kind === 'sample' ? new THREE.Vector2(index % 3 / 3, index < 3 ? .5 : 0) : new THREE.Vector2() },
      }});
      const mesh = keep(new THREE.Mesh(plane, material));
      mesh.userData.photo = photo;
      pivot.add(mesh);
      const pick=keep(new THREE.Mesh(new THREE.PlaneGeometry(width,height,8,10),pickMaterial));
      pick.matrixAutoUpdate=false;pick.userData.photo=photo;pick.userData.source=mesh;
      cards.push({mesh,pick,pivot,material,phase,width,height,wind:{bend:0}});
      const cord = keep(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-length,0)]),cordMaterial));
      hanger.add(cord);
      // The clamp and cord stay fixed; only the paper deforms below the top.
      for (const z of [-.055,.055]) {
        const jaw = keep(new THREE.Mesh(clipGeometry,bronze)); jaw.position.set(0,-.08,z); pivot.add(jaw);
      }
      const loop = keep(new THREE.Mesh(loopGeometry,bronze)); loop.position.y=.20; pivot.add(loop);
      if (photo.kind === 'sample') {
        atlasMaterials.push(material);
      } else {
        const url = '/api/photos/' + photo.id;
        load(url, texture => {
          const image = texture.image as {width:number;height:number};
          const imageAspect = image.width / image.height, cardAspect = width * .936 / (height * .886);
          material.uniforms.uCover.value.set(imageAspect > cardAspect ? cardAspect / imageAspect : 1, imageAspect < cardAspect ? imageAspect / cardAspect : 1);
          material.uniforms.uMap.value = texture;
        });
      }
    });
    if (atlasMaterials.length) load('/art/memory-samples.png', texture => atlasMaterials.forEach(m => { m.uniforms.uMap.value = texture; }));

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const pickPoint=new THREE.Vector3();
    let hovered: THREE.Object3D | null = null, pointerInside = false, dragging = false, pressed = false;
    function pointerPosition(e:PointerEvent){
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    }
    function hitPhoto(){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const card of cards){
        const vertices=card.pick.geometry.attributes.position,uv=card.pick.geometry.attributes.uv;
        for(let i=0;i<vertices.count;i++){
          deformPaperPoint(uv.getX(i),uv.getY(i),card.width,card.height,card.wind.bend,card.material.uniforms.uTime.value,card.phase,pickPoint);
          vertices.setXYZ(i,pickPoint.x,pickPoint.y,pickPoint.z);
        }
        card.pick.geometry.computeBoundingSphere();card.pick.matrixWorld.copy(card.mesh.matrixWorld);
      }
      ray.setFromCamera(pointer,camera);
      return ray.intersectObjects(cards.map(card=>card.pick))[0]?.object.userData.source as THREE.Mesh || null;
    }
    function pointerMove(e:PointerEvent){
      pointerInside=true;pointerPosition(e);
      if(pressed&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)dragging=true;
    }
    function pointerLeave(){pointerInside=false;hovered=null;renderer.domElement.style.cursor='grab'}
    function pointerDown(e: PointerEvent) { down = { x: e.clientX, y: e.clientY };pressed=true;dragging=false; }
    function pointerUp(e: PointerEvent) {
      const moved=dragging||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7;
      pressed=false;dragging=false;
      if(moved)return;
      pointerPosition(e);
      const hit=hitPhoto();
      if(hit?.userData.photo)selectRef.current(hit.userData.photo);
    }
    function pointerCancel(){pressed=false;dragging=false;pointerLeave()}
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerleave', pointerLeave);
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.style.cursor='grab';
    function resize() {
      const width = root!.clientWidth, height = root!.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false); composer.setSize(width, height);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    let frame = 0;
    const clock = new THREE.Clock();
    const attachment = new THREE.Vector3();
    let elapsed = 0;
    let lastHit = 0;
    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), .05);
      elapsed += dt;
      if (!reduced) { dust.rotation.y = Math.sin(elapsed * .023) * .008; }
      for (const card of cards) {
        if (!reduced) {
          stepPaperWind(card.wind,elapsed,dt,card.phase);
          card.material.uniforms.uBend.value = card.wind.bend;
          card.material.uniforms.uTime.value = elapsed;
        }
      }
      controls.update();
      // Constrain each final view ray after damping, before drawing any frame.
      containCamera(camera.position, controls.target);
      camera.lookAt(controls.target);
      for (const card of cards) {
        card.pivot.getWorldPosition(attachment);
        const size = photoScale(attachment.distanceTo(camera.position));
        // Scale around the suspension point so the print never leaves its cord.
        card.pivot.scale.setScalar(THREE.MathUtils.damp(card.pivot.scale.x,size,3.5,dt));
      }
      if(pointerInside&&elapsed-lastHit>.06){
        scene.updateMatrixWorld(true);camera.updateMatrixWorld();
        hovered=dragging?null:hitPhoto();lastHit=elapsed;
        renderer.domElement.style.cursor=dragging?'grabbing':hovered?'pointer':'grab';
      }
      for(const card of cards)card.material.uniforms.uHover.value=THREE.MathUtils.damp(card.material.uniforms.uHover.value,card.mesh===hovered?1:0,9,dt);
      composer.render(); frame = requestAnimationFrame(tick);
    }
    tick();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('pointercancel',pointerCancel);
      geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      bloom.dispose(); composer.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === root) root.removeChild(renderer.domElement);
    };
  }, [signature]);

  return <div className="real-memory-scene"><div className="webgl-host" ref={host} />
    {unsupported && <div className="scene-fallback"><p>当前浏览器未能开启 3D 显示。</p><small>可以通过右上角的照片列表查看相册。</small></div>}
    {failed > 0 && <div className="scene-load-note">部分影像暂未加载完成。</div>}
  </div>;
}
