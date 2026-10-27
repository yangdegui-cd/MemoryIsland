"use client";
import Link from '../components/IslandLink';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Clapperboard,Copy,Film,Link2,LoaderCircle,Play,Plus,RotateCcw,Trash2,X} from 'lucide-react';
import {useIslandLanguage} from '../components/useIslandLanguage';
import './media.css';

type Job={id:string;source_url:string;platform:string;creator:string;title:string;state:string;progress:number;duration:number;size:number;error:string;created:number;stream_url:string|null};
type Storage={used:number;quota:number;maxFile:number;free:number};
const active=new Set(['queued','fetching','downloading','processing','cancelling']);
const messages:Record<string,[string,string]>={
 invalid_source:['请粘贴 Bilibili 或 YouTube 的单个视频链接。','Paste a single Bilibili or YouTube video link.'],
 login_required:['登录已失效，请刷新页面重新登录。','Your session expired. Refresh to sign in.'],
 access_required:['这个视频需要会员、登录或地区权限，服务器无法下载。','This video requires membership, sign-in, or regional access.'],
 geo_restricted:['这个视频限制了观看地区，当前服务器无法下载。','This video is unavailable in the server’s region.'],
 incomplete_video:['平台仅提供试看片段，或文件不完整，未保存为完整视频。','Only a preview or incomplete file was available. It was not saved as a full video.'],
 platform_restricted:['视频平台限制了服务器访问，请稍后重试或换一个链接。','The platform restricted server access. Try later or use another link.'],
 source_unavailable:['暂时无法获取视频，请检查链接或稍后重试。','Unable to retrieve this video. Check the link or try later.'],
 unsupported_video:['暂不支持直播、合集或尚未上线的视频。','Live streams, collections, and upcoming videos are not supported.'],
 too_large:['视频超过单个文件 2 GB 的限制。','This video exceeds the 2 GB file limit.'],
 too_long:['暂时支持时长在 3 小时内的视频。','Videos up to 3 hours are supported.'],
 storage_full:['服务器可用空间不足，请先删除一些视频。','Storage is nearly full. Remove a video before trying again.'],
 queue_full:['队列已有 5 个任务，请等一个任务完成。','Five downloads are queued. Wait for one to finish.'],
 timed_out:['下载超时，可以稍后重试。','The download timed out. You can retry later.'],
 invalid_state:['任务正在切换状态，请稍后再试。','This task is changing state. Try again in a moment.'],
 invalid_origin:['请求来源无效，请从媒体室页面操作。','Open the media room to perform this action.'],
 service_unavailable:['媒体服务暂时无法连接，请稍后重试。','The media service is unavailable. Try again shortly.'],
};
const states:Record<string,[string,string]>={queued:['排队中','Queued'],fetching:['读取视频','Reading video'],downloading:['下载中','Downloading'],processing:['整理视频','Preparing playback'],cancelling:['正在取消','Cancelling'],ready:['已收藏','Ready'],failed:['未能下载','Download failed'],cancelled:['已取消','Cancelled']};
function size(bytes:number){return bytes>=1024**3?`${(bytes/1024**3).toFixed(1)} GB`:`${(bytes/1024**2).toFixed(1)} MB`;}
function duration(seconds:number){const n=Math.round(seconds);return n>=3600?`${Math.floor(n/3600)}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}

export default function MediaRoom(){
 const{language,changeLanguage}=useIslandLanguage();const en=language==='en';
 const t=(zh:string,english:string)=>en?english:zh;
 const[jobs,setJobs]=useState<Job[]>([]),[storage,setStorage]=useState<Storage|null>(null),[url,setUrl]=useState('');
 const[selected,setSelected]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[actionId,setActionId]=useState(''),[copied,setCopied]=useState(false),[deleteId,setDeleteId]=useState<string|null>(null),[playerError,setPlayerError]=useState(false);
 const copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const video=useRef<HTMLVideoElement>(null);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  try{const response=await fetch('/api/media/jobs',{cache:'no-store',signal});const data=await response.json() as {jobs:Job[];storage:Storage;detail?:string};if(!response.ok)throw Error(data.detail||'service_unavailable');setJobs(data.jobs);setStorage(data.storage);setError(current=>['service_unavailable','login_required'].includes(current)?'':current);}
  catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message in messages?(e as Error).message:'service_unavailable');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;async function poll(){await refresh(controller.signal);if(!controller.signal.aborted)timer=setTimeout(poll,3000);}void poll();return()=>{controller.abort();clearTimeout(timer);if(copyTimer.current)clearTimeout(copyTimer.current);};},[refresh]);
 const ready=jobs.filter(j=>j.state==='ready');const playing=ready.find(j=>j.id===selected)||ready[0];
 useEffect(()=>{setPlayerError(false);setCopied(false);},[playing?.id]);
 async function mutate(path:string,method='POST',body?:unknown){
  const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json() as Job&{detail?:string};if(!response.ok)throw Error(data.detail||'service_unavailable');return data;
 }
 async function add(e:React.FormEvent){e.preventDefault();if(busy||!url.trim())return;setBusy(true);setError('');try{const job=await mutate('/api/media/jobs','POST',{url});setUrl('');setSelected(job.id);await refresh();}catch(e){setError((e as Error).message in messages?(e as Error).message:'service_unavailable');}finally{setBusy(false);}}
 async function action(job:Job,kind:'retry'|'cancel'|'delete'){if(actionId)return;setActionId(job.id);try{await mutate(`/api/media/jobs/${job.id}${kind==='delete'?'':`/${kind}`}`,kind==='delete'?'DELETE':'POST');setDeleteId(null);await refresh();}catch(e){setError((e as Error).message in messages?(e as Error).message:'service_unavailable');}finally{setActionId('');}}
 async function copy(){if(!playing?.stream_url)return;try{await navigator.clipboard.writeText(playing.stream_url);setCopied(true);if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),2500);}catch{const field=document.getElementById('media-stream-link') as HTMLInputElement|null;field?.focus();field?.select();}}
 const errorText=(code:string)=>(messages[code]||messages.source_unavailable)[en?1:0];
 return <div className="media-room">
  <header className="media-header"><Link prefetch={false} href="/games" className="media-back"><ArrowLeft size={17}/><span>{t('游戏屋','Game house')}</span></Link><span className="media-wordmark">OUR LITTLE CINEMA</span><button className="media-language" onClick={()=>changeLanguage(en?'zh':'en')} aria-label={t('切换为英文','Switch to Chinese')}>{en?'中':'EN'}</button></header>
  <main className="media-content">
   <div className="media-heading"><div><span className="media-eyebrow"><span/> {t('把喜欢的，留在这里','A little place for our favourites')}</span><h1>{t('媒体室','Media room')}<span>✦</span></h1></div><div className="media-counter"><Film size={18}/><strong>{ready.length.toString().padStart(2,'0')}</strong><span>{t('部收藏','saved videos')}</span></div></div>
   <form className="media-add" onSubmit={add}><Link2 size={19}/><label className="sr-only" htmlFor="media-source">{t('视频链接','Video link')}</label><input id="media-source" value={url} onChange={e=>setUrl(e.target.value)} placeholder={t('粘贴 Bilibili / YouTube 视频链接…','Paste a Bilibili / YouTube video link…')} maxLength={2048} required autoComplete="off"/><button type="submit" disabled={busy||!url.trim()}>{busy?<LoaderCircle size={17} className="media-spinning"/>:<Plus size={18}/>}<span>{busy?t('正在添加','Adding'):t('收藏视频','Save video')}</span></button></form>
   <div className="media-source-note"><span><i className="media-bili"/>Bilibili</span><span><i className="media-youtube"/>YouTube</span><small>{t('下载在后台继续，离开页面也没关系。','Downloads continue even when you leave this page.')}</small></div>
   {error&&<div className="media-alert" role="alert">{errorText(error)}<button onClick={()=>void refresh()}>{t('重试','Retry')}</button></div>}
   <div className="media-layout">
    <section className="media-screen-panel" aria-label={t('视频播放','Video player')}>
     <div className="media-screen">
      {playing?<video key={playing.id} ref={video} src={playing.stream_url!} controls playsInline preload="metadata" onError={()=>setPlayerError(true)}/>:<div className="media-empty-screen"><div className="media-film-mark"><Clapperboard size={42} strokeWidth={1}/><span>✦</span></div><h2>{t('今晚，看点喜欢的','Something good to watch')}</h2><p>{t('第一部收藏，从一个链接开始。','Your first favourite starts with a link.')}</p><div className="media-screen-dots"><i/><i/><i/></div></div>}
     </div>
     {playerError&&<p className="media-player-error" role="alert">{t('暂时无法播放，可以重新载入或直接打开视频链接。','Unable to play. Reload or open the video link directly.')}<button onClick={()=>{setPlayerError(false);video.current?.load();}}>{t('重新载入','Reload')}</button></p>}
     <div className="media-now"><div><span className="media-eyebrow">{t('正在放映','NOW SHOWING')}</span><h2>{playing?.title||t('等待一部好视频','Your next favourite awaits')}</h2>{playing&&<p>{playing.platform==='youtube'?'YouTube':'Bilibili'}<span>·</span>{duration(playing.duration)}<span>·</span>{size(playing.size)}<a href={playing.source_url} target="_blank" rel="noreferrer">{t('原视频','Original')}<ArrowUpRight size={13}/></a></p>}</div><Clapperboard className="media-now-icon" size={27} strokeWidth={1}/></div>
     {playing&&<div className="media-share"><label htmlFor="media-stream-link">{t('播放链接','Playback link')}</label><div><input id="media-stream-link" readOnly value={playing.stream_url!} onFocus={e=>e.target.select()}/><button onClick={copy} aria-label={t('复制播放链接','Copy playback link')}>{copied?<Check size={16}/>:<Copy size={16}/>}<span>{copied?t('已复制','Copied'):t('复制','Copy')}</span></button></div><small>{t('拥有此链接的人可以播放。删除视频后，链接立即失效。','Anyone with this link can play. Deleting the video disables the link.')}</small></div>}
    </section>
    <aside className="media-library"><div className="media-library-title"><h2>{t('我们的片单','Our collection')}</h2><span>{jobs.length}</span></div>
     {loading?<p className="media-library-empty" role="status"><LoaderCircle size={20} className="media-spinning"/>{t('正在打开片单…','Opening our collection…')}</p>:jobs.length===0?<div className="media-library-empty"><Film size={29} strokeWidth={1}/><p>{t('这里还很安静','A quiet little collection')}</p><small>{t('收藏的视频会按时间留在这里。','Saved videos will appear here.')}</small></div>:<ul className="media-list">{jobs.map((job,index)=><li key={job.id} className={`${playing?.id===job.id?'selected ':''}${job.state==='failed'?'failed':''}`}>
      <div className="media-item-top"><button className={`media-thumbnail ${job.platform}`} disabled={job.state!=='ready'} onClick={()=>setSelected(job.id)} aria-label={`${t('播放','Play')} ${job.title||job.source_url}`}>{job.state==='ready'?<Play size={20} fill="currentColor"/>:active.has(job.state)?<LoaderCircle size={20} className="media-spinning"/>:<Film size={22} strokeWidth={1}/>}<small>{String(jobs.length-index).padStart(2,'0')}</small></button><div className="media-item-info"><span className="media-platform">{job.platform==='youtube'?'YouTube':'Bilibili'}</span><button className="media-item-title" disabled={job.state!=='ready'} onClick={()=>setSelected(job.id)}>{job.title||t('等待读取视频标题','Waiting for video title')}</button><span className="media-status">{(states[job.state]||states.failed)[en?1:0]}{job.state==='downloading'?` · ${Math.round(job.progress)}%`:job.state==='ready'?` · ${duration(job.duration)}`:''}</span></div></div>
      {active.has(job.state)&&<progress max={100} value={job.progress} aria-label={t('下载进度','Download progress')}/>}
      {job.state==='failed'&&<p className="media-job-error">{errorText(job.error)}</p>}
      <div className="media-item-actions"><time>{new Intl.DateTimeFormat(en?'en-US':'zh-CN',{month:'short',day:'numeric'}).format(new Date(job.created*1000))}</time>{['failed','cancelled'].includes(job.state)&&<button disabled={!!actionId} onClick={()=>void action(job,'retry')}><RotateCcw size={13}/>{t('重试','Retry')}</button>}{active.has(job.state)?<button disabled={!!actionId||job.state==='cancelling'} onClick={()=>void action(job,'cancel')}><X size={13}/>{t('取消','Cancel')}</button>:<button disabled={!!actionId} onClick={()=>setDeleteId(job.id)} aria-label={`${t('删除','Delete')} ${job.title}`}><Trash2 size={13}/></button>}</div>
     </li>)}</ul>}
     {storage&&<div className="media-storage"><div><span>{t('小岛存储','Island storage')}</span><span>{size(storage.used)} / {size(storage.quota)}</span></div><progress max={storage.quota} value={storage.used}/><small>{t('最高 1080p · 单部 2 GB · 最长 3 小时','Up to 1080p · 2 GB per video · 3 hours max')}</small></div>}
    </aside>
   </div>
  </main>
  {deleteId&&<div className="media-modal-backdrop" onClick={()=>setDeleteId(null)}><div className="media-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="media-delete-title" onClick={e=>e.stopPropagation()}><h2 id="media-delete-title">{t('删除这部视频？','Delete this video?')}</h2><p>{t('服务器上的文件会被移除，播放链接也会失效。','The server file will be removed and its playback link will stop working.')}</p><div><button autoFocus disabled={!!actionId} onClick={()=>setDeleteId(null)}>{t('保留','Keep it')}</button><button className="media-confirm-delete" disabled={!!actionId} onClick={()=>{const job=jobs.find(j=>j.id===deleteId);if(job)void action(job,'delete');}}>{t('删除视频','Delete video')}</button></div></div></div>}
 </div>;
}
