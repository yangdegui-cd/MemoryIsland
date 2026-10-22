"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Maximize, X } from 'lucide-react';
import RiverScene from './RiverScene';
import { dateKey, offsetDate, sampleChats } from './timeline';
import './river.css';

export default function River() {
  const [anchor, setAnchor] = useState('');
  const [near, setNear] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);
  const [fullscreenError, setFullscreenError] = useState('');
  const root = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const interaction = useRef<HTMLButtonElement>(null);
  const chats = useMemo(() => anchor ? sampleChats(anchor) : [], [anchor]);
  useEffect(() => { setAnchor(offsetDate(dateKey(new Date()), -3)); }, []);
  useEffect(() => {
    if (selected) close.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.code === 'Escape') { setSelected(null); setDirection(0); }
      if (e.code === 'KeyF' && !e.repeat && near && !selected) { e.preventDefault(); setSelected(near); setDirection(0); }
      if (selected && e.code === 'Tab') { e.preventDefault(); close.current?.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [near, selected]);
  const records = chats.filter(chat => chat.date === selected);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen();
      else setFullscreenError('此浏览器不支持系统全屏，当前已使用铺满窗口的沉浸模式。');
    } catch { setFullscreenError('无法进入系统全屏，当前仍可在窗口内探索。'); }
  }
  return <section ref={root} className="river-world" aria-label="时光长河游戏场景">
    {anchor && <RiverScene anchor={anchor} chats={chats} paused={!!selected} direction={direction} onNear={setNear} />}
    <header className="river-header"><div className="river-brand"><h1>时光长河</h1><span>RIVER OF TIME</span></div><div className="river-actions"><button onClick={fullscreen} aria-label="切换全屏"><Maximize size={17}/></button><a href="/"><ArrowLeft size={15}/>返回小岛</a></div></header>
    <div className="river-sample">示例回忆 <span>· 日期连续，光留住说过的话</span></div>
    {fullscreenError && <button className="river-feedback" onClick={() => setFullscreenError('')}>{fullscreenError} ×</button>}
    {near && !selected && <button ref={interaction} className="river-interact" onClick={() => { setDirection(0); setSelected(near); }}><kbd>F</kbd><span>{chats.some(c => c.date === near) ? '查看当天聊天' : '这一天没有聊天'}<small>{near.replaceAll('-', '.')}</small></span><i>✧</i></button>}
    <footer className="river-controls"><span><kbd>W</kbd><kbd>↑</kbd> 前进</span><span><kbd>S</kbd><kbd>↓</kbd> 后退</span><span><kbd>Shift</kbd> 奔跑</span></footer>
    <div className="river-touch" aria-label="触屏移动控制">{[{ label: '前进', value: 1 }, { label: '后退', value: -1 }].map(item => <button key={item.value} aria-label={item.label} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDirection(item.value); }} onPointerUp={() => setDirection(0)} onPointerCancel={() => setDirection(0)} onLostPointerCapture={() => setDirection(0)}>{item.value === 1 ? '↑' : '↓'}</button>)}</div>
    {selected && <div className="river-modal-backdrop"><section className="river-memory" role="dialog" aria-modal="true" aria-labelledby="river-memory-title"><button ref={close} className="river-close" aria-label="关闭聊天" onClick={() => { setSelected(null); requestAnimationFrame(() => interaction.current?.focus()); }}><X size={21}/></button><div className="river-memory-eyebrow">A MOMENT IN TIME · 示例回忆</div><h2 id="river-memory-title">{selected.replaceAll('-', '.')}</h2><div className="river-memory-scroll">{records.length ? records.map(chat => <article key={chat.id}><h3>{chat.title}</h3>{chat.messages.map((message, i) => <div key={i} className={'river-message ' + message.role}><small>{message.role === 'user' ? '旅人' : '回声'}</small><p>{message.content}</p></div>)}</article>) : <div className="river-empty"><span>◇</span><h3>安静的一天</h3><p>这一天没有聊天记录，<br/>也许，你正忙着好好生活。</p></div>}</div><div className="river-memory-foot">按 Esc 返回长河</div></section></div>}
  </section>;
}
