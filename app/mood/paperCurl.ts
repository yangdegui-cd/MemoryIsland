/** A moving cylindrical fold, slightly diagonal, with a fixed paper spine. */
export function curlPoint(x:number,y:number,width:number,progress:number){
 if(progress<=0)return {x,y,z:0};
 if(progress>=1)return {x:-x,y,z:0};
 const lift=Math.sin(Math.PI*progress);
 const radius=width*.125*lift;
 const tilt=.12*lift, nx=Math.cos(tilt),ny=Math.sin(tilt);
 const fold=width*(1-progress)-Math.PI*radius*.5;
 const distance=(x-fold)*nx+y*ny;
 if(distance<=0)return {x,y,z:0};
 const angle=Math.min(Math.PI,distance/radius);
 const bent=distance<Math.PI*radius?radius*Math.sin(angle):-(distance-Math.PI*radius);
 const tether=Math.min(1,Math.max(0,x/(width*.08)));
 const shift=(bent-distance)*tether;
 return {x:x+shift*nx,y:y+shift*ny,z:radius*(1-Math.cos(angle))*tether};
}
export const turnProgress=(t:number)=>t*t*(3-2*t);
