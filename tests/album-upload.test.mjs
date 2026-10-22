import test from 'node:test';
import assert from 'node:assert/strict';
import {readPhotoError,preparePhotoUpload} from '../app/album/upload.ts';
test('plain-text 413 produces a helpful upload error instead of a JSON exception',async()=>{
  assert.match(await readPhotoError(new Response('Payload Too Large',{status:413})),/图片.*过/);
});
test('HTML proxy failures and structured API failures are handled safely',async()=>{
  assert.equal(await readPhotoError(new Response('<html>Bad Gateway</html>',{status:502})),'上传失败，请稍后重试。');
  assert.equal(await readPhotoError(Response.json({error:'请选择8MB以内的图片'},{status:400})),'请选择8MB以内的图片');
});
test('small images retain their original bytes and format',async()=>{
  const file=new File([new Uint8Array(100)],'small.png',{type:'image/png'});
  assert.equal(await preparePhotoUpload(file),file);
});
