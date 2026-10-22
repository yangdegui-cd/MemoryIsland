"use client";
import {useEffect,useState} from 'react';
export function useIslandLanguage(){
  const [language,setLanguage]=useState<'zh'|'en'>('zh');
  useEffect(()=>{
    const read=()=>{try{const value=localStorage.getItem('island-language');if(value==='zh'||value==='en')setLanguage(value);}catch{}};
    read();window.addEventListener('storage',read);window.addEventListener('island-language-change',read);
    return ()=>{window.removeEventListener('storage',read);window.removeEventListener('island-language-change',read);};
  },[]);
  useEffect(()=>{document.documentElement.lang=language==='zh'?'zh-CN':'en';},[language]);
  const changeLanguage=(value:'zh'|'en')=>{setLanguage(value);try{localStorage.setItem('island-language',value);}catch{}window.dispatchEvent(new Event('island-language-change'));};
  return {language,changeLanguage};
}
