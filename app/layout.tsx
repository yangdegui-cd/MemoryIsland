import type {Metadata} from 'next';import './globals.css';import Shell from './components/Shell';
export const metadata:Metadata={title:'日常小岛 · 好好生活，慢慢记录',description:'写下日常，收藏心情，种下习惯，转动分类轮盘，让相处多一点新鲜感。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body><Shell>{children}</Shell></body></html>}
