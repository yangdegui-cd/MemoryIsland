import {and,eq,isNull,sql} from 'drizzle-orm';
import {getDb} from '../../../db';
import {users} from '../../../db/schema';
import {apiError,endSession,readIdentity,RequestError,requireUser,sameOrigin,seedPeople,sessionCookie,startSession} from '../../../lib/identity';
import {equalHash,passwordDigest,randomToken} from '../../../lib/password';
import {validTimeZone} from '../../../lib/pair-time';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await readIdentity(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(r:Request){try{
  sameOrigin(r);const body=await r.json() as {action?:string;name?:string;password?:string;timeZone?:string};
  if(!['identify','setup','login','reset'].includes(body.action||''))throw new RequestError('无效操作');
  await seedPeople();const db=getDb();
  const user=body.action==='reset'?await requireUser():(await db.select().from(users).where(eq(users.name,typeof body.name==='string'?body.name.trim():'')))[0];
  if(!user)throw new RequestError('名字未匹配，请检查后重试。');
  if(body.action==='identify')return Response.json({name:user.name,initialized:!!user.passwordHash},{headers:{'Cache-Control':'no-store'}});
  if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)throw new RequestError('密码需要 8–128 个字符。');
  if(body.action==='setup'){
    if(user.passwordHash)throw new RequestError('这个身份已经设置过密码，请使用密码登录。',409);
    if(!validTimeZone(body.timeZone))throw new RequestError('请选择有效的时区。');
    const salt=randomToken();const hash=await passwordDigest(body.password,salt);
    const updated=await db.update(users).set({passwordHash:hash,passwordSalt:salt,timeZone:body.timeZone,credentialVersion:1,updatedAt:Date.now()}).where(and(eq(users.id,user.id),isNull(users.passwordHash))).returning();
    if(!updated[0])throw new RequestError('这个身份已完成设置，请使用密码登录。',409);
    return await startSession(r,updated[0]);
  }
  if(body.action==='reset'){
    const salt=randomToken();const updated=await db.update(users).set({passwordHash:await passwordDigest(body.password,salt),passwordSalt:salt,credentialVersion:sql`${users.credentialVersion}+1`,failedAttempts:0,lockedUntil:0,updatedAt:Date.now()}).where(eq(users.id,user.id)).returning();
    return await startSession(r,updated[0]);
  }
  if(user.lockedUntil>Date.now())throw new RequestError('尝试次数较多，请 5 分钟后重试。',429);
  if(!user.passwordHash||!user.passwordSalt)throw new RequestError('请先设置这个身份的密码。',409);
  if(!equalHash(await passwordDigest(body.password,user.passwordSalt),user.passwordHash)){
    await db.update(users).set({failedAttempts:sql`CASE WHEN ${users.lockedUntil}>0 AND ${users.lockedUntil}<=${Date.now()} THEN 1 ELSE ${users.failedAttempts}+1 END`,lockedUntil:sql`CASE WHEN ${users.failedAttempts}>=4 AND ${users.lockedUntil}=0 THEN ${Date.now()+300000} ELSE 0 END`}).where(eq(users.id,user.id));
    throw new RequestError('密码不正确，请重试。',401);
  }
  await db.update(users).set({failedAttempts:0,lockedUntil:0}).where(eq(users.id,user.id));
  return await startSession(r,user);
}catch(e){return apiError(e);}}
export async function DELETE(r:Request){try{sameOrigin(r);await endSession();return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(r,'',true),'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
