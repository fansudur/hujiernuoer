// Selection always refers to a frozen source sample, never an interpolated elevation.
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validProfileSample=s=>s&&['distance_m','lon','lat','DSM_m'].every(k=>Number.isFinite(s[k]));
export function nearestProfileSample(samples,distance){
 let best=-1,error=Infinity;
 samples.forEach((s,i)=>{if(validProfileSample(s)&&Math.abs(s.distance_m-distance)<error){best=i;error=Math.abs(s.distance_m-distance);}});
 return best;
}
export function profileGeometry(samples){
 const valid=samples.filter(validProfileSample),max=Math.max(1,...samples.map(s=>Number.isFinite(s.distance_m)?s.distance_m:0));
 const lo=valid.length?Math.floor(Math.min(...valid.map(s=>s.DSM_m))-1):0,hi=valid.length?Math.ceil(Math.max(...valid.map(s=>s.DSM_m))+1):1;
 const x=v=>60+v/max*680,y=v=>110-(v-lo)/(hi-lo)*85;
 let drawing=false;const path=samples.map(s=>{if(!validProfileSample(s)){drawing=false;return '';}const command=drawing?'L':'M';drawing=true;return `${command}${x(s.distance_m)},${y(s.DSM_m)}`;}).join(' ');
 return {max,lo,hi,x,y,path};
}
export function createProfileLinkage(onSelect){
 let profile=null,selected=-1;const views=new Set();
 function select(index){if(!profile||!validProfileSample(profile.samples[index])||selected===index)return;selected=index;for(const view of views)view.update();onSelect(profile.samples[index]);}
 function setProfile(next){if(profile===next)return;profile=next;selected=next?nearestProfileSample(next.samples,0):-1;for(const view of [...views])view.destroy();onSelect(selected<0?null:profile.samples[selected]);}
 function mount(container){
  if(!profile)return()=>{};
  const samples=profile.samples,g=profileGeometry(samples),indices=samples.map((s,i)=>validProfileSample(s)?i:-1).filter(i=>i>=0);
  container.innerHTML=`<div class="px-profile-readout" role="status" aria-live="off"></div><svg class="px-profile-interactive" viewBox="0 0 800 140" role="img" aria-label="${escapeHTML(profile.name)}，历史地表高程剖面"><text x="8" y="13" font-size="12">历史 DSM 高程 m</text>${[g.lo,(g.lo+g.hi)/2,g.hi].map(v=>`<line x1="60" x2="740" y1="${g.y(v)}" y2="${g.y(v)}" stroke="#b7c9d0"/><text x="5" y="${g.y(v)+4}" font-size="12">${v.toFixed(0)}</text>`).join('')}<path d="${g.path}" stroke="#b94314" stroke-width="3" fill="none"/><line data-profile-cursor y1="20" y2="114" stroke="#00647a" stroke-width="2" stroke-dasharray="4 3"/><circle data-profile-dot r="6" fill="#00e5f0" stroke="#173c50" stroke-width="3"/><text x="60" y="133" font-size="12">起点 0 m</text><text x="740" y="133" text-anchor="end" font-size="12">终点 ${g.max.toFixed(0)} m</text></svg><label class="px-profile-slider-label">沿剖面选点 <input class="px-profile-slider" type="range" min="0" max="${Math.max(0,indices.length-1)}" step="1" aria-label="沿剖面选择历史地表高程采样点" ${indices.length?'':'disabled'}></label><p class="px-profile-help">悬停或拖动曲线；方向键逐点，Home / End 到两端。历史约30米级 DSM，不是湖深或当期水位。</p>`;
  const svg=container.querySelector('svg'),range=container.querySelector('input'),readout=container.querySelector('.px-profile-readout'),cursor=container.querySelector('[data-profile-cursor]'),dot=container.querySelector('[data-profile-dot]');
  let pointer=null;
  const pick=e=>{const matrix=svg.getScreenCTM?.();let x;if(matrix&&typeof DOMPoint!=='undefined')x=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()).x;else{const r=svg.getBoundingClientRect();x=(e.clientX-r.left)/r.width*800;}select(nearestProfileSample(samples,Math.max(0,Math.min(g.max,(x-60)/680*g.max))));};
  svg.onpointerdown=e=>{if(e.button!==0)return;pointer=e.pointerId;svg.setPointerCapture?.(pointer);pick(e);e.preventDefault();};
  svg.onpointermove=e=>{if(e.pointerType==='mouse'||pointer===e.pointerId)pick(e);};
  const release=e=>{if(pointer===e.pointerId){if(svg.hasPointerCapture?.(pointer))svg.releasePointerCapture(pointer);pointer=null;}};
  svg.onpointerup=release;svg.onpointercancel=release;svg.onlostpointercapture=()=>{pointer=null;};
  range.oninput=()=>select(indices[+range.value]);
  const view={update(){const sample=samples[selected];cursor.style.display=dot.style.display=sample?'':'none';if(!sample){readout.textContent='本剖面没有可用高程采样';return;}const text=`沿线 ${sample.distance_m.toFixed(0)} m · 历史地表高程 ${sample.DSM_m.toFixed(1)} m`;readout.textContent=text;range.value=indices.indexOf(selected);range.setAttribute('aria-valuetext',text);cursor.setAttribute('x1',g.x(sample.distance_m));cursor.setAttribute('x2',g.x(sample.distance_m));dot.setAttribute('cx',g.x(sample.distance_m));dot.setAttribute('cy',g.y(sample.DSM_m));},destroy(){if(pointer!==null&&svg.hasPointerCapture?.(pointer))svg.releasePointerCapture(pointer);pointer=null;svg.onpointerdown=svg.onpointermove=svg.onpointerup=svg.onpointercancel=svg.onlostpointercapture=range.oninput=null;views.delete(view);}};
  views.add(view);view.update();return()=>view.destroy();
 }
 return {setProfile,mount,select,getSelected:()=>selected<0?null:profile.samples[selected]};
}

