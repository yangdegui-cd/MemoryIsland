export const UPLOAD_TARGET_BYTES=850*1024;

export async function readPhotoError(response:Response,fallback='上传失败，请稍后重试。'){
  if(response.status===413)return '这张图片超过服务器接收大小，请重试或选择较小的图片。';
  try{
    const text=await response.text();
    const data=JSON.parse(text);
    if(typeof data?.error==='string'&&data.error.trim())return data.error;
  }catch{/* Proxies can return plain text or HTML, not application JSON. */}
  if(response.status===401)return '登录状态已失效，请重新登录后上传。';
  if(response.status===429)return '上传较频繁，请稍后重试。';
  return fallback;
}

async function decode(file:File):Promise<{source:CanvasImageSource;width:number;height:number;release:()=>void}>{
  if(typeof createImageBitmap==='function'){
    try{const bitmap=await createImageBitmap(file);return{source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()}}catch{/* Try the image decoder below. */}
  }
  const url=URL.createObjectURL(file),image=new Image();
  try{
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('无法读取这张图片，请重新选择。'));image.src=url});
    return{source:image,width:image.naturalWidth,height:image.naturalHeight,release:()=>URL.revokeObjectURL(url)};
  }catch(error){URL.revokeObjectURL(url);throw error}
}

export async function preparePhotoUpload(file:File):Promise<File>{
  if(file.size<=UPLOAD_TARGET_BYTES)return file;
  const image=await decode(file);
  try{
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');if(!context)throw Error('当前浏览器无法处理大图，请选择较小的图片。');
    let edge=Math.min(3200,Math.max(image.width,image.height));
    for(let sizeAttempt=0;sizeAttempt<6;sizeAttempt++){
      const scale=Math.min(1,edge/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      context.imageSmoothingQuality='high';context.drawImage(image.source,0,0,canvas.width,canvas.height);
      for(const quality of [.9,.8,.7]){
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
        if(blob&&blob.size<=UPLOAD_TARGET_BYTES){
          const extension=blob.type==='image/webp'?'webp':blob.type==='image/jpeg'?'jpg':'png';
          return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.'+extension,{type:blob.type,lastModified:file.lastModified});
        }
      }
      edge*=.75;
    }
    throw Error('这张图片压缩后仍然过大，请选择较小的图片。');
  }finally{image.release()}
}
