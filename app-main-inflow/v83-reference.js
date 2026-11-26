import {wireReferenceCartography} from "./v84-cartography.js?v=105.9";
const by=id=>document.getElementById(id);
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
export function wireReferenceZoom(){
 const dock=by('guided-reference-dock'), pane=by('guided-map-pane'), photos=by('guided-photo-preview');
 const nav=by('guided-nav-map').querySelector('svg'), local=by('guided-map-inset'), four=by('guided-four-inset');
 const svgs=[nav,local,four], defaults=new Map(svgs.map(el=>[el,el.getAttribute('viewBox').split(' ').map(Number)]));
 const frames=new Map(svgs.map(el=>[el,{z:1,x:0,y:0}]));
 const display=()=>pane.dataset.view==='overview'?nav:(!by('guided-location-card').hidden&&!four.hasAttribute('hidden')?four:local);
 wireReferenceCartography(svgs);
 // Keep a cartographic (uniform-scale) view, but fit to the actual SVG content
 // and the available pane aspect rather than the old fixed 154×100 window.
 const referenceSpan=()=>{
  const rect=nav.getBoundingClientRect(), root=nav.querySelector('#guided-nav-base');
  if(rect.width<3||rect.height<3||!root?.childElementCount)return;
  const b=root.getBBox();
  if(b.width<1||b.height<1)return;
  const marginX=5,marginY=6;
  let w=b.width+2*marginX,h=b.height+2*marginY;
  const ratio=rect.width/rect.height;
  if(w/h<ratio)w=h*ratio;else h=w/ratio;
  const next=[b.x+b.width/2-w/2,b.y+b.height/2-h/2,w,h];
  const prev=defaults.get(nav);
  if(next.every((v,i)=>Math.abs(v-prev[i])<.1))return;
  defaults.set(nav,next);
  const north=nav.querySelector('[data-fixed-north]');
  north?.setAttribute('x',String(next[0]+next[2]-8));
  north?.setAttribute('y',String(next[1]+11));
  draw(nav);
 };
 let reframeReq=0;
 const scheduleMapFit=()=>{if(!reframeReq)reframeReq=requestAnimationFrame(()=>{reframeReq=0;referenceSpan();});};
 nav.addEventListener('hjn-reference-content',scheduleMapFit);
 new ResizeObserver(scheduleMapFit).observe(nav);
 const ranges={map:[1,5]};
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
 dock.querySelectorAll('[data-map-zoom]').forEach(b=>b.onclick=()=>mapZoom(Number(b.dataset.mapZoom)));
  wirePhotoLens(photos);
 const wheel=(el,fn)=>el.addEventListener('wheel',e=>{
  if(!e.deltaY)return;
  e.preventDefault();e.stopPropagation();fn(e.deltaY>0?-1:1);
 },{passive:false});
 wheel(pane,mapZoom);
 pane.addEventListener('keydown',e=>{if(e.target!==pane||!['-','+','=','0'].includes(e.key))return;e.preventDefault();mapZoom(e.key==='-'?-1:e.key==='0'?0:1);});
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
 new MutationObserver(()=>{draw(display());scheduleMapFit();}).observe(pane,{attributes:true,attributeFilter:['data-view']});
 describe('map',1);
}

