"use client";
import {useEffect,useRef,useState} from 'react';
import {Clock3,ChevronLeft,ChevronRight} from 'lucide-react';
import {dateKey} from './timeline';

export default function TimeCalendar({dates,language,onSelect,onOpenChange}:{dates:string[];language:'zh'|'en';onSelect:(date:string)=>void;onOpenChange:(open:boolean)=>void}){
 const [open,setOpen]=useState(false);
 const [month,setMonth]=useState('');
 const container=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const en=language==='en';
 const change=(value:boolean)=>{setOpen(value);onOpenChange(value);};
 useEffect(()=>{if(!open)return;function outside(e:PointerEvent){if(!container.current?.contains(e.target as Node)){setOpen(false);onOpenChange(false);}}function key(e:KeyboardEvent){if(e.key==='Escape'){e.stopPropagation();setOpen(false);onOpenChange(false);trigger.current?.focus();}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};},[open,onOpenChange]);
 const [y,m]=month.split('-').map(Number);
 const first=month?new Date(y,m-1,1,12):new Date();
 const days=month?new Date(y,m,0,12).getDate():0;
 const shift=(step:number)=>setMonth(dateKey(new Date(y,m-1+step,1,12)).slice(0,7));
 return <div ref={container} className="river-time-picker"><button ref={trigger} className="river-time-button" aria-expanded={open} aria-controls="river-time-calendar" disabled={!dates.length} onClick={()=>{if(!open)setMonth((dates.at(-1)||dateKey(new Date())).slice(0,7));change(!open);}}><Clock3 size={16}/>{en?'Time travel':'时间传送'}</button>{open&&<section id="river-time-calendar" className="river-calendar" aria-label={en?'Choose a travel date':'选择传送日期'}><div className="river-calendar-heading"><button aria-label={en?'Previous month':'上个月'} onClick={()=>shift(-1)}><ChevronLeft size={17}/></button><strong>{en?new Intl.DateTimeFormat('en',{month:'long',year:'numeric'}).format(first):`${y} 年 ${m} 月`}</strong><button aria-label={en?'Next month':'下个月'} onClick={()=>shift(1)}><ChevronRight size={17}/></button></div><div className="river-calendar-grid">{(en?['Su','Mo','Tu','We','Th','Fr','Sa']:['日','一','二','三','四','五','六']).map(d=><span className="river-weekday" key={d}>{d}</span>)}{Array.from({length:first.getDay()},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,'0')}`;const available=dates.includes(date);return <button key={date} disabled={!available} aria-label={date} className={available?'has-memory':''} onClick={()=>{onSelect(date);change(false);trigger.current?.focus();}}>{i+1}{available&&<i/>}</button>;})}</div><p>{en?'Glowing dates hold your conversations':'亮起的日期，藏着说过的话'}</p></section>}</div>;
}
