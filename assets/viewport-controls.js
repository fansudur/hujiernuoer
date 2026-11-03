// Independent navigation cameras; research time and geometries remain shared.
export function attachTopNavigation(scene, controls){
 const canvas=scene.canvas,pointers=new Map();let gesture=null;
 const point=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
 const snapshot=()=>{const ps=[...pointers.values()];return ps.length>1?{center:[(ps[0][0]+ps[1][0])/2,(ps[0][1]+ps[1][1])/2],distance:Math.hypot(ps[1][0]-ps[0][0],ps[1][1]-ps[0][1])}:{center:ps[0],distance:0};};
 const end=e=>{pointers.delete(e.pointerId);if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);gesture=pointers.size?snapshot():null;canvas.classList.toggle('is-panning',pointers.size>0);};
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();pointers.set(e.pointerId,point(e));canvas.setPointerCapture?.(e.pointerId);gesture=snapshot();canvas.classList.add('is-panning');});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,point(e));const next=snapshot();if(gesture?.center&&next.center){scene.panTop(next.center[0]-gesture.center[0],next.center[1]-gesture.center[1]);if(next.distance>0&&gesture.distance>0)scene.zoomTop(next.distance/gesture.distance,next.center);}gesture=next;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);scene.zoomTop(Math.exp(-Math.max(-300,Math.min(300,dy))*.002),point(e));},{passive:false});
 canvas.addEventListener('dblclick',e=>{e.preventDefault();scene.resetTop();});
 canvas.addEventListener('keydown',e=>{const pan={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(pan[e.key]){e.preventDefault();scene.panTop(...pan[e.key]);}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();e.key==='Home'?scene.resetTop():scene.zoomTop(e.key==='-'?1/1.4:1.4);}});
 controls.plus.onclick=()=>scene.zoomTop(1.4);controls.minus.onclick=()=>scene.zoomTop(1/1.4);controls.reset.onclick=()=>scene.resetTop();
 return {cancel(){for(const id of [...pointers.keys()])end({pointerId:id});}};
}
export function attachSplitWorkspace(container, separator, onResize){
 let ratio=.46,preferred=.46,active=null;const clamp=value=>{const width=Math.max(1,container.clientWidth-10),min=Math.min(.45,240/width);return Math.max(min,Math.min(1-min,value));};
 const apply=(value,remember=true)=>{if(remember)preferred=value;if(!container.clientWidth)return;ratio=clamp(value);container.style.setProperty('--px-left',ratio+'fr');container.style.setProperty('--px-right',(1-ratio)+'fr');separator.setAttribute('aria-valuemin',String(Math.round(clamp(0)*100)));separator.setAttribute('aria-valuemax',String(Math.round(clamp(1)*100)));separator.setAttribute('aria-valuenow',String(Math.round(ratio*100)));separator.setAttribute('aria-valuetext','顶视 '+Math.round(ratio*100)+'%，三维 '+Math.round((1-ratio)*100)+'%');onResize();};
 const stop=e=>{if(active!==e.pointerId)return;active=null;if(separator.hasPointerCapture?.(e.pointerId))separator.releasePointerCapture(e.pointerId);separator.classList.remove('is-dragging');};
 separator.addEventListener('pointerdown',e=>{if(e.button!==0||container.dataset.view!=='both')return;e.preventDefault();active=e.pointerId;separator.setPointerCapture?.(active);separator.classList.add('is-dragging');});
 separator.addEventListener('pointermove',e=>{if(e.pointerId!==active)return;e.preventDefault();const r=container.getBoundingClientRect();apply((e.clientX-r.left-5)/Math.max(1,r.width-10));});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])separator.addEventListener(event,stop);
 separator.addEventListener('dblclick',()=>apply(.46));separator.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();apply(e.key==='Home'?.46:e.key==='End'?.5:ratio+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.1:.02));});apply(ratio);const observer=new ResizeObserver(()=>{if(container.clientWidth>0&&!matchMedia('(max-width:760px)').matches)apply(preferred,false);});observer.observe(container);
 return {get ratio(){return ratio;},reset:()=>apply(.46),cancel(){if(active!==null)stop({pointerId:active});}};
}
