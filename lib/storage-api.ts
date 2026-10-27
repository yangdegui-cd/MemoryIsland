import {and,desc,eq,gt,lt,or,sql} from 'drizzle-orm';
import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getDb} from '../db';
import {apiKeys,records,users} from '../db/schema';
import {PAIR_OWNER,RequestError} from './identity';
import {digest} from './password';
import {calendarDate,chatInput,imageMime,photoInput,type StorageScope} from './storage-api-validation';

export function storageJson(body:unknown,status=200){
  return Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function storageError(error:unknown){
  if(error instanceof z.ZodError)return storageJson({error:'Invalid request fields.',details:error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))},400);
  return storageJson({error:error instanceof RequestError?error.message:'Storage is temporarily unavailable.'},error instanceof RequestError?error.status:503);
}
export async function requireApiKey(request:Request,scope:StorageScope){
  const match=request.headers.get('authorization')?.match(/^Bearer (di_[a-f0-9]{64})$/i);
  if(!match)throw new RequestError('A valid Bearer API key is required.',401);
  const [found]=await getDb().select({key:apiKeys,user:users}).from(apiKeys).innerJoin(users,eq(users.id,apiKeys.userId))
    .where(and(eq(apiKeys.tokenHash,await digest(match[1])),gt(apiKeys.expiresAt,Date.now()))).limit(1);
  if(!found||found.key.credentialVersion!==found.user.credentialVersion)throw new RequestError('The API key is invalid or expired.',401);
  if(!(JSON.parse(found.key.scopes) as string[]).includes(scope))throw new RequestError('Missing API scope: '+scope,403);
  return {userId:found.user.id,keyId:found.key.id};
}
async function readLimited(request:Request,limit:number){
  if(Number(request.headers.get('content-length'))>limit)throw new RequestError('Request body is too large.',413);
  const reader=request.body?.getReader();if(!reader)throw new RequestError('A request body is required.');
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RequestError('Request body is too large.',413);}chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function readStorageJson(request:Request,limit=2*1024*1024){
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError('Use Content-Type: application/json.',415);
  const bytes=await readLimited(request,limit);
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError('Invalid UTF-8 JSON body.');}
}
type Kind='photo'|'chat';
type Row=typeof records.$inferSelect;
type StoredData={title:string;date:string;authorId?:string;key?:string;mime?:string;size?:number;_api?:{externalId?:string;fingerprint:string};[key:string]:unknown};
function publicRecord(row:Row){
  const {key:objectKey,_api,...data}=JSON.parse(row.data) as StoredData;void objectKey;
  return {id:row.id,createdAt:row.createdAt,...data,...(_api?.externalId?{externalId:_api.externalId}:{}),
    ...(row.kind==='photo'?{url:'/api/v1/photos/'+row.id,albumUrl:'/album?photo='+row.id}:{})};
}
async function recordId(kind:Kind,userId:string,externalId?:string){
  return externalId?'api-'+kind+'-'+await digest(userId+'\0'+externalId):crypto.randomUUID();
}
async function findRecord(kind:Kind,id:string){
  return (await getDb().select().from(records).where(and(eq(records.id,id),eq(records.userId,PAIR_OWNER),eq(records.kind,kind))).limit(1))[0];
}
function replay(row:Row,fingerprint:string){
  if((JSON.parse(row.data) as StoredData)._api?.fingerprint!==fingerprint)throw new RequestError('externalId already exists with different content. Use a new externalId for a new import.',409);
  return storageJson({ok:true,replayed:true,item:publicRecord(row)});
}
export async function storeChat(request:Request,userId:string){
  const {externalId,...data}=chatInput.parse(await readStorageJson(request));
  const id=await recordId('chat',userId,externalId),fingerprint=await digest(JSON.stringify(data));
  const existing=await findRecord('chat',id);if(existing)return replay(existing,fingerprint);
  const row={id,userId:PAIR_OWNER,kind:'chat',createdAt:Date.now(),data:JSON.stringify({...data,authorId:userId,_api:{externalId,fingerprint}})};
  const inserted=await getDb().insert(records).values(row).onConflictDoNothing().returning();
  if(!inserted.length){const winner=await findRecord('chat',id);if(!winner)throw new Error('Import conflict');return replay(winner,fingerprint);}
  return storageJson({ok:true,replayed:false,item:publicRecord(row)},201);
}
export async function storePhoto(request:Request,userId:string){
  const bucket=env.BUCKET;if(!bucket)throw new Error('Missing R2 binding');
  const contentType=request.headers.get('content-type')||'';
  if(!/^multipart\/form-data\s*;/i.test(contentType))throw new RequestError('Use multipart/form-data with a file field.',415);
  const bytes=await readLimited(request,9*1024*1024);
  let form:FormData;
  try{form=await new Response(bytes,{headers:{'Content-Type':contentType}}).formData();}catch{throw new RequestError('Invalid multipart form.');}
  const file=form.get('file');
  if(!(file instanceof File)||!file.size)throw new RequestError('Select a non-empty image file.');
  if(file.size>8*1024*1024)throw new RequestError('Image size must not exceed 8 MiB.',413);
  if([...form.keys()].some(key=>!['file','title','date','externalId'].includes(key))||['file','title','date','externalId'].some(key=>form.getAll(key).length>1))throw new RequestError('Unknown or duplicate form field.');
  const {externalId,...data}=photoInput.parse({title:form.get('title'),date:form.get('date'),externalId:form.get('externalId')??undefined});
  const image=await file.arrayBuffer(),mime=imageMime(new Uint8Array(image));
  if(!mime)throw new RequestError('Only JPEG, PNG and WebP images are supported.',415);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',image)),n=>n.toString(16).padStart(2,'0')).join('');
  const fingerprint=await digest(JSON.stringify({...data,hash})),id=await recordId('photo',userId,externalId);
  const existing=await findRecord('photo',id);if(existing)return replay(existing,fingerprint);
  // A unique attempt object prevents concurrent retries from deleting the winner's file.
  const key='photos/'+encodeURIComponent(PAIR_OWNER)+'/'+crypto.randomUUID();
  await bucket.put(key,image,{httpMetadata:{contentType:mime}});
  const row={id,userId:PAIR_OWNER,kind:'photo',createdAt:Date.now(),data:JSON.stringify({...data,key,mime,size:file.size,authorId:userId,_api:{externalId,fingerprint}})};
  try{
    const inserted=await getDb().insert(records).values(row).onConflictDoNothing().returning();
    if(inserted.length)return storageJson({ok:true,replayed:false,item:publicRecord(row)},201);
  }catch(error){
    // Check ambiguous DB errors before removing an object that may have been committed.
    const saved=await findRecord('photo',id);
    if(saved&&(JSON.parse(saved.data) as StoredData).key===key)return storageJson({ok:true,replayed:false,item:publicRecord(saved)},201);
    await bucket.delete(key);throw error;
  }
  await bucket.delete(key);
  const winner=await findRecord('photo',id);if(!winner)throw new Error('Import conflict');return replay(winner,fingerprint);
}
export async function listStored(request:Request,kind:Kind){
  const query=new URL(request.url).searchParams;
  const limit=z.coerce.number().int().min(1).max(50).parse(query.get('limit')??20);
  const filters=[eq(records.userId,PAIR_OWNER),eq(records.kind,kind)];
  if(query.has('date')){const date=kind==='chat'?z.union([calendarDate,z.literal('undated')]).parse(query.get('date')):calendarDate.parse(query.get('date'));filters.push(sql`json_extract(${records.data}, '$.date') = ${date}`);}
  if(query.has('cursor')){
    let cursor:{createdAt:number;id:string};
    try{cursor=z.object({createdAt:z.number().int().nonnegative(),id:z.string().min(1).max(128)}).parse(JSON.parse(atob(query.get('cursor')!)));}catch{throw new RequestError('Invalid pagination cursor.');}
    filters.push(or(lt(records.createdAt,cursor.createdAt),and(eq(records.createdAt,cursor.createdAt),lt(records.id,cursor.id)))!);
  }
  const rows=await getDb().select().from(records).where(and(...filters)).orderBy(desc(records.createdAt),desc(records.id)).limit(limit+1);
  const more=rows.length>limit;const page=rows.slice(0,limit),last=page.at(-1);
  return storageJson({items:page.map(publicRecord),nextCursor:more&&last?btoa(JSON.stringify({createdAt:last.createdAt,id:last.id})):null});
}
export async function readStored(kind:Kind,id:string){
  const row=await findRecord(kind,id);if(!row)throw new RequestError('Record not found.',404);
  if(kind==='chat')return storageJson({item:publicRecord(row)});
  const data=JSON.parse(row.data) as StoredData;
  const bucket=env.BUCKET;if(!bucket)throw new Error('Missing R2 binding');
  const object=data.key?await bucket.get(data.key):null;if(!object)throw new RequestError('Image not found.',404);
  return new Response(object.body,{headers:{'Content-Type':data.mime||'application/octet-stream','Content-Length':String(object.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
