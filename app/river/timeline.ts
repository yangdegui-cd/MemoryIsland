export type ChatMessage = { role: string; content: string; speaker?: string; time?: string | null; original?: string; translation?: string; note?: string };
export type RiverChat = { id: string; date: string; title: string; sourceNote?: string; part?: number; messages: ChatMessage[] };
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
// Calendar arithmetic at local noon avoids DST and UTC date shifts.
export function offsetDate(anchor: string, offset: number) {
  const [y, m, d] = anchor.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + offset, 12));
}
export function sampleChats(anchor: string, language: 'zh' | 'en' = 'zh'): RiverChat[] {
  if (language === 'en') return [
    { offset: 0, title: 'Leave today among the clouds', messages: [{role:'user',content:'If memories were a road, what would it look like?'},{role:'assistant',content:'Perhaps a long road above the clouds, with a door for every day. The words we shared would glow quietly behind them.'},{role:'user',content:'Then let’s walk a little slower. I want to take it all in.'}] },
    { offset: 2, title: 'Dreaming of a journey', messages: [{role:'user',content:'I want to find somewhere quiet, watch the sunrise and think about nothing.'},{role:'assistant',content:'Keep that morning for yourself. Bring a warm drink and wait for the first light. There’s no need to rush into what comes next.'}] },
    { offset: 3, title: 'A little good thing today', messages: [{role:'user',content:'A cat followed me for a little while on my walk today.'},{role:'assistant',content:'A tiny guide chose you today. That little stretch of road is a memory worth keeping.'}] },
    { offset: -2, title: 'To my future self', messages: [{role:'user',content:'I hope I’ll look back someday and feel that the effort was worth it.'},{role:'assistant',content:'Take care of today first. Your future self will remember that you made a sincere start.'}] },
  ].map((chat,i)=>({id:`sample-${i}`,date:offsetDate(anchor,chat.offset),title:chat.title,messages:chat.messages}));
  return [
    { offset: 0, title: '把今天留在云端', messages: [{ role: 'user', content: '如果回忆是一条路，你觉得它会是什么样子？' }, { role: 'assistant', content: '也许是一条云海上的长路。每走过一天，就留下一扇门。那些说过的话，会在门后静静发光。' }, { role: 'user', content: '那就慢一点走吧，我想多看看。' }] },
    { offset: 2, title: '关于一场旅行', messages: [{ role: 'user', content: '想找一个安静的地方，看日出，什么都不想。' }, { role: 'assistant', content: '那就把清晨留给自己吧。带一杯热饮，等天边第一束光，不必急着安排下一件事。' }] },
    { offset: 3, title: '今天也有小小的好事', messages: [{ role: 'user', content: '今天散步时看见一只猫，它跟了我一小段路。' }, { role: 'assistant', content: '看来今天你被一位小小的向导选中了。这一小段路，也值得好好收藏。' }] },
    { offset: -2, title: '给未来的自己', messages: [{ role: 'user', content: '希望以后回头看，会觉得现在的努力没有白费。' }, { role: 'assistant', content: '先把今天走好。未来的你，会记得你曾认真出发。' }] },
  ].map((chat, i) => ({ id: `sample-${i}`, date: offsetDate(anchor, chat.offset), title: chat.title, messages: chat.messages }));
}
