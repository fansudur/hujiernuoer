import { WATERWAY_MAP_GROUPS } from './waterway-map-policy.js';

export const WATERWAY_PANEL='waterway';
export const ROUTE_DEEP_LINK='water-routes';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(v);
const txt=v=>typeof v==='string'&&v.trim().length>0;
const links=v=>[...new Set((Array.isArray(v)?v:[]).filter(slug))];
export const routePhotoId=v=>/^field-photo-\d{4}$/.test(v||'')?v:/^(?:IMG_)?\d{4}(?:\.JPG)?$/i.test(v||'')?'field-photo-'+v.match(/\d{4}/)[0]:null;
const archiveIds=['f1-waterway-chain','wc2-downstream-review'];
const accessLabels=Object.freeze({southeast:'东南同位月检',cases:'水面与地形样例',history:'历史纸图与线索'});
const accessIds=v=>links(v).filter(id=>Object.hasOwn(accessLabels,id));

// Waterway items open existing stations, without starting playback.
export const ROUTE_GUIDE_MAP=Object.freeze({
  "lake-profiles": [{"target": "lake-west", "label": "西侧分区与剖面"}, {"target": "road-c-south-central", "label": "南中分区与剖面"}, {"target": "road-b-southeast", "label": "东南分区与剖面"}],
  "office": [{"target": "lake-office-caution", "label": "中桥、03 道路与主湖合图"}],
  "round": [{"target": "road-round", "label": "地方路圆涵"}],
  "north-preserve": [{"target": "runoff-main-entrance-context", "label": "西长湖与桥东分流对照"}],
  "west-slope": [{"target": "runoff-upper-slope", "label": "西北坡大沟壑"}],
  "bridge": [{"target": "runoff-bridge", "label": "三八水库中桥"}],
  "east-apron": [{"target": "runoff-bend-gap", "label": "桥东旧转折"}],
  "village-in": [{"target": "runoff-se", "label": "村北低槽"}],
  "village-rims": [{"target": "kmz-north-to-crossings", "label": "01、03 上游来路"}],
  "four-pins": [{"target": "road-nw-gully", "label": "03 道路四个现场点"}],
  "main-nw": [{"target": "runoff-main-entrance-context", "label": "共同弯槽与主湖西北岸"}],
  "ne-fades": [{"target": "east-marsh-source", "label": "东部泥沼"}],
  "ne-model": [{"target": "east-pool-source", "label": "东池候选来水"}],
  "westlake-old-guess": [{"target": "runoff-main-entrance-context", "label": "西长湖来水线索"}],
});

export function validateWaterwayOverview(doc){
 if(doc?.schema!=='hjn-route-narrative/v1'||!txt(doc.title)||!Array.isArray(doc.sections)||!doc.sections.length)throw new Error('水路总览清单不可用');
 const groups=new Set(),ids=new Set(),allFeatures=new Set();
 const sections=doc.sections.map(g=>{
  if(!slug(g?.id)||groups.has(g.id)||!txt(g.title)||!Array.isArray(g.items)||!g.items.length)throw new Error('水路分支资料不完整');
  groups.add(g.id);
  if(g.leadItemId!=null&&!g.items.some(i=>i?.id===g.leadItemId))throw new Error('首个段落不属于本分支');
  return {...g,items:g.items.map(item=>{
    if(!slug(item?.id)||ids.has(item.id)||!txt(item.title)||!txt(item.body))throw new Error('水路证据项内容不完整');
    ids.add(item.id);
    const featureIds=links(item.featureIds);
    if(item.focusFeatureId!=null&&!featureIds.includes(item.focusFeatureId))throw new Error('地图焦点不属于本段');
    for(const id of featureIds)allFeatures.add(id);
    return {...item,featureIds,compareLinks:(Array.isArray(item.compareLinks)?item.compareLinks:[]).filter(link=>featureIds.includes(link?.featureId)&&txt(link?.label)),focusFeatureId:item.focusFeatureId??featureIds[0]??null,profileIds:links(item.profileIds),
       photos:[...new Set((Array.isArray(item.photos)?item.photos:[]).map(routePhotoId).filter(Boolean))],
       imageryIds:links(item.imageryIds),crossAccess:accessIds(item.crossAccess),sources:(Array.isArray(item.sources)?item.sources:[]).filter(s=>txt(s?.label)&&txt(s?.ref))};
  })};
 });
 const readingOrder=links(doc.readingOrder);
 if(readingOrder.some(id=>!groups.has(id)))throw new Error('主湖阅读顺序含不存在的分支');
 const mainEntries=Array.isArray(doc.mainEntries)?doc.mainEntries:[];
 if(mainEntries.some(e=>!allFeatures.has(e?.featureId)||!txt(e.label))||new Set(mainEntries.map(e=>e.featureId)).size!==mainEntries.length)throw new Error('主湖入口位置未通过对账');
 return {...doc,sections,readingOrder:[...readingOrder,...[...groups].filter(id=>!readingOrder.includes(id))],mainEntries,crossAccess:accessIds(doc.crossAccess),archiveEvidenceIds:[...new Set([...archiveIds,...links(doc.archiveEvidenceIds)])]};
}

