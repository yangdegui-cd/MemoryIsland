"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Share2,Trash2,X} from 'lucide-react';
import type {Entry} from '../components/data';
import {useIslandLanguage} from '../components/useIslandLanguage';
import PhotoShare from './PhotoShare';

export default function PhotoViewer({photo,onClose,onNext,onDelete,busy}:{photo:Entry;onClose:()=>void;onNext:(delta:number)=>void;onDelete:(photo:Entry)=>void;busy:boolean}){
  const root=useRef<HTMLDivElement>(null);
  const[shareOpen,setShareOpen]=useState(false);
  const {language}=useIslandLanguage();const t=(zh:string,en:string)=>language==='en'?en:zh;
  useEffect(()=>{setShareOpen(false)},[photo.id]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    root.current?.focus();
    return()=>previous?.focus();
  },[]);
  function closeShare(){setShareOpen(false);root.current?.querySelector<HTMLButtonElement>('.album-share-trigger')?.focus();}
  const index=photo.data.sampleIndex||0;
  return <div ref={root} tabIndex={-1} className="album-viewer" role="dialog" aria-modal="true" aria-label={photo.data.title||t('照片大图','Photo viewer')} onClick={onClose} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(shareOpen)closeShare();else onClose()}
    if(!shareOpen&&event.key==='ArrowLeft'){event.preventDefault();onNext(-1)}
    if(!shareOpen&&event.key==='ArrowRight'){event.preventDefault();onNext(1)}
    if(event.key==='Tab'){
      const buttons=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')||[]);
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  }}>
    <div className="album-viewer-tools" onClick={e=>e.stopPropagation()}>
      {photo.kind!=='sample'&&<button className="album-share-trigger" aria-label={t('分享照片','Share photo')} aria-expanded={shareOpen} onClick={()=>setShareOpen(v=>!v)}><Share2 size={17}/><span>{t('分享','Share')}</span></button>}
      <button aria-label={t('关闭大图','Close photo')} title={t('关闭大图','Close photo')} onClick={onClose}><X size={21}/></button>
    </div>
    {shareOpen&&<PhotoShare key={photo.id} photoId={photo.id} onClose={closeShare}/>}
    <button className="album-viewer-prev" disabled={shareOpen} aria-label={t('上一张','Previous photo')} onClick={e=>{e.stopPropagation();onNext(-1)}}><ArrowLeft size={21}/></button>
    <figure onClick={e=>e.stopPropagation()}>
      {photo.kind==='sample'?<div className="album-sample-full" role="img" aria-label={photo.data.title} style={{backgroundPosition:`${index%3*50}% ${index<3?0:100}%`}}/>:<img key={photo.id} src={'/api/photos/'+encodeURIComponent(photo.id)} alt={photo.data.title||t('回忆照片','Memory photo')}/>}
      <figcaption><span>{photo.data.title}{photo.data.date&&<small>{photo.data.date}</small>}</span>{photo.kind!=='sample'&&<button disabled={busy||shareOpen} aria-label={t('删除照片','Delete photo')} onClick={()=>onDelete(photo)}><Trash2 size={16}/></button>}</figcaption>
    </figure>
    <button className="album-viewer-next" disabled={shareOpen} aria-label={t('下一张','Next photo')} onClick={e=>{e.stopPropagation();onNext(1)}}><ArrowRight size={21}/></button>
  </div>
}
