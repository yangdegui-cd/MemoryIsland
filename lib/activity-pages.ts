// A page event must never contain a query, private share link, or arbitrary text.
export const ACTIVITY_PAGES=['/','/mood','/album','/river','/media','/games','/diary','/habits','/wishes','/wheel','/settings/api'] as const;
export function isActivityPage(path:unknown):path is string{return typeof path==='string'&&(ACTIVITY_PAGES as readonly string[]).includes(path);}
