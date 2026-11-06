// Runs against a disposable compiled Worker, never against production data.
import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist/server'),files=await readdir(root,{recursive:true});
const runtime=new Miniflare({name:'photo-sharing-qa',host:'127.0.0.1',port:0,
  modules:['index.js',...files.filter(n=>n.endsWith('.js')&&n!=='index.js')].map(name=>({type:'ESModule',path:path.join(root,name)})),modulesRoot:root,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,
  d1Databases:{DB:'photo-sharing-isolated'},r2Buckets:{BUCKET:'photo-sharing-isolated'},
  assets:{directory:'dist/client',routerConfig:{has_user_worker:true}},
});
let checks=0;
try{
  const base=String(await runtime.ready).replace(/\/$/,'');
  const db=await runtime.getD1Database('DB'),bucket=await runtime.getR2Bucket('BUCKET');
  for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
    await db.batch((await readFile('drizzle/'+name,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
  async function call(route,{method='GET',cookie,json,origin=base,status=200,headers={}}={}){
    const response=await fetch(base+route,{method,headers:{origin,...(cookie?{cookie}:{}),...(json?{'Content-Type':'application/json'}:{}),...headers},...(json?{body:JSON.stringify(json)}:{})});
    assert.equal(response.status,status,`${method} ${route}: ${await response.clone().text()}`);checks++;return response;
  }
  const setup=async name=>(await call('/api/identity',{method:'POST',json:{action:'setup',name,password:'isolated-sharing-test-only',timeZone:'UTC'}})).headers.get('set-cookie').split(';')[0];
  const alexx=await setup('Alexx'),bv=await setup('BV');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  const metadata={key:'private-fixture.png',mime:'image/png',title:'<script>alert("x")</script> & memory',date:'2026-11-05',authorId:'alexx',privateNote:'Do not disclose'};
  await bucket.put(metadata.key,bytes,{httpMetadata:{contentType:'image/png'}});
  for(const [id,owner,kind,data] of [
    ['first','daily-island:alexx-bv','photo',metadata],
    ['second','daily-island:alexx-bv','photo',{...metadata,key:'second.png',title:'Another private photo'}],
    ['missing-file','daily-island:alexx-bv','photo',{...metadata,key:'absent.png'}],
    ['wrong-owner','another-island','photo',metadata],
    ['not-photo','daily-island:alexx-bv','mood',{body:'Private mood'}],
  ]) await db.prepare('INSERT INTO records (id,user_id,kind,data,created_at) VALUES (?,?,?,?,?)').bind(id,owner,kind,JSON.stringify(data),Date.now()).run();
  const endpoint='/api/photos/first/share';
  for(const method of ['GET','POST','DELETE'])await call(endpoint,{method,status:401});
  for(const method of ['POST','DELETE']){
    await call(endpoint,{method,cookie:alexx,origin:'https://other.invalid',status:403});
    await call(endpoint,{method,cookie:alexx,headers:{'sec-fetch-site':'cross-site'},status:403});
  }
  for(const id of ['wrong-owner','not-photo','not-found'])for(const method of ['GET','POST','DELETE'])await call('/api/photos/'+id+'/share',{method,cookie:alexx,status:404});
  await call('/api/photos/missing-file/share',{method:'POST',cookie:alexx,status:404});
  assert.deepEqual(await (await call(endpoint,{cookie:alexx})).json(),{enabled:false,url:null});
  await call('/api/photos/first',{status:401});
  const shared=await Promise.all(Array.from({length:3},()=>call(endpoint,{method:'POST',cookie:alexx}).then(r=>r.json())));
  assert.equal(new Set(shared.map(s=>s.url)).size,1,'Concurrent creation returns one stable link');
  const link=shared[0].url;assert.match(link,/^\/share\/photos\/[a-f0-9]{64}$/);
  assert.deepEqual(await (await call(endpoint,{cookie:bv})).json(),shared[0]);
  assert.deepEqual(await (await call('/api/photos/second/share',{cookie:alexx})).json(),{enabled:false,url:null});
  const page=await call(link),html=await page.text();
  assert(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; memory'));
  assert(html.includes('2026-11-05'));assert(html.includes('保存照片'));
  for(const privateText of ['Who are you?','private-fixture.png','Do not disclose','Another private photo','authorId','/api/records','<script>'])assert(!html.includes(privateText),privateText);
  assert((await (await call(link+'?lang=en')).text()).includes('Save photo'));
  for(const suffix of ['/image','/image?download=1','/image?photo=second']){
    const image=await call(link+suffix);assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);
    assert.equal(image.headers.get('content-type'),'image/png');
    assert.match(image.headers.get('content-disposition'),suffix.includes('download=1')?/^attachment/:/^inline/);
    assert.match(image.headers.get('cache-control'),/no-store/);
    assert.equal(image.headers.get('referrer-policy'),'no-referrer');
    assert.match(image.headers.get('x-robots-tag'),/noindex/);
  }
  assert.match(page.headers.get('cache-control'),/no-store/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  for(const bad of ['invalid','0'.repeat(64)])for(const suffix of ['','/image'])await call('/share/photos/'+bad+suffix,{status:404});
  await call('/api/photos/first',{status:401});
  await call(endpoint,{method:'DELETE',cookie:bv});
  await call(link,{status:404});await call(link+'/image',{status:404});
  await call('/api/photos/first',{cookie:alexx});
  assert.equal((await (await call(endpoint,{cookie:alexx})).json()).enabled,false);
  const renewed=await (await call(endpoint,{method:'POST',cookie:bv})).json();assert.notEqual(renewed.url,link);
  await call(link,{status:404});await call(renewed.url);
  await call('/api/photos/first',{method:'DELETE',cookie:alexx});
  await call(renewed.url,{status:404});await call(renewed.url+'/image',{status:404});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM photo_shares').first()).n,0,'Photo deletion removes shares');
  assert.equal((await db.prepare('SELECT count(*) AS n FROM records').first()).n,4,'Unrelated records preserved');
  console.log(`PASS ${checks} HTTP checks: private by default, authenticated sharing, origin checks, exact-photo access, concurrent creation, anonymous HTML/image, escaping, bilingual page, revocation, new-token rotation and deletion cleanup.`);
}finally{await runtime.dispose();}
