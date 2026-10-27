import {and,desc,eq,gt} from 'drizzle-orm';
import {getDb} from '../../../db';
import {apiKeys} from '../../../db/schema';
import {RequestError,requireUser,sameOrigin} from '../../../lib/identity';
import {digest,randomToken} from '../../../lib/password';
import {keyInput} from '../../../lib/storage-api-validation';
import {readStorageJson,storageError,storageJson} from '../../../lib/storage-api';
export const dynamic='force-dynamic';
export async function GET(){try{
  const user=await requireUser();
  const rows=await getDb().select().from(apiKeys).where(eq(apiKeys.userId,user.id)).orderBy(desc(apiKeys.createdAt));
  return storageJson({items:rows.map(({id,name,prefix,scopes,createdAt,expiresAt,credentialVersion})=>({id,name,prefix,scopes:JSON.parse(scopes),createdAt,expiresAt,active:expiresAt>Date.now()&&credentialVersion===user.credentialVersion}))});
}catch(error){return storageError(error);}}
export async function POST(request:Request){try{
  sameOrigin(request);const user=await requireUser();
  const input=keyInput.parse(await readStorageJson(request,16384));
  const db=getDb(),now=Date.now();
  const active=await db.select({id:apiKeys.id}).from(apiKeys).where(and(eq(apiKeys.userId,user.id),gt(apiKeys.expiresAt,now),eq(apiKeys.credentialVersion,user.credentialVersion))).limit(20);
  if(active.length>=20)throw new RequestError('Revoke an existing key before creating more (maximum 20).',409);
  const token='di_'+randomToken();
  const key={id:crypto.randomUUID(),userId:user.id,name:input.name,tokenHash:await digest(token),prefix:token.slice(0,11),scopes:JSON.stringify(input.scopes),credentialVersion:user.credentialVersion,createdAt:now,expiresAt:now+input.expiresInDays*86400000};
  await db.insert(apiKeys).values(key);
  return storageJson({id:key.id,name:key.name,token,scopes:input.scopes,expiresAt:key.expiresAt},201);
}catch(error){return storageError(error);}}
