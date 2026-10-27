"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from '../../components/IslandLink';
import {useIslandLanguage} from '../../components/useIslandLanguage';
import {storageScopes,type StorageScope} from '../../../lib/storage-api-validation';
import './settings.css';

type Key={id:string;name:string;prefix:string;scopes:StorageScope[];expiresAt:number;active:boolean};
async function request<T=Record<string,never>>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{cache:'no-store',...init});
  const data=await response.json() as T&{error?:string};if(!response.ok)throw Error(data.error||'Request failed');return data;
}
export default function ApiSettings(){
  const {language,changeLanguage}=useIslandLanguage();const en=language==='en';const t=(zh:string,english:string)=>en?english:zh;
  const [keys,setKeys]=useState<Key[]>([]),[name,setName]=useState(''),[scopes,setScopes]=useState<StorageScope[]>([...storageScopes]);
  const [days,setDays]=useState(90),[token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
  const reload=useCallback(async()=>{const data=await request<{items:Key[]}>('/api/api-keys');setKeys(data.items);},[]);
  useEffect(()=>{reload().catch(e=>setError(e.message));},[reload]);
  async function create(event:React.FormEvent){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setToken('');setCopied(false);
    try{const data=await request<{token:string}>('/api/api-keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,scopes,expiresInDays:days})});setToken(data.token);setName('');await reload();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function revoke(key:Key){
    if(!confirm(t(`撤销「${key.name}」？使用它的程序将停止访问。`,`Revoke “${key.name}”? Apps using it will lose access.`)))return;
    setBusy(true);setError('');try{await request('/api/api-keys/'+key.id,{method:'DELETE'});if(token.startsWith(key.prefix))setToken('');await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const labels:Record<StorageScope,string>={'photos:read':t('读取图片','Read photos'),'photos:write':t('上传图片','Upload photos'),'chats:read':t('读取聊天','Read chats'),'chats:write':t('导入聊天','Import chats')};
  return <div className="storage-settings"><header><Link href="/" prefetch={false}>← {t('返回小岛','Back to island')}</Link><button onClick={()=>changeLanguage(en?'zh':'en')}>{en?'中文':'English'}</button></header>
    <h1>{t('存储 API','Storage API')}</h1><p>{t('从脚本保存照片和聊天，自动同步到回忆相册与时光长河。','Save photos and chats from scripts, synced to your album and River of Time.')}</p>
    <a href="/api/v1/docs" target="_blank" rel="noreferrer">{t('查看完整文档与调用示例 ↗','API documentation & examples ↗')}</a>
    {error&&<p role="alert" className="storage-error">{error}</p>}
    {token&&<section className="storage-secret" role="status"><b>{t('密钥只显示这一次，请保存。','This key is shown only once. Save it now.')}</b><code>{token}</code><button onClick={async()=>{try{await navigator.clipboard.writeText(token);setCopied(true);}catch{setError(t('复制失败，请手动选中密钥复制。','Copy failed. Select and copy the key manually.'));}}}>{copied?t('已复制','Copied'):t('复制密钥','Copy key')}</button><button onClick={()=>setToken('')}>{t('已保存，隐藏','Saved, hide')}</button></section>}
    <form onSubmit={create}><h2>{t('创建密钥','Create key')}</h2><label>{t('名称','Name')}<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder={t('例如：聊天备份脚本','e.g. Chat backup script')}/></label>
      <fieldset><legend>{t('权限','Permissions')}</legend>{storageScopes.map(scope=><label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={e=>setScopes(e.target.checked?[...scopes,scope]:scopes.filter(value=>value!==scope))}/>{labels[scope]}</label>)}</fieldset>
      <label>{t('有效期','Expires after')}<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90,365].map(value=><option key={value} value={value}>{value} {t('天','days')}</option>)}</select></label>
      <button type="submit" disabled={busy||!scopes.length}>{busy?t('处理中…','Working…'):t('生成密钥','Generate key')}</button>
    </form><section><h2>{t('我的密钥','My keys')}</h2>{!keys.length&&<p>{t('暂时没有 API 密钥。','No API keys yet.')}</p>}{keys.map(key=><article key={key.id}><div><b>{key.name}</b><small>{key.prefix}… · {key.active?t('有效至 ','Expires '):t('已失效 · ','Inactive · ')}{new Date(key.expiresAt).toLocaleDateString(en?'en-US':'zh-CN')}</small><small>{key.scopes.map(scope=>labels[scope]).join(' · ')}</small></div><button disabled={busy} onClick={()=>revoke(key)}>{t('撤销','Revoke')}</button></article>)}<p className="storage-footnote">{t('密钥可访问两人的共享照片和聊天。请仅交给你信任的程序；重设密码会使本人已有密钥失效。','Keys access shared photos and chats. Use them only in trusted apps. Resetting your password invalidates your existing keys.')}</p></section>
  </div>;
}
