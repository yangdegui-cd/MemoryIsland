export type MoodPrivacy = {authorId?:string;locked?:boolean;sealed?:unknown};
export function canReadMood(data:MoodPrivacy,userId:string){return !(data.locked||data.sealed)||data.authorId===userId;}
export function canChangeMood(data:MoodPrivacy,next:MoodPrivacy,userId:string){
 if((data.locked||data.sealed||next.locked||next.sealed)&&data.authorId!==userId)return false;
 return true;
}
