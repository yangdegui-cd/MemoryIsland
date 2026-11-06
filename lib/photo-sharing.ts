import {and,eq} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
import {getDb} from '../db';
import {photoShares,records} from '../db/schema';
import {PAIR_OWNER,RequestError} from './identity';

export const shareHeaders={
  'Cache-Control':'private, no-store, max-age=0',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff',
};
export const photoSharePath=(token:string)=>'/share/photos/'+token;

export async function findOwnedPhoto(id:string){
  const [row]=await getDb().select().from(records).where(and(eq(records.id,id),eq(records.userId,PAIR_OWNER),eq(records.kind,'photo'))).limit(1);
  if(!row)throw new RequestError('照片不存在',404);
  return row;
}

export async function findSharedPhoto(token:string){
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const [row]=await getDb().select({photo:records}).from(photoShares).innerJoin(records,eq(records.id,photoShares.photoId)).where(and(eq(photoShares.token,token),eq(records.userId,PAIR_OWNER),eq(records.kind,'photo'))).limit(1);
  if(!row||!env.BUCKET)return null;
  const data=JSON.parse(row.photo.data) as {key?:string;mime?:string;title?:string;date?:string};
  if(!data.key||!['image/png','image/jpeg','image/webp'].includes(data.mime||''))return null;
  return {key:data.key,mime:data.mime!,title:typeof data.title==='string'?data.title:'',date:typeof data.date==='string'?data.date:''};
}
