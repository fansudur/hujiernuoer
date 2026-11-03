// Texture canvas and actual source footprint are different after uniform-canvas export.
// Only the latter may hide the fixed reference backdrop, including its own QA holes.
const validBounds=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3];
export function imageryObservationBounds(image){
 const canvas=image?.bounds_wgs84||image?.bounds||image?.assets?.geographic?.bounds;
 const original=image?.uniform_canvas?.original_source?.bounds||image?.original_bounds||image?.observation_bounds;
 return validBounds(original)?original:validBounds(canvas)?canvas:null;
}
export function imageryRenderSpec(image){
 if(!image)return null;
 const asset=image.assets?.geographic,raw=asset?.path||image.src||image.asset?.path;
 const bounds=image.bounds_wgs84||image.bounds||asset?.bounds;
 if(!raw||!validBounds(bounds))return null;
 const src=raw.startsWith('data/')?raw:(asset?'data/satellite/':'data/spatial/')+raw.split('/').pop();
 return {src,bounds,observationBounds:imageryObservationBounds(image),date:image.date};
}
export function boundsContainPoint(bounds,point){return validBounds(bounds)&&Array.isArray(point)&&point[0]>=bounds[0]&&point[0]<=bounds[2]&&point[1]>=bounds[1]&&point[1]<=bounds[3];}
export function referenceDateLabel(reference){
 const dates=[...new Set(reference?.dates?.filter(Boolean)||[])].sort();
 return dates.length>1?dates[0]+'—'+dates.at(-1):dates[0]||reference?.date||'未载入';
}
export function selectReferenceContext(contexts,terrainBounds,fallback){
 const local=contexts?.local,regional=contexts?.regional;
 if(local&&validBounds(local.bounds_wgs84)&&validBounds(terrainBounds)&&boundsContainPoint(local.bounds_wgs84,[terrainBounds[0],terrainBounds[1]])&&boundsContainPoint(local.bounds_wgs84,[terrainBounds[2],terrainBounds[3]]))return local;
 if(regional&&validBounds(terrainBounds))return regional;
 return local||fallback;
}
export function preferSameDateCoverage(scenes,chosen,{preferOffice=false,officeCoverage=[]}={}){
 if(!chosen)return null;
 const candidates=scenes.filter(s=>s.date===chosen.date);
 const office=new Map(officeCoverage.map(r=>[r.id,r.office_covered===true]));
 return candidates.sort((a,b)=>{
  if(preferOffice){const difference=Number(office.get(b.id)||false)-Number(office.get(a.id)||false);if(difference)return difference;}
  return (b.uniform_canvas?.opaque_fraction||0)-(a.uniform_canvas?.opaque_fraction||0);
 })[0]||chosen;
}
