'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {usePeople} from './PeopleProvider';
import {isActivityPage} from '../../lib/activity-pages';

export default function VisitTracker(){
  const {userId}=usePeople();const pathname=usePathname();
  const last=useRef('');const hiddenAt=useRef<number|null>(null);
  useEffect(()=>{
    if(!userId||!isActivityPage(pathname))return;
    const key=userId+':'+pathname;
    function report(type:'view'|'resume'){
      const body=JSON.stringify({eventId:crypto.randomUUID(),path:pathname,type});
      // A single retry reuses the event ID. The server deduplicates per account.
      const send=()=>fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body,cache:'no-store',keepalive:true});
      void (async()=>{for(let attempt=0;attempt<2;attempt++){
        try{if((await send()).status<500)return;}catch{}
      }})();
    }
    function visible(){
      if(document.visibilityState!=='visible'){hiddenAt.current=Date.now();return;}
      if(last.current!==key){last.current=key;report('view');}
      else if(hiddenAt.current!==null&&Date.now()-hiddenAt.current>=60_000)report('resume');
      hiddenAt.current=null;
    }
    visible();document.addEventListener('visibilitychange',visible);
    return()=>document.removeEventListener('visibilitychange',visible);
  },[userId,pathname]);
  return null;
}
