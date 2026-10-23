// Compact embedded character textures without changing skinning or animation.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
for (const identity of ['alexx','bv']) {
  const path=new URL(`../public/models/river-${identity}-v3.glb`,import.meta.url);
  const file=await readFile(path),length=file.readUInt32LE(12);
  const doc=JSON.parse(file.toString('utf8',20,20+length)),bin=file.subarray(28+length);
  const replacements=new Map();
  for (const image of doc.images??[]) {
    const v=doc.bufferViews[image.bufferView];
    const bytes=bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
    const size=/Ranger/.test(image.name)?1024:/Eye/.test(image.name)?256:512;
    const optimized=await sharp(bytes).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).removeAlpha().png({compressionLevel:9}).toBuffer();
    image.mimeType='image/png';replacements.set(image.bufferView,optimized);
  }
  let offset=0;const pieces=[];
  for (let i=0;i<doc.bufferViews.length;i++) {
    const v=doc.bufferViews[i],bytes=replacements.get(i)??bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
    v.byteOffset=offset;v.byteLength=bytes.length;pieces.push(bytes);offset+=bytes.length;
    const pad=(4-offset%4)%4;if(pad){pieces.push(Buffer.alloc(pad));offset+=pad;}
  }
  doc.buffers[0].byteLength=offset;
  doc.asset.extras.textureMaxSize=1024;
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.write('JSON',16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset,0);binHeader.write('BIN\0',4);
  await writeFile(path,Buffer.concat([header,json,binHeader,...pieces]));
  console.log(`${identity}: ${(file.length/1024/1024).toFixed(1)} → ${((28+json.length+offset)/1024/1024).toFixed(1)} MiB`);
}
