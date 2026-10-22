import {eq} from 'drizzle-orm';
import {getDb} from '../../../db';import {users} from '../../../db/schema';
import {apiError,people,RequestError,requireUser,sameOrigin} from '../../../lib/identity';
import {validTimeZone} from '../../../lib/pair-time';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{
  sameOrigin(r);await requireUser();const body=await r.json() as {primaryId:string;people:{id:string;timeZone:string}[]};
  if(!['alexx','bv'].includes(body.primaryId)||!Array.isArray(body.people)||body.people.length!==2||new Set(body.people.map(p=>p.id)).size!==2||!body.people.every(p=>['alexx','bv'].includes(p.id)&&validTimeZone(p.timeZone)))throw new RequestError('请分别选择两人的时区和主时区。');
  const db=getDb();await db.batch([db.update(users).set({timeZone:body.people[0].timeZone,isPrimary:body.people[0].id===body.primaryId,updatedAt:Date.now()}).where(eq(users.id,body.people[0].id)),db.update(users).set({timeZone:body.people[1].timeZone,isPrimary:body.people[1].id===body.primaryId,updatedAt:Date.now()}).where(eq(users.id,body.people[1].id))]);
  return Response.json({people:await people()},{headers:{'Cache-Control':'no-store'}});
}catch(e){return apiError(e);}}
