// Clip analytical polygon triangles against the actual DSM surface triangles.
// Output shares the terrain's piecewise-linear height, never an inferred lake level.
export function drapeTriangles(sourcePositions, sourceIndices, terrainPositions, width, height, lift=.004) {
 const out=[], eps=1e-10, tx=i=>terrainPositions[i*3],ty=i=>terrainPositions[i*3+1],tz=i=>terrainPositions[i*3+2];
 const x0=tx(0),z0=tz(0),dx=tx(1)-x0,dz=tz(width)-z0;
 if(width<2||height<2||!(dx>0)||!(dz>0))return out;
 const ids=sourceIndices||Array.from({length:sourcePositions.length/3},(_,i)=>i);
 const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const clip=(poly,a,b,sign)=>{const next=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=sign*cross(a,b,p),dq=sign*cross(a,b,q),pin=dp>=-eps,qin=dq>=-eps;if(pin)next.push(p);if(pin!==qin){const f=dp/(dp-dq);next.push([p[0]+f*(q[0]-p[0]),p[1]+f*(q[1]-p[1])]);}}return next;};
 for(let k=0;k<ids.length;k+=3){
  // THREE.ShapeGeometry is XY; geographic north is -scene Z.
  const source=[ids[k],ids[k+1],ids[k+2]].map(i=>[sourcePositions[i*3],-sourcePositions[i*3+1]]);
  const c0=Math.max(0,Math.floor((Math.min(...source.map(p=>p[0]))-x0)/dx)),c1=Math.min(width-2,Math.floor((Math.max(...source.map(p=>p[0]))-x0)/dx));
  const r0=Math.max(0,Math.floor((Math.min(...source.map(p=>p[1]))-z0)/dz)),r1=Math.min(height-2,Math.floor((Math.max(...source.map(p=>p[1]))-z0)/dz));
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
   const i=r*width+c;
   for(const tri of [[i,i+width,i+1],[i+1,i+width,i+width+1]]){
    const vertices=tri.map(j=>[tx(j),tz(j)]),area=cross(vertices[0],vertices[1],vertices[2]),sign=Math.sign(area);let poly=source;
    for(let e=0;e<3&&poly.length;e++)poly=clip(poly,vertices[e],vertices[(e+1)%3],sign);
    if(poly.length<3)continue;
    const point=p=>{const a=cross(vertices[1],vertices[2],p)/area,b=cross(vertices[2],vertices[0],p)/area;return [p[0],a*ty(tri[0])+b*ty(tri[1])+(1-a-b)*ty(tri[2])+lift,p[1]];};
    for(let j=1;j<poly.length-1;j++)if(Math.abs(cross(poly[0],poly[j],poly[j+1]))>eps)out.push(...point(poly[0]),...point(poly[j]),...point(poly[j+1]));
   }
  }
 }
 return out;
}

// Split a geographic polyline at DSM grid edges and each cell's diagonal.
// At each split, callers sample the same piecewise-linear terrain as the mesh.
export function splitGroundLine(coords, terrain) {
 if(coords.length<2)return coords.map(c=>c.slice(0,2));
 const [w,s,e,n]=terrain.bounds,dx=(e-w)/terrain.width,dy=(n-s)/terrain.height,x0=w+dx/2,y0=n-dy/2,result=[];
 for(let i=1;i<coords.length;i++){
  const a=coords[i-1],b=coords[i],u=(a[0]-x0)/dx,v=(y0-a[1])/dy,du=(b[0]-a[0])/dx,dv=-(b[1]-a[1])/dy,ts=[0,1];
  for(const [start,delta] of [[u,du],[v,dv]])if(Math.abs(delta)>1e-12)for(let k=Math.ceil(Math.min(start,start+delta));k<=Math.floor(Math.max(start,start+delta));k++){const t=(k-start)/delta;if(t>1e-9&&t<1-1e-9)ts.push(t);}
  ts.sort((a,b)=>a-b);const breaks=[...new Set(ts)];
  if(Math.abs(du+dv)>1e-12)for(let j=1;j<breaks.length;j++){const mid=(breaks[j-1]+breaks[j])/2,cell=Math.floor(u+du*mid)+Math.floor(v+dv*mid),t=(cell+1-u-v)/(du+dv);if(t>breaks[j-1]+1e-9&&t<breaks[j]-1e-9)ts.push(t);}
  ts.sort((a,b)=>a-b);for(const t of ts)if(!(i>1&&t===0))result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
 }
 return result;
}
