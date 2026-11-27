const ns='http://www.w3.org/2000/svg';
const add=(host,tag,attrs={},text='')=>{
 const n=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);
 if(text)n.textContent=text;
 host.append(n);return n;
};
const names={
 'f1-east-bridge-location-ref':'G332 中桥','guide-main-lake':'主湖',
 'hjn-seasonal-round-gap':'南段圆涵','guide-south-roundabout':'南部环岛',
 'guide-wf1':'西长湖','east-guide-marsh-pin':'东部泥沼','east-guide-pool-pin':'东池','east-guide-texture-end':'纹理消散窗'
};
const dot=(n)=>[Number(n.getAttribute('cx')),Number(n.getAttribute('cy'))];
const translated=n=>(n.getAttribute('transform')||'').match(/[-+]?(?:\d*\.)?\d+/g)?.slice(0,3).map(Number)??[];
const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const isWithin=(r,w,h)=>r.x>=3&&r.y>=3&&r.x+r.w<=w-3&&r.y+r.h<=h-3;
const overlaps=(a,b)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
const centerBox=(x,y,w,h)=>({x:x-w/2,y:y-h/2,w,h});
function fitCallout(origin,w,h,box,occupied,r){
 for(const k of [0,7,15,25,38,56,76,104]){
   for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]]){
    const p=centerBox(origin.x+dx*(w/2+r+k),origin.y+dy*(h/2+r+k),w,h);
    if(isWithin(p,box.w,box.h)&&!occupied.some(q=>overlaps(q,p)))return p;
   }
 }
 return null;
}
export function wireReferenceCartography(svgs){
 const visuals=svgs.map(svg=>({svg,layer:null,key:''}));
 const canvas=document.createElement('canvas'), measure=canvas.getContext('2d');
 function draw(o){
  const {svg}=o, b=svg.viewBox.baseVal, rect=svg.getBoundingClientRect(), css=getComputedStyle(svg);
  const left=(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.paddingLeft)||0);
  const right=(parseFloat(css.borderRightWidth)||0)+(parseFloat(css.paddingRight)||0);
  const top=(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.paddingTop)||0);
  const bottom=(parseFloat(css.borderBottomWidth)||0)+(parseFloat(css.paddingBottom)||0);
  const w=rect.width-left-right,h=rect.height-top-bottom, m=svg.getScreenCTM();
  if(w<=0||h<=0||!b.width||!b.height||!m?.a||!m?.d)return;
  // Actual SVG-to-screen matrix includes letterboxing after panel resize and the geographic viewBox.
  const px=m.a,py=m.d,x0=(rect.left+left-m.e)/px,y0=(rect.top+top-m.f)/py;
  const box={w,h};
  const pt=([x,y])=>({x:(x-x0)*px,y:(y-y0)*py});
  const rows=[];
  const north=svg.querySelector(':scope > text[data-fixed-north]');
  if(north){
   for(const [id,kind,label] of [['guided-nav-marker','heading','镜头'],['guided-nav-photo','photo','照片'],['guided-nav-target','target','本站']]){
    const n=svg.querySelector('#'+id); if(!n||n.hasAttribute('hidden'))continue;
    const [x,y,angle]=translated(n);if(Number.isFinite(x)&&Number.isFinite(y))rows.push({origin:pt([x,y]),kind,label,staticReference:n.hasAttribute('data-static-reference'),angle:angle||0, bearing:n.querySelector('path')?.getAttribute('visibility')!=='hidden'});
   }
   for(const n of svg.querySelectorAll('[data-place-id]')){
    const id=n.dataset.placeId, number=id.match(/^hjn-03-road-pin-0([1-4])$/)?.[1];
    rows.push({origin:pt(dot(n)),kind:number?'num':'place',label:number||names[id]||n.dataset.placeLabel||'',active:n.dataset.placeCurrent==='true',tone:n.dataset.placeTone});
   }
  }else{
   for(const n of svg.querySelectorAll(':scope > g[data-num]')){
    rows.push({origin:pt(translated(n)),kind:'num',label:n.dataset.num,active:n.classList.contains('active')});
   }
   const moving=svg.querySelector('.guide-local-anchor');
   if(moving)rows.push({origin:pt(dot(moving)),kind:'target',label:'',staticReference:moving.hasAttribute('data-static-reference')});
   for(const n of svg.querySelectorAll(':scope > text:not([data-fixed-north])')){
    const label=n.textContent.trim();if(!label)continue;
    const prev=n.previousElementSibling;
    const p=n.dataset.insetAt?.split(',').map(Number) ??
      (prev?.tagName==='line'?[Number(prev.getAttribute('x1')),Number(prev.getAttribute('y1'))]:null);
    if(p)rows.push({origin:pt(p),kind:n.dataset.labelId?'num':'local',label,active:n.classList.contains('guide-opening-focus'),tone:n.dataset.placeTone});
    else rows.push({kind:'caption',label});
   }
  }
  const rank={caption:0,num:1,place:2,local:2,photo:3,target:4,heading:5};
  rows.sort((a,b)=>rank[a.kind]-rank[b.kind]||Number(!!b.active)-Number(!!a.active));
  const key=JSON.stringify([w,h,b.x,b.y,b.width,b.height,px,py,x0,y0,rows.map(r=>[r.kind,r.label,r.tone,r.active,r.bearing,r.staticReference,Math.round(r.angle||0),r.origin&&Math.round(r.origin.x),r.origin&&Math.round(r.origin.y)])]);
  if(o.key===key&&o.layer?.isConnected)return;
  o.key=key;o.layer?.remove();
  const layer=o.layer=add(svg,'g',{'data-v84-overlay':'','pointer-events':'none',transform:'translate('+x0+' '+y0+') scale('+(1/px)+' '+(1/py)+')'});
  svg.setAttribute('data-v84-cartography','');
  const stems=add(layer,'g',{'data-inset-leaders':''}), marks=add(layer,'g',{'data-inset-symbols':''}), labels=add(layer,'g',{'data-inset-labels':''});
  const busy=[], items=[];
  const font=w<185?11:12;
  measure.font='600 '+font+'px system-ui,sans-serif';
  if(north&&h>24&&w>32){
   const r={x:w-24,y:4,w:20,h:19};busy.push(r);
   add(labels,'text',{x:w-14,y:17,'text-anchor':'middle',fill:'#9A9892',class:'v84-label','font-size':10,'letter-spacing':'0.08em'},'北');
  }
  for(const row of rows){
   if(row.kind==='caption'){
    const natural=measure.measureText(row.label).width+12;
    const cw=Math.min(natural,w-10);
    if(cw>18&&h>37){const r=centerBox(w/2,h-13,cw,17);busy.push(r);labelAt(labels,r,row.label,font,natural>cw?cw-8:null);}
    continue;
   }
   const {origin:p,kind}=row;
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
   if(p.x<0||p.x>w||p.y<0||p.y>h){
    if(kind!=='heading'||w<42||h<25)continue;
    const edge={x:Math.max(12,Math.min(w-12,p.x)),y:Math.max(12,Math.min(h-12,p.y))};
    row.label='镜头在图外';row.angle=Math.atan2(p.x-w/2,h/2-p.y)*180/Math.PI;row.outside=true;row.origin=edge;
    p.x=edge.x;p.y=edge.y;
   }
   const r=kind==='heading'?10:kind==='photo'||kind==='num'||kind==='target'?9:5;
   // The direction arrow has a longer footprint only in the direction it points.
   // Reserve the rotated footprint so it does not collide with the other map symbols.
   let dw=r*2,dh=r*2,ox=0,oy=0;
   if(kind==='photo'&&row.bearing){
    const a=row.angle*Math.PI/180, co=Math.cos(a),si=Math.sin(a);
    const rotated=[[-9,-31],[9,-31],[-9,-3],[9,-3]].map(([x,y])=>[x*co-y*si,x*si+y*co]);
    const l=Math.min(-r,...rotated.map(q=>q[0])),rt=Math.max(r,...rotated.map(q=>q[0]));
    const t=Math.min(-r,...rotated.map(q=>q[1])),bt=Math.max(r,...rotated.map(q=>q[1]));
    dw=rt-l;dh=bt-t;ox=(l+rt)/2;oy=(t+bt)/2;
   }
   let slot=centerBox(p.x+ox,p.y+oy,dw,dh);
   const geographic=kind==='place'||kind==='local';
   if(!geographic&&(!isWithin(slot,w,h)||busy.some(q=>overlaps(q,slot))))slot=fitCallout(p,dw,dh,box,busy,3);
   if(!slot){
    if(kind==='num')add(stems,'circle',{cx:p.x,cy:p.y,r:2.2,fill:'#c5eafa',stroke:'#122333'});
    continue;
   }
   busy.push(slot);
   const c={x:slot.x+dw/2-ox,y:slot.y+dh/2-oy};
   if(delta(c,p)>1){
    add(stems,'line',{x1:p.x,y1:p.y,x2:c.x,y2:c.y,class:'v84-stem'});
    add(stems,'circle',{cx:p.x,cy:p.y,r:1.5,fill:'#c5d7e2'});
   }
   const g=add(marks,'g',{'data-inset-symbol':kind,'data-inset-current':String(!!row.active),transform:'translate('+c.x+' '+c.y+')','aria-label':row.label||kind});
   if(kind==='heading'){
    const arrow=add(g,'g',{transform:'rotate('+row.angle+')'});
    add(arrow,'path',{d:'M0 -8.5 L5.8 5.5 L0 3.4 L-5.8 5.5 Z',fill:row.outside?'#121418':'#D4AF6A',stroke:row.outside?'#D4AF6A':'#090A0C','stroke-width':1.1});
    add(arrow,'circle',{r:1.7,fill:'#F4F1EA'});
   }else if(kind==='photo'){
    if(row.bearing){
     const bearing=(Math.round(row.angle)%360+360)%360;
     const arrow=add(g,'g',{transform:'rotate('+row.angle+')','data-photo-bearing':bearing});
     add(arrow,'path',{d:'M0 -26 L6 -16 L2 -16 L2 -4 L-2 -4 L-2 -16 L-6 -16 Z',fill:'#D8B4EE',stroke:'#17111F','stroke-width':1.8,'stroke-linejoin':'round','paint-order':'stroke fill'});
     g.setAttribute('aria-label','照片拍摄方向 '+bearing+'°');
    }
    add(g,'rect',{x:-6.5,y:-3.8,width:13,height:8.2,rx:2,fill:'#241B2E',stroke:'#D8B4EE','stroke-width':1.2});
    add(g,'circle',{r:1.9,fill:'#D8B4EE'});
   }else if(kind==='target'){
    if(!row.staticReference)add(g,'circle',{r:8.5,fill:'none',stroke:'#74B8DC','stroke-width':0.9,class:'rm-radar-pulse'});
    add(g,'circle',{r:5.2,fill:'rgba(116,184,220,0.14)',stroke:'#74B8DC','stroke-width':1.25});
   }else if(kind==='num'){
    add(g,'circle',{r:7.2,fill:row.active?'#D4AF6A':'#14161B',stroke:row.active?'#F4E6C5':'#74B8DC','stroke-width':1});
    add(g,'text',{y:3.6,'text-anchor':'middle',fill:row.active?'#090A0C':'#F4F1EA','font-size':10.5,'font-weight':700},row.label);
   }else add(g,'circle',{r:row.active?3.9:3.0,fill:row.tone||(row.active?'#DFB164':'#9A9892'),stroke:'#090A0C','stroke-width':0.9});
   if(row.label)add(g,'title',{},row.label);
   if(row.label&&kind!=='num')items.push({row,c,r});
  }
  items.sort((a,b)=>Number(!!b.row.active)-Number(!!a.row.active)||Number(['heading','photo','target'].includes(b.row.kind))-Number(['heading','photo','target'].includes(a.row.kind)));
  const missing=[];
  for(const {row,c,r} of items){
   const width=measure.measureText(row.label).width+9;
   const pos=fitCallout(c,width,17,box,busy,r+3);
   if(!pos){missing.push(row.label);continue;}
   busy.push(pos);
   const x=Math.max(pos.x,Math.min(c.x,pos.x+pos.w)),y=Math.max(pos.y,Math.min(c.y,pos.y+pos.h));
   if(Math.hypot(x-c.x,y-c.y)>r+3)add(stems,'line',{x1:c.x,y1:c.y,x2:x,y2:y,class:'v84-stem'});
   labelAt(labels,pos,row.label,font,null,row.tone);
  }
  if(missing.length)add(layer,'title',{},'当前视窗内其余标注：'+missing.join('、')+'。拉高参照图或放大查看。');
 }
 function labelAt(host,p,value,font,length,tone){
  const g=add(host,'g',{'data-inset-label':value});
  add(g,'rect',{x:p.x,y:p.y,width:p.w,height:p.h,rx:p.h*0.5,fill:'#0E0F12','fill-opacity':.70,stroke:'rgba(255,255,255,0.10)','stroke-width':0.6});
  add(g,'text',{x:p.x+p.w/2,y:p.y+p.h/2+font*.34,'text-anchor':'middle','font-size':font,class:'v84-label',...(tone?{style:'fill:'+tone}:{}),...(length?{textLength:length,lengthAdjust:'spacingAndGlyphs'}:{})},value);
 }
 let pending=0;
 const schedule=()=>{if(!pending)pending=requestAnimationFrame(()=>{pending=0;visuals.forEach(draw);});};
 const ro=new ResizeObserver(schedule);
 for(const v of visuals){
  ro.observe(v.svg);
  new MutationObserver(records=>{
   if(records.some(r=>!r.target.closest?.('[data-v84-overlay]')&&(r.type!=='childList'||[...r.addedNodes,...r.removedNodes].some(n=>!n.hasAttribute?.('data-v84-overlay')))))schedule();
  }).observe(v.svg,{subtree:true,childList:true,attributes:true,attributeFilter:['viewBox','transform','hidden','class','cx','cy','visibility','data-static-reference']});
 }
 schedule();
}
