import {isPassiveEvidenceInteraction,attachEvidenceNarrationControls,observeEvidenceViewers} from './evidence-narration-viewer.js';
// Editorial narration only: never rewrites scientific data or registers report images.
export function buildNarrationCatalog(manifest){
 const chapters=manifest.chapters.map(c=>({...c,kind:'chapter',stage_id:c.stage_id}));
 const figures=manifest.figures.map(f=>({...f,kind:'figure',stage_id:f.proposed_stage}));
 const known=new Set(chapters.map(c=>c.stage_id));
 if(new Set([...chapters,...figures].map(i=>i.id)).size!==chapters.length+figures.length)throw Error('讲解编号重复');
 for(const f of figures)if(!known.has(f.stage_id))throw Error('图件章节未配置：'+f.id);
 return chapters.flatMap(c=>[c,...figures.filter(f=>f.stage_id===c.stage_id)]);
}
// Injectable transport: actual scene/image readiness and media ended drive progression.
export function createExpertNarrationController({items,prepare,onState=()=>{},onCommit=()=>{},audioFactory=()=>new Audio(),prepareAudio=async item=>({src:item.audio.src,dispose(){}}),beforePlay=()=>{}}){
 let queue=items.map(i=>i.id),index=0,status='idle',error='',epoch=0,playRevision=0,abort=null,audio=null,audioSource=null,committed=null,continuing=false,contextItem=null;
 const state=()=>({queue:[...queue],index:contextItem?-1:index,id:contextItem||queue[index]||null,contextOnly:!!contextItem,status,error,playing:status==='playing',busy:status==='preparing'||status==='loading-audio',currentTime:Number.isFinite(audio?.currentTime)?audio.currentTime:0,duration:Number.isFinite(audio?.duration)?audio.duration:0,committed});
 const emit=()=>onState(state());
 function invalidate(){++epoch;abort?.abort();abort=null;if(audio){audio.onended=null;audio.onerror=null;audio.ontimeupdate=null;audio.onloadedmetadata=null;audio.pause();audio.removeAttribute?.('src');audio.load?.();audio=null;}audioSource?.dispose();audioSource=null;}
 function stop(reason=''){continuing=false;invalidate();status='stopped';error=reason;emit();}
 async function startAudio(item,ticket){
  if(ticket!==epoch)return;
  if(!item.audio?.available){continuing=false;status='unavailable';error='本段语音尚未生成；可阅读讲解全文，或选择其他段落。';emit();return;}
  status='loading-audio';emit();
  const source=await prepareAudio(item,{signal:abort.signal,isCurrent:()=>ticket===epoch});
  if(ticket!==epoch){source.dispose();return;}audioSource=source;
  beforePlay();if(ticket!==epoch)return;const media=audioFactory();audio=media;media.preload='auto';media.src=source.src;media.ontimeupdate=media.onloadedmetadata=()=>{if(ticket===epoch)emit();};
  media.onended=()=>{if(ticket!==epoch||audio!==media||status!=='playing')return;if(!contextItem&&index+1<queue.length)void jump(queue[index+1],{play:true});else{continuing=false;invalidate();status='complete';emit();}};
  media.onerror=()=>{if(ticket!==epoch)return;invalidate();status='error';error='本段音频加载失败；未跳过。请重试或手动选择下一段。';emit();};
  const revision=++playRevision;status='playing';emit();
  try{await media.play();if(ticket!==epoch){media.pause();return;}if(revision!==playRevision)return;status='playing';emit();}
  catch(e){if(ticket!==epoch||revision!==playRevision)return;media.pause();continuing=false;status=e?.name==='NotAllowedError'?'blocked':'error';error=status==='blocked'?'浏览器阻止连续播放，请点击播放继续。':'音频无法播放，请重试。';emit();}
 }
 async function jump(id,{play=continuing,contextOnly=false}={}){
  const n=queue.indexOf(id);if(n<0&&(!contextOnly||!items.some(i=>i.id===id)))return false;
  invalidate();continuing=play;contextItem=n<0?id:null;if(n>=0)index=n;status='preparing';error='';const ticket=epoch;abort=new AbortController();emit();
  const item=items.find(i=>i.id===id),isCurrent=()=>ticket===epoch;
  try{const result=await prepare(item,{signal:abort.signal,isCurrent});if(!isCurrent())return false;if(result===false)throw Error('地图或图件未完成同步');committed=id;status='ready';onCommit(item);emit();if(play)await startAudio(item,ticket);return true;}
  catch(e){if(!isCurrent())return false;invalidate();status='error';error=e.message||'资料未能载入，请重试。';emit();return false;}
 }
 async function play(){
  if(!queue.length&&!contextItem)return;if(status==='playing'||status==='preparing'||status==='loading-audio')return;
  if((status==='paused'||status==='blocked')&&audio&&committed===(contextItem||queue[index])){error='';continuing=true;const ticket=epoch,revision=++playRevision,media=audio;beforePlay();if(ticket!==epoch)return;status='playing';emit();try{await media.play();if(ticket!==epoch){media.pause();return;}if(revision===playRevision){status='playing';emit();}}catch(e){if(ticket===epoch&&revision===playRevision){continuing=false;status='blocked';error='请再次点击播放，或检查音频。';emit();}}return;}
  if(status==='complete'&&!contextItem)index=0;
  await jump(contextItem||queue[index],{play:true,contextOnly:!!contextItem});
 }
 function pause(){if(status==='preparing'||status==='loading-audio'){stop('准备已取消');return;}if(audio&&status==='playing'){++playRevision;continuing=false;audio.pause();status='paused';emit();}}
 function setQueue(ids){if(ids.some(id=>!items.some(i=>i.id===id))||new Set(ids).size!==ids.length)throw Error('无效播放列表');const current=contextItem||queue[index];committed=null;stop();contextItem=null;queue=[...ids];index=Math.max(0,queue.indexOf(current));status='idle';error='';emit();}
 // Manual chapter selection is metadata-only: no map preparation, audio, or queue mutation.
 function selectChapter(stage){
  if(!['idle','stopped','complete'].includes(status))return false;
  const item=items.find(i=>i.kind==='chapter'&&i.stage_id===stage);if(!item)return false;
  const n=queue.indexOf(item.id);invalidate();continuing=false;contextItem=n<0?item.id:null;if(n>=0)index=n;
  committed=null;status='idle';error='';emit();return true;
 }
 function seek(seconds){if(audio&&Number.isFinite(audio.duration)&&Number.isFinite(seconds)){audio.currentTime=Math.max(0,Math.min(audio.duration,seconds));emit();}}
 return {getState:state,jump,play,pause,stop,setQueue,selectChapter,seek,next:()=>jump(queue[Math.min(queue.length-1,state().index+1)]),previous:()=>jump(queue[Math.max(0,state().index-1)])};
}
// Fetch a complete same-origin MP3 before playback: seek must not depend on
// the static host honoring HTTP Range. One owned object URL per current item.
export async function prepareNarrationAudioBlob(item,{signal},{fetchImpl=fetch,urlApi=URL,BlobImpl=Blob}={}){
 const response=await fetchImpl(item.audio.src,{signal});
 if(!response.ok)throw Error('本段音频未能完整载入，请重试。');
 const bytes=await response.arrayBuffer();
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 if(item.audio.bytes&&bytes.byteLength!==item.audio.bytes)throw Error('音频文件不完整；请重试，未跳过本段。');
 const src=urlApi.createObjectURL(new BlobImpl([bytes],{type:'audio/mpeg'}));let released=false;
 return {src,dispose(){if(!released){released=true;urlApi.revokeObjectURL(src);}}};
}
export function narrationDisplayCaption(item){
 const original=item.source_refs?.caption||'',correction=item.editorial_correction;
 // Apply only the reviewed exact phrase; source caption remains untouched.
 return correction?.original_phrase&&correction?.spoken_phrase?original.replace(correction.original_phrase,correction.spoken_phrase):original;
}
export function resolveNarrationFigure(items,figure){
 // Exact current report ID + asset, or an existing A alias with the same asset.
 // Historical inventory IDs deliberately do not inherit current narration.
 const src=figure.asset?.src||figure.src;
 return items.find(i=>i.kind==='figure'&&i.source_refs.asset.src===src&&(i.id===figure.id||/^A\d+$/.test(figure.id||'')))||null;
}
// Event adapters are injectable for source-backed lifecycle tests without a browser.
export function bindExpertNarrationLifecycle({events,document,stop,onContextChange,onModeChange=()=>{}}){
 const bindings=[];const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);bindings.push(()=>target.removeEventListener(type,handler,options));};
 on(events,'lake-story-stage',onContextChange);on(events,'lake-process-preparing',onContextChange);
 on(events,'lake-reading-mode',()=>{onContextChange();onModeChange();});
 on(events,'lake-narration-state',e=>{if(e.detail?.playing||e.detail?.busy)onContextChange();});
 on(document,'visibilitychange',()=>{if(document.hidden)stop('页面离开前台，已停止');});
 on(events,'pagehide',()=>stop());
 return ()=>bindings.forEach(remove=>remove());
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadImage(src,signal){return new Promise((resolve,reject)=>{
 const image=new Image();const done=fn=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',cancel);fn();};
 const cancel=()=>done(()=>reject(new DOMException('Cancelled','AbortError')));
 signal.addEventListener('abort',cancel,{once:true});image.onload=()=>done(()=>resolve(image));image.onerror=()=>done(()=>reject(Error('原图未能载入；请重试，不跳过此图。')));image.src=src;if(signal.aborted)cancel();
 });}
