/** Draw the notebook's already-laid-out DOM, without cloning the document or an iframe. */
const images = new Map<string, HTMLImageElement>();
export function preparePaperImages(sources: (string|undefined)[]) {
 for(const source of sources)if(source&&!images.has(source)) {
  const image=new Image();image.src=source;images.set(source,image);
 }
 // Retain nearby pages only. Uploaded photos can be large when decoded.
 while(images.size>12)images.delete(images.keys().next().value!);
}
export function retainPaperImages(sources:(string|undefined)[]){
 for(const source of images.keys())if(!sources.includes(source))images.delete(source);
 preparePaperImages(sources);
}
export function clearPaperImages(){images.clear();}
function pageImage(element:Element) {
 return (element as HTMLElement).style?.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
}
export function warmNotebookImages(book:HTMLElement) {
 preparePaperImages(Array.from(book.querySelectorAll<HTMLElement>('[style]')).map(pageImage));
}

// A cold timeline jump may decode a photo after the first frame. Refresh it without delaying the curl.
export function observePaperImages(book:HTMLElement,ready:()=>void){
 let cancelled=false;
 const pending=Array.from(book.querySelectorAll<HTMLElement>('[style]')).map(pageImage).filter((s):s is string=>!!s).map(source=>images.get(source)).filter((image):image is HTMLImageElement=>!!image&&!image.complete);
 if(pending.length)Promise.allSettled(pending.map(image=>image.decode())).then(()=>{if(!cancelled)ready();});
 return ()=>{cancelled=true;};
}

