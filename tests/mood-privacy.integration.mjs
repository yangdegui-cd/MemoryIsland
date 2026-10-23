import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist/server');const files=await readdir(root,{recursive:true});
const mf=new Miniflare({name:'mood-privacy-qa',host:'127.0.0.1',port:0,modules:['index.js',...files.filter(n=>n.endsWith('.js')&&n!=='index.js')].map(n=>({type:'ESModule',path:path.join(root,n)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'isolated-mood-privacy-test'},r2Buckets:{BUCKET:'isolated-photos'},assets:{directory:'dist/client',routerConfig:{has_user_worker:true}},cf:false});
let checks=0;
try{
 const base=String(await mf.ready).replace(/\/$/,'');const db=await mf.getD1Database('DB');
 for(const name of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+name,'utf8');await db.batch(sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));}
 async function api(method,route,body,cookie='',status=200){const r=await mf.dispatchFetch(base+route,{method,headers:{origin:base,'Content-Type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));checks++;return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie};}
 const password='privacy-test-only-2026';const a=await api('POST','/api/identity',{action:'setup',name:'Alexx',password,timeZone:'Asia/Shanghai'});const b=await api('POST','/api/identity',{action:'setup',name:'BV',password,timeZone:'Asia/Shanghai'});
 const note={date:'2026-10-22',mood:'平静',note:'private original',locked:true,authorId:'bv',image:'data:image/jpeg;base64,YQ=='};
 const one=await api('POST','/api/records',{kind:'mood',data:note},a.cookie,201);const two=await api('POST','/api/records',{kind:'mood',data:{...note,note:'BV private'}},b.cookie,201);
 let aRows=(await api('GET','/api/records?kind=mood',null,a.cookie)).data;assert.equal(aRows.length,1);assert.equal(aRows[0].data.authorId,'alexx');
 let bRows=(await api('GET','/api/records',null,b.cookie)).data;assert.equal(bRows.length,1);assert.equal(bRows[0].id,two.data.id);assert(!JSON.stringify(bRows).includes('private original'));
 await api('POST','/api/records',{kind:'mood',id:one.data.id,data:{...note,locked:false}},b.cookie,403);
 await api('DELETE','/api/records',{id:one.data.id},b.cookie,403);
 await api('PATCH','/api/records',{action:'unlockAllMoods'},'',401);
 assert.equal((await api('PATCH','/api/records',{action:'unlockAllMoods'},a.cookie)).data.count,1);
 bRows=(await api('GET','/api/records?kind=mood',null,b.cookie)).data;assert.equal(bRows.length,2);
 aRows=(await api('GET','/api/records',null,a.cookie)).data;assert.equal(aRows.length,1);
 await api('POST','/api/records',{kind:'mood',id:one.data.id,data:note},b.cookie,403);
 await api('POST','/api/records',{kind:'mood',id:one.data.id,data:{...note,locked:true}},a.cookie);
 assert.equal((await api('GET','/api/records?kind=mood',null,b.cookie)).data.length,1);
 await api('POST','/api/records',{kind:'mood',id:one.data.id,data:{...note,locked:false}},a.cookie);
 assert.equal((await api('GET','/api/records?kind=mood',null,b.cookie)).data.length,2);
 console.log(`PASS ${checks} HTTP checks: author attribution, private text/image filtering, cross-user edit/delete/unlock denial, own bulk unlock, edit unlock/relock.`);
}finally{await mf.dispose();}
