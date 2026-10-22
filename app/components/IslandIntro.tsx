"use client";
import {useEffect,useRef,useState} from 'react';

export default function IslandIntro({language}:{language:'zh'|'en'}){
  const [visible,setVisible]=useState(true);
  const [leaving,setLeaving]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const skip=useRef<HTMLButtonElement>(null);
  const [reduced,setReduced]=useState(false);
  const dismiss=()=>{setLeaving(true);};
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    if(media.matches){setVisible(false);return;}
    try{if(sessionStorage.getItem('island-intro-seen')){setVisible(false);return;}}catch{}
    const timer=setTimeout(()=>{setLeaving(true);},4200);
    return ()=>clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(!leaving)return;
    try{sessionStorage.setItem('island-intro-seen','1');}catch{}
    const timer=setTimeout(()=>{setVisible(false);document.querySelector<HTMLAnchorElement>('.island-wordmark')?.focus({preventScroll:true});},800);
    return ()=>clearTimeout(timer);
  },[leaving]);
  useEffect(()=>{
    if(!visible||reduced)return;
    const element=canvas.current;
    const ctx=element?.getContext('2d');
    if(!element||!ctx)return;
    let width=0,height=0,frame=0;
    const resize=()=>{width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);element.width=width*dpr;element.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};
    resize();addEventListener('resize',resize);
    const particles=Array.from({length:width<700?260:650},()=>({angle:Math.random()*Math.PI*2,radius:.55+Math.random()*.65,size:.4+Math.random()*1.5,speed:.03+Math.random()*.04,offset:Math.random()*40,alpha:.2+Math.random()*.6}));
    const start=performance.now();
    const draw=(now:number)=>{
      const seconds=(now-start)/1000;ctx.clearRect(0,0,width,height);
      for(const p of particles){const angle=p.angle+seconds*p.speed;const rx=width*.47*p.radius,ry=height*.34*p.radius;const x=width*.5+Math.cos(angle)*rx;const y=height*.5+Math.sin(angle)*ry+Math.sin(angle*3+p.offset)*12;ctx.globalAlpha=p.alpha*(.65+Math.sin(seconds+p.offset)*.35);ctx.fillStyle='#efcf89';ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);};
  },[visible,reduced]);
  useEffect(()=>{
    if(!visible)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setLeaving(true);}};
    document.addEventListener('keydown',escape);
    return ()=>document.removeEventListener('keydown',escape);
  },[visible]);
  if(!visible)return null;
  return <div className={'island-intro'+(leaving?' leaving':'')} role="dialog" aria-modal="true" aria-label={language==='zh'?'欢迎来到日常小岛':'Welcome to Daily Island'} onKeyDown={event=>{if(event.key==='Tab'){event.preventDefault();skip.current?.focus();}}}>
    <canvas ref={canvas} aria-hidden="true"/>
    <div className="island-intro-copy"><h2>{language==='zh'?'日常小岛':'Daily Island'}</h2><p>{language==='zh'?'把普通的日子，过成自己的小美好。':'A little beauty in every day.'}</p><span className="island-intro-line" aria-hidden="true"/></div>
    <button ref={skip} autoFocus type="button" onClick={dismiss}>{language==='zh'?'跳过':'Skip'} <span aria-hidden="true">›</span></button>
  </div>;
}
