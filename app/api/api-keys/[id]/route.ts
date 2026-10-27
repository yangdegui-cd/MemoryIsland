import {and,eq} from 'drizzle-orm';
import {getDb} from '../../../../db';
import {apiKeys} from '../../../../db/schema';
import {RequestError,requireUser,sameOrigin} from '../../../../lib/identity';
import {storageError,storageJson} from '../../../../lib/storage-api';
export const dynamic='force-dynamic';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{
  sameOrigin(request);const user=await requireUser(),{id}=await params;
  const deleted=await getDb().delete(apiKeys).where(and(eq(apiKeys.id,id),eq(apiKeys.userId,user.id))).returning({id:apiKeys.id});
  if(!deleted.length)throw new RequestError('API key not found.',404);
  return storageJson({ok:true});
}catch(error){return storageError(error);}}
