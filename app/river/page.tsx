"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize, X } from 'lucide-react';
import RiverScene from './RiverScene';
import { offsetDate, sampleChats } from './timeline';
import './river.css';
import {useIslandLanguage} from '../components/useIslandLanguage';
import {usePeople} from '../components/PeopleProvider';
import {primaryToday} from '../../lib/pair-time';

export default function River() {
  const {primary}=usePeople();
  const {language}=useIslandLanguage();
  const t=(zh:string,en:string)=>language==='en'?en:zh;
  const [anchor, setAnchor] = useState('');
  const [near, setNear] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [strafe, setStrafe] = useState(0);
  const [fullscreenError, setFullscreenError] = useState('');
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const interaction = useRef<HTMLButtonElement>(null);
  const chats = useMemo(() => anchor ? sampleChats(anchor, language) : [], [anchor, language]);
  useEffect(() => { setAnchor(offsetDate(primaryToday(), -3)); }, [primary?.timeZone]);
  useEffect(() => {
    if (selected) close.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.code === 'Escape') { setSelected(null); setDirection(0); setStrafe(0); }
      if (e.code === 'KeyF' && !e.repeat && near && !selected) { e.preventDefault(); setSelected(near); setDirection(0); setStrafe(0); }
      if (selected && e.code === 'Tab') { e.preventDefault(); close.current?.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [near, selected]);
  useEffect(() => {
    const stop = () => { setDirection(0); setStrafe(0); };
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); };
  }, []);
  const records = chats.filter(chat => chat.date === selected);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setFullscreenError(t('此浏览器不支持系统全屏，当前已使用铺满窗口的沉浸模式。', 'Fullscreen is unavailable. You can still explore in this window.'));
    } catch { setFullscreenError(t('无法进入系统全屏，当前仍可在窗口内探索。', 'Unable to enter fullscreen. You can still explore in this window.')); }
  }
  return <section ref={root} className="river-world" aria-label={t('时光长河游戏场景','River of Time game scene')}>
    {anchor && <RiverScene language={language} anchor={anchor} chats={chats} paused={!!selected} direction={direction} strafe={strafe} onNear={setNear} />}
    <header className="river-header"><div className="river-brand"><h1>{t('时光长河','River of Time')}</h1><span>RIVER OF TIME</span></div><div className="river-actions"><button onClick={fullscreen} aria-label={t('切换全屏','Toggle fullscreen')}><Maximize size={17}/></button><a href="/"><ArrowLeft size={15}/>{t('返回小岛','Back to island')}</a></div></header>
    <div className="river-sample">{t('示例回忆','Sample memories')} <span>· {t('日期连续，光留住说过的话','A door for every day, a light for every memory')}</span></div>
    {fullscreenError && <button className="river-feedback" onClick={() => setFullscreenError('')}>{fullscreenError} ×</button>}
    {near && !selected && <button ref={interaction} className="river-interact" onClick={() => { setDirection(0); setStrafe(0); setSelected(near); }}><kbd>F</kbd><span>{chats.some(c => c.date === near) ? t('查看当天聊天','View this day’s chats') : t('这一天没有聊天','No chats this day')}<small>{near.replaceAll('-', '.')}</small></span><i>✧</i></button>}
    <footer className="river-controls"><span><kbd>W</kbd><kbd>↑</kbd> {t('前进','Forward')}</span><span><kbd>S</kbd><kbd>↓</kbd> {t('后退','Back')}</span><span><kbd>A</kbd><kbd>D</kbd> {t('左右','Left / right')}</span></footer>
    <div className="river-touch" aria-label={t('触屏移动控制','Touch movement controls')}>{[{ label: t('前进','Forward'), value: 1 }, { label: t('后退','Back'), value: -1 }, { label: t('左移','Move left'), value: -2 }, { label: t('右移','Move right'), value: 2 }].map(item => <button key={item.value} aria-label={item.label} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); if (Math.abs(item.value) === 2) setStrafe(item.value / 2); else setDirection(item.value); }} onPointerUp={() => { setDirection(0); setStrafe(0); }} onPointerCancel={() => { setDirection(0); setStrafe(0); }} onLostPointerCapture={() => { setDirection(0); setStrafe(0); }}>{item.value === 1 ? '↑' : item.value === -1 ? '↓' : item.value === -2 ? '←' : '→'}</button>)}</div>
    {selected && <div className="river-modal-backdrop"><section className="river-memory" role="dialog" aria-modal="true" aria-labelledby="river-memory-title"><button ref={close} className="river-close" aria-label={t('关闭聊天','Close chats')} onClick={() => { setSelected(null); requestAnimationFrame(() => interaction.current?.focus()); }}><X size={21}/></button><div className="river-memory-eyebrow">A MOMENT IN TIME · {t('示例回忆','SAMPLE MEMORY')}</div><h2 id="river-memory-title">{selected.replaceAll('-', '.')}</h2><div className="river-memory-scroll">{records.length ? records.map(chat => <article key={chat.id}><h3>{chat.title}</h3>{chat.messages.map((message, i) => <div key={i} className={'river-message ' + message.role}><small>{message.role === 'user' ? t('旅人','Traveler') : t('回声','Echo')}</small><p>{message.content}</p></div>)}</article>) : <div className="river-empty"><span>◇</span><h3>{t('安静的一天','A quiet day')}</h3><p>{t('这一天没有聊天记录，','No chats were recorded this day.')}<br/>{t('也许，你正忙着好好生活。','Perhaps you were out enjoying life.')}</p></div>}</div><div className="river-memory-foot">{t('按 Esc 返回长河','Press Esc to return')}</div></section></div>}
  </section>;
}
