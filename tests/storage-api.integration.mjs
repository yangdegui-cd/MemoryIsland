// A disposable compiled-worker D1/R2 instance. Never reads the real site database.
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist/server'),files=await readdir(root,{recursive:true});
const runtime=new Miniflare({name:'storage-api-qa',host:'127.0.0.1',port:0,
  modules:['index.js',...files.filter(n=>n.endsWith('.js')&&n!=='index.js')].map(name=>({type:'ESModule',path:path.join(root,name)})),modulesRoot:root,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,
  d1Databases:{DB:'storage-api-isolated'},r2Buckets:{BUCKET:'storage-api-isolated-photos'},
  assets:{directory:'dist/client',routerConfig:{has_user_worker:true}},
});
let checks=0;
try{
  const base=String(await runtime.ready).replace(/\/$/,'');
  const db=await runtime.getD1Database('DB'),bucket=await runtime.getR2Bucket('BUCKET');
  for(const name of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()){
    const statements=(await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
    await db.batch(statements.map(s=>db.prepare(s)));
  }
  async function call(route,{method='GET',json,body,token,cookie,origin=base,status=200,headers={}}={}){
    const response=await fetch(base+route,{method,headers:{origin,...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),...(json!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body?{body}:json!==undefined?{body:JSON.stringify(json)}:{})});
    assert.equal(response.status,status,`${method} ${route}: ${await response.clone().text()}`);checks++;return response;
  }
  const password='storage-test-only-2026';
  const setup=async name=>(await call('/api/identity',{method:'POST',json:{action:'setup',name,password,timeZone:'UTC'}})).headers.get('set-cookie').split(';')[0];
  const alexx=await setup('Alexx'),bv=await setup('BV');
  await call('/api/v1/photos',{status:401});
  await call('/api/v1/chats',{cookie:alexx,status:401});
  await call('/api/api-keys',{method:'POST',json:{},status:401});
  await call('/api/api-keys',{method:'POST',cookie:alexx,origin:'https://other.invalid',json:{},status:403});
  await call('/api/api-keys',{method:'POST',cookie:alexx,json:{name:'bad',scopes:['moods:read']},status:400});
  const allScopes=['photos:read','photos:write','chats:read','chats:write'];
  const createKey=async(scopes,cookie=alexx)=>(await call('/api/api-keys',{method:'POST',cookie,json:{name:'Disposable QA key',scopes},status:201})).json();
  const key=await createKey(allScopes),readOnly=await createKey(['chats:read']),writeOnly=await createKey(['photos:write']);
  const token=key.token;assert.match(token,/^di_[a-f0-9]{64}$/);
  const keyRows=await db.prepare('SELECT * FROM api_keys WHERE id = ?').bind(key.id).first();
  assert.notEqual(keyRows.token_hash,token);assert.match(keyRows.token_hash,/^[a-f0-9]{64}$/);
  const listed=await (await call('/api/api-keys',{cookie:alexx})).text();assert(!listed.includes(token));assert(!listed.includes(keyRows.token_hash));
  assert.equal((await (await call('/api/api-keys',{cookie:bv})).json()).items.length,0);
  await call('/api/api-keys/'+key.id,{method:'DELETE',cookie:bv,status:404});
  await call('/api/api-keys',{method:'POST',token,json:{name:'cannot escalate',scopes:allScopes},status:401});
  await call('/api/v1/photos',{token:readOnly.token,status:403});
  await call('/api/records?kind=mood',{token,status:401});

  const chat={title:'Alexx · BV',date:'2026-10-27',part:0,externalId:'chat-test-0',sourceNote:'Isolated test only',messages:[
    {role:'user',speaker:'Alexx',time:'2026-10-27 10:30:00',content:'Hi',original:'Hi',translation:'你好'},
    {role:'assistant',speaker:'BV',time:'2026-10-27T10:30:01-07:00',content:'Hello',original:'Hello',translation:'你好呀'},
  ]};
  await call('/api/v1/chats',{method:'POST',token:readOnly.token,json:chat,status:403});
  const saved=await (await call('/api/v1/chats',{method:'POST',token,json:chat,status:201})).json();
  assert.equal(saved.item.authorId,'alexx');assert.equal(saved.replayed,false);assert.deepEqual(saved.item.messages,chat.messages);
  assert.equal((await (await call('/api/v1/chats/'+saved.item.id,{token})).json()).item.id,saved.item.id);
  const repeated=await (await call('/api/v1/chats',{method:'POST',token,json:chat})).json();assert.equal(repeated.item.id,saved.item.id);assert.equal(repeated.replayed,true);
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,title:'changed'},status:409});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,date:'2026-02-30'},status:400});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,authorId:'bv'},status:400});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,messages:[]},status:400});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,messages:Array(501).fill(chat.messages[0])},status:400});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,messages:[{role:'admin',content:'invalid'}]},status:400});
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,messages:[{role:'user',time:'2026-02-30 10:30:00',content:'invalid'}]},status:400});
  await call('/api/v1/chats',{method:'POST',token,body:'{',headers:{'Content-Type':'application/json'},status:400});
  await call('/api/v1/chats',{method:'POST',token,body:'{}',status:415});
  await call('/api/v1/chats',{method:'POST',token,json:{large:'x'.repeat(2*1024*1024)},status:413});
  const shared=(await (await call('/api/records?kind=chat',{cookie:bv})).json()).find(row=>row.id===saved.item.id);
  assert.deepEqual(shared.data.messages,chat.messages);
  const concurrent=await Promise.all(Array.from({length:3},()=>fetch(base+'/api/v1/chats',{method:'POST',headers:{authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...chat,externalId:'concurrent-chat'})})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,200,201]);checks+=3;
  const anotherKey=await createKey(allScopes);
  assert.equal((await (await call('/api/v1/chats',{method:'POST',token:anotherKey.token,json:chat})).json()).item.id,saved.item.id);
  const bvKey=await createKey(allScopes,bv);
  assert.notEqual((await (await call('/api/v1/chats',{method:'POST',token:bvKey.token,json:chat,status:201})).json()).item.id,saved.item.id);
  await call('/api/v1/chats',{method:'POST',token,json:{...chat,date:'undated',externalId:'undated'},status:201});
  const page1=await (await call('/api/v1/chats?date=2026-10-27&limit=1',{token})).json();assert.equal(page1.items.length,1);assert(page1.nextCursor);
  const seen=new Set([page1.items[0].id]);let cursor=page1.nextCursor;
  while(cursor){const next=await (await call('/api/v1/chats?date=2026-10-27&limit=1&cursor='+encodeURIComponent(cursor),{token})).json();for(const row of next.items){assert(!seen.has(row.id));seen.add(row.id);}cursor=next.nextCursor;}
  assert.equal(seen.size,3);
  await call('/api/v1/chats?limit=51',{token,status:400});
  await call('/api/v1/chats?cursor=bad',{token,status:400});
  await call('/api/v1/chats?date=2025-02-29',{token,status:400});
  await call('/api/v1/chats/not-found',{token,status:404});

  const image=await readFile('public/art/album-cozy-oak-atlas-v1.png');assert(image.length>1024*1024);
  function form(bytes=image,id='photo-test',extra={}){const body=new FormData();body.set('file',new File([bytes],'source.png',{type:'image/png'}));for(const [name,value] of Object.entries({title:'API photo test',date:'2026-10-27',externalId:id,...extra}))body.set(name,value);return body;}
  const photo=await (await call('/api/v1/photos',{method:'POST',token,body:form(),status:201})).json();
  assert.equal(photo.item.size,image.length);assert.equal(photo.item.mime,'image/png');assert(!('key' in photo.item));assert(!('_api' in photo.item));
  const readback=await call(photo.item.url,{token});assert.equal(readback.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await readback.arrayBuffer()),image);
  assert.deepEqual(Buffer.from(await (await call('/api/photos/'+photo.item.id,{cookie:bv})).arrayBuffer()),image);
  assert.equal((await (await call('/api/v1/photos',{method:'POST',token,body:form()})).json()).item.id,photo.item.id);
  await call('/api/v1/photos',{method:'POST',token,body:form(image,'photo-test',{title:'Changed'}),status:409});
  await call('/api/v1/photos',{token:writeOnly.token,status:403});
  await call(photo.item.url,{status:401});
  await call('/api/v1/photos',{method:'POST',token,body:form(Buffer.from('<svg>bad</svg>'),'bad'),status:415});
  await call('/api/v1/photos',{method:'POST',token,body:form(image,'bad-date',{date:'2026-02-30'}),status:400});
  await call('/api/v1/photos',{method:'POST',token,body:form(image,'extra',{authorId:'bv'}),status:400});
  const big=Buffer.alloc(8*1024*1024+1);image.copy(big,0,0,16);
  await call('/api/v1/photos',{method:'POST',token,body:form(big,'too-big'),status:413});
  const photoRace=await Promise.all(Array.from({length:3},()=>fetch(base+'/api/v1/photos',{method:'POST',headers:{authorization:'Bearer '+token},body:form(image,'photo-concurrent')})));
  assert.deepEqual(photoRace.map(r=>r.status).sort(),[200,200,201]);checks+=3;
  const objects=await bucket.list();assert.equal(objects.objects.length,2,'Concurrent retries leave one R2 object, no orphan copies.');
  const photos=await (await call('/api/v1/photos?date=2026-10-27',{token})).json();assert.equal(photos.items.length,2);

  await db.prepare('UPDATE api_keys SET expires_at = 0 WHERE id = ?').bind(readOnly.id).run();
  await call('/api/v1/chats',{token:readOnly.token,status:401});
  await call('/api/api-keys/'+key.id,{method:'DELETE',cookie:alexx});
  await call('/api/v1/chats',{token,status:401});
  await call('/api/identity',{method:'POST',cookie:alexx,json:{action:'reset',password:'storage-reset-only-2026'}});
  await call('/api/v1/chats',{token:anotherKey.token,status:401});
  await call('/api/v1/chats',{token:bvKey.token});
  const docs=await call('/api/v1/docs');assert((await docs.text()).includes('externalId'));
  const markdown=await call('/api/v1/docs?format=markdown');assert.equal(await markdown.text(),await readFile('docs/storage-api.md','utf8'));
  console.log(`PASS ${checks} HTTP checks: scoped keys, hash-only storage, revocation/expiry/reset, image byte roundtrip, concurrent idempotency/R2 cleanup, chat validation, website compatibility, pagination and documentation.`);
}finally{await runtime.dispose();}
