"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Link2,Trash2,X} from 'lucide-react';
import type {Entry} from '../components/data';

export default function PhotoViewer({photo,onClose,onNext,onDelete,busy}:{photo:Entry;onClose:()=>void;onNext:(delta:number)=>void;onDelete:(photo:Entry)=>void;busy:boolean}){
  const root=useRef<HTMLDivElement>(null);
  const[copyState,setCopyState]=useState('');
  useEffect(()=>{setCopyState('')},[photo.id]);
  useEffect(()=>{if(!copyState)return;const timer=setTimeout(()=>setCopyState(''),2500);return()=>clearTimeout(timer)},[copyState]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    root.current?.focus();
    return()=>previous?.focus();
  },[]);
  async function copyLink(){try{await navigator.clipboard.writeText(location.href);setCopyState('链接已复制')}catch{setCopyState('可复制浏览器地址栏链接')}}
  const index=photo.data.sampleIndex||0;
  return <div ref={root} tabIndex={-1} className="album-viewer" role="dialog" aria-modal="true" aria-label={photo.data.title||'照片大图'} onClick={onClose} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose()}
    if(event.key==='ArrowLeft'){event.preventDefault();onNext(-1)}
    if(event.key==='ArrowRight'){event.preventDefault();onNext(1)}
    if(event.key==='Tab'){
      const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  }}>
    <div className="album-viewer-tools" onClick={e=>e.stopPropagation()}>
      <button aria-label="复制照片链接" title="复制照片链接" onClick={copyLink}>{copyState==='链接已复制'?<Check size={18}/>:<Link2 size={18}/>}</button>
      <button aria-label="关闭大图" title="关闭大图" onClick={onClose}><X size={21}/></button>
    </div>
    <button className="album-viewer-prev" aria-label="上一张" onClick={e=>{e.stopPropagation();onNext(-1)}}><ArrowLeft size={21}/></button>
    <figure onClick={e=>e.stopPropagation()}>
      {photo.kind==='sample'?<div className="album-sample-full" role="img" aria-label={photo.data.title} style={{backgroundPosition:`${index%3*50}% ${index<3?0:100}%`}}/>:<img key={photo.id} src={'/api/photos/'+encodeURIComponent(photo.id)} alt={photo.data.title||'回忆照片'}/>}
      <figcaption><span>{photo.data.title}{photo.data.date&&<small>{photo.data.date}</small>}</span>{photo.kind!=='sample'&&<button disabled={busy} aria-label="删除照片" onClick={()=>onDelete(photo)}><Trash2 size={16}/></button>}</figcaption>
    </figure>
    <button className="album-viewer-next" aria-label="下一张" onClick={e=>{e.stopPropagation();onNext(1)}}><ArrowRight size={21}/></button>
    {copyState&&<span className="album-viewer-feedback" role="status">{copyState}</span>}
  </div>
}
