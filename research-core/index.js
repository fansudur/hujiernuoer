/** Framework-neutral data access. No DOM, window, Three.js or renderer state. */
export const CONTRACT_VERSION = 'lake-research-contract/1.0';
const defaultBase = new URL('../', import.meta.url);
export async function readResearchJSON(path, {baseUrl=defaultBase,fetchImpl=globalThis.fetch}={}) {
  if (typeof fetchImpl !== 'function') throw new Error('Supply a fetch-compatible function in this runtime.');
  const response = await fetchImpl(new URL(path, baseUrl));
  if (!response.ok) throw new Error(`Research asset failed: ${path} (${response.status})`);
  return response.json();
}
export function createResearchClient({baseUrl=defaultBase,fetchImpl=globalThis.fetch,catalog=null}={}) {
  const cache=new Map();
  const read=path=>{if(!cache.has(path))cache.set(path,readResearchJSON(path,{baseUrl,fetchImpl}).catch(e=>{cache.delete(path);throw e;}));return cache.get(path);};
  const getCatalog=()=>catalog?Promise.resolve(catalog):read('research-core/catalog.json');
  return Object.freeze({catalog:getCatalog,async dataset(id){const c=await getCatalog(),entry=c.datasets.find(d=>d.id===id);if(!entry)throw new Error(`Unknown research dataset: ${id}`);return {descriptor:entry,data:await read(entry.path)};},clearCache(){cache.clear();}});
}
export function selectSameMonthPoints(points,month,{includeAnnual=false,startYear=-Infinity,endYear=Infinity}={}) {
  const m=Number(month);if(!Number.isInteger(m)||m<1||m>12)throw new RangeError('month must be 1..12');
  return points.filter(p=>{const d=String(p.date),y=Number(d.slice(0,4));return y>=startYear&&y<=endYear&&(d.length===4?includeAnnual:/^\d{4}-\d{2}(?:-\d{2})?$/.test(d)&&Number(d.slice(5,7))===m);});
}
export function selectExactDate(records,date,{dateKey='date'}={}) {return records.find(r=>r[dateKey]===date)??null;}
export function findPixelSeason(records,featureId,year,season) {
  if(!['summer','late_spring_early_summer'].includes(season))return null;
  return records.find(r=>r.feature_id===featureId&&r.year===Number(year)&&r.season===season)??null;
}
export function pixelSeasonDifference(records,featureId,year,season,referenceYear=Number(year)-1) {
  const current=findPixelSeason(records,featureId,year,season),reference=findPixelSeason(records,featureId,referenceYear,season);
  return {current,reference,value:Number.isFinite(current?.value)&&Number.isFinite(reference?.value)?current.value-reference.value:null,unit:'NDVI',comparison:'same pixel, same season, explicit years'};
}
export function featureById(collection,id) {return collection.features.find(f=>f.properties?.id===id||f.id===id)??null;}
export function featuresForStage(collection,stage) {return collection.features.filter(f=>(f.properties?.stages||[]).includes(stage));}
export function compareExactDates(left,right,{startDate='',endDate='9999',qualifiedOnly=false}={}) {
  const byDate=new Map(right.map(p=>[p.date,p]));
  return left.filter(p=>p.date>=startDate&&p.date<=endDate&&byDate.has(p.date)).map(p=>{const q=byDate.get(p.date);const valid=Number.isFinite(p.value)&&Number.isFinite(q.value)&&(!qualifiedOnly||(p.qualified===true&&q.qualified===true));return {date:p.date,left:p,right:q,comparable:valid,difference:valid?q.value-p.value:null};});
}
export function missingState(record,key='value') {return !record?'absent':record[key]===null||record[key]===undefined?'missing':typeof record[key]==='number'&&!Number.isFinite(record[key])?'invalid':record[key]===0?'observed_zero':'present';}

/** Exact monthly classification: qualified zero is not an unavailable observation. */
export function selectNeighborMonth(index,water,nodata,date) {
  return ['N1','N2','S1'].map(window=>{
    const observation=index.observations.find(r=>r.window===window&&r.date===date)??null;
    const qualified=observation?.qualified_both_denominators===true&&observation?.geometry_available===true;
    return {window,date,observation,status:!qualified?'unavailable':observation.observed_zero?'observed_zero':'observed_water',water:qualified&&observation.water_feature_id?featureById(water,observation.water_feature_id):null,nodata:qualified&&observation.nodata_feature_id?featureById(nodata,observation.nodata_feature_id):null};
  });
}
