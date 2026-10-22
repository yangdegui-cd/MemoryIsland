"use client";
import {useEffect,useRef,useState} from 'react';

const FIREFLY = {count: 90, mobileCount: 48, leaves: 14, speed: 0.018, brightness: 0.85};

export default function IslandIntro({language}:{language:'zh'|'en'}){
  const [visible,setVisible]=useState(true);
  const [leaving,setLeaving]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const skip=useRef<HTMLButtonElement>(null);
  const dismiss=()=>{setLeaving(true);};
  useEffect(()=>{
    const timer=setTimeout(()=>{setLeaving(true);},6000);
    return ()=>clearTimeout(timer);
  },[]);
  useEffect(()=>{
    if(!leaving)return;
    const timer=setTimeout(()=>{setVisible(false);document.querySelector<HTMLAnchorElement>('.island-wordmark')?.focus({preventScroll:true});},800);
    return ()=>clearTimeout(timer);
  },[leaving]);
  useEffect(()=>{
    if(!visible)return;
    const element=canvas.current;
    const ctx=element?.getContext('2d');
    if(!element||!ctx)return;
    let width=0,height=0,frame=0;
    const resize=()=>{width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);element.width=width*dpr;element.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};
    resize();addEventListener('resize',resize);
    const particles=Array.from({length:width<700?FIREFLY.mobileCount:FIREFLY.count},()=>({
      x:Math.random(),y:.12+Math.random()*.8,
      depth:Math.random(),phase:Math.random()*Math.PI*2,
      speed:.65+Math.random()*.7,
    }));
    const leaves=Array.from({length:FIREFLY.leaves},()=>({x:Math.random(),y:Math.random(),phase:Math.random()*6,size:7+Math.random()*13}));
    const start=performance.now();
    let last=0;
    const draw=(now:number)=>{
      frame=requestAnimationFrame(draw);
      if(now-last<1000/45)return;
      last=now;
      const seconds=(now-start)/1000;
      ctx.clearRect(0,0,width,height);
      const fade=Math.min(1,seconds/.8);
      // Open, gently arched wind traces; no closed rings or rotation.
      for(let line=0;line<2;line++){
        ctx.beginPath();
        for(let step=0;step<=100;step++){
          const u=step/100;
          const arch=Math.exp(-(((u-.52)/.24)**2));
          const x=u*width;
          const y=height*(.52-arch*.36+line*.025)+Math.sin(u*8+seconds*.25+line)*8;
          if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
        ctx.strokeStyle=line===0?'rgba(217,175,73,.32)':'rgba(133,152,101,.25)';ctx.lineWidth=.7;ctx.stroke();
      }
      for(const p of particles){
        const x=((p.x+seconds*FIREFLY.speed*p.speed)%1.15-.075)*width+Math.sin(seconds*.6+p.phase)*12;
        const y=p.y*height+Math.sin(seconds*.5+p.phase)*height*.027;
        // Keep the title readable, while allowing foreground glow around the edges.
        const inText=x>width*.26&&x<width*.74&&y>height*.57&&y<height*.79;
        const pulse=.4+.6*(.5+.5*Math.sin(seconds*1.4+p.phase));
        const core=.9+p.depth*2;
        const radius=6+p.depth**4*36;
        const glow=ctx.createRadialGradient(x,y,0,x,y,radius);
        glow.addColorStop(0,'rgba(255,255,235,.95)');
        glow.addColorStop(.12,'rgba(255,231,125,.85)');
        glow.addColorStop(.35,'rgba(250,203,54,.32)');
        glow.addColorStop(1,'rgba(250,203,54,0)');
        ctx.globalAlpha=fade*pulse*FIREFLY.brightness*(inText?.12:1);
        ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
        ctx.beginPath();ctx.arc(x,y,core,0,Math.PI*2);ctx.fillStyle='#fffde0';ctx.fill();
      }
      for(const leaf of leaves){
        const x=((leaf.x+seconds*.012)%1.16-.08)*width;
        const y=leaf.y*height+Math.sin(seconds*.5+leaf.phase)*24;
        ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(seconds*.35+leaf.phase)*.6+leaf.phase);
        ctx.globalAlpha=fade*.6;ctx.fillStyle='#8b9a65';
        ctx.beginPath();ctx.moveTo(-leaf.size,0);ctx.quadraticCurveTo(0,-leaf.size*.65,leaf.size,0);ctx.quadraticCurveTo(0,leaf.size*.65,-leaf.size,0);ctx.fill();
        ctx.strokeStyle='#c4c99c';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(-leaf.size,0);ctx.lineTo(leaf.size,0);ctx.stroke();ctx.restore();
      }
      ctx.globalAlpha=1;
    };
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);};
  },[visible]);
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
