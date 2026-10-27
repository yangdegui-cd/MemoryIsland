import guide from '../../../../docs/storage-api.md?raw';
export const dynamic='force-dynamic';
export function GET(request:Request){
  if(new URL(request.url).searchParams.get('format')==='markdown')return new Response(guide,{headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="daily-island-storage-api.md"'}});
  const escaped=guide.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>日常小岛 · 存储 API 文档</title><style>html{background:#f7f5ef;color:#334f44;overscroll-behavior:none}body{max-width:1000px;padding:28px 22px;margin:auto}nav{display:flex;justify-content:space-between;gap:20px}a{color:#3e6c58}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85;font:14px/1.85 ui-monospace,monospace;background:#fffdf8;border:1px solid #e1e5db;padding:24px;border-radius:16px}</style><nav><a href="/settings/api">密钥管理 / API keys</a><a href="?format=markdown">下载 Markdown 文档</a></nav><pre>${escaped}</pre></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"}});
}
