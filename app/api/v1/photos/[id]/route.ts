import {readStored,requireApiKey,storageError} from '../../../../../lib/storage-api';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{await requireApiKey(request,'photos:read');return await readStored('photo',(await params).id);}catch(error){return storageError(error);}}
