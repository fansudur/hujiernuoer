import {lonLatToLocalKm,sampleDemElevation} from './terrain-math.js';
import {pointInGeoGeometry} from './geo-pick.js';
const coord=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
export const isTrack=f=>['LineString','MultiLineString'].includes(f?.geometry?.type);
const valid=z=>Number.isFinite(z)&&z>-10000;
export function sampleValidDisplayDem(dem,lon,lat){
 if(!dem||!Array.isArray(dem.bounds_wgs84)||!Number.isInteger(dem.width)||!Number.isInteger(dem.height)||dem.width<2||dem.height<2)return null;
 const [w,s,e,n]=dem.bounds_wgs84,cols=dem.width,rows=dem.height,el=dem.elevations_m;
 if(!el||!(n>s&&e>w)||lon<w-1e-9||lon>e+1e-9||lat<s-1e-9||lat>n+1e-9)return null;
 const u=Math.max(0,Math.min(cols-1,(lon-w)/(e-w)*(cols-1))),v=Math.max(0,Math.min(rows-1,(n-lat)/(n-s)*(rows-1)));
 const i=Math.min(cols-2,Math.floor(u)),j=Math.min(rows-2,Math.floor(v)),r=j*cols+i;
 const ids=u-i+v-j<=1?[r,r+1,r+cols]:[r+1,r+cols,r+cols+1];
 if(ids.some(i=>!valid(el[i]) || (dem.nodata_value!=null&&el[i]===dem.nodata_value)))return null;
 const z=sampleDemElevation(dem,lon,lat);
 return valid(z)?z:null;
}
const between=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function intersections(a,b,masks){
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
 const out=[],d=sub(b,a);
 for(const geom of masks){
  const polygons=geom?.type==='Polygon'?[geom.coordinates]:geom?.type==='MultiPolygon'?geom.coordinates:[];
  for(const poly of polygons)for(const ring of poly)for(let i=1;i<ring.length;i++){
   const c=ring[i-1],e=ring[i];if(!coord(c)||!coord(e))continue;
   if(Math.max(a[0],b[0])<Math.min(c[0],e[0])||Math.min(a[0],b[0])>Math.max(c[0],e[0])||
      Math.max(a[1],b[1])<Math.min(c[1],e[1])||Math.min(a[1],b[1])>Math.max(c[1],e[1]))continue;
   const m=sub(e,c),delta=sub(c,a),z=cross(d,m);
   if(Math.abs(z)<=1e-19)continue;
   const t=cross(delta,m)/z,k=cross(delta,d)/z;
   if(t>1e-10&&t<1-1e-10&&k>=0&&k<=1)out.push(t);
  }
 }
 return out;
}
function gridSteps(a,b,dem,dist,masks){
 const [w,s,e,n]=dem.bounds_wgs84,U=p=>(p[0]-w)/(e-w)*(dem.width-1),V=p=>(n-p[1])/(n-s)*(dem.height-1);
 const bars=(x,y,lo,hi)=>{
   const points=[];
   if(Math.abs(x-y)<1e-10)return points;
   for(let j=Math.max(lo,Math.ceil(Math.min(x,y)));j<=Math.min(hi,Math.floor(Math.max(x,y)));j++){
    const t=(j-x)/(y-x);if(t>1e-10&&t<1-1e-10)points.push(t);
   }
   return points;
 };
 const m=Math.min(2048,Math.max(1,Math.ceil(dist/30)));
 const ap=U(a),bp=U(b),aq=V(a),bq=V(b);
 const all=[0,1,...Array.from({length:m-1},(_,i)=>(i+1)/m),...bars(ap,bp,0,dem.width-1),...bars(aq,bq,0,dem.height-1),
   ...bars(ap+aq,bp+bq,0,dem.width+dem.height-2),...intersections(a,b,masks)];
 all.sort((a,b)=>a-b);
 return all.filter((t,i)=>!i||t-all[i-1]>1e-9);
}
export function profileFromExactLine(feature,dem,referenceMasks=[]){
 if(!isTrack(feature)||!dem?.bounds_wgs84||!dem.elevations_m)return null;
 const runs=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates;
 if(!Array.isArray(runs)||!runs.length||runs.some(line=>!Array.isArray(line)||line.length<2||!line.every(coord)))return null;
 const rows=[],mask=[];
 let distance=0,previous=null;
 const add=(m,p,forceGap=false)=>{
   const water=!forceGap&&referenceMasks.some(g=>pointInGeoGeometry(p[0],p[1],g));
   // The geometry never supplies elevation. Every rendered sample comes from
   // the same native point-node, triangle surface as the display DEM.
   const z=forceGap||water?null:sampleValidDisplayDem(dem,p[0],p[1]);
   rows.push([m,p[0],p[1],z]);mask.push(water);
 };
 for(const line of runs){
  if(previous)add(distance,previous,true);
  add(distance,line[0]);
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i];
   const ap=lonLatToLocalKm(a[0],a[1],dem.bounds_wgs84),bp=lonLatToLocalKm(b[0],b[1],dem.bounds_wgs84);
   const dist=1000*Math.hypot(ap[0]-bp[0],ap[1]-bp[1]);
   if(!(dist>0))continue;
   const ts=gridSteps(a,b,dem,dist,referenceMasks);
   for(let j=1;j<ts.length;j++){
    const t=(ts[j]+ts[j-1])/2;
    // An interior representative records a narrow no-data/water intersection
    // even if its boundary vertices fall in adjacent triangles.
    add(distance+dist*t,between(a,b,t));
    add(distance+dist*ts[j],j===ts.length-1?b:between(a,b,ts[j]));
    if(rows.length>12000)return null;
   }
   distance+=dist;
  }
  previous=line.at(-1);
 }
 if(!(distance>0)||!rows.some(r=>Number.isFinite(r[3])))return null;
 return {
  ...feature,properties:{...feature.properties,
    positive_direction:'沿所选线的原始顶点顺序，从首点 0 m 递增；不是实测流向。',
    zero_anchor_lonlat:rows[0].slice(1,3),
    profile:{
      columns:['distance_m','lon','lat','glo30_m'],samples:rows,water_mask:mask,water_mask_label:'主湖历史参考水面',
      note:'沿当前所选矢量取样：图谱 GLO‑30 显示地形（392×276 节点，未垂向夸张）。缺测、图外或主湖历史参考水面内断开；不补值，不是沟底、水深或实测流向。多段线分段显示，不跨缺口连线。'
    }
  }
 };
}

export function nativeTrackProfiles(rows,byId){
 const result=new Map();
 if(!Array.isArray(rows))return result;
 for(const {id,profile} of rows){
  const f=byId.get(id)||byId.get('diag-branch-'+id),samples=profile?.samples,coords=f?.geometry?.coordinates;
  if(f?.geometry?.type!=='LineString'||!Array.isArray(samples)||samples.length!==coords.length||
     !Array.isArray(profile.columns)||profile.columns.join()!=='distance_m,lon,lat,glo30_m,aw3d30_m')continue;
  if(samples.some((r,i)=>!Array.isArray(r)||r.length!==5||!Number.isFinite(r[0])||(i===0?r[0]!==0:r[0]<=samples[i-1][0])||
     !coord(r.slice(1,3))||Math.abs(r[1]-coords[i][0])>1e-8||Math.abs(r[2]-coords[i][1])>1e-8||r.slice(3).some(z=>z!==null&&!valid(z))))continue;
  result.set(f.id,{...f,properties:{...f.properties,zero_anchor_lonlat:samples[0].slice(1,3),
    positive_direction:'沿本条模型线的原始顶点顺序，从首点 0 m 到该模型线终点；不是实测流向。',profile}});
 }
 return result;
}