const statusName={observed:'影像或现场观察',candidate:'待核',gap:'证据缺口',modeled:'地形模型',context:'定位参照',field:'现场记录',mixed:'观测与待核','visible-morphology':'可见地貌','model-only':'模型条件'};

function itemTaxonomy(it){
  const st=String(it.status||'');
  if((it.photos||[]).length>0 || /现场识别|现场记录/.test(st)) return { key:'photo', sym:'◉', label:'实拍' };
  if(/历史假设|草图/.test(st)) return { key:'sketch', sym:'✎', label:'手绘' };
  if(/地形模型|地形参照|model/.test(st)) return { key:'model', sym:'┄', label:'模型' };
  if(/待现场核查|缺口|待核/.test(st)) return { key:'gap', sym:'×', label:'待核缺口' };
  return { key:'landform', sym:'●', label:'影像地貌' };
}

const niceScene=id=>{
 const m=/^ge-(root|0[1-4])-(\d{4})(\d{2})(.*)$/.exec(id);
 if(!m)return id;
 const zones={root:'全景','01':'三八水库中桥','02':'圆涵与主湖西岸','03':'办公院与西北岸','04':'北小湖近景'};
 const variant=m[4]?(m[4].startsWith('detail')?' · 冬季近景'+m[4].slice(6):' · 备选 '+m[4].replace(/^-/ ,'')):'';
 return m[2]+'-'+m[3]+' · '+zones[m[1]]+variant;
};

