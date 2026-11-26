export const TOUR_IDS=Object.freeze(['opening','runoff','history','road','corridor-to-lake','east-water','road-context','lake-inflow','closing']);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const dist=(a,b)=>Math.hypot((b[0]-a[0])*72800,(b[1]-a[1])*111320);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function softenedTravelProgress(value) {
 const t=clamp(value,0,1), edge=.14;
 const rise=u=>u**3-.5*u**4;
 if(t<edge)return edge*rise(t/edge)/(1-edge);
 if(t>1-edge)return 1-edge*rise((1-t)/edge)/(1-edge);
 return (t-edge/2)/(1-edge);
}
// Camera-only centripetal spline: archive/display lines remain unchanged.
const xScale=72800,yScale=111320;
const merge=(a,b,f)=>a.map((v,k)=>v+(b[k]-v)*f);
const norm=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const makeCounterpart=(origin,other)=>origin.map((v,k)=>2*v-other[k]);
function crPoint(a,b,c,d,t){
 const t0=0,t1=Math.sqrt(Math.max(1e-5,norm(a,b))),t2=t1+Math.sqrt(Math.max(1e-5,norm(b,c))),t3=t2+Math.sqrt(Math.max(1e-5,norm(c,d)));
 const u=t1+(t2-t1)*t;
 const mix=(m,n,l,h)=>merge(m,n,(u-l)/(h-l));
 const A=mix(a,b,t0,t1),B=mix(b,c,t1,t2),C=mix(c,d,t2,t3);
 return mix(mix(A,B,t0,t2),mix(B,C,t1,t3),t1,t2);
}
const signedYaw=(a,b)=>((b-a+540)%360)-180;
export function buildCinematicTrack(coords){
 const [ox,oy]=coords[0], linear=coords.map(([x,y])=>[(x-ox)*xScale,(y-oy)*yScale]);
 const raw=linear.filter((p,i)=>i===0||norm(p,linear[i-1])>.10);
 if(raw.length<2)return null;
 const out=[raw[0]], chain=[0];
 for(let i=0;i<raw.length-1;i++){
  const b=raw[i],c=raw[i+1],len=norm(b,c);
  const a=raw[i-1]||makeCounterpart(b,c),d=raw[i+2]||makeCounterpart(c,b);
  const tabs=Math.max(6,Math.ceil(len/3));
  for(let k=1;k<=tabs;k++){
   const t=k/tabs;
   let p=crPoint(a,b,c,d,t);
   // Bound off-corridor drift smoothly; this only limits camera position, not road shape.
   const x=[c[0]-b[0],c[1]-b[1]],u=clamp(((p[0]-b[0])*x[0]+(p[1]-b[1])*x[1])/(len*len),0,1);
   const seg=merge(b,c,u), gap=norm(seg,p), bound=Math.min(18,len*.32);
   if(gap>.001)p=merge(seg,p,Math.tanh(gap/bound)*bound/gap);
   if(k===tabs)p=c;
   const delta=norm(out.at(-1),p);
   if(delta>1e-4){chain.push(chain.at(-1)+delta);out.push(p);}
  }
 }
 const length=chain.at(-1);
 const at=m=>{
  const d=clamp(m,0,length);
  let lo=0,hi=chain.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(chain[mid]<d)lo=mid;else hi=mid;}
  return merge(out[lo],out[hi],(d-chain[lo])/(chain[hi]-chain[lo]));
 };
 const yawAt=m=>{
  const weighted=[-55,-28,0,28,55].map((off,k)=>{
   const start=at(m+off-Math.min(96,length*.35)),stop=at(m+off+Math.min(185,length*.6));
   const den=norm(start,stop), weight=[1,2,3,2,1][k];
   return den>.01?[(stop[0]-start[0])*weight/den,(stop[1]-start[1])*weight/den]:[0,0];
  });
  return (Math.atan2(weighted.reduce((a,p)=>a+p[0],0),weighted.reduce((a,p)=>a+p[1],0))*180/Math.PI+360)%360;
 };
 const xy=m=>{const [x,y]=at(m);return [ox+x/xScale,oy+y/yScale];};
 // Fixed-distance yaw table, independent from video frame rate.
 const stride=6, count=Math.max(2,Math.ceil(length/stride));
 const yaws=Array.from({length:count+1},(_,i)=>yawAt(length*i/count));
 const position=m=>{
  const k=clamp(m,0,length)/length*count,lo=Math.min(yaws.length-2,Math.floor(k));
  const [lon,lat]=xy(m);
  return {lon,lat,heading:(yaws[lo]+signedYaw(yaws[lo],yaws[lo+1])*(k-lo)+360)%360};
 };
 return {length,position};
}

export function buildCinematicHeightProfile(track, ground, {scale=8, eyeM=325,clearanceM=125}={}){
 if(!track)return null;
 const count=Math.max(3,Math.ceil(track.length/8)), stride=track.length/count;
 const nodes=Array.from({length:count+1},(_,i)=>{
  const p=track.position(i*stride), z=ground(p.lon,p.lat);
  return Number.isFinite(z)?z*scale:null;
 });
 const elevations=nodes.map((z,i)=>{
  if(z===null)return null;
  let total=0,weight=0;
  for(let k=-11;k<=11;k++){
    const v=nodes[clamp(i+k,0,count)],w=Math.exp(-.5*(k/4)**2);
    if(v!==null){total+=v*w;weight+=w;}
  }
  // Clearance stays independent from vertical extrapolation and from regular terrain settings.
  return Math.max(z+clearanceM,total/Math.max(weight,1e-6)+eyeM);
 });
 return (m,groundNow)=>{
  const q=clamp(m/stride,0,count),i=Math.min(count-1,Math.floor(q));
  if(elevations[i]===null||elevations[i+1]===null||!Number.isFinite(groundNow))return eyeM;
  const target=elevations[i]+(elevations[i+1]-elevations[i])*(q-i);
  return Math.max(clearanceM,target-groundNow*scale);
 };
}

