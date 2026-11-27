export const WATERWAY_MAP_GROUPS=Object.freeze([
 {id:'wc2-optical-review',label:'圆涵下游 · 同位置影像核查'},
 {id:'archive-routing',label:'旧模型路径 · Wcross1／2、B、C'},
 {id:'wcross-upstream',label:'地方道路 Wcross1／2 · 路西模型段与影像'},
 {id:'wcross-far-west',label:'地方道路 Wcross1／2 · G332 西坡试算（可选）'},
 {id:'owner-blue-201909',label:'2019-09 用户蓝线 · 原图判读草图'},
 {id:'bridge-f1-diag-raw',label:'三八水库中桥 · 桥东肩与老转折：原面停点与填洼对照'},
 {id:'f1-waterway',label:'三八水库桥上下游与主湖西北水路'},
]);
export const W2_ARCHIVED='archive-route-wcross2';
export const W2_OPTICAL_PARTS=Object.freeze(['wc2-review-near','wc2-review-gap','wc2-review-middle','wc2-review-fringe']);
export const DUPLICATE_HOME_PATHS=Object.freeze([
 ['main-profile-west-inlet','archive-route-wcross1'],
 ['main-profile-south-central-inlet','archive-route-c'],
 ['main-profile-southeast-inlet','archive-route-b'],
]);
export const EAST_POOL_ROUTE_REFERENCE='f1-east-pool-shore-ref';
export const EAST_POOL_DATED_REFERENCE='archive-east_pool_2025-09-22_scl6';
export function datedWaterMapLabel(feature){
 if(feature?.id===EAST_POOL_ROUTE_REFERENCE||feature?.id===EAST_POOL_DATED_REFERENCE)return '东池 · 2025-09-22 对照';
 const p=feature?.properties;
 if(p?.layer!=='nearby-pools')return null;
 const match=/^(.*?)\s*·\s*(\d{4}-\d{2}-\d{2})\b/.exec(p.name||'');
 return match?`${match[1].trim()} · ${match[2]} ${p.status==='observed'?'对照':'待核'}`:null;
}
// Archive observations are a separate layer from dated guide references.
const eastArchiveHides = new WeakMap();
export function eastPoolTimelineFrame(month,byId,archive){
 let hiddenIds=eastArchiveHides.get(byId);
 if(!hiddenIds){
  hiddenIds=[EAST_POOL_ROUTE_REFERENCE];
  for(const [id,f] of byId)if(f.properties?.object==='east_pool')hiddenIds.push(id);
  eastArchiveHides.set(byId,hiddenIds);
 }
 const known=Object.hasOwn(archive,month);
 const observation=known?archive[month]:null;
 const label=observation
  ? (observation.areaHa===0?'东池观测窗 · 未检出水面':('东池观测窗 · '+observation.areaHa.toFixed(2)+' ha'))
  : (known?'东池观测窗 · 覆盖不足':'东池观测窗 · 超出档案');
 return {observation,feature:observation?.feature||null,hiddenIds,label};
}
// Same field landmark, carried in several evidence layers. Never merge nearby photos or other evidence by distance.
const landmarkAliases=[
 ['f1-east-bridge-location-ref','nw96-bridge','west-slope-f1-bridge'],
 ...[1,2,3,4].map(n=>['hjn-03-road-pin-0'+n,'nw96-pin'+n]),
];
const emptyHidden=new Set(), memo=new Map();
export function hiddenWaterwayAliases(layers,byId,selected,{scope=null,spoken=null}={}){
 const excluded=[];
 // The dated East Pond reference is available by route selection, narration, or
 // the separate pool scope/layer, but never an anonymous part of the default routes.
 const explicitRoute=selected===EAST_POOL_ROUTE_REFERENCE||spoken?.has(EAST_POOL_ROUTE_REFERENCE);
 if(byId.has(EAST_POOL_ROUTE_REFERENCE)&&!explicitRoute)excluded.push(EAST_POOL_ROUTE_REFERENCE);
 if(explicitRoute&&byId.has(EAST_POOL_ROUTE_REFERENCE)&&byId.has(EAST_POOL_DATED_REFERENCE)
     &&(scope?.has(EAST_POOL_DATED_REFERENCE)||layers.has('nearby-pools')||spoken?.has(EAST_POOL_DATED_REFERENCE))
     &&selected!==EAST_POOL_DATED_REFERENCE){
   excluded.push(EAST_POOL_DATED_REFERENCE);
 } else if(explicitRoute&&selected===EAST_POOL_DATED_REFERENCE)excluded.push(EAST_POOL_ROUTE_REFERENCE);
 // These are verified coincident copies used for different interactions:
 // the exact archive route and the homepage's derived profile have one map stroke.
 if(layers.has('archive-routing'))for(const [profile,archive] of DUPLICATE_HOME_PATHS){
   if(byId.has(profile)&&byId.has(archive))excluded.push(selected===profile?archive:profile);
 }
 if(layers.has('archive-routing')&&layers.has('wc2-optical-review')&&byId.has(W2_ARCHIVED)&&W2_OPTICAL_PARTS.every(id=>byId.has(id))){
   // Explicit archival selection replaces its four display-only cuts.
   if(selected===W2_ARCHIVED)excluded.push(...W2_OPTICAL_PARTS);
   else excluded.push(W2_ARCHIVED);
 }
 for(const ids of landmarkAliases){
   const eligible=ids.map(id=>byId.get(id)).filter(f=>f?.geometry?.type==='Point'&&
      (layers.has(f.properties?.layer)||scope?.has(f.id)||spoken?.has(f.id)));
   const winner=eligible.find(f=>f.id===selected)??eligible.find(f=>spoken?.has(f.id))??eligible[0];
   if(!winner)continue;
   for(const f of eligible)if(f!==winner&&f.geometry.coordinates[0]===winner.geometry.coordinates[0]&&
      f.geometry.coordinates[1]===winner.geometry.coordinates[1])excluded.push(f.id);
 }
 const key=excluded.join('|');
 if(!key)return emptyHidden;
 if(!memo.has(key))memo.set(key,new Set(excluded));
 return memo.get(key);
}
export function setWaterwayMapLayers(current,action,id=null){
 const out=new Set(current);
 const ids=WATERWAY_MAP_GROUPS.map(g=>g.id);
 if(action==='all')for(const g of ids)out.add(g);
 else if(action==='none'||action==='solo'){
   for(const g of ids)out.delete(g);
   if(action==='solo'&&ids.includes(id))out.add(id);
 }
 else if(action==='toggle'&&ids.includes(id)){
   if(out.has(id))out.delete(id);else out.add(id);
 }
 return out;
}
