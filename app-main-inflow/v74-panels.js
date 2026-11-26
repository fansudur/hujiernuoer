const doc=document;
const view=()=>({w:doc.documentElement.clientWidth,h:window.visualViewport?.height||innerHeight});
const safe=7;
const cfg={
 'guided-reference-dock':{label:'空间参照图',minW:213,minH:158},
 'guided-photo-preview':{label:'证据照片',minW:190,minH:118},
 'guided-tour-panel':{label:'讲解面板',minW:226,minH:112},
 'guided-tour-nav-strip':{label:'播放控件',minW:220,minH:48},
 'chart-deck':{label:'剖面图表',minW:228,minH:95,active:n=>n.dataset.expanded==='true'},
 'studio-drawer':{label:'地图工具',minW:196,minH:125},
 'inspector-drawer':{label:'地图详情',minW:190,minH:120},
 'legend-popover':{label:'图例',minW:183,minH:100},
 'basemap-popover':{label:'底图窗口',minW:210,minH:126},
 'scope-popover':{label:'地点窗口',minW:190,minH:130},
 'export-menu':{label:'工具窗口',minW:184,minH:112}
};
const mounted=new Map;
let handlers={}, profileActive=false;
const clamp=(n,a,b)=>Math.min(Math.max(n,a),Math.max(a,b));
const live=()=>doc.getElementById('v74-panel-status');
const say=t=>{if(live())live().textContent=t;};
export function configureTourPanels(next={}){handlers={...handlers,...next};return api;}
function limits(v,opts){
 return {w:Math.min(v.w-safe*2,opts.minW),h:Math.min(v.h-safe*2,opts.minH)};
}
function available(rec){
 const {n,opts}=rec, root=doc.getElementById('observatory');
 // On phones the tour has one dedicated, expandable tab slot, not floating desktop windows.
 if(root?.dataset.v93MobTab&&view().w<=760&&root.classList.contains('guided-tour-active'))return false;
 return !n.hidden&&(!opts.free||opts.free(n))&&(!opts.active||opts.active(n));
}
function apply(rec){
 const {n,opts,state}=rec;
 if(!state||!available(rec)){n.classList.remove('v74-custom-panel');return;}
 const v=view(), min=limits(v,opts);
 const w=clamp(state.w,min.w,v.w-safe*2);
 const root=doc.getElementById('observatory'), nav=doc.getElementById('guided-tour-nav-strip');
 const linkedGuide=!root?.dataset.v93MobTab&&n.id==='guided-tour-panel'&&root?.classList.contains('v74-tour-profile-open');
 const cut=linkedGuide&&nav&&!nav.hidden?Math.min(v.h-safe,nav.getBoundingClientRect().top-100):v.h-safe;
 const h=clamp(state.h,min.h,cut-safe);
 const x=clamp(state.x,safe,v.w-w-safe),y=clamp(state.y,safe,cut-h);
 n.style.setProperty('--v74-x',x+'px');n.style.setProperty('--v74-y',y+'px');n.style.setProperty('--v74-w',w+'px');n.style.setProperty('--v74-h',h+'px');
 n.classList.add('v74-custom-panel');
 // Update other guide components that fit their unfixed bounds on demand.
 window.dispatchEvent(new CustomEvent('hjn-v74-panel-change',{detail:{id:n.id,bounds:{x,y,w,h}}}));
}
function current(rec){const r=rec.n.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};}
function resetOne(rec,announce=true){
 rec.state=null;rec.n.classList.remove('v74-custom-panel');rec.n.classList.remove('v74-interacting');
 for(const key of ['x','y','w','h'])rec.n.style.removeProperty('--v74-'+key);
 if(announce)say(rec.opts.label+'已恢复默认位置和大小');
 window.dispatchEvent(new CustomEvent('hjn-v74-panel-change',{detail:{id:rec.n.id,reset:true}}));
}
function resetLayout(){for(const r of mounted.values())resetOne(r,false);say('所有窗口已恢复默认布局');}
const blockers='button,a,input,select,textarea,label,summary,[contenteditable],[role="button"],[role="separator"],[role="slider"]';
const headerFor={
 'guided-photo-preview':'header','guided-reference-dock':'.guided-reference-title','guided-tour-panel':'.walk-row:first-child',
 'guided-tour-nav-strip':'.v75-title','studio-drawer':'.drawer-head,.drawer-header',
 'inspector-drawer':'.drawer-head,.drawer-header', 'chart-deck':'.v75-title'
};
const directions={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1]};
function solve(rec,o,dx,dy,mode){
 if(mode==='move')return {...o,x:o.x+dx,y:o.y+dy};
 const [hx,hy]=directions[mode], lim=limits(view(),rec.opts),v=view();
 const x=hx<0?clamp(o.x+dx,safe,o.x+o.w-lim.w):o.x;
 const y=hy<0?clamp(o.y+dy,safe,o.y+o.h-lim.h):o.y;
 const w=hx>0?clamp(o.w+dx,lim.w,v.w-o.x-safe):o.w+o.x-x;
 let h=hy>0?clamp(o.h+dy,lim.h,v.h-o.y-safe):o.h+o.y-y;
 // Horizontal-only resize also gives the map room to preserve its aspect ratio.
 if(rec.opts.growMap&&hx&&!hy)h=clamp(o.h+(w-o.w)*.64,lim.h,v.h-y-safe);
 return {x,y,w,h};
}
function gesture(rec,target,mode){
 const isTitle=mode==='move';
 let priorTap;
 function eligible(e){return available(rec)&&(!isTitle||!e.target.closest(blockers));}
 target.addEventListener('pointerdown',ev=>{
  if(!ev.isPrimary||ev.button!==0||!eligible(ev))return;
  if(!isTitle||ev.pointerType==='touch')ev.preventDefault();
  ev.stopPropagation();
  const origin=current(rec),id=ev.pointerId,x0=ev.clientX,y0=ev.clientY;
  let moved=false;
  const cleanup=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',up);target.removeEventListener('pointercancel',cancel);target.removeEventListener('lostpointercapture',cancel);rec.n.classList.remove('v74-interacting');};
  const move=e=>{
   if(e.pointerId!==id)return;
   const dx=e.clientX-x0,dy=e.clientY-y0;
   if(!moved&&Math.hypot(dx,dy)<5)return;
   if(!moved){moved=true;priorTap=null;rec.n.classList.add('v74-interacting');}
   rec.state=solve(rec,origin,dx,dy,mode);apply(rec);
  };
  const up=e=>{
   if(e.pointerId!==id)return;
   if(moved)rec.state=current(rec);
   else if(isTitle&&e.pointerType==='touch'){
    const now=performance.now();
    if(priorTap&&now-priorTap.when<425&&Math.hypot(x0-priorTap.x,y0-priorTap.y)<27){resetOne(rec);priorTap=null;}
    else priorTap={when:now,x:x0,y:y0};
   }
   cleanup();
  };
  const cancel=e=>{if(e.pointerId===id)cleanup();};
  target.addEventListener('pointermove',move);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',cancel);target.addEventListener('lostpointercapture',cancel);
  target.setPointerCapture(id);
 });
 if(!isTitle)return;
 target.addEventListener('dblclick',ev=>{if(eligible(ev)){ev.preventDefault();resetOne(rec);}});
 target.addEventListener('keydown',ev=>{
  if(ev.target!==target||!available(rec))return;
  if(ev.key==='Home'||ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();resetOne(rec);return;}
  const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[ev.key];
  if(!direction)return;
  ev.preventDefault();ev.stopPropagation();
  const origin=current(rec),[dx,dy]=direction.map(n=>n*(ev.shiftKey?24:8));
  rec.state=solve(rec,origin,dx,dy,ev.altKey?'se':'move');apply(rec);rec.state=current(rec);
 });
}
function mount(){
 for(const [id,opts] of Object.entries(cfg)){
  if(mounted.has(id))continue;
  const n=doc.getElementById(id);if(!n)continue;
  const rec={n,opts,state:null};mounted.set(id,rec);
  let header=n.querySelector(headerFor[id]||'.pop-head');
  if(!header){
   header=doc.createElement('div');header.className='v75-title';
   header.textContent=opts.label;n.prepend(header);
  }
  header.classList.add('v75-window-title');header.tabIndex=0;
  header.setAttribute('aria-description','拖动标题移动，双击或双点标题恢复。键盘方向键移动，Alt 加方向键调整大小，Home 恢复。');
  if(!header.title)header.title='拖动移动，双击恢复默认位置和大小';
  gesture(rec,header,'move');
  for(const direction of Object.keys(directions)){
   const edge=doc.createElement('i');edge.className='v75-window-edge';edge.dataset.edge=direction;
   edge.setAttribute('aria-hidden','true');n.append(edge);gesture(rec,edge,direction);
  }
  new MutationObserver(()=>apply(rec)).observe(n,{attributes:true,attributeFilter:['hidden','data-expanded']});
 }
 const global=doc.getElementById('v74-layout-reset');if(global)global.onclick=resetLayout;
 const close=doc.getElementById('v74-close-tour-profile');if(close)close.onclick=closeProfile;
 const launch=doc.getElementById('v74-open-tour-profile'),link=doc.getElementById('guided-tour-route-chart');
 if(launch&&link){
  const profileId=()=>link.hidden?null:new URL(link.href,location.href).searchParams.get('prof');
  const sync=()=>{launch.hidden=!profileId();};
  launch.onclick=()=>profileActive?closeProfile():openProfile(profileId());
  new MutationObserver(sync).observe(link,{attributes:true,attributeFilter:['hidden','href']});
  sync();
 }
 const root=doc.getElementById('observatory');
 if(root)new MutationObserver(()=>{if(profileActive&&!root.classList.contains('guided-tour-active'))closeProfile({native:true});}).observe(root,{attributes:true,attributeFilter:['class']});
 if(root)wireGuideDocks(root);
 const nav=doc.getElementById('guided-tour-nav-strip');
 if(root&&nav&&typeof ResizeObserver==='function'){
  const syncNav=()=>{
   if(nav.hidden||nav.classList.contains('v74-custom-panel'))return;
   const r=nav.getBoundingClientRect();
   if(r.height>0)root.style.setProperty('--v75-nav-space',Math.ceil(view().h-r.top+4)+'px');
  };
  new ResizeObserver(syncNav).observe(nav);
  window.visualViewport?.addEventListener('resize',syncNav);
  window.addEventListener('resize',syncNav);
  syncNav();
 }
 const deck=doc.getElementById('chart-deck');
 if(deck)new MutationObserver(()=>{if(profileActive&&deck.dataset.expanded==='false')closeProfile({native:true});}).observe(deck,{attributes:true,attributeFilter:['data-expanded']});
}
export function openProfile(id){
 if(typeof id!=='string'||!id||typeof handlers.openProfile!=='function')return false;
 const root=doc.getElementById('observatory');if(!root?.classList.contains('guided-tour-active'))return false;
 if(handlers.openProfile(id)===false)return false;
 profileActive=true;root.classList.add('v74-tour-profile-open');
 doc.getElementById('chart-deck')?.setAttribute('data-tour-profile',id);
 doc.getElementById('v74-open-tour-profile')?.setAttribute('aria-expanded','true');
 const b=doc.getElementById('v74-close-tour-profile');b?.removeAttribute('hidden');
 return true;
}
export function closeProfile({native=false}={}){
 const root=doc.getElementById('observatory');
 if(!profileActive)return false;
 profileActive=false;root?.classList.remove('v74-tour-profile-open');
 doc.getElementById('chart-deck')?.removeAttribute('data-tour-profile');
 doc.getElementById('v74-open-tour-profile')?.setAttribute('aria-expanded','false');
 const b=doc.getElementById('v74-close-tour-profile');if(b)b.hidden=true;
 handlers.closeProfile?.({native});return true;
}
function relayout(){for(const r of mounted.values())apply(r);}
window.addEventListener('resize',relayout);
window.visualViewport?.addEventListener('resize',relayout);
doc.addEventListener('click',e=>{
 const link=e.target.closest('#guided-tour-route-chart[href]');if(!link)return;
 const p=new URL(link.href,location.href).searchParams,id=p.get('prof');
 if(openProfile(id)){e.preventDefault();e.stopPropagation();}
});
const api={openProfile,closeProfile,resetLayout,configure:configureTourPanels};
window.hjnV74Panels=api;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

