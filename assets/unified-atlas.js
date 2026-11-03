import {bindEntryLink,atlasReturnRoute} from './entry-links.js';
// Presentation only. All chapter, date, evidence and narration state remains
// in the original controllers; original.html never imports this module.
export function initUnifiedAtlas(host,guide){
 if(!document.body.classList.contains('lake-design-preview')||host.dataset.unifiedAtlas)return;
 host.dataset.unifiedAtlas='true';
 // Optional editorial narration must never block the existing atlas.
 void import('./expert-narration.js').then(m=>m.initExpertNarration(host)).catch(error=>console.warn('Expert narration unavailable',error));
 const css=document.createElement('link');css.rel='stylesheet';css.href='assets/unified-atlas.css';document.head.append(css);
 const header=host.querySelector('.px-header');
 header.querySelector('b').textContent='呼吉尔诺尔';
 header.querySelector('span').textContent='湖泊与草地 · 专业分析';
 const nav=header.querySelector('nav');nav.setAttribute('aria-label','阅读模式与资料');
 const original=document.createElement('a');original.textContent='对照旧版';bindEntryLink(original,'original.html',()=>({mode:'expert',chapter:window.lakeStory.getState().stage,month:window.lakeProcess.state.date}));nav.append(original);
 const report=document.createElement('button');report.type='button';report.dataset.passiveEvidence='true';report.textContent='查研究报告';report.onclick=()=>window.lakeReader.open();nav.append(report);
 const aside=host.querySelector('.px-story');aside.setAttribute('aria-label','当前问题与研究解释');aside.classList.add('mobile-expanded');
 // Move existing live nodes, not copied conclusions or a second state model.
 function disclose(label,nodes){
  const present=nodes.map(s=>aside.querySelector(s)).filter(Boolean);if(!present.length)return;
  const details=document.createElement('details');details.className='atlas-disclosure';
  const summary=document.createElement('summary');summary.textContent=label;details.append(summary,...present);aside.append(details);
 }
 disclose('逐步看地图与镜头操作',['#attention-director']);
 disclose('对生产生活的影响',['.px-meaning','#story-impacts','#story-examples']);
 const board=host.querySelector('.story-board');
 // Give original evidence board its own document row; never cover the lake.
 if(board){host.append(board);board.classList.add('atlas-evidence-board');}
 const evidence=document.createElement('button');evidence.type='button';evidence.id='atlas-chapter-evidence';evidence.textContent='查看本章原图与依据';
 evidence.onclick=()=>{document.getElementById('story-board-open').click();if(!board.hidden)board.scrollIntoView({block:'start',behavior:'auto'});};
 aside.append(evidence);
 const toolbar=host.querySelector('.px-map-toolbar');toolbar.setAttribute('aria-label','地图比较与时间工具');
 const sync=()=>{
  document.getElementById('atlas-chapter-evidence').setAttribute('aria-expanded',String(!board.hidden));
  requestAnimationFrame(()=>window.lakeProcess.scene.resizeViews());
 };
 window.addEventListener('lake-reading-mode',sync);
 // A new chapter starts with its question; monthly updates keep reading position.
 window.addEventListener('lake-story-stage',()=>{aside.scrollTop=0;sync();});
 new MutationObserver(()=>evidence.setAttribute('aria-expanded',String(!board.hidden))).observe(board,{attributes:true,attributeFilter:['hidden']});
 css.onload=sync;sync();
 // Explicit technical destination. Carry only our known same-site return route.
 function contextualize(root){
  const links=[...(root.matches?.('a[href="research-core/index.html"]')?[root]:[]),...root.querySelectorAll('a[href="research-core/index.html"]')];
  for(const link of links){
   const back=atlasReturnRoute(location.pathname,location.search);
   link.href='research-core/index.html?theme=atlas&return='+encodeURIComponent(back);
   link.textContent='数据目录与复算方法（技术资料）';
  }
 }
 contextualize(document.body);
 // Resolve return state at activation, after the existing share-state controller
 // has committed chapter/month or simple step. No stale initialization snapshot.
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href^="research-core/index.html"]');if(!link)return;
  const back=atlasReturnRoute(location.pathname,location.search);
  link.href='research-core/index.html?theme=atlas&return='+encodeURIComponent(back);
 },true);
 const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)contextualize(node);});
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 // Archived interfaces remain accessible; their original provenance is untouched.
 const versions=document.getElementById('px-legacy');
 if(versions)versions.onclick=()=>{
  guide.stop();const d=document.createElement('dialog');d.className='atlas-versions';
  d.innerHTML='<div class="dialog-head"><h2>当前表达与历史留档</h2><button type="button">关闭</button></div><p>当前为统一地图讲解：简明导览与专业分析共用研究数据。设计调整不改变研究记录，也不修改历史报告。</p><a class="version-card" data-original href="original.html">对照旧版地图讲解</a><a class="version-card" href="legacy.html?mode=basic">历史原讲解 · 保留原配音与当时表达</a><a class="version-card" href="legacy.html?mode=linked">历史多层地图表达</a><button type="button" data-history>查阅旧三册原文</button><p class="reader-alert">历史判断须结合最新报告的修订、撤回与降级记录阅读。</p>';
  const unbind=bindEntryLink(d.querySelector('[data-original]'),'original.html',()=>({mode:guide.getState().mode,index:guide.getState().index,chapter:window.lakeStory.getState().stage,month:window.lakeProcess.state.date}));
  d.querySelector('.dialog-head button').onclick=()=>d.close();d.querySelector('[data-history]').onclick=()=>{d.close();window.lakeReader.open({mode:'history'});};d.onclose=()=>{unbind();d.remove();};document.body.append(d);d.showModal();
 };
}
