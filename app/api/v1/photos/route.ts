import {listStored,requireApiKey,storageError,storePhoto} from '../../../../lib/storage-api';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{await requireApiKey(request,'photos:read');return await listStored(request,'photo');}catch(error){return storageError(error);}}
export async function POST(request:Request){try{const actor=await requireApiKey(request,'photos:write');return await storePhoto(request,actor.userId);}catch(error){return storageError(error);}}