// Default docks follow header widths; manual title/edge changes remain independent.
function wireGuideDocks(root){
 const by=id=>doc.getElementById(id), topbarForDock=()=>by('v93-tour-topbar'), left=by('atlas-hero-card'), right=doc.querySelector('.atlas-cmd-bar');
 const guide=by('guided-tour-panel'), pane=by('guided-map-pane'), dock=by('guided-reference-dock');
 const credit=by('guided-reference-credit'), nav=by('guided-tour-nav-strip'), eastLegend=by('guided-east-legend'), photo=by('guided-photo-preview'), chart=by('chart-deck');
 if(![left,right,guide,pane,dock,credit,nav].every(Boolean))return;
 let frame=0;
 const sync=()=>{
  frame=0;
  const header=left.getBoundingClientRect();
  if(header.width&&view().w>760){
   for(const [k,v] of [['left',header.left],['width',header.width],['top',header.bottom+12]]){
    const px=v+'px', key='--v95-prologue-'+k;
    if(root.style.getPropertyValue(key)!==px)root.style.setProperty(key,px);
   }
  }
  if(!root.classList.contains('guided-tour-active'))return;
  if(root.dataset.v93MobTab){
   if(view().w<=760)return;
   const {h}=view(), topbar=by('v93-tour-topbar');
   const put=(key,n)=>{const value=Math.round(n)+'px';if(root.style.getPropertyValue('--v94-'+key)!==value)root.style.setProperty('--v94-'+key,value);};
   const top=Math.max(66,(topbar?.getBoundingClientRect().bottom||0)+10);
   const navRect=nav.getBoundingClientRect();
   const baseBottom=(!nav.hidden&&!nav.classList.contains('v74-custom-panel')&&navRect.height)?navRect.top-8:h-64;
   const hasProfile=root.classList.contains('v74-tour-profile-open')&&Boolean(chart?.dataset.tourProfile);
   const lane=Math.max(100,baseBottom-top);
   const profileReserve=hasProfile?Math.min(212,Math.round(lane*.37)):0;
   put('dock-top',top);
   put('reference-height',Math.max(126,Math.min(395,lane*(photo?.hidden?0.74:0.51))));
   const scriptLimit=Math.max(115,lane-profileReserve-(hasProfile?8:0));
   if(guide.style.getPropertyValue('--v94-script-limit')!==scriptLimit+'px')guide.style.setProperty('--v94-script-limit',scriptLimit+'px');
   // Read the actual, current layout after setting the caps. This avoids profile
   // and photo jumps when the corresponding pane first opens at a new stop.
   const guideRect=guide.getBoundingClientRect(), dockRect=dock.getBoundingClientRect();
   const scriptBottom=guideRect.height?guideRect.bottom:top;
   const referenceBottom=(!dock.hidden&&dockRect.height&&!dock.classList.contains('v74-custom-panel'))?dockRect.bottom:top;
   const profileY=Math.max(top,scriptBottom+8);
   const photoY=Math.max(top,referenceBottom+8);
   // Automatically dock beneath transcript, but keep manual profile/guide positions independent:
   // if a moved transcript leaves no room below, use the original left lane.
   const profileNeedsLane=guide.classList.contains('v74-custom-panel')&&baseBottom-profileY<95;
   const chartTop=profileNeedsLane?Math.max(top,baseBottom-profileReserve):profileY;
   put('profile-y',chartTop);
   put('profile-x',profileNeedsLane?14:(guideRect.width?guideRect.left:14));
   put('profile-width',profileNeedsLane?Math.min(view().w*.31,388):(guideRect.width||Math.min(view().w*.31,388)));
   put('profile-height',Math.max(78,Math.min(212,baseBottom-chartTop)));
   put('photo-y',photoY);put('photo-height',Math.max(80,baseBottom-photoY));
   return;
  }
  const {w,h}=view(), small=w<=760, L=left.getBoundingClientRect(),R=right.getBoundingClientRect();
  const shortLandscape=small&&w>=500&&w>h&&h<=515;
  const scroll=by('guided-observer-script'), board=by('guided-director-board');
  if(shortLandscape&&board?.parentElement===guide)scroll.prepend(board);
  else if(!shortLandscape&&board?.parentElement===scroll)guide.insertBefore(board,scroll);
  const put=(key,n)=>{const v=Math.round(n)+'px';if(root.style.getPropertyValue('--guide-'+key)!==v)root.style.setProperty('--guide-'+key,v);};
  put('left',L.left);put('left-w',shortLandscape?Math.min(L.width,w*.48):L.width);
  put('right',shortLandscape?9:small?w-L.right:w-R.right);
  put('right-w',shortLandscape?Math.max(185,Math.min(L.width,w*.46)):small?L.width:R.width);
  put('map-y',(small?(shortLandscape?Math.min(L.bottom,R.bottom||L.bottom):L.bottom):R.bottom)+9);
  const bottom=nav.hidden?h-8:nav.getBoundingClientRect().top-8;
  const photoBelow=dock.getBoundingClientRect().bottom+8;
  put('photo-y',Math.max(small?85:R.bottom+8,Math.min(photoBelow,bottom-160)));
  // On phones start the transcript below the fixed map and source heading.
  // Enlarged photos use the scrollable right rail; they do not shift the map.
  const top=small&&!shortLandscape&&!dock.classList.contains('v74-custom-panel')?Math.max(L.bottom+9,dock.getBoundingClientRect().bottom+8):L.bottom+9;
  put('script-y',top);
  const bounds=guide.getBoundingClientRect();
  const gap=9,end=nav.hidden?h-7:nav.getBoundingClientRect().top-7;
  const hasProfile=root.classList.contains('v74-tour-profile-open')&&Boolean(chart?.dataset.tourProfile);
  const actualTop=guide.classList.contains('v74-custom-panel')?bounds.top:top;
  const usable=Math.max(0,end-actualTop);
  const preferred=shortLandscape?Math.round(Math.max(69,Math.min(102,h*.23))):Math.round(Math.min(small?162:236,Math.max(102,h*(small?.19:.25))));
  const chartReserve=hasProfile?Math.max(70,Math.min(preferred,usable-Math.min(148,Math.round(usable*.44))-gap)):0;
  put('script-max',Math.max(34,usable-(hasProfile?chartReserve+gap:0)));
  const profileY=(bounds.height?bounds.bottom:top+25)+gap;
  put('profile-x',bounds.width?bounds.left:L.left);put('profile-w',bounds.width?bounds.width:L.width);
  put('profile-y',profileY);put('profile-h',Math.max(48,Math.min(preferred,end-profileY)));
  const manual=chart?.classList.contains('v74-custom-panel')?mounted.get('chart-deck')?.state:null;
  const collision=Boolean(manual&&bounds.left<manual.x+manual.w&&manual.x<bounds.right&&bounds.top<manual.y+manual.h&&manual.y<bounds.bottom+8);
  chart?.classList.toggle('v81-profile-avoid',collision);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
 const observer=new ResizeObserver(schedule);
 for(const node of [left,right,guide,pane,credit,nav,eastLegend,chart,dock,photo].filter(Boolean))observer.observe(node);
 const mutation=new MutationObserver(schedule);
 mutation.observe(root,{attributes:true,attributeFilter:['class']});
 for(const node of [photo,dock,chart,topbarForDock()].filter(Boolean))mutation.observe(node,{attributes:true,attributeFilter:['hidden','data-expanded']});
 window.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 window.addEventListener('hjn-v74-panel-change',schedule);
 schedule();
}

