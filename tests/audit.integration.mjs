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
    return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie,headers:response.headers};
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

  // The browser viewer exposes a limited projection to the two authenticated
  // accounts. Reading the audit feed must not create another audit event.
  await call('/api/audit',undefined,'','GET',401);
  await call('/api/audit',undefined,reset.cookie,'GET',401);
  const bAgain=await call('/api/identity',{action:'login',name:'BV',password:password+'-new'});
  const beforeRead=await count();
  const feed=await call('/api/audit?limit=100',undefined,a.cookie);
  await call('/api/audit',undefined,bAgain.cookie);assert.equal(await count(),beforeRead);
  assert.match(feed.headers.get('cache-control'),/private, no-store/);assert.ok(feed.headers.get('vary').split(',').map(value=>value.trim()).includes('Cookie'));
  assert.ok(feed.data.items.some(item=>item.actorId==='alexx'));assert.ok(feed.data.items.some(item=>item.actorId==='bv'));
  assert.ok(feed.data.items.every(item=>!['identity.check','record.list','photo.read'].includes(item.action)));
  const bvFeed=await call('/api/audit?actor=bv&view=all&limit=100',undefined,a.cookie);assert.ok(bvFeed.data.items.every(item=>item.actorId==='bv'));
  const security=await call('/api/audit?view=auth',undefined,a.cookie);assert.ok(security.data.items.some(item=>item.actorId===null&&item.subjectId==='bv'&&item.reason==='incorrect_password'));
  const visits=await call('/api/audit?view=visits',undefined,a.cookie);assert.ok(visits.data.items.every(item=>['page.view','page.resume'].includes(item.action)));
  const pageHtml=await(await fetch(origin+'/activity')).text();assert.match(pageHtml,/identity-backdrop/);assert.doesNotMatch(pageHtml,/PRIVATE_NOTE_NEVER_LOG/);
  for(const query of ['actor=stranger','view=wrong','limit=101','limit=-1','limit=1.5','date=2026-02-30','cursor=invalid'])await call('/api/audit?'+query,undefined,a.cookie,'GET',400);
  const boundary=Date.parse('2001-01-01T00:00:00+08:00');
  for(const delta of [-1,0,3600000,3600000,86400000]){
    await db.prepare('INSERT INTO audit_events (id,created_at,actor_id,actor_name,auth_type,session_ref,action,outcome,status,method,path,ip,user_agent,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),boundary+delta,'bv','BV','session','PRIVATE_SESSION_REF','page.view','success',204,'POST','/mood','PRIVATE_IP','PRIVATE_DEVICE',JSON.stringify({keyId:'PRIVATE_KEY_ID',private:'PRIVATE_EXTRA'})).run();
  }
  let next=null;const ids=[];
  do{
    const page=await call('/api/audit?date=2001-01-01&limit=1'+(next?'&cursor='+encodeURIComponent(next):''),undefined,a.cookie);
    ids.push(...page.data.items.map(item=>item.id));
    assert.ok(page.data.items.every(item=>item.createdAt>=boundary&&item.createdAt<boundary+86400000));
    const serialized=JSON.stringify(page.data);for(const secret of ['PRIVATE_SESSION_REF','PRIVATE_IP','PRIVATE_DEVICE','PRIVATE_KEY_ID','PRIVATE_EXTRA'])assert.ok(!serialized.includes(secret));
    for(const item of page.data.items)assert.deepEqual(Object.keys(item).sort(),['id','createdAt','actorId','actorName','subjectId','action','outcome','path','authType','kind','reason','count'].sort());
    next=page.data.nextCursor;
  }while(next);
  assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
  const outsiderToken='f'.repeat(64),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(outsiderToken));
  await db.prepare("INSERT INTO users (id,name,created_at,updated_at) VALUES ('outsider','Outsider',0,0)").run();
  await db.prepare('INSERT INTO sessions (token_hash,user_id,credential_version,expires_at) VALUES (?,?,0,?)').bind(Buffer.from(hash).toString('hex'),'outsider',Date.now()+60000).run();
  await call('/api/audit',undefined,'island_identity='+outsiderToken,'GET',403);

  // A log-store failure must not encourage retrying an already committed write.
  await db.prepare('DROP TABLE audit_events').run();
  const saved=await call('/api/records',{kind:'wish',data:{title:'Still saved',category:'生活',done:false}},a.cookie,'POST',201);
  assert.ok(await db.prepare('SELECT id FROM records WHERE id=?').bind(saved.data.id).first());
  console.log(`PASS ${checks} audit HTTP checks: attribution, CRUD, authentication, viewer permissions, filtering, Beijing date boundaries, stable pagination, private-field projection and logging outage.`);
}finally{await runtime.dispose();await rm(temporary,{recursive:true,force:true});}
