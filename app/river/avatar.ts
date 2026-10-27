import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MToonMaterial, VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import type { RiverCharacter } from './characters';

export const riverAvatarMotions = {
  run: '/models/river-sprint-v1.glb',
  idle: '/models/river-idle-v1.glb',
};

// Dye the authored fabric/hair while retaining seams, highlights, texture alpha,
// skin and hardware. Multiplying a red tint into black fabric would stay black.
export function dyeForMaterial(character: RiverCharacter, name: string) {
  if (character === 'alexx') {
    if (name.includes('_HAIR')) return { color: '#ff4335', lift: 2.9, trim: 0 };
    if (name.includes('_Tops_')) return { color: '#f52e38', lift: 2.8, trim: .65 };
    if (name.includes('_Bottoms_')) return { color: '#ff3443', lift: 3.9, trim: .1 };
    if (name.includes('_Shoes_')) return { color: '#ff3540', lift: 3.5, trim: .25 };
  } else {
    if (name.includes('_Tops_')) return { color: '#9451ca', lift: 1.15, trim: .3 };
    if (name.includes('_Bottoms_')) return { color: '#7534a5', lift: 1.3, trim: .25 };
    if (name.includes('_Shoes_')) return { color: '#75529c', lift: 1.05, trim: .75 };
  }
  return null;
}

// Small, smooth silhouette adjustments in the selected BV asset's bind space.
// Body and clothing use the same field; the humanoid skeleton is untouched.
export function shapeBvVertex(p: T.Vector3) {
  const falloff = (distance: number, radius: number) => 1 - T.MathUtils.smoothstep(Math.abs(distance), 0, radius);
  const chest = falloff(p.y - 1.095, .15) * falloff(p.x, .19)
    * (1 - T.MathUtils.smoothstep(p.z, -.085, .015));
  const hips = falloff(p.y - .825, .15) * falloff(p.x, .22);
  const back = T.MathUtils.smoothstep(p.z, -.025, .075);
  return new T.Vector3(p.x * (1 + hips * .18 + chest * .07), p.y, p.z - chest * .038 + hips * back * .042);
}

function shapeBv(vrm: VRM) {
  const positions = new Set<T.BufferAttribute | T.InterleavedBufferAttribute>();
  vrm.scene.updateMatrixWorld(true);
  vrm.scene.traverse(object => {
    if (!(object instanceof T.Mesh) || !object.name.startsWith('Body')) return;
    const geometry = object.geometry, position = geometry.getAttribute('position');
    if (!position || positions.has(position)) return;
    positions.add(position);
    const normal = geometry.getAttribute('normal');
    const inverse = object.matrixWorld.clone().invert();
    const toWorld = new T.Matrix3().getNormalMatrix(object.matrixWorld);
    const toLocal = new T.Matrix3().getNormalMatrix(inverse);
    const point = new T.Vector3(), n = new T.Vector3(), delta = .0001;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      const deformed = shapeBvVertex(point);
      if (normal) {
        // Transform authored normals with the deformation's inverse Jacobian;
        // preserve smooth normals across the original UV/material seams.
        const cols = ['x', 'y', 'z'].map(axis => {
          const plus = point.clone(), minus = point.clone();
          plus[axis as 'x'|'y'|'z'] += delta; minus[axis as 'x'|'y'|'z'] -= delta;
          return shapeBvVertex(plus).sub(shapeBvVertex(minus)).multiplyScalar(.5 / delta);
        });
        const jacobian = new T.Matrix3().set(cols[0].x, cols[1].x, cols[2].x, cols[0].y, cols[1].y, cols[2].y, cols[0].z, cols[1].z, cols[2].z).invert().transpose();
        n.fromBufferAttribute(normal, i).applyMatrix3(toWorld).applyMatrix3(jacobian).applyMatrix3(toLocal).normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
      deformed.applyMatrix4(inverse); position.setXYZ(i, deformed.x, deformed.y, deformed.z);
    }
    position.needsUpdate = true; if (normal) normal.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  });
}

