import {env} from 'cloudflare:workers';
import {findSharedPhoto,photoSharePath,shareHeaders} from '../../../../lib/photo-sharing';
import {sharedPhotoPage} from '../../../../lib/shared-photo-page';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;const en=new URL(request.url).searchParams.get('lang')==='en';
  const headers={...shareHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
  try{
    const photo=await findSharedPhoto(token);const available=!!photo&&!!await env.BUCKET?.head(photo.key);
    return new Response(sharedPhotoPage({path:photoSharePath(encodeURIComponent(token)),title:available?photo!.title:'',date:available?photo!.date:'',en,available}),{status:available?200:404,headers});
  }catch{return new Response(en?'Temporarily unavailable. Please retry.':'暂时无法查看，请稍后重试。',{status:503,headers:{...shareHeaders,'Content-Type':'text/plain; charset=utf-8'}});}
}
