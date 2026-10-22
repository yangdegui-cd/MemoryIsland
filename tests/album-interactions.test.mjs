import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {deformPaperPoint} from '../app/components/albumPaper.ts';
import {photoUrl,validatePhotoFiles} from '../app/components/albumPhotos.ts';

test('hover geometry follows moving paper while its top stays pinned',()=>{
  const point=new THREE.Vector3();
  for(let time=0;time<30;time+=.2){
    deformPaperPoint(.5,1,12,18,.6,time,2,point);
    assert.deepEqual(point.toArray(),[0,0,0]);
  }
  const first=deformPaperPoint(0,0,12,18,.6,0,2,new THREE.Vector3());
  let movement=0;
  for(let time=0;time<20;time+=.2){
    const later=deformPaperPoint(0,0,12,18,.6,time,2,new THREE.Vector3());
    movement=Math.max(movement,first.distanceTo(later));
  }
  assert.ok(movement>.5&&movement<3);
});

test('photo links retain the route and unrelated query values',()=>{
  assert.equal(photoUrl('https://example.com/album?language=en','sample-1'),'/album?language=en&photo=sample-1');
  assert.equal(photoUrl('https://example.com/album?photo=sample-1&language=en',null),'/album?language=en');
});

test('pasted screenshots use the same file limits as file picker uploads',()=>{
  const screenshot=new File([new Uint8Array(100)],'clipboard.png',{type:'image/png'});
  assert.equal(validatePhotoFiles([screenshot]),'');
  assert.ok(validatePhotoFiles(Array(13).fill(screenshot)));
  assert.ok(validatePhotoFiles([new File([new Uint8Array(8*1024*1024+1)],'large.png',{type:'image/png'})]));
  assert.ok(validatePhotoFiles([new File(['not an image'],'script.svg',{type:'image/svg+xml'})]));
});
