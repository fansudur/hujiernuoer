// Display conventions only. Raw observations, quality masks and model paths stay unchanged.
export const WATER_BLUE = '#147fd1';
export const WATER_FILL_ALPHA = .42;
export const TRACE_ORANGE = '#f28a18';
const finite = v => typeof v === 'number' && Number.isFinite(v);
export function mapChartTitle(chart){
 if(String(chart.id||'').startsWith('grass-')){const place={N:'北侧',W:'西侧',S:'南侧'}[String(chart.id).slice(-1)]||'';const month=(chart.selectedDate||chart.points?.[0]?.date||'').slice(5,7);return `${place}草地绿度${month?' · '+Number(month)+'月':''}`;}
 return String(chart.title||'').replace(/绿意指数\s*NDVI|NDVI/g,'绿度');
}
export function chartEndpointText(chart){
 const points=chart.points||[], first=points[0], last=points.at(-1),value=p=>finite(p?.value)?p.value.toFixed(chart.decimals??2):'缺测';
 if(!first)return '';
 const date=p=>chart.seasonal?Number(p.date.slice(5,7))+'月':p.date.slice(0,4);
 return `${date(first)} ${value(first)} → ${date(last)} ${value(last)}`;
}
export function chartTimeText(chart){const p=chart.points||[];if(!p.length)return '';return chart.seasonal?'1月 → 12月':`${p[0].date.slice(0,4)} → ${p.at(-1).date.slice(0,4)}年`;}
export function isSameMapPoint(a,b,tolerance=.00003){return !!a&&!!b&&Math.abs(a[0]-b[0])<tolerance&&Math.abs(a[1]-b[1])<tolerance;}
export function hasNativeOfficeLabel(scene){const p=scene.references?.office?.features?.[0]?.geometry?.coordinates;return (scene.nativeLabels||[]).some(l=>l.id==='local-office'||/办公院/.test(l.text||'')&&isSameMapPoint(l.anchor,p));}
// Liang–Barsky display clipping. This rectangle is a reading window, not a catchment boundary.
export function clipRouteToBounds(coords,bounds){
 if(!bounds)return coords.length>1?[coords]:[];
 const [w,s,e,n]=bounds,runs=[];let run=[];
 const same=(a,b)=>a&&b&&Math.abs(a[0]-b[0])<1e-10&&Math.abs(a[1]-b[1])<1e-10;
 for(let i=1;i<coords.length;i++){
  const a=coords[i-1],b=coords[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1,valid=true;
  for(const [p,q] of [[-dx,a[0]-w],[dx,e-a[0]],[-dy,a[1]-s],[dy,n-a[1]]]){if(Math.abs(p)<1e-14){if(q<0){valid=false;break;}}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi){valid=false;break;}}}
  if(!valid){if(run.length>1)runs.push(run);run=[];continue;}
  const at=t=>[a[0]+t*dx,a[1]+t*dy,...(finite(a[2])&&finite(b[2])?[a[2]+t*(b[2]-a[2])]:[])],aa=at(lo),bb=at(hi);
  if(!same(run.at(-1),aa)){if(run.length>1)runs.push(run);run=[aa];}if(!same(run.at(-1),bb))run.push(bb);
  if(hi<1){if(run.length>1)runs.push(run);run=[];}
 }
 if(run.length>1)runs.push(run);return runs;
}
export function readableRunoffRoutes(scene){
 const routes=scene.state?.paths||[],bounds=scene.runoffStudyBounds;
 if(scene.readableRunoffCache?.paths===routes&&scene.readableRunoffCache?.bounds===bounds)return scene.readableRunoffCache.routes;
 const result=routes.flatMap(route=>clipRouteToBounds(route.coordinates||route.geometry?.coordinates||[],bounds).map(coordinates=>({...route,coordinates,displayClipped:!!bounds})));
 scene.readableRunoffCache={paths:routes,bounds,routes:result};return result;
}
export function drawLabelPlate(ctx,text,x,y,{color='#183f50',font='600 11px system-ui',padding=5,maxWidth=Infinity}={}){
 ctx.save();ctx.font=font;const width=Math.min(maxWidth,ctx.measureText(text).width+padding*2);ctx.globalAlpha=1;ctx.fillStyle='#fffffff2';ctx.fillRect(x,y,width,21);ctx.strokeStyle='#173f5033';ctx.lineWidth=1;ctx.strokeRect(x,y,width,21);ctx.fillStyle=color;ctx.textBaseline='middle';ctx.fillText(text,x+padding,y+10.5,Math.max(1,width-padding*2));ctx.restore();return width;
}

