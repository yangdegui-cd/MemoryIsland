import type {Metadata} from 'next';
import './globals.css';
import Shell from './components/Shell';
import {PeopleProvider,type Identity} from './components/PeopleProvider';
import {readIdentity} from '../lib/identity';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'日常小岛 · 好好生活，慢慢记录',description:'写下日常，收藏心情，种下习惯，转动分类轮盘，让相处多一点新鲜感。'};
export default async function Layout({children}:{children:React.ReactNode}){
  // Resolve the HttpOnly session before rendering a new scene, including a full
  // document navigation. A lookup failure stays pending for the client retry.
  let initialIdentity:Identity|undefined;
  try{initialIdentity=await readIdentity();}catch{}
  return <html lang="zh-CN"><body><PeopleProvider initialIdentity={initialIdentity}><Shell>{children}</Shell></PeopleProvider></body></html>;
}
