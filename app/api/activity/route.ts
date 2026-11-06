import {requireUser,sameOrigin,apiError,RequestError} from '../../../lib/identity';
import {readStorageJson} from '../../../lib/storage-api';
import {auditDetails} from '../../../lib/audit-context';
import {isActivityPage} from '../../../lib/activity-pages';
export const dynamic='force-dynamic';

export async function POST(request:Request){try{
  sameOrigin(request);await requireUser();
  const body=await readStorageJson(request,1024);
  if(!body||!isActivityPage(body.path)||!['view','resume'].includes(body.type)||typeof body.eventId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.eventId))throw new RequestError('无效的访问记录');
  auditDetails({action:body.type==='resume'?'page.resume':'page.view',page:body.path,eventKey:body.eventId});
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
