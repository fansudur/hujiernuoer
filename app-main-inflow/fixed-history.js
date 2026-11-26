export const FIXED_HISTORY_SCHEMA = 'hjn-google-earth-history/v1';
const coord = p => Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90;
const usableFootprint = f => {
  const rings=Array.isArray(f)?f:f?.type==='Polygon'?f.coordinates:null;
  return Array.isArray(rings) && rings.length>0 && rings.every(r=>Array.isArray(r)&&r.length>=4&&r.every(coord)&&r[0].every((v,i)=>v===r.at(-1)[i]));
};
const text=v=>typeof v==='string'&&v.trim().length>0;
export function validateFixedHistory(doc,demBounds,existing = {}) {
  if(doc?.schema!==FIXED_HISTORY_SCHEMA || !Array.isArray(doc.scenes) || !doc.scenes.length
    || !Array.isArray(demBounds) || demBounds.length!==4) throw new Error('未找到有效的本机历史影像清单');
  const ids=new Set();
  return doc.scenes.map(r=>{
    const fileRe=/^(?:google-earth-history\/)?([A-Za-z0-9][A-Za-z0-9_-]*\.(?:png|jpe?g|webp))$/i;
    const match=typeof r?.imagePath==='string' && r.imagePath.match(fileRe);
    const credit=typeof r?.attributionImagePath==='string' && r.attributionImagePath.match(fileRe);
    const bounds=Array.isArray(r?.bounds_wgs84)&&r.bounds_wgs84.length===4&&r.bounds_wgs84.every((v,i)=>Number.isFinite(v)&&Math.abs(v-demBounds[i])<1e-8);
    const date=r?.sourceDate || '';
    if(!r || !/^[-a-zA-Z0-9_]+$/.test(r.id||'') || ids.has(r.id) || Object.hasOwn(existing,r.id)
      || !text(r.title) || !text(r.zone) || !text(r.registrationNote) || !text(r.attribution)
      || !/^$|^\d{4}-\d{2}-\d{2}$/.test(date) || !match || !bounds || !usableFootprint(r.sourceFootprint)
      || !/^[0-9a-f]{64}$/i.test(r.sha256||'')) throw new Error('影像注册信息不完整或范围不匹配');
    ids.add(r.id);
    return {...r,sourceDate:date,url:new URL('./google-earth-history/'+match[1],import.meta.url).href,
      creditUrl:credit ? new URL('./google-earth-history/'+credit[1],import.meta.url).href : null};
  });
}
export function historySceneMonth(scene) {
  // Source acquisition overrides a differing file label if known.
  const raw=scene.sourceDate ? scene.sourceDate.slice(0,7)
    : String(scene.sourceLabel||'').match(/^\d{4}-\d{2}(?=\D|$)/)?.[0];
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(raw||'') ? raw : null;
}
// Display only: preserve registry order for same-month playback preference.
export function historyMenuEntries(scenes) {
  const byText = (a,b) => a===b ? 0 : a<b ? -1 : 1;
  return scenes.map(scene=>{
    const month=historySceneMonth(scene);
    const date=month && scene.sourceDate ? scene.sourceDate : null;
    return {scene, year:month?.slice(0,4)||'日期未核',
      label:date || (month ? month+'（文件标记）' : '日期未核'),
      key:date || (month ? month+'-~' : '~')};
  }).sort((a,b)=>byText(a.key,b.key)||byText(a.scene.zone,b.scene.zone)||byText(a.scene.id,b.scene.id));
}
export const isBroadHistoryScene = scene => scene?.scope==='broad';
export function broadHistoryMonths(scenes=[]) {
  return [...new Set(scenes.filter(isBroadHistoryScene).map(historySceneMonth).filter(Boolean))].sort();
}
export function exactGoogleEarthMonth(date,scenes,preferredZone=null) {
  const fits=scenes.filter(s=>historySceneMonth(s)===date);
  const wide=fits.filter(isBroadHistoryScene);
  const same=wide.length?wide:fits;
  return same.find(s=>s.preferredMonthView===true)||same.find(s=>s.zone===preferredZone)||same.find(s=>/^03\b/.test(s.zone))||same[0]||null;
}
export function loadHistoryImage(scene,{ImageClass=Image,timeoutMs=7000,signal}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new Error('影像请求已取消'));return;}
    const im=new ImageClass();
    const timer=setTimeout(()=>end(false),timeoutMs);
    const onAbort=()=>end(false);
    signal?.addEventListener('abort',onAbort,{once:true});
    function end(ok){
      signal?.removeEventListener('abort',onAbort);
      clearTimeout(timer);
      im.onload=im.onerror=null;
      if(ok&&im.naturalWidth>0)resolve(scene);
      else reject(new Error('本机历史影像未能解码'));
    }
    im.onload=()=>end(true);
    im.onerror=()=>end(false);
    im.src=scene.url;
  });
}
