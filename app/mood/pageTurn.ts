import {captureNotebook,warmNotebookImages,observePaperImages,clearPaperImages} from './paperSnapshot';
import * as THREE from 'three';
import {curlPoint, turnProgress} from './paperCurl';

export const TURN_DURATION = 650;
const SHADOW_VERTEX = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SHADOW_FRAGMENT = `varying vec2 vUv;uniform float progress,width,height,spine,total;
void main(){float lift=sin(3.14159265*progress);float radius=width*.125*lift;
float fold=width*(1.0-progress)-3.14159265*radius*.5;
float x=vUv.x*total-spine;float y=(vUv.y-.5)*height;float d=x-fold+y*.12*lift;
float blur=8.0+radius*.23;float shade=exp(-d*d/(blur*blur))*lift*.27;
gl_FragColor=vec4(.24,.21,.15,shade);}`;
const PAPER_VERTEX = 'varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const PAPER_FRAGMENT = `uniform sampler2D front,back;varying vec2 vUv;varying vec3 vNormal;
void main(){vec3 n=normalize(vNormal);
vec4 paper=gl_FrontFacing?texture2D(front,vUv):texture2D(back,vec2(1.0-vUv.x,vUv.y));
float light=.79+.21*abs(n.z);float rim=pow(max(0.0,abs(n.x)),7.0)*.075;
gl_FragColor=vec4(paper.rgb*light+rim,paper.a);
#include <colorspace_fragment>
}`;

function crop(source: HTMLCanvasElement, x: number, width: number) {
 const canvas = document.createElement('canvas');
 canvas.width = Math.round(width); canvas.height = source.height;
 canvas.getContext('2d')!.drawImage(source,x,0,width,source.height,0,0,canvas.width,canvas.height);
 return canvas;
}
function texture(canvas: HTMLCanvasElement) {
 const map = new THREE.CanvasTexture(canvas);
 map.colorSpace = THREE.SRGBColorSpace;
 map.minFilter = map.magFilter = THREE.LinearFilter;
 map.generateMipmaps = false;
 return map;
}

function createPaperEngine(width: number, height: number, mobile: boolean) {
 let pageWidth = mobile ? width : width/2;
 const renderer = new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.setSize(width,height); renderer.setClearColor('#fffdf5');
 renderer.outputColorSpace = THREE.SRGBColorSpace;
 renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
 const scene = new THREE.Scene();
 const camera = new THREE.OrthographicCamera(0,width,height/2,-height/2,.1,4000);
 camera.position.z = 2000;
 const placeholder = document.createElement('canvas'); placeholder.width = placeholder.height = 1;
 const empty = texture(placeholder);
 let baseGeometry = new THREE.PlaneGeometry(width,height);
 const baseMaterial = new THREE.MeshBasicMaterial({map:empty,toneMapped:false});
 const base = new THREE.Mesh(baseGeometry,baseMaterial); base.position.x = width/2; scene.add(base);
 const shadowMaterial = new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{progress:{value:0},width:{value:pageWidth},height:{value:height},spine:{value:mobile?0:width/2},total:{value:width}},
  vertexShader:SHADOW_VERTEX,fragmentShader:SHADOW_FRAGMENT});
 const shadow = new THREE.Mesh(baseGeometry,shadowMaterial); shadow.position.set(width/2,0,1); scene.add(shadow);
 let geometry = new THREE.PlaneGeometry(pageWidth,height,100,28);
 const material = new THREE.ShaderMaterial({side:THREE.DoubleSide,
  uniforms:{front:{value:empty},back:{value:empty}},vertexShader:PAPER_VERTEX,fragmentShader:PAPER_FRAGMENT});
 const sheet = new THREE.Mesh(geometry,material); sheet.frustumCulled = false;
 sheet.position.set(mobile?0:width/2,0,2); scene.add(sheet);
 let position = geometry.attributes.position as THREE.BufferAttribute;
 let original = Float32Array.from(position.array);
 let disposed = false;
 function render(progress: number) {
  if(disposed)return;
  for(let i=0;i<position.count;i++) {
   const point = curlPoint(original[i*3]+pageWidth/2,original[i*3+1],pageWidth,progress);
   position.setXYZ(i,point.x,point.y,point.z);
  }
  position.needsUpdate = true; geometry.computeVertexNormals();
  shadowMaterial.uniforms.progress.value = progress; renderer.render(scene,camera);
 }
 // Compile and upload before interaction, then keep the context and shaders warm.
 renderer.compile(scene,camera); render(0);
 return {get width(){return width;},get height(){return height;},get mobile(){return mobile;},renderer,render,
  resize(nextWidth:number,nextHeight:number,nextMobile:boolean){
   width=nextWidth;height=nextHeight;mobile=nextMobile;pageWidth=mobile?width:width/2;
   baseGeometry.dispose();baseGeometry=new THREE.PlaneGeometry(width,height);base.geometry=shadow.geometry=baseGeometry;
   geometry.dispose();geometry=new THREE.PlaneGeometry(pageWidth,height,100,28);sheet.geometry=geometry;
   position=geometry.attributes.position as THREE.BufferAttribute;original=Float32Array.from(position.array);
   base.position.x=width/2;shadow.position.x=width/2;sheet.position.x=mobile?0:width/2;
   shadowMaterial.uniforms.width.value=pageWidth;shadowMaterial.uniforms.height.value=height;
   shadowMaterial.uniforms.spine.value=mobile?0:width/2;shadowMaterial.uniforms.total.value=width;
   camera.right=width;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();renderer.setSize(width,height);
  },
  setMaps(front: THREE.Texture, back: THREE.Texture, base: THREE.Texture) {
   material.uniforms.front.value=front;material.uniforms.back.value=back;baseMaterial.map=base;
  },
  clearMaps(){material.uniforms.front.value=empty;material.uniforms.back.value=empty;baseMaterial.map=empty;},
  dispose(){if(disposed)return;disposed=true;empty.dispose();geometry.dispose();baseGeometry.dispose();material.dispose();shadowMaterial.dispose();baseMaterial.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
type PaperEngine = ReturnType<typeof createPaperEngine>;
const engines = new WeakMap<HTMLElement, PaperEngine>();
function engineFor(book: HTMLElement) {
 const {width,height} = book.getBoundingClientRect();
 const mobile = matchMedia('(max-width:760px)').matches;
 let engine = engines.get(book);
 if(engine&&(engine.width!==width||engine.height!==height||engine.mobile!==mobile))engine.resize(width,height,mobile);
 if(!engine){engine=createPaperEngine(width,height,mobile);engines.set(book,engine);}
 return engine;
}
/** Prepare once while idle; page turns never create a new WebGL context mid-interaction. */
export function prepareNotebookTurns(book: HTMLElement) {
 warmNotebookImages(book);
 const warm = () => {if(book.isConnected&&!matchMedia('(prefers-reduced-motion: reduce)').matches)try{engineFor(book);}catch{/* The turn handler provides a readable fallback. */}};
 const idle = 'requestIdleCallback' in window ? window.requestIdleCallback(warm,{timeout:800}) : undefined;
 const timer = idle===undefined ? window.setTimeout(warm,100) : undefined;
 const resize=new ResizeObserver(()=>{if(engines.has(book)&&book.getAttribute('aria-busy')!=='true')warm();});resize.observe(book);
 return () => {
  resize.disconnect();
  if(idle!==undefined)window.cancelIdleCallback(idle);
  if(timer!==undefined)window.clearTimeout(timer);
  engines.get(book)?.dispose();engines.delete(book);clearPaperImages();
 };
}

/** Snapshot actual layouts, then bend one subdivided sheet over the stationary pages. */
export async function animateNotebookTurn(book: HTMLElement, forward: boolean, applyTarget: () => void, onMiddle: () => void) {
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){applyTarget();onMiddle();return;}
 let overlay: HTMLDivElement|undefined, engine: PaperEngine|undefined;
 const textures: THREE.Texture[]=[];
 let applied=false;let stopImages:(()=>void)|undefined;
 try {
  if(!book.isConnected)return;
  engine=engineFor(book);
  const {width,height,mobile}=engine;
  const before=captureNotebook(book);
  overlay=document.createElement('div');overlay.className='book-turn-canvas';
  overlay.setAttribute('data-book-effect','');overlay.setAttribute('aria-hidden','true');
  before.style.cssText='width:100%;height:100%;display:block';
  overlay.appendChild(before);book.appendChild(overlay);
  applyTarget();applied=true;
  let after=captureNotebook(book);
  if(!book.isConnected)return;
  const half=mobile?before.width:before.width/2;
  const front=texture(crop(forward?before:after,mobile?0:half,half));
  const back=texture(crop(forward?after:before,0,half));
  const baseCanvas=document.createElement('canvas');baseCanvas.width=before.width;baseCanvas.height=before.height;
  const ctx=baseCanvas.getContext('2d')!;
  function drawBase(){
   if(mobile)ctx.drawImage(forward?after:before,0,0);
   else {
    ctx.drawImage(forward?before:after,0,0,half,before.height,0,0,half,before.height);
    ctx.drawImage(forward?after:before,half,0,half,before.height,half,0,half,before.height);
   }
  }
  drawBase();
  const baseMap=texture(baseCanvas);textures.push(front,back,baseMap);
  stopImages=observePaperImages(book,()=>{
   if(!overlay?.isConnected)return;
   after=captureNotebook(book);drawBase();baseMap.needsUpdate=true;
   const targetMap=forward?back:front;targetMap.image=crop(after,forward||mobile?0:half,half);targetMap.needsUpdate=true;
  });
  engine.setMaps(front,back,baseMap);engine.render(forward?.025:.975);
  overlay.replaceChildren(engine.renderer.domElement);
  await new Promise<void>(resolve=>{
   let start:number|undefined,middle=false;
   function frame(now:number) {
    start??=now;
    const elapsed=Math.min(1,(now-start)/TURN_DURATION),progress=.025+.975*turnProgress(elapsed);
    engine!.render(forward?progress:1-progress);
    if(!middle&&elapsed>=.45){middle=true;onMiddle();}
    if(elapsed<1&&book.isConnected)requestAnimationFrame(frame);else resolve();
   }
   requestAnimationFrame(frame);
  });
 } catch(error) {
  console.warn('Notebook turn unavailable',error);
  if(!applied)applyTarget();onMiddle();
 } finally {
  stopImages?.();overlay?.remove();engine?.clearMaps();textures.forEach(map=>map.dispose());
 }
}