export function installProfileMarkers(Scene){
 Scene.prototype.setProfileSample=function(sample){this.profileSample=validProfileSample(sample)?sample:null;this.render();};
 const active=s=>s.state.theme==='terrain'&&s.state.profile&&validProfileSample(s.profileSample);
 const oldTop=Scene.prototype.drawTop;
 Scene.prototype.drawTop=function(){oldTop.call(this);if(!active(this)||!this.canvas.width)return;const ctx=this.canvas.getContext('2d'),{xy,w,h}=this.topTransform(),s=this.profileSample,[x,y]=xy([s.lon,s.lat]);if(x<0||y<0||x>w||y>h)return;ctx.save();ctx.globalAlpha=1;ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle='#00e5f0';ctx.fill();ctx.strokeStyle='#102f40';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();ctx.restore();};
 const oldRender=Scene.prototype.render;
 Scene.prototype.render=function(){oldRender.call(this);this.drawProfileMarker3D();};
 Scene.prototype.drawProfileMarker3D=function(){
  if(!this.renderer||!this.camera||!active(this)){if(this.profileMarkerLabel)this.profileMarkerLabel.hidden=true;return;}
  if(!this.profileMarkerLabel?.isConnected){const el=document.createElement('div');el.className='px-profile-map-marker';el.setAttribute('aria-hidden','true');el.innerHTML='<i></i><span></span>';this.el.append(el);this.profileMarkerLabel=el;}
  const s=this.profileSample,point=this.point([s.lon,s.lat,s.DSM_m],0);point.y+=this.layerOffset('profile');const ndc=point.project(this.camera),el=this.profileMarkerLabel;
  el.hidden=![ndc.x,ndc.y,ndc.z].every(Number.isFinite)||Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||Math.abs(ndc.z)>1;
  if(el.hidden)return;el.style.left=`${(ndc.x+1)/2*100}%`;el.style.top=`${(1-ndc.y)/2*100}%`;el.querySelector('span').textContent=`${s.distance_m.toFixed(0)} m · DSM ${s.DSM_m.toFixed(1)} m`;
 };
}
