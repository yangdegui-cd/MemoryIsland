"use client";
import {useState,useEffect,useRef,useCallback} from 'react';
import {Upload,X,ArrowLeft,Maximize2,Images} from 'lucide-react';
import MemoryScene from '../components/MemoryScene';
import {useRecords,today,type Entry} from '../components/data';
import {samplePhotos,photoUrl,validatePhotoFiles} from '../components/albumPhotos';
import PhotoViewer from './PhotoViewer';
import UploadPreview from './UploadPreview';
import '../river/river.css';
import './album.css';

export default function Album(){
  const root=useRef<HTMLDivElement>(null),fileInput=useRef<HTMLInputElement>(null),openedHere=useRef(false);
  const s=useRecords('photo');
  const[uploadOpen,setUploadOpen]=useState(false),[files,setFiles]=useState<File[]>([]);
  const[title,setTitle]=useState(''),[date,setDate]=useState(today());
  const[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const[selectedId,setSelectedId]=useState<string|null>(null),[showAll,setShowAll]=useState(false);
  const displayPhotos=s.rows.length?s.rows:samplePhotos;
  const selected=displayPhotos.find(photo=>photo.id===selectedId);
  useEffect(()=>{
    const sync=()=>setSelectedId(new URL(location.href).searchParams.get('photo'));
    sync();window.addEventListener('popstate',sync);
    return()=>window.removeEventListener('popstate',sync);
  },[]);
  function selectPhoto(photo:Entry,replace=false){
    const url=photoUrl(location.href,photo.id);
    if(replace) history.replaceState(history.state,'',url);
    else {history.pushState(history.state,'',url);openedHere.current=true}
    setSelectedId(photo.id);setShowAll(false);
  }
  const closePhoto=useCallback(()=>{
    setSelectedId(null);
    if(openedHere.current){openedHere.current=false;history.back()}
    else history.replaceState(history.state,'',photoUrl(location.href,null));
  },[]);
  useEffect(()=>{
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    function key(e:KeyboardEvent){if(e.key==='Escape'){if(!busy)setUploadOpen(false);setShowAll(false)}}
    window.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=before;window.removeEventListener('keydown',key)};
  },[busy]);
  useEffect(()=>{
    function paste(event:ClipboardEvent){
      if(busy)return;
      const incoming=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((file):file is File=>!!file);
      if(!incoming.length)return;
      event.preventDefault();
      const named=incoming.map((file,i)=>new File([file],`截图-${new Date().toISOString().replace(/[:.]/g,'-')}-${i+1}.${file.type==='image/jpeg'?'jpg':file.type==='image/webp'?'webp':'png'}`,{type:file.type}));
      const combined=[...files,...named],problem=validatePhotoFiles(combined);
      if(problem){setError(problem);return}
      if(selectedId)closePhoto();
      setFiles(combined);setError('');setMessage('');setUploadOpen(true);
    }
    window.addEventListener('paste',paste);
    return()=>window.removeEventListener('paste',paste);
  },[busy,files,selectedId,closePhoto]);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current?.requestFullscreen()}catch{setError('无法进入系统全屏。')}}
  async function upload(e:React.FormEvent){
    e.preventDefault();if(!files.length){setError('先选择或粘贴想收藏的照片吧。');return}
    const problem=validatePhotoFiles(files);if(problem){setError(problem);return}
    setBusy(true);setError('');setMessage('');let count=0;
    try{
      for(const file of files){
        const form=new FormData();form.set('file',file);form.set('title',title.trim()||file.name.replace(/\.[^.]+$/,'').slice(0,120));form.set('date',date);
        const r=await fetch('/api/photos',{method:'POST',body:form});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);
        count++;setMessage(`已收藏 ${count} / ${files.length} 张`);
      }
      setFiles([]);setTitle('');if(fileInput.current)fileInput.current.value='';setUploadOpen(false);
    }catch(e){setFiles(files.slice(count));if(fileInput.current)fileInput.current.value='';setError(e instanceof Error?e.message:'上传失败')}
    finally{setBusy(false);await s.reload()}
  }
  async function remove(photo:Entry){
    if(!confirm('确定删除这张照片？删除后无法恢复。'))return;
    setBusy(true);setError('');
    try{const res=await fetch('/api/photos/'+photo.id,{method:'DELETE'});if(!res.ok)throw Error(((await res.json()) as {error:string}).error);closePhoto();await s.reload()}
    catch(e){setError(e instanceof Error?e.message:'删除失败')}finally{setBusy(false)}
  }
  function next(delta:number){if(!selected)return;const i=displayPhotos.findIndex(r=>r.id===selected.id);selectPhoto(displayPhotos[(i+delta+displayPhotos.length)%displayPhotos.length],true)}
  return <div ref={root} className="album-world">
    <section className="album-stage" aria-label="三维悬浮照片墙"><MemoryScene photos={s.rows} onSelect={selectPhoto}/><div className="universe-grain"/></section>
    <header className="river-header"><div className="river-brand"><h1>回忆相册</h1><span>PALACE OF MEMORIES</span></div><div className="river-actions">
      <button aria-label="收藏照片" title="收藏照片" onClick={()=>{setDate(today());setUploadOpen(true)}}><Upload size={17}/></button>
      <button aria-label="全部照片" title="全部照片" onClick={()=>setShowAll(true)}><Images size={17}/></button>
      <button aria-label="切换全屏" onClick={fullscreen}><Maximize2 size={17}/></button><a href="/"><ArrowLeft size={15}/>返回小岛</a>
    </div></header>
    {error&&<div className="notice" role="alert">{error}</div>}{message&&!busy&&<p className="success" role="status">{message}</p>}
    {uploadOpen&&<div className="album-panel-backdrop"><section className="panel editor" role="dialog" aria-modal="true" aria-label="收藏照片">
      <div className="section-head"><h3>每一张，都有自己的故事。</h3><button aria-label="关闭上传" className="icon-button" disabled={busy} onClick={()=>setUploadOpen(false)}><X size={18}/></button></div>
      <form onSubmit={upload}>
        <label className="photo-file">选择照片<input ref={fileInput} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const next=Array.from(e.target.files||[]),problem=validatePhotoFiles(next);if(problem){setError(problem);e.target.value='';return}setFiles(next);setError('')}}/><small>也可直接粘贴截图（⌘V / Ctrl+V）。每张不超过 8MB，一次最多 12 张。</small></label>
        {!!files.length&&<UploadPreview files={files} busy={busy} onRemove={index=>{setFiles(current=>current.filter((_,i)=>i!==index));if(fileInput.current)fileInput.current.value=''}}/>}
        <div className="form-grid"><label>这段回忆的名字（可选）<input maxLength={120} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)} placeholder="不填则使用照片文件名"/></label><label>回忆日期<input type="date" required disabled={busy} value={date} onChange={e=>setDate(e.target.value)}/></label></div>
        <button className="button coral" disabled={busy||!files.length}><Upload size={16}/>{busy?message||'正在收藏…':`上传${files.length?' '+files.length+' 张':''}照片`}</button>
      </form>
    </section></div>}
    {showAll&&<div className="album-panel-backdrop"><section className="panel album-collection" role="dialog" aria-modal="true" aria-label="全部照片"><div className="section-head"><h3>收藏的瞬间</h3><button aria-label="关闭照片列表" className="icon-button" onClick={()=>setShowAll(false)}><X size={18}/></button></div><div className="photo-grid">{displayPhotos.map(photo=><button key={photo.id} className="photo-grid-card" onClick={()=>selectPhoto(photo)}>{photo.kind==='sample'?<div className="album-sample-thumb" role="img" aria-label={photo.data.title} style={{backgroundPosition:`${photo.data.sampleIndex%3*50}% ${photo.data.sampleIndex<3?0:100}%`}}/>:<img src={'/api/photos/'+photo.id} alt={photo.data.title} loading="lazy"/>}<span>{photo.data.title}<small>{photo.data.date}</small></span></button>)}</div></section></div>}
    {selected&&<PhotoViewer photo={selected} onClose={closePhoto} onNext={next} onDelete={remove} busy={busy}/>}
    {selectedId&&!selected&&!s.loading&&<div className="album-panel-backdrop"><section className="panel" role="dialog" aria-label="照片不可用"><div className="section-head"><h3>这张照片暂时无法查看</h3><button aria-label="关闭大图" className="icon-button" onClick={closePhoto}><X size={18}/></button></div><p>照片可能已被删除，或当前登录身份没有访问权限。</p></section></div>}
  </div>
}
