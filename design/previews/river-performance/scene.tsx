import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import RiverScene from '../../../app/river/RiverScene';
import {offsetDate} from '../../../app/river/timeline';
import '../../../app/river/river.css';
const chats=Array.from({length:90},(_,i)=>({id:String(i),date:offsetDate('2026-10-27',i-40),title:'Performance fixture',messages:[]}));
function App(){const[direction,setDirection]=useState(0),[near,setNear]=useState<string|null>(null),[stats,setStats]=useState('');
useEffect(()=>{const timer=setInterval(()=>setStats(JSON.stringify({...document.querySelector<HTMLElement>('.river-canvas')?.dataset},null,2)),500);return()=>clearInterval(timer)},[]);
return <><RiverScene character={new URLSearchParams(location.search).get('avatar')==='bv'?'bv':'alexx'} language="zh" anchor="2026-10-27" chats={chats} teleportTo={null} paused={false} direction={direction} strafe={0} onNear={setNear}/><aside style={{position:'fixed',top:8,left:8,zIndex:100,color:'#fff',background:'#14252ad9',padding:8,font:'12px monospace'}}><button onClick={()=>setDirection(1)}>持续前跑</button><button onClick={()=>setDirection(0)}>停步</button><button onClick={()=>setDirection(-1)}>持续后跑</button><span>{near?'F · '+near:'未靠近门'}</span><pre style={{maxHeight:160,overflow:'auto',width:400}}>{stats}</pre></aside></>}
createRoot(document.getElementById('root')!).render(<App/>);
