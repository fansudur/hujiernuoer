// Passive evidence inspection shares existing transports; it never owns media.
export function isPassiveEvidenceInteraction(target){
 return !!target?.closest?.('[data-narration-viewer],.evidence-full,#canonical-evidence,.sg-evidence-dialog,[data-passive-evidence],#story-image-full,[data-figure-index],#story-board-open,#story-board-close,#story-board-size,#atlas-chapter-evidence,#story-more,#sg-evidence,#story-text-full,#px-report,#px-archive,#expert-more-toggle,#expert-tools-close,#px-interpret,#story-reading-dialog');
}
export function evidencePlaybackView({mode,simple,expert,items=[],viewedId=null,viewedTitle=''}){
 const s=mode==='simple'?simple:expert,item=mode==='simple'?null:items.find(i=>i.id===s?.id);
 const playingTitle=mode==='simple'?`简明第 ${(s?.index??0)+1} 幕`:item?.title||'尚未选择讲解';
 return {state:s||{},playingTitle,viewedTitle,matched:mode==='expert'&&!!viewedId&&viewedId===s?.id};
}
export function attachEvidenceNarrationControls(dialog,{figure=null,expert,getSimple,events=window,documentImpl=document}={}){
 if(dialog.querySelector('.en-viewer-controls'))return;
 dialog.dataset.narrationViewer='true';
 const item=figure?expert.resolveFigure(figure):null,bar=documentImpl.createElement('section');bar.className='en-viewer-controls';bar.setAttribute('aria-label','边看原图边听讲解');
 bar.innerHTML='<p data-viewed></p><p data-listening role="status" aria-live="polite"></p><div class="en-viewer-transport"><button data-prev>上一段</button><button data-toggle>播放</button><button data-next>下一段</button><button data-stop>停止</button></div><label data-seek-label>当前语音进度 <input data-seek type="range" min="0" max="1" step="0.1" disabled aria-label="当前语音播放位置"><output data-time></output></label><button data-listen-figure></button> <button data-close-viewer>收起原图 / 资料</button><p class="en-viewer-note">放大图保持你选择的这一张；连续播放不会替换它。查看、收起原图不会停止语音。</p>';
 (dialog.querySelector('.dialog-head,.sg-dialog-head')||dialog.firstElementChild).after(bar);
 const current=()=>{const simple=getSimple();return {simple,mode:simple?.getState().mode||'expert'};};
 const update=()=>{
  const {simple,mode}=current(),v=evidencePlaybackView({mode,simple:simple?.getState(),expert:expert.getState(),items:expert.items,viewedId:item?.id,viewedTitle:figure?.title||'研究资料'}),s=v.state;
  bar.querySelector('[data-viewed]').textContent='正在查看：'+v.viewedTitle;
  const listening=(s.playing?'正在讲解：':s.status==='paused'?'已暂停：':'当前讲解：')+v.playingTitle+(figure?(v.matched?' · 与此图一致':' · 与所看图分开，不自动换图'):'');const statusNode=bar.querySelector('[data-listening]');if(statusNode.textContent!==listening)statusNode.textContent=listening;
  const toggle=bar.querySelector('[data-toggle]');toggle.textContent=s.playing?'暂停':'播放 / 继续';toggle.disabled=!!s.busy;
  bar.querySelector('[data-prev]').disabled=s.index<=0||!!s.busy;bar.querySelector('[data-next]').disabled=s.index>=(mode==='simple'?s.total:s.queue?.length)-1||!!s.busy;
  const seek=bar.querySelector('[data-seek]');seek.disabled=mode!=='expert'||!s.duration;seek.max=String(s.duration||1);if(documentImpl.activeElement!==seek)seek.value=String(s.currentTime||0);
  const fmt=t=>Math.floor((t||0)/60)+':'+String(Math.floor((t||0)%60)).padStart(2,'0');bar.querySelector('[data-time]').textContent=mode==='expert'&&s.duration?fmt(s.currentTime)+' / '+fmt(s.duration):mode==='simple'?'简明讲解可暂停或继续':'— / —';
  const listen=bar.querySelector('[data-listen-figure]');listen.hidden=!figure;listen.disabled=!item;listen.textContent=item?'切换为这张图的讲解（保留放大图）':'此图没有本批独立配音；可继续听当前讲解';
 };
 bar.querySelector('[data-toggle]').onclick=()=>{const {simple,mode}=current();if(mode==='simple')simple.toggle();else expert.getState().playing?expert.pause():expert.play();update();};
 bar.querySelector('[data-stop]').onclick=()=>{const {simple,mode}=current();(mode==='simple'?simple:expert).stop();update();};
 for(const direction of ['prev','next'])bar.querySelector('[data-'+direction+']').onclick=()=>{const {simple,mode}=current();if(mode==='simple'){const s=simple.getState();simple.show(s.index+(direction==='prev'?-1:1),{continuePlay:s.playing});}else expert[direction==='prev'?'previous':'next']();};
 bar.querySelector('[data-seek]').oninput=e=>expert.seek(+e.target.value);
 bar.querySelector('[data-close-viewer]').onclick=()=>dialog.close();
 bar.querySelector('[data-listen-figure]').onclick=()=>item&&expert.playFigure(item.id);
 const names=['lake-expert-narration-state','lake-narration-state','lake-reading-mode'];for(const name of names)events.addEventListener(name,update);
 dialog.addEventListener('close',()=>{for(const name of names)events.removeEventListener(name,update);bar.remove();},{once:true});update();
}
export function observeEvidenceViewers(options){
 const {documentImpl=document}=options;
 const scan=()=>documentImpl.querySelectorAll('dialog[open]').forEach(d=>{if(d.matches('.evidence-full,#canonical-evidence,.sg-evidence-dialog,#story-reading-dialog'))attachEvidenceNarrationControls(d,options);});
 const observer=new MutationObserver(scan);observer.observe(documentImpl.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});scan();return ()=>observer.disconnect();
}
