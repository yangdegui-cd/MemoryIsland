"use client";

import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {usePathname} from 'next/navigation';
import {Music2,Pause,Play,SkipBack,SkipForward,Volume2,VolumeX,X,LoaderCircle} from 'lucide-react';
import {useIslandLanguage} from './useIslandLanguage';
import {musicPlaylist,playableMusic} from './musicPlaylist';
import {MusicPlayback,type PlaybackState} from './musicPlayback';
import './background-music.css';

const PREFS='island-music-preferences';
const initial:PlaybackState={index:-1,status:'paused',position:0,duration:0,volume:.3,wanted:true};
const time=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

export default function BackgroundMusic(){
  const {language}=useIslandLanguage();const en=language==='en';const pathname=usePathname();
  const audio=useRef<HTMLAudioElement>(null);const controller=useRef<MusicPlayback|null>(null);
  const[playback,setPlayback]=useState(initial);const[open,setOpen]=useState(false);
  const[portal,setPortal]=useState<Element|null>(null);
  const dock=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);const close=useRef<HTMLButtonElement>(null);
  const track=playableMusic[playback.index];const playing=playback.status==='playing';
  const t=(zh:string,english:string)=>en?english:zh;
  function persist(wanted:boolean,volume=playback.volume){try{localStorage.setItem(PREFS,JSON.stringify({wanted,volume}));}catch{}}
  function toggle(){controller.current?.toggle();if(controller.current)persist(controller.current.state.wanted);}
  function choose(index:number){controller.current?.select(index);persist(true);}
  function syncVideo(){controller.current?.suspendForVideo(Array.from(document.querySelectorAll('video')).some(v=>!v.paused&&!v.ended&&!v.muted&&v.volume>0));}

  useEffect(()=>{
    let wanted=true,volume=.3;
    try{const saved=JSON.parse(localStorage.getItem(PREFS)||'null');if(typeof saved?.wanted==='boolean')wanted=saved.wanted;if(typeof saved?.volume==='number'&&Number.isFinite(saved.volume))volume=Math.max(0,Math.min(1,saved.volume));}catch{}
    const player=new MusicPlayback(audio.current!,playableMusic,setPlayback,volume);controller.current=player;
    player.start(wanted);syncVideo();
    const activate=(e:Event)=>{if(!dock.current?.contains(e.target as Node))player.activate();};
    document.addEventListener('pointerdown',activate);document.addEventListener('keydown',activate);
    const videoEvent=(e:Event)=>{if(e.target instanceof HTMLVideoElement)syncVideo();};
    for(const event of ['play','playing','pause','ended','volumechange'])document.addEventListener(event,videoEvent,true);
    const fullscreen=()=>setPortal(document.fullscreenElement||document.body);fullscreen();
    document.addEventListener('fullscreenchange',fullscreen);
    return()=>{document.removeEventListener('pointerdown',activate);document.removeEventListener('keydown',activate);for(const event of ['play','playing','pause','ended','volumechange'])document.removeEventListener(event,videoEvent,true);document.removeEventListener('fullscreenchange',fullscreen);player.destroy();controller.current=null;};
  },[]);
  useEffect(()=>{setOpen(false);const frame=requestAnimationFrame(syncVideo);return()=>cancelAnimationFrame(frame);},[pathname]);
  useEffect(()=>{
    if(!open)return;close.current?.focus();
    const outside=(e:PointerEvent)=>{if(!dock.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  const dismiss=()=>{setOpen(false);trigger.current?.focus();};
  const status=playback.status==='blocked'?t('点击播放，听听今天的歌','Press play to start the music'):
    playback.status==='video'?t('视频播放中，音乐暂歇','Music rests while your video plays'):
    playback.status==='error'?t('这首暂时无法播放，请重试或换一首','Unavailable for now. Retry or pick another song.'):
    playback.status==='loading'?t('正在载入…','Loading…'):playing?t('正在播放','NOW PLAYING'):t('已暂停','PAUSED');
  return <><audio ref={audio} data-island-music preload="metadata"/>{portal&&createPortal(
    <div ref={dock} className={'music-dock'+(playing?' is-playing':'')+(pathname==='/river'?' music-dock-river':'')} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')dismiss();}} onKeyUp={e=>e.stopPropagation()}>
      {open&&<section className="music-panel" id="island-music-panel" role="dialog" aria-label={t('我们的歌单','Our playlist')}>
        <header><div><small>OUR LITTLE SOUNDTRACK</small><h2>{t('我们的歌单','Our playlist')}</h2></div><button ref={close} type="button" onClick={dismiss} aria-label={t('关闭歌单','Close playlist')}><X size={17}/></button></header>
        <div className="music-now"><div className="music-record" aria-hidden="true"><span><Music2 size={23}/></span></div><div><span className="music-status" role="status">{status}</span><h3>{track?.title||t('选一首，慢慢听','A song for this moment')}</h3><p>{track?.artist}</p></div></div>
        <label className="music-progress"><span className="music-sr-only">{t('播放进度','Playback position')}</span><input type="range" min="0" max={playback.duration||1} step=".1" value={Math.min(playback.position,playback.duration||1)} disabled={!playback.duration} onChange={e=>controller.current?.seek(Number(e.target.value))}/><span>{time(playback.position)}</span><span>{time(playback.duration)}</span></label>
        <div className="music-controls"><button type="button" aria-label={t('上一首','Previous song')} onClick={()=>{controller.current?.previous();persist(true);}}><SkipBack size={19}/></button><button type="button" className="music-play" aria-label={playing||playback.status==='loading'?t('暂停音乐','Pause music'):t('播放音乐','Play music')} onClick={toggle}>{playback.status==='loading'?<LoaderCircle className="music-loading" size={22}/>:playing?<Pause size={22} fill="currentColor"/>:<Play size={22} fill="currentColor"/>}</button><button type="button" aria-label={t('随机下一首','Shuffle next song')} onClick={()=>{controller.current?.next();persist(true);}}><SkipForward size={19}/></button></div>
        <ol className="music-list">{musicPlaylist.map((song,index)=><li key={song.id}><button type="button" className={song.id===track?.id?'selected':''} aria-current={song.id===track?.id?'true':undefined} aria-label={`${t('播放','Play')} ${song.title} · ${song.artist}`} disabled={!song.src} onClick={()=>choose(playableMusic.indexOf(song))}><span className="music-track-number">{song.id===track?.id&&playing?<span className="music-bars" aria-hidden="true"><i/><i/><i/></span>:String(index+1).padStart(2,'0')}</span><span className="music-track-text"><b>{song.title}</b><small>{song.artist}{!song.src? t(' · 音源待补充',' · Audio pending'):''}</small></span>{song.id===track?.id&&<span className="music-selected-dot"/>}</button></li>)}</ol>
        <footer><span>{t(`${playableMusic.length} 首可播放 · 随机续播`,`${playableMusic.length} songs · shuffle play`)}</span><label className="music-volume">{playback.volume===0?<VolumeX size={15}/>:<Volume2 size={15}/>}<span className="music-sr-only">{t('音量','Volume')}</span><input type="range" min="0" max="1" step=".01" value={playback.volume} onChange={e=>{const value=Number(e.target.value);controller.current?.setVolume(value);persist(playback.wanted,value);}}/></label></footer>
      </section>}
      <button ref={trigger} type="button" className="music-trigger" aria-label={t('背景音乐','Background music')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?'island-music-panel':undefined} title={track?`${track.title} · ${track.artist}`:t('背景音乐','Background music')} onClick={()=>{setOpen(v=>!v);controller.current?.activate();}}><Music2 size={21}/>{playing&&<span className="music-trigger-dot"/>}</button>
    </div>,portal)}</>;
}
