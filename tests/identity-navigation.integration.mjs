// Uses the disposable fixtures created by identity.integration.mjs.
import assert from 'node:assert/strict';
const base=process.env.ISLAND_TEST_ORIGIN;
if(base!=='http://127.0.0.1:5174')throw Error('Use the disposable preview on 127.0.0.1:5174.');
const anonymous=await(await fetch(base+'/api/identity')).json();assert.deepEqual(anonymous,{userId:null,people:[]});
const wrong=await(await fetch(base+'/api/identity',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'identify',name:'unknown visitor'})})).json();
assert.doesNotMatch(JSON.stringify(wrong),/Alexx|\bBV\b/);
for(const path of ['/','/mood','/river']){const html=await(await fetch(base+path)).text();assert.doesNotMatch(html,/Alexx|\bBV\b/,`${path}: names in anonymous HTML`);}
const login=await fetch(base+'/api/identity',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'login',name:'Alexx',password:'island-qa-reset-2026'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
for(const path of ['/','/mood','/river','/games','/album']){
 const r=await fetch(base+path,{headers:{cookie}});assert.equal(r.status,200);const html=await r.text();
 assert.match(html,/<div class="pair-app-content"/,`${path}: session must be restored in the initial HTML`);
 assert.doesNotMatch(html,/<div class="identity-backdrop"/,`${path}: authenticated navigation must not render the sign-in screen`);
 assert.doesNotMatch(html,/Who are you\?/,`${path}: authenticated initial render must not contain the dialog`);
}
await fetch(base+'/api/identity',{method:'DELETE',headers:{origin:base,cookie}});
const expired=await(await fetch(base+'/api/identity',{headers:{cookie}})).json();assert.deepEqual(expired,{userId:null,people:[]});
console.log('PASS anonymous identity and HTML privacy; server-restored session on five scenes; logout still requires authentication.');