export function applyRiverPalette(vrm: VRM, character: RiverCharacter) {
  const seen = new Set<T.Material>();
  vrm.scene.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MToonMaterial) || seen.has(material)) continue;
      seen.add(material);
      const dye = dyeForMaterial(character, material.name);
      if (!dye) continue;
      const originalCompile = material.onBeforeCompile.bind(material);
      const originalKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        originalCompile(shader, renderer);
        shader.uniforms.riverDyeColor = { value: new T.Color(dye.color) };
        shader.uniforms.riverDyeLift = { value: dye.lift };
        shader.uniforms.riverDyeTrim = { value: dye.trim };
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
          #include <common>
          uniform vec3 riverDyeColor;
          uniform float riverDyeLift;
          uniform float riverDyeTrim;
          vec3 riverDye(vec3 source) {
            float luma = dot(source, vec3(.2126, .7152, .0722));
            float detail = pow(max(luma, .001), .42) * riverDyeLift;
            vec3 dyed = riverDyeColor * detail;
            float paleTrim = smoothstep(.65, .95, luma) * riverDyeTrim;
            return mix(dyed, vec3(luma), paleTrim);
          }
        `).replace('material.diffuseColor = diffuseColor.rgb;',
          'material.diffuseColor = riverDye(diffuseColor.rgb);')
          .replace('material.shadingShift = shadingShiftFactor;',
            'material.shadeColor = riverDye(material.shadeColor);\nmaterial.shadingShift = shadingShiftFactor;');
      };
      material.customProgramCacheKey = () => `${originalKey}:river-${character}-${dye.color}-${dye.lift}-${dye.trim}`;
      material.needsUpdate = true;
    }
  });
}

// Rest-pose retargeting adapted from pmndrs/viverse (MIT; see asset NOTICE).
// Source local quaternions cannot be copied directly onto a different humanoid.
export function retargetRiverClip(source: GLTF, vrm: VRM, name: string) {
  const clip = source.animations[0];
  const hips = source.scene.getObjectByName('hips');
  if (!clip || !hips?.parent) throw new Error('Animation is missing its humanoid hips');
  source.scene.updateMatrixWorld(true);
  const sourceHeight = hips.getWorldPosition(new T.Vector3()).y;
  const targetHeight = vrm.humanoid.normalizedRestPose.hips?.position?.[1];
  if (!targetHeight || sourceHeight <= 0) throw new Error('Invalid humanoid rest height');
  const ratio = targetHeight / sourceHeight;
  const tracks: T.KeyframeTrack[] = [];
  for (const original of clip.tracks) {
    const [boneName, property] = original.name.split('.');
    const target = vrm.humanoid.getNormalizedBoneNode(boneName as VRMHumanBoneName);
    const bone = source.scene.getObjectByName(boneName);
    if (!target || !bone?.parent) continue;
    const track = original.clone();
    if (track instanceof T.QuaternionKeyframeTrack) {
      const restInverse = bone.quaternion.clone().invert();
      const parentRest = bone.parent.getWorldQuaternion(new T.Quaternion());
      const parentInverse = parentRest.clone().invert();
      const q = new T.Quaternion();
      for (let i = 0; i < track.values.length; i += 4) {
        q.fromArray(track.values, i).premultiply(parentRest).multiply(restInverse).multiply(parentInverse);
        if (vrm.meta.metaVersion === '0') { q.x *= -1; q.z *= -1; }
        q.toArray(track.values, i);
      }
    } else if (property === 'position' && boneName === 'hips') {
      const p = new T.Vector3();
      for (let i = 0; i < track.values.length; i += 3) {
        p.fromArray(track.values, i).applyMatrix4(hips.parent.matrixWorld).multiplyScalar(ratio);
        p.x = 0; p.z = 0; // In-place running; the corridor supplies world travel.
        p.toArray(track.values, i);
      }
    } else continue;
    track.name = `${target.name}.${property}`;
    tracks.push(track);
  }
  if (tracks.length < 15) throw new Error(`Incomplete humanoid mapping: ${tracks.length}`);
  return new T.AnimationClip(name, clip.duration, tracks);
}

export async function loadRiverAvatar(model: string, character: RiverCharacter, motions = riverAvatarMotions) {
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(model);
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('Character is missing its VRM rig'); }
  try {
    const animationLoader = new GLTFLoader();
    const [run, idle] = await Promise.all([animationLoader.loadAsync(motions.run), animationLoader.loadAsync(motions.idle)]);
    const runClip = retargetRiverClip(run, vrm, 'Run');
    const idleClip = retargetRiverClip(idle, vrm, 'Idle');
    VRMUtils.deepDispose(run.scene); VRMUtils.deepDispose(idle.scene);
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    if (character === 'bv') shapeBv(vrm);
    applyRiverPalette(vrm, character);
    vrm.scene.traverse(object => {
      if (object instanceof T.Mesh) {
        object.frustumCulled = false;
        object.castShadow = true;
        object.receiveShadow = false;
      }
    });
    VRMUtils.rotateVRM0(vrm); // Canonical +Z forward, including legacy VRM 0 files.
    return { vrm, runClip, idleClip, dispose: () => VRMUtils.deepDispose(vrm.scene) };
  } catch (error) { VRMUtils.deepDispose(vrm.scene); throw error; }
}

export type RiverAvatar = Awaited<ReturnType<typeof loadRiverAvatar>>;
