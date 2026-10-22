import type { Entry } from './data';

const titles = ['日落时分','海岸慢行','雨后街灯','花园来信','午后咖啡','海边晚霞'];
export const samplePhotos: Entry[] = Array.from({length:44},(_,i)=>({
  id:`sample-${i}`,kind:'sample',createdAt:0,data:{title:titles[i%6],sampleIndex:i%6},
}));

export function photoUrl(current: string, id: string | null) {
  const url = new URL(current);
  if(id) url.searchParams.set('photo',id); else url.searchParams.delete('photo');
  return url.pathname + url.search + url.hash;
}

export function validatePhotoFiles(files: File[]) {
  if(files.length > 12) return '每次最多上传12张照片。';
  if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type))) return '只支持 JPG、PNG、WebP 图片。';
  if(files.some(file=>!file.size || file.size > 8*1024*1024)) return '每张照片须小于8MB，且不能是空文件。';
  return '';
}
