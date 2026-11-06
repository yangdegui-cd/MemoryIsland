import {getDb} from '../db';
import {auditEvents} from '../db/schema';
import {withAuditContext,type AuditContext} from './audit-context';

function route(path:string,method:string):{action:string;targetId?:string;recordKind?:string}|undefined{
  if(path==='/api/activity'&&method==='POST')return {action:'page.report'};
  if(path==='/api/identity')return {action:method==='GET'?'identity.check':method==='DELETE'?'auth.logout':'auth.request'};
  if(path==='/api/people')return {action:'people.update'};
  if(path==='/api/records')return {action:({GET:'record.list',POST:'record.save',DELETE:'record.delete',PATCH:'mood.unlock_all'} as Record<string,string>)[method]||'record.request'};
  const photo=path.match(/^\/api\/photos(?:\/([a-zA-Z0-9_-]{1,128}))?(\/share)?$/);
  if(photo)return {action:photo[2]?({GET:'photo.share_status',POST:'photo.share_enable',DELETE:'photo.share_revoke'} as Record<string,string>)[method]||'photo.share_request':({GET:'photo.read',POST:'photo.create',DELETE:'photo.delete'} as Record<string,string>)[method]||'photo.request',targetId:photo[1],recordKind:'photo'};
  const key=path.match(/^\/api\/api-keys(?:\/([a-zA-Z0-9_-]{1,128}))?$/);
  if(key)return {action:({GET:'api_key.list',POST:'api_key.create',DELETE:'api_key.revoke'} as Record<string,string>)[method]||'api_key.request',targetId:key[1]};
  const storage=path.match(/^\/api\/v1\/(chats|photos)(?:\/([a-zA-Z0-9_-]{1,128}))?$/);
  if(storage){const kind=storage[1]==='chats'?'chat':'photo';return {action:`api.${kind}.${method==='POST'?'create':storage[2]?'read':'list'}`,targetId:storage[2],recordKind:kind};}
}
function cleanId(value:unknown){return typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value)?value:null;}
function short(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):null;}

export async function auditRequest(request:Request,run:()=>Promise<Response>):Promise<Response>{
  const url=new URL(request.url),match=route(url.pathname,request.method);
  if(!match)return run();
  const context:AuditContext={...match};
  if(url.pathname==='/api/records'&&['diary','mood','habit','wish','wheel','spin','photo','chat'].includes(url.searchParams.get('kind')||''))context.recordKind=url.searchParams.get('kind')!;
  return withAuditContext(context,async()=>{
    let response:Response|undefined;
    try{response=await run();return response;}
    finally{
      const status=response?.status||500;
      const actor=context.actor;
      const details={...(context.recordKind?{kind:context.recordKind}:{}),...(context.reason?{reason:context.reason}:{}),...(context.count!==undefined?{count:context.count}:{}),...(actor?.keyId?{keyId:actor.keyId}:{})};
      try{
        // Keep persistence awaited, including failed requests and logout. A logging
        // outage must not turn an already committed user action into a retry.
        await getDb().insert(auditEvents).values({
          id:crypto.randomUUID(),createdAt:Date.now(),actorId:actor?.id??null,actorName:actor?.name??null,
          authType:actor?.authType??'anonymous',sessionRef:actor?.sessionRef??null,
          subjectId:cleanId(context.subjectId),action:context.action!,outcome:status<400?'success':status<500?'denied':'error',status,
          method:request.method,path:context.page??url.pathname,targetId:cleanId(context.targetId),
          // Nginx overwrites X-Real-IP and the application port is loopback-only.
          ip:short(request.headers.get('x-real-ip'),64),userAgent:short(request.headers.get('user-agent'),512),
          details:JSON.stringify(details),eventKey:actor&&context.eventKey?actor.id+':'+context.eventKey:null,
        }).onConflictDoNothing();
      }catch{
        console.error(JSON.stringify({event:'audit.write_failed',action:context.action,status}));
      }
    }
  });
}
