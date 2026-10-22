"use client";

import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { offsetDate, type RiverChat } from './timeline';

type Props = { anchor: string; chats: RiverChat[]; paused: boolean; direction: number; onNear: (date: string | null) => void };
const SPACING = 18;
const curve = (z: number) => .0038 * (z - 4) ** 2;
const stone = '#e5dec9';

export default function RiverScene({ anchor, chats, paused, direction, onNear }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ paused, direction, onNear });
  live.current = { paused, direction, onNear };
  const [failed, setFailed] = useState(false);
  const signature = chats.map(chat => chat.date).join(',');
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); return; }
    setFailed(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', '云海弧形长路：W 前进，S 后退，Shift 奔跑，靠近传送门按 F 查看聊天');
    const scene = new T.Scene();
    scene.background = new T.Color('#92bfce');
    scene.fog = new T.FogExp2('#bdced3', .0035);
    const camera = new T.PerspectiveCamera(53, 1, .1, 600);
    camera.position.set(.4, 5.1, 14.8);
    camera.lookAt(3.4, 3.6, -27);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .20, .22, 2.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    scene.add(new T.HemisphereLight('#e8f7ff', '#a4977b', 1.8));
    const sun = new T.DirectionalLight('#fff0c6', 2.3); sun.position.set(-30, 45, -35); scene.add(sun);
    const fill = new T.DirectionalLight('#fff3dc', 1.35); fill.position.set(-8, 12, 18); scene.add(fill);
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
    const background = new T.TextureLoader().load('/art/river-sky.jpg');
    background.colorSpace = T.SRGBColorSpace; textures.push(background); scene.background = background;
    let seed = 42; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
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
    roadGeo.computeVertexNormals(); mesh(roadGeo, roadMat, scene);
    const railSegments: T.Group[] = [];
    for (let i = 0; i < 74; i++) {
      const rail = new T.Group(); scene.add(rail); railSegments.push(rail);
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
      uniforms: { time: { value: 0 }, uActive: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=vec2((position.x+1.01)/2.02,position.y/5.35);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform float time,uActive; void main(){vec2 p=vUv-.5;float r=length(p*vec2(1.,.6));float a=atan(p.y,p.x);float flow=sin(r*47.-time*1.5+a*2.)*.5+.5;float edge=pow(abs(p.x)*2.,5.);vec3 c=mix(vec3(.07,.35,.43),vec3(.45,.91,1.),flow*.5+edge*.55);c+=vec3(.5,.4,.2)*pow(flow,18.)*.7; c=mix(vec3(.25,.29,.30),c,uActive);gl_FragColor=vec4(c,mix(.9,.82,uActive));}` }); materials.push(portalShader);
    type Portal = { root: T.Group; material: T.ShaderMaterial; label: T.Sprite; labelMaterial: T.SpriteMaterial; light: T.Mesh; gems: T.Mesh[]; index: number };
    const portals: Portal[] = [];
    const labelTexture = (date: string, active: boolean) => canvasTexture(768, 144, ctx => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '48px Georgia, serif'; ctx.shadowColor = '#193d56'; ctx.shadowBlur = 5; ctx.strokeStyle = '#284b5d'; ctx.lineWidth = 3; ctx.strokeText(date.replaceAll('-', '.'), 384, 66); ctx.fillStyle = active ? '#ffedc7' : '#516774'; ctx.fillText(date.replaceAll('-', '.'), 384, 66);
      ctx.font = '18px sans-serif'; ctx.shadowBlur = 0; ctx.fillStyle = active ? '#fff7dc' : '#5b7380'; ctx.fillText(active ? '✧  有一段回忆  ✧' : '—  安静的一天  —', 384, 113);
    });
    for (let i = 0; i < 10; i++) {
      const group = new T.Group(); scene.add(group);
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
      const label = new T.Sprite(lm); label.position.set(0, 6.7, 0); label.scale.set(5.6, 1.05, 1); group.add(label);
      portals.push({ root: group, material: pm, label, labelMaterial: lm, light, gems, index: Number.NaN });
    }
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
    const shadowTex = canvasTexture(64, 64, ctx => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(32,51,59,.35)'); g.addColorStop(1, 'rgba(32,51,59,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
    const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }); materials.push(shadowMat);
    mesh(new T.PlaneGeometry(2.1, 2.1), shadowMat, traveler, 0, .01, 0).rotation.x = -Math.PI / 2;
    const particlesGeo = new T.BufferGeometry(); const particlePos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { particlePos[i * 3] = (random() - .5) * 35; particlePos[i * 3 + 1] = random() * 11; particlePos[i * 3 + 2] = -random() * 100; }
    particlesGeo.setAttribute('position', new T.BufferAttribute(particlePos, 3));
    const particleMat = new T.PointsMaterial({ color: '#fff1c4', size: .07, transparent: true, opacity: .7, depthWrite: false }); materials.push(particleMat); geometries.push(particlesGeo);
    const particles = new T.Points(particlesGeo, particleMat); scene.add(particles);
    const keys = new Set<string>();
    let travel = 2.5, elapsed = 0, step = 0, last = 0, frame = 0, lastNear: string | null = null;
    const movementKeys = new Set(['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight']);
    function keydown(e: KeyboardEvent) { if (!movementKeys.has(e.code) || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; e.preventDefault(); if (!live.current.paused) keys.add(e.code); }
    function keyup(e: KeyboardEvent) { keys.delete(e.code); }
    function clear() { keys.clear(); live.current.direction = 0; last = 0; }
    function visibility() { clear(); }
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    function resize() { const w = root!.clientWidth, h = root!.clientHeight; if (!w || !h) return; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      const imageAspect = 1672 / 941, viewAspect = w / h;
      background.repeat.set(Math.min(1, viewAspect / imageAspect), Math.min(1, imageAspect / viewAspect));
      background.offset.set((1 - background.repeat.x) / 2, (1 - background.repeat.y) / 2); }
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    function animate(now: number) {
      frame = requestAnimationFrame(animate); const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now; elapsed += dt;
      if (live.current.paused) keys.clear();
      const input = live.current.paused || document.hidden ? 0 : Math.max(-1, Math.min(1, live.current.direction + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)));
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight'); const speed = running ? 10 : 4.6;
      travel += input * speed * dt;
      root!.dataset.traveler = traveler.position.toArray().join(','); root!.dataset.camera = camera.position.toArray().join(','); root!.dataset.distance = travel.toFixed(2); root!.dataset.moving = String(input !== 0);
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
      let nearest: string | null = null, best = 5.2;
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
        portal.material.uniforms.time.value = elapsed;
        if (Math.abs(distance) < best) { best = Math.abs(distance); nearest = date; }
      }
      if (nearest !== lastNear) { lastNear = nearest; root!.dataset.near = nearest || ''; live.current.onNear(nearest); }
      step += input * dt * (running ? 13 : 8);
      for (let i = 0; i < 2; i++) { legs[i].rotation.x = input ? Math.sin(step + i * Math.PI) * .5 : T.MathUtils.lerp(legs[i].rotation.x, 0, .15); arms[i].rotation.x = input ? -Math.sin(step + i * Math.PI) * .3 : T.MathUtils.lerp(arms[i].rotation.x, 0, .15); }
      body.position.y = input ? Math.abs(Math.sin(step)) * .045 : Math.sin(elapsed * 1.5) * .009;
      cape.rotation.x = .08 + Math.sin(elapsed * 2) * .035 + Math.abs(input) * .12;
      particles.position.y = Math.sin(elapsed * .25) * .3;
      composer.render();
    }
    frame = requestAnimationFrame(animate);
    function contextLost(e: Event) { e.preventDefault(); cancelAnimationFrame(frame); keys.clear(); setFailed(true); }
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); bloom.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  // Scene content is stable; input and modal state are read through live refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, signature]);
  return <><div ref={host} className="river-canvas"/>{failed && <div className="river-unavailable" role="alert">三维场景暂时无法显示。请启用浏览器硬件加速并刷新页面。<button onClick={() => window.location.reload()}>重新打开</button></div>}</>;
}
