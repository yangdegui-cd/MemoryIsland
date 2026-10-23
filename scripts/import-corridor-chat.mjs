import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Generate a local-only, repeatable import. Never bundle private chats in the client.
const [source, output = '.sites-runtime/chat-import.sql'] = process.argv.slice(2);
if (!source) throw Error('Usage: node scripts/import-corridor-chat.mjs <chat.txt> [output.sql]');
const text = readFileSync(source,'utf8').replace(/\r\n/g,'\n');
const entries = [...text.matchAll(/^\[(\d+)\] (时间未知|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| (.+)\n([\s\S]*?)(?=^\[\d+\] |$(?![\s\S]))/gm)];
const groups = new Map();
for (const [,index,time,speaker,body] of entries) {
  const match = body.trim().match(/^原文：([\s\S]*?)\n中文：([\s\S]*?)(?:\n注：([\s\S]*))?$/);
  if (!match) throw Error(`Cannot parse message ${index}`);
  const date = time === '时间未知' ? 'undated' : time.slice(0,10);
  if (!groups.has(date)) groups.set(date,[]);
  groups.get(date).push({role:speaker==='A1exx'?'user':'assistant',speaker,time:date==='undated'?null:time,original:match[1],translation:match[2],note:match[3]||'',content:match[1]});
}
const expected = Number(text.match(/合计 (\d+) 条/)?.[1]);
if (!entries.length || entries.length!==expected) throw Error(`Expected ${expected} messages; parsed ${entries.length}`);
const quote = s => "'"+s.replaceAll("'","''")+"'";
const chunks=[...groups].flatMap(([date,messages])=>Array.from({length:Math.ceil(messages.length/30)},(_,i)=>({date,messages:messages.slice(i*30,(i+1)*30),part:i})));
const sql = chunks.map(({date,messages,part})=>{
  const id='corridor-'+createHash('sha256').update('Beathana_Vonterra:'+date+':'+part).digest('hex').slice(0,24);
  const data={date,part,title:date==='undated'?'相识的开场':'A1exx · Beathana_Vonterra',messages,sourceNote:'时间为工具首次接收时间（北京时间），不一定是原始发送时间。补充内容已标注。'};
  return `INSERT INTO records (id,user_id,kind,data,created_at) VALUES (${quote(id)},'daily-island:alexx-bv','chat',${quote(JSON.stringify(data))},${Date.now()}) ON CONFLICT(id) DO UPDATE SET data=excluded.data;`;
}).join('\n');
mkdirSync('.sites-runtime',{recursive:true});writeFileSync(output,sql);
console.log(JSON.stringify({messages:entries.length,days:[...groups].map(([date,m])=>({date,count:m.length})),output}));
