"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Entry } from './data';

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
    float fog = smoothstep(13., 49., vDepth);
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
    const camera = new THREE.PerspectiveCamera(55, 1, .15, 180);
    camera.position.set(0, 1.3, 12);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, -12);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.rotateSpeed = .32;
    controls.zoomSpeed = .52;
    controls.panSpeed = .46;
    controls.minDistance = 3;
    controls.maxDistance = 26;
    controls.minPolarAngle = Math.PI * .40;
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
    scene.fog = new THREE.FogExp2('#35271a', .009);

    const stone = new THREE.MeshStandardMaterial({ color: '#695443', roughness: .82, metalness: .12 });
    const bronze = new THREE.MeshStandardMaterial({ color: '#997045', roughness: .47, metalness: .68 });
    materials.add(stone); materials.add(bronze);
    scene.add(new THREE.HemisphereLight('#d7b488', '#211c1b', 1.5));
    const sunlight = new THREE.DirectionalLight('#ffe1a2', 3.2);
    sunlight.position.set(9, 12, -17); scene.add(sunlight);
    function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
      const mesh = keep(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
      mesh.position.set(x, y, z); scene.add(mesh); return mesh;
    }
    const plaster = new THREE.MeshStandardMaterial({ color: '#544435', roughness: .9 });
    const inset = new THREE.MeshStandardMaterial({ color: '#2a241f', roughness: .72 });
    const glass = new THREE.MeshBasicMaterial({ color: '#ffe5ae', toneMapped: false });
    materials.add(plaster); materials.add(inset); materials.add(glass);
    const cameraMin = new THREE.Vector3(-8, -.5, -28);
    const cameraMax = new THREE.Vector3(8, 9, 18);
    const targetMin = new THREE.Vector3(-2, 1, -24);
    const targetMax = new THREE.Vector3(2, 4, -8);
    // Closed interior: floor -4, side walls +/-12, end walls -43 / 22.
    box(.6, 18, 66, plaster, -12, 5, -10);
    box(.6, 18, 66, plaster, 12, 5, -10);
    box(24, 18, .6, plaster, 0, 5, -43);
    box(24, 18, .6, plaster, 0, 5, 22);
    box(24, .5, 66, plaster, 0, 14, -10);
    for (const side of [-1, 1]) {
      for (const y of [-3.6, -.8, 9.3, 13.4]) box(.25, .14, 65, bronze, side * 11.6, y, -10);
      for (let bay = 0; bay < 6; bay++) {
        const z = 16 - bay * 9;
        box(.16, 10, 5.7, inset, side * 11.58, 4.3, z);
        // Tall luminous panes sit in the right wall, with real mullions.
        if (side === 1) {
          const windowShape = new THREE.Shape();
          windowShape.moveTo(-2.35, .25); windowShape.lineTo(2.35, .25);
          windowShape.lineTo(2.35, 7.2); windowShape.absarc(0, 7.2, 2.35, 0, Math.PI, false);
          windowShape.lineTo(-2.35, .25);
          const pane = keep(new THREE.Mesh(new THREE.ShapeGeometry(windowShape), glass));
          pane.rotation.y = -Math.PI / 2; pane.position.set(11.45, 0, z); scene.add(pane);
          const crown = Array.from({ length: 33 }, (_, i) => {
            const a = i / 32 * Math.PI;
            return new THREE.Vector3(11.26, 7.2 + Math.sin(a) * 2.5, z + Math.cos(a) * 2.5);
          });
          scene.add(keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crown), 32, .10, 6, false), bronze)));
          for (const dz of [-2.5, -1.25, 0, 1.25, 2.5]) box(.32, 9.1, .10, bronze, 11.28, 4.6, z + dz);
          for (const y of [.1, 3, 6, 9.1]) box(.32, .12, 5.1, bronze, 11.26, y, z);
          const glow = new THREE.PointLight('#ffcf81', 28, 19, 2);
          glow.position.set(9.8, 6, z); scene.add(glow);
        } else {
          for (const dz of [-2.85, 2.85]) box(.25, 10.2, .10, bronze, -11.4, 4.3, z + dz);
          for (const y of [-.8, 9.4]) box(.25, .10, 5.8, bronze, -11.4, y, z);
        }
      }
    }
    // Gilded coffers tie the ceiling to the same columns and floor.
    for (let z = 18; z > -43; z -= 4.5) {
      box(23.5, .16, .12, bronze, 0, 13.65, z);
      for (const x of [-8, -4, 0, 4, 8]) box(.10, .16, 4.5, bronze, x, 13.65, z - 2.25);
    }
    for (const x of [-8, -4, 0, 4, 8]) {
      box(3.5, 11, .2, inset, x, 4, -42.55);
      for (const dx of [-1.75, 1.75]) box(.09, 11, .3, bronze, x + dx, 4, -42.35);
      for (const y of [-1.5, 9.5]) box(3.6, .09, .3, bronze, x, y, -42.35);
    }
    // Repeating carved pilasters and arch ribs give camera movement real parallax.
    for (let i = 0; i < 7; i++) {
      const z = 20 - i * 9;
      for (const side of [-1, 1]) {
        const x = side * 10.7;
        const column = keep(new THREE.Mesh(new THREE.CylinderGeometry(.48, .62, 13.2, 16), stone));
        column.position.set(x, 2.7, z); scene.add(column);
        for (const y of [-3.5, -3.1, 8.9, 9.2]) {
          const ring = keep(new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .16, 24), bronze));
          ring.position.set(x, y, z); scene.add(ring);
        }
        box(1.55, .42, 1.65, bronze, x, -3.2, z);
        box(1.4, .2, 1.5, bronze, x, 9.3, z);
        for (const offset of [-.28, 0, .28]) box(.045, 11.8, .065, bronze, x + offset, 2.7, z + .58);
      }
      const curve = new THREE.EllipseCurve(0, 9.3, 10.7, 4.7, 0, Math.PI, false, 0);
      const points = curve.getPoints(56).map(v => new THREE.Vector3(v.x, v.y, z));
      const arch = keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 56, .115, 6, false), bronze));
      scene.add(arch);
    }

    // A real mirror below the scene reflects moving photographs and architecture.
    const mirror = new Reflector(new THREE.PlaneGeometry(29, 86), {
      color: new THREE.Color('#5b4632'), textureWidth: 768, textureHeight: 768, clipBias: .003,
    });
    keep(mirror); mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -4, -12); scene.add(mirror);
    const floor = keep(new THREE.Mesh(new THREE.PlaneGeometry(29, 86), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
        float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.13+7.4;a*=.5;}return v;}
        void main(){vec2 p=vUv*vec2(22.,64.);float seams=step(.994,fract(p.x*.5))+step(.994,fract(p.y*.5));float vein=1.-smoothstep(.003,.019,abs(fbm(p*1.8)-.48));vec3 col=mix(vec3(.023,.018,.014),vec3(.14,.1,.052),vein*.48+seams*.14);gl_FragColor=vec4(col,.72);}`,

    })));
    floor.rotation.x = -Math.PI / 2; floor.position.copy(mirror.position).y += .012; scene.add(floor);

    const sunlightPosition = new THREE.Vector3(10, 10.5, -19);
    const glowBytes = new Uint8Array(128 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4, d = Math.hypot((x - 63.5) / 64, (y - 63.5) / 64);
      glowBytes.set([255, 198, 106, Math.max(0, Math.round(Math.exp(-d * d * 4.8) * 190 - 1))], i);
    }
    const glowMap = new THREE.DataTexture(glowBytes, 128, 128);
    glowMap.needsUpdate = true; textures.add(glowMap);
    const halo = keep(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: '#ffd6a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .65 })));
    halo.position.copy(sunlightPosition); halo.scale.set(18, 18, 1); scene.add(halo);
    for (let i = 0; i < 7; i++) {
      const source = sunlightPosition.clone().add(new THREE.Vector3((i % 2) * .7, (i % 3 - 1) * 1.1, .2));
      const end = new THREE.Vector3(-9 + i * .3, -3.9, 7 + i * .8);
      const beam = keep(new THREE.Mesh(new THREE.ConeGeometry(.9 + i * .07, source.distanceTo(end), 24, 1, true), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 vUv;void main(){float a=pow(sin(vUv.x*3.14159),2.);float f=pow(vUv.y,.3)*(1.-smoothstep(.95,1.,vUv.y));gl_FragColor=vec4(1.,.68,.29,a*f*.038);}',
      })));
      beam.position.copy(source).add(end).multiplyScalar(.5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), source.clone().sub(end).normalize());
      scene.add(beam);
    }

    const dustData = new Float32Array(520 * 3);
    for (let i = 0; i < 520; i++) {
      dustData[i * 3] = Math.sin(i * 12.9898) * 11;
      dustData[i * 3 + 1] = Math.cos(i * 4.1414) * 8 + 3;
      dustData[i * 3 + 2] = Math.sin(i * 7.717) * 25 - 10;
    }
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustData, 3));
    const dust = keep(new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: glowMap, color: '#ffcb77', size: .06, transparent: true, opacity: .54, depthWrite: false, blending: THREE.AdditiveBlending })));
    scene.add(dust);

    const cards: { mesh: THREE.Mesh; pivot: THREE.Group; material: THREE.ShaderMaterial; phase: number; angles: THREE.Vector3 }[] = [];
    const all: Entry[] = photos.length ? photos.slice(0, 60) : Array.from({ length: 44 }, (_, i) => ({ id: `sample-${i}`, kind: 'sample', data: {}, createdAt: 0 }));
    const empty = new THREE.DataTexture(new Uint8Array([89, 70, 49, 255]), 1, 1); empty.needsUpdate = true; textures.add(empty);
    const atlasMaterials: THREE.ShaderMaterial[] = [];
    const cachedTextures = new Map<string, THREE.Texture>();
    all.forEach((photo, i) => {
      const phase = i * 2.39996;
      const foreground = i < 6;
      const x = foreground ? [-4.3, 4.6, -2.6, 3.1, -5.2, 5.4][i] : Math.sin(phase) * (2.8 + i % 5 * 1.15);
      const y = [5.6, 2.1, .4, 7.0, 3.6, -.7, 6.2, 1.3, 4.4, 8.4][i % 10] + Math.sin(i * 1.3) * .5;
      const z = foreground ? [7.4, 6.4, 2.4, 3.5, -1.2, -.4][i] : 1 - Math.floor((i - 6) / 6) * 5.1 + Math.cos(phase) * 1.6;
      const pivot = new THREE.Group(); pivot.position.set(x, y, z);
      const angles = new THREE.Vector3([.09, -.16, .22, -.08][i % 4], [-.35, .42, -.67, .3, 2.7, 1.34, -2.5, .65, -1.12, .18][i % 10], (i % 5 - 2) * .045);
      pivot.rotation.set(angles.x, angles.y, angles.z);
      const width = foreground ? 1.75 : 1.25 + i % 4 * .16, height = width * (i % 6 === 2 ? .83 : 1.25);
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
      const string = keep(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, 16, z)]), new THREE.LineBasicMaterial({ color: '#d6b16d', transparent: true, opacity: .14 })));
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
      controls.target.clamp(targetMin, targetMax);
      camera.position.clamp(cameraMin, cameraMax);
      camera.lookAt(controls.target);
      composer.render(); frame = requestAnimationFrame(tick);
    }
    tick();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp);
      mirror.getRenderTarget().dispose();
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
