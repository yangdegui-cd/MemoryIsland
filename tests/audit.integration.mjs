// Exercise the built production Worker, authentication, D1 and R2 in a fresh,
// disposable runtime. This test never connects to the production database.
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Miniflare} from 'miniflare';

const build=path.resolve(process.env.AUDIT_BUILD_DIR||'dist');
const root=path.join(build,'server');
const temporary=await mkdtemp(path.join(os.tmpdir(),'island-audit-'));
const files=await readdir(root,{recursive:true});
const runtime=new Miniflare({name:'audit-qa',port:0,host:'127.0.0.1',cf:false,
  modules:['index.js',...files.filter(name=>name.endsWith('.js')&&name!=='index.js')].map(name=>({type:'ESModule',path:path.join(root,name)})),modulesRoot:root,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'audit-qa'},d1Persist:path.join(temporary,'d1'),r2Buckets:{BUCKET:'audit-qa'},r2Persist:path.join(temporary,'r2'),
  assets:{directory:path.join(build,'client'),routerConfig:{has_user_worker:true}},
});
let checks=0;
const password='audit-test-password-2026',secretNote='PRIVATE_NOTE_NEVER_LOG';
let origin;
try{
  origin=(await runtime.ready).origin;
  const db=await runtime.getD1Database('DB');
  for(const name of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()){
    const sql=await readFile(path.join('drizzle',name),'utf8');
    await db.batch(sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  async function call(url,body,cookie='',method=body?'POST':'GET',expected=200,extra={}){
    const response=await fetch(origin+url,{method,headers:{origin,'User-Agent':'Audit QA Browser','X-Real-IP':'192.0.2.5',...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
    const data=response.status===204?null:await response.json();
    assert.equal(response.status,expected,JSON.stringify(data));checks++;
    return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie};
  }
  const last=()=>db.prepare('SELECT * FROM audit_events ORDER BY rowid DESC LIMIT 1').first();
  const count=async()=>Number((await db.prepare('SELECT count(*) AS n FROM audit_events').first()).n);
  const a=await call('/api/identity',{action:'setup',name:'Alexx',password,timeZone:'UTC'});
  assert.equal((await last()).actor_id,'alexx');assert.equal((await last()).action,'auth.setup');
  const b=await call('/api/identity',{action:'setup',name:'BV',password,timeZone:'Asia/Shanghai'});
  assert.equal((await last()).actor_id,'bv');
  await call('/api/identity',{action:'login',name:'BV',password:'wrong-password'},'','POST',401);
  let event=await last();assert.equal(event.actor_id,null);assert.equal(event.subject_id,'bv');assert.equal(JSON.parse(event.details).reason,'incorrect_password');
  await call('/api/identity',{action:'identify',name:'BV'});
  event=await last();assert.equal(event.actor_id,null);assert.equal(event.action,'auth.identify');
  const login=await call('/api/identity',{action:'login',name:'BV',password});
  event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.action,'auth.login');assert.equal(event.outcome,'success');const loginRef=event.session_ref;
  await call('/api/identity',undefined,login.cookie);
  event=await last();assert.equal(event.action,'identity.check');assert.equal(event.session_ref,loginRef);

  const visit={eventId:crypto.randomUUID(),path:'/mood',type:'view',actorId:'alexx',createdAt:1};
  await call('/api/activity',visit,login.cookie,'POST',204);
  event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.path,'/mood');assert.equal(event.action,'page.view');assert.ok(event.created_at>Date.now()-10_000);
  const before=await count();await call('/api/activity',visit,login.cookie,'POST',204);assert.equal(await count(),before);
  await call('/api/activity',{...visit,type:'resume',eventId:crypto.randomUUID()},login.cookie,'POST',204);assert.equal((await last()).action,'page.resume');
  await call('/api/activity',{...visit,eventId:crypto.randomUUID()},'','POST',401);assert.equal((await last()).actor_id,null);
  await call('/api/activity',{...visit,path:'/share/photos/private-token'},login.cookie,'POST',400);
  await call('/api/activity',{...visit,path:'/mood?password=private-token'},login.cookie,'POST',400);
  await call('/api/activity',visit,login.cookie,'POST',403,{origin:'https://foreign.test'});
  const parallel=await count();
  await Promise.all(Array.from({length:12},(_,i)=>call('/api/activity',{eventId:crypto.randomUUID(),type:'view',path:i%2?'/album':'/river'},i%2?a.cookie:b.cookie,'POST',204)));
  const concurrent=(await db.prepare("SELECT actor_id,path FROM audit_events WHERE action='page.view' AND path IN ('/album','/river')").all()).results;
  assert.equal(concurrent.length,12);assert.equal(await count(),parallel+12);assert.ok(concurrent.every(row=>row.actor_id===(row.path==='/album'?'alexx':'bv')));

  const note=await call('/api/records',{kind:'mood',data:{date:'2026-11-06',mood:'平静',note:secretNote,authorId:'bv'}},a.cookie,'POST',201);
  event=await last();assert.equal(event.actor_id,'alexx');assert.equal(event.action,'record.create');assert.equal(event.target_id,note.data.id);
  await call('/api/records',{kind:'mood',id:note.data.id,data:{date:'2026-11-06',mood:'开心',note:secretNote}},b.cookie);
  event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.action,'record.update');
  const row=await db.prepare('SELECT data FROM records WHERE id=?').bind(note.data.id).first();assert.equal(JSON.parse(row.data).authorId,'alexx');
  await call('/api/records?kind=mood&secret=private-token',undefined,b.cookie);assert.equal((await last()).path,'/api/records');
  await call('/api/records',{id:note.data.id},b.cookie,'DELETE');event=await last();assert.equal(event.action,'record.delete');assert.equal(event.target_id,note.data.id);

  const key=await call('/api/api-keys',{name:'PRIVATE_KEY_NAME',scopes:['chats:write'],expiresInDays:1},b.cookie,'POST',201);
  const chat=await call('/api/v1/chats',{title:'PRIVATE_CHAT_TITLE',date:'2026-11-06',externalId:'qa-only',messages:[{role:'user',content:secretNote}]},'','POST',201,{authorization:'Bearer '+key.data.token});
  event=await last();assert.equal(event.auth_type,'api_key');assert.equal(event.actor_id,'bv');assert.equal(event.target_id,chat.data.item.id);assert.equal(JSON.parse(event.details).keyId,key.data.id);
  await call('/api/v1/chats',undefined,'','GET',403,{authorization:'Bearer '+key.data.token});assert.equal((await last()).actor_id,'bv');
  await call('/api/api-keys/'+key.data.id,undefined,b.cookie,'DELETE');assert.equal((await last()).action,'api_key.revoke');
  await call('/api/v1/chats',undefined,'','GET',401,{authorization:'Bearer '+key.data.token});assert.equal((await last()).actor_id,null);

  const form=new FormData();form.set('file',new File([Uint8Array.from([137,80,78,71,13,10,26,10,0])],'private.png',{type:'image/png'}));form.set('title','PRIVATE_PHOTO_TITLE');form.set('date','2026-11-06');
  const upload=await fetch(origin+'/api/photos',{method:'POST',headers:{origin,cookie:b.cookie},body:form});assert.equal(upload.status,201);const photo=await upload.json();
  event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.action,'photo.create');assert.equal(event.target_id,photo.id);
  const share=await call('/api/photos/'+photo.id+'/share',{},b.cookie);assert.equal((await last()).action,'photo.share_enable');
  await call('/api/photos/'+photo.id+'/share',undefined,b.cookie,'DELETE');assert.equal((await last()).action,'photo.share_revoke');
  await call('/api/photos/'+photo.id,undefined,b.cookie,'DELETE');assert.equal((await last()).action,'photo.delete');

  const reset=await call('/api/identity',{action:'reset',password:password+'-new'},b.cookie);event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.action,'auth.password_reset');
  await call('/api/activity',{...visit,eventId:crypto.randomUUID()},login.cookie,'POST',401);assert.equal((await last()).actor_id,null);
  await call('/api/identity',undefined,reset.cookie,'DELETE');event=await last();assert.equal(event.actor_id,'bv');assert.equal(event.action,'auth.logout');
  await call('/api/activity',{...visit,eventId:crypto.randomUUID()},reset.cookie,'POST',401);assert.equal((await last()).actor_id,null);
  const all=JSON.stringify((await db.prepare('SELECT * FROM audit_events').all()).results);
  for(const secret of [password,secretNote,a.cookie,b.cookie,key.data.token,'PRIVATE_KEY_NAME','PRIVATE_CHAT_TITLE','PRIVATE_PHOTO_TITLE',share.data.url.split('/').pop(),'private-token'])assert.ok(!all.includes(secret),'Secret leaked into audit log');

  // A log-store failure must not encourage retrying an already committed write.
  await db.prepare('DROP TABLE audit_events').run();
  const saved=await call('/api/records',{kind:'wish',data:{title:'Still saved',category:'生活',done:false}},a.cookie,'POST',201);
  assert.ok(await db.prepare('SELECT id FROM records WHERE id=?').bind(saved.data.id).first());
  console.log(`PASS ${checks} audit HTTP checks: verified actors, failed login, restore, concurrent requests, page deduplication, CRUD, API keys, photo sharing, reset/logout/revocation, secret redaction and logging outage.`);
}finally{await runtime.dispose();await rm(temporary,{recursive:true,force:true});}
