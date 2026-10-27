import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicPlayback} from '../app/components/musicPlayback.ts';

class AudioStub extends EventTarget {
  src='';volume=1;currentTime=0;duration=240;paused=true;plays=0;failure=null;
  load(){}
  removeAttribute(){this.src='';}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  play(){this.plays++;if(this.failure)return Promise.reject(this.failure);this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
}
const tracks=[{src:'one.m4a'},{src:'two.m4a'},{src:'three.m4a'}];
const setup=()=>{const audio=new AudioStub();const player=new MusicPlayback(audio,tracks,()=>{},.3,()=>.4);return {audio,player};};
test('autoplay rejection waits for a gesture and reports real playback',async()=>{
  const {audio,player}=setup();audio.failure={name:'NotAllowedError'};player.start();await Promise.resolve();
  assert.equal(player.state.status,'blocked');audio.failure=null;player.activate();
  assert.equal(player.state.status,'playing');player.destroy();
});
test('manual pause survives a video ending and unrelated interaction',()=>{
  const {audio,player}=setup();player.start();player.suspendForVideo(true);assert.equal(player.state.status,'video');
  player.pause();const plays=audio.plays;player.suspendForVideo(false);player.activate();
  assert.equal(audio.plays,plays);assert.equal(player.state.status,'paused');player.destroy();
});
test('video interruption resumes the same song at its existing position',()=>{
  const {audio,player}=setup();player.start();audio.currentTime=42;const src=audio.src;
  player.suspendForVideo(true);assert.equal(audio.paused,true);player.suspendForVideo(false);
  assert.equal(audio.src,src);assert.equal(audio.currentTime,42);assert.equal(player.state.status,'playing');player.destroy();
});
test('late failure from the previous song cannot overwrite a successful selection',async()=>{
  const {audio,player}=setup();let reject;audio.play=()=>new Promise((_,r)=>{reject=r;});player.start();
  audio.play=AudioStub.prototype.play;player.select(2);reject({name:'NotAllowedError'});await Promise.resolve();
  assert.equal(player.state.index,2);assert.equal(player.state.status,'playing');player.destroy();
});
test('ending picks another song and paused preference does not autoplay',()=>{
  const {audio,player}=setup();player.start(false);assert.equal(audio.plays,0);player.play();const before=player.state.index;
  audio.dispatchEvent(new Event('ended'));assert.notEqual(player.state.index,before);assert.equal(player.state.status,'playing');player.destroy();
});
test('unmount stops sound and stale requests cannot notify after disposal',async()=>{
  const audio=new AudioStub();let calls=0,reject;audio.play=()=>new Promise((_,r)=>{reject=r;});
  const player=new MusicPlayback(audio,tracks,()=>calls++);player.start();player.destroy();const before=calls;
  reject({name:'NotAllowedError'});await Promise.resolve();assert.equal(calls,before);assert.equal(audio.paused,true);assert.equal(audio.src,'');
});
