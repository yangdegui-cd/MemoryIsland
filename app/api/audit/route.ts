import {and,desc,eq,gte,inArray,lt,or,type SQL} from 'drizzle-orm';
import {getDb} from '../../../db';
import {auditEvents} from '../../../db/schema';
import {apiError,requireUser,RequestError} from '../../../lib/identity';
import {calendarDate} from '../../../lib/storage-api-validation';
import {ACTIVITY_ACTIONS,AUTH_ACTIONS,type AuditPage} from '../../../lib/audit-view';
export const dynamic='force-dynamic';

export async function GET(request:Request){try{
  const user=await requireUser();
  if(!['alexx','bv'].includes(user.id))throw new RequestError('无权查看活动记录。',403);
  const query=new URL(request.url).searchParams;
  const actor=query.get('actor')||'all',view=query.get('view')||'activity';
  if(!['all','alexx','bv'].includes(actor)||!['activity','visits','auth','all'].includes(view))throw new RequestError('筛选条件无效。');
  const limit=Number(query.get('limit')??50);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new RequestError('每页需要 1–100 条记录。');
  const filters:SQL[]=[];
  // Actor filters mean verified accounts. Failed attempts naming someone stay
  // unverified and are shown under "Both" / "Sign-in & security" instead.
  if(actor!=='all')filters.push(eq(auditEvents.actorId,actor));
  if(view==='activity')filters.push(inArray(auditEvents.action,ACTIVITY_ACTIONS));
  if(view==='visits')filters.push(inArray(auditEvents.action,['page.view','page.resume']));
  if(view==='auth')filters.push(inArray(auditEvents.action,AUTH_ACTIONS));
  const date=query.get('date');
  if(date){
    if(!calendarDate.safeParse(date).success)throw new RequestError('日期格式无效。');
    const start=Date.parse(date+'T00:00:00+08:00');
    filters.push(gte(auditEvents.createdAt,start),lt(auditEvents.createdAt,start+86400000));
  }
  const token=query.get('cursor');
  if(token){
    let cursor:{time:number;id:string};
    try{
      if(token.length>256)throw Error();
      cursor=JSON.parse(atob(token));
      if(!Number.isSafeInteger(cursor.time)||cursor.time<0||typeof cursor.id!=='string'||!/^[a-f0-9-]{36}$/i.test(cursor.id))throw Error();
    }catch{throw new RequestError('分页位置无效，请刷新。');}
    filters.push(or(lt(auditEvents.createdAt,cursor.time),and(eq(auditEvents.createdAt,cursor.time),lt(auditEvents.id,cursor.id)))!);
  }
  const rows=await getDb().select({id:auditEvents.id,createdAt:auditEvents.createdAt,actorId:auditEvents.actorId,actorName:auditEvents.actorName,subjectId:auditEvents.subjectId,action:auditEvents.action,outcome:auditEvents.outcome,path:auditEvents.path,authType:auditEvents.authType,details:auditEvents.details})
    .from(auditEvents).where(and(...filters)).orderBy(desc(auditEvents.createdAt),desc(auditEvents.id)).limit(limit+1);
  const page=rows.slice(0,limit),last=page.at(-1);
  const result:AuditPage={items:page.map(({details,...row})=>{
    const meta=JSON.parse(details);
    return {...row,kind:typeof meta.kind==='string'?meta.kind:null,reason:typeof meta.reason==='string'?meta.reason:null,count:Number.isFinite(meta.count)?meta.count:null};
  }),nextCursor:rows.length>limit&&last?btoa(JSON.stringify({time:last.createdAt,id:last.id})):null};
  return Response.json(result,{headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
}catch(error){return apiError(error);}}
