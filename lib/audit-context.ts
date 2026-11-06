import {AsyncLocalStorage} from 'node:async_hooks';

export type AuditActor={id:string;name:string;authType:'session'|'api_key';sessionRef?:string;keyId?:string};
export type AuditDetails={action?:string;subjectId?:string;targetId?:string;recordKind?:string;reason?:string;count?:number;eventKey?:string;page?:string};
export type AuditContext=AuditDetails&{actor?:AuditActor};
const contexts=new AsyncLocalStorage<AuditContext>();

export function withAuditContext<T>(context:AuditContext,run:()=>T):T{return contexts.run(context,run);}
export function auditDetails(details:AuditDetails){const context=contexts.getStore();if(context)Object.assign(context,details);}
// Called only after the existing server-side credential validation succeeds.
// A name typed into the sign-in form is a subject, never an authenticated actor.
export async function auditActor(user:{id:string;name:string},authType:'session'|'api_key',credentialId:string){
  const context=contexts.getStore();if(!context)return;
  const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('island-audit-session:'+credentialId));
  context.actor={id:user.id,name:user.name,authType,...(authType==='session'
    ?{sessionRef:Array.from(new Uint8Array(fingerprint),n=>n.toString(16).padStart(2,'0')).join('').slice(0,24)}
    :{keyId:credentialId})};
}
