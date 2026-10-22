"use client";
import {useState,useEffect,useCallback} from 'react';
import {primaryToday} from '../../lib/pair-time';
import {usePeople} from './PeopleProvider';
export type Entry={id:string;kind:string;data:any;createdAt:number};
export const today=primaryToday;
export const moods=['开心','平静','一般','低落','疲惫'];export const faces=['☀️','🌿','☁️','🌧️','🌙'];
export function useRecords(kind?:string){usePeople();const[rows,setRows]=useState<Entry[]>([]);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[auth,setAuth]=useState(false);
const reload=useCallback(async()=>{setLoading(true);try{const r=await fetch('/api/records'+(kind?'?kind='+kind:''));if(r.status===401)setAuth(true);if(!r.ok)throw Error(((await r.json()) as {error:string}).error);setRows(await r.json());setAuth(false);setError('')}catch(e:any){setError(e.message||'读取失败')}finally{setLoading(false)}},[kind]);useEffect(()=>{reload()},[reload]);
async function save(data:any,id?:string,otherKind?:string){setBusy(true);setError('');try{const r=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:otherKind||kind,data,id})});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);await reload();return true}catch(e:any){setError(e.message);return false}finally{setBusy(false)}}
async function remove(id:string){if(!confirm('确定删除这条记录？删除后无法恢复。'))return;setBusy(true);try{const r=await fetch('/api/records',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error(((await r.json()) as {error:string}).error);await reload()}catch(e:any){setError(e.message)}finally{setBusy(false)}}return{rows,loading,busy,error,auth,save,remove,reload}}
export function Status({state}:{state:any}){const identity=usePeople();return <>{state.loading&&<p className="muted small">正在打开你的小岛…</p>}{state.error&&<div className="notice" role="alert">{state.error} {state.auth?<button className="text-button" onClick={identity.refresh}>重新登录 →</button>:<button className="text-button" onClick={state.reload}>重新读取</button>}</div>}</>}
export function Heading({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action?:React.ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}<span className="title-dot">.</span></h1><p>{desc}</p></div>{action}</div>}

export function useMounted(){const[mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return mounted}