export function normalizeGuidedTours(raw,featureById){
 if(raw?.schema!=='hjn-guided-tours/v1'||raw?.tours?.length!==TOUR_IDS.length)throw Error('导览清单缺失');
 const text=s=>typeof s==='string'&&s.trim().length>0;
 return TOUR_IDS.map(id=>{
  const t=raw.tours.find(r=>r.id===id);
  if(!text(t?.title)||!text(t?.summary)||!Array.isArray(t.steps)||t.steps.length<(['opening','closing','corridor-to-lake'].includes(id)?1:2))throw Error('导览元数据缺失 '+id);
  const steps=t.steps.map(step=>{
   if(!text(step.id)||!text(step.title)||!text(step.body)||!text(step.source)||!text(step.status)||!['travel','station','gap'].includes(step.kind))throw Error('导览段说明缺失');
   if(step.kind==='gap'){if(step.geometry||step.featureId)throw Error('缺口不得登记移动几何');return {...step,duration:0};}
   const f=featureById.get(step.featureId);
   if(step.featureId&&!f)throw Error('缺少已归档对象 '+step.featureId);
   const geom=step.geometry||f?.geometry;
   if(!geom)throw Error('缺少导览坐标');
   const numeric=(val,d,l,h)=>Number.isFinite(val)?clamp(val,l,h):d;
   // Aerial viewing only; do not rewrite the archived geometries, captions, or voice manifest.
   const aerial=step.eyeM>=800?[step.eyeM,step.pitch]:id==='road' ? [step.kind==='travel'?114:360,step.kind==='travel'?-10:-25]
    : id==='runoff' ? [step.kind==='travel'?265:step.id==='runoff-bridge'?360:Math.max(275,step.eyeM||0),step.kind==='travel'?-18:step.id==='runoff-bridge'?-23:-60]
    : id==='lake-inflow' ? [step.kind==='travel'?650:275,step.kind==='travel'?-61:-62]
    : [step.sceneId?405:285,-58];
   const options={...step,eyeM:numeric(step.camera?.eyeM,aerial[0],80,7500),pitch:numeric(step.camera?.pitch,aerial[1],-80,-7),
    duration:numeric(step.duration,step.kind==='travel'?16:10,4,id==='road'?120:60)};
   if(step.kind==='travel'){
    if(geom.type!=='LineString'||!Array.isArray(geom.coordinates)||geom.coordinates.length<2||!geom.coordinates.every(point))throw Error('移动必须沿一条已登记线段');
    const coordinates=geom.coordinates;
    const chain=[0];
    for(let i=1;i<coordinates.length;i++)chain[i]=chain[i-1]+dist(coordinates[i-1],coordinates[i]);
    if(chain.at(-1)<2)throw Error('移动线段无距离');
    return {...options,coordinates,chain,length:chain.at(-1),cameraTrack:buildCinematicTrack(coordinates)};
   }
   const target=step.center|| (geom.type==='Point'?geom.coordinates:null);
   if(!point(target))throw Error('站点必须提供明确中心点');
   return {...options,target,heading:numeric(step.heading,0,-360,720)};
  });
  if(new Set(steps.map(s=>s.id)).size!==steps.length)throw Error('站点 ID 重复');
  return {...t,steps};
 });
}
export function sampleGuidedTour(step,fraction){
 if(step.kind==='gap')return null;
 if(step.kind==='station')return {lon:step.target[0],lat:step.target[1],heading:step.heading,pitch:step.pitch,eyeM:step.eyeM,site:'guided'};
 const n=step.chain.length;
 const at=m=>{
  const d=clamp(m,0,step.length);
  let lo=0,hi=n-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(step.chain[mid]<d)lo=mid;else hi=mid;}
  const r=(d-step.chain[lo])/Math.max(1e-9,step.chain[hi]-step.chain[lo]);
  return step.coordinates[lo].map((v,k)=>v+(step.coordinates[hi][k]-v)*r);
 };
 const s=(step.markRoad||step.featureId==='secondary-way-162036946'?softenedTravelProgress(fraction):clamp(fraction,0,1))*step.length,[lon,lat]=at(s);
 const road=step.markRoad||step.featureId==='secondary-way-162036946';
 // Use a long road chord rather than a single vertex tangent. End-of-leg still stays on the original line.
 const back=road?Math.min(75,step.length*.32):Math.min(28,step.length*.24);
 const ahead=road?Math.min(165,step.length*.58):back;
 const a=at(s-back),b=at(s+ahead);
 const heading=(Math.atan2((b[0]-a[0])*72800,(b[1]-a[1])*111320)*180/Math.PI+360)%360;
 return {lon,lat,heading,pitch:step.pitch,eyeM:step.eyeM,site:step.markRoad?'road':'guided'};
}
