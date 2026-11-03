// Map-plane proximity, not a route, terrain path, safety buffer, or access permission.
import {distanceM} from './access-analysis.js';
const R=6371008.8,rad=Math.PI/180;
export function waterPolygons(collection){return (collection?.features||[]).flatMap(f=>f.geometry?.type==='Polygon'?[f.geometry.coordinates]:f.geometry?.type==='MultiPolygon'?f.geometry.coordinates:[]);}
export function pointInRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function pointInWater(p,collection){return waterPolygons(collection).some(rings=>pointInRing(p,rings[0])&&!rings.slice(1).some(r=>pointInRing(p,r)));}
export function nearestBoundary(office,collection){
 const polygons=waterPolygons(collection);if(!polygons.length)return {status:'observed_zero',distance_m:null,point:null,line:null};
 if(pointInWater(office,collection))return {status:'office_in_classified_water',distance_m:null,point:null,line:null};
 const sx=R*rad*Math.cos(office[1]*rad),sy=R*rad;let best=null;
 for(const rings of polygons)for(const ring of rings)for(let i=1;i<ring.length;i++){
  const a=ring[i-1],b=ring[i],ax=(a[0]-office[0])*sx,ay=(a[1]-office[1])*sy,bx=(b[0]-office[0])*sx,by=(b[1]-office[1])*sy,dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/len)):0,point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],distance=distanceM(office,point);
  if(!best||distance<best.distance_m)best={status:distance<.01?'office_on_boundary':'outside_water',distance_m:distance,point,line:[office.slice(0,2),point]};
 }
 return best||{status:'no_boundary',distance_m:null,point:null,line:null};
}
export function compareOfficeShore(a,b){return {sameMonth:a.date.slice(5)===b.date.slice(5),difference_m:Number.isFinite(a.distance_m)&&Number.isFinite(b.distance_m)?b.distance_m-a.distance_m:null};}
export function shorelineLines(collection){return waterPolygons(collection).flatMap(rings=>rings);}
