import {listStored,requireApiKey,storageError,storeChat} from '../../../../lib/storage-api';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{await requireApiKey(request,'chats:read');return await listStored(request,'chat');}catch(error){return storageError(error);}}
export async function POST(request:Request){try{const actor=await requireApiKey(request,'chats:write');return await storeChat(request,actor.userId);}catch(error){return storageError(error);}}
