import {headers} from 'next/headers';
import {getDb} from '../../../db';import {records} from '../../../db/schema';import {eq,and,desc} from 'drizzle-orm';
export const dynamic='force-dynamic';
const kinds=['diary','mood','habit','wish','wheel','spin','photo'];
const str=(v:any,n:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const date=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function valid(k:string,d:any){if(!d||typeof d!=='object'||Array.isArray(d))return false;
if(k==='diary')return str(d.title,120)&&str(d.body,20000)&&date(d.date)&&['开心','平静','一般','低落','疲惫'].includes(d.mood);
if(k==='mood')return date(d.date)&&['开心','平静','一般','低落','疲惫'].includes(d.mood)&&typeof d.note==='string'&&d.note.length<=500;
if(k==='habit')return str(d.title,100)&&Array.isArray(d.dates)&&d.dates.length<=10000&&d.dates.every(date);
if(k==='wish')return str(d.title,200)&&['生活','旅行','成长'].includes(d.category)&&typeof d.done==='boolean';
if(k==='wheel')return str(d.title,30)&&Array.isArray(d.options)&&d.options.length>=2&&d.options.length<=12&&d.options.every((v:any)=>str(v,20));
if(k==='spin')return str(d.category,30)&&str(d.result,20);return false;}
async function uid(){return(await headers()).get('oai-authenticated-user-id')}
function err(error:string,status:number){return Response.json({error},{status})}
function sameOrigin(r:Request){return !r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin}
export async function GET(r:Request){const user=await uid();if(!user)return err('请先登录，开启你的私人小岛。',401);const kind=new URL(r.url).searchParams.get('kind');if(kind&&!kinds.includes(kind))return err('无效记录类型',400);try{const rows=await getDb().select().from(records).where(kind?and(eq(records.userId,user),eq(records.kind,kind)):eq(records.userId,user)).orderBy(desc(records.createdAt));return Response.json(rows.map(v=>({...v,data:JSON.parse(v.data)})),{headers:{'Cache-Control':'no-store'}})}catch{return err('读取失败，请稍后重试。',503)}}
export async function POST(r:Request){const user=await uid();if(!user)return err('请先登录',401);if(!sameOrigin(r))return err('无效请求来源',403);try{const {kind,data,id}=await r.json() as {kind:string;data:any;id?:string};if(!kinds.includes(kind)||!valid(kind,data))return err('请检查内容格式或长度',400);const db=getDb();if(id){if(typeof id!=='string')return err('无效编号',400);const found=await db.select().from(records).where(and(eq(records.id,id),eq(records.userId,user),eq(records.kind,kind)));if(!found.length)return err('记录不存在',404);await db.update(records).set({data:JSON.stringify(data)}).where(and(eq(records.id,id),eq(records.userId,user)));return Response.json({ok:true,id})}const newId=crypto.randomUUID();await db.insert(records).values({id:newId,userId:user,kind,data:JSON.stringify(data),createdAt:Date.now()});return Response.json({ok:true,id:newId},{status:201})}catch{return err('保存失败，请重试',400)}}
export async function DELETE(r:Request){const user=await uid();if(!user)return err('请先登录',401);if(!sameOrigin(r))return err('无效请求来源',403);try{const{id}=await r.json() as {id?:string};if(typeof id!=='string')return err('无效编号',400);const row=await getDb().select().from(records).where(and(eq(records.id,id),eq(records.userId,user)));if(row[0]?.kind==='photo')return err('请从相册删除照片',400);await getDb().delete(records).where(and(eq(records.id,id),eq(records.userId,user)));return Response.json({ok:true})}catch{return err('删除失败',500)}}