export function captureNotebook(book:HTMLElement) {
 const bounds=book.getBoundingClientRect(),scale=Math.min(devicePixelRatio,1.5);
 const canvas=document.createElement('canvas');canvas.width=Math.round(bounds.width*scale);canvas.height=Math.round(bounds.height*scale);
 const ctx=canvas.getContext('2d')!;ctx.scale(scale,scale);ctx.translate(-bounds.x,-bounds.y);
 ctx.fillStyle='#fffdf5';ctx.fillRect(bounds.x,bounds.y,bounds.width,bounds.height);
 const range=document.createRange();
 function drawText(node:Text,style:CSSStyleDeclaration,clip:DOMRect) {
  const text=node.textContent||'';if(!text.trim())return;
  ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle=style.color;ctx.textBaseline='alphabetic';
  ctx.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;
  const metrics=ctx.measureText('Hg');
  const ascent=metrics.fontBoundingBoxAscent??metrics.actualBoundingBoxAscent,descent=metrics.fontBoundingBoxDescent??metrics.actualBoundingBoxDescent;
  let line='',left=0,top=0,bottom=0;
  function flush(){if(line&&bottom>clip.top&&top<clip.bottom)ctx.fillText(line,left,top+(bottom-top-ascent-descent)/2+ascent);line='';}
  // Range positions preserve the browser's wrapping, handwritten font and scrolled content.
  let first=0;
  if(text.length>1000){
   let low=0,high=text.length-1;
   while(low<high){const mid=(low+high)>>>1;range.setStart(node,mid);range.setEnd(node,mid+1);if(range.getBoundingClientRect().bottom<clip.top)low=mid+1;else high=mid;}
   first=low;if(first>0&&/[\uDC00-\uDFFF]/.test(text[first]))first--;
  }
  for(let offset=first;offset<text.length;) {
   const char=String.fromCodePoint(text.codePointAt(offset)!);
   range.setStart(node,offset);range.setEnd(node,offset+char.length);offset+=char.length;
   const rect=range.getBoundingClientRect();
   if(!rect.width||!rect.height){if(char==='\n')flush();continue;}
   if(rect.top>clip.bottom){flush();break;}
   if(rect.bottom<clip.top)continue;
   if(line&&Math.abs(rect.top-top)>1)flush();
   if(!line){left=rect.left;top=rect.top;bottom=rect.bottom;}
   line+=style.textTransform==='uppercase'?char.toUpperCase():style.textTransform==='lowercase'?char.toLowerCase():char;
  }
  flush();ctx.letterSpacing='0px';
 }
 function drawIcon(svg:SVGSVGElement,style:CSSStyleDeclaration,rect:DOMRect) {
  const view=svg.viewBox.baseVal;ctx.save();ctx.translate(rect.x,rect.y);ctx.scale(rect.width/(view.width||24),rect.height/(view.height||24));
  ctx.translate(-view.x,-view.y);ctx.strokeStyle=style.color;ctx.lineWidth=Number(svg.getAttribute('stroke-width')||2);ctx.lineCap='round';ctx.lineJoin='round';
  for(const node of Array.from(svg.children)){
   const a=(key:string)=>Number(node.getAttribute(key)||0);const path=new Path2D();
   if(node.tagName==='path'){ctx.stroke(new Path2D(node.getAttribute('d')||''));continue;}
   if(node.tagName==='line'){path.moveTo(a('x1'),a('y1'));path.lineTo(a('x2'),a('y2'));}
   else if(node.tagName==='circle')path.arc(a('cx'),a('cy'),a('r'),0,Math.PI*2);
   else if(node.tagName==='rect')path.roundRect(a('x'),a('y'),a('width'),a('height'),a('rx'));
   else if(node.tagName==='polyline'||node.tagName==='polygon'){
    const points=(node.getAttribute('points')||'').trim().split(/[ ,]+/).map(Number);
    for(let i=0;i<points.length;i+=2)i?path.lineTo(points[i],points[i+1]):path.moveTo(points[i],points[i+1]);
    if(node.tagName==='polygon')path.closePath();
   }
   ctx.stroke(path);
  }
  ctx.restore();
 }
 function visit(element:Element,clip:DOMRect) {
  if(element.hasAttribute('data-book-effect'))return;
  const style=getComputedStyle(element),rect=element.getBoundingClientRect();
  if(style.display==='none'||style.visibility==='hidden'||!rect.width||!rect.height||rect.bottom<clip.top||rect.top>clip.bottom)return;
  ctx.save();ctx.globalAlpha*=Number(style.opacity);
  if(element!==book&&style.backgroundColor!=='rgba(0, 0, 0, 0)'){
   ctx.fillStyle=style.backgroundColor;ctx.beginPath();ctx.roundRect(rect.x,rect.y,rect.width,rect.height,parseFloat(style.borderRadius)||0);ctx.fill();
  }
  if(element!==book&&style.borderTopStyle==='solid'&&parseFloat(style.borderTopWidth)>0){
   const border=parseFloat(style.borderTopWidth);ctx.strokeStyle=style.borderTopColor;ctx.lineWidth=border;ctx.beginPath();ctx.roundRect(rect.x+border/2,rect.y+border/2,rect.width-border,rect.height-border,parseFloat(style.borderRadius)||0);ctx.stroke();
  }
  const source=pageImage(element);
  if(source){
   preparePaperImages([source]);const image=images.get(source)!;
   if(image.complete&&image.naturalWidth){
    ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.width,rect.height);ctx.clip();
    const ratio=Math.max(rect.width/image.naturalWidth,rect.height/image.naturalHeight),w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
    ctx.drawImage(image,rect.x+(rect.width-w)/2,rect.y+(rect.height-h)/2,w,h);ctx.restore();
   }
   const veil=ctx.createLinearGradient(0,rect.y,0,rect.bottom);veil.addColorStop(0,'#fffdf540');veil.addColorStop(1,'#fffdf559');ctx.fillStyle=veil;ctx.fillRect(rect.x,rect.y,rect.width,rect.height);
  }
  if(element.classList.contains('note-text')){
   ctx.strokeStyle='#e8e6d7';ctx.lineWidth=1;
   for(let y=rect.y+35.5;y<Math.min(rect.bottom,clip.bottom);y+=36)if(y>clip.top){ctx.beginPath();ctx.moveTo(rect.x,y);ctx.lineTo(rect.right,y);ctx.stroke();}
  }
  if(['auto','scroll','hidden','clip'].includes(style.overflowY)||['auto','scroll','hidden','clip'].includes(style.overflowX)){
   const top=Math.max(clip.top,rect.top),left=Math.max(clip.left,rect.left);
   clip=new DOMRect(left,top,Math.min(clip.right,rect.right)-left,Math.min(clip.bottom,rect.bottom)-top);
   ctx.beginPath();ctx.rect(clip.x,clip.y,clip.width,clip.height);ctx.clip();
  }
  if(element instanceof SVGSVGElement)drawIcon(element,style,rect);
  else if(element instanceof HTMLInputElement){
   ctx.fillStyle=element.value?style.color:'#a6aa96';ctx.font=`${style.fontSize} ${style.fontFamily}`;ctx.textBaseline='middle';
   ctx.fillText(element.value?'•'.repeat(element.value.length):element.placeholder,rect.x+parseFloat(style.paddingLeft),rect.y+rect.height/2);
  }else for(const node of Array.from(element.childNodes)){
   if(node.nodeType===Node.TEXT_NODE)drawText(node as Text,style,clip);
   else if(node instanceof Element)visit(node,clip);
  }
  ctx.restore();
 }
 visit(book,bounds);
 if(!matchMedia('(max-width:760px)').matches){
  const x=bounds.x+bounds.width/2-16,spine=ctx.createLinearGradient(x,0,x+32,0);
  spine.addColorStop(0,'#8b806300');spine.addColorStop(.48,'#8b80631c');spine.addColorStop(.54,'#ffffff99');spine.addColorStop(1,'#ffffff00');ctx.fillStyle=spine;ctx.fillRect(x,bounds.y,32,bounds.height);
 }
 ctx.strokeStyle='#d8d4c3';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(bounds.x+.5,bounds.y+.5,bounds.width-1,bounds.height-1,[8,18,18,8]);ctx.stroke();
 return canvas;
}
