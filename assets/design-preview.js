import {initUnifiedAtlas} from './unified-atlas.js';
import {bindEntryLink} from './entry-links.js';
// Formal homepage and backward-compatible preview. Scientific state and atomic transitions stay owned
// by the existing simple-guide controller, including URL/history restoration.
function atlasMapNote(topic){
 const controls='拖动地图查看位置，滚轮或双指缩放。';
 const notes=[
  '蓝色水域与橙色历史边界用于同月对比；缺测不代表没有水。',
  '三块草地是固定比较窗口；绿度用于比较植被表现，不等同于草量或牧草品质。缺测不当作零。',
  '箭头表示地形推导的潜在下降方向，不是现场观测的水流；实际来水、流路与出口仍需核查。默认突出关键点，放大地图可看其余标注。'
 ];
 return controls+notes[topic];
}
// Measure only real content (the sticky hint must not create its own overflow).
function atlasCaptionOverflow(caption,hint,desktop){
 const overflow=desktop&&caption.clientHeight>0&&caption.scrollHeight-(hint.hidden?0:hint.offsetHeight)>caption.clientHeight+2;
 return {overflow,atEnd:caption.scrollTop+caption.clientHeight>=caption.scrollHeight-3};
}
function installCaptionScrollHint(caption){
 caption.tabIndex=0;caption.setAttribute('aria-label','当前幕次说明，可滚动阅读');
 const hint=document.createElement('button');hint.type='button';hint.className='atlas-caption-more';hint.hidden=true;hint.textContent='向下查看其余说明 ↓';caption.append(hint);
 const desktop=window.matchMedia('(min-width:761px)');let queued=false;
 const update=()=>{
  queued=false;const state=atlasCaptionOverflow(caption,hint,desktop.matches);
  if(hint.hidden===state.overflow)hint.hidden=!state.overflow;
  // Keep its footprint at the end: removing it would change the scroll limit
  // and make the bottom affordance reappear in a resize/scroll loop.
  const exhausted=!state.overflow||state.atEnd;
  hint.dataset.exhausted=String(exhausted);hint.tabIndex=exhausted?-1:0;
  hint.setAttribute('aria-hidden',String(exhausted));
  if(exhausted&&document.activeElement===hint)caption.focus({preventScroll:true});
 };
 const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update);}};
 hint.onclick=()=>caption.scrollTo({top:caption.scrollTop+Math.max(120,caption.clientHeight*.65),behavior:'auto'});
 caption.addEventListener('scroll',schedule,{passive:true});
 const resize=new ResizeObserver(schedule);resize.observe(caption);
 // Observe content boxes too: wrapping / asynchronous labels can change overflow.
 for(const child of caption.children)if(child!==hint)resize.observe(child);
 const mutations=new MutationObserver(schedule);mutations.observe(caption,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-comparison']});
 desktop.addEventListener('change',schedule);window.addEventListener('lake-simple-committed',()=>{caption.scrollTop=0;schedule();});
 window.addEventListener('pagehide',()=>{resize.disconnect();mutations.disconnect();desktop.removeEventListener('change',schedule);},{once:true});
 schedule();
}
function enhanceAtlas(){
 const host=document.getElementById('process-explorer'),guide=window.lakeSimpleGuide;
 if(!host||!guide||host.dataset.atlasEnhanced)return;
 host.dataset.atlasEnhanced='true';
 const header=host.querySelector('.sg-header');
 header.querySelector('.sg-eyebrow').textContent='呼伦贝尔 · 碱泡子';
 header.querySelector('h1').textContent='呼吉尔诺尔';
 const subtitle=document.createElement('p');subtitle.className='atlas-subtitle';subtitle.textContent='湖泊与草地前期研究';header.firstElementChild.append(subtitle);
 const links=document.createElement('nav');links.className='atlas-links';links.setAttribute('aria-label','版本与模式');
 const original=document.createElement('a');original.textContent='对照旧版';bindEntryLink(original,'original.html',()=>({mode:'simple',index:guide.getState().index}));links.append(original,document.getElementById('sg-expert'));header.append(links);
 const sidebar=host.querySelector('.sg-sidebar');sidebar.setAttribute('aria-label','六幕地图讲解');
 const steps=document.createElement('nav');steps.className='atlas-steps';steps.setAttribute('aria-label','选择讲解幕次');
 const labels=['2021 水边','2024 对比','三块草地','换年比较','地势方向','比较选择'];
 labels.forEach((label,index)=>{const b=document.createElement('button');b.type='button';b.className='atlas-step';b.innerHTML='<span>'+String(index+1).padStart(2,'0')+'</span><b>'+label+'</b>';b.setAttribute('aria-label','第'+(index+1)+'幕：'+guide.frames[index].title);b.onclick=()=>guide.show(index);steps.append(b);});
 sidebar.prepend(steps);
 const playback=sidebar.querySelector('.sg-playback');
 playback.querySelector('.sg-progress>span:last-child').textContent='六幕地图讲解';
 const controls=document.createElement('div');controls.className='atlas-transport';
 const prev=document.createElement('button');prev.id='atlas-prev';prev.type='button';prev.textContent='上一幕';prev.onclick=()=>guide.show(guide.getState().index-1);
 const next=document.createElement('button');next.id='atlas-next';next.type='button';next.textContent='下一幕';next.onclick=()=>guide.show(guide.getState().index+1);
 controls.append(prev,document.getElementById('sg-play'),next);playback.prepend(controls);
 const voice=document.createElement('div');voice.className='atlas-voice';
 voice.innerHTML='<span>合成语音</span><button type="button" id="atlas-mute" aria-pressed="false">静音</button><p id="atlas-voice-status" role="status" aria-live="polite"></p>';
 playback.append(voice);
 const voiceStatus=voice.querySelector('p'),mute=voice.querySelector('button');
 const messages={idle:'点语音讲解开始；切换幕次会停止语音。',preparing:'地图准备好后开始语音。',loading:'正在载入语音…',playing:'正在讲解；本幕结束后进入下一幕。',paused:'已暂停，继续将从原位置播放。',complete:'六幕讲解结束，可自由查看。',unavailable:'这幕语音尚未就绪，可用上一幕／下一幕查看。','load-error':'语音未能载入，请点语音讲解重试，或手动查看。',blocked:'浏览器阻止了语音，请再次点语音讲解。','scene-error':'这幕地图未准备好，请先重新载入。','comparison-unavailable':'历史边界未载入，已停止语音；可重试讲解或手动查看。'};
 const updateVoice=s=>{voiceStatus.textContent=s.status==='preparing'?(s.playing?'地图准备好后继续语音。':'正在准备地图，语音已停止。'):s.status==='playing'&&s.index===s.total-1?'正在讲解最后一幕，结束后停止。':(messages[s.status]||messages.idle);mute.setAttribute('aria-pressed',String(!!s.muted));mute.textContent=s.muted?'取消静音':'静音';};
 mute.onclick=()=>guide.setMuted?.(!guide.getState().muted);
 window.addEventListener('lake-narration-state',event=>updateVoice(event.detail));updateVoice(guide.getState());
 // Evidence viewers are passive: their own controls share the live narration.
 window.addEventListener('pagehide',()=>guide.stop());
 original.addEventListener('click',()=>guide.stop());
 const caption=host.querySelector('.sg-map-caption');
 const evidence=document.getElementById('sg-evidence');caption.append(evidence);
 const note=document.createElement('p');note.className='atlas-map-note';caption.append(note);
 installCaptionScrollHint(caption);
 // Update explanatory map text only from a fully committed frame, never pendingIndex.
 const updateCommittedNote=()=>{note.textContent=atlasMapNote(guide.frames[guide.getState().index].topic);};
 window.addEventListener('lake-simple-committed',updateCommittedNote);updateCommittedNote();
 const originalUpdate=()=>{const s=guide.getState();steps.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-current',i===s.index?'step':'false');b.disabled=s.busy;});prev.disabled=s.busy||s.index===0;next.disabled=s.busy||s.index===guide.frames.length-1;};
 // Observe only controller-owned text/attributes; never create a second clock.
 new MutationObserver(originalUpdate).observe(document.getElementById('sg-play'),{attributes:true,attributeFilter:['disabled','aria-pressed'],childList:true});
 window.addEventListener('lake-simple-committed',originalUpdate);originalUpdate();
 window.addEventListener('lake-simple-committed',()=>{const active=steps.querySelector('[aria-current=step]');if(active&&steps.scrollWidth>steps.clientWidth){const left=active.offsetLeft-steps.offsetLeft;if(left<steps.scrollLeft)steps.scrollLeft=left;else if(left+active.offsetWidth>steps.scrollLeft+steps.clientWidth)steps.scrollLeft=left+active.offsetWidth-steps.clientWidth;}});
 // The existing controller owns mode changes, URL state and narration stopping.
 // Do not replace sg-expert.onclick: it already calls guide.setMode('expert').
 initUnifiedAtlas(host,guide);
 requestAnimationFrame(()=>window.lakeProcess.scene.resizeViews());
}
if(document.documentElement.dataset.lakeReady==='true')enhanceAtlas();else window.addEventListener('lake-ready',enhanceAtlas,{once:true});
