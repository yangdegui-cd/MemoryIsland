import * as THREE from 'three';

// CPU counterpart for the lightweight interaction mesh. Rendering keeps the
// high resolution sheet on the GPU; hover/click follows its current curl.
export function deformPaperPoint(u:number,v:number,width:number,height:number,bend:number,time:number,phase:number,target:THREE.Vector3){
  const free=1-v,loose=free*free,side=(u-.5)*2;
  const twist=Math.sin(time*.72+phase*.37),ripple=Math.sin(time*1.1-free*3.4+side*1.2+phase*.21);
  return target.set((u-.5)*width+loose*width*.004*bend,
    (v-1)*height+loose*height*.012*(bend*bend+twist*twist*.35),
    loose*(height*.068*bend+width*.065*side*twist)+loose*free*width*(.026*side*side+.014*ripple));
}

// A thin two-sided print with a closed paper edge, subdivided so the same curl
// bends both surfaces and the rim without opening seams.
export function createPaperGeometry(width: number, height: number) {
  const columns = 32, rows = 40, thickness = width * .0011;
  const positions: number[] = [], uvs: number[] = [], surfaces: number[] = [], indices: number[] = [];
  const vertex = (u: number, v: number, z: number, surface: number) => {
    const index = positions.length / 3;
    positions.push((u - .5) * width, (v - 1) * height, z);
    uvs.push(u, v); surfaces.push(surface);
    return index;
  };
  const stride = columns + 1, count = stride * (rows + 1);
  for (let side = 0; side < 2; side++) {
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      vertex(x / columns, y / rows, (side ? -.5 : .5) * thickness, side);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const a = side * count + y * stride + x, b = a + 1, c = a + stride, d = c + 1;
      indices.push(...(side ? [a,c,b,b,c,d] : [a,b,c,b,d,c]));
    }
  }
  const perimeter: [number,number][] = [];
  for (let x = 0; x < columns; x++) perimeter.push([x / columns,0]);
  for (let y = 0; y < rows; y++) perimeter.push([1,y / rows]);
  for (let x = columns; x > 0; x--) perimeter.push([x / columns,1]);
  for (let y = rows; y > 0; y--) perimeter.push([0,y / rows]);
  for (let i = 0; i < perimeter.length; i++) {
    const [u,v] = perimeter[i], [nextU,nextV] = perimeter[(i + 1) % perimeter.length];
    const a = vertex(u,v,thickness / 2,2), b = vertex(u,v,-thickness / 2,2);
    const c = vertex(nextU,nextV,thickness / 2,2), d = vertex(nextU,nextV,-thickness / 2,2);
    indices.push(a,b,c,b,d,c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('aSurface', new THREE.Float32BufferAttribute(surfaces,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  // Shader curl can extend beyond the undeformed sheet at the viewport edge.
  if (geometry.boundingSphere) geometry.boundingSphere.radius += Math.max(width,height) * .18;
  return geometry;
}
