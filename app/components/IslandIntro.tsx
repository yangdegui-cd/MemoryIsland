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
    // All light is generated here: no photograph, ring texture or masked backdrop.
    const makeGlow=(core:string)=>{
      const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
      const brush=sprite.getContext('2d')!;
      const gradient=brush.createRadialGradient(16,16,0,16,16,16);
      gradient.addColorStop(0,core);gradient.addColorStop(.13,'#ffe8ad');
      gradient.addColorStop(.35,'rgba(226,170,70,.3)');gradient.addColorStop(1,'rgba(226,170,70,0)');
      brush.fillStyle=gradient;brush.fillRect(0,0,32,32);return sprite;
    };
    const glow=makeGlow('#fff8dd');
    const count=width<700?5500:14500;
    const particles=Array.from({length:count},(_,i)=>({
      angle:Math.random()*Math.PI*2,
      band:i%3,
      spread:(Math.random()+Math.random()+Math.random()-1.5),
      size:Math.random()<.018?1.8+Math.random()*2.4:.22+Math.random()*.9,
      speed:.12+Math.random()*.055,
      phase:Math.random()*Math.PI*2,
      alpha:.25+Math.random()*.7,
    }));
    const stars=Array.from({length:180},()=>({x:Math.random(),y:Math.random(),size:.25+Math.random()*.85,phase:Math.random()*6}));
    const start=performance.now();
    let last=0;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(now-last<1000/45)return;
      last=now;
      const seconds=(now-start)/1000;
      ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
      const entrance=Math.min(1,seconds/1.1);
      const release=Math.max(0,Math.min(1,(seconds-4.9)/1.1));
      const scale=1+(1-entrance)*.32+release*.55;
      const unit=Math.max(width,height*.95);
      for(const star of stars){
        ctx.globalAlpha=(.15+Math.sin(seconds*.8+star.phase)**2*.4)*entrance;
        ctx.fillStyle='#e8c88b';ctx.fillRect(star.x*width,star.y*height,star.size,star.size);
      }
      for(const p of particles){
        const angle=p.angle+seconds*p.speed;
        // Two dense streams and a thin outer orbit; varying thickness creates wisps.
        const base=[.345,.395,.47][p.band];
        const thickness=p.band===2?.004:.016+.012*Math.sin(angle*3+p.band)**2;
        const radius=(base+p.spread*thickness+Math.sin(angle*2+p.band)*.012)*scale;
        const ox=Math.cos(angle)*unit*radius;
        const oy=Math.sin(angle)*unit*radius*.48;
        const x=width*.5+ox;
        const y=height*.49+oy-ox*.23;
        const depth=(Math.sin(angle)+1)/2;
        const size=p.size*(.85+depth*.65);
        const alpha=Math.min(1,p.alpha*1.4)*entrance*(1-release*.9)*(.5+.5*Math.sin(seconds+p.phase)**2);
        ctx.globalAlpha=alpha;
        if(p.size>1.8){
          const diameter=size*(7+depth*5);
          ctx.drawImage(glow,x-diameter/2,y-diameter/2,diameter,diameter);
        }else{
          ctx.fillStyle=p.band===1?'#e3b363':'#ffe2a0';
          ctx.fillRect(x,y,Math.max(.7,size),Math.max(.7,size));
          if(p.size>.85){const halo=size*5;ctx.globalAlpha=alpha*.3;ctx.drawImage(glow,x-halo/2,y-halo/2,halo,halo);ctx.globalAlpha=alpha;}
          // A few moving streaks are tangent to the same tilted orbit.
          if(p.phase<.22){
            ctx.strokeStyle='#e9c278';ctx.lineWidth=.5;
            ctx.beginPath();ctx.moveTo(x,y);
            const dx=-Math.sin(angle)*3;
            ctx.lineTo(x+dx,y+Math.cos(angle)*1.5-dx*.23);ctx.stroke();
          }
        }
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
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
    <img className="intro-island" src="/art/intro-island.png" alt="" aria-hidden="true"/>
    <canvas ref={canvas} aria-hidden="true"/>
    <div className="island-intro-copy"><h2>{language==='zh'?'日常小岛':'Daily Island'}</h2><p>{language==='zh'?'把普通的日子，过成自己的小美好。':'A little beauty in every day.'}</p><span className="island-intro-line" aria-hidden="true"/></div>
    <button ref={skip} autoFocus type="button" onClick={dismiss}>{language==='zh'?'跳过':'Skip'} <span aria-hidden="true">›</span></button>
  </div>;
}
