// A small reading layer over the same scientific app. No duplicate data or map clock.
export const GUIDE_TOPICS=[
 {id:'shore',title:'岸线在变，活动边界要留余地',summary:'两年7月检出明水约100和132公顷，岸边使用要看多期范围。'},
 {id:'grass',title:'草地有差别，分开看更有用',summary:'固定窗口里，西侧草地更绿；护草、去盐、饮水分别比较。'},
 {id:'runoff',title:'先看地势，再比较怎么治',summary:'把办公院、坡面和近湖低处一起看，比较护草与减缓冲刷。'}
];
export const GUIDE_FRAMES=[
 {topic:0,stage:'shore',date:'2021-07',title:'先看 2021 年 7 月的水边',text:'固定统计范围内，当月检出明水100.13公顷。蓝色范围和边线表示这期水域，下一幕比较另一年的同一个月份。',kind:'● 遥感记录',focus:{id:'simple-shore',label:'看这期水域边界',layers:['water','traces'],anchor:[119.6916,49.1328],span_km:3.5,dim:.14}},
 {topic:0,stage:'shore',date:'2024-07',title:'再看 2024 年 7 月',text:'当月检出明水132.14公顷，比2021年7月多约32公顷。橙线保留2021年位置，供判断岸边活动与设施要留多少变化余地。',kind:'● 遥感记录',focus:{id:'simple-shore',label:'比较同月岸线位置',layers:['water','traces'],anchor:[119.6916,49.1328],span_km:3.5,dim:.14}},
 {topic:1,stage:'production',date:'2024-07',title:'这三块草地，是固定的比较窗口',text:'2024年7月，西侧窗口绿度0.57，高于北侧0.41和南侧0.47。绿度就是卫星看到的植被有多绿，能帮助比较不同位置的植被表现。',kind:'● 遥感记录',focus:{id:'simple-grass',label:'比较三块固定草地',feature_ids:['grass-N','grass-W','grass-S'],chart_ids:['grass-N*','grass-W*','grass-S*'],layers:[],anchor:[119.685,49.135],span_km:4,dim:.14}},
 {topic:1,stage:'production',date:'2025-07',title:'换到另一年的同一个月份',text:'2025年7月，北、西、南三个窗口绿度约0.56、0.63、0.52，均高于前一年同月。固定窗口让变化可比较，护草优先位置可据此讨论。',kind:'● 遥感记录',focus:{id:'simple-grass',label:'同位置、同月份比较',feature_ids:['grass-N','grass-W','grass-S'],chart_ids:['grass-N*','grass-W*','grass-S*'],layers:[],anchor:[119.685,49.135],span_km:4,dim:.14}},
 {topic:2,stage:'runoff',date:'2024-07',title:'沿着高低关系看水可能往哪走',text:'蓝色箭头表示地形推导的潜在下降方向。结合办公院与近湖低处的位置，可定位哪些坡段值得重点比较冲刷和护草条件。',kind:'◆ 地形推导',focus:{id:'simple-runoff',label:'看坡面与下降方向',feature_ids:['inflow-*','local-office'],layers:['paths'],anchor:[119.682,49.145],span_km:5,dim:.14}},
 {topic:2,stage:'runoff',date:'2024-07',title:'把分析变成可比较的选择',text:'三种方向解决的问题不同。点选卡片定位相关位置，比较适用条件与仍缺少的现场资料。',kind:'◆ 地形推导',focus:{id:'simple-runoff',label:'围绕场地条件比较方案',feature_ids:['inflow-*','local-office'],layers:['paths'],anchor:[119.682,49.145],span_km:5,dim:.14}}
];
export const GUIDE_OPTIONS=[
 {id:'protect',title:'护住草皮',where:'已有草被、容易踩踏或冲刷的外围坡面',condition:'先比较植被与放牧使用，保留现有草皮',missing:'草种、覆盖率、踩踏和冲刷的现场记录',feature:'grass-W'},
 {id:'slow',title:'减速分流',where:'地形显示可能汇水的上坡与浅沟段',condition:'先核清来水和出口，避免把水集中冲向下游',missing:'雨后流路、涵洞连通、流量与可施工条件',feature:'inflow-upstream_swale'},
 {id:'restore',title:'局部恢复',where:'经现场确认的裸地、受损边缘与低洼处',condition:'区分盐碱、软泥和积水原因，再做小范围试验',missing:'土壤盐分、含水状况、承载与植物适生性',feature:'inflow-downstream_band'}
];
// This controller can be tested without a browser, and owns only its guide timer.
export function createGuideController({applyFrame,onState=()=>{},onCommit=()=>{},onError=()=>{},frames=GUIDE_FRAMES,schedule=setTimeout,cancel=clearTimeout,delay=6500,reducedMotion=()=>false}){
 let index=0,pendingIndex=null,playing=false,busy=false,generation=0,timer=null,disposed=false;
 const emit=()=>onState({index,pendingIndex,playing,busy,total:frames.length});
 function stop(){++generation;playing=false;busy=false;pendingIndex=null;if(timer!==null)cancel(timer);timer=null;emit();}
 async function show(next,{continuePlay=false}={}){
  if(disposed)return;stop();const requested=Math.max(0,Math.min(frames.length-1,next));pendingIndex=requested;playing=continuePlay&&!reducedMotion();busy=true;const token=generation;emit();
  try{const applied=await applyFrame(frames[requested],requested,()=>!disposed&&generation===token);if(token===generation&&!disposed&&applied!==false){index=requested;pendingIndex=null;busy=false;emit();onCommit(frames[index],index);}else if(token===generation&&!disposed){playing=false;}}
  catch(error){if(token===generation){playing=false;onError(error);}}
  finally{if(token===generation&&!disposed){busy=false;pendingIndex=null;emit();if(playing)timer=schedule(()=>{if(token!==generation)return;if(index>=frames.length-1){stop();return;}show(index+1,{continuePlay:true});},delay);}}
 }
 function toggle(){if(playing){stop();return Promise.resolve();}if(reducedMotion())return show((index+1)%frames.length);return show(index>=frames.length-1?0:index,{continuePlay:true});}
 return {show,toggle,stop,getState:()=>({index,pendingIndex,playing,busy,total:frames.length}),dispose(){stop();disposed=true;}};
}
export async function initSimpleGuide(){
 const app=window.lakeProcess,story=window.lakeStory,scene=app?.scene,host=document.getElementById('process-explorer');if(!app||!story||!scene||!host)return;
 if(!document.querySelector('link[href="assets/simple-guide.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='assets/simple-guide.css';document.head.append(css);}
 const header=document.createElement('header');header.className='sg-header';header.innerHTML='<div><span class="sg-eyebrow">先看懂，再深入</span><h1>呼吉尔诺尔湖泊与草地 · 前期研究</h1></div><button id="sg-expert">进入专业分析 <span aria-hidden="true">↗</span></button>';host.prepend(header);
 const expertReturn=document.createElement('button');expertReturn.id='sg-return';expertReturn.textContent='返回简明讲解';host.querySelector('.px-header nav')?.prepend(expertReturn);
 const sidebar=document.createElement('aside');sidebar.className='sg-sidebar';sidebar.setAttribute('aria-label','三条核心结论');sidebar.innerHTML='<div class="sg-intro"><span>简明讲解</span><h2>先看三件事</h2><p>同一张地图，依次看变化、意义和可比较的方向。</p></div><div class="sg-topics">'+GUIDE_TOPICS.map((t,i)=>'<button class="sg-topic" data-sg-topic="'+i+'" aria-pressed="false"><span class="sg-number">0'+(i+1)+'</span><span><b>'+t.title+'</b><small>'+t.summary+'</small></span></button>').join('')+'</div><div class="sg-playback"><button id="sg-play" aria-pressed="false">▶ 播放重点讲解</button><div class="sg-progress"><span id="sg-progress"></span><span>可点结论直接看</span></div><div class="sg-progress-track"><i id="sg-progress-fill"></i></div></div><button id="sg-evidence">这些结论依据什么？</button>';host.querySelector('.px-workspace').prepend(sidebar);
 const caption=document.createElement('section');caption.className='sg-map-caption';caption.setAttribute('aria-live','polite');caption.innerHTML='<div><span id="sg-evidence-kind"></span><span id="sg-date"></span></div><h2 id="sg-frame-title"></h2><p id="sg-frame-text"></p><small id="sg-image-date"></small><section id="sg-options" aria-label="三种方向比较" hidden></section>';host.querySelector('.px-map-area').append(caption);
 const $=id=>document.getElementById(id);let mode='expert',applying=0,current=GUIDE_FRAMES[0],expertState=null,transition=0,pendingFrame=0;
 const veil=document.createElement('div');veil.className='sg-transition-veil';veil.hidden=true;veil.setAttribute('role','status');veil.innerHTML='<b>正在准备下一幕…</b><span>地图、日期与说明准备好后一起显示</span><button id="sg-retry" hidden>重新载入这一幕</button>';host.querySelector('.px-map-area').append(veil);
 const afterPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 function beginTransition(){const ticket=++transition;veil.dataset.failed='false';veil.hidden=false;veil.querySelector('b').textContent='正在准备下一幕…';$('sg-retry').hidden=true;host.dataset.guideLoading='true';return ticket;}
 function finishTransition(ticket){if(ticket!==transition||mode!=='simple')return;host.dataset.guideLoading='false';veil.hidden=true;}
 function showComparison(frame){const box=$('sg-options');box.hidden=frame!==GUIDE_FRAMES[5];caption.dataset.comparison=String(!box.hidden);if(box.hidden){box.replaceChildren();return;}box.innerHTML=GUIDE_OPTIONS.map((o,i)=>'<button class="sg-option" data-sg-option="'+i+'" aria-pressed="false"><b>'+o.title+'</b><span><strong>适合哪里</strong>'+o.where+'</span><span><strong>前提</strong>'+o.condition+'</span><span><strong>还缺什么</strong>'+o.missing+'</span></button>').join('')+'<small class="sg-option-note">定位仅用于比较相关场地条件，不是施工分区。</small>';box.querySelectorAll('[data-sg-option]').forEach(button=>button.onclick=()=>{guide.stop();const option=GUIDE_OPTIONS[+button.dataset.sgOption],feature=window.lakeNative?.features?.features?.find(f=>f.properties.id===option.feature);const native=window.lakeNative?.lastSpec;if(native){const features=[...native.features];if(feature&&!features.some(f=>f.properties.id===feature.properties.id))features.push({...feature,properties:{...feature.properties,label:'西侧固定草地比较窗',labelVisible:true,fill:false,color:'#3c8154'}});scene.setNativeSpatial({...native,features});}let coords=feature?.geometry?.coordinates;while(Array.isArray(coords?.[0]?.[0]))coords=coords[0];const anchor=feature?.geometry?.type==='Point'?coords:Array.isArray(coords?.[0])?[coords.reduce((n,c)=>n+c[0],0)/coords.length,coords.reduce((n,c)=>n+c[1],0)/coords.length]:frame.focus.anchor;const focus={...frame.focus,id:'simple-choice-'+option.id,label:option.title+' · 比较相关场地',anchor,span_km:3,feature_ids:[option.feature],layers:option.id==='slow'?['paths']:[]};scene.setAttention(focus);scene.flyAttention(focus,{restoreFromFit:true});box.querySelectorAll('[data-sg-option]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});}

 const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function stopAll(){app.stop();window.lakeEvidenceTools?.stop();window.lakeNative?.stop?.();scene.cancelAttentionFlight?.('reading-mode');}
 function closePanels(){window.lakeAccess?.close?.();window.lakeExpertTools?.close?.();const close=document.getElementById('story-board-close');if(story.getState().boardOpen)close?.click();for(const dialog of document.querySelectorAll('dialog[open]:not([data-narration-viewer])'))dialog.close();}
 function imageStamp(force=false){if(mode!=='simple'||(!force&&(applying||!veil.hidden)))return;const im=scene.satelliteSpec;if(scene.satelliteError)$('sg-image-date').textContent='该期影像暂未加载成功；水域与草地数据有各自来源。';else if(im?.date&&im.date.startsWith(app.state.date))$('sg-image-date').textContent='实拍 '+im.date+'｜定位底图 '+(scene.contextSpec?.date||'未加载');else $('sg-image-date').textContent='无当月实拍｜定位底图 '+(scene.contextSpec?.date||'未加载')+'，不代表当月';}
 async function applyFrame(frame,_index,isCurrent){
  if(mode!=='simple')return false;pendingFrame=_index;const ticket=beginTransition();++applying;try{let comparisonReady=true;stopAll();closePanels();const stageIndex=story.story.stages.findIndex(s=>s.id===frame.stage);if(story.getState().stage!==frame.stage)story.selectStage(stageIndex);
  scene.setDSMDisplay?.(false);app.state.traces=true;app.state.changes=false;const traces=$('px-traces');if(traces)traces.checked=true;const changes=$('px-changes');if(changes)changes.checked=false;
  if(app.state.background!=='matched')await app.setBackground('matched');if(!isCurrent()||mode!=='simple'){return;}
  await app.setClockMonth(frame.date);if(!isCurrent()||mode!=='simple'){return false;}
  if(app.whenSceneReady&&await app.whenSceneReady({date:frame.date,stage:frame.stage,isCurrent})===false)return false;await afterPaint();if(!isCurrent()||mode!=='simple')return false;
  if(frame.topic===0&&scene.state.waterDate!==frame.date)throw Error('Selected water geometry not ready');
  app.view('top');scene.historyTimelineActive=false;window.lakeHistoricalSource?.setVisible(false);scene.cancelAttentionFlight?.('simple-frame');scene.setAttention(frame.focus);if(!(typeof document!=='undefined'&&document.body.classList.contains('lake-design-preview')&&reduced()))scene.flyAttention(frame.focus,{restoreFromFit:true});
  if(frame.topic===0&&frame.date==='2024-07'){const previous=app.index.samples.find(s=>s.date==='2021-07');try{const r=await fetch('data/linked/'+previous.water_geojson);if(!r.ok)throw Error('2021 comparison unavailable');const fc=await r.json();if(!isCurrent()||mode!=='simple')return;scene.setState({traces:[{date:'2021-07',area:previous.detected_water_ha,color:'#b45b0c',fc}]});}catch(error){comparisonReady=false;console.warn('Simple comparison trace unavailable',error);}}
  if(!isCurrent()||mode!=='simple')return false;
  await afterPaint();if(!isCurrent()||mode!=='simple')return false;
  current=frame;$('sg-frame-title').textContent=frame.title;$('sg-frame-text').textContent=comparisonReady?frame.text:frame.text.replace('橙线保留2021年位置，','2021年轮廓暂未载入；两期记录仍可');$('sg-evidence-kind').textContent=frame.kind;$('sg-date').textContent=frame.date.replace('-','年')+'月';imageStamp(true);showComparison(frame);scene.render?.();return {ticket,narrationReady:comparisonReady};}finally{--applying;}
 }
 const narrated=document.body.classList.contains('lake-design-preview');
 let segments=[];if(narrated){try{const response=await fetch('data/simple-narration.json');if(response.ok)segments=(await response.json()).segments||[];}catch(error){console.warn('Narration manifest unavailable',error);}}
 const guideFactory=narrated?(await import('./narrated-guide.js')).createNarratedGuideController:createGuideController;
 const guide=guideFactory({frames:GUIDE_FRAMES,segments,applyFrame,reducedMotion:reduced,onCommit(frame,index){finishTransition(transition);window.dispatchEvent(new CustomEvent('lake-simple-committed',{detail:{index,date:frame.date,stage:frame.stage}}));},onError(error){console.error('Simple guide frame failed',error);veil.dataset.failed='true';veil.querySelector('b').textContent='这幕资料暂未载入成功';$('sg-retry').hidden=false;},onState(s){if(!s.busy&&!veil.hidden&&veil.dataset.failed!=='true'){veil.querySelector('b').textContent='切换已暂停';$('sg-retry').hidden=false;}$('sg-play').textContent=s.busy?'正在准备地图…':s.playing?'Ⅱ 暂停讲解':reduced()?'下一幕 · 逐步查看':'▶ '+(s.index===s.total-1?'重新看重点':'播放重点讲解');$('sg-play').setAttribute('aria-pressed',String(s.playing));$('sg-play').disabled=s.busy;if(narrated){$('sg-play').textContent=s.busy?'正在准备地图…':s.playing?'Ⅱ 暂停语音':s.status==='paused'?'▶ 继续语音':s.status==='complete'?'▶ 重听六幕':'▶ 语音讲解';window.dispatchEvent(new CustomEvent('lake-narration-state',{detail:s}));}$('sg-progress').textContent=(s.index+1)+' / '+s.total+' 幕';$('sg-progress-fill').style.width=(s.index+1)/s.total*100+'%';sidebar.querySelectorAll('[data-sg-topic]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.sgTopic===GUIDE_FRAMES[s.index].topic)));}});
 async function setMode(next,{restore=false}={}){
  if(next===mode)return;guide.stop();stopAll();closePanels();
  if(next==='simple')expertState={stage:story.getState().index,date:app.state.date,view:app.state.view,background:app.state.background};
  mode=next;if(next==='expert'){++transition;veil.hidden=true;host.dataset.guideLoading='false';}host.dataset.readingMode=next;document.body.classList.toggle('lake-simple-mode',next==='simple');window.dispatchEvent(new CustomEvent('lake-reading-mode',{detail:{mode:next}}));
  if(next==='simple'){app.view('top');await guide.show(guide.getState().index);}else{scene.cancelAttentionFlight?.('expert-entry');window.lakeNative?.refresh?.(false);if(restore&&expertState){story.selectStage(expertState.stage);await app.setClockMonth(expertState.date);await app.setBackground(expertState.background);app.view(expertState.view);}else app.view('top');window.lakeExpertTools?.refresh?.();}
  requestAnimationFrame(()=>scene.resizeViews());
 }
 $('sg-retry').onclick=()=>guide.show(pendingFrame);
 $('sg-play').onclick=()=>guide.toggle();sidebar.querySelectorAll('[data-sg-topic]').forEach(b=>b.onclick=()=>guide.show(GUIDE_FRAMES.findIndex(f=>f.topic===+b.dataset.sgTopic)));$('sg-expert').onclick=()=>setMode('expert');expertReturn.onclick=()=>setMode('simple');
 $('sg-evidence').onclick=()=>{if(!document.body.classList.contains('lake-design-preview')){guide.stop();stopAll();}const d=document.createElement('dialog');d.className='sg-evidence-dialog';d.innerHTML='<div class="sg-dialog-head"><h2>先看结论，需要时再查依据</h2><button aria-label="关闭资料说明">关闭</button></div><p><b>● 遥感记录：</b>水域边界和草地绿度来自明确日期、固定范围的卫星资料。缺测不当作零。</p><p><b>◆ 地形推导：</b>下降方向依据已有地表高低模型，帮助筛查位置关系。</p><p><b>◌ 视觉演示：</b>播放顺序、强调色和箭头用于讲解，不新增现场测量。</p><p>本页是前期分析。岸边是否能走、饮水是否适合牲畜、修复怎么实施，需要各自的现场与专业依据。</p><button id="sg-open-records">查看历年水面记录</button><button id="sg-open-expert">进入完整专业分析</button><a href="research-core/index.html" target="_blank" rel="noopener">数据来源与复算资料</a>';document.body.append(d);d.querySelector('.sg-dialog-head button').onclick=()=>d.close();d.onclose=()=>d.remove();d.querySelector('#sg-open-expert').onclick=()=>{d.close();setMode('expert');};d.querySelector('#sg-open-records').onclick=async()=>{d.close();await setMode('expert');window.lakeObservationTimeline?.open?.();};d.showModal();};
 host.querySelector('.px-canvases').addEventListener('pointerdown',()=>{if(mode==='simple'&&(guide.getState().playing||guide.getState().busy))guide.stop();});
 host.querySelector('.px-canvases').addEventListener('wheel',()=>{if(mode==='simple'&&(guide.getState().playing||guide.getState().busy))guide.stop();},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){guide.stop();stopAll();}});
 window.addEventListener('lake-process-rendered',()=>{if(mode==='simple'&&!applying&&veil.hidden){imageStamp();scene.setAttention(current.focus);}});
 window.lakeSimpleGuide={setMode,toggle:guide.toggle,stop:guide.stop,getState:()=>({...guide.getState(),mode}),show:guide.show,setMuted:guide.setMuted,topics:GUIDE_TOPICS,frames:GUIDE_FRAMES};
 window.addEventListener('pagehide',()=>guide.stop());
 await setMode('simple');
}
