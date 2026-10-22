// Keep original artwork and dimensions; generate browser-negotiated WebP sidecars.
import sharp from 'sharp';
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const target = process.argv[2] || 'dist/client';
const results=[];
for (const file of await readdir(path.join(target,'art'))) {
  if (!/\.(png|jpe?g)$/i.test(file)) continue;
  const source=path.join(target,'art',file);
  const output=source+'.webp';
  await sharp(source).webp({quality:85,alphaQuality:100,effort:6}).toFile(output);
  const before=(await stat(source)).size, after=(await stat(output)).size;
  results.push({file,before,after,savedPercent:Math.round((1-after/before)*100)});
}
await mkdir('outputs',{recursive:true});
await writeFile('outputs/server-image-optimization.json',JSON.stringify(results,null,2));
console.table(results);
