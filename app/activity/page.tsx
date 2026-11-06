'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,RefreshCw,Footprints} from 'lucide-react';
import Link from '../components/IslandLink';
import {usePeople} from '../components/PeopleProvider';
import {useIslandLanguage} from '../components/useIslandLanguage';
import {auditLabel,auditReason,type AuditItem,type AuditPage} from '../../lib/audit-view';
import './activity.css';

const format=(time:number,options:Intl.DateTimeFormatOptions,en=false)=>new Intl.DateTimeFormat(en?'en-GB':'zh-CN',{timeZone:'Asia/Shanghai',...options}).format(time);
const dayKey=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);

export default function ActivityPage(){
  const {people}=usePeople();const {language,changeLanguage}=useIslandLanguage();const en=language==='en';const t=(zh:string,english:string)=>en?english:zh;
  const [actor,setActor]=useState('all'),[date,setDate]=useState(''),[view,setView]=useState('activity');
  const [items,setItems]=useState<AuditItem[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState<'refresh'|'more'|null>('refresh'),[error,setError]=useState(''),[updated,setUpdated]=useState(0);
  const pending=useRef<AbortController|null>(null),version=useRef(0);
  const load=useCallback(async(next:string|null=null)=>{
    pending.current?.abort();const controller=new AbortController();pending.current=controller;const requestVersion=++version.current;
    setBusy(next?'more':'refresh');setError('');if(!next){setItems([]);setCursor(null);}
    const query=new URLSearchParams({actor,view});if(date)query.set('date',date);if(next)query.set('cursor',next);
    try{
      const response=await fetch('/api/audit?'+query,{cache:'no-store',signal:controller.signal});
      const data=await response.json() as AuditPage&{error?:string};
      if(!response.ok)throw Error(data.error||'无法读取活动记录 / Unable to load activity');
      if(version.current!==requestVersion)return;
      setItems(previous=>next?[...previous,...data.items.filter(item=>!previous.some(old=>old.id===item.id))]:data.items);setCursor(data.nextCursor);setUpdated(Date.now());
    }catch(e){if(!controller.signal.aborted&&version.current===requestVersion)setError((e as Error).message);}
    finally{if(version.current===requestVersion&&!controller.signal.aborted)setBusy(null);}
  },[actor,date,view]);
  useEffect(()=>{void load();return()=>pending.current?.abort();},[load]);
  const groups:Array<{key:string;time:number;items:AuditItem[]}>=[];
  for(const item of items){const key=dayKey(item.createdAt);const group=groups.at(-1);if(group?.key===key)group.items.push(item);else groups.push({key,time:item.createdAt,items:[item]});}
  const personName=(id:string|null)=>people.find(person=>person.id===id)?.name??'';
  return <div className="activity-page"><div className="activity-wrap">
    <header className="activity-top"><Link href="/" prefetch={false}><ArrowLeft size={17}/>{t('返回小岛','Back to island')}</Link><button onClick={()=>changeLanguage(en?'zh':'en')}>{en?'中文':'English'}</button></header>
    <div className="activity-heading"><div><p className="activity-eyebrow">OUR LITTLE ISLAND</p><h1>{t('活动记录','Our activity')}</h1><p className="activity-subtitle">{t('两个人，在小岛留下的足迹。','The little traces we leave on our island.')}</p></div><Footprints size={40} strokeWidth={1.1} aria-hidden="true"/></div>
    <div className="activity-controls">
      <div className="activity-people" role="group" aria-label={t('按账号筛选','Filter by account')}>
        {[{id:'all',name:t('全部','Both')},...people].map(person=><button key={person.id} aria-pressed={actor===person.id} onClick={()=>setActor(person.id)}>{person.id!=='all'&&<span className={'activity-dot '+person.id}/>} {person.name}</button>)}
      </div>
      <div className="activity-filters"><label><span>{t('日期','Date')}</span><input type="date" aria-label={t('筛选日期（北京时间）','Date in Beijing time')} value={date} onChange={event=>setDate(event.target.value)}/></label><label><span>{t('类型','Type')}</span><select aria-label={t('活动类型','Activity type')} value={view} onChange={event=>setView(event.target.value)}><option value="activity">{t('主要活动','Main activity')}</option><option value="visits">{t('页面访问','Page visits')}</option><option value="auth">{t('登录与安全','Sign-in & security')}</option><option value="all">{t('全部日志','All events')}</option></select></label>{date&&<button className="activity-clear" onClick={()=>setDate('')}>{t('全部日期','All dates')}</button>}</div>
    </div>
    <div className="activity-meta"><span>{t('北京时间 · 最新在前','Beijing time · Newest first')}{updated&&!busy?' · '+t('更新于 ','Updated ')+format(updated,{hour:'2-digit',minute:'2-digit',hour12:false}):''}</span><button disabled={!!busy} onClick={()=>void load()} aria-label={t('刷新记录','Refresh activity')}><RefreshCw size={14} className={busy==='refresh'?'activity-spinning':''}/>{t('刷新','Refresh')}</button></div>
    <div className="activity-feed" aria-busy={!!busy}>
      {error&&<div className="activity-error" role="alert">{error}<button disabled={!!busy} onClick={()=>void load(cursor)}>{t('重试','Retry')}</button></div>}
      {busy==='refresh'&&<p className="activity-empty" role="status">{t('正在读取足迹…','Loading our activity…')}</p>}
      {!busy&&!error&&!items.length&&<div className="activity-empty"><Footprints size={28} strokeWidth={1.3}/><p>{t('这段时间还没有匹配的记录。','No matching activity in this period.')}</p></div>}
      {groups.map(group=><section className="activity-day" key={group.key}><h2>{format(group.time,{year:'numeric',month:'long',day:'numeric'},en)}<span>{format(group.time,{weekday:'long'},en)}</span></h2><ol>{group.items.map(item=><li key={item.id}>
        <time dateTime={new Date(item.createdAt).toISOString()}>{format(item.createdAt,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}</time>
        <span className={'activity-avatar '+(item.actorId||'unknown')} aria-hidden="true">{item.actorName?.slice(0,1)||'?'}</span>
        <div className="activity-event"><div><strong>{item.actorName||t('未验证身份','Unverified identity')}</strong><span className="activity-action">{auditLabel(item,en)}</span>{item.outcome!=='success'&&<span className="activity-failed">{item.outcome==='denied'?t('未成功','Not completed'):t('出错','Error')}</span>}</div>
          {(!item.actorId&&item.subjectId||item.reason||item.authType==='api_key'||item.count!==null)&&<p>{[!item.actorId&&item.subjectId?t('尝试身份：','Attempted identity: ')+(personName(item.subjectId)||item.subjectId):'',auditReason(item.reason,en),item.authType==='api_key'?t('API 调用','API request'):'',item.count!==null?item.count+t(' 条记录',' records'):''].filter(Boolean).join(' · ')}</p>}
        </div>
      </li>)}</ol></section>)}
    </div>
    {!!items.length&&<footer className="activity-bottom"><span>{t('已显示 ','Showing ')}{items.length}{t(' 条记录',' events')}</span>{cursor&&<button disabled={!!busy} onClick={()=>void load(cursor)}>{busy==='more'?t('读取中…','Loading…'):t('更早的记录','Earlier activity')}</button>}</footer>}
  </div></div>;
}