// Screen rectangles only: anchors and scientific geometries are never displaced.
export const mapBoxesOverlap=(a,b,gap=4)=>a[0]<b[2]+gap&&a[2]>b[0]-gap&&a[1]<b[3]+gap&&a[3]>b[1]-gap;
export function mapChromeBoxes(w,h){return [[0,0,82,52],[0,h-58,Math.max(90,w*.25+26),h],[w-52,0,w,145]];}
export function placeMapLabel(anchor,width,height,w,h,occupied=[]){
 const clamp=(x,y)=>[Math.max(4,Math.min(w-width-4,x)),Math.max(4,Math.min(h-height-4,y))];
 const candidates=[];
 for(const dy of [-height-5,8,-height-30,34,-height-55,60,-height-80,86]){
  candidates.push(clamp(anchor[0]+8,anchor[1]+dy),clamp(anchor[0]-width-8,anchor[1]+dy));
 }
 for(let y=56;y<h-height-4;y+=height+6)for(const x of [4,w-width-4])candidates.push(clamp(x,y));
 const box=p=>[p[0],p[1],p[0]+width,p[1]+height];
 return box(candidates.find(p=>!occupied.some(q=>mapBoxesOverlap(box(p),q)))||candidates.reduce((best,p)=>occupied.filter(q=>mapBoxesOverlap(box(p),q)).length<occupied.filter(q=>mapBoxesOverlap(box(best),q)).length?p:best));
}
export function focusLabelBox(scene,ctx,w,h,xy){
 const f=scene.focusSpec;if(!f?.anchor||!hasDrawableWaterFocus(scene))return null;
 const [x,y]=xy(f.anchor);if(x<0||x>w||y<0||y>h)return null;
 ctx.save();ctx.font='600 12px system-ui';const tw=Math.min(w-20,ctx.measureText(f.label||'当前讲解主体').width+18);ctx.restore();
 const bx=Math.max(8,Math.min(w-tw-8,x+18)),by=Math.max(20,Math.min(h-35,y-23));return [bx,by,bx+tw,by+25];
}

export function previewMapReadability(){return !!globalThis.document?.body?.classList?.contains('lake-design-preview');}

export function hasDrawableWaterFocus(scene){
 const f=scene.focusSpec;
 return !previewMapReadability()||scene.state?.theme!=='shore'||!(f?.layers||[]).includes('water')||!!scene.state?.water?.features?.some(feature=>['Polygon','MultiPolygon'].includes(feature.geometry?.type)&&feature.geometry.coordinates?.length);
}

// Editorial labels only. The office remains an imagery/user reference, not a survey.
export const OFFICE_MAP_LABEL='办公院 · 用户指认';
export function officeMapLabel(){return previewMapReadability()?OFFICE_MAP_LABEL:'办公院参照';}
export function nativeMapLabel(label,id){return previewMapReadability()&&id==='local-office'?OFFICE_MAP_LABEL:label;}
export function selectMapLabels(scene,labels,{spanKm}={}){
 if(!previewMapReadability()||scene.nativeSpatial?.stage!=='runoff'||labels.length<=5)return labels;
 const span=spanKm??((scene.bounds?.[2]-scene.bounds?.[0])*111.32*Math.cos(49.14*Math.PI/180)/(scene.topView?.zoom||1));
 if(span<=2.5)return labels;
 const priorities=['local-office','inflow-upstream_swale','inflow-pool_bowl','local-Ncross','inflow-downstream_band'];
 const selected=scene.focusSpec?.id==='selected-object'?scene.focusSpec.feature_ids?.[0]:null;
 const ranked=[...labels].sort((a,b)=>{
  const rank=id=>id===selected?-1:priorities.includes(id)?priorities.indexOf(id):99;
  return rank(a.id)-rank(b.id);
 });
 const keep=new Set(ranked.slice(0,5));return labels.filter(l=>keep.has(l));
}
