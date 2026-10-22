"use client";
import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
export default function UploadPreview({files,busy,onRemove}:{files:File[];busy:boolean;onRemove:(index:number)=>void}){
  const[urls,setUrls]=useState<string[]>([]);
  useEffect(()=>{const next=files.map(file=>URL.createObjectURL(file));setUrls(next);return()=>next.forEach(url=>URL.revokeObjectURL(url))},[files]);
  return <div className="album-upload-previews">{files.map((file,i)=><div key={`${file.name}-${i}`}><img src={urls[i]} alt={file.name}/><span>{file.name}</span><button type="button" disabled={busy} aria-label={`移除 ${file.name}`} onClick={()=>onRemove(i)}><X size={14}/></button></div>)}</div>
}
