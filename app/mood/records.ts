"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Entry} from '../components/data';
import type {Note,Sealed} from './crypto';
type StoredNote=Note|{date:string;sealed:Sealed};
// One-time upload of pages created by the earlier browser-only preview. Keep the
// old copy as a fallback; all new writes and reads use the server.
async function importBrowserPages(){
 const marker='island-mood-cloud-import-v1';
 try{if(localStorage.getItem(marker))return;}catch{}
 if(!('indexedDB' in window)||typeof indexedDB.databases!=='function')return;
 if(!(await indexedDB.databases()).some(db=>db.name==='daily-island-mood-journal'))return;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('daily-island-mood-journal');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 let entries:Entry[]=[];try{if(db.objectStoreNames.contains('notes'))entries=await new Promise<Entry[]>((resolve,reject)=>{const r=db.transaction('notes','readonly').objectStore('notes').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
 for(const entry of entries){const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'mood',clientId:entry.id,data:entry.data})});if(!r.ok)throw Error('旧笔记上传未完成，内容仍保留，请重新读取。');}
 try{localStorage.setItem(marker,'done');}catch{}
}

export function useMoodRecords(en:boolean){
 const imported=useRef<Promise<void>|null>(null);const[rows,setRows]=useState<Entry[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[auth,setAuth]=useState(false);
 const reload=useCallback(async()=>{setLoading(true);try{if(!imported.current)imported.current=importBrowserPages().catch(error=>{imported.current=null;throw error;});await imported.current;const r=await fetch('/api/records?kind=mood',{cache:'no-store'});const data=await r.json() as Entry[]&{error?:string};setAuth(r.status===401);if(!r.ok)throw Error(data.error);setRows(data);setError('');}catch(e){setError((e as Error).message||'读取失败，请重试。');}finally{setLoading(false);}},[]);
 useEffect(()=>{reload();const refresh=()=>{if(document.visibilityState==='visible')reload();};document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh);},[reload]);
 async function save(data:StoredNote,id?:string):Promise<string|false>{setBusy(true);setError('');try{const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'mood',data,id})});const result=await r.json() as {id:string;error?:string};setAuth(r.status===401);if(!r.ok)throw Error(result.error);await reload();return result.id;}catch(e){setError((e as Error).message||(en?'Could not save. Your draft is still here.':'保存失败，草稿仍保留，请重试。'));return false;}finally{setBusy(false);}}
 async function remove(id:string){if(!confirm(en?'Delete this page permanently?':'确定删除这一页？删除后无法恢复。'))return;setBusy(true);setError('');try{const r=await fetch('/api/records',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);setRows(previous=>previous.filter(r=>r.id!==id));}catch(e){setError((e as Error).message||'删除失败，请重试。');}finally{setBusy(false);}}
 return {rows,loading,busy,error,auth,reload,save,remove};
}
