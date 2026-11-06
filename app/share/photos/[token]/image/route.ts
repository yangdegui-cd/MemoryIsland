import {env} from 'cloudflare:workers';
import {findSharedPhoto,shareHeaders} from '../../../../../lib/photo-sharing';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    const photo=await findSharedPhoto((await params).token);
    if(!photo||!env.BUCKET)return new Response('Not found',{status:404,headers:shareHeaders});
    const object=await env.BUCKET.get(photo.key);
    if(!object)return new Response('Not found',{status:404,headers:shareHeaders});
    const extension=photo.mime==='image/png'?'png':photo.mime==='image/webp'?'webp':'jpg';
    return new Response(object.body,{headers:{...shareHeaders,'Content-Type':photo.mime,'Content-Length':String(object.size),'Content-Disposition':`${new URL(request.url).searchParams.get('download')==='1'?'attachment':'inline'}; filename="memory.${extension}"`,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
  }catch{return new Response('Temporarily unavailable',{status:503,headers:shareHeaders});}
}
