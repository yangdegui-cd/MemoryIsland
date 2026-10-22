"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Entry } from './data';
import { palaceBounds, containCamera } from './albumRoom';

type Props = { photos: Entry[]; onSelect: (photo: Entry) => void };
const paperVertex = `
  uniform float uTime, uPhase, uMotion;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    float loose = pow(1. - uv.y, 1.25);
    float curl = pow((uv.x - .5) * 2., 2.) * .17;
    float wave = sin(uv.y * 4.3 - uTime * .72 + uPhase) * .075
               + sin(uv.x * 4.8 + uTime * .51 + uPhase) * .045;
    p.z += curl + wave * loose * uMotion;
    p.x += sin(uTime * .46 + uPhase + uv.y * 2.) * .035 * loose * uMotion;
    vWorld = (modelMatrix * vec4(p, 1.)).xyz;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const paperFragment = `
  uniform sampler2D uMap;
  uniform vec2 uCover, uTile, uOffset;
  uniform float uBack;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec2 crop = clamp((vUv - .5) * uCover + .5, .002, .998);
    vec3 image = texture2D(uMap, crop * uTile + uOffset).rgb;
    float grain = fract(sin(dot(vUv, vec2(1537.3, 329.7))) * 43758.54) * .025;
    vec3 paper = vec3(.77, .71, .59) + grain;
    float inside = step(.025, vUv.x) * step(vUv.x, .975)
                 * step(.075, vUv.y) * step(vUv.y, .975);
    vec3 col = mix(paper, image, inside);
    if (!gl_FrontFacing || uBack > .5) col = paper * .55;
    vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    vec3 sunlight = normalize(vec3(10., 11., -18.) - vWorld);
    float lit = abs(dot(normal, sunlight));
    col *= .68 + lit * .52;
    col += vec3(.085, .039, .009) * lit;
    float fog = smoothstep(35., 115., vDepth);
    col = mix(col, vec3(.058, .038, .021), fog * .65);
    gl_FragColor = vec4(col, 1.);
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
    const camera = new THREE.PerspectiveCamera(65, 1, .15, 180);
    camera.position.set(0, 1.2, 27);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 17, -28);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.rotateSpeed = .32;
    controls.zoomSpeed = .52;
    controls.panSpeed = .46;
    controls.minDistance = 34;
    controls.maxDistance = 68;
    controls.minPolarAngle = Math.PI * .30;
    controls.maxPolarAngle = Math.PI * .54;
    controls.minAzimuthAngle = -.30;
    controls.maxAzimuthAngle = .30;
    controls.screenSpacePanning = false;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.update();

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(800, 500), .35, .6, .88);
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

    // A single six-sided box. The selected artwork is projected onto its
    // interior faces using one continuous panoramic UV field (no wall seams).
    const bronze = new THREE.MeshStandardMaterial({ color: '#997045', roughness: .47, metalness: .68 });
    materials.add(bronze);
    scene.add(new THREE.HemisphereLight('#ffe2af', '#493623', 2));
    const roomMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uPalace: { value: null }, uReady: { value: 0 } },
      vertexShader: `varying vec3 vRoom; void main(){
        vRoom = (modelMatrix * vec4(position,1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }`,
      fragmentShader: `uniform sampler2D uPalace; uniform float uReady; varying vec3 vRoom;
        void main(){
          vec3 ray = normalize(vRoom - vec3(0., 7., 18.));
          vec2 uv = vec2(atan(ray.x, -ray.z) / 6.2831853 + .5, asin(clamp(ray.y,-1.,1.)) / 3.14159265 + .5);
          vec3 color = texture2D(uPalace, uv).rgb;
          gl_FragColor = vec4(mix(vec3(.12,.08,.04),color,uReady),1.);
          #include <colorspace_fragment>
        }`,
    });
    const roomSize = palaceBounds.getSize(new THREE.Vector3());
    const room = keep(new THREE.Mesh(new THREE.BoxGeometry(roomSize.x, roomSize.y, roomSize.z), roomMaterial));
    room.position.copy(palaceBounds.getCenter(new THREE.Vector3())); scene.add(room);
    load('/art/palace-reference.png', texture => {
      texture.wrapS = THREE.RepeatWrapping;
      roomMaterial.uniforms.uPalace.value = texture;
      roomMaterial.uniforms.uReady.value = 1;
    });
    const dustData = new Float32Array(260 * 3);
    for(let i=0;i<260;i++) {
      dustData[i*3] = Math.sin(i*12.9)*25;
      dustData[i*3+1] = Math.cos(i*4.1)*20+23;
      dustData[i*3+2] = Math.sin(i*7.7)*60-20;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustData,3));
    const dust = keep(new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#ffdfa4',size:.045,transparent:true,opacity:.45,depthWrite:false})));
    scene.add(dust);

    const cards: { mesh: THREE.Mesh; pivot: THREE.Group; material: THREE.ShaderMaterial; phase: number; angles: THREE.Vector3 }[] = [];
    const all: Entry[] = photos.length ? photos.slice(0, 60) : Array.from({ length: 44 }, (_, i) => ({ id: `sample-${i}`, kind: 'sample', data: {}, createdAt: 0 }));
    const empty = new THREE.DataTexture(new Uint8Array([89, 70, 49, 255]), 1, 1); empty.needsUpdate = true; textures.add(empty);
    const atlasMaterials: THREE.ShaderMaterial[] = [];
    const cachedTextures = new Map<string, THREE.Texture>();
    all.forEach((photo, i) => {
      const phase = i * 2.39996;
      const foreground = i < 6;
      const rawX = foreground ? [-4.3, 4.6, -2.6, 3.1, -5.2, 5.4][i] : Math.sin(phase) * (2.8 + i % 5 * 1.15);
      const rawY = [5.6, 2.1, .4, 7.0, 3.6, -.7, 6.2, 1.3, 4.4, 8.4][i % 10] + Math.sin(i * 1.3) * .5;
      const rawZ = foreground ? [7.4, 6.4, 2.4, 3.5, -1.2, -.4][i] : 1 - Math.floor((i - 6) / 6) * 5.1 + Math.cos(phase) * 1.6;
      const x = rawX * 2.05;
      const y = foreground ? [12, 7, 19, 27, 6, 33][i] : (rawY + 1) * 4.4 + 3;
      const z = foreground ? [19, 17, 7, 1, 10, -8][i] : rawZ * 2.2 - 3;
      const pivot = new THREE.Group(); pivot.position.set(x, y, z);
      const angles = new THREE.Vector3([.09, -.16, .22, -.08][i % 4], [-.35, .42, -.67, .3, 2.7, 1.34, -2.5, .65, -1.12, .18][i % 10], (i % 5 - 2) * .045);
      pivot.rotation.set(angles.x, angles.y, angles.z);
      const width = foreground ? 3.2 : 1.9 + i % 4 * .2, height = width * (i % 6 === 2 ? .83 : 1.25);
      const plane = new THREE.PlaneGeometry(width, height, 24, 30); plane.translate(0, -height / 2, 0);
      const tile = photo.kind === 'sample' ? new THREE.Vector2(1 / 3, 1 / 2) : new THREE.Vector2(1, 1);
      const index = i % 6;
      const material = new THREE.ShaderMaterial({ vertexShader: paperVertex, fragmentShader: paperFragment, side: THREE.DoubleSide, uniforms: {
        uTime: { value: 0 }, uPhase: { value: phase }, uMotion: { value: reduced ? 0 : 1 }, uMap: { value: empty },
        uCover: { value: new THREE.Vector2(1, 1) }, uTile: { value: tile },
        uOffset: { value: photo.kind === 'sample' ? new THREE.Vector2(index % 3 / 3, index < 3 ? .5 : 0) : new THREE.Vector2() },
        uBack: { value: 0 },
      }});
      const mesh = keep(new THREE.Mesh(plane, material));
      mesh.userData.photo = photo.kind === 'sample' ? null : photo;
      pivot.add(mesh); scene.add(pivot); cards.push({ mesh, pivot, material, phase, angles });
      const string = keep(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, 48, z)]), new THREE.LineBasicMaterial({ color: '#d6b16d', transparent: true, opacity: .14 })));
      scene.add(string);
      const clip = keep(new THREE.Mesh(new THREE.BoxGeometry(.055, .13, .055), bronze)); clip.position.set(0, -.02, .025); clip.rotation.z = .14; pivot.add(clip);
      if (photo.kind === 'sample') {
        atlasMaterials.push(material);
      } else {
        const url = '/api/photos/' + photo.id;
        load(url, texture => {
          cachedTextures.set(url, texture);
          const image = texture.image as {width:number;height:number};
          const imageAspect = image.width / image.height, cardAspect = width / height;
          material.uniforms.uCover.value.set(imageAspect > cardAspect ? cardAspect / imageAspect : 1, imageAspect < cardAspect ? imageAspect / cardAspect : 1);
          material.uniforms.uMap.value = texture;
        });
      }
    });
    if (atlasMaterials.length) load('/art/memory-samples.png', texture => atlasMaterials.forEach(m => { m.uniforms.uMap.value = texture; }));

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    function pointerDown(e: PointerEvent) { down = { x: e.clientX, y: e.clientY }; }
    function pointerUp(e: PointerEvent) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(cards.map(c => c.mesh))[0];
      if (hit?.object.userData.photo) selectRef.current(hit.object.userData.photo);
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    function resize() {
      const width = root!.clientWidth, height = root!.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false); composer.setSize(width, height);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    let frame = 0;
    const clock = new THREE.Clock();
    function tick() {
      if (disposed) return;
      const time = clock.getElapsedTime();
      if (!reduced) { dust.rotation.y = Math.sin(time * .023) * .025; dust.position.y = Math.sin(time * .11) * .15; }
      for (const card of cards) {
        card.material.uniforms.uTime.value = time;
        if (!reduced) {
          card.pivot.rotation.set(card.angles.x + Math.sin(time * .43 + card.phase) * .032,
            card.angles.y + Math.sin(time * .32 + card.phase) * .065,
            card.angles.z + Math.sin(time * .5 + card.phase) * .025);
        }
      }
      controls.update();
      // Clamp both the orbit centre and eye, including accumulated pan/damping.
      // Keeping the eye above the reflector avoids its undefined underside view.
      containCamera(camera.position, controls.target);
      camera.lookAt(controls.target);
      composer.render(); frame = requestAnimationFrame(tick);
    }
    tick();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp);
      geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      bloom.dispose(); composer.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === root) root.removeChild(renderer.domElement);
    };
  }, [signature]);

  return <div className="real-memory-scene"><div className="webgl-host" ref={host} />
    {unsupported && <div className="scene-fallback"><p>当前浏览器未能开启 3D 显示。</p><small>可以在下方照片网格中查看相册。</small></div>}
    {failed > 0 && <div className="scene-load-note">部分影像暂未加载完成。</div>}
  </div>;
}
