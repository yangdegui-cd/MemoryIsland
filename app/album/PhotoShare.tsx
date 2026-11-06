"use client";
import {useEffect,useRef,useState} from 'react';
import {Check,Copy,Link2,LoaderCircle,X} from 'lucide-react';
import {useIslandLanguage} from '../components/useIslandLanguage';

type ShareState={enabled:boolean;url:string|null};
async function readShare(response:Response):Promise<ShareState>{
  if(!response.ok)throw Error();
  const result=await response.json() as ShareState;
  if(typeof result.enabled!=='boolean'||(result.enabled?typeof result.url!=='string'||!/^\/share\/photos\/[a-f0-9]{64}$/.test(result.url):result.url!==null))throw Error();
  return result;
}
export default function PhotoShare({photoId,onClose}:{photoId:string;onClose:()=>void}){
  const {language}=useIslandLanguage();const en=language==='en';const t=(zh:string,english:string)=>en?english:zh;
  const [share,setShare]=useState<ShareState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(false),[feedback,setFeedback]=useState<'copied'|'manual'|'revoked'|null>(null),[retry,setRetry]=useState(0);
  const input=useRef<HTMLInputElement>(null),close=useRef<HTMLButtonElement>(null);
  const endpoint='/api/photos/'+encodeURIComponent(photoId)+'/share';
  useEffect(()=>{close.current?.focus();const controller=new AbortController();setLoading(true);setError(false);
    fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(readShare).then(result=>{if(!controller.signal.aborted)setShare(result);}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[endpoint,retry]);
  async function change(method:'POST'|'DELETE'){
    if(busy)return;setBusy(true);setError(false);setFeedback(null);
    try{setShare(await readShare(await fetch(endpoint,{method,cache:'no-store'})));if(method==='DELETE')setFeedback('revoked');}
    catch{setError(true);}finally{setBusy(false);}
  }
  const url=share?.url?new URL(share.url+(en?'?lang=en':''),location.origin).href:'';
  async function copy(){try{await navigator.clipboard.writeText(url);setFeedback('copied');}catch{input.current?.focus();input.current?.select();setFeedback('manual');}}
  return <section className="album-share-panel" aria-label={t('分享照片','Share photo')} onClick={e=>e.stopPropagation()}>
    <div className="album-share-heading"><h2>{t('分享这张照片','Share this photo')}</h2><button ref={close} type="button" aria-label={t('关闭分享面板','Close share panel')} onClick={onClose}><X size={18}/></button></div>
    <p>{t('持有链接的人无需登录即可查看这张照片。','Anyone with the link can view this photo without signing in.')}</p>
    {loading?<p role="status">{t('正在读取分享状态…','Loading sharing settings…')}</p>:share?.enabled?<>
      <label className="album-share-link"><span>{t('分享链接','Share link')}</span><input ref={input} readOnly value={url} onFocus={e=>e.target.select()}/></label>
      <div className="album-share-actions"><button type="button" className="album-share-primary" disabled={busy} onClick={copy}>{feedback==='copied'?<Check size={16}/>:<Copy size={16}/>} {t('复制链接','Copy link')}</button><button type="button" className="album-share-revoke" disabled={busy} onClick={()=>change('DELETE')}>{busy?<LoaderCircle size={15}/>:null}{t('关闭分享','Turn off sharing')}</button></div>
    </>:share?<button type="button" className="album-share-primary" disabled={busy} onClick={()=>change('POST')}>{busy?<LoaderCircle size={16}/>:<Link2 size={16}/>} {t('生成分享链接','Create share link')}</button>:<button type="button" className="album-share-primary" onClick={()=>setRetry(v=>v+1)}>{t('重新读取','Retry')}</button>}
    {error&&<p className="album-share-error" role="alert">{t('操作失败，请重试。','Could not update sharing. Please retry.')}</p>}
    {feedback&&<p className="album-share-feedback" role="status">{feedback==='copied'?t('链接已复制','Link copied'):feedback==='manual'?t('请复制上方已选中的链接。','Please copy the selected link above.'):t('分享已关闭，原链接已失效。','Sharing is off. The previous link no longer works.')}</p>}
  </section>;
}