export async function initExpertNarration(host){
 if(!document.body.classList.contains('lake-design-preview')||host.dataset.expertNarration)return;
 host.dataset.expertNarration='true';
 const css=document.createElement('link');css.rel='stylesheet';css.href='assets/expert-narration.css';document.head.append(css);
 const box=document.createElement('section');box.className='expert-narration';box.setAttribute('aria-label','专业语音讲解');
 box.innerHTML='<button type="button" disabled>正在读取本章讲解…</button>';host.querySelector('.px-story').prepend(box);
 try{
  const response=await fetch('data/expert-narration.json');if(!response.ok)throw Error('讲解目录暂不可用');const manifest=await response.json(),items=buildNarrationCatalog(manifest);
  const panel=document.createElement('section');panel.className='expert-narration-evidence';panel.hidden=true;panel.setAttribute('aria-label','当前讲解原图与依据');
  box.innerHTML=`<div class="en-compact"><button type="button" data-compact-play>▶ 听本章讲解</button><button type="button" data-expand aria-expanded="false" aria-controls="expert-narration-expanded">选段 / 控制</button></div><p class="en-compact-status" data-compact-status role="status" hidden></p><div class="en-expanded" id="expert-narration-expanded" hidden><h3>专业讲解 · 章节与图件</h3><p class="en-label">AI 合成语音 · ${manifest.figures.length} 张报告原图 / ${manifest.chapters.length} 章</p><p>${items.every(i=>i.audio?.available)?items.length+'段配音已就绪。':items.some(i=>i.audio?.available)?'已制作段落可播放；未制作段落会明确停下。':'本批配音尚未提供，可先阅读图文说明。'}历史图件与机制示意不在本批配音范围。</p><details class="en-help"><summary>播放与地图说明</summary><p>章节与图件同一播放列表，按顺序连续播放；原图在地图旁对照，不贴到地表。移动端在地图下方阅读。</p></details><label>播放范围<select data-scope><option value="all">章节＋全部报告图件</option><option value="chapters">只听九章</option><option value="figures">只听全部报告图件</option><option value="custom">自选段落</option></select></label><div class="en-transport"><button data-prev aria-label="上一段">上一段</button><button data-play>播放</button><button data-next aria-label="下一段">下一段</button><button data-stop>停止</button></div><label class="en-seek">本段进度 <input data-seek type="range" min="0" max="1" step="0.1" value="0" disabled aria-label="本段音频播放位置"><output data-time>— / —</output></label><p data-status role="status" aria-live="polite">请选择段落</p><p data-current></p><button data-show disabled>查看当前讲解与原图</button><details class="en-catalog"><summary>选择或跳转讲解段落</summary><p>点击标题跳转；播放中跳转将接着播放。自选模式勾选后按“应用选择”。</p><div data-custom hidden><button data-apply>应用选择</button></div><div data-list>${items.map(i=>`<div class="en-item ${i.kind}"><input type="checkbox" data-pick="${esc(i.id)}" checked aria-label="选入 ${esc(i.title)}" hidden><button data-jump="${esc(i.id)}">${i.kind==='figure'?'图 '+Number(i.id.split('-')[1])+' · ':''}${esc(i.title)}</button></div>`).join('')}</div></details></div>`;
  box.querySelector('.en-catalog').before(panel);
  function focusEvidence(){const aside=host.querySelector('.px-story'),transport=box.querySelector('.en-transport');aside.scrollTop+=panel.getBoundingClientRect().top-aside.getBoundingClientRect().top-transport.getBoundingClientRect().height-12;}
  let ownChange=0,evidenceValid=false;const app=window.lakeProcess,story=window.lakeStory;
  const controller=createExpertNarrationController({items,prepareAudio:prepareNarrationAudioBlob,beforePlay(){window.lakeSimpleGuide?.stop();app.stop();window.lakeEvidenceTools?.stop();window.lakeNative?.stop?.();},
   async prepare(item,{signal,isCurrent}){
    panel.hidden=true;evidenceValid=false;
    if(window.lakeSimpleGuide?.getState().mode!=='expert')throw Error('请先进入专业分析');
    window.lakeSimpleGuide.stop();app.stop();window.lakeEvidenceTools?.stop();
    ++ownChange;try{if(story.getState().stage!==item.stage_id)story.selectStage(story.story.stages.findIndex(s=>s.id===item.stage_id));}finally{--ownChange;}
    const date=app.state.date;
    if(!await app.whenSceneReady({date,stage:item.stage_id,isCurrent}))return false;
    const image=item.kind==='figure'?await loadImage(item.source_refs.asset.src,signal):null;
    if(!isCurrent())return false;
    const caption=item.source_refs?.caption||'',displayCaption=narrationDisplayCaption(item),brief=displayCaption.length>100?displayCaption.slice(0,100)+'…':displayCaption;
    evidenceValid=true;panel.hidden=false;panel.innerHTML=`<div class="en-evidence-head"><h3>${esc(item.title)}</h3></div><div data-image></div>${item.kind==='figure'?'<p class="en-caption">'+esc(brief)+'</p>':''}${item.editorial_correction?'<p class="en-correction-note">图注年份措辞已校正，原文与依据见下方。</p>':''}<p class="en-context-brief">${item.kind==='figure'?'地图为章节背景；本图日期与口径见图注。':'地图为章节背景；比较日期与口径见下方讲解。'}</p>${item.id==='chapter-shore'?'<p class="en-window">本章讲解：2021年7月→2024年7月，共同可见范围内约100.13→132.03公顷；不是当前地图固定统计窗的单月读数。</p>':''}<details class="en-script" ${item.kind==='chapter'?'open':''}><summary>讲解全文 · 说明什么问题</summary><p class="en-transcript">${esc(item.text)}</p></details><details><summary>证据边界与地图关系</summary><p class="en-context">地图上下文：${esc(story.story.stages.find(s=>s.id===item.stage_id)?.title||item.stage_id)} · 当前地图年月 ${esc(date)}。讲解中的比较日期与统计窗口以全文为准，不等于当前地图单月读数。</p><p><strong>放在哪里：</strong>${item.kind==='figure'?'原图在此独立证据板阅读；未独立地理配准，不贴地、不用于量距。'+(item.existing_stage_bindings?.includes(item.stage_id)?'已有章节关联不代表原图已配准。':'本图仅作主题相关对照；未核验地图锚点，不新增定位标记。'):esc(item.display?.map_note||'显示当前章已有地图上下文。')}</p>${caption?'<h4>原图完整图注</h4><p>'+esc(caption)+'</p>':''}${item.editorial_correction?'<p class="en-correction">讲解校正：'+esc(typeof item.editorial_correction==='string'?item.editorial_correction:item.editorial_correction.reason)+'</p>':''}<ul>${(item.evidence_limits||[]).map(t=>'<li>'+esc(t)+'</li>').join('')}</ul><p class="en-source">出处：${esc(item.source||item.source_refs?.file||'')}${item.source_refs?.page?' · 最新报告第 '+item.source_refs.page+' 页':''}</p></details>${item.kind==='figure'?'<button data-enlarge>放大查看原图</button> · <a target="_blank" rel="noopener" href="'+esc(item.source_refs.pdf)+'#page='+item.source_refs.page+'">查看报告原页 ↗</a>':''}<button data-close>收起说明</button>`;
    if(image){image.alt=item.title;const link=document.createElement('button');link.type='button';link.onclick=()=>window.lakeReader.showFigure({id:item.id,title:item.title,asset:item.source_refs.asset,caption:item.source_refs.caption,page:item.source_refs.page});link.setAttribute('aria-label','打开完整原图：'+item.title);link.append(image);panel.querySelector('[data-image]').append(link);}
    panel.querySelector('[data-enlarge]')?.addEventListener('click',()=>window.lakeReader.showFigure({id:item.id,title:item.title,asset:item.source_refs.asset,caption:item.source_refs.caption,page:item.source_refs.page}));
    panel.querySelector('[data-close]').onclick=()=>{panel.hidden=true;};
    return true;
   },onCommit(){},onState(s){
    if(!s.committed||s.committed!==s.id){evidenceValid=false;panel.hidden=true;}
    window.dispatchEvent(new CustomEvent('lake-expert-narration-state',{detail:s}));
    const seek=box.querySelector('[data-seek]');seek.disabled=!s.duration;seek.max=String(s.duration||1);seek.value=String(s.currentTime);const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');box.querySelector('[data-time]').textContent=s.duration?fmt(s.currentTime)+' / '+fmt(s.duration):'— / —';
    const label={idle:'请选择段落','loading-audio':'正在完整载入本段音频…',preparing:'正在同步地图与原图…',ready:'图文已就绪',playing:'正在播放',paused:'已暂停',stopped:'已停止',complete:'播放列表已结束',unavailable:'语音尚未生成',blocked:'需要点击继续播放',error:'载入未成功'};
    box.querySelector('[data-status]').textContent=(label[s.status]||s.status)+(s.error?' · '+s.error:'');
    const selected=items.find(i=>i.id===s.id);
    box.querySelector('[data-current]').textContent=s.id?(s.contextOnly?'本章（不改动所选队列）':`${s.index+1} / ${s.queue.length}`)+' · '+selected?.title:'尚未选择段落';
    const compact=box.querySelector('[data-compact-play]');compact.textContent=s.busy?'正在准备…':s.playing?'Ⅱ 暂停讲解':s.status==='paused'||s.status==='blocked'?'▶ 继续讲解':selected?.kind==='figure'?'▶ 听所选图讲解':'▶ 听本章讲解';compact.disabled=s.busy||!s.id;compact.setAttribute('aria-pressed',String(s.playing));compact.title=selected?.title||'选择当前章节';compact.setAttribute('aria-label',compact.textContent+'：'+(selected?.title||'当前章节'));
    box.dataset.playbackStatus=s.status;const briefStatus=box.querySelector('[data-compact-status]');briefStatus.hidden=!['error','unavailable','blocked'].includes(s.status);briefStatus.textContent=briefStatus.hidden?'':(label[s.status]||'')+(s.error?' · '+s.error:'');
    box.querySelector('[data-show]').disabled=!s.committed||s.busy||!evidenceValid;
    const play=box.querySelector('[data-play]');play.textContent=s.playing?'暂停':s.status==='paused'?'继续':'播放';play.disabled=s.busy||!s.id;play.setAttribute('aria-pressed',String(s.playing));
    box.querySelector('[data-prev]').disabled=!s.queue.length||s.index<=0;box.querySelector('[data-next]').disabled=!s.queue.length||s.index===s.queue.length-1;
    box.querySelectorAll('[data-jump]').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.jump===s.id));b.disabled=!s.queue.includes(b.dataset.jump);});
   }});
  box.querySelector('[data-expand]').onclick=()=>{const expanded=box.querySelector('.en-expanded'),button=box.querySelector('[data-expand]');expanded.hidden=!expanded.hidden;button.setAttribute('aria-expanded',String(!expanded.hidden));button.textContent=expanded.hidden?'选段 / 控制':'收起控制';};
  box.querySelector('[data-compact-play]').onclick=()=>controller.getState().playing?controller.pause():controller.play();
  box.querySelector('[data-seek]').oninput=e=>controller.seek(+e.target.value);
  box.querySelector('[data-show]').onclick=()=>{panel.hidden=false;focusEvidence();};
  box.querySelector('[data-play]').onclick=()=>controller.getState().playing?controller.pause():controller.play();
  box.querySelector('[data-stop]').onclick=()=>controller.stop();box.querySelector('[data-prev]').onclick=controller.previous;box.querySelector('[data-next]').onclick=controller.next;
  box.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>controller.jump(b.dataset.jump));
  const scope=box.querySelector('[data-scope]');scope.onchange=()=>{controller.stop();const custom=scope.value==='custom';box.querySelector('[data-custom]').hidden=!custom;box.querySelectorAll('[data-pick]').forEach(c=>c.hidden=!custom);if(!custom)controller.setQueue(items.filter(i=>scope.value==='all'||i.kind===(scope.value==='chapters'?'chapter':'figure')).map(i=>i.id));};
  box.querySelector('[data-apply]').onclick=()=>controller.setQueue([...box.querySelectorAll('[data-pick]:checked')].map(c=>c.dataset.pick));
  const manual=()=>{if(!ownChange){evidenceValid=false;panel.hidden=true;controller.stop('地图或阅读上下文已改变，已停止讲解');controller.selectChapter(story.getState().stage);}};
  bindExpertNarrationLifecycle({events:window,document,stop:controller.stop,onContextChange:manual,onModeChange(){box.hidden=host.dataset.readingMode!=='expert';}});
  // Capture user map/date/tool changes before their async state mutations start.
  document.addEventListener('click',e=>{if(!isPassiveEvidenceInteraction(e.target)&&!box.contains(e.target)&&!panel.contains(e.target)&&e.target.closest?.('button,select,input')&&!e.target.closest('.sg-sidebar'))manual();},true);
  document.addEventListener('input',e=>{if(!isPassiveEvidenceInteraction(e.target)&&!box.contains(e.target)&&e.target.closest?.('input,select'))manual();},true);
  host.querySelector('.px-canvases').addEventListener('pointerdown',manual);host.querySelector('.px-canvases').addEventListener('wheel',manual,{passive:true});
  const expert={...controller,items,resolveFigure:figure=>resolveNarrationFigure(items,figure),async playFigure(id){
   if(window.lakeSimpleGuide.getState().mode!=='expert')await window.lakeSimpleGuide.setMode('expert');
   const q=controller.getState().queue;if(!q.includes(id))controller.setQueue([...q,id]);
   await controller.jump(id,{play:true});
  },decorateFigureDialog(dialog,figure){attachEvidenceNarrationControls(dialog,{figure,expert,getSimple:()=>window.lakeSimpleGuide});}};
  window.lakeExpertNarration=expert;
  const disconnectViewers=observeEvidenceViewers({expert,getSimple:()=>window.lakeSimpleGuide});window.addEventListener('pagehide',disconnectViewers,{once:true});
  controller.setQueue(items.map(i=>i.id));controller.selectChapter(story.getState().stage);box.hidden=host.dataset.readingMode!=='expert';
 }catch(error){box.innerHTML='<h3>专业讲解</h3><p>'+esc(error.message)+'。现有地图与报告仍可使用。</p>';}
}