function wirePhotoLens(photos){
 for(const img of photos.querySelectorAll('.v75-evidence-media img')){
   const frame=document.createElement('div'), canvas=document.createElement('canvas');
   frame.className='v83-photo-frame';
   frame.tabIndex=0;frame.setAttribute('role','button');frame.setAttribute('aria-label','查看照片局部细节');frame.setAttribute('aria-pressed','false');
   canvas.setAttribute('aria-hidden','true');
   img.before(frame);frame.append(img,canvas);img.draggable=false;
   let fixed=false,request=0,point={x:.5,y:.5}, manualScale=null, activeScale=2.4, grab=null;
   function crop(){
     if(!img.complete||!img.naturalWidth||img.hidden||photos.hidden)return;
     const b=img.getBoundingClientRect();
     if(!b.width||!b.height)return;
     const d=Math.min(2.5,devicePixelRatio||1), w=Math.round(b.width*d), h=Math.round(b.height*d);
     if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
     const nw=img.naturalWidth,nh=img.naturalHeight, fit=Math.min(w/nw,h/nh);
     const iw=nw*fit,ih=nh*fit,dx=(w-iw)/2,dy=(h-ih)/2;
     const mag=manualScale??limit(Math.max(nw/iw,nh/ih),2.2,3.4), sw=nw/mag, sh=nh/mag;
     activeScale=mag;
     const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);
     ctx.drawImage(img,limit(point.x,0,1)*(nw-sw),limit(point.y,0,1)*(nh-sh),sw,sh,dx,dy,iw,ih);
     canvas.dataset.sourceCrop=[(point.x*(nw-sw)).toFixed(1),(point.y*(nh-sh)).toFixed(1),sw.toFixed(1),sh.toFixed(1)].join(',');
     frame.classList.add('is-lens');
   }
   function draw(){if(!request)request=requestAnimationFrame(()=>{request=0;crop();});}
   function reset(){
     fixed=false;manualScale=null;grab=null;cancelAnimationFrame(request);request=0;point={x:.5,y:.5};
     frame.classList.remove('is-lens','is-touch-lens','is-fixed-lens','is-grabbing');frame.setAttribute('aria-pressed','false');
     delete canvas.dataset.sourceCrop;
   }
   function position(e){
     const b=img.getBoundingClientRect(),f=Math.min(b.width/img.naturalWidth,b.height/img.naturalHeight);
     if(!(f>0))return;
     const w=img.naturalWidth*f,h=img.naturalHeight*f,l=b.left+(b.width-w)/2,t=b.top+(b.height-h)/2;
     point={x:limit((e.clientX-l)/w,0,1),y:limit((e.clientY-t)/h,0,1)};draw();
   }
   frame.onpointerenter=e=>{if(e.pointerType==='mouse'&&!fixed)position(e);};
   frame.onpointermove=e=>{
     if(grab&&frame.hasPointerCapture(e.pointerId)){
       const b=img.getBoundingClientRect(), f=Math.min(b.width/img.naturalWidth,b.height/img.naturalHeight);
       const k=Math.max(.25,activeScale-1);
       point={x:limit(grab.p.x-(e.clientX-grab.x)/(img.naturalWidth*f*k),0,1),y:limit(grab.p.y-(e.clientY-grab.y)/(img.naturalHeight*f*k),0,1)};draw();return;
     }
     if(e.pointerType==='mouse'&&!fixed||e.pointerType!=='mouse'&&fixed)position(e);
   };
   function lock(e){
     if(!fixed&&e)position(e);
     fixed=true;frame.classList.add('is-fixed-lens');frame.setAttribute('aria-pressed','true');
   }
   frame.addEventListener('wheel',e=>{
     if(e.ctrlKey||!e.deltaY||!img.naturalWidth)return;
     e.preventDefault();lock(e);
     const z=limit((manualScale??activeScale)*(e.deltaY<0?1.21:1/1.21),1,6);
     if(z<=1.05){reset();return;}
     manualScale=z;draw();
   },{passive:false});
   frame.ondblclick=reset;
   frame.onpointerleave=e=>{if(e.pointerType==='mouse'&&!fixed)reset();};
   frame.onpointerdown=e=>{
     if(!e.isPrimary||e.button!==0||!fixed)return;
     if(e.pointerType==='mouse')e.preventDefault();
     grab={x:e.clientX,y:e.clientY,p:{...point}};frame.classList.add('is-grabbing');frame.setPointerCapture(e.pointerId);
   };
   frame.onlostpointercapture=()=>{grab=null;frame.classList.remove('is-grabbing');};
   frame.onclick=e=>{
     if(e.pointerType==='mouse'||e.detail===0)return;
     if(fixed){reset();return;}
     lock(e);frame.classList.add('is-touch-lens');
   };
   frame.onkeydown=e=>{
     if(e.key==='Escape'&&frame.classList.contains('is-lens')){
       e.preventDefault();e.stopPropagation();reset();return;
     }
     if(e.key==='Enter'||e.key===' '){
       e.preventDefault();
       if(fixed){reset();return;}
       lock();draw();return;
     }
     const delta={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[e.key];
     if(!fixed||!delta)return;
     e.preventDefault();e.stopPropagation();point={x:limit(point.x+delta[0],0,1),y:limit(point.y+delta[1],0,1)};draw();
   };
   // A touch drag should pan without the ensuing click toggling the lens off.
   let down=null;
   frame.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.pointerType!=='mouse')down=[e.clientX,e.clientY];},true);
   frame.addEventListener('click',e=>{
     if(e.pointerType==='mouse'||!down)return;
     if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>7)e.stopImmediatePropagation();
     down=null;
   },true);
   img.addEventListener('load',()=>{if(frame.matches(':hover')&&frame.classList.contains('is-lens'))draw();});
   new MutationObserver(reset).observe(img,{attributes:true,attributeFilter:['src','hidden']});
   new MutationObserver(reset).observe(photos,{attributes:true,attributeFilter:['hidden']});
   new ResizeObserver(()=>{if(frame.classList.contains('is-lens'))draw();}).observe(frame);
 }
}



