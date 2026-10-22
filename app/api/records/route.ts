import {currentUser,PAIR_OWNER,sameOrigin} from '../../../lib/identity';
import {getDb} from '../../../db';import {records} from '../../../db/schema';import {eq,and,desc} from 'drizzle-orm';
export const dynamic='force-dynamic';
const kinds=['diary','mood','habit','wish','wheel','spin','photo'];
const str=(v:any,n:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const date=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function valid(k:string,d:any){if(!d||typeof d!=='object'||Array.isArray(d))return false;
if(k==='diary')return str(d.title,120)&&str(d.body,20000)&&date(d.date)&&['开心','平静','一般','低落','疲惫'].includes(d.mood);
if(k==='mood'){
if(!date(d.date))return false;
if(d.sealed){const v=d.sealed;return v.version===1&&typeof v.salt==='string'&&/^[A-Za-z0-9+/]{22}==$/.test(v.salt)&&typeof v.iv==='string'&&/^[A-Za-z0-9+/]{16}$/.test(v.iv)&&typeof v.ciphertext==='string'&&v.ciphertext.length<=1300000&&/^[A-Za-z0-9+/]+={0,2}$/.test(v.ciphertext);}
return ['开心','平静','一般','低落','疲惫'].includes(d.mood)&&typeof d.note==='string'&&d.note.length<=20000&&(!d.image||(typeof d.image==='string'&&d.image.length<=900000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(d.image)));}

if(k==='habit')return str(d.title,100)&&Array.isArray(d.dates)&&d.dates.length<=10000&&d.dates.every(date);
if(k==='wish')return str(d.title,200)&&['生活','旅行','成长'].includes(d.category)&&typeof d.done==='boolean';
if(k==='wheel')return str(d.title,30)&&Array.isArray(d.options)&&d.options.length>=2&&d.options.length<=12&&d.options.every((v:any)=>str(v,20));
if(k==='spin')return str(d.category,30)&&str(d.result,20);return false;}
async function uid(){return await currentUser()?PAIR_OWNER:null}
function err(error:string,status:number){return Response.json({error},{status})}
function validOrigin(r:Request){try{sameOrigin(r);return true}catch{return false}}
export async function GET(r:Request){const user=await uid();if(!user)return err('请先选择你的身份并登录。',401);const kind=new URL(r.url).searchParams.get('kind');if(kind&&!kinds.includes(kind))return err('无效记录类型',400);try{const rows=await getDb().select().from(records).where(kind?and(eq(records.userId,user),eq(records.kind,kind)):eq(records.userId,user)).orderBy(desc(records.createdAt));return Response.json(rows.map(v=>({...v,data:JSON.parse(v.data)})),{headers:{'Cache-Control':'no-store'}})}catch{return err('读取失败，请稍后重试。',503)}}
export async function POST(r:Request){const user=await uid();if(!user)return err('请先登录',401);if(!validOrigin(r))return err('无效请求来源',403);try{const {kind,data,id,clientId}=await r.json() as {kind:string;data:any;id?:string;clientId?:string};if(!kinds.includes(kind)||!valid(kind,data))return err('请检查内容格式或长度',400);const db=getDb();if(clientId){if(kind!=='mood'||typeof clientId!=='string'||!/^[-a-f0-9]{36}$/.test(clientId))return err('无效导入编号',400);const existing=await db.select().from(records).where(eq(records.id,clientId));if(existing[0])return existing[0].userId===user&&existing[0].kind===kind?Response.json({ok:true,id:clientId}):err('记录编号冲突',409);}if(id){if(typeof id!=='string')return err('无效编号',400);const found=await db.select().from(records).where(and(eq(records.id,id),eq(records.userId,user),eq(records.kind,kind)));if(!found.length)return err('记录不存在',404);data.authorId=JSON.parse(found[0].data).authorId;await db.update(records).set({data:JSON.stringify(data)}).where(and(eq(records.id,id),eq(records.userId,user)));return Response.json({ok:true,id})}data.authorId=(await currentUser())!.id;const newId=clientId||crypto.randomUUID();await db.insert(records).values({id:newId,userId:user,kind,data:JSON.stringify(data),createdAt:Date.now()});return Response.json({ok:true,id:newId},{status:201})}catch{return err('保存失败，请重试',400)}}
export async function DELETE(r:Request){const user=await uid();if(!user)return err('请先登录',401);if(!validOrigin(r))return err('无效请求来源',403);try{const{id}=await r.json() as {id?:string};if(typeof id!=='string')return err('无效编号',400);const row=await getDb().select().from(records).where(and(eq(records.id,id),eq(records.userId,user)));if(row[0]?.kind==='photo')return err('请从相册删除照片',400);await getDb().delete(records).where(and(eq(records.id,id),eq(records.userId,user)));return Response.json({ok:true})}catch{return err('删除失败',500)}}
