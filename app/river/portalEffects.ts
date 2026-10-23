import * as T from 'three';
import profile from '../../tools/blender/river-reference-profile.json';

/** The cutouts supply painted detail; these uniforms drive real-time light. */
export function portalSurface(active: T.Texture, dormant: T.Texture) {
  return new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: {
      time: { value: 0 }, uActive: { value: 1 },
      uView: { value: active }, uDormant: { value: dormant },
      uBounds: { value: new T.Vector4(...profile.uvBounds as [number,number,number,number]) },
      uSpring: { value: (profile.springHeight-profile.glassBottom)/(profile.springHeight+profile.glassRise-profile.glassBottom) },
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uView,uDormant;
      uniform float time,uActive,uSpring;
      uniform vec4 uBounds;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){
        vec2 uv=(vec2(vUv.x,1.-vUv.y)-uBounds.xy)/uBounds.zw;
        // A small optical ripple moves the world inside the gate, not its frame.
        vec2 flow=vec2(sin(uv.y*19.-time*.65),sin(uv.x*15.+time*.49))*.0028;
        vec3 view=texture2D(uView,vUv+flow*uActive).rgb;
        vec3 quiet=texture2D(uDormant,vUv).rgb*.80;
        float breathing=.88+.12*sin(time*1.35);
        float n=noise(uv*vec2(4.,8.)+vec2(time*.07,-time*.13));
        float wave=pow(.5+.5*sin(uv.y*25.+uv.x*10.+n*9.-time*1.3),24.);
        float archY=max(0.,(uv.y-uSpring)/(1.-uSpring));
        float outline=length(vec2((uv.x-.5)*2.,archY));
        float rim=pow(clamp(outline,0.,1.),36.)+pow(1.-clamp(uv.y,0.,1.),42.);
        vec3 magic=view*(1.06+.16*breathing);
        magic+=vec3(.10,.68,1.)*wave*.48;
        magic+=vec3(2.9,1.85,.65)*rim*breathing;
        vec2 grid=uv*vec2(16.,33.)+vec2(time*.035,-time*.28);
        vec2 cell=floor(grid),local=fract(grid)-.5;
        float twinkle=.35+.65*pow(.5+.5*sin(time*2.1+hash(cell)*6.28),2.);
        float star=(1.-smoothstep(.015,.09,length(local)))*step(.88,hash(cell))*twinkle;
        float rays=exp(-abs(local.x)*95.-abs(local.y)*13.)+exp(-abs(local.y)*95.-abs(local.x)*13.);
        magic+=vec3(3.5,2.7,1.3)*(star+rays*.10*step(.93,hash(cell)))*.7;
        gl_FragColor=vec4(mix(quiet,magic,uActive),1.);
      }`,
  });
}

export function animateFrameMaterial(material: T.MeshStandardMaterial, clock: { value: number }) {
  material.emissive.set('#ffca69');
  material.emissiveIntensity = 0;
  material.onBeforeCompile = shader => {
    shader.uniforms.riverTime = clock;
    shader.vertexShader = 'varying vec2 riverFrameUv;\n'+shader.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nriverFrameUv=vec2(uv.x,1.-uv.y);');
    shader.fragmentShader = 'varying vec2 riverFrameUv; uniform float riverTime;\n'+shader.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float crown=exp(-pow((riverFrameUv.x-.5)*30.,2.)-pow((riverFrameUv.y-.886)*35.,2.));
        float gilt=max(0.,diffuseColor.r-diffuseColor.b);
        float breath=.85+.15*sin(riverTime*1.35);
        totalEmissiveRadiance+=vec3(2.8,1.6,.48)*crown*breath;
        totalEmissiveRadiance+=vec3(.8,.45,.1)*gilt*.26*breath;
        float softLight=.22+.06*sin(riverFrameUv.y*15.+sin(riverTime*.37)*1.5)
          +.04*sin(riverFrameUv.x*23.+riverTime*.29);
        totalEmissiveRadiance+=vec3(1.1,.65,.23)*smoothstep(.07,.36,gilt)*softLight;`);
  };
  material.customProgramCacheKey = () => 'river-reference-soft-gold-v8';
  material.needsUpdate = true;
}

/** A continuous soft ribbon gently deforms; there is no circulating bright head. */
export function softFrameGlow(clock: {value:number}, outer=false) {
  const w=outer?1.48:profile.glassHalfWidth;
  const rise=outer?1.48:profile.glassRise;
  const points:T.Vector2[]=[];
  const base=profile.glassBottom,spring=profile.springHeight;
  for(let i=0;i<=60;i++)points.push(new T.Vector2(-w,base+(spring-base)*i/60));
  for(let i=1;i<=72;i++){const a=Math.PI*(1-i/72);points.push(new T.Vector2(Math.cos(a)*w,spring+Math.sin(a)*rise));}
  for(let i=1;i<=60;i++)points.push(new T.Vector2(w,spring-(spring-base)*i/60));
  const vertices:number[]=[],normals:number[]=[],uv:number[]=[],indices:number[]=[];
  let length=0;
  for(let i=0;i<points.length;i++){
    if(i)length+=points[i].distanceTo(points[i-1]);
    const direction=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();
    const normal=new T.Vector2(-direction.y,direction.x);
    for(const side of [-1,1]){
      vertices.push(points[i].x+normal.x*side*.14,points[i].y+normal.y*side*.14,0);
      normals.push(normal.x,normal.y);uv.push((side+1)/2,length);
    }
    if(i){const n=i*2;indices.push(n-2,n-1,n,n-1,n+1,n);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('ribbonNormal',new T.Float32BufferAttribute(normals,2));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    uniforms:{time:clock,strength:{value:outer?.19:.36}},
    vertexShader:`attribute vec2 ribbonNormal;varying vec2 vUv;uniform float time;
      void main(){vUv=uv;vec3 p=position;
        float curl=sin(uv.y*3.1+sin(time*.41))* .015+sin(uv.y*1.7-time*.33)*.018;
        p.xy+=ribbonNormal*curl;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time,strength;
      void main(){
        float warp=sin(vUv.y*2.4+sin(time*.47))* .22+sin(vUv.y*5.3-time*.36)*.08;
        float x=(vUv.x-.5)*5.2+warp;
        float veil=exp(-x*x*1.7);
        float silk=exp(-pow(x+sin(vUv.y*3.7+time*.32)*.42,2.)*12.);
        float gentle=.83+.10*sin(time*.54+vUv.y*.9);
        float fade=smoothstep(0.,.14,vUv.x)*(1.-smoothstep(.86,1.,vUv.x));
        gl_FragColor=vec4(vec3(1.8,1.12,.43),(veil*.62+silk*.18)*strength*gentle*fade);
      }`,
  });
  return {geometry,material};
}

/** All map channels receive the same per-module UV phase, preserving PBR fit. */
export function continuousPavingMaterial(material: T.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float riverTilePhase;\n'+shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv.y+=riverTilePhase;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv.y+=riverTilePhase;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv.y+=riverTilePhase;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv.y+=riverTilePhase;
      #endif
      #ifdef USE_METALNESSMAP
        vMetalnessMapUv.y+=riverTilePhase;
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      float pavingGilt=smoothstep(.06,.25,diffuseColor.r-diffuseColor.b);
      metalnessFactor=mix(.035,.62,pavingGilt);
      roughnessFactor=mix(.31,.24,pavingGilt);`);
  };
  material.customProgramCacheKey = () => 'river-continuous-paving-v8';
  material.needsUpdate = true;
}
