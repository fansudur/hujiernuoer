export const WALK_ROAD_ID='secondary-way-162036946';
export const WALK_ROAD_PHOTO='field-photo-2020';
export const WALK_OFFICE_ID='office-service';
export const FREE_FLY_ENTRY_M=25;
export const WALK_EYE_M=1.7;
export const WALK_GUIDE_SPEED_MPS=4;
export const WALK_STEP_M=10;
const R=Math.PI/180;
const validPoint=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
const dist=(a,b)=>Math.hypot((a[0]-b[0])*72_800,(a[1]-b[1])*111_320);
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
const direction=(a,b)=>(Math.atan2((b[0]-a[0])*72_800,(b[1]-a[1])*111_320)/R+360)%360;
function measure(coords){
 const d=[0];
 for(let i=1;i<coords.length;i++)d.push(d[i-1]+dist(coords[i-1],coords[i]));
 return d;
}
function at(coords,stations,m){
 const x=clamp(m,0,stations.at(-1));
 for(let i=1;i<stations.length;i++){
   if(x<=stations[i]&&stations[i]>stations[i-1])return mix(coords[i-1],coords[i],(x-stations[i-1])/(stations[i]-stations[i-1]));
 }
 return [...coords.at(-1)];
}
export function prepareWalkRoad(road, reference, halfSpanM=70){
 const cs=road?.geometry?.type==='LineString'?road.geometry.coordinates:null;
 if(road?.id!==WALK_ROAD_ID||!cs?.length||cs.length<2||!cs.every(validPoint)||!validPoint(reference))return null;
 const d=measure(cs);
 let nearest=null;
 for(let i=1;i<cs.length;i++){
   if(d[i]===d[i-1])continue;
   const a=cs[i-1],b=cs[i],dx=(b[0]-a[0])*72_800,dy=(b[1]-a[1])*111_320;
   const ax=(reference[0]-a[0])*72_800,ay=(reference[1]-a[1])*111_320;
   const t=clamp((ax*dx+ay*dy)/(dx*dx+dy*dy),0,1);
   const away=dist(mix(a,b,t),reference);
   if(!nearest||away<nearest.distanceM)nearest={distanceM:away,offsetM:d[i-1]+(d[i]-d[i-1])*t};
 }
 // Fail closed if the documented local reference changes or the road is missing.
 if(!nearest||nearest.distanceM>25||!Number.isFinite(halfSpanM)||halfSpanM<=0)return null;
 const a=Math.max(0,nearest.offsetM-halfSpanM), b=Math.min(d.at(-1),nearest.offsetM+halfSpanM);
 const coords=[at(cs,d,a),...cs.filter((_,i)=>d[i]>a&&d[i]<b),at(cs,d,b)];
 const stations=measure(coords);
 if(stations.at(-1)<30)return null;
 return {sourceId:road.id,coords,stations,distanceToPhotoM:nearest.distanceM,lengthM:stations.at(-1)};
}
export function sampleWalkRoad(route, offset, yawOffset=0){
 const s=clamp(offset,0,route.lengthM);
 const [lon,lat]=at(route.coords,route.stations,s);
 const a=at(route.coords,route.stations,Math.max(0,s-2));
 const b=at(route.coords,route.stations,Math.min(route.lengthM,s+2));
 return {lon,lat,stationM:s,heading:(direction(a,b)+yawOffset+360)%360,eyeM:WALK_EYE_M};
}

// NOAA GML fractional-year approximation: true north, geometric altitude.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function beijingSun(date,minutes,lon,lat){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(minutes)||minutes<0||minutes>=1440||![lon,lat].every(Number.isFinite))return null;
 const midnight=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(+midnight)||midnight.toISOString().slice(0,10)!==date)return null;
 const y=midnight.getUTCFullYear(),first=Date.UTC(y,0,1),ny=Date.UTC(y+1,0,1);
 const g=2*Math.PI*((+midnight-first)/86400000+(minutes/60-12)/24)/((ny-first)/86400000);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const d=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const h=((minutes+eq+4*lon-8*60)/4-180)*R, p=lat*R;
 const east=-Math.cos(d)*Math.sin(h);
 const north=Math.cos(p)*Math.sin(d)-Math.sin(p)*Math.cos(d)*Math.cos(h);
 const up=Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(h);
 return {altitude:Math.asin(clamp(up,-1,1))/R,azimuth:(Math.atan2(east,north)/R+360)%360,vector:[east,up,-north]};
}
export const FREE_CLIMB_MPS=35;
export const FREE_CLIMB_FAST_MPS=105;
// Near/far planes follow eye height rather than limiting altitude.
// Units in the renderer are kilometres.
export function walkClipForHeight(eyeM){
 const altitudeKm=Math.max(0,eyeM)/1000;
 return {near:Math.max(.0005,altitudeKm/1200),far:altitudeKm+22,fogDensity:.010/Math.max(1,altitudeKm/18)};
}
export const FREE_WALK_MPS=2.3;
export const FREE_FLY_MPS=35;
export const WALK_SPEED_LEVELS=Object.freeze([.25,.4,.6,.8,1,1.4,2,3,4,6,8]);
export const WALK_SPEED_DEFAULT=4;
export const WALK_SPEED_MAX=8;
export const FLY_SPEED_DEFAULT=WALK_SPEED_LEVELS.length-1;
export const walkSpeedMaxLevel=mode=>mode==='fly'?FLY_SPEED_DEFAULT:WALK_SPEED_MAX;
export function walkVerticalMps(mode,level=WALK_SPEED_DEFAULT,fast=false){
 return mode==='fly'?(fast?FREE_CLIMB_FAST_MPS:FREE_CLIMB_MPS)*(WALK_SPEED_LEVELS[level]??1):0;
}
export function walkHorizontalMps(mode,level=WALK_SPEED_DEFAULT,fast=false){
 const flight=mode==='fly';
 return (flight?FREE_FLY_MPS:FREE_WALK_MPS)*(WALK_SPEED_LEVELS[level]??1)*(fast?(flight?3:2.7):1);
}
export function adjustFreeLook(pose,dx,dy){
 return {...pose,heading:((pose.heading+dx*.17)%360+360)%360,pitch:clamp((pose.pitch||0)-dy*.15,-84,84)};
}
export function stepFreePose(pose, controls, dt, mode, validGround, speedLevel=WALK_SPEED_DEFAULT){
 const t=clamp(Number(dt)||0,0,.10), flying=mode==='fly';
 if(!t||!pose||!validGround(pose.lon,pose.lat))return pose;
 let front=(controls.forward?1:0)-(controls.back?1:0), side=(controls.right?1:0)-(controls.left?1:0);
 const m=Math.hypot(front,side);
 if(m>1){front/=m;side/=m;}
 const speed=walkHorizontalMps(mode,speedLevel,controls.fast)*t;
 const h=pose.heading*R;
 const x=(Math.sin(h)*front+Math.cos(h)*side)*speed;
 const y=(Math.cos(h)*front-Math.sin(h)*side)*speed;
 let lon=pose.lon+x/72_800,lat=pose.lat+y/111_320;
 if(!validGround(lon,lat)){lon=pose.lon;lat=pose.lat;}
 const eyeM=flying?Math.max(WALK_EYE_M,pose.eyeM+((controls.up?1:0)-(controls.down?1:0))*walkVerticalMps(mode,speedLevel,controls.fast)*t):WALK_EYE_M;
 return { ...pose, lon, lat, eyeM };
}
