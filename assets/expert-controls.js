// Reorganize existing controls without duplicating app state or event handlers.
export function initExpertControls(){
 const host=document.getElementById('process-explorer'),app=window.lakeProcess;
 if(!host||!app||document.getElementById('expert-tools-panel'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href='assets/expert-controls.css';document.head.append(css);
 initExpertTransitionGuard(host,app);
 host.classList.add('expert-controls-ready');host.dataset.readingMode ||= 'expert';
 const toolbar=host.querySelector('.px-map-toolbar'),nav=host.querySelector('.story-stage-nav');
 const panel=document.createElement('aside');panel.id='expert-tools-panel';panel.hidden=true;panel.setAttribute('aria-label','更多分析工具');
 panel.innerHTML='<div class="expert-panel-heading"><h2>更多分析工具</h2><button id="expert-tools-close" aria-label="关闭更多分析工具">关闭 ×</button></div><p class="expert-panel-intro">先选要回答的问题，再打开需要的工具。设置会保留在当前地图中。</p><div class="expert-tool-sections"></div>';
 host.append(panel);
 const sections=new Map();
 for(const [id,title] of [['analysis','分析专题'],['map','地图显示'],['time','精细时间设置'],['evidence','原件与数据依据'],['reports','报告与复算']]){const section=document.createElement('section');section.dataset.expertSection=id;const heading=document.createElement('h3');heading.textContent=title;section.append(heading);const row=document.createElement('div');row.className='expert-tool-grid';section.append(row);panel.querySelector('.expert-tool-sections').append(section);sections.set(id,row);}
 function move(selector,section){const el=host.querySelector(selector)||document.querySelector(selector);if(el&&!panel.contains(el))sections.get(section).append(el);return el;}
 function organize(){
  for(const q of ['.story-tools','#native-spatial-tools','#access-open'])move(q,'analysis');
  for(const q of ['#px-fit','#px-camera','#native-dsm','#native-toggle','#native-profile','#unified-layers','#visual-settings-open','.px-basemap'])move(q,'map');
  for(const q of ['#px-clock-open','#px-time-options'])move(q,'time');
  for(const q of ['#native-source','#historical-source-tools','#story-board-open','#evidence-tools-open','#story-more','#px-about'])move(q,'evidence');
  for(const q of ['#px-report','#px-archive','#px-legacy','#px-interpret','#px-data-core'])move(q,'reports');
  // Keep future optional buttons reachable instead of clipping the toolbar.
  for(const el of [...toolbar.children])if(!el.matches('#px-animate,.px-view-buttons,#expert-date-control,#expert-more-toggle'))sections.get('map').append(el);
  for(const section of panel.querySelectorAll('[data-expert-section]'))section.hidden=sections.get(section.dataset.expertSection).children.length===0;
  const data=document.getElementById('px-data-core');if(data){data.textContent='数据与复算';data.title='下载数据、方法说明与独立重建接口';}
  const archive=document.getElementById('px-archive');if(archive)archive.textContent='研究图件';
  const versions=document.getElementById('px-legacy');if(versions)versions.textContent='历史报告与修订';
 }
 const dateLabel=document.createElement('label');dateLabel.id='expert-date-control';dateLabel.innerHTML='<span>年月</span><button id="expert-current-month" type="button" aria-label="选择地图年月，打开观测时间轴"></button><span id="expert-date-status" class="sr-only"></span>';
 const more=document.createElement('button');more.id='expert-more-toggle';more.textContent='更多工具';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls',panel.id);
 toolbar.append(dateLabel,more);toolbar.prepend(document.getElementById('px-animate'));
 const input=dateLabel.querySelector('button');const monthLabel=d=>d.slice(0,4)+'年'+Number(d.slice(5))+'月 ▾';input.textContent=monthLabel(app.state.date);input.onclick=()=>window.lakeObservationTimeline?.open?.();
 function open(){panel.hidden=false;more.setAttribute('aria-expanded','true');host.classList.add('expert-tools-open');document.getElementById('expert-tools-close').focus();}
 function close({focus=false}={}){panel.hidden=true;more.setAttribute('aria-expanded','false');host.classList.remove('expert-tools-open');if(focus)more.focus();}
 more.onclick=()=>panel.hidden?open():close();document.getElementById('expert-tools-close').onclick=()=>close({focus:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden&&!document.querySelector('dialog[open]')){e.preventDefault();close({focus:true});}});
 panel.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&['access-open','story-more','story-board-open','px-report','px-archive','px-legacy','px-interpret','evidence-tools-open','observation-records-open'].includes(button.id))close();});
 if(nav){const wrapper=document.createElement('div');wrapper.className='expert-chapter-nav';const left=document.createElement('button'),right=document.createElement('button');left.className=right.className='expert-nav-arrow';left.textContent='‹';right.textContent='›';left.setAttribute('aria-label','向前查看章节');right.setAttribute('aria-label','向后查看章节');nav.before(wrapper);wrapper.append(left,nav,right);const hint=document.createElement('small');hint.className='expert-chapter-hint';hint.textContent='9个章节 · 左右滑动或点箭头';wrapper.after(hint);const sync=()=>{left.disabled=nav.scrollLeft<2;right.disabled=nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-2;};left.onclick=()=>nav.scrollBy({left:-Math.max(240,nav.clientWidth*.65),behavior:'smooth'});right.onclick=()=>nav.scrollBy({left:Math.max(240,nav.clientWidth*.65),behavior:'smooth'});nav.addEventListener('scroll',sync,{passive:true});new ResizeObserver(sync).observe(nav);requestAnimationFrame(sync);}
 const legend=document.createElement('button');legend.id='expert-evidence-key';legend.textContent='● 观测　◆ 推导　◌ 示意　· 图示不等于可用地 · 依据';legend.title='这些图来自哪里？各自能说明什么？';host.querySelector('.px-map-area').append(legend);
 legend.onclick=()=>{const d=document.createElement('dialog');d.className='expert-source-dialog';const h=document.createElement('h2');h.textContent='这张地图的资料依据';const x=document.createElement('button');x.textContent='关闭';x.onclick=()=>d.close();const head=document.createElement('div');head.className='dialog-head';head.append(h,x);d.append(head);for(const text of ['● 观测：卫星影像或分类记录。缺测保留空白。','◆ 推导：由地形或统计关系算出的分析结果。','◌ 示意：用于讲解过程的动态效果。','面积变化帮助定位需要关注的范围；实地可用性还需现场确认。',host.querySelector('[data-px-dates]')?.textContent,document.getElementById('px-background-label')?.textContent,document.getElementById('native-spatial-caption')?.textContent].filter(Boolean)){const p=document.createElement('p');p.textContent=text;d.append(p);}d.onclose=()=>d.remove();document.body.append(d);d.showModal();};
 const sync=()=>{input.textContent=monthLabel(app.state.date);const original=host.querySelector('[data-px-dates]');if(original)original.title=original.textContent;const detail=document.getElementById('native-spatial-caption');if(detail)detail.title=detail.textContent;};
 window.addEventListener('lake-story-stage',()=>{close();sync();});window.addEventListener('lake-process-rendered',sync);
 const headerNav=host.querySelector('.px-header nav');if(headerNav)new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&n.id==='px-data-core')))organize();}).observe(headerNav,{childList:true});
 const plainLabels=()=>{const auto=document.getElementById('attention-auto'),shore=document.getElementById('attention-shore');if(auto)auto.textContent='自动移动地图：'+(auto.getAttribute('aria-pressed')==='true'?'开':'关');if(shore&&shore.textContent==='近岸虚拟机位')shore.textContent='站在岸边看（三维）';};host.addEventListener('click',()=>queueMicrotask(plainLabels));window.addEventListener('lake-story-stage',plainLabels);plainLabels();organize();sync();window.lakeExpertTools={open,close,refresh:organize,getState:()=>({open:!panel.hidden,month:app.state.date})};
}

