import {headers} from 'next/headers';
import {and,eq,gt,lt} from 'drizzle-orm';
import {getDb} from '../db';
import {records,sessions,users} from '../db/schema';
import {digest,randomToken} from './password';
export const PAIR_OWNER='daily-island:alexx-bv';
const COOKIE='island_identity';
const LIFETIME=180*24*60*60;
export type Person={id:string;name:string;timeZone:string;isPrimary:boolean;initialized:boolean};
export class RequestError extends Error {constructor(message:string,public status=400){super(message);}}
export function sameOrigin(r:Request){const origin=r.headers.get('origin');if((origin&&origin!==new URL(r.url).origin)||r.headers.get('sec-fetch-site')==='cross-site')throw new RequestError('请求来源无效',403);}
export function apiError(error:unknown){return Response.json({error:error instanceof RequestError?error.message:'服务器暂时无法连接，请稍后重试。'},{status:error instanceof RequestError?error.status:503,headers:{'Cache-Control':'no-store'}});}
export async function seedPeople(){const now=Date.now();await getDb().insert(users).values([{id:'alexx',name:'Alexx',isPrimary:true,createdAt:now,updatedAt:now},{id:'bv',name:'BV',createdAt:now,updatedAt:now}]).onConflictDoNothing();}
export async function people():Promise<Person[]>{const all=await getDb().select().from(users);return all.filter(v=>['alexx','bv'].includes(v.id)).sort((a,b)=>a.id.localeCompare(b.id)).map(v=>({id:v.id,name:v.name,timeZone:v.timeZone,isPrimary:v.isPrimary,initialized:!!v.passwordHash}));}
function tokenFrom(cookie:string|null){return cookie?.split(';').map(p=>p.trim()).find(p=>p.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
export async function currentUser(){
  const token=tokenFrom((await headers()).get('cookie'));if(!token||!/^\w{64}$/.test(token))return null;
  const found=await getDb().select({user:users,session:sessions}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(and(eq(sessions.tokenHash,await digest(token)),gt(sessions.expiresAt,Date.now()))).limit(1);
  const match=found[0];return match&&match.user.credentialVersion===match.session.credentialVersion?match.user:null;
}
export async function readIdentity(){const user=await currentUser();return {userId:user?.id??null,people:user?await people():[]};}
export async function requireUser(){const user=await currentUser();if(!user)throw new RequestError('请先选择你的身份并登录。',401);return user;}
export async function sharedOwner(){return(await currentUser())?PAIR_OWNER:null;}
export function sessionCookie(r:Request,token:string,clear=false){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:LIFETIME}${new URL(r.url).protocol==='https:'?'; Secure':''}`;}
export async function endSession(){const token=tokenFrom((await headers()).get('cookie'));if(token)await getDb().delete(sessions).where(eq(sessions.tokenHash,await digest(token)));}
export async function startSession(r:Request,user:typeof users.$inferSelect){
  const db=getDb();const token=randomToken();await endSession();
  await db.batch([db.delete(sessions).where(lt(sessions.expiresAt,Date.now())),db.insert(sessions).values({tokenHash:await digest(token),userId:user.id,credentialVersion:user.credentialVersion,expiresAt:Date.now()+LIFETIME*1000})]);
  // Carry over only the records belonging to the platform-verified visitor.
  const legacyId=(await headers()).get('oai-authenticated-user-id');
  if(legacyId)await db.update(records).set({userId:PAIR_OWNER}).where(eq(records.userId,legacyId));
  return Response.json({userId:user.id,people:await people()},{headers:{'Set-Cookie':sessionCookie(r,token),'Cache-Control':'no-store'}});
}
