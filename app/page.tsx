"use client";

import {useIslandLanguage} from './components/useIslandLanguage';
import {Landmark, Waves, Gamepad2, Cloud, Sprout} from 'lucide-react';
import './island-home.css';
import IslandIntro from './components/IslandIntro';

const copy = {
  zh: {brand:'日常小岛', title:'欢迎回到你的小岛', hint:'点击一处，开始探索', palace:'记忆宫殿', river:'时光长河', game:'游戏屋', sky:'心情天空'},
  en: {brand:'Daily Island', title:'Welcome to your little island', hint:'Pick a place. Begin exploring.', palace:'Memory Palace', river:'River of Time', game:'Game House', sky:'Mood Sky'},
};

export default function Home(){
  const {language,changeLanguage}=useIslandLanguage();
  const t=copy[language];
  const destinations=[
    {name:t.palace,href:'/album',className:'palace',Icon:Landmark},
    {name:t.river,href:'/river',className:'river',Icon:Waves},
    {name:t.game,href:'/games',className:'game',Icon:Gamepad2},
    {name:t.sky,href:'/mood',className:'sky',Icon:Cloud},
  ];
  return <div className="island-home" data-language={language}>
    <IslandIntro language={language}/>
    <div className="island-art" aria-hidden="true"/>
    <header className="island-header">
      <a href="/" className="island-wordmark"><Sprout aria-hidden="true"/>{t.brand}</a>
      <div className="island-language" role="group" aria-label={language==='zh'?'界面语言':'Interface language'}>
        <button type="button" lang="zh-CN" aria-pressed={language==='zh'} onClick={()=>changeLanguage('zh')}>中文</button>
        <button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>changeLanguage('en')}>EN</button>
      </div>
    </header>
    <h1 className="island-welcome">{t.title}</h1>
    <nav className="island-destinations" aria-label={language==='zh'?'探索小岛':'Explore the island'}>
      {destinations.map(({name,href,className,Icon})=><a key={className} href={href} className={'island-destination '+className}><Icon size={21} aria-hidden="true"/><span>{name}</span><i aria-hidden="true"/></a>)}
    </nav>
    <div className="island-fireflies" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{left:`${8+(i*23)%85}%`,top:`${30+(i*17)%58}%`,animationDelay:`${i*.43}s`}}/>)}</div>
    <p className="island-hint">{t.hint}</p>
  </div>;
}