// Shield all date-dependent assertions until the actual scene generation is ready.
export function initExpertTransitionGuard(host,app){
 const area=host.querySelector('.px-canvases');
 const veil=document.createElement('div');veil.id='expert-transition-veil';veil.setAttribute('role','status');
 const message=document.createElement('p'),retry=document.createElement('button');retry.textContent='重试当前地图';retry.hidden=true;
 veil.append(message,retry);area.append(veil);
 let generation=0,timer=null;
 const current=g=>generation===g;
 function begin(){
  const g=++generation;clearTimeout(timer);host.dataset.expertTransition='loading';
  message.textContent='正在准备当前章节与年月的地图…';retry.hidden=true;
  const fail=()=>{if(!current(g))return;clearTimeout(timer);host.dataset.expertTransition='error';message.textContent='当前地图尚未就绪，旧画面已隐藏。可以重试，或切换章节 / 年月。';retry.hidden=false;};
  timer=setTimeout(fail,35000);
  // Capture state after synchronous chapter/date normalization, never await inside renderTheme.
  Promise.resolve().then(async()=>{
   if(!current(g))return;
   const token=app.state.token,date=app.state.date,stage=window.lakeStory?.getState?.().stage;
   try{
    const ready=await app.whenSceneReady({date,stage,isCurrent:()=>current(g)&&app.state.token===token});
    if(!current(g))return;
    if(!ready){fail();return;}
    clearTimeout(timer);delete host.dataset.expertTransition;retry.hidden=true;
   }catch{fail();}
  });
 }
 retry.onclick=()=>app.renderTheme();
 window.addEventListener('lake-process-preparing',begin);
 // Native-only chapter and mode updates also need a readiness barrier.
 window.addEventListener('lake-story-stage',begin);
 window.addEventListener('lake-reading-mode',begin);
 if(app.state.renderPending)begin();
 return {begin,getState:()=>({generation,status:host.dataset.expertTransition||'ready'})};
}