export function renderWaterwayOverview(doc,byId,{branch=null,item=null,result='',mapLayers=null,mapDetailsOpen=false,slopeCluesReady=false,slopeCanLocate=true}={}){
 const lookup=new Map((doc?.sections||[]).map(s=>[s.id,s]));
 const sections=(doc?.readingOrder||[...lookup.keys()]).map(id=>lookup.get(id)).filter(Boolean);
 const section=lookup.get(branch)??sections[0];
 const btn=(action,id,label,variant='',extra='')=>'<button type="button" class="mini-pill'+(variant?' '+variant:'')+'" data-route-action="'+action+'" data-route-target="'+esc(id)+'"'+extra+'>'+esc(label)+'</button>';
 const title=id=>/^archive-route-wcross[12]$/.test(id)?('Wcross'+id.at(-1)+' 全段视野（保留断口）'):(byId.get(id)?.properties?.name||id);
 const actual=(ids,action)=>(ids||[]).filter(id=>byId.has(id)).map(id=>btn(action,id,title(id))).join('');
 const fold=(name,content,kind)=>content?'<details class="ed-fold" data-route-evidence-kind="'+kind+'"><summary>'+esc(name)+'</summary><div class="ev-links">'+content+'</div></details>':'';
 const cross=(keys)=>accessIds(keys).map(id=>btn('archive',id,accessLabels[id])).join('');
 const extraAccess=accessIds(doc?.crossAccess);
 const sketch=id=>{const p=byId.get(id)?.properties||{};return p.feature_role==='owner_blue_sketch'||p.status==='owner_sketch_hypothesis_not_observed'||/^sketch-|^owner-.*-blue-/.test(id);};
 const model=id=>{const p=byId.get(id)?.properties||{};return /model|scenario|search_window|terrain_only|alternative_dsm|catchment/i.test([p.status,p.feature_role,p.layer].join(' '));};
 const mainLinks=(doc?.mainEntries||[]).filter(e=>byId.has(e.featureId)).map(e=>btn('feature',e.featureId,e.label,'accent-pill',' data-route-main-entry')).join('');

 const renderItem=it=>{
  const focus=[it.focusFeatureId,...(it.featureIds||[])].find(id=>id&&byId.has(id));
  const rest=(it.featureIds||[]).filter(id=>id!==focus&&byId.has(id));
  const models=rest.filter(id=>!sketch(id)&&model(id)), sketches=rest.filter(sketch), places=rest.filter(id=>!sketch(id)&&!model(id));
  const placeLinks=actual(places,'feature'),modelLinks=actual(models,'feature');
  const compareLinks=(it.compareLinks||[]).filter(link=>byId.has(link.featureId)).map(link=>btn('feature',link.featureId,link.label)).join('');
  const tax=itemTaxonomy(it);
  const narLinks=(ROUTE_GUIDE_MAP[it.id]||[]).map(n=>btn('guide',n.target,'导览 · '+n.label,'guide-link-pill')).join('');
  const imgCount=(it.imageryIds||[]).length;
  const photoCount=(it.photos||[]).filter(id=>byId.has(id)).length;
  const profCount=(it.profileIds||[]).filter(id=>byId.has(id)).length;
  const officeGapNote=it.id==='office'
    ? '<div class="office-gap-banner"><strong>办公院出水口未确认：</strong>图上保留断口，原地形与填洼线仅为 30m 模型对照。</div>'
    : '';

  return `<article class="ed-item ${item===it.id?'active':''}" data-route-item="${esc(it.id)}" data-item-tax="${tax.key}">
   <div class="ed-item-head">
     <h3 class="ed-item-title">${esc(it.title)}</h3>
     <span class="ed-tax-meta" title="${esc(statusName[it.status]||it.status||tax.label)}"><i class="ed-tax-sym ${tax.key}">${tax.sym}</i>${esc(tax.label)}</span>
   </div>
   <p class="ed-body">${esc(it.body)}</p>
   ${officeGapNote}
   <div class="ww-direct-bar">
     ${focus?btn('feature',focus,focus===it.focusFeatureId&&txt(it.focusLabel)?it.focusLabel:'定位：'+title(focus),'accent-pill',' data-route-primary'):''}
     ${narLinks}
   </div>
   <div class="ed-fold-group">
   ${compareLinks?'<nav class="ev-links" aria-label="分别定位缺口两段（不表示相接）" data-route-gap-links>'+compareLinks+'</nav>':''}
     ${fold('历史影像 · '+imgCount,it.imageryIds.map(id=>btn('imagery',id,niceScene(id))).join(''),'imagery')}
     ${fold('现场实拍 · '+photoCount,actual(it.photos,'photo'),'photos')}
     ${fold('地形剖面 · '+profCount,actual(it.profileIds,'profile'),'profiles')}
     ${fold('模型对照',modelLinks,'models')}
     ${fold('手绘草图（假设）',actual(sketches,'feature'),'sketches')}
     ${fold('其他位置',placeLinks,'places')}
     ${fold('继续核对',cross(it.crossAccess),'cross-access')}
     ${it.sources.length?'<details class="ed-fold"><summary>来源与口径</summary><div class="tech-source-list">'+it.sources.map(s=>'<div><span>'+esc(s.label)+'</span> <code>'+esc(s.ref)+'</code></div>').join('')+'</div></details>':''}
   </div>
  </article>`;
 };

 const mapOnCount=WATERWAY_MAP_GROUPS.filter(x=>mapLayers?.has(x.id)).length;

 return `
 <header class="ed-intro">
  <div class="ed-kicker"><span>主湖来水路线</span><span>4 分支 · 14 节点</span></div>
  <h2 class="ed-h2">${esc(doc?.title||'水路总览')}</h2>
  <p class="ed-lead">${esc(doc?.summary||'水路总览资料未载入，仍可查看原证据。')}</p>
  <div class="ww-tax-key" aria-label="四类证据图元速辨">
    <span class="ed-tax-meta"><i class="ed-tax-sym photo">◉</i>实拍</span>
    <span class="ed-tax-meta"><i class="ed-tax-sym model">┄</i>模型</span>
    <span class="ed-tax-meta"><i class="ed-tax-sym sketch">✎</i>手绘</span>
    <span class="ed-tax-meta"><i class="ed-tax-sym gap">×</i>待核缺口</span>
  </div>
  ${mainLinks?'<nav class="ev-links ed-entry-links" aria-label="主湖三处入口定位">'+mainLinks+'</nav>':''}
  <p class="card-note ed-live-result" data-waterway-result aria-live="polite">${esc(result)}</p>

  <details class="ed-fold ed-layer-ctrl" data-waterway-map-details ${mapDetailsOpen?'open':''}>
   <summary><span>七组水路图层控制</span><span class="ed-fold-stat" data-waterway-map-count>${mapOnCount}／7 已开启</span></summary>
   <div class="ev-links" style="margin:6px 0">
    <button type="button" class="mini-pill accent-pill" data-waterway-map-action="all">全部开启</button>
    <button type="button" class="mini-pill" data-waterway-map-action="none">全部关闭</button>
   </div>
   <div class="ww-layer-list">${WATERWAY_MAP_GROUPS.map(g=>`<div class="ww-layer-row" data-waterway-map-row="${g.id}"><label class="ww-layer-chk"><input type="checkbox" data-waterway-map-action="toggle" data-waterway-map-group="${g.id}" ${mapLayers?.has(g.id)?'checked':''}><span>${esc(g.label)}</span></label><button type="button" class="mini-pill" data-waterway-map-action="solo" data-waterway-map-group="${g.id}" aria-label="七组中只看：${esc(g.label)}">只看</button></div>`).join('')}</div>
   <p class="card-note">Wcross2 影像核查与旧模型线同开时不重复画；只切图层，不改水面月份。</p>
  </details>
  ${doc?.rules?.length?'<details class="ed-fold"><summary>读图口径</summary><ul class="card-note ed-rule-list">'+doc.rules.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul></details>':''}
 </header>

 ${sections.map(s=>{
  const items=s.leadItemId?[s.items.find(i=>i.id===s.leadItemId),...s.items.filter(i=>i.id!==s.leadItemId)]:s.items;
  return `<details class="ed-branch" data-route-branch="${esc(s.id)}" ${section?.id===s.id?'open':''}>
   <summary class="ed-branch-head"><span>${esc(s.title)}</span><small>${items.length}</small></summary>
   ${s.summary?'<p class="ed-branch-sub">'+esc(s.summary)+'</p>':''}
   ${s.id==='west-bridge'&&slopeCluesReady?`<div class="ed-callout" aria-label="国道浅斑与地方路待核线索">
    <div class="ed-kicker"><span>国道浅斑与地方路</span><span data-route-slope-status aria-live="polite">${mapLayers?.has('slope-road-clues')?'已显示':'未显示'}</span></div>
    <p class="card-note">2004-05 浅斑与蓝笔末端旁地方路分别核查；跨 G332 两套地形不一致，图上不连线。</p>
    <div class="ev-links"><button type="button" class="mini-pill" data-route-slope-toggle aria-pressed="${Boolean(mapLayers?.has('slope-road-clues'))}">${mapLayers?.has('slope-road-clues')?'隐藏标记':'显示待核标记'}</button>
    ${slopeCanLocate?'<button type="button" class="mini-pill" data-route-slope-field>定位地方路</button>':''}
    <button type="button" class="mini-pill" data-route-slope-evidence>核查说明</button></div>
   </div>`:''}
   <div class="ed-branch-items">${items.map(renderItem).join('')}</div>
  </details>`;
 }).join('')}

 <details class="ed-fold ed-archive-footer" data-route-archive>
  <summary>专题入口、档案与阅读稿</summary>
  <div class="ev-links" style="margin-top:6px" data-route-secondary-access>
   ${extraAccess.includes('southeast')?cross(['southeast']):''}
   ${btn('archive','bridge','三八水库中桥专题')}
   ${btn('archive','culvert','地方道路圆涵专题')}
   ${cross(extraAccess.filter(id=>id!=='southeast'))}
   ${btn('archive','evidence','旧证据卡')}
   ${btn('archive','docs','389 资料清单')}
   <a class="mini-pill" href="./route-narrative.md" download="主湖来水_路线总览.md">下载阅读稿</a>
  </div>
 </details>`;
}
