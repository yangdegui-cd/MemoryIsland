// Use only a disposable local DB/R2 instance; never production or the main preview.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=process.env.ALBUM_TEST_ORIGIN;
if(base!=='http://127.0.0.1:5186')throw Error('Use the isolated album QA instance on port 5186.');
const password='album-local-qa-2026';
const setup=await fetch(base+'/api/identity',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'setup',name:'Alexx',password,timeZone:'America/Los_Angeles'})});
assert.equal(setup.status,200,await setup.clone().text());
const cookie=setup.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const bytes=await readFile(new URL('../public/art/album-cozy-oak-atlas-v1.png',import.meta.url));assert.ok(bytes.length>1024*1024);
function form(data){const body=new FormData();body.set('file',new File([data],'album-upload-qa.png',{type:'image/png'}));body.set('title','Disposable album upload QA');body.set('date','2026-10-22');return body}
const uploaded=await fetch(base+'/api/photos',{method:'POST',headers:{origin:base,cookie},body:form(bytes)});
assert.equal(uploaded.status,201,await uploaded.clone().text());
const {id}=await uploaded.json();
try{
  const original=await fetch(base+'/api/photos/'+id,{headers:{cookie}});assert.equal(original.status,200);assert.equal((await original.arrayBuffer()).byteLength,bytes.length);
  const tooBig=Buffer.alloc(8*1024*1024+1);bytes.copy(tooBig,0,0,100);
  const rejected=await fetch(base+'/api/photos',{method:'POST',headers:{origin:base,cookie},body:form(tooBig)});
  assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/8MB/);
  console.log(`PASS: ${bytes.length} byte multipart upload, R2 readback, and API JSON rejection above 8MB.`);
}finally{
  const deleted=await fetch(base+'/api/photos/'+id,{method:'DELETE',headers:{origin:base,cookie}});assert.equal(deleted.status,200);
}
