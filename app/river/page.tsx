"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize, X } from 'lucide-react';
import RiverScene from './RiverScene';
import TimeCalendar from './TimeCalendar';
import { offsetDate, type RiverChat } from './timeline';
import './river.css';
import {useIslandLanguage} from '../components/useIslandLanguage';
import {usePeople} from '../components/PeopleProvider';
import {primaryToday} from '../../lib/pair-time';
import {riverCharacterForIdentity} from './characters';

export default function River() {
  const {primary,userId}=usePeople();
  const {language}=useIslandLanguage();
  const t=(zh:string,en:string)=>language==='en'?en:zh;
  const [anchor, setAnchor] = useState('');
  const [near, setNear] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [strafe, setStrafe] = useState(0);
  const [teleportTo, setTeleportTo] = useState<{date:string;sequence:number}|null>(null);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const interaction = useRef<HTMLButtonElement>(null);
  const [chats,setChats] = useState<RiverChat[]>([]);
  const [loadError,setLoadError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(() => { if(!userId)return; const controller=new AbortController();setLoading(true);setLoadError('');
    fetch('/api/records?kind=chat',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('load');return r.json() as Promise<{id:string;data:Omit<RiverChat,'id'>}[]>;}).then(rows=>{const data=rows.map((r:{id:string;data:Omit<RiverChat,'id'>})=>r.data.date==='undated'?{...r.data,id:r.id,date:'2026-10-17',part:-1,sourceNote:'开场对话归入 2026 年 10 月 17 日；原始记录没有具体时分。'}:{...r.data,id:r.id}).sort((a:RiverChat,b:RiverChat)=>a.date.localeCompare(b.date)||(a.part??0)-(b.part??0));setChats(data);const first=data.find((c:RiverChat)=>c.messages.length>0);if(first)setAnchor(first.date);}).catch(e=>{if(e.name!=='AbortError')setLoadError('聊天记录读取失败，请刷新重试。');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
  },[userId]);
  useEffect(() => { setAnchor(offsetDate(primaryToday(), -3)); }, [primary?.timeZone]);
  useEffect(() => {
    if (selected) close.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.code === 'Escape') { setSelected(null); setDirection(0); setStrafe(0); }
      if (e.code === 'KeyF' && !e.repeat && near && !selected && !calendarOpen && !(e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) { e.preventDefault(); setSelected(near); setDirection(0); setStrafe(0); }
      if (selected && e.code === 'Tab') { e.preventDefault(); close.current?.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [near, selected, calendarOpen]);
  useEffect(() => {
    const stop = () => { setDirection(0); setStrafe(0); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); };
  }, []);
  const records = chats.filter(chat => chat.date === selected);
  const availableDates=[...new Set(chats.filter(chat=>chat.messages.length>0&&/^\d{4}-\d{2}-\d{2}$/.test(chat.date)).map(chat=>chat.date))].sort();
  function teleport(date:string){
    if(!availableDates.includes(date))return;
    setSelected(null);setDirection(0);setStrafe(0);setNear(null);
    setTeleportTo(previous=>({date,sequence:(previous?.sequence??0)+1}));
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setFullscreenError(t('此浏览器不支持系统全屏，当前已使用铺满窗口的沉浸模式。', 'Fullscreen is unavailable. You can still explore in this window.'));
    } catch { setFullscreenError(t('无法进入系统全屏，当前仍可在窗口内探索。', 'Unable to enter fullscreen. You can still explore in this window.')); }
  }
  return <section ref={root} className="river-world" aria-label={t('时光走廊游戏场景','Corridor of Time game scene')}>
    {anchor && <RiverScene character={riverCharacterForIdentity(userId)} language={language} anchor={anchor} chats={chats} teleportTo={teleportTo} paused={!!selected||calendarOpen} direction={direction} strafe={strafe} onNear={setNear} />}
    <header className="river-header"><div className="river-brand"><h1>{t('时光走廊','Corridor of Time')}</h1><span>CORRIDOR OF TIME</span></div><div className="river-actions"><TimeCalendar dates={availableDates} language={language} onSelect={teleport} onOpenChange={setCalendarOpen}/><button onClick={fullscreen} aria-label={t('切换全屏','Toggle fullscreen')}><Maximize size={17}/></button><a href="/"><ArrowLeft size={15}/>{t('返回小岛','Back to island')}</a></div></header>
    <div className="river-sample">{loading?t('正在读取聊天…','Loading chats…'):loadError||t(`已收藏 ${chats.reduce((n,c)=>n+c.messages.length,0)} 条聊天` ,`${chats.reduce((n,c)=>n+c.messages.length,0)} messages saved`)} <span>· {t('日期连续，光留住说过的话','A door for every day, a light for every memory')}</span></div>
    {fullscreenError && <button className="river-feedback" onClick={() => setFullscreenError('')}>{fullscreenError} ×</button>}
    {near && !selected && <button ref={interaction} className="river-interact" onClick={() => { setDirection(0); setStrafe(0); setSelected(near); }}><kbd>F</kbd><span>{chats.some(c => c.date === near) ? t('查看当天聊天','View this day’s chats') : t('这一天没有聊天','No chats this day')}<small>{near.replaceAll('-', '.')}</small></span><i>✧</i></button>}
    <footer className="river-controls"><span><kbd>W</kbd><kbd>↑</kbd> {t('前进','Forward')}</span><span><kbd>S</kbd><kbd>↓</kbd> {t('后退','Back')}</span><span><kbd>A</kbd><kbd>D</kbd> {t('左右','Left / right')}</span></footer>
    <div className="river-touch" aria-label={t('触屏移动控制','Touch movement controls')}>{[{ label: t('前进','Forward'), value: 1 }, { label: t('后退','Back'), value: -1 }, { label: t('左移','Move left'), value: -2 }, { label: t('右移','Move right'), value: 2 }].map(item => <button key={item.value} aria-label={item.label} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); if (Math.abs(item.value) === 2) setStrafe(item.value / 2); else setDirection(item.value); }} onPointerUp={() => { setDirection(0); setStrafe(0); }} onPointerCancel={() => { setDirection(0); setStrafe(0); }} onLostPointerCapture={() => { setDirection(0); setStrafe(0); }}>{item.value === 1 ? '↑' : item.value === -1 ? '↓' : item.value === -2 ? '←' : '→'}</button>)}</div>
    {selected && <div className="river-modal-backdrop"><section className="river-memory" role="dialog" aria-modal="true" aria-labelledby="river-memory-title"><button ref={close} className="river-close" aria-label={t('关闭聊天','Close chats')} onClick={() => { setSelected(null); requestAnimationFrame(() => interaction.current?.focus()); }}><X size={21}/></button><div className="river-memory-eyebrow">A MOMENT IN TIME · {t('我们的聊天','OUR CONVERSATIONS')}</div><h2 id="river-memory-title">{selected.replaceAll('-', '.')}</h2><div className="river-memory-scroll">{records.length ? records.map(chat => <article key={chat.id}>{(chat.part===-1||!chat.part)&&<><h3>{chat.title}</h3><p className="river-source-note">{t(chat.sourceNote||'','Opening messages have no recorded time; other times show when the tool first received each message (Beijing time).')}</p></>}{chat.messages.map((message, i) => <div key={i} className={'river-message ' + message.role}><div className="river-message-meta"><b>{message.speaker || (message.role === 'user' ? 'A1exx' : 'Beathana_Vonterra')}</b><time>{message.time?.slice(11)||t('时间未知','Time unknown')}</time></div><div className="river-original"><small>{t('原文','ORIGINAL')}</small><p>{message.original??message.content}</p></div><div className="river-translation"><small>{t('中文','CHINESE')}</small><p>{message.translation||''}</p></div>{message.note&&<div className="river-message-note">{t('注：','Note: ')}{message.note}</div>}</div>)}</article>) : <div className="river-empty"><span>◇</span><h3>{t('安静的一天','A quiet day')}</h3><p>{t('这一天没有聊天记录，','No chats were recorded this day.')}<br/>{t('也许，你正忙着好好生活。','Perhaps you were out enjoying life.')}</p></div>}</div><div className="river-memory-foot">{t('按 Esc 返回走廊','Press Esc to return')}</div></section></div>}
  </section>;
}
