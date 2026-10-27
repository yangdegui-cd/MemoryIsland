import {z} from 'zod';

export const storageScopes = ['photos:read','photos:write','chats:read','chats:write'] as const;
export type StorageScope = typeof storageScopes[number];
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const date = new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}, 'Use a valid calendar date (YYYY-MM-DD).');
export const externalId = z.string().trim().min(1).max(160);
export const keyInput = z.object({
  name:z.string().trim().min(1).max(80),
  scopes:z.array(z.enum(storageScopes)).min(1).max(4).transform(items=>[...new Set(items)]),
  expiresInDays:z.number().int().min(1).max(365).default(90),
}).strict();
export const photoInput = z.object({title:z.string().trim().min(1).max(120),date:calendarDate,externalId:externalId.optional()}).strict();
const chatMessage = z.object({
  role:z.enum(['user','assistant','system']),
  content:z.string().min(1).max(20000),
  speaker:z.string().trim().min(1).max(120).optional(),
  time:z.string().max(64).refine(value=>
    /^\d{4}-\d{2}-\d{2}[T ](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
    && calendarDate.safeParse(value.slice(0,10)).success
    && Number.isFinite(Date.parse(value.replace(' ','T')+(/[Z+-]/.test(value.slice(19))?'':'Z'))),
  'Use YYYY-MM-DD HH:mm:ss or an ISO 8601 timestamp.').nullable().optional(),
  original:z.string().max(20000).optional(),
  translation:z.string().max(20000).optional(),
  note:z.string().max(2000).optional(),
}).strict();
export const chatInput = z.object({
  title:z.string().trim().min(1).max(120),date:z.union([calendarDate,z.literal('undated')]),
  externalId:externalId.optional(),part:z.number().int().min(0).max(100000).optional(),
  sourceNote:z.string().max(2000).optional(),
  messages:z.array(chatMessage).min(1).max(500),
}).strict();
export function imageMime(bytes:Uint8Array):string|null {
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}
