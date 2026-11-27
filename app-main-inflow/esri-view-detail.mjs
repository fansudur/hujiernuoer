// Pick tiles for the settled camera, using the actual CSS-pixel ground footprint.
import {ATLAS_BOUNDS,BRIDGE_BOUNDS,BRIDGE_ZOOM,DETAIL_ZOOMS,mercatorX,mercatorY,tileWindow} from './esri-atlas-windows.mjs?v=2';

export const DETAIL_TILE_LIMIT=32;
const MAX_REQUESTS=240, MAX_SCENES=5, SETTLE_MS=550;
const clip=(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];
const valid=b=>b[0]<b[2]&&b[1]<b[3];
const tileLat=(y,z)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))*180/Math.PI;
const tileLon=(x,z)=>360*x/2**z-180;

export function planEsriDetail({width,height,ground,pixelRatio=1,bridge=false}){
 if(width<1||height<1)return null;
 const points=[], steps=[];
 const grid=Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>{
  const ll=ground(j*width/4,i*height/4);
  if(!ll?.every(Number.isFinite))return null;
  points.push(ll);
  return [mercatorX(ll[0],1),mercatorY(ll[1],1)];
 }));
 for(let i=0;i<5;i++)for(let j=0;j<5;j++){
  const a=grid[i][j];if(!a)continue;
  for(const [b,pixels] of [[grid[i]?.[j+1],width/4],[grid[i+1]?.[j],height/4]]){
   if(!b)continue;
   const step=Math.hypot(a[0]-b[0],a[1]-b[1])/pixels;
   if(step>0)steps.push(step);
  }
 }
 if(!steps.length)return null; // a view with mostly sky has no reliable scale
 steps.sort((a,b)=>a-b);
 const density=Math.max(1,Math.min(2,pixelRatio));
 const projectedZoom=Math.round(Math.log2(density/(256*steps[Math.floor(steps.length*.30)])));
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const w=Math.min(...xs),e=Math.max(...xs),s=Math.min(...ys),n=Math.max(...ys);
 const footprint=[w-(e-w)*.04,s-(n-s)*.04,e+(e-w)*.04,n+(n-s)*.04];
 const midpoint=[(w+e)/2,(s+n)/2];
 const inBridge=midpoint[0]>=BRIDGE_BOUNDS[0]&&midpoint[0]<=BRIDGE_BOUNDS[2]&&midpoint[1]>=BRIDGE_BOUNDS[1]&&midpoint[1]<=BRIDGE_BOUNDS[3];
 const allowed=bridge===true||(bridge==='focus'&&inBridge)?[BRIDGE_ZOOM,...DETAIL_ZOOMS]:DETAIL_ZOOMS;
 for(const zoom of allowed){
  if(zoom>projectedZoom)continue;
  const area=zoom===BRIDGE_ZOOM?BRIDGE_BOUNDS:ATLAS_BOUNDS;
  const candidate=clip(footprint,area);
  if(!valid(candidate))continue;
  const tile=tileWindow(candidate,zoom);
  const count=(tile.right-tile.left+1)*(tile.bottom-tile.top+1);
  if(count<1||count>DETAIL_TILE_LIMIT||Math.max(tile.right-tile.left,tile.bottom-tile.top)>=12)continue;
  const bounds=clip([tileLon(tile.left,zoom),tileLat(tile.bottom+1,zoom),tileLon(tile.right+1,zoom),tileLat(tile.top,zoom)],area);
  return {zoom,count,bounds,key:[zoom,tile.left,tile.top,tile.right,tile.bottom].join('/'),tile};
 }
 return null;
}

export function createEsriDetailController({context,load,show,revoke=URL.revokeObjectURL}){
 const scenes=new Map(),failed=new Set();
 let timer=null,current=null,revision=0,stamp=null,scope=null,published=null,requested=0,quotaHit=false;
 const publish=scene=>{
  if(published===scene)return;
  published=scene;
  show(scene);
 };
 const cancelTimer=()=>{clearTimeout(timer);timer=null;};
 const arm=()=>{cancelTimer();timer=setTimeout(()=>{timer=null;void settled();},SETTLE_MS);};
 function sync(){
  const ctx=context();
  if(!ctx){
   cancelTimer();current?.abort.abort();
   if(scope!==null)revision++;
   scope=null;stamp=null;publish(null);
   return;
  }
  if(scope===ctx.scope&&stamp===ctx.stamp)return;
  if(scope!==ctx.scope){
   current?.abort.abort();
   // Keep the previous geographic detail when crossing adjacent stops,
   // but not when switching renderer or changing imagery mode.
   if(scope?.[0]!==ctx.scope[0])publish(null);
  }
  scope=ctx.scope;stamp=ctx.stamp;revision++;
  arm();
 }
 async function settled(){
  const ctx=context();
  if(!ctx||scope!==ctx.scope||stamp!==ctx.stamp)return;
  const existing=published&&scenes.get(published.key);
  const plan=planEsriDetail(ctx);
  if(!plan){publish(null);return;}
  const covering=entry=>entry?.zoom===plan.zoom&&entry.tile.left<=plan.tile.left&&entry.tile.right>=plan.tile.right&&entry.tile.top<=plan.tile.top&&entry.tile.bottom>=plan.tile.bottom;
  const cached=(covering(existing)?existing:null)||[...scenes.values()].find(covering);
  if(cached){scenes.delete(cached.scene.key);scenes.set(cached.scene.key,cached);publish(cached.scene);return;}
  if(current||quotaHit||failed.has(plan.key)||requested+plan.count>MAX_REQUESTS)return;
  const mark=revision;
  const request={abort:new AbortController()};
  current=request;requested+=plan.count;
  try{
   const signal=AbortSignal.any([request.abort.signal,AbortSignal.timeout(16000)]);
   const result=await load(plan,signal);
   if(signal.aborted){revoke(result.url);return;}
   const scene={...result,id:'esri-detail-'+plan.key,key:plan.key};
   scenes.set(plan.key,{...plan,scene});
   if(mark===revision&&context()?.stamp===ctx.stamp&&context()?.scope===ctx.scope)publish(scene);
   while(scenes.size>MAX_SCENES){
    const oldest=[...scenes.values()].find(x=>x.scene!==published);
    scenes.delete(oldest.scene.key);revoke(oldest.scene.url);
   }
  }catch(e){
   // No retry loop on a slow network, failed tile, or exhausted daily quota.
   if(e?.status===429)quotaHit=true;
   if(!request.abort.signal.aborted)failed.add(plan.key);
  }finally{
   if(current===request)current=null;
   if(mark!==revision&&context()&&!timer)arm();
  }
 }
 function dispose(){
  cancelTimer();current?.abort.abort();scope=null;stamp=null;publish(null);
  for(const {scene} of scenes.values())revoke(scene.url);
  scenes.clear();
 }
 return {sync,dispose};
}
