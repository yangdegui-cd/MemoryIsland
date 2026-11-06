import {eq} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
import {getDb} from '../../../../../db';
import {photoShares} from '../../../../../db/schema';
import {apiError,requireUser,RequestError,sameOrigin} from '../../../../../lib/identity';
import {findOwnedPhoto,photoSharePath} from '../../../../../lib/photo-sharing';
import {randomToken} from '../../../../../lib/password';

export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const result=(token?:string,status=200)=>Response.json({enabled:!!token,url:token?photoSharePath(token):null},{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(_request:Request,{params}:Context){try{
  await requireUser();const {id}=await params;await findOwnedPhoto(id);
  const [share]=await getDb().select().from(photoShares).where(eq(photoShares.photoId,id)).limit(1);
  return result(share?.token);
}catch(error){return apiError(error);}}

export async function POST(request:Request,{params}:Context){try{
  sameOrigin(request);const user=await requireUser();const {id}=await params;const photo=await findOwnedPhoto(id);
  if(!env.BUCKET)throw new RequestError('照片存储暂时不可用',503);
  const meta=JSON.parse(photo.data);
  if(!meta.key||!['image/png','image/jpeg','image/webp'].includes(meta.mime)||!await env.BUCKET.head(meta.key))throw new RequestError('照片不存在',404);
  const db=getDb();
  // One stable, unguessable link per photo, including concurrent create requests.
  await db.insert(photoShares).values({photoId:id,token:randomToken(),createdBy:user.id,createdAt:Date.now()}).onConflictDoNothing({target:photoShares.photoId});
  const [share]=await db.select().from(photoShares).where(eq(photoShares.photoId,id)).limit(1);
  if(!share)throw new RequestError('分享状态已变化，请重试',409);
  return result(share.token);
}catch(error){return apiError(error);}}

export async function DELETE(request:Request,{params}:Context){try{
  sameOrigin(request);await requireUser();const {id}=await params;await findOwnedPhoto(id);
  await getDb().delete(photoShares).where(eq(photoShares.photoId,id));
  return result();
}catch(error){return apiError(error);}}
