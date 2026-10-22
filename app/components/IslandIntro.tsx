"use client";
import {useEffect,useRef,useState} from 'react';

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
    const count=width<700?6500:16000;
    const particles=Array.from({length:count},()=>({
      seed:Math.random()*Math.PI*2,
      lane:Math.random(),
      spread:(Math.random()+Math.random()+Math.random()-1.5),
      size:Math.random()<.009?1.8+Math.random()*1.6:.25+Math.random()*.9,
      speed:.018+Math.random()*.065,
      drift:.008+Math.random()*.025,
      phase:Math.random()*Math.PI*2,
      life:2+Math.random()*4,
      age:Math.random()*6,
      alpha:.3+Math.random()*.7,
    }));
    const stars=Array.from({length:250},()=>({x:Math.random(),y:Math.random(),size:.25+Math.random()*.85,phase:Math.random()*6}));
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
        const life=((seconds+p.age)%p.life)/p.life;
        const envelope=Math.sin(life*Math.PI)**.65;
        // Independent lifetimes and local turbulence break up the overall spiral silhouette.
        // No shared rotation transform or discrete concentric orbits.
        const angle=p.seed+seconds*p.speed;
        const bend=Math.sin(angle*2.3+seconds*.17)*.028+Math.sin(angle*5.1+p.phase)*.012;
        const lane=.315+p.lane*.13;
        const widthOfCloud=.024+.023*(.5+.5*Math.sin(angle*3.7+seconds*.22));
        const radialDrift=(life-.5)*p.drift;
        const radius=(lane+p.spread*widthOfCloud+bend+radialDrift)*scale;
        const turbulenceX=Math.sin(seconds*(.3+p.speed)+p.phase)*unit*.012;
        const turbulenceY=Math.cos(seconds*.45+p.phase*1.7)*unit*.009;
        const ox=Math.cos(angle)*unit*radius;
        const oy=Math.sin(angle)*unit*radius*.48;
        const x=width*.5+ox+turbulenceX;
        const y=height*.49+oy-ox*.23+turbulenceY;
        const depth=(Math.sin(angle)+1)/2;
        const size=p.size*(.8+depth*.6);
        // Broken, bright wisps travel through a broader dim dust cloud.
        const wisp=.3+.7*(.5+.5*Math.sin(angle*4.2+seconds*.3+p.lane*3))**2;
        const alpha=p.alpha*entrance*(1-release*.9)*envelope*wisp;
        ctx.globalAlpha=alpha;
        if(p.size>1.8){
          const diameter=size*(8+depth*5);
          ctx.drawImage(glow,x-diameter/2,y-diameter/2,diameter,diameter);
        }else{
          ctx.fillStyle=p.lane>.5?'#f0c681':'#ffe6ae';
          ctx.fillRect(x,y,Math.max(.65,size),Math.max(.65,size));
          if(p.size>.85){const halo=size*5;ctx.globalAlpha=alpha*.35;ctx.drawImage(glow,x-halo/2,y-halo/2,halo,halo);}
        }
      }
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
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
