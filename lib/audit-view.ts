export type AuditItem={id:string;createdAt:number;actorId:string|null;actorName:string|null;subjectId:string|null;action:string;outcome:string;path:string;authType:string;kind:string|null;reason:string|null;count:number|null};
export type AuditPage={items:AuditItem[];nextCursor:string|null};
export const ACTIVITY_ACTIONS=['page.view','page.resume','auth.setup','auth.login','auth.logout','auth.password_reset','auth.request','record.create','record.update','record.delete','mood.unlock_all','photo.create','photo.delete','photo.share_enable','photo.share_revoke','people.update','api_key.create','api_key.revoke','api.chat.create','api.photo.create'];
export const AUTH_ACTIONS=['auth.setup','auth.login','auth.logout','auth.password_reset','auth.identify','auth.request'];

const pages:Record<string,[string,string]>={'/':['首页','Home'],'/mood':['心情手记','Mood journal'],'/album':['回忆相册','Memory album'],'/river':['时光走廊','Corridor of Time'],'/games':['游戏屋','Game house'],'/media':['视频房','Media room'],'/diary':['生活手记','Diary'],'/habits':['习惯花园','Habits'],'/wishes':['愿望清单','Wishes'],'/wheel':['转盘','Wheel'],'/settings/api':['API 设置','API settings'],'/activity':['活动记录','Activity log']};
const kinds:Record<string,[string,string]>={mood:['心情记录','mood entry'],diary:['日记','diary entry'],habit:['习惯','habit'],wish:['愿望','wish'],wheel:['转盘','wheel'],spin:['转盘结果','wheel result'],photo:['照片','photo'],chat:['聊天记录','chat record']};
const actions:Record<string,[string,string]>={
  'auth.setup':['首次设置并登录','Set up account and sign in'],'auth.login':['登录','Sign in'],'auth.logout':['退出登录','Sign out'],'auth.password_reset':['重设密码','Reset password'],'auth.identify':['识别输入的名字','Check entered name'],'auth.request':['登录请求','Sign-in request'],'identity.check':['检查登录状态','Check session'],
  'record.list':['读取记录','Read records'],'record.replay':['重复提交已保存的记录','Resubmit a saved record'],'mood.unlock_all':['批量解锁心情','Unlock mood entries'],
  'photo.create':['上传照片','Upload photo'],'photo.read':['查看照片','View photo'],'photo.delete':['删除照片','Delete photo'],'photo.share_status':['查看照片分享状态','Check photo sharing'],'photo.share_enable':['开启照片分享','Enable photo sharing'],'photo.share_revoke':['关闭照片分享','Disable photo sharing'],
  'people.update':['修改时区设置','Update time zones'],'api_key.create':['创建 API 密钥','Create API key'],'api_key.revoke':['撤销 API 密钥','Revoke API key'],'api_key.list':['查看 API 密钥列表','List API keys'],
  'api.chat.create':['通过 API 导入聊天','Import chat via API'],'api.photo.create':['通过 API 上传照片','Upload photo via API'],'api.chat.replay':['重复导入已保存的聊天','Repeat a saved chat import'],'api.photo.replay':['重复上传已保存的照片','Repeat a saved photo upload'],'api.chat.list':['通过 API 读取聊天列表','List chats via API'],'api.photo.list':['通过 API 读取照片列表','List photos via API'],'api.chat.read':['通过 API 读取聊天','Read chat via API'],'api.photo.read':['通过 API 读取照片','Read photo via API'],'page.report':['提交访问记录','Report page visit'],
};
export function auditLabel(item:AuditItem,en=false){
  const i=en?1:0;
  if(item.action==='page.view'||item.action==='page.resume')return (item.action==='page.resume'?(en?'Return to ':'切回'):(en?'Open ':'进入'))+(pages[item.path]?.[i]??item.path);
  if(['record.create','record.update','record.delete'].includes(item.action))return ({'record.create':en?'Add ':'新增','record.update':en?'Edit ':'修改','record.delete':en?'Delete ':'删除'}[item.action]||'')+(kinds[item.kind||'']?.[i]??(en?'record':'记录'));
  return actions[item.action]?.[i]??(en?'Site activity':'站内操作');
}
export function auditReason(reason:string|null,en=false){
  const messages:Record<string,[string,string]>={incorrect_password:['密码不正确','Incorrect password'],account_locked:['尝试次数过多，暂时锁定','Temporarily locked after too many attempts'],unknown_identity:['名字未匹配','Name not recognized'],cross_origin:['请求来源无效','Invalid request origin']};
  return reason?messages[reason]?.[en?1:0]??'':'';
}
