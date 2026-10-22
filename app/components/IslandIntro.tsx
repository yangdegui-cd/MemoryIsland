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
    const timer=setTimeout(()=>{setLeaving(true);},6000);
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
    // Several narrow spiral arms form moving ribbons, rather than a sparse ring.
    const particles=Array.from({length:width<700?2200:5600},(_,i)=>({
      angle:Math.random()*Math.PI*2,
      band:i%4,
      spread:(Math.random()+Math.random()+Math.random()-1.5)*.075,
      size:Math.random()<.025?2+Math.random()*2:.35+Math.random()*.9,
      speed:.19+Math.random()*.11,
      phase:Math.random()*Math.PI*2,
      alpha:.25+Math.random()*.7,
    }));
    const start=performance.now();
    const draw=(now:number)=>{
      const seconds=(now-start)/1000;
      ctx.clearRect(0,0,width,height);
      ctx.globalCompositeOperation='lighter';
      const entrance=Math.min(1,seconds/1.25);
      const release=Math.max(0,(seconds-4.7)/1.3);
      const scale=1+(1-entrance)*.45+release*.9;
      const unit=Math.max(width,height*1.1);
      for(const p of particles){
        const angle=p.angle+seconds*p.speed;
        const radius=(.27+p.band*.045+p.spread+Math.sin(angle*2+p.band)*.035)*scale;
        const orbitX=Math.cos(angle)*unit*radius;
        const orbitY=Math.sin(angle)*height*radius*.82;
        const x=width*.5+orbitX+orbitY*.36;
        const y=height*.48+orbitY-orbitX*.19;
        const depth=(Math.sin(angle)+1)/2;
        const size=p.size*(.55+depth*.95);
        ctx.globalAlpha=p.alpha*entrance*(1-release*.8)*(.55+.45*Math.sin(seconds*1.6+p.phase)**2);
        ctx.strokeStyle=p.band%2?'#f5d994':'#c49b50';
        ctx.lineWidth=size;
        // Short tangent trails make the flow apparent even during the short intro.
        const trail=(2+depth*6)*(1+release*2);
        ctx.beginPath();ctx.moveTo(x,y);
        ctx.lineTo(x-Math.sin(angle)*trail,y+Math.cos(angle)*trail*.48);
        ctx.stroke();
        if(p.size>2){
          ctx.globalAlpha*=.3;
          ctx.fillStyle='#e7bb64';
          ctx.beginPath();ctx.arc(x,y,size*3.5,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=p.alpha*entrance*(1-release);
          ctx.fillStyle='#fff3cc';ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
        }
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      frame=requestAnimationFrame(draw);
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
