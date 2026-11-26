const by=id=>document.getElementById(id);
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function wireReferenceZoom(){
 const dock=by('guided-reference-dock'), pane=by('guided-map-pane'), split=by('guide-reference-split'), photos=by('guided-photo-preview');
 const nav=by('guided-nav-map').querySelector('svg'), local=by('guided-map-inset'), four=by('guided-four-inset');
 const svgs=[nav,local,four], defaults=new Map(svgs.map(el=>[el,el.getAttribute('viewBox').split(' ').map(Number)]));
 const frames=new Map(svgs.map(el=>[el,{z:1,x:0,y:0}]));
 const display=()=>pane.dataset.view==='overview'?nav:(!by('guided-location-card').hidden&&!four.hasAttribute('hidden')?four:local);
 const ranges={map:[1,5], photo:[1,4]};
 const describe=(key,z)=>{
  const btn=dock.querySelector('[data-'+key+'-zoom="0"]');
  btn.textContent=(Math.round(z*10)/10)+'×';
  for(const [dir,val] of [[-1,ranges[key][0]],[1,ranges[key][1]]])dock.querySelector('[data-'+key+'-zoom="'+dir+'"]').disabled=z===val;
 };
 function draw(el){
   const [x0,y0,w,h]=defaults.get(el), f=frames.get(el), ew=w/f.z,eh=h/f.z;
   f.x=limit(f.x,-(w-ew)/2,(w-ew)/2);f.y=limit(f.y,-(h-eh)/2,(h-eh)/2);
   el.setAttribute('viewBox',[x0+(w-ew)/2+f.x,y0+(h-eh)/2+f.y,ew,eh].join(' '));
   if(el===display())describe('map',f.z);
 }
 function mapZoom(dir){
  const el=display(), f=frames.get(el);
  if(!dir){f.z=1;f.x=f.y=0;}else f.z=limit(Math.round((f.z+dir*.5)*2)/2,...ranges.map);
  draw(el);
 }
 let photoScale=1;
 const viewport=photos.querySelector('.v82-photo-viewport');
 function photoZoom(dir){
   photoScale=dir===0?1:limit(photoScale+dir*.5,...ranges.photo);
   const z=photoScale; viewport.style.setProperty('--photo-zoom',z*100+'%');
   viewport.classList.toggle('is-zoomed',z>1);
   if(z===1){viewport.scrollLeft=0;viewport.scrollTop=0;}
   describe('photo',z);
 }
 function setSplit(v){
  v=limit(Math.round(v),25,75);dock.style.setProperty('--map-share',String(v/100));split.setAttribute('aria-valuenow',String(v));
 }
 split.addEventListener('pointerdown',e=>{
   if(e.button!==0||!e.isPrimary)return;
   e.preventDefault();e.stopPropagation();split.setPointerCapture(e.pointerId);
 });
 // clientY also works for touch, where movementY is not consistently populated.
 let last=null,share=45;
 split.onpointerdown=e=>{if(e.isPrimary){last=e.clientY;share=Number(split.getAttribute('aria-valuenow'));}};
 split.onpointermove=e=>{
  if(last===null||!split.hasPointerCapture(e.pointerId))return;
  const total=pane.offsetHeight+photos.parentElement.offsetHeight;
  if(total>0)setSplit(share+100*(e.clientY-last)/total);
 };
 split.onlostpointercapture=()=>{last=null;};
 split.ondblclick=()=>setSplit(45);
 split.onkeydown=e=>{
  const k=e.key;if(!['ArrowUp','ArrowDown','Home','End','Enter'].includes(k))return;
  e.preventDefault();setSplit(k==='Home'?25:k==='End'?75:k==='Enter'?45:Number(split.getAttribute('aria-valuenow'))+(k==='ArrowUp'?-4:4));
 };
 for(const b of dock.querySelectorAll('[data-map-zoom],[data-photo-zoom]'))b.addEventListener('click',()=>{
   if(b.dataset.mapZoom!==undefined)mapZoom(Number(b.dataset.mapZoom));else photoZoom(Number(b.dataset.photoZoom));
 });
 const wheel=(el,fn)=>el.addEventListener('wheel',e=>{
  if(e.ctrlKey||!e.deltaY)return;
  e.preventDefault();fn(e.deltaY>0?-1:1);
 },{passive:false});
 wheel(pane,mapZoom);wheel(viewport,photoZoom);
 for(const el of svgs){
  let drag=null;
  el.addEventListener('pointerdown',e=>{
   const f=frames.get(el);if(f.z===1||e.button!==0||!e.isPrimary)return;
   e.preventDefault();el.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,fx:f.x,fy:f.y};
  });
  el.addEventListener('pointermove',e=>{
   if(!drag||!el.hasPointerCapture(e.pointerId))return;
   const f=frames.get(el), b=el.getBoundingClientRect(),[,,w,h]=defaults.get(el);
   const px=Math.min(b.width/w,b.height/h)*f.z;if(px<.01)return;
   f.x=drag.fx-(e.clientX-drag.x)/px;f.y=drag.fy-(e.clientY-drag.y)/px;draw(el);
  });
  el.addEventListener('lostpointercapture',()=>{drag=null;});
  el.addEventListener('dblclick',()=>mapZoom(0));
 }
 new MutationObserver(()=>draw(display())).observe(pane,{attributes:true,attributeFilter:['data-view']});
 new MutationObserver(()=>{split.hidden=photos.hidden;photoZoom(0);}).observe(photos,{attributes:true,attributeFilter:['hidden']});
 by('guided-photo-enlarged').addEventListener('load',()=>photoZoom(0));
 describe('map',1);describe('photo',1);
}

